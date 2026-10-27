import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";
import { firebase, encodeUsage, decodeUsage } from "./firebase.ts";

const pair = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64")}\n-----END PRIVATE KEY-----`;
const env = {
  FIREBASE_PROJECT_ID: "test-project",
  FIREBASE_API_KEY: "public-test",
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    project_id: "test-project",
    client_email: "worker@test-project.iam.gserviceaccount.com",
    private_key: pem,
  }),
  GROQ_API_KEYS: "gsk_test1234567890123",
  REVENUECAT_SECRET_API_KEY: "test-secret",
};
const request = (action = "generate", token = "valid") =>
  new Request("https://example.com/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      action,
      messages: [{ role: "user", content: "Write a note" }],
    }),
  });
const event = (content, finish_reason = null) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason }] })}\n\n`;

let fixture = 0;
function upstream(initial = {}) {
  env.GROQ_API_KEYS = `gsk_case${++fixture}abcdefghijklmnop`;
  let fields = initial === null ? null : encodeUsage(initial);
  let version = 1;
  let calls = 0;
  let fail = false;
  const mock = async (input, options) => {
    const url = new URL(String(input));
    if (url.hostname === "identitytoolkit.googleapis.com") {
      const token = JSON.parse(options.body).idToken;
      return token === "valid"
        ? Response.json({
            users: [
              {
                localId: "uid",
                providerUserInfo: [{ providerId: "google.com" }],
              },
            ],
          })
        : Response.json({ error: {} }, { status: 400 });
    }
    if (url.hostname === "oauth2.googleapis.com")
      return Response.json({ access_token: "server-token", expires_in: 3600 });
    if (url.hostname === "api.revenuecat.com")
      return Response.json({ subscriber: { entitlements: {} } });
    if (url.hostname === "firestore.googleapis.com") {
      if (options.method === "PATCH") {
        if (
          fields
            ? url.searchParams.get("currentDocument.updateTime") !==
              String(version)
            : url.searchParams.get("currentDocument.exists") !== "false"
        )
          return Response.json(
            { error: { status: "FAILED_PRECONDITION" } },
            { status: 412 },
          );
        fields = JSON.parse(options.body).fields;
        version++;
      }
      return fields
        ? Response.json({ fields, updateTime: String(version) })
        : Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 });
    }
    if (url.hostname === "api.groq.com") {
      calls++;
      if (fail) return new Response("", { status: 500 });
      return new Response(
        event("A useful draft.") + event("", "stop") + "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }
    throw new Error("Unexpected endpoint");
  };
  return {
    mock,
    usage: () => decodeUsage(fields || {}),
    calls: () => calls,
    fail: () => {
      fail = true;
    },
  };
}
async function invoke(req) {
  const pending = [];
  const response = await worker.fetch(req, env, {
    waitUntil: (task) => pending.push(task),
  });
  const text = await response.text();
  await Promise.all(pending);
  return { response, text };
}

test("worker denies absent and invalid identity before generation", async (t) => {
  const source = upstream();
  t.mock.method(globalThis, "fetch", source.mock);
  for (const token of ["", "forged"])
    assert.equal(
      (await invoke(request("generate", token))).response.status,
      401,
    );
  assert.equal(source.calls(), 0);
  assert.equal(
    (await invoke(new Request("https://example.com/ai"))).response.status,
    405,
  );
});
test("three successful responses are enforced through Firestore, then a paywall response", async (t) => {
  const source = upstream();
  t.mock.method(globalThis, "fetch", source.mock);
  for (let i = 0; i < 3; i++) {
    const result = await invoke(request());
    assert.equal(result.response.status, 200);
    assert.match(result.text, /A useful draft/);
    assert.match(result.text, /\[DONE\]/);
  }
  assert.equal(source.usage().freeUsed, 3);
  assert.equal(source.calls(), 3);
  const denied = await invoke(request());
  assert.equal(denied.response.status, 402);
  assert.equal(JSON.parse(denied.text).error, "subscription_required");
});
test("parallel requests cannot spend the final free response twice", async (t) => {
  const source = upstream({ freeUsed: 2 });
  t.mock.method(globalThis, "fetch", source.mock);
  const responses = await Promise.all(
    Array.from({ length: 4 }, () => invoke(request())),
  );
  assert.equal(responses.filter((r) => r.response.status === 200).length, 1);
  assert.equal(source.usage().freeUsed, 3);
  assert.equal(source.calls(), 1);
});
test("failed upstream generation releases the reservation and preserves free allowance", async (t) => {
  const source = upstream();
  source.fail();
  t.mock.method(globalThis, "fetch", source.mock);
  const result = await invoke(request());
  assert.match(result.text, /error/);
  assert.equal(source.usage().freeUsed, 0);
  assert.equal(source.usage().pending, null);
});
test("Firestore field mapping preserves quota and reservation data", () => {
  const value = {
    freeUsed: 3,
    paidUsed: 7,
    month: "2026-10",
    pending: { id: "request", until: 12345 },
  };
  assert.deepEqual(decodeUsage(encodeUsage(value)), value);
});
test("Firestore writes retry a stale revision instead of overwriting another request", async () => {
  let writes = 0;
  let reads = 0;
  const source = upstream();
  const mock = async (input, options) => {
    if (String(input).includes("firestore.googleapis.com")) {
      if (options.method === "PATCH" && ++writes === 1)
        return Response.json({ error: { status: "ABORTED" } }, { status: 409 });
      if (!options.method) reads++;
    }
    return source.mock(input, options);
  };
  await firebase(env, mock).update("uid", (usage) => ({
    ...usage,
    freeUsed: (usage.freeUsed || 0) + 1,
  }));
  assert.equal(writes, 2);
  assert.equal(reads, 2);
  assert.equal(source.usage().freeUsed, 1);
});

test("new-account document creation uses a precondition and retries creation races", async () => {
  const source = upstream(null);
  const client = firebase(env, source.mock);
  await Promise.all(
    [1, 2].map(() =>
      client.update("uid", (usage) => ({
        ...usage,
        freeUsed: (usage.freeUsed || 0) + 1,
      })),
    ),
  );
  assert.equal(source.usage().freeUsed, 2);
});
test("oversized requests stop before provider or quota writes", async (t) => {
  const source = upstream();
  t.mock.method(globalThis, "fetch", source.mock);
  const response = await invoke(
    new Request("https://example.com/ai", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid",
        "Content-Type": "application/json",
      },
      body: "x".repeat(170001),
    }),
  );
  assert.equal(response.response.status, 413);
  assert.equal(source.calls(), 0);
  assert.equal(source.usage().freeUsed, 0);
});
test("response text arrives progressively, and success is charged before the terminal event", async (t) => {
  const source = upstream();
  const encoder = new TextEncoder();
  let complete;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(event("First")));
      complete = () => {
        controller.enqueue(
          encoder.encode(
            event(" second") + event("", "stop") + "data: [DONE]\n\n",
          ),
        );
        controller.close();
      };
    },
  });
  t.mock.method(globalThis, "fetch", async (url, init) =>
    String(url).includes("api.groq.com")
      ? new Response(body, { headers: { "Content-Type": "text/event-stream" } })
      : source.mock(url, init),
  );
  const pending = [];
  const response = await worker.fetch(request(), env, {
    waitUntil: (task) => pending.push(task),
  });
  const reader = response.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /First/);
  assert.equal(source.usage().freeUsed, 0);
  assert.ok(source.usage().pending);
  complete();
  let rest = "";
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    rest += new TextDecoder().decode(next.value);
  }
  await Promise.all(pending);
  assert.match(rest, /second/);
  assert.match(rest, /\[DONE\]/);
  assert.equal(source.usage().freeUsed, 1);
  assert.equal(source.usage().pending, null);
});


test("a verified store subscription unlocks the paid quota and never spends free allowance", async (t) => {
  const source = upstream({ freeUsed: 3 });
  t.mock.method(globalThis, "fetch", async (input, options) => {
    if (new URL(String(input)).hostname === "api.revenuecat.com")
      return Response.json({ subscriber: {
        entitlements: { anything_pro: { product_identifier: "pro_monthly", expires_date: new Date(Date.now() + 86400000).toISOString() } },
        subscriptions: { pro_monthly: { is_sandbox: false } },
      } });
    return source.mock(input, options);
  });
  const status = await invoke(request("status"));
  assert.equal(status.response.status, 200);
  assert.equal(JSON.parse(status.text).paid, true);
  assert.equal(JSON.parse(status.text).limit, 100);
  const answer = await invoke(request());
  assert.equal(answer.response.status, 200);
  assert.equal(source.usage().paidUsed, 1);
  assert.equal(source.usage().freeUsed, 3);
});

test("sandbox subscriptions cannot grant production access, and billing outages do not spend quota", async (t) => {
  const source = upstream({ freeUsed: 3 });
  let unavailable = false;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    if (new URL(String(input)).hostname === "api.revenuecat.com")
      return unavailable ? new Response("", { status: 503 }) : Response.json({ subscriber: {
        entitlements: { anything_pro: { product_identifier: "test_pro", expires_date: null } },
        subscriptions: { test_pro: { is_sandbox: true } },
      } });
    return source.mock(input, options);
  });
  const sandbox = await invoke(request());
  assert.equal(sandbox.response.status, 402);
  assert.equal(source.calls(), 0);
  unavailable = true;
  const outage = await invoke(request());
  assert.equal(outage.response.status, 503);
  assert.equal(JSON.parse(outage.text).error, "billing_unavailable");
  assert.equal(source.usage().freeUsed, 3);
  assert.equal(source.calls(), 0);
});


test("expiry and renewal are rechecked on each request without trusting a stale app flag", async (t) => {
  const source = upstream({ freeUsed: 3, paidUsed: 5, month: new Date().toISOString().slice(0, 7) });
  let active = true;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    if (new URL(String(input)).hostname === "api.revenuecat.com")
      return Response.json({ subscriber: {
        entitlements: { anything_pro: { product_identifier: "monthly", expires_date: new Date(Date.now() + (active ? 86400000 : -86400000)).toISOString() } },
        subscriptions: { monthly: { is_sandbox: false } },
      } });
    return source.mock(input, options);
  });
  assert.equal(JSON.parse((await invoke(request("status"))).text).paid, true);
  active = false;
  assert.equal(JSON.parse((await invoke(request("status"))).text).paid, false);
  assert.equal((await invoke(request())).response.status, 402);
  active = true;
  const renewed = JSON.parse((await invoke(request("status"))).text);
  assert.equal(renewed.paid, true);
  assert.equal(renewed.used, 5);
  assert.equal(source.calls(), 0);
});
