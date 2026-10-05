'use strict';
// Virtual stores isolate all canonical, probe and recovery keys from old apps.
(function () {
  var prefix = 'hort_ops_single_writer_v1:';
  var workspaceKey = 'hort_ops_workspace_v2_single_writer_v1';
  function physical(key) {
    key = String(key);
    return key === workspaceKey || key === 'hort_ops_workspace_v2' ? workspaceKey : prefix + key;
  }
  function owned(key) { return key === workspaceKey || (key && key.indexOf(prefix) === 0); }
  function allowed() { return window.HortOpsWriterSession && window.HortOpsWriterSession.canPersist(); }
  function createStore(name) {
    var raw;
    try { raw = window[name]; } catch (error) { raw = null; }
    function available() { if (!raw) throw new Error('Persistent browser storage is unavailable'); return raw; }
    function writable() { if (!allowed()) throw new Error('Workspace is read-only: exclusive ownership required'); return available(); }
    function keys() {
      var store = available(), result = [];
      for (var i = 0; i < store.length; i++) {
        var key = store.key(i);
        if (owned(key)) result.push(key === workspaceKey ? 'hort_ops_workspace_v2' : key.slice(prefix.length));
      }
      return result;
    }
    var store = {
      getItem: function(key) { return available().getItem(physical(key)); },
      setItem: function(key, value) { writable().setItem(physical(key), String(value)); },
      removeItem: function(key) { writable().removeItem(physical(key)); },
      clear: function() { var rawStore = writable(); keys().forEach(function(key) { rawStore.removeItem(physical(key)); }); },
      key: function(index) { return keys()[index] || null; }
    };
    Object.defineProperty(store, 'length', { get: function() { return keys().length; } });
    return store;
  }
  Object.defineProperty(window, 'HortOpsClientStorage', { value: Object.freeze({
    localStorage: createStore('localStorage'), sessionStorage: createStore('sessionStorage'),
    physicalKey: physical, workspaceKey: workspaceKey
  }), writable: false, configurable: false });
}());
