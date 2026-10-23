<script lang="ts">
	import DiagramView from '$lib/components/DiagramView.svelte';
	import SourceEditor from '$lib/components/SourceEditor.svelte';
	import { appState, loadedFromHash } from '$lib/state.svelte';
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
			config: appState.config
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
			config: appState.config
		})}`;
		window.open(url, '_blank', 'noopener');
	}

	function openSample(name: string) {
		const sample = SAMPLES.find((s) => s.name === name);
		if (!sample) return;
		appState.load({ code: sample.source, config: '{}' });
		history.replaceState(null, '', window.location.pathname);
		samplesOpen = false;
	}

	let samplesOpen = $state(false);
	let editorTab = $state<'diagram' | 'config'>('diagram');
	// The theme label is rendered after hydration: the prerendered page cannot
	// know the saved choice, and a differing label would be a hydration mismatch.
	let mounted = $state(false);
	onMount(() => (mounted = true));

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

<div class="shell">
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
				class="action"
				onclick={() => themeState.cycle()}
				title="Cycle theme (Auto → Light → Dark)"
			>
				{mounted ? themeState.label : ''}
			</button>
			<button class="action primary" onclick={share}>{copied ? 'Link copied' : 'Share'}</button>
		</div>
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
			</div>
			{#if editorTab === 'diagram'}
				<div class="editor-body">
					<SourceEditor value={appState.code} oninput={(code) => (appState.code = code)} error={sourceError} />
				</div>
			{:else}
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
			<DiagramView {outcome} onpopout={popout} />
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
