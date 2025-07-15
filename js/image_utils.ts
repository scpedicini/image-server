import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Generates a SHA256 hash from a file
 * @param filePath - Path to the file to hash
 * @returns SHA256 hash of the file as a hex string
 */
export async function generateSHA256HashFromFile(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const fileBuffer = await fs.readFile(filePath);
  hash.update(fileBuffer);
  return hash.digest('hex');
}

/**
 * Get all directories in a directory
 * @param srcPath - Path to the directory to search
 * @returns Array of directory names (not full paths)
 */
export async function getDirectories(srcPath: string): Promise<string[]> {
  const dirs = await fs.readdir(srcPath);

  const lstatObjs = await Promise.all(dirs.map(async dir => ({
    lstats: await fs.lstat(path.join(srcPath, dir)),
    path: dir
  })));

  return lstatObjs
    .filter(l => l.lstats.isDirectory())
    .map(l => l.path);
}

/**
 * Get list of files in a directory sorted by modification date
 * @param dir - Directory path
 * @param ascending - Sort ascending if true, descending if false
 * @returns List of filenames in the directory (without path)
 */
export async function readDirAsyncSortedByDate(dir: string, ascending = true): Promise<string[]> {
  const fileList = await fs.readdir(dir);

  const files = await Promise.all(fileList.map(async f => ({
    name: f,
    time: (await fs.stat(path.join(dir, f))).mtime.getTime()
  })));

  const sortedFiles = files
    .sort((a, b) => a.time - b.time)
    .map(v => v.name);

  return ascending ? sortedFiles : sortedFiles.reverse();
}

/**
 * Get list of files in a directory sorted alphabetically
 * @param dir - Directory path
 * @returns List of filenames in the directory (without path)
 */
export async function readDirAsyncSortedAlphabetically(dir: string): Promise<string[]> {
  return await fs.readdir(dir);
}

/**
 * Verify if a file is a zip file by checking its signature
 * @param filePath - Path to the file to check
 * @returns True if the file is a zip file, false otherwise
 */
export async function verifyFileIsZip(filePath: string): Promise<boolean> {
  const fileBuffer = await fs.readFile(filePath, { encoding: null });
  const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const fileSignature = fileBuffer.slice(0, 4);
  return fileSignature.equals(zipSignature);
}