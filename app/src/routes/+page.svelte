<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import EntryEditor from '$lib/components/EntryEditor.svelte';
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
	let showEditor = $state(false);

	onMount(async () => {
		await initializeApp();
	});

	async function initializeApp() {
		try {
			// Wait for database initialization
			await ensureInitialized();

			// Load existing entries and sort by creation date (newest first)
			entries = (await storageService.getAllEntries()).sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);

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
		// We don't need to auto-load today's entry anymore
		// Entries will be created when user clicks the plus button
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

		// Add new entry and maintain sort order by creation date
		entries = [newEntry, ...entries].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
		return newEntry;
	}

	async function handleEntrySave(savedEntry: JournalEntry) {
		// Update the entry in our local state
		const index = entries.findIndex((entry) => entry.id === savedEntry.id);
		if (index !== -1) {
			// Update existing entry
			entries[index] = savedEntry;
		} else {
			// Add new entry
			entries = [savedEntry, ...entries];
		}

		// Maintain sort order by creation date (newest first)
		entries = entries.sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);

		// Extract and track words from the entry
		if (savedEntry.content.trim()) {
			try {
				await wordExtractorService.extractAndTrackWords(savedEntry.id, savedEntry.content);
			} catch (err) {
				console.error('Error tracking words:', err);
			}
		}
	}

	async function handleEntryDelete(entryToDelete: JournalEntry) {
		if (!entryToDelete.id) {
			// For new entries without ID, just close the editor
			return;
		}

		try {
			// Delete from storage
			await storageService.deleteEntry(entryToDelete.id);

			// Remove from local state
			entries = entries.filter((entry) => entry.id !== entryToDelete.id);
		} catch (err) {
			console.error('Error deleting entry:', err);
		}
	}

	async function selectEntry(entry: JournalEntry) {
		currentEntry = entry;
		showEditor = true;
	}

	async function createNewEntryForToday() {
		const newEntry = await createNewEntry();
		currentEntry = newEntry;
		showEditor = true;
	}

	function openNewEntryEditor() {
		// Create a temporary entry for editing
		currentEntry = {
			id: '', // Will be assigned when saved
			date: new Date(),
			content: '',
			wordCount: 0,
			kanjiCount: 0,
			analyzed: false,
			createdAt: new Date(),
			updatedAt: new Date()
		} as JournalEntry;
		showEditor = true;
	}

	function closeEditor() {
		showEditor = false;
		currentEntry = null;
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatDateTime(date: Date): string {
		return new Date(date).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
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

<div class="relative min-h-screen bg-background">
	{#if isLoading}
		<div class="flex min-h-screen items-center justify-center">
			<div class="text-center">
				<div class="text-lg font-medium">Loading Kanji desu...</div>
				<div class="mt-2 text-sm text-muted-foreground">
					Initializing Japanese text processing...
				</div>
			</div>
		</div>
	{:else if error}
		<div class="flex min-h-screen items-center justify-center p-4">
			<Card class="mx-auto max-w-md">
				<CardHeader>
					<CardTitle class="text-red-600">Error</CardTitle>
				</CardHeader>
				<CardContent>
					<p class="text-sm">{error}</p>
					<Button class="mt-4" onclick={initializeApp}>Try Again</Button>
				</CardContent>
			</Card>
		</div>
	{:else if showDebugView}
		<div class="p-4">
			<div class="mb-4">
				<Button variant="outline" onclick={toggleDebugView}>Back to Journal</Button>
			</div>
			<DatabaseDebugView />
		</div>
	{:else if showMecabTest}
		<div class="p-4">
			<div class="mb-4">
				<Button variant="outline" onclick={toggleMecabTest}>Back to Journal</Button>
			</div>
			<MecabTest />
		</div>
	{:else}
		<!-- Main Journal View -->
		<div class="flex min-h-screen flex-col">
			<!-- Header with debug buttons -->
			<div
				class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
			>
				<div class="flex items-center justify-between p-4">
					<div>
						<h1 class="text-xl font-bold">漢字です</h1>
						<p class="text-sm text-muted-foreground">Japanese Learning Journal</p>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={toggleMecabTest}>分析</Button>
						<Button variant="outline" size="sm" onclick={toggleDebugView}>
							{showDebugView ? 'Hide' : 'Show'} Debug
						</Button>
					</div>
				</div>
			</div>

			<!-- Journal Entries List -->
			<div class="flex-1 overflow-y-auto">
				{#if entries.length === 0}
					<div class="flex h-full items-center justify-center p-8">
						<div class="text-center">
							<div class="mb-4 text-6xl">📝</div>
							<h3 class="mb-2 text-xl font-medium">Welcome to Kanji desu!</h3>
							<p class="mb-6 max-w-md text-muted-foreground">
								Start your Japanese learning journey by creating your first journal entry.
							</p>
							<Button onclick={openNewEntryEditor} size="lg">Create First Entry</Button>
						</div>
					</div>
				{:else}
					<div class="divide-y">
						{#each entries as entry (entry.id)}
							<button
								class="w-full p-6 text-left transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
								onclick={() => selectEntry(entry)}
							>
								<!-- Entry Content -->
								<div class="mb-4">
									{#if entry.furiganaHtml}
										<div
											class="furigana-content text-xl leading-relaxed"
											style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; line-height: 2.2;"
										>
											{@html entry.furiganaHtml}
										</div>
									{:else if entry.content}
										<div
											class="text-xl leading-relaxed"
											style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; line-height: 2.2;"
										>
											{entry.content}
										</div>
									{:else}
										<div class="text-xl text-muted-foreground italic">Empty entry</div>
									{/if}
								</div>

								<!-- Entry Footer -->
								<div class="flex items-center justify-between">
									<div class="flex gap-4 text-sm text-muted-foreground">
										<span>{entry.wordCount} words</span>
										<span>{entry.kanjiCount} kanji</span>
									</div>
									<div class="text-sm text-muted-foreground">
										{formatDateTime(entry.createdAt || entry.date)}
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Floating Plus Button -->
		<button
			class="fixed right-6 bottom-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
			onclick={openNewEntryEditor}
			aria-label="Create new journal entry"
		>
			<svg class="mx-auto h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
				></path>
			</svg>
		</button>

		<!-- Floating Dictionary Button -->
		<a
			href="/words"
			class="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-none"
			aria-label="Go to dictionary"
		>
			<span class="text-lg font-medium">辞書</span>
		</a>
	{/if}

	<!-- Entry Editor Modal -->
	<EntryEditor
		bind:entry={currentEntry}
		isOpen={showEditor}
		onClose={closeEditor}
		onSave={handleEntrySave}
		onDelete={handleEntryDelete}
	/>
</div>

<style>
	/* Furigana styling for journal entries */
	:global(.furigana-content ruby) {
		ruby-align: center;
	}

	:global(.furigana-content rt) {
		font-size: 0.6em;
		line-height: 1;
		text-align: center;
		color: #666;
		font-weight: normal;
	}

	/* Custom scrollbar */
	.overflow-y-auto::-webkit-scrollbar {
		width: 6px;
	}

	.overflow-y-auto::-webkit-scrollbar-track {
		background: transparent;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb {
		background: hsl(var(--muted-foreground) / 0.3);
		border-radius: 3px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground) / 0.5);
	}
</style>
