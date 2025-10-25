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
		entry?: JournalEntry | null;
		isOpen: boolean;
		onClose: () => void;
		onSave?: (entry: JournalEntry) => void;
		onDelete?: (entry: JournalEntry) => void;
	}

	let {
		entry = $bindable(),
		isOpen,
		onClose,
		onSave = () => {},
		onDelete = () => {}
	}: Props = $props();

	// State
	let textareaElement: any;
	let furiganaHtml = $state('');
	let isGeneratingFurigana = $state(false);
	let lastContent = $state('');

	// Visual viewport tracking for mobile keyboard handling
	let viewportHeight = $state('100vh');
	let viewportWidth = $state('100vw');

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

		// Set up visual viewport tracking for mobile keyboard handling
		updateViewport();

		if (typeof window !== 'undefined') {
			if (typeof window.visualViewport === 'undefined') {
				window.addEventListener('resize', updateViewport);
			} else if (window.visualViewport) {
				window.visualViewport.addEventListener('resize', updateViewport);
			}
		}
	});

	onDestroy(() => {
		// Cancel any pending auto-saves when component is destroyed
		if (entry) {
			autoSaveService.cancelAutoSave(entry);
		}

		// Clean up visual viewport event listeners
		if (typeof window !== 'undefined') {
			if (typeof window.visualViewport === 'undefined') {
				window.removeEventListener('resize', updateViewport);
			} else if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', updateViewport);
			}
		}
	});

	/**
	 * Update the viewport height and width values for mobile keyboard handling
	 */
	function updateViewport() {
		if (
			typeof window !== 'undefined' &&
			typeof document !== 'undefined' &&
			typeof document.documentElement !== 'undefined'
		) {
			if (typeof window.visualViewport === 'undefined' || !window.visualViewport) {
				viewportHeight = `${window.innerHeight}px`;
				viewportWidth = `${window.innerWidth}px`;

				document.documentElement.style.setProperty('--viewport-height', viewportHeight);
				document.documentElement.style.setProperty('--viewport-width', viewportWidth);
			} else {
				viewportHeight = `${window.visualViewport.height}px`;
				viewportWidth = `${window.visualViewport.width}px`;

				document.documentElement.style.setProperty('--viewport-height', viewportHeight);
				document.documentElement.style.setProperty('--viewport-width', viewportWidth);
			}
		}
	}

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
			// Always use forceSave which handles both new and existing entries properly
			const savedEntry = await autoSaveService.forceSave(entry);
			onSave(savedEntry);
			onClose();
		} catch (error) {
			console.error('Save failed:', error);
		}
	}

	async function handleDelete() {
		if (!entry) return;

		const confirmed = confirm(
			'Are you sure you want to delete this entry? This action cannot be undone.'
		);

		if (confirmed) {
			try {
				// Cancel any pending auto-saves
				autoSaveService.cancelAutoSave(entry);

				// Call the delete callback
				onDelete(entry);
				onClose();
			} catch (error) {
				console.error('Delete failed:', error);
			}
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
	<!-- Backdrop - only on mobile -->
	<div
		class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
		onclick={handleBackdropClick}
		style="animation: fadeIn 0.2s ease-out;"
	></div>

	<!-- Editor Panel -->
	<div
		class="fixed inset-0 z-50 bg-background shadow-2xl"
		style="animation: slideUp 0.3s ease-out; height: var(--viewport-height, 100vh);"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b p-2 md:p-4">
			<h2 class="text-lg font-semibold">
				{entry ? (entry.id ? 'Edit Entry' : 'New Entry') : 'Entry Editor'}
			</h2>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={handleSave}>Save</Button>
				{#if entry}
					<Button variant="destructive" size="sm" onclick={handleDelete}>Delete</Button>
				{/if}
				<Button variant="ghost" size="sm" onclick={onClose}>Close</Button>
			</div>
		</div>

		{#if entry}
			<!-- Editor Content Container -->
			<div class="flex h-[calc(var(--viewport-height,100vh)-120px)] flex-col md:flex-row">
				<!-- Text Editor -->
				<div class="flex h-[calc(var(--viewport-height,100vh)*0.4)] flex-1 flex-col md:h-full">
					<div class="flex-1 p-2 md:p-4">
						<Textarea
							bind:this={textareaElement}
							value={entry.content}
							oninput={handleInput}
							autofocus
							placeholder="Start writing your journal entry in Japanese..."
							class="h-full resize-none border-0 text-lg leading-relaxed shadow-none focus-visible:ring-0"
							style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;"
						/>
					</div>
				</div>

				<!-- Separator -->
				<Separator orientation="horizontal" class="md:hidden" />
				<Separator orientation="vertical" class="hidden h-full md:block" />

				<!-- Furigana Preview -->
				<div class="flex flex-1 flex-col">
					<div class="flex-1 overflow-y-auto p-2 md:p-4">
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
									class="furigana-preview md:vertical-text text-lg leading-loose"
									style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; line-height: 2.5;"
								>
									{@html furiganaHtml}
								</div>
							{:else}
								<div
									class="md:vertical-text text-lg leading-loose"
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

			<!-- Stats Footer - Inside editor on white background -->
			<div class="border-t bg-background p-3">
				<div
					class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
				>
					<div class="flex flex-wrap gap-4">
						<span>{getWordCount()} words</span>
						<span>{getKanjiCount()} kanji</span>
						<span>{entry.content.length} characters</span>
						{#if autoSaveService.hasPendingSave(entry)}
							<span class="text-blue-600">Auto-saving...</span>
						{/if}
					</div>
					<div class="text-right text-xs">
						<div>
							{entry.date.toLocaleDateString('en-US', {
								weekday: 'short',
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})}
						</div>
						<div>
							{entry.updatedAt.toLocaleTimeString('en-US', {
								hour: 'numeric',
								minute: '2-digit',
								hour12: true
							})}
						</div>
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

	/* Vertical text layout for desktop Japanese book style */
	@media (min-width: 768px) {
		:global(.vertical-text) {
			writing-mode: vertical-rl;
			text-orientation: mixed;
			height: 100%;
			overflow-x: auto;
			overflow-y: hidden;
			white-space: nowrap;
			direction: rtl;
		}

		:global(.vertical-text ruby) {
			ruby-position: over;
		}

		:global(.vertical-text rt) {
			font-size: 0.6em;
			color: #666;
			font-weight: normal;
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

	/* Horizontal scrollbar for vertical text */
	.overflow-x-auto::-webkit-scrollbar {
		height: 6px;
	}

	.overflow-x-auto::-webkit-scrollbar-track {
		background: transparent;
	}

	.overflow-x-auto::-webkit-scrollbar-thumb {
		background: hsl(var(--muted-foreground) / 0.3);
		border-radius: 3px;
	}

	.overflow-x-auto::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground) / 0.5);
	}
</style>
