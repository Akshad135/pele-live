<script lang="ts">
	import DiagramView from '$lib/components/DiagramView.svelte';
	import SourceEditor from '$lib/components/SourceEditor.svelte';
	import { appState, loadedFromHash } from '$lib/state.svelte';
	import { parseConfig, renderDiagram } from '$lib/render';
	import { PeleError } from 'pele';
	import { deserializeState, serializeState } from '$lib/serde';
	import { SAMPLES } from '$lib/samples';

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

	function openSample(name: string) {
		const sample = SAMPLES.find((s) => s.name === name);
		if (!sample) return;
		appState.load({ code: sample.source, config: '{}' });
		history.replaceState(null, '', window.location.pathname);
		samplesOpen = false;
	}

	let samplesOpen = $state(false);

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

<header>
	<a class="wordmark" href="/">pele<span>.live</span></a>
	<span class="tagline">Mermaid playground · renders locally, nothing leaves your browser</span>
	<div class="actions">
		<details class="menu" bind:open={samplesOpen}>
			<summary class="action">Samples</summary>
			<div class="menu-list">
				{#each SAMPLES as sample (sample.name)}
					<button onclick={() => openSample(sample.name)}>{sample.name}</button>
				{/each}
			</div>
		</details>
		<button class="action primary" onclick={share}>{copied ? 'Link copied' : 'Share'}</button>
	</div>
</header>

<main>
	<div class="panes" bind:this={panes} style={`grid-template-columns: ${split}fr 6px 1fr`}>
		<section class="pane" aria-label="Mermaid source">
			<SourceEditor value={appState.code} oninput={(code) => (appState.code = code)} />
		</section>
		<div
			class="divider"
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize panes"
			onpointerdown={startDrag}
		></div>
		<section class="pane" aria-label="Diagram preview">
			<DiagramView {outcome} />
		</section>
	</div>
</main>

<style>
	header {
		display: flex;
		align-items: baseline;
		gap: 14px;
		padding: 10px 18px;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	.actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
		align-self: center;
	}

	.action {
		border: 1px solid var(--border-strong);
		background: var(--surface);
		color: var(--fg);
		border-radius: var(--radius);
		padding: 6px 14px;
		font-size: 13px;
		cursor: pointer;
	}

	.action:hover {
		border-color: var(--accent);
	}

	.action.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-fg);
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
		border-color: var(--accent);
	}

	.menu-list {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		z-index: 10;
		min-width: 190px;
		max-height: 70vh;
		overflow: auto;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
		padding: 4px;
		display: grid;
	}

	.menu-list button {
		text-align: left;
		border: 0;
		background: none;
		padding: 7px 12px;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
	}

	.menu-list button:hover {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}

	.wordmark {
		font-weight: 700;
		font-size: 17px;
		color: var(--fg);
		text-decoration: none;
		letter-spacing: -0.02em;
	}

	.wordmark span {
		color: var(--muted);
		font-weight: 500;
	}

	.tagline {
		font-size: 12.5px;
		color: var(--muted);
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
