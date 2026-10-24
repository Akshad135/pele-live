/**
 * Prefixes every selector in a CSS fragment with a scope, so user CSS can
 * target the diagram preview without leaking onto the rest of the app.
 * String literals, comments and url(...) tokens are skipped while scanning,
 * so braces inside them cannot break rule detection. @media/@supports/@layer
 * blocks are recursed into; @font-face/@keyframes and brace-less statements
 * (@import, @charset) pass through untouched — keyframe steps and font
 * declarations must not be prefixed.
 */

function skipString(css: string, start: number): number {
	const quote = css[start];
	for (let i = start + 1; i < css.length; i++) {
		if (css[i] === '\\') {
			i++;
		} else if (css[i] === quote) {
			return i + 1;
		}
	}
	return css.length;
}

function skipComment(css: string, start: number): number {
	const close = css.indexOf('*/', start + 2);
	return close === -1 ? css.length : close + 2;
}

/** Index of the '}' matching the '{' at openIdx, or -1 when unbalanced. */
function matchBrace(css: string, openIdx: number): number {
	let depth = 0;
	for (let i = openIdx; i < css.length; i++) {
		const ch = css[i];
		if (ch === '"' || ch === "'") {
			i = skipString(css, i) - 1;
		} else if (ch === '/' && css[i + 1] === '*') {
			i = skipComment(css, i) - 1;
		} else if (ch === '{') {
			depth++;
		} else if (ch === '}') {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

function collapse(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function isNestedAtRule(selector: string): boolean {
	return /^@(media|supports|layer|container|scope)\b/.test(selector);
}

function prefixSelector(selector: string, scope: string): string {
	return selector
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			if (!part.startsWith(scope)) return `${scope} ${part}`;
			// A compound like `.frame`, `.frame x`, `.frame:hover`, `.frame.x` is
			// already scoped; `.framed` (no boundary) is not.
			const rest = part.slice(scope.length);
			if (rest === '' || /^[:.[#>~+\s*]/.test(rest)) return part;
			return `${scope} ${part}`;
		})
		.join(', ');
}

export function scopeCss(css: string, scope: string): string {
	const out: string[] = [];
	let pending = ''; // selector / at-rule text accumulating before the next '{' or ';'
	let i = 0;

	while (i < css.length) {
		const ch = css[i];
		if (ch === '"' || ch === "'") {
			const end = skipString(css, i);
			pending += css.slice(i, end);
			i = end;
		} else if (ch === '/' && css[i + 1] === '*') {
			// A comment counts as whitespace, never as selector text: dropping
			// it keeps its words out of the selector (a comment before a rule
			// would otherwise be prefixed — or split — and corrupt the rule).
			pending += ' ';
			i = skipComment(css, i);
		} else if (ch === '{') {
			const close = matchBrace(css, i);
			const rawBody = css.slice(i + 1, close === -1 ? css.length : close);
			const body = collapse(rawBody);
			const selector = collapse(pending);
			pending = '';
			if (selector.startsWith('@') && isNestedAtRule(selector)) {
				out.push(`${selector} { ${scopeCss(rawBody, scope)} }`);
			} else if (selector.startsWith('@') || selector === '') {
				// @font-face, @keyframes, stray blocks: keep as written.
				out.push(`${selector}${selector ? ' ' : ''}{ ${body} }`);
			} else {
				out.push(`${prefixSelector(selector, scope)} { ${body} }`);
			}
			i = close === -1 ? css.length : close + 1;
		} else if (ch === ';') {
			// Brace-less statement such as @import or @charset.
			if (collapse(pending)) out.push(`${collapse(pending)};`);
			pending = '';
			i++;
		} else {
			pending += ch;
			i++;
		}
	}
	return out.join('');
}
