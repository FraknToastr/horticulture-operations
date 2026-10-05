(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var activeKeys = Object.create(null);
  var lastActiveScope = "";
  var lastDestination = "";
var observer = null;
var DRAWER_MOTION_DURATION = 220;
var DRAWER_MOTION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
var afterOpenWork = Object.create(null);

  var CARD_CONFIGS = [
    {
      selector: "#eventPickerList > [data-event-card-id]",
      attribute: "data-event-card-id",
      prefix: "map-record",
      scope: "map",
      title: [".program-event-card__head h5"],
      metric: [".program-event-card__action-row .program-card-pill", ".program-card-pill"],
      metricFormat: "count-or-dash",
      metricHeadingAttribute: "data-disclosure-metric-heading",
      headings: ["Record / Project", "Location"]
    },
    {
      selector: "#shapeList > [data-shape-card-id]",
      attribute: "data-shape-card-id",
      prefix: "map-polygon",
      scope: "map",
      title: [".program-shape-card__toggle span"],
      metric: [".program-shape-card__measure"],
      status: [".program-create-job-btn span"],
      headings: ["Polygon / Work type", "Measurement", "Job"]
    },
    {
      selector: "#plannerPickerList > [data-planner-project-id]",
      attribute: "data-planner-project-id",
      prefix: "planner-project",
      scope: "planner",
      title: [".program-event-card__head h5"],
      metric: [".planner-card-progress span:last-child"],
      status: [".program-status-pill"],
      headings: ["Project", "Checklist", "Status"]
    },
    {
      selector: "[data-costing-projects-list] > [data-costing-project-id]",
      attribute: "data-costing-project-id",
      prefix: "costing-project",
      scope: "costing",
      title: [".program-costing-project-card__title"],
      metric: [".program-costing-project-card__meta .program-card-pill"],
      metricFormat: "count-or-dash",
      status: [".program-status-pill"],
      headings: ["Project", "Line items", "Status"]
    },
    {
      selector: "[data-scheduler-list] > [data-scheduler-project]",
      attribute: "data-scheduler-project",
      prefix: "scheduler-project",
      scope: "scheduler",
      title: [".program-scheduler-project-card__title"],
      metric: [".program-scheduler-project-card__action"],
      metricFormat: "count-or-dash",
      status: [".program-status-pill"],
      headings: ["Project", "Jobs", "Status"]
    },
    {
      selector: "[data-scheduler-list] > [data-scheduler-job]",
      attribute: "data-scheduler-job",
      prefix: "scheduler-job",
      scope: "scheduler",
      title: [".program-scheduler-job-card__title"],
      metric: [".program-scheduler-job-card__time-text"],
      status: [".program-status-pill"],
      headings: ["Job", "Schedule", "Status"],
      openAction: "Edit schedule"
    },
    {
      selector: "[data-quote-projects-list] > [data-quote-project-id]",
      attribute: "data-quote-project-id",
      prefix: "quote-project",
      scope: "quotes",
      title: [".program-quote-project-card__title"],
      metric: [".program-quote-project-card__meta .program-card-pill"],
      status: [".program-status-pill"],
      headings: ["Project", "Latest quote", "Status"]
    }
  ];

  function text(value) {
    return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
  }

  function scopeForKey(key) {
    var value = text(key);
    if (value.indexOf("register:") === 0) return "register";
    if (value.indexOf("map-") === 0) return "map";
    if (value.indexOf("planner-") === 0) return "planner";
    if (value.indexOf("costing-") === 0) return "costing";
    if (value.indexOf("scheduler-") === 0) return "scheduler";
    if (value.indexOf("quote-") === 0) return "quotes";
    return "default";
  }

  function disclosureScope(node, key) {
    var explicit = node && node.getAttribute ? text(node.getAttribute("data-disclosure-scope")) : "";
    return explicit || scopeForKey(key);
  }

  function activeKeyForScope(scope) {
    return activeKeys[text(scope) || "default"] || "";
  }

  function isKeyActive(key, scope) {
    var targetKey = text(key);
    if (!targetKey) return false;
    var targetScope = text(scope) || scopeForKey(targetKey);
    return activeKeyForScope(targetScope) === targetKey;
  }

  function activeScopes() {
    return Object.keys(activeKeys).filter(function (scope) { return Boolean(activeKeys[scope]); });
  }

  var INNER_SCOPES = ["map", "planner", "costing", "scheduler", "quotes", "default"];

  function clearScopesWithoutSync(scopes) {
    var closed = [];
    (scopes || []).forEach(function (scope) {
      var key = activeKeyForScope(scope);
      if (!key) return;
      delete afterOpenWork[key];
      delete activeKeys[scope];
      closed.push({ scope: scope, key: key });
    });
    if (lastActiveScope && !activeKeyForScope(lastActiveScope)) lastActiveScope = "";
    return closed;
  }

  function safeId(value) {
    return text(value).replace(/[^a-zA-Z0-9_-]+/g, "-");
  }

  function formatMetric(value, format) {
    if (format !== "count-or-dash") return value;
    var match = text(value).match(/\d+/);
    var count = match ? Number(match[0]) : 0;
    return count > 0 ? String(count) : "-";
  }

  function firstNode(root, selectors) {
    for (var index = 0; index < selectors.length; index += 1) {
      var node = root.querySelector(selectors[index]);
      if (node && text(node.textContent)) return node;
    }
    return null;
  }

  function setRowState(row, expanded) {
    if (!row) return;
    row.classList.toggle("is-disclosure-open", expanded);
    row.setAttribute("data-disclosure-state", expanded ? "open" : "closed");
  }

  function prefersReducedMotion() {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function drawerMotionTarget(drawer) {
    if (drawer && drawer.tagName === "TR") return drawer.querySelector(".program-register-drawer") || drawer;
    return drawer;
  }

function emitDrawerMotionEnd(drawer, expanded) {
 document.dispatchEvent(new CustomEvent("uos:disclosure-motion-end", {
      detail: { key: drawer.getAttribute("data-disclosure-key") || "", drawer: drawer, expanded: expanded }
    }));
}

function emitDrawerMotionStart(drawer, expanded) {
  document.dispatchEvent(new CustomEvent("uos:disclosure-motion-start", {
    detail: {
      key: drawer.getAttribute("data-disclosure-key") || "",
      drawer: drawer,
      expanded: expanded,
      motion: drawer.getAttribute("data-disclosure-motion") || (drawer.tagName === "TR" ? "register" : "mini"),
      duration: DRAWER_MOTION_DURATION,
      easing: DRAWER_MOTION_EASING
    }
  }));
}

function flushAfterOpenWork(key) {
  var callbacks = afterOpenWork[key] || [];
  delete afterOpenWork[key];
  callbacks.forEach(function (callback) { callback(); });
}

function finishDrawerMotion(drawer, target, expanded) {
    drawer.classList.remove("is-disclosure-closing");
    target.style.removeProperty("height");
    target.style.removeProperty("overflow");
    target.style.removeProperty("opacity");
    target.style.removeProperty("transform");
    drawer.hidden = !expanded;
  drawer._uosDisclosureAnimation = null;
  emitDrawerMotionEnd(drawer, expanded);
  var drawerKey = drawer.getAttribute("data-disclosure-key") || "";
  var drawerScope = disclosureScope(drawer, drawerKey);
  if (expanded && isKeyActive(drawerKey, drawerScope)) {
    flushAfterOpenWork(drawerKey);
  }
}

function cancelDrawerMotion(drawer, target) {
  var animation = drawer && drawer._uosDisclosureAnimation;
  if (animation) {
    drawer._uosDisclosureAnimation = null;
    animation.onfinish = null;
    animation.oncancel = null;
    animation.cancel();
  }
  drawer.classList.remove("is-disclosure-closing");
  target.style.removeProperty("height");
  target.style.removeProperty("overflow");
  target.style.removeProperty("opacity");
  target.style.removeProperty("transform");
}

function setDrawerState(drawer, expanded, animateMotion) {
  if (!drawer) return;
  var wasExpanded = drawer.getAttribute("aria-hidden") === "false";
  var target = drawerMotionTarget(drawer);
    drawer.setAttribute("aria-hidden", expanded ? "false" : "true");

    /* Mutation-driven enhancement can sync the same state several times while
       content is being rebuilt. Preserve the live animation in that case. */
    if (wasExpanded === expanded) {
      if (!drawer._uosDisclosureAnimation) drawer.hidden = !expanded;
      return;
    }

  cancelDrawerMotion(drawer, target);

  /* DOM enhancement and workspace rerenders synchronise state without motion.
     Only an explicit user/API open or close is allowed to start animation. */
  if (!animateMotion) {
    drawer.hidden = !expanded;
    return;
  }

    if (prefersReducedMotion() || typeof target.animate !== "function") {
      drawer.hidden = !expanded;
      emitDrawerMotionEnd(drawer, expanded);
      return;
    }

  drawer.hidden = false;
  if (!expanded) drawer.classList.add("is-disclosure-closing");

    var startHeight = expanded ? 0 : target.getBoundingClientRect().height;
    var endHeight = expanded ? target.scrollHeight : 0;
    target._uosDisclosureSampledEndHeight = endHeight;
    target.style.height = startHeight + "px";
    target.style.overflow = "hidden";

  var animation = target.animate([
      {
        height: startHeight + "px",
        opacity: expanded ? 0 : 1,
        transform: expanded ? "translateY(-4px)" : "translateY(0)"
      },
      {
        height: endHeight + "px",
        opacity: expanded ? 1 : 0,
        transform: expanded ? "translateY(0)" : "translateY(-3px)"
      }
    ], {
      duration: DRAWER_MOTION_DURATION,
      easing: DRAWER_MOTION_EASING,
      fill: "both"
  });
  drawer._uosDisclosureAnimation = animation;
  emitDrawerMotionStart(drawer, expanded);
  animation.onfinish = function () { finishDrawerMotion(drawer, target, expanded); };
}

function syncAll(animateMotion) {
    var foundByScope = Object.create(null);
    Array.prototype.forEach.call(document.querySelectorAll("[data-disclosure-toggle]"), function (toggle) {
      var key = toggle.getAttribute("data-disclosure-key") || "";
      var scope = disclosureScope(toggle, key);
      var expanded = Boolean(key && isKeyActive(key, scope));
      if (expanded) foundByScope[scope] = true;
      toggle.setAttribute("data-disclosure-scope", scope);
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      var row = toggle.closest("[data-disclosure-row]");
      if (row) row.setAttribute("data-disclosure-scope", scope);
      setRowState(row, expanded);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-disclosure-drawer]"), function (drawer) {
      var key = drawer.getAttribute("data-disclosure-key") || "";
      var scope = disclosureScope(drawer, key);
      var expanded = Boolean(key && isKeyActive(key, scope));
      drawer.setAttribute("data-disclosure-scope", scope);
      setDrawerState(drawer, expanded, animateMotion === true);
    });
    /* Incremental DOM enhancement must not retire an unrelated parent scope.
       Only explicit motion sync can clear a missing active key, and then only
       within the scope whose row has actually disappeared. */
    if (animateMotion === true) {
      activeScopes().forEach(function (scope) {
        if (!foundByScope[scope]) delete activeKeys[scope];
      });
    }
  }

  function emit(name, key) {
    var drawer = null;
    Array.prototype.some.call(document.querySelectorAll("[data-disclosure-drawer]"), function (candidate) {
      if (candidate.getAttribute("data-disclosure-key") === key) {
        drawer = candidate;
        return true;
      }
      return false;
    });
    document.dispatchEvent(new CustomEvent(name, { detail: { key: key, drawer: drawer } }));
  }

function open(key, scopeOverride) {
    var nextKey = text(key);
    if (!nextKey) return;
    var scope = text(scopeOverride) || scopeForKey(nextKey);
    var previousKey = activeKeyForScope(scope);
    var closedChildren = [];
    if (scope === "register" && previousKey && previousKey !== nextKey) {
      closedChildren = clearScopesWithoutSync(INNER_SCOPES);
    }
    emit("uos:disclosure-before-open", nextKey);
    if (previousKey && previousKey !== nextKey) delete afterOpenWork[previousKey];
    activeKeys[scope] = nextKey;
    lastActiveScope = scope;
    syncAll(true);
    if (previousKey && previousKey !== nextKey) emit("uos:disclosure-close", previousKey);
    closedChildren.forEach(function (entry) { emit("uos:disclosure-close", entry.key); });
    emit("uos:disclosure-open", nextKey);
  }

function closeScope(scope) {
  var targetScope = text(scope) || "default";
  var scopesToClose = targetScope === "register" ? ["register"].concat(INNER_SCOPES) : [targetScope];
  var previous = clearScopesWithoutSync(scopesToClose);
  if (!previous.length) return;
  syncAll(true);
  previous.forEach(function (entry) { emit("uos:disclosure-close", entry.key); });
}

function closeAll(scope) {
  if (scope) {
    closeScope(scope);
    return;
  }
  var previous = clearScopesWithoutSync(activeScopes());
  syncAll(true);
  previous.forEach(function (entry) { emit("uos:disclosure-close", entry.key); });
}

function closeInnerScopesExcept(scopeToKeep) {
  var scopes = INNER_SCOPES.filter(function (scope) { return scope !== scopeToKeep; });
  var previous = clearScopesWithoutSync(scopes);
  if (!previous.length) return;
  syncAll(true);
  previous.forEach(function (entry) { emit("uos:disclosure-close", entry.key); });
}

function toggle(key, scopeOverride) {
    var targetKey = text(key);
    var scope = text(scopeOverride) || scopeForKey(targetKey);
    if (isKeyActive(targetKey, scope)) closeScope(scope);
    else open(targetKey, scope);
}

function runAfterOpen(key, callback) {
  var targetKey = text(key);
  var targetScope = scopeForKey(targetKey);
  if (!targetKey || typeof callback !== "function" || !isKeyActive(targetKey, targetScope)) return false;
  var drawer = null;
  Array.prototype.some.call(document.querySelectorAll("[data-disclosure-drawer]"), function (candidate) {
    if (candidate.getAttribute("data-disclosure-key") === targetKey) {
      drawer = candidate;
      return true;
    }
    return false;
  });
  if (!drawer || !drawer._uosDisclosureAnimation) {
    callback();
    return true;
  }
  if (!afterOpenWork[targetKey]) afterOpenWork[targetKey] = [];
  afterOpenWork[targetKey].push(callback);
  return true;
}

  function replaceButtonCard(card) {
    if (!card || card.tagName !== "BUTTON") return card;
    var replacement = document.createElement("div");
    Array.prototype.forEach.call(card.attributes, function (attribute) {
      if (attribute.name !== "type" && attribute.name !== "role" && attribute.name !== "tabindex") {
        replacement.setAttribute(attribute.name, attribute.value);
      }
    });
    while (card.firstChild) replacement.appendChild(card.firstChild);
    card.parentNode.replaceChild(replacement, card);
    return replacement;
  }

  function ensureListHeader(card, config) {
    var parent = card.parentNode;
    if (!parent) return;
    var headings = config.headings.slice();
    if (config.metricHeadingAttribute) {
      headings[1] = text(parent.getAttribute(config.metricHeadingAttribute)) || headings[1];
    }
    var header = parent.querySelector('[data-disclosure-list-header="' + config.prefix + '"]');
    if (!header) {
      header = document.createElement("div");
      header.className = "program-disclosure-list__header";
      header.setAttribute("data-disclosure-list-header", config.prefix);
      header.setAttribute("aria-hidden", "true");
      parent.insertBefore(header, card);
    }
    header.innerHTML = '<span class="program-disclosure-list__spacer"></span>' +
      '<span>' + headings[0] + '</span>' +
      '<span>' + headings[1] + '</span>' +
      '<span>' + headings[2] + '</span>';
    parent.classList.add("program-disclosure-list");
  }

  function enhanceCard(originalCard, config) {
    if (originalCard.hasAttribute("data-disclosure-skip")) return;
    var cardWasFocused = originalCard === document.activeElement;
    var card = replaceButtonCard(originalCard);
    if (!card || card.hasAttribute("data-disclosure-enhanced")) return;
    var entityId = text(card.getAttribute(config.attribute));
    if (!entityId) return;

    var titleNode = firstNode(card, config.title);
    var metricNode = firstNode(card, config.metric);
    var statusNode = firstNode(card, config.status);
    var title = text(titleNode && titleNode.textContent) || entityId;
    var metric = formatMetric(text(metricNode && metricNode.textContent), config.metricFormat) || "—";
    var status = text(statusNode && statusNode.textContent) || "—";
    var key = config.prefix + ":" + entityId;
    var scope = text(config.scope) || scopeForKey(key);
    var drawerId = "program-disclosure-" + safeId(key);

    ensureListHeader(card, config);

    var drawer = document.createElement("div");
    drawer.className = "program-disclosure-drawer program-disclosure-drawer--card";
    drawer.id = drawerId;
    drawer.setAttribute("data-disclosure-drawer", "");
    drawer.setAttribute("data-disclosure-key", key);
    drawer.setAttribute("data-disclosure-scope", scope);
    drawer.setAttribute("data-disclosure-motion", "mini");
    drawer.setAttribute("role", "region");
    drawer.setAttribute("aria-hidden", "true");
    drawer.hidden = true;
    while (card.firstChild) drawer.appendChild(card.firstChild);

    if (config.openAction) {
      var actionBar = document.createElement("div");
      actionBar.className = "program-disclosure-drawer__actions";
      actionBar.innerHTML = '<button type="button" class="uos-button uos-button--primary uos-button--sm" data-scheduler-open-job-detail="' + entityId.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">' + config.openAction + '</button>';
      drawer.appendChild(actionBar);
    }

    var summary = document.createElement("button");
    summary.type = "button";
    summary.className = "program-disclosure-summary";
    summary.setAttribute("data-disclosure-toggle", "");
    summary.setAttribute("data-disclosure-key", key);
    summary.setAttribute("data-disclosure-scope", scope);
    summary.setAttribute("aria-controls", drawerId);
    summary.setAttribute("aria-label", "Toggle " + title + " details");
    summary.id = drawerId + "-toggle";
    drawer.setAttribute("aria-labelledby", summary.id);

    var chevron = document.createElement("span");
    chevron.className = "program-disclosure-summary__chevron";
    chevron.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
    var titleCell = document.createElement("span");
    titleCell.className = "program-disclosure-summary__title";
    titleCell.textContent = title;
    var metricCell = document.createElement("span");
    metricCell.className = "program-disclosure-summary__metric";
    metricCell.textContent = metric;
    if (config.metricFormat === "count-or-dash") metricCell.classList.add("program-disclosure-summary__metric--count");
    if (config.metricFormat === "count-or-dash" && metric === "-") metricCell.classList.add("is-empty");
    var statusCell = document.createElement("span");
    statusCell.className = "program-disclosure-summary__status program-status-pill";
    statusCell.textContent = status;
    if (statusNode) {
      Array.prototype.forEach.call(statusNode.classList, function (className) {
        if (className.indexOf("status--") === 0) statusCell.classList.add(className);
      });
    }

    summary.appendChild(chevron);
    summary.appendChild(titleCell);
    summary.appendChild(metricCell);
    summary.appendChild(statusCell);

    card.removeAttribute("role");
    card.removeAttribute("tabindex");
    card.classList.add("program-disclosure-row", "program-disclosure-row--card");
    card.setAttribute("data-disclosure-row", "");
    card.setAttribute("data-disclosure-key", key);
    card.setAttribute("data-disclosure-scope", scope);
    card.setAttribute("data-disclosure-enhanced", "");
    card.appendChild(summary);
    card.appendChild(drawer);
    syncAll(false);
    if (cardWasFocused && typeof summary.focus === "function") {
      try { summary.focus({ preventScroll: true }); } catch (error) { summary.focus(); }
    }
  }

  function enhance(root) {
    var scope = root && root.querySelectorAll ? root : document;
    CARD_CONFIGS.forEach(function (config) {
      if (scope.nodeType === 1 && scope.matches(config.selector)) enhanceCard(scope, config);
      Array.prototype.forEach.call(scope.querySelectorAll(config.selector), function (card) {
        enhanceCard(card, config);
      });
    });
  }

  function interactiveTarget(target) {
    return target.closest("button, a, input, select, textarea, label, summary, [contenteditable=\"true\"]");
  }

  function focusWithoutScroll(node) {
    if (!node || typeof node.focus !== "function") return;
    try { node.focus({ preventScroll: true }); } catch (error) { node.focus(); }
  }

  function visibleToggles() {
    return Array.prototype.filter.call(document.querySelectorAll("[data-disclosure-toggle]"), function (node) {
      return !node.disabled && node.getAttribute("aria-hidden") !== "true" && (!node.closest || !node.closest("[hidden]"));
    });
  }

  function bind() {
    enhance(document);
    document.addEventListener("click", function (event) {
      var destination = event.target.closest("[data-program-destination],[data-destination]");
      if (destination) {
        var destinationKey = text(destination.getAttribute("data-program-destination") || destination.getAttribute("data-destination"));
        if (["planner", "map", "costing", "scheduler", "quotes"].indexOf(destinationKey) < 0) closeAll();
        else closeInnerScopesExcept(destinationKey);
        return;
      }
      var listContextChange = event.target.closest("[data-pane-mode],[data-planner-pane-mode],[data-costing-pane-mode],[data-scheduler-pane-mode],[data-quotes-pane-mode],[data-scheduler-show-jobs],[data-scheduler-back-projects]");
      if (listContextChange) {
        if (listContextChange.matches("[data-pane-mode]")) closeScope("map");
        else if (listContextChange.matches("[data-planner-pane-mode]")) closeScope("planner");
        else if (listContextChange.matches("[data-costing-pane-mode]")) closeScope("costing");
        else if (listContextChange.matches("[data-scheduler-pane-mode],[data-scheduler-show-jobs],[data-scheduler-back-projects]")) closeScope("scheduler");
        else if (listContextChange.matches("[data-quotes-pane-mode]")) closeScope("quotes");
      }
      var toggleNode = event.target.closest("[data-disclosure-toggle]");
      if (toggleNode) {
        var toggleKey = toggleNode.getAttribute("data-disclosure-key");
        toggle(toggleKey, disclosureScope(toggleNode, toggleKey));
        return;
      }
      var clickableRow = event.target.closest("[data-disclosure-click-row][data-disclosure-row]");
      if (clickableRow && !interactiveTarget(event.target)) {
        toggle(clickableRow.getAttribute("data-disclosure-key"));
      }
    }, true);

    document.addEventListener("keydown", function (event) {
      var toggleNode = event.target.closest && event.target.closest("[data-disclosure-toggle]");
      if (event.key === "Escape") {
        // Each Tools drawer owns Escape before the outer Register drawer.
        if (event.target.closest && event.target.closest("[data-calculator-tools]:not([hidden]),[data-costing-tools]:not([hidden])")) return;
        var context = event.target.closest && event.target.closest("[data-disclosure-drawer],[data-disclosure-toggle]");
        var contextKey = context && context.getAttribute ? context.getAttribute("data-disclosure-key") : "";
        var contextScope = contextKey ? disclosureScope(context, contextKey) : "";
        var scopeToClose = contextScope && activeKeyForScope(contextScope) ? contextScope : lastActiveScope;
        var keyToClose = scopeToClose ? activeKeyForScope(scopeToClose) : "";
        if (keyToClose) {
          var activeToggle = document.querySelector('[data-disclosure-toggle][data-disclosure-key="' + keyToClose.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]');
          closeScope(scopeToClose);
          focusWithoutScroll(activeToggle);
          event.preventDefault();
          return;
        }
      }
      if (!toggleNode || ["ArrowDown", "ArrowUp", "Home", "End"].indexOf(event.key) < 0) return;
      var toggles = visibleToggles(), index = toggles.indexOf(toggleNode), next = index;
      if (event.key === "Home") next = 0;
      else if (event.key === "End") next = toggles.length - 1;
      else if (event.key === "ArrowDown") next = Math.min(toggles.length - 1, index + 1);
      else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
      if (next >= 0 && toggles[next]) focusWithoutScroll(toggles[next]);
      event.preventDefault();
    }, true);

    document.addEventListener("uos:program-ready", function (event) {
      var workspace = event.detail && event.detail.workspace;
      var destination = text(workspace && workspace.workspace && workspace.workspace.destination);
      var recordModules = ["planner", "map", "costing", "scheduler", "quotes"];
 var staysInDrawer = recordModules.indexOf(destination) >= 0 && recordModules.indexOf(lastDestination) >= 0;
 var returningToOpenRegister = destination === "register" && activeKeyForScope("register");
 if (destination && lastDestination && destination !== lastDestination) {
 if (returningToOpenRegister) closeInnerScopesExcept("register");
 else
        if (staysInDrawer) closeInnerScopesExcept(destination);
        else closeAll();
      }
      if (destination) lastDestination = destination;
    });

    document.addEventListener("uos:disclosure-motion-end", function (event) {
      var detail = event.detail || {};
    });

    if (window.MutationObserver) {
      observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          Array.prototype.forEach.call(mutation.addedNodes, function (node) {
            if (node && node.nodeType === 1) enhance(node);
          });
        });
        syncAll(false);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  UOS.ProgramDisclosureRows = {
    open: open,
    closeAll: closeAll,
    closeScope: closeScope,
    toggle: toggle,
    isOpen: function (key, scope) { return isKeyActive(key, scope); },
    activeKey: function (scope) {
      if (scope) return activeKeyForScope(scope);
      if (lastActiveScope && activeKeyForScope(lastActiveScope)) return activeKeyForScope(lastActiveScope);
      return activeKeyForScope("register") || "";
    },
    activeKeys: function () {
      var copy = {};
      activeScopes().forEach(function (scope) { copy[scope] = activeKeys[scope]; });
      return copy;
    },
    scopeForKey: scopeForKey,
    enhance: enhance,
    sync: function () { syncAll(false); },
    afterOpen: runAfterOpen,
    motion: {
      register: { duration: DRAWER_MOTION_DURATION, easing: DRAWER_MOTION_EASING },
      mini: { duration: DRAWER_MOTION_DURATION, easing: DRAWER_MOTION_EASING }
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
}());
