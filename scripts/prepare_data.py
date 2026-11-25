"""Rebuild the atlas from the supplied GIS directory. Original files are read only."""
import argparse, csv, gzip, hashlib, json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.gis-deps'))
import shapefile
from shapely import make_valid, union_all
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, GeometryCollection, box
from shapely.ops import transform
from pyproj import CRS, Transformer

OUT = ROOT / 'dist' / 'data'
OUT.mkdir(parents=True, exist_ok=True)
TO_WEB = Transformer.from_crs(3035, 4326, always_xy=True).transform
AUDIT = []

def polygonal(g):
    if isinstance(g, (Polygon, MultiPolygon)): return g
    return union_all([polygonal(x) for x in g.geoms]) if hasattr(g, 'geoms') else Polygon()

def clean(g):
    return polygonal(make_valid(g))

def read(path):
    if path.suffix == '.shp':
        reader = shapefile.Reader(str(path))
        features = list(reader.__geo_interface__['features'])
        crs = CRS.from_wkt(path.with_suffix('.prj').read_text())
    else:
        d = json.loads(path.read_text(encoding='utf-8-sig'))
        features = d['features']
        crs = CRS.from_user_input(d.get('crs', {}).get('properties', {}).get('name', 'EPSG:4326'))
    project = Transformer.from_crs(crs, 3035, always_xy=True).transform
    result = []; invalid = 0
    for f in features:
        if not f['geometry']: continue
        g = shape(f['geometry']); invalid += int(not g.is_valid)
        result.append((clean(transform(project, clean(g))), f['properties']))
    AUDIT.append(dict(file=path.name, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), crs=crs.to_string(), features=len(features), invalid_repaired=invalid))
    return result

def combined(items): return clean(union_all([g for g, _ in items]))

def fc(items, simplify=0):
    features=[]
    for geom, props in items:
        if geom.is_empty: continue
        props = dict(props, area_ha=geom.area/10000, area_km2=geom.area/1000000)
        display = geom.simplify(simplify, preserve_topology=True) if simplify else geom
        features.append(dict(type='Feature', properties=props, geometry=mapping(clean(transform(TO_WEB, display)))))
    return dict(type='FeatureCollection', features=features)

def save(name, obj):
    (OUT/name).write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def layer(name, geom, props):
    # Dissolved, disjoint polygon components: popups report exact component areas.
    parts=list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    items=[(g,dict(props,component=i+1)) for i,g in enumerate(parts)]
    save(name+'.geojson',fc([(g,p) for g,p in items if g.area>=25],5))
    with gzip.open(OUT/(name+'.full.geojson.gz'),'wt',encoding='utf-8') as f:
        json.dump(fc(items),f,ensure_ascii=False,separators=(',',':'))

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('gis_root',type=pathlib.Path); args=parser.parse_args()
    def source(name):
        paths=list(args.gis_root.rglob(name))
        if len(paths)!=1: raise ValueError(f'Expected exactly one {name}, found {len(paths)}')
        return read(paths[0])
    lands=source('Austro_Hungarian_Empire_Lands.shp')
    from export_context import export_lands
    export_lands(lands)
    empire=combined(lands)
    save('empire.geojson',fc([(empire,{'name':'Austria-Hungary · 1910'})],50))
    municipalities=[(g,{'name':p['COMUNE']}) for g,p in source('Comuni_Belluno_1991.geojson') if p['COMUNE'].startswith(('Cortina','Livinallongo','Colle Santa Lucia'))]
    assert len(municipalities)==3
    save('municipalities.geojson',fc(municipalities,5))
    specs=[
      ('belluno','Belluno','Italia','Provincia e tre comuni oggi bellunesi','Provincia_Belluno_1881.geojson',['Copertura_TMS_1Aus.geojson','Copertura_TMS_3Aus.geojson'],['TMS 1 Aus','TMS 3 Aus']),
      ('dolina','Dolina','Galizia','Distretto di Dolina','Dolyna_District.geojson',['Copertura_Dolina_1877.geojson','Copertura_Dolina_1914.geojson'],['1877','1914']),
      ('szeben','Szeben','Ungheria','Contea di Szeben','Szeben_County.geojson',['Copertura_Fogaras_1875.geojson','Copertura_Fogaras_1914.geojson'],['1875','1914']),
      ('haromszek','Háromszék','Ungheria','Contea di Háromszék','Haromszek_County.geojson',[],[])]
    chronology=json.loads((OUT/'chronology.json').read_text(encoding='utf-8'))
    cases=[]; boundaries=[]; rows=[]
    for key,name,region,subtitle,boundaryfile,files,labels in specs:
        boundary=combined(source(boundaryfile))
        if key=='belluno': boundary=clean(union_all([boundary]+[g for g,p in municipalities]))
        boundaries.append((boundary,{'id':key,'name':name}))
        case=dict(id=key,name=name,region=region,subtitle=subtitle,labels=labels,sources=files,boundary_km2=boundary.area/1e6,available=bool(files))
        case.update(chronology[key]); labels=case['labels']
        if not files:
            case['bounds']=list(transform(TO_WEB,boundary).bounds); cases.append(case); continue
        print('Processing',name,flush=True)
        a,b=[combined(source(f)) for f in files]
        stable=clean(a.intersection(b)); gain=clean(b.difference(a)); loss=clean(a.difference(b))
        assert abs(a.area-stable.area-loss.area)<max(1,a.area*1e-9)
        assert abs(b.area-stable.area-gain.area)<max(1,b.area*1e-9)
        assert gain.intersection(loss).area<1
        geoms=dict(early=a,late=b,stable=stable,gain=gain,loss=loss)
        stats={k:g.area/1e6 for k,g in geoms.items()}; stats['net']=stats['late']-stats['early']
        stats['net_pct']=100*stats['net']/stats['early'] if stats['early'] else None
        case['stats']=stats
        case['outside_boundary_km2']={k:g.difference(boundary).area/1e6 for k,g in [('early',a),('late',b)]}
        case['inside_empire_km2']={k:g.intersection(empire).area/1e6 for k,g in [('early',a),('late',b)]}
        case['bounds']=list(transform(TO_WEB,union_all([boundary,a,b])).bounds)
        for k,g in geoms.items():
            layer(f'{key}-{k}',g,{'case':name,'class':k,'label':labels[0] if k=='early' else labels[1] if k=='late' else k})
            rows.append(dict(case=name,layer=k,area_ha=g.area/1e4,area_km2=g.area/1e6))
        cases.append(case)
    from coverage_ratios import add_coverage, export_csv
    for case in cases: add_coverage(case)
    export_csv(cases)
    save('boundaries.geojson',fc(boundaries,5))
    save('catalog.json',dict(cases=cases,method=dict(area_crs='EPSG:3035',display_crs='EPSG:4326',display_simplification_m=5,display_min_component_m2=25,imperial_clipping=False,boundary_clipping=False),audit=AUDIT))
    with (OUT/'areas.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['case','layer','area_ha','area_km2']); writer.writeheader(); writer.writerows(rows)
    print(json.dumps(cases,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
