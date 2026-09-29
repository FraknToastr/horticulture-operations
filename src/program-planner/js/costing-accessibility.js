(function () {
  "use strict";
  function decorate() {
    document.querySelectorAll("[data-costing-catalog-body] tr").forEach(function (row) {
      var cells = row.querySelectorAll("td");
      if (cells.length < 5) return;
      var description = cells[0].querySelector("strong");
      var category = cells[1].querySelector(".program-category-pill");
      var status = cells[4].querySelector(".program-rate-state");
      if (description) { var descriptionValue = description.textContent.trim(); description.setAttribute("data-uos-tooltip", descriptionValue); description.setAttribute("aria-label", descriptionValue); }
      if (category) { var categoryValue = category.textContent.trim(); category.setAttribute("data-uos-tooltip", "Category: " + categoryValue); category.setAttribute("aria-label", "Category: " + categoryValue); }
      if (status) { var statusValue = status.textContent.trim(); status.setAttribute("data-uos-tooltip", "State: " + statusValue); status.setAttribute("aria-label", "State: " + statusValue); }
      row.querySelectorAll("[data-costing-add-rate], [data-costing-edit-rate], [data-costing-delete-rate]").forEach(function (button) { var label = button.getAttribute("aria-label") || button.getAttribute("title") || "Rate Item action"; button.setAttribute("data-uos-tooltip", label); button.setAttribute("title", label); });
    });
  }
  function bind() {
    var body = document.querySelector("[data-costing-catalog-body]");
    if (!body) return;
    decorate();
    new MutationObserver(decorate).observe(body, { childList: true });
  }
  document.addEventListener("uos:program-ready", bind);
  if (document.readyState !== "loading") bind(); else document.addEventListener("DOMContentLoaded", bind, { once: true });
}());
