/* Ephemeral account-scoped conversation, optional browser dictation and explicit spoken replies. */
(function () {
  "use strict";
  const POS = window.POS, esc = POS.util.escapeHTML;
  function mount(host, onBrief) {
    const owner = POS.cloud.getStatus().user?.uid, controller = new AbortController();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const canSpeak = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
    let recognition, listening = false, busy = false, disposed = false, brief = "", latestReply = "", spokenBase = "";
    let turns = [];
    host.innerHTML = `<details class="project-conversation" id="project-conversation"><summary>Talk through your project <span>Voice or text</span></summary><div class="conversation-body">
      <p class="field-help">Explain it like you would to a friend. I can ask questions and help shape a project brief.</p>
      <div class="conversation-log" id="conversation-log" role="log" aria-label="Project conversation" aria-live="polite"><div class="conversation-bubble assistant"><span>Planning partner</span><p>What are you making, and where are you feeling stuck?</p></div></div>
      <form id="conversation-form"><label class="label" for="conversation-input">Your message</label><textarea class="input" id="conversation-input" rows="3" maxlength="2000" placeholder="I’m working on a typography project, but I’m not sure how to begin…"></textarea>
      <div class="conversation-controls"><button class="btn" id="conversation-mic" type="button" aria-pressed="false" ${Recognition ? "" : "hidden"}>${POS.util.icon("mic")} Start microphone</button><button class="btn btn-primary" id="conversation-send" type="submit">Send message</button><button class="btn" id="conversation-retry" type="button" hidden>Retry last message</button></div></form>
      <p class="field-help" id="conversation-voice-help">${Recognition ? "Dictation fills the message box. Check the words before sending. Your browser’s speech service may process audio outside this device." : "Voice input is unavailable in this browser. Type here, or use your keyboard’s dictation. Try Chrome or Edge over HTTPS or localhost for browser voice input."}</p>
      <p class="conversation-status" id="conversation-status" role="status"></p>
      <div class="conversation-controls"><button class="btn" id="conversation-read" type="button" ${canSpeak ? "disabled" : "hidden"}>Read reply aloud</button><button class="btn" id="conversation-stop-audio" type="button" hidden>Stop reading</button><button class="btn" id="conversation-reset" type="button">Start fresh</button></div>
      <div class="conversation-brief" id="conversation-brief" hidden><label class="label" for="conversation-brief-text">Your project brief</label><textarea class="input" id="conversation-brief-text" rows="4" maxlength="5000"></textarea><button class="btn btn-primary" id="conversation-use" type="button">Use this brief for my plan</button></div>
      <p class="field-help">Only messages you send go to the AI provider. This conversation is not saved to your account. Closing the planner clears it; approved plans save separately.</p>
    </div></details>`;
    const $ = selector => host.querySelector(selector);
    const input = $("#conversation-input"), log = $("#conversation-log"), status = $("#conversation-status");
    function valid() { return !disposed && host.isConnected && POS.cloud.getStatus().user?.uid === owner; }
    function say(text) { if (valid()) status.textContent = text; }
    function bubble(role, text) {
      const el = document.createElement("div"); el.className = "conversation-bubble " + role;
      el.innerHTML = `<span>${role === "user" ? "You" : "Planning partner"}</span><p>${esc(text)}</p>`;
      log.append(el); log.scrollTop = log.scrollHeight;
    }
    function update() {
      $("#conversation-send").disabled = busy || listening || turns.length >= 16;
      $("#conversation-send").textContent = busy ? "Thinking…" : "Send message";
      $("#conversation-mic").disabled = busy;
      $("#conversation-mic").setAttribute("aria-pressed", String(listening));
      $("#conversation-mic").innerHTML = POS.util.icon("mic") + (listening ? " Stop microphone" : " Start microphone");
      $("#conversation-reset").disabled = busy;
      $("#conversation-use").disabled = busy;
      $("#conversation-read").disabled = busy || !latestReply || listening;
    }
    function stopReading() {
      if (canSpeak) window.speechSynthesis.cancel();
      $("#conversation-stop-audio").hidden = true;
    }
    function stopMic(abort = false) {
      if (recognition) { try { abort ? recognition.abort() : recognition.stop(); } catch { /* Already stopped. */ } }
    }
    async function request() {
      if (!valid() || busy) return;
      busy = true; stopReading(); update(); $("#conversation-retry").hidden = true;
      say("Thinking about your project…");
      try {
        const token = await POS.cloud.token();
        if (!valid()) return;
        const response = await fetch("/api/plan", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ mode: "conversation", messages: turns }) });
        const answer = await response.json();
        if (!response.ok) throw new Error(answer.error || "Conversation is unavailable. Retry, or describe the project directly below.");
        if (!valid()) return;
        if (typeof answer.reply !== "string" || !answer.reply.trim() || answer.reply.length > 1500 || typeof answer.brief !== "string" || answer.brief.length > 5000 || typeof answer.ready !== "boolean") throw new Error("The reply was not valid. Retry your message.");
        turns.push({ role: "assistant", content: answer.reply }); latestReply = answer.reply;
        bubble("assistant", answer.reply);
        brief = answer.brief; $("#conversation-brief-text").value = brief;
        $("#conversation-brief").hidden = !brief;
        say(turns.length >= 16 ? "Conversation limit reached. Use your brief, or start fresh." : answer.ready ? "Your brief is ready to review. You can add more detail, or use it below." : "Add a little more detail when you’re ready.");
      } catch (error) {
        if (valid() && error.name !== "AbortError") { say(error.message); $("#conversation-retry").hidden = false; }
      } finally { busy = false; if (valid()) update(); }
    }
    $("#conversation-form").onsubmit = e => {
      e.preventDefault();
      if (busy || listening || !valid()) return;
      const text = input.value.trim();
      if (!text) { say("Say or type a message first."); input.focus(); return; }
      if (turns.at(-1)?.role === "user") { say("Retry the pending message first, or start a fresh conversation."); return; }
      if (turns.length >= 16) { say("Use the brief or start fresh to keep talking."); return; }
      const next = [...turns, { role: "user", content: text }];
      if (JSON.stringify(next).length > 14000) { say("This conversation is full. Use your brief, or start fresh."); return; }
      turns = next; bubble("user", text); input.value = ""; request();
    };
    $("#conversation-retry").onclick = request;
    $("#conversation-mic").onclick = () => {
      if (busy || !Recognition || !valid()) return;
      if (listening) { stopMic(); return; }
      stopReading();
      try {
        recognition = new Recognition(); recognition.lang = navigator.language || "en-US";
        recognition.continuous = false; recognition.interimResults = true;
        spokenBase = input.value.trim();
        recognition.onstart = () => { if (!valid()) { stopMic(true); return; } listening = true; update(); say("Listening… Stop the microphone when you’re finished, then check and send your words."); };
        recognition.onresult = event => {
          if (!valid()) return;
          const words = Array.from(event.results).map(result => result[0].transcript).join(" ");
          input.value = [spokenBase, words].filter(Boolean).join(" ").slice(0, 2000);
        };
        let failed = false;
        recognition.onerror = event => {
          failed = true;
          if (valid()) { listening = false; update(); }
          const errors = { "not-allowed": "Microphone permission was denied. Allow it in browser settings, or type your message.", "service-not-allowed": "Your browser blocked its speech service. Type your message instead.", "audio-capture": "No microphone is available. Check the connection or type your message.", "no-speech": "No speech was detected. Try again or type your message.", network: "The speech service could not connect. Your text is still here; try typing instead.", aborted: "Microphone stopped. Your text is still here." };
          say(errors[event.error] || "Voice input stopped. Try again or type your message.");
        };
        recognition.onend = () => { if (!valid()) return; listening = false; update(); if (!failed) say("Microphone off. Check your words, then send your message."); };
        listening = true; update(); recognition.start();
      } catch { listening = false; update(); say("Voice input could not start. Check microphone permission, or type your message."); }
    };
    $("#conversation-read").onclick = () => {
      if (!canSpeak || !latestReply || !valid()) return;
      stopMic(true); stopReading();
      const utterance = new SpeechSynthesisUtterance(latestReply); utterance.lang = navigator.language || "en-US";
      utterance.onend = utterance.onerror = () => { if (valid()) $("#conversation-stop-audio").hidden = true; };
      $("#conversation-stop-audio").hidden = false; window.speechSynthesis.speak(utterance);
    };
    $("#conversation-stop-audio").onclick = stopReading;
    $("#conversation-reset").onclick = () => {
      stopMic(true); stopReading(); turns = []; brief = ""; latestReply = ""; input.value = "";
      log.innerHTML = ""; bubble("assistant", "What are you making, and where are you feeling stuck?");
      $("#conversation-brief").hidden = true; $("#conversation-retry").hidden = true; update(); say("Fresh conversation. Nothing was saved.");
    };
    $("#conversation-use").onclick = () => {
      const text = $("#conversation-brief-text").value.trim();
      if (!text || !valid()) return;
      stopMic(true); stopReading(); onBrief(text); say("Brief copied below. Check your deadline and availability, then generate a plan. Nothing has been saved.");
    };
    $("#project-conversation").addEventListener("toggle", () => { if (!$("#project-conversation").open) { stopMic(true); stopReading(); } });
    function destroy() { disposed = true; stopMic(true); if (canSpeak) window.speechSynthesis.cancel(); controller.abort(); turns = []; brief = ""; latestReply = ""; }
    return { destroy };
  }
  POS.projectConversation = { mount };
})();
