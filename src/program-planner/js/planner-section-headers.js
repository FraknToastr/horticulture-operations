(function () {
  "use strict";

  var collapsed = Object.create(null);
  var processing = false;
  var labels = ["Status", "Owner", "Due", "Notes"];

  function sectionId(section) {
    return "planner-section-" + section.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function createToggle(section) {
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "planner-section-toggle";
    toggle.setAttribute("data-planner-section-toggle", section);
    toggle.setAttribute("aria-controls", sectionId(section));

    var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "planner-section-toggle__icon");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M6 9l6 6 6-6");
    icon.appendChild(path);
    toggle.appendChild(icon);
    return toggle;
  }

  function setExpandedState(row, section) {
    var expanded = !collapsed[section];
    row.setAttribute("aria-expanded", String(expanded));
    var button = row.querySelector("[data-planner-section-toggle]");
    if (!button) return;
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", (expanded ? "Collapse " : "Expand ") + section + " section");
  }

  function mergeHeader(row, section, text) {
    var count = text.indexOf(" · ") >= 0 ? text.slice(text.indexOf(" · ")) : "";
    row.innerHTML = "";
    var first = document.createElement("th");
    first.scope = "col";
    first.className = "planner-section-heading";
    first.textContent = section.toUpperCase() + count;
    row.appendChild(first);

    labels.forEach(function (label) {
      var cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      row.appendChild(cell);
    });

    var actions = document.createElement("th");
    actions.scope = "col";
    actions.className = "planner-section-actions";
    actions.appendChild(createToggle(section));
    row.appendChild(actions);
    row.setAttribute("data-planner-merged", "true");
  }

  function applySections() {
    if (processing) return;
    var table = document.querySelector(".planner-table");
    if (!table) return;
    processing = true;
    var rows = Array.prototype.slice.call(table.querySelectorAll("tbody tr"));
    var section = null;
    rows.forEach(function (row) {
      if (row.classList.contains("planner-cat-header-row")) {
        var text = (row.textContent || "").trim();
        section = row.getAttribute("data-planner-section") || text.split(" · ")[0] || text;
        row.setAttribute("data-planner-section", section);
        if (!row.hasAttribute("data-planner-merged")) mergeHeader(row, section, text);
        setExpandedState(row, section);
        return;
      }
      if (section) {
        row.setAttribute("data-planner-section-row", section);
        row.hidden = Boolean(collapsed[section]);
      }
    });
    processing = false;
  }

  document.addEventListener("click", function (event) {
    var toggle = event.target.closest && event.target.closest("[data-planner-section-toggle]");
    if (!toggle) return;
    var section = toggle.getAttribute("data-planner-section-toggle");
    collapsed[section] = !collapsed[section];
    applySections();
  });

  var host = document.querySelector("[data-program-view=planner]");
  if (host && window.MutationObserver) {
    new MutationObserver(applySections).observe(host, { childList: true, subtree: true });
  }
  document.addEventListener("uos:program-ready", applySections);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applySections);
  else applySections();
})();
