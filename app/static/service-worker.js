const CACHE_NAME = 'kanjidesu-v1';
const STATIC_ASSETS = ['/', '/manifest.json', '/favicon.svg'];

// Install event - cache static assets
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => {
				console.log('Caching static assets');
				return cache.addAll(STATIC_ASSETS);
			})
			.then(() => {
				console.log('Service worker installed');
				return self.skipWaiting();
			})
	);
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (cacheName !== CACHE_NAME) {
							console.log('Deleting old cache:', cacheName);
							return caches.delete(cacheName);
						}
					})
				);
			})
			.then(() => {
				console.log('Service worker activated');
				return self.clients.claim();
			})
	);
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	// Skip chrome-extension and other non-http requests
	if (!event.request.url.startsWith('http')) {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			// Return cached version if available
			if (cachedResponse) {
				return cachedResponse;
			}

			// Otherwise fetch from network
			return fetch(event.request)
				.then((response) => {
					// Don't cache non-successful responses
					if (!response || response.status !== 200 || response.type !== 'basic') {
						return response;
					}

					// Clone the response for caching
					const responseToCache = response.clone();

					// Cache the response for future use
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
					});

					return response;
				})
				.catch(() => {
					// Return offline page or fallback for navigation requests
					if (event.request.mode === 'navigate') {
						return caches.match('/');
					}
					return new Response('Offline', { status: 503 });
				});
		})
	);
});

// Background sync for future features
self.addEventListener('sync', (event) => {
	if (event.tag === 'background-sync') {
		console.log('Background sync triggered');
		// Future: sync data when back online
	}
});

// Push notifications for future features
self.addEventListener('push', (event) => {
	if (event.data) {
		const data = event.data.json();
		console.log('Push notification received:', data);

		const options = {
			body: data.body || 'New notification from Kanji desu',
			icon: '/favicon.svg',
			badge: '/favicon.svg',
			tag: 'kanjidesu-notification',
			requireInteraction: false,
			actions: [
				{
					action: 'open',
					title: 'Open App'
				},
				{
					action: 'close',
					title: 'Close'
				}
			]
		};

		event.waitUntil(self.registration.showNotification(data.title || 'Kanji desu', options));
	}
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	if (event.action === 'open' || !event.action) {
		event.waitUntil(clients.openWindow('/'));
	}
});
