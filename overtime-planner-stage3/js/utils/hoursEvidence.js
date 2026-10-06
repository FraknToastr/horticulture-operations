// Optional operator-verified hours history. Existing YTD fields are not evidence.
(function(root) {
  'use strict';
  var keys = ['id','year','throughDate','hours','source','recordedAt','verification'];
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  function fail(error) { return { valid: false, error: error }; }
  function validateRecord(record, options) {
    options = options || {};
    if (!record || typeof record !== 'object' || Array.isArray(record) ||
        Object.keys(record).length !== keys.length || !keys.every(function(key) { return Object.prototype.hasOwnProperty.call(record,key); })) {
      return fail('Hours evidence must contain exactly id, year, throughDate, hours, source, recordedAt and verification.');
    }
    if (typeof record.id !== 'string' || !/^HOURS-[A-Za-z0-9_-]+$/.test(record.id)) return fail('Hours evidence requires a canonical HOURS- identifier.');
    if (!Number.isInteger(record.year) || record.year < 1 || record.year > 9999) return fail('Hours evidence requires a valid calendar year.');
    if (!validDate(record.throughDate) || Number(record.throughDate.slice(0,4)) !== record.year) return fail('Hours evidence coverage date must be a real date in its calendar year.');
    if (typeof record.hours !== 'number' || !Number.isFinite(record.hours) || record.hours < 0) return fail('Hours evidence requires finite, nonnegative hours.');
    if (typeof record.source !== 'string' || !record.source.trim()) return fail('Identify the source used to verify the hours.');
    if (typeof record.recordedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(record.recordedAt) ||
        !validDate(record.recordedAt.slice(0,10)) || !Number.isFinite(Date.parse(record.recordedAt))) return fail('Hours evidence recordedAt must be an ISO timestamp with a timezone.');
    if (record.verification !== 'operator_verified') return fail('Hours evidence must be explicitly verified by the operator.');
    if (options.today !== undefined) {
      if (!validDate(options.today)) return fail('A real current date is required for hours entry.');
      if (record.throughDate > options.today) return fail('Hours evidence cannot cover a future date.');
    }
    return { valid: true };
  }
  function validate(records, options) {
    if (records === undefined) return { valid: true };
    if (!Array.isArray(records)) return fail('Overtime hours evidence must be an array.');
    var ids = new Set();
    for (var i = 0; i < records.length; i++) {
      var result = validateRecord(records[i], options);
      if (!result.valid) return fail('Hours evidence record ' + (i + 1) + ': ' + result.error);
      if (ids.has(records[i].id)) return fail('Hours evidence identifiers must be unique.');
      ids.add(records[i].id);
    }
    return { valid: true };
  }
  function latest(records, year) {
    if (!validate(records).valid || !Array.isArray(records)) return null;
    var selected = records.filter(function(record) { return record.year === year; }).slice().sort(function(a,b) {
      var difference = Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
      if (difference) return difference;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    })[0];
    return selected ? Object.assign({}, selected) : null;
  }
  root.HortOpsHoursEvidence = { validate: validate, validateRecord: validateRecord, latest: latest, isRealDate: validDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HortOpsHoursEvidence;
})(typeof window !== 'undefined' ? window : globalThis);
