const STATIC_CACHE = 'mws-static-v1';
const IMG_CACHE = 'mws-img-v1';
const CACHES = [STATIC_CACHE, IMG_CACHE];
const RESTAURANT_DB = 'mws-restaurants';
const RESTAURANT_DB_STORE = 'restaurants';
const REVIEW_DB_STORE = 'reviews';
const REQUEST_DB_STORE = 'requests';
const RESTAURANT_DB_VERSION = 3;

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

// Credit: https://serviceworke.rs/request-deferrer_service-worker_doc.html
const enqueueRequest = req =>
  serializeRequest(req).then(serializedRequest =>
    openStore(REQUEST_DB_STORE).then(
      store =>
        new Promise(resolve => {
          const localId = new Date().valueOf();
          store.put({ ...serializedRequest, localId }).onsuccess = () =>
            resolve(localId);
        })
    )
  );

// Credit: https://serviceworke.rs/request-deferrer_service-worker_doc.html
const flushQueue = () =>
  openStore(REQUEST_DB_STORE).then(store => {
    return new Promise(resolve => {
      store.getAll().onsuccess = event => {
        const requests = event.target.result;
        if (!requests.length) {
          resolve();
        }
        resolve(
          requests
            .reduce(
              (prevPromise, serializedRequest) =>
                prevPromise.then(() =>
                  deserializeRequest(serializedRequest).then(request =>
                    fetch(request)
                  )
                ),
              Promise.resolve()
            )
            .then(
              () =>
                new Promise(resolve => {
                  openStore(REQUEST_DB_STORE).then(store => {
                    store.clear();
                  });
                  openStore(REVIEW_DB_STORE).then(store => {
                    store.index('temp').openCursor().onsuccess = e => {
                      const cursor = e.target.result;
                      if (cursor) {
                        cursor.delete();
                        cursor.continue();
                      } else {
                        resolve();
                      }
                    };
                  });
                })
            )
        );
      };
    });
  });

// Credit: https://serviceworke.rs/request-deferrer_service-worker_doc.html
const serializeRequest = req => {
  const headers = {};

  for (let header of req.headers.entries()) {
    headers[header[0]] = header[1];
  }

  const serializedRequest = {
    url: req.url,
    headers,
    method: req.method,
    mode: req.mode,
    credentials: req.credentials,
    cache: req.cache,
    redirect: req.redirect,
    referrer: req.referrer
  };

  if (req.method === 'POST') {
    return req
      .clone()
      .text()
      .then(body => {
        serializedRequest.body = body;
        return Promise.resolve(serializedRequest);
      });
  }
  return Promise.resolve(serializedRequest);
};

// Credit: https://serviceworke.rs/request-deferrer_service-worker_doc.html
const deserializeRequest = data => Promise.resolve(new Request(data.url, data));

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

        reviewsStore.createIndex('temp', 'localId', {
          unique: false
        });
      }

      if (e.oldVersion < 3) {
        db.createObjectStore(REQUEST_DB_STORE, {
          keyPath: 'localId'
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
    const queueRequest = navigator.onLine
      ? flushQueue().then(() => fetch(req))
      : fetch(req.clone());
    queueRequest
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
        if (req.method === 'PUT') {
          enqueueRequest(req.clone()).then(() => {
            const requestUrl = new URL(req.url);
            const is_favorite = requestUrl.searchParams.get('is_favorite');
            openStore(RESTAURANT_DB_STORE).then(store => {
              store.get(Number(matches[1])).onsuccess = e => {
                const restaurant = {
                  ...e.target.result,
                  is_favorite
                };
                store.put(restaurant);
                resolve(responsify(restaurant));
              };
            });
          });
        } else {
          openStore(RESTAURANT_DB_STORE).then(store => {
            const getRequest = matches
              ? store.get(Number(matches[1]))
              : store.getAll();
            getRequest.onsuccess = () => resolve(responsify(getRequest.result));
          });
        }
      });
  });
}

function fetchReviews(req) {
  const requestUrl = new URL(req.url);
  const restaurantId = requestUrl.searchParams.get('restaurant_id');

  return new Promise(resolve => {
    const queueRequest = navigator.onLine
      ? flushQueue().then(() => fetch(req))
      : fetch(req.clone());
    queueRequest
      .then(res => {
        resolve(res.clone());
        res.json().then(data => {
          const reviews = Array.isArray(data) ? data : [data];
          openStore(REVIEW_DB_STORE).then(store => {
            reviews.forEach(review => store.put(review));
          });
        });
      })
      .catch(() => {
        if (req.method === 'POST') {
          enqueueRequest(req.clone()).then(localId => {
            req.json().then(review => {
              const reviewData = {
                ...review,
                createdAt: new Date().toISOString(),
                localId
              };
              openStore(REVIEW_DB_STORE).then(store => {
                store.put({ ...reviewData, id: localId }).onsuccess = () =>
                  resolve(responsify(reviewData));
              });
            });
          });
        } else {
          openStore(REVIEW_DB_STORE).then(store => {
            store
              .index('restaurantId')
              .getAll(Number(restaurantId)).onsuccess = event => {
              const reviews = event.target.result;
              resolve(responsify(reviews));
            };
          });
        }
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
