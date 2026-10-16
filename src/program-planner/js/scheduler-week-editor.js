(function (host) {
  "use strict";
  var UOS = host.UOS = host.UOS || {};
  function create(options) {
    var root = options.root, tools = UOS.SchedulerCalendarTools, drafts = new Map();
    var saving = false, gesture = null, frame = 0, focusMinute = 540, suppressClick = false;
    var live = document.createElement("p"); live.className = "uos-sr-only"; live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite"); root.appendChild(live);
    function announce(message) { if (live.textContent !== message) live.textContent = message; }
    function form() { return options.form(); }
    function values() {
      var result = {}, node = form();
      if (node) Array.from(node.elements).forEach(function (field) { if (field.name) result[field.name] = field.type === "checkbox" ? field.checked : field.value; });
      return result;
    }
    function fingerprint(job) {
      return JSON.stringify(["startDate", "endDate", "startTime", "endTime", "allDay", "crewId", "location", "priority", "updatesApplicationStatus", "status", "projectId", "owner"].map(function (key) { return job && job[key]; }));
    }
    function dirty(entry) { return Boolean(entry && JSON.stringify(entry.values) !== JSON.stringify(entry.baseline)); }
    function active() { return drafts.get(options.context().jobId); }
    function restore(saved) {
      var node = form(); if (!node || !saved) return;
      Object.keys(saved).forEach(function (name) { var field = node.elements[name]; if (field) { if (field.type === "checkbox") field.checked = saved[name]; else field.value = saved[name]; } });
      options.capture();
    }
    function remember() {
      var context = options.context(); if (!context.editing || !form()) return null;
      var entry = drafts.get(context.jobId);
      if (!entry) { entry = { baseline: values(), values: values(), fingerprint: fingerprint(context.job), touched: false }; drafts.set(context.jobId, entry); }
      else entry.values = values();
      return entry;
    }
    function patch(fields) {
      return { startDate: fields.startDate, endDate: fields.sameDay ? fields.startDate : fields.endDate || fields.startDate, startTime: fields.startTime, endTime: fields.endTime,
        allDay: Boolean(fields.allDay), crewId: fields.crewId, location: fields.location, priority: fields.priority, updatesApplicationStatus: Boolean(fields.updatesApplicationStatus) };
    }
    function previewJobs(jobs) {
      return jobs.map(function (job) {
        var entry = drafts.get(job.id); if (!dirty(entry)) return job;
        var changes = patch(entry.values);
        try { tools.validate(changes); return options.normalize(Object.assign({}, job, changes, { _unscheduled: false, _calendarDraft: true })); }
        catch (error) { return job; }
      });
    }
    function eligible() {
      var c = options.context();
      return c.editing && root.getClientRects().length && !saving && !pending && form() && c.job && c.job.owner === c.owner && c.job.projectId === c.projectId;
    }
    function updateStatus() {
      var entry = active(), node = root.querySelector("[data-scheduler-draft-state]"), discard = root.querySelector("[data-scheduler-discard]");
      var hint = root.querySelector("[data-scheduler-placement-hint]"); if (hint) hint.hidden = !(options.context().editing && options.context().week && options.context().job?._unscheduled);
      if (node) { node.hidden = !dirty(entry); node.textContent = entry && entry.fingerprint !== fingerprint(options.context().job) ? "This job changed elsewhere. Your unsaved draft is retained." : "Unsaved schedule changes"; }
      if (discard) { discard.hidden = !dirty(entry); discard.disabled = saving; }
    }
    var pending = null, paging = false, controls = [], ownerKey = "scheduler-date-editor";
    function clearControls() { controls.forEach(function (node) { node.remove(); }); controls = []; }
    function currentJob() { return previewJobs([options.context().job])[0]; }
    function jobCards() {
      return Array.from(root.querySelectorAll(".program-calendar-job")).filter(function (node) {
        return node.dataset.schedulerJob === options.context().jobId && !node.closest("[data-scheduler-unscheduled]");
      });
    }
    function addControl(kind, rect, x, y) {
      var button = document.createElement("button"); button.type = "button"; button.className = "scheduler-week-handle";
      button.dataset.weekHandle = kind; button.dataset.schedulerGestureOwner = ownerKey;
      var label = { move: "Move job", start: "Adjust job start time", end: "Adjust job end time", "date-start": "Adjust job first day", "date-end": "Adjust job last day" }[kind];
      button.setAttribute("aria-label", label + ". Enter or Space picks up; arrows adjust; Enter drops; Escape cancels.");
      button.title = label; button.style.position = "fixed"; button.style.left = x - 22 + "px"; button.style.top = y - 22 + "px";
      button.innerHTML = kind === "move" ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/></svg>' : '<span class="scheduler-week-edge-grip' + (kind.indexOf("date-") === 0 ? ' is-date-grip' : '') + '" aria-hidden="true"></span>';
      document.body.appendChild(button); controls.push(button);
    }
    function enhance() {
      updateStatus(); if (gesture || pending) return; clearControls();
      root.querySelectorAll('.has-schedule-handles').forEach(function (node) { node.classList.remove('has-schedule-handles'); });
      var enabled = eligible();
      root.querySelectorAll(".scheduler-week-day").forEach(function (day) {
        day.classList.toggle("is-editable", Boolean(enabled)); day.tabIndex = enabled ? 0 : -1;
        day.setAttribute("aria-label", "Timed jobs for " + day.dataset.schedulerDate + (enabled ? ". Up and Down select half-hour. Enter places the job open in the editor." : ""));
      });
      if (!enabled) return;
      var job = currentJob(); if (!job || job._unscheduled) return;
      var nodes = jobCards(); if (!nodes.length) return;
      nodes.forEach(function (node) { node.classList.add('has-schedule-handles'); });
      var first = nodes[0].getBoundingClientRect(), last = nodes[nodes.length - 1].getBoundingClientRect();
      addControl("date-start", first, first.left + 2, first.top + first.height / 2);
      addControl("date-end", last, last.right - 2, last.top + last.height / 2);
      var accessories = nodes[0].querySelector('.scheduler-card-accessories');
      var moveX = accessories ? accessories.getBoundingClientRect().left + 22 : first.right - 24;
      addControl("move", first, moveX, first.top + Math.min(first.height / 2, 22));
      if (options.context().week && tools.dayInterval(job)) {
        addControl("start", first, first.left + first.width / 2, first.top);
        addControl("end", last, last.left + last.width / 2, last.bottom);
      }
      var scroller = root.querySelector(".program-calendar-scroll"), viewport = scroller.getBoundingClientRect();
      var bounds = { top: viewport.top + scroller.clientTop, left: viewport.left + scroller.clientLeft,
        right: viewport.left + scroller.clientLeft + scroller.clientWidth, bottom: viewport.top + scroller.clientTop + scroller.clientHeight };
      var header = root.querySelector(options.context().week ? ".scheduler-week-head" : ".scheduler-month-heading");
      if (header) {
        if (options.context().week && job.allDay) {
          var rail = root.querySelector(".scheduler-all-day-rail").getBoundingClientRect();
          bounds.top = Math.max(bounds.top, rail.top); bounds.bottom = Math.min(bounds.bottom, rail.bottom);
        } else bounds.top = Math.max(bounds.top, header.getBoundingClientRect().bottom);
      }
      var gutter = options.context().week && root.querySelector(".scheduler-week-gutter");
      if (gutter) bounds.left = Math.max(bounds.left, gutter.getBoundingClientRect().right);
      controls.forEach(function (node) {
        var rect = node.getBoundingClientRect(), left = bounds.left, right = bounds.right;
        // Side grips keep their outer target area without covering card symbols.
        var edgeCard = node.dataset.weekHandle === "date-start" ? nodes[0] : node.dataset.weekHandle === "date-end" ? nodes[nodes.length - 1] : null;
        var rail = edgeCard && edgeCard.querySelector(".scheduler-card-accessories");
        if (rail) {
          var railBox = rail.getBoundingClientRect();
          if (rect.top < railBox.bottom && rect.bottom > railBox.top) {
            if (node.dataset.weekHandle === "date-end") left = Math.max(left, railBox.right + 2);
            else if (rect.right > railBox.left) right = Math.min(right, railBox.left - 2);
          }
        }
        node.hidden = rect.bottom <= bounds.top || rect.top >= bounds.bottom || rect.right <= left || rect.left >= right;
        node.style.clipPath = "inset(" + Math.max(0, bounds.top - rect.top) + "px " + Math.max(0, rect.right - right) + "px " + Math.max(0, rect.bottom - bounds.bottom) + "px " + Math.max(0, left - rect.left) + "px)";
      });
    }
    function sync() {
      var c = options.context();
      if (c.editing && form()) {
        var entry = drafts.get(c.jobId);
        if (pending) restore(pending.before);
        else if (dirty(entry)) restore(entry.values);
        else drafts.set(c.jobId, { baseline: values(), values: values(), fingerprint: fingerprint(c.job), touched: false });
      }
      enhance();
    }
    function writeSchedule(changes) {
      if (!form()) return false;
      try { tools.validate(changes); } catch (error) { announce(error.message); return false; }
      remember();
      Object.keys(changes).forEach(function (key) { var field = form().elements[key]; if (field) { if (field.type === "checkbox") field.checked = changes[key]; else field.value = changes[key]; } });
      form().elements.sameDay.checked = changes.startDate === changes.endDate;
      options.capture(); var entry = remember(); entry.touched = true; updateStatus();
      announce(changes.startDate + " to " + changes.endDate + ", " + (changes.allDay ? "all day" : changes.startTime + " to " + changes.endTime) + ". Unsaved schedule.");
      return true;
    }
    function writeInterval(range) { return writeSchedule(tools.intervalPatch(range)); }
    function place(date, minute) {
      if (!eligible() || !options.context().week) return;
      var c = options.context(), prior = tools.dayInterval(currentJob());
      if (!c.job._unscheduled && !prior) return;
      var duration = prior ? prior.end - prior.start : 30, start = Math.min(tools.slotInterval(date, minute).start, Math.floor((1440 - duration) / 30) * 30);
      if (writeInterval({ date: date, start: start, end: start + duration })) {
        options.repaint();
        var selected = jobCards()[0], scroller = root.querySelector(".program-calendar-scroll");
        if (selected) {
          var box = selected.getBoundingClientRect(), view = scroller.getBoundingClientRect(), top = view.top + root.querySelector(".scheduler-week-head").getBoundingClientRect().height + 24;
          if (box.bottom > view.bottom - 24) scroller.scrollTop += box.bottom - view.bottom + 24;
          else if (box.top < top) scroller.scrollTop -= top - box.top;
        }
        enhance();
      }
    }
    function queueRepaint() { if (!frame) frame = host.requestAnimationFrame(function () { frame = 0; options.repaint(); }); }
    function changed(event) {
      if (!event.target.closest("[data-scheduler-form]") || !form() || saving || pending) return;
      options.capture(); remember(); updateStatus(); queueRepaint();
    }
    function hitDate(x, y) {
      var hits = Array.from(root.querySelectorAll("[data-scheduler-hit-date]"));
      var best = null, distance = Infinity;
      hits.forEach(function (node) {
        var r = node.getBoundingClientRect(); if (!r.width || !r.height) return;
        var dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
        var d = dx * dx + dy * dy;
        if (d < distance) { distance = d; best = { date: node.dataset.schedulerHitDate, rect: r, node: node }; }
      });
      return best;
    }
    function timeAt(y, date) {
      var day = root.querySelector('.scheduler-week-day[data-scheduler-date="' + date + '"]');
      return day ? tools.minuteAtPixel(options.layout(), y - day.getBoundingClientRect().top) : 0;
    }
    function fadeSources() { jobCards().forEach(function (node) { node.classList.add("is-drag-source"); }); }
    function paintGhost() {
      var g = gesture; if (!g) return;
      var job = g.proposed, dates = tools.occupiedDates(job);
      root.querySelectorAll("[data-scheduler-hit-date]").forEach(function (node) { node.classList.toggle("is-date-preview", node.dataset.schedulerHitDate >= dates.startDate && node.dataset.schedulerHitDate <= dates.endDate); });
      var hit = hitDate(g.clientX, g.clientY); if (!hit) return;
      var rect = g.sourceRect, left = hit.rect.left + 6, top = g.clientY - g.grabY, width = rect.width, height = rect.height;
      if (options.context().week) {
        var day = root.querySelector('.scheduler-week-day[data-scheduler-date="' + job.startDate + '"]');
        var range = tools.dayInterval(job);
        if (day && range && !job.allDay) {
          var dayBox = day.getBoundingClientRect();
          var jobs = options.calendarJobs().map(function (entry) { return entry.id === g.job.id ? Object.assign({}, entry, job) : entry; });
          var segment = tools.daySegments(jobs, job.startDate).find(function (entry) { return entry.job.id === g.job.id; });
          var lanes = segment ? segment.lanes : 1, lane = segment ? segment.lane : 0;
          left = dayBox.left + dayBox.width * lane / lanes + 6 / lanes + 2;
          width = dayBox.width / lanes - 12 / lanes - 4;
          top = dayBox.top + tools.pixelAtMinute(options.layout(), range.start) + 2;
          height = Math.max(1, tools.pixelAtMinute(options.layout(), range.end) - tools.pixelAtMinute(options.layout(), range.start) - 4);
        } else {
          var cells = Array.from(root.querySelectorAll(".scheduler-all-day-hit")).filter(function (node) { return node.dataset.schedulerHitDate >= dates.startDate && node.dataset.schedulerHitDate <= dates.endDate; });
          if (cells.length) { var a = cells[0].getBoundingClientRect(), b = cells[cells.length - 1].getBoundingClientRect(); left = a.left + 4; width = b.right - a.left - 8; top = a.top; height = 32; }
        }
      } else if (g.kind.indexOf("date-") === 0) {
        var cells = Array.from(root.querySelectorAll(".scheduler-month-day")).filter(function (node) { return node.dataset.schedulerHitDate >= dates.startDate && node.dataset.schedulerHitDate <= dates.endDate; });
        if (cells.length && cells[0].parentElement === cells[cells.length - 1].parentElement) {
          var a = cells[0].getBoundingClientRect(), b = cells[cells.length - 1].getBoundingClientRect(); left = a.left + 4; width = b.right - a.left - 8; top = a.top + 32;
        }
      }
      Object.assign(g.ghost.style, { left: left + "px", top: top + "px", width: Math.max(44, width) + "px", height: height + "px" });
      g.ghost.textContent = (g.job.title || "Job") + " · " + dates.startDate + (dates.endDate !== dates.startDate ? " – " + dates.endDate : "") + " · " + (job.allDay ? "All day" : job.startTime + "–" + job.endTime);
      fadeSources();
    }
    function updateGesture(days, minutes) {
      var g = gesture; if (!g) return;
      if (g.kind.indexOf("date-") === 0) {
        g.proposed = tools.resizeDates(g.job, g.kind, days);
        g.needsConversion = !g.job.allDay && (g.proposed.startDate !== g.proposed.endDate || !tools.dayInterval(g.job));
        if (!g.needsConversion && !g.job.allDay) g.proposed = Object.assign({}, g.proposed, { allDay: false, startTime: g.job.startTime, endTime: g.job.endTime });
      } else {
        var range = tools.dayInterval(g.job);
        if (range && options.context().week) {
          var changed = tools.adjustInterval(range, g.kind, minutes);
          if (g.kind === "move") changed.date = tools.shiftDate(range.date, days);
          g.proposed = tools.intervalPatch(changed);
        } else g.proposed = tools.shiftSchedule(g.job, days);
      }
      if (!g.needsConversion) writeSchedule(g.proposed);
      paintGhost();
    }
    function paintGesture() {
      var g = gesture; if (!g || !g.moved || g.keyboard) return;
      var hit = hitDate(g.clientX, g.clientY); if (!hit) return;
      var days = tools.dateDistance(g.startHit.date, hit.date);
      var minutes = options.context().week && g.kind.indexOf("date-") !== 0 ? timeAt(g.clientY, hit.date) - g.startMinute : 0;
      if (g.kind === "start" || g.kind === "end") days = 0;
      updateGesture(days, minutes);
    }
    function autoScroll() {
      var g = gesture; if (!g || g.keyboard) return;
      var now = host.performance.now(), scroller = root.querySelector(".program-calendar-scroll"), rect = scroller.getBoundingClientRect();
      var edge = g.clientX < rect.left + 32 ? -1 : g.clientX > rect.right - 32 ? 1 : 0;
      if (g.moved) {
        var top = rect.top + (root.querySelector(".scheduler-week-head")?.getBoundingClientRect().height || 0);
        if (g.clientY < top + 28) scroller.scrollTop -= 10;
        else if (g.clientY > rect.bottom - 28) scroller.scrollTop += 10;
        var previousLeft = scroller.scrollLeft;
        if (edge) scroller.scrollLeft += edge * 12;
        // Reserved scrollbar gutters can make scrollWidth overstate the reachable edge.
        if (edge && Math.abs(scroller.scrollLeft - previousLeft) > .5) {
          g.edge = 0; g.edgeSince = now;
        } else if (edge && g.kind !== "start" && g.kind !== "end") {
          if (g.edge !== edge) { g.edge = edge; g.edgeSince = now; }
          if (now - g.edgeSince >= (g.paged ? 750 : 600)) {
            paging = true;
            try { options.pagePeriod(edge); } finally { paging = false; }
            g.edgeSince = now; g.paged = true;
          }
        } else { g.edge = 0; g.edgeSince = now; g.paged = false; }
        paintGesture();
      }
      g.frame = host.requestAnimationFrame(autoScroll);
    }
    function cleanGesture(g) {
      host.cancelAnimationFrame(g.frame); g.ghost.remove();
      if (g.pointerId != null && root.hasPointerCapture(g.pointerId)) root.releasePointerCapture(g.pointerId);
      root.querySelectorAll(".is-drag-source,.is-date-preview").forEach(function (node) { node.classList.remove("is-drag-source", "is-date-preview"); });
      clearControls();
    }
    function restoreGesture(g) {
      restore(g.before); var entry = remember(); if (entry) entry.touched = g.touched;
      options.finishPeriod(false); announce("Calendar gesture cancelled.");
    }
    function focusControl(kind) {
      enhance(); var control = controls.find(function (node) { return node.dataset.weekHandle === kind; });
      if (control && !control.hidden) control.focus({ preventScroll: true });
    }
    async function finishGesture(cancel, repaint) {
      if (!gesture) return;
      var g = gesture; gesture = null; suppressClick = true; cleanGesture(g);
      if (cancel || !g.moved) {
        restoreGesture(g); if (repaint !== false) { options.repaint(); focusControl(g.kind); } return;
      }
      if (g.needsConversion) {
        pending = g;
        var accepted = await UOS.dialogs.open({
          title: "Convert to all-day job?", modalClass: "scheduler-all-day-confirm",
          message: (g.job.title || "This job") + " will become an all-day job from " + g.proposed.startDate + " to " + g.proposed.endDate + ". The current hours will be removed. Use Save schedule to save this change.",
          actions: [{ label: "Cancel", value: false }, { label: "Convert to all day", value: true }]
        });
        if (pending !== g) return;
        pending = null;
        if (accepted && options.context().jobId === g.job.id) {
          writeSchedule(g.proposed); options.finishPeriod(true);
        } else restoreGesture(g);
      } else options.finishPeriod(true);
      if (repaint !== false) { options.repaint(); focusControl(g.kind); }
    }
    function beginGesture(target, event, keyboard) {
      if (!eligible() || pending) return;
      if (frame) { host.cancelAnimationFrame(frame); frame = 0; }
      var job = currentJob(), nodes = jobCards(); if (!job || !nodes.length) return;
      var kind = target.dataset.weekHandle, source = kind === "date-end" || kind === "end" ? nodes[nodes.length - 1] : nodes[0];
      var rect = source.getBoundingClientRect(), x = keyboard ? rect.left + rect.width / 2 : event.clientX, y = keyboard ? rect.top + rect.height / 2 : event.clientY;
      var hit = hitDate(x, y); if (!hit) return;
      var ghost = document.createElement("div"); ghost.className = "scheduler-week-drag-ghost scheduler-date-drag-ghost"; ghost.setAttribute("aria-hidden", "true");
      document.body.appendChild(ghost); remember();
      gesture = { job: job, kind: kind, before: values(), touched: active()?.touched, proposed: tools.shiftSchedule(job, 0),
        pointerId: keyboard ? null : event.pointerId, keyboard: keyboard, days: 0, minutes: 0, startHit: hit,
        startMinute: timeAt(y, hit.date), sourceRect: rect, grabY: y - rect.top, clientX: x, clientY: y, startX: x, startY: y,
        moved: false, ghost: ghost, frame: 0, edge: 0, edgeSince: host.performance.now() };
      controls.forEach(function (node) { node.style.opacity = "0"; node.style.pointerEvents = "none"; });
      paintGhost(); if (!keyboard) { root.setPointerCapture(event.pointerId); autoScroll(); }
      announce("Job picked up. Arrows adjust, Enter drops, Escape cancels.");
    }
    document.addEventListener("pointerdown", function (event) {
      var target = event.target.closest('[data-scheduler-gesture-owner="' + ownerKey + '"]');
      if (!target) { suppressClick = false; return; }
      if (!eligible() || event.button !== 0) return;
      event.preventDefault(); event.stopImmediatePropagation(); beginGesture(target, event, false);
    }, true);
    root.addEventListener("pointermove", function (event) {
      var g = gesture; if (!g || g.keyboard || event.pointerId !== g.pointerId) return;
      event.preventDefault(); g.clientX = event.clientX; g.clientY = event.clientY;
      if (Math.hypot(g.clientX - g.startX, g.clientY - g.startY) >= 3) g.moved = true;
      paintGesture();
    });
    root.addEventListener("pointerup", function (event) {
      if (gesture && !gesture.keyboard && event.pointerId === gesture.pointerId) { event.preventDefault(); finishGesture(false); }
    });
    ["pointercancel", "lostpointercapture"].forEach(function (name) { root.addEventListener(name, function (event) {
      if (gesture && !gesture.keyboard && gesture.pointerId === event.pointerId) finishGesture(true);
    }); });
    host.addEventListener("blur", function () { finishGesture(true); });
    host.addEventListener("keydown", function (event) {
      if (gesture && ["Escape", "Enter", " "].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation(); finishGesture(event.key === "Escape"); return;
      }
      if (gesture && gesture.keyboard && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        var g = gesture, horizontal = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (g.kind.indexOf("date-") === 0) g.days += horizontal || (event.key === "ArrowUp" ? -7 : 7);
        else if (options.context().week) { if (g.kind === "move") g.days += horizontal; g.minutes += event.key === "ArrowUp" ? -30 : event.key === "ArrowDown" ? 30 : 0; }
        else g.days += horizontal || (event.key === "ArrowUp" ? -7 : 7);
        g.moved = true; updateGesture(g.days, g.minutes);
        var dates = Array.from(root.querySelectorAll("[data-scheduler-hit-date]")).map(function (node) { return node.dataset.schedulerHitDate; }).sort();
        var aim = g.kind === "date-end" ? tools.occupiedDates(g.proposed).endDate : g.proposed.startDate;
        if (aim < dates[0] || aim > dates[dates.length - 1]) {
          paging = true; try { options.pagePeriod(aim < dates[0] ? -1 : 1); } finally { paging = false; } paintGhost();
        }
        return;
      }
      var target = event.target.closest('[data-scheduler-gesture-owner="' + ownerKey + '"]');
      if (target && eligible()) {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopImmediatePropagation(); beginGesture(target, event, true); return; }
        if (["ArrowUp","ArrowDown"].includes(event.key) && options.context().week && ["start","end","move"].includes(target.dataset.weekHandle)) {
          event.preventDefault(); event.stopImmediatePropagation();
          var range = tools.dayInterval(currentJob()), kind = target.dataset.weekHandle;
          if (range && writeInterval(tools.adjustInterval(range, kind, event.key === "ArrowUp" ? -30 : 30))) options.repaint();
          focusControl(kind); return;
        }
      }
      if (event.key === "Escape" && form()?.getClientRects().length && !pending && !document.querySelector("dialog[open],.uos-modal-backdrop")) {
        event.preventDefault(); event.stopImmediatePropagation(); options.closeEditor();
      }
    }, true);
    document.addEventListener("click", function (event) {
      if (event.target.closest('[data-scheduler-gesture-owner="' + ownerKey + '"]')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    root.addEventListener("click", function (event) {
      if (event.target.closest("[data-scheduler-discard]")) {
        event.preventDefault(); drafts.delete(options.context().jobId); options.discard(); options.repaint(); return;
      }
      var day = event.target.closest(".scheduler-week-day");
      if (suppressClick) { suppressClick = false; if (event.target.closest(".program-calendar")) { event.preventDefault(); event.stopPropagation(); return; } }
      if (!day || !eligible() || pending) return;
      var jobCard = event.target.closest(".scheduler-week-job");
      if (jobCard && options.context().job._unscheduled && !tools.dayInterval(currentJob()) && jobCard.dataset.schedulerJob !== options.context().jobId) {
        event.preventDefault(); event.stopPropagation(); place(day.dataset.schedulerDate, timeAt(event.clientY, day.dataset.schedulerDate)); return;
      }
      if (!event.target.closest("[data-scheduler-job],button,a,input,select,textarea")) place(day.dataset.schedulerDate, timeAt(event.clientY, day.dataset.schedulerDate));
    });
    root.addEventListener("keydown", function (event) {
      var day = event.target.closest(".scheduler-week-day");
      if (!day || event.target !== day || !eligible() || !["ArrowUp","ArrowDown","Enter"," "].includes(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === "Enter" || event.key === " ") { place(day.dataset.schedulerDate, focusMinute); return; }
      focusMinute = Math.max(0, Math.min(1410, focusMinute + (event.key === "ArrowUp" ? -30 : 30)));
      var row = options.layout().rows[focusMinute / 30]; day.style.setProperty("--scheduler-focused-top", row.top + "px"); day.style.setProperty("--scheduler-focused-height", row.height + "px");
      announce(day.dataset.schedulerDate + " " + tools.intervalPatch(tools.slotInterval(day.dataset.schedulerDate, focusMinute)).startTime);
    }, true);
    root.addEventListener("input", changed); root.addEventListener("change", changed);
    document.addEventListener("scroll", function () { if (!gesture && !pending) enhance(); }, true);
    host.addEventListener("resize", function () { if (!gesture && !pending) enhance(); });
    if (host.ResizeObserver) new host.ResizeObserver(function () {
      if (!root.getClientRects().length) {
        if (gesture) finishGesture(true, false);
        if (pending) { pending = null; var modal = document.querySelector('.scheduler-all-day-confirm')?.closest('.uos-modal-backdrop'); if (modal) UOS.dialogs.close(modal, false); options.finishPeriod(false); }
        clearControls();
      } else if (!gesture && !pending) enhance();
    }).observe(root);
    return {
      retainDraft: function () { remember(); if (gesture) finishGesture(true, false); clearControls(); },
      sync: sync, enhance: enhance, previewJobs: previewJobs,
      canLeave: function () { if (pending) return false; if (gesture) finishGesture(true, false); var entry = remember(); if (entry && !dirty(entry)) drafts.delete(options.context().jobId); return true; },
      beforeRender: function () { if (paging) return; if (pending && options.context().jobId !== pending.job.id) { pending = null; var modal = document.querySelector('.scheduler-all-day-confirm')?.closest('.uos-modal-backdrop'); if (modal) UOS.dialogs.close(modal, false); options.finishPeriod(false); } if (gesture) finishGesture(true, false); },
      isSaving: function () { return saving || Boolean(pending); },
      beginSave: function () {
        if (gesture || pending) throw new Error("Finish the calendar gesture first.");
        var entry = remember(); if (dirty(entry) && entry.fingerprint !== fingerprint(options.context().job)) throw new Error("This job changed while editing. Discard the draft and try again.");
        if (entry?.touched) tools.validate(patch(entry.values)); saving = true;
        var submit = form()?.querySelector('[type="submit"]'); if (submit) submit.disabled = true; enhance();
      },
      endSave: function (success) {
        saving = false; if (success) { drafts.delete(options.context().jobId); options.discard(); options.repaint(); } else remember();
        var submit = form()?.querySelector('[type="submit"]'); if (submit) submit.disabled = false; enhance();
      }
    };
  }
  UOS.SchedulerWeekEditor = { create: create };
}(window));
