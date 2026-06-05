// Run: npm test  (node --import tsx --test). Covers toSpokenText (markdown/number
// sanitization) and normalizeSpeechStream (sentence-buffered streaming so a number or
// markdown token split across deltas is never normalized mid-token).
import { test } from "node:test";
import assert from "node:assert/strict";
import { toSpokenText, normalizeSpeechStream } from "./speech-text.js";
import { buildReplyStream, _internal } from "./reply-stream.js";

async function* genFrom(chunks: string[]): AsyncGenerator<string> {
  for (const c of chunks) yield c;
}
async function collect(src: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const c of src) out += c;
  return out;
}
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

test("strips bold/italic/heading markers", () => {
  assert.equal(toSpokenText("**Hello** _there_ ## Title"), "Hello there Title");
});

test("keeps link label, drops url", () => {
  assert.equal(
    toSpokenText("See [the policy](https://x.com/p) now"),
    "See the policy now",
  );
});

test("unwraps inline and fenced code", () => {
  assert.equal(toSpokenText("Run `npm test` please"), "Run npm test please");
  assert.equal(toSpokenText("a ```block here``` b"), "a b");
});

test("expands abbreviated money", () => {
  assert.equal(
    toSpokenText("Premium is $1.5M total"),
    "Premium is 1.5 million dollars total",
  );
  assert.equal(toSpokenText("$2B in force"), "2 billion dollars in force");
});

test("speaks plain money and percent without a stray symbol", () => {
  assert.equal(
    toSpokenText("You owe $1,234.56 now"),
    "You owe 1,234.56 dollars now",
  );
  assert.equal(toSpokenText("Persistency is 85%"), "Persistency is 85 percent");
});

test("converts bullet lists into clause breaks", () => {
  assert.equal(toSpokenText("- first\n- second"), ", first , second");
});

test("groups a standalone large number but leaves digits embedded in a word alone", () => {
  assert.equal(
    toSpokenText("We wrote 12500 policies"),
    "We wrote 12,500 policies",
  );
  // An identifier like "model3594" must NOT be split into "model3,594".
  assert.equal(toSpokenText("the model3594 build"), "the model3594 build");
  // Years stay natural.
  assert.equal(toSpokenText("back in 2026"), "back in 2026");
});

test("normalizeSpeechStream flushes complete sentences and sanitizes each", async () => {
  const out = await collect(
    normalizeSpeechStream(
      genFrom(["You wrote **3** policies. ", "AP is $12,300."]),
    ),
  );
  // No markdown, no dollar sign; both sentences present.
  assert.ok(!out.includes("*"), `markdown leaked: ${out}`);
  assert.ok(!out.includes("$"), `dollar sign leaked: ${out}`);
  assert.ok(out.includes("3 policies"));
  assert.ok(out.includes("12,300 dollars"));
});

test("a number split ACROSS deltas is normalized intact (the core bug)", async () => {
  // "$1,234.56" arrives as four fragments — must still become "1,234.56 dollars",
  // never a spoken "dollar sign" from a "$"-only fragment.
  const out = await collect(
    normalizeSpeechStream(
      genFrom(["Your premium is $", "1,", "234.", "56 even."]),
    ),
  );
  assert.ok(out.includes("1,234.56 dollars"), `number was mangled: ${out}`);
  assert.ok(!out.includes("$"), `dollar sign leaked: ${out}`);
});

test("a no-punctuation reply still flushes at end", async () => {
  const out = await collect(
    normalizeSpeechStream(genFrom(["just three words"])),
  );
  assert.equal(out.trim(), "just three words");
});

test("mid-stream error: buffered partial is still spoken, NO apology (integration with buildReplyStream)", async () => {
  // The orchestrator streamed a real answer, then threw before a sentence boundary. The user
  // must hear the partial, NOT "Sorry, I hit a problem" (which the bridge only speaks when
  // ZERO real deltas were produced). This is the regression the buffering could have caused.
  async function* yieldsThenThrows(): AsyncGenerator<string> {
    yield "You have three pending policies"; // no trailing "." → buffered, not yet flushed
    throw new Error("assistant-orchestrator emitted an error event");
  }
  const chunks = await readAll(
    buildReplyStream({
      jwt: "jwt",
      text: "what's pending",
      stream: () => normalizeSpeechStream(yieldsThenThrows()),
    }),
  );
  const spoken = chunks.join("");
  assert.ok(
    spoken.includes("three pending policies"),
    `partial answer was lost: ${JSON.stringify(spoken)}`,
  );
  assert.ok(
    !spoken.includes(_internal.ERROR_MESSAGE),
    `spurious apology appended after a partial answer: ${JSON.stringify(spoken)}`,
  );
});

test("error with NO prior text still surfaces the fallback (deltas === 0 path)", async () => {
  // eslint-disable-next-line require-yield -- async function* is a generator without a yield
  async function* throwsImmediately(): AsyncGenerator<string> {
    throw new Error("upstream failed before any text");
  }
  const chunks = await readAll(
    buildReplyStream({
      jwt: "jwt",
      text: "hi",
      stream: () => normalizeSpeechStream(throwsImmediately()),
    }),
  );
  assert.deepEqual(chunks, [_internal.ERROR_MESSAGE]);
});
