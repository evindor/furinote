import { storageService } from './storage.service.js';
import { wordExtractorService } from './word-extractor.service.js';
import type { JournalEntry } from '../types/index.js';

class AnalysisService {
	/**
	 * Analyze a single entry for word extraction and tracking
	 */
	async analyzeEntry(entryId: string, force: boolean = false): Promise<void> {
		try {
			const entry = await storageService.getEntry(entryId);
			if (!entry) {
				throw new Error(`Entry with id ${entryId} not found`);
			}

			// Skip if already analyzed and not forcing
			if (entry.analyzed && !force) {
				return;
			}

			// Extract and track words from the entry
			await wordExtractorService.extractAndTrackWords(entryId, entry.content);

			// Mark entry as analyzed
			await storageService.markEntryAsAnalyzed(entryId);

			console.log(`Entry ${entryId} analyzed successfully`);
		} catch (error) {
			console.error(`Error analyzing entry ${entryId}:`, error);
			throw error;
		}
	}

	/**
	 * Analyze all unanalyzed entries
	 */
	async analyzeUnanalyzedEntries(): Promise<void> {
		try {
			const unanalyzedEntries = await storageService.getUnanalyzedEntries();

			console.log(`Found ${unanalyzedEntries.length} unanalyzed entries`);

			for (const entry of unanalyzedEntries) {
				await this.analyzeEntry(entry.id, false);
			}

			console.log('All unanalyzed entries processed');
		} catch (error) {
			console.error('Error analyzing unanalyzed entries:', error);
			throw error;
		}
	}

	/**
	 * Force reanalyze all entries (ignores analyzed flag)
	 */
	async forceReanalyzeAll(): Promise<void> {
		try {
			// Clear all existing words first
			await this.clearAllWords();

			const allEntries = await storageService.getAllEntries();

			console.log(`Force reanalyzing ${allEntries.length} entries`);

			for (const entry of allEntries) {
				// Mark as unanalyzed first
				await storageService.markEntryAsUnanalyzed(entry.id);
				// Then analyze
				await this.analyzeEntry(entry.id, true);
			}

			console.log('Force reanalysis completed');
		} catch (error) {
			console.error('Error during force reanalysis:', error);
			throw error;
		}
	}

	/**
	 * Analyze entry after it has been saved/updated
	 */
	async analyzeAfterSave(entry: JournalEntry): Promise<void> {
		try {
			// Mark as unanalyzed since content changed
			await storageService.markEntryAsUnanalyzed(entry.id);

			// Analyze the entry
			await this.analyzeEntry(entry.id, true);
		} catch (error) {
			console.error(`Error analyzing entry after save ${entry.id}:`, error);
			// Don't throw here to avoid breaking the save process
		}
	}

	/**
	 * Clear all tracked words (used before force reanalysis)
	 */
	private async clearAllWords(): Promise<void> {
		try {
			const allWords = await storageService.getAllWords();

			for (const word of allWords) {
				await storageService.deleteWord(word.id);
			}

			console.log('All tracked words cleared');
		} catch (error) {
			console.error('Error clearing words:', error);
			throw error;
		}
	}

	/**
	 * Get analysis statistics
	 */
	async getAnalysisStats(): Promise<{
		totalEntries: number;
		analyzedEntries: number;
		unanalyzedEntries: number;
		totalWords: number;
	}> {
		try {
			const [allEntries, unanalyzedEntries, allWords] = await Promise.all([
				storageService.getAllEntries(),
				storageService.getUnanalyzedEntries(),
				storageService.getAllWords()
			]);

			return {
				totalEntries: allEntries.length,
				analyzedEntries: allEntries.length - unanalyzedEntries.length,
				unanalyzedEntries: unanalyzedEntries.length,
				totalWords: allWords.length
			};
		} catch (error) {
			console.error('Error getting analysis stats:', error);
			return {
				totalEntries: 0,
				analyzedEntries: 0,
				unanalyzedEntries: 0,
				totalWords: 0
			};
		}
	}
}

// Create singleton instance
export const analysisService = new AnalysisService();
