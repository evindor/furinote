import { storageService } from './storage.service.js';
import { analysisService } from './analysis.service.js';
import type { JournalEntry } from '../types/index.js';

class AutoSaveService {
	private saveTimeouts = new Map<string, number>();
	private defaultDelay = 2000; // 2 seconds

	/**
	 * Schedule an auto-save for a journal entry with debouncing
	 */
	scheduleAutoSave(entry: JournalEntry, delay: number = this.defaultDelay): void {
		// Use a key that works for both new and existing entries
		const entryKey = entry.id || `temp-${entry.date.getTime()}`;

		// Clear existing timeout for this entry
		const existingTimeout = this.saveTimeouts.get(entryKey);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Schedule new save
		const timeout = setTimeout(async () => {
			try {
				const savedEntry = await this.saveEntry(entry);
				// Update the entry object with the new ID if it was created
				if (!entry.id && savedEntry.id) {
					entry.id = savedEntry.id;
				}
				this.saveTimeouts.delete(entryKey);
			} catch (error) {
				console.error('Auto-save failed:', error);
			}
		}, delay);

		this.saveTimeouts.set(entryKey, timeout);
	}

	/**
	 * Force immediate save of an entry (cancels any pending auto-save)
	 */
	async forceSave(entry: JournalEntry): Promise<JournalEntry> {
		// Cancel pending auto-save using the same key logic
		const entryKey = entry.id || `temp-${entry.date.getTime()}`;
		const existingTimeout = this.saveTimeouts.get(entryKey);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
			this.saveTimeouts.delete(entryKey);
		}

		const savedEntry = await this.saveEntry(entry);

		// Update the entry object with the new ID if it was created
		if (!entry.id && savedEntry.id) {
			entry.id = savedEntry.id;
		}

		return savedEntry;
	}

	/**
	 * Cancel auto-save for a specific entry
	 */
	cancelAutoSave(entryIdOrEntry: string | JournalEntry): void {
		let entryKey: string;
		if (typeof entryIdOrEntry === 'string') {
			entryKey = entryIdOrEntry;
		} else {
			entryKey = entryIdOrEntry.id || `temp-${entryIdOrEntry.date.getTime()}`;
		}

		const existingTimeout = this.saveTimeouts.get(entryKey);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
			this.saveTimeouts.delete(entryKey);
		}
	}

	/**
	 * Cancel all pending auto-saves
	 */
	cancelAllAutoSaves(): void {
		for (const [entryId, timeout] of this.saveTimeouts) {
			clearTimeout(timeout);
		}
		this.saveTimeouts.clear();
	}

	/**
	 * Get the number of pending auto-saves
	 */
	getPendingSaveCount(): number {
		return this.saveTimeouts.size;
	}

	/**
	 * Check if an entry has a pending auto-save
	 */
	hasPendingSave(entryIdOrEntry: string | JournalEntry): boolean {
		let entryKey: string;
		if (typeof entryIdOrEntry === 'string') {
			entryKey = entryIdOrEntry;
		} else {
			entryKey = entryIdOrEntry.id || `temp-${entryIdOrEntry.date.getTime()}`;
		}
		return this.saveTimeouts.has(entryKey);
	}

	private async saveEntry(entry: JournalEntry): Promise<JournalEntry> {
		// Update word and kanji counts before saving
		const updatedEntry = {
			...entry,
			wordCount: this.countWords(entry.content),
			kanjiCount: this.countKanji(entry.content),
			updatedAt: new Date()
		};

		let savedEntry: JournalEntry;

		if (entry.id) {
			// Existing entry - update it
			savedEntry = await storageService.updateEntry(updatedEntry);
		} else {
			// New entry - create it
			savedEntry = await storageService.createEntry({
				date: updatedEntry.date,
				content: updatedEntry.content,
				wordCount: updatedEntry.wordCount,
				kanjiCount: updatedEntry.kanjiCount,
				analyzed: false,
				createdAt: updatedEntry.createdAt || new Date(),
				updatedAt: updatedEntry.updatedAt
			});
		}

		// Trigger analysis after saving
		await analysisService.analyzeAfterSave(savedEntry);

		return savedEntry;
	}

	private countWords(text: string): number {
		// Simple word count - split by whitespace and filter empty strings
		return text
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
	}

	private countKanji(text: string): number {
		// Count kanji characters (Unicode range for CJK Unified Ideographs)
		const kanjiRegex = /[\u4E00-\u9FAF]/g;
		const matches = text.match(kanjiRegex);
		return matches ? matches.length : 0;
	}
}

// Create singleton instance
export const autoSaveService = new AutoSaveService();
