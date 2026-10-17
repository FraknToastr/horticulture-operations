const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=process.cwd(),report=path.join(root,'docs/audits/nsa-evt/20261017-094545-local-8545d67');
const source='/tmp/nsa-evt-audit-20261017-094545';
const plan=JSON.parse(fs.readFileSync(path.join(report,'evidence/execution-plan.json')));
const gateFile=path.join(report,'evidence/mandatory-gates-before-execution.json');
if(!fs.existsSync(gateFile))throw new Error('Mandatory gates must precede tests');
const attemptFile=path.join(report,'evidence/execution-attempts.json');
const attempts=fs.existsSync(attemptFile)?JSON.parse(fs.readFileSync(attemptFile,'utf8')):[];
async function run(batch){
 const number=attempts.filter(x=>x.batch===batch.id).length+1;
 const start=new Date(),out='/tmp/nsa-audit-'+batch.id+'.attempt'+number+'.'+(batch.kind==='node'?'tap':'json'),err='/tmp/nsa-audit-'+batch.id+'.attempt'+number+'.stderr';
 const args=batch.kind==='node'?['--test',...batch.files]:[path.join(source,'node_modules/@playwright/test/cli.js'),'test','--config',path.join(report,'harness/playwright.config.cjs'),...batch.files,'--reporter=json'];
 if(batch.grep)args.push('--grep',batch.grep);if(batch.grepInvert)args.push('--grep-invert',batch.grepInvert);
 if(batch.id==='B-GPU')args.push('--workers=1');
 const env={...process.env};if(batch.kind==='browser'){delete env.PLAYWRIGHT_BROWSERS_PATH;env.NODE_OPTIONS=((env.NODE_OPTIONS||'')+' --require=/tmp/nsa-audit-browser-guard.cjs').trim();}
 const stdout=fs.openSync(out,'w'),stderr=fs.openSync(err,'w');
 const child=cp.spawn('rtk',['proxy',process.execPath,...args],{cwd:source,env,stdio:['ignore',stdout,stderr]});
 const result=await new Promise(resolve=>{child.on('error',e=>resolve({code:null,error:e.message}));child.on('close',(code,signal)=>resolve({code,signal}));});fs.closeSync(stdout);fs.closeSync(stderr);
 const attempt={id:batch.id+'-'+number,batch:batch.id,startedAt:start.toISOString(),endedAt:new Date().toISOString(),durationMs:Date.now()-start.getTime(),exitStatus:result.code,signal:result.signal,error:result.error,command:['rtk','proxy','node',...args].join(' '),cwd:'disposable candidate snapshot',stdout:out,stderr:err,status:result.code===0?'PASS':'FAIL'};attempts.push(attempt);
 fs.writeFileSync(path.join(report,'evidence/execution-attempts.json'),JSON.stringify(attempts,null,2)+'\n');
 console.log(JSON.stringify({batch:batch.id,exit:result.code,durationMs:attempt.durationMs,output:out}));
}
(async()=>{for(const batch of plan.batches){if(process.argv.includes('--browser-only')&&batch.kind!=='browser')continue;await run(batch);}})().catch(e=>{console.error(e);process.exitCode=1;});
