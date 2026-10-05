(function (host) {
  "use strict";
  var ZONE = "Australia/Adelaide";
  var formatter = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  function civil(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) throw new Error("Enter valid dates and start/end times.");
    var ms = Date.parse(date + "T" + time + ":00Z");
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) throw new Error("Enter a valid calendar date.");
    return ms;
  }
  function wall(ms) {
    var values = {}; formatter.formatToParts(new Date(ms)).forEach(function (part) { values[part.type] = part.value; });
    return Date.UTC(+values.year, +values.month - 1, +values.day, +values.hour, +values.minute);
  }
  function localInstant(date, time) {
    var target = civil(date, time), offsets = new Set();
    [-48, -24, 0, 24, 48].forEach(function (hours) { var probe = target + hours * 3600000; offsets.add(wall(probe) - probe); });
    var matches = Array.from(offsets).map(function (offset) { return target - offset; }).filter(function (ms) { return wall(ms) === target; }).sort(function (a, b) { return a - b; });
    if (!matches.length) throw new Error("That time does not exist in Australia/Adelaide because of daylight saving. Choose another time.");
    return { ms: matches[0], ambiguous: matches.length > 1 };
  }
  function validate(job) {
    var startDate = job.startDate, endDate = job.endDate || startDate;
    civil(startDate, "00:00"); civil(endDate, "00:00");
    if (endDate < startDate) throw new Error("End date must not precede start date.");
    if (job.allDay) return { startDate: startDate, endDate: endDate, allDay: true, ambiguous: false };
    var start = localInstant(startDate, job.startTime), end = localInstant(endDate, job.endTime);
    if (end.ms <= start.ms || civil(endDate, job.endTime) <= civil(startDate, job.startTime)) throw new Error("End must be after start. For an overnight job, set the end date to the following day.");
    return { start: start.ms, end: end.ms, ambiguous: start.ambiguous || end.ambiguous, allDay: false };
  }
  function escapeText(value) { return String(value == null ? "" : value).replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,"); }
  function fold(line) {
    var result = "", current = "", bytes = 0;
    Array.from(line).forEach(function (character) {
      var size = new TextEncoder().encode(character).length;
      if (bytes + size > 75) { result += current + "\r\n"; current = " "; bytes = 1; }
      current += character; bytes += size;
    });
    return result + current;
  }
  function stamp(ms) { return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
  function nextDate(date) { return new Date(civil(date, "00:00") + 86400000).toISOString().slice(0, 10).replace(/-/g, ""); }
  function outlookFile(job, options) {
    options = options || {};
    if (!job.id) throw new Error("A saved job is required to create an Outlook file.");
    var interval = validate(job);
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Horticulture Operations//Job Scheduler//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", "UID:" + encodeURIComponent(job.id) + "@horticulture-operations", "DTSTAMP:" + stamp(options.now == null ? Date.now() : options.now), "SUMMARY:" + escapeText(job.title || job.name || "Untitled job")];
    if (interval.allDay) {
      lines.push("DTSTART;VALUE=DATE:" + interval.startDate.replace(/-/g, ""), "DTEND;VALUE=DATE:" + nextDate(interval.endDate));
    } else lines.push("DTSTART:" + stamp(interval.start), "DTEND:" + stamp(interval.end));
    if (options.includeLocation !== false && job.location) lines.push("LOCATION:" + escapeText(job.location));
    lines.push("DESCRIPTION:" + escapeText("Job: " + job.id + "\nSchedule time zone: " + ZONE), "END:VEVENT", "END:VCALENDAR");
    return { contents: lines.map(fold).join("\r\n") + "\r\n", filename: String(job.id).replace(/[^a-zA-Z0-9_-]/g, "-") + ".ics", ambiguous: interval.ambiguous };
  }
  function daySegments(jobs, date) {
    var midnight = civil(date, "00:00"), next = midnight + 86400000;
    var segments = jobs.filter(function (job) { return !job.allDay && job.startDate && !job._unscheduled; }).map(function (job) {
      var start = civil(job.startDate, job.startTime), end = civil(job.endDate || job.startDate, job.endTime);
      if (end <= midnight || start >= next) return null;
      return { job: job, start: Math.max(0, (start - midnight) / 60000), end: Math.min(1440, (end - midnight) / 60000), continuesBefore: start < midnight, continuesAfter: end > next };
    }).filter(Boolean).sort(function (a, b) { return a.start - b.start || b.end - a.end || String(a.job.id).localeCompare(String(b.job.id)); });
    var group = [], lanes = [], groupEnd = -1;
    function finish() { group.forEach(function (segment) { segment.lanes = lanes.length; }); group = []; lanes = []; groupEnd = -1; }
    segments.forEach(function (segment) {
      if (segment.start >= groupEnd) finish();
      var lane = lanes.findIndex(function (end) { return end <= segment.start; });
      if (lane < 0) lane = lanes.length;
      lanes[lane] = segment.end; segment.lane = lane; group.push(segment); groupEnd = Math.max(groupEnd, segment.end);
    }); finish(); return segments;
  }
  var api = { timeZone: ZONE, validate: validate, localInstant: localInstant, outlookFile: outlookFile, daySegments: daySegments };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  host.UOS = host.UOS || {}; host.UOS.SchedulerCalendarTools = api;
}(typeof window === "undefined" ? globalThis : window));
