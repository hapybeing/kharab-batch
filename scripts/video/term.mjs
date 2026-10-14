// Renders the REAL CLI transcript (kharab-batch/video/terminal-session.txt) as a terminal replay and records it.
// Output text is copied verbatim; only the 35 s source re-fetch wait of `verify` is shortened (said on screen).
//   PW=… OUT=build node term.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PW || "playwright");
const OUT = process.env.OUT || "build";
const raw = fs.readFileSync(path.join(HERE, "../../video/terminal-session.txt"), "utf8").trimEnd().split("\n");
const header = raw[0].replace(/^# /, "");
// split into steps: {cmd, out[], took}
const steps = []; let cur = null;
for (const l of raw.slice(1)) {
  if (l.startsWith("$ ")) { cur = { cmd: l.slice(2), out: [] }; steps.push(cur); }
  else if (l.startsWith("# took")) cur.took = l.replace("# took ", "");
  else cur.out.push(l);
}
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const color = l => {
  let h = esc(l);
  h = h.replace(/(RED)/, '<b class="red">$1</b>').replace(/^(MATCH)/, '<b class="ok">$1</b>').replace(/^(2\/2 readers agree)/, '<b class="ok">$1</b>')
    .replace(/(owner 0x…dEaD \(sealed\))/, '<span class="seal">$1</span>').replace(/(48 days)/, '<b class="hi">$1</b>');
  return h;
};
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0b1020;width:1920px;height:1080px;overflow:hidden;font-family:"DejaVu Sans Mono",monospace}
.win{position:absolute;left:70px;top:46px;width:1780px;height:820px;background:#0f172a;border-radius:16px;box-shadow:0 20px 60px #0008;border:1px solid #334155;overflow:hidden}
.bar{height:44px;background:#1e293b;display:flex;align-items:center;padding:0 18px;gap:10px;color:#94a3b8;font:20px "Noto Sans",sans-serif}
.dot{width:14px;height:14px;border-radius:50%;background:#ef4444}.dot:nth-child(2){background:#f59e0b}.dot:nth-child(3){background:#22c55e}
.t{padding:18px 26px;color:#e2e8f0;font-size:21px;line-height:1.42;white-space:pre-wrap;word-break:break-all}
.p{color:#38bdf8}.c{color:#f8fafc}.red{color:#f87171}.ok{color:#4ade80}.seal{color:#fbbf24}.hi{color:#fde047}.dim{color:#64748b}
.cur{display:inline-block;width:12px;background:#e2e8f0;animation:b 1s steps(1) infinite}@keyframes b{50%{opacity:0}}
.tag{position:absolute;left:70px;top:880px;color:#94a3b8;font:22px "Noto Sans",sans-serif}
</style><div class="win"><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>&nbsp; kharab-batch — no website, no backend: the CLI reads Arkiv directly</div><div class="t" id="t"></div></div>
<div class="tag">${esc(header)}</div>
<script>
const steps=${JSON.stringify(steps)}, color=${color.toString()}, esc=${esc.toString()};
const t=document.getElementById('t'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){ await sleep(500);
 for(const [i,s] of steps.entries()){
  const line=document.createElement('div'); line.innerHTML='<span class="p">$ </span><span class="c"></span><span class="cur">&nbsp;</span>'; t.appendChild(line);
  const c=line.querySelector('.c'); for(const ch of s.cmd){ c.textContent+=ch; await sleep(s.cmd.length>60?14:32); }
  await sleep(350); line.querySelector('.cur').remove();
  if(i===1){ const w=document.createElement('div'); w.className='dim'; w.textContent='… re-fetching the regulator\\'s own page (took '+s.took+'; wait shortened in this video)'; t.appendChild(w); await sleep(1100); }
  else await sleep(900);
  for(const l of s.out){ const d=document.createElement('div'); d.innerHTML=color(l)||'&nbsp;'; t.appendChild(d); await sleep(60); }
  window['done'+i]=Date.now(); await sleep(i===0?3800:1500);
 }
 window.finished=true; }
run();
</script>`;
fs.mkdirSync(`${OUT}/clips`, { recursive: true });
fs.writeFileSync(`${OUT}/term.html`, html);
export { html };
