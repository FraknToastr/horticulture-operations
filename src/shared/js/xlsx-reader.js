(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  var MAX_FILE = 20 * 1024 * 1024, MAX_ENTRY = 20 * 1024 * 1024, MAX_ENTRIES = 200, MAX_ROWS = 10000;
  function u16(view, offset) { return view.getUint16(offset, true); }
  function u32(view, offset) { return view.getUint32(offset, true); }
  function clean(value) { return String(value == null ? "" : value).trim(); }
  function entity(value) { return String(value || "").replace(/&#(\d+);/g, function (_, code) { return String.fromCodePoint(Number(code)); }).replace(/&#x([0-9a-f]+);/gi, function (_, code) { return String.fromCodePoint(parseInt(code, 16)); }).replace(/&(lt|gt|quot|apos|amp);/g, function (_, name) { return { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[name]; }); }
  function attr(source, name) { var match = String(source).match(new RegExp("(?:^|\\s)" + name.replace(":", "(?::|:[A-Za-z0-9_-]*:?)") + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i")); return match ? entity(match[2]) : ""; }
  async function inflate(input) {
    if (!("DecompressionStream" in window)) throw new Error("This browser cannot decompress XLSX files.");
    var reader = new Blob([input]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader(), chunks = [], total = 0;
    while (true) { var part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > MAX_ENTRY) { await reader.cancel(); throw new Error("Expanded XLSX content exceeds 20 MB."); } chunks.push(part.value); }
    var output = new Uint8Array(total), cursor = 0; chunks.forEach(function (chunk) { output.set(chunk, cursor); cursor += chunk.length; }); return output;
  }
  async function unzip(file) {
    if (!file || Number(file.size) > MAX_FILE) throw new Error("The XLSX file exceeds 20 MB.");
    var buffer = await file.arrayBuffer(), view = new DataView(buffer), source = new Uint8Array(buffer), eocd = -1;
    for (var offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 65557); offset -= 1) if (u32(view, offset) === 0x06054b50) { eocd = offset; break; }
    if (eocd < 0) throw new Error("The selected XLSX has no valid ZIP directory.");
    var count = u16(view, eocd + 10), cursor = u32(view, eocd + 16), files = {}, decoder = new TextDecoder("utf-8");
    if (count > MAX_ENTRIES) throw new Error("The XLSX contains more than 200 entries.");
    for (var index = 0; index < count; index += 1) {
      if (cursor + 46 > eocd || u32(view, cursor) !== 0x02014b50) throw new Error("The XLSX central directory is invalid.");
      var flags = u16(view, cursor + 8), method = u16(view, cursor + 10), compressedSize = u32(view, cursor + 20), expandedSize = u32(view, cursor + 24), nameLength = u16(view, cursor + 28), extraLength = u16(view, cursor + 30), commentLength = u16(view, cursor + 32), localOffset = u32(view, cursor + 42);
      var name = decoder.decode(source.slice(cursor + 46, cursor + 46 + nameLength)).replace(/\\/g, "/");
      if (flags & 1 || expandedSize > MAX_ENTRY || name.indexOf("..") >= 0 || name[0] === "/") throw new Error("The XLSX contains an unsafe entry.");
      if (/^(?:xl\/(?:workbook|sharedStrings)\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/worksheets\/[^/]+\.xml)$/i.test(name)) {
        if (localOffset + 30 > source.length || u32(view, localOffset) !== 0x04034b50) throw new Error("An XLSX entry is invalid.");
        var start = localOffset + 30 + u16(view, localOffset + 26) + u16(view, localOffset + 28), compressed = source.slice(start, start + compressedSize), content;
        if (compressed.length !== compressedSize) throw new Error("An XLSX entry is truncated.");
        if (method === 0) content = compressed; else if (method === 8) content = await inflate(compressed); else throw new Error("The XLSX uses unsupported compression.");
        if (content.length !== expandedSize) throw new Error("An XLSX entry has an invalid expanded size."); files[name] = decoder.decode(content);
      }
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }
  function tags(xml, name) { var output = [], expression = new RegExp("<(?:(?:[A-Za-z0-9_-]+):)?" + name + "\\b([^>]*)>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?" + name + "\\s*>", "gi"), match; while ((match = expression.exec(xml || ""))) output.push({ attributes: match[1], content: match[2] }); return output; }
  function column(reference) { var letters = String(reference || "").replace(/[^A-Za-z]/g, ""), value = 0; for (var i = 0; i < letters.length; i += 1) value = value * 26 + letters.charCodeAt(i) % 32; return value - 1; }
  function workbookRows(files, sheetName) {
    var strings = tags(files["xl/sharedStrings.xml"], "si").map(function (item) { return tags(item.content, "t").map(function (node) { return entity(node.content.replace(/<[^>]+>/g, "")); }).join(""); });
    var relations = {}; (files["xl/_rels/workbook.xml.rels"] || "").replace(/<Relationship\b([^>]*)\/?\s*>/gi, function (_, attributes) { var target = attr(attributes, "Target"), id = attr(attributes, "Id"); relations[id] = target[0] === "/" ? target.slice(1) : "xl/" + target.replace(/^\.\//, ""); return _; });
    var sheets = []; (files["xl/workbook.xml"] || "").replace(/<sheet\b([^>]*)\/?\s*>/gi, function (_, attributes) { sheets.push({ name: attr(attributes, "name"), path: relations[attr(attributes, "r:id")] }); return _; });
    var selected = sheets.find(function (sheet) { return sheet.name.toLowerCase() === clean(sheetName).toLowerCase(); }) || sheets[0];
    if (!selected || !files[selected.path]) throw new Error("The XLSX has no readable worksheet.");
    var rows = tags(files[selected.path], "row").slice(0, MAX_ROWS + 1).map(function (row) {
      var values = []; tags(row.content, "c").forEach(function (cell) { var type = attr(cell.attributes, "t"), inline = tags(cell.content, "t").map(function (node) { return entity(node.content.replace(/<[^>]+>/g, "")); }).join(""), valueNode = tags(cell.content, "v")[0], value = type === "inlineStr" ? inline : valueNode ? entity(valueNode.content) : ""; if (type === "s") value = strings[Number(value)] || ""; else if (type !== "str" && value !== "" && Number.isFinite(Number(value))) value = Number(value); values[column(attr(cell.attributes, "r"))] = value; });
      return { number: Number(attr(row.attributes, "r")) || 0, hidden: attr(row.attributes, "hidden") === "1", cells: values };
    });
    if (rows.length > MAX_ROWS) throw new Error("The XLSX contains more than 10,000 rows."); return rows;
  }
  async function read(file, sheetName) { return workbookRows(await unzip(file), sheetName); }
  async function rows(file) { return (await read(file)).map(function (row) { return row.cells; }); }
  async function headers(file) {
    var values = await read(file), sectionNames = ["Turf Remediation", "Plant Hire/Contractors", "Irrigation", "Sundry Costs", "Plants", "City Operations"];
    if (sectionNames.some(function (name) { return values.some(function (row) { return clean(row.cells[0]).toLowerCase().indexOf(name.toLowerCase()) === 0; }); })) return ["section", "label", "unit", "rate", "active", "supplier"];
    var first = values.find(function (row) { return row.cells.some(clean); }); return first ? first.cells.map(clean) : [];
  }
  async function rateRows(file) {
    var values = await read(file, "Working sheet"), headings = ["Soil / top dress", "Turf Remediation", "Plant Hire/Contractors (external)", "Irrigation", "Sundry Costs", "Plants", "City Operations"], output = [];
    headings.forEach(function (heading, headingIndex) { var start = values.findIndex(function (row) { return clean(row.cells[0]).toLowerCase() === heading.toLowerCase(); }); if (start < 0) return; var end = values.length; for (var next = headingIndex + 1; next < headings.length; next += 1) { var found = values.findIndex(function (row, index) { return index > start && clean(row.cells[0]).toLowerCase() === headings[next].toLowerCase(); }); if (found >= 0) { end = found; break; } } values.slice(start + 1, end).forEach(function (row) { var label = clean(row.cells[0]); if (!label || /^(sub total|gst inc|total estimate)$/i.test(label)) return; output.push({ owner: "EVT", section: heading, label: label, unit: clean(row.cells[1] || row.cells[4]), rate: Number(row.cells[5]) || 0, active: !row.hidden, sourceRow: row.number }); }); });
    if (!output.length) throw new Error("The XLSX contains no supported rate rows."); return output;
  }
  UOS.xlsxReader = { read: read, rows: rows, headers: headers, rateRows: rateRows };
})();
