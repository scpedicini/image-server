#!/usr/bin/env node

/**
 * Entry point for the ImageServer application
 * This file provides error handling and proper Node.js 22+ compatibility
 */

import { fileURLToPath } from 'url';
import path from 'path';
import startServer from "./server.js";

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Display banner
console.log("\n-----------------------------------------");
console.log("ImageServer - Media Gallery Application");
console.log("-----------------------------------------\n");

// Check Node.js version
const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0], 10);

if (majorVersion < 18) {
  console.error(`Error: Node.js version ${nodeVersion} is not supported.`);
  console.error("Please upgrade to Node.js 18 or later.");
  process.exit(1);
}

// Start the server with error handling
try {
  console.log(`Using Node.js ${nodeVersion}`);

  await startServer();
} catch (error) {
  console.error("Failed to start ImageServer:", error);

  // Handle common errors and provide helpful messages
  if (error instanceof Error) {
    if (error.message.includes('better-sqlite3')) {
      console.error("\nThere was an issue with the SQLite module. This is required for the application to run.");
      console.error("Make sure SQLite and its development libraries are installed on your system.");
    } else if (error.message.includes('fluent-ffmpeg')) {
      console.error("\nThere was an issue with the FFmpeg module.");
      console.error("Make sure FFmpeg is installed on your system.");
    }
  }

  process.exit(1);
}
