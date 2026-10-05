(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.UOS = root.UOS || {}; root.UOS.ProgramReports = api; }
}(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  var UOS = root.UOS = root.UOS || {};
  function money(value) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(Number(value) || 0); }
  function customerMoney(value) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0); }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function cell(row, value, className) { var node = document.createElement("td"); node.textContent = String(value); if (className) node.className = className; row.appendChild(node); }
  function ownerBadge(owner, label) { var node = document.createElement("span"); node.className = "program-report-owner"; node.dataset.owner = owner; node.textContent = "[" + label + "]"; return node; }
  function renderDonut(summary, root) {
    var host = root.querySelector("[data-reports-donut]");
    if (!host) return;
    clear(host);
    var finances = summary.finances;
    var composition = UOS.ProgramReportsModel.budgetComposition(finances);
    var figure = document.createElement("figure"); figure.className = "program-report-donut-figure";
    var chart = document.createElement("div"); chart.className = "program-report-donut"; chart.setAttribute("role", "img");
    chart.style.setProperty("--report-actual-end", composition.actualEnd + "%");
    chart.style.setProperty("--report-committed-end", composition.committedEnd + "%");
    chart.style.setProperty("--report-spare-end", composition.spareEnd + "%");
    chart.setAttribute("aria-label", "Budget composition: actual " + money(finances.actualSpend) + ", committed " + money(finances.committedBudget) + ", spare " + money(finances.spareFunds) + (composition.overrun ? ", over budget by " + money(composition.overrun) : "") + ".");
    var centre = document.createElement("span"); centre.textContent = money(composition.used); centre.setAttribute("aria-hidden", "true"); chart.appendChild(centre);
    var caption = document.createElement("figcaption"), legend = document.createElement("dl"); legend.className = "program-report-donut-legend";
    [["actual", "Actual", finances.actualSpend], ["committed", "Committed", finances.committedBudget], ["spare", "Available", finances.spareFunds]].forEach(function (entry) {
      var row = document.createElement("div"), term = document.createElement("dt"), value = document.createElement("dd"), swatch = document.createElement("i");
      swatch.dataset.reportLegend = entry[0]; swatch.setAttribute("aria-hidden", "true"); term.appendChild(swatch); term.appendChild(document.createTextNode(entry[1])); value.textContent = money(entry[2]); row.appendChild(term); row.appendChild(value); legend.appendChild(row);
    });
    if (composition.overrun) { var note = document.createElement("p"); note.className = "program-report-overrun"; note.textContent = "Over budget by " + money(composition.overrun); caption.appendChild(note); }
    caption.appendChild(legend); figure.appendChild(chart); figure.appendChild(caption); host.appendChild(figure);
  }
  function renderOwnerBars(summary, root) {
    var list = root.querySelector("[data-reports-owner-bars]");
    if (!list) return;
    clear(list);
    var maximum = Math.max(1, summary.finances.approvedBudget, summary.finances.committedBudget + summary.finances.actualSpend);
    summary.owners.forEach(function (owner) {
      var item = document.createElement("li");
      var heading = document.createElement("span"); heading.textContent = owner.label;
      var progress = document.createElement("progress");
      progress.max = maximum; progress.value = owner.committedBudget + owner.actualSpend;
      progress.setAttribute("aria-label", owner.label + " used budget " + money(progress.value) + " of " + money(owner.approvedBudget));
      var value = document.createElement("strong"); value.textContent = money(progress.value);
      item.appendChild(heading); item.appendChild(progress); item.appendChild(value); list.appendChild(item);
    });
  }
  function renderOwners(summary, root) {
    var body = root.querySelector("[data-reports-owner-body]"); if (!body) return; clear(body);
    summary.owners.forEach(function (owner) {
      var row = document.createElement("tr"), heading = document.createElement("th");
      heading.scope = "row"; heading.appendChild(ownerBadge(owner.owner, owner.label)); row.appendChild(heading);
      cell(row, owner.jobs); cell(row, money(owner.approvedBudget), "program-report-money");
      cell(row, money(owner.committedBudget), "program-report-money"); cell(row, money(owner.actualSpend), "program-report-money");
      cell(row, money(owner.spareFunds), "program-report-money"); body.appendChild(row);
    });
  }
  function renderStatuses(summary, root) {
    var body = root.querySelector("[data-reports-status-body]"); if (!body) return; clear(body);
    summary.statuses.forEach(function (status) {
      var row = document.createElement("tr"), heading = document.createElement("th"); heading.scope = "row"; heading.textContent = status.label; row.appendChild(heading);
      cell(row, status.jobs); cell(row, money(status.estimate), "program-report-money");
      cell(row, money(status.committed), "program-report-money"); cell(row, money(status.actual), "program-report-money"); body.appendChild(row);
    });
  }
  function renderJobs(summary, root) {
    var body = root.querySelector("[data-reports-job-body]"); if (!body) return; clear(body);
    summary.jobs.forEach(function (job) {
      var row = document.createElement("tr"), heading = document.createElement("th"), title = document.createElement("strong"), id = document.createElement("small");
      heading.scope = "row"; title.textContent = job.title; id.textContent = job.id; heading.appendChild(title); heading.appendChild(id); row.appendChild(heading);
      var owner = document.createElement("td"); owner.appendChild(ownerBadge(job.owner, job.ownerLabel)); row.appendChild(owner);
      cell(row, job.statusLabel); cell(row, money(job.estimate), "program-report-money"); cell(row, money(job.actual), "program-report-money");
      cell(row, job.status === "completed" ? money(job.variance) : "—", "program-report-money"); body.appendChild(row);
    });
  }
  function render(workspace, root) {
    root = root || document;
    var model = UOS.ProgramReportsModel;
    if (!model) return null;
    var summary = model.summarize(workspace);
    var fundingBody = root.querySelector("[data-reports-funding-body]");
    if (fundingBody) {
      clear(fundingBody);
      (summary.fundingPositions || []).forEach(function (position) {
        var row = document.createElement("tr");
        cell(row, position.title); cell(row, position.owner); cell(row, customerMoney(position.calculatedDeliveryCost));
        cell(row, customerMoney(position.operationalAmount)); cell(row, customerMoney(position.customerQuote));
        cell(row, position.customerAgreementStatus); cell(row, customerMoney(position.confirmedCustomerFunding));
        cell(row, customerMoney(position.customerGst)); cell(row, customerMoney(position.customerGrandTotal));
        cell(row, customerMoney(position.paymentsPaid)); cell(row, customerMoney(position.customerOutstanding));
        fundingBody.appendChild(row);
      });
    }
    ["approvedBudget", "committedBudget", "actualSpend", "spareFunds"].forEach(function (field) {
      var node = root.querySelector('[data-reports-kpi="' + field + '"]'); if (node) node.textContent = money(summary.finances[field]);
    });
    var empty = root.querySelector("[data-reports-empty]"), content = root.querySelector("[data-reports-content]");
    if (empty) empty.hidden = summary.hasData; if (content) content.hidden = !summary.hasData;
    renderDonut(summary, root); renderOwnerBars(summary, root); renderOwners(summary, root); renderStatuses(summary, root); renderJobs(summary, root);
    var live = root.querySelector("[data-reports-updated]");
    if (live) live.textContent = summary.jobCount + (summary.jobCount === 1 ? " job" : " jobs") + " · Available funding " + money(summary.finances.spareFunds);
    return summary;
  }

  var api = { render: render };
  UOS.ProgramReports = api;

  if (typeof root.document !== "undefined" && root.document && typeof root.document.addEventListener === "function") {
    root.document.addEventListener("uos:program-ready", function (event) {
      var workspace = event.detail && event.detail.workspace;
      if (!workspace || !workspace.workspace || workspace.workspace.destination !== "reports") return;
      render(workspace);
    });
  }

  return api;
}));
