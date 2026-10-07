(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var OWNERS = { NSA: "Nature Strip", EVT: "Remediation" };
  var QUANTITY_KINDS = ["direct", "area", "length", "volume", "mass", "hours"];
  var REQUIRED_CSV_COLUMNS = ["id", "owner", "category", "description", "unit", "unitRate", "active", "quantityKind"];
  var CSV_COLUMNS = REQUIRED_CSV_COLUMNS.concat(["kind", "libraryCategory", "catalogSection", "addPath", "sourceFileName", "sourceImportedAt", "sourceRow", "sourceId", "sourceApp", "sourceVersion", "legacyId", "schedulerEnabled"]);
  var MAX_ITEMS = 10000;

  function object(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function number(value, fallback) { var parsed = Number(value); return Number.isFinite(parsed) ? parsed : (fallback == null ? 0 : fallback); }
  function money(value) { return Math.round((number(value) + Number.EPSILON) * 100) / 100; }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function hash(value) {
    var output = 2166136261;
    String(value).split("").forEach(function (character) { output = Math.imul(output ^ character.charCodeAt(0), 16777619); });
    return (output >>> 0).toString(36).toUpperCase().padStart(7, "0");
  }
  function costingOwner(value) {
    var normalized = text(value).toUpperCase();
    if (!OWNERS[normalized]) throw new Error("Costing owner must be NSA or EVT.");
    return normalized;
  }
  function quantityKind(value) {
    var normalized = text(value).toLowerCase() || "direct";
    if (QUANTITY_KINDS.indexOf(normalized) < 0) throw new Error('Unsupported quantity kind "' + normalized + '".');
    return normalized;
  }
  function normalizeSource(input) {
    if (!object(input)) return null;
    var output = {
      fileName: text(input.fileName).slice(0, 255),
      importedAt: text(input.importedAt).slice(0, 40),
    sourceRow: Number.isInteger(Number(input.sourceRow)) && Number(input.sourceRow) > 0 ? Number(input.sourceRow) : null,
    id: text(input.id).slice(0, 255)
    };
  return output.fileName || output.importedAt || output.sourceRow || output.id ? output : null;
  }
  function stableId(input) {
    var supplied = text(input.id);
    if (supplied) {
      if (/^(?:NSA|EVT)-RATE-/.test(supplied)) return supplied.replace(/^(?:NSA|EVT)-RATE-/, "RATE-");
      if (supplied.indexOf("RATE-") !== 0) throw new Error("Rate item id must use the RATE- prefix.");
      return supplied;
    }
    return "RATE-" + hash([text(input.category), text(input.description || input.label), text(input.unit)].join("|"));
  }

  function normalizeItem(input) {
    if (!object(input)) throw new Error("Rate item must be an object.");
    var description = text(input.description || input.label);
    var category = text(input.category || input.section);
    var unitRate = number(input.unitRate == null ? input.rate : input.unitRate, NaN);
    if (!description) throw new Error("Rate item requires a description.");
    if (!category) throw new Error("Rate item requires a category.");
    if (!Number.isFinite(unitRate) || unitRate < 0) throw new Error("Rate item unitRate must be a non-negative number.");
    return {
      id: stableId(input),
      owner: "",
      type: "rateItem",
      category: category,
      description: description,
      unit: text(input.unit),
      unitRate: money(unitRate),
      active: input.active !== false,
      schedulerEnabled: typeof input.schedulerEnabled === "boolean" ? input.schedulerEnabled : ["Labour", "Contractors"].indexOf(input.kind || category) >= 0,
      quantityKind: quantityKind(input.quantityKind || input.mode),
      kind: text(input.kind || input.libraryCategory),
      libraryCategory: text(input.libraryCategory || input.kind),
      catalogSection: text(input.catalogSection || input.libraryCategory || input.kind),
      addPath: text(input.addPath),
      source: normalizeSource(input.source || {
        fileName: input.sourceFileName, importedAt: input.sourceImportedAt,
        sourceRow: input.sourceRow, id: input.sourceId
      }),
  sourceApp: text(input.sourceApp || (object(input.provenance) && input.provenance.sourceApp)),
  sourceVersion: input.sourceVersion == null || input.sourceVersion === "" ? (object(input.provenance) ? input.provenance.sourceVersion || "" : "") : input.sourceVersion,
  legacyId: text(input.legacyId || (object(input.provenance) && input.provenance.legacyId))
    };
  }

  function normalize(input) {
    var values = Array.isArray(input) ? input : object(input) && Array.isArray(input.items) ? input.items : [];
    if (values.length > MAX_ITEMS) throw new Error("Rate library contains more than 10,000 items.");
    var ids = {};
    var items = values.map(function (item, index) {
      var normalized;
      try { normalized = normalizeItem(item); } catch (error) { throw new Error("Rate item " + (index + 1) + ": " + error.message); }
      if (ids[normalized.id]) throw new Error('Rate library contains duplicate id "' + normalized.id + '".');
      ids[normalized.id] = true;
      return normalized;
    });
    return { version: 1, items: items };
  }

  function categories(library) {
    return Array.from(new Set(normalize(library).items.map(function (item) { return item.category; }))).sort(function (a, b) { return a.localeCompare(b); });
  }

  function filter(library, options) {
    options = options || {};
    var requestedCategories = options.categories == null ? null : new Set((Array.isArray(options.categories) ? options.categories : [options.categories]).map(text));
    var query = text(options.query).toLowerCase();
    return normalize(library).items.filter(function (item) {
      return (!requestedCategories || requestedCategories.has(item.category)) &&
        (options.active == null || item.active === Boolean(options.active)) &&
        (!query || [item.description, item.category, item.unit].join(" ").toLowerCase().indexOf(query) >= 0);
    });
  }

  function upsert(library, input) {
    var output = normalize(library), item = normalizeItem(input);
    var index = output.items.findIndex(function (candidate) { return candidate.id === item.id; });
    if (index >= 0) output.items[index] = item; else output.items.push(item);
    return output;
  }

  function remove(library, id) {
    var output = normalize(library), normalizedId = text(id);
    output.items = output.items.filter(function (item) { return item.id !== normalizedId; });
    return output;
  }

  function nonNegative(value, label, fallback) {
    if (value == null || value === "") return fallback == null ? 0 : fallback;
    var parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(label + " must be a non-negative number.");
    return parsed;
  }

  function deriveQuantity(kind, input) {
    input = input || {};
    if (kind === "area") return nonNegative(input.areaSqM, "areaSqM");
    if (kind === "length") return nonNegative(input.lengthM, "lengthM");
    if (kind === "volume") return nonNegative(input.volumeM3, "volumeM3", nonNegative(input.areaSqM, "areaSqM") * nonNegative(input.depthM, "depthM"));
    if (kind === "mass") return nonNegative(input.massKg, "massKg", deriveQuantity("volume", input) * nonNegative(input.densityKgM3, "densityKgM3"));
    if (kind === "hours") return nonNegative(input.hours, "hours") * nonNegative(input.workers, "workers", 1);
    return nonNegative(input.quantity, "quantity");
  }

  function calculateLine(rateInput, measurementInput, options) {
    options = options || {};
    var rate = normalizeItem(rateInput);
    if (!rate.active && !options.allowInactive) throw new Error("Inactive rate items cannot be added to costings.");
 var quantity = options.quantityOverride == null
 ? deriveQuantity(rate.quantityKind, measurementInput)
 : nonNegative(options.quantityOverride, "quantityOverride");
    var sourceGeometryId = text(options.sourceGeometryId || (measurementInput && measurementInput.sourceGeometryId)) || null;
    var suppliedId = text(options.id);
    var lineOwner = costingOwner(options.owner);
    if (suppliedId && suppliedId.indexOf(lineOwner + "-COST-") !== 0) throw new Error("Costing line id prefix must match its owner.");
    return {
      id: suppliedId || lineOwner + "-COST-" + hash([rate.id, sourceGeometryId || "manual", text(options.discriminator)].join("|")),
      owner: lineOwner,
      type: "costingLine",
      title: rate.description,
      category: rate.category,
      rateItemId: rate.id,
      quantity: Math.round((quantity + Number.EPSILON) * 1000000) / 1000000,
      unit: rate.unit,
      unitRate: rate.unitRate,
      estimatedTotal: money(quantity * rate.unitRate),
      sourceGeometryId: sourceGeometryId,
      jobId: null,
      assignmentState: "Unassigned",
      calculation: { quantityKind: rate.quantityKind, inputs: clone(measurementInput || {}) }
    };
  }

  function calculate(rateItems, requests) {
    var library = normalize(rateItems), byId = {};
    library.items.forEach(function (item) { byId[item.id] = item; });
    var lines = (requests || []).map(function (request, index) {
      if (!object(request) || !byId[text(request.rateItemId)]) throw new Error("Calculation request " + (index + 1) + " references an unknown rate item.");
      return calculateLine(byId[text(request.rateItemId)], request.measurements, request);
    });
    return { lines: lines, total: money(lines.reduce(function (sum, line) { return sum + line.estimatedTotal; }, 0)) };
  }

  function safeCell(value) {
    var output = String(value == null ? "" : value);
    if (/^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(output)) output = "'" + output;
    return '"' + output.replace(/"/g, '""') + '"';
  }
  function exportCsv(library) {
    var rows = normalize(library).items.slice().sort(function (a, b) { return a.category.localeCompare(b.category) || a.description.localeCompare(b.description); });
    return CSV_COLUMNS.map(safeCell).join(",") + "\r\n" + rows.map(function (item) {
      var row = Object.assign({}, item, {
        sourceFileName: item.source && item.source.fileName || "",
        sourceImportedAt: item.source && item.source.importedAt || "",
        sourceRow: item.source && item.source.sourceRow || "",
        sourceId: item.source && item.source.id || ""
      });
      return CSV_COLUMNS.map(function (column) { return safeCell(row[column]); }).join(",");
    }).join("\r\n") + (rows.length ? "\r\n" : "");
  }

  function csvRows(value) {
    var rows = [], row = [], cell = "", quoted = false, input = String(value || "").replace(/^\uFEFF/, "");
    for (var index = 0; index <= input.length; index += 1) {
      var character = index < input.length ? input[index] : "\n";
      if (quoted) {
        if (character === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else cell += character;
      } else if (character === '"' && !cell) quoted = true;
      else if (character === ",") { row.push(cell); cell = ""; }
      else if (character === "\n" || character === "\r") {
        if (character === "\r" && input[index + 1] === "\n") index += 1;
        row.push(cell); if (row.some(function (value) { return text(value); })) rows.push(row); row = []; cell = "";
      } else cell += character;
    }
    if (quoted) throw new Error("CSV contains an unterminated quoted field.");
    return rows;
  }

  function importCsv(value) {
    var rows = csvRows(value);
    if (rows.length < 1) throw new Error("Rate library CSV is empty.");
    if (rows.length > MAX_ITEMS + 1) throw new Error("Rate library CSV contains more than 10,000 item rows.");
    var indexes = {};
    rows[0].forEach(function (heading, index) {
      var key = text(heading).toLowerCase();
      if (indexes[key] != null) throw new Error('Rate library CSV has duplicate column "' + key + '".');
      indexes[key] = index;
    });
    REQUIRED_CSV_COLUMNS.forEach(function (column) { if (indexes[column.toLowerCase()] == null) throw new Error('Rate library CSV is missing column "' + column + '".'); });
    return normalize(rows.slice(1).map(function (row, offset) {
      function get(name) { return row[indexes[name.toLowerCase()]] == null ? "" : row[indexes[name.toLowerCase()]]; }
      var active = text(get("active")).toLowerCase();
      if (["true", "1", "yes", "active"].indexOf(active) >= 0) active = true;
      else if (["false", "0", "no", "inactive"].indexOf(active) >= 0) active = false;
      else throw new Error("Rate library CSV row " + (offset + 2) + " has an invalid active value.");
      var schedulerFlag = text(get("schedulerEnabled")).toLowerCase();
      if (schedulerFlag && ["true", "false", "1", "0", "yes", "no"].indexOf(schedulerFlag) < 0) throw new Error("Rate library CSV row " + (offset + 2) + " has an invalid schedulerEnabled value.");
      return {
        id: get("id"), owner: get("owner"), category: get("category"), description: get("description"),
        unit: get("unit"), unitRate: get("unitRate"), active: active, quantityKind: get("quantityKind"), schedulerEnabled: schedulerFlag ? ["true", "1", "yes"].indexOf(schedulerFlag) >= 0 : undefined,
        kind: get("kind"), libraryCategory: get("libraryCategory"), catalogSection: get("catalogSection"), addPath: get("addPath"),
        sourceFileName: get("sourceFileName"), sourceImportedAt: get("sourceImportedAt"), sourceRow: get("sourceRow"),
        sourceId: get("sourceId"), sourceApp: get("sourceApp"), sourceVersion: get("sourceVersion"), legacyId: get("legacyId")
      };
    }));
  }

  function toUnifiedRateItem(input) {
    var item = normalizeItem(input);
    return { id: item.id, owner: "", type: "rateItem", title: item.description, status: item.active ? "Active" : "Inactive", category: item.category, description: item.description, unit: item.unit, unitRate: item.unitRate, active: item.active, schedulerEnabled: item.schedulerEnabled, quantityKind: item.quantityKind, kind: item.kind, libraryCategory: item.libraryCategory, catalogSection: item.catalogSection, addPath: item.addPath, source: clone(item.source), sourceApp: item.sourceApp, sourceVersion: item.sourceVersion, legacyId: item.legacyId, payload: clone(item), provenance: { owner: "GLOBAL", ownerName: "Universal catalog", legacyId: item.legacyId || "", sourceApp: item.sourceApp || "uos.rate-library", sourceVersion: item.sourceVersion || 1, sourceId: item.source && item.source.id || "" } };
  }

  UOS.rateLibrary = {
    version: 1,
    quantityKinds: QUANTITY_KINDS.slice(),
    csvColumns: CSV_COLUMNS.slice(),
    normalizeItem: normalizeItem,
    normalize: normalize,
    categories: categories,
    filter: filter,
    upsert: upsert,
    remove: remove,
    deriveQuantity: deriveQuantity,
    calculateLine: calculateLine,
    calculate: calculate,
    exportCsv: exportCsv,
    importCsv: importCsv,
    toUnifiedRateItem: toUnifiedRateItem
  };
})();
