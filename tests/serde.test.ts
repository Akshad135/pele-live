import { describe, expect, it } from 'vitest';
import { deflate } from 'pako';
import { deserializeState, serializeState } from '../src/lib/serde';
import { SAMPLES } from '../src/lib/samples';
import { renderDiagram } from '../src/lib/render';

describe('serde', () => {
	it('round-trips through the pako format', () => {
		const state = { code: 'flowchart LR\n  A --> B', config: '{"fontSize":14}' };
		const serialized = serializeState(state);
		expect(serialized.startsWith('pako:')).toBe(true);
		expect(deserializeState(serialized)).toEqual(state);
	});

	it('round-trips unicode and special characters', () => {
		const state = { code: 'flowchart LR\n  A[ "quotes" & <tags> 漢字 🎉 ] --> B', config: '{}' };
		expect(deserializeState(serializeState(state))).toEqual(state);
	});

	it('reads real mermaid.live links: pinned vectors from their exact serialize path', () => {
		// Vector 1: pako payload built with mermaid-live-editor's code path
		// (JSON.stringify -> deflate level 9 -> js-base64 fromUint8Array url-safe).
		expect(
			deserializeState(
				'pako:eNolTr0OgjAYfJXm5pLo2kEjOuqim9bhCy1CsJTUEkXS53B39w18HX0OCy53l_tJrkdmlYZAfrbXrCDn2Xora8YWh-_7-Xk9jixJZiwdrHSUy95W8wAOo52hUsVtL-ELbbSEkFDkKomhQK23u67OILxrNUfbKPJ6VdLJkYHI6XyJrlalt27zfzGe4Wio3lsbO_0gB7pBTDi6iIHjPmbTEH4EgT8i'
			)
		).toEqual({ code: 'flowchart LR\n  A[漢字] --> B\n  B --> C{ok?}', config: '{"theme":"dark"}' });
		// Vector 2: legacy raw-base64 format.
		expect(deserializeState('eyJjb2RlIjoiZ3JhcGggVERcbiBBLS0-QiIsIm1lcm1haWQiOiJ7fSJ9')).toEqual({
			code: 'graph TD\n A-->B',
			config: '{}'
		});
	});

	it('reads legacy base64 links with unicode without mojibake', () => {
		const json = JSON.stringify({ code: 'flowchart LR\n  A[漢字] --> B', mermaid: '{}' });
		const bytes = new TextEncoder().encode(json);
		let binary = '';
		for (const byte of bytes) binary += String.fromCharCode(byte);
		const legacy = btoa(binary);
		expect(deserializeState(legacy)).toEqual({ code: 'flowchart LR\n  A[漢字] --> B', config: '{}' });
	});

	it('rejects malformed payloads', () => {
		expect(deserializeState('pako:not-base64!!')).toBeNull();
		expect(deserializeState('garbage')).toBeNull();
		expect(deserializeState('pako:AAAA')).toBeNull();
		expect(serializeState({ code: 'x', config: '{}' }).startsWith('pako:')).toBe(true);
	});

	it('rejects JSON without a code field', () => {
		const json = JSON.stringify({ mermaid: '{}' });
		// Wrap the JSON with a real deflate so decoding succeeds but the shape is rejected.
		const bytes = deflate(new TextEncoder().encode(json), { level: 9 });
		let binary = '';
		for (const byte of bytes) binary += String.fromCharCode(byte);
		const payload = 'pako:' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		expect(deserializeState(payload)).toBeNull();
	});
});

describe('samples', () => {
	it('have unique names', () => {
		const names = SAMPLES.map((s) => s.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it('all render with pele', () => {
		for (const sample of SAMPLES) {
			const outcome = renderDiagram(sample.source);
			expect(outcome.ok, `${sample.name}: ${outcome.ok ? '' : outcome.error.message}`).toBe(true);
		}
	});
});
