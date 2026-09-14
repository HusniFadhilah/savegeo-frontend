const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ACER/AppData/Local/npm-cache/_npx/db89d7302a373f10/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.GLOBE_TEST_URL || 'http://127.0.0.1:5789';
(async () => {
 const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
 const results=[];
 try {
  const context=await browser.newContext();
  await context.route('**/api/**', async route => {
   const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'content-type,authorization','Access-Control-Allow-Methods':'GET,OPTIONS'};
   if(route.request().method()==='OPTIONS') return route.fulfill({status:204,headers});
   return route.fulfill({status:401,json:{detail:'Test: signed out'},headers});
  });
  const page=await context.newPage();
  for(const route of ['/carbon-estimation','/land-cover-change','/disaster','/satellite-imagery','/crop-monitoring','/disaster/event/10']) {
   await page.goto(`${base}${route}?view=3d&basemap=satellite`,{waitUntil:'domcontentloaded'});
   await page.waitForURL('**/login');
   const from=await page.evaluate(()=>history.state?.usr?.from);
   assert.equal(from,`${route}?view=3d&basemap=satellite`);
   results.push({route,loginRedirectPreserves3d:true});
  }
  await context.close();
  fs.mkdirSync('test-results/globe',{recursive:true});
  fs.writeFileSync('test-results/globe/routes.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
