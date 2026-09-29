(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  var STAGE_KIND = "uos.program-data-stage";
  var MAX_BYTES = 50 * 1024 * 1024;
  var MAX_ZIP_ENTRIES = 256;
  var MAX_ENTRY_EXPANDED_BYTES = 50 * 1024 * 1024;
  var MAX_TOTAL_EXPANDED_BYTES = 100 * 1024 * 1024;
  var MAX_COMPRESSION_RATIO = 100;
  var APP_IDENTITIES = {
    NSA: { owner: "NSA", appId: "uos.horticulture.nsa", workspaceKind: "NSA" },
    EVT: { owner: "EVT", appId: "uos.horticulture.events", workspaceKind: "EVT" }
  };
  var CANONICAL_SCHEMA_VERSION = 5;
  var LEGACY_SCHEMA_VERSIONS = [2, 3, 4];

  function isolatedCanonical(value) {
    return object(value) && (value.app === APP_IDENTITIES.NSA.appId || value.app === APP_IDENTITIES.EVT.appId) &&
      Number(value.schemaVersion) >= 4 && Number(value.schemaVersion) <= CANONICAL_SCHEMA_VERSION && Boolean(text(value.workspaceKind));
  }
  function manualLegacy(value) {
    return object(value) && value.app === "uos.horticulture" &&
      LEGACY_SCHEMA_VERSIONS.indexOf(Number(value.schemaVersion)) >= 0 && !value.exportAppId && !value.workspaceKind;
  }

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!object(value)) return value;
    var output = {}; Object.keys(value).sort().forEach(function (key) { output[key] = stableValue(value[key]); }); return output;
  }
  function serialize(value, spacing) { return JSON.stringify(stableValue(value), null, spacing == null ? 0 : spacing); }
  function fingerprint(value) { var input = serialize(value), result = 2166136261; for (var i = 0; i < input.length; i += 1) { result ^= input.charCodeAt(i); result = Math.imul(result, 16777619); } return "fnv1a32:" + (result >>> 0).toString(16).padStart(8, "0"); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function appIdentity(value) {
    var supplied = object(value) ? value : {};
    var token = text(supplied.owner || supplied.workspaceKind || value).toUpperCase();
    if (token === "EVENT" || token === "EVENTS") token = "EVT";
    if (token === "NATURE" || token === "NATURE-STRIP") token = "NSA";
    var base = APP_IDENTITIES[token];
    if (!base) throw new Error("An NSA or EVT app identity is required.");
    return {
      owner: base.owner,
      appId: text(supplied.appId) || base.appId,
      workspaceKind: text(supplied.workspaceKind) || base.workspaceKind
    };
  }
  function legacyModule(item) {
    var payload = object(item && item.payload) ? item.payload : {};
    var provenanceValue = object(item && item.provenance) ? item.provenance : {};
    return text(item && (item.module || item.registerType || item.eventType || item.kind) ||
      payload.module || payload.registerType || payload.eventType || payload.kind || provenanceValue.sourceApp)
      .toLowerCase().replace(/[\s_-]+/g, " ");
  }
  function excludedLegacyRecord(item) {
    var moduleName = legacyModule(item);
    return moduleName === "major event" || moduleName === "major events" ||
      moduleName === "road closure" || moduleName === "road closures" ||
      moduleName === "uos major events" || moduleName === "uos road closures";
  }
  function legacySource(workspace) {
    if (!object(workspace) || !object(workspace.entities)) throw new Error("Legacy workspace must contain entities.");
    if (workspace.app !== "uos.horticulture" && workspace.app !== "uos.horticulture.nsa" && workspace.app !== "uos.horticulture.events") {
      throw new Error("The selected file is not a Horticulture Program workspace.");
    }
    var output = clone(workspace);
    model().collections.forEach(function (name) {
      if (!Array.isArray(output.entities[name])) output.entities[name] = [];
    });
    output.context = object(output.context) ? output.context : {};
    output.referenceData = object(output.referenceData) ? output.referenceData : {};
    output.workspace = object(output.workspace) ? output.workspace : {};
    return output;
  }
  function sliceWorkspace(workspace, identityValue, options) {
    var identity = appIdentity(identityValue), checked = legacySource(workspace), output = clone(checked);
    var retained = Object.create(null), collections = model().collections;
    options = options || {};
    collections.forEach(function (name) {
      if (name === "rateItems" || name === "catalogs") return;
      output.entities[name] = checked.entities[name].filter(function (item) {
        var keep = item.owner === identity.owner && !excludedLegacyRecord(item);
        if (keep) retained[item.id] = true;
        return keep;
      }).map(clone);
    });
    // Remove same-owner descendants of excluded legacy modules or incomplete roots.
    var links = ["applicationId", "eventId", "projectId", "parentJobId", "jobId", "quoteId", "rootQuoteId", "previousQuoteId", "costingLineId", "sourceGeometryId", "paymentId", "quoteLineId"];
    var changed = true;
    while (changed) {
      changed = false;
      collections.forEach(function (name) {
        if (name === "rateItems" || name === "catalogs") return;
        output.entities[name] = output.entities[name].filter(function (item) {
          var invalid = links.some(function (field) { return text(item[field]) && !retained[item[field]]; });
          if (invalid) { delete retained[item.id]; changed = true; return false; }
          return true;
        });
      });
    }
    var requiredRates = Object.create(null);
    collections.forEach(function (name) {
      if (name === "rateItems" || name === "catalogs") return;
      output.entities[name].forEach(function (item) { if (text(item.rateItemId)) requiredRates[item.rateItemId] = true; });
    });
    output.entities.rateItems = checked.entities.rateItems.filter(function (item) {
      return options.referencedRatesOnly ? Boolean(requiredRates[item.id]) : true;
    }).map(clone);
    var requiredCatalogs = Object.create(null);
    output.entities.rateItems.forEach(function (item) { if (text(item.catalogId)) requiredCatalogs[item.catalogId] = true; });
    collections.forEach(function (name) {
      if (name === "catalogs" || name === "rateItems") return;
      output.entities[name].forEach(function (item) { if (text(item.catalogId)) requiredCatalogs[item.catalogId] = true; });
    });
    if (Array.isArray(checked.entities.catalogs)) {
      output.entities.catalogs = checked.entities.catalogs.filter(function (item) {
        return Boolean(requiredCatalogs[item.id]) || item.owner === identity.owner || text(item.workspaceKind).toUpperCase() === identity.workspaceKind;
      }).map(clone);
      var retainedCatalogs = Object.create(null);
      output.entities.catalogs.forEach(function (item) { retainedCatalogs[item.id] = true; });
      output.entities.rateItems = output.entities.rateItems.filter(function (item) { return !text(item.catalogId) || retainedCatalogs[item.catalogId]; });
    }
    output.app = identity.appId;
    output.context.selectedOwner = identity.owner;
    delete output.context.majorEvents;
    delete output.context.roadClosures;
    output.workspace.ownerMode = identity.owner;
    output.workspaceKind = identity.workspaceKind;
    output.exportAppId = identity.appId;
    output.referenceData = { shared: clone(checked.referenceData.shared || {}) };
    output.referenceData[identity.owner] = clone(checked.referenceData[identity.owner] || {});
    if (Array.isArray(checked.referenceData.users)) output.referenceData.users = clone(checked.referenceData.users);
    delete output.referenceData.shared.majorEvents;
    delete output.referenceData.shared.roadClosures;
    if (model().appId === identity.appId) {
      output = model().normalize(output);
      output.exportAppId = identity.appId;
      model().assertValid(output);
    }
    return output;
  }
  function importIdentity(value) {
    return {
      appId: text(value && (value.exportAppId || value.appId)),
      workspaceKind: text(value && value.workspaceKind).toUpperCase()
    };
  }
  function assertImportIdentity(value, expectedValue, options) {
    var expected = appIdentity(expectedValue), actual = importIdentity(value);
    options = options || {};
    if (!actual.appId && !actual.workspaceKind) {
      if (options.allowLegacy) return { legacy: true, expected: expected };
      throw new Error("Workspace import has no app identity; use the manual legacy import flow.");
    }
    if (actual.workspaceKind !== expected.workspaceKind.toUpperCase() || actual.appId !== expected.appId) {
      throw new Error("This " + (actual.workspaceKind || actual.appId || "unknown") + " workspace cannot be imported into the " + expected.workspaceKind + " app.");
    }
    return { legacy: false, expected: expected };
  }
  function assertWorkspaceIsolation(workspace, expectedValue) {
    var expected = appIdentity(expectedValue);
    assertImportIdentity(workspace, expected);
    var checked = model().appId === expected.appId ? model().normalize(workspace) : legacySource(workspace);
    var leaks = [];
    model().collections.forEach(function (name) {
      if (name === "rateItems") return;
      checked.entities[name].forEach(function (item) {
        if (item.owner !== expected.owner || excludedLegacyRecord(item)) leaks.push(name + ":" + item.id);
      });
    });
    if (leaks.length) throw new Error("Workspace contains records outside the " + expected.workspaceKind + " app boundary: " + leaks.join(", ") + ".");
    return checked;
  }
  function legacyImportPreview(workspace, identityValue) {
    var identity = appIdentity(identityValue), checked = legacySource(workspace), discarded = { foreignOwner: {}, excludedLegacy: 0, total: 0 };
    model().collections.forEach(function (name) {
      if (name === "rateItems") return;
      var count = checked.entities[name].filter(function (item) { return item.owner !== identity.owner; }).length;
      if (count) { discarded.foreignOwner[name] = count; discarded.total += count; }
      var excluded = checked.entities[name].filter(function (item) { return item.owner === identity.owner && excludedLegacyRecord(item); }).length;
      discarded.excludedLegacy += excluded; discarded.total += excluded;
    });
    var candidate = sliceWorkspace(checked, identity), retainedCounts = counts(candidate);
    var retainedTotal = Object.keys(retainedCounts).reduce(function (sum, name) { return name === "rateItems" || name === "catalogs" ? sum : sum + Number(retainedCounts[name] || 0); }, 0);
    var legacyMigration = { sourceSchemaVersion: Number(workspace.schemaVersion), targetSchemaVersion: model().schemaVersion, targetLabel: identity.owner === "EVT" ? "Events" : "Nature Strip Applications", retainedCounts: retainedCounts, retainedTotal: retainedTotal, discarded: clone(discarded), unresolvedCatalogAssignments: clone(candidate.migration && candidate.migration.unresolvedCatalogAssignments || []), replacement: true };
    return { app: identity, candidate: candidate, discarded: discarded, legacyMigration: legacyMigration, automatic: false };
  }
  function model() { if (!UOS.ProgramModel) throw new Error("ProgramModel must load before ProgramData."); return UOS.ProgramModel; }
  function bytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
  function encode(value) { return new TextEncoder().encode(String(value)); }
  function decode(value) { return new TextDecoder("utf-8").decode(value); }
  function put16(view, offset, value) { view.setUint16(offset, value, true); }
  function put32(view, offset, value) { view.setUint32(offset, value, true); }
  function get16(view, offset) { return view.getUint16(offset, true); }
  function get32(view, offset) { return view.getUint32(offset, true); }
  var crcTable = (function () { var table = []; for (var n = 0; n < 256; n += 1) { var c = n; for (var k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1; table[n] = c >>> 0; } return table; })();
  function crc32(input) { var crc = 0xFFFFFFFF; for (var i = 0; i < input.length; i += 1) crc = crcTable[(crc ^ input[i]) & 0xFF] ^ crc >>> 8; return (crc ^ 0xFFFFFFFF) >>> 0; }
  function safeName(name) {
    if (!name || /[\u0000-\u001f]/.test(name) || /^[a-zA-Z]:/.test(name) || /^[\\/]/.test(name)) return false;
    var normalized = name.replace(/\\/g, "/"), parts = normalized.split("/");
    if (parts.some(function (part) { return !part || part === "." || part === ".."; })) return false;
    var lower = normalized.toLowerCase();
    if (lower.indexOf("__macosx") >= 0 || lower.indexOf(".ds_store") >= 0) return false;
    return lower.lastIndexOf(".json") === lower.length - 5 ||
           lower.lastIndexOf(".csv") === lower.length - 4 ||
           lower.lastIndexOf(".geojson") === lower.length - 8 ||
           lower.lastIndexOf(".txt") === lower.length - 4;
  }

  function zipStored(files) {
    var prepared = Object.keys(files).sort().map(function (name) { if (!safeName(name)) throw new Error("Unsafe export filename."); var data = bytes(files[name]); return { name: name, nameBytes: encode(name), data: data, crc: crc32(data), offset: 0 }; });
    var localSize = prepared.reduce(function (sum, file) { return sum + 30 + file.nameBytes.length + file.data.length; }, 0);
    var centralSize = prepared.reduce(function (sum, file) { return sum + 46 + file.nameBytes.length; }, 0);
    if (localSize + centralSize + 22 > MAX_BYTES) throw new Error("Program workspace bundle exceeds 50 MB.");
    var output = new Uint8Array(localSize + centralSize + 22), view = new DataView(output.buffer), cursor = 0;
    prepared.forEach(function (file) { file.offset = cursor; put32(view, cursor, 0x04034B50); put16(view, cursor + 4, 20); put16(view, cursor + 6, 0x0800); put16(view, cursor + 8, 0); put32(view, cursor + 14, file.crc); put32(view, cursor + 18, file.data.length); put32(view, cursor + 22, file.data.length); put16(view, cursor + 26, file.nameBytes.length); output.set(file.nameBytes, cursor + 30); output.set(file.data, cursor + 30 + file.nameBytes.length); cursor += 30 + file.nameBytes.length + file.data.length; });
    var centralOffset = cursor;
    prepared.forEach(function (file) { put32(view, cursor, 0x02014B50); put16(view, cursor + 4, 20); put16(view, cursor + 6, 20); put16(view, cursor + 8, 0x0800); put32(view, cursor + 16, file.crc); put32(view, cursor + 20, file.data.length); put32(view, cursor + 24, file.data.length); put16(view, cursor + 28, file.nameBytes.length); put32(view, cursor + 42, file.offset); output.set(file.nameBytes, cursor + 46); cursor += 46 + file.nameBytes.length; });
    put32(view, cursor, 0x06054B50); put16(view, cursor + 8, prepared.length); put16(view, cursor + 10, prepared.length); put32(view, cursor + 12, centralSize); put32(view, cursor + 16, centralOffset);
    return output;
  }

  function inflateRawSync(compressedContent) {
    if (typeof require === "function") {
      try {
        var zlib = require("zlib");
        if (zlib && typeof zlib.inflateRawSync === "function") {
          return new Uint8Array(zlib.inflateRawSync(compressedContent));
        }
      } catch (e) {}
    }
    return null;
  }

  async function inflateRawBounded(compressedContent, limit, name) {
    if (typeof DecompressionStream === "undefined") return null;
    var stream = new DecompressionStream("deflate-raw");
    var writer = stream.writable.getWriter(), reader = stream.readable.getReader(), chunks = [], total = 0;
    var pumping = writer.write(compressedContent).then(function () { return writer.close(); });
    try {
      while (true) {
        var part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > limit) { await reader.cancel(); throw new Error("Program workspace ZIP expanded-size limit exceeded by " + name + "."); }
        chunks.push(part.value);
      }
      await pumping;
    } catch (error) {
      try { await writer.abort(error); } catch (ignored) {}
      throw error;
    }
    var output = new Uint8Array(total), position = 0;
    chunks.forEach(function (chunk) { output.set(chunk, position); position += chunk.byteLength; });
    return output;
  }

  function unzipStored(input) {
    var data = bytes(input), view = new DataView(data.buffer, data.byteOffset, data.byteLength), eocd = -1;
    if (data.length > MAX_BYTES || data.length < 22) throw new Error("Program workspace ZIP is empty or too large.");
    for (var cursor = data.length - 22; cursor >= Math.max(0, data.length - 65557); cursor -= 1) if (get32(view, cursor) === 0x06054B50) { eocd = cursor; break; }
    if (eocd < 0) throw new Error("Program workspace ZIP has no valid directory.");
    var count = get16(view, eocd + 10), centralSize = get32(view, eocd + 12), centralOffset = get32(view, eocd + 16), files = {}, names = {}, expandedTotal = 0;
    if (get16(view, eocd + 4) !== 0 || get16(view, eocd + 6) !== 0 || get16(view, eocd + 8) !== count || centralOffset + centralSize !== eocd) throw new Error("Multi-disk, ZIP64, or invalid ZIP directories are not supported.");
    if (count > MAX_ZIP_ENTRIES) throw new Error("Program workspace ZIP contains too many entries.");
    cursor = centralOffset;
    for (var index = 0; index < count; index += 1) {
      if (cursor + 46 > eocd) throw new Error("Program workspace ZIP directory is truncated.");
      if (get32(view, cursor) !== 0x02014B50) throw new Error("Program workspace ZIP directory is malformed.");
      var flags = get16(view, cursor + 8), method = get16(view, cursor + 10), checksum = get32(view, cursor + 16), size = get32(view, cursor + 24), nameLength = get16(view, cursor + 28), extraLength = get16(view, cursor + 30), commentLength = get16(view, cursor + 32), offset = get32(view, cursor + 42);
      if (cursor + 46 + nameLength + extraLength + commentLength > eocd) throw new Error("Program workspace ZIP directory entry is truncated.");
      var name = decode(data.slice(cursor + 46, cursor + 46 + nameLength));
      var canonicalName = name.replace(/\\/g, "/").toLowerCase();
      if (!safeName(name)) throw new Error("Program workspace ZIP contains unsafe entry " + name + ".");
      if (names[canonicalName]) throw new Error("Program workspace ZIP contains duplicate entry " + name + ".");
      names[canonicalName] = true;
      if (flags & 1) throw new Error("Encrypted ZIP entries are not supported: " + name + ".");
      if (method !== 0 && method !== 8) throw new Error("Unsupported ZIP compression for " + name + ".");
      if (offset + 30 > data.length || get32(view, offset) !== 0x04034B50) throw new Error("Program workspace ZIP local header is invalid for " + name + ".");
      var localNameLength = get16(view, offset + 26), localName = decode(data.slice(offset + 30, offset + 30 + localNameLength));
      if (localName !== name) throw new Error("Program workspace ZIP local and directory names differ for " + name + ".");
      var dataOffset = offset + 30 + localNameLength + get16(view, offset + 28);
      var compressedSize = get32(view, cursor + 20);
      if (size > MAX_ENTRY_EXPANDED_BYTES || expandedTotal + size > MAX_TOTAL_EXPANDED_BYTES) throw new Error("Program workspace ZIP expanded-size limit exceeded by " + name + ".");
      if (size > 1024 * 1024 && size / Math.max(1, compressedSize) > MAX_COMPRESSION_RATIO) throw new Error("Program workspace ZIP compression ratio is unsafe for " + name + ".");
      if (dataOffset + compressedSize > data.length) throw new Error("Program workspace ZIP entry is truncated: " + name + ".");
      var compressedContent = data.slice(dataOffset, dataOffset + compressedSize);
      var content;
      if (method === 0) {
        content = compressedContent;
      } else if (method === 8) {
        content = inflateRawSync(compressedContent);
        if (!content) {
          throw new Error("Async decompression required for " + name);
        }
      }
      if (!content || content.length !== size || crc32(content) !== checksum) throw new Error("Program workspace ZIP checksum failed for " + name);
      expandedTotal += content.length; files[name] = content; cursor += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }

  async function unzipStoredAsync(input) {
    try {
      return unzipStored(input);
    } catch (err) {
      if (err.message && err.message.indexOf("Async decompression required") < 0) throw err;
    }
    var data = bytes(input), view = new DataView(data.buffer, data.byteOffset, data.byteLength), eocd = -1;
    if (data.length > MAX_BYTES || data.length < 22) throw new Error("Program workspace ZIP is empty or too large.");
    for (var cursor = data.length - 22; cursor >= Math.max(0, data.length - 65557); cursor -= 1) if (get32(view, cursor) === 0x06054B50) { eocd = cursor; break; }
    if (eocd < 0) throw new Error("Program workspace ZIP has no valid directory.");
    var count = get16(view, eocd + 10), centralSize = get32(view, eocd + 12), centralOffset = get32(view, eocd + 16), files = {}, names = {}, expandedTotal = 0;
    if (get16(view, eocd + 4) !== 0 || get16(view, eocd + 6) !== 0 || get16(view, eocd + 8) !== count || centralOffset + centralSize !== eocd) throw new Error("Multi-disk, ZIP64, or invalid ZIP directories are not supported.");
    if (count > MAX_ZIP_ENTRIES) throw new Error("Program workspace ZIP contains too many entries.");
    cursor = centralOffset;
    for (var index = 0; index < count; index += 1) {
      if (cursor + 46 > eocd) throw new Error("Program workspace ZIP directory is truncated.");
      if (get32(view, cursor) !== 0x02014B50) throw new Error("Program workspace ZIP directory is malformed.");
      var flags = get16(view, cursor + 8), method = get16(view, cursor + 10), checksum = get32(view, cursor + 16), size = get32(view, cursor + 24), nameLength = get16(view, cursor + 28), extraLength = get16(view, cursor + 30), commentLength = get16(view, cursor + 32), offset = get32(view, cursor + 42);
      if (cursor + 46 + nameLength + extraLength + commentLength > eocd) throw new Error("Program workspace ZIP directory entry is truncated.");
      var name = decode(data.slice(cursor + 46, cursor + 46 + nameLength));
      var canonicalName = name.replace(/\\/g, "/").toLowerCase();
      if (!safeName(name)) throw new Error("Program workspace ZIP contains unsafe entry " + name + ".");
      if (names[canonicalName]) throw new Error("Program workspace ZIP contains duplicate entry " + name + ".");
      names[canonicalName] = true;
      if (flags & 1) throw new Error("Encrypted ZIP entries are not supported: " + name + ".");
      if (method !== 0 && method !== 8) throw new Error("Unsupported ZIP compression for " + name + ".");
      if (offset + 30 > data.length || get32(view, offset) !== 0x04034B50) throw new Error("Program workspace ZIP local header is invalid for " + name + ".");
      var localNameLength = get16(view, offset + 26), localName = decode(data.slice(offset + 30, offset + 30 + localNameLength));
      if (localName !== name) throw new Error("Program workspace ZIP local and directory names differ for " + name + ".");
      var dataOffset = offset + 30 + localNameLength + get16(view, offset + 28);
      var compressedSize = get32(view, cursor + 20);
      if (size > MAX_ENTRY_EXPANDED_BYTES || expandedTotal + size > MAX_TOTAL_EXPANDED_BYTES) throw new Error("Program workspace ZIP expanded-size limit exceeded by " + name + ".");
      if (size > 1024 * 1024 && size / Math.max(1, compressedSize) > MAX_COMPRESSION_RATIO) throw new Error("Program workspace ZIP compression ratio is unsafe for " + name + ".");
      if (dataOffset + compressedSize > data.length) throw new Error("Program workspace ZIP entry is truncated: " + name + ".");
      var compressedContent = data.slice(dataOffset, dataOffset + compressedSize);
      var content;
      if (method === 0) {
        content = compressedContent;
      } else if (method === 8) {
        content = inflateRawSync(compressedContent);
        if (!content) content = await inflateRawBounded(compressedContent, Math.min(MAX_ENTRY_EXPANDED_BYTES, MAX_TOTAL_EXPANDED_BYTES - expandedTotal), name);
      }
      if (!content || content.length !== size || crc32(content) !== checksum) throw new Error("Program workspace ZIP checksum failed for " + name);
      expandedTotal += content.length; files[name] = content; cursor += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }

  function csvCell(value) { var output = String(value == null ? "" : value); if (/^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(output)) output = "'" + output; return '"' + output.replace(/"/g, '""') + '"'; }
  function tableCsv(values) { return '"id","owner","type","data"\r\n' + values.map(function (item) { return [item.id, item.owner, item.type, serialize(item)].map(csvCell).join(","); }).join("\r\n") + (values.length ? "\r\n" : ""); }
  function parseTable(value, name) {
    var rows = UOS.imports.parseCsv(value); if (!rows.length || rows[0].join("|") !== "id|owner|type|data") throw new Error(name + " has an invalid header.");
    return rows.slice(1).filter(function (row) { return row.some(text); }).map(function (row, index) { try { var item = JSON.parse(row[3]); if ((row[0] && item.id !== row[0]) || (row[1] && item.owner !== row[1]) || (row[2] && item.type !== row[2])) throw new Error(); return item; } catch (error) { throw new Error(name + " row " + (index + 2) + " is invalid."); } });
  }
  
  function registerLocationsGeoJson(workspace) {
    var features = [];
    (workspace.entities.events || []).concat(workspace.entities.applications || []).forEach(function (rec) {
      (rec.locations || []).forEach(function (pin, idx) {
        if (pin && pin.coordinate && Array.isArray(pin.coordinate)) {
          features.push({
            type: "Feature",
            id: pin.id || (rec.id + "-loc-" + (idx + 1)),
            geometry: { type: "Point", coordinates: pin.coordinate },
            properties: { id: pin.id, registerId: rec.id, owner: rec.owner, name: pin.name || "", address: pin.address || "" }
          });
        }
      });
    });
    return { type: "FeatureCollection", features: features };
  }

  function geoJson(workspace) {
    return { type: "FeatureCollection", features: workspace.entities.geometries.map(function (item) { return { type: "Feature", id: item.id, geometry: clone(item.geometry || null), properties: { id: item.id, owner: item.owner, projectId: item.projectId || "", geometryKind: item.geometryKind || "", workType: item.workType || item.payload && item.payload.workType || "" } }; }) };
  }
  function canonical(workspace, identityValue) {
    if (identityValue) workspace = sliceWorkspace(workspace, identityValue);
    var checked = model().appId === workspace.app ? model().normalize(workspace) : legacySource(workspace), entities = {};
    model().collections.forEach(function (name) { entities[name] = checked.entities[name].slice().sort(function (a, b) { return text(a.id).localeCompare(text(b.id)); }).map(clone); });
    var output = { app: checked.app, schemaVersion: checked.schemaVersion, workspaceRevision: Math.max(0, Number(checked.workspaceRevision) || 0), updatedAt: checked.updatedAt, entities: entities, context: clone(checked.context), referenceData: clone(checked.referenceData), workspace: clone(checked.workspace), migration: clone(checked.migration), statusControl: clone(checked.statusControl) };
    if (workspace.workspaceKind) output.workspaceKind = text(workspace.workspaceKind);
    if (workspace.exportAppId || isolatedCanonical(checked)) output.exportAppId = text(workspace.exportAppId || checked.app);
    if (model().appId === output.app) model().assertValid(output);
    return output;
  }
  var LEGACY_V3_COLLECTIONS = ["applications", "costingLines", "events", "geometries", "jobs", "payments", "projects", "quoteEvents", "quoteLines", "quotes", "rateItems", "tasks"].sort(); var LEGACY_V4_COLLECTIONS = ["applications", "events", "projects", "jobs", "tasks", "catalogs", "costingLines", "rateItems", "geometries", "quotes", "quoteLines", "payments", "paymentAllocations", "quoteEvents"].sort();
  function assertBundleCollections(manifest) {
    if (!Array.isArray(manifest.collections)) throw new Error("Program bundle collections are missing.");
    var collections = manifest.collections.slice().sort();
    if (collections.some(function (name, index) { return !/^[a-zA-Z]+$/.test(name) || (index && name === collections[index - 1]); })) throw new Error("Program bundle contains an unsafe or duplicate collection name.");
    var expected = manualLegacy(manifest) && Number(manifest.schemaVersion) === 3 ? LEGACY_V3_COLLECTIONS : Number(manifest.schemaVersion) === 4 ? LEGACY_V4_COLLECTIONS : model().collections.slice().sort();
    if (JSON.stringify(collections) !== JSON.stringify(expected)) throw new Error("Program bundle collections do not match the schemaVersion " + Number(manifest.schemaVersion) + " schema.");
    return collections;
  }
  function exportJson(workspace, identityValue) { return serialize(canonical(workspace, identityValue), 2); }
  function exportBundle(workspace, identityValue) {
    var checked = canonical(workspace, identityValue), privacy = UOS.ProgramPrivacy;
    if (privacy && typeof privacy.projectForHumanExport === "function") checked = privacy.projectForHumanExport(checked);
    var files = {}, collections = model().collections.slice().sort();
    collections.forEach(function (name) { files[name + ".csv"] = encode(tableCsv(checked.entities[name])); });
    files["geometries.geojson"] = encode(serialize(geoJson(checked), 2));
    files["register-locations.geojson"] = encode(serialize(registerLocationsGeoJson(checked), 2));
    var inventory = {};
    Object.keys(files).sort().forEach(function (name) { inventory[name] = { bytes: files[name].length, crc32: crc32(files[name]).toString(16).padStart(8, "0") }; });
    files["manifest.json"] = encode(serialize({ app: checked.app, exportAppId: checked.exportAppId || checked.app || "", workspaceKind: checked.workspaceKind || "", schemaVersion: checked.schemaVersion, workspaceRevision: Math.max(0, Number(checked.workspaceRevision) || 0), format: "csv-geojson-bundle", bundleVersion: 2, generator: "horticulture-program-planner", collections: collections, files: inventory, updatedAt: checked.updatedAt, context: checked.context, referenceData: checked.referenceData, workspace: checked.workspace, migration: checked.migration, statusControl: checked.statusControl }, 2));
    return zipStored(files);
  }
  function importBundle(input, files, options) {
    files = files || unzipStored(input); var manifest;
    try { manifest = JSON.parse(decode(files["manifest.json"])); } catch (error) { throw new Error("Program bundle manifest is invalid."); }
    if ((!isolatedCanonical(manifest) && !manualLegacy(manifest)) || manifest.format !== "csv-geojson-bundle") throw new Error("Program bundle schema is unsupported.");
    var bundleIdentity = options && options.expectedApp ? assertImportIdentity(manifest, options.expectedApp, { allowLegacy: Boolean(options.allowLegacy) }) : null;
    if (Number(manifest.bundleVersion) >= 2) {
      if (!object(manifest.files)) throw new Error("Program bundle integrity inventory is missing.");
      var expectedNames = Object.keys(manifest.files).sort(), actualNames = Object.keys(files).filter(function (name) { return name !== "manifest.json"; }).sort();
      if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) throw new Error("Program bundle file inventory does not match the archive.");
      expectedNames.forEach(function (name) {
        var entry = manifest.files[name], content = files[name];
        if (!object(entry) || !content || Number(entry.bytes) !== content.length || text(entry.crc32).toLowerCase() !== crc32(content).toString(16).padStart(8, "0")) throw new Error(name + " failed bundle integrity validation.");
      });
    }
    var candidate = model().blank(manifest.updatedAt); candidate.workspaceRevision = Math.max(0, Number(manifest.workspaceRevision) || 0); candidate.context = clone(manifest.context || candidate.context); candidate.referenceData = clone(manifest.referenceData || candidate.referenceData); candidate.workspace = clone(manifest.workspace || candidate.workspace); candidate.migration = clone(manifest.migration || candidate.migration); candidate.statusControl = clone(manifest.statusControl || candidate.statusControl);
    var bundleCollections = assertBundleCollections(manifest);
    bundleCollections.forEach(function (name) { var filename = name + ".csv"; if (!files[filename]) throw new Error(filename + " is missing."); candidate.entities[name] = parseTable(decode(files[filename]), filename); });
    if (!files["geometries.geojson"]) throw new Error("geometries.geojson is missing.");
    try {
      var map = JSON.parse(decode(files["geometries.geojson"]));
      if (map.type !== "FeatureCollection" || !Array.isArray(map.features)) throw new Error();
      var geometryById = Object.create(null), seenFeatures = Object.create(null); candidate.entities.geometries.forEach(function (item) { geometryById[item.id] = item; });
      if (map.features.length !== candidate.entities.geometries.length) throw new Error();
      map.features.forEach(function (feature) { var item = geometryById[feature.id], properties = feature.properties || {}; if (!item || seenFeatures[feature.id] || properties.id !== item.id || text(properties.projectId) !== text(item.projectId) || JSON.stringify(feature.geometry || null) !== JSON.stringify(item.geometry || null)) throw new Error(); seenFeatures[feature.id] = true; });
    } catch (error) { throw new Error("geometries.geojson does not match the canonical geometry collection."); }
    if (!files["register-locations.geojson"]) throw new Error("register-locations.geojson is missing.");
    try {
      var pins = JSON.parse(decode(files["register-locations.geojson"]));
      var expectedPins = registerLocationsGeoJson(candidate), expectedById = Object.create(null), seenPins = Object.create(null);
      if (pins.type !== "FeatureCollection" || !Array.isArray(pins.features) || pins.features.length !== expectedPins.features.length) throw new Error();
      expectedPins.features.forEach(function (feature) { expectedById[feature.id] = feature; });
      pins.features.forEach(function (feature) { var expected = expectedById[feature.id]; if (!expected || seenPins[feature.id] || serialize(feature.geometry || null) !== serialize(expected.geometry) || text(feature.properties && feature.properties.registerId) !== text(expected.properties.registerId) || text(feature.properties && feature.properties.owner) !== text(expected.properties.owner)) throw new Error(); seenPins[feature.id] = true; });
    } catch (error) { throw new Error("register-locations.geojson does not match the canonical Register locations."); }
    candidate.app = manifest.app;
    candidate.schemaVersion = Number(manifest.schemaVersion);
    candidate.workspaceKind = text(manifest.workspaceKind);
    candidate.exportAppId = text(manifest.exportAppId);
    var legacyPreview = bundleIdentity && bundleIdentity.legacy ? legacyImportPreview(candidate, options.expectedApp) : null;
    var normalized = legacyPreview ? legacyPreview.candidate : model().normalize(candidate);
    model().assertValid(normalized);
    if (options && options.expectedApp) assertWorkspaceIsolation(normalized, options.expectedApp);
    if (legacyPreview && options && typeof options.onLegacyPreview === "function") options.onLegacyPreview(clone(legacyPreview.legacyMigration));
    return normalized;
  }
  function counts(candidate) { var output = {}; Object.keys(candidate.entities).forEach(function (name) { if (Array.isArray(candidate.entities[name])) output[name] = candidate.entities[name].length; }); return output; }
  function ownership(candidate) { var output = { NSA: 0, EVT: 0 }; Object.keys(candidate.entities).forEach(function (name) { (candidate.entities[name] || []).forEach(function (item) { if (output[item.owner] != null) output[item.owner] += 1; }); }); return output; }
  function conflicts(current, candidate) { var ids = {}; Object.keys(current.entities).forEach(function (name) { (current.entities[name] || []).forEach(function (item) { ids[item.id] = true; }); }); var output = []; Object.keys(candidate.entities).forEach(function (name) { (candidate.entities[name] || []).forEach(function (item) { if (ids[item.id]) output.push({ id: item.id, collection: name, resolution: "Imported record replaces matching identity" }); }); }); return output; }
  function staged(targetId, candidate, current, diagnostics, source, changeSet) { candidate = model().normalize(candidate); model().assertValid(candidate); changeSet = changeSet || candidate; return { kind: STAGE_KIND, targetId: targetId, candidate: clone(candidate), baseFingerprint: fingerprint(current), baseRevision: Math.max(0, Number(current && current.workspaceRevision) || 0), preview: { detectedType: targetId, counts: counts(changeSet), ownership: ownership(changeSet), warnings: clone(diagnostics || []), conflicts: conflicts(current, changeSet), source: clone(source || {}), blocked: false }, applied: false }; }
  function migrationCandidate(stageValue) {
    if (!stageValue || !stageValue.preview) throw new Error("Migration adapter did not return a staged result.");
    if (stageValue.preview.blocked) {
      var reasons = (stageValue.preview.validationErrors || []).concat((stageValue.preview.conflicts || []).filter(function (item) { return item.resolution === "blocked"; }).map(function (item) { return item.error || item.id; }));
      throw new Error("Imported source is blocked and cannot be merged" + (reasons.length ? ": " + reasons.join("; ") : "."));
    }
    return stageValue.candidate;
  }
  function fileJson(file) { return file.text().then(function (value) { try { return JSON.parse(value.replace(/^\ufeff/, "")); } catch (error) { throw new Error("Imported JSON is malformed."); } }); }
  function rateRows(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error("Rate catalogue contains no rows.");
    if (Array.isArray(rows[0])) {
      var headings = rows[0].map(function (value) { return text(value).toLowerCase(); });
      rows = rows.slice(1).filter(function (row) { return row.some(text); }).map(function (row) { var item = {}; headings.forEach(function (heading, index) { item[heading] = row[index]; }); return item; });
    }
    return rows.map(function (row, index) {
      var active = text(row.active).toLowerCase();
      return { owner: text(row.owner) || "EVT", category: text(row.category || row.section), description: text(row.description || row.label), unit: text(row.unit), unitRate: row.unitRate == null ? row.rate : row.unitRate, active: ["false", "0", "no", "inactive"].indexOf(active) < 0, quantityKind: text(row.quantityKind || row.quantitykind) || undefined, source: { sourceRow: index + 2 } };
    });
  }
  function importRates(current, rows) {
    if (!UOS.ProgramCosting) throw new Error("Rate catalogue adapters are unavailable.");
    var candidate = current; rateRows(rows).forEach(function (item) { candidate = UOS.ProgramCosting.upsertRateItem(candidate, item); }); return candidate;
  }
  function tabularRows(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error("The tabular import contains no rows.");
    if (!Array.isArray(rows[0])) return rows;
    var headings = rows[0].map(function (value) { return text(value).toLowerCase(); });
    return rows.slice(1).filter(function (row) { return row.some(text); }).map(function (row) { var item = {}; headings.forEach(function (heading, index) { if (heading) item[heading] = row[index]; }); return item; });
  }
  function mergeRecords(current, collection, incoming) { var byId = {}; incoming.forEach(function (item) { byId[item.id] = item; }); current.entities[collection] = current.entities[collection].filter(function (item) { return !byId[item.id]; }).concat(incoming); return current; }
  function importNature(current, rows) {
    var candidate = clone(current), imported = model().blank(), applicationIds = {};
    tabularRows(rows).forEach(function (row, index) {
      var legacyId = text(row["application id"] || row.applicationid || row.id || row.receipt || row["receipt no"] || "row-" + (index + 2)), kind = text(row.kind).toLowerCase() || "application";
      if (kind === "application") { var applicationId = model().stableId("NSA", "application", legacyId); applicationIds[legacyId] = applicationId; imported.entities.applications.push({ id: applicationId, owner: "NSA", type: "application", title: text(row.address || row.title || legacyId), address: text(row.address), status: text(row.status), provenance: { owner: "NSA", sourceApp: "uos.nature-strip", sourceVersion: 2, sourceId: legacyId } }); }
      else if (kind === "project") imported.entities.projects.push({ id: model().stableId("NSA", "project", legacyId), owner: "NSA", type: "project", title: text(row.title || row.address || legacyId), applicationId: applicationIds[text(row["application id"])] || null, provenance: { owner: "NSA", sourceApp: "uos.nature-strip", sourceVersion: 2, sourceId: legacyId } });
    });
    mergeRecords(candidate, "applications", imported.entities.applications); mergeRecords(candidate, "projects", imported.entities.projects); return { candidate: model().normalize(candidate), changeSet: model().normalize(imported) };
  }
  function natureReceiptField(source, start, end) {
    var match = String(source || "").match(new RegExp(start + "\\s+([\\s\\S]*?)(?=\\s+(?:" + end + ")\\s+|$)", "i"));
    return match ? text(match[1]).replace(/\s+/g, " ") : "";
  }
  function natureReceiptDate(value) {
    var match = text(value).match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (!match) return "";
    var months = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
    var month = months[match[2].toLowerCase()];
    return month ? match[3] + "-" + String(month).padStart(2, "0") + "-" + String(Number(match[1])).padStart(2, "0") : "";
  }
  function parseNatureReceiptText(source, fileName) {
    var flat = text(source).replace(/\s+/g, " ");
    var receiptMatch = flat.match(/Receipt number\s+([A-Z]+\d+)/i);
    if (!receiptMatch) throw new Error("The Nature Strip PDF does not contain a readable receipt number. No data was changed.");
    var receipt = receiptMatch[1].toUpperCase();
    var submitted = natureReceiptField(flat, "Submitted on", "Receipt number");
    var givenName = natureReceiptField(flat, "Given name", "Family name");
    var familyName = natureReceiptField(flat, "Family name", "Email");
    var email = natureReceiptField(flat, "Email", "Preferred phone number");
    var phone = natureReceiptField(flat, "Preferred phone number", "Property address");
    var rawAddress = natureReceiptField(flat, "Property address", "Do you have a sketch");
    var coordinateMatch = rawAddress.match(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/);
    var address = rawAddress.replace(/\s+Map\s*\([^)]*\)\s*$/i, "").trim();
    var sketchMatch = flat.match(/Do you have a sketch or diagram(?: of the nature strip and\/or watering system)?\??\s+(Yes|No)\b/i);
    var sketchOrDiagram = sketchMatch ? sketchMatch[1].replace(/^./, function (value) { return value.toUpperCase(); }) : "";
    var comments = natureReceiptField(flat, "Please provide any information relevant to your application", "Please indicate your preference for your nature strip");
    var preference = natureReceiptField(flat, "Please indicate your preference for your nature strip", "Preferred plant type");
    var plantType = natureReceiptField(flat, "Preferred plant type", "Consent");
    var scope = [preference, plantType].filter(Boolean).join(": ");
    var received = natureReceiptDate(submitted);
    var importedAt = new Date().toISOString();
    var locations = coordinateMatch ? [{
      id: "NSA-LOC-" + receipt,
      name: address || receipt,
      address: address,
      coordinate: [Number(coordinateMatch[2]), Number(coordinateMatch[1])],
      visible: true
    }] : [];
    return {
      owner: "NSA", type: "application", title: address || receipt, address: address,
      receipt: receipt, status: "received", startDate: received, receivedDate: received, dateReceived: received, locations: locations,
      payload: {
        applicationType: "Nature Strip Application", receipt: receipt, receiptNumber: receipt,
        customerName: [givenName, familyName].filter(Boolean).join(" "), customerEmail: email,
        customerPhone: phone, address: address, dateReceived: received, sketchOrDiagram: sketchOrDiagram, scope: scope,
        comments: comments, coordinates: coordinateMatch ? coordinateMatch[1] + ", " + coordinateMatch[2] : "",
        status: "received",
        source: { kind: "pdf", fileName: text(fileName), importedAt: importedAt }
      },
      provenance: { owner: "NSA", sourceApp: "uos.nature-strip", sourceVersion: 2, sourceId: receipt }
    };
  }
  async function importNaturePdf(current, file) {
    var pdf = await UOS.imports.openPdf(new Uint8Array(await file.arrayBuffer()));
    var pages = [];
    try {
      for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        var page = await pdf.getPage(pageNumber);
        var content = await page.getTextContent();
        pages.push(content.items.map(function (item) { return text(item.str); }).filter(Boolean).join(" "));
      }
    } finally {
      if (pdf && typeof pdf.destroy === "function") await pdf.destroy();
    }
    var incoming = parseNatureReceiptText(pages.join(" "), file.name);
    var candidate = clone(current), applications = candidate.entities.applications || [];
    var receiptKey = incoming.receipt.toUpperCase();
    var existing = applications.find(function (item) {
      var payload = item && item.payload || {};
      return text(item && (item.receipt || item.receiptNumber) || payload.receipt || payload.receiptNumber).toUpperCase() === receiptKey;
    });
    if (existing) {
      var preservedPayload = clone(existing.payload || {});
      var preservedProvenance = clone(existing.provenance || {});
      var preservedHistory = Array.isArray(existing.statusHistory) && existing.statusHistory.length
        ? clone(existing.statusHistory)
        : (Array.isArray(preservedPayload.statusHistory) && preservedPayload.statusHistory.length ? clone(preservedPayload.statusHistory) : null);
      var mergedLocations = Array.isArray(existing.locations) ? clone(existing.locations) : [];
      (incoming.locations || []).forEach(function (location) {
        var duplicate = mergedLocations.some(function (current) {
          return current && Array.isArray(current.coordinate) && current.coordinate.length >= 2 &&
            Number(current.coordinate[0]) === Number(location.coordinate[0]) && Number(current.coordinate[1]) === Number(location.coordinate[1]);
        });
        if (!duplicate) mergedLocations.push(location);
      });
      incoming.locations = mergedLocations;
      incoming.status = text(existing.status) || incoming.status;
      incoming.startDate = text(existing.startDate) || incoming.startDate;
      if (preservedHistory) {
        incoming.statusHistory = preservedHistory;
        incoming.payload.statusHistory = clone(preservedHistory);
      }
      Object.keys(incoming).forEach(function (key) { if (key !== "payload" && key !== "provenance") existing[key] = incoming[key]; });
      existing.payload = Object.assign(preservedPayload, incoming.payload);
      existing.provenance = Object.assign(preservedProvenance, incoming.provenance);
      incoming = clone(existing);
    } else {
      incoming.id = model().stableId("NSA", "application", incoming.receipt);
      applications.push(incoming);
    }
    candidate.entities.applications = applications;
    candidate = model().normalize(candidate);
    if (!existing && UOS.ProgramStatus && typeof UOS.ProgramStatus.reconcileMutation === "function") {
      candidate = UOS.ProgramStatus.reconcileMutation(model().normalize(current), candidate, { source: "automatic", action: "Register imported", at: incoming.source && incoming.source.importedAt });
    }
    var imported = model().blank(); imported.entities.applications = [clone(incoming)];
    imported.entities.statusEvents = (candidate.entities.statusEvents || []).filter(function (item) { return item.entityId === incoming.id; }).map(clone);
    var importedChangeSet = model().normalize(imported);
    /* A blank v5 workspace deliberately includes the shared Rate Catalog. It is
       baseline data, not part of an individual PDF import, so exclude it from
       the staged delta and conflict preview. The candidate still retains the
       complete catalogue. */
    importedChangeSet.entities.rateItems = [];
    return { candidate: candidate, changeSet: importedChangeSet, existing: Boolean(existing), receipt: receiptKey };
  }
  function importUsers(current, rows) {
    var candidate = clone(current), users = tabularRows(rows).map(function (row, index) { return { id: text(row.id) || "user-" + (index + 1), title: text(row.title), team: text(row.team), crew: text(row.crew), isPlantOperator: /^(?:true|1|yes)$/i.test(text(row["is plant operator"] || row.isplantoperator)) }; });
    if (!users.length) throw new Error("The users table contains no records."); candidate.referenceData = object(candidate.referenceData) ? candidate.referenceData : {}; candidate.referenceData.users = users; return { candidate: model().normalize(candidate), users: users };
  }
  async function importZipArchive(file, current, options) {
    var buffer = await file.arrayBuffer();
    var files = await unzipStoredAsync(buffer);
    if (files["manifest.json"]) {
      var legacyPreview = null;
      var bundleOptions = options && options.expectedApp ? { expectedApp: options.expectedApp, allowLegacy: options.allowLegacy, onLegacyPreview: function (value) { legacyPreview = value; } } : null;
      return { candidate: importBundle(buffer, files, bundleOptions), changeSet: null, legacyPreview: legacyPreview };
    }

    var candidate = clone(current);
    var changeSet = model().blank();
    var fileKeys = Object.keys(files);
    var importedEntries = 0;

    for (var i = 0; i < fileKeys.length; i += 1) {
      var fileName = fileKeys[i];
      var lowerName = fileName.toLowerCase();
      var rawBytes = files[fileName];

      if (lowerName.indexOf("__macosx") >= 0 || lowerName.indexOf(".ds_store") >= 0) continue;

      if (lowerName.lastIndexOf(".json") === lowerName.length - 5) {
        try {
          var jsonText = decode(rawBytes).replace(/^\ufeff/, "");
          var input = JSON.parse(jsonText);
          if (input && input.app === "uos.horticulture" && (Number(input.schemaVersion) === 2 || Number(input.schemaVersion) === 3)) {
            candidate = model().normalize(input);
            importedEntries += 1;
            mergeRecords(changeSet.entities, "applications", input.entities.applications || []);
            mergeRecords(changeSet.entities, "events", input.entities.events || []);
            mergeRecords(changeSet.entities, "projects", input.entities.projects || []);
          } else if (input && UOS.ProgramMigration && (input.app === "uos.nature-strip" || input.app === "uos.remediation" || !input.app)) {
            var sources = input.app === "uos.nature-strip" ? { nature: input } : { remediation: input };
            var imported = migrationCandidate(UOS.ProgramMigration.stage(Object.assign({ unified: candidate }, sources), { model: model(), currentWorkspace: candidate }));
            importedEntries += 1;
            candidate = imported;
            model().collections.forEach(function (coll) {
              if (Array.isArray(imported.entities[coll])) {
                changeSet.entities[coll] = (changeSet.entities[coll] || []).concat(imported.entities[coll]);
              }
            });
          }
        } catch (e) { throw new Error(fileName + ": " + e.message); }
      } else if (lowerName.lastIndexOf(".csv") === lowerName.length - 4) {
        try {
          var csvText = decode(rawBytes);
          var rows = UOS.imports.parseCsv(csvText);
          if (lowerName.indexOf("rate") >= 0 || lowerName.indexOf("catalogue") >= 0 || lowerName.indexOf("catalog") >= 0) {
            candidate = importRates(candidate, rows);
            importedEntries += 1;
            changeSet.entities.rateItems = (changeSet.entities.rateItems || []).concat(rateRows(rows));
          } else if (lowerName.indexOf("nature") >= 0 || lowerName.indexOf("application") >= 0) {
            var nImport = importNature(candidate, rows);
            candidate = nImport.candidate;
            importedEntries += 1;
          }
        } catch (e) { throw new Error(fileName + ": " + e.message); }
      }
    }

    if (!importedEntries) throw new Error("Program workspace ZIP contains no recognized horticulture data entries.");
    return { candidate: candidate, changeSet: changeSet };
  }

  async function stage(file, current, options) {
    options = options || {}; var checkedCurrent = model().normalize(current); if (!UOS.smartImport) throw new Error("UOS.smartImport must load before ProgramData.");
    var inspection = await UOS.smartImport.inspect(file, options.inspectOptions || {}), target = inspection.targetId, candidate;
    var stageDiagnostics = clone(inspection.diagnostics || []);
    var changeSet = null;
    var legacyStagePreview = null;
    if (inspection.kind === "json") {
      var input = await fileJson(file);
      if (isolatedCanonical(input) || manualLegacy(input)) {
        if (options.expectedApp) {
          var identityCheck = assertImportIdentity(input, options.expectedApp, { allowLegacy: Boolean(options.allowLegacy) });
          if (identityCheck.legacy) {
            var previewResult = legacyImportPreview(input, options.expectedApp);
            candidate = previewResult.candidate; changeSet = candidate;
            legacyStagePreview = previewResult.legacyMigration;
          } else candidate = assertWorkspaceIsolation(input, options.expectedApp);
        } else candidate = model().normalize(input);
      }
      else if (UOS.ProgramMigration && (input.app === "uos.nature-strip" || input.app === "uos.remediation" || !input.app)) {
        var sources = input.app === "uos.nature-strip" ? { nature: input } : { remediation: input };
        var imported = migrationCandidate(UOS.ProgramMigration.stage(Object.assign({ unified: checkedCurrent }, sources), { model: model(), currentWorkspace: checkedCurrent }));
        candidate = imported; changeSet = imported;
      } else throw new Error("The detected JSON schema is not supported by Program Planner.");
    } else if (inspection.kind === "zip") {
      var zipResult = await importZipArchive(file, checkedCurrent, options);
      candidate = zipResult.candidate;
      changeSet = zipResult.changeSet;
    }
    else if (inspection.kind === "csv" && (target === "remediation-rates" || target === "program-rate-catalog")) {
      candidate = importRates(checkedCurrent, UOS.imports.parseCsv(await file.text()));
    } else if (inspection.kind === "xlsx" && target === "remediation-rates") {
      if (typeof options.extractRateSpreadsheetRows !== "function") throw new Error("This XLSX requires the registered rate spreadsheet reader.");
      candidate = importRates(checkedCurrent, await options.extractRateSpreadsheetRows(file));
    } else if ((inspection.kind === "csv" || inspection.kind === "xlsx") && target === "nature-workspace") {
      if (inspection.kind === "xlsx" && typeof options.extractSpreadsheetRows !== "function") throw new Error("This XLSX requires the registered spreadsheet row reader.");
      var natureImport = importNature(checkedCurrent, inspection.kind === "csv" ? UOS.imports.parseCsv(await file.text()) : await options.extractSpreadsheetRows(file)); candidate = natureImport.candidate; changeSet = natureImport.changeSet;
    } else if (inspection.kind === "pdf" && target === "nature-workspace") {
      var naturePdfImport = await importNaturePdf(checkedCurrent, file); candidate = naturePdfImport.candidate; changeSet = naturePdfImport.changeSet;
      if (naturePdfImport.existing) stageDiagnostics.push("Receipt " + naturePdfImport.receipt + " matches an existing Nature Strip application. Applying this import will update that record, not create a duplicate.");
    } else if ((inspection.kind === "csv" || inspection.kind === "xlsx") && target === "users") {
      if (inspection.kind === "xlsx" && typeof options.extractSpreadsheetRows !== "function") throw new Error("This XLSX requires the registered spreadsheet row reader.");
      var usersImport = importUsers(checkedCurrent, inspection.kind === "csv" ? UOS.imports.parseCsv(await file.text()) : await options.extractSpreadsheetRows(file)); candidate = usersImport.candidate; changeSet = model().blank(); changeSet.referenceData.users = usersImport.users;
    } else throw new Error("The detected import type has no Program Planner adapter.");
    if (target === "users") { var usersStage = staged(target, candidate, checkedCurrent, stageDiagnostics, inspection.source, model().blank()); usersStage.preview.counts = { users: candidate.referenceData.users.length }; usersStage.preview.ownership = { NSA: 0, EVT: 0 }; return usersStage; }
    var result = staged(target, candidate, checkedCurrent, stageDiagnostics, inspection.source, changeSet);
    if (legacyStagePreview || zipResult && zipResult.legacyPreview) result.preview.legacyMigration = clone(legacyStagePreview || zipResult.legacyPreview);
    return result;
  }
  function apply(stageValue, options) {
    if (!stageValue || stageValue.kind !== STAGE_KIND || stageValue.applied) return Promise.reject(new Error("A fresh staged Program import is required."));
    if (stageValue.preview && stageValue.preview.blocked) return Promise.reject(new Error("This Program import is blocked and cannot be applied."));
    if (options && options.currentWorkspace && fingerprint(model().normalize(options.currentWorkspace)) !== stageValue.baseFingerprint) return Promise.reject(new Error("Workspace changed after import staging; inspect the file again."));
    var candidate; try { candidate = model().normalize(stageValue.candidate); } catch (error) { return Promise.reject(error); }
    var commit = options && options.commit;
    var commitOptions = { baseRevision: Math.max(0, Number(stageValue.baseRevision) || 0), mutationKind: "import" };
    return Promise.resolve(typeof commit === "function" ? commit(clone(candidate), commitOptions) : candidate).then(function (saved) {
      stageValue.applied = true;
      return clone(saved && typeof saved === "object" ? saved : candidate);
    });
  }
  function registerTarget() {
    if (!UOS.smartImport) return;
    var registered = UOS.smartImport.listTargets();
    var hasOwnerSpecificWorkspaceTargets = registered.some(function (item) { return item.id === "program-workspace-nsa"; }) && registered.some(function (item) { return item.id === "program-workspace-events"; });
    if (!registered.some(function (item) { return item.id === "program-workspace"; })) {
      var workspaceTarget = {
        id: "program-workspace",
        label: "Horticulture Program Planner workspace",
        promotionTarget: "workspace",
        zip: { required: ["manifest.json", "geometries.geojson", "register-locations.geojson"], any: ["applications.csv", "events.csv", "jobs.csv", "catalogs.csv", "paymentAllocations.csv"] }
      };
      if (!hasOwnerSpecificWorkspaceTargets) workspaceTarget.json = { predicate: function (value) { return isolatedCanonical(value) || manualLegacy(value); }, required: ["entities", "context", "workspace"] };
      UOS.smartImport.registerTarget(workspaceTarget);
    }
    if (!UOS.smartImport.listTargets().some(function (item) { return item.id === "program-rate-catalog"; })) UOS.smartImport.registerTarget({ id: "program-rate-catalog", label: "Program rate catalogue", promotionTarget: "entities.rateItems", tabular: { required: ["owner", "category", "description", "unit", "unitrate", "active"], any: ["quantitykind"] } });
  }
  registerTarget();
  UOS.ProgramData = { stage: stage, apply: apply, exportJson: exportJson, exportBundle: exportBundle, importBundle: importBundle, geoJson: geoJson, registerTarget: registerTarget, parseNatureReceiptText: parseNatureReceiptText, appIdentity: appIdentity, sliceWorkspace: sliceWorkspace, legacyImportPreview: legacyImportPreview, assertImportIdentity: assertImportIdentity, assertWorkspaceIsolation: assertWorkspaceIsolation };
})();
