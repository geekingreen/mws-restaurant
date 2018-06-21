const STATIC_CACHE = 'mws-static-v1';
const IMG_CACHE = 'mws-img-v1';
const CACHES = [STATIC_CACHE, IMG_CACHE];

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
