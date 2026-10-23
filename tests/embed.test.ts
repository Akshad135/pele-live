import { describe, it, expect } from 'vitest';
import {
	htmlWithState,
	pngWithState,
	stateFromHtml,
	stateFromPng,
	stateFromSvg,
	svgWithState
} from '$lib/embed';
import { serializeState, deserializeState } from '$lib/serde';
import { importDiagramFile } from '$lib/importDiagram';

const state = { code: 'flowchart LR\n A --> B', config: '{"theme":"dark"}' };
const payload = serializeState(state);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect x="1" y="1" width="10" height="10"/></svg>`;

/** Signature + IHDR(13 bytes) + IEND, enough for the chunk walker. */
function stubPng(): Uint8Array {
	const ihdr = new Uint8Array(8 + 12 + 13 + 12);
	const view = new DataView(ihdr.buffer);
	ihdr.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	// IHDR chunk: length 13 at 8, type at 12.
	view.setUint32(8, 13);
	ihdr.set(new TextEncoder().encode('IHDR'), 12);
	// IEND chunk: length 0 at 33, type at 37.
	view.setUint32(33, 0);
	ihdr.set(new TextEncoder().encode('IEND'), 37);
	return ihdr;
}

describe('svg metadata', () => {
	it('round-trips through the <metadata> element', () => {
		const tagged = svgWithState(svg, payload);
		expect(tagged.startsWith('<svg xmlns')).toBe(true);
		expect(tagged).toContain(`<metadata data-pele-live-state="1">${payload}</metadata>`);
		expect(stateFromSvg(tagged)).toBe(payload);
		expect(deserializeState(stateFromSvg(tagged)!)).toEqual(state);
	});

	it('leaves svgs without a root tag untouched', () => {
		expect(svgWithState('not svg', payload)).toBe('not svg');
		expect(stateFromSvg('not svg')).toBeNull();
	});
});

describe('png metadata', () => {
	it('round-trips through a tEXt chunk', () => {
		const tagged = pngWithState(stubPng(), payload);
		expect(stateFromPng(tagged)).toBe(payload);
		expect(deserializeState(stateFromPng(tagged)!)).toEqual(state);
		// The original chunk structure survives.
		expect(stateFromPng(stubPng())).toBeNull();
	});
});

describe('html metadata', () => {
	it('round-trips through the <meta> tag', () => {
		const doc = htmlWithState(svg, payload, 'T');
		expect(stateFromHtml(doc)).toBe(payload);
		expect(stateFromHtml('<html><body>no meta</body></html>')).toBeNull();
	});
});

describe('importDiagramFile', () => {
	it('reads .mmd files as source', async () => {
		const file = new File(['pie title x\n "a": 1'], 'chart.mmd', { type: 'text/plain' });
		const result = await importDiagramFile(file);
		expect(result).toEqual({ code: 'pie title x\n "a": 1', config: '{}', css: '' });
	});

	it('reads editor-state back out of an exported svg', async () => {
		const file = new File([svgWithState(svg, payload)], 'diagram.svg', { type: 'image/svg+xml' });
		const result = await importDiagramFile(file);
		expect(result).toMatchObject({ code: state.code, config: state.config });
	});

	it('reads editor-state back out of an exported png', async () => {
		const file = new File([pngWithState(stubPng(), payload)], 'diagram.png', { type: 'image/png' });
		const result = await importDiagramFile(file);
		expect(result).toMatchObject({ code: state.code });
	});

	it('reads editor-state back out of an exported html file', async () => {
		const file = new File([htmlWithState(svg, payload, 'T')], 'diagram.html', { type: 'text/html' });
		const result = await importDiagramFile(file);
		expect(result).toMatchObject({ code: state.code, config: state.config });
	});

	it('reports files without embedded state', async () => {
		const file = new File([svg], 'plain.svg', { type: 'image/svg+xml' });
		const result = await importDiagramFile(file);
		expect(result).toHaveProperty('error');
	});
});
