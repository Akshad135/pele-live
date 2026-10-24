/**
 * Mermaid syntax documentation per detected diagram type. Types without an
 * official page (pele-only syntaxes) map to nothing and get no link.
 */
const DOCS_PAGES: Record<string, string> = {
	flowchart: 'flowchart',
	'flowchart-v2': 'flowchart',
	'flowchart-elk': 'flowchart',
	sequence: 'sequenceDiagram',
	classDiagram: 'classDiagram',
	stateDiagram: 'stateDiagram',
	er: 'entityRelationshipDiagram',
	journey: 'userJourney',
	gantt: 'gantt',
	pie: 'pie',
	quadrantChart: 'quadrantChart',
	requirement: 'requirementDiagram',
	gitGraph: 'gitgraph',
	c4: 'c4',
	mindmap: 'mindmap',
	timeline: 'timeline',
	sankey: 'sankey',
	xychart: 'xyChart',
	block: 'block',
	packet: 'packet',
	kanban: 'kanban',
	architecture: 'architecture',
	radar: 'radar',
	treemap: 'treemap',
	swimlane: 'swimlanes'
};

export function docsUrl(mermaidType: string): string | null {
	const page = DOCS_PAGES[mermaidType];
	return page ? `https://mermaid.js.org/syntax/${page}.html` : null;
}
