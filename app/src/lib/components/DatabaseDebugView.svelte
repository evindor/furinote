<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { storageService } from '$lib/services/storage.service.js';
	import type { JournalEntry, TrackedWord } from '$lib/types/index.js';

	// State
	let entries = $state<JournalEntry[]>([]);
	let words = $state<TrackedWord[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		error = null;
		try {
			await storageService.init();
			const [entriesData, wordsData] = await Promise.all([
				storageService.getAllEntries(),
				storageService.getAllWords()
			]);
			entries = entriesData;
			words = wordsData;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load data';
			console.error('Error loading data:', err);
		} finally {
			isLoading = false;
		}
	}

	async function clearAllData() {
		if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
			return;
		}

		try {
			await storageService.clearAllData();
			entries = [];
			words = [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to clear data';
			console.error('Error clearing data:', err);
		}
	}

	async function exportData() {
		try {
			const data = await storageService.exportData();
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `kanjidesu-export-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to export data';
			console.error('Error exporting data:', err);
		}
	}

	async function deleteEntry(entryId: string) {
		if (!confirm('Are you sure you want to delete this entry?')) {
			return;
		}

		try {
			await storageService.deleteEntry(entryId);
			entries = entries.filter((entry) => entry.id !== entryId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete entry';
			console.error('Error deleting entry:', err);
		}
	}

	async function deleteWord(wordId: string) {
		if (!confirm('Are you sure you want to delete this word?')) {
			return;
		}

		try {
			await storageService.deleteWord(wordId);
			words = words.filter((word) => word.id !== wordId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete word';
			console.error('Error deleting word:', err);
		}
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleString();
	}

	function truncateText(text: string, maxLength: number = 100): string {
		return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center justify-between">
				<span>Database Debug View</span>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={loadData} disabled={isLoading}>
						{isLoading ? 'Loading...' : 'Refresh'}
					</Button>
					<Button variant="outline" size="sm" onclick={exportData}>Export Data</Button>
					<Button variant="destructive" size="sm" onclick={clearAllData}>Clear All Data</Button>
				</div>
			</CardTitle>
		</CardHeader>

		{#if error}
			<CardContent>
				<div class="rounded bg-red-50 p-3 text-sm text-red-500">
					Error: {error}
				</div>
			</CardContent>
		{/if}
	</Card>

	<!-- Statistics -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		<Card>
			<CardContent class="pt-6">
				<div class="text-2xl font-bold">{entries.length}</div>
				<p class="text-muted-foreground text-xs">Journal Entries</p>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="pt-6">
				<div class="text-2xl font-bold">{words.length}</div>
				<p class="text-muted-foreground text-xs">Tracked Words</p>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="pt-6">
				<div class="text-2xl font-bold">
					{words.reduce((sum, word) => sum + word.frequency, 0)}
				</div>
				<p class="text-muted-foreground text-xs">Total Word Usage</p>
			</CardContent>
		</Card>
	</div>

	<!-- Journal Entries -->
	<Card>
		<CardHeader>
			<CardTitle>Journal Entries ({entries.length})</CardTitle>
		</CardHeader>
		<CardContent>
			{#if isLoading}
				<div class="text-muted-foreground py-8 text-center">Loading entries...</div>
			{:else if entries.length === 0}
				<div class="text-muted-foreground py-8 text-center">No entries found</div>
			{:else}
				<div class="space-y-4">
					{#each entries as entry (entry.id)}
						<div class="space-y-2 rounded-lg border p-4">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<h4 class="font-medium">
										{entry.title || `Entry ${formatDate(entry.date)}`}
									</h4>
									<p class="text-muted-foreground text-sm">
										{truncateText(entry.content)}
									</p>
								</div>
								<Button variant="destructive" size="sm" onclick={() => deleteEntry(entry.id)}>
									Delete
								</Button>
							</div>

							<div class="text-muted-foreground flex gap-4 text-xs">
								<span>ID: {entry.id}</span>
								<span>Words: {entry.wordCount}</span>
								<span>Kanji: {entry.kanjiCount}</span>
								<span>Created: {formatDate(entry.createdAt)}</span>
								<span>Updated: {formatDate(entry.updatedAt)}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Tracked Words -->
	<Card>
		<CardHeader>
			<CardTitle>Tracked Words ({words.length})</CardTitle>
		</CardHeader>
		<CardContent>
			{#if isLoading}
				<div class="text-muted-foreground py-8 text-center">Loading words...</div>
			{:else if words.length === 0}
				<div class="text-muted-foreground py-8 text-center">No words found</div>
			{:else}
				<div class="space-y-2">
					{#each words as word (word.id)}
						<div class="flex items-center justify-between rounded border p-3">
							<div class="flex-1">
								<div class="flex items-center gap-3">
									<span
										class="text-lg font-medium"
										style="font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;"
									>
										{word.word}
									</span>
									<span class="text-muted-foreground text-sm">
										{word.reading}
									</span>
									<span class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
										×{word.frequency}
									</span>
								</div>
								<div class="text-muted-foreground mt-1 flex gap-4 text-xs">
									<span>ID: {word.id}</span>
									<span>First seen: {formatDate(word.firstSeen)}</span>
									<span>Last used: {formatDate(word.lastUsed)}</span>
									<span>Entries: {word.entryIds.length}</span>
								</div>
							</div>
							<Button variant="destructive" size="sm" onclick={() => deleteWord(word.id)}>
								Delete
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
