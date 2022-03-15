const AdmZip = require("adm-zip");
const fs_async = require('fs').promises;

async function doesDirectoryExist(path) {
    try {
        let stats = await fs_async.stat(path);
        return stats.isDirectory();
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
}

async function createDirectory(path) {
    try {
        await fs_async.mkdir(path);
    } catch (err) {
        if (err.code === 'EEXIST') {
            return;
        }
        throw err;
    }
}

function stripQueryStringFromUrl(url) {
    return url.split('?').shift();
}

/**
 *
 * @param admZip
 * @returns {Array}
 */
function getAlphabetizedEntriesFromZip(admZip) {
    const zipEntries = admZip.getEntries(); // an array of ZipEntry records

    // sort alphanumerically
    zipEntries.sort(function(a, b) {
        return a.entryName.localeCompare(b.entryName, undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    });

    return zipEntries;
}

module.exports = {
    doesDirectoryExist,
    createDirectory,
    stripQueryStringFromUrl,
    getAlphabetizedEntriesFromZip
};