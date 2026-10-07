// Operational Warnings Modal Component
// Displays active schedule conflicts, missing plant operator certifications, and slot collisions with quick-action links.

window.HortOpsWarningsModal = {
  activeFilter: 'all',

  open: function() {
    if (window.HortOpsModalUtils) window.HortOpsModalUtils.lockBackgroundScroll();
    this.activeFilter = 'all';
    this.renderModal();
  },

  close: function() {
    var el = document.getElementById('warnings-modal-root');
    if (el) el.innerHTML = '';
    if (window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
  },

  setFilter: function(category) {
    this.activeFilter = category;
    this.renderModal();
  },

  renderModal: function() {
    var el = document.getElementById('warnings-modal-root');
    if (!el) return;

    var state = (window.HortOpsApp && window.HortOpsApp.state) ? window.HortOpsApp.state : {};
    var warnings = (window.HortOpsWarningUtils && typeof window.HortOpsWarningUtils.getWarnings === 'function')
      ? window.HortOpsWarningUtils.getWarnings(state)
      : [];

    var icons = window.HortOpsIcons;
    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml)
      ? window.HortOpsSecurityUtils.escapeHtml
      : function(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr)
      ? window.HortOpsSecurityUtils.escapeHtmlAttr
      : esc;

    var totalCount = warnings.length;
    var certCount = warnings.filter(function(w) { return w.category === 'Certification'; }).length;
    var crewCount = warnings.filter(function(w) { return w.category === 'Crew Integrity' || w.category === 'Eligibility'; }).length;
    var slotCount = warnings.filter(function(w) { return w.category === 'Slot Collision'; }).length;
    var rosterCount = warnings.filter(function(w) { return w.category === 'Rostering'; }).length;
    var persistCount = warnings.filter(function(w) { return w.category === 'Persistence' || w.category === 'System'; }).length;

    var filtered = warnings;
    if (this.activeFilter === 'certification') {
      filtered = warnings.filter(function(w) { return w.category === 'Certification'; });
    } else if (this.activeFilter === 'crew') {
      filtered = warnings.filter(function(w) { return w.category === 'Crew Integrity' || w.category === 'Eligibility'; });
    } else if (this.activeFilter === 'slot') {
      filtered = warnings.filter(function(w) { return w.category === 'Slot Collision'; });
    } else if (this.activeFilter === 'rostering') {
      filtered = warnings.filter(function(w) { return w.category === 'Rostering'; });
    } else if (this.activeFilter === 'persistence') {
      filtered = warnings.filter(function(w) { return w.category === 'Persistence' || w.category === 'System'; });
    }

    // Filter pills HTML
    var filterPillsHtml = '<div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">' +
      '<button class="warning-filter-pill ' + (this.activeFilter === 'all' ? 'active' : '') + '" onclick="window.HortOpsWarningsModal.setFilter(\'all\')">' +
        'All Issues (' + totalCount + ')' +
      '</button>' +
      '<button class="warning-filter-pill ' + (this.activeFilter === 'certification' ? 'active' : '') + '" onclick="window.HortOpsWarningsModal.setFilter(\'certification\')">' +
        'Plant Operator (' + certCount + ')' +
      '</button>' +
      '<button class="warning-filter-pill ' + (this.activeFilter === 'crew' ? 'active' : '') + '" onclick="window.HortOpsWarningsModal.setFilter(\'crew\')">' +
        'Crew & Eligibility (' + crewCount + ')' +
      '</button>' +
      '<button class="warning-filter-pill ' + (this.activeFilter === 'slot' ? 'active' : '') + '" onclick="window.HortOpsWarningsModal.setFilter(\'slot\')">' +
        'Slot Collisions (' + slotCount + ')' +
      '</button>' +
      (rosterCount > 0 ? ('<button class="warning-filter-pill ' + (this.activeFilter === 'rostering' ? 'active' : '') + '" onclick="window.HortOpsWarningsModal.setFilter(\'rostering\')">' +
        'Rostering (' + rosterCount + ')' +
      '</button>') : '') +
      (persistCount > 0 ? ('<button class="warning-filter-pill ' + (this.activeFilter === 'persistence' ? 'active' : '') + '" onclick="window.HortOpsWarningsModal.setFilter(\'persistence\')">' +
        'Persistence (' + persistCount + ')' +
      '</button>') : '') +
    '</div>';

    // Warnings list HTML
    var warningsListHtml = '';
    if (filtered.length === 0) {
      warningsListHtml = '<div style="text-align: center; padding: 2.5rem 1rem; color: var(--slate-500); background: var(--slate-50); border-radius: 8px; border: 1px dashed var(--slate-200);">' +
        icons.render('checkCircle', 'w-8 h-8 text-emerald-600') +
        '<div style="font-weight: 700; font-size: 14px; margin-top: 0.5rem; color: var(--slate-800);">No Warnings in this Category</div>' +
        '<div style="font-size: 12px; margin-top: 0.25rem;">All operational requirements and schedule invariants are satisfied.</div>' +
      '</div>';
    } else {
      warningsListHtml = '<div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: calc(75vh - 160px); overflow-y: auto; padding-right: 4px;">' +
        filtered.map(function(w) {
          var isHigh = w.severity === 'high';
          var borderColor = isHigh ? '#ef4444' : '#f59e0b';
          var badgeBg = isHigh ? '#fef2f2' : '#fffbeb';
          var badgeColor = isHigh ? '#991b1b' : '#92400e';
          var badgeBorder = isHigh ? '#fca5a5' : '#fde68a';
          var iconName = isHigh ? 'alertTriangle' : 'alertTriangle';

          var actionBtnHtml = '';
          if (w.shiftId) {
            actionBtnHtml = '<button class="btn btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; flex-shrink: 0;" onclick="window.HortOpsWarningsModal.close(); window.HortOpsApp.openStaffAssignModal(\'' + escAttr(w.shiftId) + '\')">' +
              icons.render('userPlus', 'w-3 h-3') + ' Allocate Crew' +
            '</button>';
          }

          return '<div style="border: 1px solid var(--slate-200); border-left: 4px solid ' + borderColor + '; border-radius: 6px; padding: 0.75rem 0.85rem; background: #ffffff; display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">' +
            '<div style="overflow: hidden; flex: 1;">' +
              '<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; flex-wrap: wrap;">' +
                '<span class="badge" style="font-size: 10px; font-weight: 700; background: ' + badgeBg + '; color: ' + badgeColor + '; border: 1px solid ' + badgeBorder + '; display: inline-flex; align-items: center; gap: 0.25rem;">' +
                  icons.render(iconName, 'w-3 h-3') + esc(w.category) +
                '</span>' +
                (w.date ? ('<span style="font-size: 11px; font-weight: 600; color: var(--slate-600); font-family: var(--font-mono);">' + esc(w.date) + (w.time ? ' • ' + esc(w.time) : '') + '</span>') : '') +
              '</div>' +
              '<div style="font-weight: 700; font-size: 13px; color: var(--slate-900); margin-bottom: 0.25rem;">' +
                esc(w.title) +
              '</div>' +
              '<div style="font-size: 12px; color: var(--slate-600); line-height: 1.4;">' +
                esc(w.message) +
              '</div>' +
            '</div>' +
            actionBtnHtml +
          '</div>';
        }).join('') +
      '</div>';
    }

    var modalHtml = '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsWarningsModal.close()">' +
      '<div class="modal-card modal-lg" style="max-width: 720px;">' +
        '<div class="modal-header" style="display: flex; align-items: center; justify-content: space-between;">' +
          '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
            '<div style="width: 32px; height: 32px; border-radius: 6px; background: #fffbeb; border: 1px solid #fcd34d; display: flex; align-items: center; justify-content: center; color: #d97706;">' +
              icons.render('alertTriangle', 'w-5 h-5') +
            '</div>' +
            '<div>' +
              '<h2 style="font-size: 16px; font-weight: 800; color: var(--slate-900); margin: 0; display: flex; align-items: center; gap: 0.5rem;">' +
                'Operational Warnings & Alerts' +
                '<span class="badge badge-amber" style="font-size: 11px; padding: 2px 6px;">' + totalCount + ' Issue' + (totalCount !== 1 ? 's' : '') + '</span>' +
              '</h2>' +
              '<div style="font-size: 11px; color: var(--slate-500); margin-top: 1px;">Live schedule integrity, plant operator certifications, and slot collision diagnostics.</div>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn-secondary" style="padding: 0.25rem 0.4rem;" onclick="window.HortOpsWarningsModal.close()" title="Close">' +
            icons.render('x', 'w-4 h-4') +
          '</button>' +
        '</div>' +

        '<div class="modal-body" style="padding: 1rem 1.25rem;">' +
          filterPillsHtml +
          warningsListHtml +
        '</div>' +

        '<div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.25rem; background: var(--slate-50); border-top: 1px solid var(--slate-200); border-radius: 0 0 8px 8px;">' +
          '<span style="font-size: 12px; color: var(--slate-500);">' +
            'Showing ' + filtered.length + ' of ' + totalCount + ' warning' + (totalCount !== 1 ? 's' : '') +
          '</span>' +
          '<button class="btn btn-secondary" onclick="window.HortOpsWarningsModal.close()">Close</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    el.innerHTML = modalHtml;
  }
};
