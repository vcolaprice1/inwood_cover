"""Apply source dates and English descriptions without recalculating geometry."""
import gzip,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1];DATA=ROOT/'dist/data'
chronology=json.loads((DATA/'chronology.json').read_text(encoding='utf-8'))
p=DATA/'catalog.json';catalog=json.loads(p.read_text(encoding='utf-8'))
for case in catalog['cases']:
    case.update(chronology[case['id']])
    if not case['available']:continue
    for key,label in zip(['early','late'],case['labels']):
        for suffix in ['.geojson','.full.geojson.gz']:
            q=DATA/(case['id']+'-'+key+suffix);compressed=suffix.endswith('.gz')
            with (gzip.open(q,'rt',encoding='utf-8') if compressed else q.open(encoding='utf-8')) as f:d=json.load(f)
            for feature in d['features']:feature['properties']['label']=label
            with (gzip.open(q,'wt',encoding='utf-8') if compressed else q.open('w',encoding='utf-8')) as f:json.dump(d,f,ensure_ascii=False,separators=(',',':'))
p.write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Updated chronology; analytical areas and geometry unchanged')
