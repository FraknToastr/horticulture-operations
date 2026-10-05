/**
 * Stage 3 - Gate 3D Verification Contract:
 * Workforce Intelligence Analytics Dashboard, Fatigue Risk Heatmap & Qualification Compliance Matrix
 */

const assert = require('assert');
const path = require('path');

// Setup mock window environment
if (typeof window === 'undefined') {
  global.window = {};
}

const baseDir = process.cwd();

// Load dependencies
require(path.join(baseDir, 'js/data/holidays.js'));
require(path.join(baseDir, 'js/utils/icons.js'));
require(path.join(baseDir, 'js/utils/securityUtils.js'));
require(path.join(baseDir, 'js/utils/dateUtils.js'));
require(path.join(baseDir, 'js/utils/qualifications.js'));
require(path.join(baseDir, 'js/utils/fatigueEngine.js'));
require(path.join(baseDir, 'js/components/analytics.js'));

const analytics = window.HortOpsAnalytics;
assert(analytics, 'HortOpsAnalytics must be defined');

console.log('=== STAGE 3 GATE 3D VERIFICATION CONTRACT ===\n');

// -------------------------------------------------------------
// Test Group 1: Graceful Empty State Handling
// -------------------------------------------------------------
console.log('--- Test Group 1: Graceful Empty State Handling ---');
const emptyState = {
  allShifts: [],
  staffList: [],
  jobs: [],
  budgetSettings: { hourlyBaseRate: 44.50 },
  currentYear: 2026
};

const emptyHtml = analytics.render(emptyState);
assert(typeof emptyHtml === 'string', 'Render must return HTML string');
assert(emptyHtml.includes('Total Overtime Projection'), 'Must render Overtime Projection KPI');
assert(emptyHtml.includes('Workforce Fatigue Risk Heatmap'), 'Must render Fatigue Heatmap card');
assert(emptyHtml.includes('Workforce Qualification & Accreditation Compliance'), 'Must render Qualification Compliance card');
assert(emptyHtml.includes('All workforce members are within safe fatigue thresholds'), 'Must show safe status message when no staff are fatigued');
console.log('✔ Empty and baseline states render cleanly without exceptions');

// -------------------------------------------------------------
// Test Group 2: Fatigue Risk Heatmap & Multi-Week Distribution
// -------------------------------------------------------------
console.log('\n--- Test Group 2: Fatigue Risk Heatmap & Distribution ---');
const staffLow = { id: 's-low', name: 'Safe Officer', status: 'active', team: 'Parks' };
const staffCrit = { id: 's-crit', name: 'Fatigued Officer', status: 'active', team: 'Arboriculture' };

// Create 4 consecutive weekend shifts for s-crit
const shifts = [
  { shiftId: 'sh1', date: '2026-05-16', startTime: '07:00', durationHours: 6, crewSize: 1, assignedStaffIds: ['s-crit'] },
  { shiftId: 'sh2', date: '2026-05-23', startTime: '07:00', durationHours: 6, crewSize: 1, assignedStaffIds: ['s-crit'] },
  { shiftId: 'sh3', date: '2026-05-30', startTime: '07:00', durationHours: 6, crewSize: 1, assignedStaffIds: ['s-crit'] },
  { shiftId: 'sh4', date: '2026-06-06', startTime: '07:00', durationHours: 6, crewSize: 1, assignedStaffIds: ['s-crit'] }
];

const stateWithFatigue = {
  allShifts: shifts,
  staffList: [staffLow, staffCrit],
  jobs: [{ id: 'job-1', name: 'Park Maintenance', crewSize: 1, durationHours: 6 }],
  budgetSettings: { hourlyBaseRate: 50.0 },
  currentYear: 2026
};

const fatigueHtml = analytics.render(stateWithFatigue);
assert(fatigueHtml.includes('Fatigued Officer'), 'Watchlist must include fatigued officer');
assert(fatigueHtml.includes('REST REQUIRED'), 'Must render REST REQUIRED badge for officer at critical tier');
assert(fatigueHtml.includes('4 wks'), 'Must report 4 consecutive weekends in watchlist table');
// Under strict 14-day window (excluding 15th calendar day per R55-P2-07 / S3-P05), hours on 06-06 and 05-30 sum to 12 hrs
assert(fatigueHtml.includes('12 hrs'), 'Must report 12 rolling 14-day hours in watchlist table under strict 14-day lookback');
console.log('✔ Fatigue Risk Heatmap correctly identifies, visualizes, and watchlists fatigued staff');

// -------------------------------------------------------------
// Test Group 3: Qualification Compliance & Expiring Tickets
// -------------------------------------------------------------
console.log('\n--- Test Group 3: Qualification Compliance & Expiring Tickets ---');
const staffWithTickets = {
  id: 's-ticketed',
  name: 'Certified Officer',
  status: 'active',
  team: 'Trees',
  qualifications: [
    {
      code: 'CHAINSAW_L1',
      certificateNumber: 'CS-999',
      issuedDate: '2024-01-01',
      expiryDate: '2026-06-20', // Expiring in 14 days relative to 2026-06-06
      status: 'active'
    },
    {
      code: 'EWP_TICKET',
      certificateNumber: 'EWP-123',
      issuedDate: '2024-01-01',
      expiryDate: '2028-01-01', // Active
      status: 'active'
    },
    {
      code: 'CHIPPER',
      certificateNumber: 'CHIP-456',
      issuedDate: '2022-01-01',
      expiryDate: '2025-01-01', // Expired
      status: 'expired'
    }
  ]
};

const stateWithTickets = {
  allShifts: shifts,
  staffList: [staffWithTickets],
  jobs: [],
  budgetSettings: { hourlyBaseRate: 44.50 },
  currentYear: 2026
};

const ticketsHtml = analytics.render(stateWithTickets);
assert(ticketsHtml.includes('3 Total Tickets Held'), 'Must report total tickets held');
assert(ticketsHtml.includes('CS-999'), 'Must render expiring ticket certificate number');
assert(ticketsHtml.includes('Chainsaw Level 1'), 'Must render qualification title');
assert(ticketsHtml.includes('days left'), 'Must show remaining days for ticket expiring in <= 30 days');
console.log('✔ Qualification Compliance Matrix accurately reflects active, expiring, and expired accreditations');

console.log('\n======================================================');
console.log(' [PASS] GATE 3D CONTRACT VERIFICATION COMPLETE: 100% OK');
console.log('======================================================\n');
