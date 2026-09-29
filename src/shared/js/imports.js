(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  var script = document.currentScript;
  var pdfWorkerUrl = new URL("../vendor/pdfjs/pdf.worker.min.js", script.src);

  function readText(file, maxBytes) {
    maxBytes = maxBytes || 20 * 1024 * 1024;
    if (!file) return Promise.reject(new Error("Choose a file first."));
    if (file.size > maxBytes) return Promise.reject(new Error("The selected file is larger than the allowed " + Math.round(maxBytes / 1048576) + " MB."));
    return file.text();
  }

  function readJson(file, maxBytes) {
    return readText(file, maxBytes).then(function (text) {
      try { return JSON.parse(text.replace(/^\ufeff/, "")); }
      catch (error) { throw new Error("The selected file is not valid JSON: " + error.message); }
    });
  }

  function openPdf(data) {
    if (!window.pdfjsLib) return Promise.reject(new Error("The local PDF import runtime is unavailable."));
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl.href;
    var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    return window.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
  }

  function parseCsv(text) {
    var rows = [], row = [], field = "", quoted = false;
    text = String(text || "").replace(/^\ufeff/, "");
    for (var index = 0; index < text.length; index += 1) {
      var character = text[index];
      if (quoted) {
        if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else field += character;
      } else if (character === '"') quoted = true;
      else if (character === ",") { row.push(field); field = ""; }
      else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
      else field += character;
    }
    if (quoted) throw new Error("CSV contains an unfinished quoted field.");
    if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
    return rows;
  }

  function safeCsvCell(value) {
    var string = String(value == null ? "" : value);
    /* Spreadsheet engines can ignore leading whitespace/control characters
       when deciding whether a cell is a formula. Put the text marker before
       that entire prefix so tab/CR-prefixed payloads remain inert as well. */
    if (typeof value === "string" && /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(string)) string = "'" + string;
    return /[",\r\n]/.test(string) ? '"' + string.replace(/"/g, '""') + '"' : string;
  }

  function download(filename, contents, type) {
    var blob = new Blob([contents], { type: type || "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadJson(filename, value) { download(filename, JSON.stringify(value, null, 2), "application/json;charset=utf-8"); }
  function downloadCsv(filename, rows) { download(filename, "\ufeff" + rows.map(function (row) { return row.map(safeCsvCell).join(","); }).join("\r\n"), "text/csv;charset=utf-8"); }
  function uuid(prefix) {
    var value = window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    return (prefix || "id") + "-" + value;
  }
  function normalizeNumber(value, fallback) { var number = Number(value); return Number.isFinite(number) ? number : (fallback == null ? 0 : fallback); }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]; }); }

  function formatDate(value) {
    if (!value) return "—";
    var raw = String(value).trim();
    if (!raw || raw === "—" || raw === "Not supplied") return raw;
    var d = null;
    var isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      d = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
    } else {
      var ms = Date.parse(raw);
      if (!isNaN(ms)) d = new Date(ms);
    }
    if (!d || isNaN(d.valueOf())) return raw;
    return String(d.getUTCDate()).padStart(2, "0") + "/" +
      String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear();
  }

  function money(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0;
  }
  function text(value) {
    return String(value == null ? "" : value).trim();
  }
  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch (e) { /* fallback */ }
    }
    return JSON.parse(JSON.stringify(value));
  }

  function virtualScroll(container, options) {
    options = options || {};
    var rowHeight = options.rowHeight || 48;
    var totalItems = options.totalItems || 0;
    var buffer = options.buffer == null ? 5 : options.buffer;
    var threshold = options.threshold == null ? 80 : options.threshold;
    var onRender = options.onRender || function () {};

    if (!container || totalItems <= threshold) {
      onRender({ startIndex: 0, endIndex: totalItems, topPadding: 0, bottomPadding: 0, isVirtual: false });
      return function () {};
    }

    var ticking = false;
    function update() {
      ticking = false;
      var scrollTop = container.scrollTop || 0;
      var clientHeight = container.clientHeight || 500;
      var startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
      var visibleCount = Math.ceil(clientHeight / rowHeight) + (buffer * 2);
      var endIndex = Math.min(totalItems, startIndex + visibleCount);
      var topPadding = startIndex * rowHeight;
      var bottomPadding = Math.max(0, (totalItems - endIndex) * rowHeight);

      onRender({
        startIndex: startIndex,
        endIndex: endIndex,
        topPadding: topPadding,
        bottomPadding: bottomPadding,
        isVirtual: true
      });
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(update);
        } else {
          setTimeout(update, 16);
        }
      }
    }

    container.addEventListener("scroll", onScroll, { passive: true });
    update();

    return function cleanup() {
      container.removeEventListener("scroll", onScroll);
    };
  }

  UOS.utils = Object.freeze({
    money: money,
    text: text,
    esc: escapeHtml,
    escapeHtml: escapeHtml,
    clone: clone,
    normalizeNumber: normalizeNumber,
    formatDate: formatDate,
    uuid: uuid,
    parseCsv: parseCsv,
    safeCsvCell: safeCsvCell,
    virtualScroll: virtualScroll
  });

  UOS.imports = { readText: readText, readJson: readJson, openPdf: openPdf, parseCsv: parseCsv, safeCsvCell: safeCsvCell, download: download, downloadJson: downloadJson, downloadCsv: downloadCsv, uuid: uuid, normalizeNumber: normalizeNumber, escapeHtml: escapeHtml, formatDate: formatDate, money: money, clone: clone, virtualScroll: virtualScroll };
})();
