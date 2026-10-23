<script lang="ts">
	import { enableZoom, type Zoom } from 'pele';
	import type { RenderOutcome } from '$lib/render';
	import { exportPng, exportSvg, withResolvedTheme } from '$lib/export';

	interface Props {
		outcome: RenderOutcome;
		/** Opens the current diagram in its own tab. Button hidden when absent. */
		onpopout?: () => void;
	}

	let { outcome, onpopout }: Props = $props();

	let frame = $state<HTMLDivElement | undefined>();
	// The element whose first element child is the svg — what enableZoom needs.
	let stage = $state<HTMLDivElement | undefined>();
	let zoom: Zoom | undefined;

	$effect(() => {
		if (!stage) return;
		// `always`: a playground diagram may fit its pane and still be worth zooming.
		const instance = enableZoom(stage, { always: true, maxScale: 8 });
		zoom = instance;
		return () => {
			if (zoom === instance) zoom = undefined;
			instance.destroy();
		};
	});

	// Pele's zoom does not watch the DOM: it needs refresh() to pick up the
	// svg that {@html} replaces on every render.
	$effect(() => {
		void outcome;
		zoom?.refresh();
	});

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let exportError = $state('');

	$effect(() => () => clearTimeout(copyTimer));

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
			// Fullscreen can be refused (permissions policy, iframe); the button just does nothing.
		}
	}

	async function copySvg() {
		if (!outcome.ok || !frame) return;
		const source = frame.querySelector('svg');
		if (!source) return;
		try {
			await navigator.clipboard.writeText(withResolvedTheme(outcome.svg, source));
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1600);
		} catch {
			exportError = 'Clipboard is unavailable here.';
		}
	}

	async function downloadSvg() {
		if (!outcome.ok || !frame) return;
		const source = frame.querySelector('svg');
		if (!source) return;
		exportSvg(outcome.svg, source);
	}

	async function downloadPng() {
		if (!outcome.ok) return;
		const source = frame?.querySelector('svg');
		if (!source) return;
		exportError = '';
		try {
			await exportPng(outcome.svg, source);
		} catch (e) {
			exportError = e instanceof Error ? e.message : 'PNG export failed.';
		}
	}
</script>

<div class="diagram-frame" class:has-error={!outcome.ok} class:grid={grid && outcome.ok} bind:this={frame}>
	{#if outcome.ok}
		<div class="diagram" bind:this={stage}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- Pele sanitizes its own SVG output -->
			{@html outcome.svg}
		</div>
		<span class="badge" title="Rendered diagram type">{outcome.diagramType}</span>
		<div class="toolbar">
			<button onclick={copySvg}>{copied ? 'Copied' : 'Copy SVG'}</button>
			<button onclick={downloadSvg}>SVG</button>
			<button onclick={downloadPng}>PNG</button>
		</div>
		<div class="side-tools">
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
			<button onclick={toggleGrid} title={grid ? 'Hide grid' : 'Show grid'} aria-pressed={grid}>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
					<path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
				</svg>
			</button>
		</div>
		{#if exportError}
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
		overflow: auto;
		display: grid;
		place-items: center;
		padding: 28px;
		background: var(--surface);
	}

	/* Dot grid, like the original editor's preview, tuned subtle. */
	.diagram-frame.grid {
		background-image: radial-gradient(var(--grid-dot) 1px, transparent 1px);
		background-size: 20px 20px;
		background-position: -1px -1px;
	}

	.diagram {
		max-width: 100%;
		line-height: 0;
	}

	.diagram :global(svg) {
		max-width: 100%;
		height: auto;
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

	.toolbar {
		position: absolute;
		bottom: 14px;
		left: 14px;
		display: flex;
		gap: 2px;
		padding: 3px;
		background: color-mix(in srgb, var(--surface) 72%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.07);
	}

	.toolbar button,
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
	}

	.toolbar button:hover,
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
		gap: 2px;
		padding: 3px;
		background: color-mix(in srgb, var(--surface) 72%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.07);
	}

	.diagram-frame:fullscreen {
		border-radius: 0;
	}

	.export-error {
		position: absolute;
		bottom: 44px;
		left: 12px;
		margin: 0;
		font-size: 12px;
		color: var(--error-fg);
		background: var(--surface);
		border: 1px solid var(--error-border);
		border-radius: 6px;
		padding: 4px 10px;
	}

	/* Pele's zoom buttons: match the page instead of the diagram's variables. */
	.diagram-frame :global(.pele-zoom) {
		background: var(--surface) !important;
		color: var(--fg) !important;
		border-color: var(--border-strong) !important;
	}

	.diagram-frame :global(.pele-zoom button:hover:not(:disabled)) {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
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
