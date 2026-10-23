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

test('canvas fits, zooms, and pans with the cursor at any zoom', async ({ page }) => {
	const transform = () =>
		page.locator('.canvas').getAttribute('style').then((s) => (s ?? '').replace(/;$/, ''));
	const initial = await transform();
	expect(initial).toContain('scale(1)');

	// Toolbar zoom changes the transform; reset brings it back.
	await page.locator('.zoom-tools button[title="Zoom in"]').click();
	await page.locator('.zoom-tools button[title="Zoom in"]').click();
	const zoomed = await transform();
	expect(zoomed).not.toBe(initial);
	await page.locator('.zoom-tools button[title*="Reset zoom"]').click();
	expect(await transform()).toBe(initial);

	// Dragging pans at any zoom, fit included.
	const box = await page.locator('.diagram').boundingBox();
	const cx = box!.x + box!.width / 2;
	const cy = box!.y + box!.height / 2;
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 80, cy + 60, { steps: 5 });
	await page.mouse.up();
	expect(await transform()).not.toBe(initial);
	await page.locator('.zoom-tools button[title*="Reset zoom"]').click();

	// A diagram larger than the canvas renders fitted (scale < 1).
	const editor = page.locator('.source-editor .cm-content');
	await editor.click();
	await editor.press('ControlOrMeta+a');
	const big = ['flowchart TD', ...Array.from({ length: 40 }, (_, i) => `  N${i} --> N${i + 1}`)].join('\n');
	await editor.type(big);
	await expect(page.locator('.canvas').first()).toBeVisible();
	await page.waitForFunction(() => {
		const style = document.querySelector('.canvas')?.getAttribute('style') ?? '';
		return /scale\(0\.\d+\)/.test(style);
	});
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
	// Exports embed the editor state so they can be imported back.
	const path = await download.path();
	const svg = (await import('node:fs/promises')).readFile(path, 'utf8');
	expect(await svg).toContain('pele-live-state');
});

test('HTML export downloads a standalone page', async ({ page }) => {
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'HTML', exact: true }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('diagram.html');
	expect(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8')).toContain(
		'<meta name="pele-live-state"'
	);
});

test('PNG popover offers size modes and downloads with state', async ({ page }) => {
	await page.locator('.toolbar .png-toggle').click();
	await expect(page.locator('.png-popover')).toBeVisible();
	await page.locator('.png-modes button', { hasText: 'width' }).click();
	await page.locator('.png-size input').fill('800');
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download PNG' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('diagram-with-editor-state.png');
});

test('importing a .mmd file loads it into the editor', async ({ page }) => {
	await page.setInputFiles('input[type=file]', {
		name: 'plan.mmd',
		mimeType: 'text/plain',
		buffer: Buffer.from('pie title Imported\n "a": 1')
	});
	await expect(page.locator('.source-editor .cm-content')).toContainText('pie title Imported');
	await expect(page.locator('.badge')).toHaveText('pie');
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
