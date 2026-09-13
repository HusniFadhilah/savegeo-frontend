/* Run with the Vite server running: node tests/browser/swipe-check.cjs
 * PLAYWRIGHT_MODULE may point to an existing Playwright installation.
 * Tests use real Chromium/Leaflet with synthetic tiles; no GEE credentials.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inflateSync } = require('node:zlib');
const base = process.env.SWIPE_TEST_URL || 'http://127.0.0.1:5501';
const output = path.resolve('test-results/swipe');
fs.mkdirSync(output, { recursive: true });

// Decode Chromium RGB/RGBA PNG screenshots to verify actual rendered pixels,
// rather than treating a changed clip-path string as evidence of visibility.
function pixels(png) {
  let width, height, bpp; const data = [];
  for (let pos = 8; pos < png.length;) {
    const len = png.readUInt32BE(pos), kind = png.toString('ascii', pos + 4, pos + 8);
    const chunk = png.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); bpp = chunk[9] === 6 ? 4 : 3; assert.equal(chunk[8], 8); }
    if (kind === 'IDAT') data.push(chunk);
    pos += len + 12;
  }
  const raw = inflateSync(Buffer.concat(data)), stride = width * bpp, decoded = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= bpp ? decoded[i - bpp] : 0, b = y ? decoded[i - stride] : 0, c = y && x >= bpp ? decoded[i - stride - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p-a), pb = Math.abs(p-b), pc = Math.abs(p-c);
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a+b)/2) : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      decoded[i] = (raw[pos++] + predictor) & 255;
    }
  }
  let red = 0, blue = 0;
  for (let i = 0; i < decoded.length; i += bpp) {
    if (decoded[i] > decoded[i+2] + 60 && decoded[i] > decoded[i+1] + 60) red++;
    if (decoded[i+2] > decoded[i] + 60 && decoded[i+2] > decoded[i+1] + 60) blue++;
  }
  return { red, blue, at: (x,y) => [...decoded.subarray(Math.round(y)*stride + Math.round(x)*bpp, Math.round(y)*stride + Math.round(x)*bpp + 3)] };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const provider = {key:'sentinel2',name:'Test satellite',provider:'Test',group:'Optik',gee_collection:'test',source_kind:'gee',visualization:'rgb',resolution_m:10,revisit_days:5,start_year:2015,cloud_property:null};
    const scenes = [{id:'before',acquired_at:'2024-01-01T00:00:00Z',cloud_cover_pct:null,resolution_m:30},{id:'after',acquired_at:'2025-01-01T00:00:00Z',cloud_cover_pct:null,resolution_m:10}];
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1280,height:900}, isMobile:mobile, hasTouch:mobile, deviceScaleFactor:1 });
      let requests = 0;
      await context.route('**/*', async route => {
        const url = route.request().url();
        const pathname = new URL(url).pathname;
        if(route.request().method() === 'OPTIONS') return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization'}});
        const json = value => route.fulfill({json:value,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true'}});
        if(pathname.endsWith('/imagery/providers')) return json({providers:{sentinel2:provider},default:'sentinel2'});
        if(pathname.endsWith('/imagery/scenes')) return json({scenes,count:2,truncated:false,satellite:provider});
        if(pathname.endsWith('/imagery/scene-tile')) {
          const body = route.request().postDataJSON();
          assert(body.aoi.geojson.geometry.coordinates.length, 'Scene tile request must include full AOI');
          return json({scene_id:body.scene_id,tile_url:base+`/test-tiles/${body.scene_id}/{z}/{x}/{y}.png`,satellite:provider});
        }
        if(pathname.includes('cloud-mask-techniques')) return json({techniques:{}});
        if(pathname.endsWith('/imagery/nasa-gibs/layers')) return json({layers:[]});
        if(pathname.endsWith('/imagery/samgeo/status')) return json({available:false,message:'Not used in swipe test'});
        if (url.includes('/test-tiles/')) {
          requests++;
          if (url.includes('/error/')) return route.fulfill({ status:404, body:'' });
          const color = url.includes('/before/') ? '#ee2020' : '#2020ee';
          return route.fulfill({ contentType:'image/svg+xml', headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Credentials':'true'}, body:`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${color}"/></svg>` });
        }
        if (new URL(url).pathname.endsWith('/basemaps')) return json({layers:[{key:'test',name:'Test',enabled:true,is_default:true,tile_url:base+'/base/{z}/{x}/{y}.png',max_zoom:19,attribution:'Test'}]});
        if (!url.startsWith(base) && ['fetch','xhr'].includes(route.request().resourceType())) return json({});
        if (url.includes('/base/') || !url.startsWith(base)) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eee"/></svg>'});
        return route.continue();
      });
      for (const module of (process.env.SWIPE_MODULES || 'shared,disaster,land-cover-change,carbon-estimation,imagery').split(',')) {
        const page = await context.newPage(); const errors = [];
        let apiRequests = 0, expectedTileError = false;
        page.on('request', r => { if(['fetch','xhr'].includes(r.resourceType())) apiRequests++; });
        page.on('console', message => { if(message.type()==='error' && !(expectedTileError && message.text().includes('404'))) errors.push(message.text()); });
        page.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR', e.message); });
        console.log('Checking',module,mobile?'mobile':'desktop');
        await page.goto(`${base}/tests/browser/swipe.html?module=${module}`);
        if(module === 'imagery') {
          await page.getByRole('button',{name:'Cari Scene',exact:true}).click();
          await page.getByRole('button',{name:'Bandingkan 2 Waktu'}).click();
          for(const [label,index] of [['Scene A (Sebelum)',1],['Scene B (Sesudah)',0]]) {
            const field = page.locator('.col-sm-6').filter({has:page.getByText(label,{exact:true})});
            await field.locator('.sg-ssel-control').click();
            await field.locator('.sg-ssel-option').nth(index).click();
          }
          await page.getByRole('button',{name:'Muat Perbandingan'}).click();
        }
        const slider = page.locator('.swipe-divider');
        await slider.waitFor();
        await page.waitForFunction(() => document.querySelector('.swipe-divider')?.getAttribute('aria-disabled') === 'false');
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.swipe-compare-wrap .leaflet-container').count(),1);
        const map = page.locator('.swipe-compare-wrap .leaflet-container');
        for (const orientation of ['vertical','horizontal']) {
          await page.getByTitle(orientation === 'vertical' ? 'Slider vertikal (kiri/kanan)' : 'Slider horizontal (atas/bawah)', {exact:true}).click();
          await slider.focus();
          const beforeRequests = requests;
          const beforeApiRequests = apiRequests;
          const identity = await page.evaluate(() => {
            window.testTiles = [...document.querySelectorAll('.leaflet-swipe-before-pane img, .leaflet-swipe-after-pane img')];
            return document.querySelector('.swipe-compare-wrap .leaflet-map-pane').style.transform;
          });
          const counts = [];
          for (const percent of [0,50,100]) {
            await slider.press('Home');
            for (let i=0;i<percent/10;i++) await slider.press('Shift+ArrowRight');
            assert.equal(await slider.getAttribute('aria-valuenow'),String(percent));
            const shot = await map.screenshot({path:path.join(output,`${module}-${mobile?'mobile':'desktop'}-${orientation}-${percent}.png`)});
            const count = pixels(shot); counts.push({red:count.red,blue:count.blue});
          }
          assert(counts[0].blue > 1000 && counts[0].red < counts[0].blue*.1, JSON.stringify({module,orientation,counts}));
          assert(counts[1].blue > 500 && counts[1].red > 500, JSON.stringify({module,orientation,counts}));
          assert(counts[2].red > 1000 && counts[2].blue < counts[2].red*.1, JSON.stringify({module,orientation,counts}));
          assert.equal(requests,beforeRequests,'Dragging/keyboard must not request tiles');
          assert.equal(apiRequests,beforeApiRequests,'Dragging/keyboard must not call APIs');
          assert.equal(await page.evaluate(() => document.querySelector('.swipe-compare-wrap .leaflet-map-pane').style.transform), identity);
          assert(await page.evaluate(() => window.testTiles.length > 0 && window.testTiles.every(tile => tile.isConnected)), 'Tiles must not remount');
          // Real mouse drag while the map is unlocked; mobile uses touch CDP.
          await page.getByTitle(/Posisi peta terkunci/).click();
          await slider.press('Home'); for(let i=0;i<5;i++) await slider.press('Shift+ArrowRight');
          const box = await map.boundingBox();
          const start = orientation === 'vertical' ? {x:box.x+box.width*.5,y:box.y+box.height*.5} : {x:box.x+box.width*.5,y:box.y+box.height*.5};
          const end = orientation === 'vertical' ? {x:box.x+box.width*.75,y:start.y} : {x:start.x,y:box.y+box.height*.75};
          if(mobile) {
            const cdp = await context.newCDPSession(page);
            await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
            await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});
            await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            await cdp.detach();
          } else {
            await page.mouse.move(start.x,start.y); await page.mouse.down(); await page.mouse.move(end.x,end.y,{steps:8}); await page.mouse.up();
          }
          assert(Math.abs(Number(await slider.getAttribute('aria-valuenow'))-75)<=2,'Pointer/touch must move divider');
          assert.equal(await page.evaluate(() => document.querySelector('.swipe-compare-wrap .leaflet-map-pane').style.transform),identity,'Map must stay fixed');
          await page.getByTitle(/Posisi peta bebas/).click();
          results.push({module,mobile,orientation,counts});
        }
        if(module === 'land-cover-change') {
          for(const [label,url] of [['Area Berubah','changed'],['Kelas Tujuan','destination'],['Kelas Tahun','after']]) {
            await page.getByRole('button',{name:label,exact:true}).click();
            await page.waitForFunction(() => document.querySelector('.swipe-divider')?.getAttribute('aria-disabled')==='false');
            assert(await page.locator('.leaflet-swipe-after-pane img').first().getAttribute('src').then(src => src.includes('/'+url+'/')));
          }
        }
        if(['disaster','land-cover-change','carbon-estimation'].includes(module)) {
          await map.locator('.opacity-panel input').evaluate(el => {el.value='0.4';el.dispatchEvent(new Event('input',{bubbles:true}));});
          for(const name of ['before','after']) assert.equal(await page.locator(`.leaflet-swipe-${name}-pane .leaflet-layer`).evaluate(el=>el.style.opacity),'0.4');
          await page.getByText('Change AOI',{exact:true}).click();
          await page.waitForFunction(() => document.querySelector('.swipe-divider')?.getAttribute('aria-disabled')==='false');
        }
        if(['disaster','land-cover-change'].includes(module)) {
          await page.getByRole('button',{name:'Berdampingan',exact:true}).click();
          assert.equal(await page.locator('.leaflet-container').count(),2);
          if(module==='disaster') for(const label of ['Pre','Post']) {
            await page.getByRole('button',{name:label,exact:true}).click();
            assert.equal(await page.locator('.leaflet-container').count(),1);
          }
          await page.getByRole('button',{name:module==='disaster'?'Geser':'Geser (Slider)',exact:true}).click();
          await page.waitForFunction(() => document.querySelector('.swipe-divider')?.getAttribute('aria-disabled')==='false');
        }
        if(module === 'imagery') {
          await page.getByText('Change AOI',{exact:true}).click();
          assert.equal(await slider.count(),0,'AOI change must discard old scene tiles');
          await page.getByRole('button',{name:'Muat Perbandingan'}).click();
          await page.waitForFunction(() => document.querySelector('.swipe-divider')?.getAttribute('aria-disabled')==='false');
        }
        if(module === 'shared') {
          await page.getByTitle('Slider vertikal (kiri/kanan)',{exact:true}).click();
          await slider.press('Home');
          const mapSize = await map.boundingBox();
          const sample = pixels(await map.screenshot());
          const center = sample.at(mapSize.width/2,mapSize.height/2+10);
          assert(Math.abs(center[0]-center[2])<30,'AOI hole must reveal basemap');
          await page.evaluate(() => window.testMap.panBy([65,25],{animate:false}));
          await page.waitForTimeout(350);
          const dims = await page.evaluate(() => {
            const pane=document.querySelector('.leaflet-swipe-after-pane'), size=window.testMap.getSize();
            return [pane.offsetWidth,pane.offsetHeight,size.x,size.y,pane.style.clipPath];
          });
          assert.equal(dims[0],dims[2]); assert.equal(dims[1],dims[3]); assert(dims[4].includes('path'));
          await page.getByText('Toggle AOI clipping',{exact:true}).click();
          await page.waitForFunction(() => document.querySelector('.swipe-divider')?.getAttribute('aria-disabled')==='false');
          await page.setViewportSize(mobile ? {width:420,height:844} : {width:1000,height:900});
          await page.waitForTimeout(400);
          await slider.press('Home'); for(let i=0;i<5;i++) await slider.press('Shift+ArrowRight');
          const resized = pixels(await map.screenshot({path:path.join(output,`shared-${mobile?'mobile':'desktop'}-pan-resize-no-aoi.png`)}));
          assert(resized.red>20000 && resized.blue>20000,'Unclipped swipe must reveal both images after pan and resize');
          const newSize = await page.evaluate(() => [document.querySelector('.leaflet-swipe-after-pane').offsetWidth,window.testMap.getSize().x]);
          assert.equal(newSize[0],newSize[1]);
          await page.getByText('Toggle AOI clipping',{exact:true}).click();
          await page.getByText('Change AOI',{exact:true}).click();
          await page.getByText('Change layer',{exact:true}).click();
          await page.waitForFunction(() => document.querySelector('.swipe-divider').getAttribute('aria-disabled')==='false');
          await page.getByText('Opacity 40%',{exact:true}).click();
          assert.equal(await page.locator('.leaflet-swipe-after-pane .leaflet-layer').evaluate(el => el.style.opacity),'0.4');
          await page.getByText('Missing layer',{exact:true}).click();
          assert.equal(await slider.getAttribute('aria-disabled'),'true');
          await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-swipe-before-pane img')].some(img => img.classList.contains('leaflet-tile-loaded')));
          await page.waitForTimeout(350);
          const missing = pixels(await map.screenshot()); assert(missing.red>1000 && missing.blue<missing.red*.1, JSON.stringify({red:missing.red,blue:missing.blue}));
          expectedTileError = true;
          await page.getByText('Failed layer',{exact:true}).click();
          await page.getByRole('status').filter({hasText:'gagal'}).waitFor();
          assert.equal(await slider.getAttribute('aria-disabled'),'true');
        }
        assert.deepEqual(errors,[]);
        await page.close();
      }
      await context.close();
    }
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
    console.log(`PASS: ${results.length} module/device/orientation combinations; pixel endpoints, mouse/touch, keyboard, stable map/layers and request counts.`);
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
