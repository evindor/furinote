export interface JournalEntry {
	id: string;
	date: Date;
	title?: string;
	content: string;
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

export interface FuriganaToken {
	surface: string;
	reading: string;
	pronunciation: string;
	pos: string;
	pos_detail_1: string;
	pos_detail_2: string;
	pos_detail_3: string;
	conjugated_type: string;
	conjugated_form: string;
	basic_form: string;
	reading_form: string;
	pronunciation_form: string;
}

export interface AppSettings {
	showFurigana: boolean;
	autoSave: boolean;
	autoSaveInterval: number; // in milliseconds
	theme: 'light' | 'dark' | 'system';
	fontSize: 'small' | 'medium' | 'large';
}
