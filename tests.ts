import fs from 'fs';
import fsAsync from 'fs/promises';
import AdmZip from 'adm-zip';
import path from 'path';

import { doesDirectoryExist, createDirectory } from './js/utility_belt.js';

/**
 * Checks if a file has a 7z signature
 * @param buffer - File buffer to check
 * @returns True if the file has a 7z signature
 */
function isFileSignature7z(buffer: Buffer): boolean {
  return buffer[0] === 0x37 && 
         buffer[1] === 0x7A && 
         buffer[2] === 0xBC && 
         buffer[3] === 0xAF && 
         buffer[4] === 0x27 && 
         buffer[5] === 0x1C;
}

/**
 * Checks if a file has a ZIP signature
 * @param buffer - File buffer to check
 * @returns True if the file has a ZIP signature
 */
function isFileSignatureZip(buffer: Buffer): boolean {
  return buffer[0] === 0x50 && 
         buffer[1] === 0x4B && 
         buffer[2] === 0x03 && 
         buffer[3] === 0x04;
}

/**
 * Loads a file into a buffer
 * @param filePath - Path to the file
 * @returns Buffer containing the file data
 */
function loadFileIntoBuffer(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

/**
 * Test function for ZIP file operations
 */
async function testZip(): Promise<void> {
  let filePath = './private/testzip.zip';
  let fileBuffer = loadFileIntoBuffer(filePath);
  let is7z = isFileSignature7z(fileBuffer);
  let isZip = isFileSignatureZip(fileBuffer);

  // Reading archives
  const zip = new AdmZip(filePath);
  const zipEntries = zip.getEntries();

  zipEntries.forEach(function (zipEntry) {
    console.log(zipEntry.toString());
  });

  console.log(`Is 7z: ${is7z}`);
  console.log(`Is ZIP: ${isZip}`);
}

/**
 * Main test function
 */
async function main(): Promise<void> {
  try {
    // Test directory creation
    let pathExists = await createDirectory('/users/Shaun/tmp/folder1');
    console.log(`Directory created: ${pathExists}`);

    // Add more tests here
    await testZip();
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the main test function
(async () => {
  await main();
})();