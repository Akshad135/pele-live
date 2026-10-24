import { appState, type AppState } from './state.svelte';
import { serializeState } from './serde';

export interface Project {
	id: string;
	name: string;
	state: AppState;
	time: number;
}

const KEY = 'pele-live:projects';
const MAX_PROJECTS = 100;

function read(): Project[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry): entry is Project =>
				entry !== null &&
				typeof entry === 'object' &&
				typeof entry.id === 'string' &&
				typeof entry.name === 'string' &&
				typeof entry.time === 'number' &&
				typeof entry.state?.code === 'string'
		);
	} catch {
		return [];
	}
}

function write(list: Project[]) {
	try {
		localStorage.setItem(KEY, JSON.stringify(list));
	} catch {
		// Storage full or blocked: the session keeps working, saving just fails.
	}
}

function uid() {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function snapshot(): AppState {
	return { code: appState.code, config: appState.config, css: appState.css };
}

/** A readable default name from the diagram itself. */
export function nameFromCode(code: string): string {
	const line = code
		.split('\n')
		.map((l) => l.trim())
		.find((l) => l && !l.startsWith('%%'));
	if (!line) return 'Untitled diagram';
	return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

function persist(list: Project[]) {
	projects = list;
	write(list);
}

let projects = $state<Project[]>(read());

export const projectStore = {
	get list() {
		return projects;
	},

	/** Saves the current diagram under `name`; an existing name is overwritten. */
	save(name?: string) {
		const trimmed = name?.trim() || nameFromCode(appState.code);
		const existing = projects.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
		if (existing) {
			existing.state = snapshot();
			existing.time = Date.now();
			persist(projects);
			return existing.id;
		}
		const entry: Project = { id: uid(), name: trimmed, state: snapshot(), time: Date.now() };
		persist([entry, ...projects].slice(0, MAX_PROJECTS));
		return entry.id;
	},

	open(id: string) {
		const entry = projects.find((p) => p.id === id);
		if (entry) appState.load(entry.state);
		return Boolean(entry);
	},

	remove(id: string) {
		persist(projects.filter((p) => p.id !== id));
	},

	rename(id: string, name: string) {
		const entry = projects.find((p) => p.id === id);
		if (!entry || !name.trim()) return;
		entry.name = name.trim();
		persist(projects);
	},

	entryUrl(entry: Project) {
		return `${window.location.origin}${window.location.pathname}#${serializeState(entry.state)}`;
	},

	export() {
		const blob = new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
		const a = document.createElement('a');
		a.href = url;
		a.download = `pele-projects-${stamp}.json`;
		a.click();
		URL.revokeObjectURL(url);
	},

	import(text: string): { restored: number; duplicates: number; invalid: number } {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return { restored: 0, duplicates: 0, invalid: 0 };
		}
		if (!Array.isArray(parsed)) return { restored: 0, duplicates: 0, invalid: 0 };
		let restored = 0;
		let duplicates = 0;
		let invalid = 0;
		const incoming: Project[] = [];
		for (const raw of parsed) {
			const entry = raw as Project;
			const valid =
				raw !== null &&
				typeof raw === 'object' &&
				typeof entry.id === 'string' &&
				typeof entry.time === 'number' &&
				typeof entry.state?.code === 'string';
			if (!valid) {
				invalid++;
				continue;
			}
			const name = typeof entry.name === 'string' ? entry.name.toLowerCase() : '';
			if (
				projects.some((p) => p.id === entry.id || p.name.toLowerCase() === name) ||
				incoming.some((p) => p.id === entry.id || p.name.toLowerCase() === name)
			) {
				duplicates++;
				continue;
			}
			incoming.push({
				id: entry.id,
				name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : nameFromCode(entry.state.code),
				state: {
					code: entry.state.code,
					config: typeof entry.state.config === 'string' ? entry.state.config : '{}',
					css: typeof entry.state.css === 'string' ? entry.state.css : ''
				},
				time: entry.time
			});
			restored++;
		}
		if (incoming.length) persist([...incoming, ...projects].slice(0, MAX_PROJECTS));
		return { restored, duplicates, invalid };
	}
};
