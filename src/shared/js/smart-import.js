(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var imports = UOS.imports;
  var registeredTargets = [];
  var MAX_FILE_BYTES = 20 * 1024 * 1024;
  var MAX_ZIP_ENTRIES = 500;

  function clean(value) { return String(value == null ? "" : value).trim(); }
  function lower(value) { return clean(value).toLowerCase(); }
  function unique(values) {
    return values.filter(function (value, index) { return values.indexOf(value) === index; });
  }
  function normalHeaders(values) { return unique((values || []).map(lower).filter(Boolean)); }
  function readU16(view, offset) { return view.getUint16(offset, true); }
  function readU32(view, offset) { return view.getUint32(offset, true); }

  function validateTarget(target) {
    if (!target || !clean(target.id)) throw new Error("A Smart Import target requires an id.");
    if (!clean(target.promotionTarget)) throw new Error("Smart Import target " + target.id + " requires an explicit promotionTarget.");
    return Object.freeze({
      id: clean(target.id),
      label: clean(target.label) || clean(target.id),
      promotionTarget: clean(target.promotionTarget),
      json: target.json || null,
      zip: target.zip || null,
      tabular: target.tabular || null,
      pdf: target.pdf || null
    });
  }

  function registerTarget(target) {
    var normalized = validateTarget(target);
    if (registeredTargets.some(function (item) { return item.id === normalized.id; })) {
      throw new Error("Smart Import target ids must be unique: " + normalized.id + ".");
    }
    registeredTargets.push(normalized);
    return normalized;
  }

  function unregisterTarget(id) {
    registeredTargets = registeredTargets.filter(function (item) { return item.id !== id; });
  }

  function matchSet(actual, signature, mode) {
    if (!signature) return false;
    var list = actual.map(lower);
    var required = (signature.required || []).map(lower);
    var any = (signature.any || []).map(lower);
    var excluded = (signature.excluded || []).map(lower);
    var exact = Boolean(signature.exact);
    var includes = mode === "filename" ? function (expected) {
      return list.some(function (value) { return value === expected || value.endsWith("/" + expected); });
    } : function (expected) { return list.indexOf(expected) >= 0; };
    if (excluded.length && excluded.some(includes)) return false;
    if (required.length && !required.every(includes)) return false;
    if (any.length && !any.some(includes)) return false;
    if (!required.length && !any.length) return false;
    return !exact || list.length === unique(required.concat(any)).length;
  }

  function jsonKeys(value) {
    if (!value || typeof value !== "object") return [];
    var keys = Object.keys(value);
    if (Array.isArray(value) && value[0] && typeof value[0] === "object") keys = keys.concat(Object.keys(value[0]));
    if (!Array.isArray(value)) {
      Object.keys(value).forEach(function (key) {
        if (value[key] && typeof value[key] === "object" && !Array.isArray(value[key])) {
          keys = keys.concat(Object.keys(value[key]).map(function (child) { return key + "." + child; }));
        }
      });
    }
    return unique(keys.map(lower));
  }

  function zipFilenames(buffer) {
    var view = new DataView(buffer);
    var decoder = new TextDecoder("utf-8");
    var eocd = -1;
    var start = Math.max(0, view.byteLength - 65557);
    for (var offset = view.byteLength - 22; offset >= start; offset -= 1) {
      if (readU32(view, offset) === 0x06054b50) { eocd = offset; break; }
    }
    if (eocd < 0) throw new Error("The selected ZIP/XLSX archive has no valid central directory.");
    var diskNumber = readU16(view, eocd + 4);
    var directoryDisk = readU16(view, eocd + 6);
    var diskCount = readU16(view, eocd + 8);
    var count = readU16(view, eocd + 10);
    var directorySize = readU32(view, eocd + 12);
    var cursor = readU32(view, eocd + 16);
    if (diskNumber !== 0 || directoryDisk !== 0 || diskCount !== count) throw new Error("Multi-disk ZIP archives are not supported.");
    if (count === 0xffff || directorySize === 0xffffffff || cursor === 0xffffffff) throw new Error("ZIP64 archives are not supported.");
    if (count > MAX_ZIP_ENTRIES) throw new Error("The selected archive contains more than " + MAX_ZIP_ENTRIES + " entries.");
    if (cursor > eocd || directorySize > eocd - cursor || cursor + directorySize !== eocd) throw new Error("The selected archive has invalid central-directory bounds.");
    var names = [];
    var canonicalNames = Object.create(null);
    var directoryEnd = cursor + directorySize;
    for (var index = 0; index < count; index += 1) {
      if (cursor + 46 > directoryEnd || readU32(view, cursor) !== 0x02014b50) throw new Error("The selected archive has an invalid central directory.");
      var flags = readU16(view, cursor + 8);
      var method = readU16(view, cursor + 10);
      var nameLength = readU16(view, cursor + 28);
      var extraLength = readU16(view, cursor + 30);
      var commentLength = readU16(view, cursor + 32);
      var entryDisk = readU16(view, cursor + 34);
      var end = cursor + 46 + nameLength;
      var next = end + extraLength + commentLength;
      if (next > directoryEnd) throw new Error("The selected archive contains an invalid central-directory entry.");
      if (flags & 1) throw new Error("Encrypted ZIP/XLSX entries are not supported.");
      if (method !== 0 && method !== 8) throw new Error("The archive uses an unsupported compression method.");
      if (entryDisk !== 0) throw new Error("Multi-disk ZIP archives are not supported.");
      var name = decoder.decode(new Uint8Array(buffer, cursor + 46, nameLength)).replace(/\\/g, "/");
      var segments = name.split("/");
      if (!name || name.indexOf("\u0000") >= 0 || name[0] === "/" || /^[a-z]:\//i.test(name) || segments.some(function (segment) { return segment === ".." || segment === "."; })) {
        throw new Error("The archive contains an unsafe filename.");
      }
      var canonical = name.replace(/\/{2,}/g, "/").toLowerCase();
      if (canonicalNames[canonical]) throw new Error("The archive contains duplicate canonical filenames.");
      canonicalNames[canonical] = true;
      names.push(name);
      cursor = next;
    }
    if (cursor !== directoryEnd) throw new Error("The selected archive central-directory length is inconsistent.");
    return names;
  }

  function candidatesFor(targets, property, actual, mode) {
    return targets.filter(function (target) { return matchSet(actual, target[property], mode); });
  }

  function valueAtPath(value, path) {
    return String(path).split(".").reduce(function (current, key) {
      return current && typeof current === "object" ? current[key] : undefined;
    }, value);
  }

  function allowedValue(actual, expected) {
    var values = Array.isArray(expected) ? expected : [expected];
    return values.some(function (value) { return actual === value; });
  }

  function hasJsonDiscriminator(signature) {
    return Boolean(signature && (typeof signature.predicate === "function" || signature.app !== undefined || signature.schemaVersions || signature.values));
  }

  function matchJson(value, keys, signature) {
    if (!signature) return false;
    if (typeof signature.predicate === "function" && signature.predicate(value) !== true) return false;
    if (signature.app !== undefined && !allowedValue(value && value.app, signature.app)) return false;
    if (signature.schemaVersions && !allowedValue(value && value.schemaVersion, signature.schemaVersions)) return false;
    if (signature.values && !Object.keys(signature.values).every(function (path) {
      return allowedValue(valueAtPath(value, path), signature.values[path]);
    })) return false;
    if ((signature.required || signature.any) && !matchSet(keys, signature)) return false;
    return hasJsonDiscriminator(signature) || matchSet(keys, signature);
  }

  function jsonCandidates(targets, value, keys) {
    var discriminated = targets.filter(function (target) {
      return hasJsonDiscriminator(target.json) && matchJson(value, keys, target.json);
    });
    return discriminated.length ? discriminated : targets.filter(function (target) {
      return !hasJsonDiscriminator(target.json) && matchJson(value, keys, target.json);
    });
  }

  function hasTabularDiscriminator(signature) { return Boolean(signature && typeof signature.predicate === "function"); }
  function tabularCandidates(targets, headers) {
    var specific = targets.filter(function (target) {
      var signature = target.tabular;
      if (!signature) return false;
      var headerMatch = !(signature.required || signature.any) || matchSet(headers, signature);
      return hasTabularDiscriminator(signature) && signature.predicate(headers.slice()) === true && headerMatch;
    });
    return specific.length ? specific : targets.filter(function (target) {
      return target.tabular && !hasTabularDiscriminator(target.tabular) && matchSet(headers, target.tabular);
    });
  }

  function resolvedPreview(kind, file, candidates, diagnostics, details) {
    if (candidates.length > 1) {
      throw new Error("Import is ambiguous: it matches " + candidates.map(function (item) { return item.label; }).join(", ") + ". No data was changed.");
    }
    if (!candidates.length) throw new Error("The " + kind.toUpperCase() + " content does not match a supported import signature. No data was changed.");
    var target = candidates[0];
    return Object.freeze({
      valid: true,
      kind: kind,
      targetId: target.id,
      targetLabel: target.label,
      promotionTarget: target.promotionTarget,
      source: Object.freeze({ name: clean(file.name), size: Number(file.size) || 0, lastModified: Number(file.lastModified) || 0 }),
      diagnostics: Object.freeze(diagnostics.slice()),
      details: Object.freeze(details || {})
    });
  }

  async function inspect(file, options) {
    options = options || {};
    if (!file) throw new Error("Choose a file to inspect.");
    var maximumBytes = options.maxBytes || MAX_FILE_BYTES;
    if (Number(file.size) > maximumBytes) throw new Error("The selected file exceeds the Smart Import size limit.");
    var targets = (options.targets || registeredTargets).map(validateTarget);
    if (!targets.length) throw new Error("No Smart Import targets are registered.");
    var buffer = await file.arrayBuffer();
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > maximumBytes) throw new Error("The selected file bytes exceed the Smart Import size limit.");
    var bytes = new Uint8Array(buffer);
    var head = new TextDecoder("utf-8").decode(bytes.slice(0, Math.min(bytes.length, 4096))).replace(/^\ufeff/, "");
    var trimmed = head.trimStart();

    /* 1. JSON key inspection. A JSON-shaped file is never allowed to fall
       through to a weaker extension or header heuristic. */
    if (trimmed[0] === "{" || trimmed[0] === "[") {
      var value;
      try { value = JSON.parse(new TextDecoder("utf-8").decode(bytes).replace(/^\ufeff/, "")); }
      catch (error) { throw new Error("The selected JSON is malformed: " + error.message + ". No data was changed."); }
      var keys = jsonKeys(value);
      return resolvedPreview("json", file, jsonCandidates(targets, value, keys), ["Matched by JSON key inspection and exact schema discriminators."], { keys: keys });
    }

    /* 2. ZIP filename inspection. XLSX is deliberately allowed to continue
       only when its container filenames do not identify an import target. */
    var isZip = bytes.length >= 4 && readU32(new DataView(buffer), 0) === 0x04034b50;
    if (isZip) {
      var filenames = zipFilenames(buffer);
      var zipCandidates = candidatesFor(targets, "zip", filenames, "filename");
      if (zipCandidates.length) return resolvedPreview("zip", file, zipCandidates, ["Matched by ZIP filename inspection."], { filenames: filenames.slice().sort() });
      var isXlsx = filenames.some(function (name) { return lower(name) === "xl/workbook.xml"; });
      if (!isXlsx) {
        var hasWorkspaceOrDataFiles = filenames.some(function (name) {
          var l = lower(name);
          return (l.indexOf(".json") >= 0 || l.indexOf(".csv") >= 0) && l.indexOf("__macosx") < 0;
        });
        if (hasWorkspaceOrDataFiles && filenames.indexOf("manifest.json") >= 0 && filenames.indexOf("geometries.geojson") >= 0) {
          var workspaceTargets = targets.filter(function (t) { return t.id === "program-workspace" || t.id === "program-workspace-v2"; });
          if (workspaceTargets.length) return resolvedPreview("zip", file, workspaceTargets, ["Matched by canonical Program workspace bundle."], { filenames: filenames.slice().sort() });
        }
        throw new Error("The ZIP archive contents do not match a supported bundle format. No data was changed.");
      }
      if (typeof options.extractSpreadsheetHeaders !== "function") throw new Error("This XLSX requires a registered spreadsheet-header reader. No data was changed.");
      var workbookHeaders = normalHeaders(await options.extractSpreadsheetHeaders(file, filenames.slice()));
      return resolvedPreview("xlsx", file, tabularCandidates(targets, workbookHeaders), ["ZIP filenames identified an XLSX workbook.", "Matched by XLSX column headers."], { headers: workbookHeaders });
    }

    /* 3. CSV/XLSX column signature matching. */
    var isPdf = bytes.length >= 5 && head.slice(0, 5) === "%PDF-";
    if (!isPdf) {
      var text = new TextDecoder("utf-8").decode(bytes);
      var rows;
      try { rows = imports.parseCsv(text); }
      catch (error) { throw new Error("The selected tabular file is malformed: " + error.message + ". No data was changed."); }
      var headers = normalHeaders(rows[0] || []);
      if (headers.length) return resolvedPreview("csv", file, tabularCandidates(targets, headers), ["Matched by CSV column headers."], { headers: headers, rowCount: Math.max(0, rows.length - 1) });
    }

    /* 4. PDF layout extraction. PDF handlers receive the safely opened
       document and must only return preview diagnostics, never mutate state. */
    if (isPdf) {
      var pdf = await imports.openPdf(bytes);
      var pageCount = pdf.numPages;
      var matches = [];
      var pdfDetails = {};
      try {
        for (var targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
          var target = targets[targetIndex];
          if (typeof target.pdf !== "function") continue;
          var result = await target.pdf(pdf, file);
          if (result && result.match !== false) { matches.push(target); pdfDetails[target.id] = result === true ? {} : result; }
        }
      } finally {
        if (pdf && typeof pdf.destroy === "function") await pdf.destroy();
      }
      var preview = resolvedPreview("pdf", file, matches, [], { pageCount: pageCount, matches: pdfDetails });
      return preview;
    }

    throw new Error("The file content is not a supported JSON, ZIP, CSV/XLSX or PDF import. No data was changed.");
  }

  UOS.smartImport = Object.freeze({
    inspect: inspect,
    registerTarget: registerTarget,
    unregisterTarget: unregisterTarget,
    listTargets: function () { return registeredTargets.slice(); },
    zipFilenames: zipFilenames
  });
})();
