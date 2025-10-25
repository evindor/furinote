import type { JournalEntry, TrackedWord } from '../types/index.js';

const DB_NAME = 'KanjiDesuDB';
const DB_VERSION = 3;
const ENTRIES_STORE = 'entries';
const WORDS_STORE = 'words';

class StorageService {
	private db: IDBDatabase | null = null;

	async init(): Promise<void> {
		return this.openDatabase();
	}

	private async openDatabase(retryCount = 0): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			console.log(DB_VERSION);

			request.onerror = () => {
				const error = request.error;

				// Handle version error - this happens when cached JS has lower version than DB
				if (error?.name === 'VersionError' && retryCount === 0) {
					console.warn(
						'Database version conflict detected. Clearing cache and recreating database...'
					);

					// Delete the database and retry
					const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
					deleteRequest.onsuccess = () => {
						console.log('Old database deleted. Recreating...');
						this.openDatabase(1).then(resolve).catch(reject);
					};
					deleteRequest.onerror = () => {
						reject(new Error('Failed to delete outdated database'));
					};
				} else {
					reject(error);
				}
			};

			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				const transaction = (event.target as IDBOpenDBRequest).transaction!;
				const oldVersion = event.oldVersion;

				// Create entries store
				if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
					const entriesStore = db.createObjectStore(ENTRIES_STORE, { keyPath: 'id' });
					entriesStore.createIndex('date', 'date', { unique: false });
					entriesStore.createIndex('createdAt', 'createdAt', { unique: false });
					entriesStore.createIndex('analyzed', 'analyzed', { unique: false });
				} else if (oldVersion < 2) {
					// Migration for version 2: add analyzed field to existing entries
					const entriesStore = transaction.objectStore(ENTRIES_STORE);

					// Add analyzed index if it doesn't exist
					if (!entriesStore.indexNames.contains('analyzed')) {
						entriesStore.createIndex('analyzed', 'analyzed', { unique: false });
					}

					// Update existing entries to have analyzed: false
					entriesStore.openCursor().onsuccess = (event) => {
						const cursor = (event.target as IDBRequest).result;
						if (cursor) {
							const entry = cursor.value;
							if (entry.analyzed === undefined) {
								entry.analyzed = false;
								cursor.update(entry);
							}
							cursor.continue();
						}
					};
				}

				// Create words store
				if (!db.objectStoreNames.contains(WORDS_STORE)) {
					const wordsStore = db.createObjectStore(WORDS_STORE, { keyPath: 'id' });
					wordsStore.createIndex('word', 'word', { unique: false });
					wordsStore.createIndex('frequency', 'frequency', { unique: false });
					wordsStore.createIndex('firstSeen', 'firstSeen', { unique: false });
				}
			};
		});
	}

	// Journal Entry CRUD operations
	async createEntry(entry: Omit<JournalEntry, 'id'>): Promise<JournalEntry> {
		if (!this.db) throw new Error('Database not initialized');

		const id = Math.random().toString(36);
		const newEntry: JournalEntry = { ...entry, id, analyzed: entry.analyzed ?? false };

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([ENTRIES_STORE], 'readwrite');
			const store = transaction.objectStore(ENTRIES_STORE);
			const request = store.add(newEntry);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(newEntry);
		});
	}

	async getEntry(id: string): Promise<JournalEntry | null> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([ENTRIES_STORE], 'readonly');
			const store = transaction.objectStore(ENTRIES_STORE);
			const request = store.get(id);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result || null);
		});
	}

	async getAllEntries(): Promise<JournalEntry[]> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([ENTRIES_STORE], 'readonly');
			const store = transaction.objectStore(ENTRIES_STORE);
			const index = store.index('createdAt');
			const request = index.getAll();

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const entries = request.result.sort(
					(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
				resolve(entries);
			};
		});
	}

	async updateEntry(entry: JournalEntry): Promise<JournalEntry> {
		if (!this.db) throw new Error('Database not initialized');

		const updatedEntry = { ...entry, updatedAt: new Date() };

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([ENTRIES_STORE], 'readwrite');
			const store = transaction.objectStore(ENTRIES_STORE);
			const request = store.put(updatedEntry);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(updatedEntry);
		});
	}

	async updateEntryFurigana(entryId: string, furiganaHtml: string): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const entry = await this.getEntry(entryId);
		if (!entry) throw new Error(`Entry with id ${entryId} not found`);

		const updatedEntry = { ...entry, furiganaHtml, updatedAt: new Date() };
		await this.updateEntry(updatedEntry);
	}

	async deleteEntry(id: string): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([ENTRIES_STORE], 'readwrite');
			const store = transaction.objectStore(ENTRIES_STORE);
			const request = store.delete(id);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	// Tracked Word CRUD operations
	async createOrUpdateWord(word: Omit<TrackedWord, 'id'>): Promise<TrackedWord> {
		if (!this.db) throw new Error('Database not initialized');

		// First, try to find existing word
		const existingWord = await this.getWordByText(word.word);

		if (existingWord) {
			// Update existing word
			const updatedWord: TrackedWord = {
				...existingWord,
				frequency: existingWord.frequency + 1,
				lastUsed: new Date(),
				entryIds: [...new Set([...existingWord.entryIds, ...word.entryIds])]
			};

			return new Promise((resolve, reject) => {
				const transaction = this.db!.transaction([WORDS_STORE], 'readwrite');
				const store = transaction.objectStore(WORDS_STORE);
				const request = store.put(updatedWord);

				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(updatedWord);
			});
		} else {
			// Create new word
			const id = Math.random().toString(36);
			const newWord: TrackedWord = { ...word, id, frequency: 1 };

			return new Promise((resolve, reject) => {
				const transaction = this.db!.transaction([WORDS_STORE], 'readwrite');
				const store = transaction.objectStore(WORDS_STORE);
				const request = store.add(newWord);

				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(newWord);
			});
		}
	}

	async getWordByText(wordText: string): Promise<TrackedWord | null> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([WORDS_STORE], 'readonly');
			const store = transaction.objectStore(WORDS_STORE);
			const index = store.index('word');
			const request = index.get(wordText);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result || null);
		});
	}

	async getAllWords(): Promise<TrackedWord[]> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([WORDS_STORE], 'readonly');
			const store = transaction.objectStore(WORDS_STORE);
			const request = store.getAll();

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const words = request.result.sort((a, b) => b.frequency - a.frequency);
				resolve(words);
			};
		});
	}

	async deleteWord(id: string): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([WORDS_STORE], 'readwrite');
			const store = transaction.objectStore(WORDS_STORE);
			const request = store.delete(id);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async updateWordWithJishoData(
		wordId: string,
		jishoData: import('../types/index.js').JishoData
	): Promise<TrackedWord> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([WORDS_STORE], 'readwrite');
			const store = transaction.objectStore(WORDS_STORE);

			// First get the existing word
			const getRequest = store.get(wordId);

			getRequest.onerror = () => reject(getRequest.error);
			getRequest.onsuccess = () => {
				const existingWord = getRequest.result;
				if (!existingWord) {
					reject(new Error('Word not found'));
					return;
				}

				// Update the word with Jisho data
				const updatedWord: TrackedWord = {
					...existingWord,
					jishoData
				};

				const putRequest = store.put(updatedWord);
				putRequest.onerror = () => reject(putRequest.error);
				putRequest.onsuccess = () => resolve(updatedWord);
			};
		});
	}

	// Utility methods
	async clearAllData(): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([ENTRIES_STORE, WORDS_STORE], 'readwrite');

			const entriesStore = transaction.objectStore(ENTRIES_STORE);
			const wordsStore = transaction.objectStore(WORDS_STORE);

			const clearEntries = entriesStore.clear();
			const clearWords = wordsStore.clear();

			transaction.onerror = () => reject(transaction.error);
			transaction.oncomplete = () => resolve();
		});
	}

	async exportData(): Promise<{ entries: JournalEntry[]; words: TrackedWord[] }> {
		const [entries, words] = await Promise.all([this.getAllEntries(), this.getAllWords()]);

		return { entries, words };
	}

	// Analysis-related methods
	async getUnanalyzedEntries(): Promise<JournalEntry[]> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([ENTRIES_STORE], 'readonly');
			const store = transaction.objectStore(ENTRIES_STORE);
			const request = store.getAll();

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const entries = request.result.filter((entry) => !entry.analyzed);
				resolve(entries);
			};
		});
	}

	async markEntryAsAnalyzed(entryId: string): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const entry = await this.getEntry(entryId);
		if (!entry) throw new Error('Entry not found');

		const updatedEntry = { ...entry, analyzed: true, updatedAt: new Date() };
		await this.updateEntry(updatedEntry);
	}

	async markEntryAsUnanalyzed(entryId: string): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const entry = await this.getEntry(entryId);
		if (!entry) throw new Error('Entry not found');

		const updatedEntry = { ...entry, analyzed: false, updatedAt: new Date() };
		await this.updateEntry(updatedEntry);
	}

	async resetDatabase(): Promise<void> {
		// Close existing connection
		if (this.db) {
			this.db.close();
			this.db = null;
		}

		// Delete the database
		return new Promise((resolve, reject) => {
			const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

			deleteRequest.onsuccess = () => {
				console.log('Database deleted successfully');
				resolve();
			};

			deleteRequest.onerror = () => {
				reject(new Error('Failed to delete database'));
			};
		});
	}
}

// Create singleton instance
export const storageService = new StorageService();

// Initialize storage persistence
export async function initializeStorage(): Promise<void> {
	await storageService.init();

	// Request persistent storage
	if ('storage' in navigator && 'persist' in navigator.storage) {
		const persistent = await navigator.storage.persist();
		console.log(`Persistent storage: ${persistent}`);
	}
}

// Reset database - useful for clearing cache issues
export async function resetDatabase(): Promise<void> {
	await storageService.resetDatabase();
}
