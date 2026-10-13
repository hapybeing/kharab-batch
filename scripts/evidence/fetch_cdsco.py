#!/usr/bin/env python3
# usage: fetch_cdsco.py TAB YEAR... > out.json   (TAB = nsq | spurious)
import json, sys, time, urllib.request, http.cookiejar
B="https://cdscoonline.gov.in/CDSCO"
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders=[("User-Agent","kharab-batch-mirror/0.1 (+github.com/hapybeing)")]
def get(p):
    raw=op.open(B+p,timeout=60).read()
    try: return raw.decode("utf-8")
    except UnicodeDecodeError: return raw.decode("cp1252",errors="replace")
get("/viewPublicNSQDrug")
tab=sys.argv[1]; fn={"nsq":"filteredNsqDrugTable","spurious":"filteredSpuriousDrugTable"}[tab]
out={}
for y in sys.argv[2:]:
    for m in json.loads(get(f"/publicReportingMonths?year={y}&tab={tab}")):
        rows=json.loads(get(f"/{fn}?month={m}-{y}&source=All&tab={tab}"))["aaData"]
        out[f"{m}-{y}"]=rows; print(f"{tab} {m}-{y}: {len(rows)}",file=sys.stderr); time.sleep(1.0)
json.dump({"fetched_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"tab":tab,"months":out},sys.stdout,ensure_ascii=False)
