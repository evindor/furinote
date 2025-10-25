<script lang="ts">
	import { onMount } from 'svelte';
	import { storageService } from '$lib/services/storage.service.js';
	import { analysisService } from '$lib/services/analysis.service.js';
	import { ensureInitialized } from '$lib/stores/initialization.js';
	import type { TrackedWord } from '$lib/types/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import WordCard from '$lib/components/WordCard.svelte';

	let words: TrackedWord[] = [];
	let filteredWords: TrackedWord[] = [];
	let searchTerm = '';
	let isLoading = false;
	let isReanalyzing = false;
	let fetchingDefinitions = new Set<string>(); // Track which words are currently fetching
	let showStats = false; // Toggle for mobile stats display
	let analysisStats = {
		totalEntries: 0,
		analyzedEntries: 0,
		unanalyzedEntries: 0,
		totalWords: 0
	};

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		try {
			// Wait for database initialization
			await ensureInitialized();

			const [wordsData, stats] = await Promise.all([
				storageService.getAllWords(),
				analysisService.getAnalysisStats()
			]);

			words = wordsData;
			filteredWords = words;
			analysisStats = stats;
		} catch (error) {
			console.error('Error loading words data:', error);
		} finally {
			isLoading = false;
		}
	}

	async function forceReanalyze() {
		if (isReanalyzing) return;

		isReanalyzing = true;
		try {
			await analysisService.forceReanalyzeAll();
			await loadData();
		} catch (error) {
			console.error('Error during force reanalysis:', error);
			alert('Error during reanalysis. Please check the console for details.');
		} finally {
			isReanalyzing = false;
		}
	}

	async function analyzeUnanalyzed() {
		if (isReanalyzing) return;

		isReanalyzing = true;
		try {
			await analysisService.analyzeUnanalyzedEntries();
			await loadData();
		} catch (error) {
			console.error('Error analyzing unanalyzed entries:', error);
			alert('Error during analysis. Please check the console for details.');
		} finally {
			isReanalyzing = false;
		}
	}

	function filterWords() {
		console.log('filterWords called with searchTerm:', searchTerm, 'words length:', words.length);

		if (!searchTerm.trim()) {
			filteredWords = words;
			console.log('No search term, showing all words:', filteredWords.length);
		} else {
			const term = searchTerm.toLowerCase().trim();
			console.log('Filtering with term:', term);

			filteredWords = words.filter((word) => {
				// Search in word text (exact match and partial match)
				const wordMatch = word.word.toLowerCase().includes(term);
				if (wordMatch) {
					console.log('Word match:', word.word, 'contains', term);
					return true;
				}

				// Search in reading (hiragana/katakana)
				const readingMatch = word.reading.toLowerCase().includes(term);
				if (readingMatch) {
					console.log('Reading match:', word.reading, 'contains', term);
					return true;
				}

				// Search in Jisho data if available
				if (word.jishoData) {
					// Search in parts of speech and English definitions
					const definitionMatch = word.jishoData.senses.some((sense) =>
						// Search in English definitions
						sense.english_definitions.some((def) => def.toLowerCase().includes(term))
					);
					if (definitionMatch) {
						console.log('Definition match for:', word.word);
						return true;
					}
				}

				return false;
			});

			console.log('Filtered results:', filteredWords.length, 'out of', words.length);
		}
	}

	function getKanjiFromWord(word: string): string[] {
		const kanjiRegex = /[\u4E00-\u9FAF]/g;
		const matches = word.match(kanjiRegex);
		return matches ? [...new Set(matches)] : [];
	}

	$: (searchTerm, words, filterWords());
</script>

<svelte:head>
	<title>Words - Kanji desu</title>
</svelte:head>

<div class="container mx-auto space-y-6 p-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Word Tracking</h1>
			<p class="text-muted-foreground">Track your Japanese vocabulary usage and frequency</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={() => (showStats = !showStats)}>Stats</Button>
		</div>
	</div>

	<!-- Statistics (Hidden by default, toggleable) -->
	{#if showStats}
		<Card>
			<CardContent class="p-4">
				<div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
					<div class="text-center">
						<div class="text-lg font-bold md:text-2xl">{analysisStats.totalEntries}</div>
						<div class="text-muted-foreground">Total Entries</div>
					</div>
					<div class="text-center">
						<div class="text-lg font-bold text-green-600 md:text-2xl">
							{analysisStats.analyzedEntries}
						</div>
						<div class="text-muted-foreground">Analyzed</div>
					</div>
					<div class="text-center">
						<div class="text-lg font-bold text-orange-600 md:text-2xl">
							{analysisStats.unanalyzedEntries}
						</div>
						<div class="text-muted-foreground">Unanalyzed</div>
					</div>
					<div class="text-center">
						<div class="text-lg font-bold text-blue-600 md:text-2xl">
							{analysisStats.totalWords}
						</div>
						<div class="text-muted-foreground">Words</div>
					</div>
				</div>
				<div class="mt-4 flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={analyzeUnanalyzed}
						disabled={isReanalyzing || analysisStats.unanalyzedEntries === 0}
						class="flex-1"
					>
						{#if isReanalyzing}
							Analyzing...
						{:else}
							Analyze ({analysisStats.unanalyzedEntries})
						{/if}
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onclick={forceReanalyze}
						disabled={isReanalyzing}
						class="flex-1"
					>
						{#if isReanalyzing}
							Rebuilding...
						{:else}
							Rebuild
						{/if}
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Search Bar -->
	<div class="mx-auto mb-6 w-full max-w-md">
		<Input
			type="text"
			placeholder="Search by kanji, reading, English meaning, or JLPT level..."
			bind:value={searchTerm}
			class="w-full"
		/>
		{#if searchTerm.trim()}
			<div class="mt-2 text-center text-xs text-muted-foreground">
				Found {filteredWords.length} word{filteredWords.length === 1 ? '' : 's'} matching "{searchTerm}"
			</div>
		{/if}
	</div>

	<!-- Word Cards -->
	{#if isLoading}
		<div class="py-8 text-center">
			<p class="text-muted-foreground">Loading words...</p>
		</div>
	{:else if filteredWords.length === 0}
		<div class="py-8 text-center">
			<p class="text-muted-foreground">
				{searchTerm
					? 'No words found matching your search.'
					: 'No words tracked yet. Start writing journal entries!'}
			</p>
		</div>
	{:else}
		<div class="mb-6 text-center text-sm text-muted-foreground">
			Showing {filteredWords.length} of {words.length} words
		</div>
		<div class="space-y-6">
			{#each filteredWords as word (word.id)}
				<WordCard {word} bind:fetchingDefinitions />
			{/each}
		</div>
	{/if}
</div>

<!-- Floating Journal Button -->
<a
	href="/"
	class="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-none"
	aria-label="Go to journal"
>
	<span class="text-lg font-medium">日記</span>
</a>
