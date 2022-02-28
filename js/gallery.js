const placeholderSrc = (width, height) => `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"%3E%3C/svg%3E`

/*  <img
      src={placeholderSrc(width, height)}
      data-src={url}
      alt={alt} />

 Javascript monitors images and as they appear "in view", copy data-src into src field.
 */

var pswpElement = document.querySelectorAll('.pswp')[0];

// build items array
var items = [
    {
        src: 'img/gameover_avc.mp4',
        w: 600,
        h: 400
    },
    {
        src: 'img/shangui.png',
        w: 1200,
        h: 900
    },
    {
        src: 'img/squid.gif',
        w: 600,
        h: 450
    }
];

// define options (if needed)
var options = {
    // optionName: 'option value'
    // for example:
    index: 0 // start at first slide
};

// Initializes and opens PhotoSwipe
// var gallery = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, items, options);

// gallery.init();



document.addEventListener("DOMContentLoaded", function () {
    return;

    var lazyloadImages;

    if ("IntersectionObserver" in window) {
        lazyloadImages = document.querySelectorAll(".lazy");
        var imageObserver = new IntersectionObserver(function (entries, observer) {
            entries.forEach(function (entry) {
                console.log("checking entry for intersection...");
                if (entry.isIntersecting) {
                    var image = entry.target;
                    image.src = image.dataset.src;
                    image.classList.remove("lazy");
                    imageObserver.unobserve(image);
                }
            });
        });

        lazyloadImages.forEach(function (image) {
            imageObserver.observe(image);
        });
    } else {
        // var lazyloadThrottleTimeout;
        // lazyloadImages = document.querySelectorAll(".lazy");
        //
        // function lazyload() {
        //     if (lazyloadThrottleTimeout) {
        //         clearTimeout(lazyloadThrottleTimeout);
        //     }
        //
        //     lazyloadThrottleTimeout = setTimeout(function () {
        //         var scrollTop = window.pageYOffset;
        //         lazyloadImages.forEach(function (img) {
        //             if (img.offsetTop < (window.innerHeight + scrollTop)) {
        //                 img.src = img.dataset.src;
        //                 img.classList.remove('lazy');
        //             }
        //         });
        //         if (lazyloadImages.length === 0) {
        //             document.removeEventListener("scroll", lazyload);
        //             window.removeEventListener("resize", lazyload);
        //             window.removeEventListener("orientationChange", lazyload);
        //         }
        //     }, 20);
        // }
        //
        // document.addEventListener("scroll", lazyload);
        // window.addEventListener("resize", lazyload);
        // window.addEventListener("orientationChange", lazyload);
    }
});
