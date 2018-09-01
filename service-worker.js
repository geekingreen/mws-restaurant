const STATIC_CACHE = 'mws-static-v1';
const IMG_CACHE = 'mws-img-v1';
const CACHES = [STATIC_CACHE, IMG_CACHE];
const RESTAURANT_DB = 'mws-restaurants';
const RESTAURANT_DB_STORE = 'restaurants';
const REVIEW_DB_STORE = 'reviews';
const RESTAURANT_DB_VERSION = 2;

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
  '/js/dbhelper.js',
  '/js/main.js',
  '/js/restaurant_info.js',
  '/js/sw-helper.js'
];

const responsify = value =>
  new Response(JSON.stringify(value), {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' }
  });

function openStore(storeName) {
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

      if (e.oldVersion < 2) {
        const reviewsStore = db.createObjectStore(REVIEW_DB_STORE, {
          keyPath: 'id'
        });

        reviewsStore.createIndex('restaurantId', 'restaurant_id', {
          unique: false
        });
      }
    };

    openRequest.onsuccess = () => {
      const db = openRequest.result;
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      resolve(store);
    };

    openRequest.onerror = reject;
  });
}

function fetchRestaurants(req) {
  const requestUrl = new URL(req.url);
  const matches = requestUrl.pathname.match(/(\d+)\/?$/);

  return new Promise((resolve, reject) => {
    fetch(req)
      .then(res => {
        resolve(res.clone());
        res.json().then(data => {
          const arr = matches ? [data] : data;
          openStore(RESTAURANT_DB_STORE).then(store => {
            arr.forEach(restaurant => store.put(restaurant));
          });
        });
      })
      .catch(() => {
        openStore(RESTAURANT_DB_STORE)
          .then(store => {
            const getRequest = matches
              ? store.get(Number(matches[1]))
              : store.getAll();
            getRequest.onsuccess = () => {
              resolve(responsify(getRequest.result));
            };
          })
          .catch(() => console.error('Cannot Open Store'));
      });
  });
}

function fetchReviews(req) {
  const requestUrl = new URL(req.url);
  const restaurantId = requestUrl.searchParams.get('restaurant_id');

  return new Promise((resolve, reject) => {
    fetch(req)
      .then(res => {
        resolve(res.clone());
        res.json().then(data => {
          openStore(REVIEW_DB_STORE).then(store => {
            data.forEach(review => store.put(review));
          });
        });
      })
      .catch(() => {
        openStore(REVIEW_DB_STORE).then(store => {
          store
            .index('restaurantId')
            .getAll(Number(restaurantId)).onsuccess = event => {
            const reviews = event.target.result;
            resolve(responsify(reviews));
          };
        });
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
    return e.respondWith(fetchRestaurants(e.request));
  }

  if (/^\/reviews/.test(requestUrl.pathname)) {
    return e.respondWith(fetchReviews(e.request));
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
