delete process.env.PLAYWRIGHT_BROWSERS_PATH;
process.env.QUOTE_FILE_MODE='1';
module.exports={
 testDir:'../browser',testMatch:'quote-first-interaction.spec.js',
 timeout:30000,workers:1,
 outputDir:'../../test-results/quote-file-artifacts',
 reporter:[['json',{outputFile:'../../test-results/nsa-demo-readiness/quote-file-edge/results.json'}]],
 use:{browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1600,height:1000}}
};
