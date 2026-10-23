import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
await page.goto('http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);
const classes = await page.evaluate(() => [...document.querySelectorAll('.cm-line [class]')].slice(0, 6).map((el) => el.className));
console.log(classes);
const kw = await page.evaluate(() => {
  const el = document.querySelector('[class*="keyword"]');
  return el ? getComputedStyle(el).color : 'none';
});
console.log('keyword light:', kw);
await page.evaluate(() => localStorage.setItem('pele-live:theme', 'dark'));
await page.reload();
await page.waitForTimeout(800);
const kw2 = await page.evaluate(() => {
  const el = document.querySelector('[class*="keyword"]');
  return el ? getComputedStyle(el).color : 'none';
});
console.log('keyword dark:', kw2);
await browser.close();
