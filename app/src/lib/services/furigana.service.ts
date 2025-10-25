import type { FuriganaToken, MecabToken } from '../types/index.js';
import { mecabService } from './mecab.service.js';

class FuriganaService {
	private kuroshiro: Kuroshiro | null = null;
	private isKuroshiroInitialized = false;
	private kuroshiroInitPromise: Promise<void> | null = null;

	/**
	 * Initialize Kuroshiro as fallback for katakana to hiragana conversion
	 */
	async initKuroshiro(): Promise<void> {
		if (this.isKuroshiroInitialized) return;
		if (this.kuroshiroInitPromise) return this.kuroshiroInitPromise;

		this.kuroshiroInitPromise = this._initializeKuroshiro();
		return this.kuroshiroInitPromise;
	}

	private async _initializeKuroshiro(): Promise<void> {
		try {
			// Check if we're in browser environment
			if (typeof window === 'undefined') {
				throw new Error('Window object not available (server-side rendering)');
			}

			// Wait for scripts to load
			await this.waitForKuroshiroScripts();

			// Access global objects directly
			const KuroshiroModule = (window as any).Kuroshiro;
			const Kuroshiro = KuroshiroModule.default || KuroshiroModule;
			const KuromojiAnalyzer = (window as any).KuromojiAnalyzer;

			if (!Kuroshiro || !KuromojiAnalyzer) {
				console.warn('Kuroshiro not available, using simple katakana to hiragana conversion');
				return;
			}

			console.log('Creating Kuroshiro instance...');
			this.kuroshiro = new Kuroshiro();

			console.log('Creating KuromojiAnalyzer instance...');
			const analyzer = new KuromojiAnalyzer({
				dictPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/'
			});

			console.log('Initializing Kuroshiro with analyzer...');
			await this.kuroshiro!.init(analyzer);

			this.isKuroshiroInitialized = true;
			console.log('Kuroshiro initialized successfully');
		} catch (error) {
			console.error('Failed to initialize Kuroshiro:', error);
			// Don't throw - we can fall back to simple conversion
		}
	}

	private async waitForKuroshiroScripts(): Promise<void> {
		return new Promise((resolve) => {
			// If scripts are already loaded, resolve immediately
			if ((window as any).Kuroshiro && (window as any).KuromojiAnalyzer) {
				resolve();
				return;
			}

			// Otherwise, wait a bit for scripts to load
			let attempts = 0;
			const maxAttempts = 50; // 5 seconds max
			const checkInterval = setInterval(() => {
				attempts++;
				if ((window as any).Kuroshiro && (window as any).KuromojiAnalyzer) {
					clearInterval(checkInterval);
					resolve();
				} else if (attempts >= maxAttempts) {
					clearInterval(checkInterval);
					resolve(); // Resolve anyway and let the main function handle the error
				}
			}, 100);
		});
	}

	/**
	 * Convert katakana to hiragana using Kuroshiro or simple mapping
	 */
	async convertToHiragana(text: string): Promise<string> {
		// Try using MeCab's simple conversion first
		const simpleConverted = mecabService.katakanaToHiragana(text);
		if (simpleConverted !== text) {
			return simpleConverted;
		}

		// Fall back to Kuroshiro if available
		try {
			await this.initKuroshiro();
			if (this.kuroshiro) {
				return await this.kuroshiro.convert(text, { to: 'hiragana' });
			}
		} catch (error) {
			console.error('Error converting to hiragana with Kuroshiro:', error);
		}

		return text; // Return original text if conversion fails
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

	async convertToRomaji(text: string): Promise<string> {
		try {
			await this.initKuroshiro();
			if (this.kuroshiro) {
				return await this.kuroshiro.convert(text, { to: 'romaji' });
			}
		} catch (error) {
			console.error('Error converting to romaji:', error);
		}
		return text; // Return original text on error
	}

	// Extract Japanese words from text for tracking using MeCab
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

	// Check if text contains Japanese characters
	containsJapanese(text: string): boolean {
		const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
		return japaneseRegex.test(text);
	}

	// Count kanji characters in text
	countKanji(text: string): number {
		const kanjiRegex = /[\u4E00-\u9FAF]/g;
		const matches = text.match(kanjiRegex);
		return matches ? matches.length : 0;
	}

	// Generate furigana HTML with ruby tags using MeCab
	async generateFuriganaHTML(text: string): Promise<string> {
		try {
			const tokens = await mecabService.analyze(text);
			return mecabService.generateFuriganaHTML(tokens);
		} catch (error) {
			console.error('Error generating furigana HTML with MeCab:', error);
			return text; // Return original text on error
		}
	}

	private segmentText(text: string): Array<{ text: string; isJapanese: boolean }> {
		const segments: Array<{ text: string; isJapanese: boolean }> = [];
		let currentSegment = '';
		let isCurrentJapanese = false;

		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			const isJapanese = this.containsJapanese(char);

			if (i === 0) {
				currentSegment = char;
				isCurrentJapanese = isJapanese;
			} else if (isJapanese === isCurrentJapanese) {
				currentSegment += char;
			} else {
				segments.push({ text: currentSegment, isJapanese: isCurrentJapanese });
				currentSegment = char;
				isCurrentJapanese = isJapanese;
			}
		}

		if (currentSegment) {
			segments.push({ text: currentSegment, isJapanese: isCurrentJapanese });
		}

		return segments;
	}

	private convertToRubyTags(furiganaText: string): string {
		// Convert Kuroshiro's furigana format to HTML ruby tags
		// Kuroshiro outputs format like: 漢字<ruby>かんじ</ruby> or 漢字(かんじ)

		let result = furiganaText;

		// Format 1: word(reading) - convert to <ruby>word<rt>reading</rt></ruby>
		result = result.replace(/([^\s\(\)<>]+)\(([^\)]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');

		// Format 2: word<ruby>reading</ruby> - convert to proper ruby format
		// Only match if it's not already in the correct format (doesn't have <rt> tags)
		result = result.replace(/([^\s<>]+)<ruby>([^<]+)<\/ruby>/g, (match, word, reading) => {
			// Check if this is already properly formatted
			if (match.includes('<rt>')) {
				return match; // Already properly formatted, don't change
			}
			return `<ruby>${word}<rt>${reading}</rt></ruby>`;
		});

		// Clean up any malformed ruby tags that might have empty rt elements
		result = result.replace(
			/<ruby>([^<]+)<rp><\/rp><rt><\/rt><rt>([^<]+)<\/rt><rp><\/rp><\/ruby>/g,
			'<ruby>$1<rt>$2</rt></ruby>'
		);
		result = result.replace(
			/<ruby>([^<]+)<rt><\/rt><rt>([^<]+)<\/rt><\/ruby>/g,
			'<ruby>$1<rt>$2</rt></ruby>'
		);

		// If no conversion happened, it might be plain text or already converted
		return result;
	}
}

// Create singleton instance
export const furiganaService = new FuriganaService();
