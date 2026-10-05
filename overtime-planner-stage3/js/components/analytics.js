// Analytics Dashboard & Workforce Intelligence Component (Zero External Chart Libraries)
window.HortOpsAnalytics = {
  render: function(state) {
    var icons = window.HortOpsIcons || { render: function() { return ''; } };
    var scheduler = window.HortOpsScheduler;
    var fatigueEngine = window.HortOpsFatigueEngine;
    var qualEngine = window.HortOpsQualifications || window.HortOpsQualificationEngine;
    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return String(s || ''); };

    function calcDaysDiff(d1, d2) {
      if (fatigueEngine && typeof fatigueEngine.getDaysDiff === 'function') {
        return fatigueEngine.getDaysDiff(d1, d2);
      }
      var t1 = new Date(d1 + 'T00:00:00Z').getTime();
      var t2 = new Date(d2 + 'T00:00:00Z').getTime();
      return Math.round((t1 - t2) / 86400000);
    }

    var allShifts = state.allShifts || [];
    var staffList = state.staffList || [];
    var jobs = state.jobs || [];
    var budget = state.budgetSettings || (scheduler && scheduler.DEFAULT_BUDGET_SETTINGS) || { hourlyBaseRate: 44.50 };

    // Calculate total overtime costs & monthly profile
    var totalCost = 0;
    var totalHours = 0;
    var categoryCosts = {};
    var monthCosts = new Array(12).fill(0);

    allShifts.forEach(function(sh) {
      var costInfo = (scheduler && typeof scheduler.calculateShiftCost === 'function')
        ? scheduler.calculateShiftCost(sh, budget)
        : { totalCost: (sh.durationHours || 4) * (sh.crewSize || 2) * (budget.hourlyBaseRate || 44.50) * 1.5 };
      totalCost += costInfo.totalCost;
      totalHours += ((sh.durationHours || 0) * (sh.crewSize || 0));

      var cat = sh.category || 'General';
      categoryCosts[cat] = (categoryCosts[cat] || 0) + costInfo.totalCost;

      if (sh.date && typeof sh.date === 'string' && sh.date.length >= 7) {
        var monthIdx = parseInt(sh.date.slice(5, 7), 10) - 1;
        if (monthIdx >= 0 && monthIdx < 12) {
          monthCosts[monthIdx] += costInfo.totalCost;
        }
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

    // Determine current evaluation date anchor
    var asOfDate = new Date().toISOString().slice(0, 10);
    if (allShifts.length > 0) {
      var shiftDates = allShifts.map(function(s) { return s.date; }).filter(Boolean).sort();
      if (shiftDates.length > 0) {
        var minDate = shiftDates[0];
        var maxDate = shiftDates[shiftDates.length - 1];
        if (asOfDate < minDate || asOfDate > maxDate) {
          asOfDate = maxDate;
        }
      }
    }

    // --- Workforce Fatigue Risk & Rest-Gap Analytics ---
    var activeStaff = staffList.filter(function(s) { return s.status === 'active'; });
    var fatigueCounts = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
    var elevatedStaff = [];

    activeStaff.forEach(function(staff) {
      var fRes = fatigueEngine
        ? fatigueEngine.evaluateStaffFatigue(staff, allShifts, asOfDate)
        : { tier: 'LOW', consecutiveWeekends: 0, rolling14DaysHours: 0, rolling28DaysHours: 0, isHardBlocked: false };
      var tier = fRes.tier || 'LOW';
      if (fatigueCounts[tier] !== undefined) fatigueCounts[tier]++;
      if (tier === 'HIGH' || tier === 'CRITICAL' || fRes.consecutiveWeekends >= 3 || fRes.rolling14DaysHours >= 22) {
        elevatedStaff.push({
          staff: staff,
          fatigue: fRes
        });
      }
    });

    elevatedStaff.sort(function(a, b) {
      if (b.fatigue.tier === 'CRITICAL' && a.fatigue.tier !== 'CRITICAL') return 1;
      if (a.fatigue.tier === 'CRITICAL' && b.fatigue.tier !== 'CRITICAL') return -1;
      return b.fatigue.consecutiveWeekends - a.fatigue.consecutiveWeekends;
    });

    var totalActiveStaff = Math.max(activeStaff.length, 1);
    var lowPct = Math.round((fatigueCounts.LOW / totalActiveStaff) * 100);
    var modPct = Math.round((fatigueCounts.MODERATE / totalActiveStaff) * 100);
    var highPct = Math.round((fatigueCounts.HIGH / totalActiveStaff) * 100);
    var critPct = Math.round((fatigueCounts.CRITICAL / totalActiveStaff) * 100);

    var fatigueRowsHtml = '';
    if (elevatedStaff.length === 0) {
      fatigueRowsHtml = '<tr><td colspan="5" style="text-align: center; color: var(--emerald-700); padding: 1.25rem; font-weight: 600; background: var(--emerald-50); border-radius: 6px;">' +
        '✓ All workforce members are within safe fatigue thresholds. Zero mandatory rest blocks active.' +
        '</td></tr>';
    } else {
      fatigueRowsHtml = elevatedStaff.map(function(item) {
        var s = item.staff;
        var f = item.fatigue;
        var badge = '';
        if (f.tier === 'CRITICAL') {
          badge = '<span class="status-pill status-pill-red" style="font-weight: 700;">REST REQUIRED</span>';
        } else if (f.tier === 'HIGH') {
          badge = '<span class="status-pill status-pill-amber" style="font-weight: 700;">ELEVATED RISK</span>';
        } else {
          badge = '<span class="status-pill status-pill-blue" style="font-weight: 600;">MODERATE</span>';
        }
        return '<tr>' +
          '<td style="font-weight: 600; color: var(--slate-800);">' + esc(s.name) + '</td>' +
          '<td style="color: var(--slate-600);">' + esc(s.team || 'Unassigned') + '</td>' +
          '<td style="font-weight: 700; color: ' + (f.consecutiveWeekends >= 4 ? 'var(--rose-700)' : 'var(--slate-700)') + ';">' + f.consecutiveWeekends + ' wks</td>' +
          '<td style="font-weight: 700; color: ' + (f.rolling14DaysHours >= 32 ? 'var(--rose-700)' : 'var(--slate-700)') + ';">' + f.rolling14DaysHours + ' hrs</td>' +
          '<td>' + badge + '</td>' +
        '</tr>';
      }).join('');
    }

    // --- Workforce Qualification Compliance Matrix ---
    var totalAccreditations = 0;
    var activeAccreditations = 0;
    var expiringSoonAccreditations = 0;
    var expiredAccreditations = 0;
    var ticketTypeCounts = {};
    var expiringList = [];

    activeStaff.forEach(function(staff) {
      if (!staff.qualifications || !Array.isArray(staff.qualifications)) return;
      staff.qualifications.forEach(function(q) {
        if (!q || !q.code) return;
        totalAccreditations++;
        var qDef = (qualEngine && qualEngine.REGISTRY && qualEngine.REGISTRY[q.code]) || { name: q.code, category: 'Ticket' };
        ticketTypeCounts[q.code] = (ticketTypeCounts[q.code] || 0) + 1;

        var daysLeft = calcDaysDiff(q.expiryDate, asOfDate);
        var isExp = (q.status === 'suspended') || (qualEngine && typeof qualEngine.isQualificationExpired === 'function' ? qualEngine.isQualificationExpired(q, asOfDate) : (daysLeft < 0));

        if (isExp) {
          expiredAccreditations++;
        } else if (daysLeft <= 30) {
          expiringSoonAccreditations++;
          expiringList.push({
            staff: staff,
            ticket: q,
            daysLeft: daysLeft,
            def: qDef
          });
        } else {
          activeAccreditations++;
        }
      });
    });

    expiringList.sort(function(a, b) { return a.daysLeft - b.daysLeft; });

    var expiringRowsHtml = '';
    if (expiringList.length === 0) {
      expiringRowsHtml = '<tr><td colspan="5" style="text-align: center; color: var(--emerald-700); padding: 1rem; font-weight: 600; background: var(--emerald-50); border-radius: 6px;">' +
        '✓ All active accreditations are valid for at least 30 days.' +
        '</td></tr>';
    } else {
      expiringRowsHtml = expiringList.map(function(item) {
        var qualTitle = item.def.name || item.def.title || item.ticket.code;
        return '<tr>' +
          '<td style="font-weight: 600; color: var(--slate-800);">' + esc(item.staff.name) + '</td>' +
          '<td style="font-weight: 600; color: var(--slate-700);">' + esc(qualTitle) + '</td>' +
          '<td style="color: var(--slate-600);">' + esc(item.ticket.certificateNumber || '—') + '</td>' +
          '<td style="font-weight: 700; color: var(--amber-700);">' + esc(item.ticket.expiryDate) + '</td>' +
          '<td><span class="status-pill status-pill-amber">' + item.daysLeft + ' days left</span></td>' +
        '</tr>';
      }).join('');
    }

    var ticketPillsHtml = Object.keys(ticketTypeCounts).map(function(code) {
      var def = (qualEngine && qualEngine.REGISTRY && qualEngine.REGISTRY[code]) || { name: code };
      var label = def.name || def.title || code;
      return '<div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px;">' +
        '<span style="font-size: 13px; font-weight: 600; color: var(--slate-700);">' + esc(label) + '</span>' +
        '<span style="font-size: 13px; font-weight: 800; color: var(--emerald-700); background: var(--emerald-50); padding: 0.15rem 0.5rem; border-radius: 9999px;">' + ticketTypeCounts[code] + '</span>' +
      '</div>';
    }).join('');

    return '<div style="display: flex; flex-direction: column; gap: 1.25rem;">' +
      // Row 1: Overtime Expenditure KPIs
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

        '<div class="panel-card" style="padding: 1rem; margin-bottom: 0;">' +
          '<div style="font-size: 12px; font-weight: 700; color: var(--slate-500); text-transform: uppercase;">Active Workforce Size</div>' +
          '<div style="font-size: 24px; font-weight: 800; color: var(--slate-800); margin-top: 0.25rem;">' + activeStaff.length + ' Officers</div>' +
          '<div style="font-size: 12px; color: var(--slate-400); margin-top: 0.25rem;">Available for overtime roster</div>' +
        '</div>' +
      '</div>' +

      // Row 2: Monthly Expenditure Profile
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

      // Row 3: Fatigue Management & Rest Risk Heatmap (Stage 3 Gate 3C / 3D)
      '<div class="panel-card">' +
        '<div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">' +
          '<span class="panel-title" style="display: flex; align-items: center; gap: 0.5rem;">' +
            icons.render('shield', 'w-4 h-4') + 'Workforce Fatigue Risk Heatmap & Multi-Week Distribution' +
          '</span>' +
          '<span style="font-size: 12px; color: var(--slate-500);">Evaluated as of: ' + esc(asOfDate) + '</span>' +
        '</div>' +
        '<div class="panel-body">' +
          // Distribution Bar
          '<div style="margin-bottom: 1.25rem;">' +
            '<div style="display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: var(--slate-100);">' +
              '<div style="width: ' + lowPct + '%; background-color: var(--emerald-500);" title="Low Fatigue: ' + lowPct + '%"></div>' +
              '<div style="width: ' + modPct + '%; background-color: var(--blue-500);" title="Moderate Fatigue: ' + modPct + '%"></div>' +
              '<div style="width: ' + highPct + '%; background-color: var(--amber-500);" title="High Risk: ' + highPct + '%"></div>' +
              '<div style="width: ' + critPct + '%; background-color: var(--rose-600);" title="Rest Required: ' + critPct + '%"></div>' +
            '</div>' +
            '<div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 0.4rem; color: var(--slate-600);">' +
              '<span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--emerald-500); margin-right:4px;"></span>Low: ' + fatigueCounts.LOW + ' (' + lowPct + '%)</span>' +
              '<span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--blue-500); margin-right:4px;"></span>Moderate: ' + fatigueCounts.MODERATE + ' (' + modPct + '%)</span>' +
              '<span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--amber-500); margin-right:4px;"></span>High: ' + fatigueCounts.HIGH + ' (' + highPct + '%)</span>' +
              '<span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--rose-600); margin-right:4px;"></span>Rest Req: ' + fatigueCounts.CRITICAL + ' (' + critPct + '%)</span>' +
            '</div>' +
          '</div>' +

          // Table of elevated / critical officers
          '<div style="font-size: 13px; font-weight: 700; color: var(--slate-700); margin-bottom: 0.5rem;">Elevated Fatigue Risk & Mandatory Rest Watchlist</div>' +
          '<div style="overflow-x: auto;">' +
            '<table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">' +
              '<thead>' +
                '<tr>' +
                  '<th style="text-align: left; padding: 0.5rem;">Officer</th>' +
                  '<th style="text-align: left; padding: 0.5rem;">Team</th>' +
                  '<th style="text-align: left; padding: 0.5rem;">Consecutive Weekends</th>' +
                  '<th style="text-align: left; padding: 0.5rem;">14-Day Overtime</th>' +
                  '<th style="text-align: left; padding: 0.5rem;">Fatigue Tier</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                fatigueRowsHtml +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Row 4: Qualification Compliance Matrix (Stage 3 Gate 3A / 3B / 3D)
      '<div class="panel-card">' +
        '<div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">' +
          '<span class="panel-title" style="display: flex; align-items: center; gap: 0.5rem;">' +
            icons.render('award', 'w-4 h-4') + 'Workforce Qualification & Accreditation Compliance' +
          '</span>' +
          '<span style="font-size: 12px; color: var(--slate-500);">' + totalAccreditations + ' Total Tickets Held</span>' +
        '</div>' +
        '<div class="panel-body">' +
          // Summary Badges
          '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">' +
            '<div style="padding: 0.75rem; background: var(--emerald-50); border: 1px solid var(--emerald-200); border-radius: 6px; text-align: center;">' +
              '<div style="font-size: 11px; font-weight: 700; color: var(--emerald-800); text-transform: uppercase;">Active & Compliant</div>' +
              '<div style="font-size: 20px; font-weight: 800; color: var(--emerald-700); margin-top: 0.2rem;">' + activeAccreditations + '</div>' +
            '</div>' +
            '<div style="padding: 0.75rem; background: var(--amber-50); border: 1px solid var(--amber-200); border-radius: 6px; text-align: center;">' +
              '<div style="font-size: 11px; font-weight: 700; color: var(--amber-800); text-transform: uppercase;">Expiring (≤ 30 Days)</div>' +
              '<div style="font-size: 20px; font-weight: 800; color: var(--amber-700); margin-top: 0.2rem;">' + expiringSoonAccreditations + '</div>' +
            '</div>' +
            '<div style="padding: 0.75rem; background: var(--rose-50); border: 1px solid var(--rose-200); border-radius: 6px; text-align: center;">' +
              '<div style="font-size: 11px; font-weight: 700; color: var(--rose-800); text-transform: uppercase;">Expired / Suspended</div>' +
              '<div style="font-size: 20px; font-weight: 800; color: var(--rose-700); margin-top: 0.2rem;">' + expiredAccreditations + '</div>' +
            '</div>' +
          '</div>' +

          // Registry Pool Grid
          (Object.keys(ticketTypeCounts).length > 0 ? (
            '<div style="font-size: 13px; font-weight: 700; color: var(--slate-700); margin-bottom: 0.5rem;">Certified Workforce Pool by Accreditation</div>' +
            '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.5rem; margin-bottom: 1.25rem;">' +
              ticketPillsHtml +
            '</div>'
          ) : '') +

          // Expiring Tickets Watchlist
          (expiringList.length > 0 ? (
            '<div style="font-size: 13px; font-weight: 700; color: var(--amber-800); margin-bottom: 0.5rem;">Upcoming Expirations (Renewal Action Required)</div>' +
            '<div style="overflow-x: auto;">' +
              '<table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">' +
                '<thead>' +
                  '<tr>' +
                    '<th style="text-align: left; padding: 0.5rem;">Officer</th>' +
                    '<th style="text-align: left; padding: 0.5rem;">Accreditation</th>' +
                    '<th style="text-align: left; padding: 0.5rem;">Cert #</th>' +
                    '<th style="text-align: left; padding: 0.5rem;">Expiry Date</th>' +
                    '<th style="text-align: left; padding: 0.5rem;">Notice Period</th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody>' +
                  expiringRowsHtml +
                '</tbody>' +
              '</table>' +
            '</div>'
          ) : '') +
        '</div>' +
      '</div>' +

    '</div>';
  }
};
