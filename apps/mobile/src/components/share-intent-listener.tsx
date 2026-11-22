import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { useCollection } from '../state/collection';
import { processShareIntent } from '../services/share-intent';

export function ShareIntentListener() {
  const collection = useCollection();
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent({
    debug: __DEV__,
    resetOnBackground: true,
    disabled: Platform.OS === 'web',
  });

  const processing = useRef(false);
  const lastProcessedKey = useRef('');

  useEffect(() => {
    if (error) {
      collection.setError(`Could not receive shared item: ${error}`);
    }
  }, [error, collection]);

  useEffect(() => {
    if (!collection.ready || !hasShareIntent) return;
    if (processing.current) return;

    const payloadKey = JSON.stringify({
      text: shareIntent.text,
      webUrl: shareIntent.webUrl,
      files: shareIntent.files?.map((f) => f.path || f.fileName),
      type: shareIntent.type,
    });

    if (payloadKey === lastProcessedKey.current) return;

    processing.current = true;
    lastProcessedKey.current = payloadKey;

    void (async () => {
      try {
        const result = await processShareIntent(shareIntent, {
          items: collection.data.items,
          save: collection.save,
          capture: collection.capture,
          enrich: collection.enrich,
          setNotice: collection.setNotice,
          setError: collection.setError,
        });

        if (result.savedId) {
          const idToOpen = result.savedId;

          requestAnimationFrame(() => {
            router.push({ pathname: '/item/[id]', params: { id: idToOpen } });
          });
        }
      } catch (err) {
        collection.setError(err instanceof Error ? err.message : 'Could not save shared content.');
      } finally {
        processing.current = false;
        resetShareIntent();
      }
    })();
  }, [collection.ready, hasShareIntent, shareIntent, resetShareIntent, collection]);

  return null;
}
