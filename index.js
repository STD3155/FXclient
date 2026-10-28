import downloadGame from "./download.js";
console.log("Building FX Client");
try {
  await downloadGame();
  await import("./build.js");
} catch (error) {
  console.error("Build failed:", error.message ?? error);
  process.exitCode = 1;
}
