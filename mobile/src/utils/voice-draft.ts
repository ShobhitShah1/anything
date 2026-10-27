export interface VoiceDraft {
  prefix: string;
  committed: string;
  text: string;
}

export function applyVoiceResult(
  draft: VoiceDraft,
  transcript: string,
  isFinal: boolean,
): VoiceDraft {
  const phrase = transcript.trim();
  if (!phrase) return draft;
  const spoken = [draft.committed, phrase].filter(Boolean).join(' ');
  return {
    prefix: draft.prefix,
    committed: isFinal ? spoken : draft.committed,
    text: draft.prefix + (draft.prefix && !draft.prefix.endsWith('\n') ? '\n' : '') + spoken,
  };
}

export function voiceEndMessage(started: boolean, resultEvents: number, reason: string): string {
  if (reason || resultEvents > 0) return '';
  return started
    ? 'The speech service ended without text. Check microphone access and try again.'
    : 'The speech service stopped before the microphone was ready. Check your phone’s speech service and try again.';
}

export function shouldCancelForBackground(
  permissionPending: boolean,
  recognizing: boolean,
): boolean {
  return !permissionPending || recognizing;
}
