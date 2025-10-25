<script lang="ts">
	import { onMount } from 'svelte';
	import { storageService } from '$lib/services/storage.service.js';
	import { analysisService } from '$lib/services/analysis.service.js';
	import { jishoService } from '$lib/services/jisho.service.js';
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
	import {
		Table,
		TableBody,
		TableCaption,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';

	let words: TrackedWord[] = [];
	let filteredWords: TrackedWord[] = [];
	let searchTerm = '';
	let isLoading = false;
	let isReanalyzing = false;
	let fetchingDefinitions = new Set<string>(); // Track which words are currently fetching
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
		if (!searchTerm.trim()) {
			filteredWords = words;
		} else {
			const term = searchTerm.toLowerCase();
			filteredWords = words.filter(
				(word) =>
					word.word.toLowerCase().includes(term) || word.reading.toLowerCase().includes(term)
			);
		}
	}

	function sortByFrequency() {
		filteredWords = [...filteredWords].sort((a, b) => b.frequency - a.frequency);
	}

	function sortByWord() {
		filteredWords = [...filteredWords].sort((a, b) => a.word.localeCompare(b.word));
	}

	function sortByReading() {
		filteredWords = [...filteredWords].sort((a, b) => a.reading.localeCompare(b.reading));
	}

	function getKanjiFromWord(word: string): string[] {
		const kanjiRegex = /[\u4E00-\u9FAF]/g;
		const matches = word.match(kanjiRegex);
		return matches ? [...new Set(matches)] : [];
	}

	async function fetchDefinition(word: TrackedWord) {
		if (fetchingDefinitions.has(word.id)) return;

		fetchingDefinitions.add(word.id);
		fetchingDefinitions = fetchingDefinitions; // Trigger reactivity

		try {
			const jishoData = await jishoService.fetchDefinition(word.word);

			if (jishoData) {
				// Update the word in the database
				await storageService.updateWordWithJishoData(word.id, jishoData);

				// Update the local state
				const wordIndex = words.findIndex((w) => w.id === word.id);
				if (wordIndex !== -1) {
					words[wordIndex] = { ...words[wordIndex], jishoData };
					words = words; // Trigger reactivity
					filterWords(); // Update filtered words
				}
			} else {
				alert('No definition found for this word.');
			}
		} catch (error) {
			console.error('Error fetching definition:', error);
			alert('Error fetching definition. Please try again.');
		} finally {
			fetchingDefinitions.delete(word.id);
			fetchingDefinitions = fetchingDefinitions; // Trigger reactivity
		}
	}

	$: {
		filterWords();
	}
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
			<Button
				variant="outline"
				onclick={analyzeUnanalyzed}
				disabled={isReanalyzing || analysisStats.unanalyzedEntries === 0}
			>
				{#if isReanalyzing}
					Analyzing...
				{:else}
					Analyze Unanalyzed ({analysisStats.unanalyzedEntries})
				{/if}
			</Button>
			<Button variant="destructive" onclick={forceReanalyze} disabled={isReanalyzing}>
				{#if isReanalyzing}
					Rebuilding...
				{:else}
					Force Rebuild All Data
				{/if}
			</Button>
		</div>
	</div>

	<!-- Statistics Cards -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium">Total Entries</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{analysisStats.totalEntries}</div>
			</CardContent>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium">Analyzed Entries</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold text-green-600">{analysisStats.analyzedEntries}</div>
			</CardContent>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium">Unanalyzed Entries</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold text-orange-600">{analysisStats.unanalyzedEntries}</div>
			</CardContent>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium">Unique Words</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold text-blue-600">{analysisStats.totalWords}</div>
			</CardContent>
		</Card>
	</div>

	<!-- Search and Controls -->
	<Card>
		<CardHeader>
			<CardTitle>Word List</CardTitle>
			<CardDescription>Search and sort your tracked Japanese words</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="flex flex-col gap-4 sm:flex-row">
				<div class="flex-1">
					<Input
						type="text"
						placeholder="Search words or readings..."
						bind:value={searchTerm}
						class="w-full"
					/>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={sortByFrequency}>Sort by Frequency</Button>
					<Button variant="outline" size="sm" onclick={sortByWord}>Sort by Word</Button>
					<Button variant="outline" size="sm" onclick={sortByReading}>Sort by Reading</Button>
				</div>
			</div>

			<Separator />

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
				<div class="rounded-md border">
					<Table>
						<TableCaption>
							Showing {filteredWords.length} of {words.length} words
						</TableCaption>
						<TableHeader>
							<TableRow>
								<TableHead class="w-[200px]">Word</TableHead>
								<TableHead class="w-[200px]">Reading</TableHead>
								<TableHead class="w-[150px]">Kanji</TableHead>
								<TableHead class="w-[100px]">Frequency</TableHead>
								<TableHead class="w-[150px]">First Seen</TableHead>
								<TableHead class="w-[150px]">Last Used</TableHead>
								<TableHead class="w-[100px]">Entries</TableHead>
								<TableHead class="w-[300px]">Definition</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each filteredWords as word (word.id)}
								<TableRow>
									<TableCell class="text-lg font-medium">
										{word.word}
									</TableCell>
									<TableCell class="text-muted-foreground">
										{word.reading}
									</TableCell>
									<TableCell>
										<div class="flex flex-wrap gap-1">
											{#each getKanjiFromWord(word.word) as kanji}
												<Badge variant="secondary" class="text-xs">
													{kanji}
												</Badge>
											{/each}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline">
											{word.frequency}
										</Badge>
									</TableCell>
									<TableCell class="text-sm text-muted-foreground">
										{new Date(word.firstSeen).toLocaleDateString()}
									</TableCell>
									<TableCell class="text-sm text-muted-foreground">
										{new Date(word.lastUsed).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<Badge variant="outline">
											{word.entryIds.length}
										</Badge>
									</TableCell>
									<TableCell class="max-w-[300px]">
										{#if word.jishoData}
											<div class="space-y-2">
												{#if word.jishoData.jlpt.length > 0}
													<div class="flex flex-wrap gap-1">
														{#each word.jishoData.jlpt as level}
															<Badge variant="secondary" class="text-xs">
																{level.toUpperCase()}
															</Badge>
														{/each}
													</div>
												{/if}
												<div class="space-y-1">
													{#each word.jishoData.senses as sense, index}
														<div class="text-sm">
															<div class="font-medium text-muted-foreground">
																{sense.parts_of_speech.join(', ')}
															</div>
															<div class="text-xs">
																{sense.english_definitions.join('; ')}
															</div>
														</div>
														{#if index < word.jishoData.senses.length - 1}
															<div class="my-1 border-t border-muted"></div>
														{/if}
													{/each}
												</div>
											</div>
										{:else}
											<Button
												variant="outline"
												size="sm"
												onclick={() => fetchDefinition(word)}
												disabled={fetchingDefinitions.has(word.id)}
											>
												{#if fetchingDefinitions.has(word.id)}
													Fetching...
												{:else}
													Fetch Definition
												{/if}
											</Button>
										{/if}
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

<!-- Floating Journal Button -->
<a
	href="/"
	class="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-none"
	aria-label="Go to journal"
>
	<span class="text-lg font-medium">日記</span>
</a>
