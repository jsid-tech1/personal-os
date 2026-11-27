/* Local goal breakdown; uses the same agent as /api/plan, without saving tasks. */
const path = require("node:path");
const fs = require("node:fs");
const env = path.resolve(__dirname, "../.env");
if (fs.existsSync(env)) process.loadEnvFile(env);
const { generatePlan } = require("../functions/planner.cjs");
const args = process.argv.slice(2);
const capacity = Number(args.find(arg => arg.startsWith("--capacity="))?.slice(11) || 120);
const description = args.filter(arg => !arg.startsWith("--capacity=")).join(" ");
if (!description) {
  console.error('Usage: npm run agent -- "Your goal and context" --capacity=120');
  process.exitCode = 1;
} else {
  generatePlan({ description, capacity }).then(plan => {
    console.log(JSON.stringify(plan, null, 2));
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
