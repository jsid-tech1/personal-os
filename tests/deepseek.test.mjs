import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createPersonalServer } from "../server.mjs";

async function serve(t, options) {
  const server = createPersonalServer(options).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function post(origin, endpoint, data, extra = {}) {
  return fetch(`${origin}/api/deepseek/${endpoint}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...extra.headers },
    body: JSON.stringify(data),
    signal: extra.signal,
  });
}

test("the server works without a key and never serves private files", async (t) => {
  const base = await serve(t, {});
  const app = await fetch(base);
  assert.equal(app.status, 200);
  assert.match(await app.text(), /js\/deepseek\.js/);
  const status = await fetch(`${base}/api/deepseek/status`);
  assert.deepEqual(await status.json(), { configured: false });
  assert.equal((await post(base, "chat", {})).status, 503);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.equal((await fetch(`${base}/server.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/assets/%2e%2e%2fserver.mjs`)).status, 404);
});

test("only same-origin clients can call a provider endpoint", async (t) => {
  let called = false;
  const base = await serve(t, { key: "test-only", fetchImpl: async () => { called = true; } });
  assert.equal((await post(base, "chat", {}, { headers: { origin: "http://example.com" } })).status, 403);
  assert.equal((await post(base, "chat", {}, { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  const noOrigin = await fetch(`${base}/api/deepseek/chat`, { method: "POST" });
  assert.equal(noOrigin.status, 403);
  const invalidRole = await post(base, "chat", { messages: [{ role: "system", content: "bad" }] });
  assert.equal(invalidRole.status, 400);
  assert.equal(called, false);
});

test("chat streams partial replies and forwards only provided workspace context", async (t) => {
  const seen = [];
  const encoder = new TextEncoder();
  const base = await serve(t, {
    key: "test-only",
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://api.deepseek.com/chat/completions");
      assert.equal(options.headers.Authorization, "Bearer test-only");
      seen.push(JSON.parse(options.body));
      let step = 0;
      return new Response(new ReadableStream({
        pull(stream) {
          const packets = [
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n',
          ];
          if (step < packets.length) stream.enqueue(encoder.encode(packets[step++]));
          else stream.close();
        },
      }), { headers: { "Content-Type": "text/event-stream" } });
    },
  });
  const messages = [{ role: "user", content: "Hi" }];
  const res = await post(base, "chat", { messages });
  assert.equal(res.headers.get("content-type"), "text/event-stream");
  assert.match(await res.text(), /Hello.*\n[\s\S]* world[\s\S]*\[DONE]/);
  assert.equal(seen[0].model, "deepseek-flash");
  assert.deepEqual(seen[0].messages.slice(1), messages);
  const context = "A matching task";
  await (await post(base, "chat", { messages, context })).text();
  assert.match(seen[1].messages[1].content, /A matching task/);
});

test("voice clips and stream playback use the documented format", async (t) => {
  const base = await serve(t, {
    key: "test-only",
    fetchImpl: async (url, options) => {
      if (url.endsWith("/asr")) {
        const file = options.body.get("file");
        assert.equal(file.name, "turn.wav");
        assert.equal(file.type, "audio/wav");
        assert.equal(file.size, 80);
        return Response.json({ text: "Test voice turn", request_id: "not surfaced" });
      }
      assert.match(url, /\/v1\/tools\/tts$/);
      assert.deepEqual(JSON.parse(options.body), { text: "Test reply", voice_id: "stella", format: "pcm" });
      return new Response(new Uint8Array([1, 0, 2, 0]), { headers: { "Content-Type": "audio/pcm" } });
    },
  });
  const wav = Buffer.alloc(80);
  wav.write("RIFF", 0);
  wav.write("WAVE", 8);
  const voice = await fetch(`${base}/api/deepseek/transcribe`, {
    method: "POST", headers: { origin: base, "content-type": "audio/wav" }, body: wav,
  });
  assert.deepEqual(await voice.json(), { text: "Test voice turn" });
  const playback = await post(base, "speak", { text: "Test reply" });
  assert.equal(playback.headers.get("content-type"), "audio/pcm");
  assert.deepEqual(new Uint8Array(await playback.arrayBuffer()), new Uint8Array([1, 0, 2, 0]));
});

test("invalid draft actions are dropped and dates/durations are validated", async (t) => {
  const base = await serve(t, {
    key: "test-only",
    fetchImpl: async (_, options) => {
      assert.deepEqual(JSON.parse(options.body).response_format, { type: "json_object" });
      return Response.json({ choices: [{ message: { content: JSON.stringify({ items: [
        { type: "delete", title: "Delete workspace" },
        { type: "task", title: "Review work", date: "2026-02-31", duration: 10000, id: "ignore" },
        { type: "note", title: "  A note  ", duration: 10 },
      ] }) } }] });
    },
  });
  const result = await post(base, "draft", { message: "Review work", date: "2026-02-01" });
  assert.deepEqual(await result.json(), { items: [
    { type: "task", title: "Review work", date: null, duration: 480 },
    { type: "note", title: "A note", date: null, duration: null },
  ] });
});

test("provider authorization errors are explained without reflecting provider details", async (t) => {
  const base = await serve(t, {
    key: "test-only", fetchImpl: async () => new Response("upstream details", { status: 401 }),
  });
  const res = await post(base, "chat", { messages: [{ role: "user", content: "Hello" }] });
  assert.equal(res.status, 503);
  const { error } = await res.json();
  assert.match(error, /Check the server key/);
  assert.doesNotMatch(error, /upstream details|test-only/);
});

test("disconnecting from a reply cancels the upstream request", async (t) => {
  let disconnect;
  const cancelled = new Promise((resolve) => { disconnect = resolve; });
  const base = await serve(t, {
    key: "test-only",
    fetchImpl: async (_, { signal }) => {
      signal.addEventListener("abort", disconnect, { once: true });
      return new Response(new ReadableStream({
        start(stream) {
          stream.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
        },
      }), { headers: { "Content-Type": "text/event-stream" } });
    },
  });
  const controller = new AbortController();
  const response = await post(base, "chat", { messages: [{ role: "user", content: "Hi" }] }, { signal: controller.signal });
  const chunk = await response.body.getReader().read();
  assert.match(new TextDecoder().decode(chunk.value), /Hello/);
  controller.abort();
  await Promise.race([
    cancelled,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Upstream request wasn't cancelled")), 1500);
      cancelled.then(() => clearTimeout(timer));
    }),
  ]);
});
