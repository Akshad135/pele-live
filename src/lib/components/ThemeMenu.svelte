<script lang="ts">
	import { THEMES, themeState, type ThemeChoice } from '$lib/theme.svelte';

	let open = $state(false);

	// Close on Escape or a click outside of it.
	$effect(() => {
		if (!open) return;
		const close = (event: Event) => {
			if (!(event.target instanceof Element) || !event.target.isConnected) return;
			if (event.target.closest('.theme-menu, .theme-toggle')) return;
			open = false;
		};
		const keyClose = (event: KeyboardEvent) => {
			if (event.key === 'Escape') open = false;
		};
		document.addEventListener('click', close);
		document.addEventListener('keydown', keyClose);
		return () => {
			document.removeEventListener('click', close);
			document.removeEventListener('keydown', keyClose);
		};
	});

	function pick(id: ThemeChoice) {
		themeState.set(id);
		open = false;
	}
</script>

<div class="theme-menu">
	<button
		class="theme-toggle"
		class:active={open}
		aria-expanded={open}
		onclick={() => (open = !open)}
		title="Pick a theme"
	>
		<span class="swatch" class:dark={THEMES.find((t) => t.id === themeState.current)?.scheme === 'dark'}></span>
		{themeState.label}
	</button>
	{#if open}
		<div class="menu">
			{#each THEMES as option (option.id)}
				<button
					aria-pressed={themeState.current === option.id}
					class:selected={themeState.current === option.id}
					onclick={() => pick(option.id)}
				>
					<span class="dot {option.id}"></span>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.theme-menu {
		position: relative;
	}

	.theme-toggle {
		border: 1px solid transparent;
		background: transparent;
		color: var(--fg);
		border-radius: 8px;
		padding: 7px 14px;
		font-size: 13.5px;
		font-weight: 500;
		cursor: pointer;
		transition: background 100ms;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.theme-toggle:hover,
	.theme-toggle.active {
		background: var(--accent-soft);
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: 4px;
		background: linear-gradient(120deg, #ffffff 50%, #161616 50%);
		border: 1px solid var(--border-strong);
	}

	.menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 40;
		display: grid;
		gap: 2px;
		min-width: 170px;
		padding: 6px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.16);
	}

	.menu button {
		border: 0;
		background: transparent;
		color: var(--fg);
		font-size: 13.5px;
		padding: 8px 12px;
		border-radius: 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 9px;
		text-align: left;
	}

	.menu button:hover {
		background: var(--accent-soft);
	}

	.menu button.selected {
		color: var(--accent);
		background: var(--accent-soft);
	}

	.dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		border: 1px solid var(--border-strong);
		flex-shrink: 0;
	}

	.dot.auto {
		background: linear-gradient(120deg, #ffffff 50%, #111a2e 50%);
	}

	.dot.day {
		background: #f4f4f5;
	}

	.dot.paper {
		background: #0f766e;
	}

	.dot.midnight {
		background: #1c2942;
	}

	.dot.matte {
		background: #111111;
	}
</style>
