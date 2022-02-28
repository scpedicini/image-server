

let tag = document.getElementsByTagName('h2')[0]
tag.textContent = 'Hello World';

console.info(tag);

Base64Encode('✓ à la mode'); // "4pyTIMOgIGxhIG1vZGU="
Base64Encode('\n'); // "Cg=="


// Handles ascii/unicode
function Base64Encode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}

// Handles ascii/unicode
function Base64Decode(str) {
    return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

Base64Decode('4pyTIMOgIGxhIG1vZGU='); // "✓ à la mode"
Base64Decode('Cg=='); // "\n"


