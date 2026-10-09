const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {loadSuite,workspaceWithProject,addPolygon}=require("./helpers/area-pricing-suite.cjs");
const csv=fs.readFileSync("tests/fixtures/moasure/north-terrace-6.csv","utf8");
test("Moasure fixture measures X/Y in metres and retains reported area and original XYZ",()=>{
 const u=loadSuite(),p=u.MoasureGeometry.parse(csv,"survey.csv"),g=p.groups[0];
 assert.equal(g.points.length,28);assert.ok(Math.abs(g.areaSqM-246.553397)<1e-9);assert.equal(g.reportedAreaSqM,246.55);
 assert.equal(g.points[10].xyz[2],-.258);
 const pose=[138.6,-34.9],ring=u.MoasureGeometry.place(g.coordinates,pose,45),back=u.MoasureGeometry.unplace(ring,pose,45);
 assert.ok(back.every((p,i)=>Math.hypot(p[0]-g.coordinates[i][0],p[1]-g.coordinates[i][1])<1e-7));
});
test("Moasure parser groups paths, orders points, converts units and rejects invalid outlines",()=>{
 const u=loadSuite(),m=u.MoasureGeometry;
 const input='Layer,Path,Point,X:cm,Y:cm,Path-Type\n1,1,3,0,100,Dot2Dot\n1,1,1,0,0,Dot2Dot\n1,1,2,100,0,Dot2Dot\n1,2,1,200,0,Dot2Dot\n1,2,2,300,0,Dot2Dot\n1,2,3,200,100,Dot2Dot';
 const g=m.parse(input).groups;assert.equal(g.length,2);assert.equal(g[0].areaSqM,.5);assert.equal(g[1].coordinates[0][0],2);
 for(const invalid of [input.replace('100,0,Dot2Dot',',0,Dot2Dot'),input.replace('X:cm','X:ft'),input.replace('Dot2Dot','Arc'),input.replace('1,1,2','1,1,1'),'"unclosed']) assert.throws(()=>m.parse(invalid));
 assert.throws(()=>m.ring([[0,0],[2,2],[0,2],[2,0]]));
});
test("Moasure import placement, canonical pricing, rigid movement, vertex editing and reload are safe",()=>{
 const u=loadSuite();let w=workspaceWithProject(u);const project=w.entities.projects[0].id,key=u.MoasureGeometry.parse(csv).groups[0].key;
 w=u.WorkAreaService.importMoasure(w,project,csv,"survey.csv",[key],[138.6,-34.9],"survey-operation");
 const id=w.entities.geometries[0].id,g=w.entities.geometries[0],source=JSON.stringify(g.moasureSurvey);
 assert.throws(()=>u.WorkAreaService.syncGeometry(w,id,{explicit:true}),e=>e.code==="WORK_PLACEMENT_UNCONFIRMED");
 w=u.WorkAreaService.savePlacement(w,id,{anchor:[138.61,-34.91],bearing:25});
 w=u.WorkAreaService.updateGeometry(w,id,{rateItemId:"RATE-TURFING-HA",payload:{rateItemId:"RATE-TURFING-HA",pricingUnit:"ha"}});
 w=u.WorkAreaService.syncGeometry(w,id,{explicit:true});
 const line=JSON.stringify(w.entities.costingLines[0]),job=JSON.stringify(w.entities.jobs[0]),area=w.entities.geometries[0].payload.areaSqM;
 assert.ok(Math.abs(area-246.553397)<1e-9);
 w=u.WorkAreaService.savePlacement(w,id,{anchor:[138.62,-34.92],bearing:170});
 assert.equal(w.entities.geometries[0].payload.areaSqM,area);assert.equal(JSON.stringify(w.entities.costingLines[0]),line);assert.equal(JSON.stringify(w.entities.jobs[0]),job);
 w=u.WorkAreaService.syncGeometry(w,id);assert.equal(w.entities.costingLines[0].estimatedTotal,JSON.parse(line).estimatedTotal);
 assert.throws(()=>u.WorkAreaService.updateGeometry(w,id,{moasureSurvey:{filename:"overwritten"}}));
 const geometry=structuredClone(w.entities.geometries[0].geometry);geometry.coordinates[0][1][0]+=.00001;
 w=u.WorkAreaService.updateGeometry(w,id,{geometry});w=u.WorkAreaService.syncGeometry(w,id);
 assert.equal(w.entities.geometries[0].localPlacement.edited,true);assert.notEqual(w.entities.geometries[0].payload.areaSqM,area);
 assert.equal(JSON.stringify(w.entities.geometries[0].moasureSurvey),source);
 const restored=u.ProgramModel.importJson(u.ProgramData.exportJson(w,"NSA"));assert.equal(restored.entities.geometries[0].localPlacement.edited,true);
});
test("Drawn polygon placement preserves measurements and rejects stale or scaled baselines",()=>{
 const u=loadSuite();let w=workspaceWithProject(u);w=addPolygon(u,w,"turfing","NSA-GEO-RIGID","RATE-TURFING");w=u.WorkAreaService.syncGeometry(w,"NSA-GEO-RIGID",{explicit:true});
 const g=w.entities.geometries[0],area=g.payload.areaSqM,line=JSON.stringify(w.entities.costingLines[0]);
 w=u.WorkAreaService.savePlacement(w,g.id,{anchor:[138.7,-35],bearing:90},JSON.stringify(g));
 assert.equal(w.entities.geometries[0].payload.areaSqM,area);assert.equal(JSON.stringify(w.entities.costingLines[0]),line);
 assert.throws(()=>u.WorkAreaService.savePlacement(w,g.id,{anchor:[138.7,-35],bearing:90},JSON.stringify(g)),e=>e.code==="WORK_PLACEMENT_STALE");
 const altered=structuredClone(w.entities.geometries[0].localPlacement);altered.coordinates[0][2][0]*=2;
 const geometry={type:altered.type,coordinates:u.MoasureGeometry.place(altered.coordinates,altered.anchor,altered.bearing)};
 assert.throws(()=>u.WorkAreaService.updateGeometry(w,g.id,{geometry,localPlacement:altered}),e=>e.code==="WORK_BASELINE_MISMATCH");
});
