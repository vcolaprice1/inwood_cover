"""Apply the documented display-only minimum to an existing export."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]/'dist/data'
for p in root.glob('*.geojson'):
    if not any(p.stem.endswith('-'+k) for k in ['early','late','stable','gain','loss']):continue
    d=json.loads(p.read_text(encoding='utf-8'))
    d['features']=[f for f in d['features'] if f['properties']['area_ha']>=.0025]
    p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
p=root/'catalog.json';d=json.loads(p.read_text(encoding='utf-8'));d['method']['display_min_component_m2']=25
p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
