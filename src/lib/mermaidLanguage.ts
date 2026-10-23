import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Diagram-type headers and the structural keywords each grammar shares.
const DIAGRAM_TYPES =
	'flowchart flowchart-v2 graph sequenceDiagram classDiagram stateDiagram stateDiagram-v2 erDiagram journey gantt pie quadrantChart requirementDiagram mindmap timeline gitGraph sankey-beta xychart-beta block-beta architecture-beta kanban packet-beta radar-beta';

const KEYWORDS =
	'subgraph end direction participant actor autonumber activate deactivate note over loop alt else par and opt critical option break classDef class style click linkStyle title section columns beta left right up down TB TD BT RL LR';

const KEYWORD_SET = new Set([...DIAGRAM_TYPES.split(' '), ...KEYWORDS.split(' ')]);

function token(stream: import('@codemirror/language').StringStream): string | null {
	if (stream.match('%%{')) {
		stream.skipToEnd();
		return 'meta';
	}
	if (stream.match('%%')) {
		stream.skipToEnd();
		return 'comment';
	}
	if (stream.eat('"')) {
		stream.eatWhile((ch) => ch !== '"' && ch !== '\n');
		stream.eat('"');
		return 'string';
	}
	// Leading whitespace may precede a keyword on an indented line.
	const start = stream.pos;
	stream.eatSpace();
	const wordStart = stream.pos;
	stream.eatWhile(/[\w-]/);
	if (KEYWORD_SET.has(stream.current())) return 'keyword';
	stream.pos = stream.current() ? start : wordStart;
	if (stream.eatWhile(/[-=.ox>#|~]/) && stream.current().length > 1) return 'operator';
	if (stream.current().length === 0) stream.eatWhile(/[^\s]/);
	if (stream.current().length === 0) stream.next();
	return null;
}

/** Token names mapped explicitly so the highlight style below always applies. */
export const mermaidHighlight = HighlightStyle.define([
	{ tag: t.keyword, color: 'var(--syntax-keyword)' },
	{ tag: t.string, color: 'var(--syntax-string)' },
	{ tag: t.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
	{ tag: t.meta, color: 'var(--syntax-meta)' },
	{ tag: t.operator, color: 'var(--syntax-operator)' }
]);

/** A lightweight Mermaid grammar: comments, diagram keywords, strings, edge operators. */
export const mermaidLanguage = StreamLanguage.define<null>({
	name: 'mermaid',
	startState: () => null,
	token(stream, _state) {
		return token(stream);
	},
	languageData: { commentTokens: { line: '%%' } },
	tokenTable: {
		keyword: t.keyword,
		string: t.string,
		comment: t.comment,
		meta: t.meta,
		operator: t.operator
	}
});

/** The grammar and its theme, bound to the page's --syntax-* variables. */
export const mermaidWithTheme = [mermaidLanguage, syntaxHighlighting(mermaidHighlight)];
