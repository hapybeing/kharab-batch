import json,re,collections,datetime,difflib
def norm(b): return re.sub(r'[^A-Z0-9]','',(b or '').upper())
cd=[]
for f in ['snap/cdsco_nsq_2025_2026_20261013.json','snap/cdsco_nsq_2024_20261013.json','snap/cdsco_spurious_2024_2026_20261013.json']:
    d=json.load(open(f))
    for m,rows in d['months'].items():
        for r in rows:
            r['_list']=m; r['_tab']=d['tab']; r.setdefault('str_product_name', r.get('product_name_from_dtl','')); r['str_product_name']=r['str_product_name'] or ''; r['str_manufactured_by']=r.get('str_manufactured_by') or ''; r['str_reported_by_lab_or_state']=r.get('str_reported_by_lab_or_state') or ''; cd.append(r)
byb=collections.defaultdict(list)
for r in cd: byb[norm(r['str_batch_no'])].append(r)
def ptok(s):
    w=re.findall(r'[a-z0-9]+',(s or '').lower()); return w
COSM=re.compile(r'shower|gel\b|shampoo|soap|cream|lotion|face ?wash|hair|kajal|lipstick|powder|deo|perfume|serum|sunscreen|toothpaste|mouthwash|nail|henna|mehendi|dye|body wash|talc|moisturi',re.I)
def load_ka():
    k=json.load(open('../data/ka_kspc_nsq_20261012.json'))
    out=[]
    for r in k:
        d=datetime.datetime.strptime(r['nsq_date'],'%d-%b-%Y').date()
        r['_d']=d; out.append(r)
    return out
