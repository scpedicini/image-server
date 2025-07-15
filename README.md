# ImageServer

A TypeScript-based media gallery server for browsing and viewing images, videos, and comic book archives, with Node 22+ support.

## Features

- Directory browsing with thumbnails
- Image gallery with lightbox viewing
- Video playback with thumbnail generation
- Comic book (CBR/CBZ) reader
- Copy-to-clipboard and download functionality
- Optional password protection
- Node 22+ compatibility with fallback storage

## Requirements

- Node.js 22+
- npm

## Installation

```bash
# Install dependencies
npm install
```

The application uses SQLite for thumbnail storage on Node.js versions where it's compatible, and automatically falls back to a file-based storage system for Node.js 22+ where there might be compatibility issues.

## Usage

```bash
# Start the server
npm start

# Start with custom options
npm start -- --path /path/to/media --port 8080 --pass mypassword

# Clean thumbnails
npm start -- --clean-thumbnails
```

### Command Line Options

- `--path`: Directory to serve (defaults to current directory)
- `--port`: Port to serve on (defaults to 12345)
- `--pass`: Password to protect access (optional)
- `--clean-thumbnails`: Clean all thumbnails on startup

## Development

```bash
# Run tests
npm test

# Build TypeScript
npm run build
```

## Node.js 22+ Compatibility

This application has been updated to support Node.js 22 with the following features:

- TypeScript support throughout the codebase
- ES modules for modern module loading
- File-based thumbnail storage fallback when SQLite is unavailable
- Improved error handling for native dependencies
- Proper typing for all components

## License

See the LICENSE file for details.