
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

document.getElementById('thumbsize').addEventListener('input', event => {
    modifyThumbnailSize(event.target.value);
});

document.getElementById('togglevideos').addEventListener('change', event => {

    //document.getElementsByClassName('vstack')[0].hidden = event.target.value !== 'on'
    document.getElementsByClassName('vstack')[0].hidden = !event.target.checked;
});
