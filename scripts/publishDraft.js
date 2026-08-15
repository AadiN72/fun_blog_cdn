#!/usr/bin/env node

/**
 * Publish a draft using the repo workflow:
 * 1. move images draft folder into /media/slug then git add /media/slug
 * 2. use octokit to get the githubusercontent urls for the images
 * 3. hydrate the markdown and move it to files
 * 4. git add and commit the markdown file to GitHub
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { Octokit } from "octokit";
import dotenv from "dotenv";
import readline from "readline/promises";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

const args = process.argv.slice(2);

async function promptForDraft() {
  const draftsDir = path.join(repoRoot, "drafts");
  const files = fs
    .readdirSync(draftsDir)
    .filter((file) => file.endsWith(".md"))
    .sort();

  if (files.length === 0) {
    console.error("No draft files found in drafts/");
    process.exit(1);
  }

  console.log("Select a draft to publish:\n");
  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file.replace(/\.md$/, "")}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question("\nChoose a draft number: ");
  rl.close();

  const selection = Number(answer.trim());
  const chosen = files[selection - 1];

  if (!chosen) {
    console.error("Invalid selection");
    process.exit(1);
  }

  return chosen.replace(/\.md$/, "");
}

let draftSlug = args[0];
if (!draftSlug) {
  draftSlug = await promptForDraft();
}

const githubConfig = {
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER,
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH || "main",
  mediaPath: process.env.GITHUB_MEDIA_PATH || "media",
};

if (!githubConfig.token) {
  console.error("Error: GITHUB_TOKEN not found in .env");
  process.exit(1);
}

if (!githubConfig.owner || !githubConfig.repo) {
  console.error("Error: GITHUB_OWNER or GITHUB_REPO not found in .env");
  process.exit(1);
}

const octokit = new Octokit({ auth: githubConfig.token });
const draftFile = path.join(repoRoot, "drafts", `${draftSlug}.md`);
const imagesDir = path.join(repoRoot, "drafts", `images-${draftSlug}`);
const publishedFile = path.join(repoRoot, "files", `${draftSlug}.md`);

function findImageLinks(content) {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches = [];
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    matches.push({
      alt: match[1],
      path: match[2],
      fullMatch: match[0],
    });
  }

  return matches;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getImageUrlsFromGitHub() {
  const mediaDir = path.join(repoRoot, "media", draftSlug);
  if (!fs.existsSync(mediaDir)) {
    return new Map();
  }

  const files = fs
    .readdirSync(mediaDir)
    .filter((file) => fs.statSync(path.join(mediaDir, file)).isFile());
  const imageUrls = new Map();

  for (const fileName of files) {
    const contentData = await octokit.rest.repos.getContent({
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      path: `${githubConfig.mediaPath}/${draftSlug}/${fileName}`,
      ref: githubConfig.branch,
    });

    const downloadUrl =
      contentData.data.download_url ||
      `https://raw.githubusercontent.com/${githubConfig.owner}/${githubConfig.repo}/${githubConfig.branch}/${githubConfig.mediaPath}/${draftSlug}/${fileName}`;

    imageUrls.set(fileName, downloadUrl);
  }

  return imageUrls;
}

function resolveImageSourceDir(content) {
  const imageLinks = findImageLinks(content);
  const candidates = [];

  for (const imageLink of imageLinks) {
    const localPath = imageLink.path.trim();
    if (!localPath || /^https?:\/\//i.test(localPath)) {
      continue;
    }

    const dirName = path.dirname(localPath).replace(/\\/g, "/");
    if (dirName && dirName !== ".") {
      candidates.push(path.join(repoRoot, "drafts", dirName));
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (fs.existsSync(imagesDir)) {
    return imagesDir;
  }

  const draftImageDirs = fs
    .readdirSync(path.join(repoRoot, "drafts"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("images-"))
    .map((entry) => path.join(repoRoot, "drafts", entry.name));

  if (draftImageDirs.length === 1) {
    return draftImageDirs[0];
  }

  return null;
}

function moveImagesIntoMedia(content) {
  const sourceDir = resolveImageSourceDir(content);

  if (!sourceDir || !fs.existsSync(sourceDir)) {
    return [];
  }

  const targetDir = path.join(repoRoot, "media", draftSlug);
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  fs.rmSync(sourceDir, { recursive: true, force: true });

  execSync(`git add media/${draftSlug}`, {
    cwd: repoRoot,
    stdio: "inherit",
  });

  return fs
    .readdirSync(targetDir)
    .filter((file) => fs.statSync(path.join(targetDir, file)).isFile());
}

function commitMediaBundle() {
  execSync(`git commit -m "Add media for ${draftSlug}"`, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  execSync("git push origin main", { cwd: repoRoot, stdio: "inherit" });
}

function finalizeGitPublish() {
  const status = execSync("git status --porcelain", {
    cwd: repoRoot,
    encoding: "utf-8",
  }).trim();

  if (!status) {
    return;
  }

  execSync("git add .", { cwd: repoRoot, stdio: "inherit" });
  execSync(`git commit -m "Publish ${draftSlug}"`, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  execSync("git push origin main", { cwd: repoRoot, stdio: "inherit" });
}

function hydrateMarkdown(content, imageUrls) {
  const imageLinks = findImageLinks(content);

  for (const imageLink of imageLinks) {
    const imageFileName = path.basename(imageLink.path);
    const cdnUrl = imageUrls.get(imageFileName);

    if (cdnUrl) {
      content = content.replace(
        new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegex(imageLink.path)}\\)`, "g"),
        `![$1](${cdnUrl})`,
      );
    }
  }

  return content;
}

async function publishDraft() {
  try {
    if (!fs.existsSync(draftFile)) {
      console.error(`Error: Draft file not found: ${draftFile}`);
      process.exit(1);
    }

    console.log(`\n📤 Publishing draft: ${draftSlug}\n`);

    let content = fs.readFileSync(draftFile, "utf-8");
    console.log("✓ Read draft file");

    const imageFiles = moveImagesIntoMedia(content);
    console.log(`✓ Moved images into media/${draftSlug}`);

    if (imageFiles.length > 0) {
      commitMediaBundle();
      console.log(`✓ Committed and pushed media bundle to GitHub`);
    }

    const imageUrls =
      imageFiles.length > 0 ? await getImageUrlsFromGitHub() : new Map();

    const hydratedContent = hydrateMarkdown(content, imageUrls);
    const filesDir = path.dirname(publishedFile);
    fs.mkdirSync(filesDir, { recursive: true });
    fs.writeFileSync(publishedFile, hydratedContent);
    console.log(`✓ Wrote hydrated markdown to ${publishedFile}`);

    finalizeGitPublish();
    console.log(`✓ Committed and pushed markdown to GitHub: ${draftSlug}`);

    fs.unlinkSync(draftFile);
    console.log(`✓ Deleted draft: ${draftFile}`);

    console.log(`\n✅ Successfully published draft: ${draftSlug}\n`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

publishDraft();
