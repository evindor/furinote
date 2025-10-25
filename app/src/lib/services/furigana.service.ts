import type { MecabToken } from '../types/index.js';
import { mecabService } from './mecab.service.js';
import * as wanakana from 'wanakana';

class FuriganaService {
	/**
	 * Convert katakana to hiragana using wanakana
	 */
	convertToHiragana(text: string): string {
		return wanakana.toHiragana(text);
	}

	/**
	 * Convert text to furigana using MeCab
	 */
	async convertToFurigana(text: string): Promise<string> {
		try {
			const tokens = await mecabService.analyze(text);
			return mecabService.generateFuriganaHTML(tokens);
		} catch (error) {
			console.error('Error converting to furigana with MeCab:', error);
			return text; // Return original text on error
		}
	}

	/**
	 * Convert text to romaji using wanakana
	 */
	convertToRomaji(text: string): string {
		return wanakana.toRomaji(text);
	}

	/**
	 * Extract Japanese words from text for tracking using MeCab
	 */
	async extractJapaneseWords(text: string): Promise<string[]> {
		try {
			const tokens = await mecabService.analyze(text);
			const contentWords = mecabService.extractContentWords(tokens);
			return [...new Set(contentWords.map((token) => token.word))];
		} catch (error) {
			console.error('Error extracting Japanese words with MeCab:', error);
			// Fallback to simple regex
			const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
			const matches = text.match(japaneseRegex);
			return matches ? [...new Set(matches)] : [];
		}
	}

	/**
	 * Check if text contains Japanese characters
	 */
	containsJapanese(text: string): boolean {
		const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
		return japaneseRegex.test(text);
	}

	/**
	 * Count kanji characters in text
	 */
	countKanji(text: string): number {
		const kanjiRegex = /[\u4E00-\u9FAF]/g;
		const matches = text.match(kanjiRegex);
		return matches ? matches.length : 0;
	}

	/**
	 * Generate furigana HTML with ruby tags using MeCab
	 */
	async generateFuriganaHTML(text: string): Promise<string> {
		try {
			const tokens = await mecabService.analyze(text);
			return mecabService.generateFuriganaHTML(tokens);
		} catch (error) {
			console.error('Error generating furigana HTML with MeCab:', error);
			return text; // Return original text on error
		}
	}
}

// Create singleton instance
export const furiganaService = new FuriganaService();
