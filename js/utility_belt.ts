import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';

/**
 * Strips the query string from a URL
 * @param url - The URL to strip the query string from
 * @returns The URL without the query string
 */
export function stripQueryStringFromUrl(url: string): string {
  const questionMarkIndex = url.indexOf('?');
  if (questionMarkIndex !== -1) {
    return url.substring(0, questionMarkIndex);
  }
  return url;
}

/**
 * Checks if a directory exists
 * @param directoryPath - Path to the directory to check
 * @returns True if the directory exists, false otherwise
 */
export async function doesDirectoryExist(directoryPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(directoryPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Creates a directory if it doesn't exist
 * @param directoryPath - Path to the directory to create
 * @returns True if the directory was created or already exists, false otherwise
 */
export async function createDirectory(directoryPath: string): Promise<boolean> {
  if (await doesDirectoryExist(directoryPath)) {
    return true;
  }

  try {
    await fs.mkdir(directoryPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`Error creating directory ${directoryPath}:`, error);
    return false;
  }
}

/**
 * Gets all entries from a zip file and sorts them alphabetically
 * @param zip - AdmZip instance
 * @returns Array of zip entries sorted alphabetically by name
 */
export function getAlphabetizedEntriesFromZip(zip: AdmZip): AdmZip.IZipEntry[] {
  const entries = zip.getEntries();
  return entries.sort((a, b) => {
    return a.entryName.localeCompare(b.entryName, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  });
}