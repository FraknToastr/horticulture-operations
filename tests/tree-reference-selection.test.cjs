const {test}=require('node:test');const assert=require('node:assert/strict');
test('Reference picking uses nearest tree, SRZ priority, multipart geometry and polygon holes',async()=>{
  const {pickReference,sameReference,featureBounds}=await import('../src/shared/space-map/reference-picking.mjs');
  const polygon={type:'Feature',properties:{OBJECTID:4,asset_id:55,tpz:8.76,srz:3.02,risk:'High'},geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[4,6],[6,6],[6,4],[4,4]]]}};
  const point={type:'Feature',properties:{OBJECTID:90,asset_id:55,tpz:null,srz:null,risk:'High'},geometry:{type:'Point',coordinates:[2,2]}};
  const map={project:c=>({x:c[0]*100,y:c[1]*100}),unproject:p=>({lng:p.x/100,lat:p.y/100})};
  const payload=f=>({geojson:{type:'FeatureCollection',features:[f]},hitBounds:new Float64Array(featureBounds(f))});
  const layers=new Map([['trees',payload(point)],['srz',payload(polygon)],['tpz',payload(polygon)]]);
  assert.equal(pickReference(map,layers,{x:203,y:200}).layer,'trees');
  assert.equal(pickReference(map,layers,{x:100,y:100}).layer,'srz');
  assert.equal(pickReference(map,layers,{x:500,y:500}),null);
  assert.equal(sameReference({layer:'trees',feature:point},{layer:'srz',feature:polygon}),true);
  const multipart={...polygon,geometry:{type:'MultiPolygon',coordinates:[polygon.geometry.coordinates,[[[20,20],[21,20],[21,21],[20,21],[20,20]]]]}};
  assert.equal(pickReference(map,new Map([['tpz',payload(multipart)]]),{x:2050,y:2050}).layer,'tpz');
});
test('Worker builds a GPU highlight with associated point and polygon while retaining measurements',async()=>{
  const {processMessage}=await import('../src/shared/space-map/tree-worker.mjs');
  const props={OBJECTID:1,asset_id:7,tpz:8.76,srz:3.02,risk:'Moderate'};
  const features=[{type:'Feature',properties:{...props,__referenceLayer:'trees'},geometry:{type:'Point',coordinates:[138.6,-34.92]}},{type:'Feature',properties:{...props,__referenceLayer:'srz'},geometry:{type:'Polygon',coordinates:[[[138.6,-34.92],[138.601,-34.92],[138.601,-34.921],[138.6,-34.92]]]}}];
  const {payload}=processMessage({type:'selection',layer:'selection',features,origin:[0,0],tolerance:0,token:1});
  assert.equal(payload.highlight,true);assert.equal(payload.count,2);assert.equal(payload.points.length,3);assert(payload.batches[0].outlineBase.length>0);assert.equal(payload.geojson.features[0].properties.tpz,8.76);assert.equal(payload.hitBounds.length,8);
  processMessage({type:'clear',layer:'selection'});
});
