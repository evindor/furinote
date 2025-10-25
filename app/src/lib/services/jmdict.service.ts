import type { JishoData } from '../types/index.js';

interface JMDictEntry {
	id: string;
	kanji: Array<{
		common: boolean;
		text: string;
		tags: string[];
	}>;
	kana: Array<{
		common: boolean;
		text: string;
		tags: string[];
		appliesToKanji: string[];
	}>;
	sense: Array<{
		partOfSpeech: string[];
		appliesToKanji: string[];
		appliesToKana: string[];
		related: string[][];
		antonym: string[][];
		field: string[];
		dialect: string[];
		misc: string[];
		info: string[];
		languageSource: string[];
		gloss: Array<{
			lang: string;
			gender: string | null;
			type: string | null;
			text: string;
		}>;
	}>;
}

interface JMDictData {
	version: string;
	languages: string[];
	commonOnly: boolean;
	dictDate: string;
	dictRevisions: string[];
	tags: Record<string, string>;
	words: JMDictEntry[];
}

class JMDictService {
	private dictData: JMDictData | null = null;
	private isLoading = false;
	private loadPromise: Promise<void> | null = null;

	async loadDictionary(): Promise<void> {
		if (this.dictData) return;
		if (this.isLoading && this.loadPromise) return this.loadPromise;

		this.isLoading = true;
		this.loadPromise = this._loadDictionaryData();

		try {
			await this.loadPromise;
		} finally {
			this.isLoading = false;
		}
	}

	private async _loadDictionaryData(): Promise<void> {
		try {
			const response = await fetch('/jmdict-eng-3.6.1.json');
			if (!response.ok) {
				throw new Error(`Failed to load JMDict: ${response.status}`);
			}
			this.dictData = await response.json();
			console.log('JMDict loaded successfully');
		} catch (error) {
			console.error('Error loading JMDict:', error);
			throw error;
		}
	}

	async findDefinition(searchTerm: string): Promise<JishoData | null> {
		await this.loadDictionary();

		if (!this.dictData) {
			throw new Error('JMDict not loaded');
		}

		// Normalize search term
		const normalizedSearch = searchTerm.trim();
		if (!normalizedSearch) return null;

		// Search for exact matches in kanji and kana
		const entry = this.dictData.words.find((word) => {
			// Check kanji forms
			const kanjiMatch = word.kanji.some((k) => k.text === normalizedSearch);
			if (kanjiMatch) return true;

			// Check kana forms
			const kanaMatch = word.kana.some((k) => k.text === normalizedSearch);
			return kanaMatch;
		});

		if (!entry) return null;

		return this.convertToJishoData(entry);
	}

	private convertToJishoData(entry: JMDictEntry): JishoData {
		// Extract JLPT levels from misc tags
		const jlptLevels: string[] = [];
		entry.sense.forEach((sense) => {
			sense.misc.forEach((tag) => {
				if (tag.startsWith('jlpt-')) {
					const level = tag.replace('jlpt-', '').toUpperCase();
					if (!jlptLevels.includes(level)) {
						jlptLevels.push(level);
					}
				}
			});
		});

		// Convert senses to JishoData format
		const senses = entry.sense.map((sense) => ({
			english_definitions: sense.gloss.filter((g) => g.lang === 'eng').map((g) => g.text),
			parts_of_speech: sense.partOfSpeech.map((pos) => {
				// Convert JMDict part of speech tags to readable format
				return this.convertPartOfSpeech(pos);
			})
		}));

		return {
			jlpt: jlptLevels,
			senses: senses
		};
	}

	private convertPartOfSpeech(pos: string): string {
		// Map common JMDict part of speech tags to readable format
		const posMap: Record<string, string> = {
			n: 'Noun',
			v1: 'Ichidan verb',
			v5: 'Godan verb',
			v5k: 'Godan verb with ku ending',
			v5g: 'Godan verb with gu ending',
			v5s: 'Godan verb with su ending',
			v5t: 'Godan verb with tsu ending',
			v5n: 'Godan verb with nu ending',
			v5b: 'Godan verb with bu ending',
			v5m: 'Godan verb with mu ending',
			v5r: 'Godan verb with ru ending',
			v5u: 'Godan verb with u ending',
			'v5k-s': 'Godan verb - Iku/Yuku special class',
			v5aru: 'Godan verb - -aru special class',
			v5uru: 'Godan verb - Uru old class verb',
			'v5r-i': 'Godan verb with ru ending (irregular)',
			vk: 'Kuru verb - special class',
			vs: 'Suru verb',
			'vs-s': 'Suru verb - special class',
			'vs-i': 'Suru verb - included',
			vz: 'Ichidan verb - zuru verb',
			vn: 'Irregular nu verb',
			vr: 'Irregular ru verb',
			vi: 'Intransitive verb',
			vt: 'Transitive verb',
			'adj-i': 'I-adjective',
			'adj-na': 'Na-adjective',
			'adj-no': 'No-adjective',
			'adj-pn': 'Pre-noun adjectival',
			'adj-t': 'Taru-adjective',
			'adj-f': 'Noun or verb acting prenominally',
			adv: 'Adverb',
			'adv-to': 'Adverb taking the to particle',
			aux: 'Auxiliary',
			'aux-v': 'Auxiliary verb',
			'aux-adj': 'Auxiliary adjective',
			conj: 'Conjunction',
			cop: 'Copula',
			ctr: 'Counter',
			exp: 'Expression',
			int: 'Interjection',
			'n-adv': 'Adverbial noun',
			'n-suf': 'Noun, used as a suffix',
			'n-pref': 'Noun, used as a prefix',
			'n-t': 'Noun (temporal)',
			num: 'Numeric',
			pn: 'Pronoun',
			pref: 'Prefix',
			prt: 'Particle',
			suf: 'Suffix'
		};

		return posMap[pos] || pos;
	}

	// Method to search for multiple possible forms of a word
	async findDefinitionWithVariants(searchTerm: string): Promise<JishoData | null> {
		// Try exact match first
		let result = await this.findDefinition(searchTerm);
		if (result) return result;

		// If no exact match, try some common variations
		// Remove common okurigana endings for verbs/adjectives
		const variations = [
			searchTerm.replace(/[うくぐすつぬぶむるいきぎしちにびみりえけげせてねべめれ]$/, ''),
			searchTerm.replace(/[うくぐすつぬぶむるいきぎしちにびみりえけげせてねべめれ]{1,2}$/, '')
		];

		for (const variant of variations) {
			if (variant !== searchTerm && variant.length > 0) {
				result = await this.findDefinition(variant);
				if (result) return result;
			}
		}

		return null;
	}
}

// Create singleton instance
export const jmdictService = new JMDictService();
