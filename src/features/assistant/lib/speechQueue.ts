// Ordered, double-buffered playback queue for the voice TTS pipeline.
//
// Sentences are enqueued as the reply streams in. The queue fetches each
// sentence's audio AHEAD of time (the next while the current plays) for gapless
// playback, but ALWAYS plays strictly in enqueue order. It exits when the queue
// is empty and finish() has been signalled, or immediately on cancel().
//
// Pure and dependency-injected (no fetch/Audio/React) so the ordering and
// cancellation behavior is unit-testable. The hook supplies real fetch + play.

export interface SpeechQueueDeps<A> {
  /** Fetch the audio for one sentence; resolve null if unavailable. */
  fetchAudio: (text: string) => Promise<A | null>;
  /** Play one fetched audio item to completion. */
  playAudio: (audio: A) => Promise<void>;
  /** Called once when playback begins (e.g. set the "speaking" phase). */
  onActive?: () => void;
  /** Return false to stop draining (e.g. the session was torn down). */
  isAlive?: () => boolean;
}

export interface SpeechQueue {
  /** Add a sentence to be spoken. Starts the drain loop if idle. */
  enqueue: (sentence: string) => void;
  /** Signal that no more sentences will be enqueued. */
  finish: () => void;
  /** Barge-in/teardown: drop everything and release idle() waiters. */
  cancel: () => void;
  /** Resolves once the queue is drained and finish() has been signalled. */
  idle: () => Promise<void>;
}

export function createSpeechQueue<A>(deps: SpeechQueueDeps<A>): SpeechQueue {
  const queue: string[] = [];
  let finished = false;
  let cancelled = false;
  let draining = false;
  let wake: (() => void) | null = null;
  let idleResolvers: Array<() => void> = [];

  const alive = () => (deps.isAlive ? deps.isAlive() : true) && !cancelled;

  const resolveIdle = () => {
    const resolvers = idleResolvers;
    idleResolvers = [];
    resolvers.forEach((r) => r());
  };

  const doWake = () => {
    if (wake) {
      const w = wake;
      wake = null;
      w();
    }
  };

  async function drain() {
    if (draining) return;
    draining = true;
    deps.onActive?.();

    const startNext = (): Promise<A | null> | null => {
      const next = queue.shift();
      return next === undefined ? null : deps.fetchAudio(next);
    };

    let prefetch = startNext();
    for (;;) {
      if (!alive()) break;
      if (!prefetch) {
        // Items may have been enqueued while we were playing (a doWake that found
        // no waiter) — pick them up before deciding to wait.
        if (queue.length > 0) {
          prefetch = startNext();
          continue;
        }
        if (finished) break;
        // Truly empty and more may come: wait for the next enqueue/finish.
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        if (!alive()) break;
        prefetch = startNext();
        continue;
      }
      // Double-buffer: kick off the NEXT fetch before awaiting/playing this one,
      // but play strictly in order (await current's playback fully first).
      const current = prefetch;
      const following = startNext();
      const audio = await current;
      if (!alive()) break;
      if (audio != null) await deps.playAudio(audio);
      prefetch = following;
    }

    draining = false;
    resolveIdle();
  }

  return {
    enqueue(sentence: string) {
      if (cancelled) return;
      const text = sentence.trim();
      if (!text) return;
      queue.push(text);
      doWake();
      if (!draining) void drain();
    },
    finish() {
      finished = true;
      doWake();
    },
    cancel() {
      cancelled = true;
      finished = true;
      queue.length = 0;
      doWake();
      resolveIdle();
    },
    idle() {
      if (!draining && queue.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        idleResolvers.push(resolve);
      });
    },
  };
}
