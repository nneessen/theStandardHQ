// Run: npm test  (node --import tsx --test). Regression coverage for the barge-in
// "Controller is already closed" bug + the happy/no-auth/error paths of buildReplyStream.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReplyStream, _internal } from "./reply-stream.js";

async function readAll(stream: ReadableStream<string>): Promise<string[]> {
  const out: string[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) out.push(value);
  }
  return out;
}

async function* genFrom(chunks: string[]): AsyncGenerator<string> {
  for (const c of chunks) yield c;
}

test("streams orchestrator deltas in order then closes", async () => {
  const chunks = await readAll(
    buildReplyStream({
      jwt: "jwt",
      text: "hi",
      stream: () => genFrom(["Hello", " there"]),
    }),
  );
  assert.deepEqual(chunks, ["Hello", " there"]);
});

test("no jwt → speaks the not-connected message and never calls the orchestrator", async () => {
  let called = false;
  const chunks = await readAll(
    buildReplyStream({
      jwt: null,
      text: "hi",
      stream: () => {
        called = true;
        return genFrom(["should not run"]);
      },
    }),
  );
  assert.equal(called, false);
  assert.deepEqual(chunks, [_internal.NO_AUTH_MESSAGE]);
});

test("orchestrator error → emits partial output then the fallback, no throw", async () => {
  async function* boom(): AsyncGenerator<string> {
    yield "partial";
    throw new Error("upstream 500");
  }
  const chunks = await readAll(
    buildReplyStream({ jwt: "jwt", text: "hi", stream: () => boom() }),
  );
  assert.deepEqual(chunks, ["partial", _internal.ERROR_MESSAGE]);
});

test("barge-in: cancel mid-stream aborts the fetch and never throws 'Controller is already closed'", async () => {
  let captured: AbortSignal | undefined;
  async function* slow(signal: AbortSignal): AsyncGenerator<string> {
    captured = signal;
    yield "first";
    // Block until the consumer cancels (which aborts `signal`), mimicking an in-flight
    // orchestrator fetch that gets torn down by barge-in.
    await new Promise<void>((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), {
        once: true,
      });
    });
    yield "unreachable";
  }

  const stream = buildReplyStream({
    jwt: "jwt",
    text: "hi",
    stream: (s) => slow(s),
  });
  const reader = stream.getReader();
  const first = await reader.read();
  assert.equal(first.value, "first");

  // Barge-in: the consumer cancels. This must not throw and must abort the upstream signal.
  await reader.cancel();
  // Let the start() teardown microtasks settle (the slow generator rejects on abort and is
  // swallowed by buildReplyStream's cancellation-aware catch).
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(captured, "stream() should have received an AbortSignal");
  assert.equal(
    captured!.aborted,
    true,
    "cancel must abort the orchestrator fetch signal",
  );
});

test("delta emitted after the consumer cancels is dropped without throwing", async () => {
  // Drives the enqueue-after-close guard directly: the generator keeps yielding, but once
  // the reader cancels, further deltas must be silently dropped (not throw).
  let yielded = 0;
  async function* chatty(signal: AbortSignal): AsyncGenerator<string> {
    for (let i = 0; i < 5; i++) {
      if (signal.aborted) return;
      yielded++;
      yield `chunk-${i}`;
    }
  }
  const stream = buildReplyStream({
    jwt: "jwt",
    text: "hi",
    stream: (s) => chatty(s),
  });
  const reader = stream.getReader();
  await reader.read(); // pull one
  await reader.cancel(); // then bail
  await new Promise((r) => setTimeout(r, 20));
  // The point is simply: no unhandled throw escaped the cancel path.
  assert.ok(yielded >= 1);
});
