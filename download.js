import https from "node:https";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const GAME_URL = "https://territorial.io";
const MAX_ATTEMPTS = 3;

function downloadHtml(get, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = get(GAME_URL, async (response) => {
      response.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      try {
        if (response.statusCode !== 200) {
          response.destroy();
          throw new Error(`HTTP ${response.statusCode} from ${GAME_URL}`);
        }
        response.setEncoding("utf8");
        let html = "";
        for await (const chunk of response) html += chunk;
        resolve(html);
      } catch (error) {
        reject(error);
      } finally {
        clearTimeout(timeout);
      }
    });
    // Cover connection setup and the entire response, including stalled bodies.
    const timeout = setTimeout(() => {
      request.destroy(new Error(`Download timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    request.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export default async function downloadGame({
  directory = "./game",
  get = https.get,
  retryDelayMs = 1000,
  timeoutMs = 30_000
} = {}) {
  let html;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      html = await downloadHtml(get, timeoutMs);
      break;
    } catch (error) {
      const reason = error.code ? `${error.code}: ${error.message}` : error.message;
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`Could not download ${GAME_URL} after ${MAX_ATTEMPTS} attempts: ${reason}`, { cause: error });
      }
      console.warn(`Game download failed (${attempt}/${MAX_ATTEMPTS}): ${reason}. Retrying...`);
      await delay(retryDelayMs * attempt);
    }
  }

  const script = /<script>\s*([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!script?.trim()) throw new Error(`No game script found in the response from ${GAME_URL}`);

  // Replace existing files only after downloading and validating the response.
  await fs.mkdir(directory, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(directory, ".download-"));
  try {
    await fs.writeFile(path.join(temporary, "latest.html"), html);
    await fs.writeFile(path.join(temporary, "latest.js"), script.replace(/\r?\n|\r/g, ""));
    await fs.rename(path.join(temporary, "latest.html"), path.join(directory, "latest.html"));
    await fs.rename(path.join(temporary, "latest.js"), path.join(directory, "latest.js"));
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
  console.log("Downloaded game to game/latest.html and game/latest.js");
}
