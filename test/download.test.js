import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import downloadGame from "../download.js";

const resetError = () => Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
const html = '<html><script>const game = true;\nstart();</script></html>';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fx-download-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, "latest.html"), "previous html");
  await fs.writeFile(path.join(directory, "latest.js"), "previous script");
  return directory;
}

function mockGet(outcomes) {
  let calls = 0;
  const get = (_url, callback) => {
    const request = new EventEmitter();
    request.destroy = (error) => request.emit("error", error);
    const outcome = outcomes[calls++];
    queueMicrotask(() => {
      if (outcome === "reset") return request.emit("error", resetError());
      if (outcome === "stall") return;
      const response = new PassThrough();
      response.statusCode = outcome?.status ?? 200;
      callback(response);
      if (outcome === "partial") {
        response.write("<script>incomplete");
        response.destroy(resetError());
      } else response.end(outcome?.html ?? html);
    });
    return request;
  };
  return { get, calls: () => calls };
}

for (const failure of ["reset", "partial", "stall", { status: 503 }]) {
  test(`retries a failed download (${JSON.stringify(failure)}) and saves the complete response`, async (t) => {
    const directory = await fixture(t);
    const mock = mockGet([failure, {}]);
    await downloadGame({ directory, get: mock.get, retryDelayMs: 0, timeoutMs: 50 });
    assert.equal(mock.calls(), 2);
    assert.equal(await fs.readFile(path.join(directory, "latest.html"), "utf8"), html);
    assert.equal(await fs.readFile(path.join(directory, "latest.js"), "utf8"), "const game = true;start();");
    assert.deepEqual((await fs.readdir(directory)).sort(), ["latest.html", "latest.js"]);
  });
}

test("stops after three connection failures and preserves existing files", async (t) => {
  const directory = await fixture(t);
  const mock = mockGet(["reset", "reset", "reset"]);
  await assert.rejects(downloadGame({ directory, get: mock.get, retryDelayMs: 0 }), /after 3 attempts: ECONNRESET/);
  assert.equal(mock.calls(), 3);
  assert.equal(await fs.readFile(path.join(directory, "latest.html"), "utf8"), "previous html");
  assert.equal(await fs.readFile(path.join(directory, "latest.js"), "utf8"), "previous script");
});

for (const invalid of ["<html>Server error</html>", "<script>  </script>", "<script>truncated"]) {
  test(`rejects invalid game HTML without overwriting files: ${invalid}`, async (t) => {
    const directory = await fixture(t);
    const mock = mockGet([{ html: invalid }]);
    await assert.rejects(downloadGame({ directory, get: mock.get }), /No game script found/);
    assert.equal(await fs.readFile(path.join(directory, "latest.html"), "utf8"), "previous html");
    assert.equal(await fs.readFile(path.join(directory, "latest.js"), "utf8"), "previous script");
  });
}
