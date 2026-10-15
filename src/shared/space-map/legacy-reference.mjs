export function clearLegacyReference(map, id) {
  const source = `reference-${id}`;
  for (const suffix of ['points', 'fill', 'outline', 'casing']) if (map.getLayer(`${source}-${suffix}`)) map.removeLayer(`${source}-${suffix}`);
  if (map.getSource(source)) map.removeSource(source);
}
export function addLegacyReference(map, id, payload) {
  const source = `reference-${id}`; if (map.getSource(source)) return;
  map.addSource(source, { type: 'geojson', data: payload.geojson });
  const successors = id === 'tpz' ? ['reference-srz-fill', 'reference-trees-points'] : id === 'srz' ? ['reference-trees-points'] : [];
  const before = successors.concat(['uos-shape-fill', 'uos-draft-fill']).find(layer => map.getLayer(layer));
  if (payload.highlight) {
 map.addLayer({ id: `${source}-fill`, type:'fill', source, filter:['==',['geometry-type'],'Polygon'], paint:{'fill-color':'#ffde59','fill-opacity':.25} }, before);
    map.addLayer({ id: `${source}-casing`, type:'line', source, filter:['==',['geometry-type'],'Polygon'], paint:{'line-color':'#10233f','line-width':6,'line-opacity':1} }, before);
    map.addLayer({ id: `${source}-outline`, type:'line', source, filter:['==',['geometry-type'],'Polygon'], paint:{'line-color':'#ffde59','line-width':3,'line-opacity':1} }, before);
    map.addLayer({ id: `${source}-points`, type:'circle', source, filter:['==',['geometry-type'],'Point'], paint:{'circle-radius':6,'circle-color':'#ffde59','circle-stroke-color':'#10233f','circle-stroke-width':3} }, before);
    return;
  }
  if (id === 'trees') map.addLayer({ id: `${source}-points`, type: 'circle', source, paint: { 'circle-radius': 2, 'circle-color': '#ffffff' } }, before);
  else {
 map.addLayer({ id: `${source}-fill`, type: 'fill', source, paint: { 'fill-color': ['get', '__riskColor'], 'fill-opacity': .25 } }, before);
 map.addLayer({ id: `${source}-outline`, type: 'line', source, paint: { 'line-color': '#ffffff', 'line-width': .5, 'line-opacity': .25 } }, before);
  }
}
export function installLegacyReference(map) {
  if (typeof map.setReferenceLayer === 'function') return;
  map.clearReferenceLayer = id => clearLegacyReference(map, id);
  map.setReferenceLayer = (id, payload) => { clearLegacyReference(map, id); if (payload) addLegacyReference(map, id, payload); };
}
