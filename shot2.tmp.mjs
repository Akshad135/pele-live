import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
await page.goto('http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
// wait for hydration
await page.waitForTimeout(600);
const popupPromise = page.context().waitForEvent('page');
await page.locator('.side-tools button[title*="own tab"]').click();
const popup = await popupPromise;
await popup.waitForTimeout(500);
await popup.screenshot({ path: '/tmp/popout.png' });
await browser.close();
