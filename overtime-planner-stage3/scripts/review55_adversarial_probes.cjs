'use strict';
// Independent Review 55 probes. Use with node in the extracted PR24 root.
global.window = global;
require('./js/utils/qualifications.js');
require('./js/utils/fatigueEngine.js');
require('./js/utils/eligibilityEngine.js');
require('./js/utils/rostering/engine.js');
const q = global.HortOpsQualifications;
const f = global.HortOpsFatigueEngine;
const roster = global.HortOpsRosteringEngine;
const e = global.HortOpsEligibilityEngine;
let findings = 0;
function issue(id, expected, actual) {
  const defect = JSON.stringify(expected) !== JSON.stringify(actual);
  console.log(`[${defect ? 'REPRODUCED' : 'NOT REPRODUCED'}] ${id}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  if(defect) findings++;
}
const person = {id:'STAFF', name:'Test Staff', status:'active', team:'Parks', department:'Horticulture',role:'Worker', qualifications:[]};
const required = ['CHAINSAW_L1'];
issue('S3-P01 undated ticket accredited', false, q.evaluateStaffQualifications({...person,qualifications:[{code:'CHAINSAW_L1',status:'active'}]},required,'2026-10-10').compliant);
issue('S3-P02 future-issued ticket accredited', false, q.evaluateStaffQualifications({...person,qualifications:[{code:'CHAINSAW_L1',issuedDate:'2027-01-01',expiryDate:'2029-01-01',status:'active'}]},required,'2026-10-10').compliant);
const history = ['2026-09-12','2026-09-19','2026-09-26'].map((date,i)=>({shiftId:`H${i}@${date}`,date,startTime:'07:00 AM',durationHours:6,assignedStaffIds:['STAFF']}));
const target={shiftId:'J@2026-10-03',jobId:'J',date:'2026-10-03',startTime:'07:00 AM',durationHours:6,crewSize:1,assignedStaffIds:[]};
const job={id:'J',name:'Dangerous Job', requiredQualifications:required,crewSize:1};
console.log('STAGE3_FATIGUE baseline='+f.evaluateStaffFatigue(person,history,target.date).tier+' prospective='+f.simulateAssignmentFatigue(person,target,history).tier);
issue('S3-P03 rotation recommends unqualified critical-fatigue officer',null,
  roster.recommendRotationCandidate({job,occurrence:target,allShifts:history.concat([target]),roster:[person],currentAssignedIds:[],previousHolderId:null}).candidate?.id ?? null);
issue('S3-P04 canonical eligibility admits same staff', false, e.validateStaffEligibility(person,target,job,history,[]).eligible);
const boundaryShifts=[{date:'2026-09-19',shiftId:'S-BORDER',assignedStaffIds:['STAFF'],durationHours:8}];
issue('S3-P05 14-day lookback includes 15th calendar day',0,f.calculateRollingHours('STAFF',boundaryShifts,'2026-10-03',14));
issue('S3-P06 no duration counts as four hours',0,f.calculateRollingHours('STAFF',[{date:'2026-10-03',shiftId:'NO-DURATION',assignedStaffIds:['STAFF']}],'2026-10-03',14));
// Direct saveAllocation gate: prove a pre-staged fourth weekend reaches the rostering engine.
global.document = { getElementById:()=>null };
global.alert = (msg)=> { global.lastReview55Alert=msg; };
require('./js/components/staffAssignModal.js');
const modal=global.HortOpsStaffAssignModal;
const qualifiedPerson={...person,qualifications:[{code:'CHAINSAW_L1',issuedDate:'2025-01-01',expiryDate:'2028-01-01',status:'active'}]};
global.HortOpsApp={state:{staffList:[qualifiedPerson],jobs:[job],allShifts:history.concat([target]),customAssignments:{},currentYear:2026}};
// Keep upstream Stage 1 checks satisfied to isolate the Stage 3 save gate.
global.HortOpsEligibilityEngine.validateCrewForOccurrence=()=>({valid:true,hardBlock:false,issues:[]});
global.HortOpsEligibilityEngine.validateStaffEligibility=()=>({eligible:true,reasons:[]});
let reachedRostering=false;
global.HortOpsRosteringEngine={applyRostering:()=>{reachedRostering=true;return {success:false};}};
modal.activeShiftId=target.shiftId;
modal.stagedAssignedStaffIds=['STAFF'];
modal.stagedSlots=[];
modal.stagedSlotStrategies={};
modal.saveAllocation();
issue('S3-P07 saveAllocation reaches rostering after prospectively CRITICAL staged 4th weekend',false,reachedRostering);
console.log(`SUMMARY ${findings} observable departures from stated conservative safety expectations`);
