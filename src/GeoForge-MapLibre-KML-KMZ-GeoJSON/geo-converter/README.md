# GeoForge — MapLibre spatial converter

Open `index.html` in a modern browser. This build uses **MapLibre GL JS 5.6.0**, loaded from unpkg, so an internet connection is required for the mapping engine and OSM/MetroMap tiles. **JSZip is bundled locally** so the application can import/export KMZ without a server. No local server, account, build step, or file upload is necessary. If opening directly from `file://` and your browser blocks tile requests, open the folder through an ordinary static web server.

## Features

- Import multiple `.kml`, `.kmz`, `.geojson`, or `.json` files (KML Placemark points, lines, polygons, MultiGeometry, extended data).
- Draw points, lines, and polygons; drag the toolbar, finish or undo; press Escape to cancel.
- Show or hide geodesic segment-length annotations and polygon area annotations in square metres. Polygon perimeter also appears when length annotations are enabled. Measurements approximate ground distances on a sphere (radius 6,371,008.8 m). Labels are capped at 800 for browser performance; exported geometries are unaffected.
- Select features, control visibility, zoom, delete, and clear the workspace. Export all, visible, or selected features to GeoJSON, KML, or KMZ. KML/KMZ export includes geometries and simple properties, not styling, embedded photos, network links, or ground overlays.
- Use OpenStreetMap or MetroMap imagery. MetroMap is configured to use the supplied **GDA2020, state:LATEST** WMTS endpoint. Enter your API key, then connect. The application requests WMTS GetCapabilities to identify an EPSG:3857/Web Mercator tile matrix set, required by MapLibre. If your MetroMap subscription/service does not advertise this CRS, the app reports the incompatibility rather than silently placing tiles using an incorrect projection.
- Optionally remember the MetroMap key in your browser’s `localStorage` (`geoforge-metromap-key`). Uncheck *Remember* or click *Forget saved key* to clear the saved copy. Requests to MetroMap necessarily contain the key in the WMTS URL; use only a trusted browser, appropriate MetroMap key restrictions, and a subscription with API/WMTS access.

## Files

- `index.html` — application layout
- `styles.css` — app theme and responsive layout
- `app.js` — MapLibre integration, drawing, measurements, import/export, WMTS discovery
- `vendor/jszip.min.js` — JSZip, for KMZ handling

## Notes

All geometry is held in browser memory and is **not** autosaved. Export your work before closing the page. GeoJSON and KML exported coordinates use WGS84 longitude/latitude (EPSG:4326). KML may contain altitude coordinates, which are retained when present, but the map and measurement calculations use horizontal coordinates. Imported image overlays and KML styling are deliberately outside the geometry conversion scope. OSM and MetroMap imagery require network access. MetroMap's WMTS may enforce browser CORS, API entitlements, and appropriate EPSG:3857 tile matrix availability.
