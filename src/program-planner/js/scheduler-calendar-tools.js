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
  function dayInterval(job) {
    if (!job || job.allDay || !job.startDate || !job.startTime || !job.endTime) return null;
    try {
      var start = (civil(job.startDate, job.startTime) - civil(job.startDate, "00:00")) / 60000;
      var end = (civil(job.endDate || job.startDate, job.endTime) - civil(job.startDate, "00:00")) / 60000;
      return start >= 0 && end > start && end <= 1440 ? { date: job.startDate, start: start, end: end } : null;
    } catch (error) { return null; }
  }
  function intervalPatch(range) {
    if (!range || !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end > 1440 || range.end <= range.start) throw new Error("Choose a valid time within one day.");
    civil(range.date, "00:00");
    function time(minutes) { return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0"); }
    return { startDate: range.date, endDate: range.end === 1440 ? new Date(civil(range.date, "00:00") + 86400000).toISOString().slice(0, 10) : range.date,
      startTime: time(range.start), endTime: range.end === 1440 ? "00:00" : time(range.end), allDay: false };
  }
  function slotInterval(date, minute) {
    var start = Math.max(0, Math.min(1410, Math.floor(minute / 30) * 30));
    return { date: date, start: start, end: start + 30 };
  }
  function adjustInterval(range, handle, delta) {
    var start = range.start, end = range.end;
    if (handle === "move") {
      var duration = end - start;
      start = Math.max(0, Math.min(Math.floor((1440 - duration) / 30) * 30, Math.round((start + delta) / 30) * 30));
      end = start + duration;
    } else if (handle === "start") start = Math.max(0, Math.min(Math.floor((end - 30) / 30) * 30, Math.round((start + delta) / 30) * 30));
    else if (handle === "end") end = Math.min(1440, Math.max(Math.ceil((start + 30) / 30) * 30, Math.round((end + delta) / 30) * 30));
    else throw new Error("Unknown calendar handle.");
    return { date: range.date, start: start, end: end };
  }
function stackedWeekLayout(jobs, dates) {
    var days = dates.map(function (date) { return daySegments(jobs, date); });
    var intervals = days.flat();
    var bands = [];
    days.forEach(function (segments) {
      var group = null;
      segments.forEach(function (segment) {
        if (!group || Math.floor(segment.start / 30) >= Math.ceil(group.end / 30)) {
          if (group && group.count > 1) bands.push(group);
          group = { start: segment.start, end: segment.end, count: 1 };
        } else { group.end = Math.max(group.end, segment.end); group.count++; }
      });
      if (group && group.count > 1) bands.push(group);
    });
    // Shared bands cover whole bookings, so no job is split at a band boundary.
    bands.forEach(function (band) { band.first = Math.floor(band.start / 30); band.last = Math.ceil(band.end / 30); });
    var changed = true;
    while (changed) {
      changed = false;
      bands.forEach(function (band) {
        intervals.forEach(function (segment) {
          var first = Math.floor(segment.start / 30), last = Math.ceil(segment.end / 30);
          if (first < band.last && last > band.first && (first < band.first || last > band.last)) {
            band.first = Math.min(first, band.first); band.last = Math.max(last, band.last); changed = true;
          }
        });
      });
      bands.sort(function (a, b) { return a.first - b.first; });
      for (var i = 1; i < bands.length; i++) {
        if (bands[i].first < bands[i - 1].last) {
          bands[i - 1].last = Math.max(bands[i - 1].last, bands[i].last);
          bands.splice(i--, 1); changed = true;
        }
      }
    }
    var rows = Array.from({ length: 48 }, function (_, index) {
      var minute = index * 30;
      return { minute: minute, top: 0, height: 24, cells: days.map(function (segments) {
        return segments.filter(function (segment) { return segment.start < minute + 30 && segment.end > minute; });
      }) };
    });
    bands.forEach(function (band) {
      band.cells = days.map(function (segments) { return segments.filter(function (segment) {
        return segment.start < band.last * 30 && segment.end > band.first * 30;
      }); });
      var count = Math.max.apply(null, band.cells.map(function (cell) { return cell.length; }));
      var height = Math.max((band.last - band.first) * 24, 28 + count * 64 + (count + 1) * 8);
      for (var i = band.first; i < band.last; i++) { rows[i].height = height / (band.last - band.first); rows[i].band = band; }
    });
    // A very short standalone booking still needs a readable, usable block.
    intervals.forEach(function (segment) {
      var first = Math.floor(segment.start / 30), last = Math.ceil(segment.end / 30);
      if (!rows[first].band && last - first <= 2) {
        var available = Math.max(1, Math.ceil((segment.end - segment.start) / 30));
        var required = 52 / available;
        for (var i = first; i < last; i++) rows[i].height = Math.max(rows[i].height, required);
      }
    });
    var top = 0;
    rows.forEach(function (row) { row.top = top; top += row.height; });
    var layout = { rows: rows, height: top, dates: dates, bands: bands, blocks: [] };
    bands.forEach(function (band) {
      band.top = rows[band.first].top;
      band.height = (band.last === 48 ? top : rows[band.last].top) - band.top;
    });
    layout.blocks = days.map(function (segments, column) {
      return segments.map(function (segment) {
        var band = rows[Math.floor(segment.start / 30)].band;
        if (band) return { segment: segment, top: band.top + 36 + band.cells[column].indexOf(segment) * 72,
          height: 64, minute: band.first * 30, band: band };
        var start = pixelAtMinute(layout, segment.start), end = pixelAtMinute(layout, segment.end);
        return { segment: segment, top: start + 4, height: Math.max(44, end - start - 8), minute: Math.floor(segment.start / 30) * 30 };
      });
    });
    return layout;
  }
  function pixelAtMinute(layout, minute) {
    if (minute >= 1440) return layout.height;
    var row = layout.rows[Math.max(0, Math.floor(minute / 30))];
    return row.top + (minute - row.minute) / 30 * row.height;
  }
  function minuteAtPixel(layout, pixel) {
    var row = layout.rows.find(function (entry) { return pixel < entry.top + entry.height; }) || layout.rows[47];
    return row.minute;
  }
  function shiftDate(date, days) {
    return new Date(civil(date, "00:00") + days * 86400000).toISOString().slice(0, 10);
  }
  function dateDistance(from, to) { return Math.round((civil(to, "00:00") - civil(from, "00:00")) / 86400000); }
  function occupiedDates(job) {
    var end = job.endDate || job.startDate;
    if (!job.allDay && job.endTime === "00:00" && end > job.startDate) end = shiftDate(end, -1);
    return { startDate: job.startDate, endDate: end };
  }
  function shiftSchedule(job, days) {
    return { startDate: shiftDate(job.startDate, days), endDate: shiftDate(job.endDate || job.startDate, days),
      startTime: job.allDay ? "" : job.startTime, endTime: job.allDay ? "" : job.endTime, allDay: Boolean(job.allDay) };
  }
  function resizeDates(job, edge, days) {
    var dates = occupiedDates(job);
    if (edge === "date-start") dates.startDate = [shiftDate(dates.startDate, days), dates.endDate].sort()[0];
    else dates.endDate = [shiftDate(dates.endDate, days), dates.startDate].sort()[1];
    return { startDate: dates.startDate, endDate: dates.endDate, startTime: "", endTime: "", allDay: true };
  }
  function spanLanes(jobs, dates) {
    if (!dates.length) return [];
    var spans = jobs.filter(function (job) { var range = occupiedDates(job); return range.startDate <= dates[dates.length - 1] && range.endDate >= dates[0]; })
      .map(function (job) { var range = occupiedDates(job); return { job: job, start: Math.max(0, dateDistance(dates[0], range.startDate)), end: Math.min(dates.length - 1, dateDistance(dates[0], range.endDate)),
        continuesBefore: range.startDate < dates[0], continuesAfter: range.endDate > dates[dates.length - 1] }; })
      .sort(function (a, b) { return a.start - b.start || b.end - a.end || String(a.job.id).localeCompare(String(b.job.id)); });
    var ends = [];
    spans.forEach(function (span) { var lane = ends.findIndex(function (end) { return end < span.start; }); if (lane < 0) lane = ends.length; ends[lane] = span.end; span.lane = lane; });
    return spans;
  }
  var api = { timeZone: ZONE, shiftDate: shiftDate, dateDistance: dateDistance, occupiedDates: occupiedDates, shiftSchedule: shiftSchedule, resizeDates: resizeDates, spanLanes: spanLanes, validate: validate, localInstant: localInstant, outlookFile: outlookFile, daySegments: daySegments,
    stackedWeekLayout: stackedWeekLayout, pixelAtMinute: pixelAtMinute, minuteAtPixel: minuteAtPixel,
    dayInterval: dayInterval, intervalPatch: intervalPatch, slotInterval: slotInterval, adjustInterval: adjustInterval };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  host.UOS = host.UOS || {}; host.UOS.SchedulerCalendarTools = api;
}(typeof window === "undefined" ? globalThis : window));
