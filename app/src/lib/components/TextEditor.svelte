<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { furiganaService } from '$lib/services/furigana.service.js';
	import { autoSaveService } from '$lib/services/auto-save.service.js';
	import type { JournalEntry } from '$lib/types/index.js';

	// Props
	interface Props {
		entry: JournalEntry;
		showFurigana?: boolean;
		onSave?: (entry: JournalEntry) => void;
	}

	let { entry, showFurigana = true, onSave = () => {} }: Props = $props();

	// State
	let textareaElement: any;
	let furiganaHtml = $state('');
	let isGeneratingFurigana = $state(false);
	let lastContent = $state(entry.content);

	// Reactive effect for content changes
	$effect(() => {
		if (entry.content !== lastContent) {
			lastContent = entry.content;
			handleContentChange();
		}
	});

	onMount(async () => {
		// Generate furigana if enabled and content exists
		if (showFurigana && entry.content) {
			await generateFurigana();
		}
	});

	onDestroy(() => {
		// Cancel any pending auto-saves when component is destroyed
		autoSaveService.cancelAutoSave(entry.id);
	});

	async function handleContentChange() {
		// Update entry content
		entry.updatedAt = new Date();

		// Schedule auto-save
		autoSaveService.scheduleAutoSave(entry);

		// Generate furigana if enabled
		if (showFurigana && furiganaService.containsJapanese(entry.content)) {
			await generateFurigana();
		}
	}

	async function generateFurigana() {
		if (!entry.content.trim()) {
			furiganaHtml = '';
			return;
		}

		isGeneratingFurigana = true;
		try {
			furiganaHtml = await furiganaService.generateFuriganaHTML(entry.content);
		} catch (error) {
			console.error('Error generating furigana:', error);
			furiganaHtml = entry.content; // Fallback to original text
		} finally {
			isGeneratingFurigana = false;
		}
	}

	async function handleManualSave() {
		try {
			const savedEntry = await autoSaveService.forceSave(entry);
			onSave(savedEntry);
		} catch (error) {
			console.error('Manual save failed:', error);
		}
	}

	function toggleFurigana() {
		showFurigana = !showFurigana;
		if (showFurigana && entry.content) {
			generateFurigana();
		}
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		entry.content = target.value;
	}

	function getWordCount(): number {
		return entry.content
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
	}

	function getKanjiCount(): number {
		const kanjiRegex = /[\u4E00-\u9FAF]/g;
		const matches = entry.content.match(kanjiRegex);
		return matches ? matches.length : 0;
	}
</script>

<Card class="mx-auto w-full max-w-4xl">
	<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
		<CardTitle class="text-2xl font-bold">
			{entry.title || `Entry - ${new Date(entry.date).toLocaleDateString()}`}
		</CardTitle>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={toggleFurigana}>
				{showFurigana ? 'Hide' : 'Show'} Furigana
			</Button>
			<Button variant="outline" size="sm" onclick={handleManualSave}>Save</Button>
		</div>
	</CardHeader>

	<CardContent class="space-y-4">
		<!-- Text Input Area -->
		<div class="relative">
			<Textarea
				bind:this={textareaElement}
				value={entry.content}
				oninput={handleInput}
				placeholder="Start writing your journal entry in Japanese..."
				class="min-h-[300px] resize-none text-lg leading-relaxed"
				style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;"
			/>

			<!-- Auto-save indicator -->
			{#if autoSaveService.hasPendingSave(entry.id)}
				<div
					class="text-muted-foreground bg-background absolute right-2 top-2 rounded px-2 py-1 text-xs"
				>
					Auto-saving...
				</div>
			{/if}
		</div>

		<!-- Furigana Display -->
		{#if showFurigana && entry.content.trim()}
			<div class="bg-muted/50 rounded-lg border p-4">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-muted-foreground text-sm font-medium">Furigana Preview</h3>
					{#if isGeneratingFurigana}
						<div class="text-muted-foreground text-xs">Generating...</div>
					{/if}
				</div>

				<div
					class="text-lg leading-loose"
					style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; line-height: 2.5;"
				>
					{@html furiganaHtml}
				</div>
			</div>
		{/if}

		<!-- Statistics -->
		<div class="text-muted-foreground flex gap-4 text-sm">
			<span>Words: {getWordCount()}</span>
			<span>Kanji: {getKanjiCount()}</span>
			<span>Characters: {entry.content.length}</span>
			<span>Last updated: {new Date(entry.updatedAt).toLocaleTimeString()}</span>
		</div>
	</CardContent>
</Card>

<style>
	/* Ruby text styling for furigana */
	:global(ruby) {
		ruby-align: center;
	}

	:global(rt) {
		font-size: 0.6em;
		color: #666;
		font-weight: normal;
	}

	/* Ensure proper line height for furigana */
	:global(.furigana-text) {
		line-height: 2.5;
	}
</style>
