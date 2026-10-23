<script lang="ts">
	import { basicSetup, EditorView } from 'codemirror';
	import { EditorState, type Extension } from '@codemirror/state';
	import { mermaidLanguage } from '$lib/mermaidLanguage';

	interface Props {
		value: string;
		oninput: (code: string) => void;
		extensions?: Extension[];
	}

	import { untrack } from 'svelte';

	let { value, oninput, extensions = [] }: Props = $props();

	let container = $state<HTMLDivElement | undefined>();
	let view: EditorView | undefined;

	$effect(() => {
		// The initial document is captured once; later prop changes flow through
		// the sync effect below so the view is never recreated mid-typing.
		const initialDoc = untrack(() => value);
		const editor = new EditorView({
			parent: container,
			state: EditorState.create({
				doc: initialDoc,
				extensions: [
					basicSetup,
					mermaidLanguage,
					EditorView.lineWrapping,
					EditorView.updateListener.of((update) => {
						if (update.docChanged) oninput(editor.state.doc.toString());
					}),
					...extensions
				]
			})
		});
		view = editor;
		return () => {
			view = undefined;
			editor.destroy();
		};
	});

	// Sync outside changes (reset, sample, share link) into the editor.
	$effect(() => {
		const text = value;
		if (view && text !== view.state.doc.toString()) {
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
		}
	});
</script>

<div class="source-editor" bind:this={container}></div>

<style>
	.source-editor {
		height: 100%;
		overflow: hidden;
		font-size: 13.5px;
	}

	.source-editor :global(.cm-editor) {
		height: 100%;
		background: var(--surface);
	}

	.source-editor :global(.cm-gutters) {
		background: var(--surface);
		border-right: 1px solid var(--border);
		color: var(--muted);
	}

	.source-editor :global(.cm-activeLine) {
		background: color-mix(in srgb, var(--accent) 5%, transparent);
	}

	.source-editor :global(.cm-activeLineGutter) {
		background: transparent;
		color: var(--fg);
	}
</style>
