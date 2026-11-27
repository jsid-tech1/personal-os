# DeepSeek in Capture

For **Add task → Generate AI plan**, use `npm run dev` and open the URL it prints. Sign in, describe the project and review the proposed steps. Both the development server and the local Capture server use the same authenticated `/api/plan` handler and load `DEEPSEEK_API_KEY` from `.env`. A terminal-only option is `npm run agent -- "Your goal" --capacity=120`. See [AI planning setup](docs/AI_AND_SYNC_SETUP.md).

Run Node.js 22 or newer. Copy `.env.example` to `.env`, set `DEEPSEEK_API_KEY` in that private file, and start:

```powershell
node --env-file=.env server.mjs
```

If `DEEPSEEK_API_KEY` is already set in the server environment, run `node server.mjs`. Don’t paste the key into Capture or add it to browser code. `.env` is ignored by Git and not served.

Open <http://127.0.0.1:8787/> → **Capture** → **Use DeepSeek** → **Turn on DeepSeek**. Type a question, or tap the microphone to record and tap it again to send that turn. Your browser asks for mic permission. The first voice turn turns on spoken replies; **Read replies** controls them. Starting a new voice turn interrupts the reply. Text still works if the microphone or audio playback is unavailable.

- DeepSeek receives only submitted cloud messages, completed voice turns, and the context you explicitly share. When workspace sharing is on, it may receive matching titles and scheduling details, never full note bodies or the whole database. Turning sharing off starts fresh model context; it does not delete requests already sent.
- Conversation history is held in the open sheet. Personal OS does not persist audio or automatically save messages as tasks, notes, or goals. **Draft tasks or notes** creates a review; **Add selected** saves it.
- The mic is **turn-based**, not full-duplex. DeepSeek currently transcribes completed recordings; text and spoken replies stream back. On-device mode is still available without a key, and `index.html` still opens from disk.
- The server binds to loopback and is intended for your own device. **Do not publish or proxy these endpoints to the internet.** Hosting for other users needs separate authentication, per-user rate limits, and HTTPS. Firestore deployment and cross-device sync are separate.
- Browser storage is per origin. If you used a different port or opened `index.html` directly, export from that version and import at the new address to bring your own data over.

Run the mock-provider checks with `node --test tests/deepseek.test.mjs`. Those tests do not send anything to DeepSeek.
