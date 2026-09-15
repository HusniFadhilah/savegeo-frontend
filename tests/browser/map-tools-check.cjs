const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage({viewport:{width:1200,height:800}});
 const errors = []; page.on('pageerror', e=>errors.push(e.message));
 let archiveRequests = 0;
 const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
 await page.route('**/*', async route => {
  const url = route.request().url();
  if (url.includes('WMTSCapabilities.xml')) {
   archiveRequests++;
   const layers = ['2014-02-20','2025-01-15','2025-02-27','2026-09-01'].map((date,i)=>`<Layer><Title>World Imagery (Wayback ${date})</Title><Identifier>${i}</Identifier><ResourceURL resourceType="tile" template="http://127.0.0.1:5501/archive/${i}/{TileMatrix}/{TileRow}/{TileCol}.png"/></Layer>`).join('');
   return route.fulfill({contentType:'application/xml',body:`<Capabilities>${layers}</Capabilities>`});
  }
  if (/\/(archive|test-result)\//.test(url) || !url.startsWith('http://127.0.0.1:5501')) {
   if (/\/(tile|tiles)\//.test(url) || /\/(archive|test-result)\//.test(url)) return route.fulfill({contentType:'image/png',body:png});
   return route.fulfill({contentType:'application/json',body:'[]'});
  }
  return route.continue();
 });
 await page.goto('http://127.0.0.1:5501/tests/browser/map-tools.html');
 await page.getByRole('button',{name:'Citra historis',exact:true}).waitFor();
 assert.equal(await page.locator('.map-history-panel').count(),0);
 assert.equal(archiveRequests,0);
 const menu = page.getByRole('button',{name:'Alat gambar AOI',exact:true});
 assert.equal(await page.locator('.aoi-tools-panel').isVisible(),false);
 await menu.hover();
 assert.equal(await page.locator('.aoi-tools-panel').isVisible(),true);
 assert.equal(await page.locator('.savegeo-draw-polygon').isVisible(),true);
 assert.equal(await page.locator('.aoi-curve-control__button').isVisible(),true);
 assert.equal(await page.locator('.aoi-rectangle-control__button').isVisible(),true);
 await page.mouse.move(800,100);
 assert.equal(await page.locator('.aoi-tools-panel').isVisible(),false);
 await menu.focus(); await page.keyboard.press('Enter');
 assert.equal(await page.locator('.aoi-tools-panel').isVisible(),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.aoi-tools-panel').isVisible(),false);
 await page.getByRole('button',{name:'Citra historis',exact:true}).click();
 await page.getByRole('slider',{name:'Linimasa citra historis'}).waitFor();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Tahun tampilan"] option[value="2014"]') || Array.from(document.querySelectorAll('[aria-label="Tahun tampilan"] option')).some(option=>option.textContent==='2014'));
 assert.equal(archiveRequests,1);
 assert.equal(await page.locator('.leaflet-historical-imagery-pane img').count(),0);
 assert.equal(await page.getByLabel('Hari tampilan').inputValue(),'current');
 assert.equal(await page.getByLabel('Tahun tampilan').inputValue(),String(new Date().getFullYear()));
 await page.getByLabel('Tahun tampilan').selectOption('2014');
 await page.waitForFunction(()=>document.querySelector('.leaflet-historical-imagery-pane img')?.src.includes('/archive/0/'));
 assert.equal(await page.locator('.leaflet-gee-result-pane-pane').evaluate(el=>getComputedStyle(el).zIndex),'350');
 await page.getByRole('button',{name:'Rilis berikutnya',exact:true}).click();
 assert.equal(await page.getByLabel('Tahun tampilan').inputValue(),'2025');
 fs.mkdirSync('test-results/map-tools',{recursive:true});
 await page.screenshot({path:'test-results/map-tools/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/map-tools/mobile.png'});
 const rect = await page.locator('.map-history-panel').boundingBox();
 assert(rect.x>=0 && rect.x+rect.width<=390);
 await page.getByRole('button',{name:'Kembali ke terkini'}).click();
 assert.equal(await page.locator('.leaflet-historical-imagery-pane img').count(),0);
 assert.equal(await page.getByLabel('Hari tampilan').inputValue(),'current');
 await page.getByRole('button',{name:'Tutup citra historis'}).click();
 assert.equal(await page.locator('.leaflet-historical-imagery-pane img').count(),0);
 await page.setViewportSize({width:1200,height:800});
 await menu.hover();
 await page.locator('.aoi-rectangle-control__button').click();
 const mapRect = await page.locator('#tools-map').boundingBox();
 await page.mouse.click(mapRect.x+300,mapRect.y+100);
 await page.mouse.click(mapRect.x+500,mapRect.y+240);
 await page.getByText('AOI selected',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: lazy archive loading; hover/keyboard AOI menu; date/tile changes; result pane; desktop/mobile; close restores basemap; rectangle drawing; no browser errors.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});


