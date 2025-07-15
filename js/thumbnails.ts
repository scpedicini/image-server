import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import * as fsAsync from 'fs/promises';
import { generateSHA256HashFromFile, verifyFileIsZip } from './image_utils.js';
import { createDirectory, getAlphabetizedEntriesFromZip } from './utility_belt.js';
import { ThumbnailStorage } from './storage.js';

// Import SQLite
import Database from 'better-sqlite3';

/**
 * SQLite-based thumbnail storage implementation
 */
class SqliteThumbnailStorage implements ThumbnailStorage {
  private db: any;
  private dbPath: string;
  
  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }
  
  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath, { verbose: console.log });
      const createTable = "CREATE TABLE IF NOT EXISTS thumbnails ('hash' TEXT NOT NULL PRIMARY KEY, 'image' TEXT, 'scenevariation' REAL);";
      this.db.exec(createTable);
    } catch (err) {
      console.error('Failed to initialize SQLite storage:', err);
      throw err;
    }
  }
  
  async getImage(hash: string): Promise<string | undefined> {
    const stmt = this.db.prepare("SELECT image FROM thumbnails WHERE hash = ?");
    const row = stmt.get(hash) as { image: string } | undefined;
    return row?.image;
  }
  
  async saveImage(hash: string, imagePath: string, sceneVariation = 0): Promise<void> {
    const stmt = this.db.prepare("INSERT OR REPLACE INTO thumbnails (hash, image, scenevariation) VALUES (?, ?, ?)");
    stmt.run(hash, imagePath, sceneVariation);
  }
  
  async deleteAll(): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM thumbnails");
    stmt.run();
  }
}

export class ThumbnailManager {
  /** Path to the directory containing the thumbnail database */
  private thumbnailDatabasePath: string;

  /** Full path to the thumbnail database file */
  private thumbnailDatabaseFilePath: string;

  /** Storage implementation */
  private storage: ThumbnailStorage;

  /** Path to the directory storing thumbnails */
  private thumbnailPath: string;

  /** 
   * If true, use filename as hash for performance; 
   * If false, compute SHA256 hash of the file 
   */
  private cheatHash: boolean;

