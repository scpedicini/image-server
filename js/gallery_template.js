
const lightbox = GLightbox({
    touchNavigation: true,
    loop: true,
    autoplayVideos: true,
    touchFollowAxis: true,
    plyr: { config: {settings: ['loop'], autoplay: true, muted: true, storage: { enabled: false }, loop: {active: true}, fullscreen: { enabled: true, fallback: true, iosNative: true } } },
});



function modifyThumbnailSize(size)
{
    let imgRule = Object.values(Object.values(document.styleSheets).find(x => 'href' in x && x.href.includes("gallery.css")).cssRules)
        .find(x => x.selectorText === 'img');
    if(imgRule !== undefined) {
        imgRule.style['height'] = size + 'px';
        imgRule.style['width'] = size + 'px';
    }
}

document.getElementById('thumbsize')?.addEventListener('input', event => {
    modifyThumbnailSize(event.target.value);
});

document.getElementById('togglevideos')?.addEventListener('change', event => {

    //document.getElementsByClassName('vstack')[0].hidden = event.target.value !== 'on'
    document.getElementsByClassName('vstack')[0].hidden = !event.target.checked;
});


function copyFileNameToClipboard(event, path) {
    console.log('Copying path to clipboard:', path);
    event.preventDefault();
    event.stopPropagation();
    navigator.clipboard.writeText(path)
        .then(() => {
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✓';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
        });
}

async function copyTrueFileToClipboard(event, filename) {
    event.preventDefault();
    event.stopPropagation();

    try {
        const response = await fetch(`/copy-file/${filename}`);
        if (!response.ok) throw new Error('Network response was not ok');

        const blob = await response.blob();
        const item = new ClipboardItem({
            [blob.type]: blob
        });

        await navigator.clipboard.write([item]);

        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1000);
    } catch (err) {
        console.error('Failed to copy file:', err);
        const btn = event.target;
        btn.textContent = '❌';
        setTimeout(() => {
            btn.textContent = '📋';
        }, 1000);
    }
}
