/**
 * State round-trip for exported files, excalidraw-style: the serialized
 * share-link payload rides inside exported SVG (<metadata>), PNG (a tEXt
 * chunk) and HTML (<meta>), so any of them can be imported back into the
 * editor and continue where the file left off.
 */

export const PNG_KEYWORD = 'pele-live';

// --- SVG -------------------------------------------------------------------

/** Inserts the state as a <metadata> child right after the svg root tag. */
export function svgWithState(svg: string, state: string): string {
	const open = /<svg[^>]*>/.exec(svg);
	if (!open) return svg;
	const at = open.index + open[0].length;
	return `${svg.slice(0, at)}<metadata data-pele-live-state="1">${state}</metadata>${svg.slice(at)}`;
}

export function stateFromSvg(svg: string): string | null {
	const match = /<metadata[^>]*>([^<]*)<\/metadata>/.exec(svg);
	return match ? match[1] : null;
}

// --- PNG (tEXt chunks) -----------------------------------------------------

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

function textChunk(keyword: string, text: string): Uint8Array<ArrayBuffer> {
	const body = new TextEncoder().encode(`${keyword}\0${text}`);
	const chunk = new Uint8Array(12 + body.length);
	const view = new DataView(chunk.buffer);
	view.setUint32(0, body.length);
	chunk.set(new TextEncoder().encode('tEXt'), 4);
	chunk.set(body, 8);
	view.setUint32(8 + body.length, crc32(chunk.subarray(4, 8 + body.length)));
	return chunk;
}

/** Returns a copy of the PNG with the state embedded as a tEXt chunk. */
export function pngWithState(png: Uint8Array, state: string): Uint8Array<ArrayBuffer> {
	const chunk = textChunk(PNG_KEYWORD, state);
	// Insert after the signature (8 bytes) and the IHDR chunk that follows it.
	const ihdrLength = new DataView(png.buffer, png.byteOffset, png.byteLength).getUint32(8);
	const at = 8 + 12 + ihdrLength;
	const out = new Uint8Array(png.length + chunk.length);
	out.set(png.subarray(0, at));
	out.set(chunk, at);
	out.set(png.subarray(at), at + chunk.length);
	return out;
}

export function stateFromPng(png: Uint8Array): string | null {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	let pos = 8;
	while (pos + 12 <= png.length) {
		const length = view.getUint32(pos);
		const type = new TextDecoder().decode(png.subarray(pos + 4, pos + 8));
		if (type === 'tEXt') {
			const data = png.subarray(pos + 8, pos + 8 + length);
			const zero = data.indexOf(0);
			if (zero > 0 && new TextDecoder().decode(data.subarray(0, zero)) === PNG_KEYWORD) {
				return new TextDecoder().decode(data.subarray(zero + 1));
			}
		}
		if (type === 'IEND') break;
		pos += 12 + length;
	}
	return null;
}

// --- HTML ------------------------------------------------------------------

/** Escapes text interpolated into the HTML shell (the title). */
function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function htmlWithState(
	svg: string,
	state: string | null,
	title: string,
	background?: string | null
): string {
	const meta = state ? `<meta name="pele-live-state" content="${state}">` : '';
	// A page cannot be transparent; null (Transparent choice) keeps plain white.
	const pageBackground = background || '#fff';
	return [
		'<!doctype html>',
		'<html>',
		'<head>',
		'<meta charset="utf-8">',
		meta,
		`<title>${escapeHtml(title)}</title>`,
		'<style>',
		`body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: ${pageBackground}; }`,
		'svg { max-width: 100vw; height: auto; }',
		'</style>',
		'</head>',
		`<body>${svg}</body>`,
		'</html>'
	]
		.filter(Boolean)
		.join('\n');
}

export function stateFromHtml(html: string): string | null {
	const meta = /<meta\s[^>]*pele-live-state[^>]*>/i.exec(html);
	if (!meta) return null;
	const content = /content\s*=\s*["']([^"']*)["']/i.exec(meta[0]);
	return content ? content[1] : null;
}
