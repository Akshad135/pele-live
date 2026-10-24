<script lang="ts">
	import { untrack, onMount } from 'svelte';
	import type { RenderOutcome } from '$lib/render';
	import {
		copyPng,
		copySvg,
		exportHtml,
		exportPng,
		exportSvg,
		type PngOptions
	} from '$lib/export';
	import type { SharedState } from '$lib/serde';
	import { scopeCss } from '$lib/scopedCss';
	import { docsUrl } from '$lib/docs';
	import { colorizeNodes, paletteFromStyle } from '$lib/diagramColors';
	import { themeState } from '$lib/theme.svelte';

	interface Props {
		outcome: RenderOutcome;
		/** User CSS, scoped to this preview. */
		css?: string;
		/** Editor state embedded into exports so files can be re-imported. */
		shared?: SharedState;
		/** Opens the current diagram in its own tab. Button hidden when absent. */
		onpopout?: () => void;
	}

	let { outcome, css = '', shared, onpopout }: Props = $props();

	// The canvas renders client-side only: a prerendered page cannot know the
	// saved session, and {@html} hydration trusts the server DOM, so any
	// server-rendered diagram would stick while the editor shows the restored
	// code. Empty canvas until mount; every effect below re-runs on `mounted`.
	let mounted = $state(false);
	onMount(() => (mounted = true));

	// --- Pan & zoom ----------------------------------------------------------
	// Own implementation: pele's enableZoom cannot pan at fit and its clamping
	// assumes an untransformed svg. Here the canvas translates/scales freely and
	// every diagram that doesn't fit the pane is fitted on render.

	let frame = $state<HTMLDivElement | undefined>();
	// The transformed wrapper around the svg.
	let stage = $state<HTMLDivElement | undefined>();

	const MAX_SCALE = 8;
	const PAN_MARGIN = 48;

	let view = $state({ scale: 1, x: 0, y: 0 });
	// The size key the current view was laid out for; refits only when the
	// diagram's natural size changes, so typing while panned keeps the view.
	let laidOutSize = '';

	function svgSize(): { w: number; h: number } | null {
		const svg = stage?.querySelector('svg');
		if (!svg) return null;
		const w = svg.width.baseVal.value;
		const h = svg.height.baseVal.value;
		return w > 0 && h > 0 ? { w, h } : null;
	}

	/** Fit the diagram into the pane (shrink-only) and center it. */
	function fit() {
		const size = untrack(svgSize);
		const rect = untrack(() => frame?.getBoundingClientRect());
		if (!size || !rect || rect.width <= 0 || rect.height <= 0) return;
		const scale = Math.min((rect.width - 56) / size.w, (rect.height - 56) / size.h, 1);
		view = { scale, x: 0, y: 0 };
		laidOutSize = `${size.w}x${size.h}`;
	}

	function clampPan() {
		const size = untrack(svgSize);
		const rect = untrack(() => frame?.getBoundingClientRect());
		if (!size || !rect) return;
		const halfW = (size.w * view.scale) / 2 + rect.width / 2 - PAN_MARGIN;
		const halfH = (size.h * view.scale) / 2 + rect.height / 2 - PAN_MARGIN;
		view.x = Math.min(halfW, Math.max(-halfW, view.x));
		view.y = Math.min(halfH, Math.max(-halfH, view.y));
	}

	/** Scales by `factor` keeping the point (clientX, clientY) stationary. */
	function zoomAt(factor: number, clientX: number, clientY: number) {
		const rect = frame?.getBoundingClientRect();
		if (!rect) return;
		const px = clientX - rect.left - rect.width / 2;
		const py = clientY - rect.top - rect.height / 2;
		const next = Math.min(MAX_SCALE, Math.max(0.05, view.scale * factor));
		const applied = next / view.scale;
		view.x = px - (px - view.x) * applied;
		view.y = py - (py - view.y) * applied;
		view.scale = next;
		clampPan();
	}

	function zoomBy(factor: number) {
		const rect = frame?.getBoundingClientRect();
		if (!rect) return;
		zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
	}

	function zoomReset() {
		fit();
	}

	function onWheel(event: WheelEvent) {
		// Plain wheel zooms, like every canvas editor. Without preventDefault
		// ctrl+wheel would zoom the whole page instead.
		event.preventDefault();
		const turn = Math.min(Math.max(-event.deltaY, -60), 60);
		zoomAt(2 ** (turn * 0.0022), event.clientX, event.clientY);
	}

	let panning = $state(false);

	function startPan(event: PointerEvent) {
		if (event.button !== 0 || !outcome.ok) return;
		// The floating toolbars keep their own clicks.
		if (event.target instanceof Element && event.target.closest('button, a, input, .side-tools, .zoom-tools, .export-popover')) {
			return;
		}
		const startX = event.clientX;
		const startY = event.clientY;
		const baseX = view.x;
		const baseY = view.y;
		panning = true;
		const move = (e: PointerEvent) => {
			view.x = baseX + (e.clientX - startX);
			view.y = baseY + (e.clientY - startY);
			clampPan();
		};
		const up = () => {
			panning = false;
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	}

	function onDoubleClick(event: MouseEvent) {
		if (event.target instanceof Element && event.target.closest('button, a')) return;
		const size = untrack(svgSize);
		const rect = frame?.getBoundingClientRect();
		if (!size || !rect) return;
		if (view.scale > fitScale() + 0.01) {
			fit();
		} else {
			zoomAt(Math.max(1, (size.w < rect.width && size.h < rect.height ? 2 : 1.25)) / view.scale, event.clientX, event.clientY);
		}
	}

	function fitScale() {
		const size = untrack(svgSize);
		const rect = untrack(() => frame?.getBoundingClientRect());
		if (!size || !rect || rect.width === 0) return 1;
		return Math.min((rect.width - 56) / size.w, (rect.height - 56) / size.h, 1);
	}

	// --- Canvas content: single writer ---------------------------------------
	// One effect owns both hosts' content and always replaces it wholesale, so
	// a render can never leave a previous diagram behind — not across error
	// transitions, not across hydration, not across anything.
	let diagramHost = $state<HTMLDivElement | undefined>();

	$effect(() => {
		void outcome;
		void mounted;
		void roughOn;
		if (diagramHost) diagramHost.innerHTML = outcome.ok ? outcome.svg : '';
		if (roughSource) roughSource.innerHTML = outcome.ok ? outcome.svg : '';
	});

	// Fit whenever the rendered svg's natural size appears for the first time;
	// same-size re-renders (typing) keep the current pan/zoom.
	$effect(() => {
		void outcome;
		void roughDone;
		void mounted; // the svg only exists after mount
		const size = svgSize();
		const key = size ? `${size.w}x${size.h}` : '';
		if (key && key !== laidOutSize) fit();
	});

	// Refit when the pane itself is resized.
	$effect(() => {
		if (!frame) return;
		const observer = new ResizeObserver(() => fit());
		observer.observe(frame);
		return () => observer.disconnect();
	});

	// --- Editor-default node colors -------------------------------------------
	// Cycle the theme's pastel palette across the diagram's nodes, matched by
	// data-id so a sequence participant's top and bottom copies share a color.
	// Runs before the rough effect so a sketch picks the colors up.
	$effect(() => {
		void outcome; // recolor whenever the diagram is re-rendered
		void themeState.current; // ...and whenever the theme (palette) changes
		void themeState.systemDark; // ...including OS flips while on the auto theme
		void roughOn; // ...and when the pristine rough-source copy appears
		void mounted; // ...and when the canvas content first renders
		const frameEl = frame;
		if (!frameEl) return;
		const palette = paletteFromStyle(getComputedStyle(frameEl));
		// Every pele svg in the frame: the displayed one and the pristine
		// offscreen copy the hand-drawn sketch is built from.
		colorizeNodes(untrack(() => [...frameEl.querySelectorAll('.pele-nodes > .pele-node')]), palette);
	});

	// --- Hand-drawn (rough) mode ---------------------------------------------
	const ROUGH_KEY = 'pele-live:rough';
	let roughOn = $state(typeof localStorage !== 'undefined' && localStorage.getItem(ROUGH_KEY) === 'on');
	// Hidden holder for the pristine pele svg that svg2roughjs consumes.
	let roughSource = $state<HTMLDivElement | undefined>();
	// Where the sketch output lands while rough mode is on.
	let sketchHost = $state<HTMLDivElement | undefined>();
	// Flips true once a sketch finished; part of the layout effect's inputs.
	let roughDone = $state(0);

	function toggleRough() {
		roughOn = !roughOn;
		try {
			localStorage.setItem(ROUGH_KEY, roughOn ? 'on' : 'off');
		} catch {
			// The toggle still works this session if saving fails.
		}
		if (!roughOn) roughDone++;
	}

	$effect(() => {
		void outcome; // re-sketch whenever the diagram is re-rendered
		void mounted; // the pristine source only exists after mount
		void themeState.current; // and whenever the theme (or its palette) changes
		void themeState.systemDark; // ...including OS flips while on the auto theme
		if (!roughOn) return;
		const source = untrack(() => roughSource?.querySelector('svg'));
		const host = untrack(() => sketchHost);
		if (!source || !host) return;
		let cancelled = false;
		// svg2roughjs sketches synchronously; debounce so typing a large
		// diagram doesn't re-sketch on every keystroke. The previous sketch
		// stays visible until the fresh one replaces it.
		const timer = setTimeout(() => {
			void (async () => {
				const { Svg2Roughjs } = await import('svg2roughjs');
				if (cancelled) return;
				const sketcher = new Svg2Roughjs(host);
				sketcher.fontFamily = getComputedStyle(document.body).fontFamily;
				sketcher.svg = source;
				await sketcher.sketch(true);
				if (cancelled) return;
				roughDone++;
			})();
		}, 150);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	// --- User CSS ------------------------------------------------------------
	let cssEl = $state<HTMLStyleElement | undefined>();

	$effect(() => {
		if (!frame) return;
		const el = document.createElement('style');
		el.dataset.userCss = '';
		frame.appendChild(el);
		cssEl = el;
		return () => {
			if (cssEl === el) cssEl = undefined;
			el.remove();
		};
	});

	$effect(() => {
		if (cssEl) cssEl.textContent = scopeCss(css, '.diagram-frame');
	});

	// --- Export ----------------------------------------------------------------
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let exportError = $state('');

	$effect(() => () => clearTimeout(copyTimer));

	function flashCopied() {
		copied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = false), 1600);
	}

	// The export popup with one row per format.
	let exportOpen = $state(false);
	let exportDialog = $state<HTMLDivElement | undefined>();
	// Editor state embedded into exports so files can be re-imported here.
	let embedOn = $state(true);
	// PNG export sizing: auto (2x) or fit a chosen width/height.
	let pngMode = $state<'auto' | 'width' | 'height'>('auto');
	let pngValue = $state(1080);

	function pngOptions(): PngOptions {
		return { mode: pngMode, value: Math.max(16, Math.min(16384, pngValue || 0)) };
	}

	function exportState(): SharedState | undefined {
		return embedOn && shared ? shared : undefined;
	}

	// Close the export popup on Escape or a click outside of it.
	$effect(() => {
		if (!exportOpen) return;
		const close = (event: Event) => {
			if (!(event.target instanceof Element) || !event.target.isConnected) return;
			if (event.target.closest('.export-popover, .export-toggle')) return;
			exportOpen = false;
		};
		const keyClose = (event: KeyboardEvent) => {
			if (event.key === 'Escape') exportOpen = false;
		};
		document.addEventListener('click', close);
		document.addEventListener('keydown', keyClose);
		return () => {
			document.removeEventListener('click', close);
			document.removeEventListener('keydown', keyClose);
		};
	});

	// Move focus into the dialog when it opens, restore to the toggle on close.
	$effect(() => {
		if (exportOpen) exportDialog?.focus();
	});

	function currentSource(): Element | null {
		return frame?.querySelector('svg') ?? null;
	}

	async function onCopySvg() {
		const source = currentSource();
		if (!outcome.ok || !source) return;
		try {
			await copySvg(outcome.svg, source, exportState(), css);
			flashCopied();
		} catch {
			exportError = 'Clipboard is unavailable here.';
		}
	}

	function onDownloadSvg() {
		const source = currentSource();
		if (!outcome.ok || !source) return;
		exportSvg(outcome.svg, source, exportState(), css);
	}

	function onDownloadHtml() {
		const source = currentSource();
		if (!outcome.ok || !source) return;
		exportHtml(outcome.svg, source, exportState(), css);
	}

	async function onDownloadPng() {
		const source = currentSource();
		if (!outcome.ok || !source) return;
		exportError = '';
		try {
			await exportPng(outcome.svg, source, pngOptions(), exportState(), css);
		} catch (e) {
			exportError = e instanceof Error ? e.message : 'PNG export failed.';
		}
	}

	async function onCopyPng() {
		const source = currentSource();
		if (!outcome.ok || !source) return;
		exportError = '';
		try {
			await copyPng(outcome.svg, source, pngOptions(), exportState(), css);
			flashCopied();
		} catch (e) {
			exportError = e instanceof Error ? e.message : 'Could not copy the image.';
		}
	}

	// Grid toggle, persisted like the original editor's.
	const GRID_KEY = 'pele-live:grid';
	let grid = $state(
		typeof localStorage === 'undefined' || localStorage.getItem(GRID_KEY) !== 'off'
	);

	function toggleGrid() {
		grid = !grid;
		try {
			localStorage.setItem(GRID_KEY, grid ? 'on' : 'off');
		} catch {
			// The toggle still works this session if saving fails.
		}
	}

	async function fullscreen() {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await frame?.requestFullscreen();
			}
		} catch {
			exportError = 'Fullscreen was blocked by the browser.';
		}
	}
