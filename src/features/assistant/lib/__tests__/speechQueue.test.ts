import { describe, expect, it, vi } from "vitest";
import { createSpeechQueue } from "../speechQueue";

// A controllable async clock-free helper: resolves after N microtask turns so
// overlapping fetch/play promises interleave deterministically.
const ticks = (n: number): Promise<void> => {
  let p = Promise.resolve();
  for (let i = 0; i < n; i++) p = p.then(() => {});
  return p;
};

describe("createSpeechQueue", () => {
  it("plays sentences strictly in order even when later fetches finish first", async () => {
    const played: string[] = [];
    // "two" fetches SLOWEST and "three" fast — if the queue played in
    // fetch-completion order it would be [one, three, two]. Order must hold.
    const fetchDelays: Record<string, number> = { one: 1, two: 6, three: 1 };
    const queue = createSpeechQueue<string>({
      fetchAudio: async (text) => {
        await ticks(fetchDelays[text] ?? 1);
        return `audio:${text}`;
      },
      playAudio: async (audio) => {
        await ticks(1);
        played.push(audio);
      },
    });

    queue.enqueue("one");
    queue.enqueue("two");
    queue.enqueue("three");
    queue.finish();
    await queue.idle();

    expect(played).toEqual(["audio:one", "audio:two", "audio:three"]);
  });

  it("idle() resolves only after finish() and full drain", async () => {
    const played: string[] = [];
    const queue = createSpeechQueue<string>({
      fetchAudio: async (t) => t,
      playAudio: async (a) => {
        await ticks(2);
        played.push(a);
      },
    });

    let resolved = false;
    queue.enqueue("a");
    const idle = queue.idle().then(() => {
      resolved = true;
    });
    // Not finished yet — idle must stay pending even though "a" may have played.
    await ticks(5);
    expect(resolved).toBe(false);

    queue.enqueue("b");
    queue.finish();
    await idle;
    expect(resolved).toBe(true);
    expect(played).toEqual(["a", "b"]);
  });

  it("cancel() stops further playback (barge-in) and releases idle()", async () => {
    const played: string[] = [];
    const queue = createSpeechQueue<string>({
      fetchAudio: async (t) => t,
      playAudio: async (a) => {
        await ticks(2);
        played.push(a);
      },
    });

    queue.enqueue("a");
    queue.enqueue("b");
    queue.enqueue("c");
    const idle = queue.idle();
    await ticks(1); // let "a" start
    queue.cancel();
    await idle; // cancel must release idle waiters

    // After cancel, no NEW sentences begin; at most the in-flight one lands.
    queue.enqueue("d");
    await ticks(5);
    expect(played).not.toContain("d");
    expect(played.length).toBeLessThanOrEqual(1);
  });

  it("onActive fires once when draining begins", async () => {
    const onActive = vi.fn();
    const queue = createSpeechQueue<string>({
      fetchAudio: async (t) => t,
      playAudio: async () => {},
      onActive,
    });
    queue.enqueue("a");
    queue.enqueue("b");
    queue.finish();
    await queue.idle();
    expect(onActive).toHaveBeenCalledTimes(1);
  });

  it("stops draining when isAlive() turns false", async () => {
    const played: string[] = [];
    let alive = true;
    const queue = createSpeechQueue<string>({
      isAlive: () => alive,
      fetchAudio: async (t) => t,
      playAudio: async (a) => {
        await ticks(2);
        played.push(a);
      },
    });
    queue.enqueue("a");
    queue.enqueue("b");
    queue.enqueue("c");
    await ticks(1);
    alive = false; // session torn down
    queue.finish();
    await queue.idle();
    expect(played.length).toBeLessThanOrEqual(1);
  });
});
