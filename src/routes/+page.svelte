<script lang="ts">
	import DiagramView from '$lib/components/DiagramView.svelte';
	import HistoryPanel from '$lib/components/HistoryPanel.svelte';
	import SourceEditor from '$lib/components/SourceEditor.svelte';
	import { appState, loadedFromHash } from '$lib/state.svelte';
	import { history as diagramHistory } from '$lib/history.svelte';
	import { importDiagramFile } from '$lib/importDiagram';
	import { parseConfig, renderDiagram } from '$lib/render';
	import { PeleError } from 'pele';
	import { serializeState } from '$lib/serde';
	import { SAMPLES } from '$lib/samples';
	import { onMount } from 'svelte';
	import { themeState } from '$lib/theme.svelte';

	// Split position as a fraction of the playground width, persisted.
	const SPLIT_KEY = 'pele-live:split';
	let split = $state(0.5);
	let panes = $state<HTMLDivElement | undefined>();

	function fractionFrom(clientX: number) {
		if (!panes) return;
		const rect = panes.getBoundingClientRect();
		split = Math.min(0.8, Math.max(0.2, (clientX - rect.left) / rect.width));
	}

	function startDrag(event: PointerEvent) {
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		const move = (e: PointerEvent) => fractionFrom(e.clientX);
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
			try {
				localStorage.setItem(SPLIT_KEY, String(split));
			} catch {
				// Saving the split is a nicety, not a requirement.
			}
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	}

	if (typeof localStorage !== 'undefined') {
		try {
			const saved = Number(localStorage.getItem(SPLIT_KEY));
			if (saved >= 0.2 && saved <= 0.8) split = saved;
		} catch {
			// Unavailable storage keeps the default split.
		}
	}

	const parsedConfig = $derived(parseConfig(appState.config));
	const outcome = $derived(
		parsedConfig.error
			? { ok: false as const, error: new PeleError(`Invalid config JSON: ${parsedConfig.error}`) }
			: renderDiagram(appState.code, parsedConfig.config)
	);

	// The hash was already applied during state initialization (no first-paint flicker);
	// drop it from the address bar so a reload restores the saved session instead.
	if (loadedFromHash) {
		history.replaceState(null, '', window.location.pathname);
	}

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function share() {
		const url = `${window.location.origin}${window.location.pathname}#${serializeState({
			code: appState.code,
			config: appState.config,
			css: appState.css
		})}`;
		try {
			await navigator.clipboard.writeText(url);
		} catch {
			window.prompt('Copy this link:', url);
			return;
		}
		copied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = false), 1600);
	}

	function popout() {
		const url = `${window.location.origin}/view#${serializeState({
			code: appState.code,
			config: appState.config,
			css: appState.css
		})}`;
		window.open(url, '_blank', 'noopener');
	}

	function openSample(name: string) {
		const sample = SAMPLES.find((s) => s.name === name);
		if (!sample) return;
		appState.load({ code: sample.source, config: '{}', css: sample.css ?? '' });
		history.replaceState(null, '', window.location.pathname);
		samplesOpen = false;
	}

	// --- Import (.mmd or any export of this editor with embedded state) ------
	let fileInput = $state<HTMLInputElement | undefined>();
	let dragOver = $state(false);
	let importError = $state('');
	let importErrorTimer: ReturnType<typeof setTimeout> | undefined;

	async function importFiles(files: FileList | undefined | null) {
		const file = files?.[0];
		if (!file) return;
		try {
			const result = await importDiagramFile(file);
			if ('error' in result) {
				importError = result.error;
			} else {
				appState.load(result);
				history.replaceState(null, '', window.location.pathname);
				importError = result.warn ?? '';
			}
		} catch {
			importError = `Could not read ${file.name}.`;
		}
		if (fileInput) fileInput.value = '';
		clearTimeout(importErrorTimer);
		importErrorTimer = setTimeout(() => (importError = ''), 4000);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		if (event.dataTransfer?.files.length) void importFiles(event.dataTransfer.files);
	}

	function onDragLeave(event: DragEvent) {
		// Child crossings also fire dragleave on the shell; only a real exit
		// (relatedTarget outside, or leaving the window) hides the veil.
		const shell = event.currentTarget as HTMLElement | null;
		if (!shell || !shell.contains(event.relatedTarget as Node | null)) dragOver = false;
	}

	let samplesOpen = $state(false);
	let historyOpen = $state(false);
	let editorTab = $state<'diagram' | 'config' | 'css'>('diagram');
	// The theme label is rendered after hydration: the prerendered page cannot
	// know the saved choice, and a differing label would be a hydration mismatch.
	let mounted = $state(false);
	onMount(() => (mounted = true));

	// Minute-by-minute timeline snapshots for the history panel.
	onMount(() => diagramHistory.startAutoSave());

	// Close the history panel on Escape or a click outside of it.
	$effect(() => {
		if (!historyOpen) return;
		const close = (event: Event) => {
			if (!(event.target instanceof Element)) return;
			// The toggle is excluded: its click opens the panel, and this document
			// listener is added during that same click's dispatch.
			if (event.target.closest('.history-menu, .history-toggle')) return;
			historyOpen = false;
		};
		const keyClose = (event: KeyboardEvent) => {
			if (event.key === 'Escape') historyOpen = false;
		};
		document.addEventListener('click', close);
		document.addEventListener('keydown', keyClose);
		return () => {
			document.removeEventListener('click', close);
			document.removeEventListener('keydown', keyClose);
		};
	});

	// The error shown as an inline marker: only source errors map to editor lines.
	const sourceError = $derived(
		outcome.ok || parsedConfig.error
			? null
			: { line: outcome.error.line, column: outcome.error.column, message: outcome.error.message }
	);

	// Close the samples menu on Escape or a click outside of it.
	$effect(() => {
		if (!samplesOpen) return;
		const close = (event: Event) => {
			if (!(event.target instanceof Element) || !event.target.closest('.menu')) {
				samplesOpen = false;
			}
		};
		const keyClose = (event: KeyboardEvent) => {
			if (event.key === 'Escape') samplesOpen = false;
		};
		document.addEventListener('click', close);
		document.addEventListener('keydown', keyClose);
		return () => {
			document.removeEventListener('click', close);
			document.removeEventListener('keydown', keyClose);
		};
	});
