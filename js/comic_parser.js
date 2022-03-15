const fs = require('fs');
const path = require('path');
const AdmZip = require("adm-zip");
const {getAlphabetizedEntriesFromZip} = require("./utility_belt");



function convertBufferToBase64(buffer) {
    return buffer.toString('base64');
}

const $embeddedImage = (imgData, imgExt) => `<img src="data:image/${imgExt};base64, ${imgData}" alt="" loading="lazy" class="aglightbox" data-gallery="picgallery">`;

function buildComic(templateHtml, comicTitle, physicalComicFile) {

    const zip = new AdmZip(physicalComicFile);
    const zipEntries = getAlphabetizedEntriesFromZip(zip);

    const $imgElements = [];


    for(let zipEntry of zipEntries) {

        const zipExt = zipEntry.name.split('.').pop()?.toLowerCase();

        if(!zipEntry.isDirectory && ['jpg', 'png', 'gif', "jpeg"].includes (zipExt))
        {
            console.log(zipEntry.entryName);

            const fileBuffer = zip.readFile(zipEntry);
            const imgData = convertBufferToBase64(fileBuffer);
            const $img = $embeddedImage(imgData, zipExt);

            $imgElements.push($img);
            // if($imgElements.length === 3)
            //     break;

        }
    }

    const imgBlock = $imgElements.join('\n');
    templateHtml = templateHtml.replace('{{COMICNAME}}', comicTitle);
    templateHtml = templateHtml.replace("{{CBRSTACK}}", imgBlock);

    return templateHtml;
}

module.exports = {
    buildComic
};





