const { chromium } = require('C:/Users/HP/AppData/Roaming/npm/node_modules/n8n/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const CHROMIUM = 'C:/Users/HP/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';
const BASE = 'http://localhost:5173';
const SCREENSHOTS = path.join(__dirname, 'test-screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  // 1. Login
  console.log('Navigating to login...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'changeme');
  await page.screenshot({ path: path.join(SCREENSHOTS, '1-login.png') });
  await page.click('button[type="submit"]');

  // 2. Wait for Media page redirect
  console.log('Waiting for Media page...');
  await page.waitForURL('**/media', { timeout: 10000 });
  // Wait for loading spinner to go away (assets fetched or empty state shown)
  await page.waitForFunction(() => !document.body.innerText.includes('Loading…'), { timeout: 15000 });
  await page.screenshot({ path: path.join(SCREENSHOTS, '2-media-loaded.png') });
  console.log('Media page title:', await page.title());

  // 3. Check Upload button visible
  const uploadBtn = page.locator('button', { hasText: 'Upload' });
  const uploadVisible = await uploadBtn.isVisible();
  console.log('Upload button visible:', uploadVisible);

  // 4. Check for grid or empty state
  const grid = page.locator('.grid');
  const emptyState = page.locator('text=No media yet');
  const hasGrid = await grid.isVisible().catch(() => false);
  const hasEmpty = await emptyState.isVisible().catch(() => false);
  console.log('Grid visible:', hasGrid, '| Empty state visible:', hasEmpty);

  // Count asset cards
  const cardCount = await page.locator('.grid > div').count();
  console.log('Asset cards rendered:', cardCount);

  // 5. Test delete — hover over first card to reveal button, then click
  console.log('\nTesting delete...');
  const firstCard = page.locator('.grid > div').first();
  await firstCard.hover();
  await page.waitForTimeout(400); // hover CSS transition
  await page.screenshot({ path: path.join(SCREENSHOTS, '3-hover-delete-button.png') });

  // Override confirm before clicking to auto-accept
  await page.evaluate(() => { window.confirm = () => true; });
  await firstCard.locator('button[title="Delete"]').click({ force: true });
  // Wait for card count to drop (delete + reload)
  await page.waitForFunction(
    (prev) => document.querySelectorAll('.grid > div').length < prev,
    cardCount,
    { timeout: 10000 }
  );
  const afterDelete = await page.locator('.grid > div').count();
  console.log('Cards after delete:', afterDelete, '(expected', cardCount - 1, ')');
  await page.screenshot({ path: path.join(SCREENSHOTS, '4-after-delete.png') });

  // 6. Test upload with a tiny PNG
  console.log('\nTesting upload...');
  const { createCanvas } = require('canvas');
  let testImagePath = path.join(__dirname, 'test-upload.png');
  // Create a 10x10 blue PNG using canvas if available, else use a minimal PNG buffer
  const minimalPng = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c4944415478016360f8cf000000020001e221bc330000000049454e44ae426082',
    'hex'
  );
  require('fs').writeFileSync(testImagePath, minimalPng);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(testImagePath);

  // Wait for progress bar or new card
  try {
    await page.waitForSelector('.grid > div', { timeout: 10000 });
    // Wait for count to go back up
    await page.waitForFunction(
      (prev) => document.querySelectorAll('.grid > div').length > prev,
      afterDelete,
      { timeout: 10000 }
    );
    const afterUpload = await page.locator('.grid > div').count();
    console.log('Cards after upload:', afterUpload, '(expected', afterDelete + 1, ')');
    await page.screenshot({ path: path.join(SCREENSHOTS, '5-after-upload.png') });
  } catch (e) {
    console.log('Upload wait error:', e.message);
    await page.screenshot({ path: path.join(SCREENSHOTS, '5-upload-state.png') });
  }

  // 7. Console errors summary
  if (errors.length) {
    console.log('\nConsole errors:');
    errors.forEach(e => console.log(' ', e));
  } else {
    console.log('\nNo console errors.');
  }

  // Clean up test file
  require('fs').unlinkSync(testImagePath);
  await browser.close();
  console.log(`\nScreenshots saved to: ${SCREENSHOTS}`);
})().catch(e => { console.error(e); process.exit(1); });
