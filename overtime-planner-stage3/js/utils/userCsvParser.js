// Robust CSV Parser and Stable Employee Identity Resolver (P0-02, N-P0-03, N-P1-01, P1-03, P1-04)
// Full RFC-4180 multiline tokenizer, duplicate ID rejection, and departed status preservation.

window.HortOpsUserCsvParser = (function() {
  var AVATAR_COLORS = [
    '#10b981', '#06b6d4', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#6366f1', '#84cc16', '#f97316'
  ];

  function parseCsvRows(text) {
    var rows = [];
    var currentRow = [];
    var currentField = '';
    var inQuotes = false;

    var clean = (text || '').replace(/^\uFEFF/, '');

    for (var i = 0; i < clean.length; i++) {
      var char = clean[i];

      if (char === '\\' && inQuotes && (clean[i + 1] === '"' || clean[i + 1] === '\\')) {
        currentField += clean[i + 1];
        i++;
      } else if (char === '"') {
        if (inQuotes && clean[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && clean[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some(function(cell) { return cell.length > 0; })) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(function(cell) { return cell.length > 0; })) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  function parseCsvLine(line) {
    var rows = parseCsvRows(line);
    return rows.length > 0 ? rows[0] : [];
  }

  function extractEmpNumber(id) {
    if (!id || typeof id !== 'string') return 0;
    var match = id.match(/EMP-(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  function parseUserCsv(csvContent, currentRoster) {
    if (!csvContent) {
      return { success: false, staff: [], errors: ['CSV content is empty.'] };
    }

    var rows = parseCsvRows(csvContent);
    if (rows.length < 2) {
      return { success: false, staff: [], errors: ['CSV file is empty or missing data rows.'] };
    }

    var rawHeaders = rows[0];
    var headers = rawHeaders.map(function(h) {
      return h.toLowerCase().replace(/[^a-z0-9]/g, '');
    });

    var idIdx = headers.findIndex(function(h) { return h === 'id' || h === 'empid' || h === 'employeeid'; });
    var titleIdx = headers.findIndex(function(h) { return h === 'title' || h === 'name' || h === 'fullname'; });
    var userTypeIdx = headers.findIndex(function(h) { return h === 'usertype' || h === 'type'; });
    var emailIdx = headers.findIndex(function(h) { return h === 'email' || h === 'corporateemail'; });
    var deptIdx = headers.findIndex(function(h) { return h === 'department' || h === 'dept'; });
    var teamIdx = headers.findIndex(function(h) { return h === 'team'; });
    var crewIdx = headers.findIndex(function(h) { return h === 'crew'; });
    var jobTitleIdx = headers.findIndex(function(h) { return h === 'jobtitle'; });
    var roleIdx = headers.findIndex(function(h) { return h === 'role'; });
    var statusIdx = headers.findIndex(function(h) { return h === 'status' || h === 'employmentstatus'; });
    var isContractorIdx = headers.findIndex(function(h) { return h === 'iscontractor' || h === 'contractor'; });
    var isPlantOpIdx = headers.findIndex(function(h) { return h === 'isplantoperator' || h === 'plantoperator' || h === 'plant'; });

    if (titleIdx === -1) {
      return {
        success: false,
        staff: [],
        errors: ['Missing required column: "Title" or "Name". Found columns: ' + rawHeaders.join(', ')]
      };
    }

    var currentById = new Map();
    var currentByEmail = new Map();
    var currentByName = new Map();
    var maxIdNumber = 0;

    if (currentRoster && Array.isArray(currentRoster)) {
      currentRoster.forEach(function(s) {
        if (s.id) {
          currentById.set(s.id.toUpperCase(), s);
          var num = extractEmpNumber(s.id);
          if (num > maxIdNumber) maxIdNumber = num;
        }
        if (s.email) {
          currentByEmail.set(s.email.trim().toLowerCase(), s);
        }
        var fullName = (s.title || s.name || '').trim().toLowerCase();
        if (fullName) {
          currentByName.set(fullName, s);
        }
      });
    }

    var parsedStaff = [];
    var errors = [];
    var seenSourceIds = new Set();
    var duplicateErrors = [];
    var nextAssignedNumber = maxIdNumber + 1;

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      var explicitId = idIdx !== -1 && row[idIdx] ? row[idIdx].trim() : '';

      // Safe ID format validation and Duplicate ID check (Mandate Section 4, 6)
      if (explicitId) {
        if (!/^[A-Za-z0-9_-]+$/.test(explicitId)) {
          errors.push('Employee ID on row ' + (i + 1) + ' ("' + explicitId + '") contains invalid characters. Only letters, numbers, hyphens, and underscores are permitted.');
        }
        var upperId = explicitId.toUpperCase();
        if (seenSourceIds.has(upperId)) {
          duplicateErrors.push('Duplicate employee ID detected on row ' + (i + 1) + ': "' + explicitId + '". Each employee ID must be unique.');
        }
        seenSourceIds.add(upperId);
      }

      var title = row[titleIdx] ? row[titleIdx].trim() : ('Staff Member ' + i);
      var userType = userTypeIdx !== -1 && row[userTypeIdx] ? row[userTypeIdx].trim() : 'Worker';
      var email = emailIdx !== -1 && row[emailIdx] ? row[emailIdx].trim() : (title.toLowerCase().replace(/\s+/g, '.') + '@synthetic.council.local');
      var department = deptIdx !== -1 && row[deptIdx] ? row[deptIdx].trim() : 'Horticulture';
      var team = teamIdx !== -1 && row[teamIdx] ? row[teamIdx].trim() : 'Parks';
      var crew = crewIdx !== -1 && row[crewIdx] ? row[crewIdx].trim() : 'GTL - Horticultural Team Leader';
      var jobTitle = jobTitleIdx !== -1 && row[jobTitleIdx] ? row[jobTitleIdx].trim() : '';
      var roleRaw = roleIdx !== -1 && row[roleIdx] ? row[roleIdx].trim() : 'Operational Staff';
      var role = roleRaw;
      if (roleRaw.toLowerCase() === 'read') {
        role = 'Operational Staff';
      } else if (roleRaw.toLowerCase() === 'write') {
        role = 'Team Leader';
      } else if (roleRaw.toLowerCase() === 'admin') {
        role = 'Admin';
      }

      var isContractorRaw = isContractorIdx !== -1 && row[isContractorIdx] ? row[isContractorIdx].toUpperCase() : 'FALSE';
      var isContractor = isContractorRaw === 'TRUE' || isContractorRaw === '1' || isContractorRaw === 'YES';

      var isPlantOpRaw = isPlantOpIdx !== -1 && row[isPlantOpIdx] ? row[isPlantOpIdx].toUpperCase() : 'FALSE';
      var isPlantOperator = isPlantOpRaw === 'TRUE' || isPlantOpRaw === '1' || isPlantOpRaw === 'YES';

      var stableId = '';
      var existingMatch = null;

      if (explicitId && currentById.has(explicitId.toUpperCase())) {
        existingMatch = currentById.get(explicitId.toUpperCase());
        stableId = existingMatch.id;
      } else if (email && currentByEmail.has(email.toLowerCase())) {
        existingMatch = currentByEmail.get(email.toLowerCase());
        stableId = existingMatch.id;
      } else if (title && currentByName.has(title.toLowerCase())) {
        existingMatch = currentByName.get(title.toLowerCase());
        stableId = existingMatch.id;
      } else if (explicitId) {
        stableId = explicitId;
        var num = extractEmpNumber(explicitId);
        if (num > maxIdNumber) maxIdNumber = num;
      } else {
        stableId = 'EMP-' + String(nextAssignedNumber).padStart(3, '0');
        nextAssignedNumber++;
      }

      var status = 'active';
      var validStatuses = ['active', 'departed', 'inactive', 'on_leave', 'temporarily_unavailable'];
      if (statusIdx !== -1 && row[statusIdx] !== undefined && row[statusIdx] !== null && row[statusIdx].trim() !== '') {
        var rawStatus = row[statusIdx].trim().toLowerCase();
        if (validStatuses.indexOf(rawStatus) !== -1) {
          status = rawStatus;
        } else {
          // Fail-closed rejection of unknown workforce status (Mandate Section 4)
          errors.push('Employee ' + (explicitId || title) + ' on row ' + (i + 1) + ' has unsupported employment status "' + row[statusIdx].trim() + '". Supported values: active, departed, inactive, on_leave, temporarily_unavailable.');
        }
      } else if (existingMatch && existingMatch.status) {
        status = existingMatch.status;
      }

      parsedStaff.push({
        id: stableId,
        title: title,
        name: title,
        userType: userType,
        email: email,
        department: department,
        team: team,
        crew: crew,
        jobTitle: jobTitle,
        role: role,
        status: status,
        isContractor: isContractor,
        isPlantOperator: isPlantOperator,
        skills: existingMatch ? (existingMatch.skills || []) : [],
        phone: existingMatch ? (existingMatch.phone || '') : '',
        avatarColor: (existingMatch && existingMatch.avatarColor) ? existingMatch.avatarColor : AVATAR_COLORS[parsedStaff.length % AVATAR_COLORS.length],
        isOvertimeExempt: existingMatch ? existingMatch.isOvertimeExempt : false,
        exemptionStartDate: existingMatch ? (existingMatch.exemptionStartDate || '') : '',
        exemptionEndDate: existingMatch ? (existingMatch.exemptionEndDate || '') : '',
        exemptionReason: existingMatch ? (existingMatch.exemptionReason || '') : '',
        willingness: existingMatch ? (existingMatch.willingness || 'available') : 'available',
        customAvailabilityNotes: existingMatch ? (existingMatch.customAvailabilityNotes || '') : '',
        overtimeStats: existingMatch ? (existingMatch.overtimeStats || { hoursYTD: 0, shiftCount: 0 }) : { hoursYTD: 0, shiftCount: 0 },
        ytdOvertimeHours: existingMatch ? (existingMatch.ytdOvertimeHours || 0) : 0,
        ytdShiftCount: existingMatch ? (existingMatch.ytdShiftCount || 0) : 0,
        departedDate: existingMatch ? (existingMatch.departedDate || '') : ''
      });
    }

    var allErrors = duplicateErrors.concat(errors);
    if (allErrors.length > 0) {
      return {
        success: false,
        staff: [],
        errors: allErrors
      };
    }

    if (parsedStaff.length === 0) {
      return { success: false, staff: [], errors: ['No valid staff records found in CSV.'] };
    }

    return { success: true, staff: parsedStaff, errors: errors };
  }

  function exportUsersToCsv(staffList) {
    var headers = ['Title', 'User Type', 'Email', 'Department', 'Team', 'Crew', 'Job Title', 'Role', 'Is Contractor', 'Is Plant Operator', 'Status'];
    var rows = (staffList || []).map(function(s) {
      return [
        '"' + (s.title || s.name || '').replace(/"/g, '""') + '"',
        '"' + (s.userType || 'Worker').replace(/"/g, '""') + '"',
        '"' + (s.email || '').replace(/"/g, '""') + '"',
        '"' + (s.department || '').replace(/"/g, '""') + '"',
        '"' + (s.team || '').replace(/"/g, '""') + '"',
        '"' + (s.crew || '').replace(/"/g, '""') + '"',
        '"' + (s.jobTitle || '').replace(/"/g, '""') + '"',
        '"' + (s.role || 'Operational Staff').replace(/"/g, '""') + '"',
        s.isContractor ? 'TRUE' : 'FALSE',
        s.isPlantOperator ? 'TRUE' : 'FALSE',
        '"' + (s.status || 'active') + '"'
      ];
    });

    return [headers.join(','), rows.map(function(r) { return r.join(','); }).join('\n')].join('\n');
  }

  return {
    parseCsvRows: parseCsvRows,
    parseCsvLine: parseCsvLine,
    parseUserCsv: parseUserCsv,
    exportUsersToCsv: exportUsersToCsv
  };
})();

// Canonical department hierarchy utility decoupled from prototype seed datasets
window.HortOpsData = window.HortOpsData || {};
window.HortOpsData.getDepartmentHierarchy = function(staffList, options) {
  var list = staffList || (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.staffList) || [];
  var includeDeparted = options && options.includeDeparted === true;
  var deptMap = {};

  list.forEach(function(staff) {
    if (!includeDeparted && staff && staff.status === 'departed') return;
    var dept = (staff && staff.department) || 'Other';
    var team = (staff && staff.team) || 'Other';
    if (!deptMap[dept]) {
      deptMap[dept] = {};
    }
    deptMap[dept][team] = (deptMap[dept][team] || 0) + 1;
  });

  var hierarchy = [];
  Object.keys(deptMap).forEach(function(deptName) {
    var teamMap = deptMap[deptName];
    var deptTotal = 0;
    var teams = [];

    Object.keys(teamMap).forEach(function(teamName) {
      var count = teamMap[teamName];
      deptTotal += count;
      teams.push({ name: teamName, count: count });
    });

    teams.sort(function(a, b) { return b.count - a.count; });

    hierarchy.push({
      name: deptName,
      totalStaff: deptTotal,
      teams: teams
    });
  });

  hierarchy.sort(function(a, b) { return b.totalStaff - a.totalStaff; });
  return hierarchy;
};
