const { onRequest } = require("firebase-functions/v2/https");
const { handler } = require("./api.cjs");
exports.plan = onRequest({ region: "us-central1", secrets: ["DEEPSEEK_API_KEY"], timeoutSeconds: 60, maxInstances: 3 }, handler);
