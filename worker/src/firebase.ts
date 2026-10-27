import { AccessError, type Usage } from "./access.ts";

export type FirebaseEnv = {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_API_KEY: string;
  FIREBASE_SERVICE_ACCOUNT: string;
};

let credential:
  | {
      raw: string;
      email: string;
      key: CryptoKey;
      token: string;
      until: number;
      pending?: Promise<string>;
    }
  | undefined;
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

async function accessToken(env: FirebaseEnv, fetchImpl: typeof fetch) {
  if (!credential || credential.raw !== env.FIREBASE_SERVICE_ACCOUNT) {
    const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    if (
      account.project_id !== env.FIREBASE_PROJECT_ID ||
      !account.client_email ||
      typeof account.private_key !== "string"
    )
      throw new Error("Invalid server credentials");
    const der = Uint8Array.from(
      atob(account.private_key.replace(/-----[^-]+-----|\s/g, "")),
      (c) => c.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    credential = {
      raw: env.FIREBASE_SERVICE_ACCOUNT,
      email: account.client_email,
      key,
      token: "",
      until: 0,
    };
  }
  const current = credential;
  if (current.until > Date.now()) return current.token;
  if (current.pending) return current.pending;
  current.pending = (async () => {
    const encode = (value: object) =>
      base64url(new TextEncoder().encode(JSON.stringify(value)));
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: current.email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      current.key,
      new TextEncoder().encode(unsigned),
    );
    const response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Could not authorize usage storage");
    const result = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!result.access_token) throw new Error("Missing storage authorization");
    current.token = result.access_token;
    current.until =
      Date.now() + (Math.min(result.expires_in || 3600, 3600) - 60) * 1000;
    return current.token;
  })();
  try {
    return await current.pending;
  } finally {
    current.pending = undefined;
  }
}

type Field = {
  integerValue?: string;
  stringValue?: string;
  nullValue?: null;
  mapValue?: { fields: Record<string, Field> };
};
export function encodeUsage(usage: Usage): Record<string, Field> {
  return {
    freeUsed: { integerValue: String(usage.freeUsed || 0) },
    paidUsed: { integerValue: String(usage.paidUsed || 0) },
    month: { stringValue: usage.month || "" },
    pending: usage.pending
      ? {
          mapValue: {
            fields: {
              id: { stringValue: usage.pending.id },
              until: { integerValue: String(usage.pending.until) },
            },
          },
        }
      : { nullValue: null },
  };
}
export function decodeUsage(fields: Record<string, Field> = {}): Usage {
  const pending = fields.pending?.mapValue?.fields;
  return {
    freeUsed: Number(fields.freeUsed?.integerValue || 0),
    paidUsed: Number(fields.paidUsed?.integerValue || 0),
    month: fields.month?.stringValue || "",
    pending: pending
      ? {
          id: pending.id?.stringValue || "",
          until: Number(pending.until?.integerValue || 0),
        }
      : null,
  };
}

export function firebase(env: FirebaseEnv, fetchImpl: typeof fetch = fetch) {
  const documentUrl = (uid: string) =>
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/aiUsage/${encodeURIComponent(uid)}`;
  const headers = async () => ({
    Authorization: `Bearer ${await accessToken(env, fetchImpl)}`,
    "Content-Type": "application/json",
  });
  async function read(uid: string) {
    const response = await fetchImpl(documentUrl(uid), {
      headers: await headers(),
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) return { usage: {} as Usage, updateTime: "" };
    if (!response.ok) throw new Error("Could not load AI usage");
    const result = (await response.json()) as {
      fields?: Record<string, Field>;
      updateTime: string;
    };
    if (!result.updateTime) throw new Error("Invalid usage storage response");
    return { usage: decodeUsage(result.fields), updateTime: result.updateTime };
  }
  return {
    async identify(token: string) {
      const response = await fetchImpl(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) {
        if (response.status >= 500 || response.status === 429)
          throw new AccessError(
            "auth_unavailable",
            "Could not check your account. Please try again.",
            503,
          );
        throw new AccessError(
          "sign_in_required",
          "Sign in again to use AI.",
          401,
        );
      }
      const result = (await response.json()) as {
        users?: {
          localId?: string;
          disabled?: boolean;
          providerUserInfo?: { providerId: string }[];
        }[];
      };
      const user = result.users?.[0];
      if (
        !user?.localId ||
        !/^[^/]{1,128}$/.test(user.localId) ||
        user.disabled ||
        !user.providerUserInfo?.some(
          (provider) => provider.providerId === "google.com",
        )
      )
        throw new AccessError(
          "sign_in_required",
          "Sign in with Google to use AI.",
          401,
        );
      return user.localId;
    },
    read,
    async update(uid: string, update: (usage: Usage) => Usage) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const snapshot = await read(uid);
        const next = update(snapshot.usage);
        if (next === snapshot.usage) return;
        const condition = snapshot.updateTime
          ? `currentDocument.updateTime=${encodeURIComponent(snapshot.updateTime)}`
          : "currentDocument.exists=false";
        const response = await fetchImpl(`${documentUrl(uid)}?${condition}`, {
          method: "PATCH",
          headers: await headers(),
          body: JSON.stringify({ fields: encodeUsage(next) }),
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) return;
        const error = (await response.json().catch(() => ({}))) as {
          error?: { status?: string };
        };
        if (
          ![409, 412].includes(response.status) &&
          !["FAILED_PRECONDITION", "ABORTED", "ALREADY_EXISTS"].includes(
            error.error?.status || "",
          )
        )
          throw new Error("Could not save AI usage");
      }
      throw new AccessError(
        "busy",
        "Another AI request is updating your account. Please try again.",
        409,
      );
    },
  };
}
