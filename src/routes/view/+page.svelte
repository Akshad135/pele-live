<script lang="ts">
	import DiagramView from '$lib/components/DiagramView.svelte';
	import { parseConfig, renderDiagram } from '$lib/render';
	import { deserializeState, serializeState } from '$lib/serde';
	import { PeleError } from 'pele';

	// A shared link: /view#pako:… — renders the diagram with no editor chrome.
	const shared =
		typeof location !== 'undefined'
			? (() => {
					try {
						return deserializeState(decodeURIComponent(location.hash.slice(1)));
					} catch {
						return null;
					}
				})()
			: null;

	const parsed = shared ? parseConfig(shared.config) : { error: 'No diagram in this link.' };
	const outcome = $derived(
		shared && !parsed.error
			? renderDiagram(shared.code, parsed.config)
			: {
					ok: false as const,
					error: new PeleError(parsed.error ?? 'No diagram in this link.')
				}
	);

	// Back into the editor with the same diagram loaded.
	const editorHref =
		shared && !parsed.error
			? `/#${serializeState({ code: shared.code, config: shared.config, css: shared.css })}`
			: '/';

	function backToEditor(event: MouseEvent) {
		// This tab is normally a script-opened popout: close it and put focus
		// back on the editor tab it came from. window.close() only works for
		// script-opened tabs, so if it survives (opener gone, link opened
		// directly), fall back to turning this tab into the editor.
		try {
			(window.opener as Window | null)?.focus();
		} catch {
			// The opener may be cross-origin or gone; focusing is a nicety.
		}
		window.close();
		if (!window.closed) {
			event.preventDefault();
			window.location.href = editorHref;
		}
	}
</script>

<svelte:head>
	<title>Pele Live — diagram</title>
</svelte:head>

<div class="stage">
	<DiagramView {outcome} css={shared?.css ?? ''} shared={shared ?? undefined} />
	<a class="back" href={editorHref} onclick={backToEditor}>Back to editor</a>
</div>

<style>
	.stage {
		height: 100dvh;
	}

	.back {
		position: fixed;
		/* Below the zoom tools, which own the top-right corner. */
		top: 60px;
		right: 14px;
		z-index: 20;
		text-decoration: none;
		color: var(--fg);
		background: color-mix(in srgb, var(--surface) 72%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 5px 12px;
		font-size: 12.5px;
		font-weight: 500;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.07);
	}

	.back:hover {
		color: var(--accent);
	}
</style>
