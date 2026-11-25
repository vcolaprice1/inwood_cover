"""Forest share of each complete study-area boundary, from analytical areas."""
import csv,json,pathlib
DATA=pathlib.Path(__file__).resolve().parents[1]/'dist/data'
def add_coverage(case):
    if not case['available']:return
    total=case['boundary_km2']
    if total<=0:raise ValueError('Study area must be positive')
    inside={k:case['stats'][k]-case['outside_boundary_km2'][k] for k in ['early','late']}
    assert all(-1e-8<=a<=total+1e-8 for a in inside.values())
    case['coverage']={'forest_inside_km2':inside,'percent':{k:100*a/total for k,a in inside.items()}}
    case['coverage']['change_percentage_points']=case['coverage']['percent']['late']-case['coverage']['percent']['early']

def export_csv(cases):
    fields=['case','period','map_dates','study_area_ha','study_area_km2','forest_inside_ha','forest_inside_km2','forest_share_percent']
    with (DATA/'forest-share.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for c in cases:
            if not c['available']:continue
            for i,k in enumerate(['early','late']):
                a=c['coverage']['forest_inside_km2'][k]
                w.writerow(dict(case=c['name'],period=k,map_dates=c['labels'][i],study_area_ha=c['boundary_km2']*100,study_area_km2=c['boundary_km2'],forest_inside_ha=a*100,forest_inside_km2=a,forest_share_percent=c['coverage']['percent'][k]))

if __name__=='__main__':
    p=DATA/'catalog.json';d=json.loads(p.read_text(encoding='utf-8'))
    for c in d['cases']:
        add_coverage(c)
        if c['available']:print(c['name'],c['coverage']['percent'])
    p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8');export_csv(d['cases'])
