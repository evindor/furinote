// Global declarations for browser-loaded Kuroshiro
declare global {
	interface Window {
		Kuroshiro: typeof Kuroshiro;
		KuromojiAnalyzer: typeof KuromojiAnalyzer;
	}

	class Kuroshiro {
		constructor();
		init(analyzer: any): Promise<void>;
		convert(text: string, options: ConvertOptions): Promise<string>;
	}

	class KuromojiAnalyzer {
		constructor(options?: { dictPath?: string });
	}

	interface ConvertOptions {
		to: 'hiragana' | 'katakana' | 'romaji' | 'furigana';
		mode?: 'normal' | 'spaced' | 'okurigana' | 'furigana';
		romajiSystem?: 'nippon' | 'passport' | 'hepburn';
		delimiter_start?: string;
		delimiter_end?: string;
	}
}

export {};
