<<<<<<< HEAD
/* Firebase verifies the caller before any model request. Secrets stay on the server. */
const { generatePlan, validateInput, PlanningError } = require("./planner.cjs");
const { converse } = require("./conversation.cjs");
=======
/* Authenticated planning and conversation transports; secrets stay on the server. */
const { generatePlan, validateInput, PlanningError } = require("./planner.cjs");
const { converse, validateMessages } = require("./conversation.cjs");
>>>>>>> eaa4f2317ef581e48895c55391148951989000f4

async function verifyToken(token) {
  const { getApps, initializeApp } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT || "personal-os-12b89" });
  return (await getAuth().verifyIdToken(token)).uid;
}

function createHandler({ verify = verifyToken, generate = generatePlan } = {}) {
  const limits = new Map();
  return async function handler(req, res) {
    const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
    if (req.method !== "POST") return send(405, { error: "Use POST." });
    const origin = req.headers.origin;
    const localPort = req.socket?.localPort || Number(process.env.PORT) || 8000;
    if (origin && ![`http://localhost:${localPort}`, `http://127.0.0.1:${localPort}`, "https://personal-os-12b89.web.app", "https://personal-os-12b89.firebaseapp.com", process.env.APP_ORIGIN].includes(origin)) return send(403, { error: "Origin not allowed." });
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!token) return send(401, { error: "Sign in before generating a plan." });
    let uid;
    try {
      uid = await verify(token[1]);
      if (!uid) throw new Error("invalid identity");
    } catch (error) {
      if (error.code === "MODULE_NOT_FOUND") return send(503, { error: "The planning server is missing Firebase Admin. Run npm ci --prefix functions and restart the server." });
      return send(401, { error: "Session verification failed. Sign in again and check the server's Firebase configuration." });
    }
    const now = Date.now();
    for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
    const usage = limits.get(uid) || { count: 0, until: now + 60000 };
    if (++usage.count > 5) return send(429, { error: "Wait a minute before sending another request." });
    limits.set(uid, usage);
    if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") return send(415, { error: "Send the goal as JSON." });
    try {
      let body = req.body;
      if (Number(req.headers["content-length"]) > 16000 || req.rawBody?.length > 16000) return send(413, { error: "Description is too long." });
      if (!body) {
        const chunks = [];
        let size = 0;
        for await (const chunk of req.iterator({ destroyOnReturn: false })) {
          size += Buffer.byteLength(chunk);
          if (size > 16000) { req.resume(); return send(413, { error: "Description is too long." }); }
          chunks.push(Buffer.from(chunk));
        }
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { return send(400, { error: "Send a valid JSON goal description." }); }
      }
<<<<<<< HEAD
      if (body?.mode === "conversation") return send(200, await converse(body));
=======
      if (body?.mode === "conversation") {
        try { validateMessages(body.messages); } catch (error) { return send(400, { error: error.message }); }
        if (!process.env.OPENAI_API_KEY) return send(503, { error: "Conversation is not configured. Set OPENAI_API_KEY on the server, or enter your brief directly." });
        return send(200, await converse(body));
      }
>>>>>>> eaa4f2317ef581e48895c55391148951989000f4
      const input = validateInput(body);
      send(200, await generate(input));
    } catch (error) {
      send(error instanceof PlanningError ? error.status : 502, { error: error instanceof PlanningError ? error.message : "The request could not be completed. Retry, or choose On-device templates." });
    }
  };
}
module.exports = { handler: createHandler(), createHandler };
