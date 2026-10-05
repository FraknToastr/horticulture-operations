(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var script = document.currentScript;
  var rootUrl = new URL("../../", script.src);
  var preferenceKey = "uos-horticulture-suite-v2-preferences";
  var defaults = { theme: "light", font: "standard", railCollapsed: false };
  var preferences = defaults;
  var modalStack = [];

  try { preferences = Object.assign({}, defaults, JSON.parse(localStorage.getItem(preferenceKey) || "{}")); } catch (error) { preferences = defaults; }

  function applyPreferences() {
    var root = document.documentElement;
    root.setAttribute("data-suite-theme", ["light", "dark", "protanopia", "deuteranopia", "tritanopia"].indexOf(preferences.theme) >= 0 ? preferences.theme : "light");
    root.setAttribute("data-suite-font", preferences.font === "dyslexic" ? "dyslexic" : "standard");
    preferences.railCollapsed = Boolean(preferences.railCollapsed);
    document.body.classList.toggle("uos-rail-collapsed", preferences.railCollapsed);
    document.querySelectorAll("[data-uos-theme]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-uos-theme") === preferences.theme));
    });
    document.querySelectorAll("[data-uos-font]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-uos-font") === preferences.font));
    });
    document.querySelectorAll("[data-uos-rail-collapse]").forEach(function (button) {
      button.setAttribute("aria-expanded", String(!preferences.railCollapsed));
      button.setAttribute("aria-label", preferences.railCollapsed ? "Expand navigation" : "Collapse navigation");
      button.setAttribute("data-uos-tooltip", preferences.railCollapsed ? "Expand navigation" : "Collapse navigation");
    });
  }

  function setPreference(type, value) {
    var update = {};
    if (type === "font") update.font = value;
    else if (type === "railCollapsed") update.railCollapsed = Boolean(value);
    else update.theme = value;
    preferences = Object.assign({}, preferences, update);
    try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch (error) { /* display remains session-only */ }
    applyPreferences();
  }

  function focusable(container) {
    return Array.prototype.slice.call(container.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])")).filter(function (element) { return !element.hidden && element.offsetParent !== null; });
  }

  function trapModal(backdrop) {
    function onKeydown(event) {
      if (event.key === "Escape") { event.stopPropagation(); closeModal(backdrop, false); return; }
      if (event.key !== "Tab") return;
      var items = focusable(backdrop);
      if (!items.length) { event.preventDefault(); return; }
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    backdrop._uosKeydown = onKeydown;
    backdrop.addEventListener("keydown", onKeydown);
  }

  function closeModal(backdrop, result) {
    if (!backdrop || !backdrop.isConnected) return;
    backdrop.removeEventListener("keydown", backdrop._uosKeydown);
    backdrop.remove();
    modalStack = modalStack.filter(function (item) { return item !== backdrop; });
    document.body.classList.toggle("uos-modal-open", modalStack.length > 0);
    if (backdrop._uosResolve) backdrop._uosResolve(result);
    if (backdrop._uosOpener && backdrop._uosOpener.isConnected) backdrop._uosOpener.focus({ preventScroll: true });
  }

  // One Escape owner for shared overlays and every native dialog, including
  // dialogs created by modules after startup. Run before drawer/map handlers.
  var modalSequence = 0;
  function topModal() {
    return Array.prototype.slice.call(document.querySelectorAll("dialog[open], .uos-modal-backdrop")).sort(function (a, b) {
      return (a._uosModalOrder || 0) - (b._uosModalOrder || 0);
    }).pop();
  }
  if (typeof HTMLDialogElement !== "undefined") {
    ["show", "showModal"].forEach(function (method) {
      var original = HTMLDialogElement.prototype[method];
      HTMLDialogElement.prototype[method] = function () {
        var opener = document.activeElement, dialog = this;
        var result = original.apply(dialog, arguments);
        dialog._uosModalOrder = ++modalSequence;
        dialog._uosModalOpener = opener;
        if (!dialog._uosRestoreFocus) {
          dialog._uosRestoreFocus = true;
          dialog.addEventListener("close", function () {
            var target = dialog._uosModalOpener;
            // Native close events are queued: a newer modal may already own focus.
            var active = topModal();
            if (active && active._uosModalOrder > dialog._uosModalOrder) return;
            if (target && target.isConnected) target.focus({ preventScroll: true });
          });
        }
        return result;
      };
    });
  }
  // Native focus scrolling may reveal only a textarea's caret, clipping its ring.
  // Reveal the control inside modal scroll regions without moving the workspace.
  document.addEventListener("focusin", function (event) {
    var target = event.target;
    var modal = target.closest && target.closest("dialog[open], .uos-modal");
    if (!modal) return;
    window.requestAnimationFrame(function () {
      if (!modal.isConnected || document.activeElement !== target) return;
      var style = window.getComputedStyle(target);
      var clearance = Math.max(8, (parseFloat(style.outlineWidth) || 0) + Math.max(0, parseFloat(style.outlineOffset) || 0));
      for (var parent = target.parentElement; parent; parent = parent.parentElement) {
        var css = window.getComputedStyle(parent);
        var box = parent.getBoundingClientRect();
        var rect = target.getBoundingClientRect();
        var left = box.left + parent.clientLeft + clearance;
        var top = box.top + parent.clientTop + clearance;
        var width = parent.clientWidth - 2 * clearance;
        var height = parent.clientHeight - 2 * clearance;
        if (/auto|scroll/.test(css.overflowY) && rect.height <= height) {
          if (rect.top < top) parent.scrollTop += rect.top - top;
          else if (rect.bottom > top + height) parent.scrollTop += rect.bottom - top - height;
        }
        if (/auto|scroll/.test(css.overflowX) && rect.width <= width) {
          if (rect.left < left) parent.scrollLeft += rect.left - left;
          else if (rect.right > left + width) parent.scrollLeft += rect.right - left - width;
        }
        if (parent === modal) break;
      }
    });
  });
  window.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var top = topModal();
    if (!top) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (top.tagName.toLowerCase() === "dialog") {
      var cancel = new Event("cancel", { cancelable: true });
      if (top.dispatchEvent(cancel) && top.open) top.close();
    } else closeModal(top, false);
  }, true);

  function openDialog(options) {
    options = options || {};
    var backdrop = document.createElement("div");
    backdrop._uosModalOrder = ++modalSequence;
    backdrop.className = "uos-modal-backdrop";
    backdrop._uosOpener = document.activeElement;
    var openerMenu = backdrop._uosOpener && backdrop._uosOpener.closest ? backdrop._uosOpener.closest("[data-uos-menu-panel]") : null;
    if (openerMenu) {
      var menuTrigger = Array.prototype.find.call(document.querySelectorAll("[data-uos-menu-trigger]"), function (candidate) {
        return candidate.getAttribute("aria-controls") === openerMenu.id;
      });
      if (menuTrigger) backdrop._uosOpener = menuTrigger;
    }
    var titleId = "uos-dialog-" + Math.random().toString(36).slice(2);
    backdrop.innerHTML = '<section class="uos-modal" role="dialog" aria-modal="true" aria-labelledby="' + titleId + '">' +
      '<header class="uos-modal__head"><h2 id="' + titleId + '"></h2><button class="uos-icon-button" type="button" data-uos-close aria-label="Close">×</button></header>' +
      '<div class="uos-modal__body"></div><footer class="uos-modal__foot"></footer></section>';
    if (options.modalClass) backdrop.querySelector(".uos-modal").classList.add(options.modalClass);
    backdrop.querySelector("h2").textContent = options.title || "Dialog";
    if (options.headerNode) backdrop.querySelector(".uos-modal__head").insertBefore(options.headerNode, backdrop.querySelector("[data-uos-close]"));
    var body = backdrop.querySelector(".uos-modal__body");
    if (options.node) body.appendChild(options.node);
    else body.textContent = options.message || "";
    var footer = backdrop.querySelector(".uos-modal__foot");
    (options.actions || [{ label: "Close", value: false }]).forEach(function (action) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "uos-button" + (action.primary ? " uos-button--primary" : "") + (action.danger ? " uos-button--danger" : "");
      button.textContent = action.label;
      button.addEventListener("click", function () { closeModal(backdrop, action.value); });
      footer.appendChild(button);
    });
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop || event.target.closest("[data-uos-close]")) closeModal(backdrop, false);
    });
    document.body.appendChild(backdrop);
    document.body.classList.add("uos-modal-open");
    modalStack.push(backdrop);
    trapModal(backdrop);
    setTimeout(function () {
      if (topModal() !== backdrop || backdrop._uosModalOrder !== modalSequence) return;
      (footer.querySelector(".uos-button--primary") || footer.querySelector("button") || backdrop.querySelector("[data-uos-close]")).focus({ preventScroll: true });
    }, 0);
    return new Promise(function (resolve) { backdrop._uosResolve = resolve; });
  }

  function confirmDialog(options) {
    options = typeof options === "string" ? { message: options } : options || {};
    return openDialog({
      title: options.title || "Confirm action",
      message: options.message || "Continue?",
      actions: [
        { label: options.cancelLabel || "Cancel", value: false },
        { label: options.confirmLabel || "Continue", value: true, primary: !options.danger, danger: Boolean(options.danger) }
      ]
    });
  }

  function alertDialog(options) {
    options = typeof options === "string" ? { message: options } : options || {};
    return openDialog({
      title: options.title || "Information",
      message: options.message || "",
      actions: [
        { label: options.buttonLabel || "OK", value: true, primary: true }
      ]
    });
  }

  function toast(message, type) {
    var region = document.querySelector(".uos-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "uos-toast-region";
      document.body.appendChild(region);
    }
    var item = document.createElement("div");
    item.className = "uos-toast";
    item.setAttribute("role", type === "error" ? "alert" : "status");
    item.textContent = message;
    region.appendChild(item);
    setTimeout(function () {
      item.remove();
      if (!region.children.length) region.remove();
    }, type === "error" ? 5200 : 3200);
  }

  function displayDialog() {
    var node = document.createElement("div");
    node.innerHTML = '<div class="uos-field"><span>Theme</span><div class="uos-segmented" role="group" aria-label="Theme"><button type="button" data-uos-theme="light">Light</button><button type="button" data-uos-theme="dark">Dark</button><button type="button" data-uos-theme="protanopia">Protanopia</button><button type="button" data-uos-theme="deuteranopia">Deuteranopia</button><button type="button" data-uos-theme="tritanopia">Tritanopia</button></div></div><div class="uos-field uos-field--spaced"><span>Reading font</span><div class="uos-segmented" role="group" aria-label="Reading font"><button type="button" data-uos-font="standard">Standard</button><button type="button" data-uos-font="dyslexic">OpenDyslexic</button></div></div>';
    node.addEventListener("click", function (event) {
      var theme = event.target.closest("[data-uos-theme]");
      var font = event.target.closest("[data-uos-font]");
      if (theme) setPreference("theme", theme.getAttribute("data-uos-theme"));
      if (font) setPreference("font", font.getAttribute("data-uos-font"));
      applyPreferences();
    });
    openDialog({ title: "Display settings", node: node });
    setTimeout(applyPreferences, 0);
  }

  function aboutDialog() {
    var appName = document.documentElement.getAttribute("data-app-name") || document.title;
    var path = location.pathname;
    var isProgramPlanner = path.indexOf("program-planner") >= 0;
    var appTechnology = path.indexOf("remediation-planner") >= 0 ? '<li><strong>MapLibre GL JS 5.3.0</strong><span>Locally bundled WebGL mapping, GeoJSON rendering, map controls and spatial interaction.</span></li><li><strong>pdf-lib 1.17.1</strong><span>Locally bundled, offline PDF document generation for facilitator-safe remediation quotes.</span></li>' : '<li><strong>PDF.js 2.16.105</strong><span>Locally bundled PDF parsing with evaluation disabled and a local worker for portable imports.</span></li>';
    var appCode = isProgramPlanner ? '<li><strong>Horticulture Program Planner modules</strong><span>Canonical schema-v4 validation, staged legacy migration, financial-year rate catalogs, Applications and Events register, Monday-first Week and Month scheduler, time and conflict analysis, Job calculator, spatial quantity costing, live financial reports, Smart Import, CSV/GeoJSON bundle export, legacy deep links and IndexedDB persistence.</span></li>' : path.indexOf("nature-strip") >= 0 ? '<li><strong>Nature Strip modules</strong><span>Application, project, schedule, import, data-grid, validation and workspace model modules.</span></li>' : path.indexOf("overtime-planner") >= 0 ? '<li><strong>Overtime modules</strong><span>Source and users import, recurrence and roster model, responsive calendars, persistence and offline mobile export.</span></li>' : '<li><strong>Remediation modules</strong><span>Workspace model, provider configuration, map orchestration, event planning and portable import/export.</span></li>';
    var node = document.createElement("div");
    node.className = "uos-about";
    node.innerHTML = '<div class="uos-about__brand" aria-label="Urban Operating System, made by Josh Roberts"><img class="uos-about__logo uos-about__logo--light" src="../shared/assets/uos-logo-forward.svg" alt="U-OS"><img class="uos-about__logo uos-about__logo--dark" src="../shared/assets/uos-logo-forward-dark.svg" alt="U-OS"><img class="uos-about__dots" src="../shared/assets/uos-logo-dot-column.svg" alt=""><span class="uos-about__system" aria-hidden="true"><span>Urban</span><span>Operating</span><span>System</span></span><span class="uos-about__divider" aria-hidden="true"></span><span class="uos-made-by"><span>Made</span><span>by</span><span>Josh Roberts</span></span></div><div class="uos-about__intro"><div><p class="uos-about-lead">Made for Jamie Kent and the Horticulture Teams</p><p>This portable U-OS application keeps operational data in user-selected files and browser storage, never in embedded operational datasets.</p></div><strong class="uos-about__version">Version 1.0</strong></div><section class="uos-about__section"><h3>HTML platform</h3><ul class="uos-about__stack"><li><strong>HTML5</strong><span>Semantic landmarks, native controls, accessible dialogs, tables, forms and responsive document structure.</span></li><li><strong>Browser platform APIs</strong><span>File, Blob, URL, download, drag-and-drop, Web Crypto UUIDs, Intl formatting and DOM event APIs.</span></li><li><strong>Portable runtime</strong><span>Zero-build static files for local <code>file://</code> use or a simple local web server.</span></li></ul></section><section class="uos-about__section"><h3>CSS platform</h3><ul class="uos-about__stack"><li><strong>U-OS design tokens</strong><span>Shared colour, typography, spacing, radius, elevation, motion and responsive sizing variables.</span></li><li><strong>Shared CSS layers</strong><span>Reset, themes, components, shell, accessibility and print styles, followed by app-specific layouts.</span></li><li><strong>Modern CSS</strong><span>Grid, Flexbox, custom properties, responsive layouts, focus-visible states, reduced-motion support and print rules.</span></li><li><strong>OpenDyslexic</strong><span>Locally bundled WOFF fonts available through the suite reading-font preference.</span></li></ul></section><section class="uos-about__section"><h3>JavaScript platform and libraries</h3><ul class="uos-about__stack"><li><strong>Vanilla JavaScript</strong><span>Framework-free modular scripts with no compilation, package runtime or CDN dependency.</span></li><li><strong>U-OS shared runtime</strong><span>Dialog, menu, display preference, storage, import, download, accessibility announcement and data-grid utilities.</span></li><li><strong>Browser persistence</strong><span>IndexedDB workspace storage with localStorage preferences and explicit portable JSON/CSV exports.</span></li><li><strong>Local file processing</strong><span>JSON and CSV handling plus browser ZIP/decompression and spreadsheet/XML processing where used by an importer.</span></li>' + appTechnology + appCode + '</ul></section><p class="uos-about__footnote">Horticulture Operations Suite · ' + appName + ' · Version 1.0</p>';
    node.querySelector(".uos-about__brand").remove();
    node.querySelector(".uos-about__version").remove();
    node.querySelector(".uos-about__footnote").textContent = "Horticulture Operations Suite · " + appName;
    var appHeading = document.createElement("h2");
    appHeading.className = "uos-about__app-name";
    appHeading.textContent = appName;
    node.insertBefore(appHeading, node.firstChild);
    var headerBrand = document.createElement("div");
    headerBrand.className = "uos-about-header-brand";
    headerBrand.setAttribute("aria-label", "Urban Operating System, made by Josh Roberts, Version 1.0");
    headerBrand.innerHTML = '<img class="uos-about-header-brand__logo uos-about-header-brand__logo--light" src="../shared/assets/uos-logo-forward.svg" alt="U-OS"><img class="uos-about-header-brand__logo uos-about-header-brand__logo--dark" src="../shared/assets/uos-logo-forward-dark.svg" alt="U-OS"><img class="uos-about-header-brand__dots" src="../shared/assets/uos-logo-dot-column.svg" alt=""><span class="uos-about-header-brand__system" aria-hidden="true"><span>Urban</span><span>Operating</span><span>System</span></span><span class="uos-about-header-brand__divider" aria-hidden="true"></span><span class="uos-about-header-brand__made"><span>Made</span><span>by</span><span>Josh Roberts</span></span><strong class="uos-about-header-brand__version">Version 1.0</strong>';
    openDialog({ title: "About " + appName, node: node, headerNode: headerBrand });
  }

  function addCreatorBranding() {
    /* About-only branding is created when its dialog opens. */
  }

  function bindMenus() {
    function triggerFor(panel) {
      return Array.prototype.find.call(document.querySelectorAll("[data-uos-menu-trigger]"), function (candidate) {
        return panel && candidate.getAttribute("aria-controls") === panel.id;
      });
    }
    function closePanel(panel, restoreFocus) {
      if (!panel) return;
      panel.hidden = true;
      var trigger = triggerFor(panel);
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
        if (restoreFocus) trigger.focus();
      }
    }
    function closeAll(except) {
      document.querySelectorAll("[data-uos-menu-panel]").forEach(function (panel) {
        if (panel !== except) closePanel(panel, false);
      });
    }
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest("[data-uos-menu-trigger]");
      if (trigger) {
        var panel = document.getElementById(trigger.getAttribute("aria-controls"));
        var open = Boolean(panel && panel.hidden);
        closeAll(panel);
        if (panel) panel.hidden = !open;
        trigger.setAttribute("aria-expanded", String(open));
        return;
      }
      var activePanel = event.target.closest("[data-uos-menu-panel]");
      if (activePanel) {
        if (event.target.closest("button,a")) closePanel(activePanel, false);
        return;
      }
      closeAll(null);
    });
    document.addEventListener("keydown", function (event) {
      var trigger = event.target.closest("[data-uos-menu-trigger]");
      if (trigger && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        var panel = document.getElementById(trigger.getAttribute("aria-controls"));
        if (!panel) return;
        event.preventDefault();
        closeAll(panel);
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        var firstItems = focusable(panel);
        if (firstItems.length) firstItems[event.key === "ArrowUp" ? firstItems.length - 1 : 0].focus();
        return;
      }
      var panel = event.target.closest("[data-uos-menu-panel]");
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePanel(panel, true);
        return;
      }
      if (event.key === "Tab") { closePanel(panel, false); return; }
      if (["ArrowDown", "ArrowUp", "Home", "End"].indexOf(event.key) === -1) return;
      var items = focusable(panel);
      if (!items.length) return;
      var index = items.indexOf(document.activeElement);
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = items.length - 1;
      else index = (Math.max(0, index) + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      event.preventDefault();
      items[index].focus();
    });
  }

  function bindTabs() {
    document.addEventListener("keydown", function (event) {
      var tab = event.target.closest('[role="tab"]');
      if (!tab || ["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) === -1) return;
      var tabs = Array.prototype.slice.call(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]:not([disabled])'));
      var index = tabs.indexOf(tab);
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = tabs.length - 1;
      else index = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[index].focus();
      tabs[index].click();
    });
  }

  function bindTooltips() {
    var tooltip = document.createElement("div");
    tooltip.className = "uos-tooltip";
    tooltip.id = "uos-shared-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    var active = null;
    var timer = null;
    var scheduled = null;
    var previousDescription = null;

    function candidate(target) {
      return target && target.closest ? target.closest("[data-uos-tooltip],.uos-nav__item,.uos-header__action[aria-label],.uos-icon-button[aria-label]") : null;
    }
    function isHoveredOrKeyFocused(element) {
      if (!element || !element.isConnected) return false;
      try {
        if (element.matches(":hover")) return true;
      } catch (e) {}
      try {
        if (element.matches(":focus-visible")) return true;
      } catch (e) {}
      return false;
    }
    var pointer = null, leaveTimer = null;
    function scheduleLeave() {
      if (leaveTimer) return;
      leaveTimer = setTimeout(function () { leaveTimer = null; if (!tooltip.matches(":hover") && active && !isHoveredOrKeyFocused(active)) hide(); }, 220);
    }
    tooltip.addEventListener("pointerenter", function () { clearTimeout(leaveTimer); leaveTimer = null; });
    var GAP = 48, EDGE = 8;
    function normalizeTips(node) {
      if (!node || node.nodeType !== 1) return;
      var targets = node.hasAttribute("title") ? [node] : [];
      targets = targets.concat(Array.prototype.slice.call(node.querySelectorAll("[title]")));
      targets.forEach(function (target) {
        var label = target.getAttribute("title");
        if (label && !target.hasAttribute("data-uos-tooltip")) target.setAttribute("data-uos-tooltip", label);
        if (label && !target.hasAttribute("aria-label") && !target.hasAttribute("aria-labelledby") && !target.textContent.trim() && !target.labels?.length && target.matches("button,input,select,[role=img]")) target.setAttribute("aria-label", label);
        target.removeAttribute("title");
      });
    }
    normalizeTips(document.documentElement);
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === "attributes") normalizeTips(record.target);
        else Array.prototype.forEach.call(record.addedNodes, normalizeTips);
      });
      if (active && !active.isConnected) hide();
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"] });
    function position(target) {
      var rect = target.getBoundingClientRect();
      var viewport = window.visualViewport;
      var bounds = { left: viewport ? viewport.offsetLeft : 0, top: viewport ? viewport.offsetTop : 0, width: viewport ? viewport.width : window.innerWidth, height: viewport ? viewport.height : window.innerHeight };
      var right = bounds.left + bounds.width - EDGE, bottom = bounds.top + bounds.height - EDGE;
      var leftEdge = bounds.left + EDGE, topEdge = bounds.top + EDGE;
      tooltip.style.maxWidth = Math.max(1, Math.min(320, bounds.width - 2 * EDGE)) + "px";
      tooltip.style.maxHeight = Math.max(1, bounds.height - 2 * EDGE) + "px";
      var point = pointer || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      var preferred = target.closest(".uos-rail") ? "right" : target.getAttribute("data-uos-tooltip-pos") || "bottom";
      var order = [preferred, {top:"bottom",bottom:"top",right:"left",left:"right"}[preferred] || "top", "right", "left", "bottom", "top"].filter(function (side,index,all) { return all.indexOf(side) === index; });
      var size = tooltip.getBoundingClientRect();
      var choices = order.map(function (side) {
        var horizontal = side === "right" || side === "left";
        var start = horizontal ? (side === "right" ? Math.max(rect.right,point.x) + GAP : leftEdge) : (side === "bottom" ? Math.max(rect.bottom,point.y) + GAP : topEdge);
        var end = horizontal ? (side === "left" ? Math.min(rect.left,point.x) - GAP : right) : (side === "top" ? Math.min(rect.top,point.y) - GAP : bottom);
        return { side:side, horizontal:horizontal, available:Math.max(0,end-start), start:start, end:end, fits:end-start >= (horizontal ? size.width : size.height) };
      });
      var choice = choices.find(function (item) { return item.fits; }) || choices.sort(function (a,b) { return b.available-a.available; })[0];
      if (!choice.fits) {
        if (choice.horizontal) tooltip.style.maxWidth = Math.max(1, choice.available) + "px";
        else tooltip.style.maxHeight = Math.max(1, choice.available) + "px";
        size = tooltip.getBoundingClientRect();
      }
      var x = rect.left + rect.width / 2 - size.width / 2, y = rect.top + rect.height / 2 - size.height / 2;
      if (choice.side === "right") x = choice.start;
      if (choice.side === "left") x = choice.end - size.width;
      if (choice.side === "bottom") y = choice.start;
      if (choice.side === "top") y = choice.end - size.height;
      tooltip.style.left = Math.max(leftEdge, Math.min(right - size.width, x)) + "px";
      tooltip.style.top = Math.max(topEdge, Math.min(bottom - size.height, y)) + "px";
      // Overflowing help needs pointer access for scrolling; ordinary tips
      // allow clicks through to the controls below them.
      tooltip.style.pointerEvents = tooltip.scrollHeight > tooltip.clientHeight || tooltip.scrollWidth > tooltip.clientWidth ? "auto" : "none";
    }
    function show(target) {
      if (!target || !target.isConnected) return;
      if (!isHoveredOrKeyFocused(target)) {
        hide();
        return;
      }
      hide();
      active = target;
      previousDescription = target.getAttribute("aria-describedby");
      target.setAttribute("aria-describedby", [previousDescription, tooltip.id].filter(Boolean).join(" "));
      var label = target.getAttribute("data-uos-tooltip") || target.getAttribute("aria-label");
      if (!label && target.classList.contains("uos-nav__item")) {
        var labelSpan = target.querySelector("span");
        if (labelSpan) label = labelSpan.textContent.trim();
      }
      tooltip.textContent = label || "";
      tooltip.hidden = !tooltip.textContent;
      if (!tooltip.hidden) position(target);
    }
    function schedule(target, delay) {
      if (scheduled === target) return;
      clearTimeout(timer);
      scheduled = target;
      timer = setTimeout(function () { scheduled = null; show(target); }, delay);
    }
    function hide() {
      clearTimeout(leaveTimer); leaveTimer = null;
      clearTimeout(timer);
      timer = null;
      scheduled = null;
      tooltip.hidden = true;
      if (active && active.isConnected) {
        if (previousDescription) active.setAttribute("aria-describedby", previousDescription);
        else active.removeAttribute("aria-describedby");
      }
      active = null;
      previousDescription = null;
    }
    document.addEventListener("pointerover", function (event) {
      pointer = { x: event.clientX, y: event.clientY };
      normalizeTips(event.target);
      var target = candidate(event.target);
      if (!target || active === target || scheduled === target) return;
      var replaceImmediately = Boolean(active && !tooltip.hidden);
      hide();
      schedule(target, replaceImmediately ? 0 : 140);
    });
    document.addEventListener("pointerout", function (event) {
      if (event.relatedTarget && tooltip.contains(event.relatedTarget)) return;
      var target = candidate(event.target);
      var next = candidate(event.relatedTarget);
      if (!target || target === next) return;
      if (active && !next) { scheduleLeave(); return; }
      var replaceImmediately = Boolean(next && active && !tooltip.hidden);
      hide();
      if (next && isHoveredOrKeyFocused(next)) schedule(next, replaceImmediately ? 0 : 140);
    });
    document.addEventListener("pointermove", function (event) {
      pointer = { x: event.clientX, y: event.clientY };
      if (tooltip.contains(event.target)) return;
      if (active && isHoveredOrKeyFocused(active)) position(active);
      if (active && !isHoveredOrKeyFocused(active)) scheduleLeave();
    });
    document.addEventListener("focusin", function (event) {
      pointer = null;
      var target = candidate(event.target);
      if (target && isHoveredOrKeyFocused(target)) {
        schedule(target, 0);
      } else {
        hide();
      }
    });
    document.addEventListener("focusout", function (event) { if (candidate(event.target)) hide(); });
    tooltip.addEventListener("pointerleave", function (event) { if (!active || !active.contains(event.relatedTarget)) hide(); });
    tooltip.addEventListener("scroll", function (event) { event.stopPropagation(); });
    document.addEventListener("click", function (event) { if (!tooltip.contains(event.target)) hide(); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") hide(); });
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", function (event) { if (event.target !== tooltip) hide(); }, true);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", hide);
    document.addEventListener("mouseleave", hide);
    document.addEventListener("visibilitychange", function () { hide(); });
  }

  function bindShell() {
    document.querySelectorAll("[data-uos-home]").forEach(function (link) { if (!link.getAttribute("href") || link.getAttribute("href") === "#") link.href = new URL("index.html", rootUrl).href; });
    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-uos-display]")) displayDialog();
      if (event.target.closest("[data-uos-about]")) aboutDialog();
      if (event.target.closest("[data-uos-rail-toggle]")) document.body.classList.toggle("uos-rail-open");
      if (event.target.closest("[data-uos-rail-collapse]")) setPreference("railCollapsed", !preferences.railCollapsed);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        document.body.classList.remove("uos-rail-open");
        document.querySelectorAll("[data-uos-menu-panel]").forEach(function (panel) { panel.hidden = true; });
        document.querySelectorAll("[data-uos-menu-trigger]").forEach(function (trigger) { trigger.setAttribute("aria-expanded", "false"); });
      }
    });
  }

  function bindResizableInspector(inspector, name) {
    if (!inspector) return null;
    if (inspector._uosResizeHandle && inspector._uosResizeHandle.isConnected) return inspector._uosResizeHandle;
    var minimum = 320;
    var maximum = 440;
    var storageKey = "uos-horticulture-suite-v2-inspector-width:" + (name || inspector.id || "inspector");
    var handle = document.createElement("div");
    handle.className = "uos-inspector-resize";
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-label", "Resize inspector");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-valuemin", String(minimum));
    handle.setAttribute("aria-valuemax", String(maximum));
    inspector.prepend(handle);
    inspector._uosResizeHandle = handle;
    var active = null;

    function setWidth(value, persist) {
      var width = Math.max(minimum, Math.min(maximum, Math.round(Number(value) || 360)));
      document.documentElement.style.setProperty("--uos-inspector-width", width + "px");
      handle.setAttribute("aria-valuenow", String(width));
      if (persist) {
        try { localStorage.setItem(storageKey, String(width)); } catch (error) { /* compact UI state remains session-only */ }
      }
      return width;
    }

    var saved = null;
    try { saved = Number(localStorage.getItem(storageKey)); } catch (error) { saved = null; }
    setWidth(Number.isFinite(saved) && saved ? saved : 360, false);
    handle.addEventListener("pointerdown", function (event) {
      active = { x: event.clientX, width: Number(handle.getAttribute("aria-valuenow")) || 360 };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", function (event) {
      if (active) setWidth(active.width + active.x - event.clientX, false);
    });
    handle.addEventListener("pointerup", function () {
      if (!active) return;
      active = null;
      setWidth(handle.getAttribute("aria-valuenow"), true);
    });
    handle.addEventListener("keydown", function (event) {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) === -1) return;
      event.preventDefault();
      var width = Number(handle.getAttribute("aria-valuenow")) || 360;
      if (event.key === "Home") width = minimum;
      else if (event.key === "End") width = maximum;
      else width += event.key === "ArrowLeft" ? 10 : -10;
      width = setWidth(width, true);
      toast("Inspector width " + width + " pixels.");
    });
    return handle;
  }

  UOS.preferences = { get: function () { return Object.assign({}, preferences); }, set: setPreference, apply: applyPreferences };
  UOS.dialogs = { open: openDialog, confirm: confirmDialog, alert: alertDialog, close: closeModal };
  UOS.toast = toast;
  UOS.navigation = { rootUrl: rootUrl.href };
  UOS.shell = {
    openRail: function () { document.body.classList.add("uos-rail-open"); },
    closeRail: function () { document.body.classList.remove("uos-rail-open"); },
    toggleRail: function () { document.body.classList.toggle("uos-rail-open"); },
    bindResizableInspector: bindResizableInspector
  };

  applyPreferences();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { addCreatorBranding(); bindMenus(); bindTabs(); bindShell(); bindTooltips(); });
  else { addCreatorBranding(); bindMenus(); bindTabs(); bindShell(); bindTooltips(); }
})();
