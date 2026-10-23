import { describe, expect, it } from 'vitest';
import { parseConfig, renderDiagram } from '../src/lib/render';

describe('renderDiagram', () => {
	it('renders a valid flowchart', () => {
		const outcome = renderDiagram('flowchart LR\n  A --> B');
		expect(outcome.ok).toBe(true);
		if (outcome.ok) {
			expect(outcome.svg).toContain('<svg');
			expect(outcome.diagramType).toBe('flowchart');
			expect(outcome.width).toBeGreaterThan(0);
			expect(outcome.height).toBeGreaterThan(0);
		}
	});

	it('renders every diagram type pele claims to support', () => {
		const sources: Array<[string, string]> = [
			['flowchart', 'flowchart TD\n  A --> B'],
			['sequence', 'sequenceDiagram\n  A->>B: hello\n  B-->>A: hi'],
			['class', 'classDiagram\n  class Animal\n  Animal : +String name'],
			['state', 'stateDiagram-v2\n  [*] --> s1\n  s1 --> [*]'],
			['er', 'erDiagram\n  CUSTOMER ||--o{ ORDER : places'],
			['journey', 'journey\n  title Trip\n  section Day\n    Walk: 5: Me'],
			['gantt', 'gantt\n  title Plan\n  section Work\n  Task :a1, 2026-01-01, 3d'],
			['pie', 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85'],
			['quadrantChart', 'quadrantChart\n  title Reach\n  x-axis Low --> High\n  y-axis Low --> High\n  A: [0.3, 0.6]'],
			['requirement', 'requirementDiagram\n  requirement r1 {\n    id: 1\n    text: some\n    risk: low\n    verifymethod: inspection\n  }'],
			['mindmap', 'mindmap\n  root((mind))\n    A\n    B'],
			['timeline', 'timeline\n  title History\n  2020 : A\n  2021 : B'],
			['gitGraph', 'gitGraph\n  commit\n  commit\n  branch dev\n  commit'],
			['sankey', 'sankey\n\nA,B,10\nA,C,5'],
			['xychart', 'xychart-beta\n  title "Sales"\n  x-axis [a, b, c]\n  y-axis "Units" 0 --> 10\n  bar [3, 5, 8]'],
			['block', 'block-beta\n  columns 2\n  a b\n  c d']
		];
		for (const [type, source] of sources) {
			const outcome = renderDiagram(source);
			expect(outcome.ok, `${type} should render: ${outcome.ok ? '' : outcome.error.message}`).toBe(true);
			if (outcome.ok) expect(outcome.diagramType).toBe(type);
		}
	});

	it('reports syntax errors with line and column', () => {
		const outcome = renderDiagram('flowchart TD\n  A --> ]bogus\n  B');
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) {
			expect(outcome.error.code).toBe('syntax');
			expect(outcome.error.line).toBeGreaterThan(0);
			expect(outcome.error.column).toBeGreaterThan(0);
		}
	});

	it('reports unsupported diagram types', () => {
		const outcome = renderDiagram('zenuml\n  A->B: hi');
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.error.code).toBe('unsupported-diagram');
	});

	it('rejects input over the character limit instead of hanging', () => {
		const big = 'flowchart TD\n  ' + 'A'.repeat(60_000);
		const outcome = renderDiagram(big);
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.error.code).toBe('limit');
	});

	it('treats empty input as a friendly message, not a parse error', () => {
		const outcome = renderDiagram('   \n  ');
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.error.code).toBe('syntax');
	});
});

describe('parseConfig', () => {
	it('accepts an empty config', () => {
		expect(parseConfig('')).toEqual({ config: {} });
		expect(parseConfig('  {}  ')).toEqual({ config: {} });
	});

	it('accepts a JSON object', () => {
		expect(parseConfig('{"fontSize": 16}')).toEqual({ config: { fontSize: 16 } });
	});

	it('rejects arrays, primitives and malformed JSON', () => {
		expect(parseConfig('[]').error).toBeDefined();
		expect(parseConfig('null').error).toBeDefined();
		expect(parseConfig('"x"').error).toBeDefined();
		expect(parseConfig('{').error).toBeDefined();
	});
});
