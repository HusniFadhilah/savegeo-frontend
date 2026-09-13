// Run the backend live GEE verification script first. No imagery is mocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const base=process.env.SWIPE_TEST_URL || 'http://127.0.0.1:5501';
(async()=>{
  const report=JSON.parse(fs.readFileSync('test-results/live-resolution/results.json','utf8'));
  assert(report.results.every(r=>Math.abs(r.native_scales.B4-10)<.01));
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1000,height:800}});
    const errors=[];let imageryRequests=0;
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.url().includes('/live-resolution/')) imageryRequests++;});
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('/basemaps')) return route.fulfill({json:{layers:[{key:'test',name:'Test',enabled:true,is_default:true,tile_url:base+'/blank/{z}/{x}/{y}',max_zoom:19,attribution:'Test'}]},headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true'}});
      if(url.pathname.startsWith('/blank/') || !route.request().url().startsWith(base)) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'});
      return route.continue();
    });
    await page.goto(base+'/tests/browser/swipe.html?module=resolution&live=1');
    await page.waitForFunction(()=>document.querySelector('.swipe-divider')?.getAttribute('aria-disabled')==='false');
    await page.waitForTimeout(400);
    const slider=page.locator('.swipe-divider'), map=page.locator('.swipe-compare-wrap .leaflet-container');
    const rect=await map.boundingBox();
    const crop={x:rect.x+rect.width/2-100,y:rect.y+rect.height/2-80,width:64,height:64};
    const count=imageryRequests;
    const transform=await page.evaluate(()=>document.querySelector('.leaflet-map-pane').style.transform);
    for(const orientation of ['vertical','horizontal']) {
      await page.getByTitle(orientation==='vertical'?'Slider vertikal (kiri/kanan)':'Slider horizontal (atas/bawah)',{exact:true}).click();
      await slider.press('Home');
      const after=await page.screenshot({clip:crop,path:`test-results/live-resolution/${orientation}-after-detail.png`});
      await slider.press('End');
      const before=await page.screenshot({clip:crop,path:`test-results/live-resolution/${orientation}-before-detail.png`});
      assert(!before.equals(after),'Fixed geographical patch must reveal different real imagery');
      await slider.press('Home');for(let i=0;i<5;i++) await slider.press('Shift+ArrowRight');
      await map.screenshot({path:`test-results/live-resolution/${orientation}-50.png`});
      assert.equal(await page.evaluate(()=>document.querySelector('.leaflet-map-pane').style.transform),transform);
    }
    assert.equal(imageryRequests,count,'Swiping must not reload real imagery');
    assert.deepEqual(errors,[]);
    console.log('PASS: two real Sentinel-2 scenes, 10m native grids, different fixed-location pixels in both orientations, stable map and no new tile requests.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
