/**
 * Editor-default diagram coloring: cycle a per-theme pastel palette across
 * the diagram's nodes (the mermaid.live look). pele paints every node with
 * its internal --_s (fill) / --_b (stroke) variables, so setting those on a
 * node group recolors it without fighting pele's presentation attributes.
 */
export interface NodePalette {
	fill: string;
	line: string;
}

/** Number of colors in the palette defined in app.css. */
export const NODE_PALETTE_SIZE = 6;

export function paletteFromStyle(computed: CSSStyleDeclaration): NodePalette[] {
	const palette: NodePalette[] = [];
	for (let i = 1; i <= NODE_PALETTE_SIZE; i++) {
		const fill = computed.getPropertyValue(`--pele-node-${i}`).trim();
		const line = computed.getPropertyValue(`--pele-node-${i}-line`).trim();
		if (fill && line) palette.push({ fill, line });
	}
	return palette;
}

/**
 * Assign one palette color per unique node, matched by pele's data-id so a
 * sequence participant's top and bottom copies share a color. Nodes without
 * a data-id (none today) fall back to one color per element, in order.
 */
export function colorizeNodes(nodes: Element[], palette: NodePalette[]): void {
	if (!palette.length) return;
	const byId = new Map<string, NodePalette>();
	let fallback = 0;
	for (const node of nodes) {
		const id = node.getAttribute('data-id') ?? `#index-${fallback++}`;
		let color = byId.get(id);
		if (!color) {
			color = palette[byId.size % palette.length];
			byId.set(id, color);
		}
		// setAttribute, not .style: exported SVGs are parsed as XML, where
		// elements have no style property. Re-runs merge over pele's own
		// inline style instead of clobbering it.
		const existing = node.getAttribute('style');
		const base = existing ? `${existing.replace(/;\s*$/, '')};` : '';
		node.setAttribute('style', `${base}--_s:${color.fill};--_b:${color.line}`);
	}
}
