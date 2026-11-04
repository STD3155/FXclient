import assert from "node:assert/strict";
import test from "node:test";
import { clearClientCache } from "../src/clientCache.js";

test("cache cleanup keeps other applications' caches and service workers", async () => {
  const removedScopes = [];
  const deletedCaches = [];
  const scopes = ["https://example.test/", "https://example.test/FXclient/", "https://example.test/other/"];
  await clearClientCache({
    pageUrl: "https://example.test/FXclient/index.html?mode=team#lobby=abcde",
    serviceWorker: { async getRegistrations() {
      return scopes.map(scope => ({ scope, async unregister() { removedScopes.push(scope); } }));
    } },
    cacheStorage: {
      async keys() { return ["fxclient-123", "fxclient-456", "other-app-123"]; },
      async delete(key) { deletedCaches.push(key); }
    }
  });
  assert.deepEqual(removedScopes, ["https://example.test/FXclient/"]);
  assert.deepEqual(deletedCaches, ["fxclient-123", "fxclient-456"]);
});

test("cache cleanup also works without optional browser APIs", async () => {
  await clearClientCache({ pageUrl: "https://example.test/FXclient/" });
});
