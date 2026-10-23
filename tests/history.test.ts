import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The test environment is node: provide a minimal localStorage before the
// modules (which read it at import time) are loaded.
class MemStorage {
	private map = new Map<string, string>();
	getItem(key: string) {
		return this.map.has(key) ? this.map.get(key)! : null;
	}
	setItem(key: string, value: string) {
		this.map.set(key, String(value));
	}
	removeItem(key: string) {
		this.map.delete(key);
	}
	clear() {
		this.map.clear();
	}
}
(globalThis as unknown as { localStorage?: MemStorage }).localStorage = new MemStorage();

const { history } = await import('$lib/history.svelte');
const { appState } = await import('$lib/state.svelte');

describe('history', () => {
	beforeEach(() => {
		localStorage.clear();
		history.clear('auto');
		history.clear('manual');
		appState.load({ code: 'flowchart TD\n A --> B', config: '{}' });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('auto-save snapshots immediately, dedups unchanged state, and trims to 30', () => {
		vi.useFakeTimers();
		const stop = history.startAutoSave(10);
		expect(history.auto).toHaveLength(1);
		vi.advanceTimersByTime(10);
		expect(history.auto).toHaveLength(1); // nothing changed: no duplicate

		for (let i = 0; i < 40; i++) {
			appState.code = `flowchart TD\n A --> B${i}`;
			vi.advanceTimersByTime(10);
		}
		expect(history.auto).toHaveLength(30); // MAX_AUTO
		expect(history.auto[0].state.code).toContain('B39');
		stop();
	});

	it('saves, renames, restores and removes manual versions', () => {
		history.save('first');
		appState.code = 'pie title x';
		history.save();

		expect(history.manual).toHaveLength(2);
		expect(history.manual[0].name).toBeUndefined();
		expect(history.manual[1].name).toBe('first');

		history.rename(history.manual[1].id, 'renamed');
		expect(history.manual[1].name).toBe('renamed');

		history.restore(history.manual[1].id);
		expect(appState.code).toBe('flowchart TD\n A --> B');

		history.remove(history.manual[0].id);
		expect(history.manual).toHaveLength(1);

		history.clear('manual');
		expect(history.manual).toHaveLength(0);
	});

	it('does not save a manual duplicate of the newest entry', () => {
		history.save('a');
		history.save('b');
		expect(history.manual).toHaveLength(1);
	});

	it('restores code and config together', () => {
		appState.load({ code: 'flowchart LR\n X --> Y', config: '{"theme":"dark"}' });
		history.save('with config');
		appState.load({ code: 'pie', config: '{}' });
		history.restore(history.manual[0].id);
		expect(appState.code).toContain('X --> Y');
		expect(appState.config).toBe('{"theme":"dark"}');
	});

	it('imports JSON files, skipping duplicates and invalid entries', () => {
		history.save('kept');
		const existing = structuredClone(history.manual[0]);

		const file = JSON.stringify([
			existing, // duplicate id
			{ ...existing, id: 'other-id', state: { code: 'same', config: '{}' } }, // same state as newest? no — newest is "kept" code
			{ id: 'good', state: { code: 'pie title ok', config: '{}' }, time: 1, type: 'manual' },
			{ id: 'bad' }, // invalid
			{ id: 'bad2', state: { config: '{}' }, time: 2, type: 'manual' } // no code
		]);

		const result = history.import(file);
		expect(result.restored).toBe(2);
		expect(result.duplicates).toBe(1);
		expect(result.invalid).toBe(2);
		expect(history.manual).toHaveLength(3);
		expect(history.manual.some((e) => e.state.code === 'pie title ok')).toBe(true);

		expect(history.import('not json')).toEqual({ restored: 0, duplicates: 0, invalid: 0 });
		expect(history.import('[]')).toEqual({ restored: 0, duplicates: 0, invalid: 0 });
	});

	it('skips imported entries whose state matches an existing entry', () => {
		const current = {
			id: 'same-state',
			state: { code: appState.code, config: appState.config },
			time: Date.now(),
			type: 'manual' as const
		};
		const result = history.import(JSON.stringify([current]));
		expect(result.restored).toBe(1);
		const again = history.import(JSON.stringify([{ ...current, id: 'different-id' }]));
		expect(again.duplicates).toBe(1);
		expect(again.restored).toBe(0);
	});
});
