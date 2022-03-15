const path = require("path");
const fs_async = require('fs/promises');
const { v4, uuidv4} = require('uuid')
const AdmZip = require('adm-zip');
const ffmpeg = require("fluent-ffmpeg");
const Database = require("better-sqlite3");
const fs = require("fs");
const {generateSHA256HashFromFile, verifyFileIsZip} = require("./image_utils");
const {createDirectory, getAlphabetizedEntriesFromZip} = require("./utility_belt");

class ThumbnailManager {
    /** @type {string} */
    ThumbnailDatabasePath

    /** @type {BetterSqlite3.Database} */
    ThumbnailDb

    /** @type {string} */
    ThumbnailPath

    constructor(dbFilePath, thumbnailPath) {
        this.ThumbnailDatabasePath = dbFilePath;
        this.ThumbnailPath = thumbnailPath;
    }

    async initialize() {
        this.ThumbnailDb = await this.getThumbnailDatabase(this.ThumbnailDatabasePath);
        await createDirectory(this.ThumbnailPath);
    }

    // Thumbnail Db [hash, imagepath, scenevariation]
    getThumbnailDatabase(dbFilePath) {
        const db = new Database(dbFilePath, {verbose: console.log});
        const createTable = "CREATE TABLE IF NOT EXISTS thumbnails ('hash' TEXT NOT NULL PRIMARY KEY, 'image' TEXT, 'scenevariation' REAL);"
        db.exec(createTable);
        return db;
    }

    /**
     *
     * @param {string} hash - Hash of the original file (cbr or mp4)
     * @param {string} imageFile - The root image file name (without the path)
     * @param {number} sceneVariation - Optional parameter
     * @returns {Database.RunResult}
     */
    upsertThumbnailToDb(hash, imageFile, sceneVariation= 0.0) {
        const stmt = this.ThumbnailDb.prepare("INSERT OR REPLACE INTO thumbnails (hash, image, scenevariation) VALUES (?, ?, ?)");
        const result = stmt.run(hash, imageFile, sceneVariation);
        return result;
    }

    /**
     * Uses SHA256 hash of filePath to check for db entry for the thumbnail
     * @param {string} hash
     * @returns {Promise<string|undefined>} - Absolute path to thumbnail or undefined if not found
     */
    async fetchThumbnailForFile(hash) {
        let thumbnailImagePath = undefined;

        const stmt = this.ThumbnailDb.prepare("SELECT image FROM thumbnails WHERE hash = ?");
        const row = stmt.get(hash);

        if (row) {
            const image = path.join(this.ThumbnailPath, row['image']);
            if (fs.existsSync(image)) {
                thumbnailImagePath = image;
            }
        }

        return thumbnailImagePath;
    }

    async generateThumbnailHash(filePath) {
        const hash = await generateSHA256HashFromFile(filePath);
        return hash;
    }

    /**
     * Generates a thumbnail in the specified path and adds it to the database.
     * This function is async and should not be awaited (on next browser refresh the thumbnail will be available).
     * @param fileHash - Hash used by the thumbnail database
     * @param filePath - absolute path to the cbr/mp4 file
     * @returns {Promise<string>} - Absolute file path to the thumbnail image
     */
    async generateThumbnail(fileHash, filePath) {
        const fileExt = path.extname(filePath).toLowerCase();
        let thumbnailBaseFile;
        let thumbnailFullFile;
        switch(fileExt) {
            case '.mp4':
                thumbnailBaseFile = await generateThumbnailForVideo(filePath, this.ThumbnailPath);
                break;
            case '.cbr':
            case '.cbz':
                thumbnailBaseFile = await generateThumbnailForCbr(filePath, this.ThumbnailPath);
                break;
            default:
                break;
        }

        if(thumbnailBaseFile && thumbnailBaseFile.trim().length > 0) {
            await this.upsertThumbnailToDb(fileHash, thumbnailBaseFile);
            thumbnailFullFile = path.join(this.ThumbnailPath, thumbnailBaseFile);
        }

        return thumbnailFullFile;
    }


}


/**
 *
 * @param vidFile - mp4 file
 * @param targetPath - Path where thumbnail should be stored
 * @returns {Promise<string>} - Thumbnail file name (excluding the path)
 */
async function generateThumbnailForVideo(vidFile, targetPath)
{
    return new Promise(((resolve, reject) => {
        // run ffmpeg and create thumbnail

        const thumbnailBaseFile = `${v4()}.jpg`;
        const thumbnailFullFile = path.join(targetPath, thumbnailBaseFile);

        // outputOptions [`-vf select='gt(scene\,${scenevariation})'`, "-frames:v 1" ]
        ffmpeg(vidFile, { logger: console.log })
            // deinterlace has been deprecated and replaced with bwdif since ffmpeg v5
            .outputOptions(["-filter:v bwdif=mode=send_field:parity=auto:deint=all", "-y", "-frames:v 1"])
            .output(thumbnailFullFile)
            .on('end', function (stdout, stderr) {
                console.log(`Transcoding succeeded of file ${this._currentOutput.target}!`);
                resolve(thumbnailBaseFile);
            })
            .on('error', (err, stdout, stderr) => {
                console.log(`an error occurred ${err}`);
                reject(err);
            })
            .run();
    }));
}

/**
 *
 * @param cbrFile - Must be a zip-compressed cbr/cbz file
 * @param targetPath - Path where thumbnail should be saved (with ext that is already used in the cbr file)
 * @returns {Promise<string>} - Thumbnail file name (excluding the path)
 */
async function generateThumbnailForCbr(cbrFile, targetPath)
{
    let error;
    let thumbnailBaseFile;
    if (await verifyFileIsZip(cbrFile)) {
        // reading archives
        const zip = new AdmZip(cbrFile);
        const zipEntries = getAlphabetizedEntriesFromZip(zip); // an array of ZipEntry records

        for(let zipEntry of zipEntries) {

            const zipExt = zipEntry.name.split('.').pop()?.toLowerCase();

            if(!zipEntry.isDirectory && ['jpg', 'png', 'gif', "jpeg"].includes (zipExt))
            {
                thumbnailBaseFile = `${v4()}.${zipExt}`;
                console.log(zipEntry.entryName);
                // extract this file to the current directory
                const zipStatus = zip.extractEntryTo(zipEntry, targetPath, false,
                    false, false, thumbnailBaseFile);

                if(!zipStatus) {
                    error = `Could not extract ${zipEntry.entryName}`;
                }

                break;
            }
        }

        if(!thumbnailBaseFile) {
            error = `No thumbnail could be created as no image file was found in the archive: ${cbrFile}`;
        }

        if (!error) {
            console.log(`Created thumbnail ${thumbnailBaseFile}`);
        }
    }
    else {
        error = `${cbrFile} is not a zip file`;
    }

    if(error) {
        throw new Error(error);
    }

    return thumbnailBaseFile;
}


module.exports = {
    ThumbnailManager
};