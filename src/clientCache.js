export async function clearClientCache({ serviceWorker, cacheStorage, pageUrl }) {
  const scope = new URL("./", pageUrl).href;
  if (serviceWorker) {
    const registrations = await serviceWorker.getRegistrations();
    await Promise.all(registrations
      .filter((registration) => registration.scope === scope)
      .map((registration) => registration.unregister()));
  }
  if (cacheStorage) {
    const keys = await cacheStorage.keys();
    await Promise.all(keys.filter((key) => key.startsWith("fxclient-"))
      .map((key) => cacheStorage.delete(key)));
  }
}
