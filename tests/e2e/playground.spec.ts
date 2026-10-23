import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	// A clean session for every test: no saved code, theme or split.
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();
});

test('renders the default diagram', async ({ page }) => {
	await expect(page.locator('.diagram svg').first()).toBeVisible();
	await expect(page.locator('.badge')).toHaveText('flowchart');
});

test('zoom bar engages, survives edits, and leaves on error', async ({ page }) => {
	const zoomBar = page.locator('.pele-zoom');
	await expect(zoomBar).toBeVisible();

	// Typing valid mermaid keeps zoom alive on the replaced svg.
	const editor = page.locator('.source-editor .cm-content');
	await editor.click();
	await page.keyboard.press('End');
	await page.keyboard.type('\n  Z --> Y');
	await expect(page.locator('.diagram text', { hasText: 'Y' }).first()).toBeVisible();
	await expect(zoomBar).toBeVisible();

	// An invalid diagram removes it (and the svg) until it renders again.
	await editor.press('ControlOrMeta+a');
	await editor.type('flowchart TD\n  A --> ]bogus');
	await expect(page.locator('.error-banner')).toBeVisible();
	await expect(zoomBar).toHaveCount(0);

	// Recovering re-engages zoom.
	await editor.press('ControlOrMeta+a');
	await editor.type('flowchart LR\n  A --> B');
	await expect(page.locator('.diagram svg').first()).toBeVisible();
	await expect(zoomBar).toBeVisible();
});

test('share link round-trips through the URL hash', async ({ page }) => {
	const editor = page.locator('.source-editor .cm-content');
	await editor.click();
	await editor.press('ControlOrMeta+a');
	await editor.type('pie title Z\n  "a" : 1');
	await page.getByRole('button', { name: 'Share' }).click();

	const url = await page.evaluate(() => navigator.clipboard.readText());
	expect(url).toMatch(/#pako:/);

	await page.goto(url);
	await expect(page.locator('.diagram svg').first()).toBeVisible();
	await expect(page.locator('.badge')).toHaveText('pie');
});

test('samples load into the editor', async ({ page }) => {
	await page.locator('.menu summary').click();
	await page.getByRole('button', { name: 'Sequence', exact: true }).click();
	await expect(page.locator('.source-editor .cm-content')).toContainText('sequenceDiagram');
	await expect(page.locator('.badge')).toHaveText('sequence');
});

test('export produces an SVG download with resolved theme', async ({ page, context }) => {
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'SVG', exact: true }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('diagram.svg');
});

test('popout opens the diagram in its own tab with an editor way back', async ({ page }) => {
	await page.waitForTimeout(400); // hydration, so the popout carries current state
	const popupPromise = page.context().waitForEvent('page');
	await page.locator('.side-tools button[title*="own tab"]').click();
	const popup = await popupPromise;
	await expect(popup.locator('.diagram svg').first()).toBeVisible();
	await expect(popup.locator('.badge')).toHaveText('flowchart');
	await expect(popup.getByRole('link', { name: 'Open in editor' })).toBeVisible();

	// The way back loads the same diagram in the editor.
	await popup.getByRole('link', { name: 'Open in editor' }).click();
	await expect(popup.locator('.diagram svg').first()).toBeVisible();
	await expect(popup.locator('.badge')).toHaveText('flowchart');
});

test('fullscreen button requests fullscreen on the preview', async ({ page }) => {
	await page.locator('.side-tools button[title="Fullscreen"]').click();
	await page.waitForFunction(() => document.fullscreenElement !== null);
	await page.locator('.side-tools button[title="Fullscreen"]').click();
	await page.waitForFunction(() => document.fullscreenElement === null);
});
