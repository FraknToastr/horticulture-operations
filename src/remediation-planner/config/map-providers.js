(function (root) {
  "use strict";

  /*
   * Canonical single source of truth for map provider endpoints, default
   * camera viewport (Government House / Adelaide LGA), and timeouts.
   */
  var hostConfig = (root && root.UOS_REMEDIATION_MAP_CONFIG) || {};
  var config = Object.assign({
    defaultProvider: "metromaps",
    defaultCenter: [138.6014, -34.9214],
    defaultZoom: 14,
    initializationTimeoutMs: 10000,
    providerTimeoutMs: 12000,
    glyphs: null,
    providers: [{
      id: "esri-world-imagery",
      label: "Esri World Imagery (aerial)",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    }, {
      id: "carto-light",
      label: "Carto Light",
      tiles: ["https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png"],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 20,
      attribution: " -  OpenStreetMap contributors  -  CARTO"
    }, {
      id: "osm",
      label: "OpenStreetMap (OSM)",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: " -  OpenStreetMap contributors"
    }]
  }, hostConfig);

  if (root) root.UOS_REMEDIATION_MAP_CONFIG = config;
  if (typeof module === "object" && module.exports) module.exports = config;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : global));
