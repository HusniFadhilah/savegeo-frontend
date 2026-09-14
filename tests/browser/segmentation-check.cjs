// Real model outputs; no mocked segmentation tiles.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.SWIPE_TEST_URL || 'http://127.0.0.1:5501';
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage({viewport: mobile ? {width:390,height:844} : {width:1200,height:1000},hasTouch:mobile,isMobile:mobile});
      const errors=[], requests=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>requests.push(r.url()));
      await page.route('**/*',route=> {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/basemaps')) return route.fulfill({json:{layers:[{key:'blank',name:'Blank',enabled:true,is_default:true,tile_url:base+'/blank/{z}/{x}/{y}',max_zoom:22,attribution:'Test'}]},headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true'}});
        if (url.pathname.startsWith('/blank/')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'});
        return route.continue();
      });
      await page.goto(base+'/tests/browser/segmentation.html');
      await page.waitForFunction(()=>document.querySelector('.swipe-divider')?.getAttribute('aria-disabled')==='false', null, {timeout:120000});
      assert.equal(await page.locator('tbody tr').count(),9);
      const statistics = page.getByRole('table',{name:'Statistik kelas segmentasi'}).locator('tbody');
      const text = await statistics.innerText();
      assert(text.includes('Water') && text.includes('Flooded vegetation'));
      for (const orientation of ['vertical','horizontal']) {
        await page.getByTitle(orientation === 'vertical' ? 'Slider vertikal (kiri/kanan)' : 'Slider horizontal (atas/bawah)',{exact:true}).click();
        const slider=page.locator('.swipe-divider');
        const map=page.locator('.swipe-compare-wrap .leaflet-container');
        await map.scrollIntoViewIfNeeded();
        const rect=await map.boundingBox();
        const crop={x:rect.x+70,y:rect.y+70,width:rect.width-140,height:rect.height-140};
        const count=requests.length;
        const center=await map.getAttribute('data-map-center');
        await slider.press('Home'); await page.waitForTimeout(80);
        const before=await page.screenshot({clip:crop});
        await slider.press('End'); await page.waitForTimeout(80);
        const after=await page.screenshot({clip:crop});
        assert(!before.equals(after),'Actual model pixels must differ at fixed coordinates');
        assert.equal(await map.getAttribute('data-map-center'),center);
        assert.equal(requests.length,count,'Slider must not request tiles or analysis');
        await slider.press('Home');
        for(let i=0;i<5;i++) await slider.press('Shift+ArrowRight');
        const handle=await slider.boundingBox();
        const x=handle.x+handle.width/2, y=handle.y+handle.height/2;
        const tx=x+(orientation==='vertical'?40:0), ty=y+(orientation==='horizontal'?40:0);
        if(mobile) {
          const cdp=await page.context().newCDPSession(page);
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
          await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty}]});
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          await cdp.detach();
        } else {await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(tx,ty,{steps:5});await page.mouse.up();}
        assert(Number(await slider.getAttribute('aria-valuenow'))>50);
        assert.equal(await map.getAttribute('data-map-center'),center);
        assert.equal(requests.length,count);
        await map.screenshot({path:`test-results/segmentation/${mobile?'mobile':'desktop'}-${orientation}.png`});
      }
      for(const mode of ['Pre','Post','Berdampingan','Perubahan','Segmentasi multi-kelas']) {
        await page.getByRole('button',{name:mode,exact:true}).click();
        await page.waitForTimeout(400);
        assert.equal(await statistics.innerText(),text,'Legend/statistics must not change with mode');
        if(mode==='Berdampingan') {
          const maps=page.locator('.leaflet-container');
          assert.equal(await maps.count(),2);
          assert.equal(await maps.nth(0).getAttribute('data-map-center'),await maps.nth(1).getAttribute('data-map-center'));
          assert.equal(await maps.nth(0).getAttribute('data-map-zoom'),await maps.nth(1).getAttribute('data-map-zoom'));
          await maps.nth(0).getByRole('button',{name:/Perbesar|Zoom in/}).click();
          await page.waitForTimeout(400);
          assert.equal(await maps.nth(0).getAttribute('data-map-zoom'),await maps.nth(1).getAttribute('data-map-zoom'));
        }
      }
      assert(!requests.some(url=>/\/analyses\/.*\/run/.test(url)));
      assert.deepEqual(errors,[]);
      console.log(`PASS real segmentation: ${mobile?'mobile':'desktop'}, 9 classes, both orientations, all modes, synchronized maps, no inference on interaction`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
