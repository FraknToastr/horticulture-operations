export function featureBounds(feature) {
  if (feature.geometry.type === 'Point') { const [x,y] = feature.geometry.coordinates; return [x,y,x,y]; }
  const result = [Infinity,Infinity,-Infinity,-Infinity];
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const rings of polygons) for (const p of rings[0]) { result[0]=Math.min(result[0],p[0]); result[1]=Math.min(result[1],p[1]); result[2]=Math.max(result[2],p[0]); result[3]=Math.max(result[3],p[1]); }
  return result;
}
function inRing(point, ring) {
  let inside = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i], b=ring[j];
    if ((a[1]>point[1])!==(b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
export function containsReference(feature, point) {
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  return polygons.some(rings=>inRing(point,rings[0])&&!rings.slice(1).some(ring=>inRing(point,ring)));
}
export function sameReference(a, b) {
  const id=a.feature.properties.asset_id;
  return id !== null && id !== undefined && id !== ''
    ? String(id)===String(b.feature.properties.asset_id)
    : a.layer===b.layer && String(a.feature.properties.OBJECTID)===String(b.feature.properties.OBJECTID);
}
export function pickReference(map, payloads, point, radius=10) {
  const p=Array.isArray(point)?{x:point[0],y:point[1]}:point, coordinate=map.unproject(p);
  const c=[coordinate.lng,coordinate.lat];
  let nearest=null, distance=radius;
  for (const feature of payloads.get('trees')?.geojson.features || []) {
    const projected=map.project(feature.geometry.coordinates), d=Math.hypot(projected.x-p.x,projected.y-p.y);
    if(d<=distance){nearest={layer:'trees',feature};distance=d;}
  }
  if(nearest)return nearest;
  for(const layer of ['srz','tpz']) {
    const payload=payloads.get(layer); if(!payload)continue;
    for(let i=0;i<payload.geojson.features.length;i++){
      const feature=payload.geojson.features[i], bounds=payload.hitBounds?.subarray(i*4,i*4+4)||featureBounds(feature);
      if(c[0]<bounds[0]||c[1]<bounds[1]||c[0]>bounds[2]||c[1]>bounds[3])continue;
      if(containsReference(feature,c))return {layer,feature};
    }
  }
  return null;
}
