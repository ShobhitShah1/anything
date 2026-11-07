import {
  AccessError,
  allowance,
  entitlementId,
  finish,
  hasEntitlement,
  reserve,
} from './access.ts';
import { createGroq, parseKeys, validateMessages, type AiMessage } from './groq.ts';
import { firebase, type FirebaseEnv } from './firebase.ts';

export type Env = FirebaseEnv & {
  GROQ_API_KEYS: string;
  REVENUECAT_SECRET_API_KEY: string;
  ALLOW_SANDBOX_PURCHASES?: string;
  ADMIN_CONSOLE_ORIGINS?: string;
};
let engine: ReturnType<typeof createGroq> | undefined;
let configuration = '';
const consoleOwnerUid = '28J4d7cdG9W7az1zZu6x4O5INbp1';

async function subscription(uid: string, env: Env, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
    {
      headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (response.status === 404)
    return { paid: false, expiresAt: null, gracePeriodExpiresAt: null, productIdentifier: null };
  if (!response.ok)
    throw new AccessError(
      'billing_unavailable',
      'Could not verify your subscription. Please try again.',
      503,
    );
  const result = (await response.json()) as {
    subscriber?: {
      entitlements?: Record<
        string,
        {
          expires_date?: string | null;
          grace_period_expires_date?: string | null;
          product_identifier?: string;
        }
      >;
    };
  };
  const entitlement = result.subscriber?.entitlements?.[entitlementId];
  return {
    paid: hasEntitlement(result.subscriber, Date.now(), env.ALLOW_SANDBOX_PURCHASES === 'true'),
    expiresAt: entitlement?.expires_date ?? null,
    gracePeriodExpiresAt: entitlement?.grace_period_expires_date ?? null,
    productIdentifier: entitlement?.product_identifier ?? null,
  };
}

const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export default {
  async fetch(
    request: Request,
    env: Env,
    context: Pick<ExecutionContext, 'waitUntil'>,
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowedOrigins = (env.ADMIN_CONSOLE_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const originAllowed = !!origin && allowedOrigins.includes(origin);
    const corsHeaders = originAllowed
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        }
      : undefined;
    const withCors = (response: Response) => {
      if (!corsHeaders) return response;
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };
    const reply = (body: object, status = 200) => withCors(json(body, status));
    if (request.method === 'OPTIONS')
      return originAllowed
        ? new Response(null, { status: 204, headers: corsHeaders })
        : new Response(null, { status: 403 });
    if (new URL(request.url).pathname !== '/ai') return reply({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    let uid = '';
    let stage = 'authentication';
    let reservation: { id: string; paid: boolean; at: number } | undefined;
    let settled = false;
    const fb = firebase(env);
    const settle = async (success: boolean) => {
      if (!reservation || settled) return;
      const current = reservation;
      await fb.update(uid, (usage) => finish(usage, current.paid, current.id, current.at, success));
      settled = true;
    };
    try {
      const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
      if (!token)
        throw new AccessError(
          'sign_in_required',
          'Sign in to use your three free AI responses.',
          401,
        );
      uid = await fb.identify(token);
      if (!request.headers.get('Content-Type')?.startsWith('application/json'))
        throw new AccessError('invalid_request', 'Send an AI request as JSON.', 400);
      const reader = request.body?.getReader();
      if (!reader) throw new AccessError('invalid_request', 'Invalid AI request.', 400);
      let raw = '';
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
            throw new AccessError('invalid_request', 'Send a shorter AI request.', 413);
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
        throw new AccessError('invalid_request', 'Invalid AI request.', 400);
      }
      if (!body || !['status', 'generate', 'admin_status'].includes(body.action))
        throw new AccessError('invalid_request', 'Invalid AI request.', 400);
      if (body.action === 'admin_status') {
        if (uid !== consoleOwnerUid)
          throw new AccessError('admin_required', 'Owner access is required.', 403);
        if (typeof body.uid !== 'string' || !/^[^/]{1,128}$/.test(body.uid))
          throw new AccessError('invalid_request', 'Choose a valid account.', 400);
        stage = 'usage_storage';
        const usage = (await fb.read(body.uid)).usage;
        stage = 'subscription_verification';
        const billing = await subscription(body.uid, env);
        return reply({ ...allowance(usage, billing.paid, Date.now()), subscription: billing });
      }
      let messages: AiMessage[] = [];
      if (body.action === 'generate') {
        if (
          !Array.isArray(body.messages) ||
          body.messages.some(
            (m: unknown) =>
              !m || typeof m !== 'object' || typeof (m as AiMessage).content !== 'string',
          )
        )
          throw new AccessError('invalid_request', 'Invalid AI messages.', 400);
        messages = body.messages.map((m: AiMessage) => ({
          role: m.role,
          content: m.content,
        }));
        try {
          validateMessages(messages);
        } catch (error) {
          throw new AccessError('invalid_request', (error as Error).message, 400);
        }
      }
      stage = 'usage_storage';
      const usage = (await fb.read(uid)).usage;
      let paid = false;
      let billing: Awaited<ReturnType<typeof subscription>> = {
        paid: false,
        expiresAt: null,
        gracePeriodExpiresAt: null,
        productIdentifier: null,
      };
      stage = 'subscription_verification';
      try {
        billing = await subscription(uid, env);
        paid = billing.paid;
      } catch (error) {
        if (!allowance(usage, false, Date.now()).remaining) throw error;
      }
      if (body.action === 'status')
        return reply({ ...allowance(usage, paid, Date.now()), subscription: billing });
      stage = 'usage_reservation';
      let at = Date.now();
      const id = crypto.randomUUID();
      await fb.update(uid, (value) => {
        at = Date.now();
        return reserve(value, paid, id, at);
      });
      reservation = { id, paid, at };
      stage = 'provider_configuration';
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
                  `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`,
                ),
              );
            } catch {
              closed = true;
            }
          };
          context.waitUntil(
            (async () => {
              let previous = '';
              let paintedAt = 0;
              const publish = (content: string) => {
                if (content.length === previous.length) return;
                send({
                  choices: [{ delta: { content: content.slice(previous.length) } }],
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
                    if (!previous || Date.now() - paintedAt >= 40) publish(content);
                  },
                );
                publish(answer.content);
                await settle(true);
                send({
                  choices: [
                    {
                      delta: {},
                      finish_reason: answer.truncated ? 'length' : 'stop',
                    },
                  ],
                });
                send('[DONE]');
              } catch {
                console.warn('AI generation failed', { stage: 'provider_stream' });
                try {
                  await settle(false);
                } catch {
                  console.error('AI reservation release failed');
                }
                send({
                  error: {
                    message: 'AI generation failed. Your partial draft is kept.',
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
      return withCors(
        new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-store',
          },
        }),
      );
    } catch (error) {
      try {
        await settle(false);
      } catch {
        console.error('AI reservation release failed');
      }
      const known = error instanceof AccessError;
      console.warn('AI request failed', {
        stage,
        code: known ? error.code : 'unavailable',
        firebaseProjectConfigured: !!env.FIREBASE_PROJECT_ID,
        firebaseApiKeyConfigured: !!env.FIREBASE_API_KEY,
        serviceAccountConfigured: !!env.FIREBASE_SERVICE_ACCOUNT,
        groqKeysConfigured: !!env.GROQ_API_KEYS,
        billingKeyConfigured: !!env.REVENUECAT_SECRET_API_KEY,
      });
      return reply(
        {
          error: known ? error.code : 'unavailable',
          message: known ? error.message : 'AI is temporarily unavailable. Please try again.',
        },
        known ? error.status : 503,
      );
    }
  },
};
