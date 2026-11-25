"""Export the individual historical Lands without altering forest geometry."""
import argparse
from prepare_data import read, fc, save, combined
NAMES={'Istrien':'Istria / Austrian Littoral (source grouping)','Boehmen':'Bohemia','Bukovina':'Bukovina','Bosnien-Hercegovina':'Bosnia and Herzegovina','Dalmatien':'Dalmatia','Kaernten':'Carinthia','Krain':'Carniola','Kroatien-Slavonien':'Croatia-Slavonia','Galizien':'Galicia','Ungarn':'Hungary','Nieder-Oesterreich':'Lower Austria','Maehren':'Moravia','Salzburg':'Salzburg','Schlesien':'Silesia','Steiermark':'Styria','Tirol':'Tyrol','Ober-Oesterreich':'Upper Austria','Vorarlberg':'Vorarlberg'}
def export_lands(items):
    save('lands.geojson',fc([(g,{'name':NAMES.get(p['LAND'],p['LAND']),'source_name':p['LAND']}) for g,p in items],50))
if __name__=='__main__':
    from pathlib import Path
    p=argparse.ArgumentParser();p.add_argument('shapefile',type=Path);a=p.parse_args()
    items=read(a.shapefile);export_lands(items)
    save('empire.geojson',fc([(combined(items),{'name':'Austria-Hungary · 1910'})],50))
    print(f'Exported {len(items)} historical land outlines')