</script>

<div
	class="diagram-frame"
	class:has-error={!outcome.ok}
	class:grid={grid && outcome.ok}
	bind:this={frame}
>
	{#if outcome.ok}
		<div
			class="diagram"
			role="application"
			aria-label="Diagram canvas — drag to pan, scroll to zoom"
			class:panning
			onwheel={onWheel}
			onpointerdown={startPan}
			ondblclick={onDoubleClick}
		>
			<div
				class="canvas"
				bind:this={stage}
				style={`transform: translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`}
			>
			{#if mounted && roughOn}
				<div class="sketch-host" bind:this={sketchHost}></div>
			{:else}
				<div class="diagram-host" bind:this={diagramHost}></div>
			{/if}
		</div>
	</div>
	{#if mounted && roughOn}
		<div class="rough-source" aria-hidden="true" bind:this={roughSource}></div>
	{/if}
		<span class="badge" title="Rendered diagram type">{outcome.diagramType}</span>
		{#if outcome.ok && docsUrl(outcome.mermaidType)}
			<a
				class="docs-link"
				href={docsUrl(outcome.mermaidType)}
				target="_blank"
				rel="noopener"
				title="Syntax documentation for {outcome.diagramType}"
			>
				Docs ↗
			</a>
		{/if}
		<div class="zoom-tools">
			<button onclick={() => zoomBy(0.8)} title="Zoom out">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
			</button>
			<button onclick={zoomReset} title="Fit diagram to view">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6M3.5 13a9 9 0 1 0 2-7.5L3 7" /></svg>
			</button>
			<button onclick={() => zoomBy(1.25)} title="Zoom in">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
			</button>
		</div>
		<div class="side-tools">
			<button class="export-toggle" onclick={() => (exportOpen = !exportOpen)} aria-expanded={exportOpen} title="Export the diagram">
				Export
			</button>
			<span class="side-sep" aria-hidden="true"></span>
			{#if onpopout}
				<button onclick={onpopout} title="Open the diagram in its own tab">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
					</svg>
				</button>
			{/if}
			<button onclick={fullscreen} title="Fullscreen">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
				</svg>
			</button>
			<button onclick={toggleRough} title={roughOn ? 'Hand-drawn look is on' : 'Hand-drawn look'} aria-pressed={roughOn}>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586" />
				</svg>
			</button>
			<button onclick={toggleGrid} title={grid ? 'Hide grid' : 'Show grid'} aria-pressed={grid}>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
					<path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
				</svg>
			</button>
		</div>
		{#if exportOpen}
			<div class="export-popover" role="dialog" aria-label="Export the diagram" tabindex="-1" bind:this={exportDialog}>
				<header class="export-head">
					<strong>Export</strong>
					<button class="export-close" onclick={() => (exportOpen = false)} title="Close" aria-label="Close export dialog">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
					</button>
				</header>
				{#if shared}
					<label class="export-embed">
						<input type="checkbox" bind:checked={embedOn} />
						Embed editor state — files can be re-imported here
					</label>
				{/if}
				<div class="export-row">
					<span class="export-format">SVG</span>
					<button onclick={onDownloadSvg}>Download .svg</button>
					<button onclick={onCopySvg}>{copied ? 'Copied' : 'Copy SVG'}</button>
				</div>
				<div class="export-row">
					<span class="export-format">PNG</span>
					<div class="export-png">
						<div class="png-modes">
							{#each ['auto', 'width', 'height'] as mode (mode)}
								<button
									aria-pressed={pngMode === mode}
									class:active={pngMode === mode}
									onclick={() => (pngMode = mode as 'auto' | 'width' | 'height')}
								>
									{mode}
								</button>
							{/each}
						</div>
						{#if pngMode !== 'auto'}
							<label class="png-size">
								{pngMode === 'width' ? 'Width' : 'Height'}
								<input type="number" min="16" max="16384" bind:value={pngValue} />
								px
							</label>
						{/if}
					</div>
					<div class="png-actions">
						<button onclick={onDownloadPng}>Download .png</button>
						<button onclick={onCopyPng}>Copy PNG</button>
					</div>
				</div>
				{#if shared}
					<div class="export-row">
						<span class="export-format">HTML</span>
						<button onclick={onDownloadHtml}>Download .html</button>
					</div>
				{/if}
				{#if exportError}
					<p class="export-error" role="alert">{exportError}</p>
				{/if}
			</div>
		{/if}
		{#if !exportOpen && exportError}
			<p class="export-error" role="alert">{exportError}</p>
		{/if}
	{:else}
		<div class="error-banner" role="alert">
			<strong>Error</strong>
			{#if outcome.error.line > 0}
				<span class="error-loc">line {outcome.error.line}, column {outcome.error.column}</span>
			{/if}
			<pre>{outcome.error.message}</pre>
		</div>
	{/if}
</div>

<style>
	.diagram-frame {
		position: relative;
		height: 100%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--surface);
		touch-action: none;
	}

	/* Dot grid, like the original editor's preview, tuned subtle. */
	.diagram-frame.grid {
		background-image: radial-gradient(var(--grid-dot) 1px, transparent 1px);
		background-size: 20px 20px;
		background-position: -1px -1px;
	}

	/* The pan/zoom viewport: fills the pane; the canvas inside is transformed.
	   Absolutely centered, so diagrams taller than the pane stay centered too. */
	.diagram {
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		line-height: 0;
		cursor: grab;
		user-select: none;
		-webkit-user-select: none;
	}

	.diagram.panning {
		cursor: grabbing;
	}

	.canvas {
		position: absolute;
		left: 50%;
		top: 50%;
		transform-origin: center;
		will-change: transform;
	}

	/* The pristine svg that svg2roughjs reads; kept rendered but invisible. */
	.rough-source {
		position: absolute;
		left: -100000px;
		top: 0;
		width: 1px;
		height: 1px;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
	}

	.badge {
		position: absolute;
		top: 14px;
		left: 14px;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 10px;
	}

	.docs-link {
		position: absolute;
		/* Under the type badge; the top-right corner belongs to the zoom tools. */
		top: 46px;
		left: 14px;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 10px;
		text-decoration: none;
	}

	.docs-link:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.zoom-tools {
		position: absolute;
		display: flex;
		gap: 2px;
		padding: 3px;
		background: color-mix(in srgb, var(--surface) 72%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.07);
		top: 14px;
		right: 14px;
	}

	.zoom-tools button,
	.side-tools button {
		border: 0;
		background: transparent;
		color: var(--fg);
		border-radius: 7px;
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		display: grid;
		place-items: center;
		white-space: nowrap;
	}

	.zoom-tools button:hover,
	.side-tools button:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.side-tools button[aria-pressed='true'] {
		color: var(--accent);
		background: var(--accent-soft);
	}

	.side-tools {
		position: absolute;
		bottom: 14px;
		right: 14px;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		background: color-mix(in srgb, var(--surface) 72%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.07);
	}

	.side-sep {
		width: 1px;
		height: 16px;
		background: var(--border-strong);
		margin: 0 3px;
	}

	.diagram-frame:fullscreen {
		border-radius: 0;
	}

	.export-error {
		position: absolute;
		bottom: 44px;
		right: 14px;
		margin: 0;
		font-size: 12px;
		color: var(--error-fg);
		background: var(--surface);
		border: 1px solid var(--error-border);
		border-radius: 6px;
		padding: 4px 10px;
		z-index: 11;
	}

	/* Centered export dialog over the canvas. */
	.export-popover {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: grid;
		gap: 10px;
		width: min(400px, calc(100% - 32px));
		padding: 14px;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: 12px;
		box-shadow:
			0 4px 12px rgb(0 0 0 / 0.1),
			0 24px 64px rgb(0 0 0 / 0.24);
		z-index: 12;
	}

	.export-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 13.5px;
	}

	.export-close {
		border: 0;
		background: transparent;
		color: var(--muted);
		border-radius: 6px;
		padding: 4px;
		cursor: pointer;
		display: grid;
		place-items: center;
	}

	.export-close:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.export-embed {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12.5px;
		color: var(--muted);
		cursor: pointer;
	}

	.export-embed input {
		accent-color: var(--accent);
	}

	.export-row {
		display: grid;
		grid-template-columns: 44px 1fr 1fr;
		align-items: center;
		gap: 6px;
	}

	.export-row:has(.export-png) {
		grid-template-columns: 44px 1fr;
	}

	.export-format {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.export-row > button {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg);
		font-size: 12px;
		font-weight: 500;
		border-radius: 7px;
		padding: 5px 10px;
		cursor: pointer;
		white-space: nowrap;
		text-align: center;
	}

	.export-row > button:hover {
		background: var(--accent-soft);
		color: var(--accent);
		border-color: var(--accent);
	}

	.export-png {
		display: flex;
		align-items: center;
		gap: 8px;
		grid-column: 2;
	}

	.png-modes {
		display: flex;
		gap: 2px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 2px;
	}

	.png-modes button {
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
		font-weight: 500;
		padding: 3px 10px;
		border-radius: 6px;
		cursor: pointer;
		text-transform: capitalize;
	}

	.png-modes button.active {
		background: var(--surface);
		color: var(--fg);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
	}

	.png-size {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--muted);
	}

	.png-size input {
		width: 76px;
		font: inherit;
		font-size: 12.5px;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 3px 6px;
	}

	.png-actions {
		grid-column: 2;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.png-actions button {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg);
		font-size: 12px;
		font-weight: 500;
		border-radius: 7px;
		padding: 5px 10px;
		cursor: pointer;
		white-space: nowrap;
		text-align: center;
	}

	.png-actions button:hover {
		background: var(--accent-soft);
		color: var(--accent);
		border-color: var(--accent);
	}

	.export-popover:focus {
		outline: none;
	}

	.error-banner {
		max-width: min(560px, 90%);
		background: var(--error-bg);
		border: 1px solid var(--error-border);
		color: var(--error-fg);
		border-radius: var(--radius);
		padding: 14px 16px;
		font-size: 13.5px;
		display: grid;
		gap: 6px;
	}

	.error-banner pre {
		margin: 0;
		font-family: var(--mono);
		font-size: 12.5px;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.error-loc {
		font-family: var(--mono);
		font-size: 12px;
		opacity: 0.8;
	}
</style>
