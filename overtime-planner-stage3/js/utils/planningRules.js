// Overtime-owned pool and occurrence contracts. No allocation algorithm lives here.
(function () {
    'use strict';
    if (typeof window === 'undefined') global.window = global;
    var weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    function fail(error) { return {valid:false,error:error}; }
    function ymd(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        var d = new Date(value + 'T12:00:00Z');
        return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
    }
    function ids(value) { return Array.isArray(value) && value.every(function(v) {
        return typeof v === 'string' && /^POOL-[A-Za-z0-9_-]+$/.test(v);
    }) && new Set(value).size === value.length; }
    function sectionEnabled(job, section) { return !job || !job.staffingSections || job.staffingSections[section] !== false; }
    function source(job) {
        job = job || {};
        var selected = job.exclusivePoolSource || ((job.isExclusiveTeams || job.isExclusive) ? 'teams' : 'none');
        return (selected === 'teams' && !sectionEnabled(job, 'teams')) || (selected === 'tags' && !sectionEnabled(job, 'pools')) ? 'none' : selected;
    }
    function effectivePrefs(job, prefs) {
        var result = Object.assign({}, prefs || {});
        if (!sectionEnabled(job, 'teams')) {
            result.primaryTeam = ''; result.secondaryTeam = ''; result.tertiaryTeam = '';
            result.isExclusive = false; result.exclusiveTeams = []; result.teamsEnabled = false;
        }
        return result;
    }
    function effectiveJob(job) {
        var result = Object.assign({}, job || {});
        if (!sectionEnabled(job, 'teams')) {
            ['primaryTeam','defaultTeam','preferredTeam','secondaryTeam','tertiaryTeam'].forEach(function(key) { result[key] = ''; });
            result.isExclusive = false; result.isExclusiveTeams = false; result.exclusiveTeams = [];
        }
        if (!sectionEnabled(job, 'pools')) { result.preferredPoolTagIds = []; result.exclusivePoolTagIds = []; }
        if ((job && job.exclusivePoolSource !== undefined) || !sectionEnabled(job, 'teams')) result.exclusivePoolSource = source(job);
        return result;
    }
    function matches(staff, tagIds, catalogue) {
        var active = new Set((catalogue || []).filter(function(t) { return t.active; }).map(function(t) { return t.id; }));
        return (tagIds || []).some(function(id) { return active.has(id) && (staff.poolTagIds || []).indexOf(id) !== -1; });
    }
    function validatePattern(job) {
        if (job.frequencyType !== 'work_pattern') return {valid:true};
        var p = job.workPattern;
        if (!p || typeof p !== 'object' || Array.isArray(p)) return fail('Work pattern is required.');
        if (!ymd(p.startDate) || (p.endDate !== undefined && !ymd(p.endDate)) || (p.endDate && p.endDate < p.startDate)) return fail('Work pattern requires valid start/end dates.');
        if (['weekly','run'].indexOf(p.mode) === -1) return fail('Unknown work pattern mode.');
        if (typeof p.includePublicHolidays !== 'boolean') return fail('Choose whether the pattern includes public holidays.');
        if (!Array.isArray(p.excludedDates) || new Set(p.excludedDates).size !== p.excludedDates.length || !p.excludedDates.every(ymd)) return fail('Excluded dates must be unique valid dates.');
        if (p.mode === 'run') {
            if (!Number.isInteger(p.runLength) || p.runLength < 1 || p.runLength > 4 || p.includePublicHolidays) return fail('A one-off run must contain one to four days.');
        } else {
            if (!Array.isArray(p.days) || p.days.length > 4 || new Set(p.days).size !== p.days.length || !p.days.every(function(d) { return Number.isInteger(d) && d >= 0 && d <= 6; })) return fail('Choose up to four recurring days.');
            if (!p.days.length && !p.includePublicHolidays) return fail('Choose recurring days or public holidays.');
            if (p.days.length && !p.days.some(function(first) {
                return p.days.every(function(d) { return (d - first + 7) % 7 < p.days.length; });
            })) return fail('Recurring days must form a consecutive run of up to four days.');
        }
        return {valid:true};
    }
    function validateWorkspace(data) {
        var catalogue = data.poolTags === undefined ? [] : data.poolTags;
        if (!Array.isArray(catalogue)) return fail('poolTags must be an array.');
        var seen = new Set(), labels = new Set();
        for (var t of catalogue) {
            if (!t || !ids([t.id]) || typeof t.label !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(t.label) || typeof t.active !== 'boolean') return fail('Invalid pool tag: use a short alphanumeric hashtag.');
            if (seen.has(t.id) || labels.has(t.label.toLowerCase())) return fail('Duplicate pool tag ID or label.');
            seen.add(t.id); labels.add(t.label.toLowerCase());
        }
        var records = (data.roster || []).concat(data.jobs || []);
        for (var record of records) {
            for (var field of ['poolTagIds','preferredPoolTagIds','exclusivePoolTagIds']) {
                if (record[field] !== undefined && (!ids(record[field]) || !record[field].every(function(id) { return seen.has(id); }))) return fail('Unknown or duplicate pool reference in ' + field + '.');
            }
        }
        for (var job of data.jobs || []) {
            if (job.staffingSections !== undefined) {
                var sections = job.staffingSections;
                if (!sections || typeof sections !== 'object' || Array.isArray(sections) ||
                    Object.keys(sections).length !== 2 || !Object.prototype.hasOwnProperty.call(sections,'teams') ||
                    !Object.prototype.hasOwnProperty.call(sections,'pools') || typeof sections.teams !== 'boolean' || typeof sections.pools !== 'boolean') {
                    return fail('Staffing sections must specify teams and pools as booleans.');
                }
            }
            if (job.exclusivePoolSource !== undefined && ['none','teams','tags'].indexOf(job.exclusivePoolSource) === -1) return fail('Invalid exclusive pool source.');
            if (source(job) === 'tags' && sectionEnabled(job,'teams') && (job.isExclusiveTeams || job.isExclusive)) return fail('Choose team or tag exclusivity, not both.');
            var pattern = validatePattern(job);
            if (!pattern.valid) return pattern;
        }
        return {valid:true};
    }
    function dates(job, year) {
        if (!validatePattern(job).valid || job.frequencyType !== 'work_pattern') return [];
        var p = job.workPattern, excluded = new Set(p.excludedDates), holidays = new Set(
            (window.HortOpsData.getPublicHolidaysForYear(year) || []).map(function(h) { return h.date; }));
        var end = p.endDate || year + '-12-31', results = [];
        for (var d = new Date(Date.UTC(year,0,1)); d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate()+1)) {
            var date = d.toISOString().slice(0,10);
            if (date < p.startDate || date > end || excluded.has(date)) continue;
            var elapsed = Math.round((d - new Date(p.startDate + 'T00:00:00Z'))/86400000);
            var selected = p.mode === 'run' ? elapsed >= 0 && elapsed < p.runLength :
                p.days.indexOf(d.getUTCDay()) !== -1 || (p.includePublicHolidays && holidays.has(date));
            if (selected) results.push(date);
        }
        return results;
    }
    function slotFor(slots, date) {
        return slots.find(function(s) { return [s.fridayDate,s.saturdayDate,s.sundayDate,s.mondayDate].indexOf(date) !== -1; }) ||
            slots.filter(function(s) { return s.saturdayDate <= date; }).slice(-1)[0] || slots[0];
    }
    window.HortOpsPlanningRules = {validateWorkspace:validateWorkspace,validatePattern:validatePattern,
        dates:dates,slotFor:slotFor,source:source,matches:matches,weekdays:weekdays,isRealDate:ymd,
        sectionEnabled:sectionEnabled,effectiveJob:effectiveJob,effectivePrefs:effectivePrefs};
}());
