import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import {
  applyVoiceResult,
  shouldCancelForBackground,
  voiceEndMessage,
  type VoiceDraft,
} from '../utils/voice-draft';
import { randomUUID } from 'expo-crypto';
import { aiClient, AiAccessError } from '../services/ai';
import { router } from 'expo-router';
import { useCollection } from '../state/collection';

const recognition =
  requireOptionalNativeModule<typeof ExpoSpeechRecognitionModule>('ExpoSpeechRecognition');

export function useQuickAi(active: boolean, text: string, setText: (text: string) => void) {
  const state = useCollection();
  const [enabled, setEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const voiceLevel = useSharedValue(0);
  const [phase, setPhase] = useState<
    'idle' | 'starting' | 'listening' | 'finishing' | 'thinking' | 'streaming'
  >('idle');
  const [generated, setGenerated] = useState<{
    prompt: string;
    id: string;
    truncated?: boolean;
  } | null>(null);
  const request = useRef<AbortController | null>(null);
  const stream = useRef<{
    prompt: string;
    id: string;
    content: string;
    paintedAt: number;
  } | null>(null);
  const paintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recognizing = useRef(false);
  const voiceDraft = useRef<VoiceDraft | null>(null);
  const voiceBusy = useRef(false);
  const permissionPending = useRef(false);
  const live = useRef(true);
  const voiceSession = useRef({
    id: 0,
    requestedAt: 0,
    started: false,
    resultEvents: 0,
    reason: '',
  });
  const logVoice = useCallback(
    (event: string, details: Record<string, string | number | boolean | null | undefined> = {}) => {
      const session = voiceSession.current;
      // Never log transcripts, draft contents, or account credentials.
      console.info('[dictation]', {
        event,
        session: session.id,
        elapsedMs: session.requestedAt ? Date.now() - session.requestedAt : 0,
        ...details,
      });
    },
    [],
  );
  const cancel = (reason = 'user') => {
    if (recognizing.current || voiceBusy.current) {
      voiceSession.current.reason = reason;
      logVoice('cancel', { reason });
    }
    request.current?.abort();
    request.current = null;
    clearTimeout(paintTimer.current);
    paintTimer.current = undefined;
    const draft = stream.current;
    stream.current = null;
    if (draft?.content) {
      setText(draft.content);
      setGenerated({ prompt: draft.prompt, id: draft.id });
      setEnabled(false);
    }
    cancelAnimation(voiceLevel);
    voiceLevel.set(0);
    if (recognizing.current) {
      recognizing.current = false;
      recognition?.abort();
    }
    setPhase('idle');
  };
  const cancelEffect = useEffectEvent(cancel);
  useEffect(() => {
    if (!active) cancelEffect('capture-closed');
  }, [active]);
  useEffect(() => {
    live.current = true;
    const subscription = AppState.addEventListener('change', (value) => {
      if (recognizing.current || voiceBusy.current) logVoice('app-state', { state: value });
      if (value === 'background') {
        if (shouldCancelForBackground(permissionPending.current, recognizing.current))
          cancelEffect('background');
        else logVoice('permission-background-deferred');
      }
    });
    return () => {
      live.current = false;
      subscription.remove();
      cancelEffect('unmount');
    };
  }, [logVoice]);
  const fail = (error: unknown) =>
    state.setError(
      error instanceof Error ? error.message : 'AI is unavailable. Your draft is still here.',
    );
  const ask = async () => {
    if (phase !== 'idle' || request.current || voiceBusy.current || !text.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    const prompt = text;
    const draft = { prompt, id: randomUUID(), content: '', paintedAt: 0 };
    stream.current = draft;
    setPhase('thinking');
    Keyboard.dismiss();
    try {
      const client = await aiClient();
      if (controller.signal.aborted) return;
      const result = await client.chat(
        [{ role: 'user', content: prompt }],
        true,
        controller.signal,
        (content) => {
          if (!live.current || controller.signal.aborted || request.current !== controller) return;
          const first = !draft.content;
          draft.content = content;
          if (first) {
            setGenerated({ prompt, id: draft.id });
            setPhase('streaming');
          }
          const paint = () => {
            if (live.current && !controller.signal.aborted && request.current === controller) {
              paintTimer.current = undefined;
              draft.paintedAt = Date.now();
              setText(draft.content);
            }
          };
          const elapsed = Date.now() - draft.paintedAt;
          if (elapsed >= 40) {
            clearTimeout(paintTimer.current);
            paint();
          } else if (!paintTimer.current) paintTimer.current = setTimeout(paint, 40 - elapsed);
        },
      );
      if (!live.current || controller.signal.aborted) return;
      setGenerated({ prompt, id: draft.id, truncated: result.truncated });
      setText(result.content);
      stream.current = null;
      setEnabled(false);
    } catch (error) {
      if (request.current === controller) {
        if (
          error instanceof AiAccessError &&
          ['sign_in_required', 'subscription_required'].includes(error.code)
        ) {
          router.push('/settings');
          return;
        }
        if (draft.content) {
          setText(draft.content);
          setGenerated({ prompt, id: draft.id });
          setEnabled(false);
        }
        fail(
          controller.signal.aborted
            ? new Error('AI took too long. Your draft is still here.')
            : error,
        );
      }
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        clearTimeout(paintTimer.current);
        paintTimer.current = undefined;
        stream.current = null;
        request.current = null;
        setPhase('idle');
      }
    }
  };
  const receiveVoice = useEffectEvent((transcript: string, isFinal: boolean) => {
    if (!live.current || !recognizing.current || !voiceDraft.current) return;
    if (transcript.trim()) voiceSession.current.resultEvents++;
    logVoice('result', { final: isFinal, characters: transcript.length });
    voiceDraft.current = applyVoiceResult(voiceDraft.current, transcript, isFinal);
    setText(voiceDraft.current.text);
  });
  const handleVoiceError = useEffectEvent((error: string, message: string, code?: number) => {
    logVoice('native-error', { error, code, message });
    if (recognizing.current && error !== 'aborted') voiceSession.current.reason = `error:${error}`;
    if (recognizing.current && error !== 'aborted') {
      const detail =
        error === 'no-speech' ? 'No speech detected. Tap the mic to try again.' : message;
      setVoiceError(detail);
      fail(new Error(detail));
    }
  });
  const handleVoiceEnd = useEffectEvent(() => {
    if (!voiceBusy.current && !recognizing.current) {
      logVoice('end-ignored', { reason: 'no-active-session' });
      return;
    }
    const session = voiceSession.current;
    logVoice('end', {
      started: session.started,
      resultEvents: session.resultEvents,
      reason: session.reason || 'service-ended',
    });
    const message = voiceEndMessage(session.started, session.resultEvents, session.reason);
    recognizing.current = false;
    voiceBusy.current = false;
    voiceDraft.current = null;
    voiceLevel.set(withTiming(0, { duration: 160 }));
    if (live.current) {
      if (message) {
        setVoiceError(message);
        fail(new Error(message));
      }
      setPhase('idle');
    }
  });
  useEffect(() => {
    if (!recognition) return;
    const subscriptions = [
      recognition.addListener('start', () => {
        logVoice('start');
        voiceSession.current.started = true;
        if (live.current && recognizing.current) setPhase('listening');
      }),
      recognition.addListener('audiostart', () => logVoice('audio-start')),
      recognition.addListener('audioend', () => logVoice('audio-end')),
      recognition.addListener('speechstart', () => logVoice('speech-start')),
      recognition.addListener('speechend', () => logVoice('speech-end')),
      recognition.addListener('nomatch', () => logVoice('no-match')),
      recognition.addListener('volumechange', ({ value }) => {
        if (recognizing.current)
          voiceLevel.set(withTiming(Math.max(0, Math.min(1, value / 10)), { duration: 120 }));
      }),
      recognition.addListener('result', (event) => {
        receiveVoice(event.results[0]?.transcript || '', event.isFinal);
      }),
      recognition.addListener('error', (event) =>
        handleVoiceError(event.error, event.message, event.code),
      ),
      recognition.addListener('end', () => handleVoiceEnd()),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [voiceLevel, logVoice]);
  const finishVoice = () => {
    if (!recognizing.current) return;
    // Keep accepting results until end so the recognizer can correct the last partial phrase.
    voiceSession.current.reason = 'finished';
    logVoice('finish-requested');
    setPhase('finishing');
    recognition?.stop();
  };
  const voice = async () => {
    if (phase === 'listening') {
      finishVoice();
      return;
    }
    if (phase !== 'idle' || request.current || voiceBusy.current) {
      logVoice('start-blocked', {
        phase,
        requestInFlight: !!request.current,
        voiceBusy: voiceBusy.current,
      });
      return;
    }
    voiceSession.current = {
      id: voiceSession.current.id + 1,
      requestedAt: Date.now(),
      started: false,
      resultEvents: 0,
      reason: '',
    };
    logVoice('requested', {
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      appState: AppState.currentState,
    });
    const controller = new AbortController();
    request.current = controller;
    voiceBusy.current = true;
    setVoiceError('');
    state.setError('');
    setPhase('starting');
    try {
      if (!recognition) {
        logVoice('native-module-missing');
        throw new Error('Rebuild the app to enable live dictation.');
      }
      const available = recognition.isRecognitionAvailable();
      logVoice('availability', { available });
      if (Platform.OS === 'android') {
        try {
          logVoice('recognition-service', {
            packageName: recognition.getDefaultRecognitionService().packageName,
          });
        } catch {
          logVoice('recognition-service-info-unavailable');
        }
      }
      if (!available)
        throw new Error(
          'Speech recognition is unavailable. Enable a speech service in your phone settings.',
        );
      // Android permission activities can briefly background the app before resolving.
      permissionPending.current = true;
      let permission;
      try {
        permission = await recognition.getPermissionsAsync();
        if (!permission.granted) {
          logVoice('permission-requested');
          permission = await recognition.requestPermissionsAsync();
        }
      } finally {
        permissionPending.current = false;
      }
      logVoice('permission', { granted: permission.granted, canAskAgain: permission.canAskAgain });
      if (controller.signal.aborted) {
        logVoice('permission-returned-after-cancel');
        return;
      }
      if (!permission.granted)
        throw new Error(
          'Allow microphone and speech recognition access in your phone settings to dictate.',
        );
      if (AppState.currentState !== 'active') {
        cancel('background');
        return;
      }
      voiceDraft.current = { prefix: text, committed: '', text };
      setGenerated(null);
      Keyboard.dismiss();
      recognizing.current = true;
      const lang = Intl.DateTimeFormat().resolvedOptions().locale;
      logVoice('start-called', { lang, continuous: Platform.OS === 'ios', interimResults: true });
      recognition.start({
        lang,
        interimResults: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
        // Android continuous mode routes through a custom audio recorder; use the system mic directly.
        continuous: Platform.OS === 'ios',
        maxAlternatives: 1,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
      });
      logVoice('start-returned');
    } catch (error) {
      voiceSession.current.reason = 'start-error';
      logVoice('start-error', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      recognizing.current = false;
      voiceDraft.current = null;
      if (request.current === controller) {
        setVoiceError(error instanceof Error ? error.message : 'Could not start dictation.');
        fail(error);
        setPhase('idle');
      }
    } finally {
      if (!recognizing.current) voiceBusy.current = false;
      if (request.current === controller) request.current = null;
    }
  };
  return {
    enabled,
    setEnabled,
    phase,
    generated,
    voiceError,
    voiceLevel,
    ask,
    voice,
    cancel,
    undo: () => {
      if (!generated || phase !== 'idle') return;
      setText(generated.prompt);
      setGenerated(null);
      setEnabled(true);
    },
    reset: () => {
      cancel();
      setGenerated(null);
      setEnabled(false);
    },
  };
}
