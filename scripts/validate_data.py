"""Check numerical identities, analytical geometry validity, exports and display bounds."""
import gzip,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.gis-deps'))
from shapely.geometry import shape
DATA=ROOT/'dist/data';cat=json.loads((DATA/'catalog.json').read_text(encoding='utf-8'))
assert len(cat['cases'])==4
for c in cat['cases']:
    assert -180<c['bounds'][0]<c['bounds'][2]<180
    assert -90<c['bounds'][1]<c['bounds'][3]<90
    if not c['available']:
        assert c['id']=='haromszek' and 'stats' not in c
        continue
    s=c['stats']
    for lhs,rhs in [(s['early'],s['stable']+s['loss']),(s['late'],s['stable']+s['gain']),(s['net'],s['gain']-s['loss'])]: assert abs(lhs-rhs)<1e-6
    for k in ['early','late','stable','gain','loss']:
        with gzip.open(DATA/f'{c["id"]}-{k}.full.geojson.gz','rt',encoding='utf-8') as f: full=json.load(f)
        assert abs(sum(f['properties']['area_km2'] for f in full['features'])-s[k])<1e-6
        assert all(shape(f['geometry']).is_valid for f in full['features'])
        display=json.loads((DATA/f'{c["id"]}-{k}.geojson').read_text(encoding='utf-8'))
        assert all(f['properties']['area_ha']>=.0025 for f in display['features'])
        assert len(display['features'])<=len(full['features'])
    print(c['id'],': analytical exports and area identities OK')
assert len(json.loads((DATA/'municipalities.geojson').read_text(encoding='utf-8'))['features'])==3
assert all((ROOT/'dist'/p).exists() for p in ['index.html','style.css','app.js','vendor/leaflet.js','vendor/leaflet.css','data/natural.geojson'])
print('All checks passed.')
