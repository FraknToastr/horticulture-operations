// Add two concise, non-overlapping browse accordions around the candidate list.
(function() {
  'use strict';
  var list = window.HortOpsStaffAssignCandidateList;
  if (!list || !list.render) return;
  var original = list.render;

  list.render = function(ctx) {
    var candidates = ctx.filteredStaff || [];
    var priority = ctx.getStaffPriority || function() { return 5; };

    function section(id, label, people, open) {
      var sectionContext = Object.assign({}, ctx, {
        filteredStaff: people,
        // The underlying renderer receives only this accordion's staff.
        allocatorGroups: [{ id: id, label: label, staff: people }]
      });
      return '<details class="staff-allocator-priority-section"' + (open ? ' open' : '') +
        ' style="border:1px solid var(--slate-200);border-radius:6px;background:#fff">' +
        '<summary style="cursor:pointer;padding:0.65rem 0.75rem;font-weight:800;font-size:13px;color:var(--slate-700);display:flex;justify-content:space-between">' +
        '<span>' + label + '</span><span class="badge badge-slate">' + people.length + '</span></summary>' +
        '<div style="padding:0 0.5rem 0.5rem">' + original(sectionContext) + '</div></details>';
    }

    return '<div style="display:flex;flex-direction:column;gap:0.6rem">' +
      section('matching', 'Matching staff', candidates.filter(function(person) { return priority(person) <= 4; }), true) +
      section('other', 'Other staff', candidates.filter(function(person) { return priority(person) > 4; }), false) +
      '</div>';
  };
}());
