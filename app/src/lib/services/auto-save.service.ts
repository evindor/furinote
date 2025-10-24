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
		// Clear existing timeout for this entry
		const existingTimeout = this.saveTimeouts.get(entry.id);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Schedule new save
		const timeout = setTimeout(async () => {
			try {
				await this.saveEntry(entry);
				this.saveTimeouts.delete(entry.id);
				console.log(`Auto-saved entry: ${entry.id}`);
			} catch (error) {
				console.error('Auto-save failed:', error);
			}
		}, delay);

		this.saveTimeouts.set(entry.id, timeout);
	}

	/**
	 * Force immediate save of an entry (cancels any pending auto-save)
	 */
	async forceSave(entry: JournalEntry): Promise<JournalEntry> {
		// Cancel pending auto-save
		const existingTimeout = this.saveTimeouts.get(entry.id);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
			this.saveTimeouts.delete(entry.id);
		}

		return await this.saveEntry(entry);
	}

	/**
	 * Cancel auto-save for a specific entry
	 */
	cancelAutoSave(entryId: string): void {
		const existingTimeout = this.saveTimeouts.get(entryId);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
			this.saveTimeouts.delete(entryId);
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
	hasPendingSave(entryId: string): boolean {
		return this.saveTimeouts.has(entryId);
	}

	private async saveEntry(entry: JournalEntry): Promise<JournalEntry> {
		// Update word and kanji counts before saving
		const updatedEntry = {
			...entry,
			wordCount: this.countWords(entry.content),
			kanjiCount: this.countKanji(entry.content),
			updatedAt: new Date()
		};

		const savedEntry = await storageService.updateEntry(updatedEntry);

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
