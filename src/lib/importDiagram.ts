import { stateFromHtml, stateFromPng, stateFromSvg } from './embed';
import { deserializeState, type SharedState } from './serde';

export type ImportResult = { error: string } | ({ warn?: string } & SharedState);

const SOURCE_EXTENSIONS = ['.mmd', '.mermaid', '.txt'];

/**
 * Reads a dropped or picked file back into editor state: plain Mermaid text,
 * or any export of this editor (SVG/PNG/HTML) via its embedded state payload.
 */
export async function importDiagramFile(file: File): Promise<ImportResult> {
	const name = file.name.toLowerCase();

	if (SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext))) {
		return { code: await file.text(), config: '{}', css: '' };
	}

	if (name.endsWith('.svg')) {
		const shared = deserializeState(stateFromSvg(await file.text()) ?? '');
		if (shared) return shared;
		return { error: 'No editor state in this SVG. Only files exported here can be re-imported.' };
	}

	if (name.endsWith('.png')) {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const shared = deserializeState(stateFromPng(bytes) ?? '');
		if (shared) return shared;
		return { error: 'No editor state in this PNG. Only files exported here can be re-imported.' };
	}

	if (name.endsWith('.html') || name.endsWith('.htm')) {
		const shared = deserializeState(stateFromHtml(await file.text()) ?? '');
		if (shared) return shared;
		return { error: 'No editor state in this HTML file.' };
	}

	// Unknown type: treat it as source text if it quacks like Mermaid.
	const text = await file.text();
	if (text.length < 500_000) {
		return { code: text, config: '{}', css: '', warn: 'Imported as Mermaid source text.' };
	}
	return { error: 'Unsupported file type.' };
}
