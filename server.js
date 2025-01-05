const express = require('express');
const app = express();
app.use(express.json());
const path = require('path');
const url = require('url');
const {ThumbnailManager} = require('./js/thumbnails');
const {readDirAsyncSortedByDate, getDirectories} = require("./js/image_utils");
const fs = require('fs');
const {stripQueryStringFromUrl} = require("./js/utility_belt");
const {response} = require("express");
const {buildComic} = require('./js/comic_parser');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');


// this gives back relative file names (does not include the paths)
// const readDirAsync = promisify(fs.readdir);

let addressAuth = {};

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
const VID_EXTS = ['mp4'];
const COMIC_EXTS = ['cbr', 'cbz'];
const HTML_EXTS = ['html', 'htm', 'xhtml'];

const DEVELOPER_MODE = true;

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
    .parse();

if(!args.path)
    args.path = process.cwd();

if(!args.port)
    args.port = 12345;

const rootMediaPath = args['path'];
const serverPort = args['port'];
const serverPass = args['pass']
const cleanThumbnails = args['clean-thumbnails'];

/**** FOLDER PATHS ****/

const THUMBNAIL_PATH = path.join(rootMediaPath, 'thumbnails');
const DB_PATH = path.join(rootMediaPath, 'image-server.db3');
const thumbnailManager = new ThumbnailManager(DB_PATH, THUMBNAIL_PATH, true);

const aTag = (href, title) => `<a href="${href}">${title}</a>`;
const divImg = (img, originalPath) => `
    <div class="image-container">
        <img src="${img}" alt="" loading="lazy" class="glightbox" data-gallery="picgallery">
        <button class="copy-path-btn" data-path="${originalPath}" onclick="copyFileNameToClipboard(event, '${originalPath}')">📋</button>
        <button class="copy-path-btn" data-path="${originalPath}" onclick="copyTrueFileToClipboard(event, '${originalPath}')">💾</button>
    </div>
`;

const divVid = (vid, title, thumbnail) => `<a href="${vid}" class="glightbox" data-gallery="vidgallery"> <img src="${thumbnail}" alt="${title}"> </a>`;
const divhtml5Video = (vid, title, thumbnail) => `<video playsinline controls preload="nothing"> <source src="${vid}" type="video/mp4"> </video>`;

// /cbr/folder1?file=file1.cbr
const divCbr = (cbr, title, thumbnail) => `<a href="${cbr}"> <img src="${thumbnail}" alt="${title}"> </a>`;


const masterGalleryTemplateHtml = fs.readFileSync(path.join(__dirname, 'gallery_template.html'), 'utf8');
const comicTemplateHtml = fs.readFileSync(path.join(__dirname, 'comic_template.html'), 'utf8');

//const rootMediaPath = 'D:\\data\\webserver\\media';

