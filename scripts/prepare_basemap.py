"""Clip cached Natural Earth 1:50m GeoJSON to the atlas's European extent."""
import json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.gis-deps'))
from shapely.geometry import shape,mapping,box
features=[]
for kind in ['land','lakes','rivers']:
    data=json.loads((ROOT/'.cache'/f'{kind}.geojson').read_text(encoding='utf-8'))
    for f in data['features']:
        g=shape(f['geometry']).intersection(box(-15,30,40,65))
        if not g.is_empty: features.append(dict(type='Feature',properties={'kind':kind},geometry=mapping(g)))
(ROOT/'dist/data/natural.geojson').write_text(json.dumps(dict(type='FeatureCollection',features=features),separators=(',',':')),encoding='utf-8')
print('Natural basemap:',len(features),'features')
