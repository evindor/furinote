import type { MecabToken } from '../types/index.js';

class MecabService {
	private mecab: any = null;
	private isInitialized = false;
	private initPromise: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.isInitialized) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = this._initialize();
		return this.initPromise;
	}

	private async _initialize(): Promise<void> {
		try {
			// Check if we're in browser environment
			if (typeof window === 'undefined') {
				throw new Error('Window object not available (server-side rendering)');
			}

			// Wait for MeCab to load
			await this.waitForMecab();

			// Access MeCab from window
			this.mecab = (window as any).Mecab;

			if (!this.mecab) {
				throw new Error('MeCab not found on window object. Check if mecab-wasm is loaded.');
			}

			console.log('Waiting for MeCab to be ready...');
			await this.mecab.waitReady();

			this.isInitialized = true;
			console.log('MeCab initialized successfully');
		} catch (error) {
			console.error('Failed to initialize MeCab:', error);
			throw error;
		}
	}

	private async waitForMecab(): Promise<void> {
		return new Promise((resolve) => {
			// If MeCab is already loaded, resolve immediately
			if ((window as any).Mecab) {
				resolve();
				return;
			}

			// Otherwise, wait for it to load
			let attempts = 0;
			const maxAttempts = 100; // 10 seconds max
			const checkInterval = setInterval(() => {
				attempts++;
				if ((window as any).Mecab) {
					clearInterval(checkInterval);
					resolve();
				} else if (attempts >= maxAttempts) {
					clearInterval(checkInterval);
					resolve(); // Resolve anyway and let the main function handle the error
				}
			}, 100);
		});
	}

	async analyze(text: string): Promise<MecabToken[]> {
		await this.init();
		if (!this.mecab) throw new Error('MeCab not initialized');

		try {
			const result = this.mecab.query(text);
			console.log('MeCab analysis result:', result);
			return result as MecabToken[];
		} catch (error) {
			console.error('Error analyzing text with MeCab:', error);
			return [];
		}
	}

	/**
	 * Extract meaningful words from MeCab analysis
	 * Filters out particles, auxiliary verbs, and other non-content words
	 */
	extractContentWords(tokens: MecabToken[]): MecabToken[] {
		return tokens.filter((token) => {
			// Skip particles (助詞)
			if (token.pos === '助詞') return false;

			// Skip auxiliary verbs (助動詞)
			if (token.pos === '助動詞') return false;

			// Skip symbols and punctuation
			if (token.pos === '記号') return false;

			// Skip single character hiragana (usually particles)
			if (token.word.length === 1 && this.isHiragana(token.word)) return false;

			// Include nouns, verbs, adjectives, adverbs
			const contentPOS = ['名詞', '動詞', '形容詞', '副詞'];
			return contentPOS.includes(token.pos);
		});
	}

	/**
	 * Convert katakana reading to hiragana using simple character mapping
	 */
	katakanaToHiragana(katakana: string): string {
		return katakana.replace(/[\u30A1-\u30F6]/g, (char) => {
			const code = char.charCodeAt(0);
			return String.fromCharCode(code - 0x60);
		});
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
	 * Generate furigana HTML from MeCab tokens
	 */
	generateFuriganaHTML(tokens: MecabToken[]): string {
		return tokens
			.map((token) => {
				// If the word contains kanji and has a reading, add furigana
				if (this.containsKanji(token.word) && token.reading && token.reading !== token.word) {
					const hiraganaReading = this.katakanaToHiragana(token.reading);
					return `<ruby>${token.word}<rt>${hiraganaReading}</rt></ruby>`;
				}
				// Otherwise, just return the word
				return token.word;
			})
			.join('');
	}

	/**
	 * Check if text contains kanji
	 */
	private containsKanji(text: string): boolean {
		return /[\u4E00-\u9FAF]/.test(text);
	}

	/**
	 * Get word statistics from MeCab analysis
	 */
	getWordStatistics(tokens: MecabToken[]): {
		totalTokens: number;
		contentWords: number;
		kanjiWords: number;
		verbCount: number;
		nounCount: number;
		adjectiveCount: number;
	} {
		const contentWords = this.extractContentWords(tokens);

		return {
			totalTokens: tokens.length,
			contentWords: contentWords.length,
			kanjiWords: contentWords.filter((token) => this.containsKanji(token.word)).length,
			verbCount: tokens.filter((token) => token.pos === '動詞').length,
			nounCount: tokens.filter((token) => token.pos === '名詞').length,
			adjectiveCount: tokens.filter((token) => token.pos === '形容詞').length
		};
	}
}

// Create singleton instance
export const mecabService = new MecabService();
