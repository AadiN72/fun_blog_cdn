#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

const pipedAnswers = process.stdin.isTTY
  ? null
  : fs.readFileSync(0, "utf8").split(/\r?\n/);
const rl = process.stdin.isTTY
  ? readline.createInterface({ input: process.stdin, output: process.stdout })
  : null;

function question(prompt) {
  if (!rl) {
    process.stdout.write(prompt);
    return Promise.resolve(pipedAnswers.shift() || "");
  }

  return new Promise((resolve) => rl.question(prompt, resolve));
}

try {
  console.log("\nFun Blog Manager\n");
  console.log("1. Generate draft");
  console.log("2. Publish draft");

  const choice = (await question("\nChoose an option: ")).trim();

  if (choice === "1") {
    const title = (await question("Enter a title: ")).trim();
    execFileSync(process.execPath, [
      path.join(__dirname, "generateDraft.js"),
      Date.now().toString(),
      title || "Untitled Draft",
    ], { cwd: repoRoot, stdio: "inherit" });
  } else if (choice === "2") {
    execFileSync(process.execPath, [path.join(__dirname, "publishDraft.js")], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  } else {
    console.error("Invalid option");
    process.exitCode = 1;
  }
} finally {
  rl?.close();
}