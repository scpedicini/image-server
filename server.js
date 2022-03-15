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

// this gives back relative file names (does not include the paths)
// const readDirAsync = promisify(fs.readdir);

let masterPass = "bluenoyellow";
let addressAuth = {};

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
const VID_EXTS = ['mp4'];
const COMIC_EXTS = ['cbr', 'cbz'];

const DEVELOPER_MODE = true;

/**** FOLDER PATHS ****/

let rootMediaPath = 'W:\\';

if (process.argv.length === 3) {
    rootMediaPath = process.argv[2];
}

const THUMBNAIL_PATH = path.join(rootMediaPath, 'thumbnails');
const DB_PATH = path.join(rootMediaPath, 'server.db3');
const thumbnailManager = new ThumbnailManager(DB_PATH, THUMBNAIL_PATH);

const aTag = (href, title) => `<a href="${href}">${title}</a>`;
const divImg = (img) => `<img src="${img}" alt="" loading="lazy" class="glightbox" data-gallery="picgallery">`;
const divVid = (vid, title, thumbnail) => `<a href="${vid}" class="glightbox" data-gallery="vidgallery"> <img src="${thumbnail}" alt="${title}"> </a>`;
const divhtml5Video = (vid, title, thumbnail) => `<video playsinline controls preload="nothing"> <source src="${vid}" type="video/mp4"> </video>`;

// /cbr/folder1?file=file1.cbr
const divCbr = (cbr, title, thumbnail) => `<a href="${cbr}"> <img src="${thumbnail}" alt="${title}"> </a>`;


const masterGalleryTemplateHtml = fs.readFileSync(path.join(__dirname, 'gallery_template.html'), 'utf8');
const comicTemplateHtml = fs.readFileSync(path.join(__dirname, 'comic_template.html'), 'utf8');

//const rootMediaPath = 'D:\\data\\webserver\\media';

async function createHtmlResponse(req, res, isVideoLibrary, isCbr, sortAlphabetically) {
    let response_sent = false;

    if (addressAuth[req.connection.remoteAddress] !== true && !DEVELOPER_MODE) {
        res.status(403).end();
        response_sent = true;
        return;
    }

    try {
        let request_url = decodeURIComponent(req.url.replace(new RegExp('/+$'), "")); // swapped from decodeURI which doesn't handle commmas %2C well

        console.log(`Route: ${request_url}`);

        let all_url_parts = stripQueryStringFromUrl(request_url).split('/').filter(r => r.trim().length > 0);

        let parts = all_url_parts.slice(1); // remove the "comic/video/browse" part

        // media is our static express route mapped to the logical passed-in rootMediaPath
        // example input: localhost/browse/folder1/folder2 => resulting: /media/folder1/folder2
        let staticMediaPath = '/' + ['media', ...parts].join('/'); // join all the parts together



        let logicalMediaPath = path.join(rootMediaPath, parts.join(path.sep));

        if (fs.existsSync(logicalMediaPath)) {

            if (isCbr) {

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

                const image_files = all_files.filter(f => IMAGE_EXTS.includes(f.toLowerCase().split('.').pop()));
                let imgblock = image_files.map(f => divImg(staticMediaPath + '/' + encodeURIComponent(f))).join('\n');

                const vid_files = all_files.filter(f => VID_EXTS.includes(f.toLowerCase().split('.').pop()));

                // for every vid_file we need to get the absolute path
                let vidblock = await Promise.all(vid_files.map(async x => {

                    const vidFullFile = path.join(logicalMediaPath, x);
                    const hash = await thumbnailManager.generateThumbnailHash(vidFullFile);

                    let thumbnailFullFile = await thumbnailManager.fetchThumbnailForFile(hash);
                    if (!thumbnailFullFile) {
                        thumbnailFullFile = await thumbnailManager.generateThumbnail(hash, vidFullFile);
                    }

                    let thumb = '/thumbnails/' + path.basename(thumbnailFullFile);
                    return isVideoLibrary ? aTag(staticMediaPath + '/' + encodeURIComponent(x), x) :
                        divVid(staticMediaPath + '/' + encodeURIComponent(x), x, thumb);
                }));

                if (isVideoLibrary)
                    vidblock = vidblock.join('<br>');
                else
                    vidblock = vidblock.join('\n');

                const cbr_files = all_files.filter(f => COMIC_EXTS.includes(f.toLowerCase().split('.').pop()));
                const comicPath = '/' + ['cbr', ...parts].join('/'); // join all the parts together
                let cbr_block = await Promise.all(cbr_files.map(async x => {

                    const cbrFullFile = path.join(logicalMediaPath, x);
                    const hash = await thumbnailManager.generateThumbnailHash(cbrFullFile);

                    let thumbnailFullFile = await thumbnailManager.fetchThumbnailForFile(hash);
                    if (!thumbnailFullFile) {
                        thumbnailFullFile = await thumbnailManager.generateThumbnail(hash, cbrFullFile);
                    }

                    let thumb = '/thumbnails/' + path.basename(thumbnailFullFile);
                    return divCbr(`${comicPath}?comicfile=${encodeURIComponent(x)}`, x, thumb);
                }));

                cbr_block = cbr_block.join('\n');

                let galleryhtml = masterGalleryTemplateHtml;
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
    if (req.query["pw"] === masterPass) {
        addressAuth[req.connection.remoteAddress] = true;
        res.send('Success').end();
    } else {
        res.send('Auth failure').end();
    }
});



// this route isn't really necessary since index.html is already in static middleware "use"
app.get('/gallery', async (req, res) => {
    res.sendFile('gallery.html');
});

app.use("/thumbnails", express.static(THUMBNAIL_PATH));
app.use("/media", express.static(rootMediaPath));
app.use("/js", express.static(path.join(__dirname, '/js')));
app.use("/css", express.static(path.join(__dirname, '/css')));
app.use("/node_modules", express.static(path.join(__dirname, '/node_modules')));

app.use("/vendors", express.static(path.join(__dirname, '/vendors')));


(async () => {
    await thumbnailManager.initialize();
    const server = app.listen(12345, function () {

        let host = server.address().address;
        let port = server.address().port;

        console.log(`Example app listening at http://${host}:${port}`);
    });
})();


