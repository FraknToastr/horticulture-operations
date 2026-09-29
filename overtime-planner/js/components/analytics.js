// Analytics Dashboard & Budget Simulator Component (Zero External Chart Libraries)
window.HortOpsAnalytics = {
  render: function(state) {
    var icons = window.HortOpsIcons;
    var scheduler = window.HortOpsScheduler;
    var allShifts = state.allShifts;
    var budget = state.budgetSettings || scheduler.DEFAULT_BUDGET_SETTINGS;

    // Calculate total costs
    var totalCost = 0;
    var totalHours = 0;
    var categoryCosts = {};
    var monthCosts = new Array(12).fill(0);

    allShifts.forEach(function(sh) {
      var costInfo = scheduler.calculateShiftCost(sh, budget);
      totalCost += costInfo.totalCost;
      totalHours += (sh.durationHours * sh.crewSize);

      var cat = sh.category || 'General';
      categoryCosts[cat] = (categoryCosts[cat] || 0) + costInfo.totalCost;

      var monthIdx = parseInt(sh.date.slice(5, 7), 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        monthCosts[monthIdx] += costInfo.totalCost;
      }
    });

    var maxMonthCost = Math.max.apply(null, monthCosts.concat([1]));

    var monthBarsHtml = monthCosts.map(function(cost, idx) {
      var mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var pct = Math.round((cost / maxMonthCost) * 100);
      return '<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.35rem;">' +
        '<div style="font-size: 11px; font-weight: 700; color: var(--slate-600);">' + (cost > 0 ? ('$' + Math.round(cost / 1000) + 'k') : '0') + '</div>' +
        '<div style="width: 100%; height: 120px; background: var(--slate-100); border-radius: 4px; display: flex; align-items: flex-end; overflow: hidden;">' +
          '<div style="width: 100%; height: ' + pct + '%; background-color: var(--emerald-600); border-radius: 4px 4px 0 0; transition: height 0.3s ease;"></div>' +
        '</div>' +
        '<div style="font-size: 12px; font-weight: 700; color: var(--slate-500);">' + mNames[idx] + '</div>' +
      '</div>';
    }).join('');

    return '<div style="display: flex; flex-direction: column; gap: 1rem;">' +
      // KPI Row
      '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">' +
        '<div class="panel-card" style="padding: 1rem; margin-bottom: 0;">' +
          '<div style="font-size: 12px; font-weight: 700; color: var(--slate-500); text-transform: uppercase;">Total Overtime Projection</div>' +
          '<div style="font-size: 24px; font-weight: 800; color: var(--emerald-800); margin-top: 0.25rem;">$' + Math.round(totalCost).toLocaleString() + ' AUD</div>' +
          '<div style="font-size: 12px; color: var(--slate-400); margin-top: 0.25rem;">Based on ' + allShifts.length + ' scheduled shifts</div>' +
        '</div>' +

        '<div class="panel-card" style="padding: 1rem; margin-bottom: 0;">' +
          '<div style="font-size: 12px; font-weight: 700; color: var(--slate-500); text-transform: uppercase;">Total Crew Hours</div>' +
          '<div style="font-size: 24px; font-weight: 800; color: var(--slate-800); margin-top: 0.25rem;">' + totalHours.toLocaleString() + ' hrs</div>' +
          '<div style="font-size: 12px; color: var(--slate-400); margin-top: 0.25rem;">Across all operational units</div>' +
        '</div>' +

        '<div class="panel-card" style="padding: 1rem; margin-bottom: 0;">' +
          '<div style="font-size: 12px; font-weight: 700; color: var(--slate-500); text-transform: uppercase;">Base Hourly Award Rate</div>' +
          '<div style="font-size: 24px; font-weight: 800; color: var(--slate-800); margin-top: 0.25rem;">$' + ((budget && budget.hourlyBaseRate != null) ? budget.hourlyBaseRate : (scheduler && scheduler.DEFAULT_BUDGET_SETTINGS && scheduler.DEFAULT_BUDGET_SETTINGS.hourlyBaseRate != null ? scheduler.DEFAULT_BUDGET_SETTINGS.hourlyBaseRate : 44.50)).toFixed(2) + '</div>' +
          '<div style="font-size: 12px; color: var(--slate-400); margin-top: 0.25rem;">Saturday 1.5x / 2.0x • Sunday 2.0x</div>' +
        '</div>' +
      '</div>' +

      // Monthly Projection Chart
      '<div class="panel-card">' +
        '<div class="panel-header">' +
          '<span class="panel-title">' + icons.render('fileText', 'w-4 h-4') + 'Annual Monthly Overtime Expenditure Profile</span>' +
        '</div>' +
        '<div class="panel-body">' +
          '<div style="display: flex; gap: 0.75rem; align-items: flex-end; padding: 1rem 0;">' +
            monthBarsHtml +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
};
