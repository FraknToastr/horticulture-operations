(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var OWNER_COLLECTIONS = ["applications", "events", "projects", "jobs", "tasks", "catalogs", "costingLines", "rateItems", "geometries", "quoteLines", "quotes", "payments", "paymentAllocations", "quoteEvents"];

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function equal(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!object(value)) return value;
    return Object.keys(value).sort().reduce(function (result, key) { result[key] = stable(value[key]); return result; }, {});
  }
  function fingerprint(value) {
    var input = JSON.stringify(stable(value)), result = 2166136261;
    for (var index = 0; index < input.length; index += 1) { result ^= input.charCodeAt(index); result = Math.imul(result, 16777619); }
    return "fnv1a32:" + (result >>> 0).toString(16).padStart(8, "0");
  }
  function entityRoot(workspace) { return object(workspace && workspace.entities) ? workspace.entities : workspace; }
  function collections(workspace) {
    var root = entityRoot(workspace || {});
    var named = Object.keys(root || {}).filter(function (name) { return Array.isArray(root[name]); });
    return Array.from(new Set(OWNER_COLLECTIONS.concat(named)));
  }
  function list(workspace, name) {
    var root = entityRoot(workspace || {});
    return Array.isArray(root[name]) ? root[name] : [];
  }
  function owner(record) {
    var value = text(record && (record.owner || record.ownership)).toUpperCase();
    if (value === "NSA" || value === "NATURE" || value === "NATURE STRIP") return "NSA";
    if (value === "EVT" || value === "REMEDIATION") return "EVT";
    var id = text(record && record.id).toUpperCase();
    return id.indexOf("NSA-") === 0 ? "NSA" : id.indexOf("EVT-") === 0 ? "EVT" : "";
  }
  function recordKey(record, index) {
    return text(record && record.id) || text(record && record.provenance && record.provenance.legacyId) || "#" + index;
  }
  function modelFor(options) {
    var model = options && options.model || UOS.ProgramModel || UOS.programModel;
    if (!model) throw new Error("UOS.ProgramModel must be loaded before the migration engine.");
    return model;
  }
  function validate(model, workspace) {
    var errors = [];
    if (typeof model.validate === "function") errors = model.validate(workspace) || [];
    if (errors.length) throw new Error("Migration candidate is invalid:\n" + Array.from(errors).join("\n"));
    if (typeof model.assertValid === "function") model.assertValid(workspace);
    return workspace;
  }
  function normalize(model, input) {
    if (input && input.app === "uos.horticulture" && Number(input.schemaVersion) === 1 && typeof model.fromV1 === "function") return model.fromV1(clone(input));
    if (typeof model.adapt === "function") return model.adapt(clone(input));
    if (typeof model.normalize === "function") return model.normalize(clone(input));
    throw new Error("UOS.ProgramModel requires an adapt() or normalize() method.");
  }
  function adaptNative(model, input, sourceName) {
    var options = { sourceName: sourceName };
    if (input.app === "uos.nature-strip" && typeof model.fromNatureV2 === "function") return model.fromNatureV2(clone(input), options);
    if (input.app === "uos.remediation" && typeof model.fromRemediationV2 === "function") return model.fromRemediationV2(clone(input), options);
    if (!input.app && (Number(input.version) === 1 || Number(input.version) === 4) && typeof model.fromLegacyRemediation === "function") return model.fromLegacyRemediation(clone(input), options);
    /* During cutover, the proven v1 adapters remain the bounded parser for
       native payloads. ProgramModel then performs the single v1 -> v2 lift. */
    if (UOS.unifiedWorkspace && typeof UOS.unifiedWorkspace.adapt === "function" && typeof model.fromV1 === "function") {
      return model.fromV1(UOS.unifiedWorkspace.adapt(clone(input), options));
    }
    return normalize(model, input);
  }
  function replaceOwner(model, current, incoming, ownerCode) {
    if (typeof model.replaceOwner === "function") return model.replaceOwner(current, incoming, ownerCode);
    var output = clone(current);
    var outputRoot = entityRoot(output);
    var incomingRoot = entityRoot(incoming);
    collections(output).concat(collections(incoming)).forEach(function (name) {
      if (!Array.isArray(outputRoot[name]) && !Array.isArray(incomingRoot[name])) return;
      outputRoot[name] = list(output, name).filter(function (item) { return owner(item) !== ownerCode; })
        .concat(list(incoming, name).filter(function (item) { return owner(item) === ownerCode; }).map(clone));
    });
    output.referenceData = object(output.referenceData) ? output.referenceData : {};
    if (incoming.referenceData && Object.prototype.hasOwnProperty.call(incoming.referenceData, ownerCode)) output.referenceData[ownerCode] = clone(incoming.referenceData[ownerCode]);
    if (Array.isArray(output.imports)) output.imports = output.imports.filter(function (entry) { return entry.owner !== ownerCode; }).concat((incoming.imports || []).filter(function (entry) { return entry.owner === ownerCode; }).map(clone));
    return output;
  }
  function identityValues(record) {
    var provenance = object(record && record.provenance) ? record.provenance : {};
    return [text(record && record.id), text(provenance.sourceId), text(provenance.legacyId), text(record && record.legacyId)].filter(Boolean);
  }
  function semanticKey(name, record) {
    var fields = {
      applications: ["title", "address"], events: ["title", "startDate", "address"], projects: ["applicationId", "eventId", "title"],
      jobs: ["projectId", "title", "startDate"], costingLines: ["projectId", "jobId", "description"], geometries: ["projectId", "geometryKind", "title"],
      catalogs: ["owner", "financialYear"], quotes: ["projectId", "quoteNumber"], quoteLines: ["quoteId", "description"], payments: ["quoteId", "reference"],
      paymentAllocations: ["paymentId", "quoteLineId", "amount"], rateItems: ["catalogId", "category", "description", "unit"]
    }[name];
    if (!fields) return "";
    var values = fields.map(function (field) { return text(record && record[field]).toLowerCase(); });
    return values.some(Boolean) ? values.join("|") : "";
  }
  function mergeOwner(current, incoming, ownerCode, conflicts, sourceKind) {
    var output = clone(current), outputRoot = entityRoot(output);
    collections(output).concat(collections(incoming)).forEach(function (name) {
      if (!Array.isArray(outputRoot[name])) outputRoot[name] = [];
      var indexes = {}, semantic = {};
      outputRoot[name].forEach(function (item, index) {
        identityValues(item).forEach(function (value) { (indexes[value] = indexes[value] || []).push(index); });
        var key = semanticKey(name, item); if (key) (semantic[key] = semantic[key] || []).push(index);
      });
      list(incoming, name).forEach(function (item) {
        if (owner(item) !== ownerCode) return;
        var matches = [];
        identityValues(item).forEach(function (value) { (indexes[value] || []).forEach(function (index) { if (matches.indexOf(index) < 0) matches.push(index); }); });
        var key = semanticKey(name, item);
        if (!matches.length && key) matches = (semantic[key] || []).slice();
        if (matches.length > 1) {
          conflicts.push({ collection: name, id: text(item.id), owner: ownerCode, resolution: "blocked", source: sourceKind, error: "Incoming record matches multiple existing identities." });
          return;
        }
        if (matches.length === 1) {
          if (!equal(outputRoot[name][matches[0]], item)) conflicts.push({ collection: name, id: text(item.id), owner: ownerCode, resolution: "existing-retained", source: sourceKind });
          return;
        }
        outputRoot[name].push(clone(item));
        var appended = outputRoot[name].length - 1;
        identityValues(item).forEach(function (value) { (indexes[value] = indexes[value] || []).push(appended); });
        if (key) (semantic[key] = semantic[key] || []).push(appended);
      });
    });
    return output;
  }
  function blank(model) {
    if (typeof model.blank !== "function") throw new Error("UOS.ProgramModel requires blank().");
    return model.blank();
  }
  function sourceDescriptor(kind, input) {
    if (!input) return null;
    var version = input.schemaVersion == null ? input.version : input.schemaVersion;
    return { kind: kind, app: text(input.app) || (kind === "remediation" ? "uos.remediation.legacy" : ""), version: Number(version) || null };
  }
  function conflictPreview(before, after, ownerCode, sourceKind) {
    var conflicts = [];
    collections(before).concat(collections(after)).forEach(function (name) {
      var prior = {};
      list(before, name).forEach(function (record, index) { if (owner(record) === ownerCode) prior[recordKey(record, index)] = record; });
      list(after, name).forEach(function (record, index) {
        if (owner(record) !== ownerCode) return;
        var key = recordKey(record, index);
        if (prior[key] && !equal(prior[key], record)) conflicts.push({ collection: name, id: key, owner: ownerCode, resolution: "native-wins", source: sourceKind });
      });
    });
    return conflicts;
  }
  function countPreview(workspace) {
    var result = { total: 0, byCollection: {}, byOwner: { NSA: 0, EVT: 0, unknown: 0 } };
    collections(workspace).forEach(function (name) {
      var rows = list(workspace, name);
      if (!rows.length) return;
      result.byCollection[name] = rows.length;
      result.total += rows.length;
      rows.forEach(function (row) { var code = owner(row); result.byOwner[code || "unknown"] += 1; });
    });
    return result;
  }

  /* Staging is pure: caller inputs are cloned, and persistence is never invoked. */
  function stage(sources, options) {
    sources = sources || {};
    options = options || {};
    var model = modelFor(options);
    var warnings = [];
    var conflicts = [];
    var summary = [];
    var candidate = sources.unified ? normalize(model, sources.unified) : blank(model);
    if (sources.unified) summary.push(sourceDescriptor("unified", sources.unified));

    [["nature", "NSA"], ["remediation", "EVT"]].forEach(function (pair) {
      var kind = pair[0], ownerCode = pair[1], input = sources[kind];
      if (!input) return;
      var adapted;
      try { adapted = adaptNative(model, input, text(options.sourceNames && options.sourceNames[kind])); }
      catch (error) {
        warnings.push(kind + " source could not be adapted: " + error.message);
        conflicts.push({ collection: "source", id: kind, owner: ownerCode, resolution: "blocked", source: kind, error: error.message });
        return;
      }
      var policy = options.ownerPolicies && options.ownerPolicies[ownerCode] === "replace" ? "replace" : "merge";
      if (policy === "replace") {
        conflicts = conflicts.concat(conflictPreview(candidate, adapted, ownerCode, kind));
        candidate = replaceOwner(model, candidate, adapted, ownerCode);
        warnings.push((ownerCode === "NSA" ? "Nature Strip" : "Remediation") + " owner slice is explicitly selected for replacement.");
      } else {
        candidate = mergeOwner(candidate, adapted, ownerCode, conflicts, kind);
        warnings.push((ownerCode === "NSA" ? "Nature Strip" : "Remediation") + " records are staged in merge mode; existing identities are retained.");
      }
      summary.push(sourceDescriptor(kind, input));
    });

    candidate.migration = object(candidate.migration) ? candidate.migration : {};
    candidate.migration.status = "staged";
    candidate.migration.stagedAt = new Date().toISOString();
    candidate.migration.migratedAt = "";
    candidate.migration.sources = clone(summary);
    candidate.migration.warnings = clone(warnings);
    var validationErrors = [];
    try {
      candidate = typeof model.normalize === "function" ? model.normalize(candidate) : candidate;
      if (UOS.ProjectFunding && typeof UOS.ProjectFunding.migrateApprovedBudgets === "function") candidate = UOS.ProjectFunding.migrateApprovedBudgets(candidate);
      validate(model, candidate);
    } catch (error) { validationErrors.push(error.message); }
    candidate.migration = object(candidate.migration) ? candidate.migration : {};
    candidate.migration.policies = clone(options.ownerPolicies || { NSA: "merge", EVT: "merge" });
    candidate.migration.conflicts = clone(conflicts);
    candidate.migration.validationErrors = clone(validationErrors);
    candidate.migration.warnings = clone((candidate.migration.warnings || []).concat(warnings, validationErrors).filter(function (value, index, values) { return values.indexOf(value) === index; }));
    return {
      kind: "uos.program-migration-stage",
      candidate: clone(candidate),
      baseFingerprint: fingerprint(sources.unified || options.currentWorkspace || blank(model)),
      preview: { counts: countPreview(candidate), warnings: candidate.migration.warnings, conflicts: conflicts, sources: summary, policies: clone(candidate.migration.policies), validationErrors: validationErrors, blocked: validationErrors.length > 0 || conflicts.some(function (item) { return item.resolution === "blocked"; }) },
      applied: false
    };
  }
  function apply(staged, options) {
    if (!staged || staged.kind !== "uos.program-migration-stage" || staged.applied) throw new Error("A fresh staged migration is required.");
    if (staged.preview && staged.preview.blocked) throw new Error("Migration has unresolved validation errors and cannot be applied.");
    if (options && options.currentWorkspace && fingerprint(options.currentWorkspace) !== staged.baseFingerprint) throw new Error("Workspace changed after migration staging; inspect and stage the sources again.");
    var model = modelFor(options);
    var candidate = clone(staged.candidate);
    candidate.migration = object(candidate.migration) ? candidate.migration : {};
    candidate.migration.status = "complete";
    candidate.migration.migratedAt = new Date().toISOString();
    validate(model, candidate);
    var commit = options && options.commit;
    if (typeof commit === "function") {
      return Promise.resolve(commit(clone(candidate))).then(function () { staged.applied = true; return candidate; });
    }
    staged.applied = true;
    return candidate;
  }

  var DEEP_LINKS = [
    { parameter: "application", type: "application", owner: "NSA" },
    { parameter: "project", type: "project", owner: "NSA" },
    { parameter: "event", type: "event", owner: "EVT" },
    { parameter: "job", type: "job", owner: "" }
  ];
  function parseLegacyDeepLink(search) {
    var params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    for (var index = 0; index < DEEP_LINKS.length; index += 1) {
      var definition = DEEP_LINKS[index];
      var id = text(params.get(definition.parameter));
      if (id.length > 240) continue;
      if (id) return { parameter: definition.parameter, type: definition.type, owner: definition.owner, legacyId: id, view: text(params.get("view")) };
    }
    return null;
  }
  function mapLegacyDeepLink(search, lookup) {
    var link = parseLegacyDeepLink(search);
    if (!link) return null;
    if (typeof lookup === "function") link.entityId = text(lookup(link)) || null;
    else if (lookup && object(lookup)) link.entityId = text(lookup[link.owner + ":" + link.type + ":" + link.legacyId] || lookup[link.legacyId]) || null;
    else link.entityId = null;
    return link;
  }
  function redirectUrl(base, locationLike) {
    locationLike = locationLike || window.location || {};
    var search = String(locationLike.search || "");
    var hash = String(locationLike.hash || "");
    if (search && search.charAt(0) !== "?") search = "?" + search;
    if (hash && hash.charAt(0) !== "#") hash = "#" + hash;
    return String(base || "../program-planner/").replace(/[?#].*$/, "") + search + hash;
  }

  UOS.ProgramMigration = {
    stage: stage,
    apply: apply,
    fingerprint: fingerprint,
    countPreview: countPreview,
    parseLegacyDeepLink: parseLegacyDeepLink,
    mapLegacyDeepLink: mapLegacyDeepLink,
    redirectUrl: redirectUrl
  };
})();
