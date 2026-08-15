#!/usr/bin/env node

/**
 * Script to generate draft markdown files with correct frontmatter
 * Usage: node generateDraft.js [timestamp] [title]
 *
 * Examples:
 *   node generateDraft.js                                    (uses current time, default title)
 *   node generateDraft.js 1712016000000                      (uses provided timestamp, default title)
 *   node generateDraft.js 1712016000000 "My Draft Title"     (uses both provided values)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get arguments
const args = process.argv.slice(2);
const timestamp = args[0] || Date.now().toString();
const title = args[1] || "Untitled Draft";

// Validate timestamp
if (!/^\d{13}$/.test(timestamp)) {
  console.error("Error: Timestamp must be a 13-digit millisecond timestamp");
  process.exit(1);
}

// Convert timestamp to date
const date = new Date(parseInt(timestamp));
const dateString = date.toISOString().split("T")[0]; // YYYY-MM-DD format

// Create filename and slug
const filename = `draft-${timestamp}.md`;
const slug = `draft-${timestamp}`;

// Create frontmatter
const frontmatter = `---
title: ${title}
slug: ${slug}
date: ${dateString}
---

`;

// Determine file path (relative to script location)
const filePath = path.join(__dirname, "..", "drafts", filename);
const imagesDir = path.join(__dirname, "..", "drafts", `images-${slug}`);

// Ensure files directory exists
const filesDir = path.dirname(filePath);
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
}

// Create images directory
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Write file
try {
  fs.writeFileSync(filePath, frontmatter);
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log(`✓ Created: ${filePath}`);
  console.log(`✓ Created: ${imagesDir}`);
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Date: ${dateString}`);
  console.log(`  Title: ${title}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
