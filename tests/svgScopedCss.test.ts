import { describe, it, expect } from 'vitest';
import { svgScopedCss } from '../src/lib/export';

describe('svgScopedCss', () => {
	it('scopes plain selectors to the svg root', () => {
		expect(svgScopedCss('.pele-node text { fill: red; }')).toBe(
			'svg .pele-node text { fill: red; }'
		);
	});

	it('strips the preview scope prefixes, including the sample form', () => {
		expect(svgScopedCss('.diagram-frame svg .pele-node text { fill: red; }')).toBe(
			'svg .pele-node text { fill: red; }'
		);
		expect(svgScopedCss('.diagram-frame .pele-node { fill: red; }')).toBe(
			'svg .pele-node { fill: red; }'
		);
	});

	it('keeps compound selectors selector-aware (.diagram-frame:not(.x))', () => {
		expect(svgScopedCss('.diagram-frame:not(.x) .pele-node { fill: red; }')).toBe(
			'svg :not(.x) .pele-node { fill: red; }'
		);
		// A different class sharing the prefix must survive untouched.
		expect(svgScopedCss('.diagram-framed { fill: red; }')).toBe(
			'svg .diagram-framed { fill: red; }'
		);
	});

	it('never touches text inside strings, and comments do not corrupt rules', () => {
		const out = svgScopedCss(
			'/* .diagram-frame note { } */\n.a::after { content: ".diagram-frame svg X"; }'
		);
		// scopeCss drops comments, but a brace-bearing comment must not split the rule.
		expect(out).toBe('svg .a::after { content: ".diagram-frame svg X"; }');
	});

	it('passes at-rule bodies through scopeCss recursion', () => {
		expect(svgScopedCss('@media print { .pele-node { fill: red; } }')).toBe(
			'@media print { svg .pele-node { fill: red; } }'
		);
	});

	it('returns empty for empty or comment-only input', () => {
		expect(svgScopedCss('')).toBe('');
		expect(svgScopedCss('/* nothing here */')).toBe('');
	});
});
