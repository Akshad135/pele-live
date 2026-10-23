export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'pele-live:theme';
const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];

function load(): ThemeChoice {
	if (typeof localStorage === 'undefined') return 'system';
	try {
		const raw = localStorage.getItem(KEY);
		return raw === 'light' || raw === 'dark' ? raw : 'system';
	} catch {
		return 'system';
	}
}

let theme = $state<ThemeChoice>(load());

function apply() {
	if (typeof document === 'undefined') return;
	if (theme === 'system') {
		delete document.documentElement.dataset.theme;
	} else {
		document.documentElement.dataset.theme = theme;
	}
}

export const themeState = {
	get current(): ThemeChoice {
		return theme;
	},
	get label(): string {
		return theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';
	},
	cycle() {
		theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
		try {
			localStorage.setItem(KEY, theme);
		} catch {
			// The toggle still works for this session if saving fails.
		}
		apply();
	}
};

apply();
