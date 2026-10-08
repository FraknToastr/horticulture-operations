(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.UOS = root.UOS || {}; root.UOS.ProgramCostingController = api; }
}(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

 var state = { workspace: null, section: "Labour", query: "", category: "all", rateSort: "description", rateSortDirection: "asc", jobId: "", preliminaries: 0, margin: 0, pendingAdjustments: null, editRateId: "", editorOpener: null, mode: "applications", selectedProjectId: "", bound: false };
function text(value) { return String(value == null ? "" : value).trim(); }
function hasOwn(value, key) { return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function one(selector) { return root.document ? root.document.querySelector(selector) : null; }
  function all(selector) { return root.document ? Array.prototype.slice.call(root.document.querySelectorAll(selector)) : []; }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function setText(selector, value) { var node = one(selector); if (node) node.textContent = value; }
 function money(value) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Number(value) || 0); }
 function percentage(value) { var amount = Math.max(0, Number(value) || 0); return amount.toLocaleString("en-AU", { maximumFractionDigits: 2 }) + "%"; }
  function model() { return root.UOS && (root.UOS.ProgramCosting || root.UOS.programCosting); }
  function entities(name) { return state.workspace && state.workspace.entities && Array.isArray(state.workspace.entities[name]) ? state.workspace.entities[name] : []; }
  function projectAddress(project) {
    var api = root.UOS && root.UOS.ProgramModel;
    return text(api && typeof api.displayAddressForProject === "function" ? api.displayAddressForProject(state.workspace, project) : (project && (project.location || project.address)));
  }
  function title(item) { var payload = item && item.payload || {}; return text(item && (item.title || item.name || item.description) || payload.title || payload.name || payload.description || item && item.id); }
  function statusSlug(value) { return text(value || "Draft").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "draft"; }
  function esc(value) { return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function statusPillHtml(value) { return '<span class="program-status-pill status--' + statusSlug(value) + '">' + esc(value || "Draft") + '</span>'; }
  function active(rate) { return rate.active !== false && text(rate.status).toLowerCase() !== "inactive"; }
  function rateSection(rate) {
    if (model() && model().rateKind) return model().rateKind(rate);
    if (rate && rate.kindSource === "user" && ["Labour", "Equipment", "Material", "Contractors", "Sundry"].indexOf(text(rate.kind)) >= 0) return text(rate.kind);
    var classifier = root.UOS && root.UOS.ProgramModel && root.UOS.ProgramModel.classifyRateKind;
 if (typeof classifier === "function") return classifier(rate && rate.category, rate && (rate.description || rate.title), rate && rate.kind);
 var kind = text(rate && rate.kind);
 return ["Labour", "Equipment", "Material", "Contractors", "Sundry"].indexOf(kind) >= 0 ? kind : "Equipment";
 }
 function categoryColour(label) {
 var value = text(label).toLowerCase(), hash = 2166136261;
 for (var index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
 return (hash >>> 0) % 8;
 }
  function categoryPillLabel(value) { var label = text(value) || "Uncategorised", limit = "Plant Hire/Contractors".length; return label.length > limit ? label.slice(0, limit) + "..." : label; }
  function sizeCategoryColumn() {
    var table = one(".program-cost-table");
    if (!table) return;
    var canvas = root.document.createElement("canvas"), context = canvas.getContext && canvas.getContext("2d");
    var widest = Array.prototype.reduce.call(table.querySelectorAll(".program-category-pill"), function (width, pill) {
      var style = root.getComputedStyle(pill);
      if (context) context.font = style.font || "700 11px " + style.fontFamily;
      var measured = (context ? context.measureText(pill.textContent).width : pill.textContent.length * 7)
        + (parseFloat(style.letterSpacing) || 0) * pill.textContent.length
        + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
        + 2; // Category frames use 1px borders; avoid zoom-dependent border rounding.
      return Math.max(width, measured);
    }, 0);
    var heading = table.querySelector('[data-rate-sort="category"]');
    var headingWidth = heading ? Array.prototype.reduce.call(heading.children, function (width, child) {
      if (context) context.font = root.getComputedStyle(child).font || "800 10px " + root.getComputedStyle(table).fontFamily;
      return width + (child.offsetWidth || (context ? context.measureText(child.textContent).width : child.textContent.length * 7));
    }, 8) : 0;
    var columnWidth = Math.ceil(Math.max(widest, headingWidth) + 16);
    table.style.setProperty("--commercial-category-width", columnWidth + "px");
    if (context) context.font = "800 11px " + root.getComputedStyle(table).fontFamily;
    var stateWidth = Math.ceil((context ? context.measureText("INACTIVE").width : 56) + 4 + 20 + 8);
    table.style.setProperty("--commercial-state-width", stateWidth + "px");
    table.style.minWidth = "calc(" + (columnWidth + stateWidth + 364) + "px + 4 * var(--commercial-frame-height, 34px) + 32px)";
  }
  function currentJob() { return entities("jobs").find(function (job) { return job.id === state.jobId; }) || null; }
  function showError(error) { state.error = error ? (error.message || String(error)) : ""; var node = one("[data-costing-error]"); if (!node) return; node.textContent = state.error; node.hidden = !state.error; }
  function svg(kind) {
    var namespace = ["http:", "", "www.w3.org", "2000", "svg"].join("/"), node = root.document.createElementNS(namespace, "svg");
    var paths = kind === "trash" ? ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 15H6L5 6", "M10 11v6", "M14 11v6"]
      : kind === "edit" ? ["M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z", "m13.5 6.5 4 4"]
      : kind === "map" ? ["M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z", "M9 3v15", "M15 6v15"]
      : ["M12 5v14", "M5 12h14"];
    node.setAttribute("viewBox", "0 0 24 24"); node.setAttribute("aria-hidden", "true");
    paths.forEach(function (data) { var path = root.document.createElementNS(namespace, "path"); path.setAttribute("d", data); node.appendChild(path); });
    return node;
  }
function button(label, kind, attribute, value) { var node = root.document.createElement("button"); node.type = "button"; node.className = "uos-button uos-button--secondary uos-button--icon"; node.setAttribute("aria-label", label); node.setAttribute(attribute, value); if (kind === "calendar" || kind === "calendar-tick") {
      var icon = root.document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18' + (kind === "calendar-tick" ? 'M8 16l2.5 2.5L16.5 13' : '') + '"/>';
      node.appendChild(icon);
} else node.appendChild(svg(kind)); if (kind === "trash") node.classList.add("program-delete-action"); return node; }

  function isPolygonRate(rate) {
    if (!rate || !rate.id) return false;
    if (text(rate.measurementSource).toLowerCase() === "mapped") return true;
    if (root.UOS && root.UOS.WorkAreaService && typeof root.UOS.WorkAreaService.isMappedRate === "function") {
      return root.UOS.WorkAreaService.isMappedRate(state.workspace, rate.id);
    }
    return false;
  }

  function findProjectJobs(project) {
    if (!project || !project.id) return [];
    return entities("jobs").filter(function (job) {
      return job && job.projectId === project.id;
    });
  }

  function findProjectCostingLines(project) {
    if (!project || !project.id) return [];
    return entities("costingLines").filter(function (line) {
      return line && line.projectId === project.id;
    });
  }

  function updatePillPicker() {
    all("[data-costing-pane-mode]").forEach(function (btn) {
      var active = btn.getAttribute("data-costing-pane-mode") === state.mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (window.UOS && window.UOS.ProgramApp && typeof window.UOS.ProgramApp.updateRailTheme === "function") window.UOS.ProgramApp.updateRailTheme();
  }

  function rateValues() {
    if (!state.workspace) return [];
    var fn = model() && model().catalogItems;
    if (typeof fn === "function") {
      return fn.call(model(), state.workspace, { section: "All", query: state.query, search: state.query, category: state.category, includeInactive: true }).filter(function (item) { return rateSection(item) === state.section; });
    }
    var items = state.workspace.entities && Array.isArray(state.workspace.entities.rateItems) ? state.workspace.entities.rateItems : [];
    return items.filter(function (item) {
      if (!item) return false;
      if (rateSection(item) !== state.section) return false;
      if (state.category && state.category !== "all" && text(item.category) !== state.category) return false;
      if (state.query) {
        var q = text(state.query).toLowerCase();
        return [item.description, item.title, item.category, item.unit].some(function (v) { return text(v).toLowerCase().indexOf(q) >= 0; });
      }
      return true;
    });
  }
  function formatUnitType(unitInput, quantityKindVal) {
    var rawUnit = text(unitInput).trim();
    var kind = text(quantityKindVal).toLowerCase();

    var kindToUnit = {
      area: "m²",
      volume: "m³",
      mass: "kg",
      labour: "hours",
      length: "m",
      direct: "each"
    };

    var isNumericOrEmpty = !rawUnit || !isNaN(Number(rawUnit));
    if (isNumericOrEmpty) {
      return kindToUnit[kind] || "each";
    }

    var lower = rawUnit.toLowerCase();
    var aliasMap = {
      "m2": "m²",
      "m²": "m²",
      "sqm": "m²",
      "sq m": "m²",
      "m3": "m³",
      "m³": "m³",
      "cum": "m³",
      "cu m": "m³",
      "hr": "hours",
      "hrs": "hours",
      "hour": "hours",
      "hours": "hours",
      "item": "each",
      "count": "each",
      "ea": "each",
      "each": "each",
      "lm": "m",
      "lin m": "m",
      "m": "m",
      "kg": "kg",
      "t": "tonne",
      "tonne": "tonne",
      "tonnes": "tonne",
      "l": "L",
      "ls": "lump sum",
      "lump sum": "lump sum"
    };

    return aliasMap[lower] || rawUnit;
  }

  function renderCatalogControls() {
    var select = one("[data-costing-catalog-select]");
    if (select) { clear(select); select.hidden = true; select.disabled = true; if (select.closest("label")) select.closest("label").hidden = true; }
    var createInput = one("[data-costing-new-catalog-fy]"); if (createInput) { createInput.hidden = true; if (createInput.closest("label")) createInput.closest("label").hidden = true; }
    var createButton = one("[data-costing-new-catalog]"); if (createButton) createButton.hidden = true;
    var heading = one("#cost-catalog-title"); if (heading) { heading.textContent = "Rate Items"; var eyebrow = heading.parentNode && heading.parentNode.querySelector(".uos-eyebrow"); if (eyebrow) eyebrow.textContent = "Cost Library"; }
    var drawer = one('[data-filter-drawer="costing-catalog"]');
    var drawerToggle = drawer && drawer.querySelector("[data-filter-drawer-toggle]");
    if (drawerToggle) { drawerToggle.setAttribute("aria-label", "Toggle global Rate Item library information"); var lead = drawerToggle.querySelector(".program-filter-drawer-toggle__lead span"); if (lead) lead.textContent = "Rate Item Library"; }
    var currentLabel = one("[data-costing-catalog-fy-summary] .program-costing-catalog-current__label"); if (currentLabel) currentLabel.textContent = "Library scope";
    setText("[data-costing-catalog-current-owner]", "Global");
    setText("[data-costing-catalog-current-fy]", "Reusable library");
    setText("[data-costing-catalog-drawer-fy]", "Global Rate Items");
    setText("[data-costing-catalog-current-lock]", "Editable");
    var summary = one("[data-costing-catalog-fy-summary]");
    if (summary) {
      summary.classList.remove("is-locked");
      summary.setAttribute("aria-label", "Global reusable Rate Item library, editable");
    }
  }

 function compareRateText(left, right) {
 var result = text(left).localeCompare(text(right), "en-AU", { sensitivity: "base", numeric: true });
 if (result) return result;
 return text(left).localeCompare(text(right), "en-AU", { numeric: true });
 }
 function compareRateItems(left, right) {
 var primary = state.rateSort === "category" ? "category" : "description";
 var secondary = primary === "category" ? "description" : "category";
 var result = compareRateText(left && left[primary], right && right[primary])
 || compareRateText(left && left[secondary], right && right[secondary])
 || compareRateText(left && left.id, right && right.id);
 return state.rateSortDirection === "desc" ? -result : result;
 }
 function renderRateSortHeaders() {
 all("[data-rate-sort]").forEach(function (control) {
 var key = control.getAttribute("data-rate-sort");
 var active = key === state.rateSort;
 var header = control.closest("th");
 var indicator = control.querySelector("[data-rate-sort-indicator]");
 if (header) header.setAttribute("aria-sort", active ? (state.rateSortDirection === "desc" ? "descending" : "ascending") : "none");
 if (indicator) indicator.textContent = active ? (state.rateSortDirection === "desc" ? "↓" : "↑") : "↕";
 control.setAttribute("aria-label", "Sort by " + key + (active ? ", currently " + state.rateSortDirection : ""));
 });
 }
  function renderCatalog() {
    var body = one("[data-costing-catalog-body]"), rawValues = rateValues(), job = currentJob(); clear(body);
    if (!body) return;
    var selectedProject = getCostingProjects(state.mode === "events" ? "EVT" : "NSA").find(function (p) { return p.id === state.selectedProjectId; }) || entities("projects").find(function (p) { return p.id === state.selectedProjectId; }) || null;
    var mappedIds = root.UOS && root.UOS.WorkAreaService && typeof root.UOS.WorkAreaService.mappedRateIds === "function"
      ? root.UOS.WorkAreaService.mappedRateIds(state.workspace)
      : [];
    var mappedMap = Object.create(null);
    mappedIds.forEach(function (id) { mappedMap[id] = true; });
    rawValues.forEach(function (rate) { if (isPolygonRate(rate)) mappedMap[rate.id] = true; });

    var values = rawValues.slice().sort(function (a, b) {
      var aPair = Number.isFinite(Number(a && a.catalogPairOrder)) ? Number(a.catalogPairOrder) : Number.MAX_SAFE_INTEGER;
      var bPair = Number.isFinite(Number(b && b.catalogPairOrder)) ? Number(b.catalogPairOrder) : Number.MAX_SAFE_INTEGER;
      if (aPair !== bPair) return aPair - bPair;
      if (aPair !== Number.MAX_SAFE_INTEGER) {
        var aSource = text(a.measurementSource) === "mapped" ? 0 : 1;
        var bSource = text(b.measurementSource) === "mapped" ? 0 : 1;
        return aSource - bSource || text(a.id).localeCompare(text(b.id));
      }
      var aMap = Boolean(a && a.id && mappedMap[a.id]);
      var bMap = Boolean(b && b.id && mappedMap[b.id]);
      if (aMap !== bMap) return aMap ? -1 : 1;
      var aDesc = text(a ? (a.description || a.title) : "").toLowerCase();
      var bDesc = text(b ? (b.description || b.title) : "").toLowerCase();
      return aDesc.localeCompare(bDesc) || text(a ? a.id : "").localeCompare(text(b ? b.id : ""));
    });

 values.sort(compareRateItems);
 renderRateSortHeaders();
 values.forEach(function (rate) {
 var row = root.document.createElement("tr");
 row.setAttribute("data-rate-item-row", rate.id);
      var rateTitle = title(rate) || "Untitled rate";
      var description = root.document.createElement("td"), strong = root.document.createElement("strong");
 strong.textContent = rateTitle.replace(/[\r\n]+/g, " "); strong.setAttribute("data-uos-tooltip", rateTitle); strong.setAttribute("title", rateTitle); strong.setAttribute("aria-label", rateTitle); strong.setAttribute("data-rate-description", rate.id); strong.tabIndex = 0; strong.classList.add("program-cost-value"); description.appendChild(strong);
      var categoryCell = root.document.createElement("td"), category = root.document.createElement("span");
      var categoryLabel = text(rate.category) || "Uncategorised";
 category.className = "program-category-pill"; category.setAttribute("data-category-colour", String(categoryColour(categoryLabel))); category.setAttribute("data-category-full-label", categoryLabel); category.setAttribute("data-rate-category", rate.id); category.textContent = categoryPillLabel(categoryLabel); category.setAttribute("data-uos-tooltip", categoryLabel); category.setAttribute("title", categoryLabel); category.setAttribute("aria-label", "Category: " + categoryLabel); categoryCell.appendChild(category);
      var unit = root.document.createElement("td"); var unitValue = root.document.createElement("span"); unitValue.className = "program-cost-value"; unitValue.textContent = formatUnitType(rate.unit, rate.quantityKind || rate.quantityMode || (rate.payload && (rate.payload.quantityKind || rate.payload.quantityMode))); unit.appendChild(unitValue);
      var amount = root.document.createElement("td"); var rateValue = root.document.createElement("span"); rateValue.className = "program-cost-value"; rateValue.textContent = money(rate.unitRate); amount.appendChild(rateValue);
      var statusCell = root.document.createElement("td"), status = root.document.createElement("span"), statusLabel = active(rate) ? "Active" : "Inactive"; status.className = "program-rate-state" + (active(rate) ? " program-rate-state--active" : " program-rate-state--inactive"); status.textContent = statusLabel; status.setAttribute("data-uos-tooltip", statusLabel); status.setAttribute("title", statusLabel); status.setAttribute("aria-label", "State: " + statusLabel); statusCell.appendChild(status);

      var isPolygonWork = isPolygonRate(rate);
      var action = root.document.createElement("td"), actions = root.document.createElement("div");
      var add;
      if (isPolygonWork) {
        add = button("Add " + rateTitle + " to Resource Calculator. Also available through mapped polygons.", "map", "data-costing-add-rate", rate.id);
        add.classList.add("program-rate-btn--map");
      } else {
        add = button("Add " + rateTitle + " to selected job", "plus", "data-costing-add-rate", rate.id);
      }
      var canAdd = active(rate) && (Boolean(job) || Boolean(selectedProject));
      var reason = !active(rate)
        ? "Inactive rate items cannot be added to costings."
        : (!job && !selectedProject)
        ? "Select a project from the left panel to add rates."
        : isPolygonWork
        ? "Adds manually to the Resource Calculator; also available through mapped polygons."
        : "";
      add.disabled = !canAdd;
      if (reason) add.title = reason;

      var edit = button("Edit " + rateTitle, "edit", "data-costing-edit-rate", rate.id);
      var remove = button("Delete " + rateTitle, "trash", "data-costing-delete-rate", rate.id);
      actions.className = "program-rate-actions";
      if (model().schedulerEnabled(rate)) {
        var help = "Future additions of " + rateTitle + " create draft Scheduler jobs. Change this in Rate Item settings.";
        var calendar = button(help, "calendar", "data-costing-scheduler-info", rate.id);
        var info = root.document.createElement("span");
        info.className = "program-rate-scheduler-info uos-button uos-button--secondary uos-button--icon";
        info.tabIndex = 0;
        info.setAttribute("role", "img");
        info.setAttribute("aria-label", help);
        info.setAttribute("data-costing-scheduler-info", rate.id);
        info.setAttribute("data-uos-tooltip", help);
        info.setAttribute("data-uos-tooltip-pos", "top");
        info.title = help;
        info.appendChild(calendar.firstChild);
        actions.appendChild(info);
      } else {
        var slot = root.document.createElement("span"); slot.className = "program-rate-empty-slot"; slot.setAttribute("aria-hidden", "true"); actions.appendChild(slot);
      }
      actions.appendChild(add);
      actions.appendChild(edit);
      actions.appendChild(remove);
      action.appendChild(actions);
      [categoryCell, description, unit, amount, statusCell, action].forEach(function (cell) { row.appendChild(cell); });
      body.appendChild(row);
    });
    sizeCategoryColumn();
    var empty = one("[data-costing-catalog-empty]"); if (empty) empty.hidden = values.length !== 0;
    var catalogCount = one("[data-costing-catalog-summary]");
    if (catalogCount) {
      if (catalogCount) catalogCount.textContent = String(values.length);
      catalogCount.setAttribute("aria-label", values.length + (values.length === 1 ? " rate item" : " rate items"));
    }
  }
  function decorateCatalogAccessibility() { all("[data-costing-catalog-body] tr").forEach(function (row) { var cells = row.querySelectorAll("td"); if (cells.length < 5) return; var description = cells[0].querySelector("strong"), category = cells[1].querySelector(".program-category-pill"), status = cells[4].querySelector(".program-rate-state"); if (description) { var value = text(description.textContent); description.setAttribute("data-uos-tooltip", value); description.setAttribute("aria-label", value); } if (category) { var categoryValue = category.getAttribute("data-category-full-label") || text(category.textContent); category.setAttribute("data-uos-tooltip", "Category: " + categoryValue); category.setAttribute("aria-label", "Category: " + categoryValue); } if (status) { var statusValue = text(status.textContent); status.setAttribute("data-uos-tooltip", "State: " + statusValue); status.setAttribute("aria-label", "State: " + statusValue); } }); }
  function jobLabel(job) { return job ? (title(job) || job.id) : "No job selected"; }
  function getCostingProjects(targetOwner) {
    if (root.UOS && root.UOS.ProgramModel && typeof root.UOS.ProgramModel.getProjects === "function") {
      var evt = root.UOS.ProgramModel.getProjects(state.workspace, "EVT");
      var nsa = root.UOS.ProgramModel.getProjects(state.workspace, "NSA");
      var result = [];
      var seen = {};
      evt.concat(nsa).forEach(function (p) {
        if (p && p.id && !seen[p.id]) {
          seen[p.id] = true;
          result.push(p);
        }
      });
      if (!targetOwner || targetOwner === "ALL") return result;
      var filtered = result.filter(function (p) { return p.owner === targetOwner; });
      return filtered;
    }
    var projects = entities("projects");
    return projects;
  }
  function renderProjects() {
    // Sync Cost Calculator mini toolbar prerequisites
    var costingToolbar = one("[data-costing-mini-toolbar]");
    if (costingToolbar && window.UOS && window.UOS.ProgramApp && typeof window.UOS.ProgramApp.syncToolbarPrerequisites === "function") {
      var selectedPrj = (entities("projects") || []).find(function (p) { return p.id === state.selectedProjectId; });
      var ws = state.workspace;
      var hasGeom = false;
      var hasJb = false;
      if (selectedPrj && ws && ws.entities) {
        var projId = selectedPrj.id;
        hasGeom = (ws.entities.geometries || []).some(function (g) { return g.projectId === projId || (g.payload && g.payload.projectId === projId); });
        hasJb = (ws.entities.jobs || []).some(function (j) { return j.projectId === projId; });
      }
      var hasCosted = false;
      if (selectedPrj && ws && ws.entities) {
        var prjJobs = (ws.entities.jobs || []).filter(function (j) { return j.projectId === selectedPrj.id; });
        if (prjJobs.length) {
          var jIds = {};
          prjJobs.forEach(function (j) { jIds[j.id] = true; });
          hasCosted = (ws.entities.costingLines || []).some(function (cl) {
            return cl.projectId === selectedPrj.id || jIds[cl.jobId];
          });
        }
      }
      window.UOS.ProgramApp.syncToolbarPrerequisites(costingToolbar, {
        currentModule: "costing",
        hasProject: Boolean(selectedPrj),
        hasRegister: Boolean(selectedPrj && (selectedPrj.applicationId || selectedPrj.eventId)),
        hasMap: hasGeom,
        hasJobs: hasJb,
        hasCostedJobs: hasCosted,
        linkedProject: selectedPrj
      });
    }
    var list = one("[data-costing-projects-list]");
    if (!list) return;
    clear(list);
    var targetOwner = state.mode === "events" ? "EVT" : "NSA";
    var modeLabel = targetOwner === "EVT" ? "Remediation" : "Nature Strip";
    setText("[data-costing-projects-eyebrow]", modeLabel + " Projects");
    setText("#costing-projects-title", targetOwner === "EVT" ? "Remediation Delivery Projects" : "Nature Strip Delivery Projects");
    var projects = getCostingProjects(targetOwner).slice().sort(function (a, b) {
      return (a.title || a.id).localeCompare(b.title || b.id);
    });
    var projectCount = one("[data-costing-projects-count]");
    if (projectCount) {
      projectCount.textContent = String(projects.length);
      projectCount.setAttribute("aria-label", projects.length + (projects.length === 1 ? " project" : " projects"));
    }

    // Render Filter Pills into #costingStatusFilterPills / [data-status-filter-pills="costing"]
    var pillsContainer = one('[data-status-filter-pills="costing"]');
    if (pillsContainer) {
      var allCount = projects.length;
      var withJobsCount = projects.filter(function (p) { return findProjectJobs(p).length > 0; }).length;
      var noJobsCount = projects.filter(function (p) { return findProjectJobs(p).length === 0; }).length;

      var possibleStatuses = ["Draft", "Planned", "In Progress", "Complete", "Approved", "Received", "Submitted", "Under Review", "Quoted", "On Hold"];
      projects.forEach(function (p) {
        var s = text(p.status || "").trim();
        if (s && possibleStatuses.indexOf(s) < 0) possibleStatuses.push(s);
      });

      var pillsHtml = '';
      pillsHtml += '<button type="button" class="program-status-pill-filter' + (state.projectJobFilter === "all" || !state.projectJobFilter ? ' is-active' : '') + '" data-costing-job-filter="all" aria-pressed="' + String(state.projectJobFilter === "all" || !state.projectJobFilter) + '">' +
        '<span>All</span><span class="program-status-pill-count">' + allCount + '</span></button>';
      pillsHtml += '<button type="button" class="program-status-pill-filter status--planned' + (state.projectJobFilter === "with-jobs" ? ' is-active' : '') + '" data-costing-job-filter="with-jobs" aria-pressed="' + String(state.projectJobFilter === "with-jobs") + '">' +
        '<span>With Jobs</span><span class="program-status-pill-count">' + withJobsCount + '</span></button>';
      pillsHtml += '<button type="button" class="program-status-pill-filter status--draft' + (state.projectJobFilter === "no-jobs" ? ' is-active' : '') + '" data-costing-job-filter="no-jobs" aria-pressed="' + String(state.projectJobFilter === "no-jobs") + '">' +
        '<span>No Jobs</span><span class="program-status-pill-count">' + noJobsCount + '</span></button>';

      possibleStatuses.forEach(function (statusVal) {
        var slug = statusVal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        var isActive = (state.projectStatusFilters || []).indexOf(statusVal.toLowerCase()) >= 0;
        var count = projects.filter(function (p) {
          var s = text(p.status || "").trim();
          return s.toLowerCase() === statusVal.toLowerCase();
        }).length;
        if (count > 0 || isActive) {
          pillsHtml += '<button type="button" class="program-status-pill-filter status--' + esc(slug) + (isActive ? ' is-active' : '') + '" data-costing-status-filter="' + esc(statusVal) + '" aria-pressed="' + String(isActive) + '">' +
            '<span>' + esc(statusVal) + '</span><span class="program-status-pill-count">' + count + '</span></button>';
        }
      });

      pillsContainer.innerHTML = pillsHtml;

      var badge = one('[data-filter-drawer-badge="costing"]');
      if (badge) {
        var actCount = (state.projectSearchQuery ? 1 : 0) + (state.projectJobFilter && state.projectJobFilter !== "all" ? 1 : 0) + (state.projectStatusFilters ? state.projectStatusFilters.length : 0);
        badge.textContent = String(actCount);
        badge.hidden = (actCount === 0);
      }
    }

    var visibleProjects = projects.filter(function (p) {
      if (state.projectJobFilter === "with-jobs" && findProjectJobs(p).length === 0) return false;
      if (state.projectJobFilter === "no-jobs" && findProjectJobs(p).length > 0) return false;
      if (state.projectStatusFilters && state.projectStatusFilters.length > 0) {
        var s = (p.status || "Draft").toLowerCase();
        if (state.projectStatusFilters.indexOf(s) < 0) return false;
      }
      if (state.projectSearchQuery) {
        var q = state.projectSearchQuery;
        var t = (p.title || p.name || "").toLowerCase();
        var id = (p.id || "").toLowerCase();
        var aid = (p.applicationId || "").toLowerCase();
        var eid = (p.eventId || "").toLowerCase();
        var loc = projectAddress(p).toLowerCase();
        if (t.indexOf(q) < 0 && id.indexOf(q) < 0 && aid.indexOf(q) < 0 && eid.indexOf(q) < 0 && loc.indexOf(q) < 0) return false;
      }
      return true;
    });

    if (!projects.length) {
      var emptyNotice = root.document.createElement("div");
      emptyNotice.className = "program-cost-empty";
      var titleNotice = root.document.createElement("strong");
      titleNotice.textContent = "No " + modeLabel.toLowerCase() + " projects";
      var pNotice = root.document.createElement("p");
      pNotice.textContent = "Promote " + (targetOwner === "EVT" ? "EVT events" : "NSA applications") + " in the Register to create delivery projects here.";
      emptyNotice.appendChild(titleNotice);
      emptyNotice.appendChild(pNotice);
      list.appendChild(emptyNotice);
      return;
    }

    if (!visibleProjects.length) {
      var emptyFilterNotice = root.document.createElement("div");
      emptyFilterNotice.className = "program-cost-empty";
      var titleFilterNotice = root.document.createElement("strong");
      titleFilterNotice.textContent = "No matching projects";
      var pFilterNotice = root.document.createElement("p");
      pFilterNotice.textContent = "No " + modeLabel.toLowerCase() + " delivery projects match your search or filter set.";
      emptyFilterNotice.appendChild(titleFilterNotice);
      emptyFilterNotice.appendChild(pFilterNotice);
      list.appendChild(emptyFilterNotice);
      return;
    }

    if (visibleProjects.length && (!state.selectedProjectId || !visibleProjects.some(function (p) { return p.id === state.selectedProjectId; }))) {
      state.selectedProjectId = visibleProjects[0].id;
    }
    visibleProjects.forEach(function (project) {
      var card = root.document.createElement("div");
      var isSelected = project.id === state.selectedProjectId;
      card.className = "program-costing-project-card" + (isSelected ? " is-selected" : "");
      card.setAttribute("data-costing-project-id", project.id);
      card.setAttribute("data-owner", project.owner === "EVT" ? "EVT" : "NSA");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      var head = root.document.createElement("div");
      head.className = "program-costing-project-card__head";

      var headLeft = root.document.createElement("div");
      headLeft.className = "program-costing-project-card__head-left";

      var badge = root.document.createElement("div");
      var owner = project.owner === "EVT" ? "EVT" : "NSA";
      badge.className = "program-costing-project-card__icon-badge program-costing-project-card__icon-badge--" + owner.toLowerCase();
      badge.innerHTML = owner === "EVT"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m12 13 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2-1.5-1.5 2-.3Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';

      var titleEl = root.document.createElement("strong");
      titleEl.className = "program-costing-project-card__title";
      titleEl.textContent = title(project) || project.id;

      headLeft.appendChild(badge);
      headLeft.appendChild(titleEl);

      var statusSpan = root.document.createElement("span");
      statusSpan.className = "program-costing-project-card__status";
      statusSpan.innerHTML = statusPillHtml(project.status || "Draft");

      head.appendChild(headLeft);
      head.appendChild(statusSpan);

      var regIdVal = project.applicationId || project.eventId || "";
      var div1 = root.document.createElement("div");
      div1.className = "program-costing-project-card__divider";

      var idsEl = root.document.createElement("div");
      idsEl.className = "program-costing-project-card__ids";
      idsEl.innerHTML = (regIdVal ?
        '<div class="program-costing-project-card__id-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-costing-project-card__id-icon"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg><span class="program-costing-project-card__id-label">Register ID:</span><span class="program-costing-project-card__id-value">' + esc(regIdVal) + '</span></div>' : '') +
        '<div class="program-costing-project-card__id-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-costing-project-card__id-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span class="program-costing-project-card__id-label">Project ID:</span><span class="program-costing-project-card__id-value">' + esc(project.id) + '</span></div>';

      var div2 = root.document.createElement("div");
      div2.className = "program-costing-project-card__divider";

      var locSec = root.document.createElement("div");
      locSec.className = "program-costing-project-card__loc-section";
      locSec.innerHTML = '<div class="program-costing-project-card__loc-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-costing-project-card__loc-pin"><path d="M12 21.7C17.3 17 20 13 20 9a8 8 0 1 0-16 0c0 4 2.7 8 8 12.7z"/><circle cx="12" cy="9" r="3"/></svg><span class="program-costing-project-card__loc-text">' + esc(projectAddress(project) || "No location specified") + '</span></div>';

      var costingLines = findProjectCostingLines(project);
      var meta = root.document.createElement("div");
      meta.className = "program-costing-project-card__meta";
      var lineItemsSpan = root.document.createElement("span");
      lineItemsSpan.className = "program-card-pill program-card-pill--loc";
      lineItemsSpan.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="program-card-pill-icon"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg><span>' + (costingLines.length === 1 ? "1 Line item" : costingLines.length + " Line items") + '</span>';
      meta.appendChild(lineItemsSpan);

      card.appendChild(head);
      card.appendChild(div1);
      card.appendChild(idsEl);
      card.appendChild(div2);
      card.appendChild(locSec);
      card.appendChild(meta);

      list.appendChild(card);
    });
  }
  function renderMapped() {
    var panel = one("[data-costing-mapped]"), form = one("[data-costing-map-form]"), geometries = entities("geometries"); if (!panel || !form) return;
    panel.hidden = geometries.length === 0; if (!geometries.length) return;
    var geometrySelect = form.elements.geometryId, rateSelect = form.elements.rateId, retainedGeometry = geometrySelect.value, retainedRate = rateSelect.value; clear(geometrySelect); clear(rateSelect);
    geometries.forEach(function (geometry) { var option = root.document.createElement("option"); option.value = geometry.id; option.textContent = title(geometry) || geometry.id; geometrySelect.appendChild(option); });
    if (geometries.some(function (geometry) { return geometry.id === retainedGeometry; })) geometrySelect.value = retainedGeometry;
    var selectedGeometry = geometries.find(function (geometry) { return geometry.id === geometrySelect.value; }) || geometries[0];
    entities("rateItems").filter(active).forEach(function (rate) { var option = root.document.createElement("option"); option.value = rate.id; option.textContent = title(rate) + " · " + (rate.unit || "unit"); rateSelect.appendChild(option); });
    if (Array.prototype.some.call(rateSelect.options, function (option) { return option.value === retainedRate; })) rateSelect.value = retainedRate;
    var submit = form.querySelector("button[type='submit']"); if (submit) { submit.disabled = !rateSelect.options.length; submit.title = rateSelect.options.length ? "" : "No compatible active rates are available for this polygon."; }
  }
  function renderCalculator() {
    var drawerUI = root.UOS.ProgramDrawerWorkspace, position = drawerUI && drawerUI.captureCostingPosition();
    var rootNode = one('[data-program-view="costing"]');
    if (rootNode) rootNode.setAttribute("data-costing-position-context", state.selectedProjectId);
    var selectedProject = getCostingProjects(state.mode === "events" ? "EVT" : "NSA").find(function (p) { return p.id === state.selectedProjectId; }) || entities("projects").find(function (p) { return p.id === state.selectedProjectId; }) || null;
    var projectJobs = selectedProject ? findProjectJobs(selectedProject) : [];
    var job = currentJob();
    if (job && (!selectedProject || job.projectId !== selectedProject.id)) job = null;

    var lines = selectedProject ? entities("costingLines").filter(function (line) { return line.projectId === selectedProject.id; }) : [];

    var body = one("[data-costing-lines]"); if (!body) return; clear(body);
    var calcTitle = job ? jobLabel(job) : (selectedProject ? title(selectedProject) : "Select a job");
    setText("#costing-title", "Assigned Rate Items");
    var lineCount = one("[data-costing-lines-count]");
    if (lineCount) {
      if (lineCount) lineCount.textContent = String(lines.length);
      lineCount.setAttribute("aria-label", lines.length + (lines.length === 1 ? " costing line" : " costing lines"));
    }
    var displayJob = job || (projectJobs[0] || null);
    var payload = displayJob && displayJob.payload || {};
    var displayDate = displayJob && (displayJob.startDate || payload.date);
    var formatDate = root.UOS && root.UOS.imports && root.UOS.imports.formatDate;
    [["id", displayJob && displayJob.id], ["name", selectedProject ? title(selectedProject) : jobLabel(displayJob)], ["location", displayJob && (displayJob.location || payload.location)], ["date", formatDate ? formatDate(displayDate) : (text(displayDate) || "—")]].forEach(function (entry) { setText('[data-costing-meta="' + entry[0] + '"]', text(entry[1]) || "—"); });
    lines.sort(function (a, b) { var ar = entities("rateItems").find(function (item) { return item.id === a.rateItemId; }); var br = entities("rateItems").find(function (item) { return item.id === b.rateItemId; }); return rateSection(ar).localeCompare(rateSection(br)); });
    var currentKind = "";
    lines.forEach(function (line) {
      var lineRate = entities("rateItems").find(function (item) { return item.id === line.rateItemId; }); var lineKind = model().lineKind(state.workspace, line);
 if (lineKind !== currentKind) {
   currentKind = lineKind;
   var groupRow = root.document.createElement("tr");
   groupRow.className = "program-costing-line-group";
   groupRow.setAttribute("data-costing-line-group", lineKind);
   var groupCell = root.document.createElement("th"), groupLabel = root.document.createElement("span");
   groupCell.scope = "rowgroup";
   groupCell.colSpan = 7;
   groupLabel.className = "program-costing-line-group__label";
   var sectionIcon = one('[data-costing-section="' + lineKind + '"] svg');
   if (sectionIcon) groupLabel.appendChild(sectionIcon.cloneNode(true));
   var labelText = root.document.createElement("span");
   labelText.textContent = lineKind.toUpperCase();
   groupLabel.appendChild(labelText);
   groupCell.appendChild(groupLabel);
   groupRow.appendChild(groupCell);
   body.appendChild(groupRow);
 }
      var row = root.document.createElement("tr"), name = root.document.createElement("td"), strong = root.document.createElement("strong"); strong.textContent = title(line).replace(/[\r\n]+/g, " "); strong.setAttribute("title", title(line)); strong.setAttribute("data-uos-tooltip", title(line)); strong.classList.add("program-cost-value"); name.appendChild(strong);
      name.className = "program-calculator-line-item";
      var source = root.document.createElement("td"), sourceIcon = root.document.createElementNS("http://www.w3.org/2000/svg", "svg");
      var mappedSource = Boolean(line.sourceGeometryId);
      source.className = "program-cost-source";
      source.title = mappedSource ? "Space Map" : line.sourceKind === "planner" ? "Planner" : line.rateItemId ? "Cost Library" : "Resource Calculator";
      source.setAttribute("aria-label", source.title);
      sourceIcon.setAttribute("viewBox", "0 0 24 24");
      sourceIcon.setAttribute("aria-hidden", "true");
      sourceIcon.innerHTML = mappedSource
? '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'
        : line.sourceKind === "planner" ? '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 8 1 1 2-2M12 8h5m-10 5 1 1 2-2M12 13h5m-10 5 1 1 2-2M12 18h5"/>' : '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>';
      var sourceFrame = root.document.createElement("span"); sourceFrame.className = "program-cost-source-frame"; sourceFrame.appendChild(sourceIcon); source.appendChild(sourceFrame);
     var quantity = root.document.createElement("td"), quantityInput = root.document.createElement("input"); quantityInput.className = "uos-input"; quantityInput.type = "number"; quantityInput.min = "0"; quantityInput.step = "any"; quantityInput.value = line.quantity; quantityInput.setAttribute("aria-label", "Quantity for " + title(line)); quantityInput.setAttribute("data-costing-line-quantity", line.id); if (mappedSource) { quantityInput.disabled = true; quantityInput.title = "Derived from polygon — manage in Space Map"; } quantity.appendChild(quantityInput);
      var unitTd = root.document.createElement("td");
      var unitSelect = root.document.createElement("select");
      unitSelect.className = "uos-select";
      unitSelect.setAttribute("aria-label", "Unit for " + title(line));
      unitSelect.setAttribute("data-costing-line-unit", line.id);
      var currentLineUnit = text(line.unit).toLowerCase() || "each";
      var unitOpts = ["each", "hour", "day", "week", "m²", "ha", "km²", "m³", "L", "kg", "tonne", "m", "lm", "item", "count", "set"];
      if (currentLineUnit && !unitOpts.some(function(u) { return u.toLowerCase() === currentLineUnit; })) {
        unitOpts.push(line.unit);
      }
      unitOpts.forEach(function (uOpt) {
        var opt = root.document.createElement("option");
        opt.value = uOpt;
        opt.textContent = uOpt;
        if (uOpt.toLowerCase() === currentLineUnit) opt.selected = true;
        unitSelect.appendChild(opt);
      });
     if (mappedSource) { unitSelect.disabled = true; unitSelect.title = "Derived from polygon — manage in Space Map"; }
     unitTd.appendChild(unitSelect);
     var rate = root.document.createElement("td"), rateInput = root.document.createElement("input"); rateInput.className = "uos-input"; rateInput.type = "number"; rateInput.min = "0"; rateInput.step = "0.01"; rateInput.value = line.unitRate; rateInput.setAttribute("aria-label", "Unit rate for " + title(line)); rateInput.setAttribute("data-costing-line-rate", line.id); if (mappedSource) { rateInput.disabled = true; rateInput.title = "Derived from polygon — manage in Space Map"; var derivedNote = root.document.createElement("span"); derivedNote.className = "program-costing-derived-note"; derivedNote.setAttribute("data-costing-spatial-derived", line.id); derivedNote.textContent = "Derived from polygon — manage in Space Map"; name.appendChild(derivedNote); } rate.appendChild(rateInput);
      var total = root.document.createElement("td"); var totalValue = root.document.createElement("span"); totalValue.className = "program-cost-value program-cost-value--total"; totalValue.textContent = money(line.estimatedTotal); totalValue.setAttribute("data-costing-line-total", line.id); total.appendChild(totalValue);
      var action = root.document.createElement("td"); action.className = "program-calculator-actions";
      var rail = root.document.createElement("span"); rail.className = "program-calculator-action-rail";
      if (line.jobId || line.jobCreationSuspended) {
        var linkedJob = entities("jobs").find(function (item) { return item.id === line.jobId; });
        var calendar = button(linkedJob ? "Open Scheduler job for " + title(line) : "Recreate draft job for " + title(line), linkedJob && text(linkedJob.status).toLowerCase() !== "draft" && linkedJob.startDate ? "calendar-tick" : "calendar", "data-costing-line-calendar", line.id);
        calendar.title = calendar.getAttribute("aria-label");
        calendar.setAttribute("data-costing-calendar-state", linkedJob ? (linkedJob.startDate && text(linkedJob.status).toLowerCase() !== "draft" ? "scheduled" : "draft") : "suspended");
        calendar.classList.add("program-calculator-calendar");
        rail.appendChild(calendar);
      }
      rail.appendChild(button("Remove " + title(line), "trash", "data-costing-remove", line.id));
      action.appendChild(rail);
      [name, source, quantity, unitTd, rate, total, action].forEach(function (cell) { row.appendChild(cell); }); body.appendChild(row);
    });
    var empty = one("[data-costing-lines-empty]"); if (empty) empty.hidden = lines.length !== 0;
 var result = model().totals(lines, { preliminariesPercent: state.preliminaries, marginPercent: state.margin });
 setText('[data-costing-total="subtotal"]', money(result.subtotal));
 setText('[data-costing-total-label="preliminaries"]', "Preliminaries (" + percentage(result.preliminariesPercent) + ")");
 setText('[data-costing-total="preliminaries"]', money(result.preliminaries));
 setText('[data-costing-total-label="margin"]', "Margin (" + percentage(result.marginPercent) + ")");
 setText('[data-costing-total="margin"]', money(result.margin));
 setText('[data-costing-total="gst"]', money(result.gst));
    setText('[data-costing-total="grand"]', money(result.grandTotal));
    if (position) drawerUI.restoreCostingPosition(position);
  }
  function renderCategories() {
    var select = one("[data-costing-category]"); if (!select) return; var retained = state.category; while (select.options.length > 1) select.remove(1);
    Array.from(new Set(entities("rateItems").filter(function (rate) { return rateSection(rate) === state.section; }).map(function (rate) { return text(rate.category); }).filter(Boolean))).sort().forEach(function (category) { var option = root.document.createElement("option"); option.value = category; option.textContent = category; select.appendChild(option); });
    select.value = Array.prototype.some.call(select.options, function (option) { return option.value === retained; }) ? retained : "all"; state.category = select.value;
  }
  function render() {
    if (!state.workspace || !model() || !root.document) return;
    var drawerUI = root.UOS.ProgramDrawerWorkspace, position = drawerUI && drawerUI.captureCostingPosition();
    renderProjects();
    renderCatalogControls();
    renderCategories();
    renderCatalog();
    decorateCatalogAccessibility();
    renderMapped();
    renderCalculator();
    renderCalculatorTools();
    updatePillPicker();
    all("[data-costing-section]").forEach(function (tab) { tab.setAttribute("aria-selected", String(tab.getAttribute("data-costing-section") === state.section)); });
    var preliminaries = one("[data-costing-preliminaries]"), margin = one("[data-costing-margin]");
    if (preliminaries) preliminaries.value = state.preliminaries;
    if (margin) margin.value = state.margin;
    showError(state.error ? new Error(state.error) : null);
    if (position) drawerUI.restoreCostingPosition(position);
  }
  function persist(mutator) { var app = root.UOS && root.UOS.ProgramApp; if (!app || !app.updateWorkspace) return Promise.resolve(null); return app.updateWorkspace(mutator); }
  function mutate(operation) { if (!state.workspace) return Promise.resolve(null); showError(null); return persist(function (workspace) { return operation(model(), workspace); }).then(function (saved) { if (saved) root.setTimeout(function () { update(root.UOS.ProgramApp.workspace()); }, 0); return saved; }).catch(function (error) { showError(error); return null; }); }
  function addRate(id) {
    var project = entities("projects").find(function (item) { return item.id === state.selectedProjectId; });
    if (!project) { showError(new Error("Select an existing Delivery Project before adding a rate item.")); return; }
    var operationId = root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : String(Date.now()) + ":" + Math.random();
    return mutate(function (api, workspace) {
      var result = api.createWork(workspace, project.id, id, { quantity: 1, areaSqM: 1, lengthM: 1, volumeM3: 1, massKg: 1, hours: 1, workers: 1 }, { operationId: operationId });
      result.workspace.costing = Object.assign({}, result.workspace.costing, { selectedProjectId: project.id, section: state.section, mode: state.mode });
      return result;
    }).then(function (saved) {
      if (saved) root.setTimeout(function () { update(root.UOS.ProgramApp.workspace()); }, 0);
      return saved;
    });
  }
  function updateLine(id) {
    var quantity = one('[data-costing-line-quantity="' + id + '"]'), rate = one('[data-costing-line-rate="' + id + '"]'), unit = one('[data-costing-line-unit="' + id + '"]');
    mutate(function (api, workspace) {
      var changes = { quantity: quantity ? quantity.value : undefined, unitRate: rate ? rate.value : undefined, unit: unit ? unit.value : undefined };
      var line = (workspace.entities.costingLines || []).find(function (item) { return item.id === id; });
      var geometryId = line && text(line.sourceGeometryId);
      var geometry = geometryId && (workspace.entities.geometries || []).find(function (item) { return item.id === geometryId; });
      if (geometry) {
        if (!root.UOS.WorkAreaService || typeof root.UOS.WorkAreaService.syncGeometry !== "function") throw new Error("WorkAreaService is unavailable.");
        return root.UOS.WorkAreaService.syncGeometry(workspace, geometry.id);
      }
      var nextUnit = text(changes.unit).toLowerCase();
      void nextUnit;
      return api.updateLine(workspace, id, changes);
    });
  }
  function previewCalculatorTotals() {
    var subtotal = 0;
    all("[data-costing-lines] tr").forEach(function (row) {
      var quantity = row.querySelector("[data-costing-line-quantity]");
      var rate = row.querySelector("[data-costing-line-rate]");
      var total = row.querySelector("[data-costing-line-total]");
      var lineTotal = Math.max(0, Number(quantity && quantity.value) || 0) * Math.max(0, Number(rate && rate.value) || 0);
      subtotal += lineTotal;
      if (total) total.textContent = money(lineTotal);
    });
    var preliminaries = subtotal * Math.max(0, state.preliminaries) / 100;
    var margin = (subtotal + preliminaries) * Math.max(0, state.margin) / 100;
    var gst = (subtotal + preliminaries + margin) * 0.1;
 setText('[data-costing-total="subtotal"]', money(subtotal));
 setText('[data-costing-total-label="preliminaries"]', "Preliminaries (" + percentage(state.preliminaries) + ")");
 setText('[data-costing-total="preliminaries"]', money(preliminaries));
 setText('[data-costing-total-label="margin"]', "Margin (" + percentage(state.margin) + ")");
 setText('[data-costing-total="margin"]', money(margin));
    setText('[data-costing-total="gst"]', money(gst));
    setText('[data-costing-total="grand"]', money(subtotal + preliminaries + margin + gst));
  }
  function renderCalculatorTools() {
    var busy = state.bulkDeleteBusy || root.UOS.ProgramApp && root.UOS.ProgramApp.snapshot().busy;
    var lines = entities("costingLines").filter(function (line) { return line.projectId === state.selectedProjectId; });
    all("[data-calculator-delete-kind]").forEach(function (button) {
      var kind = button.getAttribute("data-calculator-delete-kind");
      button.disabled = Boolean(busy) || !lines.some(function (line) { return kind === "All" || model().lineKind(state.workspace, line) === kind; });
    });
    bulkResult(state.bulkMessages && state.bulkMessages[state.selectedProjectId] || "");
  }
  function bulkResult(message) {
    state.bulkMessages = state.bulkMessages || {};
    if (state.selectedProjectId) state.bulkMessages[state.selectedProjectId] = message || "";
    var node = one("[data-calculator-delete-result]");
    if (node) { node.textContent = message || ""; node.hidden = !message; }
  }
  function deletionSummary(result) {
    var reasons = result.retained.map(function (item) { return item.description + ": " + item.reason; });
    return result.deletedIds.length + " items eligible for deletion. " + result.retained.length + " protected items will be retained. " + result.affectedJobIds.length + " linked jobs will be deleted. " + result.affectedGeometryIds.length + " mapped work items will be affected." + (reasons.length ? "\n" + reasons.join("\n") : "");
  }
  function bulkDelete(kind) {
    if (state.bulkDeleteBusy) return Promise.resolve(null);
    var app = root.UOS.ProgramApp, projectId = state.selectedProjectId, opener = root.document.activeElement;
    if (!projectId) return Promise.resolve(null);
    state.bulkDeleteBusy = true;
    showError(null); bulkResult(""); renderCalculatorTools();
    function review() {
      var live = app.workspace();
      if (state.selectedProjectId !== projectId || text(live.workspace.selectedProjectId) !== projectId) throw new Error("Project changed. Choose a deletion action for the current Project.");
      var fingerprint = JSON.stringify(live.entities), preview = model().removeLines(live, projectId, kind);
      if (!preview.deletedIds.length) { bulkResult(deletionSummary(preview)); return Promise.resolve(null); }
      if (!root.UOS.dialogs || !root.UOS.dialogs.confirm) throw new Error("Confirmation dialog is unavailable. No items were deleted.");
      return root.UOS.dialogs.confirm({ title: kind === "All" ? "Delete all Calculator items?" : "Delete " + kind + " Calculator items?", message: deletionSummary(preview), confirmLabel: "Delete " + preview.deletedIds.length + " items", danger: true }).then(function (confirmed) {
        if (!confirmed) return null;
        if (state.selectedProjectId !== projectId || text(app.workspace().workspace.selectedProjectId) !== projectId) throw new Error("Project changed. No items were deleted.");
        if (JSON.stringify(app.workspace().entities) !== fingerprint) return review();
        var applied;
        return persist(function (workspace) {
          if (text(workspace.workspace.selectedProjectId) !== projectId || JSON.stringify(workspace.entities) !== fingerprint) { var changed = new Error("Deletion scope changed."); changed.scopeChanged = true; throw changed; }
          applied = model().removeLines(workspace, projectId, kind);
          return applied.workspace;
        }).then(function (saved) {
          if (!saved) throw new Error("Deletion was not saved.");
          update(app.workspace());
          bulkResult("Deleted " + applied.deletedIds.length + " items. Retained " + applied.retained.length + " protected items." + (applied.retained.length ? "\n" + applied.retained.map(function (item) { return item.description + ": " + item.reason; }).join("\n") : ""));
          return saved;
        }).catch(function (error) { if (error.scopeChanged) return review(); throw error; });
      });
    }
    return Promise.resolve().then(review).catch(function (error) { showError(error); bulkResult("No bulk deletion was saved. " + error.message); return null; }).finally(function () {
      state.bulkDeleteBusy = false; renderCalculatorTools();
      if (state.selectedProjectId === projectId && root.document.activeElement === root.document.body && !all('[role="dialog"],dialog[open]').some(function (dialog) { return dialog.getClientRects().length; })) {
        var target = opener && opener.isConnected && !opener.disabled ? opener : one("[data-calculator-tools-toggle]");
        if (target && target.getClientRects().length) target.focus({ preventScroll: true });
      }
    });
  }

function confirmCalculatorLineRemoval(lineId) {
 var app = root.UOS.ProgramApp, workspace = app.workspace();
 var line = (workspace.entities.costingLines || []).find(function (item) { return item.id === lineId; });
 if (!line) return removeCalculatorLine(lineId);
 var preview;
 try { preview = model().removeCalculatorLine(workspace, lineId); }
 catch (error) { showError(error); return Promise.resolve(null); }
 var labels = { costingLines: "costing line(s)", geometries: "map geometry record(s)", jobs: "linked Job(s)", quoteLines: "Draft quote line(s)" };
 var effects = Object.keys(labels).map(function (key) {
   var count = (workspace.entities[key] || []).length - (preview.entities[key] || []).length;
   return count > 0 ? count + " " + labels[key] : "";
 }).filter(Boolean);
 var retainedGeometry = line.sourceGeometryId && (preview.entities.geometries || []).some(function (geometry) { return geometry.id === line.sourceGeometryId; });
 return root.UOS.ProgramDeleteSafety.confirm({
   title: "Delete Calculator item?", confirmLabel: "Delete item",
   message: 'Delete "' + title(line) + '"? This removes ' + effects.join(", ") + '. ' + (retainedGeometry ? 'The mapped geometry remains with its linked work removed. ' : '') + 'Editable linked Draft quote totals will be refreshed. Protected financial history cannot be deleted.',
   apply: function (guard) { return removeCalculatorLine(lineId, guard); }
 });
}
function removeCalculatorLine(lineId, guard) {
    var app = root.UOS && root.UOS.ProgramApp;
    var liveWorkspace = app && typeof app.workspace === "function" ? app.workspace() : null;
    var localLine = (state.workspace && state.workspace.entities && state.workspace.entities.costingLines || []).find(function (item) { return item.id === lineId; });
    var canonicalLine = liveWorkspace && liveWorkspace.entities && liveWorkspace.entities.costingLines
      ? liveWorkspace.entities.costingLines.find(function (item) { return item.id === lineId; })
      : localLine;

  if (!canonicalLine && !localLine) {
    if (liveWorkspace) update(liveWorkspace);
    return Promise.resolve(null);
  }
  if (!canonicalLine && localLine) {
    if (liveWorkspace && root.document && typeof root.document.createElement === "function") update(liveWorkspace);
    else if (liveWorkspace) state.workspace = clone(liveWorkspace);
    var anomaly = new Error('Costing line "' + lineId + '" is no longer present in the canonical workspace. The calculator was reconciled.');
    showError(anomaly);
    if (root.document && typeof root.document.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
      root.document.dispatchEvent(new root.CustomEvent("uos:costing-sync-anomaly", {
        detail: { lineId: lineId, reason: "local-line-missing-from-canonical-workspace" }
      }));
    }
    return Promise.resolve(null);
  }

 return mutate(function (api, workspace) {
 if (guard) guard(workspace);
 var line = (workspace.entities.costingLines || []).find(function (item) { return item.id === lineId; });
      if (!line) return workspace;
      var sourceGeometryId = text(line.sourceGeometryId);
      var result;
      if (api.removeCalculatorLine) {
        result = api.removeCalculatorLine(workspace, lineId);
      } else if (sourceGeometryId) {
        if (!root.UOS.WorkAreaService || typeof root.UOS.WorkAreaService.removeGeometry !== "function") throw new Error("WorkAreaService is unavailable.");
        if (state.jobId === line.jobId) state.jobId = "";
        result = root.UOS.WorkAreaService.removeGeometry(workspace, sourceGeometryId);
      } else {
        result = api.removeLine(workspace, lineId);
      }
      result.workspace = result.workspace || {};
      result.workspace.costing = {
        jobId: state.jobId,
        section: state.section,
        mode: state.mode,
        selectedProjectId: state.selectedProjectId
      };
      result.workspace.selectedProjectId = state.selectedProjectId;
      return result;
    }).then(function (saved) {
      var reconcile = function () {
        var live = app && typeof app.workspace === "function" ? app.workspace() : null;
        if (live) update(live);
        else if (saved) update(saved);
      };
      if (typeof root.setTimeout === "function") root.setTimeout(reconcile, 0);
      else reconcile();
      return saved;
    });
  }
  function exportCsv() { if (!state.workspace) return; try { var csv = model().exportRateCsv(state.workspace), blob = new Blob([csv], { type: "text/csv;charset=utf-8" }), link = root.document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "horticulture-rate-items.csv"; link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); }, 0); } catch (error) { showError(error); } }
  function mappedWorkTypeForRate(rateId) {
    if (!rateId) return "";
    var programModel = root.UOS && root.UOS.ProgramModel;
 var supported = programModel && Array.isArray(programModel.supportedPolygonWorkTypes) ? programModel.supportedPolygonWorkTypes : [];
 var match = supported.find(function (item) {
 if (!programModel || typeof programModel.workTypeRateMapping !== "function") return false;
 return programModel.workTypeRateMapping(state.workspace, item.key).eligibleRateItemIds.indexOf(rateId) >= 0;
 });
    return match ? match.key : "";
  }
  function updateSpatialRateFields(form) {
    if (!form || !form.elements.spatialEnabled || !form.elements.workTypeKey) return;
    var enabled = form.elements.spatialEnabled.checked;
    form.elements.workTypeKey.disabled = !enabled;
    form.elements.workTypeKey.required = enabled;
  }
  function populateSpatialWorkTypes(form) {
    if (!form || !form.elements.workTypeKey) return;
    var select = form.elements.workTypeKey;
    var programModel = root.UOS && root.UOS.ProgramModel;
    var values = programModel && Array.isArray(programModel.supportedPolygonWorkTypes) ? programModel.supportedPolygonWorkTypes : [];
    clear(select);
    var placeholder = root.document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Select a work type"; select.appendChild(placeholder);
    values.forEach(function (item) { var option = root.document.createElement("option"); option.value = item.key; option.textContent = item.label; select.appendChild(option); });
  }
  function preserveRateCategoryOption(form, rate) {
    if (!form || !rate || !text(rate.category)) return;
    var select = form.elements.category;
    var exists = Array.prototype.some.call(select.options, function (option) { return option.value === text(rate.category); });
    if (!exists) { var option = root.document.createElement("option"); option.value = text(rate.category); option.textContent = text(rate.category); select.appendChild(option); }
  }
 function closeRateEditor() {
 var dialog = one("[data-costing-rate-dialog]");
 if (dialog && dialog.open) dialog.close();
 var opener = state.editorOpener;
 state.editorOpener = null;
 if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus();
 }
 function openRateEditor(id) {
 var dialog = one("[data-costing-rate-dialog]"), form = one("[data-costing-rate-form]"), rate = entities("rateItems").find(function (item) { return item.id === id; }); if (!dialog || !form) return;
 state.editorOpener = root.document.activeElement;
    form.querySelectorAll("[data-rate-guide-icon]").forEach(function (node) {
      var icon = button("", node.getAttribute("data-rate-guide-icon"), "data-rate-guide-illustration", "").firstChild;
      icon.setAttribute("focusable", "false");
      node.replaceChildren(icon);
    });
    populateSpatialWorkTypes(form); preserveRateCategoryOption(form, rate);
 state.editRateId = rate ? rate.id : ""; form.reset(); form.elements.description.value = rate ? title(rate) : ""; form.elements.kind.value = rate ? rateSection(rate) : (["Labour", "Equipment", "Material", "Contractors", "Sundry"].indexOf(state.section) >= 0 ? state.section : "Labour"); form.elements.category.value = rate && Array.prototype.some.call(form.elements.category.options, function (option) { return option.value === text(rate.category); }) ? text(rate.category) : (state.section === "Sundry" ? "Sundry" : "Preparation"); form.elements.unit.value = rate ? text(rate.unit) || "each" : "each"; form.elements.unitRate.value = rate ? Number(rate.unitRate) || 0 : ""; form.elements.quantityMode.value = rate ? text(rate.quantityMode || rate.payload && rate.payload.quantityMode || "direct") : "direct"; form.elements.active.checked = rate ? active(rate) : true; form.elements.schedulerEnabled.checked = rate ? model().schedulerEnabled(rate) : ["Labour", "Contractors"].indexOf(form.elements.kind.value) >= 0;
    var workTypeKey = rate ? mappedWorkTypeForRate(rate.id) : ""; form.elements.spatialEnabled.checked = Boolean(workTypeKey); form.elements.workTypeKey.value = workTypeKey; if (workTypeKey && form.elements.quantityMode.value === "direct") form.elements.quantityMode.value = "m2"; updateSpatialRateFields(form);
    setText("[data-costing-rate-dialog-title]", rate ? "Edit rate" : "Add rate"); setText("[data-costing-rate-submit]", rate ? "Update rate" : "Save rate"); var error = one("[data-costing-rate-error]"); if (error) error.hidden = true; dialog.showModal();
  }
  function saveRate(event) {
    event.preventDefault(); var form = event.target, input = { id: state.editRateId || undefined, owner: "", kind: form.elements.kind.value, kindSource: "user", description: form.elements.description.value, title: form.elements.description.value, category: form.elements.category.value, unit: form.elements.unit.value, unitRate: form.elements.unitRate.value, quantityMode: form.elements.quantityMode.value, schedulerEnabled: form.elements.schedulerEnabled.checked, active: form.elements.active.checked };
    if (!form.reportValidity()) return; var errorNode = one("[data-costing-rate-error]"); if (errorNode) errorNode.hidden = true;
    var mapping = { enabled: form.elements.spatialEnabled.checked, workTypeKey: form.elements.workTypeKey.value };
    persist(function (workspace) { return model().upsertRateItemWithWorkType(workspace, input, mapping); }).then(function (saved) {
      if (!saved) return;
      var app = root.UOS && root.UOS.ProgramApp;
      var liveWorkspace = app && typeof app.workspace === "function" ? app.workspace() : null;
      closeRateEditor();
      var savedWorkspace = saved && saved.entities ? saved : liveWorkspace;
      var reconcile = function () {
        var current = app && typeof app.workspace === "function" ? app.workspace() : savedWorkspace;
        if (current) update(current);
      };
      if (typeof root.setTimeout === "function") root.setTimeout(reconcile, 0); else reconcile();
    }).catch(function (error) { if (errorNode) { errorNode.textContent = error.message || String(error); errorNode.hidden = false; } });
  }
 function deleteRate(id) {
 var rate = entities("rateItems").find(function (item) { return item.id === id; });
 if (!rate) return Promise.resolve(null);
 return root.UOS.ProgramDeleteSafety.confirm({ title: "Delete rate item?", message: "Delete " + title(rate) + " from the global library? Referenced rates cannot be deleted.", confirmLabel: "Delete rate item",
   apply: function (guard) { return mutate(function (api, workspace) { guard(workspace); return api.removeRateItem(workspace, id); }); }
 });
 }
  function createMappedLine(event) {
    event.preventDefault(); var form = event.target, geometry = entities("geometries").find(function (item) { return item.id === form.elements.geometryId.value; }), rate = entities("rateItems").find(function (item) { return item.id === form.elements.rateId.value; }); if (!geometry || !rate || !root.UOS.mapCosting) return;
    var project = entities("projects").find(function (item) { return item.id === state.selectedProjectId; });
    if (!project || geometry.projectId !== project.id) { showError(new Error("Select the Geometry's Delivery Project before adding mapped work.")); return; }
    try {
      mutate(function (api, workspace) {
        void api;
        if (!root.UOS.WorkAreaService) throw new Error("WorkAreaService is unavailable.");
        workspace = root.UOS.WorkAreaService.updateGeometry(workspace, geometry.id, { rateItemId: rate.id, payload: { rateItemId: rate.id } });
        return root.UOS.WorkAreaService.syncGeometry(workspace, geometry.id);
      });
      form.reset();
    } catch (error) { showError(error); }
  }
function update(workspace) {
  var ui = workspace && workspace.workspace || {}, costing = ui.costing || {};
  var hasOuterProject = hasOwn(ui, "selectedProjectId");
  var hasCostingProject = hasOwn(costing, "selectedProjectId");
  var hasCanonicalProject = hasOuterProject || hasCostingProject;
  var incomingProjectId = hasOuterProject ? text(ui.selectedProjectId) : (hasCostingProject ? text(costing.selectedProjectId) : "");
    if (incomingProjectId && incomingProjectId !== state.selectedProjectId) {
      state.projectSearchQuery = "";
      state.projectJobFilter = "all";
      state.projectStatusFilters = [];
      var projectSearch = one("[data-costing-project-search]");
      if (projectSearch) projectSearch.value = "";
    }
    state.workspace = clone(workspace);
  var incomingJobId = text(costing.jobId);
  var incomingJobExists = incomingJobId && (workspace.entities.jobs || []).some(function (job) { return job.id === incomingJobId; });
  if (incomingJobExists) state.jobId = incomingJobId;
  else if (hasCanonicalProject && incomingProjectId !== state.selectedProjectId) state.jobId = "";
    var savedSection = { All: "Labour", Job: "Labour", Resource: "Equipment" }[costing.section] || costing.section;
 state.section = ["Labour", "Equipment", "Material", "Contractors", "Sundry"].indexOf(savedSection) >= 0 ? savedSection : state.section;
    if (ui.ownerMode === "EVT" || ui.ownerMode === "NSA") state.mode = ui.ownerMode === "EVT" ? "events" : "applications";
    else if (costing.mode === "events" || costing.mode === "applications") state.mode = costing.mode;
  if (hasCanonicalProject) state.selectedProjectId = incomingProjectId;
    var job = currentJob(), adjustments = job && job.costing || {};
    var persistedPreliminaries = Math.max(0, Number(adjustments.preliminariesPercent) || 0);
    var persistedMargin = Math.max(0, Number(adjustments.marginPercent) || 0);
    if (state.pendingAdjustments && job && state.pendingAdjustments.jobId === job.id) {
      if (persistedPreliminaries === state.pendingAdjustments.preliminaries && persistedMargin === state.pendingAdjustments.margin) state.pendingAdjustments = null;
      else {
        persistedPreliminaries = state.pendingAdjustments.preliminaries;
        persistedMargin = state.pendingAdjustments.margin;
      }
    }
    state.preliminaries = persistedPreliminaries;
    state.margin = persistedMargin;
    updatePillPicker();
    render();
  }
  function saveUi() { return persist(function (workspace) { var project = (workspace.entities.projects || []).find(function (item) { return item.id === state.selectedProjectId; }); workspace.workspace.costing = { jobId: state.jobId || null, section: state.section, mode: state.mode, selectedProjectId: project ? project.id : "" }; workspace.workspace.selectedProjectId = project ? project.id : ""; workspace.workspace.selectedEntityId = project ? (project.applicationId || project.eventId || project.id) : ""; if (project) workspace.workspace.ownerMode = project.owner; workspace.workspace.planner = workspace.workspace.planner || {}; workspace.workspace.planner.selectedProjectId = project ? project.id : ""; return workspace; }).catch(function (error) { showError(error); return null; }); }
function saveAdjustments(source) {
  var calculator = source && source.closest ? source.closest("[data-program-view='costing']") : null;
  var preliminariesInput = source && source.matches("[data-costing-preliminaries]") ? source : (calculator && calculator.querySelector("[data-costing-preliminaries]")) || one("[data-costing-preliminaries]");
  var marginInput = source && source.matches("[data-costing-margin]") ? source : (calculator && calculator.querySelector("[data-costing-margin]")) || one("[data-costing-margin]");
  var preliminaries = Math.max(0, Number(preliminariesInput && preliminariesInput.value) || 0);
  var margin = Math.max(0, Number(marginInput && marginInput.value) || 0);
  var jobId = state.jobId;
  var section = state.section;
  var mode = state.mode;
  var selectedProjectId = state.selectedProjectId;
  state.preliminaries = preliminaries;
  state.margin = margin;
  state.pendingAdjustments = { jobId: jobId, preliminaries: preliminaries, margin: margin };
  renderCalculator();
  if (!jobId || typeof model().updateJobAdjustments !== "function") {
    return Promise.resolve(null);
  }
  return mutate(function (api, workspace) {
    var result = api.updateJobAdjustments(workspace, jobId, {
      preliminariesPercent: preliminaries,
      marginPercent: margin
    });
    var selectedProject = (result.entities.projects || []).find(function (project) { return project.id === selectedProjectId; });
    result.workspace.costing = { jobId: jobId, section: section, mode: mode, selectedProjectId: selectedProjectId };
    result.workspace.selectedProjectId = selectedProjectId;
    result.workspace.selectedEntityId = selectedProject ? (selectedProject.applicationId || selectedProject.eventId || selectedProject.id) : "";
    if (selectedProject) result.workspace.ownerMode = selectedProject.owner;
    return result;
  }).then(function (saved) {
    var app = root.UOS && root.UOS.ProgramApp;
    var liveWorkspace = app && typeof app.workspace === "function" ? app.workspace() : saved;
    if (liveWorkspace) update(liveWorkspace);
    return saved;
  });
}
function bind() {
 if (state.bound || !root.document) return; state.bound = true;
 if (root.MutationObserver) new root.MutationObserver(sizeCategoryColumn).observe(root.document.documentElement, { attributes: true, attributeFilter: ["data-suite-font"] });
 if (root.document.fonts) {
   root.document.fonts.ready.then(sizeCategoryColumn);
   root.document.fonts.addEventListener("loadingdone", sizeCategoryColumn);
 }
 var toolsToggle = one("[data-costing-tools-toggle]"), toolsDrawer = one("[data-costing-tools]");
 if (toolsToggle && toolsDrawer) {
 toolsToggle.addEventListener("click", function () {
 var opening = toolsDrawer.hidden;
 toolsDrawer.hidden = !opening;
 toolsToggle.setAttribute("aria-expanded", String(opening));
      toolsToggle.setAttribute("aria-label", (opening ? "Hide" : "Show") + " Rate Library search and actions");
 if (opening) { var search = toolsDrawer.querySelector("[data-costing-search]"); if (search) search.focus(); }
 });
 toolsDrawer.addEventListener("keydown", function (event) {
 if (event.key !== "Escape") return;
 event.stopPropagation();
 toolsDrawer.hidden = true;
 toolsToggle.setAttribute("aria-expanded", "false");
      toolsToggle.setAttribute("aria-label", "Show Rate Library search and actions");
 toolsToggle.focus();
 });
 }
     var calculatorToolsToggle = one("[data-calculator-tools-toggle]"), calculatorToolsDrawer = one("[data-calculator-tools]");
    if (calculatorToolsToggle && calculatorToolsDrawer) {
      function closeCalculatorTools() { calculatorToolsDrawer.hidden = true; calculatorToolsToggle.setAttribute("aria-expanded", "false"); calculatorToolsToggle.setAttribute("aria-label", "Show Resource Calculator tools"); calculatorToolsToggle.focus({ preventScroll: true }); }
      calculatorToolsToggle.addEventListener("click", function () {
        var opening = calculatorToolsDrawer.hidden;
        calculatorToolsDrawer.hidden = !opening;
        calculatorToolsToggle.setAttribute("aria-expanded", String(opening));
        calculatorToolsToggle.setAttribute("aria-label", (opening ? "Hide" : "Show") + " Resource Calculator tools");
        if (opening) { var first = calculatorToolsDrawer.querySelector("button:not(:disabled)"); if (first) first.focus({ preventScroll: true }); }
      });
      calculatorToolsDrawer.addEventListener("keydown", function (event) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeCalculatorTools(); } });
      calculatorToolsDrawer.addEventListener("click", function (event) { var button = event.target.closest("[data-calculator-delete-kind]"); if (button && !button.disabled) bulkDelete(button.getAttribute("data-calculator-delete-kind")); });
    }

    var categoryTabs = one(".program-cost-tabs");
 var headerContent = one(".program-costing-head-content"), costingWorkspace = one(".program-costing-workspace");
 if (headerContent && costingWorkspace) {
   var syncHeaderHeight = function () {
     var title = headerContent.querySelector(".program-costing-title"), tools = headerContent.querySelector("[data-costing-tools-toggle]");
     var menuWidth = Array.prototype.reduce.call(categoryTabs.children, function (width, button) { return width + button.offsetWidth; }, 20);
     var compact = headerContent.clientWidth < title.offsetWidth + tools.offsetWidth + menuWidth + 24;
     headerContent.classList.toggle("is-compact", compact);
     costingWorkspace.style.setProperty("--calculator-panel-header-height", Math.max(52, headerContent.offsetHeight + 1) + "px");
   };
   syncHeaderHeight();
   if (root.ResizeObserver) new root.ResizeObserver(syncHeaderHeight).observe(headerContent);
   root.addEventListener("resize", syncHeaderHeight);
   if (root.document.fonts) root.document.fonts.ready.then(syncHeaderHeight);
 }
 if (categoryTabs) categoryTabs.addEventListener("keydown", function (event) {
 var tabs = all("[data-costing-section]"), current = event.target.closest("[data-costing-section]");
 if (!current || !tabs.length || ["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) < 0) return;
 event.preventDefault();
 var index = tabs.indexOf(current), next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
 tabs[next].focus(); tabs[next].click();
 });
 var rateDialog = one("[data-costing-rate-dialog]");
 if (rateDialog) {
 rateDialog.addEventListener("keydown", function (event) {
 if (event.key !== "Escape") return;
 event.preventDefault(); event.stopPropagation(); closeRateEditor();
 });
 rateDialog.addEventListener("cancel", function (event) {
 event.preventDefault(); event.stopPropagation(); closeRateEditor();
 });
 }
 root.document.addEventListener("input", function (event) {
      if (event.target.matches("[data-costing-search]")) { state.query = event.target.value; renderCatalog(); }
      else if (event.target.matches("[data-costing-project-search]")) { state.projectSearchQuery = (event.target.value || "").trim().toLowerCase(); renderProjects(); }
      else if (event.target.matches("[data-costing-line-quantity],[data-costing-line-rate]")) previewCalculatorTotals();
    });
 all("[data-costing-preliminaries],[data-costing-margin]").forEach(function (input) {
  input.addEventListener("change", function (event) {
   event.stopPropagation();
   saveAdjustments(event.target);
  });
 });
 root.document.addEventListener("change", function (event) {
  if (!event.target.matches("[data-costing-preliminaries],[data-costing-margin]")) return;
  event.stopImmediatePropagation();
  saveAdjustments(event.target);
 }, true);
 root.document.addEventListener("change", function (event) {
      if (event.target.matches("[data-costing-category]")) { state.category = event.target.value; renderCatalog(); }
  else if (event.target.matches("[data-costing-preliminaries],[data-costing-margin]")) { state.preliminaries = Math.max(0, Number(one("[data-costing-preliminaries]").value) || 0); state.margin = Math.max(0, Number(one("[data-costing-margin]").value) || 0); if (state.jobId && typeof model().updateJobAdjustments === "function") mutate(function (api, workspace) { var result = api.updateJobAdjustments(workspace, state.jobId, { preliminariesPercent: state.preliminaries, marginPercent: state.margin }); var selectedProject = (result.entities.projects || []).find(function (project) { return project.id === state.selectedProjectId; }); result.workspace.costing = { jobId: state.jobId, section: state.section, mode: state.mode, selectedProjectId: state.selectedProjectId }; result.workspace.selectedProjectId = state.selectedProjectId; result.workspace.selectedEntityId = selectedProject ? (selectedProject.applicationId || selectedProject.eventId || selectedProject.id) : ""; if (selectedProject) result.workspace.ownerMode = selectedProject.owner; return result; }); else renderCalculator(); }
      else if (event.target.matches("[data-costing-line-quantity],[data-costing-line-rate],[data-costing-line-unit]")) updateLine(event.target.getAttribute("data-costing-line-quantity") || event.target.getAttribute("data-costing-line-rate") || event.target.getAttribute("data-costing-line-unit"));
    });
     root.document.addEventListener("click", function (event) {
      var calendar = event.target.closest("[data-costing-line-calendar]");
      if (calendar) {
        var lineId = calendar.getAttribute("data-costing-line-calendar");
        var line = entities("costingLines").find(function (item) { return item.id === lineId; });
        var ready = line.jobId ? Promise.resolve(state.workspace) : mutate(function (api, workspace) { return api.recreateWorkJob(workspace, lineId); });
        ready.then(function (saved) {
          if (!saved) return;
          var exact = saved.entities.costingLines.find(function (item) { return item.id === lineId; });
          var app = root.UOS.ProgramApp;
          return app.navigateWithContext("scheduler", exact.jobId).then(function () {
            return root.UOS.ProgramSchedulerUI.focusCalendarJob(exact.jobId);
          });
        }).catch(showError);
      }
    });
root.document.addEventListener("click", function (event) {
 var sortControl = event.target.closest("[data-rate-sort]");
 if (sortControl) {
 var sortKey = sortControl.getAttribute("data-rate-sort");
 if (sortKey === "category" || sortKey === "description") {
 if (state.rateSort === sortKey) state.rateSortDirection = state.rateSortDirection === "asc" ? "desc" : "asc";
 else { state.rateSort = sortKey; state.rateSortDirection = "asc"; }
 renderCatalog();
 return;
 }
 }
 var costingJump = event.target.closest("[data-costing-toolbar-jump],[data-costing-jump]");
      if (costingJump && root.UOS && root.UOS.ProgramApp) {
        var jumpDest = costingJump.getAttribute("data-costing-toolbar-jump") || costingJump.getAttribute("data-costing-jump");
        var prjs = getCostingProjects(state.mode === "events" ? "EVT" : "NSA");
        var activePrj = prjs.find(function (p) { return p.id === state.selectedProjectId; }) || null;
        if (typeof root.UOS.ProgramApp.navigateWithContext === "function") {
          root.UOS.ProgramApp.navigateWithContext(jumpDest, state.jobId || (activePrj && activePrj.id));
          return;
        }
        root.UOS.ProgramApp.updateWorkspace(function (candidate) {
          candidate.workspace = candidate.workspace || {};
          if (activePrj) {
            candidate.workspace.selectedProjectId = activePrj.id;
            candidate.workspace.selectedEntityId = activePrj.applicationId || activePrj.eventId || activePrj.id;
            if (activePrj.owner === "NSA" || activePrj.owner === "EVT") candidate.workspace.ownerMode = activePrj.owner;
          }
          if (state.jobId) candidate.workspace.selectedJobId = state.jobId;
          if (jumpDest === "scheduler") {
            candidate.workspace.scheduler = candidate.workspace.scheduler || {};
            if (activePrj) candidate.workspace.scheduler.selectedProjectId = activePrj.id;
            if (state.jobId) candidate.workspace.scheduler.selectedId = state.jobId;
          }
          return candidate;
        }).then(function () {
          root.UOS.ProgramApp.navigate(jumpDest);
        });
        return;
      }
      var jobFilterBtn = event.target.closest("[data-costing-job-filter]");
      if (jobFilterBtn) {
        var jf = jobFilterBtn.getAttribute("data-costing-job-filter");
        state.projectJobFilter = state.projectJobFilter === jf ? "all" : jf;
        renderProjects();
        return;
      }
      var statusFilterBtn = event.target.closest("[data-costing-status-filter]");
      if (statusFilterBtn) {
        var sf = (statusFilterBtn.getAttribute("data-costing-status-filter") || "").toLowerCase();
        state.projectStatusFilters = state.projectStatusFilters || [];
        var idx = state.projectStatusFilters.indexOf(sf);
        if (idx >= 0) state.projectStatusFilters.splice(idx, 1);
        else state.projectStatusFilters.push(sf);
        renderProjects();
        return;
      }
      var tab = event.target.closest("[data-costing-section]"), modeBtn = event.target.closest("[data-costing-pane-mode]"), add = event.target.closest("[data-costing-add-rate]"), assign = event.target.closest("[data-costing-assign]"), remove = event.target.closest("[data-costing-remove]"), editRate = event.target.closest("[data-costing-edit-rate]"), deleteRateButton = event.target.closest("[data-costing-delete-rate]"), projCard = event.target.closest("[data-costing-project-id]");
          // Expanding a project also loads its saved calculator lines. The
          // shared mini-drawer contract updates those panes without replacing
          // the row, then persists after the one opening motion has settled.
      if (projCard && event.target.closest("[data-disclosure-toggle]")) {
        var disclosureToggle = event.target.closest("[data-disclosure-toggle]");
        var disclosureKey = disclosureToggle.getAttribute("data-disclosure-key");
        if (disclosureToggle.getAttribute("aria-expanded") !== "true") return;
        state.selectedProjectId = projCard.getAttribute("data-costing-project-id");
        state.jobId = "";
        all("[data-costing-project-id]").forEach(function (card) { card.classList.toggle("is-selected", card === projCard); });
        renderCatalogControls(); renderCategories(); renderCatalog(); renderMapped(); renderCalculator();
        var disclosureApi = root.UOS && root.UOS.ProgramDisclosureRows;
        if (!disclosureApi || typeof disclosureApi.afterOpen !== "function" || !disclosureApi.afterOpen(disclosureKey, saveUi)) saveUi();
        return;
      }
      if (projCard) {
        state.selectedProjectId = projCard.getAttribute("data-costing-project-id");
        state.jobId = "";
        render(); saveUi();
      }
      else if (modeBtn) { state.mode = modeBtn.getAttribute("data-costing-pane-mode") === "events" ? "events" : "applications"; state.selectedProjectId = ""; updatePillPicker(); render(); saveUi(); }
      else if (tab) { state.section = tab.getAttribute("data-costing-section"); state.category = "all"; renderCategories(); renderCatalog(); all("[data-costing-section]").forEach(function (item) { var selected = item === tab; item.setAttribute("aria-selected", String(selected)); item.tabIndex = selected ? 0 : -1; }); saveUi(); }
      else if (add && !add.disabled && add.getAttribute("aria-disabled") !== "true") {
        add.disabled = true;
        add.setAttribute("aria-disabled", "true");
        var addPromise = addRate(add.getAttribute("data-costing-add-rate"));
        if (addPromise && typeof addPromise.finally === "function") {
          addPromise.finally(function () {
            if (add) {
              add.disabled = false;
              add.removeAttribute("aria-disabled");
            }
          });
        } else {
          add.disabled = false;
          add.removeAttribute("aria-disabled");
        }
      }
      else if (assign) mutate(function (api, workspace) { return api.assignLine(workspace, assign.getAttribute("data-costing-assign"), state.jobId); });
      else if (remove && !remove.disabled && remove.getAttribute("aria-disabled") !== "true") {
        remove.disabled = true;
        remove.setAttribute("aria-disabled", "true");
 var removePromise = confirmCalculatorLineRemoval(remove.getAttribute("data-costing-remove"));
        if (removePromise && typeof removePromise.finally === "function") {
          removePromise.finally(function () {
            if (remove) {
              remove.disabled = false;
              remove.removeAttribute("aria-disabled");
            }
          });
        } else {
          remove.disabled = false;
          remove.removeAttribute("aria-disabled");
        }
      }
      else if (event.target.closest("[data-costing-add-item]")) openRateEditor("");
      else if (editRate) openRateEditor(editRate.getAttribute("data-costing-edit-rate"));
      else if (deleteRateButton) deleteRate(deleteRateButton.getAttribute("data-costing-delete-rate"));
      else if (event.target.closest("[data-costing-rate-cancel]")) closeRateEditor();
      else if (event.target.closest("[data-costing-export]")) exportCsv();
    });
    var rateForm = one("[data-costing-rate-form]"); if (rateForm) { rateForm.addEventListener("submit", saveRate); rateForm.addEventListener("change", function (event) { if (event.target.matches("[data-costing-rate-spatial]")) updateSpatialRateFields(rateForm); }); }
    var mapForm = one("[data-costing-map-form]"); if (mapForm) { mapForm.addEventListener("submit", createMappedLine); mapForm.addEventListener("change", function (event) { if (event.target.name === "geometryId") renderMapped(); }); }
  root.document.addEventListener("uos:program-ready", function (event) {
    var detail = event.detail || {};
    var workspace = detail.workspace || detail.after;
    if (!workspace) {
      var app = root.UOS && root.UOS.ProgramApp;
      workspace = app && typeof app.workspace === "function" ? app.workspace() : null;
    }
    if (!workspace || !workspace.workspace) return;
    var currentDest = workspace.workspace.destination;
    var isCostingActive = currentDest === "costing" || (root.document && root.document.querySelector('[data-program-view="costing"]:not([hidden])'));
    if (!isCostingActive) return;
    update(workspace);
  });
  root.document.addEventListener("uos:workspace-changed", function (event) {
    var detail = event.detail || {};
    var workspace = detail.workspace || detail.after;
    if (!workspace) {
      var app = root.UOS && root.UOS.ProgramApp;
      workspace = app && typeof app.workspace === "function" ? app.workspace() : null;
    }
    if (!workspace || !workspace.workspace) return;
    // Keep linked Job indicators current even while Scheduler is the active view.
    update(workspace);
  });
  }
  if (root.document) { if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", bind, { once: true }); else bind(); }
  return { update: update, render: render, rateValues: rateValues, exportCsv: exportCsv, removeCalculatorLine: removeCalculatorLine, snapshot: function () { return clone(state); } };
}));
