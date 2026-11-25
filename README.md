# INWOOD — Forest Cover Atlas

Web GIS statico per Belluno, Dolina, Szeben e il futuro caso Háromszék. Coperture integrali e confine dell'Austria-Ungheria del 1910 come contesto, senza ritagli imperiali o amministrativi.

## Uso

Servire `dist/` con qualsiasi server statico, ad esempio:

```sh
python -m http.server 8766 --directory dist
```

Aprire http://localhost:8766. Selezionare caso, prima/seconda rilevazione, variazioni o confronto a scorrimento. Le superfici sono disponibili in ha e km²; i popup mostrano le componenti dissolte. L'alternanza visualizza solo le due carte, senza interpolazione temporale. CSV e GeoJSON analitici compressi sono scaricabili dall'interfaccia.

La base Naturale è locale, senza etichette né elementi antropici; Natural Earth 1:50m è adatta al contesto europeo, con dettaglio limitato allo zoom locale. OSM mostra la cartografia attuale. CARTO Positron senza etichette è opzionale: richiede una chiave da inserire nell'interfaccia, mantenuta solo in memoria; contiene strade ed elementi antropici. Nessun segreto è incluso nel repository.

## Elaborazione riproducibile

```sh
python -m pip install --target .gis-deps -r requirements.txt
python scripts/prepare_data.py "PERCORSO/ALLA/CARTELLA/GIS"
python scripts/validate_data.py
```

Il percorso GIS deve contenere i file forniti, con nomi univoci. Lo shapefile imperiale richiede almeno `.shp`, `.shx`, `.dbf`, `.prj`. Gli originali vengono solo letti e non sono inclusi nel repository. Il catalogo registra nome, SHA-256, CRS, numero di oggetti e geometrie invalide riparate. Le geometrie analitiche derivate sono incluse, insieme ai vettori per la visualizzazione.

La pipeline legge il CRS dichiarato, ripara geometrie invalide, mantiene le parti poligonali, riproietta in EPSG:3035 e dissolve ciascuna epoca prima delle operazioni. Calcola intersezione (persistenza), seconda meno prima (guadagno), prima meno seconda (perdita). Verifica le identità delle aree e la disgiunzione di guadagno e perdita. La cartografia usa WGS84, semplificazione topologica di 5 m per componente e omette solo in visualizzazione le componenti sotto 25 m². Statistiche e file `.full.geojson.gz` non applicano questi filtri.

I confini amministrativi non tagliano i boschi. Nel metodo dell'interfaccia si riportano le superfici esterne ai confini di studio e quelle interne al perimetro imperiale, per rilevare discrepanze senza alterare i dati.

## Casi e cronologia

| Caso | Prima | Seconda | Note |
|---|---|---|---|
| Belluno | TMS 1 Aus | TMS 3 Aus | Anni precisi da fornire; non vengono assegnati 1875/1914 automaticamente |
| Dolina | 1877 | 1914 | Anni desunti dai nomi forniti |
| Szeben | 1875 | 1914 | I nomi originali Fogaras sono un errore materiale segnalato dall'autore |
| Háromszék | — | — | Solo confine, coperture non disponibili |

Belluno usa l'unione del confine provinciale 1881 fornito con Cortina d'Ampezzo, Livinallongo del Col di Lana e Colle Santa Lucia, selezionati dal file dei comuni del 1991. I tre perimetri restano visibili separatamente; non sono presentati come confini comunali ottocenteschi.

Per cambiare le date aggiornare le etichette in `specs` dentro `scripts/prepare_data.py` e rigenerare. Per Háromszék aggiungere i due nomi di file e le due etichette all'ultima voce: il frontend abilita automaticamente tutti i confronti, senza modifiche al codice UI.

## Limiti interpretativi

Le differenze includono possibili effetti di scala, georeferenziazione, digitalizzazione e classificazione. Non è stata fornita una maschera indipendente dell'area effettivamente rilevata: il confronto assume che i due censimenti abbiano copertura comparabile. Non si applicano soglie analitiche di significatività e non si inferisce un tasso annuale. Valutare i risultati con le carte originali prima di interpretarli come variazioni reali.

## Basi e attribuzioni

- Leaflet 1.9.4, vendorizzato; licenza in `dist/vendor/LEAFLET-LICENSE`.
- OpenStreetMap: https://www.openstreetmap.org/copyright
- CARTO: https://github.com/CartoDB/basemap-styles e https://carto.com/basemaps/
- Natural Earth, pubblico dominio: https://www.naturalearthdata.com/about/terms-of-use/

La base naturale deriva dai file `ne_50m_land`, `ne_50m_lakes`, `ne_50m_rivers_lake_centerlines` del repository https://github.com/nvkelso/natural-earth-vector/tree/master/geojson, ritagliati a [-15,30,40,65]. Per rigenerarla scaricare i tre GeoJSON in `.cache/land.geojson`, `.cache/lakes.geojson`, `.cache/rivers.geojson`, quindi eseguire `python scripts/prepare_basemap.py`.

I diritti dei dati di ricerca restano ai rispettivi titolari; non viene attribuita una licenza aperta non fornita dall'autore. I font di Google sono opzionali: in assenza di rete vengono usati i font di sistema.

## Pubblicazione

`dist/` è autonomo e utilizzabile su GitHub Pages o altro hosting statico. Il workflow Pages può essere avviato manualmente dalla scheda Actions dopo aver scelto **GitHub Actions** in Settings → Pages. La configurazione `.openai/hosting.json` serve per la distribuzione Sites e non è richiesta da GitHub Pages.
