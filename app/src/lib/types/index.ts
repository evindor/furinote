export interface JournalEntry {
	id: string;
	date: Date;
	title?: string;
	content: string;
	furiganaHtml?: string; // Cached furigana version for efficient display
	wordCount: number;
	kanjiCount: number;
	analyzed: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface TrackedWord {
	id: string;
	word: string;
	reading: string;
	frequency: number;
	firstSeen: Date;
	lastUsed: Date;
	entryIds: string[]; // References to entries containing this word
}

export interface MecabToken {
	word: string;
	pos: string;
	pos_detail1: string;
	pos_detail2: string;
	pos_detail3: string;
	conjugation1: string;
	conjugation2: string;
	dictionary_form: string;
	reading: string;
	pronunciation: string;
}

export interface AppSettings {
	showFurigana: boolean;
	autoSave: boolean;
	autoSaveInterval: number; // in milliseconds
	theme: 'light' | 'dark' | 'system';
	fontSize: 'small' | 'medium' | 'large';
}
