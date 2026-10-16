const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('src/remediation-planner/config/metromaps-provider.js', 'utf8');
function load(storage = new Map(), broken = false) {
  const events = new Map();
  const context = { addEventListener: (type, listener) => events.set(type, listener), UOS_REMEDIATION_MAP_CONFIG: { defaultProvider: 'esri-world-imagery', providers: [] }, localStorage: {
    getItem: key => { if (broken) throw Error('blocked'); return storage.get(key); },
    setItem: (key, value) => { if (broken) throw Error('blocked'); storage.set(key, value); },
    removeItem: key => { if (broken) throw Error('blocked'); storage.delete(key); }
  } };
  vm.runInNewContext(source, context);
  return { api: context.UOS.MetroMapCredentials, config: context.UOS_REMEDIATION_MAP_CONFIG, storage, dispatch: (type, event = {}) => events.get(type)?.(event) };
}
test('MetroMap defaults to Esri and activates only from entered or saved credentials', () => {
  const { api, config, storage } = load();
  assert.equal(config.defaultProvider, 'esri-world-imagery');
  assert.equal(config.providers.length, 0);
  api.activate('test-key-manual', false);
  assert.equal(api.status().active, true);
  assert.equal(storage.size, 0);
  assert.match(config.providers[0].tiles[0], /key\/test-key-manual\//);
  assert.doesNotMatch(JSON.stringify(api.status()), /test-key-manual/);
  assert.throws(() => api.activate('https://bad/key', true), /valid/);
});
test('saving restores on a later visit; forgetting leaves the active tab intact', () => {
  const first = load(); first.api.activate('test-key-saved', true);
  const second = load(first.storage);
  assert.equal(second.api.status().saved, true);
  assert.equal(second.config.defaultProvider, 'metromaps');
  second.api.forget();
  assert.equal(second.api.status().saved, false);
  assert.equal(second.api.status().active, true);
  assert.match(second.config.providers[0].tiles[0], /test-key-saved/);
  assert.equal(load(first.storage).api.status().active, false);
});
test('storage failure still allows tab activation and reports failed removal safely', () => {
  const { api } = load(new Map(), true);
  assert.equal(api.status().storageUnavailable, true);
  assert.match(api.activate('test-key-tab-only', true).warning, /not saved/);
  assert.equal(api.status().active, true);
  assert.equal(api.status().saved, false);
  assert.throws(() => api.forget(), /could not be removed/);
});
test('provider source contains only a credential-free template', () => {
  assert.match(source, /key\/\{key\}\//);
  assert.doesNotMatch(source, /key\/[A-Za-z0-9_-]{20,}\//);
});

test('activation notifications reset the label state when saved storage is removed', () => {
  const { api, storage, dispatch } = load();
  const states = [];
  const unsubscribe = api.subscribe(() => states.push(api.status()));
  api.activate('test-key-manual', false);
  assert.equal(api.status().keyRemoved, false);
  api.activate('test-key-saved', true);
  storage.delete('uos.metromap.user-key');
  dispatch('storage', { key: 'uos.metromap.user-key' });
  assert.equal(api.status().active, true);
  assert.equal(api.status().saved, false);
  assert.equal(api.status().keyRemoved, true);
  api.activate('test-key-again', true);
  storage.clear();
  dispatch('storage', { key: null });
  assert.equal(states.at(-1).keyRemoved, true);
  api.activate('test-key-focus', true);
  storage.clear();
  dispatch('focus');
  assert.equal(states.at(-1).keyRemoved, true);
  unsubscribe();
  const count = states.length;
  api.activate('test-key-unsubscribed', false);
  assert.equal(states.length, count);
});

test('explicit forgetting and same-document storage removal retain tab imagery but require the activation label', () => {
  const { api, storage } = load();
  api.activate('test-key-saved', true);
  api.forget();
  assert.equal(api.status().active, true);
  assert.equal(api.status().keyRemoved, true);
  api.activate('test-key-restored', true);
  assert.equal(api.status().keyRemoved, false);
  storage.delete('uos.metromap.user-key');
  assert.equal(api.status().keyRemoved, true);
});
