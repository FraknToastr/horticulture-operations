(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.UOS = root.UOS || {}; root.UOS.ProgramMapController = api; }
}(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  var mapController = null;
  var selectedShapeId = null;
  var editingShapeId = null;
  var selectedVertexIndex = null;
  var activeDrawMode = "polygon";
  var pendingDeleteShapeId = null;
  var mapToggles = { Length: false, Area: true, Angles: false, Edges: true, Index: true, ActiveOnly: false, SelectedOnly: false };
  var activeProviderId = root.UOS_REMEDIATION_MAP_CONFIG && root.UOS_REMEDIATION_MAP_CONFIG.defaultProvider || "esri-world-imagery";
  var initialized = false;
  var sidebarViewMode = "events";
  var selectedEventFilterId = "all";
  var eventSearchQuery = "";
  var droppedGeometryFile = null;
  var renderedOwnerMode = "";
  var pendingCameraFocusId = null;
  var previousDestination = "";
  var pendingLocationPlacement = null;

  function one(selector) { return root.document ? root.document.querySelector(selector) : null; }
  function all(selector) { return root.document && typeof root.document.querySelectorAll === "function" ? Array.prototype.slice.call(root.document.querySelectorAll(selector)) : []; }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function inRegisterDrawerMode() { return document.body.hasAttribute("data-drawer-module") || document.body.hasAttribute("data-drawer-context-pending"); }
  function esc(value) { return root.UOS && root.UOS.imports && typeof root.UOS.imports.escapeHtml === "function" ? root.UOS.imports.escapeHtml(value) : text(value); }

  function updateMapToolStatus(message) {
    var status = one("#mapToolStatus");
    if (status) {
      status.textContent = text(message);
      status.hidden = !text(message);
    }
  }

function setSelectToolActive(active) {
  var button = one("#selectToolButton");
  if (!button) return;
  button.classList.toggle("is-active", active === true);
  button.setAttribute("aria-pressed", String(active === true));
}

function setMapCanvasCursor(cursor) {
  var canvas = one("#eventMap .maplibregl-canvas") || one("#eventMap canvas");
  if (canvas) canvas.style.cursor = cursor;
}

  function resetDrawingControls() {
    var toolbar = one(".program-map-header-controls");
    if (toolbar) toolbar.classList.remove("is-drawing");
    ["#finishDrawingButton", "#undoDrawingButton", "#cancelDrawingButton"].forEach(function (selector) {
      var button = one(selector);
      if (button) button.disabled = true;
    });
  }

  function cancelActiveMapInteraction() {
    pendingLocationPlacement = null;
    updateMapToolStatus("");
    setSelectToolActive(true);
    resetDrawingControls();
    if (mapController && typeof mapController.cancelActiveInteraction === "function") mapController.cancelActiveInteraction();
    else if (mapController && typeof mapController.cancelDrawing === "function") mapController.cancelDrawing();
  }

  function startPinPlacement(kind, registerId, locationId) {
    if (!registerId) return Promise.resolve(null);
    var placementWorkspace = getWorkspace();
    var placementContext = resolveMapContext(placementWorkspace, sidebarViewMode, "register", registerId);
    pendingLocationPlacement = { kind: kind === "move" ? "move" : "add", registerId: registerId, locationId: locationId || "" };
    setSelectToolActive(false);
    ensureMapInstance();
    if (mapController && typeof mapController.startLocationPlacement === "function") mapController.startLocationPlacement();
    setMapCanvasCursor("crosshair");
  setMapCanvasCursor("crosshair");
    updateMapToolStatus(kind === "move" ? "Click new pin position — Esc to cancel" : "Click to place new pin — Esc to cancel");
    return persistCanonicalMapState({
      scopeMode: "register",
      selectedRegisterId: registerId,
      selectedProjectId: placementContext.projectId || "",
      selectedLocationId: locationId || "",
      selectedGeometryId: "",
      inspectorMode: "location"
    }).then(function () {
      ensureMapInstance();
      pendingLocationPlacement = { kind: kind === "move" ? "move" : "add", registerId: registerId, locationId: locationId || "" };
      setSelectToolActive(false);
      if (kind === "move" && locationId && mapController && typeof mapController.zoomToLocation === "function") mapController.zoomToLocation(locationId);
      if (mapController && typeof mapController.startLocationPlacement === "function") mapController.startLocationPlacement();
      updateMapToolStatus(kind === "move" ? "Click the new pin position — Esc to cancel" : "Click to place the new pin — Esc to cancel");
      return getWorkspace();
    }).catch(function (error) {
      if (root.UOS.toast) root.UOS.toast(error.message || "The location context could not be saved.", "error");
      return null;
    });
  }

  function confirmPinRemoval(registerId, locationId) {
    function remove() {
      if (!root.UOS.ProgramApp) return Promise.resolve(null);
      return root.UOS.ProgramApp.updateWorkspace(function (candidate) {
        var state = canonicalMapState(candidate);
        var updated = root.UOS.ProgramModel.removeLocationFromRegister(candidate, registerId, locationId);
        return state.selectedLocationId === locationId
          ? writeCanonicalMapState(updated, { selectedLocationId: "", inspectorMode: "register" })
          : updated;
      }).then(function () {
        if (root.UOS.toast) root.UOS.toast("Location pin removed.", "success");
      }).catch(function (error) {
        if (root.UOS.toast) root.UOS.toast(error.message || "The location pin could not be removed.", "error");
      });
    }
    if (root.UOS.dialogs && typeof root.UOS.dialogs.confirm === "function") {
      return root.UOS.dialogs.confirm({
        title: "Remove location pin?",
        message: "This removes the selected location from the Register record.",
        confirmLabel: "Remove pin",
        cancelLabel: "Keep pin",
        danger: true
      }).then(function (confirmed) { return confirmed ? remove() : null; });
    }
    return remove();
  }

  function getWorkspace() {
    if (!root.UOS || !root.UOS.ProgramApp) return null;
    var app = root.UOS.ProgramApp;
    if (typeof app.workspace === "function") return app.workspace();
    if (typeof app.getWorkspace === "function") return app.getWorkspace();
    if (app.workspace && typeof app.workspace === "object") return app.workspace;
    return null;
  }

  function getGeometries() {
    var workspace = getWorkspace();
    var list = workspace && workspace.entities && Array.isArray(workspace.entities.geometries) ? workspace.entities.geometries : [];
    return list;
  }

  function recordLocations(record, workspace) {
    if (!record) return [];
    var model = root.UOS && root.UOS.ProgramModel;
    var sourceWorkspace = workspace && typeof workspace === "object" ? workspace : getWorkspace();
    return model && typeof model.registerLocations === "function"
      ? model.registerLocations(sourceWorkspace, record.id)
      : [];
  }

  function getAllWorkspaceLocations(ownerFilter) {
    var workspace = getWorkspace();
    if (!workspace || !workspace.entities) return [];
    var result = [];
    var apps = Array.isArray(workspace.entities.applications) ? workspace.entities.applications : [];
    var events = Array.isArray(workspace.entities.events) ? workspace.entities.events : [];
    var targetOwner = ownerFilter || (sidebarViewMode === "applications" ? "NSA" : "EVT");

    if (targetOwner === "NSA" || targetOwner === "all") {
      apps.forEach(function (app) {
        recordLocations(app, workspace).forEach(function (loc) {
          result.push(loc);
        });
      });
    }

    if (targetOwner === "EVT" || targetOwner === "all") {
      events.forEach(function (evt) {
        recordLocations(evt, workspace).forEach(function (loc) {
          result.push(loc);
        });
      });
    }
    return result;
  }

      function resolveMapContext(workspace, viewMode, scopeMode, targetId) {
    workspace = workspace || getWorkspace() || { entities: {} };
    var events = workspace.entities && workspace.entities.events || [];
    var apps = workspace.entities && workspace.entities.applications || [];
    var projects = workspace.entities && workspace.entities.projects || [];

    var owner = viewMode === "applications" ? "NSA" : "EVT";
    var scope = scopeMode || "register";

    if (!targetId || targetId === "all") {
      return {
        scope: scope,
        owner: owner,
        targetId: "all",
        register: null,
        registerId: null,
        project: null,
        projectId: null
      };
    }

    // Check if targetId is a Project
    var prj = projects.find(function (p) { return p.id === targetId; });
    if (prj) {
      var linkedReg = (window.UOS && window.UOS.ProgramModel && typeof window.UOS.ProgramModel.registerForProject === "function")
        ? window.UOS.ProgramModel.registerForProject(workspace, prj)
        : null;
      return {
        scope: "projects",
        owner: prj.owner || owner,
        targetId: prj.id,
        project: prj,
        projectId: prj.id,
        register: linkedReg || null,
        registerId: linkedReg ? linkedReg.id : (prj.applicationId || prj.eventId || null)
      };
    }

    // Target is a Register Record
    var reg = events.find(function (e) { return e.id === targetId; }) || apps.find(function (a) { return a.id === targetId; });
    var regPrj = reg && window.UOS && window.UOS.ProgramModel && typeof window.UOS.ProgramModel.activeProjectForRegister === "function"
      ? window.UOS.ProgramModel.activeProjectForRegister(workspace, reg)
      : null;

    return {
      scope: scope,
      owner: reg ? reg.owner : owner,
      targetId: reg ? reg.id : targetId,
      register: reg || null,
      registerId: reg ? reg.id : targetId,
      project: regPrj || null,
      projectId: regPrj ? regPrj.id : null
    };
  }

  function buildMapEvent(targetId, dataset) {
    var workspace = getWorkspace();
    var isAll = !targetId || targetId === "all";
    var events = workspace && workspace.entities && Array.isArray(workspace.entities.events) ? workspace.entities.events : [];
    var apps = workspace && workspace.entities && Array.isArray(workspace.entities.applications) ? workspace.entities.applications : [];
    var projects = workspace && workspace.entities && Array.isArray(workspace.entities.projects) ? workspace.entities.projects : [];

    var targetOwner = sidebarViewMode === "applications" ? "NSA" : "EVT";
    var filteredData = dataset || resolveFilteredMapDataset(workspace, sidebarViewMode, sidebarScopeMode, selectedSpatialFilter, selectedStatusFilters, eventSearchQuery);

    if (isAll) {
      var allLocs = filteredData.locations;
      var allPolys = convertToEventShapes(filteredData.geometries);
      return {
        id: "all",
        eventName: "Program Workspace Map",
        location: allLocs[0] || null,
        locations: allLocs,
        focusLocations: allLocs,
        allLocations: allLocs,
        polygons: allPolys,
        owner: targetOwner
      };
    }

    var ctx = resolveMapContext(workspace, sidebarViewMode, sidebarScopeMode, targetId);

    // 1. Project Scope
    if (ctx.scope === "projects" && ctx.project) {
      var project = ctx.project;
      var projectGeoms = (root.UOS && root.UOS.ProgramModel && typeof root.UOS.ProgramModel.projectWorkGeometry === "function")
        ? root.UOS.ProgramModel.projectWorkGeometry(workspace, project.id)
        : (filteredData.index.projectWorkGeometriesById[project.id] || []);
      var linkedRegister = ctx.register || ((root.UOS && root.UOS.ProgramModel && typeof root.UOS.ProgramModel.registerForProject === "function") ? root.UOS.ProgramModel.registerForProject(workspace, project) : null);
      var linkedPins = linkedRegister ? recordLocations(linkedRegister, workspace) : [];
      return {
        id: project.id,
        eventName: project.title || project.name || "Delivery Project",
        location: linkedPins[0] || null,
        locations: linkedPins,
        focusLocations: linkedPins,
        allLocations: filteredData.locations,
        polygons: convertToEventShapes(projectGeoms),
        owner: project.owner
      };
    }

    // 2. Register Scope
    var registerRecord = ctx.register || events.find(function (e) { return e.id === targetId; }) || apps.find(function (a) { return a.id === targetId; });
    var regPins = registerRecord ? recordLocations(registerRecord, workspace) : [];
    return {
      id: registerRecord ? registerRecord.id : targetId,
      eventName: registerRecord ? (registerRecord.eventName || registerRecord.title || registerRecord.name) : "Register Record",
      location: regPins[0] || null,
      locations: regPins,
      focusLocations: regPins,
      allLocations: filteredData.locations,
      polygons: [], // Register records NEVER directly own Work Geometry in v3
      owner: registerRecord ? registerRecord.owner : targetOwner
    };
  }

  function getGeometriesForEvent(targetId) {
    var workspace = getWorkspace();
    var target = targetId || selectedEventFilterId;
    if (!target || target === "all") return getGeometries();

    var ctx = resolveMapContext(workspace, sidebarViewMode, sidebarScopeMode, target);
    if (ctx.scope === "projects" && ctx.projectId) {
      return (window.UOS && window.UOS.ProgramModel && typeof window.UOS.ProgramModel.projectWorkGeometry === "function")
        ? window.UOS.ProgramModel.projectWorkGeometry(workspace, ctx.projectId)
        : [];
    }

    // Register Scope: Register records do not directly own geometries in v3
    return [];
  }

  function workTypeLabel(key) {
    key = text(key).toLowerCase();
    if (key === "turfing") return "Turfing area";
    if (key === "aerate") return "Aeration area";
    if (key === "fertilise") return "Fertilising area";
    if (key === "topdressing") return "Topdressing area";
    if (key === "rolling") return "Rolling area";
    if (key === "other") return "Other area";
    return (key.charAt(0).toUpperCase() + key.slice(1)) || "Mapped shape";
  }

  var WORK_TYPE_ALIASES = {
    turf: "turfing",
    turfing: "turfing",
    aerate: "aerate",
    aeration: "aerate",
    fertilise: "fertilise",
    fertilising: "fertilise",
    topdressing: "topdressing",
    "top dressing": "topdressing",
    rolling: "rolling",
    other: "other"
  };

  function canonicalWorkType(value) {
    var key = text(value).toLowerCase();
    return Object.prototype.hasOwnProperty.call(WORK_TYPE_ALIASES, key) ? WORK_TYPE_ALIASES[key] : "";
  }

  function geometryWorkType(geometry) {
    var payload = geometry && geometry.payload || {};
    return canonicalWorkType(geometry && (geometry.workTypeKey || geometry.workType) || payload.workTypeKey || payload.workType || payload.type);
  }

  function workTypeOptions(current) {
    var governedTypes = root.UOS && root.UOS.ProgramModel && root.UOS.ProgramModel.supportedPolygonWorkTypes;
    var types = (Array.isArray(governedTypes) && governedTypes.length ? governedTypes : [
      { key: "turfing", label: "Turfing area" },
      { key: "aerate", label: "Aeration area" },
      { key: "fertilise", label: "Fertilising area" },
      { key: "topdressing", label: "Topdressing area" },
      { key: "rolling", label: "Rolling area" }
    ]).concat([{ key: "other", label: "Other area" }]);
    var currentKey = text(current).toLowerCase();
    var isKnown = types.some(function (type) { return type.key === currentKey; });
    var placeholder = '<option value=""' + (!isKnown ? " selected" : "") + '>Select work type…</option>';
    return placeholder + types.map(function (type) {
      var selected = isKnown && type.key === currentKey;
      return '<option value="' + esc(type.key) + '"' + (selected ? " selected" : "") + '>' + esc(type.label) + '</option>';
    }).join("");
  }

  function eligiblePolygonRates(workspace, workTypeKey) {
    var service = root.UOS && root.UOS.WorkAreaService;
    if (!service || typeof service.eligibleSpatialRatesForWorkType !== "function" || !workTypeKey) return [];
    try {
      var rates = service.eligibleSpatialRatesForWorkType(workspace, workTypeKey);
      return Array.isArray(rates) ? rates : [];
    } catch (error) {
      return [];
    }
  }

  function polygonRateLabel(rate) {
    var amount = Number(rate && rate.unitRate);
    var formatted = Number.isFinite(amount)
      ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
      : "0.00";
    return text(rate && rate.description || rate && rate.id || "Rate Item") + " — $" + formatted + " / " + text(rate && rate.unit || "unit");
  }

  function polygonRateOptions(rates, selectedRateId, hasWorkType) {
    if (!hasWorkType) return '<option value="" selected>Select a work type first…</option>';
    if (!rates.length) return '<option value="" selected>No eligible pricing rates</option>';
    var hasSelected = rates.some(function (rate) { return text(rate && rate.id) === selectedRateId; });
    var options = hasSelected ? "" : '<option value="" selected>Select pricing rate…</option>';
    return options + rates.map(function (rate) {
      var rateId = text(rate && rate.id);
      return '<option value="' + esc(rateId) + '"' + (rateId === selectedRateId ? " selected" : "") + '>' + esc(polygonRateLabel(rate)) + '</option>';
    }).join("");
  }

  function formatMeasure(geom) {
    if (!geom) return "0 m²";
    var payload = geom.payload || {};
    var area = payload.areaSqM || 0;
    var length = payload.lengthM || 0;
    if (area <= 0 && Array.isArray(geom.coordinates) && geom.coordinates.length >= 3 && root.UOS.RemediationModel) {
      var metrics = root.UOS.RemediationModel.geometryMeasurements(geom.coordinates, "polygon", true);
      if (metrics && metrics.areaSqM) area = metrics.areaSqM;
    }
    if (area > 0) return area.toFixed(1) + " m²";
    if (length > 0) return length.toFixed(1) + " m length";
    return "0 m²";
  }

  function extractCoordinates(geom) {
    if (!geom) return [];
    var coords = null;
    if (Array.isArray(geom.coordinates)) {
      coords = geom.coordinates;
    } else if (geom.geometry && Array.isArray(geom.geometry.coordinates)) {
      coords = geom.geometry.coordinates;
    } else if (geom.payload && Array.isArray(geom.payload.coordinates)) {
      coords = geom.payload.coordinates;
    }
    if (!Array.isArray(coords) || !coords.length) return [];

    // If 3D array (GeoJSON Polygon: [ [ [lng, lat], ... ] ]): return outer ring coords[0]
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && typeof coords[0][0][0] === "number") {
      return coords[0];
    }
    // If 2D array (Direct ring: [ [lng, lat], ... ]): return coords
    if (Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
      return coords;
    }
    return [];
  }

  function convertToEventShapes(geometries) {
    return geometries.map(function (geom) {
      var payload = geom.payload || {};
      var coords = extractCoordinates(geom);
      return {
        id: geom.id,
        type: geometryWorkType(geom),
        geometryType: geom.geometryKind || (geom.geometry && geom.geometry.type === "LineString" ? "line" : "polygon"),
        visible: payload.visible !== false,
        valid: payload.valid !== false,
        closed: payload.closed !== false,
        coordinates: coords,
        payload: payload
      };
    });
  }

  /* WKT Geometry Parsers */
  function wktGroups(value) {
    var groups = [], depth = 0, start = 0;
    for (var index = 0; index < value.length; index += 1) {
      if (value[index] === "(") depth += 1;
      else if (value[index] === ")") depth -= 1;
      else if (value[index] === "," && depth === 0) { groups.push(value.slice(start, index).trim()); start = index + 1; }
      if (depth < 0) throw new Error("WKT parentheses are unbalanced.");
    }
    if (depth !== 0) throw new Error("WKT parentheses are unbalanced.");
    groups.push(value.slice(start).trim());
    return groups.filter(Boolean);
  }

  function wktUnwrap(value) {
    value = value.trim();
    if (value[0] !== "(" || value[value.length - 1] !== ")") throw new Error("WKT geometry is missing parentheses.");
    return value.slice(1, -1).trim();
  }

  function wktCoordinates(value) {
    return wktGroups(value).map(function (entry, index) {
      var fields = entry.trim().split(/\s+/);
      var coordinate = [Number(fields[0]), Number(fields[1])];
      if (fields.length !== 2 || !Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])) {
        throw new Error("WKT coordinate " + (index + 1) + " is invalid; use longitude latitude pairs.");
      }
      return coordinate;
    });
  }

  function wktPolygon(value) {
    var rings = wktGroups(wktUnwrap(value));
    if (rings.length !== 1) throw new Error("Polygon holes are not supported.");
    return [wktCoordinates(wktUnwrap(rings[0]))];
  }

  function wktGeometry(textInput) {
    textInput = textInput.replace(/^\s*SRID=\d+\s*;\s*/i, "").trim();
    var match = /^([A-Za-z]+)\s*(\([\s\S]*\))$/.exec(textInput);
    if (!match) throw new Error("WKT must contain a supported geometry and coordinate body.");
    var type = match[1].toUpperCase();
    var body = match[2];
    if (type === "LINESTRING") return { type: "LineString", coordinates: wktCoordinates(wktUnwrap(body)) };
    if (type === "POLYGON") return { type: "Polygon", coordinates: wktPolygon(body) };
    if (type === "MULTILINESTRING") return { type: "MultiLineString", coordinates: wktGroups(wktUnwrap(body)).map(function (group) { return wktCoordinates(wktUnwrap(group)); }) };
    if (type === "MULTIPOLYGON") return { type: "MultiPolygon", coordinates: wktGroups(wktUnwrap(body)).map(function (polygon) { return wktPolygon(polygon); }) };
    throw new Error("Unsupported WKT geometry " + type + ".");
  }

  function prepareGeoJsonShapes(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("GeoJSON must be an object.");
    var features = raw.type === "FeatureCollection" ? raw.features : raw.type === "Feature" ? [raw] : [{ type: "Feature", properties: {}, geometry: raw }];
    if (!Array.isArray(features) || !features.length) throw new Error("GeoJSON contains no features.");

    var workspace = getWorkspace();
    var ctx = resolveMapContext(workspace, sidebarViewMode, sidebarScopeMode, selectedEventFilterId);
    var targetId = ctx.projectId || ctx.registerId || (selectedEventFilterId && selectedEventFilterId !== "all" ? selectedEventFilterId : "");
    if (!targetId) throw new Error("Select a Register record or Delivery Project before importing geometry.");

    var project = ctx.project || projectForTarget(workspace, targetId, ctx.owner);
    if (!project) throw new Error("Promote the selected Register record to a Delivery Project before importing mapped work.");

    var resultGeometries = [];
    features.forEach(function (feature, index) {
      if (!feature || !feature.geometry) return;
      var geom = feature.geometry;
      var geomType = geom.type;
      if (geomType !== "Polygon" && geomType !== "MultiPolygon" && geomType !== "LineString" && geomType !== "MultiLineString") return;

      var ownerVal = ctx.owner;
      var sourceKey = text(feature.properties && (feature.properties.id || feature.properties.sourceId)) || JSON.stringify(geom);
      var id = root.UOS.ProgramModel.stableId(ownerVal, "geometry", "import:" + project.id + ":" + index + ":" + sourceKey);

      var importedWorkType = canonicalWorkType(feature.properties && (feature.properties.workTypeKey || feature.properties.category));
      var newGeom = {
        id: id,
        owner: ownerVal,
        type: "geometry",
        workTypeKey: importedWorkType,
        projectId: project.id,
        geometryKind: (geomType === "LineString" || geomType === "MultiLineString") ? "line" : "polygon",
        geometry: geom,
        payload: {
          id: id,
          type: importedWorkType,
          workTypeKey: importedWorkType,
          visible: true,
          valid: true,
          areaSqM: 0,
          lengthM: 0
        },
        provenance: {
          owner: ownerVal,
          sourceApp: "uos.space-map",
          sourceVersion: 1,
          sourceId: "import-" + index
        }
      };
      resultGeometries.push(newGeom);
    });

    if (!resultGeometries.length) throw new Error("GeoJSON contains no supported Polygon or Line geometries.");
    return resultGeometries;
  }

  var sidebarScopeMode = "register";

  function canonicalMapState(workspace) {
    workspace = workspace || getWorkspace() || { entities: {}, workspace: {} };
    var ui = workspace.workspace || {};
    var mapUi = ui.map || {};
    var entities = workspace.entities || {};
    var registers = (entities.applications || []).concat(entities.events || []);
    var projects = entities.projects || [];
    var geometries = entities.geometries || [];
  /* An explicitly cleared map selection must stay cleared. Falling back to the
     global working record resurrected filtered-out Register IDs and caused an
     endless persist -> program-ready -> render loop. */
  var hasStoredRegisterSelection = Object.prototype.hasOwnProperty.call(mapUi, "selectedRegisterId");
  var registerId = text(hasStoredRegisterSelection ? mapUi.selectedRegisterId : ui.selectedEntityId);
    var projectId = text(mapUi.selectedProjectId || ui.selectedProjectId);
    var geometryId = text(mapUi.selectedGeometryId);
    var locationId = text(mapUi.selectedLocationId);
    var scopeMode = mapUi.scopeMode === "projects" ? "projects" : "register";
    var inspectorMode = text(mapUi.inspectorMode);
    if (["register", "location", "project", "geometry", "polygon"].indexOf(inspectorMode) < 0) inspectorMode = scopeMode === "projects" ? "project" : "register";

    var geometry = geometryId ? geometries.find(function (item) { return item && item.id === geometryId; }) : null;
    if (!geometry) geometryId = "";
    if (geometry && !projectId) projectId = text(geometry.projectId || geometry.payload && geometry.payload.projectId);
    var project = projectId ? projects.find(function (item) { return item && item.id === projectId; }) : null;
    if (!project) projectId = "";
    var register = registerId ? registers.find(function (item) { return item && item.id === registerId; }) : null;
    if (!register && project && root.UOS && root.UOS.ProgramModel && typeof root.UOS.ProgramModel.registerForProject === "function") {
      try { register = root.UOS.ProgramModel.registerForProject(workspace, project) || null; } catch (error) { register = null; }
      if (register) registerId = register.id;
    }
    if (!register) registerId = "";
    if (!project && register && root.UOS && root.UOS.ProgramModel && typeof root.UOS.ProgramModel.activeProjectForRegister === "function") {
      try { project = root.UOS.ProgramModel.activeProjectForRegister(workspace, register) || null; } catch (error) { project = null; }
      if (project) projectId = project.id;
    }

    // The selected Register and Project are one lineage, not two independent
    // sidebar selections. Repair stale/partially-written legacy combinations
    // according to the active scope before anything is rendered.
    if (scopeMode === "projects" && project && root.UOS && root.UOS.ProgramModel && typeof root.UOS.ProgramModel.registerForProject === "function") {
      try {
        var projectRegister = root.UOS.ProgramModel.registerForProject(workspace, project) || null;
        register = projectRegister;
        registerId = projectRegister ? projectRegister.id : "";
      } catch (error) {
        register = null;
        registerId = "";
      }
    } else if (scopeMode === "register" && register && root.UOS && root.UOS.ProgramModel && typeof root.UOS.ProgramModel.activeProjectForRegister === "function") {
      try {
        var registerProject = root.UOS.ProgramModel.activeProjectForRegister(workspace, register) || null;
        project = registerProject;
        projectId = registerProject ? registerProject.id : "";
      } catch (error) {
        project = null;
        projectId = "";
      }
    }

    if (scopeMode === "register") {
      geometryId = "";
      if (inspectorMode === "polygon" || inspectorMode === "geometry" || inspectorMode === "project") inspectorMode = locationId ? "location" : "register";
      if (locationId && register) {
        var locations = recordLocations(register, workspace);
        if (!locations.some(function (location) { return location && location.id === locationId; })) locationId = "";
      } else if (!register) locationId = "";
    } else {
      locationId = "";
      if (inspectorMode === "location" || inspectorMode === "register") inspectorMode = geometryId ? "polygon" : "project";
      if (geometry && projectId && text(geometry.projectId || geometry.payload && geometry.payload.projectId) !== projectId) {
        geometryId = "";
        inspectorMode = "project";
      }
      if (!geometryId && inspectorMode === "polygon") inspectorMode = "geometry";
    }

    return {
      scopeMode: scopeMode,
      ownerMode: text((scopeMode === "projects" && project && project.owner) || (register && register.owner) || mapUi.ownerMode || ui.ownerMode),
      selectedRegisterId: registerId,
      selectedProjectId: projectId,
      selectedLocationId: locationId,
      selectedGeometryId: geometryId,
      inspectorMode: inspectorMode
    };
  }

  function applyCanonicalMapState(workspace) {
    var state = canonicalMapState(workspace);
    sidebarScopeMode = state.scopeMode;
    selectedEventFilterId = sidebarScopeMode === "projects" ? (state.selectedProjectId || "all") : (state.selectedRegisterId || "all");
    selectedShapeId = state.selectedGeometryId || null;
    var owner = state.ownerMode || workspace && workspace.workspace && workspace.workspace.ownerMode;
    sidebarViewMode = sidebarScopeMode === "projects" && (state.inspectorMode === "geometry" || state.inspectorMode === "polygon")
      ? "shapes"
      : (owner === "EVT" ? "events" : "applications");
    return state;
  }

  function storedMapStateMatches(workspace, state) {
    var mapUi = workspace && workspace.workspace && workspace.workspace.map || {};
    return (mapUi.scopeMode === state.scopeMode) &&
      text(mapUi.ownerMode) === text(state.ownerMode) &&
      text(mapUi.selectedRegisterId) === text(state.selectedRegisterId) &&
      text(mapUi.selectedProjectId) === text(state.selectedProjectId) &&
      text(mapUi.selectedLocationId) === text(state.selectedLocationId) &&
      text(mapUi.selectedGeometryId) === text(state.selectedGeometryId) &&
      text(mapUi.inspectorMode) === text(state.inspectorMode);
  }

  function writeCanonicalMapState(candidate, patch) {
    candidate.workspace = candidate.workspace || {};
    var existing = canonicalMapState(candidate);
    var next = Object.assign({}, existing, patch || {});
    next.scopeMode = next.scopeMode === "projects" ? "projects" : "register";
    if (["register", "location", "project", "geometry", "polygon"].indexOf(next.inspectorMode) < 0) next.inspectorMode = next.scopeMode === "projects" ? "project" : "register";
    if (next.scopeMode === "register") {
      next.selectedGeometryId = "";
      if (next.inspectorMode === "polygon" || next.inspectorMode === "geometry" || next.inspectorMode === "project") next.inspectorMode = next.selectedLocationId ? "location" : "register";
    } else {
      next.selectedLocationId = "";
      if (next.inspectorMode === "location" || next.inspectorMode === "register") next.inspectorMode = next.selectedGeometryId ? "polygon" : "project";
    }
    candidate.workspace.map = candidate.workspace.map || {};
    candidate.workspace.map.scopeMode = next.scopeMode;
    candidate.workspace.map.ownerMode = next.ownerMode || candidate.workspace.ownerMode || "";
    candidate.workspace.map.selectedRegisterId = next.selectedRegisterId || "";
    candidate.workspace.map.selectedProjectId = next.selectedProjectId || "";
    candidate.workspace.map.selectedLocationId = next.selectedLocationId || "";
    candidate.workspace.map.selectedGeometryId = next.selectedGeometryId || "";
    candidate.workspace.map.inspectorMode = next.inspectorMode;
    if (next.selectedRegisterId) candidate.workspace.selectedEntityId = next.selectedRegisterId;
    if (next.selectedProjectId) candidate.workspace.selectedProjectId = next.selectedProjectId;
    return candidate;
  }

  function persistCanonicalMapState(patch) {
    if (!root.UOS || !root.UOS.ProgramApp || typeof root.UOS.ProgramApp.updateWorkspace !== "function") return Promise.resolve(getWorkspace());
    /*
     * Map rendering is driven by `uos:program-ready`.  Do not enqueue an
     * otherwise identical workspace mutation: it creates another ready event
     * and can make an embedded map continuously tear down and initialise.
     */
    var workspace = getWorkspace();
    if (workspace) {
      var probe;
      try {
        probe = JSON.parse(JSON.stringify(workspace));
        var intendedState = canonicalMapState(writeCanonicalMapState(probe, patch));
        if (storedMapStateMatches(workspace, intendedState)) return Promise.resolve(workspace);
      } catch (error) {
        /* Let the validated application mutation provide the authoritative error path. */
      }
    }
    return root.UOS.ProgramApp.updateWorkspace(function (candidate) {
      return writeCanonicalMapState(candidate, patch);
    });
  }

  function isSessionCleared() {
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    return app && typeof app.isSessionCleared === "function" ? app.isSessionCleared() : false;
  }



  function getRemediationEventsList(ws) {
    var workspace = ws || getWorkspace();
    if (!workspace || !workspace.entities) return [];
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    if (sidebarScopeMode === "projects") {
      if (model && typeof model.getProjects === "function") {
        var canonicalProj = model.getProjects(workspace, "EVT");
        if (canonicalProj && canonicalProj.length) return canonicalProj;
      }
      return (workspace.entities.projects || []).filter(function (p) { return p.owner === "EVT"; });
    }
    if (model && typeof model.getRegisterEntities === "function") {
      var canonicalEvents = model.getRegisterEntities(workspace, "EVT");
      if (canonicalEvents && canonicalEvents.length) return canonicalEvents;
    }
    return (workspace.entities.events || []).filter(function (e) { return e.owner === "EVT"; });
  }

  function getApplicationsList(ws) {
    var workspace = ws || getWorkspace();
    if (!workspace || !workspace.entities) return [];
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    if (sidebarScopeMode === "projects") {
      if (model && typeof model.getProjects === "function") {
        var canonicalProj = model.getProjects(workspace, "NSA");
        if (canonicalProj && canonicalProj.length) return canonicalProj;
      }
      return (workspace.entities.projects || []).filter(function (p) { return p.owner === "NSA"; });
    }
    if (model && typeof model.getRegisterEntities === "function") {
      var canonicalApps = model.getRegisterEntities(workspace, "NSA");
      if (canonicalApps && canonicalApps.length) return canonicalApps;
    }
    return (workspace.entities.applications || []).filter(function (a) { return a.owner !== "EVT"; });
  }

  function resolveSelectedRecord(ws, id) {
    var ctx = resolveMapContext(ws, sidebarViewMode, sidebarScopeMode, id);
    return ctx.project || ctx.register || null;
  }

  function renderShapeCards() {
    var container = one("#shapeList");
    if (!container) return;
    var drawerMode = inRegisterDrawerMode();
    var geometries = getGeometriesForEvent(selectedEventFilterId);
    var shapes = convertToEventShapes(geometries);
    var currentWorkspace = getWorkspace();
    var linkedJobIds = Object.create(null);
    var allJobs = (currentWorkspace && currentWorkspace.entities && currentWorkspace.entities.jobs || []);
    allJobs.forEach(function (job) {
      var geometryId = text(job.sourceGeometryId || job.geometryId);
      if (geometryId) linkedJobIds[geometryId] = true;
    });

    if (eventSearchQuery) {
      shapes = shapes.filter(function (s) {
        var id = text(s.id).toLowerCase();
        var label = text(workTypeLabel(s.type)).toLowerCase();
        return id.indexOf(eventSearchQuery) >= 0 || label.indexOf(eventSearchQuery) >= 0;
      });
    }

    var shapePaneMode = editingShapeId ? "editor" : "inspector";
    container.setAttribute("data-map-shape-mode", shapePaneMode);
    var mapWorkspace = one(".program-map-workspace");
    if (drawerMode && mapWorkspace) mapWorkspace.setAttribute("data-map-area-panel", shapePaneMode);
    var backButtonHtml = editingShapeId
      ? '<button type="button" class="uos-button uos-button--secondary uos-button--sm" data-map-editor-back>← Back to polygons</button>'
      : '<button type="button" class="uos-button uos-button--secondary uos-button--sm" id="backToListButton">← Back to Mapped Locations</button>';
    var backBarHtml = '<div class="program-map-inspector-bar" data-map-inspector-controls data-mode="' + esc(shapePaneMode) + '">' + backButtonHtml + '<span>' + (editingShapeId ? "Polygon editor" : "Polygon inspector") + '</span></div>';

    if (!shapes.length) {
      container.innerHTML = backBarHtml + '<div class="program-map-empty" role="listitem">No mapped polygon shapes yet. Use Start drawing to add mapped work.</div>';
      var emptyInspectorBar = container.querySelector("[data-map-inspector-controls]");
      container.style.setProperty("--program-map-inspector-height", (emptyInspectorBar ? emptyInspectorBar.offsetHeight : 0) + "px");
      return;
    }

        var cardsHtml = shapes.map(function (shape, index) {
      var selected = shape.id === selectedShapeId;
      var editing = shape.id === editingShapeId;
      var geometryLabel = shape.geometryType === "line" ? (shape.closed ? "Closed line" : "Open line") : "Polygon";
      var geometry = (geometries || []).find(function (g) { return g.id === shape.id; });
      var geometryType = shape.type;
      var shapeTypeTitle = geometryType ? workTypeLabel(geometryType) : "Select work type…";
      var jobCreated = Boolean(linkedJobIds[shape.id]);
      var resolvedRate = (root.UOS.WorkAreaService && currentWorkspace && geometryType)
        ? root.UOS.WorkAreaService.resolveGeometryRate(currentWorkspace, geometry || { payload: shape.payload, workTypeKey: geometryType })
        : null;
      var eligibleRates = eligiblePolygonRates(currentWorkspace, geometryType);
      var selectedRateId = text(geometry && geometry.rateItemId || geometry && geometry.payload && geometry.payload.rateItemId || resolvedRate && resolvedRate.id);
      if (!eligibleRates.some(function (rate) { return text(rate && rate.id) === selectedRateId; })) selectedRateId = "";
      var canCreateJob = !jobCreated && Boolean(geometryType) && Boolean(resolvedRate);
      var jobLabel = jobCreated ? "Job created" : "Create Job";

      var jobTooltip = "";
      if (jobCreated) {
        jobTooltip = "Operational Job already generated in Job Calculator";
      } else if (!geometryType) {
        jobTooltip = "Select a valid work type before generating a Job";
      } else if (!eligibleRates.length) {
        jobTooltip = 'Work type "' + geometryType + '" has no active compatible pricing rates';
      } else if (!resolvedRate) {
        jobTooltip = "Select a pricing rate before generating a Job";
      } else {
        jobTooltip = "Generate operational Job and Costing Line from this polygon";
      }

      var jobBtnDisabled = jobCreated || !canCreateJob;
      var shapeNum = index + 1;

      var vertexHtml = "";
      if (editing && Array.isArray(shape.coordinates)) {
        vertexHtml = '<div class="rem-vertex-editor"><header><span>Vertices (' + shape.coordinates.length + ')</span></header><div class="rem-vertex-list">' +
          shape.coordinates.map(function (coord, vIdx) {
            var vSelected = vIdx === selectedVertexIndex;
            var num = vIdx + 1;
            return '<div class="rem-vertex-item' + (vSelected ? " rem-vertex-item--selected" : "") + '" data-vertex-index="' + vIdx + '">' +
              '<span class="rem-vertex-num">' + num + '</span>' +
              '<input type="number" step="any" class="uos-input rem-vertex-coord" data-coord-lat="' + vIdx + '" value="' + coord[1] + '" data-uos-tooltip="Vertex ' + num + ' Latitude" title="Vertex ' + num + ' Latitude" aria-label="Vertex ' + num + ' latitude">' +
              '<input type="number" step="any" class="uos-input rem-vertex-coord" data-coord-lng="' + vIdx + '" value="' + coord[0] + '" data-uos-tooltip="Vertex ' + num + ' Longitude" title="Vertex ' + num + ' Longitude" aria-label="Vertex ' + num + ' longitude">' +
              '<button type="button" class="uos-button uos-button--secondary uos-button--icon" data-delete-vertex="' + vIdx + '" data-uos-tooltip="Delete vertex ' + num + '" title="Delete vertex ' + num + '" aria-label="Remove vertex ' + num + '"><svg viewBox="0 0 24 24" aria-hidden="true" style="width:12px;height:12px;stroke-width:2.5;"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
            '</div>';
          }).join("") + '</div></div>';
      }

      return '<div class="program-shape-card' + (selected ? " is-selected" : "") + (editing ? " is-editing" : "") + '" data-shape-card-id="' + esc(shape.id) + '" role="region" aria-label="Polygon ' + shapeNum + ': ' + esc(shapeTypeTitle) + '"' + (drawerMode ? ' data-disclosure-skip' : '') + '>' +
        '<div class="program-shape-card__head">' +
          '<label class="program-shape-card__toggle" data-uos-tooltip="Toggle map visibility for polygon ' + shapeNum + '" title="Toggle map visibility for polygon ' + shapeNum + '"><input type="checkbox" data-shape-visible="' + esc(shape.id) + '"' + (shape.visible ? " checked" : "") + ' aria-label="Toggle map visibility for polygon ' + shapeNum + ': ' + esc(shapeTypeTitle) + '"><span>' + shapeNum + '. ' + esc(shapeTypeTitle) + '</span></label>' +
          '<span class="program-shape-card__measure" data-uos-tooltip="Measured dimensions: ' + esc(formatMeasure(shape)) + '" title="Measured dimensions: ' + esc(formatMeasure(shape)) + '">' + esc(formatMeasure(shape)) + '</span>' +
        '</div>' +
        '<div class="program-shape-card__controls">' +
          '<label class="uos-field"><span>Work type</span><select class="uos-select" data-shape-type="' + esc(shape.id) + '" data-uos-tooltip="Select work type rate category for polygon ' + shapeNum + '" title="Select work type rate category for polygon ' + shapeNum + '" aria-label="Work type for polygon ' + shapeNum + '">' + workTypeOptions(shape.type) + '</select></label>' +
          '<label class="uos-field"><span>Pricing Rate</span><select class="uos-select" data-shape-rate="' + esc(shape.id) + '"' + ((!geometryType || !eligibleRates.length) ? " disabled" : "") + ' data-uos-tooltip="Select the commercial pricing basis for polygon ' + shapeNum + '" title="Select the commercial pricing basis for polygon ' + shapeNum + '" aria-label="Pricing rate for polygon ' + shapeNum + '">' + polygonRateOptions(eligibleRates, selectedRateId, Boolean(geometryType)) + '</select></label>' +
        '</div>' +
        '<div class="program-shape-actions" role="group" aria-label="Shape actions for polygon ' + shapeNum + '">' +
          '<button type="button" class="uos-button uos-button--secondary uos-button--icon" data-shape-action="zoom" data-action-id="' + esc(shape.id) + '" data-uos-tooltip="Zoom map to polygon ' + shapeNum + '" title="Zoom map to polygon ' + shapeNum + '" aria-label="Zoom to polygon ' + shapeNum + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></button>' +
          '<button type="button" class="uos-button uos-button--sm ' + (editing ? "uos-button--primary is-active" : "uos-button--secondary") + '" data-shape-action="edit" data-action-id="' + esc(shape.id) + '" data-uos-tooltip="' + (editing ? "Finish editing and save vertex positions" : "Edit polygon corner points and shape vertices on map") + '" title="' + (editing ? "Finish editing and save vertex positions" : "Edit polygon corner points and shape vertices on map") + '" aria-label="' + (editing ? "Done editing vertices for polygon " + shapeNum : "Edit vertices for polygon " + shapeNum) + '" aria-pressed="' + (editing ? "true" : "false") + '"><svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;margin-right:4px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg><span>' + (editing ? "Done editing" : "Edit vertices") + '</span></button>' +
          '<button type="button" class="uos-button uos-button--secondary uos-button--icon" data-shape-action="duplicate" data-action-id="' + esc(shape.id) + '" data-uos-tooltip="Duplicate polygon ' + shapeNum + '" title="Duplicate polygon ' + shapeNum + '" aria-label="Duplicate polygon ' + shapeNum + '"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
          '<button type="button" class="uos-button uos-button--secondary uos-button--icon" data-shape-action="export" data-action-id="' + esc(shape.id) + '" data-uos-tooltip="Export polygon ' + shapeNum + ' as GeoJSON" title="Export polygon ' + shapeNum + ' as GeoJSON" aria-label="Export polygon ' + shapeNum + ' as GeoJSON"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg></button>' +
          '<button type="button" class="uos-button uos-button--secondary uos-button--icon" data-shape-action="delete" data-action-id="' + esc(shape.id) + '" data-uos-tooltip="Delete polygon ' + shapeNum + ' and linked costing" title="Delete polygon ' + shapeNum + ' and linked costing" aria-label="Delete polygon ' + shapeNum + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div>' +
        '<div class="program-shape-card__job-row">' +
          '<button type="button" class="uos-button uos-button--sm program-create-job-btn' + (jobCreated ? " is-created" : "") + '" data-create-shape-job="' + esc(shape.id) + '"' + (jobBtnDisabled ? " disabled" : "") + ' data-uos-tooltip="' + esc(jobTooltip) + '" title="' + esc(jobTooltip) + '" aria-label="' + esc(jobLabel + " for polygon " + shapeNum + ": " + jobTooltip) + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' + (jobCreated ? '<path d="m5 12 4 4L19 6"/>' : '<path d="M12 5v14M5 12h14"/>') + '</svg><span>' + jobLabel + '</span>' +
          '</button>' +
        '</div>' +
        vertexHtml +
      '</div>';
    }).join("");

    container.innerHTML = backBarHtml + cardsHtml;
    var inspectorBar = container.querySelector("[data-map-inspector-controls]");
    container.style.setProperty("--program-map-inspector-height", (inspectorBar ? inspectorBar.offsetHeight : 0) + "px");
  }

      function isPolygonGeometry(g) {
    if (!g || !g.projectId) return false;
    var kind = String(g.geometryKind || (g.payload && g.payload.geometryType) || "").toLowerCase();
    return kind === "polygon" || (!kind && Array.isArray(g.coordinates) && g.coordinates.length >= 3);
  }

  function buildSpatialFilterIndex(workspace, ownerMode) {
    workspace = workspace || getWorkspace() || { entities: {} };
    var events = Array.isArray(workspace.entities && workspace.entities.events) ? workspace.entities.events : [];
    var apps = Array.isArray(workspace.entities && workspace.entities.applications) ? workspace.entities.applications : [];
    var projects = Array.isArray(workspace.entities && workspace.entities.projects) ? workspace.entities.projects : [];
    var geometries = Array.isArray(workspace.entities && workspace.entities.geometries) ? workspace.entities.geometries : [];

    var targetOwner = ownerMode || (sidebarViewMode === "applications" ? "NSA" : "EVT");

    var registerById = Object.create(null);
    var registerLocationCountById = Object.create(null);
    var registerLocationsById = Object.create(null);

    (targetOwner === "NSA" ? apps : events).forEach(function (rec) {
      if (!rec || !rec.id) return;
      registerById[rec.id] = rec;
      var locs = recordLocations(rec, targetOwner);
      registerLocationCountById[rec.id] = locs.length;
      registerLocationsById[rec.id] = locs;
    });

    var projectById = Object.create(null);
    var projectByRegisterId = Object.create(null);
    var projectConflictByRegisterId = Object.create(null);
    var polygonCountByProjectId = Object.create(null);
    var projectWorkGeometriesById = Object.create(null);

    projects.forEach(function (proj) {
      if (!proj || !proj.id) return;
      if (proj.owner === targetOwner || (!proj.owner && targetOwner === "EVT")) {
        projectById[proj.id] = proj;
        polygonCountByProjectId[proj.id] = 0;
        projectWorkGeometriesById[proj.id] = [];
      }
    });

    Object.keys(registerById).forEach(function (registerId) {
      var model = root.UOS && root.UOS.ProgramModel;
      var linked = model && typeof model.activeProjectsForRegister === "function"
        ? model.activeProjectsForRegister(workspace, registerId).filter(function (project) { return project.owner === targetOwner; })
        : [];
      if (linked.length === 1) projectByRegisterId[registerId] = linked[0];
      else if (linked.length > 1) projectConflictByRegisterId[registerId] = linked.map(function (project) { return project.id; });
    });

    geometries.forEach(function (g) {
      if (!g || !g.projectId) return;
      if (projectWorkGeometriesById[g.projectId]) {
        projectWorkGeometriesById[g.projectId].push(g);
        if (isPolygonGeometry(g)) {
          polygonCountByProjectId[g.projectId] = (polygonCountByProjectId[g.projectId] || 0) + 1;
        }
      }
    });

    return {
      owner: targetOwner,
      registerById: registerById,
      registerLocationCountById: registerLocationCountById,
      registerLocationsById: registerLocationsById,
      projectById: projectById,
      projectByRegisterId: projectByRegisterId,
      projectConflictByRegisterId: projectConflictByRegisterId,
      polygonCountByProjectId: polygonCountByProjectId,
      projectWorkGeometriesById: projectWorkGeometriesById
    };
  }

