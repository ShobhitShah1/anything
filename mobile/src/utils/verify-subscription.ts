export async function verifySubscription<T extends { paid: boolean }>(
  read: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, { once: true });
  if (parent.aborted) abort();
  const timeout = setTimeout(abort, 15_000);
  const signal = controller.signal;
  const cancelled = () => new Error('Subscription verification stopped. Refresh to check access.');
  let latest: T | undefined;
  let failure: unknown;
  try {
    for (const delay of [0, 1000, 2000, 4000]) {
      if (signal.aborted) throw cancelled();
      if (delay)
        await new Promise<void>((resolve, reject) => {
          const stop = () => {
            clearTimeout(timer);
            reject(cancelled());
          };
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', stop);
            resolve();
          }, delay);
          signal.addEventListener('abort', stop, { once: true });
        });
      if (signal.aborted) throw cancelled();
      let rejectRead: ((reason: Error) => void) | undefined;
      const stopRead = () => rejectRead?.(cancelled());
      const stoppedRead = new Promise<never>((_, reject) => {
        rejectRead = reject;
      });
      signal.addEventListener('abort', stopRead, { once: true });
      try {
        latest = await Promise.race([read(signal), stoppedRead]);
        if (signal.aborted) throw cancelled();
        if (latest.paid === true) return latest;
      } catch (error) {
        if (signal.aborted) throw cancelled();
        failure = error;
      } finally {
        signal.removeEventListener('abort', stopRead);
      }
    }
    if (latest) return latest;
    throw failure;
  } finally {
    clearTimeout(timeout);
    parent.removeEventListener('abort', abort);
  }
}
