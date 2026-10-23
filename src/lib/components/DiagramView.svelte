<script lang="ts">
	import { enableZoom, type Zoom } from 'pele';
	import type { RenderOutcome } from '$lib/render';
	import { exportPng, exportSvg, withResolvedTheme } from '$lib/export';

	interface Props {
		outcome: RenderOutcome;
	}

	let { outcome }: Props = $props();

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
	<button
		class="grid-toggle"
		onclick={toggleGrid}
		title={grid ? 'Hide grid' : 'Show grid'}
		aria-pressed={grid}
	>
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
			<path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
		</svg>
	</button>
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
		top: 12px;
		right: 12px;
		font-size: 11.5px;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 10px;
	}

	.toolbar {
		position: absolute;
		bottom: 12px;
		left: 12px;
		display: flex;
		gap: 4px;
	}

	.toolbar button {
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--fg);
		border-radius: 6px;
		padding: 4px 10px;
		font-size: 12px;
		cursor: pointer;
	}

	.toolbar button:hover {
		border-color: var(--accent);
		color: var(--accent);
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

	.grid-toggle {
		position: absolute;
		bottom: 12px;
		right: 12px;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--surface);
		color: var(--muted);
		cursor: pointer;
	}

	.grid-toggle:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.grid-toggle[aria-pressed='true'] {
		color: var(--accent);
		background: var(--accent-soft);
		border-color: color-mix(in srgb, var(--accent) 30%, transparent);
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
