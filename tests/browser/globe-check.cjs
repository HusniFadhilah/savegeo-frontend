const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ACER/AppData/Local/npm-cache/_npx/db89d7302a373f10/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.GLOBE_TEST_URL || 'http://127.0.0.1:5503';
fs.mkdirSync('test-results/globe', {recursive:true});
(async()=>{
 const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 try {
 const context=await browser.newContext({viewport:{width:1280,height:900},geolocation:{latitude:-6.234567,longitude:106.765432,accuracy:25},permissions:['geolocation']});
 // Only synthetic analysis imagery is intercepted. Basemaps remain real provider requests.
 await context.route('**/test-analysis/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')}));
 const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/tests/browser/globe.html?view=3d`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.testViewer && !window.testViewer.isDestroyed(),{timeout:90000});
 await page.waitForFunction(()=>window.testViewer.dataSources.length===2,{timeout:30000});
 await page.waitForTimeout(2500);
 const initial=await page.evaluate(()=>({mode:window.testViewer.scene.mode, dataSources:window.testViewer.dataSources.length, aoi:window.testViewer.dataSources.get(0).entities.values.length, creations:window.viewerCreations, layers:window.testViewer.imageryLayers.length, terrain:window.testViewer.terrainProvider.constructor.name, status:window.locationState.getState().status}));
 assert.equal(initial.mode,3);assert.equal(initial.status,'idle');assert.equal(initial.layers,2);assert.equal(initial.dataSources,2);
 results.push({test:'real Cesium SCENE3D, MultiPolygon, hotspot, raster, no GPS request on mount',initial});
 await page.locator('.globe-settings > summary').click();
 const camera=()=>page.evaluate(()=>{const c=window.testViewer.camera;return [c.position.x,c.position.y,c.position.z,c.heading,c.pitch,c.roll]});
 const before=await camera();
 for(const id of ['roads','satellite_roads','topo','terrain','dark','light','satellite']){
   await page.getByLabel('Basemap & layers',{exact:true}).selectOption(id);
   await page.waitForTimeout(350);
   const state=await page.evaluate(()=>({layers:window.testViewer.imageryLayers.length,creates:window.viewerCreations,sources:window.testViewer.dataSources.length, urls:Array.from({length:window.testViewer.imageryLayers.length},(_,i)=>window.testViewer.imageryLayers.get(i).imageryProvider.url)}));
   assert.equal(state.creates,initial.creations); assert.equal(state.sources,2);assert.equal(state.layers,id==='satellite_roads'?3:2);
   assert(state.urls.at(-1).includes('/test-analysis/'));assert.deepEqual(await camera(),before);
   results.push({test:`basemap ${id}: order/camera/AOI/viewer retention`,state});
 }
 await page.locator('.globe-settings > summary').click();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(600);assert.notDeepEqual(await camera(),before);
 await page.getByRole('button',{name:'Tilt camera',exact:true}).click();await page.waitForTimeout(600);
 await page.getByRole('button',{name:'Orbit globe',exact:true}).click();await page.waitForTimeout(600);
 await page.getByRole('button',{name:'Compass: face north',exact:true}).click();
 assert(Math.abs(await page.evaluate(()=>window.testViewer.camera.heading))<0.001);
 results.push({test:'zoom / tilt / orbit / compass',passed:true});
 await page.locator('.user-location-control > summary').click();
 const urlBefore=page.url();
 await page.getByRole('button',{name:'Locate me',exact:true}).click();
 await page.waitForFunction(()=>window.testViewer.entities.getById('user-location'));
 await page.waitForTimeout(2000);
 assert.equal(page.url(),urlBefore);
 assert(await page.evaluate(()=>!!window.testViewer.entities.getById('user-accuracy')));
 await page.getByRole('button',{name:'Follow location',exact:true}).click();
 await context.setGeolocation({latitude:-6.25,longitude:106.75,accuracy:40});
 await page.waitForFunction(()=>window.locationState.getState().latitude===-6.25);
 await page.getByRole('button',{name:'Stop following',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.locationState.getState().follow),false);
 assert.equal(page.url(),urlBefore);
 results.push({test:'GPS granted, marker, accuracy, explicit follow/stop, coordinates absent from URL',passed:true});
 // Hide controlled test GPS before evidence capture.
 await page.getByLabel('Show location',{exact:true}).uncheck();
 await page.locator('.user-location-control > summary').click();
 await page.getByRole('button',{name:'Return to Indonesia',exact:true}).click();await page.waitForTimeout(3000);
 await page.screenshot({path:'test-results/globe/desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1000);
 await page.screenshot({path:'test-results/globe/mobile.png'});
 assert(await page.locator('.cesium-widget canvas').isVisible());
 await page.getByRole('button',{name:'Return to 2D map',exact:true}).click();
 await page.waitForSelector('.leaflet-container');
 assert.equal(await page.evaluate(()=>window.locationState.getState().latitude),-6.25);
 results.push({test:'mobile viewport, return to Leaflet, location retained',passed:true});
 await page.getByRole('button',{name:'Mount/unmount',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.locationState.getState().follow),false);
 assert.equal(errors.length,0,errors.join('\n'));
 results.push({test:'no uncaught JS errors / unmount',passed:true});
 // WebGL failure is a separate browser configuration.
 await context.close();
 const denied=await browser.newContext();
 const p=await denied.newPage();
 await p.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return original.call(this,type,...args)};});
 await p.goto(`${base}/tests/browser/globe.html?view=3d`);
 await p.getByRole('button',{name:'Return to 2D map',exact:true}).waitFor();
 assert(await p.getByRole('alert').isVisible());
 await p.getByRole('button',{name:'Return to 2D map',exact:true}).click();await p.waitForSelector('.leaflet-container');
 results.push({test:'WebGL unavailable gives explicit error and working 2D fallback',passed:true});
 fs.writeFileSync('test-results/globe/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
