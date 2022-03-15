
// More performant but can still be slow if the file is large
const fs_async = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

async function generateSHA256HashFromFile(filePath) {
    const hash = crypto.createHash('sha256');
    const fileBuffer = await fs_async.readFile(filePath);
    hash.update(fileBuffer);
    return hash.digest('hex');
}


/**
 * Get all directories in a directory
 * @param srcPath
 * @returns {Promise<string[]>} - Returns an array of directory names
 */
async function getDirectories(srcPath) {
    let dirs = await fs_async.readdir(srcPath);

    let lstat_objs = await Promise.all(dirs.map(async dir => ({
        lstats: await fs_async.lstat(path.join(srcPath, dir)),
        path: dir
    })));

    dirs = lstat_objs.filter(l => l.lstats.isDirectory()).map(l => l.path);

    return dirs;
}



/**
 * Get list of files in a directory
 * @param dir - directory path
 * @param ascending - sort ascending or descending
 * @returns {Promise<string[]>} - list of files in the directory (without path)
 */
async function readDirAsyncSortedByDate(dir, ascending = true) {
    let files = await fs_async.readdir(dir);

    files = await Promise.all(files.map(async f => ({
        name: f,
        time: (await fs_async.stat(dir + '/' + f)).mtime.getTime()
    })));

    files = files
        .sort((a, b) => a.time - b.time)
        .map(v => v.name);

    return ascending ? files : files.reverse();
}


async function readDirAsyncSortedAlphabetically(dir) {
    const files = await fs_async.readdir(dir);
    return files;
}


async function verifyFileIsZip(filePath) {
    const fileBuffer = await fs_async.readFile(filePath);
    const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const fileSignature = fileBuffer.slice(0, 4);
    return fileSignature.equals(zipSignature);
}



module.exports = {
    generateSHA256HashFromFile,
    readDirAsyncSortedByDate,
    readDirAsyncSortedAlphabetically,
    verifyFileIsZip,
    getDirectories
};