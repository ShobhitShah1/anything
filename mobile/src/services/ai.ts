import { fetch } from 'expo/fetch';
import { auth } from './auth';
import { readChatStream, type AiMessage, type AiAnswer } from '../utils/groq';

export type AiAccess = {
  paid: boolean;
  used: number;
  limit: number;
  remaining: number;
  month: string;
};
export class AiAccessError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request(
  body: { action: 'status' | 'generate'; messages?: AiMessage[]; search?: boolean },
  signal: AbortSignal,
) {
  const started = Date.now();
  let stage = 'configuration';
  let status: number | undefined;
  try {
    const configured = process.env.EXPO_PUBLIC_AI_URL?.trim();
    let url: URL;
    try {
      url = new URL(configured || '');
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/ai' ||
        url.search ||
        url.hash
      )
        throw new Error('Invalid AI endpoint');
    } catch {
      throw new AiAccessError(
        'configuration_missing',
        __DEV__
          ? 'AI setup: set EXPO_PUBLIC_AI_URL in mobile/.env to your HTTPS Worker URL ending in /ai, then fully reload the app. Provider keys belong in Cloudflare secrets.'
          : 'AI is not configured for this build. Please contact support.',
      );
    }
    if (__DEV__)
      console.info('[Anything AI] request started', { action: body.action, host: url.hostname });
    stage = 'sign_in';
    const user = auth?.currentUser;
    if (!user)
      throw new AiAccessError('sign_in_required', 'Sign in to try three AI responses for free.');
    stage = 'firebase_token';
    const token = await user.getIdToken();
    stage = 'network';
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    status = response.status;
    stage = 'backend_response';
    if (__DEV__)
      console.info('[Anything AI] response received', {
        action: body.action,
        status,
        elapsedMs: Date.now() - started,
      });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new AiAccessError(
        typeof result?.error === 'string' ? result.error : 'unavailable',
        typeof result?.message === 'string'
          ? result.message
          : `AI server returned HTTP ${status}. Please try again.`,
      );
    }
    return response;
  } catch (error) {
    // Never log raw errors, request bodies, tokens, or full URLs: they can contain private data.
    if (__DEV__)
      console.warn('[Anything AI] request failed', {
        action: body.action,
        stage,
        status,
        aborted: signal.aborted,
        elapsedMs: Date.now() - started,
      });
    if (stage === 'network' && !signal.aborted)
      throw new AiAccessError(
        'network_error',
        'Could not reach the AI server. Check your connection and Worker URL, then try again.',
      );
    throw error;
  }
}

export async function getAiAccess(signal: AbortSignal): Promise<AiAccess> {
  return (
    await request({ action: 'status' }, AbortSignal.any([signal, AbortSignal.timeout(15000)]))
  ).json();
}

export function aiClient() {
  return {
    async chat(
      messages: AiMessage[],
      search: boolean,
      signal: AbortSignal,
      onText?: (text: string) => void,
    ): Promise<AiAnswer> {
      const response = await request({ action: 'generate', messages, search }, signal);
      try {
        const answer = await readChatStream(response, onText || (() => {}), signal);
        if (__DEV__)
          console.info('[Anything AI] generation completed', { truncated: answer.truncated });
        return { ...answer, searched: search };
      } catch (error) {
        if (__DEV__) console.warn('[Anything AI] stream failed', { aborted: signal.aborted });
        throw error;
      }
    },
  };
}
