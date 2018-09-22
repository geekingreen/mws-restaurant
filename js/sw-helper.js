if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/service-worker.js', { scope: '/' })
    .then(reg => {
      if (!navigator.serviceWorker.controller) {
        return;
      }

      if (reg.waiting) {
        updateReady(reg.waiting);
        return;
      }

      if (reg.installing) {
        trackInstalling(reg.installing);
        return;
      }

      reg.addEventListener('updatefound', () => {
        trackInstalling(reg.installing);
      });
    })
    .catch(err => console.error(err));

  function updateReady(worker) {
    const shouldUpdate = confirm('Update available! Reload?');
    if (shouldUpdate) {
      worker.postMessage({ action: 'skipWaiting' });
      return;
    }
  }

  var refreshing = false;
  function trackInstalling(worker) {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        updateReady(worker);
      }

      if (worker.state === 'activated') {
        if (refreshing) {
          return;
        }
        window.location.reload();
        refreshing = true;
      }
    });
  }
}
