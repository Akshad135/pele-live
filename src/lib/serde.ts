import { deflate, inflate } from 'pako';

export interface SharedState {
	code: string;
	config: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
	const padded = text.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/**
 * Deflate + base64url. Same `pako:` format mermaid.live uses, and the JSON
 * payload uses their `mermaid` key for the config, so links open in either tool.
 */
export function serializeState(state: SharedState): string {
	const json = JSON.stringify({ code: state.code, mermaid: state.config });
	const compressed = deflate(new TextEncoder().encode(json), { level: 9 });
	return `pako:${bytesToBase64Url(compressed)}`;
}

/** Accepts `pako:` links and legacy raw-base64 links. Returns null when malformed. */
export function deserializeState(fragment: string): SharedState | null {
	if (!fragment) return null;
	try {
		let json: string;
		if (fragment.startsWith('pako:')) {
			json = inflate(base64UrlToBytes(fragment.slice(5)), { to: 'string' });
		} else {
			// Legacy base64 is UTF-8 encoded (js-base64 in mermaid.live); decode bytes, not chars.
			json = new TextDecoder().decode(base64UrlToBytes(fragment));
		}
		const parsed: unknown = JSON.parse(json);
		if (parsed === null || typeof parsed !== 'object' || typeof (parsed as SharedState).code !== 'string') {
			return null;
		}
		const state = parsed as { code: string; mermaid?: unknown; config?: unknown };
		const config =
			typeof state.mermaid === 'string'
				? state.mermaid
				: typeof state.config === 'string'
					? state.config
					: '{}';
		return { code: state.code, config };
	} catch {
		return null;
	}
}
