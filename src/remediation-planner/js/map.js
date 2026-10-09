(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var Model = UOS.RemediationModel;

  function resolveCameraTarget(event, coordinateValid, homeCenter, homeZoom) {
    event = event || {};
    var valid = typeof coordinateValid === "function" ? coordinateValid : function (coordinate) {
      return Array.isArray(coordinate) && coordinate.length >= 2 && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1]));
    };
    var geometryCoordinates = [];
    (event.polygons || []).forEach(function (shape) {
      (shape.coordinates || []).forEach(function (coordinate) {
        if (valid(coordinate)) geometryCoordinates.push(coordinate);
      });
    });
    if (geometryCoordinates.length) return { kind: "geometry", coordinates: geometryCoordinates };
    var focusLocations = Array.isArray(event.focusLocations) ? event.focusLocations : (Array.isArray(event.locations) ? event.locations : (event.location ? [event.location] : []));
    var pins = focusLocations.filter(function (location) { return location && location.visible !== false && valid(location.coordinate); });
    if (pins.length === 1) return { kind: "pin", coordinate: pins[0].coordinate };
    if (pins.length > 1) return { kind: "pins", coordinates: pins.map(function (location) { return location.coordinate; }) };
    return { kind: "home", center: homeCenter.slice(0, 2), zoom: homeZoom };
  }

  function create(options) {
    options = options || {};
    var root = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : global);
    var config = (root && root.UOS_REMEDIATION_MAP_CONFIG) || (typeof window !== "undefined" && window.UOS_REMEDIATION_MAP_CONFIG) || { defaultProvider: "offline", defaultCenter: [138.6014, -34.9214], defaultZoom: 14, providers: [] };
    var maplibregl = options.maplibregl || (root && root.maplibregl) || (typeof window !== "undefined" && window.maplibregl) || (typeof maplibregl !== "undefined" ? maplibregl : null);
    var Model = options.model || (root && root.UOS && root.UOS.RemediationModel) || (root && root.UOS && root.UOS.ProgramModel) || Model;
    var container = typeof options.container === "string" ? document.getElementById(options.container) : options.container;
    var map = null;
    var ready = false;
    var currentEvent = null;
    var selectedShapeId = null;
    var editingShapeId = null;
    var selectedVertexIndex = null;
    var draggingVertexIndex = null;
    var dragMoved = false;
    var transformShapeId=null,transformCallback=null,transformCentre=null,transformLastCoordinate=null,rotationHandle=null,rotatingHandle=false,lastRotationAngle=0;
    var suppressClick = false;
    var drawing = null;
    var previewCoordinate = null;
    var providerFailureShown = false;
    var activeProviderId = "offline";
    var pendingProviderId = null;
    var providerLoadTimer = null;
    var initializationTimer = null;
    var destroyed = false;
    var measurementMarkers = [], placingLocation = false;
    var locationMarkers=[],showLocationNumbers=true;
    var labelPlacements = [];
    var showLengthLabels = false;
    var showAreaLabel = true;
    var showMeasurementAngles = false;
    var showEdges = false;
    var showIndex = true;
    var showSelectedOnly = false;
    var MAX_MEASUREMENT_LABELS = 120;

    function animDuration(fallback) {
      try {
        var win = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
        return win && win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : (Number.isFinite(fallback) ? fallback : 300);
      } catch (_) {
        return Number.isFinite(fallback) ? fallback : 300;
      }
    }

    function themeColor(name, fallback) {
      try {
        var win = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
        var doc = win && win.document ? win.document : (typeof document !== "undefined" ? document : null);
        var cs = typeof getComputedStyle === "function" ? getComputedStyle(doc && doc.documentElement) : (win && typeof win.getComputedStyle === "function" && doc ? win.getComputedStyle(doc.documentElement) : null);
        var value = cs && typeof cs.getPropertyValue === "function" ? cs.getPropertyValue(name).trim() : "";
        return value || fallback;
      } catch (_) {
        return fallback;
      }
    }

    function offlineStyle() {
      return {
        version: 8,
        name: "Offline coordinate grid",
        sources: {},
        layers: [{
          id: "uos-offline-background",
          type: "background",
          paint: { "background-color": themeColor("--uos-surface-muted", "#f7f9fd") }
        }]
      };
    }

    function workspaceMap() {
      var workspace = typeof options.getWorkspaceMap === "function" ? options.getWorkspaceMap() : {};
      return workspace && typeof workspace === "object" ? workspace : {};
    }

    function validCenter(value) {
      return Model.coordinateValid(value) ? [Number(value[0]), Number(value[1])] : [0, 0];
    }

    function initialCenter() {
      var workspace = workspaceMap();
      if (Model.coordinateValid(workspace.center)) return validCenter(workspace.center);
      if (currentEvent && Array.isArray(currentEvent.polygons)) {
        for (var shapeIndex = 0; shapeIndex < currentEvent.polygons.length; shapeIndex += 1) {
          var coordinate = currentEvent.polygons[shapeIndex].coordinates && currentEvent.polygons[shapeIndex].coordinates[0];
          if (Model.coordinateValid(coordinate)) return validCenter(coordinate);
        }
      }
      return (Array.isArray(config.defaultCenter) && config.defaultCenter.length >= 2) ? config.defaultCenter.slice(0, 2) : [138.6014, -34.9214];
    }

    function resetView() {
      
      if (!map) return;
      var center = (Array.isArray(config.defaultCenter) && config.defaultCenter.length >= 2) ? config.defaultCenter.slice(0, 2) : [138.6014, -34.9214];
      var zoom = Number.isFinite(Number(config.defaultZoom)) ? Number(config.defaultZoom) : 14;
      var duration = animDuration(300);
      map.easeTo({ center: center, zoom: zoom, duration: duration });
    }

    function providerById(id) {
      return (Array.isArray(config.providers) ? config.providers : []).find(function (provider) { return provider && provider.id === id; }) || null;
    }

    function timeoutValue(value, fallback) {
      var parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 1000 ? Math.min(parsed, 60000) : fallback;
    }

    function clearProviderLoadTimer() {
      clearTimeout(providerLoadTimer);
      providerLoadTimer = null;
    }

    function clearInitializationTimer() {
      clearTimeout(initializationTimer);
      initializationTimer = null;
    }

    function gridStep(zoom) {
      if (zoom < 3) return 20;
      if (zoom < 7) return 2;
      if (zoom < 11) return 0.2;
      if (zoom < 15) return 0.02;
      return 0.002;
    }

    function gridFeatures() {
      if (!map) return { type: "FeatureCollection", features: [] };
      var center = map.getCenter();
      var step = gridStep(map.getZoom());
      var longitude = Math.floor(center.lng / step) * step;
      var latitude = Math.floor(center.lat / step) * step;
      var span = step * 12;
      var features = [];
      for (var offset = -12; offset <= 12; offset += 1) {
        var x = longitude + offset * step;
        var y = Math.max(-89, Math.min(89, latitude + offset * step));
        if (x >= -180 && x <= 180) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[x, Math.max(-89, latitude - span)], [x, Math.min(89, latitude + span)]] } });
        features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[Math.max(-180, longitude - span), y], [Math.min(180, longitude + span), y]] } });
      }
      return { type: "FeatureCollection", features: features };
    }

    function shapeFeatures() {
      if (!currentEvent) return { type: "FeatureCollection", features: [] };
      var features = [];
      currentEvent.polygons.forEach(function (shape) {
        Model.refreshShape(shape);
        if (showSelectedOnly && shape.id !== selectedShapeId) return;
        if (shape.visible === false || !Array.isArray(shape.coordinates) || !shape.coordinates.every(Model.coordinateValid)) return;
        if (shape.geometryType === "line" && shape.coordinates.length >= 2) {
          features.push({
            type: "Feature",
            properties: { id: shape.id, valid: shape.valid, selected: shape.id === selectedShapeId, geometryType: "line" },
            geometry: { type: "LineString", coordinates: shape.closed ? shape.coordinates.concat([shape.coordinates[0]]) : shape.coordinates }
          });
          return;
        }
        if (shape.geometryType === "polygon" && shape.coordinates.length >= 3) {
          features.push({
            type: "Feature",
            properties: { id: shape.id, valid: shape.valid, selected: shape.id === selectedShapeId, geometryType: "polygon" },
            geometry: { type: "Polygon", coordinates: [shape.coordinates.concat([shape.coordinates[0]])] }
          });
        }
      });
      return { type: "FeatureCollection", features: features };
    }

    function draftCoordinates() {
      if (!drawing) return [];
      if (drawing.mode === "square" && drawing.coordinates.length >= 2) return Model.projectedSquare(drawing.coordinates[0], drawing.coordinates[1]);
      var coordinates = drawing.coordinates.slice();
      if (previewCoordinate) coordinates.push(previewCoordinate);
      return coordinates;
    }

    function draftFeatures() {
      var coordinates = draftCoordinates();
      var features = [];
      if (!drawing || !coordinates.length) return { type: "FeatureCollection", features: [] };
      if (drawing.mode === "square" && coordinates.length === 4) {
        features.push({ type: "Feature", properties: { geometryType: "polygon" }, geometry: { type: "Polygon", coordinates: [coordinates.concat([coordinates[0]])] } });
      } else {
        features.push({ type: "Feature", properties: { geometryType: "line" }, geometry: { type: "LineString", coordinates: coordinates } });
      }
      drawing.coordinates.forEach(function (coordinate, index) {
        features.push({ type: "Feature", properties: { index: index }, geometry: { type: "Point", coordinates: coordinate } });
      });
      return { type: "FeatureCollection", features: features };
    }

    function editFeatures() {
      if (!currentEvent || !editingShapeId) return { type: "FeatureCollection", features: [] };
      var shape = currentEvent.polygons.find(function (candidate) { return candidate.id === editingShapeId; });
      if (!shape) return { type: "FeatureCollection", features: [] };
      return {
        type: "FeatureCollection",
        features: (shape.coordinates || []).map(function (coordinate, index) {
          if (!Model.coordinateValid(coordinate)) return null;
          return { type: "Feature", properties: { index: index, selected: index === selectedVertexIndex }, geometry: { type: "Point", coordinates: coordinate } };
        }).filter(Boolean)
      };
    }

    function locationFeatures() {
      var locations = currentEvent && Array.isArray(currentEvent.locations) ? currentEvent.locations.slice() : [];
      if (!locations.length && currentEvent && currentEvent.location) locations.push(currentEvent.location);
      return {
        type: "FeatureCollection",
        features: locations.map(function (location, index) {
          if (!location || location.visible === false || !Model.coordinateValid(location.coordinate)) return null;
          return {
            type: "Feature",
            properties: {
              id: location.id || "location-" + (index + 1),
              index: index,
              owner: location.owner || (currentEvent && currentEvent.owner) || "NSA",
              sourceRecordId: location.sourceRecordId || (currentEvent && currentEvent.id) || ""
            },
            geometry: { type: "Point", coordinates: location.coordinate }
          };
        }).filter(Boolean)
      };
    }

    function clearMeasurementMarkers() {
      measurementMarkers.forEach(function (marker) { marker.remove(); });
      measurementMarkers = [];
      labelPlacements = [];
    }

    function addMeasurementMarker(kind, coordinate, text) {
      var indexMarker = kind === "index" || kind === "index-border";
      if (!map || !Model.coordinateValid(coordinate) || (!indexMarker && measurementMarkers.length >= MAX_MEASUREMENT_LABELS) || typeof maplibregl.Marker !== "function") return;
      var element = document.createElement("span");
      element.className = "rem-map-measure-label rem-map-measure-label--" + kind;
      element.dataset.measureKind = kind;
      element.textContent = text;
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("role", "presentation");
      var borderIndex = kind === "index-border";
      var offsetLabel = kind === "angle" || kind === "total-length" || borderIndex;
      var baseOffset = borderIndex ? [0, -18] : offsetLabel ? [0, -10] : [0, 0];
      var projected = map.project(coordinate), width = Math.max(24, Math.min(150, String(text).length * 6.5 + 14)), height = 24;
      var shifts = borderIndex ? [[0, 0], [28, 0], [-28, 0], [0, -26], [28, -22], [-28, -22], [52, 0], [-52, 0]] : [[0, 0], [0, -28], [0, 28], [34, 0], [-34, 0], [34, -28], [-34, -28], [34, 28], [-34, 28], [68, 0], [-68, 0], [0, -56], [0, 56]];
      function placementCentre(shift) {
        return {
          x: projected.x + baseOffset[0] + shift[0],
          y: projected.y + baseOffset[1] + shift[1] - (offsetLabel ? height / 2 : 0)
        };
      }
      function collides(shift) {
        var centre = placementCentre(shift);
        return labelPlacements.some(function (placed) { return Math.abs(centre.x - placed.x) < (width + placed.width) / 2 + 6 && Math.abs(centre.y - placed.y) < (height + placed.height) / 2 + 5; });
      }
      var shift = shifts.find(function (candidate) { return !collides(candidate); });
      if (!shift) shift = shifts.reduce(function (best, candidate) {
        var centre = placementCentre(candidate);
        var clearance = Math.min.apply(null, labelPlacements.map(function (placed) {
          return Math.hypot(centre.x - placed.x, centre.y - placed.y);
        }));
        return clearance > best.clearance ? { shift: candidate, clearance: clearance } : best;
      }, { shift: shifts[0], clearance: -1 }).shift;
      var markerOffset = [baseOffset[0] + shift[0], baseOffset[1] + shift[1]];
      var marker = new maplibregl.Marker({ element: element, anchor: offsetLabel ? "bottom" : "center", offset: markerOffset }).setLngLat(coordinate).addTo(map);
      measurementMarkers.push(marker);
      var centre = placementCentre(shift);
      labelPlacements.push({ x: centre.x, y: centre.y, width: width, height: height, kind: kind });
    }

    function lineBoundsCentre(coordinates) {
      if (!coordinates.length || !coordinates.every(Model.coordinateValid)) return null;
      var referenceLongitude = Number(coordinates[0][0]);
      var longitudes = coordinates.map(function (coordinate) {
        var longitude = Number(coordinate[0]);
        while (longitude - referenceLongitude > 180) longitude -= 360;
        while (longitude - referenceLongitude < -180) longitude += 360;
        return longitude;
      });
      var latitudes = coordinates.map(function (coordinate) { return Number(coordinate[1]); });
      var longitude = (Math.min.apply(Math, longitudes) + Math.max.apply(Math, longitudes)) / 2;
      while (longitude > 180) longitude -= 360;
      while (longitude < -180) longitude += 360;
      return [longitude, (Math.min.apply(Math, latitudes) + Math.max.apply(Math, latitudes)) / 2];
    }

    function addDetailedMeasurements(measurements, coordinates) {
      if (showLengthLabels && measurements.geometryType === "line") {
        measurements.segments.forEach(function (segment) {
          addMeasurementMarker("length", segment.midpoint, Model.formatLength(segment.lengthM));
        });
        var centrepoint = lineBoundsCentre(coordinates);
        if (centrepoint) addMeasurementMarker("total-length", centrepoint, "Total length: " + Model.formatLength(measurements.totalLengthM));
      } else if (showLengthLabels) measurements.segments.forEach(function (segment) { addMeasurementMarker("length", segment.midpoint, Model.formatLength(segment.lengthM)); });
      if (showMeasurementAngles) measurements.angles.forEach(function (angle) { addMeasurementMarker("angle", angle.coordinate, Model.formatAngle(angle.degrees)); });
    }

    function draftMeasurements() {
      if (!drawing) return null;
      var coordinates = draftCoordinates();
      return Model.geometryMeasurements(coordinates, drawing.mode === "line" ? "line" : "polygon", false);
    }

    function measurementSummary(measurements) {
      if (!measurements) return "";
      var minimumCoordinates = measurements.geometryType === "line" ? 2 : 3;
      if (!measurements.valid && measurements.coordinateCount >= minimumCoordinates) return "Geometry invalid: " + measurements.validationMessage;
      var parts = [(measurements.geometryType === "line" ? "Length " : "Perimeter ") + Model.formatLength(measurements.totalLengthM)];
      if (measurements.geometryType === "polygon" && measurements.valid) parts.push("Area " + Model.formatArea(measurements.areaSqM));
      if (measurements.angles.length) parts.push("Latest angle " + Model.formatAngle(measurements.angles[measurements.angles.length - 1].degrees));
      return parts.join(" · ");
    }

    function refreshMeasurementMarkers() {
      clearMeasurementMarkers();
      if (!map || !ready) return;
      var selected = currentEvent && currentEvent.polygons.find(function (shape) { return shape.id === selectedShapeId; });
      if (selected && !drawing) {
        Model.refreshShape(selected);
        if (selected.visible !== false && selected.valid) {
          var selectedMeasurements = Model.geometryMeasurements(selected.coordinates, selected.geometryType, selected.closed);
      if(selected.measurementOverride){selectedMeasurements.areaSqM=selected.measurementOverride.areaSqM;selectedMeasurements.lengthM=selected.measurementOverride.lengthM;}
          addDetailedMeasurements(selectedMeasurements, selected.coordinates);
          if (showAreaLabel && selected.geometryType === "polygon" && selectedMeasurements.areaCoordinate) addMeasurementMarker("area", selectedMeasurements.areaCoordinate, "Area " + Model.formatArea(selectedMeasurements.areaSqM));
        }
      }
      var draft = draftMeasurements();
      if (draft) {
        var draftMinimum = draft.geometryType === "line" ? 2 : 3;
        if (draft.valid || draft.coordinateCount < draftMinimum) addDetailedMeasurements(draft, draftCoordinates());
      }
      if (showIndex && currentEvent) {
        currentEvent.polygons.forEach(function (shape, index) {
          if (showSelectedOnly && shape.id !== selectedShapeId) return;
          if (shape.geometryType !== "polygon" || shape.visible === false) return;
          var measurements = Model.geometryMeasurements(shape.coordinates, "polygon", true);
          var large = measurements.valid && measurements.areaSqM > 500;
          var coordinate = measurements.areaCoordinate || lineBoundsCentre(shape.coordinates);
          if (large && measurements.segments.length) {
            var candidates = measurements.segments.map(function (segment) {
              var point = map.project(segment.midpoint), candidatePoint = { x: point.x, y: point.y - 18 };
              var minimumDistance = labelPlacements.length ? Math.min.apply(null, labelPlacements.map(function (placed) { return Math.hypot(candidatePoint.x - placed.x, candidatePoint.y - placed.y); })) : Infinity;
              return { coordinate: segment.midpoint, distance: minimumDistance, length: segment.lengthM };
            }).sort(function (left, right) { return right.distance - left.distance || right.length - left.length; });
            if (candidates[0]) coordinate = candidates[0].coordinate;
          }
          if (coordinate) addMeasurementMarker(large ? "index-border" : "index", coordinate, String(index + 1));
        });
      }
    }

    function addOperationalLayers() {
      if (!map || !ready) return;
      if (!map.getSource("uos-grid")) {
        map.addSource("uos-grid", { type: "geojson", data: gridFeatures() });
        map.addLayer({ id: "uos-grid-lines", type: "line", source: "uos-grid", paint: { "line-color": themeColor("--uos-border", "#d1d9e5"), "line-width": 1, "line-opacity": 0.72 } });
      }
      if (!map.getSource("uos-shapes")) {
        map.addSource("uos-shapes", { type: "geojson", data: shapeFeatures() });
        map.addLayer({
          id: "uos-shape-fill",
          type: "fill",
          source: "uos-shapes",
          filter: ["all", ["==", ["get", "geometryType"], "polygon"], ["==", ["get", "valid"], true]],
          paint: {
            "fill-color": ["case", ["==", ["get", "selected"], true], themeColor("--uos-info", "#2365e8"), themeColor("--uos-brand", "#12835e")],
            "fill-opacity": ["case", ["==", ["get", "selected"], true], 0.34, 0.2]
          }
        });
        map.addLayer({
          id: "uos-shape-edges",
          type: "line",
          source: "uos-shapes",
          filter: ["all", ["==", ["get", "geometryType"], "polygon"], ["==", ["get", "selected"], false]],
          layout: { visibility: showEdges ? "visible" : "none", "line-cap": "round", "line-join": "round" },
          paint: { "line-color": themeColor("--uos-text", "#26332d"), "line-width": 2, "line-opacity": 0.9, "line-dasharray": [1.5, 1.5] }
        });
        map.addLayer({
          id: "uos-shape-selection-outline",
          type: "line",
          source: "uos-shapes",
          filter: ["all", ["==", ["get", "geometryType"], "polygon"], ["==", ["get", "selected"], true]],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": themeColor("--uos-surface", "#fff"),
            "line-width": 4,
            "line-opacity": 0.96
          }
        });
        map.addLayer({
          id: "uos-shape-line",
          type: "line",
          source: "uos-shapes",
          filter: ["all", ["==", ["get", "geometryType"], "polygon"], ["==", ["get", "selected"], true]],
          paint: {
            "line-color": ["case", ["==", ["get", "valid"], false], themeColor("--uos-danger", "#9b3f35"), ["==", ["get", "selected"], true], themeColor("--uos-info", "#2365e8"), themeColor("--uos-brand-strong", "#285a44")],
            "line-width": 2,
            "line-dasharray": [1, 0]
          }
        });
        map.addLayer({
          id: "uos-line-casing",
          type: "line",
          source: "uos-shapes",
          filter: ["==", ["get", "geometryType"], "line"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": themeColor("--uos-surface", "#fff"),
            "line-opacity": 0.92,
            "line-width": ["case", ["==", ["get", "selected"], true], 9, 7]
          }
        });
        map.addLayer({
          id: "uos-line-stroke",
          type: "line",
          source: "uos-shapes",
          filter: ["==", ["get", "geometryType"], "line"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["case", ["==", ["get", "valid"], false], themeColor("--uos-danger", "#9b3f35"), ["==", ["get", "selected"], true], themeColor("--uos-info", "#2365e8"), themeColor("--uos-brand-strong", "#285a44")],
            "line-width": ["case", ["==", ["get", "selected"], true], 5, 3]
          }
        });
      }
      if (!map.getSource("uos-draft")) {
        map.addSource("uos-draft", { type: "geojson", data: draftFeatures() });
        map.addLayer({ id: "uos-draft-fill", type: "fill", source: "uos-draft", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": themeColor("--uos-warning", "#a0642a"), "fill-opacity": 0.18 } });
        map.addLayer({ id: "uos-draft-line", type: "line", source: "uos-draft", filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]], paint: { "line-color": themeColor("--uos-warning", "#a0642a"), "line-width": ["case",["==",["geometry-type"],"Polygon"],2,3], "line-dasharray": [2, 1] } });
        map.addLayer({ id: "uos-draft-points", type: "circle", source: "uos-draft", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": themeColor("--uos-surface", "#fff"), "circle-stroke-color": themeColor("--uos-warning", "#a0642a"), "circle-stroke-width": 2 } });
      }
      if (!map.getSource("uos-edit-vertices")) {
        map.addSource("uos-edit-vertices", { type: "geojson", data: editFeatures() });
        map.addLayer({ id: "uos-edit-vertex-glow", type: "circle", source: "uos-edit-vertices", filter: ["==", ["get", "selected"], true], paint: { "circle-radius": 14, "circle-color": themeColor("--uos-info", "#2365e8"), "circle-opacity": 0.24, "circle-blur": 0.45 } });
        map.addLayer({ id: "uos-edit-vertices", type: "circle", source: "uos-edit-vertices", paint: { "circle-radius": ["case", ["==", ["get", "selected"], true], 9, 7], "circle-color": ["case", ["==", ["get", "selected"], true], themeColor("--uos-info", "#2365e8"), themeColor("--uos-surface", "#fff")], "circle-stroke-color": themeColor("--uos-info", "#2365e8"), "circle-stroke-width": 3 } });
      }
      if (!map.getSource("uos-location")) {
        map.addSource("uos-location", { type: "geojson", data: locationFeatures() });
        map.addLayer({ id: "uos-location-halo", type: "circle", source: "uos-location", paint: { "circle-radius": 14, "circle-color": ["match", ["get", "owner"], "NSA", "#15803d", "EVT", "#0284c7", "#15803d"], "circle-opacity": options.numberedLocations ? 0 : 0.22 } });
        map.addLayer({ id: "uos-location-pin", type: "circle", source: "uos-location", paint: { "circle-radius": 7, "circle-color": ["match", ["get", "owner"], "NSA", "#15803d", "EVT", "#0284c7", "#15803d"], "circle-stroke-color": themeColor("--uos-surface", "#fff"), "circle-stroke-width": 3, "circle-opacity": options.numberedLocations ? 0 : 1, "circle-stroke-opacity": options.numberedLocations ? 0 : 1 } });
      }
    }

    function refresh() {
      if (!map || !ready) return;
      var grid = map.getSource("uos-grid");
      var shapes = map.getSource("uos-shapes");
      var draft = map.getSource("uos-draft");
      var edit = map.getSource("uos-edit-vertices");
      var location = map.getSource("uos-location");
      if (grid) grid.setData(gridFeatures());
      if (shapes) shapes.setData(shapeFeatures());
      if (draft) draft.setData(draftFeatures());
      if (edit) edit.setData(editFeatures());
      if (location) location.setData(locationFeatures());
      renderNumberedLocations();
      refreshMeasurementMarkers();
    }

    function applyTheme() {
      if (!map || !ready) return;
      if (map.getLayer("uos-offline-background")) map.setPaintProperty("uos-offline-background", "background-color", themeColor("--uos-surface-muted", "#f7f9fd"));
      if (map.getLayer("uos-grid-lines")) map.setPaintProperty("uos-grid-lines", "line-color", themeColor("--uos-border", "#d1d9e5"));
      if (map.getLayer("uos-shape-fill")) {
        map.setPaintProperty("uos-shape-fill", "fill-color", ["case", ["==", ["get", "selected"], true], themeColor("--uos-info", "#2365e8"), themeColor("--uos-brand", "#12835e")]);
      }
      if (map.getLayer("uos-shape-line")) {
        map.setPaintProperty("uos-shape-line", "line-color", ["case", ["==", ["get", "valid"], false], themeColor("--uos-danger", "#9b3f35"), ["==", ["get", "selected"], true], themeColor("--uos-info", "#2365e8"), themeColor("--uos-brand-strong", "#285a44")]);
      }
      if (map.getLayer("uos-shape-selection-outline")) map.setPaintProperty("uos-shape-selection-outline", "line-color", themeColor("--uos-surface", "#fff"));
      if (map.getLayer("uos-shape-edges")) map.setPaintProperty("uos-shape-edges", "line-color", themeColor("--uos-text", "#26332d"));
      if (map.getLayer("uos-line-casing")) map.setPaintProperty("uos-line-casing", "line-color", themeColor("--uos-surface", "#fff"));
      if (map.getLayer("uos-line-stroke")) {
        map.setPaintProperty("uos-line-stroke", "line-color", ["case", ["==", ["get", "valid"], false], themeColor("--uos-danger", "#9b3f35"), ["==", ["get", "selected"], true], themeColor("--uos-info", "#2365e8"), themeColor("--uos-brand-strong", "#285a44")]);
      }
      if (map.getLayer("uos-draft-fill")) map.setPaintProperty("uos-draft-fill", "fill-color", themeColor("--uos-warning", "#a0642a"));
      if (map.getLayer("uos-draft-line")) map.setPaintProperty("uos-draft-line", "line-color", themeColor("--uos-warning", "#a0642a"));
      if (map.getLayer("uos-draft-points")) {
        map.setPaintProperty("uos-draft-points", "circle-color", themeColor("--uos-surface", "#fff"));
        map.setPaintProperty("uos-draft-points", "circle-stroke-color", themeColor("--uos-warning", "#a0642a"));
      }
      if (map.getLayer("uos-edit-vertices")) {
        map.setPaintProperty("uos-edit-vertices", "circle-color", ["case", ["==", ["get", "selected"], true], themeColor("--uos-info", "#2365e8"), themeColor("--uos-surface", "#fff")]);
        map.setPaintProperty("uos-edit-vertices", "circle-stroke-color", themeColor("--uos-info", "#2365e8"));
      }
      if (map.getLayer("uos-edit-vertex-glow")) map.setPaintProperty("uos-edit-vertex-glow", "circle-color", themeColor("--uos-info", "#2365e8"));
    }


    function renderNumberedLocations(){
      if(!options.numberedLocations)return;
      locationMarkers.forEach(function(marker){marker.remove();});locationMarkers=[];
      if(!map || !maplibregl.Marker)return;
      locationFeatures().features.forEach(function(feature,index){
        var element=document.createElement("button");
        element.type="button";element.className="uos-numbered-location-pin";
        var number=feature.properties.index+1;
        element.setAttribute("aria-label","Location "+number);
        element.style.cssText="background:none;border:0;padding:0;width:38px;height:48px;cursor:pointer";
        element.innerHTML=pinSymbol(number,showLocationNumbers,feature.properties.owner);
        element.addEventListener("click",function(event){event.stopPropagation();if(typeof options.onLocationSelected==="function")options.onLocationSelected({locationId:feature.properties.id,registerId:feature.properties.sourceRecordId});});
        locationMarkers.push(new maplibregl.Marker({element:element,anchor:"bottom"}).setLngLat(feature.geometry.coordinates).addTo(map));
      });
    }
    function fitCoordinates(coordinates){
      if(!map || !coordinates.length)return false;
      if(coordinates.length===1){map.easeTo({center:coordinates[0],zoom:19,duration:animDuration(300)});return true;}
      var bounds=new maplibregl.LngLatBounds();
      coordinates.forEach(function(c){bounds.extend(c);});
      map.fitBounds(bounds,{padding:48,maxZoom:19,duration:animDuration(300)});
      return true;
    }
    function fitLocations(){return fitCoordinates(locationFeatures().features.map(function(f){return f.geometry.coordinates;}));}
    function fitGeometries(){
      var coordinates=[];
      (currentEvent && currentEvent.polygons || []).filter(function(shape){return shape.visible!==false;}).forEach(function(shape){(shape.coordinates || []).forEach(function(c){if(Model.coordinateValid(c))coordinates.push(c);});});
      return fitCoordinates(coordinates);
    }

    function notifyDraw() {
      if (typeof options.onDrawingChange === "function") {
        var measurements = draftMeasurements();
        options.onDrawingChange({
          active: Boolean(drawing),
          mode: drawing ? drawing.mode : null,
          points: drawing ? drawing.coordinates.length : 0,
          canFinish: Boolean(drawing && drawing.coordinates.length >= (drawing.mode === "line" ? 2 : (drawing.mode === "square" ? 2 : 3))),
          measurementSummary: measurementSummary(measurements),
          measurements: measurements
        });
      }
    }

    function nearestVertex(raw, excludedShapeId, excludedIndex) {
      if (!map || !currentEvent) return raw;
      var projected = map.project(raw);
      var nearest = null;
      var distance = 12;
      var candidates = [];
      currentEvent.polygons.forEach(function (shape) {
        (shape.coordinates || []).forEach(function (coordinate, index) {
          if ((shape.id !== excludedShapeId || index !== excludedIndex) && Model.coordinateValid(coordinate)) candidates.push(coordinate);
        });
      });
      if (drawing) drawing.coordinates.forEach(function (coordinate) { candidates.push(coordinate); });
      candidates.forEach(function (coordinate) {
        var point = map.project(coordinate);
        var candidateDistance = Math.hypot(point.x - projected.x, point.y - projected.y);
        if (candidateDistance < distance) { nearest = coordinate; distance = candidateDistance; }
      });
      return nearest ? nearest.slice() : raw;
    }

    function angleSnap(raw, force) {
      if (!force || !map || !drawing || !drawing.coordinates.length) return raw;
      var anchor = drawing.coordinates[drawing.coordinates.length - 1];
      var start = map.project(anchor);
      var end = map.project(raw);
      var dx = end.x - start.x;
      var dy = end.y - start.y;
      var length = Math.hypot(dx, dy);
      if (length < 1) return raw;
      var angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      return map.unproject({ x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }).toArray();
    }

    function angleSnapFrom(raw, anchor, force) {
      if (!force || !map || !Model.coordinateValid(anchor)) return raw;
      var start = map.project(anchor);
      var end = map.project(raw);
      var dx = end.x - start.x;
      var dy = end.y - start.y;
      var length = Math.hypot(dx, dy);
      if (length < 1) return raw;
      var angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      return map.unproject({ x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }).toArray();
    }

    function snapped(raw, forceAngle) {
      var vertex = nearestVertex(raw);
      if (vertex[0] !== raw[0] || vertex[1] !== raw[1]) return vertex;
      return angleSnap(raw, forceAngle);
    }

    function snappedVertex(raw, shape, index, forceAngle) {
      var vertex = nearestVertex(raw, shape.id, index);
      if (vertex[0] !== raw[0] || vertex[1] !== raw[1]) return vertex;
      var anchor = shape.coordinates[index > 0 ? index - 1 : (shape.coordinates.length > 1 ? 1 : 0)];
      return angleSnapFrom(raw, anchor, forceAngle);
    }

    function completeDrawing() {
      if (!drawing) return null;
      var minimum = drawing.mode === "line" ? 2 : (drawing.mode === "square" ? 2 : 3);
      if (drawing.coordinates.length < minimum) return null;
      var coordinates = drawing.mode === "square" ? Model.projectedSquare(drawing.coordinates[0], drawing.coordinates[1]) : drawing.coordinates.slice();
      var shape = {
        id: Model.uuid("shape"),
        type: drawing.type,
        geometryType: drawing.mode === "line" ? "line" : "polygon",
        closed: false,
        visible: true,
        coordinates: coordinates,
        createdAt: new Date().toISOString()
      };
      Model.refreshShape(shape);
      drawing = null;
      previewCoordinate = null;
      if (map) map.getCanvas().style.cursor = "";
      selectedShapeId = shape.id;
      refresh();
      notifyDraw();
      if (typeof options.onShapeCreated === "function") options.onShapeCreated(shape);
      return shape;
    }

    function startDrawing(mode, type) {
      if (["polygon", "line", "square"].indexOf(mode) < 0) mode = "polygon";
      editShape(null);
      drawing = { mode: mode, type: String(type || ""), coordinates: [] };
      previewCoordinate = null;
      if (map) map.getCanvas().style.cursor = "crosshair";
      refresh();
      notifyDraw();
    }

    function cancelDrawing() {
      drawing = null;
      previewCoordinate = null;
      if (map) map.getCanvas().style.cursor = "";
      refresh();
      notifyDraw();
    }

    function cancelActiveInteraction() {
      cancelPlacement();
      placingLocation = false;
      drawing = null;
      previewCoordinate = null;
      editShape(null);
      if (map) map.getCanvas().style.cursor = "";
      refresh();
      notifyDraw();
    }

    function cancelPlacement() {
      transformShapeId = null; transformCallback = null; transformCentre = null; transformLastCoordinate = null;
      if (rotationHandle) rotationHandle.remove(); rotationHandle = null;
      if (map) { map.dragPan.enable(); map.getCanvas().style.cursor = ""; }
    }
    function transformShape() { return currentEvent && currentEvent.polygons.find(function(s){return s.id===transformShapeId;}); }
    function placementCentre(shape) {
      if (transformCentre) return transformCentre();
      var p=shape.coordinates,n=p.length;
      return p.reduce(function(a,v){return [a[0]+v[0]/n,a[1]+v[1]/n];},[0,0]);
    }
    function updateRotationHandle() {
      var shape=transformShape();if(!map || !shape || !rotationHandle || rotatingHandle) return;
      var p=shape.coordinates,centre=placementCentre(shape);
      var radius=Math.max.apply(null,p.map(function(v){return Math.hypot((v[0]-centre[0])*Math.cos(centre[1]*Math.PI/180),v[1]-centre[1]);}));
      rotationHandle.setLngLat([centre[0],centre[1]+Math.max(radius*1.3,.00003)]);
    }
    function rotationAngle() {
      var shape=transformShape(),c=placementCentre(shape),h=rotationHandle.getLngLat();
      return Math.atan2((h.lng-c[0])*Math.cos(c[1]*Math.PI/180),h.lat-c[1])*180/Math.PI;
    }
    function beginPlacement(id, callback, centre) {
      cancelActiveInteraction(); transformShapeId=id; transformCallback=callback; transformCentre=centre || null; selectShape(id,false);
      var el=document.createElement("button");el.type="button";el.className="uos-button uos-button--secondary uos-button--icon program-map-rotation-handle";
      el.setAttribute("aria-label","Drag to rotate polygon");el.title="Drag to rotate polygon";
      el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6"/></svg>';
      rotationHandle=new maplibregl.Marker({element:el,draggable:true}).setLngLat([0,0]).addTo(map);
      el.setAttribute("aria-label","Drag to rotate polygon");
      updateRotationHandle();
      rotationHandle.on("dragstart",function(){rotatingHandle=true;lastRotationAngle=rotationAngle();});
      rotationHandle.on("drag",function(){var a=rotationAngle(),delta=a-lastRotationAngle;if(delta>180)delta-=360;if(delta<-180)delta+=360;lastRotationAngle=a;if(transformCallback)transformCallback({kind:"rotate",delta:delta});});
      rotationHandle.on("dragend",function(){rotatingHandle=false;updateRotationHandle();});
      map.getCanvas().style.cursor="move";
    }
    function previewShape(id, coordinates) {
      var shape=currentEvent && currentEvent.polygons.find(function(s){return s.id===id;});
      if(!shape)return;shape.coordinates=Model.clone(coordinates);Model.refreshShape(shape);refresh();updateRotationHandle();
    }
    function undoPoint() {
      if (!drawing) return;
      drawing.coordinates.pop();
      previewCoordinate = null;
      refresh();
      notifyDraw();
    }

    function selectShape(id, notify) {
      selectedShapeId = id || null;
      if (editingShapeId && editingShapeId !== selectedShapeId) editShape(null);
      refresh();
      if (notify !== false && typeof options.onShapeSelected === "function") options.onShapeSelected(selectedShapeId);
    }

    function setEvent(event) {
      currentEvent = event || null;
      placingLocation = false;
      if (map && !drawing && !editingShapeId && !transformShapeId) map.getCanvas().style.cursor = "";
      if (!currentEvent) selectedShapeId = null;
      else if (!currentEvent.polygons.some(function (shape) { return shape.id === selectedShapeId; })) selectedShapeId = currentEvent.polygons[0] ? currentEvent.polygons[0].id : null;
      if (!currentEvent || !currentEvent.polygons.some(function (shape) { return shape.id === editingShapeId; })) editShape(null);
      refresh();
    }

    function editShape(id) {
      var shape = currentEvent && id ? currentEvent.polygons.find(function (candidate) { return candidate.id === id; }) : null;
      editingShapeId = shape ? shape.id : null;
      selectedVertexIndex = null;
      draggingVertexIndex = null;
      if (shape) selectedShapeId = shape.id;
      if (map) {
        map.dragPan.enable();
        map.getCanvas().style.cursor = shape ? "pointer" : (drawing ? "crosshair" : "");
      }
      refresh();
    }

    function selectVertex(index, notify) {
      var shape = currentEvent && editingShapeId ? currentEvent.polygons.find(function (candidate) { return candidate.id === editingShapeId; }) : null;
      var parsed = Number(index);
      selectedVertexIndex = shape && Number.isInteger(parsed) && parsed >= 0 && parsed < shape.coordinates.length ? parsed : null;
      refresh();
      if (notify !== false && typeof options.onVertexSelected === "function") options.onVertexSelected(selectedVertexIndex);
      return selectedVertexIndex;
    }

    function setMeasurementVisibility(lengths, area, angles, edges, index, selectedOnly) {
      showLengthLabels = lengths === true;
      showAreaLabel = area !== false;
      showMeasurementAngles = angles !== false;
      if (edges !== undefined) showEdges = edges !== false;
      if (index !== undefined) showIndex = index !== false;
      if (selectedOnly !== undefined) showSelectedOnly = selectedOnly === true;
      if (map && map.getLayer("uos-shape-edges")) map.setLayoutProperty("uos-shape-edges", "visibility", showEdges ? "visible" : "none");
      refresh();
    }

    function vertexHits(point) {
      if (!map || !map.getLayer("uos-edit-vertices")) return [];
      return map.queryRenderedFeatures([[point.x - 12, point.y - 12], [point.x + 12, point.y + 12]], { layers: ["uos-edit-vertices"] });
    }

    function shapeHits(point) {
      if (!map || !map.getLayer("uos-shape-line")) return [];
      return map.queryRenderedFeatures([[point.x - 12, point.y - 12], [point.x + 12, point.y + 12]], {
        layers: ["uos-shape-fill", "uos-shape-line", "uos-line-casing", "uos-line-stroke"]
      });
    }

    function pointSegmentDistance(point, start, end) {
      var dx = end.x - start.x;
      var dy = end.y - start.y;
      if (!dx && !dy) return Math.hypot(point.x - start.x, point.y - start.y);
      var ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
    }

    function pointInsidePolygon(point, projected) {
      var inside = false;
      for (var index = 0, previous = projected.length - 1; index < projected.length; previous = index, index += 1) {
        var current = projected[index];
        var before = projected[previous];
        if ((current.y > point.y) !== (before.y > point.y) &&
            point.x < (before.x - current.x) * (point.y - current.y) / (before.y - current.y) + current.x) inside = !inside;
      }
      return inside;
    }

    function geometryShapeIdAt(point) {
      if (!map || !currentEvent) return null;
      var best = null;
      currentEvent.polygons.forEach(function (shape) {
        if (shape.visible === false || !Array.isArray(shape.coordinates) || shape.coordinates.length < 2 || !shape.coordinates.every(Model.coordinateValid)) return;
        var projected = shape.coordinates.map(function (coordinate) { return map.project(coordinate); });
        var minimum = Infinity;
        for (var index = 1; index < projected.length; index += 1) minimum = Math.min(minimum, pointSegmentDistance(point, projected[index - 1], projected[index]));
        if (shape.geometryType === "polygon" && projected.length > 2) {
          minimum = Math.min(minimum, pointSegmentDistance(point, projected[projected.length - 1], projected[0]));
          if (pointInsidePolygon(point, projected)) minimum = 0;
        }
        if (minimum <= 12 && (!best || minimum < best.distance)) best = { id: shape.id, distance: minimum };
      });
      return best ? best.id : null;
    }

    function shapeIdAt(point) {
      var hits = shapeHits(point);
      return hits.length ? hits[0].properties.id : geometryShapeIdAt(point);
    }

    function removeBasemap() {
      if (!map || !ready) return;
      if (map.getLayer("uos-basemap")) map.removeLayer("uos-basemap");
      if (map.getSource("uos-basemap")) map.removeSource("uos-basemap");
    }

    /* The coordinate grid is a deliberate offline-map aid.  It must not sit
       over a raster provider: its pale one-pixel lines resemble tile seams
       and GeoForge intentionally has no equivalent overlay. */
    function setOfflineGridVisible(visible) {
      if (!map || !ready || !map.getLayer("uos-grid-lines")) return;
      map.setLayoutProperty("uos-grid-lines", "visibility", visible ? "visible" : "none");
    }

    function failProvider(id, detail) {
      if (providerFailureShown || activeProviderId === "offline") return;
      providerFailureShown = true;
      clearProviderLoadTimer();
      removeBasemap();
      setOfflineGridVisible(true);
      activeProviderId = "offline";
      pendingProviderId = "offline";
      if (map) map.setGlyphs(typeof config.glyphs === "string" && config.glyphs ? config.glyphs : null);
      if (typeof options.onProviderFailure === "function") options.onProviderFailure(id, detail || "Tile loading failed.");
      if (typeof options.onProviderChange === "function") options.onProviderChange("offline");
    }

    function confirmProviderLoaded() {
      if (!map || activeProviderId === "offline" || !map.getSource("uos-basemap")) return;
      if (typeof map.isSourceLoaded === "function" && !map.isSourceLoaded("uos-basemap")) return;
      clearProviderLoadTimer();
    }

    function setProvider(id) {
      id = id || "offline";
      pendingProviderId = id;
      if (!map || !ready) return;
      removeBasemap();
      clearProviderLoadTimer();
      providerFailureShown = false;
      if (id === "offline") {
        setOfflineGridVisible(true);
        activeProviderId = "offline";
        map.setGlyphs(typeof config.glyphs === "string" && config.glyphs ? config.glyphs : null);
        if (typeof options.onProviderChange === "function") options.onProviderChange("offline");
        return;
      }
      var provider = providerById(id);
      if (!provider || !Array.isArray(provider.tiles) || !provider.tiles.length) {
        activeProviderId = id;
        failProvider(id, "Provider configuration is incomplete.");
        return;
      }
      try {
        setOfflineGridVisible(false);
        map.setGlyphs(typeof provider.glyphs === "string" && provider.glyphs ? provider.glyphs : (typeof config.glyphs === "string" && config.glyphs ? config.glyphs : null));
        map.addSource("uos-basemap", {
          type: "raster",
          tiles: provider.tiles,
          tileSize: Number(provider.tileSize) || 256,
          minzoom: Number.isFinite(Number(provider.minzoom)) ? Number(provider.minzoom) : 0,
          maxzoom: Number.isFinite(Number(provider.maxzoom)) ? Number(provider.maxzoom) : 22,
          attribution: String(provider.attribution || "")
        });
        /* MetroMap uses adjacent WMTS raster tiles. Disabling the tile fade
           prevents the canvas background showing through tile edges while the
           dynamic source is settling, without degrading image interpolation. */
        map.addLayer({
          id: "uos-basemap",
          type: "raster",
          source: "uos-basemap",
          paint: {
            "raster-fade-duration": 0,
            "raster-resampling": "linear"
          }
        }, "uos-grid-lines");
        activeProviderId = id;
        pendingProviderId = null;
        if (typeof options.onProviderChange === "function") options.onProviderChange(id);
        providerLoadTimer = setTimeout(function () {
          if (activeProviderId === id) failProvider(id, "Tile loading timed out.");
        }, timeoutValue(config.providerTimeoutMs, 12000));
      } catch (error) {
        activeProviderId = id;
        failProvider(id, error.message);
      }
    }

        function zoomToShapes() {
      if (!map || !currentEvent) return;
      var duration = animDuration(300);
      var homeCenter = (Array.isArray(config.defaultCenter) && config.defaultCenter.length >= 2) ? config.defaultCenter.slice(0, 2) : [138.6014, -34.9214];
      var homeZoom = Number.isFinite(Number(config.defaultZoom)) ? Number(config.defaultZoom) : 14;

      var target = resolveCameraTarget(currentEvent, Model.coordinateValid, homeCenter, homeZoom);
      if (target.kind === "geometry") {
        var bounds = new maplibregl.LngLatBounds();
        target.coordinates.forEach(function (coordinate) { bounds.extend(coordinate); });
        map.fitBounds(bounds, { padding: 80, maxZoom: 20, duration: duration });
        return;
      }
      if (target.kind === "pin") {
        map.easeTo({ center: target.coordinate, zoom: 19, duration: duration });
        return;
      }
      if (target.kind === "pins") {
        var pinBounds = new maplibregl.LngLatBounds();
        target.coordinates.forEach(function (coordinate) { pinBounds.extend(coordinate); });
        map.fitBounds(pinBounds, { padding: 80, maxZoom: 19, duration: duration });
        return;
      }
      map.easeTo({ center: target.center, zoom: target.zoom, duration: duration });
    }

    function zoomToShape(id) {
      if (!map || !currentEvent) return;
      var shape = currentEvent.polygons.find(function (candidate) { return candidate.id === id; });
      if (!shape) return;
      var bounds = new maplibregl.LngLatBounds();
      var count = 0;
      (shape.coordinates || []).forEach(function (coordinate) {
        if (Model.coordinateValid(coordinate)) { bounds.extend(coordinate); count += 1; }
      });
      if (!count) return;
      selectShape(shape.id, true);
      map.fitBounds(bounds, { padding: 160, maxZoom: 22, duration: animDuration(300) });
    }

    function startLocationPlacement() {
      if (!map) return;
      cancelActiveInteraction(); placingLocation = true; map.getCanvas().style.cursor = "crosshair";
    }

    function locationAt(point) {
      if (!map || !map.getLayer("uos-location-pin")) return null;
      var hits = map.queryRenderedFeatures(point, { layers: ["uos-location-pin"] });
      if (!hits.length) return null;
      return {
        locationId: String(hits[0].properties && hits[0].properties.id || ""),
        registerId: String(hits[0].properties && hits[0].properties.sourceRecordId || "")
      };
    }

        function zoomToLocation(locationIdOrCoord) {
      if (!map) return;
      var duration = animDuration(300);
      if (Array.isArray(locationIdOrCoord) && Model.coordinateValid(locationIdOrCoord)) {
        map.easeTo({ center: locationIdOrCoord, zoom: 19, duration: duration });
        return;
      }
      var locs = currentEvent && Array.isArray(currentEvent.locations) ? currentEvent.locations : (currentEvent && currentEvent.location ? [currentEvent.location] : []);
      var targetLoc = typeof locationIdOrCoord === "string" ? locs.find(function (l) { return l && l.id === locationIdOrCoord; }) : locs[0];
      if (targetLoc && Model.coordinateValid(targetLoc.coordinate)) {
        map.easeTo({ center: targetLoc.coordinate, zoom: 19, duration: duration });
      }
    }

    function resize() {
      if (map) map.resize();
    }

    function destroy() {
      locationMarkers.forEach(function(marker){marker.remove();});locationMarkers=[];
      cancelPlacement();
      destroyed = true;
      ready = false;
      clearProviderLoadTimer();
      clearInitializationTimer();
      clearMeasurementMarkers();
      if (map) {
        try { map.remove(); } catch (error) { /* A failed WebGL context may already be disposed. */ }
      }
      map = null;
    }

    function failInitialization(error) {
      if (destroyed) return;
      destroyed = true;
      clearInitializationTimer();
      clearProviderLoadTimer();
      clearMeasurementMarkers();
      ready = false;
      var failedMap = map;
      map = null;
      if (failedMap) {
        try { failedMap.remove(); } catch (removeError) { /* Keep coordinate editing available even if teardown fails. */ }
      }
      if (typeof options.onUnavailable === "function") options.onUnavailable(error);
    }

    function updateVertex(id, index, coordinate, opt) {
      opt = opt || {};
      var targetId = id || editingShapeId;
      var shape = currentEvent && targetId ? currentEvent.polygons.find(function (candidate) { return candidate.id === targetId; }) : null;
      if (!shape || !Array.isArray(shape.coordinates)) return false;
      var parsedIndex = Number(index);
      if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= shape.coordinates.length) return false;
      if (!Model.coordinateValid(coordinate)) return false;

      shape.coordinates[parsedIndex] = [Number(coordinate[0]), Number(coordinate[1])];
      Model.refreshShape(shape);
      refresh();
      if (opt.preview !== false && typeof options.onShapePreview === "function") options.onShapePreview(shape);
      if (opt.commit === true && typeof options.onShapeEdited === "function") options.onShapeEdited(shape);
      return true;
    }

    function removeVertex(id, index) {
      var targetId = id || editingShapeId;
      var shape = currentEvent && targetId ? currentEvent.polygons.find(function (candidate) { return candidate.id === targetId; }) : null;
      if (!shape || !Array.isArray(shape.coordinates)) return { success: false, reason: "Shape not found." };
      var parsedIndex = Number(index);
      if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= shape.coordinates.length) return { success: false, reason: "Invalid vertex index." };

      var isPolygon = shape.geometryType === "polygon" || shape.closed;
      var minVertices = isPolygon ? 3 : 2;
      if (shape.coordinates.length <= minVertices) {
        var msg = isPolygon ? "A polygon requires at least 3 vertices." : "A line requires at least 2 vertices.";
        return { success: false, reason: msg };
      }

      shape.coordinates.splice(parsedIndex, 1);
      if (selectedVertexIndex >= shape.coordinates.length) {
        selectedVertexIndex = Math.max(0, shape.coordinates.length - 1);
      }
      Model.refreshShape(shape);
      refresh();
      if (typeof options.onShapeEdited === "function") options.onShapeEdited(shape);
      return { success: true };
    }

    function initialize() {
      if (!container || !maplibregl) {
        if (typeof options.onUnavailable === "function") options.onUnavailable();
        return;
      }
        var workspace = workspaceMap();
        showLengthLabels = workspace.showLength === true;
        showAreaLabel = workspace.showArea !== false;
        showMeasurementAngles = workspace.showAngles === true;
        showEdges = workspace.showEdges === true;
        showIndex = workspace.showIndex !== false;
        showSelectedOnly = workspace.showSelectedOnly === true;
      try {
        map = new maplibregl.Map({
          container: container,
          center: initialCenter(),
          zoom: Number.isFinite(Number(workspace.zoom)) ? Number(workspace.zoom) : (Number.isFinite(Number(config.defaultZoom)) ? Number(config.defaultZoom) : 14),
          style: offlineStyle(),
          attributionControl: true
        });
        initializationTimer = setTimeout(function () {
          failInitialization(new Error("MapLibre initialization timed out."));
        }, timeoutValue(config.initializationTimeoutMs, 10000));
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", function () {
          if (destroyed || !map) return;
          clearInitializationTimer();
          try {
            ready = true;
            addOperationalLayers();
            refresh();
            setProvider(pendingProviderId || workspace.provider || config.defaultProvider || "offline");
            if (typeof options.onReady === "function") options.onReady();
          } catch (error) {  failInitialization(error); }
        });
        map.on("moveend", function (event) {
          refresh();
          if (typeof options.onViewportChange === "function") {
            var center = map.getCenter();
            options.onViewportChange({ center: [center.lng, center.lat], zoom: map.getZoom(),userInitiated:Boolean(event.originalEvent) });
          }
        });
        map.on("mousemove", function (event) {
            if (transformLastCoordinate && transformCallback) { var next=[event.lngLat.lng,event.lngLat.lat];transformCallback({kind:"move",from:transformLastCoordinate,to:next});transformLastCoordinate=next;return; }
          if (editingShapeId && draggingVertexIndex !== null) {
            var editedShape = currentEvent && currentEvent.polygons.find(function (shape) { return shape.id === editingShapeId; });
            if (!editedShape) return;
            editedShape.coordinates[draggingVertexIndex] = snappedVertex([event.lngLat.lng, event.lngLat.lat], editedShape, draggingVertexIndex, Boolean(event.originalEvent && event.originalEvent.shiftKey));
            Model.refreshShape(editedShape);
            dragMoved = true;
            refresh();
            if (typeof options.onShapePreview === "function") options.onShapePreview(editedShape);
            return;
          }
          if (!drawing) return;
          previewCoordinate = snapped([event.lngLat.lng, event.lngLat.lat], Boolean(event.originalEvent && event.originalEvent.shiftKey));
          refresh();
          notifyDraw();
        });
        map.on("mousedown", function (event) {
            if(transformShapeId) { if(rotationHandle && event.originalEvent && rotationHandle.getElement().contains(event.originalEvent.target))return; if(shapeIdAt(event.point)===transformShapeId){transformLastCoordinate=[event.lngLat.lng,event.lngLat.lat];map.dragPan.disable();if(event.originalEvent)event.originalEvent.preventDefault();}return; }
          if (!editingShapeId || !map.getLayer("uos-edit-vertices")) return;
          var hits = vertexHits(event.point);
          if (!hits.length) return;
          draggingVertexIndex = Number(hits[0].properties.index);
          selectedVertexIndex = draggingVertexIndex;
          if (typeof options.onVertexSelected === "function") options.onVertexSelected(selectedVertexIndex);
          dragMoved = false;
          map.dragPan.disable();
          map.getCanvas().style.cursor = "pointer";
          refresh();
          if (event.originalEvent && typeof event.originalEvent.preventDefault === "function") event.originalEvent.preventDefault();
        });
        map.on("touchstart", function (event) {
            if(transformShapeId) { if(rotationHandle && event.originalEvent && rotationHandle.getElement().contains(event.originalEvent.target))return; if(shapeIdAt(event.point)===transformShapeId){transformLastCoordinate=[event.lngLat.lng,event.lngLat.lat];map.dragPan.disable();}return; }
          if (!editingShapeId || !map.getLayer("uos-edit-vertices")) return;
          var point = event.point;
          if (!point) return;
          var hits = vertexHits(point);
          if (!hits.length) return;
          draggingVertexIndex = Number(hits[0].properties.index);
          selectedVertexIndex = draggingVertexIndex;
          if (typeof options.onVertexSelected === "function") options.onVertexSelected(selectedVertexIndex);
          dragMoved = false;
          map.dragPan.disable();
          map.getCanvas().style.cursor = "pointer";
          refresh();
        });
        map.on("mouseup", function () {
            if(transformLastCoordinate){transformLastCoordinate=null;map.dragPan.enable();return;}
          if (draggingVertexIndex === null) return;
          var editedShape = currentEvent && currentEvent.polygons.find(function (shape) { return shape.id === editingShapeId; });
          draggingVertexIndex = null;
          map.dragPan.enable();
          map.getCanvas().style.cursor = editingShapeId ? "pointer" : "";
          suppressClick = dragMoved;
          dragMoved = false;
          if (editedShape) Model.refreshShape(editedShape);
          refresh();
          if (editedShape && typeof options.onShapeEdited === "function") options.onShapeEdited(editedShape);
        });
        map.on("touchmove",function(event){if(transformLastCoordinate && transformCallback){var next=[event.lngLat.lng,event.lngLat.lat];transformCallback({kind:"move",from:transformLastCoordinate,to:next});transformLastCoordinate=next;}});
          map.on("touchend", function () {
            if(transformLastCoordinate){transformLastCoordinate=null;map.dragPan.enable();return;}
          if (draggingVertexIndex === null) return;
          var editedShape = currentEvent && currentEvent.polygons.find(function (shape) { return shape.id === editingShapeId; });
          draggingVertexIndex = null;
          map.dragPan.enable();
          map.getCanvas().style.cursor = editingShapeId ? "pointer" : "";
          suppressClick = dragMoved;
          dragMoved = false;
          if (editedShape) Model.refreshShape(editedShape);
          refresh();
          if (editedShape && typeof options.onShapeEdited === "function") options.onShapeEdited(editedShape);
        });
        map.on("click", function (event) {
            if(transformShapeId) return;
          if (suppressClick) { suppressClick = false; return; }
          if (placingLocation) {
            placingLocation = false; map.getCanvas().style.cursor = "";
            if (typeof options.onLocationPlaced === "function") options.onLocationPlaced([event.lngLat.lng, event.lngLat.lat]);
            return;
          }
          if (drawing) {
            if (drawing.mode === "square" && options.autoFinishSquare === false && drawing.coordinates.length >= 2) return;
            var coordinate = snapped([event.lngLat.lng, event.lngLat.lat], Boolean(event.originalEvent && event.originalEvent.shiftKey));
            drawing.coordinates.push(coordinate);
            previewCoordinate = null;
            refresh();
            notifyDraw();
            if (drawing.mode === "square" && drawing.coordinates.length === 2 && options.autoFinishSquare !== false) completeDrawing();
            return;
          }
          if (editingShapeId && map.getLayer("uos-edit-vertices")) {
            var vertexHit = vertexHits(event.point);
            if (vertexHit.length) {
              selectVertex(Number(vertexHit[0].properties.index), true);
              return;
            }
          }
          var selectedLocation = locationAt(event.point);
          if (selectedLocation && selectedLocation.locationId) {
            if (typeof options.onLocationSelected === "function") options.onLocationSelected(selectedLocation);
            return;
          }
          selectShape(shapeIdAt(event.point), true);
        });
        map.on("sourcedata", function (event) {
          if (event && event.sourceId === "uos-basemap" && event.isSourceLoaded) confirmProviderLoaded();
        });
        map.on("idle", confirmProviderLoaded);
        map.on("error", function (event) {
          if (destroyed || !event) return;
          if (activeProviderId !== "offline" && event.sourceId === "uos-basemap") {
            failProvider(activeProviderId, event.error && event.error.message ? event.error.message : "Tile loading failed.");
            return;
          }
          if (!ready) failInitialization(event.error || new Error("MapLibre could not initialize."));
        });
      } catch (error) {
        failInitialization(error);
      }
    }

    initialize();

    return {
      available: function () { return Boolean(map); },
      ready: function () { return ready; },
      destroy: destroy,
      refresh: refresh,
      applyTheme: applyTheme,
      resize: resize,
      setEvent: setEvent,
      setProvider: setProvider,
      selectShape: selectShape,
      editShape: editShape,
      selectVertex: selectVertex,
      updateVertex: updateVertex,
      removeVertex: removeVertex,
      setMeasurementVisibility: setMeasurementVisibility,
      startDrawing: startDrawing,
      finishDrawing: completeDrawing,
      cancelDrawing: cancelDrawing,
      cancelActiveInteraction: cancelActiveInteraction,
      undoPoint: undoPoint,
      zoomToShapes: zoomToShapes,
      fitLocations:fitLocations,
      fitGeometries:fitGeometries,
      setLocationNumbers:function(visible){var next=visible!==false;if(next!==showLocationNumbers){showLocationNumbers=next;renderNumberedLocations();}},
      resetView: resetView,
      resetHome: resetView,
      zoomToShape: zoomToShape,
      startLocationPlacement: startLocationPlacement,
      beginPlacement: beginPlacement,
      cancelPlacement: cancelPlacement,
      previewShape: previewShape,
      zoomToLocation: zoomToLocation,
      getProviderId: function () { return activeProviderId; },
      getSelectedShapeId: function () { return selectedShapeId; },
      getEditingShapeId: function () { return editingShapeId; },
      getSelectedVertexIndex: function () { return selectedVertexIndex; },
      getDraggingVertexIndex: function () { return draggingVertexIndex; },
      getCanvasCursor: function () { return map ? map.getCanvas().style.cursor : ""; },
      projectCoordinate: function (coordinate) {
        if (!map || !Model.coordinateValid(coordinate)) return null;
        var point = map.project(coordinate);
        return { x: point.x, y: point.y };
      },
      shapeIdsAtCoordinate: function (coordinate) {
        if (!map || !Model.coordinateValid(coordinate)) return [];
        var id = shapeIdAt(map.project(coordinate));
        return id ? [id] : [];
      },
      editableVertexAt: function (coordinate) {
        if (!map || !Model.coordinateValid(coordinate)) return null;
        var hits = vertexHits(map.project(coordinate));
        return hits.length ? Number(hits[0].properties.index) : null;
      },
      getDrawing: function () { return drawing ? Model.clone(drawing) : null; },
      getOperationalSnapshot: function () {
        var layerIds = ["uos-shape-fill", "uos-shape-edges", "uos-shape-selection-outline", "uos-shape-line", "uos-line-casing", "uos-line-stroke"];
        var style = map && ready ? map.getStyle() : null;
        return {
          features: shapeFeatures(),
          layers: style ? style.layers.filter(function (layer) { return layerIds.indexOf(layer.id) >= 0; }).map(function (layer) { return Model.clone(layer); }) : []
        };
      },
      getMeasurementSnapshot: function () {
        return {
          drawing: draftMeasurements(),
          labels: measurementMarkers.map(function (marker) {
            var element = marker.getElement();
            var coordinate = marker.getLngLat();
            return { kind: element.dataset.measureKind, text: element.textContent, coordinate: [coordinate.lng, coordinate.lat] };
          })
        };
      },
      getLocationSnapshot: function () {
        var center = map && map.getCenter();
        return { features: locationFeatures(), center: center ? [center.lng, center.lat] : null, zoom: map ? map.getZoom() : null, moving: map ? map.isMoving() : false, placing: placingLocation };
      }
    };
  }

  function pinSymbol(number,visible,owner){
    var color=owner==="EVT"?"#137998":"#087c5c",label=String(Number(number)||0);
    return '<svg viewBox="0 0 38 48" aria-hidden="true" style="width:100%;height:100%"><path d="M19 1C9 1 2 8 2 18c0 11 17 28 17 28s17-17 17-28C36 8 29 1 19 1Z" fill="'+color+'" stroke="white" stroke-width="2"/>'+(visible?'<text x="19" y="23" text-anchor="middle" font-family="system-ui,sans-serif" font-size="17" font-weight="750" fill="white" stroke="none" stroke-width="0" style="text-shadow:none">'+label+'</text>':'')+'</svg>';
  }
  UOS.RemediationMap = { create:create,resolveCameraTarget:resolveCameraTarget,pinSymbol:pinSymbol };
  if (typeof module !== "undefined" && module.exports) module.exports = UOS.RemediationMap;
})();
