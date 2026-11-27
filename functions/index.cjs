const { onRequest } = require("firebase-functions/v2/https");
const { handler } = require("./api.cjs");
const { handler: liveHandler } = require("./live.cjs");
exports.plan = onRequest({ region: "us-central1", secrets: ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"], timeoutSeconds: 60, maxInstances: 3 }, handler);
exports.live = onRequest({ region: "us-central1", secrets: ["OPENAI_API_KEY"], timeoutSeconds: 60, maxInstances: 3 }, liveHandler);
