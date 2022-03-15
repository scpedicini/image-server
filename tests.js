const fs = require('fs');
const AdmZip = require("adm-zip");
const fs_async = require("fs/promises");
const path = require("path");

const { doesDirectoryExist, createDirectory} = require('./js/utility_belt');

// function extractFirstImageIntoMemoryFromZipFile(zipFile) {
//     let zip = new AdmZip(zipFile);
//     let zipEntries = zip.getEntries();
//     let zipEntry = zipEntries[0];
//     let zipEntryName = zipEntry.entryName;
//     let zipEntryData = zipEntry.getData();
//     let zipEntryDataBuffer = Buffer.from(zipEntryData);
//     return zipEntryDataBuffer;
// }

function isFileSignature7z(buffer) {
    return buffer[0] === 0x37 && buffer[1] === 0x7A && buffer[2] === 0xBC && buffer[3] === 0xAF && buffer[4] === 0x27 && buffer[5] === 0x1C;
}

function isFileSignatureZip(buffer) {
    return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
}

function loadFileIntoBuffer(filePath) {
    let fileBuffer = fs.readFileSync(filePath);
    return fileBuffer;
}

async function testZip()
{

    let filePath = './private/testzip.zip';
    let fileBuffer = loadFileIntoBuffer(filePath);
    let is7z = isFileSignature7z(fileBuffer);
    let isZip = isFileSignatureZip(fileBuffer);

    // reading archives
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries(); // an array of ZipEntry records

    zipEntries.forEach(function (zipEntry) {
        console.log(zipEntry.toString()); // outputs zip entries information
        // if (zipEntry.entryName == "my_file.txt") {
        //     console.log(zipEntry.getData().toString("utf8"));
        // }
    });


    console.log(is7z);
}





async function main() {
    let pathExists = await createDirectory('/users/Shaun/tmp/folder1');

    console.log(fileList);


}






(async () => {
    await main();
})();
