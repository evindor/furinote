import { writable } from 'svelte/store';
import { initializeStorage } from '$lib/services/storage.service.js';

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
			const errorMessage = error instanceof Error ? error.message : 'Failed to initialize database';
			initializationError.set(errorMessage);
			console.error('Failed to initialize database:', error);
			throw error;
		}
	})();

	return initializationPromise;
}