function matchesSpatialFilter(item, scope, filter, index) {
  if (!item) return false;
    var id = item.id || item.eventId || item.applicationId;

  if (scope === "register") {
    var locCount = index.registerLocationCountById[id] || 0;
    if (!filter) return locCount > 0;
      if (filter === "location") return locCount > 0;
      if (filter === "no-location") return locCount === 0;
  } else if (scope === "projects") {
    var polyCount = index.polygonCountByProjectId[id] || 0;
    if (!filter) return polyCount > 0;
      if (filter === "polygon") return polyCount > 0;
      if (filter === "no-polygon") return polyCount === 0;
    }
    return true;
  }

  function normalizedStatus(value) {
    return text(value).toLowerCase();
  }

  function effectiveMapStatus(item, viewMode) {
    return text((item && item.status) || (viewMode === "applications" ? "Received" : "Active"));
  }

  function resolveFilteredMapDataset(workspace, viewMode, scopeMode, spatialFilter, statusFilters, searchQuery) {
    workspace = workspace || getWorkspace() || { entities: {} };
    var owner = viewMode === "applications" ? "NSA" : "EVT";
    var scope = scopeMode || "register";
    var index = buildSpatialFilterIndex(workspace, owner);

    var rawItems = [];
    if (scope === "projects") {
      var allProjs = (workspace.entities && workspace.entities.projects) || [];
      rawItems = allProjs.filter(function (p) { return p.owner === owner; });
    } else {
      rawItems = owner === "NSA" ? ((workspace.entities && workspace.entities.applications) || []) : ((workspace.entities && workspace.entities.events) || []);
    }

    var normalizedStatusFilters = (statusFilters || []).map(normalizedStatus);
    var filteredItems = rawItems.filter(function (item) {
      if (normalizedStatusFilters.length > 0) {
        var statusStr = normalizedStatus(effectiveMapStatus(item, viewMode));
        if (normalizedStatusFilters.indexOf(statusStr) < 0) return false;
      }

      if (!matchesSpatialFilter(item, scope, spatialFilter, index)) {
        return false;
      }

      if (searchQuery) {
        var id = text(item.id || item.eventId || item.applicationId).toLowerCase();
        var name = text(item.eventName || item.title || item.name).toLowerCase();
        var loc = text(item.location || item.address).toLowerCase();
        var status = text(item.status).toLowerCase();
        if (id.indexOf(searchQuery) < 0 && name.indexOf(searchQuery) < 0 && loc.indexOf(searchQuery) < 0 && status.indexOf(searchQuery) < 0) {
          return false;
        }
      }
      return true;
    });

    var filteredRecordIds = Object.create(null);
    var filteredLocations = [];
    var seenCoords = Object.create(null);
    var filteredGeometries = [];

    filteredItems.forEach(function (item) {
      var id = item.id || item.eventId || item.applicationId;
      filteredRecordIds[id] = true;

      if (scope === "register") {
        var locs = index.registerLocationsById[id] || [];
        locs.forEach(function (loc) {
          var key = loc.coordinate[0] + ":" + loc.coordinate[1];
          if (!seenCoords[key]) {
            seenCoords[key] = true;
            filteredLocations.push(loc);
          }
        });
      } else {
        var geoms = index.projectWorkGeometriesById[id] || [];
        Array.prototype.push.apply(filteredGeometries, geoms);

        var rId = item.eventId || item.applicationId;
        var rLocs = (rId && index.registerLocationsById[rId]) || [];
        rLocs.forEach(function (loc) {
          var key = loc.coordinate[0] + ":" + loc.coordinate[1];
          if (!seenCoords[key]) {
            seenCoords[key] = true;
            filteredLocations.push(loc);
          }
        });
      }
    });

    return {
      index: index,
      scope: scope,
      owner: owner,
      items: filteredItems,
      filteredRecordIds: filteredRecordIds,
      locations: filteredLocations,
      geometries: filteredGeometries
    };
  }

  var selectedStatusFilters = [];
