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
	await page.locator('.zoom-tools button[title*="Fit diagram to view"]').click();
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
	await page.locator('.zoom-tools button[title*="Fit diagram to view"]').click();

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

	// Bookmark it (the panel opens on the Projects tab).
	await page.getByRole('button', { name: 'History' }).click();
	await page.getByRole('tab', { name: /Saved/ }).click();
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

test('projects save under a name, open back, and get deleted', async ({ page }) => {
	const editor = page.locator('.source-editor .cm-content');
	await editor.click();
	await editor.press('ControlOrMeta+a');
	await editor.type('pie title Ship\n  "a": 2');
	await expect(page.locator('.badge')).toHaveText('pie');

	await page.getByRole('button', { name: 'History' }).click();
	await page.getByRole('button', { name: 'Save project' }).click();
	// The new project goes straight into rename mode; the input is focused
	// (autofocus is ignored on dynamically inserted elements, so it is set in
	// code) with the suggested name preselected.
	const rename = page.locator('.rename');
	await expect(rename).toBeFocused();
	await rename.fill('Release plan');
	await rename.press('Enter');
	await expect(page.locator('.panel .name')).toContainText('Release plan');

	// Load a different diagram, then open the project back. Clicking the
	// editor closed the panel, so it is opened again.
	await editor.click();
	await editor.press('ControlOrMeta+a');
	await editor.type('flowchart TD\n  S --> T');
	await expect(page.locator('.badge')).toHaveText('flowchart');
	await page.getByRole('button', { name: 'History' }).click();
	await page.locator('.row-actions button[title="Restore this project"]').first().click();
	await expect(page.locator('.source-editor .cm-content')).toContainText('pie title Ship');
	await expect(page.locator('.badge')).toHaveText('pie');

	// Destructive buttons need two clicks: first arms ("Sure?"), second fires.
	await page.locator('.row-actions button[title="Delete"]').first().click();
	await expect(page.locator('.row-actions button.danger')).toBeVisible();
	await page.locator('.row-actions button.danger').first().click();
	await expect(page.locator('.panel .note')).toBeVisible();
});

