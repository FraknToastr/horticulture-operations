'use strict';
// Minimal ASCII AcroForm; source-generated so no external fixture tool is needed.
module.exports = function formFixture() {
  const content = 'BT /F1 12 Tf 20 170 Td (Stage 4 form fixture) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /AcroForm 6 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R /Annots [7 0 R] >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Fields [7 0 R] /DA (/F1 12 Tf 0 g) /DR << /Font << /F1 5 0 R >> >> >>',
    '<< /Type /Annot /Subtype /Widget /FT /Tx /T (Receipt) /V (A3330) /Rect [20 100 150 125] /P 3 0 R /F 4 >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
};
