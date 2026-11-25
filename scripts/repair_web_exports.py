"""Repair numerical ring degeneracies introduced by the final WGS84 transform."""
import gzip,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.gis-deps'))
from prepare_data import clean
from shapely.geometry import shape,mapping
for p in (ROOT/'dist/data').glob('*geojson*'):
    if p.name=='natural.geojson':continue
    compressed=p.suffix=='.gz'
    with (gzip.open(p,'rt',encoding='utf-8') if compressed else p.open(encoding='utf-8')) as f:d=json.load(f)
    count=0
    for f in d['features']:
        g=shape(f['geometry'])
        if not g.is_valid:f['geometry']=mapping(clean(g));count+=1
    if count:
        with (gzip.open(p,'wt',encoding='utf-8') if compressed else p.open('w',encoding='utf-8')) as f:json.dump(d,f,ensure_ascii=False,separators=(',',':'))
        print(p.name,count,'repaired')
