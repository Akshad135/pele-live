import { Text } from '@codemirror/state';

export interface SourceError {
	line: number;
	column: number;
	message: string;
}

/**
 * Clamp a PeleError's 1-based line/column into a range on the current
 * document. Errors from older text (or out-of-bounds positions) land on the
 * nearest valid line instead of being dropped.
 */
export function errorRange(doc: Text, error: SourceError): { from: number; to: number } {
	const lineNo = Math.min(Math.max(Math.floor(error.line) || 1, 1), doc.lines);
	const line = doc.line(lineNo);
	const from = Math.min(line.from + Math.max(Math.floor(error.column) - 1, 0), line.to);
	return { from, to: line.to };
}
