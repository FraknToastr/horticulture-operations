// Canonical Municipal Qualification & Accreditation Registry Engine (Stage 3 Gate 3A)
// Governs Adelaide City Council horticultural, arboricultural, machinery, and fleet accreditations.
if (typeof require !== 'undefined') {
  if (typeof window === 'undefined') {
    global.window = global;
  }
}

(function() {
  'use strict';

  var QUALIFICATION_REGISTRY = {
    CHAINSAW_L1: {
      code: 'CHAINSAW_L1',
      name: 'Chainsaw Level 1 (Cross-cutting & Ground Trimming)',
      category: 'Arboriculture',
      validityMonths: 36,
      validityDays: 1095,
      badgeColor: '#059669',
      description: 'Basic chainsaw operations, maintenance, cross-cutting, and ground-level branch trimming.'
    },
    CHAINSAW_L2: {
      code: 'CHAINSAW_L2',
      name: 'Chainsaw Level 2 (Felling & Tree Surgery)',
      category: 'Arboriculture',
      validityMonths: 36,
      validityDays: 1095,
      badgeColor: '#047857',
      description: 'Advanced directional tree felling, elevated limbs, and complex arboricultural surgery.'
    },
    EWP_TICKET: {
      code: 'EWP_TICKET',
      name: 'Elevated Work Platform (EWP > 11m)',
      category: 'Machinery',
      validityMonths: 60,
      validityDays: 1825,
      badgeColor: '#d97706',
      description: 'Safe operation of high-reach boom-type cherry pickers and municipal elevated platforms.'
    },
    CHIPPER: {
      code: 'CHIPPER',
      name: 'Wood Chipper & Stump Grinder',
      category: 'Machinery',
      validityMonths: 36,
      validityDays: 1095,
      badgeColor: '#b45309',
      description: 'Commercial wood chipper, brush disc feed, and stump grinder operations.'
    },
    CHEM_ACUP: {
      code: 'CHEM_ACUP',
      name: 'Chemical Handling & Spraying (ACUP / ChemCert)',
      category: 'Chemical',
      validityMonths: 36,
      validityDays: 1095,
      badgeColor: '#7c3aed',
      description: 'Preparation, handling, and application of herbicides and agricultural pesticides.'
    },
    CPR: {
      code: 'CPR',
      name: 'Provide Cardiopulmonary Resuscitation (HLTAID009)',
      category: 'Safety',
      validityMonths: 12,
      validityDays: 365,
      badgeColor: '#e11d48',
      description: 'Annual workplace CPR certification and resuscitation refresher.'
    },
    WHITE_CARD: {
      code: 'WHITE_CARD',
      name: 'General Construction Induction (White Card)',
      category: 'Safety',
      validityMonths: null,
      validityDays: null,
      isNonExpiring: true,
      badgeColor: '#475569',
      description: 'National WHS general construction induction training (non-expiring).'
    },
    FIRST_AID: {
      code: 'FIRST_AID',
      name: 'Senior First Aid & CPR',
      category: 'Safety',
      validityMonths: 36,
      validityDays: 1095,
      badgeColor: '#dc2626',
      description: 'Workplace Senior First Aid (HLTAID011) and annual CPR certification.'
    },
    HR_LICENSE: {
      code: 'HR_LICENSE',
      name: 'Heavy Rigid (HR) Driver License',
      category: 'Fleet',
      validityMonths: 60,
      validityDays: 1825,
      badgeColor: '#2563eb',
      description: 'Heavy rigid municipal transport, multi-axle tippers, and high-capacity water tankers.'
    },
    MR_LICENSE: {
      code: 'MR_LICENSE',
      name: 'Medium Rigid (MR) Driver License',
      category: 'Fleet',
      validityMonths: 60,
      validityDays: 1825,
      badgeColor: '#1d4ed8',
      description: 'Medium rigid depot trucks and dual-cab tool transport vehicles.'
    },
    TRAFFIC_MGMT: {
      code: 'TRAFFIC_MGMT',
      name: 'Work Zone Traffic Management (WZTM)',
      category: 'Safety',
      validityMonths: 36,
      validityDays: 1095,
      badgeColor: '#ea580c',
      description: 'Setup, maintenance, and traffic controller duties on municipal verges and road corridors.'
    }
  };

  var VALID_STATUSES = ['active', 'expired', 'suspended'];

  function isRealYmd(text) {
    if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    var y = parseInt(text.slice(0, 4), 10);
    var m = parseInt(text.slice(5, 7), 10);
    var d = parseInt(text.slice(8, 10), 10);
    if (m < 1 || m > 12) return false;
    var test = new Date(Date.UTC(y, m - 1, d));
    return test.getUTCFullYear() === y &&
           test.getUTCMonth() + 1 === m &&
           test.getUTCDate() === d;
  }

  var engine = {
    REGISTRY: QUALIFICATION_REGISTRY,
    DEFINITIONS: QUALIFICATION_REGISTRY,
    VALID_STATUSES: VALID_STATUSES,

    getAllDefinitions: function() {
      var keys = Object.keys(QUALIFICATION_REGISTRY);
      return keys.map(function(k) { return QUALIFICATION_REGISTRY[k]; });
    },

    getDefinition: function(code) {
      if (!code || typeof code !== 'string') return null;
      var upper = code.trim().toUpperCase();
      return QUALIFICATION_REGISTRY[upper] || null;
    },

    isValidCode: function(code) {
      if (!code || typeof code !== 'string') return false;
      return Object.prototype.hasOwnProperty.call(QUALIFICATION_REGISTRY, code.trim().toUpperCase());
    },

    isRealYmd: isRealYmd,
    isValidDateString: isRealYmd,

    calculateDefaultExpiry: function(issuedDate, code) {
      var def = this.getDefinition(code);
      var months = (def && def.validityMonths) ? def.validityMonths : 36;
      if (!issuedDate || !isRealYmd(issuedDate)) {
        issuedDate = new Date().toISOString().slice(0, 10);
      }
      var parts = issuedDate.split('-');
      var y = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10);
      var d = parseInt(parts[2], 10);
      var targetMonth = m - 1 + months;
      var targetYear = y + Math.floor(targetMonth / 12);
      var remMonth = targetMonth % 12;
      var daysInMonth = new Date(Date.UTC(targetYear, remMonth + 1, 0)).getUTCDate();
      var clampedDay = Math.min(d, daysInMonth);
      var res = new Date(Date.UTC(targetYear, remMonth, clampedDay));
      return res.toISOString().slice(0, 10);
    },

    validateQualification: function(q) {
      if (!q || typeof q !== 'object' || Array.isArray(q)) {
        return { valid: false, error: 'Qualification entry must be an object.' };
      }
      if (!q.code || typeof q.code !== 'string' || !q.code.trim()) {
        return { valid: false, error: 'Qualification entry missing required code.' };
      }
      var codeUpper = q.code.trim().toUpperCase();
      if (!this.isValidCode(codeUpper)) {
        return { valid: false, error: 'Unrecognized qualification code: ' + q.code };
      }
      if (q.status !== undefined && q.status !== null) {
        var st = String(q.status).trim().toLowerCase();
        if (VALID_STATUSES.indexOf(st) === -1) {
          return { valid: false, error: 'Qualification ' + codeUpper + ' has invalid status: ' + q.status };
        }
      }
      if (q.issuedDate !== undefined && q.issuedDate !== null && q.issuedDate !== '') {
        if (!isRealYmd(q.issuedDate)) {
          return { valid: false, error: 'Qualification ' + codeUpper + ' issuedDate must be YYYY-MM-DD.' };
        }
      }
      if (q.expiryDate !== undefined && q.expiryDate !== null && q.expiryDate !== '') {
        if (!isRealYmd(q.expiryDate)) {
          return { valid: false, error: 'Qualification ' + codeUpper + ' expiryDate must be YYYY-MM-DD.' };
        }
        if (q.issuedDate && q.expiryDate < q.issuedDate) {
          return { valid: false, error: 'Qualification ' + codeUpper + ' expiryDate (' + q.expiryDate + ') cannot precede issuedDate (' + q.issuedDate + ').' };
        }
      }
      return { valid: true };
    },

    isQualificationValid: function(target, asOfDate) {
      if (!target || typeof target !== 'object') return false;
      var status = (target.status || 'active').toLowerCase();
      if (status !== 'active') return false;

      var checkDate = asOfDate;
      if (!checkDate) {
        checkDate = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
          ? window.HortOpsDateUtils.getLocalDateKey()
          : new Date().toISOString().slice(0, 10);
      }

      // issuedDate is mandatory for accredited validity on a given date
      if (!target.issuedDate || !isRealYmd(target.issuedDate)) {
        return false;
      }
      if (target.issuedDate > checkDate) {
        return false; // Not yet issued on asOfDate
      }

      var def = this.getDefinition(target.code);
      var isNonExpiring = Boolean((def && def.isNonExpiring) || target.isNonExpiring);
      if (isNonExpiring) {
        if (target.expiryDate) {
          if (!isRealYmd(target.expiryDate) || target.expiryDate < checkDate) return false;
        }
        return true;
      }

      // Time-limited qualification requires valid expiryDate
      if (!target.expiryDate || !isRealYmd(target.expiryDate)) {
        return false;
      }
      if (target.expiryDate < target.issuedDate) {
        return false;
      }
      if (target.expiryDate < checkDate) {
        return false; // Expired
      }

      return true;
    },

    isQualificationExpired: function(target, asOfDate) {
      if (!target) return true;
      var checkDate = asOfDate;
      if (!checkDate) {
        checkDate = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
          ? window.HortOpsDateUtils.getLocalDateKey()
          : new Date().toISOString().slice(0, 10);
      }
      if (typeof target === 'string') {
        return target < checkDate;
      }
      if (typeof target === 'object') {
        var status = (target.status || 'active').toLowerCase();
        if (status === 'expired' || status === 'suspended') {
          return true;
        }
        // If not valid on checkDate, treat as non-compliant/expired
        if (!this.isQualificationValid(target, checkDate)) {
          return true;
        }
        return false;
      }
      return false;
    },

    isExpired: function(target, asOfDate) {
      return this.isQualificationExpired(target, asOfDate);
    },

    evaluateStaffQualifications: function(staff, requiredCodes, asOfDate) {
      requiredCodes = Array.isArray(requiredCodes) ? requiredCodes : [];
      if (requiredCodes.length === 0) {
        return {
          compliant: true,
          qualified: true,
          missing: [],
          missingCodes: [],
          expired: [],
          expiredCodes: [],
          active: [],
          validCodes: [],
          totalRequired: 0,
          totalSatisfied: 0
        };
      }

      var checkDate = asOfDate;
      if (!checkDate) {
        checkDate = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
          ? window.HortOpsDateUtils.getLocalDateKey()
          : new Date().toISOString().slice(0, 10);
      }

      var staffQuals = (staff && Array.isArray(staff.qualifications)) ? staff.qualifications : [];
      var activeMap = {};
      var expiredMap = {};

      for (var i = 0; i < staffQuals.length; i++) {
        var sq = staffQuals[i];
        if (!sq || !sq.code) continue;
        var codeUpper = String(sq.code).trim().toUpperCase();
        var isExp = this.isQualificationExpired(sq, checkDate);
        if (isExp) {
          expiredMap[codeUpper] = sq;
        } else {
          activeMap[codeUpper] = sq;
        }
      }

      var missing = [];
      var expired = [];
      var active = [];

      for (var r = 0; r < requiredCodes.length; r++) {
        var reqCode = String(requiredCodes[r]).trim().toUpperCase();
        if (activeMap[reqCode]) {
          active.push(reqCode);
        } else if (expiredMap[reqCode]) {
          expired.push(reqCode);
        } else {
          missing.push(reqCode);
        }
      }

      var isCompliant = (missing.length === 0 && expired.length === 0);
      return {
        compliant: isCompliant,
        qualified: isCompliant,
        missing: missing,
        missingCodes: missing,
        expired: expired,
        expiredCodes: expired,
        active: active,
        validCodes: active,
        totalRequired: requiredCodes.length,
        totalSatisfied: active.length
      };
    }
  };

  window.HortOpsQualifications = engine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
})();
