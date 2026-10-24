import { describe, expect, it } from 'vitest';
import { colorizeNodes, paletteFromStyle, type NodePalette } from '../src/lib/diagramColors';

const PALETTE: NodePalette[] = [
	{ fill: '#a', line: '#A' },
	{ fill: '#b', line: '#B' },
	{ fill: '#c', line: '#C' }
];

class FakeNode {
	styleAttr: string | null;
	constructor(
		public id: string | null,
		style: string | null = null
	) {
		this.styleAttr = style;
	}
	getAttribute(name: string): string | null {
		if (name === 'data-id') return this.id;
		if (name === 'style') return this.styleAttr;
		return null;
	}
	setAttribute(name: string, value: string) {
		if (name === 'style') this.styleAttr = value;
	}
}

function el(id: string | null, existingStyle?: string): Element {
	return new FakeNode(id, existingStyle ?? null) as unknown as Element;
}

function styleOf(node: Element): string {
	return ((node as unknown as FakeNode).styleAttr as string) ?? '';
}

describe('colorizeNodes', () => {
	it('gives every node a fill and stroke from the palette', () => {
		const nodes = [el('A'), el('B'), el('C')];
		colorizeNodes(nodes, PALETTE);
		expect(styleOf(nodes[0])).toBe('--_s:#a;--_b:#A');
		expect(styleOf(nodes[1])).toBe('--_s:#b;--_b:#B');
		expect(styleOf(nodes[2])).toBe('--_s:#c;--_b:#C');
	});

	it('pairs nodes sharing a data-id (sequence top and bottom copies)', () => {
		const nodes = [el('A'), el('B'), el('A'), el('B')];
		colorizeNodes(nodes, PALETTE);
		expect(styleOf(nodes[2])).toBe(styleOf(nodes[0]));
		expect(styleOf(nodes[3])).toBe(styleOf(nodes[1]));
	});

	it('cycles when there are more unique nodes than colors', () => {
		const nodes = ['1', '2', '3', '4', '5'].map((id) => el(id));
		colorizeNodes(nodes, PALETTE);
		expect(styleOf(nodes[3])).toBe(styleOf(nodes[0]));
		expect(styleOf(nodes[4])).toBe(styleOf(nodes[1]));
	});

	it('merges over an existing inline style instead of clobbering it', () => {
		const node = el('A', 'rx:4px');
		colorizeNodes([node], PALETTE);
		expect(styleOf(node)).toBe('rx:4px;--_s:#a;--_b:#A');
	});

	it('leaves nodes untouched when the palette is empty', () => {
		const node = el('A');
		colorizeNodes([node], []);
		expect(styleOf(node)).toBe('');
	});
});

describe('paletteFromStyle', () => {
	it('reads the numbered custom properties and skips gaps', () => {
		const computed = {
			getPropertyValue: (name: string) =>
				({ '--pele-node-1': ' #f00 ', '--pele-node-1-line': '#f00', '--pele-node-2': '' })[name] ?? ''
		} as CSSStyleDeclaration;
		expect(paletteFromStyle(computed)).toEqual([{ fill: '#f00', line: '#f00' }]);
	});
});
