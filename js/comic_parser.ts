import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { getAlphabetizedEntriesFromZip } from './utility_belt.js';

/**
 * Converts a buffer to a base64 string
 * @param buffer - Buffer to convert
 * @returns Base64 string
 */
function convertBufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Creates an HTML img tag with an embedded base64 image
 * @param imgData - Base64 encoded image data
 * @param imgExt - Image extension (jpg, png, etc.)
 * @returns HTML img tag string
 */
const $embeddedImage = (imgData: string, imgExt: string): string => 
  `<img src="data:image/${imgExt};base64, ${imgData}" alt="" loading="lazy" class="aglightbox" data-gallery="picgallery">`;

/**
 * Builds an HTML comic viewer from a comic archive file
 * @param templateHtml - HTML template for the comic viewer
 * @param comicTitle - Title of the comic
 * @param physicalComicFile - Path to the comic archive file
 * @returns Complete HTML for the comic viewer
 */
export function buildComic(templateHtml: string, comicTitle: string, physicalComicFile: string): string {
  const zip = new AdmZip(physicalComicFile);
  const zipEntries = getAlphabetizedEntriesFromZip(zip);

  const $imgElements: string[] = [];

  for (let zipEntry of zipEntries) {
    const zipExt = zipEntry.name.split('.').pop()?.toLowerCase();

    if (!zipEntry.isDirectory && 
        zipExt && 
        ['jpg', 'png', 'gif', 'jpeg'].includes(zipExt)) {
      console.log(zipEntry.entryName);

      const fileBuffer = zip.readFile(zipEntry);
      if (fileBuffer) {
        const imgData = convertBufferToBase64(fileBuffer);
        const $img = $embeddedImage(imgData, zipExt);
        $imgElements.push($img);
      }
    }
  }

  const imgBlock = $imgElements.join('\n');
  let resultHtml = templateHtml.replace('{{COMICNAME}}', comicTitle);
  resultHtml = resultHtml.replace('{{CBRSTACK}}', imgBlock);

  return resultHtml;
}