async function createHtmlResponse(req, res, isVideoLibrary, isCbr, sortAlphabetically) {
    if (!DEVELOPER_MODE && serverPass !== undefined && addressAuth[req.connection.remoteAddress] !== true) {
        res.status(403).end();
        return;
    }

    let response_sent = false;

    try {
        let request_url = decodeURIComponent(req.url.replace(new RegExp('/+$'), "")); // swapped from decodeURI which doesn't handle commmas %2C well

        console.log(`Route: ${request_url}`);

        let all_url_parts = stripQueryStringFromUrl(request_url).split('/').filter(r => r.trim().length > 0);

        const parts = all_url_parts.slice(1); // remove the "comic/video/browse" part

        // media is our static express route mapped to the logical passed-in rootMediaPath
        // example input: localhost/browse/folder1/folder2 => resulting: /media/folder1/folder2
        const staticMediaPath = '/' + ['media', ...parts].join('/'); // join all the parts together

        // Represents the relative path to the media folder
        const relativeMediaPath = parts.join(path.sep);
        const logicalMediaPath = path.join(rootMediaPath, parts.join(path.sep));

        if (fs.existsSync(logicalMediaPath)) {

            if (HTML_EXTS.includes(logicalMediaPath.toLocaleLowerCase().split('.').pop())) {
                res.set({'content-type': 'text/html; charset=utf-8'});
                res.sendFile(logicalMediaPath);
                response_sent = true;
            } else if (isCbr) {

                let comicName = req.query['comicfile'];
                let physicalCbrFile = path.join(logicalMediaPath, comicName);

                if(fs.existsSync(physicalCbrFile))
                {
                    // open the cbr file using adm-zip
                    const comicHtml = buildComic(comicTemplateHtml, comicName, physicalCbrFile);
                    res.set({'content-type': 'text/html; charset=utf-8'});
                    res.send(comicHtml);
                    response_sent = true;
                }
            } else {

                // create sub directories
                let subpaths = await getDirectories(logicalMediaPath);
                subpaths.sort();
                let legiblepaths = ['parent', ...subpaths];

                if (subpaths.length > 0) {
                    subpaths = subpaths.map(x => url.resolve(request_url + '/', encodeURIComponent(x)));
                }

                subpaths.unshift('/' + all_url_parts.slice(0, all_url_parts.length - 1).join('/'));
                let ablock = subpaths.map((x, i) => aTag(x, legiblepaths[i])).join('\n');

                // get all files in the directory sorted by date modified
                let all_files = await readDirAsyncSortedByDate(logicalMediaPath);
                all_files.reverse();

                if (sortAlphabetically) {
                    // sort alphanumerically
                    all_files.sort(function (a, b) {
                        return a.localeCompare(b, undefined, {
                            numeric: true,
                            sensitivity: 'base'
                        });
                    });
                }

                // handle the image files
                const image_files = all_files.filter(f => IMAGE_EXTS.includes(f.toLowerCase().split('.').pop()));
                let imgblock = image_files.map(f => {
                    const imgFullFilePath = path.join(logicalMediaPath, f);
                    return divImg(staticMediaPath + '/' + encodeURIComponent(f), imgFullFilePath);
                }).join('\n');

                const vid_files = all_files.filter(f => VID_EXTS.includes(f.toLowerCase().split('.').pop()));

                // for every vid_file we need to get the absolute path
                const allowParallel = false;
                /** @type string[] */
                let vidblock = undefined;
                if(allowParallel) {
                    // this quickly exceeds memory limits due to multiple spawns of ffmpeg
                    vidblock = await Promise.all(vid_files.map(async x => {
                        if(isVideoLibrary) {
                            // just a list of links to save memory
                            return aTag(staticMediaPath + '/' + encodeURIComponent(x), x);
                        } else {
                            const vidFullFile = path.join(logicalMediaPath, x);
                            const vidRelativeFile = path.join(relativeMediaPath, x);
                            // full thumbnail generation
                            const hash = await thumbnailManager.generateThumbnailHash(vidRelativeFile);

                            let thumbnailFullFile = await thumbnailManager.fetchThumbnailForFile(hash);
                            if (!thumbnailFullFile) {
                                thumbnailFullFile = await thumbnailManager.generateThumbnail(hash, vidFullFile);
                            }

                            let thumb = '/thumbnails/' + path.basename(thumbnailFullFile);
                            return divVid(staticMediaPath + '/' + encodeURIComponent(x), x, thumb);
                        }
                    }));
                } else {
                    vidblock = [];
                    for  (let x of vid_files) {
                        if(isVideoLibrary) {
                            // just a list of links to save memory
                            vidblock.push(aTag(staticMediaPath + '/' + encodeURIComponent(x), x));
                        } else {
                            const vidFullFile = path.join(logicalMediaPath, x);
                            const vidRelativeFile = path.join(relativeMediaPath, x);
                            // full thumbnail generation
                            const hash = await thumbnailManager.generateThumbnailHash(vidRelativeFile);

                            let thumbnailFullFile = await thumbnailManager.fetchThumbnailForFile(hash);
                            if (!thumbnailFullFile) {
                                thumbnailFullFile = await thumbnailManager.generateThumbnail(hash, vidFullFile);
                            }

                            let thumb = '/thumbnails/' + path.basename(thumbnailFullFile);
                            vidblock.push(divVid(staticMediaPath + '/' + encodeURIComponent(x), x, thumb));
                        }
                    }
                }



                if (isVideoLibrary)
                    vidblock = vidblock.join('<br>');
                else
                    vidblock = vidblock.join('\n');

                const cbr_files = all_files.filter(f => COMIC_EXTS.includes(f.toLowerCase().split('.').pop()));
                const comicPath = '/' + ['cbr', ...parts].join('/'); // join all the parts together
                let cbr_block = await Promise.all(cbr_files.map(async x => {

                    try {
                        const cbrFullFile = path.join(logicalMediaPath, x);
                        const cbrRelativeFile = path.join(relativeMediaPath, x);
                        const hash = await thumbnailManager.generateThumbnailHash(cbrRelativeFile);

                        let thumbnailFullFile = await thumbnailManager.fetchThumbnailForFile(hash);
                        if (!thumbnailFullFile) {
                            thumbnailFullFile = await thumbnailManager.generateThumbnail(hash, cbrFullFile);
                        }

                        let thumb = '/thumbnails/' + path.basename(thumbnailFullFile);
                        return divCbr(`${comicPath}?comicfile=${encodeURIComponent(x)}`, x, thumb);
                    } catch (e) {
                        console.error(e);
                        return undefined;
                    }
                }));

                cbr_block = cbr_block.filter(c => c !== undefined).join('\n');

                let htmlblock = all_files.filter(f => HTML_EXTS.includes(f.toLowerCase().split('.').pop()))
                    .map(f => aTag(path.join(relativeMediaPath, encodeURIComponent(f)), f));
                htmlblock = htmlblock.join('<br>');


                let galleryhtml = masterGalleryTemplateHtml;
                galleryhtml = galleryhtml.replace("{{HTMLSTACK}}", htmlblock);
                galleryhtml = galleryhtml.replace("{{ASTACK}}", ablock);
                galleryhtml = galleryhtml.replace("{{VSTACK}}", vidblock);
                galleryhtml = galleryhtml.replace("{{CBRSTACK}}", cbr_block);
                galleryhtml = galleryhtml.replace("{{IMGSTACK}}", isVideoLibrary ? "" : imgblock);


                res.set({'content-type': 'text/html; charset=utf-8'});
                res.send(galleryhtml);
                response_sent = true;
            }
        }
    } catch (ex) {
        res.set({'content-type': 'text/html; charset=utf-8'});
        res.send(ex.message);
        response_sent = true;
    }

    if (!response_sent) {
        res.status(404).end()
    }
}

