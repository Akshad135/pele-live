<script lang="ts">
	import { history, type HistoryEntry } from '$lib/history.svelte';

	let tab = $state<'manual' | 'auto'>('manual');
	let editingId = $state<string | undefined>();
	let editName = $state('');
	let importError = $state('');
	let fileInput = $state<HTMLInputElement | undefined>();

	const list = $derived(tab === 'manual' ? history.manual : history.auto);

	function label(entry: HistoryEntry) {
		return entry.name ?? new Date(entry.time).toLocaleString();
	}

	function ago(time: number) {
		const seconds = Math.round((Date.now() - time) / 1000);
		const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
		if (seconds < 60) return rtf.format(-seconds, 'second');
		const minutes = Math.round(seconds / 60);
		if (minutes < 60) return rtf.format(-minutes, 'minute');
		const hours = Math.round(minutes / 60);
		if (hours < 24) return rtf.format(-hours, 'hour');
		return rtf.format(-Math.round(hours / 24), 'day');
	}

	function startRename(entry: HistoryEntry) {
		editingId = entry.id;
		editName = entry.name ?? '';
	}

	function commitRename(entry: HistoryEntry) {
		history.rename(entry.id, editName);
		editingId = undefined;
	}

	async function importFile(files: FileList | undefined | null) {
		const file = files?.[0];
		if (!file) return;
		const result = history.import(await file.text());
		importError =
			result.restored === 0 && result.invalid === 0
				? 'No history entries found in that file.'
				: result.invalid > 0
					? `Restored ${result.restored}, skipped ${result.duplicates} duplicates and ${result.invalid} invalid.`
					: '';
		if (fileInput) fileInput.value = '';
	}
</script>

<div class="panel">
	<div class="head">
		<div class="tabs" role="tablist" aria-label="History lists">
			<button role="tab" aria-selected={tab === 'manual'} class:active={tab === 'manual'} onclick={() => (tab = 'manual')}>
				Saved <span class="count">{history.manual.length}</span>
			</button>
			<button role="tab" aria-selected={tab === 'auto'} class:active={tab === 'auto'} onclick={() => (tab = 'auto')}>
				Timeline <span class="count">{history.auto.length}</span>
			</button>
		</div>
		<div class="head-actions">
			<button class="action" onclick={() => history.save()}>Save version</button>
			<button class="icon" title="Export this list as JSON" onclick={() => history.export(tab)}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
			</button>
			<button class="icon" title="Import a history JSON file" onclick={() => fileInput?.click()}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept="application/json,.json"
				hidden
				onchange={(e) => importFile(e.currentTarget.files)}
			/>
		</div>
	</div>

	{#if importError}
		<p class="note" role="alert">{importError}</p>
	{/if}

	{#if list.length === 0}
		<p class="note">
			{tab === 'manual'
				? 'No saved versions yet. Use “Save version” to bookmark the current diagram.'
				: 'The timeline records your work every minute while you edit.'}
		</p>
	{:else}
		<ul>
			{#each list as entry (entry.id)}
				<li>
					<div class="meta">
						{#if editingId === entry.id}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								class="rename"
								value={editName}
								autofocus
								oninput={(e) => (editName = e.currentTarget.value)}
								onkeydown={(e) => {
									// Only the rename reacts: Escape here must not bubble to the
									// document handler that closes the whole panel.
									e.stopPropagation();
									if (e.key === 'Enter') commitRename(entry);
									if (e.key === 'Escape') editingId = undefined;
								}}
								onblur={() => commitRename(entry)}
							/>
						{:else}
							<span class="name" title={label(entry)}>{label(entry)}</span>
						{/if}
						<span class="time">{ago(entry.time)} · {entry.type === 'manual' ? 'saved' : 'auto'}</span>
					</div>
					<div class="row-actions">
						{#if entry.type === 'manual'}
							<button title="Rename" onclick={() => startRename(entry)}>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
							</button>
						{/if}
						<a href={history.entryUrl(entry)} target="_blank" rel="noopener" title="Open in new tab">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
						</a>
						<button title="Restore this version" onclick={() => history.restore(entry.id)}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6M3.5 13a9 9 0 1 0 2-7.5L3 7" /></svg>
						</button>
						<button title="Delete" onclick={() => history.remove(entry.id)}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
						</button>
					</div>
				</li>
			{/each}
		</ul>
		<button class="clear" onclick={() => history.clear(tab)}>Clear {tab === 'manual' ? 'saved' : 'timeline'}</button>
	{/if}
</div>

<style>
	.panel {
		width: 360px;
		max-width: calc(100vw - 32px);
		max-height: min(460px, 70vh);
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.16);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.tabs {
		display: flex;
		gap: 2px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 2px;
	}

	.tabs button {
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
		font-weight: 500;
		padding: 3px 10px;
		border-radius: 6px;
		cursor: pointer;
	}

	.tabs button.active {
		background: var(--surface);
		color: var(--fg);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
	}

	.count {
		color: var(--muted);
		font-size: 11px;
		margin-left: 3px;
	}

	.head-actions {
		display: flex;
		gap: 2px;
	}

	.head-actions .action {
		border: 0;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 12px;
		font-weight: 500;
		border-radius: 7px;
		padding: 4px 10px;
		cursor: pointer;
		white-space: nowrap;
	}

	.head-actions .action:hover {
		filter: brightness(0.96);
	}

	.head-actions .icon {
		border: 0;
		background: transparent;
		color: var(--muted);
		border-radius: 7px;
		padding: 5px;
		cursor: pointer;
		display: grid;
		place-items: center;
	}

	.head-actions .icon:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 7px 6px;
		border-radius: 8px;
	}

	li:hover {
		background: var(--bg);
	}

	li + li {
		border-top: 1px solid var(--border);
	}

	.meta {
		min-width: 0;
		display: grid;
		gap: 1px;
	}

	.name {
		font-size: 13px;
		font-weight: 500;
		color: var(--fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}

	.time {
		font-size: 11.5px;
		color: var(--muted);
	}

	.rename {
		font: inherit;
		font-size: 13px;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 6px;
		padding: 2px 6px;
		width: 200px;
		max-width: 100%;
	}

	.row-actions {
		display: flex;
		gap: 1px;
		flex-shrink: 0;
	}

	.row-actions button,
	.row-actions a {
		border: 0;
		background: transparent;
		color: var(--muted);
		border-radius: 6px;
		padding: 5px;
		cursor: pointer;
		display: grid;
		place-items: center;
	}

	.row-actions button:hover,
	.row-actions a:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.note {
		margin: 4px 2px;
		font-size: 12.5px;
		color: var(--muted);
		line-height: 1.5;
	}

	.clear {
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
		padding: 4px;
		cursor: pointer;
		text-align: center;
		border-radius: 6px;
	}

	.clear:hover {
		color: var(--error-fg);
		background: var(--error-bg);
	}
</style>
