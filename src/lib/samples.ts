export interface Sample {
	name: string;
	source: string;
	/** Optional custom CSS loaded into the CSS tab with the sample. */
	css?: string;
}

export const SAMPLES: Sample[] = [
	{
		name: 'Flowchart',
		source: `flowchart TD
  A[Spring] -->|rain| B[Puddle]
  B -->|sun| C{Evaporates?}
  C -->|yes| A
  C -->|no| B`
	},
	{
		name: 'Sequence',
		source: `sequenceDiagram
  actor U as User
  participant B as Browser
  participant S as Server
  U->>B: Type diagram
  B->>S: POST /render
  S-->>B: SVG
  B-->>U: Diagram`
	},
	{
		name: 'Class',
		source: `classDiagram
  class Animal {
    +String name
    +speak()
  }
  class Dog {
    +fetch()
  }
  Animal <|-- Dog
  Dog : +String breed`
	},
	{
		name: 'State',
		source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Rendering: input
  Rendering --> Idle: done
  Rendering --> Error: fail
  Error --> Idle: retry`
	},
	{
		name: 'Entity relationship',
		source: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "ordered in"
  CUSTOMER {
    string name
    string email
  }`
	},
	{
		name: 'Gantt',
		source: `gantt
  title Ship it
  dateFormat YYYY-MM-DD
  section Build
  Renderer      :done, r1, 2026-01-05, 10d
  Editor        :active, e1, after r1, 8d
  section Launch
  Polish        :p1, after e1, 5d`
	},
	{
		name: 'Pie',
		source: `pie title Where the time goes
  "Rendering" : 38
  "Editing" : 47
  "Shipping" : 15`
	},
	{
		name: 'Mindmap',
		source: `mindmap
  root((pele))
    Fast
      Sync render
      No deps
    Clean
      CSS variables
      SVG output
    Local
      No accounts
      No tracking`
	},
	{
		name: 'Timeline',
		source: `timeline
  title Pele Live
  Phase 1 : Playground core
  Phase 2 : Sharing
  Phase 3 : Editor polish
  Phase 4 : Export`
	},
	{
		name: 'Git graph',
		source: `gitGraph
  commit id: "init"
  commit id: "core"
  branch feature
  commit id: "sharing"
  commit id: "samples"
  checkout main
  merge feature
  commit id: "v1"`
	},
	{
		name: 'Journey',
		source: `journey
  title A day with pele.live
  section Morning
    Open playground: 5: Me
    Paste diagram: 4: Me
  section Afternoon
    Tweak theme: 5: Me
    Share link: 5: Me, Team`
	},
	{
		name: 'Quadrant',
		source: `quadrantChart
  title Tool landscape
  x-axis Heavy --> Light
  y-axis Server --> Local
  Old editors: [0.2, 0.3]
  pele.live: [0.9, 0.95]`
	},
	{
		name: 'XY chart',
		source: `xychart-beta
  title "Render time (ms)"
  x-axis [mermaid.js, pele]
  y-axis "ms" 0 --> 500
  bar [420, 12]
  line [420, 12]`
	},
	{
		name: 'Sankey',
		source: `sankey-beta

Mermaid text,Pele,60
Pele,SVG,55
Pele,Errors,5`
	},
	{
		name: 'Block',
		source: `block-beta
  columns 3
  Source["Source"] Renderer["Pele"] View["SVG"]
  space:3
  Share["Share link"] space Export["Export"]`
	},
	{
		name: 'Requirements',
		source: `requirementDiagram
  requirement fast {
    id: 1
    text: render under 50ms
    risk: low
    verifymethod: test
  }
  functionalRequirement clean {
    id: 2
    text: themeable svg
    risk: low
    verifymethod: inspection
  }
  element pele {
    type: renderer
  }
  pele - satisfies -> fast`
	},
	{
		name: 'Styling · classDef & linkStyle',
		source: `flowchart LR
  A[Mermaid text] --> B{Pele}
  B -->|fast| C[SVG]
  B -->|errors| D[Line numbers]
  C --> E[Share it]
  class A source
  classDef source fill:#2563eb,color:#fff,stroke:none
  classDef good fill:#16a34a,color:#fff,stroke:none
  classDef warn fill:#d97706,color:#fff,stroke:none
  class C,E good
  D:::warn
  linkStyle 0 stroke:#2563eb,stroke-width:3px
  linkStyle 2 stroke:#16a34a,stroke-width:3px
  linkStyle default stroke-dasharray:4 3,color:#94a3b8`
	},
	{
		name: 'Styling · frontmatter & init',
		source: `---
title: Publish pipeline
config:
  flowchart:
    curve: step
    nodeSpacing: 60
---
flowchart TB
  Draft --> Review --> Schedule --> Publish
  Publish --> Live[(Live site)]
  %%{init: {"theme": {"series-1": "#7c3aed"}}}%%`
	},
	{
		name: 'Styling · custom CSS',
		source: `flowchart LR
  web[Web app] --> api[API]
  api --> db[(Database)]
  api --> cache[Cache]
  click web href "https://example.com"`,
		css: `.diagram-frame svg .pele-node rect,
.diagram-frame svg .pele-node polygon,
.diagram-frame svg .pele-node path {
  fill: #eef4ff;
  stroke: #2563eb;
  stroke-width: 1.5px;
}
/* Hardcoded fills must carry their own label color, or the theme's label
   color (white on dark themes) disappears on them. */
.diagram-frame svg .pele-node text {
  fill: #1e293b;
}
.diagram-frame svg .pele-node[data-id='db'] rect {
  fill: #fff7ed;
  stroke: #d97706;
}
.diagram-frame svg .pele-edge-label {
  font-size: 13px;
  fill: #475569;
}`
	}
];
