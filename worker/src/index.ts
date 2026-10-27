import {
  AccessError,
  allowance,
  finish,
  hasEntitlement,
  reserve,
} from "./access.ts";
import {
  createGroq,
  parseKeys,
  validateMessages,
  type AiMessage,
} from "./groq.ts";
import { firebase, type FirebaseEnv } from "./firebase.ts";

export type Env = FirebaseEnv & {
  GROQ_API_KEYS: string;
  REVENUECAT_SECRET_API_KEY: string;
  ALLOW_SANDBOX_PURCHASES?: string;
};
let engine: ReturnType<typeof createGroq> | undefined;
let configuration = "";

export async function isPaid(
  uid: string,
  env: Env,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
    {
      headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (response.status === 404) return false;
  if (!response.ok)
    throw new AccessError(
      "billing_unavailable",
      "Could not verify your subscription. Please try again.",
      503,
    );
  const result = (await response.json()) as { subscriber?: unknown };
  return hasEntitlement(
    result.subscriber,
    Date.now(),
    env.ALLOW_SANDBOX_PURCHASES === "true",
  );
}

const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export default {
  async fetch(
    request: Request,
    env: Env,
    context: Pick<ExecutionContext, "waitUntil">,
  ): Promise<Response> {
    if (new URL(request.url).pathname !== "/ai")
      return json({ error: "not_found" }, 404);
    if (request.method !== "POST")
      return json({ error: "method_not_allowed" }, 405);
    let uid = "";
    let stage = "authentication";
    let reservation: { id: string; paid: boolean; at: number } | undefined;
    let settled = false;
    const fb = firebase(env);
    const settle = async (success: boolean) => {
      if (!reservation || settled) return;
      const current = reservation;
      await fb.update(uid, (usage) =>
        finish(usage, current.paid, current.id, current.at, success),
      );
      settled = true;
    };
    try {
      const token = request.headers
        .get("Authorization")
        ?.match(/^Bearer (.+)$/)?.[1];
      if (!token)
        throw new AccessError(
          "sign_in_required",
          "Sign in to use your three free AI responses.",
          401,
        );
      uid = await fb.identify(token);
      if (!request.headers.get("Content-Type")?.startsWith("application/json"))
        throw new AccessError(
          "invalid_request",
          "Send an AI request as JSON.",
          400,
        );
      const reader = request.body?.getReader();
      if (!reader)
        throw new AccessError("invalid_request", "Invalid AI request.", 400);
      let raw = "";
      let bytes = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) {
            raw += decoder.decode();
            break;
          }
          bytes += chunk.value.byteLength;
          if (bytes > 170_000)
            throw new AccessError(
              "invalid_request",
              "Send a shorter AI request.",
              413,
            );
          raw += decoder.decode(chunk.value, { stream: true });
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new AccessError("invalid_request", "Invalid AI request.", 400);
      }
      if (!body || !["status", "generate"].includes(body.action))
        throw new AccessError("invalid_request", "Invalid AI request.", 400);
      let messages: AiMessage[] = [];
      if (body.action === "generate") {
        if (
          !Array.isArray(body.messages) ||
          body.messages.some(
            (m: unknown) =>
              !m ||
              typeof m !== "object" ||
              typeof (m as AiMessage).content !== "string",
          )
        )
          throw new AccessError("invalid_request", "Invalid AI messages.", 400);
        messages = body.messages.map((m: AiMessage) => ({
          role: m.role,
          content: m.content,
        }));
        try {
          validateMessages(messages);
        } catch (error) {
          throw new AccessError(
            "invalid_request",
            (error as Error).message,
            400,
          );
        }
      }
      stage = "usage_storage";
      const usage = (await fb.read(uid)).usage;
      let paid = false;
      stage = "subscription_verification";
      try {
        paid = await isPaid(uid, env);
      } catch (error) {
        if (!allowance(usage, false, Date.now()).remaining) throw error;
      }
      if (body.action === "status")
        return json(allowance(usage, paid, Date.now()));
      stage = "usage_reservation";
      let at = Date.now();
      const id = crypto.randomUUID();
      await fb.update(uid, (value) => {
        at = Date.now();
        return reserve(value, paid, id, at);
      });
      reservation = { id, paid, at };
      stage = "provider_configuration";
      if (!engine || configuration !== env.GROQ_API_KEYS) {
        engine = createGroq(parseKeys(env.GROQ_API_KEYS));
        configuration = env.GROQ_API_KEYS;
      }
      const client = engine;
      const encoder = new TextEncoder();
      let closed = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (event: unknown) => {
            if (closed) return;
            try {
              controller.enqueue(
                encoder.encode(
                  `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`,
                ),
              );
            } catch {
              closed = true;
            }
          };
          context.waitUntil(
            (async () => {
              let previous = "";
              let paintedAt = 0;
              const publish = (content: string) => {
                if (content.length === previous.length) return;
                send({
                  choices: [
                    { delta: { content: content.slice(previous.length) } },
                  ],
                });
                previous = content;
                paintedAt = Date.now();
              };
              try {
                const answer = await client.chat(
                  messages,
                  body.search !== false,
                  AbortSignal.timeout(70_000),
                  (content) => {
                    if (!previous || Date.now() - paintedAt >= 40)
                      publish(content);
                  },
                );
                publish(answer.content);
                await settle(true);
                send({
                  choices: [
                    {
                      delta: {},
                      finish_reason: answer.truncated ? "length" : "stop",
                    },
                  ],
                });
                send("[DONE]");
              } catch {
                console.warn("AI generation failed", { stage: "provider_stream" });
                try {
                  await settle(false);
                } catch {
                  console.error("AI reservation release failed");
                }
                send({
                  error: {
                    message:
                      "AI generation failed. Your partial draft is kept.",
                  },
                });
              } finally {
                if (!closed) controller.close();
                closed = true;
              }
            })(),
          );
        },
        cancel() {
          closed = true;
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      try {
        await settle(false);
      } catch {
        console.error("AI reservation release failed");
      }
      const known = error instanceof AccessError;
      console.warn("AI request failed", {
        stage,
        code: known ? error.code : "unavailable",
        firebaseProjectConfigured: !!env.FIREBASE_PROJECT_ID,
        firebaseApiKeyConfigured: !!env.FIREBASE_API_KEY,
        serviceAccountConfigured: !!env.FIREBASE_SERVICE_ACCOUNT,
        groqKeysConfigured: !!env.GROQ_API_KEYS,
        billingKeyConfigured: !!env.REVENUECAT_SECRET_API_KEY,
      });
      return json(
        {
          error: known ? error.code : "unavailable",
          message: known
            ? error.message
            : "AI is temporarily unavailable. Please try again.",
        },
        known ? error.status : 503,
      );
    }
  },
};
