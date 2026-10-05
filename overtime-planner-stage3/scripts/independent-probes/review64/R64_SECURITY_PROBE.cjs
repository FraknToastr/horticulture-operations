'use strict';
const fs=require('fs');const vm=require('vm');const path=require('path');const root=process.env.HORTOPS_ROOT || __dirname;
const ctx={console,Date,Map,Set,window:{},};ctx.window.HortOpsData={};
ctx.window.HortOpsIcons={render:()=>''};
for(const rel of ['js/data/initialJobs.js','js/data/staffRoster.js','js/utils/qualifications.js','js/utils/securityUtils.js','js/utils/storage/schemaValidator.js','js/components/jobRegistry.js','js/components/staffRegistry.js']){
  const code=fs.readFileSync(path.join(root,rel),'utf8');vm.runInNewContext(code,ctx,{filename:rel});
}
const base=ctx.window.HortOpsData.INITIAL_JOBS[0];
const injected=Object.assign({},base,{id:'r64_probe',color:'red;" onmouseover="window.__r64ProbeFired=1" data-r64="1'});
const checked=ctx.window.HortOpsSchemaValidator.validateJob(injected);
const html=ctx.window.HortOpsJobRegistry.render({jobs:[injected]});
const expected='onmouseover="window.__r64ProbeFired=1"';
console.log('schema_valid=',checked.valid,'error=',checked.error||'none');
console.log('unsafe_inline_handler_in_rendered_markup=',html.includes(expected));
const match=html.match(/<span style="width: 10px;[^>]{0,250}>/);
console.log('evidence=',match?.[0].replace('window.__r64ProbeFired=1','<probe-event-handler>')||'not found');
const sampleStaff=Object.assign({},ctx.window.HortOpsData.STAFF_ROSTER[0],{avatarColor:'blue;" onmouseover="window.__r64ProbeFired=1" data-r64="1'});
const staffEnvelope={schemaVersion:2,jobs:[],roster:[sampleStaff],assignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{},permits:{},budgetSettings:{},uiState:{},absences:[],refusalHistory:[]};
const staffValidation=ctx.window.HortOpsSchemaValidator.validateCurrentV2ForBoundary(staffEnvelope);
const staffHtml=ctx.window.HortOpsStaffRegistry.render({staffList:[sampleStaff]});
console.log('staff_schema_valid=',staffValidation.valid,'error=',staffValidation.error||'none');
console.log('staff_handler_in_render=',staffHtml.includes(expected));
console.log('security_boundary_failures=',Number(checked.valid&&html.includes(expected))+Number(staffValidation.valid&&staffHtml.includes(expected)));
if(!checked.valid||!html.includes(expected)||!staffValidation.valid||!staffHtml.includes(expected))process.exit(1);
