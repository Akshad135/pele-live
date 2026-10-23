<script lang="ts">
	import { basicSetup, EditorView } from 'codemirror';
	import { EditorState, type Extension } from '@codemirror/state';
	import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
	import { untrack } from 'svelte';
	import { mermaidWithTheme } from '$lib/mermaidLanguage';
	import { errorRange, type SourceError } from '$lib/diagnostics';

	interface Props {
		value: string;
		oninput: (code: string) => void;
		extensions?: Extension[];
		/** Current render error, shown as a squiggle on the offending line. */
		error?: SourceError | null;
	}

	let { value, oninput, extensions = [], error = null }: Props = $props();

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
					mermaidWithTheme,
					EditorView.lineWrapping,
					EditorView.updateListener.of((update) => {
						if (update.docChanged) oninput(editor.state.doc.toString());
					}),
					lintGutter(),
					linter((current) => {
						if (!error) return [];
						const { from, to } = errorRange(current.state.doc, error);
						const diagnostic: Diagnostic = { from, to, severity: 'error', message: error.message };
						return [diagnostic];
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

	.source-editor :global(.cm-content) {
		caret-color: var(--fg);
	}

	.source-editor :global(.cm-cursor) {
		border-left-color: var(--fg);
	}

	.source-editor :global(.cm-selectionBackground) {
		background: color-mix(in srgb, var(--accent) 18%, transparent) !important;
	}

	.source-editor :global(.cm-lintRange-error) {
		background-image: none;
		text-decoration: underline wavy var(--error-fg);
		text-underline-offset: 3px;
	}
</style>
