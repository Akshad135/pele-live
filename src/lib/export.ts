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

/**
 * Inline the page's resolved theme variables on the SVG root, so an exported
 * file keeps the colors the user sees instead of falling back to pele's
 * defaults when opened outside the page.
 */
export function withResolvedTheme(svg: string, source: Element): string {
	const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const root = parsed.documentElement;
	if (root.nodeName === 'parsererror' || parsed.querySelector('parsererror')) return svg;
	const computed = getComputedStyle(source);
	for (const name of PELE_VARS) {
		const value = computed.getPropertyValue(name).trim();
		if (value) root.style.setProperty(name, value);
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

export function exportSvg(svg: string, source: Element) {
	const resolved = withResolvedTheme(svg, source);
	download(new Blob([resolved], { type: 'image/svg+xml;charset=utf-8' }), 'diagram.svg');
}

export function exportPng(svg: string, source: Element, scale = 2): Promise<void> {
	const resolved = withResolvedTheme(svg, source);
	const width = Number(/width="([\d.]+)"/.exec(resolved)?.[1]);
	const height = Number(/height="([\d.]+)"/.exec(resolved)?.[1]);
	if (!width || !height) return Promise.reject(new Error('SVG has no intrinsic size.'));
	// Browsers silently rasterize nothing beyond ~16384px per side; refuse
	// instead of exporting a blank image.
	if (width * scale > 16384 || height * scale > 16384) {
		return Promise.reject(new Error('Diagram is too large to export as PNG at this scale.'));
	}
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([resolved], { type: 'image/svg+xml;charset=utf-8' }));
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(width * scale);
			canvas.height = Math.round(height * scale);
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Canvas is unavailable.'));
				return;
			}
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
			canvas.toBlob((blob) => {
				if (blob) download(blob, 'diagram.png');
				else reject(new Error('PNG encoding failed.'));
				resolve();
			}, 'image/png');
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Could not rasterize the diagram.'));
		};
		image.src = url;
	});
}
