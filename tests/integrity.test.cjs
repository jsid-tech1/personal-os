const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
test("entry and API files contain no unresolved merge markers or duplicate runtime scripts", () => {
  for (const file of ["index.html", "functions/api.cjs", "functions/index.cjs", "tests/api.test.cjs"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), /^(?:<{7}|={7}|>{7})/m, file);
  }
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.equal(new Set(scripts).size, scripts.length, "Scripts must initialize only once");
  for (const id of ["mobilebar", "overlay-root", "toast-root"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, id);
});
