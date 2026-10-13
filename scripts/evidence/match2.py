exec(open('match.py').read())
import datetime,random,difflib
STOP=set('tablets tablet ip i p usp bp injection inj syrup suspension capsules capsule oral solution sodium hydrochloride hcl and with the for gastro resistant extended release prolonged film coated dispersible dry mg ml w v tabs cream gel drops plus forte vet sustained modified chewable powder sachet lotion ointment hydrobromide phosphate sulphate potassium calcium vitamin acid'.split())
def dtoks(s): return set(w for w in re.findall(r'[a-z][a-z0-9]+',(s or '').lower()) if len(w)>=4 and w not in STOP)
def split_batches(b):
    parts=re.split(r'\s*(?:/|,|&|\band\b|;)\s*',b or '')
    ps=[norm(p) for p in parts if len(norm(p))>=3]
    return set(ps+[norm(b)])
def lmonth(s):  # 'OCT-2025' or 'Oct-2025'
    return datetime.datetime.strptime(s.title(),'%b-%Y').date()
def lev1(a,b):
    if abs(len(a)-len(b))>1: return False
    return difflib.SequenceMatcher(None,a,b).ratio()>=0.85
KEYS=list(byb)
def classify(r):
    bs=split_batches(r['batch'])
    exact=[c for b in bs if len(b)>=3 for c in byb.get(b,[])]
    pt=dtoks(r['product'])
    if exact:
        ok=[c for c in exact if pt & dtoks(c['str_product_name'])] 
        return ('exact' if ok or not pt else 'exact_batch_product_differs', exact)
    near=[]
    for b in bs:
        if len(b)<5: continue
        for k in KEYS:
            if len(k)>=5 and (lev1(b,k) or (b in k or k in b)):
                for c in byb[k]:
                    if pt & dtoks(c['str_product_name']): near.append(c)
    if near: return ('near',near)
    return ('none',[])
def ka_rows(a=datetime.date(2025,1,1),b=datetime.date(2026,7,31)):
    rows=[r for r in load_ka() if a<=r['_d']<=b]
    seen=set(); out=[]
    for r in rows:
        k=(norm(r['batch']),tuple(sorted(dtoks(r['product'])))[:2])
        if k in seen: continue
        seen.add(k); out.append(r)
    return rows,out
