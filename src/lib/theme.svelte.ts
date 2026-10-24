export type ThemeChoice = 'auto' | 'day' | 'paper' | 'midnight' | 'matte';

const KEY = 'pele-live:theme';

export const THEMES: { id: ThemeChoice; label: string; scheme: 'light' | 'dark' }[] = [
	{ id: 'auto', label: 'System', scheme: 'light' },
	{ id: 'day', label: 'Day', scheme: 'light' },
	{ id: 'paper', label: 'Paper', scheme: 'light' },
	{ id: 'midnight', label: 'Midnight', scheme: 'dark' },
	{ id: 'matte', label: 'Matte', scheme: 'dark' }
];

/** Legacy values from before theme variants existed. */
function normalize(raw: string | null): ThemeChoice {
	if (raw === 'light') return 'day';
	if (raw === 'dark') return 'matte';
	return THEMES.some((t) => t.id === raw) ? (raw as ThemeChoice) : 'auto';
}

function load(): ThemeChoice {
	if (typeof localStorage === 'undefined') return 'auto';
	try {
		return normalize(localStorage.getItem(KEY));
	} catch {
		return 'auto';
	}
}

let theme = $state<ThemeChoice>(load());

function apply() {
	if (typeof document === 'undefined') return;
	// 'auto' means no attribute: the prefers-color-scheme media queries decide.
	if (theme === 'auto') {
		delete document.documentElement.dataset.theme;
	} else {
		document.documentElement.dataset.theme = theme;
	}
}

// Tracks the OS scheme so effects that read computed colors can re-run when
// the OS flips while the user is on the auto theme (no data-theme attribute).
let systemDark = $state(
	typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
);

if (typeof matchMedia !== 'undefined') {
	const query = matchMedia('(prefers-color-scheme: dark)');
	query.addEventListener('change', (event) => (systemDark = event.matches));
}

export const themeState = {
	get current(): ThemeChoice {
		return theme;
	},
	get systemDark(): boolean {
		return systemDark;
	},
	get label(): string {
		return THEMES.find((t) => t.id === theme)?.label ?? 'System';
	},
	set(choice: ThemeChoice) {
		theme = choice;
		try {
			localStorage.setItem(KEY, choice);
		} catch {
			// The toggle still works for this session if saving fails.
		}
		apply();
	}
};

apply();
