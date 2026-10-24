import { htmlWithState, pngWithState, svgWithState } from './embed';
import { colorizeNodes, paletteFromStyle } from './diagramColors';
import { serializeState, type SharedState } from './serde';
import { scopeCss } from './scopedCss';

// pele CSS variables, resolved from the live page into exported files.
const PELE_VARS = [
	'--pele-bg',
	'--pele-fg',
	'--pele-muted',
	'--pele-line',
	'--pele-surface',
	'--pele-surface-alt',
	'--pele-border',
	'--pele-accent',
	'--pele-critical',
	'--pele-font',
	'--pele-font-mono',
	'--pele-radius',
	...Array.from({ length: 8 }, (_, i) => `--pele-series-${i + 1}`)
];

/** PNG export sizing, like the original editor's: double the natural size, or fit a given width/height. */
export interface PngOptions {
	mode: 'auto' | 'width' | 'height';
	/** Target pixels for the chosen mode. Unused in auto mode. */
	value: number;
}

/**
 * Rewrite the editor's preview CSS (scoped to `.diagram-frame` there) so the
 * same rules apply inside an exported SVG: drop the preview-only prefixes,
 * then scope the rest to the svg root the way scopeCss scopes to the frame.
 */
function svgScopedCss(raw: string): string {
	const stripped = raw
		.replace(/\.diagram-frame\s+svg\s+/g, '')
		.replace(/\.diagram-frame\s+/g, '')
		.trim();
	if (!stripped) return '';
	return scopeCss(stripped, 'svg');
}

/**
 * Inline the page's resolved theme variables on the SVG root, so an exported
 * file keeps the colors the user sees instead of falling back to pele's
 * defaults when opened outside the page. The editor's node cycling palette
 * lives in page CSS rules, so it is applied per node here with resolved
 * values — the same assignment the live preview does. The user's custom CSS
 * ships along inside a <style> element, so exported files look exactly like
 * the preview.
 */
export function withResolvedTheme(svg: string, source: Element, css?: string): string {
	const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const root = parsed.documentElement;
	if (root.nodeName === 'parsererror' || parsed.querySelector('parsererror')) return svg;
	const computed = getComputedStyle(source);
	for (const name of PELE_VARS) {
		const value = computed.getPropertyValue(name).trim();
		if (value) root.style.setProperty(name, value);
	}
	const palette = paletteFromStyle(computed);
	if (palette.length) {
		colorizeNodes([...root.querySelectorAll('.pele-nodes > .pele-node')], palette);
	}
	const scoped = css ? svgScopedCss(css) : '';
	if (scoped) {
		const style = parsed.createElementNS('http://www.w3.org/2000/svg', 'style');
		style.textContent = scoped;
		root.appendChild(style);
	}
	return new XMLSerializer().serializeToString(root);
}

function download(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function naturalSize(resolved: string): { width: number; height: number } | null {
	const width = Number(/width="([\d.]+)"/.exec(resolved)?.[1]);
	const height = Number(/height="([\d.]+)"/.exec(resolved)?.[1]);
	return width > 0 && height > 0 ? { width, height } : null;
}

export function exportSvg(svg: string, source: Element, state?: SharedState, css?: string) {
	const resolved = withResolvedTheme(svg, source, css);
	const withState = state ? svgWithState(resolved, serializeState(state)) : resolved;
	download(new Blob([withState], { type: 'image/svg+xml;charset=utf-8' }), 'diagram.svg');
}

export function exportHtml(svg: string, source: Element, state?: SharedState, css?: string) {
	const resolved = withResolvedTheme(svg, source, css);
	const title = `${state?.code.match(/^\S+/)?.[0] ?? 'Diagram'} — pele.live`;
	const doc = htmlWithState(resolved, state ? serializeState(state) : null, title);
	download(new Blob([doc], { type: 'text/html;charset=utf-8' }), 'diagram.html');
}

function svgSizeFor(options: PngOptions, natural: { width: number; height: number }) {
	const value = Math.max(16, Math.min(16384, options.value));
	if (options.mode === 'auto') {
		return { width: natural.width * 2, height: natural.height * 2 };
	}
	if (options.mode === 'width') {
		const scale = value / natural.width;
		return { width: value, height: Math.max(1, Math.round(natural.height * scale)) };
	}
	const scale = value / natural.height;
	return { width: Math.max(1, Math.round(natural.width * scale)), height: value };
}

function rasterize(resolved: string, target: { width: number; height: number }): Promise<Blob> {
	// Browsers silently rasterize nothing beyond ~16384px per side; refuse
	// instead of exporting a blank image.
	if (target.width > 16384 || target.height > 16384) {
		return Promise.reject(new Error('Target size is beyond the 16384px canvas limit.'));
	}
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([resolved], { type: 'image/svg+xml;charset=utf-8' }));
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(target.width);
			canvas.height = Math.round(target.height);
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Canvas is unavailable.'));
				return;
			}
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
			canvas.toBlob((blob) => {
				if (blob) resolve(blob);
				else reject(new Error('PNG encoding failed.'));
			}, 'image/png');
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Could not rasterize the diagram.'));
		};
		image.src = url;
	});
}

export async function exportPng(
	svg: string,
	source: Element,
	options: PngOptions,
	state?: SharedState,
	css?: string
): Promise<void> {
	const resolved = withResolvedTheme(svg, source, css);
	const natural = naturalSize(resolved);
	if (!natural) throw new Error('SVG has no intrinsic size.');
	const blob = await rasterize(resolved, svgSizeFor(options, natural));
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const withState = state ? pngWithState(bytes, serializeState(state)) : bytes;
	const kind = state ? 'diagram-with-editor-state.png' : 'diagram.png';
	// `withState` is a fresh, fully-backed Uint8Array; hand its buffer to Blob.
	download(new Blob([withState.buffer as ArrayBuffer], { type: 'image/png' }), kind);
}

export async function copyPng(
	svg: string,
	source: Element,
	options: PngOptions,
	state?: SharedState,
	css?: string
): Promise<void> {
	if (typeof ClipboardItem === 'undefined') {
		throw new Error('This browser cannot copy images.');
	}
	const resolved = withResolvedTheme(svg, source, css);
	const natural = naturalSize(resolved);
	if (!natural) throw new Error('SVG has no intrinsic size.');
	const blob = await rasterize(resolved, svgSizeFor(options, natural));
	if (state) {
		const bytes = pngWithState(new Uint8Array(await blob.arrayBuffer()), serializeState(state));
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' }) })]);
	} else {
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
	}
}

export async function copySvg(
	svg: string,
	source: Element,
	state?: SharedState,
	css?: string
): Promise<void> {
	const resolved = withResolvedTheme(svg, source, css);
	const withState = state ? svgWithState(resolved, serializeState(state)) : resolved;
	await navigator.clipboard.writeText(withState);
}
