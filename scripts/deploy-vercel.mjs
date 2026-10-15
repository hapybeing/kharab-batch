// Deploy the built site (docs/) to Vercel as an independent mirror of GitHub Pages: no build step, static files only.
//   NODE_USE_ENV_PROXY=1 VERCEL_TOKEN=… node scripts/deploy-vercel.mjs      → https://kharab-batch.vercel.app
// Files are uploaded one by one (POST /v2/files, keyed by sha1) and the deployment references them by sha,
// because an inline base64 body hits Vercel's 10 MB request limit once the demo MP4 is in docs/video/.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const root = new URL("../docs/", import.meta.url).pathname;
const auth = { authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = [];
for (const p of walk(root)) {
  const data = fs.readFileSync(p); const sha = crypto.createHash("sha1").update(data).digest("hex");
  const r = await fetch("https://api.vercel.com/v2/files", { method: "POST", headers: { ...auth, "content-type": "application/octet-stream", "x-vercel-digest": sha, "content-length": String(data.length) }, body: data });
  if (!r.ok) { console.error("upload failed", path.relative(root, p), r.status, await r.text()); process.exit(1); }
  files.push({ file: path.relative(root, p), sha, size: data.length });
}
const r = await fetch("https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1", { method: "POST",
  headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ name: "kharab-batch", target: "production", files, projectSettings: { framework: null, buildCommand: null, outputDirectory: null, installCommand: null } }) });
const j = await r.json(); console.log(j.error || { id: j.id, url: j.url, alias: j.alias, files: files.length });
