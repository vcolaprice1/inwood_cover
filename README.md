# INWOOD — Forest Cover Atlas

Live atlas: https://vcolaprice1.github.io/inwood_cover/

An English-language historical forest GIS for Belluno, Dolina, Szeben and the forthcoming Háromszék case. Compare earlier and later reconstructions, persistent forest, gain and loss; use swipe or alternating views; inspect areas in hectares and square kilometres; download CSV and complete analytical GeoJSON.

## Chronology

| Study area | Earlier reconstruction | Later reconstruction |
|---|---|---|
| Belluno | 1875–1876; substitute sheets: Pieve di Cadore 1908, Aviano 1916, Conegliano 1918 | 1914–1918 |
| Dolina, Galicia | 1876–1878 | Mainly 1914; Okormezo 1907; Porohy undated, provisionally attributed to the 1914 series |
| Szeben | 1875–1879 | 1912–1915 |
| Háromszék | Forthcoming | Forthcoming |

Dates and notes are maintained in `dist/data/chronology.json`. Run `python scripts/update_metadata.py` after editing it. This updates the catalogue and date labels in downloads without changing analytical geometry. The later Belluno dates apply to the second forest reconstruction already supplied to the project. The map periods are not spatially uniform; Belluno's substitute sheets overlap the later period.

## Local preview

Serve the static `dist/` directory:

```sh
python -m http.server 8766 --directory dist
```

Open http://localhost:8766. No frontend build or API key is required.

## Basemaps and boundaries

The default basemap uses OpenStreetMap/OpenMapTiles vector data hosted by OpenFreeMap, rendered through MapLibre with a custom style containing water and natural land-cover layers only. Labels, roads, buildings, settlements, POIs and administrative borders are excluded. The pale modern land cover is context, not historical forest data. Lakes can include artificial reservoirs. Standard OSM is also available.

If vector rendering or tile loading fails, the interface explicitly announces a local Natural Earth fallback (1:50 million). CARTO is not used.

Austria-Hungary's outer boundary and 18 historical Lands come from the supplied 1910 boundary dataset. They are drawn as outlines with white halos and no polygon fill. Land names follow the dataset's groupings rather than a claim of uniform administrative status. The first source feature groups the Austrian Littoral under Istrien. Study-area and municipal boundaries can be switched independently.

## Methods

The in-app Methods & sources dialog documents:

- Colour Third Military Survey maps: raster cropping, distributed training samples, dzetsaka Random Forest classification, binary forest-mask extraction, Sieve filtering, polygonisation, metric reprojection, geometry repair, minimum patch area, hole inspection/restoration, simplification, smoothing, dissolution and visual validation. Settings come from the project's QGIS guide and are not reapplied by the atlas.
- Black-and-white maps: dependent vectorisation following Bednarczyk, Kaim & Ostafin (2016).
- Overlay uncertainty and sliver polygons: Sae-Jung, Chen & Phuong (2008), especially p. 827. The atlas does not implement their error simulations or split-and-merge correction.
- Backdating/updating: Kaim et al. (2016) and Feranec et al. (2007). Choosing the closest available map sheet is separately documented as the project's source-selection rule.

Full references and DOI links are provided in the dialog. It distinguishes the source-extraction thresholds from the separate web-display simplification.

## Reproducible analytical processing

```sh
python -m pip install --target .gis-deps -r requirements.txt
python scripts/prepare_data.py "PATH/TO/GIS"
python scripts/validate_data.py
```

The input directory must contain the supplied files under unique names. The imperial shapefile requires its accompanying SHX, DBF and PRJ files. Input files are read only. The catalogue records filenames, SHA-256 fingerprints, source CRS and geometry repairs for provenance, although filenames are not discussed in the interface.

Each reconstruction is repaired, projected to EPSG:3035 and dissolved before calculating areas. Persistence is the intersection; gain is later minus earlier; loss is earlier minus later. Net change is gain minus loss. Within-period overlaps are counted once. All supplied forest coverage is retained without clipping to the administrative or imperial boundaries. Out-of-boundary areas are reported in the methods panel.

The web map uses WGS84 geometry simplified by 5 m and omits components below 25 m² for display only. Full analytical GeoJSON downloads and statistics preserve all components without these display filters. Final WGS84 exports are repaired for numerical degeneracies introduced by reprojection. No independent survey-footprint mask was supplied; comparable coverage is assumed. Map differences are not automatically real forest changes, and annual rates are not estimated.

Belluno's study outline combines the supplied provincial boundary with Cortina d'Ampezzo, Livinallongo del Col di Lana and Colle Santa Lucia. Their separate municipal outlines refer to 1991.

To add Háromszék forest coverage, populate its input filenames in `scripts/prepare_data.py` and its date metadata in `dist/data/chronology.json`, then regenerate. The interface automatically enables comparison when data are available.

## Deployment

GitHub Pages serves the root of the `gh-pages` branch. After committing changes to main:

```sh
git push origin main
git subtree split --prefix=dist -b codex/pages
git push origin codex/pages:gh-pages
```

The existing local `codex/pages` branch can be updated by the subtree command when its history is compatible. Do not force-push unrelated history. The optional Actions workflow supports a future switch to Actions-based Pages publishing. Sites configuration is stored in `.openai/hosting.json`; it does not affect GitHub Pages.

## Attribution

- Leaflet 1.9.4; MapLibre GL JS 5.6.2; MapLibre GL Leaflet 0.1.4. Vendor licences are in `dist/vendor/`.
- OpenStreetMap: https://www.openstreetmap.org/copyright
- OpenFreeMap: https://openfreemap.org/quick_start/
- OpenMapTiles: https://openmaptiles.org/
- Natural Earth fallback, public domain: https://www.naturalearthdata.com/about/terms-of-use/

Natural Earth fallback data derive from 1:50m land, lakes and rivers, clipped to Europe. Research-data rights remain with their holders; no open licence is assigned without the author's instruction. Google Fonts are optional, with system-font fallbacks.
