const express = require('express');
const app = express();
app.use(express.json());
const path = require('path');
const fs = require('fs');
const {promisify} = require('util');

// this gives back relative file names (does not include the paths)
const readDirAsync = promisify(fs.readdir);

let masterPass = "bluenoyellow";
let addressAuth = {};

async function readDirAsyncSorted(dir) {
    let files = await readDirAsync(dir);

    files = files.map(f => ({
        name: f,
        time: fs.statSync(dir + '/' + f).mtime.getTime()
    }))
        .sort((a, b) => a.time - b.time)
        .map(v => v.name);

    return files;
}


async function readDirAsyncSortedAlphabetically(dir) {
    let files = await readDirAsync(dir);

    return files;
}

const url = require('url');
const {v4: uuidv4} = require('uuid');
const Database = require('better-sqlite3');


/**** FOLDER PATHS ****/

let rootMediaPath = 'W:\\';

if (process.argv.length === 3) {
    rootMediaPath = process.argv[2];
}

const thumbnailPath = path.join(rootMediaPath, 'thumbnails');
const dbPath = path.join(rootMediaPath, 'server.db3');

const db = new Database(dbPath, {verbose: console.log});

// Thumbnails [id, videopath, imagepath, scenevariation

const ffmpeg = require('fluent-ffmpeg');

const createTable = "CREATE TABLE IF NOT EXISTS thumbnails ('vidfile' TEXT NOT NULL PRIMARY KEY, 'imagefile' TEXT, 'scenevariation' REAL);"
db.exec(createTable);

function createOrGetThumbnail(vidfile) {
    vidfile = vidfile.toLowerCase();
    let stmt = db.prepare('SELECT * FROM thumbnails WHERE vidfile = ?');
    let row = stmt.get(vidfile);

    let retvalue = '';

    if (row !== undefined && row['imagefile'] !== null && fs.existsSync(path.join(thumbnailPath, row['imagefile']))) {
        retvalue = row['imagefile'];
    } else {
        let scenevariation = row !== undefined && row['scenevariation'] !== null ? parseFloat(row['scenevariation']) : 0.4;
        // run ffmpeg and create thumbnail

        let thumbnailBaseFile = uuidv4() + '.jpg';
        let thumbnailFullFile = path.join(thumbnailPath, thumbnailBaseFile);

        // outputOptions [`-vf select='gt(scene\,${scenevariation})'`, "-frames:v 1" ]
        ffmpeg(vidfile)

            .outputOptions(["-deinterlace", "-y", "-frames:v 1"])
            .output(thumbnailFullFile)
            .on('end', function (stdout, stderr) {
                // if file not exists then update/insert row with scenevariation = scenevariation - 0.1
                scenevariation = Math.max(0, scenevariation - 0.1).toFixed(2);
                let stmt = db.prepare('INSERT OR REPLACE INTO thumbnails (vidfile, imagefile, scenevariation) ' +
                    'VALUES (?, ?, ?)');
                let result = stmt.run(vidfile, thumbnailBaseFile, scenevariation);

                console.log(`Transcoding succeeded of file ${this._currentOutput.target}!`);
            })
            .on('error', (err) => {
                console.log(`an error occurred ${err}`);
            })
            .run();
    }

    return retvalue;
}

/*
ffmpeg('img/gameover_avc.mp4')
    .outputOptions(["-vf select='gt(scene\,0.2)'", "-frames:v 1" ])
    .output('img/gameover_avc.png')
    .on('end', function(stdout, stderr) {
        console.log(`Transcoding succeeded of file ${this._currentOutput.target}!`);
    })
    .on('error', (err) => {
        console.log('an error occurred');
    })
    .run();
*/

// ffmpeg -i input.mp4 -vf "select=gt(scene\,0.4)" -frames:v 1 output.png
console.log("*");

const aTag = (href, title) => `<a href="${href}">${title}</a>`;
const divImg = (img) => `<img src="${img}" alt="" loading="lazy" class="glightbox" data-gallery="picgallery">`;
const divVid = (vid, title, thumbnail) => `<a href="${vid}" class="glightbox" data-gallery="vidgallery"> <img src="${thumbnail}" alt="${title}"> </a>`;
const divhtml5Video = (vid, title, thumbnail) => `<video playsinline controls preload="nothing"> <source src="${vid}" type="video/mp4"> </video>`;

