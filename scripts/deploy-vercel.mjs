// Deploy the built site (docs/) to Vercel as an independent mirror of GitHub Pages: no build step, static files only.
//   VERCEL_TOKEN=… node scripts/deploy-vercel.mjs      → https://kharab-batch.vercel.app
import fs from "node:fs"; import path from "node:path";
const root = new URL("../docs/", import.meta.url).pathname;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(root).map(p => ({ file: path.relative(root, p), data: fs.readFileSync(p).toString("base64"), encoding: "base64" }));
const r = await fetch("https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1", { method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  body: JSON.stringify({ name: "kharab-batch", target: "production", files, projectSettings: { framework: null, buildCommand: null, outputDirectory: null, installCommand: null } }) });
const j = await r.json(); console.log(j.error || { id: j.id, url: j.url, alias: j.alias });
