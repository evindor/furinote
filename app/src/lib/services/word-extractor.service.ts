import { furiganaService } from './furigana.service.js';
import { storageService } from './storage.service.js';
import { mecabService } from './mecab.service.js';
import type { TrackedWord, MecabToken } from '../types/index.js';

class WordExtractorService {
	/**
	 * Extract and track Japanese words from a journal entry using MeCab
	 */
	async extractAndTrackWords(entryId: string, content: string): Promise<TrackedWord[]> {
		if (!content.trim()) return [];

		try {
			// Analyze text with MeCab
			const tokens = await mecabService.analyze(content);

			// Extract content words (nouns, verbs, adjectives, etc.)
			const contentWords = mecabService.extractContentWords(tokens);

			if (contentWords.length === 0) return [];

			// Process each word and get readings
			const trackedWords: TrackedWord[] = [];

			for (const token of contentWords) {
				try {
					// Convert katakana reading to hiragana
					const reading = token.reading
						? mecabService.katakanaToHiragana(token.reading)
						: await furiganaService.convertToHiragana(token.word);

					// Create or update tracked word
					const trackedWord = await storageService.createOrUpdateWord({
						word: token.word,
						reading,
						frequency: 1,
						firstSeen: new Date(),
						lastUsed: new Date(),
						entryIds: [entryId]
					});

					trackedWords.push(trackedWord);
				} catch (error) {
					console.error(`Error processing word "${token.word}":`, error);
					// Continue with next word even if one fails
				}
			}

			return trackedWords;
		} catch (error) {
			console.error('Error extracting words with MeCab:', error);
			// Fallback to old method
			return this.extractAndTrackWordsLegacy(entryId, content);
		}
	}

	/**
	 * Legacy word extraction method as fallback
	 */
	private async extractAndTrackWordsLegacy(
		entryId: string,
		content: string
	): Promise<TrackedWord[]> {
		try {
			// Extract Japanese words using simple regex
			const japaneseWords = this.extractJapaneseWords(content);

			if (japaneseWords.length === 0) return [];

			// Process each word and get readings
			const trackedWords: TrackedWord[] = [];

			for (const word of japaneseWords) {
				try {
					// Get reading for the word
					const reading = await furiganaService.convertToHiragana(word);

					// Create or update tracked word
					const trackedWord = await storageService.createOrUpdateWord({
						word,
						reading,
						frequency: 1,
						firstSeen: new Date(),
						lastUsed: new Date(),
						entryIds: [entryId]
					});

					trackedWords.push(trackedWord);
				} catch (error) {
					console.error(`Error processing word "${word}":`, error);
					// Continue with next word even if one fails
				}
			}

			return trackedWords;
		} catch (error) {
			console.error('Error in legacy word extraction:', error);
			return [];
		}
	}

	/**
	 * Extract Japanese words from text using regex
	 */
	private extractJapaneseWords(text: string): string[] {
		// More sophisticated regex to match Japanese words
		// This includes hiragana, katakana, and kanji sequences
		const japaneseWordRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
		const matches = text.match(japaneseWordRegex);

		if (!matches) return [];

		// Filter and clean words
		const words = matches
			.map((word) => word.trim())
			.filter((word) => word.length > 0)
			.filter((word) => this.isValidJapaneseWord(word));

		// Remove duplicates
		return [...new Set(words)];
	}

	/**
	 * Check if a word is a valid Japanese word worth tracking
	 */
	private isValidJapaneseWord(word: string): boolean {
		// Filter out single hiragana characters (particles, etc.)
		if (word.length === 1 && this.isHiragana(word)) {
			return false;
		}

		// Filter out common particles and short function words
		const commonParticles = [
			'は',
			'が',
			'を',
			'に',
			'で',
			'と',
			'の',
			'も',
			'や',
			'か',
			'よ',
			'ね'
		];
		if (commonParticles.includes(word)) {
			return false;
		}

		// Must contain at least one kanji or be a meaningful kana word
		const hasKanji = /[\u4E00-\u9FAF]/.test(word);
		const isLongEnoughKana = word.length >= 2;

		return hasKanji || isLongEnoughKana;
	}

	/**
	 * Check if character is hiragana
	 */
	private isHiragana(char: string): boolean {
		const code = char.charCodeAt(0);
		return code >= 0x3040 && code <= 0x309f;
	}

	/**
	 * Check if character is katakana
	 */
	private isKatakana(char: string): boolean {
		const code = char.charCodeAt(0);
		return code >= 0x30a0 && code <= 0x30ff;
	}

	/**
	 * Check if character is kanji
	 */
	private isKanji(char: string): boolean {
		const code = char.charCodeAt(0);
		return code >= 0x4e00 && code <= 0x9faf;
	}

	/**
	 * Get word statistics for an entry using MeCab
	 */
	async getWordStatistics(content: string): Promise<{
		totalCharacters: number;
		japaneseCharacters: number;
		kanjiCount: number;
		hiraganaCount: number;
		katakanaCount: number;
		estimatedWords: number;
		contentWords: number;
		verbCount: number;
		nounCount: number;
		adjectiveCount: number;
	}> {
		const totalCharacters = content.length;
		let kanjiCount = 0;
		let hiraganaCount = 0;
		let katakanaCount = 0;

		for (const char of content) {
			if (this.isKanji(char)) {
				kanjiCount++;
			} else if (this.isHiragana(char)) {
				hiraganaCount++;
			} else if (this.isKatakana(char)) {
				katakanaCount++;
			}
		}

		const japaneseCharacters = kanjiCount + hiraganaCount + katakanaCount;

		try {
			// Use MeCab for more accurate word statistics
			const tokens = await mecabService.analyze(content);
			const mecabStats = mecabService.getWordStatistics(tokens);

			return {
				totalCharacters,
				japaneseCharacters,
				kanjiCount,
				hiraganaCount,
				katakanaCount,
				estimatedWords: mecabStats.totalTokens,
				contentWords: mecabStats.contentWords,
				verbCount: mecabStats.verbCount,
				nounCount: mecabStats.nounCount,
				adjectiveCount: mecabStats.adjectiveCount
			};
		} catch (error) {
			console.error('Error getting MeCab statistics, falling back to simple count:', error);
			// Fallback to simple word extraction
			const japaneseWords = this.extractJapaneseWords(content);

			return {
				totalCharacters,
				japaneseCharacters,
				kanjiCount,
				hiraganaCount,
				katakanaCount,
				estimatedWords: japaneseWords.length,
				contentWords: japaneseWords.length,
				verbCount: 0,
				nounCount: 0,
				adjectiveCount: 0
			};
		}
	}

	/**
	 * Update word tracking when an entry is modified
	 */
	async updateWordTracking(entryId: string, oldContent: string, newContent: string): Promise<void> {
		try {
			// For simplicity, we'll re-extract all words
			// In a more sophisticated implementation, we could diff the changes
			await this.extractAndTrackWords(entryId, newContent);
		} catch (error) {
			console.error('Error updating word tracking:', error);
		}
	}
}

// Create singleton instance
export const wordExtractorService = new WordExtractorService();
