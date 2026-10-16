(function (root) {
  "use strict";
  var config = root.UOS_REMEDIATION_MAP_CONFIG;
  if (!config || !Array.isArray(config.providers)) return;
  // Credentials belong only to this tab and, with consent, this storage entry.
  var storageKey = "uos.metromap.user-key", activeKey = "", saved = false;
  var template = "https://api.metromap.com.au/ogc/gda2020/key/{key}/state:LATEST/service?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=Australia_latest&STYLE=default&FORMAT=image/png&TILEMATRIXSET=webmercator&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";
  function validate(value) {
    var key = String(value || "").trim();
    if (!key || key.length > 512 || !/^[A-Za-z0-9_-]+$/.test(key)) throw new Error("Enter a valid MetroMap API key.");
    return key;
  }
  function configure(key) {
    var provider = config.providers.find(function (item) { return item.id === "metromaps"; });
    if (!provider) { provider = { id: "metromaps", label: "MetroMap", tileSize: 256, minzoom: 0, maxzoom: 20, attribution: "MetroMap" }; config.providers.push(provider); }
    provider.tiles = [template.replace("{key}", encodeURIComponent(key))];
    activeKey = key;
  }
  var storageUnavailable = false;
  try { var restored = root.localStorage.getItem(storageKey); if (restored) { configure(validate(restored)); saved = true; config.defaultProvider = "metromaps"; } }
  catch (_) { storageUnavailable = true; }
  root.UOS = root.UOS || {};
  root.UOS.MetroMapCredentials = {
    status: function () { return { active: Boolean(activeKey), saved: saved, storageUnavailable: storageUnavailable }; },
    activate: function (value, remember) {
      var key = validate(value), warning = "";
      if (remember) {
        try { root.localStorage.setItem(storageKey, key); saved = true; storageUnavailable = false; }
        catch (_) { storageUnavailable = true; warning = "Activated for this tab. Browser storage is unavailable; the key was not saved."; }
      }
      configure(key);
      return { warning: warning };
    },
    forget: function () {
      try { root.localStorage.removeItem(storageKey); saved = false; storageUnavailable = false; }
      catch (_) { storageUnavailable = true; throw new Error("Browser storage is unavailable. The saved key could not be removed."); }
    }
  };
}(typeof globalThis !== "undefined" ? globalThis : this));
