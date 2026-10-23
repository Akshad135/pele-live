import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
await page.goto('http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/light.png' });
// zoom in twice via pele's own + button
await page.locator('.pele-zoom-in').click();
await page.locator('.pele-zoom-in').click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/zoomed.png' });
await page.evaluate(() => localStorage.setItem('pele-live:theme', 'dark'));
await page.reload();
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/dark.png' });
await browser.close();
