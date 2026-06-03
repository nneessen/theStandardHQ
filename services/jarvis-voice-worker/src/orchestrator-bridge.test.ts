// Run: npm test. Covers callOrchestrator's SSE handling — normal deltas/done AND the
// orchestrator `error` event (which must THROW so the caller speaks the fallback instead of
// the user hearing silence).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  callOrchestrator,
  type OrchestratorConfig,
} from "./orchestrator-bridge.js";

const cfg: OrchestratorConfig = {
  url: "http://orchestrator.test",
  anonKey: "k",
};

function sseResponse(frames: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const d of gen) out.push(d);
  return out;
}

test("yields delta texts in order and threads the conversation id on done", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    sseResponse([
      'event: delta\ndata: {"text":"Hello"}\n\n',
      'event: delta\ndata: {"text":" world"}\n\n',
      'event: done\ndata: {"conversationId":"conv-1"}\n\n',
    ])) as typeof fetch;
  try {
    let convId = "";
    const out = await collect(
      callOrchestrator(cfg, "jwt", "hi", null, (id) => (convId = id)),
    );
    assert.deepEqual(out, ["Hello", " world"]);
    assert.equal(convId, "conv-1");
  } finally {
    globalThis.fetch = original;
  }
});

test("an `error` SSE frame THROWS (so the caller speaks the fallback, not silence)", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    sseResponse([
      'event: delta\ndata: {"text":"partial"}\n\n',
      'event: error\ndata: {"message":"boom"}\n\n',
    ])) as typeof fetch;
  try {
    const out: string[] = [];
    let threw = false;
    try {
      for await (const d of callOrchestrator(
        cfg,
        "jwt",
        "hi",
        null,
        () => {},
      )) {
        out.push(d);
      }
    } catch (e) {
      threw = true;
      assert.match((e as Error).message, /boom/);
    }
    assert.equal(threw, true, "error frame must throw");
    assert.deepEqual(out, ["partial"]); // the pre-error delta still streamed
  } finally {
    globalThis.fetch = original;
  }
});

test("a non-2xx response throws (caller speaks fallback)", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("nope", { status: 500 })) as typeof fetch;
  try {
    await assert.rejects(() =>
      collect(callOrchestrator(cfg, "jwt", "hi", null, () => {})),
    );
  } finally {
    globalThis.fetch = original;
  }
});
