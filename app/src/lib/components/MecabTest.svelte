<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { mecabService } from '$lib/services/mecab.service.js';
	import { furiganaService } from '$lib/services/furigana.service.js';
	import { wordExtractorService } from '$lib/services/word-extractor.service.js';
	import type { MecabToken } from '$lib/types/index.js';

	// State
	let inputText = $state('私の犬が可愛いです');
	let mecabResult = $state<MecabToken[]>([]);
	let furiganaHtml = $state('');
	let wordStats = $state<any>(null);
	let isAnalyzing = $state(false);
	let error = $state<string | null>(null);

	onMount(() => {
		// Test with default text on mount
		analyzeText();
	});

	async function analyzeText() {
		if (!inputText.trim()) return;

		isAnalyzing = true;
		error = null;

		try {
			// Test MeCab analysis
			console.log('Testing MeCab analysis...');
			mecabResult = await mecabService.analyze(inputText);
			console.log('MeCab result:', mecabResult);

			// Test furigana generation
			console.log('Testing furigana generation...');
			furiganaHtml = await furiganaService.generateFuriganaHTML(inputText);
			console.log('Furigana HTML:', furiganaHtml);

			// Test word statistics
			console.log('Testing word statistics...');
			wordStats = await wordExtractorService.getWordStatistics(inputText);
			console.log('Word statistics:', wordStats);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Analysis failed';
			console.error('Analysis error:', err);
		} finally {
			isAnalyzing = false;
		}
	}

	function clearResults() {
		mecabResult = [];
		furiganaHtml = '';
		wordStats = null;
		error = null;
	}
</script>

<Card class="mx-auto w-full max-w-4xl">
	<CardHeader>
		<CardTitle>MeCab Integration Test</CardTitle>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Input -->
		<div>
			<label for="test-input" class="mb-2 block text-sm font-medium"> Japanese Text Input: </label>
			<Textarea
				id="test-input"
				bind:value={inputText}
				placeholder="Enter Japanese text to analyze..."
				class="min-h-[100px]"
			/>
		</div>

		<!-- Controls -->
		<div class="flex gap-2">
			<Button onclick={analyzeText} disabled={isAnalyzing || !inputText.trim()}>
				{isAnalyzing ? 'Analyzing...' : 'Analyze Text'}
			</Button>
			<Button variant="outline" onclick={clearResults}>Clear Results</Button>
		</div>

		<!-- Error Display -->
		{#if error}
			<div class="rounded-md border border-red-200 bg-red-50 p-4">
				<p class="font-medium text-red-800">Error:</p>
				<p class="text-red-600">{error}</p>
			</div>
		{/if}

		<!-- Furigana Result -->
		{#if furiganaHtml}
			<div>
				<h3 class="mb-2 text-lg font-semibold">Furigana Output:</h3>
				<div class="rounded-md border bg-gray-50 p-4">
					<div class="text-xl leading-relaxed">
						{@html furiganaHtml}
					</div>
				</div>
			</div>
		{/if}

		<!-- Word Statistics -->
		{#if wordStats}
			<div>
				<h3 class="mb-2 text-lg font-semibold">Word Statistics:</h3>
				<div class="grid grid-cols-2 gap-4 rounded-md border bg-blue-50 p-4 md:grid-cols-4">
					<div class="text-center">
						<div class="text-2xl font-bold text-blue-600">{wordStats.totalCharacters}</div>
						<div class="text-sm text-gray-600">Total Characters</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-green-600">{wordStats.contentWords}</div>
						<div class="text-sm text-gray-600">Content Words</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-purple-600">{wordStats.kanjiCount}</div>
						<div class="text-sm text-gray-600">Kanji Characters</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-orange-600">{wordStats.nounCount}</div>
						<div class="text-sm text-gray-600">Nouns</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- MeCab Token Analysis -->
		{#if mecabResult.length > 0}
			<div>
				<h3 class="mb-2 text-lg font-semibold">MeCab Token Analysis:</h3>
				<div class="overflow-x-auto">
					<table class="w-full border-collapse border border-gray-300">
						<thead>
							<tr class="bg-gray-100">
								<th class="border border-gray-300 px-2 py-1 text-left">Word</th>
								<th class="border border-gray-300 px-2 py-1 text-left">POS</th>
								<th class="border border-gray-300 px-2 py-1 text-left">Reading</th>
								<th class="border border-gray-300 px-2 py-1 text-left">Dictionary Form</th>
								<th class="border border-gray-300 px-2 py-1 text-left">Details</th>
							</tr>
						</thead>
						<tbody>
							{#each mecabResult as token}
								<tr>
									<td class="border border-gray-300 px-2 py-1 font-medium">{token.word}</td>
									<td class="border border-gray-300 px-2 py-1">{token.pos}</td>
									<td class="border border-gray-300 px-2 py-1">{token.reading || '-'}</td>
									<td class="border border-gray-300 px-2 py-1">{token.dictionary_form || '-'}</td>
									<td class="border border-gray-300 px-2 py-1 text-sm">
										{token.pos_detail1}{token.pos_detail2 !== '*' ? `, ${token.pos_detail2}` : ''}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</CardContent>
</Card>

<style>
	/* Ensure ruby text displays properly */
	:global(ruby) {
		ruby-align: center;
	}

	:global(rt) {
		font-size: 0.6em;
		line-height: 1;
		text-align: center;
	}
</style>
