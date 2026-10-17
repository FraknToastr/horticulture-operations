'use strict';

// Reviewed desktop selections. Mixed files must retain explicit title filters.
// Overtime has its own runtime and release regime and is intentionally absent.
const modelFiles = [
  'area-pricing', 'budget-governance', 'budget-model', 'business-dates',
  'c5-canonical-status-history', 'c6-multirate-corrective', 'calculator-bulk-delete',
  'canonical-costing-commands', 'canonical-work-governance', 'costing-adjustments',
  'current-year-backup-recovery', 'data-roundtrip', 'delete-register-v5',
  'desktop-release-policy',
  'delete-safety', 'empty-operational-baseline', 'evt-register-model',
  'governed-remediation', 'global-rate-workspace-recovery', 'location-polygon-sidebar', 'metromap-credentials',
  'moasure-geometry', 'model-v5', 'nsa-pdf-import-preview', 'planner-current-state',
  'planner-draft-job', 'planner-reset-history', 'program-runtime',
  'quote-calculator-membership', 'quote-funding', 'rate-library-schema',
  'register-status-guide', 'scheduler-application-nomination',
  'scheduler-calendar-tools', 'scheduler-date-ranges', 'scheduler-event-milestones',
  'scheduler-week-editing', 'sidebar-architecture', 'space-map-dashes',
  'space-map-tree', 'status', 'tree-reference-selection',
  'workspace-import-signature', 'workspace-sanitation'
].map(name => `tests/${name}.test.cjs`);

const spec = name => `**/${name}.spec.js`;
const browserBatches = [
  {
    name: 'core',
    testMatch: [
      'evt-register-delivery', 'register-status-guide', 'register-drawer-context',
      'drawer-scroll-ownership', 'register-drawer-motion', 'register-shortcut-states',
      'planner-task-editor', 'planner-draft-recovery', 'cost-library-legacy-grouping',
      'calculator-planner-job-isolation', 'c4-browser-acceptance',
      'quote-payment-funding-workflow', 'quote-first-interaction', 'quoted-lifecycle',
      'draft-quoted-cost-deletion', 'workspace-backup-recovery',
      'startup-status-recovery', 'factory-reset-startup', 'workspace-sanitation',
      'data-import-keyboard', 'reviewed-workspace-recovery', 'scheduler-side-by-side', 'scheduler-multi-day',
      'scheduler-unused-action-scope', 'scheduler-week-viewport',
      'scheduler-event-milestones', 'space-map-onboarding',
      'program-runtime', 'performance-audit'
    ].map(spec)
  },
  { name: 'budget', testMatch: [spec('budget-workflow')] },
  {
    name: 'metromap', testMatch: [spec('adaptive-map-scheduler-register'), spec('metromap-activation')],
    grep: /MetroMap/
  },
  {
    name: 'adaptive', testMatch: [spec('adaptive-map-scheduler-register')],
    grepInvert: /MetroMap/
  },
  {
    name: 'inspector', testMatch: [spec('space-map-draft-actions')],
    grep: /radial Undo restores completed vertex edits/
  },
  {
    name: 'map-draft', testMatch: [spec('space-map-draft-actions')],
    grep: /closing either radial hub|radial Undo reverses Moasure|geometry creation uses third-tier|Location actions stage pins/
  },
  {
    name: 'gpu', testMatch: [spec('space-map-gpu')],
    grepInvert: /local-file entry|local launcher/
  }
];

module.exports = { modelFiles, browserBatches };
