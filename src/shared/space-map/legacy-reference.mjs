export function clearLegacyReference(map, id) {
  const source = `reference-${id}`;
  for (const suffix of ['points', 'fill', 'outline']) if (map.getLayer(`${source}-${suffix}`)) map.removeLayer(`${source}-${suffix}`);
  if (map.getSource(source)) map.removeSource(source);
}
export function addLegacyReference(map, id, payload) {
  const source = `reference-${id}`; if (map.getSource(source)) return;
  map.addSource(source, { type: 'geojson', data: payload.geojson });
  const successors = id === 'tpz' ? ['reference-srz-fill', 'reference-trees-points'] : id === 'srz' ? ['reference-trees-points'] : [];
  const before = successors.concat(['uos-shape-fill', 'uos-draft-fill']).find(layer => map.getLayer(layer));
  if (id === 'trees') map.addLayer({ id: `${source}-points`, type: 'circle', source, paint: { 'circle-radius': 2, 'circle-color': '#ffffff' } }, before);
  else {
    map.addLayer({ id: `${source}-fill`, type: 'fill', source, paint: { 'fill-color': ['get', '__riskColor'], 'fill-opacity': .35 } }, before);
    map.addLayer({ id: `${source}-outline`, type: 'line', source, paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': .5 } }, before);
  }
}
export function installLegacyReference(map) {
  if (typeof map.setReferenceLayer === 'function') return;
  map.clearReferenceLayer = id => clearLegacyReference(map, id);
  map.setReferenceLayer = (id, payload) => { clearLegacyReference(map, id); if (payload) addLegacyReference(map, id, payload); };
}
