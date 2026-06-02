export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/serviceWorker.js', {
        scope: '/',
      });

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      return registration;
    } catch (error) {
      return null;
    }
  }

  console.warn('Service Workers not supported in this browser');
  return null;
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return registration.unregister();
    }
  }
  return false;
}
