<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import TextEditor from '$lib/components/TextEditor.svelte';
	import DatabaseDebugView from '$lib/components/DatabaseDebugView.svelte';
	import MecabTest from '$lib/components/MecabTest.svelte';
	import { storageService } from '$lib/services/storage.service.js';
	import { wordExtractorService } from '$lib/services/word-extractor.service.js';
	import { ensureInitialized } from '$lib/stores/initialization.js';
	import type { JournalEntry } from '$lib/types/index.js';

	// State
	let currentEntry = $state<JournalEntry | null>(null);
	let entries = $state<JournalEntry[]>([]);
	let showDebugView = $state(false);
	let showMecabTest = $state(false);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		await initializeApp();
	});

	async function initializeApp() {
		try {
			// Wait for database initialization
			await ensureInitialized();

			// Load existing entries
			entries = await storageService.getAllEntries();

			// Create or load today's entry
			await loadTodaysEntry();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to initialize app';
			console.error('App initialization error:', err);
		} finally {
			isLoading = false;
		}
	}

	async function loadTodaysEntry() {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Look for today's entry
		const todaysEntry = entries.find((entry) => {
			const entryDate = new Date(entry.date);
			entryDate.setHours(0, 0, 0, 0);
			return entryDate.getTime() === today.getTime();
		});

		if (todaysEntry) {
			currentEntry = todaysEntry;
		} else {
			// Create new entry for today
			currentEntry = await createNewEntry(today);
		}
	}

	async function createNewEntry(date: Date = new Date()): Promise<JournalEntry> {
		const newEntry = await storageService.createEntry({
			date,
			content: '',
			wordCount: 0,
			kanjiCount: 0,
			analyzed: false,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		entries = [newEntry, ...entries];
		return newEntry;
	}

	async function handleEntrySave(savedEntry: JournalEntry) {
		// Update the entry in our local state
		const index = entries.findIndex((entry) => entry.id === savedEntry.id);
		if (index !== -1) {
			entries[index] = savedEntry;
		}

		// Extract and track words from the entry
		if (savedEntry.content.trim()) {
			try {
				await wordExtractorService.extractAndTrackWords(savedEntry.id, savedEntry.content);
			} catch (err) {
				console.error('Error tracking words:', err);
			}
		}
	}

	async function selectEntry(entry: JournalEntry) {
		currentEntry = entry;
	}

	async function createNewEntryForToday() {
		const newEntry = await createNewEntry();
		currentEntry = newEntry;
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function toggleDebugView() {
		showDebugView = !showDebugView;
		showMecabTest = false; // Hide MeCab test when showing debug
	}

	function toggleMecabTest() {
		showMecabTest = !showMecabTest;
		showDebugView = false; // Hide debug when showing MeCab test
	}
</script>

<svelte:head>
	<title>Kanji desu - Japanese Journal</title>
	<meta
		name="description"
		content="Learn Japanese through daily journaling with furigana support"
	/>
</svelte:head>

<div class="bg-background min-h-screen">
	<!-- Header -->
	<header
		class="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur"
	>
		<div class="container mx-auto px-4 py-4">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold">漢字です</h1>
					<p class="text-muted-foreground text-sm">Japanese Learning Journal</p>
				</div>

				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={createNewEntryForToday}>New Entry</Button>
					<Button variant="outline" size="sm" onclick={toggleMecabTest}>
						{showMecabTest ? 'Hide' : 'Test'} MeCab
					</Button>
					<Button variant="outline" size="sm" onclick={toggleDebugView}>
						{showDebugView ? 'Hide' : 'Show'} Debug
					</Button>
				</div>
			</div>
		</div>
	</header>

	<main class="container mx-auto px-4 py-8">
		{#if isLoading}
			<div class="flex min-h-[400px] items-center justify-center">
				<div class="text-center">
					<div class="text-lg font-medium">Loading Kanji desu...</div>
					<div class="text-muted-foreground mt-2 text-sm">
						Initializing Japanese text processing...
					</div>
				</div>
			</div>
		{:else if error}
			<Card class="mx-auto max-w-md">
				<CardHeader>
					<CardTitle class="text-red-600">Error</CardTitle>
				</CardHeader>
				<CardContent>
					<p class="text-sm">{error}</p>
					<Button class="mt-4" onclick={initializeApp}>Try Again</Button>
				</CardContent>
			</Card>
		{:else if showDebugView}
			<DatabaseDebugView />
		{:else if showMecabTest}
			<MecabTest />
		{:else}
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
				<!-- Sidebar - Entry List -->
				<div class="lg:col-span-1">
					<Card>
						<CardHeader>
							<CardTitle class="text-lg">Journal Entries</CardTitle>
						</CardHeader>
						<CardContent class="space-y-2">
							{#if entries.length === 0}
								<div class="text-muted-foreground py-8 text-center text-sm">
									No entries yet. Start writing!
								</div>
							{:else}
								{#each entries as entry (entry.id)}
									<button
										class="hover:bg-muted/50 w-full rounded-lg border p-3 text-left transition-colors {currentEntry?.id ===
										entry.id
											? 'bg-muted border-primary'
											: ''}"
										onclick={() => selectEntry(entry)}
									>
										<div class="text-sm font-medium">
											{entry.title || formatDate(entry.date)}
										</div>
										<div class="text-muted-foreground mt-1 text-xs">
											{#if entry.furiganaHtml}
												<div class="furigana-preview">
													{@html entry.furiganaHtml.substring(0, 100)}{entry.furiganaHtml.length >
													100
														? '...'
														: ''}
												</div>
											{:else}
												{entry.content.substring(0, 50)}{entry.content.length > 50 ? '...' : ''}
											{/if}
										</div>
										<div class="text-muted-foreground mt-1 text-xs">
											{entry.wordCount} words • {entry.kanjiCount} kanji
										</div>
									</button>
								{/each}
							{/if}
						</CardContent>
					</Card>
				</div>

				<style>
					/* Furigana preview styling */
					:global(.furigana-preview ruby) {
						ruby-align: center;
					}

					:global(.furigana-preview rt) {
						font-size: 0.5em;
						line-height: 1;
						text-align: center;
						color: #666;
					}
				</style>

				<!-- Main Content - Text Editor -->
				<div class="lg:col-span-3">
					{#if currentEntry}
						<TextEditor entry={currentEntry} onSave={handleEntrySave} />
					{:else}
						<Card class="flex h-[400px] items-center justify-center">
							<CardContent class="text-center">
								<h3 class="mb-2 text-lg font-medium">Welcome to Kanji desu!</h3>
								<p class="text-muted-foreground mb-4">
									Start your Japanese learning journey by creating your first journal entry.
								</p>
								<Button onclick={createNewEntryForToday}>Create First Entry</Button>
							</CardContent>
						</Card>
					{/if}
				</div>
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="bg-muted/50 mt-16 border-t">
		<div class="container mx-auto px-4 py-6">
			<div class="text-muted-foreground text-center text-sm">
				<p>Learn Japanese through daily journaling with real-time furigana support</p>
				<p class="mt-1">Built with SvelteKit • Powered by MeCab & Wanakana</p>
			</div>
		</div>
	</footer>
</div>