let masterGalleryTemplateHtml = fs.readFileSync(path.join(__dirname, 'gallery_template.html'), 'utf8');

//const rootMediaPath = 'D:\\data\\webserver\\media';


async function getDirectories(srcPath) {
    let dirs = await readDirAsync(srcPath);
    dirs = dirs.filter(file => fs.lstatSync(path.join(srcPath, file)).isDirectory());
    return dirs;
}


async function createHtmlResponse(req, res, isVideoLibrary, isCbr) {
    if (addressAuth[req.connection.remoteAddress] !== true) {
        res.status(403).end();
        return;
    }

    try {

        let request_url = decodeURIComponent(req.url.replace(new RegExp('/+$'), "")); // swapped from decodeURI which doesn't handle commmas %2C well

        console.log(`Route: ${request_url}`);

        let all_url_parts = request_url.split('/').filter(r => r.trim().length > 0);

        let parts = all_url_parts.slice(1);
        let webpath = '/' + ['media', ...parts].join('/'); // join all the parts together

        let physicalpath = path.join(rootMediaPath, parts.join(path.sep));


        if (fs.existsSync(physicalpath)) {

            // take all files and create img tags
            let subpaths = await getDirectories(physicalpath);
            subpaths.sort();
            let legiblepaths = ['parent', ...subpaths];

            if (subpaths.length > 0) {
                subpaths = subpaths.map(x => url.resolve(request_url + '/', encodeURIComponent(x)));
            }

            subpaths.unshift('/' + all_url_parts.slice(0, all_url_parts.length - 1).join('/'));
            let ablock = subpaths.map((x, i) => aTag(x, legiblepaths[i])).join('\n');

            let image_files;
            if(isCbr) {
                image_files = await readDirAsyncSortedAlphabetically(physicalpath);
            }
            else {
                image_files = await readDirAsyncSorted(physicalpath);
                image_files.reverse();
            }

            image_files = image_files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.gif') || f.toLowerCase().endsWith('.png'));
            let imgblock = image_files.map(f => divImg(webpath + '/' + encodeURIComponent(f))).join('\n');

            let vid_files = await readDirAsyncSorted(physicalpath);
            vid_files.reverse();
            vid_files = vid_files.filter(f => f.toLowerCase().endsWith('.mp4') /*|| f.toLowerCase().endsWith('.webm')*/);

            // for every vid_file we need to get the absolute path
            let vidblock = vid_files.map(x => {
                let tx = createOrGetThumbnail(path.join(physicalpath, x));
                let thumb = '/thumbnails/' + tx;
                return isVideoLibrary ? aTag(webpath + '/' + encodeURIComponent(x), x, thumb) :
                    divVid(webpath + '/' + encodeURIComponent(x), x, thumb);
            });

            if (isVideoLibrary)
                vidblock = vidblock.join('<br>');
            else
                vidblock = vidblock.join('\n');

            let galleryhtml = masterGalleryTemplateHtml;


            galleryhtml = galleryhtml.replace("{{ASTACK}}", ablock);
            galleryhtml = galleryhtml.replace("{{VSTACK}}", vidblock);


            galleryhtml = galleryhtml.replace("{{IMGSTACK}}", isVideoLibrary ? "" : imgblock);


            res.set({'content-type': 'text/html; charset=utf-8'});
            res.send(galleryhtml);

        } else {
            res.status(404).end()
        }
    } catch (ex) {
        res.set({'content-type': 'text/html; charset=utf-8'});
        res.send(ex.message);
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
app.get('/cbr/*', async (req, res) => {
    // req.url = /browse/misc/trees
    await createHtmlResponse(req, res, false, true);

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

app.use("/thumbnails", express.static(thumbnailPath));
app.use("/media", express.static(rootMediaPath));
app.use("/js", express.static(path.join(__dirname, '/js')));
app.use("/css", express.static(path.join(__dirname, '/css')));
app.use("/node_modules", express.static(path.join(__dirname, '/node_modules')));


const server = app.listen(12345, function () {

    let host = server.address().address;
    let port = server.address().port;

    console.log(`Example app listening at http://${host}:${port}`);
});
