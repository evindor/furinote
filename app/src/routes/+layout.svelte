<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ensureInitialized } from '$lib/stores/initialization.js';

	let { children } = $props();

	onMount(async () => {
		// Initialize storage first - this ensures database is ready for any page
		await ensureInitialized();

		// Register service worker for PWA functionality
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((registration) => {
					console.log('Service Worker registered successfully:', registration);
				})
				.catch((error) => {
					console.log('Service Worker registration failed:', error);
				});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Main content -->
	{@render children?.()}
</div>
