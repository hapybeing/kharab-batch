# Reproduces the corrected Karnataka/Maharashtra "not on national portal" counts in SPEC.md §1.3
exec(open('match2.py').read())
SAME={'HTT24001','TC250238A'}          # hand-judged same batch as a CDSCO row (format/typo variants)
NOT_SAME_EXACT={'.'}                    # '.' batch string false-matches
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
    pb=[r for r in u if 'PASCHIM' in r['mfr'].upper()]
    out[label]=dict(unique=len(sub),matched=len(m),not_on_national=len(u),cosmetics_among_unmatched=len(cos),
        not_on_national_drugs=len(u)-len(cos),in_date_unmatched=sum(1 for r in u if (kexp(r['exp']) or 0)>=202610),
        paschim_banga_unmatched=len(pb),paschim_banga_total=len([r for r in sub if 'PASCHIM' in r['mfr'].upper()]))
print(json.dumps(out,indent=1))
