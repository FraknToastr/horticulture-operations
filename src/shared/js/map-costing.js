(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var EARTH_RADIUS_M = 6371008.8;

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function finite(value) { var parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
  function nonNegative(value, label, fallback) {
    var parsed = finite(value);
    if (parsed == null) return fallback == null ? 0 : fallback;
    if (parsed < 0) throw new Error(label + " must be a non-negative number.");
    return parsed;
  }
  function radians(value) { return Number(value) * Math.PI / 180; }
  function coordinate(value) {
    return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
  }
  function distance(first, second) {
    var latitudeDelta = radians(second[1] - first[1]);
    var longitudeDelta = radians(second[0] - first[0]);
    var latitudeOne = radians(first[1]);
    var latitudeTwo = radians(second[1]);
    var half = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(half), Math.sqrt(1 - half));
  }
  function ringLength(ring) {
    if (!Array.isArray(ring) || ring.length < 2 || !ring.every(coordinate)) return 0;
    var total = 0;
    for (var index = 1; index < ring.length; index += 1) total += distance(ring[index - 1], ring[index]);
    if (ring.length > 2 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) total += distance(ring[ring.length - 1], ring[0]);
    return total;
  }
  function ringArea(ring) {
    if (!Array.isArray(ring) || ring.length < 3 || !ring.every(coordinate)) return 0;
    var latitude = ring.reduce(function (sum, point) { return sum + Number(point[1]); }, 0) / ring.length;
    var scaleX = Math.cos(radians(latitude)) * Math.PI * EARTH_RADIUS_M / 180;
    var scaleY = Math.PI * EARTH_RADIUS_M / 180;
    var sum = 0;
    for (var index = 0; index < ring.length; index += 1) {
      var next = ring[(index + 1) % ring.length];
      sum += Number(ring[index][0]) * scaleX * Number(next[1]) * scaleY - Number(next[0]) * scaleX * Number(ring[index][1]) * scaleY;
    }
    return Math.abs(sum / 2);
  }
  function polygonMetrics(rings) {
    if (!Array.isArray(rings) || !rings.length) return { areaSqM: 0, lengthM: 0 };
    var area = ringArea(rings[0]);
    var length = ringLength(rings[0]);
    rings.slice(1).forEach(function (ring) { area -= ringArea(ring); length += ringLength(ring); });
    return { areaSqM: Math.max(0, area), lengthM: length };
  }
  function geoJsonMetrics(geometry) {
    if (!object(geometry)) return { areaSqM: 0, lengthM: 0 };
    if (geometry.type === "Polygon") return polygonMetrics(geometry.coordinates);
    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      return geometry.coordinates.reduce(function (total, polygon) {
        var value = polygonMetrics(polygon);
        total.areaSqM += value.areaSqM;
        total.lengthM += value.lengthM;
        return total;
      }, { areaSqM: 0, lengthM: 0 });
    }
    if (geometry.type === "LineString") return { areaSqM: 0, lengthM: ringLength(geometry.coordinates) };
    if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
      return { areaSqM: 0, lengthM: geometry.coordinates.reduce(function (total, line) { return total + ringLength(line); }, 0) };
    }
    return { areaSqM: 0, lengthM: 0 };
  }
  function assertGeometry(entity) {
    if (!object(entity) || entity.type !== "geometry" || !text(entity.id)) throw new Error("A canonical geometry entity is required.");
    if (entity.owner !== "NSA" && entity.owner !== "EVT") throw new Error("Geometry owner must be NSA or EVT.");
    var payload = object(entity.payload) ? entity.payload : {};
    var geometryType = object(entity.geometry) ? text(entity.geometry.type) : "";
    var normalizedType = { polygon: "Polygon", multipolygon: "MultiPolygon", line: "LineString", linestring: "LineString", multilinestring: "MultiLineString" }[geometryType.toLowerCase()];
    if (normalizedType) { entity.geometry.type = normalizedType; geometryType = normalizedType; }
    if (geometryType === "Polygon" && Array.isArray(entity.geometry.coordinates) && Array.isArray(entity.geometry.coordinates[0]) && typeof entity.geometry.coordinates[0][0] === "number") {
      entity.geometry.coordinates = [entity.geometry.coordinates];
    }
    if (["Polygon", "MultiPolygon", "LineString", "MultiLineString"].indexOf(geometryType) < 0) {
      var kind = text(entity.geometryKind || payload.geometryType).toLowerCase();
      var coordinates = object(entity.geometry) && Array.isArray(entity.geometry.coordinates) ? entity.geometry.coordinates : (Array.isArray(entity.coordinates) ? entity.coordinates : payload.coordinates);
      if ((kind === "polygon" || kind === "line") && Array.isArray(coordinates)) {
        geometryType = kind === "line" ? "LineString" : "Polygon";
        if (geometryType === "Polygon" && Array.isArray(coordinates[0]) && typeof coordinates[0][0] === "number") coordinates = [coordinates];
        entity.geometry = { type: geometryType, coordinates: coordinates };
      }
    }
    if (["Polygon", "MultiPolygon", "LineString", "MultiLineString"].indexOf(geometryType) < 0) throw new Error("Only polygon and line geometries can create mapped costing lines.");
    if (payload.valid === false) throw new Error("Invalid geometries cannot create mapped costing lines.");
    return entity;
  }
  function measurements(entity, inputs) {
    entity = assertGeometry(entity);
    inputs = object(inputs) ? inputs : {};
    var payload = object(entity.payload) ? entity.payload : {};
    var calculated = geoJsonMetrics(entity.geometry);
    var areaSqM = nonNegative(inputs.areaSqM, "areaSqM", nonNegative(payload.areaSqM, "areaSqM", calculated.areaSqM));
    var lengthM = nonNegative(inputs.lengthM, "lengthM", nonNegative(payload.lengthM, "lengthM", calculated.lengthM));
    var depthM = nonNegative(inputs.depthM, "depthM");
    var densityKgM3 = nonNegative(inputs.densityKgM3, "densityKgM3");
    var volumeM3 = nonNegative(inputs.volumeM3, "volumeM3", areaSqM * depthM);
    var massKg = nonNegative(inputs.massKg, "massKg", volumeM3 * densityKgM3);
    return {
      sourceGeometryId: entity.id,
      areaSqM: areaSqM,
      lengthM: lengthM,
      depthM: depthM,
      volumeM3: volumeM3,
      densityKgM3: densityKgM3,
      massKg: massKg,
      hours: nonNegative(inputs.hours, "hours"),
      workers: nonNegative(inputs.workers, "workers", 1),
      quantity: nonNegative(inputs.quantity, "quantity")
    };
  }
  function source(entity, at) {
    var provenance = object(entity.provenance) ? entity.provenance : {};
    return {
      owner: entity.owner,
      sourceApp: "uos.space-map",
      sourceVersion: 1,
      sourceId: text(provenance.sourceId || provenance.legacyId || entity.id),
      importedAt: text(at)
    };
  }
  function createLine(rateItem, geometryEntity, inputs, options) {
    if (!UOS.rateLibrary || typeof UOS.rateLibrary.calculateLine !== "function") throw new Error("UOS.rateLibrary must load before UOS.mapCosting.");
    geometryEntity = assertGeometry(geometryEntity);
    if (!object(rateItem)) throw new Error("A rate item is required.");
    options = object(options) ? options : {};
    var measured = measurements(geometryEntity, inputs);
    var line = UOS.rateLibrary.calculateLine(rateItem, measured, {
      id: options.id,
      owner: options.owner || geometryEntity.owner,
      discriminator: options.discriminator,
      sourceGeometryId: geometryEntity.id
    });
    line.jobId = null;
    line.assignmentState = "Unassigned";
    line.eventId = text(options.eventId || geometryEntity.eventId) || null;
    line.projectId = text(options.projectId || geometryEntity.projectId) || null;
    line.applicationId = text(options.applicationId || geometryEntity.applicationId) || null;
    line.provenance = source(geometryEntity, options.createdAt);
    line.calculation = { quantityKind: line.calculation.quantityKind, inputs: clone(measured) };
    return line;
  }
  function createLines(rateItems, requests, geometries) {
    var rates = {}, shapes = {};
    (rateItems || []).forEach(function (item) { rates[text(item.id)] = item; });
    (geometries || []).forEach(function (item) { shapes[text(item.id)] = item; });
    return (requests || []).map(function (request, index) {
      if (!object(request) || !rates[text(request.rateItemId)]) throw new Error("Mapped costing request " + (index + 1) + " references an unknown rate item.");
      if (!shapes[text(request.sourceGeometryId)]) throw new Error("Mapped costing request " + (index + 1) + " references an unknown geometry.");
      return createLine(rates[text(request.rateItemId)], shapes[text(request.sourceGeometryId)], request.measurements, request);
    });
  }

  UOS.mapCosting = {
    version: 1,
    measurements: measurements,
    createLine: createLine,
    createLines: createLines
  };
}());
