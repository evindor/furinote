import { writable } from 'svelte/store';
import { initializeStorage, resetDatabase } from '$lib/services/storage.service.js';

// Store to track initialization state
export const isInitialized = writable(false);
export const initializationError = writable<string | null>(null);

let initializationPromise: Promise<void> | null = null;

export async function ensureInitialized(): Promise<void> {
	// If already initialized, return immediately
	if (initializationPromise) {
		return initializationPromise;
	}

	// Create the initialization promise
	initializationPromise = (async () => {
		try {
			await initializeStorage();
			isInitialized.set(true);
			initializationError.set(null);
			console.log('Database initialized successfully');
		} catch (error) {
			let errorMessage = 'Failed to initialize database';

			if (error instanceof Error) {
				errorMessage = error.message;

				// Provide helpful message for version errors (cache issues)
				if (error.name === 'VersionError') {
					errorMessage =
						'Database version conflict detected. Please hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R) to clear the cache.';
					console.error(
						'Version conflict - likely due to cached JavaScript. Hard refresh recommended.'
					);
				}
			}

			initializationError.set(errorMessage);
			console.error('Failed to initialize database:', error);
			throw error;
		}
	})();

	return initializationPromise;
}

// Reset initialization state and database
export async function resetInitialization(): Promise<void> {
	initializationPromise = null;
	isInitialized.set(false);
	initializationError.set(null);
	await resetDatabase();
}
