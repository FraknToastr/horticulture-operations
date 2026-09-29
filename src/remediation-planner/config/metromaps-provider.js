(function (root) {
  "use strict";
  var config = root.UOS_REMEDIATION_MAP_CONFIG;
  if (!config || !Array.isArray(config.providers) || config.providers.some(function (provider) { return provider.id === "metromaps"; })) return;
  config.providers.push({ id: "metromaps", label: "Metromaps", tiles: ["https://api.metromap.com.au/ogc/gda2020/key/mh5j2jck9mtd77uwnmn33rdh4l6ch5ppnk4oxhd4nfq282ycnob1b3oxwuqqdr9o/state:LATEST/service?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=Australia_latest&STYLE=default&FORMAT=image/png&TILEMATRIXSET=webmercator&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"], tileSize: 256, minzoom: 0, maxzoom: 20, attribution: "Metromaps" });
}(typeof window !== "undefined" ? window : globalThis));
