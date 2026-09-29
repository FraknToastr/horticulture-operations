const AdmZip = require('adm-zip');
// Or use zlib/fs if adm-zip isn't installed. Let's check with child_process unzip
const { execSync } = require('child_process');
try {
  const res = execSync('unzip -p /home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline17.zip Offline/js/components/staffAssignModal/stagedCrew.js');
  console.log(res.toString('utf-8'));
} catch (e) {
  console.error('Error:', e.message);
}
