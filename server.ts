import express, { Request, Response } from 'express';
import path from 'path';
import url from 'url';
import fs from 'fs';
import * as fsAsync from 'fs/promises';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AddressInfo } from 'net';
import { fileURLToPath } from 'url';

import { ThumbnailManager } from './js/thumbnails.js';
import { readDirAsyncSortedByDate, getDirectories } from './js/image_utils.js';
import { stripQueryStringFromUrl } from './js/utility_belt.js';
import { buildComic } from './js/comic_parser.js';

// Address authentication map for password protection
interface AddressAuthMap {
  [key: string]: boolean;
}

const addressAuth: AddressAuthMap = {};

// File extensions supported by the server
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
const VID_EXTS = ['mp4'];
const COMIC_EXTS = ['cbr', 'cbz'];
const HTML_EXTS = ['html', 'htm', 'xhtml'];

const DEVELOPER_MODE = true;

// Get the directory name of the current module for ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Starts the image server
 */
export default async function startServer(): Promise<void> {
  // Parse command line arguments
  const args = yargs(hideBin(process.argv))
    .usage('Usage: $0 --path [path] --port [port] --pass [password]')
    .option('path', {
      describe: 'Path to the directory to serve if omitted the current directory is used',
      type: 'string',
    })
    .option('port', {
      describe: 'Port to serve on if omitted the port 12345 is used',
      type: 'number',
    })
    .option('pass', {
      describe: 'Password to use if omitted the password is not required',
      type: 'string',
    })
    .option('clean-thumbnails', {
      describe: 'Clean thumbnails for all images in the directory',
      type: 'boolean',
    })
    .strict()
    .parseSync();

  const rootMediaPath = args.path || process.cwd();
  const serverPort = args.port || 12345;
  const serverPass = args.pass;
  const cleanThumbnails = args['clean-thumbnails'] || false;

  // Set up paths
  const THUMBNAIL_PATH = path.join(rootMediaPath, 'thumbnails');
  const DB_PATH = path.join(rootMediaPath, 'image-server.db3');
  const thumbnailManager = new ThumbnailManager(DB_PATH, THUMBNAIL_PATH, true);

  // HTML template helpers
  const aTag = (href: string, title: string): string => `<a href="${href}">${title}</a>`;

  const divImg = (img: string, originalPath: string): string => `
    <div class="image-container">
      <img src="${img}" alt="" loading="lazy" class="glightbox" data-gallery="picgallery">
      <button class="copy-path-btn" data-path="${originalPath.replace(/\\/g, '\\\\')}" onclick="copyFileNameToClipboard(event, '${originalPath.replace(/\\/g, '\\\\')}')">📋</button>
      <button class="copy-path-btn" data-path="${originalPath}" onclick="copyTrueFileToClipboard(event, '${originalPath}')">💾</button>
      <a href="/copy-file/${encodeURIComponent(originalPath)}" download class="copy-path-btn">📥</a>
    </div>
  `;

  const divVid = (vid: string, title: string, thumbnail: string): string => 
    `<a href="${vid}" class="glightbox" data-gallery="vidgallery"> <img src="${thumbnail}" alt="${title}"> </a>`;

  const divHtml5Video = (vid: string, title: string, thumbnail: string): string => 
    `<video playsinline controls preload="nothing"> <source src="${vid}" type="video/mp4"> </video>`;

  const divCbr = (cbr: string, title: string, thumbnail: string): string => 
    `<a href="${cbr}" class="comic-link"> <img src="${thumbnail}" alt="${title}" title="${title}"> </a>`;

  // Read template files
  const masterGalleryTemplateHtml = fs.readFileSync(path.join(__dirname, 'gallery_template.html'), 'utf8');
  const comicTemplateHtml = fs.readFileSync(path.join(__dirname, 'comic_template.html'), 'utf8');

  // Express app setup
  const app = express();
  app.use(express.json());

  /**
   * Creates an HTML response for directory browsing, comic viewing, or video library
   */
  async function createHtmlResponse(
    req: Request, 
    res: Response, 
    isVideoLibrary = false, 
    isCbr = false, 
    sortAlphabetically = false
  ): Promise<void> {
    // Authentication check
    if (!DEVELOPER_MODE && 
        serverPass !== undefined && 
        req.socket.remoteAddress && 
        !addressAuth[req.socket.remoteAddress]) {
      res.status(403).end();
      return;
    }

    let responseSent = false;

    try {
      // Clean the URL by normalizing slashes and decoding it once
      let requestUrl = decodeURIComponent(req.url)
        .replace(/\/+$/, "")  // Remove trailing slashes
        .replace(/\/+/g, '/'); // Normalize multiple consecutive slashes to single ones
      console.log(`Route: ${requestUrl}`);

      let allUrlParts = stripQueryStringFromUrl(requestUrl).split('/').filter(r => r.trim().length > 0);
      const parts = allUrlParts.slice(1); // remove the "comic/video/browse" part

      // media is our static express route mapped to the logical passed-in rootMediaPath
      // example input: localhost/browse/folder1/folder2 => resulting: /media/folder1/folder2
      const staticMediaPath = '/' + ['media', ...parts].join('/'); 

      // Represents the relative path to the media folder
      const relativeMediaPath = parts.join(path.sep);
      const logicalMediaPath = path.join(rootMediaPath, relativeMediaPath);

      if (fs.existsSync(logicalMediaPath)) {
        // Handle HTML files directly
        if (HTML_EXTS.includes(logicalMediaPath.toLowerCase().split('.').pop() || '')) {
          res.set({'content-type': 'text/html; charset=utf-8'});
          res.sendFile(logicalMediaPath);
          responseSent = true;
        } 
        // Handle comic book files
        else if (isCbr) {
          let comicName = req.query['comicfile'] as string;
          if (comicName) {
            // Fully sanitize the comic name to prevent any path problems
            // 1. First decode in case it's already encoded
            let sanitizedName = decodeURIComponent(comicName);
            // 2. Remove all slashes and potentially dangerous characters
            sanitizedName = sanitizedName.replace(/[\/\\?%*:|"<>]/g, '');
            // 3. Get just the filename without path
            sanitizedName = path.basename(sanitizedName);
            
            console.log(`Processing comic: ${sanitizedName}`);
            const physicalCbrFile = path.join(logicalMediaPath, sanitizedName);

            if (fs.existsSync(physicalCbrFile)) {
              // Open the cbr file using adm-zip
              const comicHtml = buildComic(comicTemplateHtml, sanitizedName, physicalCbrFile);
              res.set({'content-type': 'text/html; charset=utf-8'});
              res.send(comicHtml);
              responseSent = true;
            } else {
              console.error(`Comic file not found: ${physicalCbrFile}`);
              res.status(404).send(`Comic file not found: ${sanitizedName}`);
              responseSent = true;
            }
          } else {
            console.error('No comic file specified');
            res.status(400).send('No comic file specified');
            responseSent = true;
          }
        } 
        // Handle directory browsing
        else {
          // Create subdirectory links
          let subpaths = await getDirectories(logicalMediaPath);
          subpaths.sort();
          let legiblePaths = ['parent', ...subpaths];

          if (subpaths.length > 0) {
            subpaths = subpaths.map(x => url.resolve(requestUrl + '/', encodeURIComponent(x)));
          }

          subpaths.unshift('/' + allUrlParts.slice(0, allUrlParts.length - 1).join('/'));
          let ablock = subpaths.map((x, i) => aTag(x, legiblePaths[i])).join('\n');

          // Get all files in the directory sorted by date modified
          let allFiles = await readDirAsyncSortedByDate(logicalMediaPath);
          allFiles.reverse();

          if (sortAlphabetically) {
            // Sort alphanumerically
            allFiles.sort(function (a, b) {
              return a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: 'base'
              });
            });
          }

          // Handle image files
          const imageFiles = allFiles.filter(f => IMAGE_EXTS.includes(f.toLowerCase().split('.').pop() || ''));
          let imgblock = imageFiles.map(f => {
            const imgFullFilePath = path.join(logicalMediaPath, f);
            // Join with path.sep to ensure proper OS-specific path separators
            return divImg(staticMediaPath + '/' + encodeURIComponent(f), imgFullFilePath);
          }).join('\n');

          // Handle video files
          const vidFiles = allFiles.filter(f => VID_EXTS.includes(f.toLowerCase().split('.').pop() || ''));
          const allowParallel = false;
          let vidblock: string[] = [];
          
          // Process video files with optional thumbnail generation
          if (allowParallel) {
            // This quickly exceeds memory limits due to multiple spawns of ffmpeg
            vidblock = await Promise.all(vidFiles.map(async x => {
              if (isVideoLibrary) {
                // Just a list of links to save memory
                return aTag(staticMediaPath + '/' + encodeURIComponent(x), x);
              } else {
                const vidFullFile = path.join(logicalMediaPath, x);
                const vidRelativeFile = path.join(relativeMediaPath, x);
                // Full thumbnail generation
                const hash = await thumbnailManager.generateThumbnailHash(vidRelativeFile);

                let thumbnailFullFile = await thumbnailManager.fetchThumbnailForFile(hash);
                if (!thumbnailFullFile) {
                  thumbnailFullFile = await thumbnailManager.generateThumbnail(hash, vidFullFile);
                }

                let thumb = '/thumbnails/' + path.basename(thumbnailFullFile || '');
                return divVid(staticMediaPath + '/' + encodeURIComponent(x), x, thumb);
              }
            }));
          } else {
            for (let x of vidFiles) {
              if (isVideoLibrary) {
                // Just a list of links to save memory
                vidblock.push(aTag(staticMediaPath + '/' + encodeURIComponent(x), x));
              } else {
                const vidFullFile = path.join(logicalMediaPath, x);
                const vidRelativeFile = path.join(relativeMediaPath, x);
                // Full thumbnail generation
                const hash = await thumbnailManager.generateThumbnailHash(vidRelativeFile);

                let thumbnailFullFile = await thumbnailManager.fetchThumbnailForFile(hash);
                if (!thumbnailFullFile) {
                  thumbnailFullFile = await thumbnailManager.generateThumbnail(hash, vidFullFile);
                }

                if (thumbnailFullFile) {
                  let thumb = '/thumbnails/' + path.basename(thumbnailFullFile);
                  vidblock.push(divVid(staticMediaPath + '/' + encodeURIComponent(x), x, thumb));
                }
              }
            }
          }

          // Join video blocks with appropriate separator
          const videoBlockHtml = isVideoLibrary 
            ? vidblock.join('<br>')
            : vidblock.join('\n');

          // Handle comic book files
          const cbrFiles = allFiles.filter(f => COMIC_EXTS.includes(f.toLowerCase().split('.').pop() || ''));
          // Use a simple /cbr path to avoid any path-related issues
          const comicPath = '/cbr';
          
          const cbrBlockArray = await Promise.all(cbrFiles.map(async x => {
            try {
              const cbrFullFile = path.join(logicalMediaPath, x);
              const cbrRelativeFile = path.join(relativeMediaPath, x);
              const hash = await thumbnailManager.generateThumbnailHash(cbrRelativeFile);

              let thumbnailFullFile = await thumbnailManager.fetchThumbnailForFile(hash);
              if (!thumbnailFullFile) {
                thumbnailFullFile = await thumbnailManager.generateThumbnail(hash, cbrFullFile);
              }

              if (thumbnailFullFile) {
                let thumb = '/thumbnails/' + path.basename(thumbnailFullFile);
                // Use a clean filename without potential for path issues
                return divCbr(`${comicPath}?comicfile=${encodeURIComponent(x)}`, x, thumb);
              }
              return undefined;
            } catch (e) {
              console.error(e);
              return undefined;
            }
          }));

          // Filter out undefined entries and join
          const cbrBlock = cbrBlockArray.filter((c): c is string => c !== undefined).join('\n');

          // Handle HTML files
          const htmlblock = allFiles
            .filter(f => HTML_EXTS.includes(f.toLowerCase().split('.').pop() || ''))
            .map(f => aTag(path.join(relativeMediaPath, encodeURIComponent(f)), f))
            .join('<br>');

          // Build final HTML by replacing template placeholders
          let galleryhtml = masterGalleryTemplateHtml;
          galleryhtml = galleryhtml.replace("{{HTMLSTACK}}", htmlblock);
          galleryhtml = galleryhtml.replace("{{ASTACK}}", ablock);
          galleryhtml = galleryhtml.replace("{{VSTACK}}", videoBlockHtml);
          galleryhtml = galleryhtml.replace("{{CBRSTACK}}", cbrBlock);
          galleryhtml = galleryhtml.replace("{{IMGSTACK}}", isVideoLibrary ? "" : imgblock);

          res.set({'content-type': 'text/html; charset=utf-8'});
          res.send(galleryhtml);
          responseSent = true;
        }
      }
    } catch (ex) {
      const error = ex as Error;
      res.set({'content-type': 'text/html; charset=utf-8'});
      res.send(error.message);
      responseSent = true;
    }

    if (!responseSent) {
      res.status(404).end();
    }
  }

  // Route handlers
  app.get('/videos/*', async (req, res) => {
    await createHtmlResponse(req, res, true);
  });

  app.get('/videos', function (req, res) {
    console.log(`Redirecting from ${req.url}`);
    res.redirect(301, req.url + '/');
  });

  app.get('/browse/*', async (req, res) => {
    await createHtmlResponse(req, res);
  });

  app.get('/browse', function (req, res) {
    console.log(`Redirecting from ${req.url}`);
    res.redirect(301, req.url + '/');
  });

  app.get('/sort/*', async (req, res) => {
    await createHtmlResponse(req, res, false, false, true);
  });

  app.get('/sort', function (req, res) {
    console.log(`Redirecting from ${req.url}`);
    res.redirect(301, req.url + '/');
  });

  app.get('/cbr/*', async (req, res) => {
    await createHtmlResponse(req, res, false, true);
  });

  app.get('/cbr', function (req, res) {
    // If we have a comic file parameter, process it directly without any redirects
    if (req.query.comicfile) {
      console.log(`Direct CBR processing: ${req.url}`);
      // Normalize the URL by removing trailing slashes from the query parameters
      req.url = req.url.replace(/\/+(?=\?|$)/g, '');
      
      // Process the comic directly
      createHtmlResponse(req, res, false, true);
    } else {
      // Only redirect for directory browsing
      console.log(`Redirecting from ${req.url}`);
      res.redirect(301, '/cbr/');
    }
  });

  app.get('/auth', (req, res) => {
    console.log("AUTH page hit");
    if (req.query["pw"] === serverPass) {
      if (req.socket.remoteAddress) {
        addressAuth[req.socket.remoteAddress] = true;
      }
      res.send('Success').end();
    } else {
      res.send('Auth failure').end();
    }
  });

  // Endpoint to handle file copying/downloading
  app.get('/copy-file/:filename(*)', (req, res) => {
    if (!DEVELOPER_MODE && 
        serverPass !== undefined && 
        req.socket.remoteAddress && 
        !addressAuth[req.socket.remoteAddress]) {
      res.status(403).end();
      return;
    }

    const filePath = decodeURIComponent(req.params.filename);

    try {
      if (fs.existsSync(filePath)) {
        // Get the proper MIME type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'application/octet-stream';

        if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
        else if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.bmp') mimeType = 'image/bmp';
        else if (ext === '.webp') mimeType = 'image/webp';

        res.sendFile(filePath, {
          headers: {
            'Content-Type': mimeType
          }
        });
      } else {
        res.status(404).send('File not found');
      }
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Static routes
  app.use("/thumbnails", express.static(THUMBNAIL_PATH));
  app.use("/media", express.static(rootMediaPath));
  app.use("/js", express.static(path.join(__dirname, '/js')));
  app.use("/css", express.static(path.join(__dirname, '/css')));
  app.use("/node_modules", express.static(path.join(__dirname, '/node_modules')));
  app.use("/vendors", express.static(path.join(__dirname, '/vendors')));

  // Initialize the server
  await thumbnailManager.initialize();

  if (cleanThumbnails === true) {
    await thumbnailManager.deleteAllThumbnails();
  }

  const server = app.listen(serverPort, function () {
    const addr = server.address() as AddressInfo;
    console.log(`Image server listening at http://localhost:${addr.port}`);
  });

  return Promise.resolve();
}