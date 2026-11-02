(function (root) {
  "use strict";
  var UOS = root.UOS = root.UOS || {}, editors = [], pending = null;
  function isDirty() { return Boolean(pending) || editors.some(function (editor) { return editor.isDirty(); }); }
  function flushAll() {
    if (pending) return pending;
    var dirty = editors.filter(function (editor) { return editor.isDirty(); });
    if (!dirty.length) return Promise.resolve();
    pending = dirty.reduce(function (chain, editor) {
      return chain.then(function () { return editor.flush(); });
    }, Promise.resolve()).finally(function () { pending = null; });
    return pending;
  }
  UOS.ProgramFieldCommits = {
    register: function (editor) {
      editors.push(editor);
      return function () { var index = editors.indexOf(editor); if (index >= 0) editors.splice(index, 1); };
    },
    isDirty: isDirty,
    flushAll: flushAll
  };
  if (typeof module !== "undefined" && module.exports) module.exports = UOS.ProgramFieldCommits;
})(typeof window !== "undefined" ? window : globalThis);
