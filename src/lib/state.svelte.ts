import { DEFAULT_CODE, DEFAULT_CONFIG } from './defaults';

export interface AppState {
	code: string;
	config: string;
}

const STORAGE_KEY = 'pele-live:v1';

function load(): AppState {
	if (typeof localStorage === 'undefined') {
		return { code: DEFAULT_CODE, config: DEFAULT_CONFIG };
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed: unknown = JSON.parse(raw);
			if (
				parsed !== null &&
				typeof parsed === 'object' &&
				typeof (parsed as AppState).code === 'string'
			) {
				const state = parsed as AppState;
				return {
					code: state.code,
					config: typeof state.config === 'string' ? state.config : DEFAULT_CONFIG
				};
			}
		}
	} catch {
		// Corrupt or unavailable storage falls through to defaults.
	}
	return { code: DEFAULT_CODE, config: DEFAULT_CONFIG };
}

const state = $state<AppState>(load());

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persist(immediate = false) {
	clearTimeout(saveTimer);
	if (immediate) {
		saveTimer = undefined;
		write();
		return;
	}
	saveTimer = setTimeout(write, 250);
}

function write() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Storage full or blocked: the session keeps working, saving just fails.
	}
}

// Flush a pending debounced save when the tab goes away.
if (typeof window !== 'undefined') {
	window.addEventListener('pagehide', () => {
		if (saveTimer !== undefined) persist(true);
	});
}

export const appState = {
	get code() {
		return state.code;
	},
	set code(value: string) {
		state.code = value;
		persist();
	},
	get config() {
		return state.config;
	},
	set config(value: string) {
		state.config = value;
		persist();
	},
	/** Replace everything, e.g. when opening a sample or a shared link. */
	load(next: AppState) {
		state.code = next.code;
		state.config = next.config ?? DEFAULT_CONFIG;
		persist();
	},
	reset() {
		this.load({ code: DEFAULT_CODE, config: DEFAULT_CONFIG });
	}
};
