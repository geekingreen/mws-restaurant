const STATIC_CACHE = 'mws-static-v1';
const IMG_CACHE = 'mws-img-v1';
const CACHES = [STATIC_CACHE, IMG_CACHE];
const RESTAURANT_DB = 'mws-restaurants';
const RESTAURANT_DB_STORE = 'restaurants';
const RESTAURANT_DB_VERSION = 1;

/*
  Using caddy web server and attempting to just store
  index.html was causing weird redirect issues with
  my service worker so I am duplicating the cache for
  / and /index.html which seems to resolve that issue.
*/
const DEFAULT_ASSETS = [
  '/',
  '/index.html',
  '/restaurant.html',
  '/css/styles.css',
  '/data/restaurants.json',
  '/js/dbhelper.js',
  '/js/main.js',
  '/js/restaurant_info.js',
  '/js/sw-helper.js'
];

function openRestaurantStore() {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(RESTAURANT_DB, RESTAURANT_DB_VERSION);

    openRequest.onupgradeneeded = e => {
      const db = openRequest.result;
      db.onerror = () => console.error('IndexedDB failed to upgrade');

      if (e.oldVersion < 1) {
        db.createObjectStore(RESTAURANT_DB_STORE, {
          keyPath: 'id'
        });
      }
    };

    openRequest.onsuccess = () => {
      const db = openRequest.result;
      const tx = db.transaction(RESTAURANT_DB_STORE, 'readwrite');
      const store = tx.objectStore(RESTAURANT_DB_STORE);
      resolve(store);
    };

    openRequest.onerror = reject;
  });
}

function fetchData(req) {
  return new Promise((resolve, reject) => {
    fetch(req)
      .then(res => {
        resolve(res.clone());
        res.json().then(data => {
          openRestaurantStore().then(store => {
            data.forEach(restaurant => store.put(restaurant));
          });
        });
      })
      .catch(() => {
        openRestaurantStore()
          .then(store => {
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => {
              resolve(
                new Response(JSON.stringify(getAllRequest.result), {
                  status: 200,
                  statusText: 'OK',
                  headers: { 'Content-Type': 'application/json' }
                })
              );
            };
          })
          .catch(() => console.error('Cannot Open Store'));
      });
  });
}

function fetchImage(req) {
  return caches.open(IMG_CACHE).then(cache =>
    cache.match(req.url).then(
      res =>
        res
          ? res
          : fetch(req).then(netRes => {
              cache.put(req.url, netRes.clone());
              return netRes;
            })
    )
  );
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(DEFAULT_ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => name.startsWith('mws-') && !CACHES.includes(name))
            .map(name => caches.delete(name))
        )
      )
  );
});

self.addEventListener('fetch', e => {
  const requestUrl = new URL(e.request.url);

  if (requestUrl.pathname.startsWith('/restaurant.html')) {
    return e.respondWith(caches.match('/restaurant.html'));
  }

  if (/^\/restaurants\/?(?:\d+)?/.test(requestUrl.pathname)) {
    return e.respondWith(fetchData(e.request));
  }

  if (requestUrl.pathname.startsWith('/img/')) {
    return e.respondWith(fetchImage(e.request));
  }

  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});

self.addEventListener('message', e => {
  if (e.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
