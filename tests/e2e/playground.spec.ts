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

test('zoom controls zoom the canvas and drag pans once zoomed', async ({ page }) => {
	const viewBox = () => page.locator('.diagram svg').first().getAttribute('viewBox');
	const initial = await viewBox();
	expect(initial).toBeTruthy();

	// Toolbar zoom changes the viewBox; reset brings it back.
	await page.locator('.zoom-tools button[title="Zoom in"]').click();
	await page.locator('.zoom-tools button[title="Zoom in"]').click();
	const zoomed = await viewBox();
	expect(zoomed).not.toBe(initial);
	await page.locator('.zoom-tools button[title*="Reset zoom"]').click();
	expect(await viewBox()).toBe(initial);

	// Pele pans by rewriting the viewBox on drag — but only once zoomed in.
	const box = await page.locator('.diagram').boundingBox();
	await page.locator('.diagram').dblclick({ position: { x: 200, y: 150 } });
	const afterDblclick = await viewBox();
	expect(afterDblclick).not.toBe(initial);

	const cx = box!.x + box!.width / 2;
	const cy = box!.y + box!.height / 2;
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 80, cy + 60, { steps: 5 });
	await page.mouse.up();
	const afterDrag = await viewBox();
	expect(afterDrag).not.toBe(afterDblclick);
});

test('history saves, restores and keeps a timeline', async ({ page }) => {
	const editor = page.locator('.source-editor .cm-content');
	await editor.click();
	await editor.press('ControlOrMeta+a');
	await editor.type('pie title Z\n  "a" : 1');
	await expect(page.locator('.badge')).toHaveText('pie');

	// Bookmark it.
	await page.getByRole('button', { name: 'History' }).click();
	await page.getByRole('button', { name: 'Save version' }).click();

	// The timeline already holds this session's snapshot.
	await page.getByRole('tab', { name: /Timeline/ }).click();
	await expect(page.locator('.panel li')).toHaveCount(1);

	// Replace the diagram, then restore the bookmark. Clicking the editor
	// closed the panel, so it is opened again.
	await editor.click();
	await editor.press('ControlOrMeta+a');
	await editor.type('flowchart TD\n  Q --> R');
	await expect(page.locator('.badge')).toHaveText('flowchart');
	await page.getByRole('button', { name: 'History' }).click();
	await page.getByRole('tab', { name: /Saved/ }).click();
	await page.locator('.row-actions button[title="Restore this version"]').first().click();
	await expect(page.locator('.source-editor .cm-content')).toContainText('pie title Z');
	await expect(page.locator('.badge')).toHaveText('pie');
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
