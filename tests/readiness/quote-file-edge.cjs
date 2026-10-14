const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync(process.execPath,[require.resolve('@playwright/test/cli'),'test','--config',path.join(__dirname,'quote-file.config.cjs')],{stdio:'inherit',env:process.env});
process.exitCode=result.status||0;
