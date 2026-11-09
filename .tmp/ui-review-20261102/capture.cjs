const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const {player,round,dataFor}=require('./fixtures.cjs');
const stamp=process.env.UI_CAPTURE_RUN || 'run-'+new Date().toISOString().replace(/[:.]/g,'-');
const out=path.resolve(__dirname,'screenshots',stamp);
fs.mkdirSync(out,{recursive:true});
const report={kind:'fixture-driven UI validation; not backend integration',createdAt:new Date().toISOString(),screens:[],unknownApi:[],errors:[]};
const selected=(process.env.UI_CAPTURE_PAGES || 'login,race2D,race3D,gallery,register,lobby,wallet,tasks,feat,stable,nursery,sponsor,catalog,characters,ranking,shop,bets,notices,settings,result').split(',');
async function inspect(page){return page.evaluate(()=>{
 const app=window.__gameApp; const root=app.node; const labels=[]; const buttons=[];
 const walk=(n,p)=>{if(!n.activeInHierarchy)return;const nodePath=p+'/'+n.name;const ui=n.getComponent('cc.UITransform'); const b=ui?.getBoundingBoxToWorld(); const bounds=b?{x:b.x,y:b.y,width:b.width,height:b.height}:null;
 const label=n.getComponent('cc.Label');if(label)labels.push({path:nodePath,text:label.string,fontSize:label.fontSize,lineHeight:label.lineHeight,overflow:label.overflow,bounds});
 const button=n.getComponent('cc.Button');if(button)buttons.push({path:nodePath,bounds,interactable:button.interactable,labels:n.children.map(c=>c.getComponent('cc.Label')?.string).filter(Boolean)});
 for(const c of n.children)walk(c,nodePath);};walk(root,'');
 return {viewportWidth:app.viewportWidth,viewportHeight:app.viewportHeight,canvas:{width:document.querySelector('canvas')?.width,height:document.querySelector('canvas')?.height},labels,buttons};
 });}
async function run(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
 for(const viewport of [{name:'portrait',width:720,height:1280},{name:'wide',width:1440,height:900}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
  await context.addInitScript(()=>{localStorage.clear(); window.__RACE_GAME_CONFIG__={apiBaseUrl:'http://localhost:55230',clientVersion:'2.0.0'};});
  await context.route('**/api/**',async route=>{const req=route.request();const u=new URL(req.url());const data=dataFor(u.pathname);if(data===null)report.unknownApi.push(u.pathname);await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},contentType:'application/json',body:JSON.stringify({code:0,message:'UI fixture',data})});});
  const page=await context.newPage();page.on('pageerror',e=>{report.errors.push({viewport:viewport.name,error:String(e)});console.log('PAGEERROR',String(e));});
  page.on('console',m=>{if(m.type()==='error')report.errors.push({viewport:viewport.name,console:m.text().slice(0,1000)});});
  await page.goto('http://127.0.0.1:7456/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__gameApp?.pageRoot?.children?.length>0,{timeout:90000});
  await page.waitForTimeout(1800);
  for(const name of selected){
   console.log('CAPTURE',viewport.name,name);
   try{
    await page.evaluate(async ({name,player,round})=>{
     const app=window.__gameApp;
     if(name==='login'||name==='register'){await app.show(name);return;}
     app.player=player;app.round=round;
     if(window.ApiClient)window.ApiClient.setTokens('ui-fixture-token','ui-fixture-refresh');
     if(name==='race2D'||name==='race3D'||name==='gallery'){app.raceRenderMode=name==='race2D'?'2D':'3D';await app.show('race');return;}
     if(['stable','nursery','sponsor','catalog'].includes(name)){app.stableTab={stable:'MY_RANCH',nursery:'NURSERY',sponsor:'SPONSOR',catalog:'CATALOG'}[name];await app.show('stable');return;}
     if(name==='result'){app.round={...round,state:6,winnerHorseNo:1,secondHorseNo:2};}
     await app.show(name);
    },{name,player,round});
    await page.waitForTimeout(name.startsWith('race')||name==='gallery'?2500:800);
    if(name==='gallery'){
     const opened=await page.evaluate(()=>{let target=null;const walk=n=>{if(!n.activeInHierarchy)return; const l=n.getComponent('cc.Label'); if(l&&/名驹图鉴|Horse Gallery/.test(l.string))target=n;for(const c of n.children)walk(c);};walk(window.__gameApp.node);if(!target)return false;let b=target;while(b&&!b.getComponent('cc.Button'))b=b.parent;if(!b)return false;b.emit('click',b.getComponent('cc.Button'));return true;});
     if(!opened)throw new Error('Gallery button not found');await page.waitForTimeout(1800);
    }
    const meta=await inspect(page);meta.name=name;meta.viewport=viewport;meta.file=path.join(out,viewport.name+'-'+name+'.png');
    await page.screenshot({path:meta.file,fullPage:true});report.screens.push(meta);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
   }catch(e){report.errors.push({viewport:viewport.name,page:name,error:String(e)});console.log('CAPTURE_FAILED',name,String(e));await page.screenshot({path:path.join(out,viewport.name+'-'+name+'-failed.png')}).catch(()=>{});}
  }
  await context.close();
 }
 }finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 console.log('OUTPUT',out);console.log('SUMMARY',JSON.stringify({screens:report.screens.length,unknownApi:[...new Set(report.unknownApi)],errors:report.errors.length}));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
