(function (root) {
  "use strict";

  var UOS = root.UOS = root.UOS || {};
  var documentNode = root.document;
  var CARD_SELECTOR = [
    ".program-register-row",
    "tr[data-register-record]",
    ".program-event-card[data-event-card-id]",
    ".program-shape-card[data-shape-card-id]",
    ".program-event-card[data-planner-project-id]",
    ".program-costing-project-card[data-costing-project-id]",
    ".program-scheduler-project-card[data-scheduler-project]",
    ".program-scheduler-row[data-scheduler-job]",
    ".program-calendar-job[data-scheduler-job]",
    ".program-quote-project-card[data-quote-project-id]",
    ".program-quote-builder-table tbody tr",
    ".program-payment-ledger__table tbody tr"
  ].join(",");
  var SCROLLER_SELECTOR = [
    ".program-scroll-region",
    ".program-map-event-list",
    ".program-map-shape-list",
    ".program-table-wrap",
    "[data-costing-projects-list]",
    "[data-scheduler-list]",
    ".program-calendar-scroll",
    ".program-quote-pane-body"
  ].join(",");
  var IDENTITY_ATTRIBUTES = [
    "data-register-record",
    "data-event-card-id",
    "data-shape-card-id",
    "data-planner-project-id",
    "data-costing-project-id",
    "data-scheduler-project",
    "data-scheduler-job",
    "data-quote-project-id"
  ];

  function nearestScroller(card) {
    if (!card || typeof card.closest !== "function") return null;
    var explicit = card.closest(SCROLLER_SELECTOR);
    if (explicit) return explicit;
    var parent = card.parentElement;
    while (parent && parent !== documentNode.body && parent !== documentNode.documentElement) {
      var style = typeof root.getComputedStyle === "function" ? root.getComputedStyle(parent) : null;
      var overflowY = style && style.overflowY || "";
      if (/(auto|scroll)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
      parent = parent.parentElement;
    }
    return null;
  }

  function isFirstInScroller(card, scroller) {
    if (!card) return false;
    // Quote editor rows are fields within a document, not a list to reset.
    if (card.matches && card.matches(".program-quote-builder-table tbody tr")) return false;
    if (card.previousElementSibling === null) return true;
    if (card.previousElementSibling && card.previousElementSibling.classList && card.previousElementSibling.classList.contains("program-virtual-spacer") && !card.previousElementSibling.previousElementSibling) return true;
    if (scroller && typeof scroller.querySelector === "function") {
      var firstCard = scroller.querySelector(CARD_SELECTOR);
      if (firstCard === card) return true;
      var firstTr = scroller.querySelector("tbody tr:not(.program-virtual-spacer)");
      if (firstTr === card) return true;
    }
    var parent = card.parentElement;
    if (parent && (parent.tagName === "TBODY" || (parent.classList && parent.classList.contains("program-table-wrap"))) && parent.previousElementSibling === null) return true;
    return false;
  }

  function ensureVisible(card, options) {
    if (!card || card.isConnected === false || typeof card.getBoundingClientRect !== "function") return false;
    var scroller = options && options.scroller || nearestScroller(card);
    if (!scroller || typeof scroller.getBoundingClientRect !== "function") return false;

    if (isFirstInScroller(card, scroller)) {
      var current = scroller;
      var moved = false;
      while (current) {
        if (current.scrollTop > 0 || current.scrollLeft > 0) {
          if (typeof current.scrollTo === "function") {
            current.scrollTo({ top: 0, left: 0, behavior: "auto" });
          } else {
            current.scrollTop = 0;
            current.scrollLeft = 0;
          }
          moved = true;
        }
        current = nearestScroller(current.parentElement);
      }
      if (moved) return true;
    }

    var cardRect = card.getBoundingClientRect();
    var scrollerRect = scroller.getBoundingClientRect();
    var hasPadding = options && Object.prototype.hasOwnProperty.call(options, "padding");
    var padding = hasPadding ? Math.max(0, Number(options.padding) || 0) : 12;
    var alignTop = Boolean(options && options.alignTop);

    // Calculate header height (e.g. thead in tables or sticky headers) inside scroller
    var headerHeight = 0;
    if (scroller && typeof scroller.querySelector === "function") {
      var isRegisterRow = card.matches && card.matches("tr[data-register-record]");
      var headerEl = isRegisterRow
        ? scroller.querySelector(".program-register-table thead th")
        : scroller.querySelector("thead, .program-disclosure-list__header, .program-table-head, .program-register-head, .planner-nav-header, .program-calendar__weekday");
      if (headerEl && typeof headerEl.getBoundingClientRect === "function") {
        var headerRect = headerEl.getBoundingClientRect();
        if (headerRect.height > 0 && headerRect.bottom > scrollerRect.top) {
          headerHeight = Math.max(0, headerRect.bottom - scrollerRect.top);
        }
      }
    }

    var viewportTop = scrollerRect.top + headerHeight + padding;
    var viewportBottom = scrollerRect.bottom - padding;
    var delta = 0;

    if (alignTop) delta = cardRect.top - viewportTop;
    else if (cardRect.height >= Math.max(0, viewportBottom - viewportTop)) delta = cardRect.top - viewportTop;
    else if (cardRect.top < viewportTop) delta = cardRect.top - viewportTop;
    else if (cardRect.bottom > viewportBottom) delta = cardRect.bottom - viewportBottom;
    if (!delta) return false;

    var nextTop = Math.max(0, scroller.scrollTop + delta);
    if (typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: nextTop, behavior: "auto" });
    } else {
      scroller.scrollTop = nextTop;
    }
    return true;
  }

  function cardIdentity(card) {
    if (!card || typeof card.getAttribute !== "function") return null;
    for (var i = 0; i < IDENTITY_ATTRIBUTES.length; i += 1) {
      var attribute = IDENTITY_ATTRIBUTES[i];
      var value = card.getAttribute(attribute);
      if (value) return { attribute: attribute, value: value };
    }
    return null;
  }

  function escapeSelector(value) {
    if (root.CSS && typeof root.CSS.escape === "function") return root.CSS.escape(value);
    return String(value).replace(/(["\\])/g, "\\$1");
  }

  function schedule(card) {
    if (!card) return;
    var identity = cardIdentity(card);
    var view = typeof card.closest === "function" ? card.closest("[data-program-view]") : null;
    var run = function () {
      var target = card.isConnected === false ? null : card;
      if ((!target || (typeof target.matches === "function" && !target.matches(CARD_SELECTOR))) && identity) {
        var selector = "[" + identity.attribute + "=\"" + escapeSelector(identity.value) + "\"]";
        target = view && view.isConnected !== false ? view.querySelector(selector) : documentNode.querySelector(selector);
      }
      if (target) {
        var visibilityOptions = null;
        var disclosureApi = UOS.ProgramDisclosureRows;
        var activeDisclosureKey = disclosureApi && typeof disclosureApi.activeKey === "function" ? disclosureApi.activeKey() : "";
        var targetKey = target.getAttribute && target.getAttribute("data-disclosure-key");
        if (target.matches && target.matches("tr[data-register-record]") && activeDisclosureKey && targetKey === activeDisclosureKey) {
          visibilityOptions = { padding: 0, alignTop: true };
        }
        ensureVisible(target, visibilityOptions);
      }
    };
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(run);
    else root.setTimeout(run, 0);
  }

  function focusedCard(target) {
    if (!target || typeof target.closest !== "function") return null;
    // Native focus handles document fields; list alignment would move the editor.
    if (target.closest(".program-quote-builder-table")) return null;
    return target.closest(CARD_SELECTOR) || target.closest(".is-selected, [data-register-record], [data-event-card-id], [data-shape-card-id], [data-planner-project-id], [data-costing-project-id], [data-scheduler-project], [data-scheduler-job]");
  }

  function syncActiveViewSelection() {
    if (!documentNode || typeof documentNode.querySelectorAll !== "function") return;
    var activeView = documentNode.querySelector("[data-program-view]:not([hidden])");
    if (!activeView) return;

    var selectedCards = activeView.querySelectorAll(CARD_SELECTOR);
    var disclosureApi = UOS.ProgramDisclosureRows;
    var activeDisclosureKey = disclosureApi && typeof disclosureApi.activeKey === "function" ? disclosureApi.activeKey() : "";
    var preferredCard = null;
    var fallbackCard = null;
    Array.prototype.forEach.call(selectedCards, function (card) {
      var selected = card.classList.contains("is-selected") || card.getAttribute("aria-selected") === "true";
      var rendered = typeof card.getClientRects !== "function" || card.getClientRects().length > 0;
      if (!selected || !rendered) return;
      if (!fallbackCard) fallbackCard = card;
      if (activeDisclosureKey && card.getAttribute("data-disclosure-key") === activeDisclosureKey) preferredCard = card;
    });
    schedule(preferredCard || fallbackCard);
  }

  function scheduleSyncActiveViewSelection() {
    syncActiveViewSelection();
    if (typeof root.requestAnimationFrame === "function") {
      root.requestAnimationFrame(function () {
        syncActiveViewSelection();
        if (typeof root.setTimeout === "function") {
          root.setTimeout(syncActiveViewSelection, 50);
        }
      });
    } else if (typeof root.setTimeout === "function") {
      root.setTimeout(syncActiveViewSelection, 0);
    }
  }

  var lastProgramReadyFocusSignature = "";

  function programReadyFocusSignature(event) {
    var workspace = event && event.detail && event.detail.workspace;
    var ui = workspace && workspace.workspace || {};
    var planner = ui.planner || {};
    var costing = ui.costing || {};
    var scheduler = ui.scheduler || {};
    var map = ui.map || {};
    return [
      ui.destination || "",
      ui.ownerMode || "",
      ui.selectedEntityId || "",
      ui.selectedProjectId || "",
      ui.selectedJobId || "",
      planner.selectedProjectId || "",
      costing.selectedProjectId || "",
      costing.jobId || "",
      scheduler.panelMode || "",
      scheduler.selectedProjectId || "",
      scheduler.selectedId || "",
      scheduler.detail === true ? "detail" : "list",
      map.scopeMode || "",
      map.selectedProjectId || ""
    ].join("|");
  }

  function syncProgramReadySelection(event) {
    var signature = programReadyFocusSignature(event);
    if (signature === lastProgramReadyFocusSignature) return;
    lastProgramReadyFocusSignature = signature;
    scheduleSyncActiveViewSelection();
  }

  UOS.ProgramCardVisibility = {
    cardSelector: CARD_SELECTOR,
    ensureVisible: ensureVisible,
    nearestScroller: nearestScroller,
    schedule: schedule,
    syncActiveViewSelection: syncActiveViewSelection,
    scheduleSyncActiveViewSelection: scheduleSyncActiveViewSelection
  };

  if (documentNode && typeof documentNode.addEventListener === "function") {
    documentNode.addEventListener("uos:program-ready", syncProgramReadySelection);
    documentNode.addEventListener("focusin", function (event) { schedule(focusedCard(event.target)); });
    documentNode.addEventListener("click", function (event) { schedule(focusedCard(event.target)); }, true);
    documentNode.addEventListener("uos:disclosure-motion-end", function (event) {
      var detail = event.detail || {};
      var drawer = detail.drawer;
      if (detail.expanded && drawer && typeof drawer.closest === "function") schedule(drawer.closest("[data-disclosure-row]"));
    });
    documentNode.addEventListener("visibilitychange", function () {
      if (documentNode.visibilityState === "visible") scheduleSyncActiveViewSelection();
    });
  }
  if (root && typeof root.addEventListener === "function") {
    root.addEventListener("focus", scheduleSyncActiveViewSelection);
  }
}(window));
