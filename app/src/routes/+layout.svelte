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

<div class="bg-background min-h-screen">
	<!-- Navigation -->
	<nav class="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
		<div class="container mx-auto px-4">
			<div class="flex h-14 items-center justify-between">
				<div class="flex items-center space-x-4">
					<a href="/" class="text-xl font-bold">Kanji desu</a>
					<div class="hidden space-x-4 md:flex">
						<a
							href="/"
							class="hover:text-primary text-sm font-medium transition-colors {$page.url
								.pathname === '/'
								? 'text-foreground'
								: 'text-muted-foreground'}"
						>
							Journal
						</a>
						<a
							href="/words"
							class="hover:text-primary text-sm font-medium transition-colors {$page.url
								.pathname === '/words'
								? 'text-foreground'
								: 'text-muted-foreground'}"
						>
							Words
						</a>
					</div>
				</div>
				<div class="md:hidden">
					<div class="flex space-x-2">
						<Button variant={$page.url.pathname === '/' ? 'default' : 'ghost'} size="sm" href="/">
							Journal
						</Button>
						<Button
							variant={$page.url.pathname === '/words' ? 'default' : 'ghost'}
							size="sm"
							href="/words"
						>
							Words
						</Button>
					</div>
				</div>
			</div>
		</div>
	</nav>

	<!-- Main content -->
	<main>
		{@render children?.()}
	</main>
</div>
