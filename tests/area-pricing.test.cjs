const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSuite, workspaceWithProject, addPolygon } = require("./helpers/area-pricing-suite.cjs");
test("area pricing: default hectare seed is commercial pricing, not measurement conversion", () => {
 const u=loadSuite(); let w=workspaceWithProject(u);
 const rate=w.entities.rateItems.find(r=>r.id==="RATE-TURFING-HA");
 assert.equal(rate.unitRate,112500);
 w=u.ProgramCosting.createWork(w,w.entities.projects[0].id,rate.id,{areaSqM:10000},{operationId:"manual-area",explicit:true});
 const l=w.entities.costingLines[0]; assert.equal(l.quantity,1); assert.equal(l.estimatedTotal,112500); assert.equal(l.sourceAreaSqM,10000);
 w=u.ProgramCosting.createWork(w,w.entities.projects[0].id,rate.id,{areaSqM:10000},{operationId:"manual-area",explicit:true});
 assert.equal(w.entities.costingLines.length,1); assert.equal(w.entities.jobs.length,1);
 w=u.ProgramCosting.updateLine(w,l.id,{quantity:0.25});
 assert.equal(w.entities.costingLines[0].sourceAreaSqM,2500);
 w=u.ProgramCosting.updateLine(w,l.id,{unit:"m²"});
 assert.equal(w.entities.costingLines[0].quantity,2500);
 assert.throws(()=>u.ProgramCosting.createWork(w,w.entities.projects[0].id,rate.id,{areaSqM:-1},{operationId:"invalid"}));
});
test("area pricing: legacy clone mapping recovery is stable and retains customer prices", () => {
 const u=loadSuite(); let w=workspaceWithProject(u);
 const original=w.entities.rateItems.find(r=>r.id==="RATE-TURFING");
 const cloned={...original,id:"RATE-LEGACY-TURF",measurementSource:"mapped",provenance:{migrationKind:"catalog-rate-clone",sourceId:"RATE-TURFING"}};
 w.entities.rateItems=w.entities.rateItems.filter(r=>!r.id.startsWith("RATE-TURFING"));
 w.entities.rateItems.push(cloned);
 w=u.ProgramModel.normalize(w);
 assert.equal(u.ProgramModel.workTypeRateMapping(w,"turfing").defaultRateItemId,cloned.id);
 assert.deepEqual(Array.from(u.ProgramModel.eligibleSpatialRatesForWorkType(w,"turfing"),r=>r.unit),["m²","ha"]);
 const ha=w.entities.rateItems.find(r=>r.id===cloned.id+"-HA"); ha.unitRate=1234;
 w=u.ProgramModel.normalize(w); assert.equal(w.entities.rateItems.find(r=>r.id===ha.id).unitRate,1234);
 assert.equal(JSON.stringify(u.ProgramModel.normalize(w)),JSON.stringify(w));
 w.entities.rateItems=w.entities.rateItems.filter(r=>r.id!==ha.id);
 w=u.ProgramModel.normalize(w); assert.ok(!w.entities.rateItems.some(r=>r.id===ha.id));
});
test("area pricing: hectare polygons retain area, line and job identity across rate changes",()=>{
 const u=loadSuite(); let w=workspaceWithProject(u);
 w=addPolygon(u,w,"turfing","NSA-GEO-AREA","RATE-TURFING");
 w=u.WorkAreaService.syncGeometry(w,"NSA-GEO-AREA",{explicit:true});
 const first=w.entities.costingLines[0]; const jobId=first.jobId, area=first.sourceAreaSqM;
 w=u.WorkAreaService.updateGeometry(w,"NSA-GEO-AREA",{rateItemId:"RATE-TURFING-HA",payload:{pricingUnit:"ha",rateItemId:"RATE-TURFING-HA"}});
 w=u.WorkAreaService.syncGeometry(w,"NSA-GEO-AREA");
 const line=w.entities.costingLines[0]; assert.equal(line.id,first.id);assert.equal(line.jobId,jobId);
 assert.equal(line.sourceAreaSqM,area);assert.equal(line.unit,"ha");assert.ok(Math.abs(line.quantity-area/10000)<0.000001);
});
test("area pricing: incompatible referenced legacy rates are not rewritten",()=>{
 const u=loadSuite();let w=workspaceWithProject(u);
 w.entities.rateItems.push({id:"RATE-LEGACY-ROLL",description:"Rolling",title:"Rolling",unit:"ha",unitRate:501.6,quantityMode:"direct",quantityKind:"direct",active:true,kind:"Labour",category:"Maintenance",owner:"",measurementSource:"mapped",provenance:{}});
 w=u.ProgramCosting.createWork(w,w.entities.projects[0].id,"RATE-LEGACY-ROLL",{quantity:1},{operationId:"historical-roll",explicit:true});
 const line=JSON.stringify(w.entities.costingLines[0]); w.entities.rateItems.find(r=>r.id==="RATE-LEGACY-ROLL").provenance={migrationKind:"catalog-rate-clone",sourceId:"RATE-0DLVIOB"}; w=u.ProgramModel.normalize(w);
 assert.equal(w.entities.rateItems.find(r=>r.id==="RATE-LEGACY-ROLL").quantityMode,"direct");
 assert.equal(JSON.stringify(w.entities.costingLines[0]),line);
 assert.ok(w.migration.areaPricingRecovery.warnings.some(s=>s.includes("RATE-LEGACY-ROLL")));
});

test("area pricing: an existing mapped hectare choice is preserved without an extra seed",()=>{
 const u=loadSuite();let w=workspaceWithProject(u);
 const base=w.entities.rateItems.find(r=>r.id==="RATE-TURFING");base.id="RATE-OLD-TURF";base.measurementSource="mapped";base.provenance={migrationKind:"catalog-rate-clone",sourceId:"RATE-TURFING"};
 w.entities.rateItems=w.entities.rateItems.filter(r=>r.id!=="RATE-TURFING-HA");
 w.entities.rateItems.push({...base,id:"RATE-CUSTOM-HA",unit:"ha",unitRate:999,provenance:{}});
 w.referenceData.shared.workTypeRateItems.turfing={eligibleRateItemIds:[base.id,"RATE-CUSTOM-HA"],defaultRateItemId:base.id};
 w=u.ProgramModel.normalize(w);
 assert.ok(!w.entities.rateItems.some(r=>r.id===base.id+"-HA"));
 assert.equal(w.entities.rateItems.find(r=>r.id==="RATE-CUSTOM-HA").unitRate,999);
});
