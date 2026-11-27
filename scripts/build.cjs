/* Publish only runtime files; documentation, tests and tooling stay out of Hosting. */
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

async function build() {
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "dist");
  await fs.mkdir(output, { recursive: true });
  for (const name of ["index.html", "css", "js", "assets"]) {
    await fs.cp(path.join(root, name), path.join(output, name), { recursive: true });
  }
  let html = await fs.readFile(path.join(root, "index.html"), "utf8");
  const resources = [...html.matchAll(/(?:src|href)="((?:js|css|assets)\/[^"?]+)(?:\?[^\"]*)?"/g)];
  for (const match of resources) {
    const hash = createHash("sha256").update(await fs.readFile(path.join(root, decodeURIComponent(match[1])))).digest("hex").slice(0, 12);
    html = html.replace(match[0], match[0].split("=")[0] + '="' + match[1] + "?v=" + hash + '"');
  }
  await fs.writeFile(path.join(output, "index.html"), html);
  console.log("Built Personal OS in dist/ (index.html, css, js, assets).");
}

build().catch(error => { console.error(error); process.exitCode = 1; });
