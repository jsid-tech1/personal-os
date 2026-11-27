/* Personal OS — Ask live voice.
   Full-screen, hands-free conversation over WebRTC. The server mints the session
   and owns the model config; this file owns the microphone, captions, and the
   confirmation gate for workspace changes. */
(function () {
  "use strict";
  const POS = window.POS;
  if (!POS) return;
  const U = POS.util;
  const esc = U.escapeHTML;
  const icon = U.icon;
  const core = POS.liveCore;
  const MAX_MS = 10 * 60 * 1000;
  const WARN_MS = 8 * 60 * 1000;
  const HIDDEN_GRACE = 30000;
  const LABELS = {
    intro: "Ready when you are.",
    connecting: "Connecting…",
    listening: "Listening…",
    hearing: "I hear you.",
    thinking: "Thinking…",
    speaking: "Speaking…",
    ended: "Conversation ended.",
    error: "Live voice isn't available.",
  };
  let active = null;

  function open() {
    if (active) { active.focus(); return; }
    if (!core) {
      POS.ui.toast("Live voice isn't available in this build. Use the text assistant.", { kind: "danger" });
      return;
    }

    const root = document.getElementById("overlay-root");
    if (!root) return;
    const previous = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = "live-wrap";
    wrap.innerHTML = `
      <div class="live-backdrop" data-live-close></div>
      <section class="live-panel" role="dialog" aria-modal="true" aria-labelledby="live-title" data-phase="intro">
        <header class="live-head">
          <span class="live-badge"><i aria-hidden="true"></i> Live</span>
          <span class="live-timer" data-live-timer>00:00</span>
          <button type="button" class="icon-btn" data-live-close aria-label="Close live voice">${icon("close")}</button>
        </header>
        <div class="live-stage">
          <div class="live-orb" data-live-orb aria-hidden="true"><span class="live-pixels"><i></i><i></i><i></i><i></i></span></div>
          <h2 class="live-title" id="live-title">Ask</h2>
          <p class="live-state" data-live-state role="status" aria-live="polite">${LABELS.intro}</p>
          <div class="live-intro" data-live-intro>
            <p>Talk naturally. Ask keeps replies short, uses your real tasks and projects, and proposes changes instead of making them.</p>
            <p class="live-fine">Live voice sends your microphone audio to OpenAI while this is open. Personal OS doesn't store the audio. Nothing changes without your confirmation. Headphones give the cleanest interruption handling.</p>
            <div class="live-intro-actions">
              <button type="button" class="btn btn-primary" data-live-start>Start live</button>
              <button type="button" class="btn btn-ghost" data-live-type>Type instead</button>
            </div>
          </div>
          <div class="live-log" data-live-log role="log" aria-label="Live transcript" hidden></div>
          <div class="live-pending" data-live-pending hidden></div>
        </div>
        <footer class="live-controls" data-live-controls hidden>
          <button type="button" class="btn btn-ghost" data-live-mute aria-pressed="false">Mute</button>
          <button type="button" class="btn btn-ghost" data-live-type>Type instead</button>
          <button type="button" class="btn" data-live-end>End</button>
        </footer>
      </section>`;
    root.appendChild(wrap);
    POS.ui.lockScroll(true);

    const panel = wrap.querySelector(".live-panel");
    const orb = wrap.querySelector("[data-live-orb]");
    const stateEl = wrap.querySelector("[data-live-state]");
    const timerEl = wrap.querySelector("[data-live-timer]");
    const intro = wrap.querySelector("[data-live-intro]");
    const logEl = wrap.querySelector("[data-live-log]");
    const pendingEl = wrap.querySelector("[data-live-pending]");
    const controls = wrap.querySelector("[data-live-controls]");
    const startBtn = wrap.querySelector("[data-live-start]");
    const muteBtn = wrap.querySelector("[data-live-mute]");
    const endBtn = wrap.querySelector("[data-live-end]");
    startBtn.dataset.mode = "start";

    let phase = "intro";
    let started = false;
    let pc = null;
    let dc = null;
    let micStream = null;
    let micTrack = null;
    let audio = null;
    let baseInstructions = "";
    let actions = core.createActions();
    let assistantLine = null;
    let assistantText = "";
    let startedAt = 0;
    let timerId = 0;
    let warnShown = false;
    let refreshTimer = 0;
    let unsubscribe = null;
    let hiddenAt = 0;
    let muted = false;
    let micLevel = 0;
    let remoteLevel = 0;
    let stopMicMeter = () => {};
    let stopRemoteMeter = () => {};
    let closing = false;

    const send = (payload) => {
      if (!dc || dc.readyState !== "open") return false;
      try { dc.send(JSON.stringify(payload)); return true; } catch { return false; }
    };
    const paintLevel = () => {
      orb.style.setProperty("--level", Math.min(1, Math.max(micLevel, remoteLevel)).toFixed(3));
    };
    const setPhase = (next, text) => {
      phase = next;
      panel.dataset.phase = next;
      orb.className = "live-orb" + (next === "intro" ? "" : " is-" + next);
      stateEl.textContent = text || LABELS[next] || "";
    };
    const scrollLog = () => { logEl.scrollTop = logEl.scrollHeight; };
    const addLine = (role, text) => {
      const line = document.createElement("div");
      line.className = "live-line is-" + role;
      line.innerHTML = `<span class="live-who">${role === "user" ? "You" : "Ask"}</span><p></p>`;
      line.querySelector("p").textContent = text || "";
      logEl.appendChild(line);
      while (logEl.children.length > 14) logEl.firstElementChild.remove();
      scrollLog();
      return line;
    };
    const assistantDelta = (text) => {
      if (!assistantLine) { assistantLine = addLine("assistant", ""); assistantText = ""; }
      assistantText += text;
      assistantLine.querySelector("p").textContent = assistantText;
      scrollLog();
    };
    const assistantDone = (full) => {
      if (!assistantLine) return;
      const finalText = String(full || assistantText || "").trim();
      assistantLine.querySelector("p").textContent = finalText || assistantText;
      assistantLine = null;
      assistantText = "";
    };
    const userSaid = (text) => {
      const value = String(text || "").trim();
      if (!value) return;
      addLine("user", value);
      actions.noteUser(value);
    };
    const screenLabel = () => {
      const hash = location.hash || "#/today";
      const [pathPart, queryPart] = hash.replace(/^#\/?/, "").split("?");
      const segments = pathPart.split("/").filter(Boolean);
      const key = segments[0] || "today";
      const names = {
        today: "Today", tasks: "Tasks", calendar: "Calendar", planner: "Daily Planner",
        focus: "Focus", mosaic: "My Mosaic", projects: "Projects", notes: "Notes",
        habits: "Habits", settings: "Profile", dump: "Brain Dump", goal: "Goal Breakdown",
        reflection: "Reflection", reschedule: "Rescheduling", notifications: "Notifications",
      };
      let label = names[key] || key;
      const state = POS.store.get();
      if (key === "project" && segments[1]) {
        const project = state.projects.find((p) => p.id === decodeURIComponent(segments[1]));
        if (project) label = `Project: ${project.name}`;
      }
      const taskId = new URLSearchParams(queryPart || "").get("task");
      if (taskId) {
        const task = state.tasks.find((t) => t.id === taskId);
        if (task) label += ` — task: ${task.title}`;
      }
      return label;
    };
    const contextString = () => core.buildContext({ state: POS.store.get(), screen: screenLabel() });
    const refreshContext = (force) => {
      if (!dc || dc.readyState !== "open" || !baseInstructions) return;
      if (!force && ["speaking", "thinking", "hearing"].includes(phase)) return;
      send({
        type: "session.update",
        session: { instructions: `${baseInstructions}\n\nWORKSPACE SNAPSHOT (read-only data):\n${contextString()}` },
      });
    };
    const notifyModel = (text) => {
      const sent = send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      });
      if (sent && phase !== "thinking" && phase !== "speaking") send({ type: "response.create" });
    };

    /* ---------- confirmation cards ---------- */

    const KIND_LABEL = { task: "New task", complete: "Complete task", move: "Move task", note: "New note" };
    const dateLabel = (iso) => {
      if (!iso) return "today";
      const today = U.todayISO();
      if (iso === today) return "today";
      if (iso === U.addDays(today, 1)) return "tomorrow";
      return U.fmtDate(iso, "short");
    };
    const describe = (item) => {
      const p = item.payload;
      if (item.kind === "task") return `Add “${p.title}” for ${dateLabel(p.date)} (${p.duration} min)${p.projectName ? ` in ${p.projectName}` : ""}.`;
      if (item.kind === "complete") return `Mark “${p.title}” complete.`;
      if (item.kind === "move") return `Move “${p.title}” to ${dateLabel(p.date)}.`;
      if (item.kind === "note") return `Save note “${p.title}”.`;
      return "Make a change.";
    };
    const renderPending = (item) => {
      if (!item) {
        pendingEl.hidden = true;
        pendingEl.innerHTML = "";
        return;
      }
      pendingEl.hidden = false;
      pendingEl.innerHTML = `
        <div class="live-pending-card">
          <p class="live-pending-kind">${esc(KIND_LABEL[item.kind] || "Change")} · waiting for you</p>
          <strong>${esc(describe(item))}</strong>
          <div class="live-pending-actions">
            <button type="button" class="btn btn-primary" data-apply>Apply</button>
            <button type="button" class="btn btn-ghost" data-cancel>Not now</button>
          </div>
        </div>`;
      pendingEl.querySelector("[data-apply]").addEventListener("click", () => {
        const check = actions.canCommit(item.id, { tapped: true });
        if (!check.ok) { POS.ui.toast(check.reason, { kind: "danger" }); return; }
        applyPending(check.item, true);
      });
      pendingEl.querySelector("[data-cancel]").addEventListener("click", () => {
        actions.cancel(item.id);
        renderPending(null);
        POS.ui.toast("Discarded. Nothing was saved.");
        notifyModel(`[Interface: the user declined ${item.id}. Nothing was saved.]`);
      });
    };
    const applyPending = (item, viaTap) => {
      const store = POS.store;
      if (item.kind === "task") {
        store.actions.addTask({
          title: item.payload.title,
          date: item.payload.date || U.todayISO(),
          duration: item.payload.duration || 30,
          projectId: item.payload.projectId || null,
        });
      } else if (item.kind === "complete") {
        store.actions.toggleTask(item.payload.taskId);
      } else if (item.kind === "move") {
        store.actions.moveTask(item.payload.taskId, item.payload.date);
      } else if (item.kind === "note") {
        store.actions.addNote({ title: item.payload.title, body: item.payload.body || "", tags: ["live"] });
      }
      actions.cancel(item.id);
      actions.resetUser();
      renderPending(null);
      POS.ui.toast(describe(item).replace(/\.$/, "") + " — saved.");
      refreshContext(true);
      if (viaTap) notifyModel(`[Interface: the user tapped Apply for ${item.id}. It is now saved. Confirm briefly.]`);
    };

    /* ---------- tools ---------- */

    const validDate = (value) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      if (Number.isNaN(Date.parse(`${value}T12:00:00`))) return false;
      return value >= U.todayISO() && value <= U.addDays(U.todayISO(), 366);
    };
    const clampInt = (value, min, max, fallback) => {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      return Math.max(min, Math.min(max, Math.round(number)));
    };
    const findProject = (name) => {
      const query = String(name || "").trim().toLowerCase();
      if (!query) return null;
      const projects = POS.store.get().projects.filter((p) => p.status !== "archived");
      return projects.find((p) => p.name.toLowerCase() === query)
        || projects.find((p) => p.name.toLowerCase().includes(query) || query.includes(p.name.toLowerCase()))
        || null;
    };
    const findTasks = (query) => {
      const value = String(query || "").trim().toLowerCase();
      const open = POS.store.get().tasks.filter((t) => !t.done);
      if (!value) return [];
      const exact = open.filter((t) => t.title.toLowerCase() === value);
      if (exact.length === 1) return exact;
      return open.filter((t) => t.title.toLowerCase().includes(value) || value.includes(t.title.toLowerCase()));
    };
    const runTool = (name, args) => {
      if (name === "propose_task") {
        const title = String(args.title || "").replace(/\s+/g, " ").trim().slice(0, 200);
        if (!title) throw new Error("A task needs a title.");
        const date = validDate(args.date) ? args.date : U.todayISO();
        const duration = clampInt(args.duration, 5, 480, 30);
        const project = findProject(args.project);
        const item = actions.propose("task", { title, date, duration, projectId: project?.id || null, projectName: project?.name || "" });
        renderPending(item);
        return { ok: true, id: item.id, preview: describe(item) };
      }
      if (name === "propose_complete_task") {
        const matches = findTasks(args.query);
        if (!matches.length) return { ok: false, error: "No open task matches that. Ask which task they mean." };
        if (matches.length > 1) return { ok: false, error: "Several tasks match. Ask which one.", candidates: matches.slice(0, 5).map((t) => t.title) };
        const item = actions.propose("complete", { taskId: matches[0].id, title: matches[0].title, date: matches[0].date });
        renderPending(item);
        return { ok: true, id: item.id, preview: describe(item) };
      }
      if (name === "propose_move_task") {
        if (!validDate(args.date)) return { ok: false, error: "Give a date within the next year as YYYY-MM-DD." };
        const matches = findTasks(args.query);
        if (!matches.length) return { ok: false, error: "No open task matches that. Ask which task they mean." };
        if (matches.length > 1) return { ok: false, error: "Several tasks match. Ask which one.", candidates: matches.slice(0, 5).map((t) => t.title) };
        const item = actions.propose("move", { taskId: matches[0].id, title: matches[0].title, date: args.date });
        renderPending(item);
        return { ok: true, id: item.id, preview: describe(item) };
      }
      if (name === "propose_note") {
        const title = String(args.title || "").replace(/\s+/g, " ").trim().slice(0, 120);
        if (!title) throw new Error("A note needs a title.");
        const body = String(args.body || "").slice(0, 4000);
        const item = actions.propose("note", { title, body });
        renderPending(item);
        return { ok: true, id: item.id, preview: describe(item) };
      }
      if (name === "commit_action") {
        const check = actions.canCommit(args.id);
        if (!check.ok) return { ok: false, error: check.reason };
        const applied = describe(check.item);
        applyPending(check.item, false);
        return { ok: true, applied };
      }
      if (name === "cancel_action") {
        const removed = actions.cancel(args.id);
        renderPending(null);
        return { ok: removed, cancelled: removed };
      }
      return { ok: false, error: "Unknown action." };
    };
    const handleTool = (event) => {
      let args = {};
      try { args = JSON.parse(event.arguments || "{}"); } catch { args = {}; }
      let output;
      try { output = runTool(event.name, args); }
      catch (err) { output = { ok: false, error: err?.message || "That action failed." }; }
      if (event.call_id) {
        send({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify(output) },
        });
      }
      send({ type: "response.create" });
    };

    /* ---------- live events ---------- */

    const onEvent = (message) => {
      let event;
      try { event = JSON.parse(message.data); } catch { return; }
      switch (event.type) {
        case "session.created":
        case "session.updated":
          if (phase === "connecting") setPhase("listening");
          break;
        case "input_audio_buffer.speech_started":
          if (phase === "speaking") assistantDone();
          setPhase("hearing");
          break;
        case "input_audio_buffer.speech_stopped":
          if (phase === "hearing") setPhase("thinking");
          break;
        case "response.created":
          setPhase("thinking");
          break;
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta":
          assistantDelta(event.delta || "");
          setPhase("speaking");
          break;
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done":
          assistantDone(event.transcript);
          break;
        case "conversation.item.input_audio_transcription.completed":
          userSaid(event.transcript);
          break;
        case "response.function_call_arguments.done":
          handleTool(event);
          break;
        case "response.done":
          if (phase === "thinking" || phase === "speaking") setPhase("listening");
          break;
        case "error":
          POS.ui.toast(event.error?.message || "Live voice hit an error.", { kind: "danger" });
          break;
        default:
          break;
      }
    };

    /* ---------- audio level ---------- */

    const meter = (stream, report) => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return () => {};
      let context;
      try {
        context = new AudioCtx();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let frame = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const value = (data[i] - 128) / 128;
            sum += value * value;
          }
          report(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
          frame = requestAnimationFrame(tick);
        };
        tick();
        return () => {
          cancelAnimationFrame(frame);
          try { source.disconnect(); } catch {}
          context.close().catch(() => {});
        };
      } catch {
        context?.close().catch(() => {});
        return () => {};
      }
    };

    /* ---------- connection ---------- */

    const teardownConnection = () => {
      clearInterval(timerId);
      timerId = 0;
      clearTimeout(refreshTimer);
      refreshTimer = 0;
      try { dc?.close(); } catch {}
      try { pc?.close(); } catch {}
      dc = null;
      pc = null;
      stopMicMeter();
      stopRemoteMeter();
      stopMicMeter = () => {};
      stopRemoteMeter = () => {};
      micLevel = 0;
      remoteLevel = 0;
      paintLevel();
      if (micStream) micStream.getTracks().forEach((track) => track.stop());
      micStream = null;
      micTrack = null;
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        audio = null;
      }
      assistantLine = null;
      assistantText = "";
      actions.clear();
      renderPending(null);
    };

    const iceComplete = (connection) => {
      if (connection.iceGatheringState === "complete") return Promise.resolve();
      return new Promise((resolve) => {
        const finish = () => {
          if (connection.iceGatheringState !== "complete") return;
          connection.removeEventListener("icegatheringstatechange", finish);
          clearTimeout(timeout);
          resolve();
        };
        const timeout = setTimeout(() => {
          connection.removeEventListener("icegatheringstatechange", finish);
          resolve();
        }, 8000);
        connection.addEventListener("icegatheringstatechange", finish);
        finish();
      });
    };

    const fail = (message, retryable = true) => {
      teardownConnection();
      started = false;
      panel.classList.add("is-error");
      intro.hidden = false;
      logEl.hidden = true;
      controls.hidden = true;
      startBtn.dataset.mode = retryable ? "retry" : "close";
      startBtn.textContent = retryable ? "Try again" : "Close";
      setPhase("error", message);
      startBtn.focus();
    };

    const start = async () => {
      if (phase === "connecting") return;
      teardownConnection();
      actions = core.createActions();
      panel.classList.remove("is-error");
      intro.hidden = true;
      logEl.hidden = false;
      controls.hidden = false;
      logEl.innerHTML = "";
      startBtn.dataset.mode = "start";
      started = true;
      muted = false;
      muteBtn.textContent = "Mute";
      muteBtn.setAttribute("aria-pressed", "false");
      timerEl.textContent = "00:00";
      warnShown = false;
      setPhase("connecting");
      try { POS.store.actions.updateSettings({ liveConsent: true }); } catch {}

      if (!POS.cloud?.getStatus?.().user) return fail("Sign in to use live voice. Your workspace is still here.", false);
      if (!navigator.mediaDevices?.getUserMedia) return fail("This browser can't open a microphone here. Use HTTPS or localhost, or type instead.", false);

      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
      } catch (err) {
        const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
        return fail(denied ? "Microphone access was denied. Allow it in the browser, or type instead." : (err?.message || "Couldn't open the microphone."), true);
      }
      micTrack = micStream.getAudioTracks()[0];
      stopMicMeter = meter(micStream, (level) => { micLevel = level; paintLevel(); });

      try {
        pc = new RTCPeerConnection();
        audio = new Audio();
        audio.autoplay = true;
        audio.setAttribute("playsinline", "");
        pc.ontrack = (event) => {
          const stream = event.streams[0] || new MediaStream([event.track]);
          audio.srcObject = stream;
          audio.play().catch(() => { stateEl.textContent = "Tap the panel to hear Ask."; });
          stopRemoteMeter();
          stopRemoteMeter = meter(stream, (level) => { remoteLevel = level; paintLevel(); });
        };
        pc.addTrack(micTrack, micStream);
        dc = pc.createDataChannel("oai-events");
        dc.addEventListener("message", onEvent);
        dc.addEventListener("close", () => {
          if (started && phase !== "error") setPhase("ended", "Live ended. Start again when you're ready.");
        });
        pc.addEventListener("connectionstatechange", () => {
          if (!started || !pc) return;
          if (pc.connectionState === "failed") fail("The live connection dropped. Try again.", true);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await iceComplete(pc);
        const sdp = pc.localDescription?.sdp;
        if (!sdp) throw new Error("Couldn't prepare the audio connection.");

        const token = await POS.cloud.token();
        const response = await fetch("/api/live", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ sdp, context: contextString() }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Live voice isn't available right now.");
        if (!result.sdp) throw new Error("Live voice returned an empty answer.");

        baseInstructions = result.instructions || "";
        await pc.setRemoteDescription({ type: "answer", sdp: result.sdp });
        startedAt = Date.now();
        timerId = setInterval(tickTimer, 1000);
        tickTimer();
        setPhase("listening");
      } catch (err) {
        if (err?.name === "AbortError") return;
        fail(err?.message || "Couldn't start live voice. Try again.", true);
      }
    };

    const tickTimer = () => {
      if (!started) return;
      const elapsed = Date.now() - startedAt;
      const seconds = Math.max(0, Math.floor(elapsed / 1000));
      timerEl.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      if (elapsed >= MAX_MS) {
        POS.ui.toast("Live ended at the 10-minute limit.");
        end();
      } else if (elapsed >= WARN_MS && !warnShown) {
        warnShown = true;
        stateEl.textContent = "Two minutes left.";
      }
    };

    const end = () => {
      if (!started) { close(); return; }
      send({ type: "session.close" });
      teardownConnection();
      started = false;
      panel.classList.remove("is-error");
      setPhase("ended", "Conversation ended. Nothing is listening now.");
      intro.hidden = false;
      logEl.hidden = true;
      controls.hidden = true;
      startBtn.dataset.mode = "retry";
      startBtn.textContent = "Start again";
      timerEl.textContent = "00:00";
      startBtn.focus();
    };

    const close = () => {
      if (closing) return;
      closing = true;
      teardownConnection();
      unsubscribe?.();
      unsubscribe = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", close);
      wrap.remove();
      POS.ui.lockScroll(false);
      active = null;
      if (previous?.isConnected) previous.focus();
    };

    const typeInstead = () => {
      close();
      POS.ui.openAssistant();
    };

    const onVisibility = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > HIDDEN_GRACE && started) end();
      hiddenAt = 0;
    };

    /* ---------- wiring ---------- */

    wrap.querySelectorAll("[data-live-close]").forEach((node) => node.addEventListener("click", close));
    wrap.querySelectorAll("[data-live-type]").forEach((node) => node.addEventListener("click", typeInstead));
    startBtn.addEventListener("click", () => {
      if (startBtn.dataset.mode === "close") close();
      else start();
    });
    endBtn.addEventListener("click", end);
    muteBtn.addEventListener("click", () => {
      if (!micTrack) return;
      muted = !muted;
      micTrack.enabled = !muted;
      muteBtn.setAttribute("aria-pressed", String(muted));
      muteBtn.textContent = muted ? "Unmute" : "Mute";
      stateEl.textContent = muted ? "Microphone muted." : (phase === "speaking" ? "Speaking…" : "Listening…");
    });
    panel.addEventListener("click", () => { audio?.play().catch(() => {}); });
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (started) end();
        else close();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = [...panel.querySelectorAll("button:not(:disabled), a[href], input, textarea, [tabindex='0']")]
        .filter((node) => node.getClientRects().length && !node.closest("[hidden]"));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", close);
    unsubscribe = POS.store.subscribe(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => refreshContext(false), 1200);
    });

    active = { focus: () => startBtn.focus(), close };
    startBtn.focus();
  }

  POS.live = { open, close: () => active?.close(), isOpen: () => Boolean(active) };
})();
