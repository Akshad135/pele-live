import { describe, it, expect, beforeEach } from 'vitest';

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

const { projectStore, nameFromCode } = await import('$lib/projects.svelte');
const { appState } = await import('$lib/state.svelte');

describe('projects', () => {
	beforeEach(() => {
		localStorage.clear();
		projectStore.list.slice().forEach((p) => projectStore.remove(p.id));
		appState.load({ code: 'flowchart TD\n A --> B', config: '{}' });
	});

	it('derives a readable name from the diagram', () => {
		expect(nameFromCode('%% comment\nflowchart LR\n A --> B')).toBe('flowchart LR');
		expect(nameFromCode('pie title A very long title that keeps going and going and going')).toBe(
			'pie title A very long title that keeps g…'
		);
		expect(nameFromCode('')).toBe('Untitled diagram');
	});

	it('saves, opens and deletes projects', () => {
		projectStore.save('Release plan');
		appState.load({ code: 'pie title x', config: '{}' });
		expect(projectStore.list).toHaveLength(1);

		expect(projectStore.open(projectStore.list[0].id)).toBe(true);
		expect(appState.code).toBe('flowchart TD\n A --> B');

		projectStore.remove(projectStore.list[0].id);
		expect(projectStore.list).toHaveLength(0);
	});

	it('overwrites when saving under an existing name (case-insensitive)', () => {
		projectStore.save('Plan');
		appState.load({ code: 'pie title v2', config: '{}' });
		projectStore.save('plan');
		expect(projectStore.list).toHaveLength(1);
		expect(projectStore.list[0].state.code).toBe('pie title v2');
	});

	it('carries code, config and css', () => {
		appState.load({ code: 'flowchart LR\n X --> Y', config: '{"theme":"dark"}', css: '.pele-node { fill: red }' });
		projectStore.save('styled');
		appState.load({ code: 'pie', config: '{}', css: '' });
		projectStore.open(projectStore.list[0].id);
		expect(appState.config).toBe('{"theme":"dark"}');
		expect(appState.css).toContain('fill: red');
	});

	it('renaming onto an existing name overwrites it', () => {
		projectStore.save('Alpha');
		appState.load({ code: 'pie title beta', config: '{}' });
		projectStore.save();
		const beta = projectStore.list[0];
		projectStore.rename(beta.id, 'Alpha');
		expect(projectStore.list).toHaveLength(1);
		expect(projectStore.list[0].name).toBe('Alpha');
		expect(projectStore.list[0].state.code).toBe('pie title beta');
	});

	it('renames and imports without duplicating', () => {
		projectStore.save('One');
		const entry = projectStore.list[0];
		projectStore.rename(entry.id, 'Renamed');
		expect(projectStore.list[0].name).toBe('Renamed');

		const file = JSON.stringify([
			{ id: 'new', name: 'Two', state: { code: 'pie', config: '{}', css: '' }, time: 1 },
			{ id: 'new2', name: 'renamed', state: { code: 'x', config: '{}', css: '' }, time: 2 }, // name dup
			{ id: 'bad' }
		]);
		expect(projectStore.import(file)).toEqual({ restored: 1, duplicates: 1, invalid: 1 });
		expect(projectStore.list.map((p) => p.name)).toContain('Two');
	});
});