var selectedSpatialFilter = null;

  function renderSpatialFilterPills(filterIndex) {
    var container = one("#mapSpatialFilterPills");
    if (!container) return;

    var isRegisterScope = sidebarScopeMode === "register";
    var index = filterIndex || buildSpatialFilterIndex(getWorkspace(), sidebarViewMode === "applications" ? "NSA" : "EVT");

    var pillsHtml = "";
    if (isRegisterScope) {
      var locCount = 0;
      var noLocCount = 0;
      var regIds = Object.keys(index.registerLocationCountById);
      regIds.forEach(function (id) {
        if (index.registerLocationCountById[id] > 0) locCount++;
        else noLocCount++;
      });

      var isLocActive = selectedSpatialFilter === "location";
      var isNoLocActive = selectedSpatialFilter === "no-location";

      pillsHtml = '<button type="button" class="program-status-pill-filter program-spatial-pill-filter' + (isLocActive ? ' is-active' : '') + '" data-map-spatial-filter="location" aria-pressed="' + String(isLocActive) + '" data-uos-tooltip="Filter records with at least one location pin" title="Filter records with at least one location pin">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:12px;height:12px;stroke-width:2.5;"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 9a8 8 0 1 0-16 0c0 4 2.7 8 8 12.7z"/></svg>' +
        '<span>Location</span>' +
        '<span class="program-status-pill-count">' + locCount + '</span>' +
      '</button>' +
      '<button type="button" class="program-status-pill-filter program-spatial-pill-filter' + (isNoLocActive ? ' is-active' : '') + '" data-map-spatial-filter="no-location" aria-pressed="' + String(isNoLocActive) + '" data-uos-tooltip="Filter records with no location pins" title="Filter records with no location pins">' +
        '<span>No Location</span>' +
        '<span class="program-status-pill-count">' + noLocCount + '</span>' +
      '</button>';
    } else {
      var polyCount = 0;
      var noPolyCount = 0;
      var projIds = Object.keys(index.polygonCountByProjectId);
      projIds.forEach(function (id) {
        if (index.polygonCountByProjectId[id] > 0) polyCount++;
        else noPolyCount++;
      });

      var isPolyActive = selectedSpatialFilter === "polygon";
      var isNoPolyActive = selectedSpatialFilter === "no-polygon";

      pillsHtml = '<button type="button" class="program-status-pill-filter program-spatial-pill-filter' + (isPolyActive ? ' is-active' : '') + '" data-map-spatial-filter="polygon" aria-pressed="' + String(isPolyActive) + '" data-uos-tooltip="Filter delivery projects with mapped polygons" title="Filter delivery projects with mapped polygons">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:12px;height:12px;stroke-width:2.5;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
        '<span>Polygon</span>' +
        '<span class="program-status-pill-count">' + polyCount + '</span>' +
      '</button>' +
      '<button type="button" class="program-status-pill-filter program-spatial-pill-filter' + (isNoPolyActive ? ' is-active' : '') + '" data-map-spatial-filter="no-polygon" aria-pressed="' + String(isNoPolyActive) + '" data-uos-tooltip="Filter delivery projects with no mapped polygons" title="Filter delivery projects with no mapped polygons">' +
        '<span>No Polygon</span>' +
        '<span class="program-status-pill-count">' + noPolyCount + '</span>' +
      '</button>';
    }

    container.innerHTML = pillsHtml;
  }

  function renderStatusFilterPills() {
    var container = one("#mapStatusFilterPills");
    if (!container) return;

    var rawItems = sidebarViewMode === "applications" ? getApplicationsList() : getRemediationEventsList();
    var possibleStatuses = sidebarViewMode === "applications" ?
      ["Draft", "Received", "Submitted", "Under Review", "Approved", "On Hold"] :
      ["Quoted", "Planned", "In Progress", "Complete", "On Hold", "Draft"];

    var statusLabelsByKey = Object.create(null);
    possibleStatuses.forEach(function (statusVal) {
      statusLabelsByKey[normalizedStatus(statusVal)] = statusVal;
    });
    rawItems.forEach(function (it) {
      var statusVal = effectiveMapStatus(it, sidebarViewMode);
      var statusKey = normalizedStatus(statusVal);
      if (!statusLabelsByKey[statusKey]) {
        statusLabelsByKey[statusKey] = statusVal;
        possibleStatuses.push(statusVal);
      }
    });

    var pillsHtml = possibleStatuses.map(function (statusVal) {
      var slug = statusVal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      var isActive = selectedStatusFilters.some(function (filter) {
        return normalizedStatus(filter) === normalizedStatus(statusVal);
      });
      var count = rawItems.filter(function (it) {
        return normalizedStatus(effectiveMapStatus(it, sidebarViewMode)) === normalizedStatus(statusVal);
      }).length;
      return '<button type="button" class="program-status-pill-filter status--' + esc(slug) + (isActive ? ' is-active' : '') + '" data-map-status-filter="' + esc(statusVal) + '" aria-pressed="' + String(isActive) + '">' +
        '<span>' + esc(statusVal) + '</span>' +
        '<span class="program-status-pill-count">' + count + '</span>' +
      '</button>';
    }).join("");

    container.innerHTML = pillsHtml;
    var badge = document.querySelector('[data-filter-drawer-badge="map"]');
    if (badge) {
      var actCount = (eventSearchQuery ? 1 : 0) + (selectedStatusFilters || []).length + (selectedSpatialFilter ? 1 : 0);
      badge.textContent = String(actCount);
      badge.hidden = (actCount === 0);
    }
  }

  function checkRecordHasGeom(rec, ws) {
    if (!rec) return false;
    // Register records own Location Pins
    var locs = recordLocations(rec);
    if (locs.length > 0) return true;
    // Projects own Work Geometries
    var id = rec.id;
    var model = root.UOS && root.UOS.ProgramModel;
    var geometries = model && typeof model.projectWorkGeometry === "function" ? model.projectWorkGeometry(ws, id) : [];
    return geometries.some(isPolygonGeometry);
  }

  function renderEventPicker() {
    var container = one("#eventPickerList");
    if (!container) return;
    var isRegisterScope = sidebarScopeMode === "register";
    var isRegisterDrawer = isRegisterScope && inRegisterDrawerMode();
    /* Location Cards in a Register drawer and Project Polygon Summaries are
       full-size operational surfaces, never disclosure rows. */
    var isAlwaysExpandedCard = isRegisterDrawer || !isRegisterScope;
    container.setAttribute("data-disclosure-metric-heading", isRegisterScope ? "Location" : "Areas");

    var workspace = getWorkspace();
    var mapState = canonicalMapState(workspace);
    var expectedOwner = sidebarViewMode === "applications" ? "NSA" : "EVT";
    var activeRegister = null;
    if (isRegisterDrawer && mapState.selectedRegisterId) {
      activeRegister = ((workspace.entities && workspace.entities.applications) || [])
        .concat((workspace.entities && workspace.entities.events) || [])
        .find(function (record) {
          return record && record.id === mapState.selectedRegisterId && record.owner === expectedOwner;
        }) || null;
    }
    var dataset = resolveFilteredMapDataset(workspace, sidebarViewMode, sidebarScopeMode, selectedSpatialFilter, selectedStatusFilters, eventSearchQuery);

    var geometryCounts = Object.create(null);
    geometryCounts = dataset.index.polygonCountByProjectId || geometryCounts;

    renderSpatialFilterPills(dataset.index);
    renderStatusFilterPills();

    if (selectedEventFilterId && selectedEventFilterId !== "all" && !dataset.filteredRecordIds[selectedEventFilterId] && !activeRegister) {
      selectedEventFilterId = "all";
      /*
       * This is a presentation fallback (for example, when a map filter
       * excludes the selected project).  Persisting it here re-enters render
       * through `uos:program-ready` and caused the Project map to flicker.
       * User selection and navigation handlers remain the only writers.
       */
    }

    if (mapController && typeof mapController.setEvent === "function") {
      mapController.setEvent(buildMapEvent(selectedEventFilterId, dataset));
    }

    var items = dataset.items;
    /* Project mode is an active-project inspector. Its zero-polygon state is
       still actionable, so retain the selected linked Project even when the
       filtered map dataset has no rendered geometry. */
    if (!isRegisterScope && mapState.selectedProjectId) {
      var activeProject = ((workspace.entities && workspace.entities.projects) || []).find(function (project) {
    return project && project.id === mapState.selectedProjectId && (!project.owner || project.owner === expectedOwner);
      }) || null;
      if (activeProject) items = [activeProject];
    }
    /* The Location sidebar is a working-record inspector, not a second
       Register browser.  Keep the active Register visible even before its
       first pin exists, and never mix unrelated Register cards into that
       record's context. */
    if (activeRegister) items = [activeRegister];

    if (!items.length) {
      container.innerHTML = '<div class="program-map-notice" role="listitem">No ' + (sidebarScopeMode === "projects" ? "Delivery project" : (sidebarViewMode === "applications" ? "Nature Strip application" : "Remediation event")) + ' records match your search or active filters.</div>';
      return;
    }

    var eventCardsHtml = items.map(function (item) {
      var id = item.id || item.eventId || item.applicationId;
      var owner = item.owner || (id.indexOf("NSA") === 0 ? "NSA" : (sidebarViewMode === "applications" ? "NSA" : "EVT"));
      var sourceId = item.applicationId || item.eventId || id;
      var sourceRecord = (workspace.entities.events || []).concat(workspace.entities.applications || []).find(function (record) { return record.id === sourceId; }) || item;
      var name = sourceRecord.eventName || sourceRecord.title || sourceRecord.name || item.eventName || item.title || item.name || id;

      var rawLocAddress = text(typeof sourceRecord.location === "object" ? (sourceRecord.location.name || sourceRecord.location.address || sourceRecord.address) : (sourceRecord.address || sourceRecord.location));
      if (!rawLocAddress || rawLocAddress.toLowerCase() === "mapped location") {
        rawLocAddress = "No location address specified";
      }

      var locations = dataset.index.registerLocationsById[sourceRecord.id] || recordLocations(sourceRecord);
      if (!locations.length && item !== sourceRecord) {
        locations = dataset.index.registerLocationsById[item.id] || recordLocations(item);
      }
      var isLocRecorded = locations.length > 0;
      var locationPinCount = locations.length;
      var locationPillText = locationPinCount === 1 ? "1 location" : (locationPinCount + " locations");
      var locPillClass = isLocRecorded ? "program-card-pill--recorded" : "program-card-pill--missing";
      var selectedLocation = isRegisterScope && mapState.selectedRegisterId === id && mapState.selectedLocationId
        ? locations.find(function (location) { return location && location.id === mapState.selectedLocationId; }) || null
        : null;

      var shapeCount = geometryCounts[id] || 0;
      var polygonPillText = shapeCount === 1 ? "1 polygon" : (shapeCount + " polygons");
      var polyPillClass = shapeCount > 0 ? "program-card-pill--poly" : "program-card-pill--missing";
      var buttonLabel = shapeCount > 0 ? "Edit Polygons" : "Add Polygons";

      var isSelected = selectedEventFilterId === id;

      var linkedProj = sidebarScopeMode === "projects" ? item : (dataset.index.projectByRegisterId[item.id] || null);
      var projIdVal = item.projectId || (linkedProj ? linkedProj.id : "");

      var regId = isRegisterScope ? id : (item.eventId || item.applicationId || "");
      var projId = isRegisterScope ? (projIdVal || "") : id;

      var iconSvg = owner === "EVT"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m12 13 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2-1.5-1.5 2-.3Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';

      var bottomControlsHtml = "";
      if (isRegisterScope) {
        var locationActionHtml = "";
        locationActionHtml =
          '<button type="button" class="uos-button uos-button--secondary uos-button--sm program-card-action-btn" data-location-action="add" data-location-event-id="' + esc(id) + '" title="Add another location pin">Add pin</button>';
        if (locationPinCount === 1) {
          locationActionHtml +=
            '<button type="button" class="uos-button uos-button--secondary uos-button--sm program-card-action-btn" data-location-action="move" data-location-event-id="' + esc(id) + '" data-location-id="' + esc(locations[0].id) + '" title="Move this location pin">Move</button>' +
            '<button type="button" class="uos-button uos-button--secondary uos-button--sm program-card-action-btn uos-button--danger-text" data-location-action="delete" data-location-event-id="' + esc(id) + '" data-location-id="' + esc(locations[0].id) + '" title="Remove this location pin">Remove</button>';
        } else if (locationPinCount > 1) {
          locationActionHtml +=
            '<button type="button" class="uos-button uos-button--secondary uos-button--sm program-card-action-btn" data-inspect-locations="' + esc(id) + '" title="Move or remove individual location pins">Manage pins</button>';
        }
        var selectedLocationHtml = "";
        if (selectedLocation) {
          var coordinate = Array.isArray(selectedLocation.coordinate) ? selectedLocation.coordinate : [];
          var coordinateLabel = coordinate.length >= 2
            ? Number(coordinate[1]).toFixed(5) + ", " + Number(coordinate[0]).toFixed(5)
            : "Coordinates unavailable";
          selectedLocationHtml =
            '<div class="program-location-context-card" data-selected-location-card="' + esc(selectedLocation.id) + '">' +
              '<div class="program-location-context-card__head">' +
                '<span class="program-location-context-card__eyebrow">Selected location</span>' +
                '<strong>' + esc(selectedLocation.name || selectedLocation.address || "Location pin") + '</strong>' +
              '</div>' +
              '<span class="program-location-context-card__coord">' + esc(coordinateLabel) + '</span>' +
              '<div class="program-location-context-card__actions">' +
                '<button type="button" class="uos-button uos-button--secondary uos-button--sm" data-pin-action="zoom" data-pin-id="' + esc(selectedLocation.id) + '" data-pin-reg-id="' + esc(id) + '">Zoom</button>' +
                '<button type="button" class="uos-button uos-button--secondary uos-button--sm" data-pin-action="move" data-pin-id="' + esc(selectedLocation.id) + '" data-pin-reg-id="' + esc(id) + '">Move</button>' +
                '<button type="button" class="uos-button uos-button--secondary uos-button--sm uos-button--danger-text" data-pin-action="delete" data-pin-id="' + esc(selectedLocation.id) + '" data-pin-reg-id="' + esc(id) + '">Remove</button>' +
              '</div>' +
            '</div>';
        }
        bottomControlsHtml =
          '<div class="program-event-card__divider"></div>' +
          '<div class="program-event-card__action-row">' +
            '<button type="button" class="program-card-pill ' + locPillClass + '" data-inspect-locations="' + esc(id) + '" title="Click to inspect and manage location pins">' +
              esc(locationPillText) +
            '</button>' +
            locationActionHtml +
          '</div>' +
          selectedLocationHtml;
      } else {
        bottomControlsHtml =
          '<div class="program-event-card__divider"></div>' +
          '<div class="program-event-card__action-row">' +
            '<span class="program-card-pill ' + polyPillClass + '">' + esc(polygonPillText) + '</span>' +
            '<button type="button" class="uos-button uos-button--secondary uos-button--sm program-card-action-btn" data-edit-event-id="' + esc(id) + '" title="' + esc(buttonLabel) + '">' +
              esc(buttonLabel) +
            '</button>' +
          '</div>';
      }

      var promoteButtonHtml = "";
      var projectConflict = isRegisterScope && dataset.index.projectConflictByRegisterId[id];
      if (projectConflict) {
        promoteButtonHtml = '<div class="program-event-card__divider"></div>' +
          '<div class="program-event-card__actions-row"><span role="alert">Project relationship conflict — review Data Health</span></div>';
      } else if (isRegisterScope && !projIdVal) {
        promoteButtonHtml = '<div class="program-event-card__divider"></div>' +
          '<div class="program-event-card__actions-row">' +
            '<button type="button" class="uos-button uos-button--secondary uos-button--sm program-event-promote-btn" data-promote-register-id="' + esc(id) + '" title="Create Delivery Project">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:13px;height:13px;stroke-width:2.5;"><path d="M12 5v14M5 12h14"/></svg>' +
              '<span>Create Delivery Project</span>' +
            '</button>' +
          '</div>';
      }

      return '<div class="program-event-card' + (isSelected ? " is-selected" : "") + '" data-event-card-id="' + esc(id) + '" data-owner="' + esc(owner) + '"' + (isAlwaysExpandedCard ? ' data-disclosure-skip' : '') + ' role="listitem" tabindex="0">' +
        '<div class="program-event-card__head">' +
          '<div class="program-event-card__head-left">' +
            '<div class="program-event-card__icon-badge program-event-card__icon-badge--' + esc(owner.toLowerCase()) + '">' + iconSvg + '</div>' +
            '<h5>' + esc(name) + '</h5>' +
          '</div>' +
        '</div>' +
        '<div class="program-event-card__divider"></div>' +
        '<div class="program-event-card__id-section">' +
          (regId ? '<div class="program-event-card__id-row"><svg class="program-event-card__id-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span class="program-event-card__id-label">Register ID:</span><span class="program-event-card__id-value">' + esc(regId) + '</span></div>' : '') +
          (projId ? '<div class="program-event-card__id-row"><svg class="program-event-card__id-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span class="program-event-card__id-label">Project ID:</span><span class="program-event-card__id-value">' + esc(projId) + '</span></div>' : '') +
        '</div>' +
        '<div class="program-event-card__divider"></div>' +
        '<div class="program-event-card__loc-section">' +
          '<div class="program-event-card__loc-row" title="' + esc(rawLocAddress) + '">' +
            '<svg class="program-event-card__loc-pin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 9a8 8 0 1 0-16 0c0 4 2.7 8 8 12.7z"/></svg>' +
            '<span class="program-event-card__loc-text">' + esc(rawLocAddress) + '</span>' +
          '</div>' +
        '</div>' +
        bottomControlsHtml +
        promoteButtonHtml +
      '</div>';
    }).join("");

    container.innerHTML = eventCardsHtml;
  }

  
  function openLocationInspector(recordId) {
    var workspace = getWorkspace();
    var record = (workspace.entities.events || []).concat(workspace.entities.applications || []).find(function (r) { return r.id === recordId; });
    if (!record) return;
    var dialog = one("#locationInspectorDialog");
    if (!dialog) return;

    var titleElem = dialog.querySelector("[data-inspector-title]") || dialog.querySelector("h2");
    if (titleElem) titleElem.textContent = "Location pins  -  " + (record.title || record.eventName || record.name || record.id);

    var listElem = dialog.querySelector("[data-inspector-pin-list]");
    var pins = recordLocations(record);
    if (listElem) {
      if (!pins.length) {
        listElem.innerHTML = '<p class="program-map-notice">No location pins recorded for this register record.</p>';
      } else {
        listElem.innerHTML = pins.map(function (pin, idx) {
          return '<div class="program-location-pin-row" data-pin-id="' + esc(pin.id) + '">' +
            '<div class="program-location-pin-info">' +
              '<strong>' + (idx + 1) + '. ' + esc(pin.name || "Location Pin " + (idx + 1)) + '</strong>' +
              '<span>' + esc(pin.coordinate[0].toFixed(5)) + ', ' + esc(pin.coordinate[1].toFixed(5)) + '</span>' +
            '</div>' +
            '<div class="program-location-pin-actions">' +
              '<button type="button" class="uos-button uos-button--secondary uos-button--sm" data-pin-action="zoom" data-pin-id="' + esc(pin.id) + '" data-pin-reg-id="' + esc(record.id) + '">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/></svg><span>Zoom</span>' +
              '</button>' +
              '<button type="button" class="uos-button uos-button--secondary uos-button--sm" data-pin-action="move" data-pin-id="' + esc(pin.id) + '" data-pin-reg-id="' + esc(record.id) + '">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/><circle cx="12" cy="9" r="2"/></svg><span>Move</span>' +
              '</button>' +
              '<button type="button" class="uos-button uos-button--secondary uos-button--sm uos-button--danger-text" data-pin-action="delete" data-pin-id="' + esc(pin.id) + '" data-pin-reg-id="' + esc(record.id) + '">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>Delete</span>' +
              '</button>' +
            '</div>' +
          '</div>';
        }).join("");
      }
    }

    var addBtn = dialog.querySelector("[data-inspector-add-pin]");
    if (addBtn) {
      addBtn.setAttribute("data-location-event-id", record.id);
      addBtn.setAttribute("title", "Add another location pin");
      // Add another location
    }

    if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
  }

  function updateSidebarViewUI() {
    var drawerMode = inRegisterDrawerMode();
    // Drawer mounting is presentation only. It must never rewrite the canonical
    // Space Map scope or inspector selection.
    // Work Geometry and its inspector are Project-owned in the v3 model.
    // Register scope must never retain a stale Project inspector pane.
    if (sidebarScopeMode !== "projects" && sidebarViewMode === "shapes") {
      var activeWorkspace = getWorkspace();
      var activeOwner = activeWorkspace && activeWorkspace.workspace && activeWorkspace.workspace.ownerMode;
      sidebarViewMode = activeOwner === "EVT" ? "events" : "applications";
    }
    var mapLayout = one(".program-map-layout");
    if (mapLayout) {
      mapLayout.classList.toggle("is-nature-mode", sidebarViewMode === "applications");
    }
    if (window.UOS && window.UOS.ProgramApp && typeof window.UOS.ProgramApp.updateRailTheme === "function") window.UOS.ProgramApp.updateRailTheme();

    var shapesPane = one('[data-sidebar-pane="shapes"]');
    var listPane = one('[data-sidebar-pane="list"]');

    if (sidebarViewMode === "shapes") {
      if (shapesPane) shapesPane.hidden = false;
      if (listPane) listPane.hidden = true;
      renderShapeCards();
    } else {
      if (shapesPane) shapesPane.hidden = true;
      if (listPane) listPane.hidden = false;
      renderEventPicker();
    }
  }

  function leavePolygonInspector() {
    if (editingShapeId && mapController && typeof mapController.editShape === "function") mapController.editShape(null);
    editingShapeId = null;
    selectedVertexIndex = null;
    persistCanonicalMapState({ selectedGeometryId: "", inspectorMode: "project" });
  }

  function leavePolygonEditor() {
    if (editingShapeId && mapController && typeof mapController.editShape === "function") mapController.editShape(null);
    editingShapeId = null;
    selectedVertexIndex = null;
    renderShapeCards();
  }

  function settleMapCardSelection(attribute, selectedId) {
    all("#eventPickerList > [data-event-card-id], #shapeList > [data-shape-card-id]").forEach(function (card) {
      card.classList.remove("is-navigation-focus");
      if (!card.hasAttribute(attribute)) return;
      var selected = card.getAttribute(attribute) === selectedId;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-selected", String(selected));
    });
  }

  function filterMapByEvent(eventId, switchSidebarToShapes) {
    var targetId = eventId || "all";
    var selectionWorkspace = getWorkspace();
    var currentState = canonicalMapState(selectionWorkspace);
    var selectionContext = resolveMapContext(selectionWorkspace, sidebarViewMode, currentState.scopeMode, targetId);
    var statePatch = {};
    if (currentState.scopeMode === "projects") {
      statePatch.scopeMode = "projects";
      statePatch.selectedProjectId = selectionContext.projectId || (targetId === "all" ? "" : targetId);
      statePatch.selectedRegisterId = selectionContext.registerId || "";
      statePatch.selectedLocationId = "";
      statePatch.selectedGeometryId = switchSidebarToShapes ? (currentState.selectedGeometryId || "") : "";
      statePatch.inspectorMode = switchSidebarToShapes ? (statePatch.selectedGeometryId ? "polygon" : "geometry") : "project";
    } else {
      statePatch.scopeMode = "register";
      statePatch.selectedRegisterId = selectionContext.registerId || (targetId === "all" ? "" : targetId);
      statePatch.selectedProjectId = selectionContext.projectId || "";
      statePatch.selectedLocationId = "";
      statePatch.selectedGeometryId = "";
      statePatch.inspectorMode = "register";
    }

    return persistCanonicalMapState(statePatch).then(function () {
      var committed = getWorkspace();
      applyCanonicalMapState(committed);
      renderEventPicker();
      settleMapCardSelection("data-event-card-id", selectedEventFilterId);
      ensureMapInstance();
      var mapEvent = buildMapEvent(selectedEventFilterId);
      if (mapController && typeof mapController.setEvent === "function") {
        mapController.setEvent(mapEvent);
        scheduleMapEventZoom();
      }
      updateSidebarViewUI();
      return committed;
    });
  }

  function scheduleMapEventZoom() {
    if (!mapController || typeof mapController.zoomToShapes !== "function") return;
    var zoom = function () {
      if (typeof mapController.resize === "function") mapController.resize();
      mapController.zoomToShapes();
    };
    if (typeof root.requestAnimationFrame === "function") {
      root.requestAnimationFrame(function () { root.requestAnimationFrame(zoom); });
    } else if (typeof root.setTimeout === "function") {
      root.setTimeout(zoom, 0);
    } else {
      zoom();
    }
  }

  function scheduleSelectedSidebarCardVisibility(targetId) {
    if (!targetId || targetId === "all") return;
    var visibility = root.UOS && root.UOS.ProgramCardVisibility;
    if (!visibility || typeof visibility.schedule !== "function") return;
    var reveal = function () {
      var pane = one('[data-sidebar-pane="list"]:not([hidden])');
      var card = pane && pane.querySelector('[data-event-card-id="' + esc(targetId) + '"]');
      if (card) visibility.schedule(card);
    };
    if (typeof root.requestAnimationFrame === "function") {
      root.requestAnimationFrame(function () { root.requestAnimationFrame(reveal); });
    } else if (typeof root.setTimeout === "function") {
      root.setTimeout(reveal, 0);
    } else {
      reveal();
    }
    if (typeof root.setTimeout === "function") root.setTimeout(reveal, 75);
  }

  function projectForTarget(candidate, targetId, owner) {
    var projects = candidate.entities && Array.isArray(candidate.entities.projects) ? candidate.entities.projects : [];
    var exact = projects.find(function (project) { return project.owner === owner && project.id === targetId; }) || null;
    if (exact) return exact;
    var model = root.UOS && root.UOS.ProgramModel;
    var linked = model && typeof model.activeProjectForRegister === "function"
      ? model.activeProjectForRegister(candidate, targetId)
      : null;
    return linked && linked.owner === owner ? linked : null;
  }

  function syncGeometry(candidate, geometryId, options) {
    if (!root.UOS.WorkAreaService) throw new Error("WorkAreaService is unavailable.");
    return root.UOS.WorkAreaService.syncGeometry(candidate, geometryId, options);
  }

  function geometryHasJob(candidate, geometryId) {
    return Boolean(candidate && candidate.entities && (candidate.entities.jobs || []).some(function (job) {
      return text(job.sourceGeometryId || job.geometryId) === geometryId;
    }));
  }

  function markGeometryAwaitingJob(candidate, geometryId) {
    if (!root.UOS.WorkAreaService || typeof root.UOS.WorkAreaService.updateGeometry !== "function") throw new Error("WorkAreaService is unavailable.");
    return root.UOS.WorkAreaService.updateGeometry(candidate, geometryId, {
      syncState: { code: "job-required", message: "Use Create Job on the polygon card to send this mapped work to the Job Calculator." }
    });
  }

  function syncExistingGeometryWork(candidate, geometryId) {
    return geometryHasJob(candidate, geometryId) || (candidate.entities.costingLines || []).some(function (line) { return line.sourceGeometryId === geometryId; }) ? syncGeometry(candidate, geometryId) : markGeometryAwaitingJob(candidate, geometryId);
  }

  function closeMapMenus(except) {
    all(".program-map-menu[open]").forEach(function (menu) { if (menu !== except) menu.open = false; });
  }

  function ensureMapInstance() {
    var container = one("#eventMap");
    if (!container) return;

    var mapEvent = buildMapEvent(selectedEventFilterId);

    var toggleLocBtn = one("#toggleLocationButton");
    if (toggleLocBtn) {
      toggleLocBtn.disabled = !(mapEvent.focusLocations && mapEvent.focusLocations.length > 0);
    }

    if (!mapController && root.UOS.RemediationMap) {
      mapController = root.UOS.RemediationMap.create({
        container: container,
        maplibregl: root.maplibregl || (typeof window !== "undefined" && window.maplibregl) || (typeof maplibregl !== "undefined" ? maplibregl : null),
        getWorkspaceMap: function () {
          var mapConfig = root.UOS_REMEDIATION_MAP_CONFIG || (typeof window !== "undefined" && window.UOS_REMEDIATION_MAP_CONFIG) || {};
          return {
            center: (Array.isArray(mapConfig.defaultCenter) && mapConfig.defaultCenter.length >= 2) ? mapConfig.defaultCenter.slice(0, 2) : [138.6014, -34.9214],
            zoom: Number.isFinite(Number(mapConfig.defaultZoom)) ? Number(mapConfig.defaultZoom) : 14,
            provider: activeProviderId
          };
        },
        onProviderChange: function (providerId) {
          activeProviderId = providerId || "offline";
          var picker = one("#providerSelect");
          if (picker) picker.value = activeProviderId;
        },
        onProviderFailure: function () {
          var notice = one("#mapNotice");
          if (notice) notice.textContent = "Aerial imagery is unavailable. The offline grid is active.";
        },
        onShapeSelected: function (shapeId) {
          var workspace = getWorkspace();
          if (!shapeId) {
            if (canonicalMapState(workspace).scopeMode !== "projects") return;
            persistCanonicalMapState({ selectedGeometryId: "", inspectorMode: "geometry" });
            return;
          }
          var geometries = workspace && workspace.entities && Array.isArray(workspace.entities.geometries) ? workspace.entities.geometries : [];
          var clickedGeom = geometries.find(function (g) { return g.id === shapeId || (g.payload && g.payload.id === shapeId); });
          if (!clickedGeom) return;
          var projectId = text(clickedGeom.projectId || clickedGeom.payload && clickedGeom.payload.projectId);
          var projectContext = resolveMapContext(workspace, sidebarViewMode, "projects", projectId);
          persistCanonicalMapState({
            scopeMode: "projects",
            selectedRegisterId: projectContext.registerId || "",
            selectedProjectId: projectId || "",
            selectedLocationId: "",
            selectedGeometryId: clickedGeom.id,
            inspectorMode: "polygon"
          }).then(function () {
            settleMapCardSelection("data-shape-card-id", clickedGeom.id);
            setTimeout(function () {
              var card = one('[data-shape-card-id="' + esc(clickedGeom.id) + '"]');
              var visibility = root.UOS && root.UOS.ProgramCardVisibility;
              if (card && visibility && typeof visibility.schedule === "function") visibility.schedule(card);
            }, 50);
          });
        },

        onVertexSelected: function (index) {
          selectedVertexIndex = index;
          var container = one("#shapeList");
          if (container) {
            var rows = container.querySelectorAll(".rem-vertex-item");
            rows.forEach(function (row, idx) {
              row.classList.toggle("rem-vertex-item--selected", idx === index);
            });
          }
        },
        onLocationSelected: function (selection) {
          if (!selection || !selection.registerId) return;
          var locationWorkspace = getWorkspace();
          var locationContext = resolveMapContext(locationWorkspace, sidebarViewMode, "register", selection.registerId);
          persistCanonicalMapState({
            scopeMode: "register",
            selectedRegisterId: selection.registerId,
            selectedProjectId: locationContext.projectId || "",
            selectedLocationId: selection.locationId || "",
            selectedGeometryId: "",
            inspectorMode: "location"
          }).then(function () {
            settleMapCardSelection("data-event-card-id", selection.registerId);
            scheduleSelectedSidebarCardVisibility(selection.registerId);
          });
        },
        onLocationPlaced: function (coord) {
          if (!coord || !Array.isArray(coord)) return;
          var placement = pendingLocationPlacement;
          pendingLocationPlacement = null;
          updateMapToolStatus("");
          setSelectToolActive(true);
          if (root.UOS.ProgramApp) {
            root.UOS.ProgramApp.updateWorkspace(function (candidate) {
              var ctx = resolveMapContext(candidate, sidebarViewMode, "register", placement && placement.registerId || selectedEventFilterId);
              var targetReg = ctx.register || (ctx.project && root.UOS.ProgramModel && typeof root.UOS.ProgramModel.registerForProject === "function" ? root.UOS.ProgramModel.registerForProject(candidate, ctx.project) : null);
              if (!targetReg) throw new Error("A Register record is required to place a Location Pin.");
              var beforeLocationIds = Object.create(null);
              var modelLocationsBefore = root.UOS.ProgramModel && typeof root.UOS.ProgramModel.registerLocations === "function"
                ? root.UOS.ProgramModel.registerLocations(candidate, targetReg.id) : [];
              modelLocationsBefore.forEach(function (location) { beforeLocationIds[location.id] = true; });
              var updated;
              if (placement && placement.kind === "move") {
                updated = root.UOS.ProgramModel.updateLocationInRegister(candidate, targetReg.id, placement.locationId, { coordinate: coord });
              } else {
                updated = root.UOS.ProgramModel.addLocationToRegister(candidate, targetReg.id, { coordinate: coord });
              }
              var updatedLocations = root.UOS.ProgramModel && typeof root.UOS.ProgramModel.registerLocations === "function"
                ? root.UOS.ProgramModel.registerLocations(updated, targetReg.id) : [];
              var selectedLocation = placement && placement.kind === "move"
                ? placement.locationId
                : ((updatedLocations.find(function (location) { return !beforeLocationIds[location.id]; }) || {}).id || "");
              return writeCanonicalMapState(updated, {
                scopeMode: "register",
                selectedRegisterId: targetReg.id,
                selectedProjectId: ctx.projectId || "",
                selectedLocationId: selectedLocation,
                selectedGeometryId: "",
                inspectorMode: "location"
              });
            }).then(function () {
              var locBtn = one("#toggleLocationButton");
              if (locBtn) locBtn.disabled = false;
              render();
              if (mapController && typeof mapController.zoomToLocation === "function") {
                mapController.zoomToLocation(coord);
              }
              root.requestAnimationFrame(function () {
                root.requestAnimationFrame(function () {
                  if (mapController && typeof mapController.zoomToLocation === "function") mapController.zoomToLocation(coord);
                });
              });
              if (root.UOS.toast) root.UOS.toast(placement && placement.kind === "move" ? "Location pin moved." : "Location pin added.", "success");
            }).catch(function (error) {
              if (root.UOS.toast) root.UOS.toast(error.message || "The location pin could not be saved.", "error");
            });
          }
        },

        onShapeCreated: function (newShape) {
          if (!newShape || !newShape.coordinates) return;
          if (root.UOS.ProgramApp) {
            root.UOS.ProgramApp.updateWorkspace(function (candidate) {
              var geomType = newShape.geometryType === "line" ? "LineString" : "Polygon";
              var rawCoords = newShape.geometryType === "line" ? newShape.coordinates : [newShape.coordinates];
              var beforeIds = Object.create(null);
              (candidate.entities.geometries || []).forEach(function (geometry) { beforeIds[geometry.id] = true; });
              var ctx = resolveMapContext(candidate, sidebarViewMode, sidebarScopeMode, selectedEventFilterId);
              var project = ctx.project || projectForTarget(candidate, ctx.projectId || ctx.registerId || selectedEventFilterId, ctx.owner);
              if (!project) throw new Error("Promote the selected Register record to a Delivery Project before drawing mapped work.");
              if (!root.UOS.WorkAreaService || typeof root.UOS.WorkAreaService.createGeometry !== "function") throw new Error("WorkAreaService is unavailable.");
              var updated = root.UOS.WorkAreaService.createGeometry(candidate, project.id, {
                workTypeKey: "turfing",
                geometryKind: newShape.geometryType || "polygon",
                geometry: { type: geomType, coordinates: rawCoords },
                payload: { type: "turfing", workTypeKey: "turfing", visible: true, valid: true }
              });
              var created = (updated.entities.geometries || []).find(function (geometry) { return !beforeIds[geometry.id]; });
              var projectContext = resolveMapContext(updated, sidebarViewMode, "projects", project.id);
              if (created) {
                updated = writeCanonicalMapState(updated, {
                  scopeMode: "projects",
                  selectedRegisterId: projectContext.registerId || "",
                  selectedProjectId: project.id,
                  selectedLocationId: "",
                  selectedGeometryId: created.id,
                  inspectorMode: "polygon"
                });
              }
              return updated;
            });
          }
        },

        onShapeEdited: function (editedShape) {
          if (!editedShape || !editedShape.id || !root.UOS.ProgramApp) return;
          root.UOS.ProgramApp.updateWorkspace(function (candidate) {
            var isLine = editedShape.geometryType === "line";
            if (!root.UOS.WorkAreaService || typeof root.UOS.WorkAreaService.updateGeometry !== "function") throw new Error("WorkAreaService is unavailable.");
            var updated = root.UOS.WorkAreaService.updateGeometry(candidate, editedShape.id, {
              geometryKind: isLine ? "line" : "polygon",
              geometry: { type: isLine ? "LineString" : "Polygon", coordinates: isLine ? editedShape.coordinates : [editedShape.coordinates] }
            });
            return syncExistingGeometryWork(updated, editedShape.id);
          }).then(render);
        }
      });
      if (mapController && typeof mapController.setEvent === "function") {
        mapController.setEvent(buildMapEvent(selectedEventFilterId));
      }
    } else if (mapController && typeof mapController.setEvent === "function") {
      mapController.setEvent(buildMapEvent(selectedEventFilterId));
    }

    if (mapController) {
      if (typeof mapController.resize === "function") mapController.resize();
      if (typeof mapController.refresh === "function") mapController.refresh();
      setTimeout(function () {
        if (mapController && typeof mapController.resize === "function") mapController.resize();
        if (mapController && typeof mapController.refresh === "function") mapController.refresh();
      }, 100);
    }
  }

  function updateTogglesUI() {
    [
      { id: "#toggleMapLength", key: "Length" },
      { id: "#toggleMapArea", key: "Area" },
      { id: "#toggleMapAngles", key: "Angles" },
      { id: "#toggleMapEdges", key: "Edges" },
      { id: "#toggleMapIndex", key: "Index" },
      { id: "#toggleMapActiveOnly", key: "ActiveOnly" },
      { id: "#toggleMapSelectedOnly", key: "SelectedOnly" }
    ].forEach(function (toggle) {
      var btn = one(toggle.id);
      if (btn) btn.setAttribute("aria-pressed", String(mapToggles[toggle.key] !== false));
    });

    if (mapController && typeof mapController.setMeasurementVisibility === "function") {
      mapController.setMeasurementVisibility(
        mapToggles.Length === true,
        mapToggles.Area !== false,
        mapToggles.Angles === true,
        mapToggles.Edges === true,
        mapToggles.Index !== false,
        mapToggles.SelectedOnly === true
      );
    }
  }

  function updateDrawModeUI() {
    all("[data-draw-mode]").forEach(function (button) {
      var mode = button.getAttribute("data-draw-mode");
      button.setAttribute("aria-pressed", String(mode === activeDrawMode));
    });
  }

  function exportShapeAsGeoJson(shapeId) {
    var geometries = getGeometries();
    var geom = geometries.find(function (g) { return g.id === shapeId; });
    if (!geom) return;
    var feature = {
      type: "Feature",
      properties: geom.payload || {},
      geometry: geom.geometry
    };
    var content = JSON.stringify(feature, null, 2);
    if (root.UOS.imports && typeof root.UOS.imports.download === "function") {
      root.UOS.imports.download("Shape_" + (geom.id || "export") + ".geojson", content, "application/geo+json;charset=utf-8");
    }
  }

  function exportScopedGeoJson() {
    var shapes = convertToEventShapes(getGeometriesForEvent(selectedEventFilterId));
    if (!shapes.length) {
      if (root.UOS.toast) root.UOS.toast("There are no mapped geometries in the current scope to export.", "error");
      return;
    }
    var collection = {
      type: "FeatureCollection",
      features: shapes.map(function (shape, index) {
        var isLine = shape.geometryType === "line";
        var coordinates = Array.isArray(shape.coordinates) ? shape.coordinates.map(function (coordinate) { return coordinate.slice(); }) : [];
        if (!isLine && coordinates.length) {
          var first = coordinates[0], last = coordinates[coordinates.length - 1];
          if (!last || first[0] !== last[0] || first[1] !== last[1]) coordinates.push(first.slice());
        }
        return {
          type: "Feature",
          id: shape.id,
          properties: { id: shape.id, index: index + 1, workType: shape.type, areaSqM: Number(shape.areaSqM) || 0, lengthM: Number(shape.lengthM) || 0, visible: shape.visible !== false },
          geometry: { type: isLine ? "LineString" : "Polygon", coordinates: isLine ? coordinates : [coordinates] }
        };
      })
    };
    var scope = selectedEventFilterId && selectedEventFilterId !== "all" ? selectedEventFilterId : "all-geometries";
    var filename = "Space-Map_" + text(scope).replace(/[^a-z0-9_-]+/gi, "-") + ".geojson";
    if (root.UOS.imports && typeof root.UOS.imports.download === "function") root.UOS.imports.download(filename, JSON.stringify(collection, null, 2), "application/geo+json;charset=utf-8");
  }

  function openImportDialog() {
    var dialog = one("#coordinateShapeDialog");
    if (!dialog) return;
    var textInput = one("#geometryTextInput");
    if (textInput) textInput.value = "";
    var fileInput = one("#geometryFileInput");
    if (fileInput) fileInput.value = "";
    droppedGeometryFile = null;
    setGeometryFileLabel(null);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.hidden = false;
  }

  function closeImportDialog() {
    var dialog = one("#coordinateShapeDialog");
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.hidden = true;
  }

  function openDeleteDialog(shapeId) {
    pendingDeleteShapeId = shapeId;
    var dialog = one("#deleteShapeDialog");
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.hidden = false;
  }

  function closeDeleteDialog() {
    pendingDeleteShapeId = null;
    var dialog = one("#deleteShapeDialog");
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.hidden = true;
  }

  function processImportSubmission() {
    var formatSelect = one("#geometryFormatInput");
    var fileInput = one("#geometryFileInput");
    var textInput = one("#geometryTextInput");
    var format = formatSelect ? formatSelect.value : "auto";
    var textValue = textInput ? textInput.value.trim() : "";

    function applyImport(rawInput, label) {
      try {
        var newGeometries = prepareGeoJsonShapes(rawInput);
        if (!root.UOS.ProgramApp || typeof root.UOS.ProgramApp.updateWorkspace !== "function") return;
        root.UOS.ProgramApp.updateWorkspace(function (candidate) {
          if (!root.UOS.WorkAreaService || typeof root.UOS.WorkAreaService.createGeometry !== "function") throw new Error("WorkAreaService is unavailable.");
          newGeometries.forEach(function (geometry) {
            candidate = root.UOS.WorkAreaService.createGeometry(candidate, geometry.projectId, geometry);
          });
          return candidate;
        }).then(function () {
          closeImportDialog();
          render();
          if (root.UOS.toast) root.UOS.toast(newGeometries.length + " geometries imported from " + label + ".", "success");
        }).catch(function (err) {
          if (root.UOS.toast) root.UOS.toast("Import failed: " + err.message, "error");
        });
      } catch (err) {
        if (root.UOS.toast) root.UOS.toast("Import failed: " + err.message, "error");
      }
    }

    var file = droppedGeometryFile || (fileInput && fileInput.files && fileInput.files[0]);
    if (file) {
      if (file.size > 20 * 1024 * 1024) { if (root.UOS.toast) root.UOS.toast("Geometry file exceeds the 20 MB limit.", "error"); return; }
      file.text().then(function (content) {
        var fileFormat = format === "auto" ? (/^\s*[\[{]/.test(content) ? "geojson" : "wkt") : format;
        applyImport(fileFormat === "geojson" ? JSON.parse(content) : wktGeometry(content), file.name);
      }).catch(function (err) {
        if (root.UOS.toast) root.UOS.toast("File read failed: " + err.message, "error");
      });
      return;
    }

    if (!textValue) {
      if (root.UOS.toast) root.UOS.toast("Choose a geometry file or paste GeoJSON / WKT text.", "error");
      return;
    }

    if (format === "auto") format = /^\s*[\\[{]/.test(textValue) ? "geojson" : "wkt";
    try {
      var parsed = format === "geojson" ? JSON.parse(textValue) : wktGeometry(textValue);
      applyImport(parsed, format === "wkt" ? "WKT" : "GeoJSON");
    } catch (err) {
      if (root.UOS.toast) root.UOS.toast("Parsing failed: " + err.message, "error");
    }
  }

  function setGeometryFileLabel(file) {
    var label = one("[data-geometry-file-name]");
    if (label) { var kilobytes = file ? Math.round(file.size / 1024) : 0; label.textContent = file ? file.name + " · " + (kilobytes > 0 ? kilobytes : 1) + " KB" : "GeoJSON, JSON or WKT · maximum 20 MB"; }
  }

  function bindEvents() {
    if (initialized) return;
    initialized = true;

    root.document.addEventListener("click", function (event) {

      var spatialFilterBtn = event.target.closest("[data-map-spatial-filter]");
      if (spatialFilterBtn) {
        var spatialFilterVal = spatialFilterBtn.getAttribute("data-map-spatial-filter");
        if (selectedSpatialFilter === spatialFilterVal) {
          selectedSpatialFilter = null;
        } else {
          selectedSpatialFilter = spatialFilterVal;
        }
        renderEventPicker();
        return;
      }

      var statusFilterBtn = event.target.closest("[data-map-status-filter]");
      if (statusFilterBtn) {
        var statusFilterVal = statusFilterBtn.getAttribute("data-map-status-filter");
        var statusIdx = selectedStatusFilters.findIndex(function (filter) {
          return normalizedStatus(filter) === normalizedStatus(statusFilterVal);
        });
        if (statusIdx >= 0) {
          selectedStatusFilters.splice(statusIdx, 1);
        } else {
          selectedStatusFilters.push(statusFilterVal);
        }
        renderEventPicker();
        return;
      }

      var inspectLocBtn = event.target.closest("[data-inspect-locations]");
      var pinActionBtn = event.target.closest("[data-pin-action]");
      var promoteRegBtn = event.target.closest("[data-promote-register-id]");
      var closeInspectorBtn = event.target.closest("#cancelLocationInspectorButton,#closeLocationInspectorModalButton");
      var inspectorAddBtn = event.target.closest("[data-inspector-add-pin]");

      if (closeInspectorBtn) {
        var d = one("#locationInspectorDialog");
        if (d && typeof d.close === "function") d.close();
        return;
      }
      if (inspectLocBtn) {
        var inspectRegId = inspectLocBtn.getAttribute("data-inspect-locations");
        var inspectWorkspace = getWorkspace();
        var inspectContext = resolveMapContext(inspectWorkspace, sidebarViewMode, "register", inspectRegId);
        persistCanonicalMapState({
          scopeMode: "register", selectedRegisterId: inspectRegId, selectedProjectId: inspectContext.projectId || "",
          selectedLocationId: "", selectedGeometryId: "", inspectorMode: "location"
        }).then(function () {
          openLocationInspector(inspectRegId);
        });
        return;
      }
      if (promoteRegBtn) {
        var promRegId = promoteRegBtn.getAttribute("data-promote-register-id");
        if (root.UOS.ProgramApp) {
          root.UOS.ProgramApp.updateWorkspace(function (ws) {
            var promoted = root.UOS.ProgramModel.promoteRegisterRecord(ws, promRegId);
            return writeCanonicalMapState(promoted.workspace, {
              scopeMode: "projects",
              selectedRegisterId: promRegId,
              selectedProjectId: promoted.project && promoted.project.id || "",
              selectedLocationId: "",
              selectedGeometryId: "",
              inspectorMode: "project"
            });
          });
        }
        return;
      }
      if (pinActionBtn) {
        var actionType = pinActionBtn.getAttribute("data-pin-action");
        var pinIdVal = pinActionBtn.getAttribute("data-pin-id");
        var pinRegId = pinActionBtn.getAttribute("data-pin-reg-id");
        if (actionType === "zoom") {
          var ws = getWorkspace();
          var regRec = (ws.entities.events || []).concat(ws.entities.applications || []).find(function (r) { return r.id === pinRegId; });
          var pins = recordLocations(regRec);
          var targetPin = pins.find(function (p) { return p.id === pinIdVal; });
          if (targetPin && mapController && typeof mapController.zoomToLocation === "function") {
            persistCanonicalMapState({ scopeMode: "register", selectedRegisterId: pinRegId, selectedLocationId: pinIdVal, selectedGeometryId: "", inspectorMode: "location" });
            var diag = one("#locationInspectorDialog");
            if (diag && typeof diag.close === "function") diag.close();
            mapController.zoomToLocation(targetPin.coordinate);
          }
        } else if (actionType === "move") {
          var moveDialog = one("#locationInspectorDialog");
          if (moveDialog && typeof moveDialog.close === "function") moveDialog.close();
          startPinPlacement("move", pinRegId, pinIdVal);
        } else if (actionType === "delete") {
          confirmPinRemoval(pinRegId, pinIdVal).then(function () {
            var inspector = one("#locationInspectorDialog");
            if (inspector && inspector.open) openLocationInspector(pinRegId);
          });
        }
        return;
      }
      if (inspectorAddBtn) {
        var diagClose = one("#locationInspectorDialog");
        if (diagClose && typeof diagClose.close === "function") diagClose.close();
        var targetAddId = inspectorAddBtn.getAttribute("data-location-event-id");
        startPinPlacement("add", targetAddId);
        return;
      }

      var shapeJumpBtn = event.target.closest("[data-shape-jump]");
      var eventJumpBtn = event.target.closest("[data-event-jump]");
      var scopeBtn = event.target.closest("[data-map-scope]");
      if (scopeBtn) {
        var newScope = scopeBtn.getAttribute("data-map-scope");
        if (newScope && newScope !== sidebarScopeMode) {
          var scopeWorkspace = getWorkspace();
          var previousContext = resolveMapContext(scopeWorkspace, sidebarViewMode, sidebarScopeMode, selectedEventFilterId);
          var currentState = canonicalMapState(scopeWorkspace);
          var nextPatch;
          if (newScope === "projects") {
            nextPatch = {
              scopeMode: "projects",
              selectedRegisterId: previousContext.registerId || currentState.selectedRegisterId || "",
              selectedProjectId: previousContext.projectId || currentState.selectedProjectId || "",
              selectedLocationId: "",
              selectedGeometryId: "",
              inspectorMode: "project"
            };
          } else {
            nextPatch = {
              scopeMode: "register",
              selectedRegisterId: previousContext.registerId || currentState.selectedRegisterId || "",
              selectedProjectId: previousContext.projectId || currentState.selectedProjectId || "",
              selectedLocationId: "",
              selectedGeometryId: "",
              inspectorMode: "register"
            };
          }
          selectedSpatialFilter = null;
          persistCanonicalMapState(nextPatch);
        }
        return;
      }
      var locCardBtn = event.target.closest("[data-location-action]");
      var editEventBtn = event.target.closest("[data-edit-event-id]");
      var createShapeJobBtn = event.target.closest("[data-create-shape-job]");
      var eventCard = event.target.closest("[data-event-card-id]");
      var drawModeBtn = event.target.closest("[data-draw-mode]");
      var toggleBtn = event.target.closest("#toggleMapLength,#toggleMapArea,#toggleMapAngles,#toggleMapEdges,#toggleMapIndex,#toggleMapActiveOnly,#toggleMapSelectedOnly");
      var shapeCard = event.target.closest("[data-shape-card-id]");
      var actionBtn = event.target.closest("[data-shape-action]");
      var coordModalBtn = event.target.closest("#coordinateShapeButton");
      var exportMapBtn = event.target.closest("#exportMapGeoJsonButton");
      var cancelCoordBtn = event.target.closest("#cancelCoordinateShapeButton,#cancelCoordinateShapeModalButton");
      var submitCoordBtn = event.target.closest("#submitCoordinateShapeButton");
      var cancelDeleteBtn = event.target.closest("#cancelDeleteShapeButton,#cancelDeleteShapeModalButton");
      var confirmDeleteBtn = event.target.closest("#confirmDeleteShapeButton");
      var selectToolBtn = event.target.closest("#selectToolButton");
      var startDrawBtn = event.target.closest("#startDrawingButton");
      var finishDrawBtn = event.target.closest("#finishDrawingButton");
      var undoDrawBtn = event.target.closest("#undoDrawingButton");
      var cancelDrawBtn = event.target.closest("#cancelDrawingButton");
      var fitBtn = event.target.closest("#zoomShapesButton");
      var homeBtn = event.target.closest("#resetHomeButton");
      var backToListBtn = event.target.closest("#backToListButton");
      var editorBackBtn = event.target.closest("[data-map-editor-back]");

      // Shared mini-drawer contract: local selection is immediate, while the
      // workspace update which can rebuild this list waits for motion end.
      if (event.target.closest("[data-disclosure-toggle]") && (eventCard || shapeCard)) {
        var mapDisclosureToggle = event.target.closest("[data-disclosure-toggle]");
        var mapDisclosureKey = mapDisclosureToggle.getAttribute("data-disclosure-key");
        if (mapDisclosureToggle.getAttribute("aria-expanded") !== "true") return;
        if (shapeCard) {
          var disclosureShapeId = shapeCard.getAttribute("data-shape-card-id");
          settleMapCardSelection("data-shape-card-id", disclosureShapeId);
          var finishShapeSelection = function () {
            if (mapController && typeof mapController.selectShape === "function") mapController.selectShape(disclosureShapeId, true);
          };
          var shapeDisclosureApi = window.UOS && window.UOS.ProgramDisclosureRows;
          if (!shapeDisclosureApi || typeof shapeDisclosureApi.afterOpen !== "function" || !shapeDisclosureApi.afterOpen(mapDisclosureKey, finishShapeSelection)) finishShapeSelection();
        } else if (eventCard) {
          var disclosureEventId = eventCard.getAttribute("data-event-card-id");
          var disclosureSelectionContext = resolveMapContext(getWorkspace(), sidebarViewMode, sidebarScopeMode, disclosureEventId);
          var persistMapSelection = function () {
            return persistCanonicalMapState(sidebarScopeMode === "projects"
              ? {
                  scopeMode: "projects",
                  selectedRegisterId: disclosureSelectionContext.registerId || "",
                  selectedProjectId: disclosureSelectionContext.projectId || "",
                  selectedLocationId: "",
                  selectedGeometryId: "",
                  inspectorMode: "project"
                }
              : {
                  scopeMode: "register",
                  selectedRegisterId: disclosureSelectionContext.registerId || "",
                  selectedProjectId: disclosureSelectionContext.projectId || "",
                  selectedLocationId: "",
                  selectedGeometryId: "",
                  inspectorMode: "register"
                }).then(function () {
                  settleMapCardSelection("data-event-card-id", disclosureEventId);
                  if (mapController && typeof mapController.setEvent === "function") {
                    mapController.setEvent(buildMapEvent(disclosureEventId));
                    scheduleMapEventZoom();
                  }
                });
          };
          var disclosureApi = root.UOS && root.UOS.ProgramDisclosureRows;
          if (!disclosureApi || typeof disclosureApi.afterOpen !== "function" || !disclosureApi.afterOpen(mapDisclosureKey, persistMapSelection)) persistMapSelection();
        }
        return;
      }

      if (shapeJumpBtn) {
        var jumpDest = shapeJumpBtn.getAttribute("data-shape-jump");
        var shapeIdVal = shapeJumpBtn.getAttribute("data-shape-id");
        var ws = getWorkspace();
        var linkedJob = (ws && ws.entities && ws.entities.jobs || []).find(function (j) {
          return text(j.sourceGeometryId || j.geometryId) === shapeIdVal;
        });
        var geom = (ws && ws.entities && ws.entities.geometries || []).find(function (g) {
          return g.id === shapeIdVal;
        });
        var projId = (linkedJob && linkedJob.projectId) || (geom && geom.projectId) || "";
        if (root.UOS && root.UOS.ProgramApp) {
          root.UOS.ProgramApp.updateWorkspace(function (candidate) {
            candidate.workspace = candidate.workspace || {};
            if (projId) candidate.workspace.selectedProjectId = projId;
            if (linkedJob) candidate.workspace.selectedJobId = linkedJob.id;
            if (jumpDest === "costing") {
              candidate.workspace.costing = candidate.workspace.costing || {};
              if (projId) candidate.workspace.costing.selectedProjectId = projId;
              if (linkedJob) candidate.workspace.costing.jobId = linkedJob.id;
            } else if (jumpDest === "scheduler") {
              candidate.workspace.scheduler = candidate.workspace.scheduler || {};
              if (linkedJob) candidate.workspace.scheduler.selectedId = linkedJob.id;
              if (projId) candidate.workspace.scheduler.selectedProjectId = projId;
            }
            return candidate;
          }).then(function () {
            root.UOS.ProgramApp.navigate(jumpDest);
          });
        }
      } else if (eventJumpBtn) {
        var evJumpDest = eventJumpBtn.getAttribute("data-event-jump");
        var evId = eventJumpBtn.getAttribute("data-event-id");
        var wsRec = getWorkspace();
        var recObj = (wsRec && wsRec.entities && (wsRec.entities.applications || []).concat(wsRec.entities.events || []) || []).find(function (r) {
          return r.id === evId;
        });
        var linkedPrj = recObj && root.UOS && root.UOS.ProgramRegister && typeof root.UOS.ProgramRegister.buildLinkedProject === "function"
          ? root.UOS.ProgramRegister.buildLinkedProject(wsRec, recObj)
          : null;
        if (root.UOS && root.UOS.ProgramApp) {
          root.UOS.ProgramApp.updateWorkspace(function (candidate) {
            candidate.workspace = candidate.workspace || {};
            candidate.workspace.selectedEntityId = evId;
            if (recObj && (recObj.owner === "NSA" || recObj.owner === "EVT")) candidate.workspace.ownerMode = recObj.owner;
            if (linkedPrj) {
              candidate.workspace.selectedProjectId = linkedPrj.id;
              candidate.workspace.planner = candidate.workspace.planner || {};
              candidate.workspace.planner.selectedProjectId = linkedPrj.id;
            }
            return candidate;
          }).then(function () {
            root.UOS.ProgramApp.navigate(evJumpDest);
          });
        }

      } else if (editorBackBtn) {
        leavePolygonEditor();
      } else if (backToListBtn) {
        leavePolygonInspector();
      } else if (createShapeJobBtn) {
        var jobShapeId = createShapeJobBtn.getAttribute("data-create-shape-job");
        var jobShapeCard = createShapeJobBtn.closest("[data-shape-card-id]");
        var jobWorkTypeSelect = jobShapeCard && jobShapeCard.querySelector("[data-shape-type]");
        var jobRateSelect = jobShapeCard && jobShapeCard.querySelector("[data-shape-rate]");
        var selectedJobWorkType = canonicalWorkType(jobWorkTypeSelect && jobWorkTypeSelect.value);
        var selectedJobRateId = text(jobRateSelect && jobRateSelect.value);
        if (createShapeJobBtn.disabled || !selectedJobWorkType || !selectedJobRateId) {
          if (root.UOS.toast) {
            root.UOS.toast(!selectedJobWorkType
              ? "Please select a valid work type before creating a Job."
              : "Please select a pricing rate before creating a Job.", "error");
          }
          return;
        }
        if (root.UOS.ProgramApp) {
          root.UOS.ProgramApp.updateWorkspace(function (candidate) {
            var geometry = root.UOS.ProgramModel.workGeometryById(candidate, jobShapeId);
            if (!geometry) throw new Error("The selected polygon no longer exists.");
            candidate = root.UOS.WorkAreaService.updateGeometry(candidate, geometry.id, {
              workTypeKey: selectedJobWorkType,
              rateItemId: selectedJobRateId,
              payload: { workTypeKey: selectedJobWorkType, type: selectedJobWorkType, rateItemId: selectedJobRateId }
            });
            candidate = syncGeometry(candidate, geometry.id, { explicit: true });
            var project = (candidate.entities.projects || []).find(function (item) { return item.id === geometry.projectId; });
            if (project) {
              candidate.workspace = candidate.workspace || {};
              candidate.workspace.selectedProjectId = project.id;
              candidate.workspace.costing = candidate.workspace.costing || {};
              candidate.workspace.costing.selectedProjectId = project.id;
              candidate.workspace.costing.jobId = null;
              candidate = writeCanonicalMapState(candidate, {
                scopeMode: "projects",
                selectedProjectId: project.id,
                selectedGeometryId: geometry.id,
                selectedLocationId: "",
                inspectorMode: "polygon"
              });
            }
            return candidate;
          }).then(function (saved) {
            var created = (saved.entities.jobs || []).some(function (job) { return text(job.sourceGeometryId) === jobShapeId; });
            var savedGeometry = (saved.entities.geometries || []).find(function (item) { return item.id === jobShapeId; });
            var failureMessage = savedGeometry && savedGeometry.syncState && savedGeometry.syncState.message;
            renderShapeCards();
            if (root.UOS.toast) root.UOS.toast(created ? "Polygon job is now available in the Job Calculator." : (failureMessage || "The polygon job could not be created."), created ? "success" : "error");
          }).catch(function (error) {
            if (root.UOS.toast) root.UOS.toast(error.message || "The polygon job could not be created.", "error");
          });
        }
      } else if (locCardBtn) {
        event.preventDefault();
        event.stopPropagation();
        var locAction = locCardBtn.getAttribute("data-location-action");
        var locTargetId = locCardBtn.getAttribute("data-location-event-id");
        var locId = locCardBtn.getAttribute("data-location-id");

        if (locAction === "add") {
          startPinPlacement("add", locTargetId);
        } else if (locAction === "move") {
          startPinPlacement("move", locTargetId, locId);
        } else if (locAction === "delete") {
          confirmPinRemoval(locTargetId, locId);
        }
        return;
      } else if (editEventBtn) {
        var editId = editEventBtn.getAttribute("data-edit-event-id");
        filterMapByEvent(editId, true);
      } else if (eventCard) {
        var cardId = eventCard.getAttribute("data-event-card-id");
        filterMapByEvent(cardId);
        var selectedWorkspace = getWorkspace();
        var selectedRecords = selectedWorkspace && selectedWorkspace.entities || {};
        var selectedRecord = (selectedRecords.events || []).concat(selectedRecords.applications || []).find(function (item) { return item.id === cardId; });
        var selectedProject = (selectedRecords.projects || []).find(function (item) { return item.id === cardId; }) ||
          (selectedRecord && root.UOS.ProgramRegister && typeof root.UOS.ProgramRegister.buildLinkedProject === "function" ? root.UOS.ProgramRegister.buildLinkedProject(selectedWorkspace, selectedRecord) : null);
        if (selectedProject && root.UOS.ProgramApp && typeof root.UOS.ProgramApp.setWorkingContext === "function") root.UOS.ProgramApp.setWorkingContext(selectedProject.owner || (selectedRecord && selectedRecord.owner), selectedProject.id);
      } else if (drawModeBtn) {
        activeDrawMode = drawModeBtn.getAttribute("data-draw-mode");
        updateDrawModeUI();
      } else if (selectToolBtn) {
        cancelActiveMapInteraction();
      } else if (startDrawBtn && mapController) {
        pendingLocationPlacement = null;
        updateMapToolStatus("");
        setSelectToolActive(false);
        mapController.startDrawing(activeDrawMode === "line" ? "line" : activeDrawMode === "square" ? "square" : "polygon");
        var mapToolbar = one(".program-map-header-controls");
        if (mapToolbar) mapToolbar.classList.add("is-drawing");
        var drawMenu = one(".program-map-menu--draw");
        if (drawMenu) drawMenu.open = false;
        one("#finishDrawingButton").disabled = false;
        one("#undoDrawingButton").disabled = false;
        one("#cancelDrawingButton").disabled = false;
      } else if (finishDrawBtn && mapController) {
        mapController.finishDrawing();
        setSelectToolActive(true);
        var finishedToolbar = one(".program-map-header-controls");
        if (finishedToolbar) finishedToolbar.classList.remove("is-drawing");
        finishDrawBtn.disabled = true;
        one("#undoDrawingButton").disabled = true;
        one("#cancelDrawingButton").disabled = true;
      } else if (undoDrawBtn && mapController) {
        mapController.undoPoint();
      } else if (cancelDrawBtn && mapController) {
        cancelActiveMapInteraction();
      } else if (homeBtn && mapController && typeof mapController.resetView === "function") {
        mapController.resetView();
      } else if (fitBtn && mapController) {
        mapController.zoomToShapes();
      } else if (coordModalBtn) {
        openImportDialog();
      } else if (exportMapBtn) {
        exportScopedGeoJson();
      } else if (cancelCoordBtn) {
        closeImportDialog();
      } else if (submitCoordBtn) {
        processImportSubmission();
      } else if (cancelDeleteBtn) {
        closeDeleteDialog();
      } else if (confirmDeleteBtn) {
        if (pendingDeleteShapeId && root.UOS.ProgramApp) {
          var deletingShapeId = pendingDeleteShapeId;
          root.UOS.ProgramApp.updateWorkspace(function (candidate) {
            var updated = root.UOS.WorkAreaService.removeGeometry(candidate, deletingShapeId);
            var state = canonicalMapState(candidate);
            return state.selectedGeometryId === deletingShapeId
              ? writeCanonicalMapState(updated, { selectedGeometryId: "", inspectorMode: "geometry" })
              : updated;
          }).then(function () {
            closeDeleteDialog();
          });
        }
      } else if (toggleBtn) {
        var id = toggleBtn.id;
        if (id === "toggleMapLength") mapToggles.Length = mapToggles.Length !== true;
        else if (id === "toggleMapArea") mapToggles.Area = mapToggles.Area === false;
        else if (id === "toggleMapAngles") mapToggles.Angles = mapToggles.Angles === false;
        else if (id === "toggleMapEdges") mapToggles.Edges = mapToggles.Edges === false;
        else if (id === "toggleMapIndex") mapToggles.Index = mapToggles.Index === false;
        else if (id === "toggleMapActiveOnly") mapToggles.ActiveOnly = mapToggles.ActiveOnly === false;
        else if (id === "toggleMapSelectedOnly") mapToggles.SelectedOnly = mapToggles.SelectedOnly === false;
        updateTogglesUI();
      } else if (actionBtn) {
        var action = actionBtn.getAttribute("data-shape-action");
        var shapeId = actionBtn.getAttribute("data-action-id");
        if (action === "zoom" && mapController) {
          mapController.zoomToShape(shapeId);
        } else if (action === "export") {
          exportShapeAsGeoJson(shapeId);
        } else if (action === "delete") {
          openDeleteDialog(shapeId);
        } else if (action === "edit") {
          var nextEditingShapeId = editingShapeId === shapeId ? null : shapeId;
          var editWorkspace = getWorkspace();
          var editGeometry = editWorkspace && editWorkspace.entities && (editWorkspace.entities.geometries || []).find(function (item) { return item.id === shapeId; });
          var editProjectId = editGeometry ? text(editGeometry.projectId || editGeometry.payload && editGeometry.payload.projectId) : "";
          var editContext = resolveMapContext(editWorkspace, sidebarViewMode, "projects", editProjectId);
          persistCanonicalMapState({
            scopeMode: "projects",
            selectedRegisterId: editContext.registerId || "",
            selectedProjectId: editProjectId || "",
            selectedLocationId: "",
            selectedGeometryId: shapeId,
            inspectorMode: "polygon"
          }).then(function () {
            editingShapeId = nextEditingShapeId;
            renderShapeCards();
            if (mapController) mapController.editShape(editingShapeId);
          });
        } else if (action === "duplicate") {
          if (root.UOS.ProgramApp) {
            root.UOS.ProgramApp.updateWorkspace(function (candidate) {
              var sourceGeom = candidate.entities.geometries.find(function (g) { return g.id === shapeId; });
              if (sourceGeom) {
                var dup = JSON.parse(JSON.stringify(sourceGeom));
                dup.id = root.UOS.ProgramModel.stableId(sourceGeom.owner, "geometry", "duplicate:" + sourceGeom.id + ":" + candidate.entities.geometries.length);
                if (dup.payload) dup.payload.id = dup.id;
                delete dup.syncState;
                candidate = root.UOS.WorkAreaService.createGeometry(candidate, sourceGeom.projectId, dup);
              }
              return candidate;
            }).then(render);
          }
        }
      } else if (event.target.closest("[data-delete-vertex]")) {
        var delBtn = event.target.closest("[data-delete-vertex]");
        var vIdx = Number(delBtn.getAttribute("data-delete-vertex"));
        if (!editingShapeId || !Number.isInteger(vIdx) || !mapController) return;
        var res = mapController.removeVertex(editingShapeId, vIdx);
        if (res && !res.success) {
          showError(res.reason || "Vertex removal failed.");
        } else {
          renderShapeCards();
        }
      } else if (shapeCard) {
        if (event.target.closest("select, input, option, label, button, .uos-field")) {
          return;
        }
        var newSelectedId = shapeCard.getAttribute("data-shape-card-id");
        if (selectedShapeId !== newSelectedId && mapController && typeof mapController.selectShape === "function") {
          mapController.selectShape(newSelectedId, true);
        }
      }
    });

    root.document.addEventListener("input", function (event) {
      var target = event.target;
      if (target && target.matches(".rem-vertex-coord")) {
        var latAttr = target.getAttribute("data-coord-lat");
        var lngAttr = target.getAttribute("data-coord-lng");
        var vIdx = Number(latAttr !== null ? latAttr : lngAttr);
        if (!editingShapeId || !Number.isInteger(vIdx) || !mapController) return;
        var row = target.closest(".rem-vertex-item");
        if (!row) return;
        var latInput = row.querySelector('[data-coord-lat="' + vIdx + '"]');
        var lngInput = row.querySelector('[data-coord-lng="' + vIdx + '"]');
        var lat = Number(latInput ? latInput.value : NaN);
        var lng = Number(lngInput ? lngInput.value : NaN);
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          mapController.updateVertex(editingShapeId, vIdx, [lng, lat], { preview: true });
        }
      }
    });

    root.document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !pendingLocationPlacement) return;
      cancelActiveMapInteraction();
      if (root.UOS.toast) root.UOS.toast("Location placement cancelled.", "info");
    });

    root.document.addEventListener("click", function (event) {
      var mapView = event.target.closest('[data-program-view="map"]');
      if (!mapView) return;
      var menu = event.target.closest(".program-map-menu");
      var summary = event.target.closest(".program-map-menu > summary");
      if (summary) { closeMapMenus(menu); return; }
      if (menu && event.target.closest("select, option")) return;
      closeMapMenus();
    });

    root.document.addEventListener("focusin", function (event) {
      if (event.target.closest('[data-program-view="map"]') && !event.target.closest(".program-map-menu")) closeMapMenus();
    });

    root.document.addEventListener("change", function (event) {
      if (event.target.closest(".program-map-menu")) closeMapMenus();
      if (event.target.matches("#geometryFileInput")) {
        droppedGeometryFile = event.target.files && event.target.files[0] || null;
        setGeometryFileLabel(droppedGeometryFile);
      }
      var target = event.target;
      if (target && target.matches(".rem-vertex-coord")) {
        var latAttr = target.getAttribute("data-coord-lat");
        var lngAttr = target.getAttribute("data-coord-lng");
        var vIdx = Number(latAttr !== null ? latAttr : lngAttr);
        if (!editingShapeId || !Number.isInteger(vIdx) || !mapController) return;
        var row = target.closest(".rem-vertex-item");
        if (!row) return;
        var latInput = row.querySelector('[data-coord-lat="' + vIdx + '"]');
        var lngInput = row.querySelector('[data-coord-lng="' + vIdx + '"]');
        var lat = Number(latInput ? latInput.value : NaN);
        var lng = Number(lngInput ? lngInput.value : NaN);
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          mapController.updateVertex(editingShapeId, vIdx, [lng, lat], { commit: true });
        } else {
          showError("Please enter valid latitude (-90 to 90) and longitude (-180 to 180) values.");
          renderShapeCards();
        }
      }
    });

    var geometryDrop = one("[data-geometry-drop-zone]");
    if (geometryDrop) {
      ["dragenter", "dragover"].forEach(function (name) { geometryDrop.addEventListener(name, function (event) { event.preventDefault(); geometryDrop.classList.add("is-dragover"); }); });
      ["dragleave", "drop"].forEach(function (name) { geometryDrop.addEventListener(name, function (event) { event.preventDefault(); geometryDrop.classList.remove("is-dragover"); }); });
      geometryDrop.addEventListener("drop", function (event) {
        droppedGeometryFile = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0] || null;
        setGeometryFileLabel(droppedGeometryFile);
      });
      geometryDrop.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); var input = one("#geometryFileInput"); if (input) input.click(); } });
    }

    root.document.addEventListener("input", function (event) {
      var searchInput = event.target.closest("#eventSearchInput,[data-event-search]");
      if (searchInput) {
        eventSearchQuery = text(searchInput.value).toLowerCase();
        updateSidebarViewUI();
      }
    });

    root.document.addEventListener("change", function (event) {
      var visibleInput = event.target.closest("[data-shape-visible]");
      var typeSelect = event.target.closest("[data-shape-type]");
      var rateSelect = event.target.closest("[data-shape-rate]");
      var providerSelect = event.target.closest("#providerSelect");

      if (visibleInput) {
        var shapeId = visibleInput.getAttribute("data-shape-visible");
        var isChecked = visibleInput.checked;
        if (mapController && typeof mapController.toggleShapeVisibility === "function") {
          mapController.toggleShapeVisibility(shapeId, isChecked);
        }
        if (root.UOS.ProgramApp) {
          root.UOS.ProgramApp.updateWorkspace(function (candidate) {
            return root.UOS.WorkAreaService.updateGeometry(candidate, shapeId, { payload: { visible: isChecked } });
          }).then(renderShapeCards);
        }
      } else if (typeSelect) {
        var shapeId = typeSelect.getAttribute("data-shape-type");
        var newType = typeSelect.value;
        if (mapController && typeof mapController.updateShapeType === "function") {
          mapController.updateShapeType(shapeId, newType);
        }
        if (root.UOS.ProgramApp) {
          root.UOS.ProgramApp.updateWorkspace(function (candidate) {
            candidate = root.UOS.WorkAreaService.updateGeometry(candidate, shapeId, {
              workTypeKey: newType,
              rateItemId: null,
              payload: { type: newType, workTypeKey: newType, rateItemId: null }
            });
            var changedGeometry = root.UOS.ProgramModel.workGeometryById(candidate, shapeId);
            var changedRate = changedGeometry && root.UOS.WorkAreaService.resolveGeometryRate(candidate, changedGeometry);
            return changedRate ? syncExistingGeometryWork(candidate, shapeId) : candidate;
          }).then(renderShapeCards);
        }
        var card = typeSelect.closest("[data-shape-card-id]");
        if (card) {
          var toggleSpan = card.querySelector(".program-shape-card__toggle span");
          if (toggleSpan) {
            var parts = toggleSpan.textContent.split(".");
            var idxStr = parts.length > 1 ? parts[0] + "." : "";
            toggleSpan.textContent = idxStr + " " + workTypeLabel(newType);
          }
        }
      } else if (rateSelect) {
        var rateShapeId = rateSelect.getAttribute("data-shape-rate");
        var selectedRateItemId = text(rateSelect.value);
        if (!selectedRateItemId || !root.UOS.ProgramApp) return;
        root.UOS.ProgramApp.updateWorkspace(function (candidate) {
          candidate = root.UOS.WorkAreaService.updateGeometry(candidate, rateShapeId, {
            rateItemId: selectedRateItemId,
            payload: { rateItemId: selectedRateItemId }
          });
          return syncExistingGeometryWork(candidate, rateShapeId);
        }).then(renderShapeCards).catch(function (error) {
          if (root.UOS.toast) root.UOS.toast(error.message || "Unable to change polygon pricing rate.", "error");
          renderShapeCards();
        });
      } else if (providerSelect) {
        activeProviderId = providerSelect.value;
        if (mapController && typeof mapController.setProvider === "function") {
          mapController.setProvider(activeProviderId);
        }
      }
    });

    var providerSelect = one("#providerSelect");
    if (providerSelect) {
      providerSelect.addEventListener("change", function (event) {
        activeProviderId = event.target.value;
        if (mapController && typeof mapController.setProvider === "function") {
          mapController.setProvider(activeProviderId);
        }
        var notice = one("#mapNotice");
        if (notice) {
          notice.textContent = activeProviderId === "offline" ? "Offline grid active. Choose a basemap provider when network context is useful." : "Basemap provider selected.";
        }
      });
    }

    root.document.addEventListener("uos:program-ready", function (event) {
      var workspace = event && event.detail && event.detail.workspace;
      var dest = workspace && workspace.workspace && workspace.workspace.destination;
      if (dest && dest !== "map") {
        previousDestination = dest;
        return;
      }
      render();
    });
  }

  function render() {
    bindEvents();
    var workspace = getWorkspace();
    var wsData = workspace && workspace.workspace ? workspace.workspace : {};
    var destination = wsData.destination || "";
    var mapState = applyCanonicalMapState(workspace);
    if (destination === "map" && !storedMapStateMatches(workspace, mapState)) {
      persistCanonicalMapState(mapState);
      return;
    }
    var activeOwnerMode = mapState.ownerMode || wsData.ownerMode;
    if (activeOwnerMode === "NSA" || activeOwnerMode === "EVT") {
      if (renderedOwnerMode !== activeOwnerMode) {
        selectedStatusFilters = [];
        selectedSpatialFilter = null;
        eventSearchQuery = "";
        var searchInput = one("#eventSearchInput,[data-event-search]");
        if (searchInput) searchInput.value = "";
      }
      renderedOwnerMode = activeOwnerMode;
    }

    var drawerMode = inRegisterDrawerMode();
    if (drawerMode) {
      var drawerMapWorkspace = one(".program-map-workspace");
      if (drawerMapWorkspace) drawerMapWorkspace.setAttribute("data-map-area-panel", editingShapeId ? "editor" : "inspector");
    }
    all("[data-map-scope]").forEach(function (btn) {
      var active = btn.getAttribute("data-map-scope") === sidebarScopeMode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    var mapControls = one('[data-module-controls="map"]');
    if (mapControls) {
      if (destination === "map") {
        mapControls.removeAttribute("hidden");
        mapControls.hidden = false;
      } else {
        mapControls.setAttribute("hidden", "hidden");
        mapControls.hidden = true;
      }
    }
    if (destination !== "map") { closeMapMenus(); return; }

        var enteredFromOtherTab = previousDestination !== "map";
    previousDestination = destination;

    try {
      updateSidebarViewUI();
      ensureMapInstance();
      var selId = selectedEventFilterId && selectedEventFilterId !== "all" ? selectedEventFilterId : "";

      var mapEvent;
      if (selId && mapController && typeof mapController.setEvent === "function") {
        mapEvent = buildMapEvent(selId);
        mapController.setEvent(mapEvent);
        if (typeof mapController.resize === "function") mapController.resize();
      } else if (mapController && typeof mapController.setEvent === "function") {
        mapEvent = buildMapEvent("all");
        mapController.setEvent(mapEvent);
        if (typeof mapController.resize === "function") mapController.resize();
      }

      // Handle entry into Space Map from another tab
      if (enteredFromOtherTab && mapController) {
        if (pendingCameraFocusId) {
          var focusId = pendingCameraFocusId;
          pendingCameraFocusId = null;
          filterMapByEvent(focusId, true);
        } else if (mapEvent && ((mapEvent.polygons && mapEvent.polygons.length) || (mapEvent.focusLocations && mapEvent.focusLocations.length))) {
          scheduleMapEventZoom();
        } else if (typeof mapController.resetView === "function") {
          mapController.resetView();
        }
        scheduleSelectedSidebarCardVisibility(selectedEventFilterId);
      }

      updateTogglesUI();
      updateDrawModeUI();
    } catch (err) {
      if (root.console && typeof root.console.warn === "function") root.console.warn("ProgramMapController render issue:", err);
    }
  }

  if (root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", bindEvents, { once: true });
    } else {
      bindEvents();
    }
  }

  return {
    init: function () { bindEvents(); render(); },
    render: render,
    getMapController: function () { return mapController; },
    setCameraFocusIntent: function (id) { pendingCameraFocusId = id ? String(id) : null; },
    focusRecord: function (id) {
      if (!id) return;
      filterMapByEvent(id);
    },
    resetView: function () {
      if (mapController && typeof mapController.resetView === "function") mapController.resetView();
    },
    getSelectedShapeId: function () { return selectedShapeId; },
    canonicalMapState: canonicalMapState,
    writeCanonicalMapState: writeCanonicalMapState,
    wktGeometry: wktGeometry,
    prepareGeoJsonShapes: prepareGeoJsonShapes,
    buildSpatialFilterIndex: buildSpatialFilterIndex,
    matchesSpatialFilter: matchesSpatialFilter,
    resolveFilteredMapDataset: resolveFilteredMapDataset,
    isPolygonGeometry: isPolygonGeometry
  };
}));
