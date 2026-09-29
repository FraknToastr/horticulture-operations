(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var MAX_RECORDS = 50;
  var records = [];

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== "object") return value;
    var result = {};
    Object.keys(value).sort().forEach(function (key) {
      result[key] = stableValue(value[key]);
    });
    return result;
  }

  function fingerprint(value) {
    return JSON.stringify(stableValue(value));
  }

  function entityMap(workspace, collection) {
    var entities = workspace && workspace.entities;
    var values = entities && Array.isArray(entities[collection]) ? entities[collection] : [];
    return values.reduce(function (result, entity) {
      var id = text(entity && entity.id);
      if (id) result[id] = fingerprint(entity);
      return result;
    }, {});
  }

  function collectionNames(before, after) {
    var names = {};
    [before, after].forEach(function (workspace) {
      var entities = workspace && workspace.entities;
      if (!entities || typeof entities !== "object") return;
      Object.keys(entities).forEach(function (name) {
        if (Array.isArray(entities[name])) names[name] = true;
      });
    });
    return Object.keys(names).sort();
  }

  function deriveChangeSet(before, after) {
    var changed = {};
    var operations = {};
    collectionNames(before, after).forEach(function (collection) {
      var prior = entityMap(before, collection);
      var next = entityMap(after, collection);
      var added = Object.keys(next).filter(function (id) { return !Object.prototype.hasOwnProperty.call(prior, id); }).sort();
      var removed = Object.keys(prior).filter(function (id) { return !Object.prototype.hasOwnProperty.call(next, id); }).sort();
      var updated = Object.keys(next).filter(function (id) {
        return Object.prototype.hasOwnProperty.call(prior, id) && prior[id] !== next[id];
      }).sort();
      var ids = added.concat(removed, updated).sort();
      if (!ids.length) return;
      changed[collection] = ids;
      operations[collection] = { added: added, updated: updated, removed: removed };
    });
    return { changed: changed, operations: operations };
  }

  function revisionOf(workspace) {
    var value = Number(workspace && workspace.workspaceRevision);
    return Number.isFinite(value) ? value : 0;
  }

  function recordMutation(input) {
    input = input || {};
    var changeSet = deriveChangeSet(input.before, input.after);
    if (!Object.keys(changeSet.changed).length) return null;
    var record = {
      revision: revisionOf(input.after),
      command: text(input.command) || "ProgramApp.updateWorkspace",
      changed: changeSet.changed,
      operations: changeSet.operations,
      durationMs: Math.max(0, Number(input.durationMs) || 0)
    };
    records.push(record);
    if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
    return JSON.parse(JSON.stringify(record));
  }

  function latest() {
    return records.length ? JSON.parse(JSON.stringify(records[records.length - 1])) : null;
  }

  function history() {
    return JSON.parse(JSON.stringify(records));
  }

  function reset() {
    records.length = 0;
  }

  UOS.ProgramObservability = {
    MAX_RECORDS: MAX_RECORDS,
    deriveChangeSet: deriveChangeSet,
    recordMutation: recordMutation,
    latest: latest,
    history: history,
    reset: reset
  };
}());
