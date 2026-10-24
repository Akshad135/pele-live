<script lang="ts">
	import '../app.css';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	// Vercel page-view analytics. Skipped on local hosts: they have no
	// /_vercel/insights endpoint, so the injected script would 404 noisily.
	// SSR-safe: injectAnalytics no-ops when not in the browser.
	const local =
		typeof window !== 'undefined' &&
		['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
	if (!local) injectAnalytics({ mode: dev ? 'development' : 'production' });

	let { children } = $props();
</script>

<div id="app">
	{@render children()}
</div>
