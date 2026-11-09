import { Image } from 'react-native';
import { Asset } from 'expo-asset';

export const WELCOME_SPACE_DARK = require('../../assets/welcome-space-dark.png');
export const WELCOME_SPACE_LIGHT = require('../../assets/welcome-space-light.png');
export const BRAND_MARK = require('../../assets/brand-mark.png');
export const SPLASH_ART = require('../../assets/splash-art.png');

export const CRITICAL_ASSETS = [WELCOME_SPACE_DARK, WELCOME_SPACE_LIGHT, BRAND_MARK, SPLASH_ART];

let preloaded = false;
let preloadPromise: Promise<void> | null = null;

export function isAssetsPreloaded(): boolean {
  return preloaded;
}

/**
 * Preloads and decodes critical visual assets during the splash screen
 * so they appear instantaneously upon launch without visual pop-in or blank frames.
 */
export function preloadCriticalAssets(): Promise<void> {
  if (preloaded) return Promise.resolve();
  if (preloadPromise) return preloadPromise;

  preloadPromise = new Promise<void>((resolve) => {
    let finished = false;
    const markDone = () => {
      if (!finished) {
        finished = true;
        preloaded = true;
        resolve();
      }
    };
    // Safety timeout: never block splash screen for more than 1200ms
    const timer = setTimeout(markDone, 1200);
    const tasks: Promise<unknown>[] = [];

    // 1. Expo Asset loader
    try {
      if (typeof Asset?.loadAsync === 'function') {
        tasks.push(Asset.loadAsync(CRITICAL_ASSETS).catch(() => []));
      }
    } catch {}

    // 2. React Native Image prefetch for disk/memory pipeline
    try {
      if (
        typeof Image?.prefetch === 'function' &&
        typeof Image?.resolveAssetSource === 'function'
      ) {
        for (const asset of CRITICAL_ASSETS) {
          try {
            const resolved = Image.resolveAssetSource(asset);

            if (resolved?.uri) {
              tasks.push(Image.prefetch(resolved.uri).catch(() => false));
            }
          } catch {}
        }
      }
    } catch {}

    if (tasks.length === 0) {
      clearTimeout(timer);
      markDone();

      return;
    }

    Promise.allSettled(tasks).finally(() => {
      clearTimeout(timer);
      markDone();
    });
  });

  return preloadPromise;
}

// Eagerly initiate asset prefetch on module evaluation
try {
  void preloadCriticalAssets();
} catch {}
