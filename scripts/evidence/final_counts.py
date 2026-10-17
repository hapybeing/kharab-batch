# Reproduces the corrected Karnataka/Maharashtra "not on national portal" counts in SPEC.md §1.3
exec(open('match2.py').read())
SAME={'HTT24001','TC250238A'}          # hand-judged same batch as a CDSCO row (format/typo variants)
NOT_SAME_EXACT={'.'}                    # '.' batch string false-matches
# The IV-fluid firm discussed in VERIFICATION.md §1 is matched by the sha256 of one word of its name, so the script does not name it.
import hashlib
IV_FIRM_SHA='16dc473a3b8807e2db6328bd9e6585f081cf20ef99b7b6a5ce8cd827f380a5d1'
def iv_firm(r): return any(hashlib.sha256(w.encode()).hexdigest()==IV_FIRM_SHA for w in re.findall(r'[A-Z]+',r['mfr'].upper()))
COSMETIC_KA={"B''rare Cosmetics BEAUTY CREAM UNISEX"}
def kexp(s):
    for f in ('%Y-%m-%d','%m-%Y'):
        try: d=datetime.datetime.strptime(s.strip(),f).date(); return d.year*100+d.month
        except: pass
rows,ded=ka_rows()
out={}
for label,lo,hi in [('jan25_jul26',datetime.date(2025,1,1),datetime.date(2026,7,31)),('jan25_apr26',datetime.date(2025,1,1),datetime.date(2026,4,30))]:
    sub=[r for r in ded if lo<=r['_d']<=hi]
    def matched(r):
        c,_=classify(r); nb=norm(r['batch'])
        if nb in NOT_SAME_EXACT: return False
        return c.startswith('exact') or nb in SAME
    m=[r for r in sub if matched(r)]; u=[r for r in sub if not matched(r)]
    cos=[r for r in u if COSM.search(r['product']) and re.search(r'beauty|whiten|glow|soap|moistur',r['product'],re.I) and not re.search(r'ketoconazole|clindamycin|calamine',r['product'],re.I)]
    pb=[r for r in u if iv_firm(r)]
    out[label]=dict(unique=len(sub),matched=len(m),not_on_national=len(u),cosmetics_among_unmatched=len(cos),
        not_on_national_drugs=len(u)-len(cos),in_date_unmatched=sum(1 for r in u if (kexp(r['exp']) or 0)>=202610),
        one_iv_firm_unmatched=len(pb),one_iv_firm_total=len([r for r in sub if iv_firm(r)]))
print(json.dumps(out,indent=1))
