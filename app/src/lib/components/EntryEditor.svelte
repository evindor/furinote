<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { furiganaService } from '$lib/services/furigana.service.js';
	import { autoSaveService } from '$lib/services/auto-save.service.js';
	import type { JournalEntry } from '$lib/types/index.js';

	// Props
	interface Props {
		entry: JournalEntry | null;
		isOpen: boolean;
		onClose: () => void;
		onSave?: (entry: JournalEntry) => void;
	}

	let { entry, isOpen, onClose, onSave = () => {} }: Props = $props();

	// State
	let textareaElement: any;
	let furiganaHtml = $state('');
	let isGeneratingFurigana = $state(false);
	let lastContent = $state('');

	// Reactive effect for content changes
	$effect(() => {
		if (entry && entry.content !== lastContent) {
			lastContent = entry.content;
			handleContentChange();
		}
	});

	// Reset state when entry changes
	$effect(() => {
		if (entry) {
			lastContent = entry.content;
			if (entry.content) {
				generateFurigana();
			} else {
				furiganaHtml = '';
			}
		}
	});

	onMount(() => {
		// Focus textarea when editor opens
		if (isOpen && textareaElement) {
			setTimeout(() => textareaElement?.focus(), 300);
		}
	});

	onDestroy(() => {
		// Cancel any pending auto-saves when component is destroyed
		if (entry) {
			autoSaveService.cancelAutoSave(entry.id);
		}
	});

	async function handleContentChange() {
		if (!entry) return;

		// Update entry content
		entry.updatedAt = new Date();

		// Schedule auto-save
		autoSaveService.scheduleAutoSave(entry);

		// Generate furigana if content contains Japanese
		if (furiganaService.containsJapanese(entry.content)) {
			await generateFurigana();
		} else {
			furiganaHtml = '';
		}
	}

	async function generateFurigana() {
		if (!entry || !entry.content.trim()) {
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

	async function handleSave() {
		if (!entry) return;

		try {
			let savedEntry;
			if (entry.id) {
				// Existing entry - update it
				savedEntry = await autoSaveService.forceSave(entry);
			} else {
				// New entry - create it
				const { storageService } = await import('$lib/services/storage.service.js');
				savedEntry = await storageService.createEntry({
					date: entry.date,
					content: entry.content,
					wordCount: getWordCount(),
					kanjiCount: getKanjiCount(),
					analyzed: false,
					createdAt: new Date(),
					updatedAt: new Date()
				});
			}
			onSave(savedEntry);
			onClose();
		} catch (error) {
			console.error('Save failed:', error);
		}
	}

	function handleInput(event: Event) {
		if (!entry) return;
		const target = event.target as HTMLTextAreaElement;
		entry.content = target.value;
	}

	function getWordCount(): number {
		if (!entry) return 0;
		return entry.content
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
	}

	function getKanjiCount(): number {
		if (!entry) return 0;
		const kanjiRegex = /[\u4E00-\u9FAF]/g;
		const matches = entry.content.match(kanjiRegex);
		return matches ? matches.length : 0;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
		onclick={handleBackdropClick}
		style="animation: fadeIn 0.2s ease-out;"
	></div>

	<!-- Editor Panel -->
	<div
		class="fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-2xl"
		style="height: 85vh; animation: slideUp 0.3s ease-out;"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b p-4">
			<h2 class="text-lg font-semibold">
				{entry ? (entry.id ? 'Edit Entry' : 'New Entry') : 'Entry Editor'}
			</h2>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={handleSave}>Save</Button>
				<Button variant="ghost" size="sm" onclick={onClose}>Close</Button>
			</div>
		</div>

		{#if entry}
			<!-- Editor Content -->
			<div class="flex h-full">
				<!-- Left Side - Text Editor -->
				<div class="flex flex-1 flex-col">
					<div class="flex-1 p-4">
						<Textarea
							bind:this={textareaElement}
							value={entry.content}
							oninput={handleInput}
							placeholder="Start writing your journal entry in Japanese..."
							class="h-full resize-none border-0 text-lg leading-relaxed shadow-none focus-visible:ring-0"
							style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;"
						/>
					</div>

					<!-- Stats Footer -->
					<div class="border-t p-4">
						<div class="flex gap-4 text-sm text-muted-foreground">
							<span>{getWordCount()} words</span>
							<span>{getKanjiCount()} kanji</span>
							<span>{entry.content.length} characters</span>
							{#if autoSaveService.hasPendingSave(entry.id)}
								<span class="text-blue-600">Auto-saving...</span>
							{/if}
						</div>
					</div>
				</div>

				<!-- Separator -->
				<Separator orientation="vertical" class="h-full" />

				<!-- Right Side - Furigana Preview -->
				<div class="flex flex-1 flex-col">
					<div class="flex-1 overflow-y-auto p-4">
						{#if entry.content.trim()}
							{#if isGeneratingFurigana}
								<div class="flex h-full items-center justify-center text-muted-foreground">
									<div class="text-center">
										<div
											class="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
										></div>
										<div class="text-sm">Generating furigana...</div>
									</div>
								</div>
							{:else if furiganaHtml}
								<div
									class="furigana-preview text-lg leading-loose"
									style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; line-height: 2.5;"
								>
									{@html furiganaHtml}
								</div>
							{:else}
								<div
									class="text-lg leading-loose"
									style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; line-height: 2.5;"
								>
									{entry.content}
								</div>
							{/if}
						{:else}
							<div class="flex h-full items-center justify-center text-muted-foreground">
								<div class="text-center">
									<div class="mb-2 text-lg">✍️</div>
									<div class="text-sm">Start typing to see furigana preview</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	/* Ruby text styling for furigana */
	:global(.furigana-preview ruby) {
		ruby-align: center;
	}

	:global(.furigana-preview rt) {
		font-size: 0.6em;
		color: #666;
		font-weight: normal;
		line-height: 1;
		text-align: center;
	}

	/* Custom scrollbar for preview area */
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
