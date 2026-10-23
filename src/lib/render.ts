import { PeleError, render } from 'pele';

export type DiagramConfig = Record<string, unknown>;

export type RenderOutcome =
	| { ok: true; svg: string; width: number; height: number; diagramType: string; mermaidType: string }
	| { ok: false; error: PeleError };

/**
 * Render Mermaid text with Pele. Synchronous, runs entirely on the client.
 * All failures (syntax, unsupported, limits) surface as PeleError.
 */
export function renderDiagram(code: string, config?: DiagramConfig): RenderOutcome {
	if (!code.trim()) {
		return { ok: false, error: new PeleError('Nothing to render yet. Type some Mermaid text.') };
	}
	try {
		// `responsive: false`: the svg keeps its natural pixel size; the preview
		// implements its own fit/zoom/pan, and pele's max-width inline style
		// would fight that transform math.
		const result = render(code, { config: config as never, responsive: false });
		return {
			ok: true,
			svg: result.svg,
			width: result.width,
			height: result.height,
			diagramType: result.type,
			mermaidType: result.mermaidType
		};
	} catch (thrown) {
		const error =
			thrown instanceof PeleError
				? thrown
				: new PeleError(thrown instanceof Error ? thrown.message : String(thrown));
		return { ok: false, error };
	}
}

/** Parse the user's config JSON. Returns the object, or the syntax error message. */
export function parseConfig(json: string): { config: DiagramConfig; error?: never } | { config?: never; error: string } {
	if (!json.trim()) return { config: {} };
	try {
		const parsed: unknown = JSON.parse(json);
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return { error: 'Config must be a JSON object.' };
		}
		return { config: parsed as DiagramConfig };
	} catch (e) {
		return { error: e instanceof Error ? e.message : String(e) };
	}
}
