(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var EARTH_RADIUS = 6371008.8;
  var DIMENSION_UNITS = ["ha", "m2", "m", "each"];
  var MAX_EVENTS = 5000;
  var MAX_ROWS = 10000;
  var MAX_SHAPES = 5000;
  var MAX_COORDINATES = 10000;
  var MAX_MONEY_CENTS = Number.MAX_SAFE_INTEGER;
  var MAX_MONEY = MAX_MONEY_CENTS / 100;
  var KNOWN_STATUSES = ["Planned", "Quoted", "In Progress", "Complete", "Over Budget", "Uncosted"];
  var JOB_STATUSES = ["Draft", "Scheduled", "In Progress", "Completed", "Cancelled"];

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function uuid(prefix) {
    return UOS.imports && UOS.imports.uuid ? UOS.imports.uuid(prefix) : prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function string(value) {
    return value == null ? "" : String(value);
  }

  function finite(value) {
    if (value === "" || value == null) return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function nonNegative(value, fallback) {
    var number = finite(value);
    return number !== null && number >= 0 ? number : (fallback == null ? 0 : fallback);
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key);
  }

  function importNumber(value, path, warnings, options) {
    options = options || {};
    if (value === undefined || value === null || value === "") {
      if (options.warnMissing !== false) warnings.push(path + ": not supplied; " + (options.fallback == null ? 0 : options.fallback) + " was used.");
      return options.fallback == null ? 0 : options.fallback;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(path + " must be a finite number.");
    if (options.minimum != null && value < options.minimum) throw new Error(path + " must be at least " + options.minimum + ".");
    if (options.maximum != null && value > options.maximum) throw new Error(path + " must be no more than " + options.maximum + ".");
    return value;
  }

  function importArray(value, path, warnings, limit) {
    if (value === undefined || value === null) {
      warnings.push(path + ": not supplied; an empty list was used.");
      return [];
    }
    if (!Array.isArray(value)) throw new Error(path + " must be an array.");
    if (value.length > limit) throw new Error(path + " contains more than " + limit + " records.");
    return value;
  }

  function clamp(value, minimum, maximum) {
    var number = finite(value);
    if (number === null) return minimum;
    return Math.min(maximum, Math.max(minimum, number));
  }

  function pushDiagnostic(diagnostics, message) {
    if (Array.isArray(diagnostics) && diagnostics.indexOf(message) < 0) diagnostics.push(message);
  }

  function shiftDecimal(value, places) {
    var parts = String(value).split("e");
    return Number(parts[0] + "e" + (Number(parts[1] || 0) + places));
  }

  function moneyCents(value, diagnostics, label) {
    var number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      pushDiagnostic(diagnostics, (label || "Financial value") + " was not finite and was treated as $0.00.");
      return 0;
    }
    if (number > MAX_MONEY) {
      pushDiagnostic(diagnostics, (label || "Financial value") + " exceeded the supported monetary range and was capped.");
      return MAX_MONEY_CENTS;
    }
    return Math.min(MAX_MONEY_CENTS, Math.round(shiftDecimal(number, 2)));
  }

  function moneyProductCents(values, diagnostics, label) {
    var product = 1;
    for (var index = 0; index < values.length; index += 1) {
      var factor = Number(values[index]);
      if (!Number.isFinite(factor) || factor < 0) {
        pushDiagnostic(diagnostics, (label || "Financial value") + " contained an invalid factor and was treated as $0.00.");
        return 0;
      }
      if (factor === 0) return 0;
      if (product > MAX_MONEY / factor) {
        pushDiagnostic(diagnostics, (label || "Financial value") + " exceeded the supported monetary range and was capped.");
        return MAX_MONEY_CENTS;
      }
      product *= factor;
    }
    return moneyCents(product, diagnostics, label);
  }

  function addMoneyCents(total, value, diagnostics, label) {
    if (value > MAX_MONEY_CENTS - total) {
      pushDiagnostic(diagnostics, (label || "Financial total") + " exceeded the supported monetary range and was capped.");
      return MAX_MONEY_CENTS;
    }
    return total + value;
  }

  function centsToMoney(value) {
    return value / 100;
  }

  function roundMoney(value) {
    return centsToMoney(moneyCents(value));
  }

  function canonicalStatus(value) {
    var normalized = string(value).trim().replace(/\s+/g, " ");
    var match = KNOWN_STATUSES.find(function (status) { return status.toLocaleLowerCase() === normalized.toLocaleLowerCase(); });
    return match || normalized;
  }

  function canonicalSeason(value) {
    var normalized = string(value).trim().replace(/[\u2010-\u2015/]/g, "-").replace(/\s+/g, "");
    var match = normalized.match(/^(\d{2}|\d{4})-(\d{2}|\d{4})$/);
    if (!match) return normalized;
    var first = Number(match[1].slice(-2));
    var second = Number(match[2].slice(-2));
    if (second !== (first + 1) % 100) return normalized;
    return String(first).padStart(2, "0") + "-" + String(second).padStart(2, "0");
  }

  function isISODate(value) {
    var match = string(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1) return false;
    var days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= days[month - 1];
  }

  function normalizeISODate(value, path) {
    var normalized = string(value).trim();
    if (normalized && !isISODate(normalized)) throw new Error(path + " must be a valid ISO date in YYYY-MM-DD format.");
    return normalized;
  }

  function blankEnvelope() {
    return {
      app: "uos.remediation",
      schemaVersion: 2,
      events: [],
      referenceData: {},
      workspace: {
        selectedId: null,
        view: "overview",
        quoteMode: "summary",
        scheduler: { weekStart: "", sort: "date", filters: { category: "", status: "", crew: "" }, selectedId: null, listScrollTop: 0 },
        costSections: { materials: true, labour: true },
        map: { provider: "offline", showLabels: true, showAngles: true, showEdges: true, showIndex: true, showSelectedOnly: false }
      }
    };
  }

  function allocationFromDefault(row, index) {
    row = row && typeof row === "object" ? row : {};
    var label = string(row.label || row.key).trim();
    var suppliedKey = string(row.key).trim();
    var suppliedDimensionKey = string(row.dimensionKey).trim();
    var key = suppliedKey || (label ? slug(label) : suppliedDimensionKey);
    var dimensionKey = suppliedDimensionKey || key;
    return {
      id: uuid("allocation"),
      key: key,
      label: label,
      enabled: Boolean(row.enabled),
      rate: typeof row.rate === "number" && Number.isFinite(row.rate) && row.rate >= 0 ? row.rate : 0,
      quotedQuantity: typeof row.quotedQuantity === "number" && Number.isFinite(row.quotedQuantity) && row.quotedQuantity >= 0 ? row.quotedQuantity : 0,
      dimensionKey: dimensionKey,
      dimensionUnit: DIMENSION_UNITS.indexOf(row.dimensionUnit) >= 0 ? row.dimensionUnit : "ha",
      total: 0
    };
  }

  function blankEvent(referenceData) {
    var event = {
      id: uuid("event"),
      season: "",
      park: "",
      eventName: "",
      date: "",
      jobNumber: "",
      areaHa: 0,
      status: "",
      statusRecords: [],
      allocations: referenceData && Array.isArray(referenceData.workDefaults) ? referenceData.workDefaults.map(allocationFromDefault) : [],
      materials: [],
      labour: [],
      jobs: [],
      quote: { lines: [] },
      location: null,
      polygons: [],
      dimensionSource: "quoted",
      contingencyPct: 0,
      completion: {},
      notes: "",
      pendingHours: "",
      tracking: {},
      source: { createdIn: "uos.remediation", createdAt: new Date().toISOString() }
    };
    recalculate(event);
    return event;
  }

  function slug(value) {
    return string(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || uuid("dimension");
  }

  function legacyQuotedQuantity(event, allocation) {
    if (allocation.quotedQuantity !== undefined && allocation.quotedQuantity !== null) return allocation.quotedQuantity;
    var tracking = event.tracking || {};
    if (allocation.key === "aerate" && tracking.aerationAreaHa !== undefined && tracking.aerationAreaHa !== null) return nonNegative(tracking.aerationAreaHa, 0);
    if (allocation.key === "fertilise" && tracking.fertilisingAreaHa !== undefined && tracking.fertilisingAreaHa !== null) return nonNegative(tracking.fertilisingAreaHa, 0);
    return nonNegative(event.areaHa, 0);
  }

  function normalizeAllocation(row, event, warnings, path, context) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(path + " must be an object.");
    row = clone(row);
    var label = string(row.label || row.key).trim();
    var suppliedKey = string(row.key).trim();
    var suppliedDimensionKey = string(row.dimensionKey).trim();
    var key = suppliedKey || (label ? slug(label) : suppliedDimensionKey);
    var dimensionKey = suppliedDimensionKey || key;
    var rate = importNumber(row.rate, path + " rate", warnings, { minimum: 0, fallback: 0 });
    var quotedValue = !hasOwn(row, "quotedQuantity") ? legacyQuotedQuantity(event, row) : row.quotedQuantity;
    var quoted = importNumber(quotedValue, path + " quotedQuantity", warnings, { minimum: 0, fallback: 0, warnMissing: false });
    if (row.total !== undefined) importNumber(row.total, path + " total", warnings, { minimum: 0, warnMissing: false });
    var unit = DIMENSION_UNITS.indexOf(row.dimensionUnit) >= 0 ? row.dimensionUnit : "ha";
    if (row.dimensionUnit && unit !== row.dimensionUnit) warnings.push(path + ": unsupported dimensionUnit was replaced with ha.");
    return Object.assign({}, row, {
      id: string(row.id) || uuid("allocation"),
      key: key,
      label: label,
      enabled: Boolean(row.enabled),
      rate: rate,
      quotedQuantity: quoted,
      dimensionKey: dimensionKey,
      dimensionUnit: unit,
      total: 0
    });
  }

  function normalizeMaterial(row, warnings, path) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(path + " must be an object.");
    row = clone(row);
    row.qty = importNumber(row.qty, path + " qty", warnings, { minimum: 0, fallback: 0 });
    row.unitCost = importNumber(row.unitCost, path + " unitCost", warnings, { minimum: 0, fallback: 0 });
    row.id = string(row.id) || uuid("material");
    row.item = string(row.item);
    row.category = string(row.category);
    row.unit = string(row.unit);
    row.notes = string(row.notes);
    row.calculationMode = row.calculationMode === "soil" ? "soil" : "standard";
    row.depthM = importNumber(row.depthM, path + " depthM", warnings, { minimum: 0, fallback: 0, warnMissing: false });
    row.density = importNumber(row.density, path + " density", warnings, { minimum: 0, fallback: row.calculationMode === "soil" ? 1.6 : 0, warnMissing: false });
    return row;
  }

  function normalizeQuote(raw, warnings, path) {
    if (raw == null) return { lines: [] };
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(path + " must be an object.");
    var lines = importArray(raw.lines, path + " lines", warnings, MAX_ROWS).map(function (line, index) {
      var linePath = path + " line " + (index + 1);
      if (!line || typeof line !== "object" || Array.isArray(line)) throw new Error(linePath + " must be an object.");
      var sourceType = ["allocation", "material", "labour"].indexOf(line.sourceType) >= 0 ? line.sourceType : "";
      if (!sourceType) throw new Error(linePath + " has an unsupported sourceType.");
      return { id: string(line.id) || uuid("quote-line"), sourceType: sourceType, sourceId: string(line.sourceId), section: string(line.section).trim() || "Remediation works", description: string(line.description).trim(), order: index };
    });
    return { lines: lines };
  }

  function normalizeLabour(row, warnings, path) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(path + " must be an object.");
    row = clone(row);
    ["workers", "hours", "rate"].forEach(function (field) {
      row[field] = importNumber(row[field], path + " " + field, warnings, { minimum: 0, fallback: 0 });
    });
    row.id = string(row.id) || uuid("labour");
    row.task = string(row.task);
    row.provider = string(row.provider);
    row.notes = string(row.notes);
    return row;
  }

  function canonicalJobStatus(value) {
    var normalized = string(value).trim().replace(/\s+/g, " ");
    if (normalized.toLocaleLowerCase() === "complete") normalized = "Completed";
    var match = JOB_STATUSES.find(function (status) { return status.toLocaleLowerCase() === normalized.toLocaleLowerCase(); });
    return match || "Draft";
  }

  function normalizeCostingRefs(value, path, warnings) {
    return importArray(value, path, warnings, MAX_ROWS).map(function (reference, index) {
      if (!reference || typeof reference !== "object" || Array.isArray(reference)) throw new Error(path + " reference " + (index + 1) + " must be an object.");
      var type = string(reference.type || reference.sourceType).trim();
      if (["allocation", "material", "labour"].indexOf(type) < 0) throw new Error(path + " reference " + (index + 1) + " has an unsupported type.");
      var id = string(reference.id || reference.sourceId).trim();
      if (!id) throw new Error(path + " reference " + (index + 1) + " requires an id.");
      return { type: type, id: id };
    });
  }

  function normalizeTask(raw, warnings, path) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(path + " must be an object.");
    var task = clone(raw);
    task.id = string(task.id) || uuid("task");
    task.title = string(task.title).trim();
    task.status = canonicalJobStatus(task.status);
    task.startDate = normalizeISODate(task.startDate, path + " startDate");
    task.endDate = normalizeISODate(task.endDate, path + " endDate");
    task.costingLineRefs = normalizeCostingRefs(task.costingLineRefs, path + " costingLineRefs", warnings);
    task.estimate = nonNegative(task.estimate, 0);
    task.actualCost = task.actualCost == null ? null : importNumber(task.actualCost, path + " actualCost", warnings, { minimum: 0, warnMissing: false });
    task.completedAt = string(task.completedAt);
    return task;
  }

  function normalizeJob(raw, warnings, path, eventId) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(path + " must be an object.");
    var job = clone(raw);
    job.id = string(job.id) || uuid("job");
    job.sourceEventId = string(job.sourceEventId) || eventId;
    if (job.sourceEventId !== eventId) throw new Error(path + " sourceEventId must identify its containing event.");
    job.promotionKey = string(job.promotionKey).trim() || "primary";
    job.title = string(job.title).trim();
    job.status = canonicalJobStatus(job.status);
    job.startDate = normalizeISODate(job.startDate, path + " startDate");
    job.endDate = normalizeISODate(job.endDate, path + " endDate");
    job.crewId = string(job.crewId) || null;
    job.priority = string(job.priority);
    job.costingLineRefs = normalizeCostingRefs(job.costingLineRefs, path + " costingLineRefs", warnings);
    job.tasks = importArray(job.tasks, path + " tasks", warnings, MAX_ROWS).map(function (task, index) { return normalizeTask(task, warnings, path + " task " + (index + 1)); });
    job.estimate = nonNegative(job.estimate, 0);
    job.actualCost = job.actualCost == null ? null : importNumber(job.actualCost, path + " actualCost", warnings, { minimum: 0, warnMissing: false });
    job.promotedAt = string(job.promotedAt);
    job.completedAt = string(job.completedAt);
    return job;
  }

  function normalizeStatusRecord(row, path) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(path + " must be an object.");
    row = clone(row);
    row.id = string(row.id) || uuid("status-record");
    row.status = canonicalStatus(row.status);
    row.date = normalizeISODate(row.date, path + " date");
    row.season = canonicalSeason(row.season);
    return row;
  }

  function latestStatusRecord(eventOrRecords) {
    var records = Array.isArray(eventOrRecords) ? eventOrRecords : eventOrRecords && eventOrRecords.statusRecords;
    if (!Array.isArray(records)) return null;
    var latest = records.reduce(function (candidate, record, index) {
      if (!record || !record.status || !record.season || !isISODate(record.date)) return candidate;
      if (!candidate || record.date > candidate.record.date || (record.date === candidate.record.date && index > candidate.index)) return { record: record, index: index };
      return candidate;
    }, null);
    return latest ? latest.record : null;
  }

  function syncEventStatus(event) {
    if (!event || typeof event !== "object") return event;
    var latest = latestStatusRecord(event);
    if (latest) {
      event.status = canonicalStatus(latest.status);
      event.season = canonicalSeason(latest.season);
    } else {
      event.status = "";
      event.season = "";
    }
    return event;
  }

  function coordinateValid(coordinate) {
    return Array.isArray(coordinate) && coordinate.length >= 2 && finite(coordinate[0]) !== null && finite(coordinate[1]) !== null && Number(coordinate[0]) >= -180 && Number(coordinate[0]) <= 180 && Number(coordinate[1]) >= -90 && Number(coordinate[1]) <= 90;
  }

  function normalizedCoordinate(coordinate) {
    return coordinateValid(coordinate) ? [Number(coordinate[0]), Number(coordinate[1])] : [null, null];
  }

  function coordinatesEqual(first, second) {
    return coordinateValid(first) && coordinateValid(second) && Math.abs(Number(first[0]) - Number(second[0])) < 1e-12 && Math.abs(Number(first[1]) - Number(second[1])) < 1e-12;
  }

  function removeClosingCoordinate(coordinates) {
    var output = Array.isArray(coordinates) ? coordinates : [];
    while (output.length > 1 && coordinatesEqual(output[0], output[output.length - 1])) output.pop();
    return output;
  }

  function removeConsecutiveDuplicateCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) return 0;
    var removed = 0;
    for (var index = coordinates.length - 1; index > 0; index -= 1) {
      if (!coordinatesEqual(coordinates[index - 1], coordinates[index])) continue;
      coordinates.splice(index, 1);
      removed += 1;
    }
    return removed;
  }

  function metresBetween(first, second) {
    if (!coordinateValid(first) || !coordinateValid(second)) return 0;
    var radians = Math.PI / 180;
    var latitude = (second[1] - first[1]) * radians;
    var longitude = (second[0] - first[0]) * radians;
    var value = Math.sin(latitude / 2) * Math.sin(latitude / 2) + Math.cos(first[1] * radians) * Math.cos(second[1] * radians) * Math.sin(longitude / 2) * Math.sin(longitude / 2);
    return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(value)));
  }

  function localPoint(coordinate, origin) {
    var radians = Math.PI / 180;
    return {
      x: (coordinate[0] - origin[0]) * radians * EARTH_RADIUS * Math.cos(origin[1] * radians),
      y: (coordinate[1] - origin[1]) * radians * EARTH_RADIUS
    };
  }

  function fromLocal(point, origin) {
    var radians = Math.PI / 180;
    var cosine = Math.cos(origin[1] * radians) || 1;
    return [origin[0] + point.x / (EARTH_RADIUS * cosine) / radians, origin[1] + point.y / EARTH_RADIUS / radians];
  }

  function polygonAreaSqM(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 3 || !coordinates.every(coordinateValid)) return 0;
    var origin = coordinates[0];
    var points = coordinates.map(function (coordinate) { return localPoint(coordinate, origin); });
    var area = 0;
    points.forEach(function (point, index) {
      var next = points[(index + 1) % points.length];
      area += point.x * next.y - next.x * point.y;
    });
    return Math.abs(area / 2);
  }

  function lineLength(coordinates, closed) {
    if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(coordinateValid)) return 0;
    var length = 0;
    for (var index = 1; index < coordinates.length; index += 1) length += metresBetween(coordinates[index - 1], coordinates[index]);
    if (closed && coordinates.length > 2) length += metresBetween(coordinates[coordinates.length - 1], coordinates[0]);
    return length;
  }

  function coordinateMidpoint(first, second) {
    if (!coordinateValid(first) || !coordinateValid(second)) return null;
    var firstLongitude = Number(first[0]);
    var secondLongitude = Number(second[0]);
    if (Math.abs(secondLongitude - firstLongitude) > 180) {
      if (firstLongitude < secondLongitude) firstLongitude += 360;
      else secondLongitude += 360;
    }
    var longitude = (firstLongitude + secondLongitude) / 2;
    if (longitude > 180) longitude -= 360;
    return [longitude, (Number(first[1]) + Number(second[1])) / 2];
  }

  function polygonCentroid(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 3 || !coordinates.every(coordinateValid)) return null;
    var origin = coordinates[0];
    var points = coordinates.map(function (coordinate) { return localPoint(coordinate, origin); });
    var twiceArea = 0;
    var centroidX = 0;
    var centroidY = 0;
    points.forEach(function (point, index) {
      var next = points[(index + 1) % points.length];
      var cross = point.x * next.y - next.x * point.y;
      twiceArea += cross;
      centroidX += (point.x + next.x) * cross;
      centroidY += (point.y + next.y) * cross;
    });
    if (Math.abs(twiceArea) < 1e-9) {
      var average = points.reduce(function (total, point) { return { x: total.x + point.x, y: total.y + point.y }; }, { x: 0, y: 0 });
      return fromLocal({ x: average.x / points.length, y: average.y / points.length }, origin);
    }
    return fromLocal({ x: centroidX / (3 * twiceArea), y: centroidY / (3 * twiceArea) }, origin);
  }

  function vertexAngleDegrees(previous, vertex, next) {
    if (!coordinateValid(previous) || !coordinateValid(vertex) || !coordinateValid(next)) return null;
    var incoming = localPoint(previous, vertex);
    var outgoing = localPoint(next, vertex);
    var incomingLength = Math.hypot(incoming.x, incoming.y);
    var outgoingLength = Math.hypot(outgoing.x, outgoing.y);
    if (!incomingLength || !outgoingLength) return null;
    var cosine = (incoming.x * outgoing.x + incoming.y * outgoing.y) / (incomingLength * outgoingLength);
    return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
  }

  function geometryMeasurements(coordinates, geometryType, closed) {
    coordinates = Array.isArray(coordinates) ? coordinates : [];
    geometryType = geometryType === "line" ? "line" : "polygon";
    var closeGeometry = coordinates.length >= 3 && (geometryType === "polygon" || Boolean(closed));
    var segmentCount = coordinates.length > 1 ? coordinates.length - 1 + (closeGeometry ? 1 : 0) : 0;
    var segments = [];
    for (var index = 0; index < segmentCount; index += 1) {
      var nextIndex = (index + 1) % coordinates.length;
      if (!coordinateValid(coordinates[index]) || !coordinateValid(coordinates[nextIndex])) continue;
      segments.push({
        fromIndex: index,
        toIndex: nextIndex,
        lengthM: metresBetween(coordinates[index], coordinates[nextIndex]),
        midpoint: coordinateMidpoint(coordinates[index], coordinates[nextIndex])
      });
    }
    var angles = [];
    if (closeGeometry) {
      coordinates.forEach(function (coordinate, angleIndex) {
        var angle = vertexAngleDegrees(coordinates[(angleIndex - 1 + coordinates.length) % coordinates.length], coordinate, coordinates[(angleIndex + 1) % coordinates.length]);
        if (angle !== null) angles.push({ index: angleIndex, degrees: angle, coordinate: coordinate.slice(0, 2) });
      });
    } else {
      for (var angleIndex = 1; angleIndex < coordinates.length - 1; angleIndex += 1) {
        var lineAngle = vertexAngleDegrees(coordinates[angleIndex - 1], coordinates[angleIndex], coordinates[angleIndex + 1]);
        if (lineAngle !== null) angles.push({ index: angleIndex, degrees: lineAngle, coordinate: coordinates[angleIndex].slice(0, 2) });
      }
    }
    var validation = shapeValidation({ geometryType: geometryType, closed: closeGeometry, coordinates: coordinates });
    var areaSqM = geometryType === "polygon" ? polygonAreaSqM(coordinates) : 0;
    return {
      geometryType: geometryType,
      closed: closeGeometry,
      coordinateCount: coordinates.length,
      valid: validation.valid,
      validationMessage: validation.message,
      segments: segments,
      angles: angles,
      totalLengthM: segments.reduce(function (total, segment) { return total + segment.lengthM; }, 0),
      areaSqM: areaSqM,
      areaCoordinate: validation.valid && geometryType === "polygon" ? polygonCentroid(coordinates) : null
    };
  }

  function formattedNumber(value, minimumDigits, maximumDigits) {
    return Number(value || 0).toLocaleString("en-AU", { minimumFractionDigits: minimumDigits, maximumFractionDigits: maximumDigits });
  }

  function formatLength(value) {
    value = Math.max(0, Number(value) || 0);
    if (value >= 1000) return formattedNumber(value / 1000, 0, 2) + " km";
    return formattedNumber(value, 0, value < 10 ? 2 : 1) + " m";
  }

  function formatArea(value) {
    value = Math.max(0, Number(value) || 0);
    if (value >= 10000) return formattedNumber(value / 10000, 0, 2) + " ha";
    return formattedNumber(value, 0, value < 100 ? 2 : 1) + " m²";
  }

  function formatAngle(value) {
    return formattedNumber(value, 0, 1) + "°";
  }

  function orientation(first, second, third) {
    var abX = second[0] - first[0];
    var abY = second[1] - first[1];
    var acX = third[0] - first[0];
    var acY = third[1] - first[1];
    var value = abX * acY - abY * acX;
    var scale = (Math.abs(abX) + Math.abs(abY)) * (Math.abs(acX) + Math.abs(acY));
    var tolerance = Number.EPSILON * 64 * scale;
    return Math.abs(value) <= tolerance ? 0 : (value > 0 ? 1 : 2);
  }

  function onSegment(first, second, third) {
    var magnitude = Math.max(1, Math.abs(first[0]), Math.abs(first[1]), Math.abs(second[0]), Math.abs(second[1]), Math.abs(third[0]), Math.abs(third[1]));
    var tolerance = Number.EPSILON * 64 * magnitude;
    return second[0] <= Math.max(first[0], third[0]) + tolerance && second[0] >= Math.min(first[0], third[0]) - tolerance && second[1] <= Math.max(first[1], third[1]) + tolerance && second[1] >= Math.min(first[1], third[1]) - tolerance;
  }

  function segmentsIntersect(first, second, third, fourth) {
    var one = orientation(first, second, third);
    var two = orientation(first, second, fourth);
    var three = orientation(third, fourth, first);
    var four = orientation(third, fourth, second);
    if (one !== 0 && two !== 0 && three !== 0 && four !== 0 && one !== two && three !== four) return true;
    return (one === 0 && onSegment(first, third, second)) || (two === 0 && onSegment(first, fourth, second)) || (three === 0 && onSegment(third, first, fourth)) || (four === 0 && onSegment(third, second, fourth));
  }

  function segmentBounds(first, second, index) {
    return {
      index: index,
      first: first,
      second: second,
      minX: Math.min(first[0], second[0]),
      maxX: Math.max(first[0], second[0]),
      minY: Math.min(first[1], second[1]),
      maxY: Math.max(first[1], second[1])
    };
  }

  function segmentsAdjacent(first, second, count) {
    return first === second || (first + 1) % count === second || (second + 1) % count === first;
  }

  function boundsOverlap(first, second) {
    var magnitude = Math.max(1, Math.abs(first.minX), Math.abs(first.maxX), Math.abs(first.minY), Math.abs(first.maxY), Math.abs(second.minX), Math.abs(second.maxX), Math.abs(second.minY), Math.abs(second.maxY));
    var tolerance = Number.EPSILON * 64 * magnitude;
    return first.maxX + tolerance >= second.minX && second.maxX + tolerance >= first.minX && first.maxY + tolerance >= second.minY && second.maxY + tolerance >= first.minY;
  }

  function firstIntersectionPair(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 4 || !coordinates.every(coordinateValid)) return null;
    var count = coordinates.length;
    var segments = coordinates.map(function (coordinate, index) {
      return segmentBounds(coordinate, coordinates[(index + 1) % count], index);
    }).sort(function (first, second) {
      return first.minX - second.minX || first.minY - second.minY || first.index - second.index;
    });
    var active = [];
    for (var segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      var segment = segments[segmentIndex];
      var xTolerance = Number.EPSILON * 64 * Math.max(1, Math.abs(segment.minX));
      active = active.filter(function (candidate) { return candidate.maxX + xTolerance >= segment.minX; });
      for (var activeIndex = 0; activeIndex < active.length; activeIndex += 1) {
        var candidate = active[activeIndex];
        if (segmentsAdjacent(candidate.index, segment.index, count) || !boundsOverlap(candidate, segment)) continue;
        if (segmentsIntersect(candidate.first, candidate.second, segment.first, segment.second)) return [Math.min(candidate.index, segment.index), Math.max(candidate.index, segment.index)];
      }
      active.push(segment);
    }
    return null;
  }

  function selfIntersects(coordinates) {
    return firstIntersectionPair(coordinates) !== null;
  }

  function repairPolygon(coordinates) {
    var result = Array.isArray(coordinates) ? coordinates.map(function (point) { return point.slice(0, 2); }) : [];
    var guard = 0;
    while (guard < 100) {
      var pair = firstIntersectionPair(result);
      if (!pair) break;
      result = result.slice(0, pair[0] + 1).concat(result.slice(pair[0] + 1, pair[1] + 1).reverse(), result.slice(pair[1] + 1));
      guard += 1;
    }
    return result;
  }

  function shapeValidation(shape) {
    var coordinates = Array.isArray(shape.coordinates) ? shape.coordinates.slice() : [];
    if (shape.geometryType !== "line" || Boolean(shape.closed)) removeClosingCoordinate(coordinates);
    removeConsecutiveDuplicateCoordinates(coordinates);
    if (!coordinates.every(coordinateValid)) return { valid: false, message: "One or more coordinates are invalid." };
    if (shape.geometryType === "line") {
      if (coordinates.length < 2) return { valid: false, message: "A line needs at least two coordinates." };
      if (lineLength(coordinates, Boolean(shape.closed)) <= 0) return { valid: false, message: "The line has no measurable length." };
      return { valid: true, message: "" };
    }
    if (coordinates.length < 3) return { valid: false, message: "A polygon needs at least three coordinates." };
    if (selfIntersects(coordinates)) return { valid: false, message: "The polygon self-intersects." };
    if (polygonAreaSqM(coordinates) <= 0) return { valid: false, message: "The polygon has no measurable area." };
    return { valid: true, message: "" };
  }

  function refreshShape(shape) {
    shape.geometryType = shape.geometryType === "line" ? "line" : "polygon";
    shape.closed = shape.geometryType === "line" ? Boolean(shape.closed) : true;
    shape.coordinates = Array.isArray(shape.coordinates) ? shape.coordinates : [];
    if (shape.geometryType === "polygon" || shape.closed) removeClosingCoordinate(shape.coordinates);
    removeConsecutiveDuplicateCoordinates(shape.coordinates);
    var validation = shapeValidation(shape);
    shape.valid = validation.valid;
    shape.validationMessage = validation.message;
    shape.areaSqM = shape.geometryType === "polygon" ? polygonAreaSqM(shape.coordinates) : 0;
    shape.lengthM = shape.geometryType === "line" ? lineLength(shape.coordinates, shape.closed) : 0;
    return shape;
  }

  function normalizeShape(row, warnings, path) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(path + " must be an object.");
    row = clone(row);
    var coordinates = importArray(row.coordinates, path + " coordinates", warnings, MAX_COORDINATES);
    var invalidCoordinateCount = 0;
    coordinates = coordinates.map(function (coordinate, coordinateIndex) {
      if (!coordinateValid(coordinate)) {
        invalidCoordinateCount += 1;
        return [null, null];
      }
      return [Number(coordinate[0]), Number(coordinate[1])];
    });
    if (invalidCoordinateCount) warnings.push(path + ": " + invalidCoordinateCount + (invalidCoordinateCount === 1 ? " invalid coordinate was" : " invalid coordinates were") + " preserved as incomplete; the shape is excluded from mapped pricing until repaired.");
    if (row.areaSqM !== undefined) importNumber(row.areaSqM, path + " areaSqM", warnings, { minimum: 0, warnMissing: false });
    if (row.lengthM !== undefined) importNumber(row.lengthM, path + " lengthM", warnings, { minimum: 0, warnMissing: false });
    row.id = string(row.id) || uuid("shape");
    row.type = string(row.type);
    row.geometryType = row.geometryType === "line" ? "line" : "polygon";
    row.closed = row.geometryType === "line" ? Boolean(row.closed) : true;
    row.visible = row.visible !== false;
    row.coordinates = coordinates;
    if ((row.geometryType === "polygon" || row.closed) && coordinates.length > 1 && coordinatesEqual(coordinates[0], coordinates[coordinates.length - 1])) {
      removeClosingCoordinate(row.coordinates);
      warnings.push(path + ": repeated closing coordinate was removed.");
    }
    var duplicateCoordinateCount = removeConsecutiveDuplicateCoordinates(row.coordinates);
    if (duplicateCoordinateCount) warnings.push(path + ": " + duplicateCoordinateCount + (duplicateCoordinateCount === 1 ? " consecutive duplicate coordinate was" : " consecutive duplicate coordinates were") + " removed.");
    row.createdAt = string(row.createdAt) || new Date().toISOString();
    refreshShape(row);
    if (!row.valid) warnings.push(path + ": " + row.validationMessage + " It will not affect mapped pricing.");
    return row;
  }

  function normalizeEvent(raw, warnings, index, context) {
    var path = "Event " + (index + 1);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(path + " must be an object.");
    var event = clone(raw);
    event.id = string(event.id) || uuid("event");
    event.season = canonicalSeason(event.season);
    event.park = string(event.park).trim();
    event.eventName = string(event.eventName).trim();
    event.date = normalizeISODate(event.date, path + " date");
    event.jobNumber = string(event.jobNumber).trim();
    event.status = canonicalStatus(event.status);
    event.statusRecords = event.statusRecords == null ? [] : importArray(event.statusRecords, path + " statusRecords", warnings, MAX_ROWS).map(function (row, rowIndex) {
      return normalizeStatusRecord(row, path + " status record " + (rowIndex + 1));
    });
    event.notes = string(event.notes);
    event.pendingHours = string(event.pendingHours);
    event.areaHa = importNumber(event.areaHa, path + " areaHa", warnings, { minimum: 0, fallback: 0 });
    event.contingencyPct = importNumber(event.contingencyPct, path + " contingencyPct", warnings, { minimum: 0, maximum: 100, fallback: 0 });
    event.dimensionSource = event.dimensionSource === "map" ? "map" : "quoted";
    if (event.location == null) event.location = null;
    else {
      if (!event.location || typeof event.location !== "object" || Array.isArray(event.location) || !coordinateValid(event.location.coordinate)) throw new Error(path + " location must contain a valid coordinate.");
      event.location = { coordinate: event.location.coordinate.map(Number), visible: event.location.visible !== false };
    }
    if (event.tracking != null && (typeof event.tracking !== "object" || Array.isArray(event.tracking))) throw new Error(path + " tracking must be an object.");
    if (event.completion != null && (typeof event.completion !== "object" || Array.isArray(event.completion))) throw new Error(path + " completion must be an object.");
    if (event.tracking == null) warnings.push(path + ": tracking was not supplied; an empty object was used.");
    if (event.completion == null) warnings.push(path + ": completion was not supplied; an empty object was used.");
    event.tracking = event.tracking || {};
    event.completion = event.completion || {};
    ["turfAreaM2", "turfCarriedOverM2", "aerationAreaHa", "fertilisingAreaHa"].forEach(function (field) {
      if (hasOwn(event.tracking, field)) event.tracking[field] = importNumber(event.tracking[field], path + " tracking." + field, warnings, { minimum: 0, warnMissing: false });
    });
    if (event.source != null && (typeof event.source !== "object" || Array.isArray(event.source))) throw new Error(path + " source must be an object.");
    if (event.source == null) warnings.push(path + ": source metadata was not supplied; an empty object was used.");
    event.source = event.source || {};

    if (!event.eventName) warnings.push(path + ": event name is not supplied.");
    event.allocations = importArray(event.allocations, path + " allocations", warnings, MAX_ROWS).map(function (row, rowIndex) { return normalizeAllocation(row, event, warnings, path + " allocation " + (rowIndex + 1), context); });
    var dimensionOwners = new Map();
    event.allocations.forEach(function (allocation, allocationIndex) {
      if (!allocation.dimensionKey) return;
      if (dimensionOwners.has(allocation.dimensionKey)) {
        warnings.push(path + " allocation " + (allocationIndex + 1) + ': duplicate dimensionKey "' + allocation.dimensionKey + '" also used by allocation ' + (dimensionOwners.get(allocation.dimensionKey) + 1) + "; mapped geometry is priced by the first enabled matching allocation only.");
      } else dimensionOwners.set(allocation.dimensionKey, allocationIndex);
    });
    event.materials = importArray(event.materials, path + " materials", warnings, MAX_ROWS).map(function (row, rowIndex) { return normalizeMaterial(row, warnings, path + " material " + (rowIndex + 1)); });
    event.labour = importArray(event.labour, path + " labour", warnings, MAX_ROWS).map(function (row, rowIndex) { return normalizeLabour(row, warnings, path + " labour " + (rowIndex + 1)); });
    event.jobs = (event.jobs == null ? [] : importArray(event.jobs, path + " jobs", warnings, MAX_ROWS)).map(function (row, rowIndex) { return normalizeJob(row, warnings, path + " job " + (rowIndex + 1), event.id); });
    event.quote = normalizeQuote(event.quote, warnings, path + " quote");
    event.polygons = importArray(event.polygons, path + " polygons", warnings, MAX_SHAPES).map(function (row, rowIndex) { return normalizeShape(row, warnings, path + " shape " + (rowIndex + 1)); });
    if (latestStatusRecord(event)) syncEventStatus(event);
    validateJobLinks(event);
    refreshJobEstimates(event);
    recalculate(event);
    return event;
  }

  function allocationContext(event) {
    var owners = new Map();
    (event.allocations || []).forEach(function (allocation) {
      if (allocation.enabled && allocation.dimensionKey && !owners.has(allocation.dimensionKey)) owners.set(allocation.dimensionKey, allocation);
    });
    var geometry = new Map();
    (event.polygons || []).forEach(function (shape) {
      refreshShape(shape);
      if (shape.visible === false || !shape.valid || !shape.type) return;
      var entry = geometry.get(shape.type);
      if (!entry) {
        entry = { shapeCount: 0, polygonCount: 0, lineCount: 0, areaSqM: 0, lengthM: 0 };
        geometry.set(shape.type, entry);
      }
      entry.shapeCount += 1;
      if (shape.geometryType === "line") {
        entry.lineCount += 1;
        entry.lengthM += shape.lengthM;
      } else {
        entry.polygonCount += 1;
        entry.areaSqM += shape.areaSqM;
      }
    });
    return { owners: owners, geometry: geometry };
  }

  function allocationGeometryEntry(context, allocation) {
    return context && allocation && allocation.dimensionKey ? context.geometry.get(allocation.dimensionKey) || null : null;
  }

  function hasApplicableMappedGeometry(context, allocation) {
    var entry = allocationGeometryEntry(context, allocation);
    if (!entry) return false;
    if (allocation.dimensionUnit === "m") return entry.lineCount > 0;
    if (allocation.dimensionUnit === "each") return entry.shapeCount > 0;
    return entry.polygonCount > 0;
  }

  function allocationMappedQuantity(event, allocation, context) {
    if (!allocation || !allocation.dimensionKey) return 0;
    context = context || allocationContext(event);
    var owner = context.owners.get(allocation.dimensionKey);
    if (owner && owner !== allocation && (!allocation.id || owner.id !== allocation.id)) return 0;
    var entry = allocationGeometryEntry(context, allocation);
    if (!entry) return 0;
    if (allocation.dimensionUnit === "m") return entry.lengthM;
    if (allocation.dimensionUnit === "m2") return entry.areaSqM;
    if (allocation.dimensionUnit === "each") return entry.shapeCount;
    return entry.areaSqM / 10000;
  }

  function allocationQuantity(event, allocation, context) {
    context = context || allocationContext(event);
    var mapped = allocationMappedQuantity(event, allocation, context);
    return event.dimensionSource === "map" || hasApplicableMappedGeometry(context, allocation) ? mapped : nonNegative(allocation.quotedQuantity, 0);
  }

  function recalculate(event, diagnostics) {
    event.contingencyPct = clamp(event.contingencyPct, 0, 100);
    var context = event.allocations.length ? allocationContext(event) : null;
    event.allocations.forEach(function (allocation, index) {
      allocation.rate = nonNegative(allocation.rate, 0);
      allocation.quotedQuantity = nonNegative(allocation.quotedQuantity, 0);
      allocation.total = allocation.enabled ? centsToMoney(moneyProductCents([allocationQuantity(event, allocation, context), allocation.rate], diagnostics, "Allocation " + (index + 1) + " total")) : 0;
    });
    return event;
  }

  function totals(event) {
    var diagnostics = [];
    recalculate(event, diagnostics);
    var allocationCents = event.allocations.reduce(function (total, row, index) {
      return addMoneyCents(total, row.enabled ? moneyCents(nonNegative(row.total, 0), diagnostics, "Allocation " + (index + 1) + " total") : 0, diagnostics, "Allocation total");
    }, 0);
    var materialCents = event.materials.reduce(function (total, row, index) {
      var factors = row.calculationMode === "soil" ? [nonNegative(row.qty, 0), nonNegative(row.depthM, 0), nonNegative(row.density, 1.6), nonNegative(row.unitCost, 0)] : [nonNegative(row.qty, 0), nonNegative(row.unitCost, 0)];
      var rowCents = moneyProductCents(factors, diagnostics, "Material " + (index + 1) + " total");
      return addMoneyCents(total, rowCents, diagnostics, "Materials total");
    }, 0);
    var labourCents = event.labour.reduce(function (total, row, index) {
      var rowCents = moneyProductCents([nonNegative(row.workers, 0), nonNegative(row.hours, 0), nonNegative(row.rate, 0)], diagnostics, "Labour " + (index + 1) + " total");
      return addMoneyCents(total, rowCents, diagnostics, "Labour total");
    }, 0);
    var subtotalCents = addMoneyCents(materialCents, labourCents, diagnostics, "Forecast subtotal");
    var contingencyCents = moneyProductCents([centsToMoney(subtotalCents), clamp(event.contingencyPct, 0, 100) / 100], diagnostics, "Contingency total");
    var forecastCents = addMoneyCents(subtotalCents, contingencyCents, diagnostics, "Forecast total");
    var balanceCents = allocationCents - forecastCents;
    return {
      allocation: centsToMoney(allocationCents),
      materials: centsToMoney(materialCents),
      labour: centsToMoney(labourCents),
      contingency: centsToMoney(contingencyCents),
      forecast: centsToMoney(forecastCents),
      balance: centsToMoney(balanceCents),
      percent: allocationCents > 0 ? forecastCents / allocationCents * 100 : 0,
      diagnostics: diagnostics
    };
  }

  function costingCollection(event, type) {
    if (type === "allocation") return event.allocations || [];
    if (type === "material") return event.materials || [];
    if (type === "labour") return event.labour || [];
    return [];
  }

  function costingRow(event, reference) {
    return costingCollection(event, reference.type).find(function (row) { return row.id === reference.id; }) || null;
  }

  function costingEstimate(event, reference) {
    var row = costingRow(event, reference);
    if (!row) return 0;
    if (reference.type === "allocation") return row.enabled ? nonNegative(row.total, 0) : 0;
    if (reference.type === "material") return row.calculationMode === "soil"
      ? centsToMoney(moneyProductCents([nonNegative(row.qty, 0), nonNegative(row.depthM, 0), nonNegative(row.density, 1.6), nonNegative(row.unitCost, 0)]))
      : centsToMoney(moneyProductCents([nonNegative(row.qty, 0), nonNegative(row.unitCost, 0)]));
    return centsToMoney(moneyProductCents([nonNegative(row.workers, 0), nonNegative(row.hours, 0), nonNegative(row.rate, 0)]));
  }

  function validateJobLinks(event) {
    var jobIds = new Set();
    var assigned = new Map();
    (event.jobs || []).forEach(function (job, jobIndex) {
      if (jobIds.has(job.id)) throw new Error("Event job " + (jobIndex + 1) + ' duplicates job ID "' + job.id + '".');
      jobIds.add(job.id);
      job.costingLineRefs.forEach(function (reference) {
        var key = reference.type + ":" + reference.id;
        if (!costingRow(event, reference)) throw new Error('Event job "' + job.id + '" references a missing costing line "' + key + '".');
        if (assigned.has(key) && assigned.get(key) !== job.id) throw new Error('Costing line "' + key + '" cannot be assigned to more than one job.');
        assigned.set(key, job.id);
      });
      job.tasks.forEach(function (task) {
        task.costingLineRefs.forEach(function (reference) {
          if (!costingRow(event, reference)) throw new Error('Event task "' + task.id + '" references a missing costing line.');
          if (!job.costingLineRefs.some(function (jobRef) { return jobRef.type === reference.type && jobRef.id === reference.id; })) throw new Error('Event task "' + task.id + '" can only use costing lines assigned to its job.');
        });
      });
    });
    ["allocation", "material", "labour"].forEach(function (type) {
      costingCollection(event, type).forEach(function (row) {
        var jobId = assigned.get(type + ":" + row.id) || null;
        row.jobId = jobId;
        row.assignmentState = jobId ? "Assigned" : "Unassigned";
      });
    });
    return event;
  }

  function refreshJobEstimates(event) {
    recalculate(event);
    (event.jobs || []).forEach(function (job) {
      job.estimate = roundMoney(job.costingLineRefs.reduce(function (sum, reference) { return sum + costingEstimate(event, reference); }, 0));
      job.tasks.forEach(function (task) {
        task.estimate = roundMoney(task.costingLineRefs.reduce(function (sum, reference) { return sum + costingEstimate(event, reference); }, 0));
      });
    });
    return event;
  }

  function promoteEventToJob(event, values) {
    values = values || {};
    event.jobs = Array.isArray(event.jobs) ? event.jobs : [];
    var promotionKey = string(values.promotionKey).trim() || "primary";
    var existing = event.jobs.find(function (job) { return job.sourceEventId === event.id && job.promotionKey === promotionKey; });
    if (existing) return { event: event, job: existing, created: false };
    var job = {
      id: string(values.id) || uuid("job"), sourceEventId: event.id, promotionKey: promotionKey,
      title: string(values.title || event.eventName || event.park).trim(), status: canonicalJobStatus(values.status),
      startDate: string(values.startDate || event.date), endDate: string(values.endDate || values.startDate || event.date),
      crewId: string(values.crewId) || null, priority: string(values.priority), costingLineRefs: [], tasks: [],
      estimate: 0, actualCost: null, promotedAt: string(values.promotedAt) || new Date().toISOString(), completedAt: ""
    };
    if (job.startDate && !isISODate(job.startDate)) throw new Error("Job startDate must be a valid ISO date in YYYY-MM-DD format.");
    if (job.endDate && !isISODate(job.endDate)) throw new Error("Job endDate must be a valid ISO date in YYYY-MM-DD format.");
    event.jobs.push(job);
    return { event: event, job: job, created: true };
  }

  function assignCostingLines(event, jobId, references) {
    var job = (event.jobs || []).find(function (candidate) { return candidate.id === jobId; });
    if (!job) throw new Error('Unknown remediation job "' + jobId + '".');
    var normalized = normalizeCostingRefs(references, "Job costingLineRefs", []);
    normalized.forEach(function (reference) { if (!costingRow(event, reference)) throw new Error('Unknown costing line "' + reference.type + ":" + reference.id + '".'); });
    var keys = new Set(normalized.map(function (reference) { return reference.type + ":" + reference.id; }));
    (event.jobs || []).forEach(function (candidate) {
      candidate.costingLineRefs = candidate === job ? normalized : candidate.costingLineRefs.filter(function (reference) { return !keys.has(reference.type + ":" + reference.id); });
      candidate.tasks.forEach(function (task) {
        task.costingLineRefs = task.costingLineRefs.filter(function (reference) {
          return candidate === job ? keys.has(reference.type + ":" + reference.id) : !keys.has(reference.type + ":" + reference.id);
        });
      });
    });
    validateJobLinks(event);
    refreshJobEstimates(event);
    return job;
  }

  function addJobTask(event, jobId, values) {
    values = values || {};
    var job = (event.jobs || []).find(function (candidate) { return candidate.id === jobId; });
    if (!job) throw new Error('Unknown remediation job "' + jobId + '".');
    var refs = normalizeCostingRefs(values.costingLineRefs, "Task costingLineRefs", []);
    refs.forEach(function (reference) {
      if (!job.costingLineRefs.some(function (jobRef) { return jobRef.type === reference.type && jobRef.id === reference.id; })) throw new Error("A task can only use costing lines assigned to its job.");
    });
    var task = { id: string(values.id) || uuid("task"), title: string(values.title).trim(), status: canonicalJobStatus(values.status), startDate: string(values.startDate), endDate: string(values.endDate), costingLineRefs: refs, estimate: 0, actualCost: null, completedAt: "" };
    job.tasks.push(task);
    refreshJobEstimates(event);
    return task;
  }

  function completeJob(event, jobId, actualCost, completedAt) {
    var job = (event.jobs || []).find(function (candidate) { return candidate.id === jobId; });
    if (!job) throw new Error('Unknown remediation job "' + jobId + '".');
    if (actualCost === "" || actualCost == null || !Number.isFinite(Number(actualCost)) || Number(actualCost) < 0) throw new Error("Completing a job requires a confirmed non-negative actual cost.");
    job.actualCost = roundMoney(Number(actualCost));
    job.status = "Completed";
    job.completedAt = string(completedAt) || new Date().toISOString();
    return job;
  }

  function completeJobTask(event, jobId, taskId, actualCost, completedAt) {
    var job = (event.jobs || []).find(function (candidate) { return candidate.id === jobId; });
    var task = job && job.tasks.find(function (candidate) { return candidate.id === taskId; });
    if (!task) throw new Error('Unknown remediation task "' + taskId + '".');
    if (actualCost === "" || actualCost == null || !Number.isFinite(Number(actualCost)) || Number(actualCost) < 0) throw new Error("Completing a task requires a confirmed non-negative actual cost.");
    task.actualCost = roundMoney(Number(actualCost));
    task.status = "Completed";
    task.completedAt = string(completedAt) || new Date().toISOString();
    return task;
  }

  function jobFinances(event) {
    refreshJobEstimates(event);
    var approved = hasOwn(event, "approvedBudget") ? roundMoney(nonNegative(event.approvedBudget, 0)) : totals(event).allocation;
    var committed = 0;
    var actual = 0;
    (event.jobs || []).forEach(function (job) {
      var status = canonicalJobStatus(job.status);
      if (status === "Completed") {
        actual += nonNegative(job.actualCost, 0);
        return;
      }
      var completedEstimate = 0;
      job.tasks.forEach(function (task) {
        if (canonicalJobStatus(task.status) !== "Completed") return;
        completedEstimate += nonNegative(task.estimate, 0);
        actual += nonNegative(task.actualCost, 0);
      });
      if (["Draft", "Scheduled", "In Progress"].indexOf(status) >= 0) committed += Math.max(0, nonNegative(job.estimate, 0) - completedEstimate);
    });
    committed = roundMoney(committed);
    actual = roundMoney(actual);
    return { approvedBudget: approved, committedBudget: committed, actualSpend: actual, spareFunds: roundMoney(approved - actual - committed) };
  }

  function envelopeFrom(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The JSON root must be an object.");
    var legacy = false;
    if (hasOwn(raw, "app")) {
      if (raw.app !== "uos.remediation") throw new Error('Unsupported app envelope "' + string(raw.app) + '". Expected uos.remediation.');
      if (raw.schemaVersion !== 2) throw new Error("Unsupported remediation schemaVersion. This app accepts schemaVersion 2 only.");
    } else {
      var version = raw.version;
      var recognizableWorkspace = hasOwn(raw, "selectedId") || hasOwn(raw, "defaultSelectedId") || hasOwn(raw, "activeTab");
      if ((version !== 1 && version !== 4) || !recognizableWorkspace) throw new Error("Unsupported legacy remediation file. Expected the recognized v1 or v4 workspace shape.");
      legacy = true;
    }
    if (!Array.isArray(raw.events)) throw new Error("The file does not contain an events array.");
    if (raw.events.length > MAX_EVENTS) throw new Error("The file contains more than " + MAX_EVENTS + " events.");
    if (raw.referenceData !== undefined && (!raw.referenceData || typeof raw.referenceData !== "object" || Array.isArray(raw.referenceData))) throw new Error("referenceData must be an object.");
    if (raw.workspace !== undefined && (!raw.workspace || typeof raw.workspace !== "object" || Array.isArray(raw.workspace))) throw new Error("workspace must be an object.");
    var legacyView = raw.activeTab === "map" ? "map" : (raw.activeTab === "costs" || raw.activeTab === "costing" ? "costing" : "overview");
    return {
      app: "uos.remediation",
      schemaVersion: 2,
      events: raw.events,
      referenceData: raw.referenceData || {},
      workspace: raw.workspace || {
        selectedId: raw.selectedId || raw.defaultSelectedId || null,
        view: legacyView,
        map: { provider: "offline" }
      },
      source: raw.source || null,
      legacy: legacy
    };
  }

  function validateReferenceData(raw, warnings) {
    var reference = clone(raw || {});
    ["workDefaults", "workTypes", "materialCatalog", "labourDefaults"].forEach(function (field) {
      if (!hasOwn(reference, field)) return;
      if (!Array.isArray(reference[field])) throw new Error("referenceData." + field + " must be an array.");
      if (reference[field].length > MAX_ROWS) throw new Error("referenceData." + field + " contains more than " + MAX_ROWS + " records.");
    });
    if (Array.isArray(reference.workDefaults)) {
      reference.workDefaults = reference.workDefaults.map(function (row, index) {
        var path = "referenceData.workDefaults[" + index + "]";
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(path + " must be an object.");
        row = clone(row);
        row.rate = importNumber(row.rate, path + ".rate", warnings, { minimum: 0, fallback: 0 });
        row.quotedQuantity = importNumber(row.quotedQuantity, path + ".quotedQuantity", warnings, { minimum: 0, fallback: 0 });
        if (row.dimensionUnit && DIMENSION_UNITS.indexOf(row.dimensionUnit) < 0) throw new Error(path + ".dimensionUnit is unsupported.");
        return row;
      });
    }
    if (Array.isArray(reference.workTypes)) {
      reference.workTypes = reference.workTypes.map(function (row, index) {
        var path = "referenceData.workTypes[" + index + "]";
        if (typeof row === "string") row = { label: row };
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(path + " must be a string or object.");
        row = clone(row);
        row.label = string(row.label || row.key).trim();
        if (!row.label) throw new Error(path + ".label must not be blank.");
        row.key = string(row.key).trim() || slug(row.label);
        row.dimensionUnit = DIMENSION_UNITS.indexOf(row.dimensionUnit) >= 0 ? row.dimensionUnit : "ha";
        if (row.rate !== undefined) row.rate = importNumber(row.rate, path + ".rate", warnings, { minimum: 0, warnMissing: false });
        return row;
      });
    }
    if (Array.isArray(reference.materialCatalog)) {
      reference.materialCatalog.forEach(function (row, index) {
        var path = "referenceData.materialCatalog[" + index + "]";
        if (Array.isArray(row)) {
          if (row.length < 4) warnings.push(path + ": incomplete catalogue row; missing fields remain blank or zero.");
          if (row[3] !== undefined) row[3] = importNumber(row[3], path + "[3]", warnings, { minimum: 0, warnMissing: false });
          return;
        }
        if (!row || typeof row !== "object") throw new Error(path + " must be an object or array.");
        if (hasOwn(row, "unitCost")) row.unitCost = importNumber(row.unitCost, path + ".unitCost", warnings, { minimum: 0, warnMissing: false });
        if (hasOwn(row, "price")) row.price = importNumber(row.price, path + ".price", warnings, { minimum: 0, warnMissing: false });
      });
    }
    if (Array.isArray(reference.labourDefaults)) {
      reference.labourDefaults = reference.labourDefaults.map(function (row, index) {
        var path = "referenceData.labourDefaults[" + index + "]";
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(path + " must be an object.");
        row = clone(row);
        ["workers", "hours", "rate"].forEach(function (field) {
          row[field] = importNumber(row[field], path + "." + field, warnings, { minimum: 0, fallback: 0 });
        });
        return row;
      });
    }
    if (reference.quoteCatalogue !== undefined) {
      if (!reference.quoteCatalogue || typeof reference.quoteCatalogue !== "object" || Array.isArray(reference.quoteCatalogue)) throw new Error("referenceData.quoteCatalogue must be an object.");
      var catalogue = clone(reference.quoteCatalogue);
      catalogue.effectiveDate = string(catalogue.effectiveDate).trim();
      catalogue.sections = importArray(catalogue.sections, "referenceData.quoteCatalogue.sections", warnings, MAX_ROWS).map(function (value) { return string(value).trim(); }).filter(Boolean);
      catalogue.items = importArray(catalogue.items, "referenceData.quoteCatalogue.items", warnings, MAX_ROWS).map(function (item, index) {
        var path = "referenceData.quoteCatalogue.items[" + index + "]";
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(path + " must be an object.");
        item = clone(item);
        item.id = string(item.id) || uuid("quote-catalogue"); item.section = string(item.section).trim(); item.label = string(item.label).trim();
        item.kind = ["allocation", "material", "labour"].indexOf(item.kind) >= 0 ? item.kind : "material";
        item.mode = ["standard", "soil", "labour"].indexOf(item.mode) >= 0 ? item.mode : "standard";
        item.rate = importNumber(item.rate, path + ".rate", warnings, { minimum: 0, fallback: 0 });
        item.active = item.active !== false; item.supplier = string(item.supplier); item.unit = string(item.unit);
        item.sourceRow = importNumber(item.sourceRow, path + ".sourceRow", warnings, { minimum: 0, fallback: 0, warnMissing: false });
        if (item.mode === "soil") item.density = importNumber(item.density, path + ".density", warnings, { minimum: 0, fallback: 1.6, warnMissing: false });
        if (!item.label || !item.section) throw new Error(path + " requires a label and section.");
        return item;
      });
      if (catalogue.source !== undefined && (!catalogue.source || typeof catalogue.source !== "object" || Array.isArray(catalogue.source))) throw new Error("referenceData.quoteCatalogue.source must be an object.");
      reference.quoteCatalogue = catalogue;
    }
    if (reference.mapCenter !== undefined && !coordinateValid(reference.mapCenter)) throw new Error("referenceData.mapCenter must contain valid finite longitude and latitude numbers.");
    return reference;
  }

  function normalizeWorkspace(raw, events, warnings) {
    var workspace = clone(raw || {});
    workspace.selectedId = string(workspace.selectedId) || (events[0] ? events[0].id : null);
    if (workspace.selectedId && !events.some(function (event) { return event.id === workspace.selectedId; })) {
      warnings.push("workspace.selectedId did not match an imported event; the first event was selected.");
      workspace.selectedId = events[0] ? events[0].id : null;
    }
    if (["overview", "costing", "quote", "catalogue", "catalogueTable", "map", "scheduler"].indexOf(workspace.view) < 0) {
      if (workspace.view !== undefined) warnings.push("workspace.view was unsupported and replaced with overview.");
      workspace.view = "overview";
    }
    if (["summary", "itemised"].indexOf(workspace.quoteMode) < 0) workspace.quoteMode = "summary";
    if (workspace.scheduler !== undefined && (!workspace.scheduler || typeof workspace.scheduler !== "object" || Array.isArray(workspace.scheduler))) throw new Error("workspace.scheduler must be an object.");
    workspace.scheduler = Object.assign({ weekStart: "", sort: "date", filters: { category: "", status: "", crew: "" }, selectedId: null, listScrollTop: 0 }, workspace.scheduler || {});
    if (workspace.scheduler.weekStart && !isISODate(workspace.scheduler.weekStart)) throw new Error("workspace.scheduler.weekStart must be a valid ISO date.");
    if (["date", "priority", "id"].indexOf(workspace.scheduler.sort) < 0) workspace.scheduler.sort = "date";
    if (!workspace.scheduler.filters || typeof workspace.scheduler.filters !== "object" || Array.isArray(workspace.scheduler.filters)) throw new Error("workspace.scheduler.filters must be an object.");
    if (workspace.inspectorWidth !== undefined) workspace.inspectorWidth = importNumber(workspace.inspectorWidth, "workspace.inspectorWidth", warnings, { minimum: 320, maximum: 440, warnMissing: false });
    if (workspace.inspectorOpen !== undefined && typeof workspace.inspectorOpen !== "boolean") throw new Error("workspace.inspectorOpen must be a boolean.");
    if (workspace.costSegment !== undefined && ["materials", "labour"].indexOf(workspace.costSegment) < 0) {
      warnings.push("workspace.costSegment was unsupported and replaced with materials.");
      workspace.costSegment = "materials";
    }
    if (workspace.costSections !== undefined && (!workspace.costSections || typeof workspace.costSections !== "object" || Array.isArray(workspace.costSections))) throw new Error("workspace.costSections must be an object.");
    workspace.costSections = Object.assign({ materials: true, labour: true }, workspace.costSections || {});
    ["materials", "labour"].forEach(function (section) {
      if (typeof workspace.costSections[section] !== "boolean") throw new Error("workspace.costSections." + section + " must be a boolean.");
    });
    if (workspace.map !== undefined && (!workspace.map || typeof workspace.map !== "object" || Array.isArray(workspace.map))) throw new Error("workspace.map must be an object.");
    workspace.map = Object.assign({ provider: "offline" }, workspace.map || {});
    workspace.map.provider = string(workspace.map.provider) || "offline";
    if (workspace.map.center !== undefined && !coordinateValid(workspace.map.center)) throw new Error("workspace.map.center must contain valid finite longitude and latitude numbers.");
    if (workspace.map.zoom !== undefined) workspace.map.zoom = importNumber(workspace.map.zoom, "workspace.map.zoom", warnings, { minimum: 0, maximum: 24, warnMissing: false });
    ["showLabels", "showAngles", "showEdges", "showIndex"].forEach(function (field) {
      if (workspace.map[field] !== undefined && typeof workspace.map[field] !== "boolean") throw new Error("workspace.map." + field + " must be a boolean.");
      if (workspace.map[field] === undefined) workspace.map[field] = true;
    });
    if (workspace.map.showSelectedOnly !== undefined && typeof workspace.map.showSelectedOnly !== "boolean") throw new Error("workspace.map.showSelectedOnly must be a boolean.");
    if (workspace.map.showSelectedOnly === undefined) workspace.map.showSelectedOnly = false;
    return workspace;
  }

  function validateWorkspaceLimits(events, referenceData) {
    if (!Array.isArray(events)) throw new Error("Workspace events must be an array.");
    if (events.length > MAX_EVENTS) throw new Error("The resulting workspace would contain more than " + MAX_EVENTS + " events.");
    var shapeCount = 0;
    var coordinateCount = 0;
    events.forEach(function (event, eventIndex) {
      if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("Event " + (eventIndex + 1) + " must be an object.");
      ["statusRecords", "allocations", "materials", "labour", "jobs"].forEach(function (field) {
        if (event[field] !== undefined && !Array.isArray(event[field])) throw new Error("Event " + (eventIndex + 1) + " " + field + " must be an array.");
        if ((event[field] || []).length > MAX_ROWS) throw new Error("Event " + (eventIndex + 1) + " " + field + " contains more than " + MAX_ROWS + " records.");
      });
      if (event.polygons !== undefined && !Array.isArray(event.polygons)) throw new Error("Event " + (eventIndex + 1) + " polygons must be an array.");
      if (event.quote && Array.isArray(event.quote.lines) && event.quote.lines.length > MAX_ROWS) throw new Error("Event " + (eventIndex + 1) + " quote contains more than " + MAX_ROWS + " lines.");
      var shapes = event.polygons || [];
      if (shapes.length > MAX_SHAPES) throw new Error("Event " + (eventIndex + 1) + " contains more than " + MAX_SHAPES + " shapes.");
      shapeCount += shapes.length;
      shapes.forEach(function (shape, shapeIndex) {
        if (!shape || typeof shape !== "object" || Array.isArray(shape)) throw new Error("Event " + (eventIndex + 1) + " shape " + (shapeIndex + 1) + " must be an object.");
        if (shape.coordinates !== undefined && !Array.isArray(shape.coordinates)) throw new Error("Event " + (eventIndex + 1) + " shape " + (shapeIndex + 1) + " coordinates must be an array.");
        var coordinates = shape.coordinates || [];
        if (coordinates.length > MAX_COORDINATES) throw new Error("Event " + (eventIndex + 1) + " shape " + (shapeIndex + 1) + " contains more than " + MAX_COORDINATES + " coordinates.");
        coordinateCount += coordinates.length;
      });
    });
    if (referenceData !== undefined) {
      if (!referenceData || typeof referenceData !== "object" || Array.isArray(referenceData)) throw new Error("referenceData must be an object.");
      ["workDefaults", "workTypes", "materialCatalog", "labourDefaults"].forEach(function (field) {
        if (referenceData[field] !== undefined && !Array.isArray(referenceData[field])) throw new Error("referenceData." + field + " must be an array.");
        if ((referenceData[field] || []).length > MAX_ROWS) throw new Error("referenceData." + field + " contains more than " + MAX_ROWS + " records.");
      });
    }
    return { events: events.length, shapes: shapeCount, coordinates: coordinateCount };
  }

  function regenerateDuplicateIds(events, warnings) {
    var eventIds = new Set();
    var collections = [
      { field: "statusRecords", label: "status record", prefix: "status-record" },
      { field: "allocations", label: "allocation", prefix: "allocation" },
      { field: "materials", label: "material", prefix: "material" },
      { field: "labour", label: "labour", prefix: "labour" },
      { field: "polygons", label: "shape", prefix: "shape" },
      { field: "jobs", label: "job", prefix: "job" }
    ];
    var nested = { statusRecords: new Set(), allocations: new Set(), materials: new Set(), labour: new Set(), polygons: new Set(), jobs: new Set() };
    var taskIds = new Set();
    events.forEach(function (event, eventIndex) {
      if (eventIds.has(event.id)) {
        var duplicateEventId = event.id;
        event.id = uuid("event");
        warnings.push('Event ' + (eventIndex + 1) + ': duplicate event ID "' + duplicateEventId + '" was regenerated.');
      }
      eventIds.add(event.id);
      collections.forEach(function (collection) {
        event[collection.field].forEach(function (row, rowIndex) {
          if (nested[collection.field].has(row.id)) {
            var duplicateId = row.id;
            row.id = uuid(collection.prefix);
            warnings.push('Event ' + (eventIndex + 1) + " " + collection.label + " " + (rowIndex + 1) + ': duplicate nested ID "' + duplicateId + '" was regenerated.');
          }
          nested[collection.field].add(row.id);
        });
      });
      (event.jobs || []).forEach(function (job) {
        (job.tasks || []).forEach(function (task) {
          if (taskIds.has(task.id)) {
            var duplicateTaskId = task.id;
            task.id = uuid("task");
            warnings.push('Event ' + (eventIndex + 1) + ': duplicate task ID "' + duplicateTaskId + '" was regenerated.');
          }
          taskIds.add(task.id);
        });
      });
      validateJobLinks(event);
    });
  }

  function prepareImport(raw) {
    var envelope = envelopeFrom(raw);
    var warnings = [];
    var events = envelope.events.map(function (event, index) {
      return normalizeEvent(event, warnings, index, { legacy: envelope.legacy });
    });
    regenerateDuplicateIds(events, warnings);
    envelope.events = events;
    envelope.referenceData = validateReferenceData(envelope.referenceData, warnings);
    validateWorkspaceLimits(envelope.events, envelope.referenceData);
    envelope.workspace = normalizeWorkspace(envelope.workspace, events, warnings);
    return { envelope: envelope, warnings: warnings };
  }

  function canonicalEvent(event) {
    var copy = clone(event);
    delete copy.id;
    delete copy._validation;
    (copy.allocations || []).forEach(function (row) { delete row.id; delete row.total; });
    (copy.statusRecords || []).forEach(function (row) { delete row.id; });
    (copy.materials || []).forEach(function (row) { delete row.id; });
    (copy.labour || []).forEach(function (row) { delete row.id; });
    (copy.jobs || []).forEach(function (job) {
      delete job.id;
      (job.tasks || []).forEach(function (task) { delete task.id; });
    });
    (copy.polygons || []).forEach(function (row) {
      delete row.id;
      delete row.createdAt;
      delete row.copiedFrom;
      delete row.valid;
      delete row.validationMessage;
      delete row.areaSqM;
      delete row.lengthM;
    });
    return JSON.stringify(stableValue(copy));
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce(function (output, key) {
      output[key] = stableValue(value[key]);
      return output;
    }, {});
  }

  function importStats(prepared, currentEvents) {
    var byId = new Map(currentEvents.map(function (event) { return [event.id, event]; }));
    var fingerprints = new Set(currentEvents.map(canonicalEvent));
    var exact = 0;
    var collisions = 0;
    prepared.envelope.events.forEach(function (event) {
      var fingerprint = canonicalEvent(event);
      if (fingerprints.has(fingerprint)) exact += 1;
      else if (byId.has(event.id)) collisions += 1;
    });
    return { records: prepared.envelope.events.length, warnings: prepared.warnings.length, exactDuplicates: exact, idCollisions: collisions };
  }

  function mergeEvents(currentEvents, incomingEvents) {
    var merged = currentEvents.map(clone);
    var byId = new Map(merged.map(function (event) { return [event.id, event]; }));
    var fingerprints = new Set(merged.map(canonicalEvent));
    var nested = {
      statusRecords: new Set(), allocations: new Set(), materials: new Set(), labour: new Set(), polygons: new Set(), jobs: new Set()
    };
    var taskIds = new Set();
    merged.forEach(function (event) {
      Object.keys(nested).forEach(function (field) { (event[field] || []).forEach(function (row) { nested[field].add(row.id); }); });
      (event.jobs || []).forEach(function (job) { (job.tasks || []).forEach(function (task) { taskIds.add(task.id); }); });
    });
    var skipped = 0;
    var regenerated = 0;
    incomingEvents.forEach(function (incoming) {
      var event = clone(incoming);
      var fingerprint = canonicalEvent(event);
      if (fingerprints.has(fingerprint)) { skipped += 1; return; }
      var existing = byId.get(event.id);
      if (existing) {
        regenerateNestedIds(event);
        regenerated += 1;
      } else {
        var eventRegenerated = false;
        var regeneratedSources = new Map();
        var regeneratedJobs = new Map();
        Object.keys(nested).forEach(function (field) {
          (event[field] || []).forEach(function (row) {
            if (!nested[field].has(row.id)) return;
            var oldId = row.id;
            row.id = uuid(field === "statusRecords" ? "status-record" : field === "polygons" ? "shape" : field === "allocations" ? "allocation" : field === "materials" ? "material" : field === "jobs" ? "job" : "labour");
            if (["allocations", "materials", "labour"].indexOf(field) >= 0) regeneratedSources.set((field === "allocations" ? "allocation" : field === "materials" ? "material" : "labour") + ":" + oldId, row.id);
            if (field === "jobs") regeneratedJobs.set(oldId, row.id);
            eventRegenerated = true;
          });
        });
        if (event.quote && Array.isArray(event.quote.lines)) event.quote.lines.forEach(function (line) { line.sourceId = regeneratedSources.get(line.sourceType + ":" + line.sourceId) || line.sourceId; });
        (event.jobs || []).forEach(function (job) {
          job.costingLineRefs.forEach(function (reference) { reference.id = regeneratedSources.get(reference.type + ":" + reference.id) || reference.id; });
          (job.tasks || []).forEach(function (task) {
            task.costingLineRefs.forEach(function (reference) { reference.id = regeneratedSources.get(reference.type + ":" + reference.id) || reference.id; });
            if (taskIds.has(task.id)) { task.id = uuid("task"); eventRegenerated = true; }
          });
        });
        ["allocations", "materials", "labour"].forEach(function (field) { (event[field] || []).forEach(function (row) { row.jobId = regeneratedJobs.get(row.jobId) || row.jobId; }); });
        if (eventRegenerated) regenerated += 1;
      }
      merged.push(event);
      byId.set(event.id, event);
      fingerprints.add(fingerprint);
      Object.keys(nested).forEach(function (field) { (event[field] || []).forEach(function (row) { nested[field].add(row.id); }); });
      (event.jobs || []).forEach(function (job) { (job.tasks || []).forEach(function (task) { taskIds.add(task.id); }); });
    });
    validateWorkspaceLimits(merged);
    return { events: merged, skipped: skipped, regenerated: regenerated };
  }

  function regenerateNestedIds(event) {
    event.id = uuid("event");
    event.statusRecords.forEach(function (row) { row.id = uuid("status-record"); });
    var sourceIds = new Map();
    event.allocations.forEach(function (row) { var old = row.id; row.id = uuid("allocation"); sourceIds.set("allocation:" + old, row.id); });
    event.materials.forEach(function (row) { var old = row.id; row.id = uuid("material"); sourceIds.set("material:" + old, row.id); });
    event.labour.forEach(function (row) { var old = row.id; row.id = uuid("labour"); sourceIds.set("labour:" + old, row.id); });
    var jobIds = new Map();
    (event.jobs || []).forEach(function (job) {
      var oldJobId = job.id;
      job.id = uuid("job");
      jobIds.set(oldJobId, job.id);
      job.sourceEventId = event.id;
      job.costingLineRefs.forEach(function (reference) { reference.id = sourceIds.get(reference.type + ":" + reference.id) || reference.id; });
      (job.tasks || []).forEach(function (task) {
        task.id = uuid("task");
        task.costingLineRefs.forEach(function (reference) { reference.id = sourceIds.get(reference.type + ":" + reference.id) || reference.id; });
      });
    });
    ["allocations", "materials", "labour"].forEach(function (field) { event[field].forEach(function (row) { row.jobId = jobIds.get(row.jobId) || row.jobId; }); });
    if (event.quote && Array.isArray(event.quote.lines)) event.quote.lines.forEach(function (row) { row.id = uuid("quote-line"); row.sourceId = sourceIds.get(row.sourceType + ":" + row.sourceId) || row.sourceId; });
    event.polygons.forEach(function (row) { row.id = uuid("shape"); });
    return event;
  }

  function duplicateEvent(event) {
    var copy = regenerateNestedIds(clone(event));
    copy.eventName = string(event.eventName) ? string(event.eventName) + " — copy" : "";
    copy.source = Object.assign({}, copy.source || {}, { copiedFrom: event.id, copiedAt: new Date().toISOString() });
    return copy;
  }

  function projectedSquare(first, second) {
    if (!coordinateValid(first) || !coordinateValid(second)) return [];
    var origin = first;
    var b = localPoint(second, origin);
    var dx = b.x;
    var dy = b.y;
    if (Math.hypot(dx, dy) === 0) return [];
    var perpendicular = { x: -dy, y: dx };
    return [first.slice(), second.slice(), fromLocal({ x: b.x + perpendicular.x, y: b.y + perpendicular.y }, origin), fromLocal(perpendicular, origin)];
  }

  UOS.RemediationModel = {
    DIMENSION_UNITS: DIMENSION_UNITS.slice(),
    KNOWN_STATUSES: KNOWN_STATUSES.slice(),
    JOB_STATUSES: JOB_STATUSES.slice(),
    LIMITS: { events: MAX_EVENTS, rows: MAX_ROWS, shapes: MAX_SHAPES, coordinatesPerShape: MAX_COORDINATES, maximumMoney: MAX_MONEY },
    blankEnvelope: blankEnvelope,
    blankEvent: blankEvent,
    clone: clone,
    finite: finite,
    nonNegative: nonNegative,
    clamp: clamp,
    roundMoney: roundMoney,
    normalizeEvent: normalizeEvent,
    normalizeShape: normalizeShape,
    canonicalStatus: canonicalStatus,
    canonicalJobStatus: canonicalJobStatus,
    canonicalSeason: canonicalSeason,
    isISODate: isISODate,
    latestStatusRecord: latestStatusRecord,
    syncEventStatus: syncEventStatus,
    prepareImport: prepareImport,
    validateWorkspaceLimits: validateWorkspaceLimits,
    importStats: importStats,
    mergeEvents: mergeEvents,
    duplicateEvent: duplicateEvent,
    recalculate: recalculate,
    totals: totals,
    promoteEventToJob: promoteEventToJob,
    assignCostingLines: assignCostingLines,
    addJobTask: addJobTask,
    completeJob: completeJob,
    completeJobTask: completeJobTask,
    jobFinances: jobFinances,
    refreshJobEstimates: refreshJobEstimates,
    validateJobLinks: validateJobLinks,
    allocationContext: allocationContext,
    allocationMappedQuantity: allocationMappedQuantity,
    allocationQuantity: allocationQuantity,
    coordinateValid: coordinateValid,
    metresBetween: metresBetween,
    polygonAreaSqM: polygonAreaSqM,
    lineLength: lineLength,
    coordinateMidpoint: coordinateMidpoint,
    polygonCentroid: polygonCentroid,
    vertexAngleDegrees: vertexAngleDegrees,
    geometryMeasurements: geometryMeasurements,
    formatLength: formatLength,
    formatArea: formatArea,
    formatAngle: formatAngle,
    selfIntersects: selfIntersects,
    repairPolygon: repairPolygon,
    shapeValidation: shapeValidation,
    refreshShape: refreshShape,
    projectedSquare: projectedSquare,
    uuid: uuid,
    slug: slug
  };
})();