</script>

<svelte:head>
	<title>Pele Live — Mermaid playground</title>
	<meta
		name="description"
		content="A fast, private Mermaid playground. Diagrams render locally with Pele — no accounts, no tracking."
	/>
</svelte:head>

<!-- svelte-ignore a11y_no_static_element_interactions -- Drag-drop is a duplicate of the Import button; the shell has no single role. -->
<div
	class="shell"
	class:drag-over={dragOver}
	ondragover={(e) => {
		e.preventDefault();
		dragOver = true;
	}}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	{#if importError}
		<p class="import-toast" role="alert">{importError}</p>
	{/if}
	{#if dragOver}
		<div class="drop-hint" aria-hidden="true">Drop to import</div>
	{/if}
	<header>
		<a class="wordmark" href="/">
			<svg class="mark" width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
				<rect width="32" height="32" rx="7" fill="var(--fg)" />
				<path
					d="M8 11h7a4 4 0 0 1 4 4v1M8 21h7a4 4 0 0 0 4-4v-1"
					fill="none"
					stroke="var(--surface)"
					stroke-width="2.5"
					stroke-linecap="round"
				/>
				<circle cx="22.5" cy="16" r="2.5" fill="var(--accent)" />
			</svg>
			pele<span>.live</span>
		</a>
		<span class="tagline">renders locally, nothing leaves your browser</span>
		<div class="actions">
			<details class="menu" bind:open={samplesOpen}>
				<summary class="action">Samples</summary>
				<div class="menu-list">
					{#each SAMPLES as sample (sample.name)}
						<button onclick={() => openSample(sample.name)}>{sample.name}</button>
					{/each}
				</div>
			</details>
			<button
				class="action history-toggle"
				class:active={historyOpen}
				onclick={() => (historyOpen = !historyOpen)}
				title="Saved versions and a timeline of your work"
			>
				History
			</button>
			<button
				class="action"
				onclick={() => fileInput?.click()}
				title="Import a .mmd file, or an SVG/PNG/HTML exported from here"
			>
				Import
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept=".mmd,.mermaid,.txt,.svg,.png,.html,.htm"
				hidden
				onchange={(e) => importFiles(e.currentTarget.files)}
			/>
			<button
				class="action"
				onclick={() => themeState.cycle()}
				title="Cycle theme (Auto → Light → Dark)"
			>
				{mounted ? themeState.label : ''}
			</button>
		<button class="action primary" onclick={share}>{copied ? 'Link copied' : 'Share'}</button>
	</div>
	{#if historyOpen}
		<div class="history-menu">
			<HistoryPanel />
		</div>
	{/if}
	</header>

	<main>
		<div class="panes" bind:this={panes} style={`grid-template-columns: ${split}fr 6px 1fr`}>
		<section class="pane" aria-label="Mermaid source">
			<div class="editor-tabs">
				<button
					aria-pressed={editorTab === 'diagram'}
					class:active={editorTab === 'diagram'}
					onclick={() => (editorTab = 'diagram')}
				>
					Diagram
				</button>
				<button
					aria-pressed={editorTab === 'config'}
					class:active={editorTab === 'config'}
					onclick={() => (editorTab = 'config')}
				>
					Config
				</button>
				<button
					aria-pressed={editorTab === 'css'}
					class:active={editorTab === 'css'}
					onclick={() => (editorTab = 'css')}
				>
					CSS
				</button>
			</div>
			{#if editorTab === 'diagram'}
				<div class="editor-body">
					<SourceEditor value={appState.code} oninput={(code) => (appState.code = code)} error={sourceError} />
				</div>
			{:else if editorTab === 'config'}
				<div class="editor-body config-body">
					<textarea
						class="config-editor"
						spellcheck="false"
						aria-label="Mermaid config JSON"
						bind:value={appState.config}
					></textarea>
					{#if parsedConfig.error}
						<p class="config-error" role="alert">Config JSON: {parsedConfig.error}</p>
					{:else}
						<p class="config-hint">
							Pele reads the config keys it supports (passed to the renderer); the rest are ignored.
						</p>
					{/if}
				</div>
			{:else}
				<div class="editor-body config-body">
					<textarea
						class="config-editor css-editor"
						spellcheck="false"
						aria-label="Custom diagram CSS"
						placeholder={'.pele-node {\n  fill: #eef4ff;\n}'}
						bind:value={appState.css}
					></textarea>
					<p class="config-hint">
						CSS scoped to the preview. Style pele's classes — .pele-node, .pele-edge,
						.pele-label, .pele-cluster, [data-id] — or plain svg selectors.
					</p>
				</div>
			{/if}
		</section>
		<div
			class="divider"
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize panes"
			onpointerdown={startDrag}
		></div>
		<section class="pane" aria-label="Diagram preview">
			<DiagramView
				{outcome}
				css={appState.css}
				shared={{ code: appState.code, config: appState.config, css: appState.css }}
				onpopout={popout}
			/>
		</section>
	</div>
</main>
</div>

<style>
	header {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 52px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
		flex-shrink: 0;
	}

	.wordmark {
		font-weight: 650;
		font-size: 15px;
		color: var(--fg);
		text-decoration: none;
		letter-spacing: -0.01em;
	}

	.wordmark span {
		color: var(--muted);
		font-weight: 450;
	}

	.tagline {
		font-size: 12.5px;
		color: var(--muted);
	}

	.actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.action {
		border: 1px solid transparent;
		background: transparent;
		color: var(--fg);
		border-radius: 8px;
		padding: 6px 12px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background 100ms;
	}

	.action:hover {
		background: var(--accent-soft);
	}

	.action.primary {
		background: var(--accent);
		color: var(--accent-fg);
	}

	.action.primary:hover {
		background: color-mix(in srgb, var(--accent) 88%, black);
	}

	.action.active {
		background: var(--accent-soft);
		color: var(--accent);
	}

	/* History dropdown, anchored to the header's right edge. */
	.history-menu {
		position: absolute;
		top: calc(100% + 2px);
		right: 12px;
		z-index: 30;
	}

	header {
		position: relative;
	}

	.menu {
		position: relative;
	}

	.menu summary {
		list-style: none;
		user-select: none;
	}

	.menu summary::-webkit-details-marker {
		display: none;
	}

	.menu[open] summary {
		background: var(--accent-soft);
	}

	.menu-list {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		z-index: 10;
		min-width: 200px;
		max-height: 70vh;
		overflow: auto;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		box-shadow:
			0 4px 12px rgb(0 0 0 / 0.08),
			0 16px 32px rgb(0 0 0 / 0.08);
		padding: 4px;
		display: grid;
	}

	.menu-list button {
		text-align: left;
		border: 0;
		background: none;
		padding: 7px 12px;
		border-radius: 7px;
		font-size: 13px;
		cursor: pointer;
	}

	.menu-list button:hover {
		background: var(--accent-soft);
	}

	main {
		flex: 1;
		min-height: 0;
	}

	.panes {
		height: 100%;
		display: grid;
	}

	.pane {
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--surface);
		display: flex;
		flex-direction: column;
	}

	.editor-tabs {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		margin: 8px 10px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 9px;
		align-self: flex-start;
	}

	.editor-tabs button {
		border: 0;
		background: transparent;
		border-radius: 7px;
		padding: 4px 14px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--muted);
		cursor: pointer;
		transition: color 100ms;
	}

	.editor-tabs button:hover {
		color: var(--fg);
	}

	.editor-tabs button.active {
		background: var(--surface);
		color: var(--fg);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
	}

	.editor-body {
		flex: 1;
		min-height: 0;
		border-top: 1px solid var(--border);
	}

	.config-body {
		display: flex;
		flex-direction: column;
		padding: 12px 14px;
		gap: 10px;
	}

	.config-editor {
		flex: 1;
		min-height: 0;
		resize: none;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 13px;
		line-height: 1.55;
		padding: 10px 12px;
	}

	.config-editor:focus {
		outline: none;
		border-color: var(--accent);
	}

	.config-error {
		margin: 0;
		font-size: 12.5px;
		color: var(--error-fg);
	}

	.config-hint {
		margin: 0;
		font-size: 12.5px;
		color: var(--muted);
	}

	.divider {
		cursor: col-resize;
		background: var(--border);
		touch-action: none;
		transition: background 120ms;
	}

	.divider:hover {
		background: var(--accent);
	}
</style>
