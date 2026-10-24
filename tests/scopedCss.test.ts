import { describe, it, expect } from 'vitest';
import { scopeCss } from '$lib/scopedCss';

describe('scopeCss', () => {
	it('prefixes plain selectors with the scope', () => {
		expect(scopeCss('.pele-node { fill: red; }', '.frame')).toBe(
			'.frame .pele-node { fill: red; }'
		);
	});

	it('prefixes each selector in a group', () => {
		expect(scopeCss('a, .b > c { color: blue }', '.frame')).toBe(
			'.frame a, .frame .b > c { color: blue }'
		);
	});

	it('leaves already-scoped selectors alone', () => {
		expect(scopeCss('.frame .x { color: red }', '.frame')).toBe('.frame .x { color: red }');
	});

	it('recurses into @media but keeps declarations intact', () => {
		expect(scopeCss('@media (min-width: 10px) { .a { color: red } }', '.frame')).toBe(
			'@media (min-width: 10px) { .frame .a { color: red } }'
		);
	});

	it('does not prefix @font-face or @keyframes, and prefixes their uses', () => {
		const css = [
			'@font-face { font-family: X; src: url(x.woff) }',
			'@keyframes spin { from { opacity: 0 } to { opacity: 1 } }',
			'.node { animation: spin 1s linear infinite }'
		].join('\n');
		const out = scopeCss(css, '.frame');
		expect(out).toContain('@font-face { font-family: X; src: url(x.woff) }');
		expect(out).toContain('@keyframes spin { from { opacity: 0 } to { opacity: 1 } }');
		expect(out).toContain('.frame .node { animation: spin 1s linear infinite }');
	});

	it('handles multiple rules and unterminated input without throwing', () => {
		expect(scopeCss('.a { color: red } .b { color: blue }', '.f')).toBe(
			'.f .a { color: red }.f .b { color: blue }'
		);
		// An unterminated block is closed rather than dropped.
		expect(scopeCss('.a { color: red', '.f')).toBe('.f .a { color: red }');
		expect(scopeCss('', '.f')).toBe('');
	});

	it('passes brace-less statements through untouched', () => {
		expect(scopeCss('@import url(a.css);\n.pele-node { fill: red }', '.frame')).toBe(
			'@import url(a.css);.frame .pele-node { fill: red }'
		);
	});

	it('does not let braces inside strings break rules', () => {
		expect(scopeCss('.a { content: "}" } .b { color: red }', '.frame')).toBe(
			'.frame .a { content: "}" }.frame .b { color: red }'
		);
	});

	it('does not treat a different class sharing the scope prefix as scoped', () => {
		expect(scopeCss('.framed { color: red }', '.frame')).toBe('.frame .framed { color: red }');
		expect(scopeCss('.frame:hover { color: red }', '.frame')).toBe('.frame:hover { color: red }');
	});

	it('drops comments instead of folding them into selectors', () => {
		expect(scopeCss('/* header */\n.a { fill: red }', '.frame')).toBe('.frame .a { fill: red }');
		expect(scopeCss('.a, /* mid */\n.b { fill: red }', '.frame')).toBe(
			'.frame .a, .frame .b { fill: red }'
		);
		// The custom-CSS sample regression: a comment before a rule must not
		// corrupt that rule's selector (the rule was silently dropped before).
		const sample = "/* Hardcoded fills must carry their own label color. */\n.diagram-frame svg .pele-node text {\n  fill: #1e293b;\n}";
		expect(scopeCss(sample, '.diagram-frame')).toBe(
			'.diagram-frame svg .pele-node text { fill: #1e293b; }'
		);
	});
});
