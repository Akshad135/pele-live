<script lang="ts">
	import DiagramView from '$lib/components/DiagramView.svelte';
	import SourceEditor from '$lib/components/SourceEditor.svelte';
	import { appState } from '$lib/state.svelte';
	import { parseConfig, renderDiagram } from '$lib/render';
	import { PeleError } from 'pele';

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