  /**
   * Creates a new ThumbnailManager instance
   * @param dbFilePath - Path to the SQLite database file
   * @param thumbnailPath - Path to store thumbnails
   * @param cheatHash - If true, use filename as hash for performance instead of SHA256
   */
  constructor(dbFilePath: string, thumbnailPath: string, cheatHash: boolean) {
    this.thumbnailDatabasePath = path.dirname(dbFilePath);
    this.thumbnailDatabaseFilePath = dbFilePath;
    this.thumbnailPath = thumbnailPath;
    this.cheatHash = cheatHash;
    
    // Create SQLite storage implementation
    try {
      this.storage = new SqliteThumbnailStorage(dbFilePath);
    } catch (err) {
      console.error('Failed to create SQLite storage:', err);
      throw new Error(`Failed to initialize SQLite database: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Initializes the thumbnail manager by opening the database and creating the thumbnail directory
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
    await createDirectory(this.thumbnailPath);
  }

  /**
   * Sets the hash mode to use filename as hash
   */
  setHashAsFileName(): void {
    this.cheatHash = true;
  }

  /**
   * Sets the hash mode to use SHA256 hash
   */
  setHashAsSHA256(): void {
    this.cheatHash = false;
  }

  /**
   * Deletes all thumbnails from the database and the filesystem
   */
  async deleteAllThumbnails(): Promise<void> {
    await this.storage.deleteAll();

    // Delete all files from thumbnail directory
    const files = (await fsAsync.readdir(this.thumbnailPath))
      .filter(x => ['.png', '.gif', '.jpg', '.jpeg'].includes(x.toLowerCase().slice(-4)));
    
    for (const file of files) {
      const filePath = path.join(this.thumbnailPath, file);
      await fsAsync.unlink(filePath);
    }
  }

  /**
   * Generates a hash for a file
   * @param relativeFilePath - Relative path to the file
   * @returns Hash of the file
   */
  async generateThumbnailHash(relativeFilePath: string): Promise<string> {
    if (this.cheatHash) {
      return relativeFilePath;
    } else {
      const fullPath = path.join(this.thumbnailDatabasePath, relativeFilePath);
      return await generateSHA256HashFromFile(fullPath);
    }
  }

  /**
   * Fetches a thumbnail for a file by its hash
   * @param hash - Hash of the file
   * @returns Full path to the thumbnail or undefined if not found
   */
  async fetchThumbnailForFile(hash: string): Promise<string | undefined> {
    const imageName = await this.storage.getImage(hash);
    
    if (imageName) {
      const imagePath = path.join(this.thumbnailPath, imageName);
      if (fs.existsSync(imagePath)) {
        return imagePath;
      }
    }
    
    return undefined;
  }

  /**
   * Generates a thumbnail for a file
   * @param fileHash - Hash used by the thumbnail database
   * @param filePath - Absolute path to the file
   * @returns Absolute path to the generated thumbnail or undefined
   */
  async generateThumbnail(fileHash: string, filePath: string): Promise<string | undefined> {
    const fileExt = path.extname(filePath).toLowerCase();
    let thumbnailBaseFile: string | undefined;
    let thumbnailFullFile: string | undefined;

    switch (fileExt) {
      case '.mp4':
        thumbnailBaseFile = await generateThumbnailForVideo(filePath, this.thumbnailPath);
        break;
      case '.cbr':
      case '.cbz':
        thumbnailBaseFile = await generateThumbnailForCbr(filePath, this.thumbnailPath);
        break;
      default:
        break;
    }

    if (thumbnailBaseFile && thumbnailBaseFile.trim().length > 0) {
      await this.storage.saveImage(fileHash, thumbnailBaseFile);
      thumbnailFullFile = path.join(this.thumbnailPath, thumbnailBaseFile);
    }

    return thumbnailFullFile;
  }
}

/**
 * Generates a thumbnail for a video file
 * @param vidFile - Path to the video file
 * @param targetPath - Path to store the thumbnail
 * @returns The filename of the generated thumbnail (without path)
 */
async function generateThumbnailForVideo(vidFile: string, targetPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const thumbnailBaseFile = `${uuidv4()}.jpg`;
    const thumbnailFullFile = path.join(targetPath, thumbnailBaseFile);

    // Cast console.log to any to avoid type conflicts with FfmpegCommandLogger
    const logger: any = console.log;
    
    ffmpeg(vidFile, { logger })
      .outputOptions(["-filter:v bwdif=mode=send_field:parity=auto:deint=all", "-y", "-frames:v 1"])
      .output(thumbnailFullFile)
      .on('end', function() {
        console.log(`Transcoding succeeded of file ${thumbnailFullFile}!`);
        resolve(thumbnailBaseFile);
      })
      .on('error', (err) => {
        console.log(`An error occurred: ${err}`);
        reject(err);
      })
      .run();
  });
}

/**
 * Generates a thumbnail for a comic book archive
 * @param cbrFile - Path to the comic book archive
 * @param targetPath - Path to store the thumbnail
 * @returns The filename of the generated thumbnail (without path)
 */
async function generateThumbnailForCbr(cbrFile: string, targetPath: string): Promise<string> {
  let error: string | undefined;
  let thumbnailBaseFile: string | undefined;

  if (await verifyFileIsZip(cbrFile)) {
    const zip = new AdmZip(cbrFile);
    const zipEntries = getAlphabetizedEntriesFromZip(zip);

    for (const zipEntry of zipEntries) {
      const zipExt = zipEntry.name.split('.').pop()?.toLowerCase();

      if (!zipEntry.isDirectory && 
          zipExt && 
          ['jpg', 'png', 'gif', 'jpeg'].includes(zipExt)) {
        thumbnailBaseFile = `${uuidv4()}.${zipExt}`;
        console.log(zipEntry.entryName);
        
        const zipStatus = zip.extractEntryTo(
          zipEntry.entryName, 
          targetPath, 
          false, // Don't maintain directory structure
          false, // Don't overwrite
          false, // Don't use strict extracting
          thumbnailBaseFile
        );

        if (!zipStatus) {
          error = `Could not extract ${zipEntry.entryName}`;
        }

        break;
      }
    }

    if (!thumbnailBaseFile) {
      error = `No thumbnail could be created as no image file was found in the archive: ${cbrFile}`;
    }

    if (!error) {
      console.log(`Created thumbnail ${thumbnailBaseFile}`);
    }
  } else {
    error = `${cbrFile} is not a zip file`;
  }

  if (error) {
    throw new Error(error);
  }

  return thumbnailBaseFile!;
}