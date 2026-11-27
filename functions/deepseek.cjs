/* Server-only JSON completions shared by task breakdowns and project briefs. */
class PlanningError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function requestJSON(messages, { key = process.env.DEEPSEEK_API_KEY, model = process.env.DEEPSEEK_MODEL || "deepseek-flash", fetchImpl = fetch, maxTokens = 6000 } = {}) {
  if (!key?.trim()) throw new PlanningError(503, "Set DEEPSEEK_API_KEY on the planning server and restart it.");
  let response;
  try {
    response = await fetchImpl("https://api.deepseek.com/chat/completions", {
      method: "POST", signal: AbortSignal.timeout(45000), redirect: "error",
      headers: { Authorization: `Bearer ${key.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, thinking: { type: "disabled" }, stream: false, max_tokens: maxTokens, response_format: { type: "json_object" } }),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") throw new PlanningError(504, "DeepSeek took too long. Try again.");
    throw new PlanningError(502, "Could not reach DeepSeek. Check your connection and try again.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    if ([401, 403].includes(response.status)) throw new PlanningError(503, "DeepSeek rejected the server key. Check DEEPSEEK_API_KEY and account access.");
    if (response.status === 402) throw new PlanningError(503, "The DeepSeek account has insufficient balance. Add credit and retry.");
    if (response.status === 429) throw new PlanningError(429, "DeepSeek is busy. Wait a minute before trying again.");
    throw new PlanningError(502, "DeepSeek could not generate a response. Try again.");
  }
  try {
    const choice = (await response.json()).choices?.[0];
    if (choice?.finish_reason !== "stop") throw new Error();
    return JSON.parse(choice.message.content);
  } catch {
    throw new PlanningError(502, "DeepSeek returned an incomplete response. Please retry.");
  }
}

module.exports = { requestJSON, PlanningError };