app.get('/videos/*', async (req, res) => {
    // req.url = /browse/misc/trees
    await createHtmlResponse(req, res, true);
});


app.get('/videos', function (req, res) {
    console.log(`Redirecting from ${req.url}`);
    res.redirect(301, req.url + '/')
});



// careful - if we serve a website with relative requests - they will continue to hit this particular page
app.get('/browse/*', async (req, res) => {
    // req.url = /browse/misc/trees
    await createHtmlResponse(req, res, false);

});

app.get('/browse', function (req, res) {
    console.log(`Redirecting from ${req.url}`);
    res.redirect(301, req.url + '/')
});



// careful - if we serve a website with relative requests - they will continue to hit this particular page
app.get('/sort/*', async (req, res) => {
    // req.url = /browse/misc/trees
    await createHtmlResponse(req, res, false, false, true);

});

app.get('/sort', function (req, res) {
    console.log(`Redirecting from ${req.url}`);
    res.redirect(301, req.url + '/')
});


// careful - if we serve a website with relative requests - they will continue to hit this particular page
app.get('/cbr/*', async (req, res) => {
    // req.url = /browse/misc/trees
    await createHtmlResponse(req, res, false, true, false);

});

app.get('/cbr', function (req, res) {
    console.log(`Redirecting from ${req.url}`);
    res.redirect(301, req.url + '/')
});


app.get('/auth', (req, res) => {
    console.log("AUTH page hit");
    if (req.query["pw"] === serverPass) {
        addressAuth[req.connection.remoteAddress] = true;
        res.send('Success').end();
    } else {
        res.send('Auth failure').end();
    }
});

// Add new endpoint to handle file copying
app.get('/copy-file/:filename(*)', (req, res) => {
    if (!DEVELOPER_MODE && serverPass !== undefined && addressAuth[req.connection.remoteAddress] !== true) {
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



app.use("/thumbnails", express.static(THUMBNAIL_PATH));
app.use("/media", express.static(rootMediaPath));
app.use("/js", express.static(path.join(__dirname, '/js')));
app.use("/css", express.static(path.join(__dirname, '/css')));
app.use("/node_modules", express.static(path.join(__dirname, '/node_modules')));

app.use("/vendors", express.static(path.join(__dirname, '/vendors')));


(async () => {
    await thumbnailManager.initialize();

    if(cleanThumbnails === true) {
        await thumbnailManager.deleteAllThumbnails();
    }

    const server = app.listen(serverPort, function () {
        /** @type {AddressInfo} */
        const addr = server.address();
        console.log(`Example app listening at http://${addr.host}:${addr.port}`);
    });
})();