test('theme menu switches between five themes', async ({ page }) => {
	await page.locator('.theme-toggle').click();
	await page.getByRole('button', { name: 'Midnight' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
	// The attribute alone proves nothing if no CSS block matches it; assert paint.
	const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	await page.locator('.theme-toggle').click();
	await page.getByRole('button', { name: 'Paper' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
	const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	expect(darkBg).not.toBe(lightBg);
	// System removes the attribute so the media queries decide.
	await page.locator('.theme-toggle').click();
	await page.getByRole('button', { name: 'System' }).click();
	await expect(page.locator('html')).not.toHaveAttribute('data-theme');
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

test('export popup produces an SVG download with resolved theme', async ({ page }) => {
	await page.locator('.export-toggle').click();
	await expect(page.locator('.export-popover')).toBeVisible();
	const downloadPromise = page.waitForEvent('download');
	await page.locator('.export-popover').getByRole('button', { name: 'Download .svg' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('diagram.svg');
	// Exports embed the editor state so they can be imported back.
	const path = await download.path();
	const svg = (await import('node:fs/promises')).readFile(path, 'utf8');
	expect(await svg).toContain('pele-live-state');
});

test('export popup can skip embedding the editor state', async ({ page }) => {
	await page.locator('.export-toggle').click();
	await page.locator('.export-embed input').uncheck();
	const downloadPromise = page.waitForEvent('download');
	await page.locator('.export-popover').getByRole('button', { name: 'Download .svg' }).click();
	const download = await downloadPromise;
	const svg = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
	expect(svg).not.toContain('pele-live-state');
});

test('HTML export downloads a standalone page', async ({ page }) => {
	await page.locator('.export-toggle').click();
	const downloadPromise = page.waitForEvent('download');
	await page.locator('.export-popover').getByRole('button', { name: 'Download .html' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('diagram.html');
	expect(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8')).toContain(
		'<meta name="pele-live-state"'
	);
});

test('PNG export offers size modes and downloads with state', async ({ page }) => {
	await page.locator('.export-toggle').click();
	await page.locator('.png-modes button', { hasText: 'width' }).click();
	await page.locator('.png-size input').fill('800');
	const downloadPromise = page.waitForEvent('download');
	await page.locator('.export-popover').getByRole('button', { name: 'Download .png' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('diagram-with-editor-state.png');
});

test('PNG export offers background options', async ({ page }) => {
	await page.locator('.export-toggle').click();
	const modes = page.locator('.png-bg-modes button');
	await expect(modes).toHaveCount(3);
	// Theme background is the default.
	await expect(modes.filter({ hasText: 'Theme' })).toHaveAttribute('aria-pressed', 'true');
	// The size readout makes the auto mode (and any clamp) visible.
	await expect(page.locator('.png-readout')).toContainText(/Exports at \d+ × \d+ px/);
	// Transparent hides the color picker; the download still works.
	await modes.filter({ hasText: 'Transparent' }).click();
	await expect(modes.filter({ hasText: 'Transparent' })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.png-color')).toHaveCount(0);
	// Custom reveals a color picker, seeded with the theme color.
	await modes.filter({ hasText: 'Custom' }).click();
	const color = page.locator('.png-color');
	await expect(color).toHaveCount(1);
	await expect(color).toHaveValue(/#[0-9a-f]{6}/);
	const downloadPromise = page.waitForEvent('download');
	await page.locator('.export-popover').getByRole('button', { name: 'Download .png' }).click();
	expect((await downloadPromise).suggestedFilename()).toBe('diagram-with-editor-state.png');
});

test('hand-drawn mode shows exactly one sketch across re-renders and themes', async ({ page }) => {
	await page.waitForSelector('.diagram svg');
	await page.locator('button[title="Hand-drawn look"]').click();
	await expect(page.locator('.sketch-host svg')).toHaveCount(1);
	const ed = page.locator('.source-editor .cm-content');
	await ed.click();
	await ed.press('ControlOrMeta+a');
	await ed.type('sequenceDiagram\n  A->>B: fresh sketch');
	await expect(page.locator('.sketch-host svg')).toHaveCount(1);
	await page.locator('.theme-toggle').click();
	await page.getByRole('button', { name: 'Midnight' }).click();
	await expect(page.locator('.sketch-host svg')).toHaveCount(1);
});

test('importing a .mmd file loads it into the editor', async ({ page }) => {
	await page.waitForTimeout(400); // hydration: the file input's change listener must exist
	await page.setInputFiles('input[type=file]', {
		name: 'plan.mmd',
		mimeType: 'text/plain',
		buffer: Buffer.from('pie title Imported\n "a": 1')
	});
	await expect(page.locator('.source-editor .cm-content')).toContainText('pie title Imported');
	await expect(page.locator('.badge')).toHaveText('pie');
});

test('popout opens the diagram in its own tab and back turns it into the editor', async ({ page }) => {
	await page.waitForTimeout(400); // hydration, so the popout link carries current state
	const popupPromise = page.context().waitForEvent('page');
	// A real target="_blank" link (never window.open — popup blockers eat those).
	await page.locator('.side-tools a[title*="own tab"]').click();
	const popup = await popupPromise;
	await expect(popup.locator('.diagram svg').first()).toBeVisible();
	await expect(popup.locator('.badge')).toHaveText('flowchart');
	await expect(popup.getByRole('link', { name: 'Back to editor' })).toBeVisible();

	// Back to editor navigates the popout tab into a full editor carrying the
	// same diagram (never window.close(): the tab may be user-opened, e.g.
	// from a link on another site).
	await popup.getByRole('link', { name: 'Back to editor' }).click();
	await expect(popup.locator('.source-editor .cm-content')).toBeVisible();
	await expect(popup).not.toHaveURL(/\/view/);
});

test('fullscreen button requests fullscreen on the preview', async ({ page }) => {
	await page.locator('.side-tools button[title="Fullscreen"]').click();
	await page.waitForFunction(() => document.fullscreenElement !== null);
	await page.locator('.side-tools button[title="Fullscreen"]').click();
	await page.waitForFunction(() => document.fullscreenElement === null);
});

test('touch pinch zooms the diagram canvas', async ({ browser }) => {
	const context = await browser.newContext({
		viewport: { width: 380, height: 780 },
		hasTouch: true
	});
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	try {
		await page.goto('http://localhost:4173/');
		await page.locator('.diagram svg').waitFor();
		const scale = () =>
			page.evaluate(() => {
				const m = /scale\(([\d.]+)\)/.exec(document.querySelector('.canvas')?.getAttribute('style') ?? '');
				return m ? Number(m[1]) : 0;
			});
		const box = await page.locator('.diagram').boundingBox();
		const cx = box!.x + box!.width / 2;
		const cy = box!.y + box!.height / 2;
		const before = await scale();
		const touch = (type: string, pts: object[]) =>
			cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts } as never);
		await touch('touchStart', [
			{ x: cx - 60, y: cy, id: 1 },
			{ x: cx + 60, y: cy, id: 2 }
		]);
		for (let d = 60; d <= 150; d += 15) {
			await touch('touchMove', [
				{ x: cx - d, y: cy, id: 1 },
				{ x: cx + d, y: cy, id: 2 }
			]);
			await page.waitForTimeout(30);
		}
		await touch('touchEnd', []);
		await page.waitForTimeout(150);
		expect(await scale()).toBeGreaterThan(before * 1.2);
	} finally {
		await context.close();
	}
});

test('boots when localStorage access is blocked entirely', async ({ browser }) => {
	// Chrome's "Block all cookies" makes every localStorage access throw.
	// A dedicated browser is needed because the flag is a launch arg.
	const blocked = await browser.browserType().launch({ args: ['--disable-local-storage'] });
	try {
		const page = await blocked.newPage();
		await page.goto('http://localhost:4173/');
		await expect(page.locator('.diagram svg').first()).toBeVisible();
		await expect(page.locator('.badge')).toHaveText('flowchart');
		// The toggles must survive their unsavable reads too: grid reads as
		// its default (on) when storage is blocked, so the button hides it.
		await page.locator('.side-tools button[title="Hide grid"]').click();
		await expect(page.locator('.side-tools button[title="Show grid"]')).toBeVisible();
	} finally {
		await blocked.close();
	}
});

