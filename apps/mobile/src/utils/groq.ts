export type AiMessage = { role: 'user' | 'assistant'; content: string };
export type AiAnswer = { content: string; searched: boolean; truncated: boolean };

const outputLimit = 48000;

export async function readChatStream(
  response: Response,
  onText: (text: string) => void,
  signal: AbortSignal,
) {
  if (!response.body) throw new Error('AI returned no response stream. Please try again.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data = '';
  let content = '';
  let finished = false;
  let stopped = false;
  let truncated = false;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', abort);
  const line = (value: string) => {
    if (value.startsWith('data:')) {
      data += (data ? '\n' : '') + value.slice(5).replace(/^ /, '');
      if (data.length > 256000) throw new Error('AI returned an invalid response.');
      return;
    }
    if (value || !data) return;
    const payload = data;
    data = '';
    if (payload.trim() === '[DONE]') {
      finished = true;
      stopped = true;
      return;
    }
    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      throw new Error('AI returned an invalid response. Your partial draft is kept.');
    }
    if (!event || typeof event !== 'object') throw new Error('AI returned an invalid response.');
    if (event.error) throw new Error('AI generation failed. Your partial draft is kept.');
    const choice = event.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === 'string' && delta) {
      content += delta;
      if (content.length > outputLimit) {
        content = content.slice(0, outputLimit).replace(/[\uD800-\uDBFF]$/, '');
        truncated = true;
        finished = true;
        stopped = true;
      }
      onText(content);
    }
    if (choice?.finish_reason) {
      finished = true;
      truncated ||= choice.finish_reason === 'length';
    }
  };
  try {
    while (!stopped) {
      if (signal.aborted) throw new Error('Request stopped. Your draft is still here.');
      const { value, done } = await reader.read();
      if (signal.aborted) throw new Error('Request stopped. Your draft is still here.');
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let end;
      while (!stopped && (end = buffer.indexOf('\n')) !== -1) {
        line(buffer.slice(0, end).replace(/\r$/, ''));
        buffer = buffer.slice(end + 1);
      }
      if (buffer.length > 256000) throw new Error('AI returned an invalid response.');
      if (done) {
        if (buffer) line(buffer.replace(/\r$/, ''));
        if (data) line('');
        break;
      }
    }
    if (!finished) throw new Error('AI stream was interrupted. Your partial draft is kept.');
    if (!content.trim()) throw new Error('AI returned no answer. Please try again.');
    return { content, truncated };
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
