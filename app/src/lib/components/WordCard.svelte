<script lang="ts">
	import type { TrackedWord, JournalEntry } from '$lib/types/index.js';
	import { storageService } from '$lib/services/storage.service.js';
	import { jishoService } from '$lib/services/jisho.service.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { onMount } from 'svelte';

	export let word: TrackedWord;
	export let fetchingDefinitions: Set<string>;

	let sampleEntry: JournalEntry | null = null;
	let isLoadingSample = false;

	onMount(async () => {
		await loadSampleEntry();
	});

	async function loadSampleEntry() {
		if (word.entryIds.length === 0) return;

		isLoadingSample = true;
		try {
			// Get a random entry ID from the word's entries
			const randomEntryId = word.entryIds[Math.floor(Math.random() * word.entryIds.length)];
			sampleEntry = await storageService.getEntry(randomEntryId);
		} catch (error) {
			console.error('Error loading sample entry:', error);
		} finally {
			isLoadingSample = false;
		}
	}

	async function fetchDefinition() {
		if (fetchingDefinitions.has(word.id)) return;

		fetchingDefinitions.add(word.id);
		fetchingDefinitions = fetchingDefinitions; // Trigger reactivity

		try {
			const jishoData = await jishoService.fetchDefinition(word.word);

			if (jishoData) {
				// Update the word in the database
				await storageService.updateWordWithJishoData(word.id, jishoData);

				// Update the local word object
				word = { ...word, jishoData };
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
</script>

<div class="space-y-4 bg-card p-6 text-card-foreground">
	<!-- Word and Reading -->
	<div class="space-y-2 text-center">
		<div class="text-3xl font-bold">{word.word}</div>
		<div class="text-lg text-muted-foreground">{word.reading}</div>
	</div>

	<!-- Sample Sentence -->
	<div class="text-center">
		{#if isLoadingSample}
			<div class="text-sm text-muted-foreground italic">Loading sample sentence...</div>
		{:else if sampleEntry?.furiganaHtml}
			<div class="border-l-2 border-muted pl-4 text-sm leading-relaxed italic">
				{@html sampleEntry.furiganaHtml}
			</div>
		{:else if sampleEntry?.content}
			<div class="border-l-2 border-muted pl-4 text-sm leading-relaxed italic">
				{sampleEntry.content}
			</div>
		{:else}
			<div class="text-sm text-muted-foreground italic">No sample sentence available</div>
		{/if}
	</div>

	<!-- Definition Section -->
	<div class="w-full">
		{#if word.jishoData}
			<div class="space-y-3">
				{#if word.jishoData.jlpt.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each word.jishoData.jlpt as level}
							<Badge variant="secondary" class="text-xs">
								{level.toUpperCase()}
							</Badge>
						{/each}
					</div>
				{/if}
				<div class="space-y-2">
					{#each word.jishoData.senses as sense, index}
						<div class="text-left">
							<div class="text-sm font-medium text-muted-foreground">
								{sense.parts_of_speech.join(', ')}
							</div>
							<div class="text-sm">
								{sense.english_definitions.join('; ')}
							</div>
						</div>
						{#if index < word.jishoData.senses.length - 1}
							<div class="border-t border-muted"></div>
						{/if}
					{/each}
				</div>
			</div>
		{:else}
			<Button
				variant="outline"
				class="w-full"
				onclick={fetchDefinition}
				disabled={fetchingDefinitions.has(word.id)}
			>
				{#if fetchingDefinitions.has(word.id)}
					Fetching Definition...
				{:else}
					Fetch Definition
				{/if}
			</Button>
		{/if}
	</div>

	<!-- Word Stats (small, bottom) -->
	<div
		class="flex items-center justify-between border-t border-muted pt-2 text-xs text-muted-foreground"
	>
		<div class="flex gap-3">
			<span>Frequency: {word.frequency}</span>
			<span>Entries: {word.entryIds.length}</span>
		</div>
		<div>
			Last used: {new Date(word.lastUsed).toLocaleDateString()}
		</div>
	</div>
</div>
