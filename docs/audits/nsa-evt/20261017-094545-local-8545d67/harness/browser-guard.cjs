// Enforce the owner's media/mobile exclusions without changing existing tests.
const fs=require('node:fs'),path=require('node:path');
const api=require(path.join('/home/n0rt/headroom-projects/Hort Ops 23 September','node_modules/playwright'));
function block(reason){fs.appendFileSync('/tmp/nsa-audit-policy-violations.jsonl',JSON.stringify({time:new Date().toISOString(),reason})+'\n');throw new Error('AUDIT_POLICY_BLOCK: '+reason);}
function options(o){if(!o)return;if(o.isMobile||o.hasTouch)block('mobile or touch emulation');if(o.viewport&&o.viewport.width<768)block('viewport width below 768');if(o.recordVideo)block('browser video');}
const pageSeen=new WeakSet(),ctxSeen=new WeakSet(),browserSeen=new WeakSet();
function page(p){if(pageSeen.has(p))return p;pageSeen.add(p);p.screenshot=()=>block('page screenshot');const proto=Object.getPrototypeOf(p.locator('html'));proto.screenshot=()=>block('locator screenshot');p.touchscreen.tap=()=>block('touch emulation');const set=p.setViewportSize;p.setViewportSize=function(v){options({viewport:v});return set.call(this,v);};return p;}
function context(c){if(ctxSeen.has(c))return c;ctxSeen.add(c);c.tracing.start=()=>block('browser trace');c.tracing.startChunk=()=>block('browser trace chunk');c.on('page',page);for(const p of c.pages())page(p);const create=c.newPage;c.newPage=async function(...args){return page(await create.apply(this,args));};return c;}
function browser(b){if(browserSeen.has(b))return b;browserSeen.add(b);const create=b.newContext;b.newContext=async function(o){options(o);return context(await create.call(this,o));};const createPage=b.newPage;b.newPage=async function(o){options(o);return page(await createPage.call(this,o));};return b;}
for(const name of ['chromium','firefox','webkit']){const t=api[name];const launch=t.launch;t.launch=async function(...args){return browser(await launch.apply(this,args));};t.launchPersistentContext=()=>block('persistent browser profile');}
