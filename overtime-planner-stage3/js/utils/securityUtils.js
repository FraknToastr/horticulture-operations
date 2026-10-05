// Central Security, HTML Escaping, and RFC-4180 CSV Utilities (Mandate Section 13)
// 100% Client-side, zero external runtime dependencies.

window.HortOpsSecurityUtils = (function() {
  /**
   * Encodes HTML special characters to prevent XSS / markup injection.
   * @param {string|any} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Encodes attribute values for safe insertion into HTML attribute quotes.
   * @param {string|any} str
   * @returns {string}
   */
  function escapeHtmlAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Serializes headers and rows into RFC-4180 compliant CSV string with formula-injection protection.
   * @param {Array<string>} headers - Column titles
   * @param {Array<Array<any>>} rows - 2D array of row cells
   * @returns {string}
   */
  function serializeCsv(headers, rows) {
    function formatCell(cell) {
      if (cell === null || cell === undefined) return '""';
      var val = String(cell);

      // Formula injection protection: prepend single quote if starts with =, +, -, @, \t, \r
      if (/^[=+\-@\t\r]/.test(val)) {
        val = "'" + val;
      }

      // If contains comma, quote, or newline, escape quotes and wrap in quotes
      if (/[",\r\n]/.test(val)) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return '"' + val + '"';
    }

    var lines = [];
    if (headers && headers.length > 0) {
      lines.push(headers.map(formatCell).join(','));
    }

    if (Array.isArray(rows)) {
      rows.forEach(function(row) {
        lines.push((row || []).map(formatCell).join(','));
      });
    }

    return lines.join('\r\n');
  }

  return {
    escapeHtml: escapeHtml,
    escapeHtmlAttr: escapeHtmlAttr,
    serializeCsv: serializeCsv
  };
})();
