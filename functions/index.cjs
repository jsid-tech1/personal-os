const { onRequest } = require("firebase-functions/v2/https");
const { handler } = require("./api.cjs");
const { handler: liveHandler } = require("./live.cjs");
<<<<<<< HEAD
exports.plan = onRequest({ region: "us-central1", secrets: ["DEEPSEEK_API_KEY"], timeoutSeconds: 60, maxInstances: 3 }, handler);
=======
exports.plan = onRequest({ region: "us-central1", secrets: ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"], timeoutSeconds: 60, maxInstances: 3 }, handler);
>>>>>>> eaa4f2317ef581e48895c55391148951989000f4
exports.live = onRequest({ region: "us-central1", secrets: ["OPENAI_API_KEY"], timeoutSeconds: 60, maxInstances: 3 }, liveHandler);
