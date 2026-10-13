exec(open('match2.py').read())
import glob
d=json.load(open('snap/cdsco_nsq_2025_2026_20261013.json'))['months']
MON={'November-2025':'Nov-2025','December-2025':'Dec-2025','February-2026':'Feb-2026','March-2026':'Mar-2026','April-2026':'Apr-2026','May-2026':'May-2026','June-2026':'Jun-2026'}
res=[]
for fn in sorted(glob.glob('hm/Drug-Alert-*.raw.txt')):
    m=re.match(r'hm/Drug-Alert-(.+)-(States|CDSCO)\.raw\.txt',fn); mon,src=MON[m.group(1)],m.group(2)
    key='state' if src=='States' else 'cdsco'
    rows=[r for r in d[mon] if key in r['str_reporting_source'].lower()]
    L=open(fn).read().split('\n'); starts=[];exp=1
    for i,l in enumerate(L):
        mm=re.match(r'^\s*(\d{1,3})\b',l)
        if mm and int(mm.group(1))==exp: starts.append(i); exp+=1
    starts.append(len(L))
    segs=[norm(' '.join(L[starts[j]:starts[j+1]])) for j in range(len(starts)-1)]
    def inseg(b,s): return len(b)>=3 and b in s
    removed=[j+1 for j,s in enumerate(segs) if not any(inseg(norm(r['str_batch_no']),s) for r in rows)]
    blob=''.join(segs)+norm(open(fn.replace('.raw','')).read() if False else '')
    added=[r for r in rows if len(norm(r['str_batch_no']))>=3 and norm(r['str_batch_no']) not in blob]
    res.append((mon,src,len(segs),len(rows),removed,[(r['str_batch_no'].replace('\n',''),r['str_reported_by_lab_or_state'][:22].replace('\n',' ')) for r in added]))
for x in res: print(x[0],x[1],'PDF rows',x[2],'portal',x[3],'PDF-rows-not-on-portal',x[4],'portal-rows-not-in-PDF',len(x[5])); 
json.dump(res,open('hm_diff.json','w'),ensure_ascii=False,indent=1)
