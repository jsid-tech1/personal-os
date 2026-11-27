/* Optional, same-origin DeepSeek transport. The browser never handles the API key. */
(function () {
  "use strict";
  const POS = window.POS;
  const base = "/api/deepseek/";
  const Audio = window.AudioContext || window.webkitAudioContext;

  async function checked(response) {
    if (response.ok) return response;
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Couldn’t reach DeepSeek. Check the server and try again.");
  }

  async function status() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const response = await fetch(base + "status", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      return response.ok && (await response.json()).configured === true;
    } catch {
      return false;
    }
  }

  async function post(path, data, signal, type = "application/json") {
    return checked(await fetch(base + path, {
      method: "POST", headers: { "Content-Type": type },
      body: type === "application/json" ? JSON.stringify(data) : data, signal,
    }));
  }

  async function chat(messages, { signal, context, voice = false, onText }) {
    const response = await post("chat", { messages, context, voice }, signal);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", reply = "", ended = false;
    const readLine = (line) => {
      if (!line.startsWith("data:")) return;
      const data = line.slice(5).trim();
      if (data === "[DONE]") { ended = true; return; }
      if (!data) return;
      const event = JSON.parse(data);
      const turn = event.choices?.[0];
      if (event.error || ["content_filter", "insufficient_system_resource", "aborted"].includes(turn?.finish_reason)) {
        throw new Error("DeepSeek stopped the reply. Try another message.");
      }
      if (typeof turn?.delta?.content === "string" && turn.delta.content) {
        reply += turn.delta.content;
        onText(turn.delta.content, reply);
      }
    };
    try {
      while (!ended) {
        const chunk = await reader.read();
        buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        lines.forEach(readLine);
        if (chunk.done) { readLine(buffer); break; }
      }
      if (!ended || !reply.trim()) throw new Error("The reply was interrupted or empty. Try again.");
      return reply;
    } finally {
      await reader.cancel().catch(() => {});
    }
  }

  async function draft(message, signal) {
    const res = await post("draft", { message, date: POS.util.todayISO() }, signal);
    const { items } = await res.json();
    return {
      items: items.map((item) => ({ ...item, projectId: null, raw: message, selected: true })),
      summary: items.length ? `${POS.util.plural(items.length, "draft item")} found. Nothing is saved yet.` : "Nothing to turn into a task, note, or goal. Nothing was saved.",
      provider: "DeepSeek",
    };
  }

  async function transcribe(wav, signal) {
    const res = await post("transcribe", wav, signal, "audio/wav");
    return (await res.json()).text.trim();
  }

  function history(turns, message) {
    const latest = [{ role: "user", content: message }];
    let chars = message.length;
    for (let i = turns.length - 2; i >= 0 && latest.length < 15; i -= 2) {
      const pair = turns.slice(i, i + 2);
      const size = pair[0].content.length + pair[1].content.length;
      if (chars + size > 32000) break;
      latest.unshift(...pair);
      chars += size;
    }
    return latest;
  }

  function workspace(message) {
    const store = POS.store;
    const today = POS.util.todayISO();
    const words = [...new Set(message.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [])]
      .filter((word) => !/^(?:what|have|tell|about|please|find|show|with|which|should|could|would|work|plan|tasks|notes|projects|habits|today|schedule)$/.test(word))
      .slice(0, 8);
    const simple = (entry) => ({
      title: String(entry.title || entry.name || "").slice(0, 140),
      ...(entry.date ? { date: entry.date, start: entry.start, done: entry.done } : {}),
      ...(entry.deadline ? { deadline: entry.deadline } : {}),
    });
    const groups = { tasks: new Set(), projects: new Set(), notes: new Set(), habits: new Set() };
    words.forEach((word) => {
      const found = store.searchAll(word);
      Object.keys(groups).forEach((group) => found[group].forEach((entry) => groups[group].add(entry)));
    });
    const snapshot = { date: today };
    Object.entries(groups).forEach(([group, entries]) => { if (entries.size) snapshot[group] = [...entries].slice(0, 4).map(simple); });
    if (/\b(today|my day|schedule|calendar|focus|priorities)\b/i.test(message)) {
      snapshot.today = store.tasksFor(today).slice(0, 8).map(simple);
      snapshot.events = store.get().events.filter((event) => event.date === today).slice(0, 5)
        .map(({ title, start, end }) => ({ title: String(title).slice(0, 100), start, end }));
    }
    // Drop groups rather than deliver truncated or malformed JSON.
    for (const field of ["notes", "habits", "projects", "events", "tasks", "today"]) {
      if (JSON.stringify(snapshot).length <= 4000) break;
      delete snapshot[field];
    }
    return JSON.stringify(snapshot);
  }

  function wav(chunks, rate) {
    const sampleCount = chunks.reduce((n, item) => n + item.length, 0);
    const source = new Float32Array(sampleCount);
    let cursor = 0;
    for (const item of chunks) { source.set(item, cursor); cursor += item.length; }
    const target = 16000;
    const ratio = rate / target;
    const length = Math.floor(sampleCount / ratio);
    const bytes = new DataView(new ArrayBuffer(44 + length * 2));
    const mark = (offset, str) => [...str].forEach((char, i) => bytes.setUint8(offset + i, char.charCodeAt(0)));
    mark(0, "RIFF"); bytes.setUint32(4, bytes.byteLength - 8, true); mark(8, "WAVE");
    mark(12, "fmt "); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true);
    bytes.setUint16(22, 1, true); bytes.setUint32(24, target, true); bytes.setUint32(28, target * 2, true);
    bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
    mark(36, "data"); bytes.setUint32(40, length * 2, true);
    for (let i = 0; i < length; i++) {
      const begin = Math.floor(i * ratio), end = Math.max(begin + 1, Math.floor((i + 1) * ratio));
      let sample = 0;
      for (let j = begin; j < end; j++) sample += source[j];
      sample = Math.max(-1, Math.min(1, sample / (end - begin)));
      bytes.setInt16(44 + i * 2, sample * (sample < 0 ? 32768 : 32767), true);
    }
    return new Blob([bytes.buffer], { type: "audio/wav" });
  }

  async function record(signal) {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode || !Audio) {
      throw new Error("Microphone recording needs a supported browser on localhost or HTTPS. You can still type.");
    }
    const audio = new Audio();
    let mic, worklet, ended = false;
    const close = () => {
      if (ended) return;
      ended = true;
      signal.removeEventListener("abort", close);
      mic?.getTracks().forEach((track) => track.stop());
      worklet?.disconnect();
      audio.close().catch(() => {});
    };
    signal.addEventListener("abort", close, { once: true });
    try {
      // Resume from the microphone button's activation before requesting permission.
      const resumed = audio.resume();
      resumed.catch(() => {});
      mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } });
      if (signal.aborted) {
        mic.getTracks().forEach((track) => track.stop());
        signal.throwIfAborted();
      }
      await Promise.all([resumed, audio.audioWorklet.addModule("/js/voice-capture.js")]);
      signal.throwIfAborted();
      const chunks = [];
      worklet = new AudioWorkletNode(audio, "pos-voice");
      worklet.port.onmessage = (event) => { if (!ended) chunks.push(event.data); };
      const mute = audio.createGain();
      mute.gain.value = 0;
      audio.createMediaStreamSource(mic).connect(worklet).connect(mute).connect(audio.destination);
      return {
        close,
        finish() {
          close();
          return wav(chunks, audio.sampleRate);
        },
      };
    } catch (err) {
      close();
      if (err.name === "NotAllowedError") throw new Error("Microphone access was denied. You can still type.");
      throw err;
    }
  }

  function player(onError) {
    if (!Audio) throw new Error("Audio playback isn’t supported in this browser.");
    const audio = new Audio();
    const sources = new Set();
    let queue = Promise.resolve();
    let abort = new AbortController();
    let next = 0;
    let closed = false;

    function stop() {
      abort.abort();
      abort = new AbortController();
      queue = Promise.resolve();
      sources.forEach((source) => source.stop());
      sources.clear();
      next = 0;
    }

    return {
      resume: () => audio.resume(),
      stop,
      close() { stop(); closed = true; audio.close().catch(() => {}); },
      speak(text) {
        if (closed || !text.trim()) return;
        const signal = abort.signal;
        queue = queue.then(async () => {
          if (signal.aborted) return;
          const response = await post("speak", { text }, signal);
          const reader = response.body.getReader();
          let pending = new Uint8Array(0);
          const play = (data) => {
            const frames = Math.floor(data.length / 2);
            if (signal.aborted || !frames) return;
            const buffer = audio.createBuffer(1, frames, 24000);
            const samples = buffer.getChannelData(0);
            const view = new DataView(data.buffer, data.byteOffset, frames * 2);
            for (let i = 0; i < frames; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
            const source = audio.createBufferSource();
            source.buffer = buffer;
            source.connect(audio.destination);
            source.onended = () => sources.delete(source);
            sources.add(source);
            next = Math.max(next, audio.currentTime + 0.03);
            source.start(next);
            next += buffer.duration;
          };
          try {
            while (!signal.aborted) {
              const { value, done } = await reader.read();
              if (done) { play(pending); break; }
              const merged = new Uint8Array(pending.length + value.length);
              merged.set(pending);
              merged.set(value, pending.length);
              const boundary = merged.length - merged.length % 2;
              if (boundary >= 4096) {
                play(merged.subarray(0, boundary));
                pending = merged.slice(boundary);
              } else pending = merged;
            }
          } finally {
            await reader.cancel().catch(() => {});
          }
        }).catch((err) => { if (!signal.aborted) { stop(); onError(err); } });
      },
    };
  }

  POS.deepseek = { status, chat, draft, transcribe, history, workspace, record, player };
})();
