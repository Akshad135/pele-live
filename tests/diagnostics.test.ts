import { describe, expect, it } from 'vitest';
import { Text } from '@codemirror/state';
import { errorRange } from '../src/lib/diagnostics';

const doc = Text.of(['flowchart TD', '  A --> ]bogus', '  B --> C']);

describe('errorRange', () => {
	it('maps a 1-based line and column to a document range', () => {
		const range = errorRange(doc, { line: 2, column: 9, message: 'x' });
		expect(range.from).toBe(doc.line(2).from + 8);
		expect(range.to).toBe(doc.line(2).to);
	});

	it('clamps out-of-range lines to the last line', () => {
		const range = errorRange(doc, { line: 99, column: 1, message: 'x' });
		expect(range.from).toBe(doc.line(3).from);
		expect(range.to).toBe(doc.line(3).to);
	});

	it('clamps columns past the end of the line', () => {
		const range = errorRange(doc, { line: 1, column: 500, message: 'x' });
		expect(range.from).toBe(doc.line(1).to);
		expect(range.to).toBe(doc.line(1).to);
	});

	it('survives zero and negative positions', () => {
		const range = errorRange(doc, { line: 0, column: 0, message: 'x' });
		expect(range.from).toBe(doc.line(1).from);
		expect(range.to).toBe(doc.line(1).to);
	});
});
