import type { FuriganaToken } from '../types/index.js';

class FuriganaService {
	private kuroshiro: Kuroshiro | null = null;
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

			// Wait for scripts to load and check what's available on window
			await this.waitForScripts();

			// Debug: log all available properties on window
			console.log(
				'Available window properties:',
				Object.keys(window).filter((key) => key.toLowerCase().includes('kuro'))
			);
			console.log('window.Kuroshiro:', (window as any).Kuroshiro);
			console.log('window.KuromojiAnalyzer:', (window as any).KuromojiAnalyzer);

			// Access global objects directly
			const KuroshiroModule = (window as any).Kuroshiro;
			const Kuroshiro = KuroshiroModule.default || KuroshiroModule;
			const KuromojiAnalyzer = (window as any).KuromojiAnalyzer;

			if (!Kuroshiro) {
				throw new Error(
					'Kuroshiro not found on window object. Check if kuroshiro.min.js is loaded.'
				);
			}

			if (!KuromojiAnalyzer) {
				throw new Error(
					'KuromojiAnalyzer not found on window object. Check if kuroshiro-analyzer-kuromoji.min.js is loaded.'
				);
			}

			console.log('Creating Kuroshiro instance...');
			this.kuroshiro = new Kuroshiro();

			console.log('Creating KuromojiAnalyzer instance...');
			const analyzer = new KuromojiAnalyzer({
				dictPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/'
			});

			console.log('Initializing Kuroshiro with analyzer...');
			await this.kuroshiro!.init(analyzer);

			this.isInitialized = true;
			console.log('Kuroshiro initialized successfully');
		} catch (error) {
			console.error('Failed to initialize Kuroshiro:', error);
			throw error;
		}
	}

	private async waitForScripts(): Promise<void> {
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

	async convertToHiragana(text: string): Promise<string> {
		await this.init();
		if (!this.kuroshiro) throw new Error('Kuroshiro not initialized');

		try {
			return await this.kuroshiro.convert(text, { to: 'hiragana' });
		} catch (error) {
			console.error('Error converting to hiragana:', error);
			return text; // Return original text on error
		}
	}

	async convertToFurigana(text: string): Promise<string> {
		await this.init();
		if (!this.kuroshiro) throw new Error('Kuroshiro not initialized');

		try {
			return await this.kuroshiro.convert(text, {
				to: 'hiragana',
				mode: 'furigana'
			});
		} catch (error) {
			console.error('Error converting to furigana:', error);
			return text; // Return original text on error
		}
	}

	async convertToRomaji(text: string): Promise<string> {
		await this.init();
		if (!this.kuroshiro) throw new Error('Kuroshiro not initialized');

		try {
			return await this.kuroshiro.convert(text, { to: 'romaji' });
		} catch (error) {
			console.error('Error converting to romaji:', error);
			return text; // Return original text on error
		}
	}

	// Extract Japanese words from text for tracking
	extractJapaneseWords(text: string): string[] {
		// Simple regex to match Japanese characters (hiragana, katakana, kanji)
		const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
		const matches = text.match(japaneseRegex);
		return matches ? [...new Set(matches)] : [];
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

	// Generate furigana HTML with ruby tags
	async generateFuriganaHTML(text: string): Promise<string> {
		await this.init();
		if (!this.kuroshiro) throw new Error('Kuroshiro not initialized');

		try {
			// Convert to furigana format first
			const furiganaResult = await this.kuroshiro.convert(text, {
				to: 'hiragana',
				mode: 'furigana'
			});

			console.log('Kuroshiro furigana result:', furiganaResult);

			// Convert the result to proper HTML ruby tags
			return this.convertToRubyTags(furiganaResult);
		} catch (error) {
			console.error('Error generating furigana HTML:', error);
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
