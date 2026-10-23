<script lang="ts">
	import type { RenderOutcome } from '$lib/render';

	interface Props {
		outcome: RenderOutcome;
	}

	let { outcome }: Props = $props();
</script>

<div class="diagram-frame" class:has-error={!outcome.ok}>
	{#if outcome.ok}
		<div class="diagram">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- Pele sanitizes its own SVG output -->
			{@html outcome.svg}
		</div>
		<span class="badge" title="Rendered diagram type">{outcome.diagramType}</span>
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
		padding: 24px;
		background:
			radial-gradient(color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px) 0 0 /
				22px 22px;
	}

	.diagram {
		max-width: 100%;
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
