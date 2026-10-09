const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const source=fs.readFileSync("src/program-planner/js/program-map.js","utf8");
const html=fs.readFileSync("src/program-planner/index.html","utf8");
const css=fs.readFileSync("src/program-planner/space-map-editor.css","utf8");
test("Space Map has independent sidebar grids instead of floating controls",()=>{
  assert.match(html,/data-space-panel="location"/);assert.match(html,/data-space-panel="space"/);
  for(const id of ["moveLocationButton","removeLocationButton","undoLocationButton","spaceAcceptDraft","spaceCancelDraft"])assert.ok(html.includes('id="'+id+'"'));
  assert.doesNotMatch(html,/id="(?:floatingDrawToolbar|selectToolButton|providerSelect)"/);
  assert.doesNotMatch(html,/src="js\/map-floating-draw-toolbar/);
  assert.ok(css.includes("grid-template-columns:360px minmax(0,1fr)"));
  assert.doesNotMatch(html,/id="(?:spaceRegisterSearch|spaceRegisterSelect|spaceProjectSearch|spaceProjectSelect|toggleMapActiveOnly|toggleMapSelectedOnly)"/);
  assert.ok(source.includes("data-space-visible-all"));
  assert.ok(css.includes("flex:3 1 0"));assert.ok(css.includes("grid-template-columns:repeat(6,minmax(0,1fr))"));
});
test("Geometry rows retain visibility and pricing metadata, with a temporary drawing row",()=>{
  for(const label of ["Geometry","Job Type","Cost Type","Measure"])assert.ok(source.includes(">"+label+"<"));
  for(const attribute of ["data-shape-visible=","data-space-expand=","data-space-draft","data-disclosure-skip"])assert.ok(source.includes(attribute));
  assert.ok(source.includes("selectedOptions[0].textContent"));
});
test("Pin edits are drafts until an atomic and guarded Finish",()=>{
  const stage=source.slice(source.indexOf("function stagePinOperation"),source.indexOf("function finishPinSession"));
  assert.ok(stage.includes("session.history.push"));assert.ok(!stage.includes("ProgramApp.updateWorkspace"));
  const finish=source.slice(source.indexOf("function finishPinSession"),source.indexOf("function handleSpaceEditorClick"));
  assert.equal(finish.split("ProgramApp.updateWorkspace").length-1,1);
  assert.ok(finish.includes("session.originalPins"));assert.ok(finish.includes("session.operations.forEach"));
  assert.ok(source.includes("showLocationNumbers"));
});
test("Canonical map state retains pin and geometry selection together and respects explicit clearing",()=>{
  const api=require("../src/program-planner/js/program-map.js");
  const application={id:"NSA-APP-1",owner:"NSA",locations:[{id:"NSA-LOC-1",coordinate:[138.6,-34.92]}]};
  const project={id:"NSA-PROJ-1",owner:"NSA",applicationId:application.id};
  global.UOS.ProgramModel={registerForProject:()=>application,activeProjectForRegister:()=>project,registerLocations:()=>application.locations};
  const workspace={workspace:{ownerMode:"NSA",selectedEntityId:application.id,selectedProjectId:project.id,map:{scopeMode:"projects",selectedRegisterId:application.id,selectedProjectId:project.id,selectedLocationId:"NSA-LOC-1",selectedGeometryId:"NSA-GEO-1",inspectorMode:"polygon"}},entities:{applications:[application],events:[],projects:[project],geometries:[{id:"NSA-GEO-1",projectId:project.id}]}};
  let state=api.canonicalMapState(workspace);
  assert.equal(state.selectedLocationId,"NSA-LOC-1");assert.equal(state.selectedGeometryId,"NSA-GEO-1");
  api.writeCanonicalMapState(workspace,{scopeMode:"register",inspectorMode:"location"});
  state=api.canonicalMapState(workspace);assert.equal(state.selectedGeometryId,"NSA-GEO-1");
  api.writeCanonicalMapState(workspace,{selectedRegisterId:"",selectedProjectId:"",selectedGeometryId:"",selectedLocationId:""});
  state=api.canonicalMapState(workspace);assert.equal(state.selectedProjectId,"");assert.equal(state.selectedRegisterId,"");
  assert.ok(source.includes("if (storedMapStateMatches(workspace, intendedState)) return Promise.resolve(workspace);"));
});
