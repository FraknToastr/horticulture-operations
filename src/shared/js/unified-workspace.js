(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var APP_ID = "uos.horticulture";
  var SCHEMA_VERSION = 1;
  var OWNERS = { NSA: "nature-strip", EVT: "remediation" };
  var COLLECTIONS = ["applications", "events", "projects", "jobs", "costingLines", "rateItems"];
  var TYPE_CODES = { application: "APP", event: "EVENT", project: "PROJ", job: "JOB", costingLine: "COST", rateItem: "RATE" };
  var COLLECTION_TYPES = { applications: "application", events: "event", projects: "project", jobs: "job", costingLines: "costingLine", rateItems: "rateItem" };
  var STORAGE = { app: "suite", name: "unified-workspace", key: "suite:unified-workspace" };

  function now() { return new Date().toISOString(); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function object(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function number(value) { var parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function ownerOfId(id) { var match = text(id).match(/^(NSA|EVT)-/); return match ? match[1] : ""; }
  function ownerName(owner) { return OWNERS[owner] || ""; }

  /* FNV-1a gives legacy records a compact deterministic identifier without
     exposing customer or event text inside a portable workspace identifier. */
  function hash(value) {
    var result = 2166136261;
    var input = String(value);
    for (var index = 0; index < input.length; index += 1) {
      result ^= input.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36).padStart(7, "0");
  }

  function generatedToken() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID().replace(/-/g, "");
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var values = new Uint32Array(4);
      window.crypto.getRandomValues(values);
      return Array.prototype.map.call(values, function (value) { return value.toString(36); }).join("");
    }
    return hash(now() + ":" + Math.random()) + hash(Math.random());
  }

  function entityId(owner, type, sourceId, discriminator) {
    if (!OWNERS[owner]) throw new Error("Entity owner must be NSA or EVT.");
    var code = TYPE_CODES[type];
    if (!code) throw new Error('Unsupported unified entity type "' + type + '".');
    var seed = text(sourceId);
    var context = text(discriminator);
    var token = seed || context ? hash(owner + ":" + type + ":" + seed + ":" + context) : generatedToken().slice(0, 16);
    return owner + "-" + code + "-" + token.toUpperCase();
  }

  function blank() {
    return {
      app: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: now(),
      entities: { applications: [], events: [], projects: [], jobs: [], costingLines: [], rateItems: [] },
      referenceData: {},
      workspace: { destination: "overview", selectedEntityId: null, calendarCursor: "", scheduler: { sort: "date", filters: {} } },
      imports: []
    };
  }

  function provenance(owner, legacyId, sourceApp, sourceVersion) {
    return { owner: owner, ownerName: ownerName(owner), legacyId: text(legacyId), sourceApp: sourceApp, sourceVersion: sourceVersion };
  }

  function baseEntity(owner, type, legacyId, discriminator, values, payload, sourceApp, sourceVersion) {
    values = values || {};
    return {
      id: entityId(owner, type, legacyId, discriminator),
      owner: owner,
      type: type,
      title: text(values.title),
      status: text(values.status),
      category: text(values.category),
      priority: text(values.priority),
      startDate: text(values.startDate),
      endDate: text(values.endDate),
      payload: clone(payload || {}),
      provenance: provenance(owner, legacyId, sourceApp, sourceVersion)
    };
  }

  function addUnique(collection, entity) {
    if (collection.some(function (item) { return item.id === entity.id; })) throw new Error('Duplicate unified id "' + entity.id + '".');
    collection.push(entity);
    return entity;
  }

  function rejectDuplicateLegacyIds(records, label) {
    var seen = {};
    records.forEach(function (record, index) {
      var id = text(record && record.id);
      if (!id) return;
      if (seen[id]) throw new Error(label + ' contains duplicate legacy id "' + id + '".');
      seen[id] = index + 1;
    });
  }

  function legacyLink(map, legacyId) { return map[text(legacyId)] || null; }

  function fromNatureV2(input, options) {
    options = options || {};
    if (!object(input) || input.app !== "uos.nature-strip" || Number(input.schemaVersion) !== 2) throw new Error("Expected a Nature Strip schemaVersion 2 workspace.");
    if (!Array.isArray(input.applications) || !Array.isArray(input.projects) || !Array.isArray(input.scheduleItems)) throw new Error("Nature Strip workspace collections are malformed.");
    var output = blank();
    var appIds = {};
    var projectIds = {};
    rejectDuplicateLegacyIds(input.applications, "Nature Strip applications");
    rejectDuplicateLegacyIds(input.projects, "Nature Strip projects");
    rejectDuplicateLegacyIds(input.scheduleItems, "Nature Strip schedule items");
    input.applications.forEach(function (record, index) {
      if (!object(record)) throw new Error("Nature Strip application " + (index + 1) + " is malformed.");
      var entity = addUnique(output.entities.applications, baseEntity("NSA", "application", record.id, index, {
        title: record.address || record.receipt || "Nature Strip application",
        status: record.status,
        category: record.applicationType,
        startDate: record.dateReceived,
        endDate: record.completionDate
      }, record, input.app, 2));
      appIds[text(record.id)] = entity.id;
    });
    input.projects.forEach(function (record, index) {
      if (!object(record)) throw new Error("Nature Strip project " + (index + 1) + " is malformed.");
      var details = object(record.details) ? record.details : record;
      var entity = addUnique(output.entities.projects, baseEntity("NSA", "project", record.id, index, {
        title: details.title || details.address || "Nature Strip project",
        status: details.status,
        category: details.category,
        priority: details.priority,
        startDate: details.startDate,
        endDate: details.targetEndDate
      }, record, input.app, 2));
      entity.applicationId = legacyLink(appIds, record.applicationRef || record.applicationId);
      entity.approvedBudget = Math.max(0, number(details.budget));
      projectIds[text(record.id)] = entity.id;
      ["materials", "labour"].forEach(function (field) {
        (Array.isArray(record[field]) ? record[field] : []).forEach(function (row, rowIndex) {
          if (!object(row)) throw new Error("Nature Strip project " + (index + 1) + " " + field + " row " + (rowIndex + 1) + " is malformed.");
          addUnique(output.entities.costingLines, costingLine("NSA", entity, field === "materials" ? "material" : "labour", row, rowIndex, input.app, 2));
        });
      });
    });
    input.scheduleItems.forEach(function (record, index) {
      if (!object(record)) throw new Error("Nature Strip schedule item " + (index + 1) + " is malformed.");
      var projectId = legacyLink(projectIds, record.projectRef);
      var applicationId = legacyLink(appIds, record.applicationRef);
      var job = addUnique(output.entities.jobs, baseEntity("NSA", "job", record.id, index, {
        title: record.title || "Scheduled Nature Strip work",
        status: record.status,
        category: "Nature Strip",
        startDate: record.date || (record.dates || [])[0],
        endDate: record.endDate
      }, record, input.app, 2));
      job.groupId = projectId || applicationId;
      job.parentJobId = null;
      job.applicationId = applicationId;
      job.projectId = projectId;
      job.sourceEntityId = projectId || applicationId;
      job.crewId = null;
      job.estimate = 0;
      job.actualCost = null;
      [projectId, applicationId].filter(Boolean).forEach(function (linkedId) {
        var linked = output.entities.projects.concat(output.entities.applications).find(function (candidate) { return candidate.id === linkedId; });
        if (linked) { linked.scheduleJobIds = Array.isArray(linked.scheduleJobIds) ? linked.scheduleJobIds : []; linked.scheduleJobIds.push(job.id); }
      });
    });
    output.referenceData.NSA = clone(input.referenceData || {});
    output.imports.push({ owner: "NSA", sourceApp: input.app, sourceVersion: 2, importedAt: now(), sourceName: text(options.sourceName) });
    output.updatedAt = text(input.updatedAt) || now();
    return output;
  }

  function costingLine(owner, eventEntity, sourceType, record, index, sourceApp, sourceVersion) {
    var legacyId = record && record.id;
    var line = baseEntity(owner, "costingLine", legacyId, eventEntity.id + ":" + sourceType + ":" + index, {
      title: record.label || record.item || record.task || "Costing line",
      status: "Unassigned",
      category: sourceType
    }, record, sourceApp, sourceVersion);
    line.eventId = eventEntity.type === "event" ? eventEntity.id : null;
    line.projectId = eventEntity.type === "project" ? eventEntity.id : null;
    line.jobId = null;
    line.assignmentState = "Unassigned";
    line.sourcePolygonId = text(record.sourcePolygonId) || null;
    line.quantity = Math.max(0, number(record.quotedQuantity == null ? record.qty == null ? record.hours : record.qty : record.quotedQuantity));
    line.unit = text(record.dimensionUnit || record.unit || (sourceType === "labour" ? "hours" : ""));
    line.unitRate = Math.max(0, number(record.rate == null ? record.unitCost : record.rate));
    line.estimatedTotal = Math.max(0, number(record.total || line.quantity * line.unitRate));
    line.actualCost = null;
    return line;
  }

  function fromRemediationV2(input, options) {
    options = options || {};
    if (!object(input) || input.app !== "uos.remediation" || Number(input.schemaVersion) !== 2) throw new Error("Expected a Remediation schemaVersion 2 workspace.");
    if (!Array.isArray(input.events)) throw new Error("Remediation workspace events are malformed.");
    var output = blank();
    rejectDuplicateLegacyIds(input.events, "Remediation events");
    input.events.forEach(function (record, index) {
      if (!object(record)) throw new Error("Remediation event " + (index + 1) + " is malformed.");
      var event = addUnique(output.entities.events, baseEntity("EVT", "event", record.id, index, {
        title: record.eventName || record.park || "Remediation event",
        status: record.status,
        category: "Remediation",
        startDate: record.date,
        endDate: record.date
      }, record, input.app, 2));
      event.approvedBudget = Math.max(0, number(record.approvedBudget != null ? record.approvedBudget : (record.allocations || []).reduce(function (sum, row) { return sum + (row && row.enabled !== false ? number(row.total) : 0); }, 0)));
      var lineIds = {};
      ["allocations", "materials", "labour"].forEach(function (field) {
        (Array.isArray(record[field]) ? record[field] : []).forEach(function (row, rowIndex) {
          if (!object(row)) throw new Error("Remediation event " + (index + 1) + " " + field + " row " + (rowIndex + 1) + " is malformed.");
          var sourceType = field === "allocations" ? "allocation" : field.slice(0, -1);
          var line = addUnique(output.entities.costingLines, costingLine("EVT", event, sourceType, row, rowIndex, input.app, 2));
          lineIds[sourceType + ":" + text(row.id)] = line.id;
        });
      });
      var jobIds = {};
      (Array.isArray(record.jobs) ? record.jobs : []).forEach(function (sourceJob, jobIndex) {
        if (!object(sourceJob)) throw new Error("Remediation event " + (index + 1) + " job " + (jobIndex + 1) + " is malformed.");
        var job = addUnique(output.entities.jobs, baseEntity("EVT", "job", sourceJob.id, event.id + ":job:" + jobIndex, {
          title: sourceJob.title || record.eventName || "Remediation job", status: sourceJob.status, category: "Remediation",
          priority: sourceJob.priority, startDate: sourceJob.startDate, endDate: sourceJob.endDate
        }, sourceJob, input.app, 2));
        job.groupId = event.id;
        job.parentJobId = null;
        job.sourceEntityId = event.id;
        job.crewId = text(sourceJob.crewId) || null;
        job.estimate = Math.max(0, number(sourceJob.estimate));
        job.actualCost = sourceJob.actualCost == null ? null : Math.max(0, number(sourceJob.actualCost));
        job.completedAt = text(sourceJob.completedAt);
        job.promotedAt = text(sourceJob.promotedAt);
        jobIds[text(sourceJob.id)] = job.id;
      });
      (Array.isArray(record.jobs) ? record.jobs : []).forEach(function (sourceJob, jobIndex) {
        var parentId = jobIds[text(sourceJob.id)];
        (Array.isArray(sourceJob.tasks) ? sourceJob.tasks : []).forEach(function (sourceTask, taskIndex) {
          var task = addUnique(output.entities.jobs, baseEntity("EVT", "job", sourceTask.id, event.id + ":task:" + jobIndex + ":" + taskIndex, {
            title: sourceTask.title || "Remediation task", status: sourceTask.status, category: "Remediation",
            startDate: sourceTask.startDate, endDate: sourceTask.endDate
          }, sourceTask, input.app, 2));
          task.groupId = event.id;
          task.parentJobId = parentId;
          task.sourceEntityId = event.id;
          task.crewId = null;
          task.estimate = Math.max(0, number(sourceTask.estimate));
          task.actualCost = sourceTask.actualCost == null ? null : Math.max(0, number(sourceTask.actualCost));
          task.completedAt = text(sourceTask.completedAt);
        });
        (Array.isArray(sourceJob.costingLineRefs) ? sourceJob.costingLineRefs : []).forEach(function (reference) {
          var lineId = lineIds[text(reference.type) + ":" + text(reference.id)];
          var line = output.entities.costingLines.find(function (candidate) { return candidate.id === lineId; });
          if (line) { line.jobId = parentId; line.assignmentState = "Assigned"; }
        });
      });
    });
    output.referenceData.EVT = clone(input.referenceData || {});
    var catalogue = input.referenceData && input.referenceData.quoteCatalogue;
    (catalogue && Array.isArray(catalogue.items) ? catalogue.items : []).forEach(function (record, index) {
      var rate = addUnique(output.entities.rateItems, baseEntity("EVT", "rateItem", record.id, index, {
        title: record.label || record.description || "Rate item",
        status: record.active === false ? "Inactive" : "Active",
        category: record.section || record.category
      }, record, input.app, 2));
      rate.description = text(record.description || record.label);
      rate.unit = text(record.unit);
      rate.unitRate = Math.max(0, number(record.rate == null ? record.unitRate == null ? record.price : record.unitRate : record.rate));
      rate.active = record.active !== false;
    });
    output.imports.push({ owner: "EVT", sourceApp: input.app, sourceVersion: 2, importedAt: now(), sourceName: text(options.sourceName) });
    output.updatedAt = text(input.updatedAt) || now();
    return output;
  }

  function fromLegacyRemediation(input, options) {
    if (!object(input) || (Number(input.version) !== 1 && Number(input.version) !== 4) || !Array.isArray(input.events)) throw new Error("Expected a recognized legacy Remediation v1 or v4 workspace.");
    var converted = {
      app: "uos.remediation",
      schemaVersion: 2,
      events: clone(input.events),
      referenceData: clone(input.referenceData || {}),
      workspace: clone(input.workspace || {
        selectedId: input.selectedId || input.defaultSelectedId || null,
        view: input.activeTab === "map" ? "map" : input.activeTab === "costs" || input.activeTab === "costing" ? "costing" : "overview"
      })
    };
    var output = fromRemediationV2(converted, options);
    output.imports[0].sourceApp = "uos.remediation.legacy";
    output.imports[0].sourceVersion = Number(input.version);
    output.entities.events.concat(output.entities.costingLines, output.entities.rateItems).forEach(function (entity) {
      entity.provenance.sourceApp = "uos.remediation.legacy";
      entity.provenance.sourceVersion = Number(input.version);
    });
    return output;
  }

  function merge(left, right) {
    var output = normalize(left);
    var incoming = normalize(right);
    COLLECTIONS.forEach(function (name) {
      incoming.entities[name].forEach(function (entity) {
        var existing = output.entities[name].findIndex(function (item) { return item.id === entity.id; });
        if (existing >= 0) output.entities[name][existing] = clone(entity);
        else output.entities[name].push(clone(entity));
      });
    });
    output.referenceData = Object.assign({}, output.referenceData, clone(incoming.referenceData));
    output.imports = output.imports.concat(clone(incoming.imports));
    output.updatedAt = now();
    assertValid(output);
    return output;
  }

  function replaceOwner(current, adaptedOwnerWorkspace, owner) {
    if (!OWNERS[owner]) throw new Error("Replacement owner must be NSA or EVT.");
    var output = normalize(current);
    var replacement = normalize(adaptedOwnerWorkspace);
    COLLECTIONS.forEach(function (name) {
      var retained = output.entities[name].filter(function (entity) { return entity.owner !== owner; });
      var incoming = replacement.entities[name].filter(function (entity) { return entity.owner === owner; });
      output.entities[name] = retained.concat(clone(incoming));
    });
    if (Object.prototype.hasOwnProperty.call(replacement.referenceData, owner)) output.referenceData[owner] = clone(replacement.referenceData[owner]);
    else delete output.referenceData[owner];
    output.imports = output.imports.filter(function (entry) { return entry.owner !== owner; }).concat(replacement.imports.filter(function (entry) { return entry.owner === owner; }));
    output.updatedAt = now();
    assertValid(output);
    return output;
  }

  function findEntity(workspace, id) {
    var found = null;
    COLLECTIONS.some(function (name) {
      found = workspace.entities[name].find(function (entity) { return entity.id === id; }) || null;
      return Boolean(found);
    });
    return found;
  }

  function promoteToJob(input, sourceEntityId, values) {
    var output = normalize(input);
    values = values || {};
    var source = findEntity(output, sourceEntityId);
    if (!source || ["application", "event", "project"].indexOf(source.type) < 0) throw new Error("Only an application, event or project can be promoted to a job.");
    var existing = output.entities.jobs.find(function (job) { return job.sourceEntityId === source.id; });
    if (existing) return { workspace: output, job: existing, created: false };
    var promotedAt = text(values.promotedAt) || now();
    var job = baseEntity(source.owner, "job", "promotion:" + source.id, "", {
      title: values.title || source.title,
      status: values.status || "Draft",
      category: values.category || source.category || ownerName(source.owner),
      priority: values.priority || source.priority,
      startDate: values.startDate || source.startDate,
      endDate: values.endDate || source.endDate
    }, {}, APP_ID, SCHEMA_VERSION);
    job.sourceEntityId = source.id;
    job.groupId = text(values.groupId) || source.id;
    job.parentJobId = text(values.parentJobId) || null;
    job.crewId = text(values.crewId) || null;
    job.estimate = Math.max(0, number(values.estimate));
    job.actualCost = null;
    job.promotedAt = promotedAt;
    job.provenance.promotedFromType = source.type;
    source.promotedJobId = job.id;
    source.promotedAt = promotedAt;
    output.entities.jobs.push(job);
    output.updatedAt = now();
    assertValid(output);
    return { workspace: output, job: job, created: true };
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!object(value)) return value;
    return Object.keys(value).sort().reduce(function (result, key) { result[key] = stableValue(value[key]); return result; }, {});
  }

  function exportJson(input, pretty) {
    var output = normalize(input);
    COLLECTIONS.forEach(function (name) { output.entities[name].sort(function (a, b) { return a.id.localeCompare(b.id); }); });
    return JSON.stringify(stableValue(output), null, pretty === false ? 0 : 2);
  }

  function importJson(value) {
    var parsed = typeof value === "string" ? JSON.parse(value) : value;
    return normalize(parsed);
  }

  /* CSV/ZIP code consumes this lossless intermediate form. entityJson is the
     canonical source; the other columns permit safe inspection and filtering. */
  function exportTables(input) {
    var output = normalize(input);
    var tables = {};
    COLLECTIONS.forEach(function (name) {
      tables[name + ".csv"] = output.entities[name].slice().sort(function (a, b) { return a.id.localeCompare(b.id); }).map(function (entity) {
        return { id: entity.id, owner: entity.owner, type: entity.type, title: entity.title == null ? "" : String(entity.title), status: entity.status == null ? "" : String(entity.status), entityJson: JSON.stringify(stableValue(entity)) };
      });
    });
    return {
      "manifest.json": {
        app: APP_ID, schemaVersion: SCHEMA_VERSION, format: "uos-horticulture-csv-bundle", formatVersion: 1,
        updatedAt: output.updatedAt, files: COLLECTIONS.map(function (name) { return name + ".csv"; }),
        referenceData: clone(output.referenceData), workspace: clone(output.workspace), imports: clone(output.imports)
      },
      tables: tables
    };
  }

  function importTables(bundle) {
    if (!object(bundle) || !object(bundle["manifest.json"]) || !object(bundle.tables)) throw new Error("Unified table bundle requires manifest.json and tables.");
    var manifest = bundle["manifest.json"];
    if (manifest.app !== APP_ID || Number(manifest.schemaVersion) !== SCHEMA_VERSION || manifest.format !== "uos-horticulture-csv-bundle" || Number(manifest.formatVersion) !== 1) throw new Error("Unsupported unified table bundle manifest.");
    var output = blank();
    output.updatedAt = text(manifest.updatedAt) || now();
    output.referenceData = object(manifest.referenceData) ? clone(manifest.referenceData) : {};
    output.workspace = Object.assign({}, output.workspace, object(manifest.workspace) ? clone(manifest.workspace) : {});
    output.imports = Array.isArray(manifest.imports) ? clone(manifest.imports) : [];
    COLLECTIONS.forEach(function (name) {
      var rows = bundle.tables[name + ".csv"];
      if (!Array.isArray(rows)) throw new Error(name + ".csv is missing from the unified table bundle.");
      output.entities[name] = rows.map(function (row, index) {
        if (!object(row) || typeof row.entityJson !== "string") throw new Error(name + ".csv row " + (index + 1) + " has no entityJson column.");
        try { return JSON.parse(row.entityJson); } catch (error) { throw new Error(name + ".csv row " + (index + 1) + " contains invalid entityJson."); }
      });
    });
    return normalize(output);
  }

  var BUNDLE_LIMIT = 50 * 1024 * 1024;
  var CSV_COLUMNS = ["id", "owner", "type", "title", "status", "entityJson"];

  function utf8Encode(value) { return new TextEncoder().encode(String(value)); }
  function utf8Decode(value) { return new TextDecoder("utf-8", { fatal: true }).decode(value); }
  function put16(view, offset, value) { view.setUint16(offset, value, true); }
  function put32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
  function get16(view, offset) { return view.getUint16(offset, true); }
  function get32(view, offset) { return view.getUint32(offset, true); }
  var crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (var index = 0; index < 256; index += 1) {
        var value = index;
        for (var bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xEDB88320 ^ value >>> 1 : value >>> 1;
        crcTable[index] = value >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var cursor = 0; cursor < bytes.length; cursor += 1) crc = crcTable[(crc ^ bytes[cursor]) & 0xFF] ^ crc >>> 8;
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function csvCell(value) {
    var string = String(value == null ? "" : value);
    /* Match the suite CSV safety rule: spreadsheet engines may ignore a
       whitespace/control prefix before interpreting a formula trigger. */
    if (typeof value === "string" && /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(string)) string = "'" + string;
    return '"' + string.replace(/"/g, '""') + '"';
  }
  function encodeCsv(rows) {
    return CSV_COLUMNS.map(csvCell).join(",") + "\r\n" + rows.map(function (row) {
      return CSV_COLUMNS.map(function (column) { return csvCell(row[column]); }).join(",");
    }).join("\r\n") + (rows.length ? "\r\n" : "");
  }

  function decodeCsv(value, name) {
    var rows = [];
    var row = [];
    var cell = "";
    var quoted = false;
    for (var index = 0; index <= value.length; index += 1) {
      var character = index < value.length ? value[index] : "\n";
      if (quoted) {
        if (character === '"' && value[index + 1] === '"') { cell += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else cell += character;
      } else if (character === '"' && !cell) quoted = true;
      else if (character === ",") { row.push(cell); cell = ""; }
      else if (character === "\n" || character === "\r") {
        if (character === "\r" && value[index + 1] === "\n") index += 1;
        row.push(cell); cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cell += character;
    }
    if (!rows.length || rows[0].length !== CSV_COLUMNS.length || rows[0].some(function (column, columnIndex) { return column !== CSV_COLUMNS[columnIndex]; })) throw new Error(name + " has an invalid unified table header.");
    return rows.slice(1).map(function (values, rowIndex) {
      if (values.length !== CSV_COLUMNS.length) throw new Error(name + " row " + (rowIndex + 2) + " has an invalid column count.");
      var result = {};
      CSV_COLUMNS.forEach(function (column, columnIndex) { result[column] = values[columnIndex]; });
      return result;
    });
  }

  function zipStored(files) {
    var names = Object.keys(files).sort();
    var prepared = names.map(function (name) {
      if (!/^(?:manifest\.json|applications\.csv|events\.csv|projects\.csv|jobs\.csv|costingLines\.csv|rateItems\.csv)$/.test(name)) throw new Error('Unsafe unified bundle filename "' + name + '".');
      var nameBytes = utf8Encode(name);
      var data = files[name] instanceof Uint8Array ? files[name] : utf8Encode(files[name]);
      return { name: name, nameBytes: nameBytes, data: data, crc: crc32(data), offset: 0 };
    });
    var localSize = prepared.reduce(function (total, file) { return total + 30 + file.nameBytes.length + file.data.length; }, 0);
    var centralSize = prepared.reduce(function (total, file) { return total + 46 + file.nameBytes.length; }, 0);
    if (localSize + centralSize + 22 > BUNDLE_LIMIT) throw new Error("Unified workspace bundle exceeds the 50 MB limit.");
    var bytes = new Uint8Array(localSize + centralSize + 22);
    var view = new DataView(bytes.buffer);
    var cursor = 0;
    prepared.forEach(function (file) {
      file.offset = cursor;
      put32(view, cursor, 0x04034B50); put16(view, cursor + 4, 20); put16(view, cursor + 6, 0x0800); put16(view, cursor + 8, 0);
      put16(view, cursor + 10, 0); put16(view, cursor + 12, 0); put32(view, cursor + 14, file.crc); put32(view, cursor + 18, file.data.length); put32(view, cursor + 22, file.data.length);
      put16(view, cursor + 26, file.nameBytes.length); put16(view, cursor + 28, 0);
      bytes.set(file.nameBytes, cursor + 30); bytes.set(file.data, cursor + 30 + file.nameBytes.length);
      cursor += 30 + file.nameBytes.length + file.data.length;
    });
    var centralOffset = cursor;
    prepared.forEach(function (file) {
      put32(view, cursor, 0x02014B50); put16(view, cursor + 4, 20); put16(view, cursor + 6, 20); put16(view, cursor + 8, 0x0800); put16(view, cursor + 10, 0);
      put16(view, cursor + 12, 0); put16(view, cursor + 14, 0); put32(view, cursor + 16, file.crc); put32(view, cursor + 20, file.data.length); put32(view, cursor + 24, file.data.length);
      put16(view, cursor + 28, file.nameBytes.length); put16(view, cursor + 30, 0); put16(view, cursor + 32, 0); put16(view, cursor + 34, 0); put16(view, cursor + 36, 0);
      put32(view, cursor + 38, 0); put32(view, cursor + 42, file.offset); bytes.set(file.nameBytes, cursor + 46);
      cursor += 46 + file.nameBytes.length;
    });
    put32(view, cursor, 0x06054B50); put16(view, cursor + 4, 0); put16(view, cursor + 6, 0); put16(view, cursor + 8, prepared.length); put16(view, cursor + 10, prepared.length);
    put32(view, cursor + 12, centralSize); put32(view, cursor + 16, centralOffset); put16(view, cursor + 20, 0);
    return bytes;
  }

  function unzipStored(input) {
    var bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length > BUNDLE_LIMIT || bytes.length < 22) throw new Error("Unified workspace ZIP is empty or exceeds the 50 MB limit.");
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var eocd = -1;
    for (var cursor = bytes.length - 22, minimum = Math.max(0, bytes.length - 65557); cursor >= minimum; cursor -= 1) if (get32(view, cursor) === 0x06054B50) { eocd = cursor; break; }
    if (eocd < 0) throw new Error("Unified workspace ZIP has no valid directory.");
    var count = get16(view, eocd + 10);
    var centralSize = get32(view, eocd + 12);
    var centralOffset = get32(view, eocd + 16);
    if (count !== 7 || centralOffset + centralSize !== eocd || centralOffset > bytes.length) throw new Error("Unified workspace ZIP directory is malformed.");
    var files = {};
    cursor = centralOffset;
    for (var entry = 0; entry < count; entry += 1) {
      if (cursor + 46 > eocd || get32(view, cursor) !== 0x02014B50) throw new Error("Unified workspace ZIP entry is malformed.");
      var flags = get16(view, cursor + 8), method = get16(view, cursor + 10), checksum = get32(view, cursor + 16), size = get32(view, cursor + 24);
      var nameLength = get16(view, cursor + 28), extraLength = get16(view, cursor + 30), commentLength = get16(view, cursor + 32), localOffset = get32(view, cursor + 42);
      if (flags & 1 || method !== 0 || size > BUNDLE_LIMIT) throw new Error("Unified workspace ZIP uses encryption, compression, or an unsupported entry size.");
      if (cursor + 46 + nameLength + extraLength + commentLength > eocd) throw new Error("Unified workspace ZIP entry exceeds its directory.");
      var name = utf8Decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
      if (!/^(?:manifest\.json|applications\.csv|events\.csv|projects\.csv|jobs\.csv|costingLines\.csv|rateItems\.csv)$/.test(name) || files[name]) throw new Error('Unified workspace ZIP contains an unsafe or duplicate filename "' + name + '".');
      if (localOffset + 30 > centralOffset || get32(view, localOffset) !== 0x04034B50) throw new Error("Unified workspace ZIP local entry is malformed.");
      var localNameLength = get16(view, localOffset + 26), localExtraLength = get16(view, localOffset + 28);
      var localName = utf8Decode(bytes.slice(localOffset + 30, localOffset + 30 + localNameLength));
      if (localName !== name || get16(view, localOffset + 6) !== flags || get16(view, localOffset + 8) !== method || get32(view, localOffset + 14) !== checksum || get32(view, localOffset + 18) !== size || get32(view, localOffset + 22) !== size) throw new Error("Unified workspace ZIP local and central entries do not match.");
      var dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      if (dataOffset + size > centralOffset) throw new Error("Unified workspace ZIP entry data is truncated.");
      var data = bytes.slice(dataOffset, dataOffset + size);
      if (crc32(data) !== checksum) throw new Error('Unified workspace ZIP checksum failed for "' + name + '".');
      files[name] = data;
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }

  function exportBundle(input) {
    var bundle = exportTables(input);
    var files = { "manifest.json": JSON.stringify(stableValue(bundle["manifest.json"]), null, 2) };
    Object.keys(bundle.tables).forEach(function (name) { files[name] = encodeCsv(bundle.tables[name]); });
    return zipStored(files);
  }

  function importBundle(input) {
    var files = unzipStored(input);
    var manifest;
    try { manifest = JSON.parse(utf8Decode(files["manifest.json"])); } catch (error) { throw new Error("Unified workspace bundle manifest.json is invalid."); }
    var tables = {};
    COLLECTIONS.forEach(function (name) {
      var filename = name + ".csv";
      if (!files[filename]) throw new Error(filename + " is missing from the unified workspace bundle.");
      tables[filename] = decodeCsv(utf8Decode(files[filename]), filename);
    });
    return importTables({ "manifest.json": manifest, tables: tables });
  }

  function adapt(input, options) {
    if (!object(input)) throw new Error("Workspace must be an object.");
    if (input.app === APP_ID) return normalize(input);
    if (input.app === "uos.nature-strip") return fromNatureV2(input, options);
    if (input.app === "uos.remediation") return fromRemediationV2(input, options);
    if (!input.app && (Number(input.version) === 1 || Number(input.version) === 4)) return fromLegacyRemediation(input, options);
    throw new Error('Unsupported workspace app "' + text(input.app) + '".');
  }

  function normalize(input) {
    if (!object(input) || input.app !== APP_ID || Number(input.schemaVersion) !== SCHEMA_VERSION) throw new Error("Expected a unified Horticulture schemaVersion 1 workspace.");
    var output = blank();
    output.updatedAt = text(input.updatedAt) || now();
    COLLECTIONS.forEach(function (name) { output.entities[name] = clone(input.entities && Array.isArray(input.entities[name]) ? input.entities[name] : []); });
    output.referenceData = object(input.referenceData) ? clone(input.referenceData) : {};
    output.workspace = Object.assign({}, output.workspace, object(input.workspace) ? clone(input.workspace) : {});
    output.imports = Array.isArray(input.imports) ? clone(input.imports) : [];
    output.entities.costingLines.forEach(function (line) { line.assignmentState = line.jobId ? "Assigned" : "Unassigned"; });
    assertValid(output);
    return output;
  }

  function validate(input) {
    var errors = [];
    if (!object(input)) return ["Workspace must be an object."];
    if (input.app !== APP_ID) errors.push("app must be " + APP_ID + ".");
    if (Number(input.schemaVersion) !== SCHEMA_VERSION) errors.push("schemaVersion must be " + SCHEMA_VERSION + ".");
    if (!object(input.entities)) return errors.concat(["entities must be an object."]);
    var byId = {};
    COLLECTIONS.forEach(function (name) {
      if (!Array.isArray(input.entities[name])) { errors.push("entities." + name + " must be an array."); return; }
      input.entities[name].forEach(function (entity, index) {
        var path = "entities." + name + "[" + index + "]";
        if (!object(entity)) { errors.push(path + " must be an object."); return; }
        if (!text(entity.id)) errors.push(path + " requires an id.");
        else if (byId[entity.id]) errors.push('Duplicate unified id "' + entity.id + '".');
        else byId[entity.id] = entity;
        if (!OWNERS[entity.owner]) errors.push(path + " owner must be NSA or EVT.");
        if (ownerOfId(entity.id) !== entity.owner) errors.push(path + " id prefix must match its owner.");
        if (!TYPE_CODES[entity.type]) errors.push(path + " has an unsupported type.");
        if (COLLECTION_TYPES[name] !== entity.type) errors.push(path + " type must be " + COLLECTION_TYPES[name] + ".");
        var expectedPrefix = entity.owner + "-" + (TYPE_CODES[entity.type] || "") + "-";
        if (text(entity.id).indexOf(expectedPrefix) !== 0) errors.push(path + " id type code must match its entity type.");
      });
    });
    (input.entities.jobs || []).forEach(function (job, index) {
      ["groupId", "parentJobId"].forEach(function (field) {
        if (!job[field]) return;
        var linked = byId[job[field]];
        if (!linked) errors.push("entities.jobs[" + index + "]." + field + " is dangling.");
        else if (linked.owner !== job.owner) errors.push("entities.jobs[" + index + "]." + field + " cannot cross owners.");
        else if (field === "parentJobId" && linked.type !== "job") errors.push("entities.jobs[" + index + "].parentJobId must identify a job.");
      });
      var seen = {};
      var cursor = job;
      while (cursor && cursor.parentJobId) {
        if (seen[cursor.id]) { errors.push("entities.jobs[" + index + "].parentJobId forms a cycle."); break; }
        seen[cursor.id] = true;
        cursor = byId[cursor.parentJobId];
      }
    });
    (input.entities.costingLines || []).forEach(function (line, index) {
      var expected = line.jobId ? "Assigned" : "Unassigned";
      if (line.assignmentState !== expected) errors.push("entities.costingLines[" + index + "].assignmentState must be " + expected + ".");
      if (line.jobId) {
        var job = byId[line.jobId];
        if (!job || job.type !== "job") errors.push("entities.costingLines[" + index + "].jobId must identify a job.");
        else if (job.owner !== line.owner) errors.push("entities.costingLines[" + index + "].jobId cannot cross owners.");
      }
      if (line.sourcePolygonId != null && typeof line.sourcePolygonId !== "string") errors.push("entities.costingLines[" + index + "].sourcePolygonId must be a string or null.");
    });
    return Array.from(new Set(errors));
  }

  function assertValid(input) {
    var errors = validate(input);
    if (errors.length) throw new Error(errors.join("\n"));
    return input;
  }

  UOS.unifiedWorkspace = {
    appId: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    owners: clone(OWNERS),
    collections: COLLECTIONS.slice(),
    storage: clone(STORAGE),
    blank: blank,
    entityId: entityId,
    ownerOfId: ownerOfId,
    adapt: adapt,
    fromNatureV2: fromNatureV2,
    fromRemediationV2: fromRemediationV2,
    fromLegacyRemediation: fromLegacyRemediation,
    merge: merge,
    replaceOwner: replaceOwner,
    promoteToJob: promoteToJob,
    exportJson: exportJson,
    importJson: importJson,
    exportTables: exportTables,
    importTables: importTables,
    exportBundle: exportBundle,
    importBundle: importBundle,
    normalize: normalize,
    validate: validate,
    assertValid: assertValid
  };
})();
