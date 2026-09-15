const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const { writeArrayBuffer } = await import('geotiff');
  const tiff = Buffer.from(writeArrayBuffer(Float32Array.from([2, 2, 2, 2, 6, 6, 6, 6]), { width: 2, height: 2, ModelPixelScale: [1, 1, 0], ModelTiepoint: [0, 0, 0, 0, 2, 0], GDAL_NODATA: '-9999' }));
  fs.mkdirSync('test-results/raster-toolbox', { recursive: true }); fs.writeFileSync('test-results/raster-toolbox/fixture.tif', tiff);
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/imagery/nasa-gibs/layers', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ layers: [] }) }));
  await page.goto(process.env.RASTER_TEST_URL || 'http://127.0.0.1:5501/tests/browser/raster-toolbox.html'); await page.getByRole('button', { name: /Peralatan citra|Imagery tools/i }).click();
  await page.locator('#raster-source').waitFor(); const operations = await page.locator('#raster-operation option').allTextContents(); assert(operations.includes('NDVI')); assert(operations.includes('Hillshade')); assert(operations.includes('Change detection'));
  await page.locator('input[type=file]').first().setInputFiles('test-results/raster-toolbox/fixture.tif'); await page.getByRole('status').filter({ hasText: 'fixture.tif' }).waitFor();
  const bandInputs = page.locator('.raster-band-grid input'); await bandInputs.nth(0).fill('1'); await bandInputs.nth(3).fill('2');
  await page.locator('#raster-operation').selectOption('ndvi'); await page.getByRole('button', { name: 'Proses lokal' }).click(); await page.getByText('Operasi lokal selesai.').waitFor(); await page.getByRole('button', { name: 'Unduh GeoTIFF' }).waitFor(); assert.deepEqual(errors, []); await page.screenshot({ path: 'test-results/raster-toolbox/panel.png' }); console.log('PASS: toolbox opens, GeoTIFF loads, NDVI runs locally, result preview/export appears, and all operation groups are available.'); await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
