import { appState, type AppState } from './state.svelte';
import { serializeState } from './serde';

export interface HistoryEntry {
	id: string;
	/** Manual saves can be named; auto snapshots are addressed by time. */
	name?: string;
	state: AppState;
	time: number;
	type: 'auto' | 'manual';
}

const AUTO_KEY = 'pele-live:history:auto';
const MANUAL_KEY = 'pele-live:history:manual';
export const AUTO_SAVE_INTERVAL = 60_000;
const MAX_AUTO = 30;
const MAX_MANUAL = 100;

function read(key: string): HistoryEntry[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry): entry is HistoryEntry =>
				entry !== null &&
				typeof entry === 'object' &&
				typeof (entry as HistoryEntry).id === 'string' &&
				typeof (entry as HistoryEntry).time === 'number' &&
				((entry as HistoryEntry).type === 'auto' || (entry as HistoryEntry).type === 'manual') &&
				typeof (entry as HistoryEntry).state?.code === 'string'
		);
	} catch {
		// Corrupt history reads as empty; saving below rewrites it.
		return [];
	}
}

function write(key: string, entries: HistoryEntry[]) {
	try {
		localStorage.setItem(key, JSON.stringify(entries));
	} catch {
		// Storage full or blocked: the session keeps working, history just stops growing.
	}
}

function uid() {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sameState(a: AppState, b: AppState) {
	return a.code === b.code && a.config === b.config;
}

/** Newest-first; a duplicate of the newest entry is skipped instead of re-saved. */
function push(entries: HistoryEntry[], entry: HistoryEntry, max: number) {
	if (entries[0] && sameState(entries[0].state, entry.state)) return entries;
	return [entry, ...entries.filter((e) => e.id !== entry.id)].slice(0, max);
}

let autoEntries = $state<HistoryEntry[]>([]);
let manualEntries = $state<HistoryEntry[]>([]);
// Loaded eagerly at module init: read() is SSR-safe, and this keeps every
// later getter a pure read (no state writes from inside a derived).
autoEntries = read(AUTO_KEY);
manualEntries = read(MANUAL_KEY);

function snapshot(): AppState {
	return { code: appState.code, config: appState.config };
}

export const history = {
	get auto() {
		return autoEntries;
	},
	get manual() {
		return manualEntries;
	},

	/** Saves the current diagram into the manual list (bookmarks). */
	save(name?: string) {
		manualEntries = push(
			manualEntries,
			{
				id: uid(),
				name: name?.trim() || undefined,
				state: snapshot(),
				time: Date.now(),
				type: 'manual'
			},
			MAX_MANUAL
		);
		write(MANUAL_KEY, manualEntries);
	},

	/** Puts a stored version back into the editor. */
	restore(id: string) {
		const entry = [...autoEntries, ...manualEntries].find((e) => e.id === id);
		if (entry) appState.load(entry.state);
	},

	remove(id: string) {
		const auto = autoEntries.filter((e) => e.id !== id);
		if (auto.length !== autoEntries.length) {
			autoEntries = auto;
			write(AUTO_KEY, auto);
			return;
		}
		manualEntries = manualEntries.filter((e) => e.id !== id);
		write(MANUAL_KEY, manualEntries);
	},

	rename(id: string, name: string) {
		const entry = manualEntries.find((e) => e.id === id);
		if (!entry) return;
		entry.name = name.trim() || undefined;
		write(MANUAL_KEY, manualEntries);
	},

	clear(type: 'auto' | 'manual') {
		if (type === 'auto') {
			autoEntries = [];
			write(AUTO_KEY, autoEntries);
		} else {
			manualEntries = [];
			write(MANUAL_KEY, manualEntries);
		}
	},

	/** Downloads one list as JSON so history can move between browsers. */
	export(type: 'auto' | 'manual') {
		const entries = type === 'auto' ? autoEntries : manualEntries;
		const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
		const a = document.createElement('a');
		a.href = url;
		a.download = `pele-history-${type}-${stamp}.json`;
		a.click();
		URL.revokeObjectURL(url);
	},

	/** Merges an exported file back in; returns the counts shown to the user. */
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
		for (const raw of parsed) {
			const entry = raw as HistoryEntry;
			const valid =
				raw !== null &&
				typeof raw === 'object' &&
				typeof entry.id === 'string' &&
				typeof entry.time === 'number' &&
				(entry.type === 'auto' || entry.type === 'manual') &&
				typeof entry.state?.code === 'string';
			if (!valid) {
				invalid++;
				continue;
			}
			const list = entry.type === 'auto' ? autoEntries : manualEntries;
			if (list.some((e) => e.id === entry.id || sameState(e.state, entry.state))) {
				duplicates++;
				continue;
			}
			const clean: HistoryEntry = {
				id: entry.id,
				name: typeof entry.name === 'string' ? entry.name : undefined,
				state: {
					code: entry.state.code,
					config: typeof entry.state.config === 'string' ? entry.state.config : '{}'
				},
				time: entry.time,
				type: entry.type
			};
			if (entry.type === 'auto') {
				autoEntries = push(autoEntries, clean, MAX_AUTO);
				write(AUTO_KEY, autoEntries);
			} else {
				manualEntries = push(manualEntries, clean, MAX_MANUAL);
				write(MANUAL_KEY, manualEntries);
			}
			restored++;
		}
		return { restored, duplicates, invalid };
	},

	/** Shareable link for one stored version. */
	entryUrl(entry: HistoryEntry) {
		return `${window.location.origin}${window.location.pathname}#${serializeState(entry.state)}`;
	},

	/** Periodic snapshots of whatever is in the editor. Returns a stop function. */
	startAutoSave(interval = AUTO_SAVE_INTERVAL): () => void {
		const tick = () => {
			autoEntries = push(
				autoEntries,
				{ id: uid(), state: snapshot(), time: Date.now(), type: 'auto' },
				MAX_AUTO
			);
			write(AUTO_KEY, autoEntries);
		};
		tick();
		const timer = setInterval(tick, interval);
		return () => clearInterval(timer);
	}
};
