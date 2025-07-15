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



# Sample .zshrc Configuration

Using this you can easily start the image server from your terminal with a simple command: `image_server [path] [port]`.

```zsh
function image_server() {
    # 1. Define the directory of the server script
    local imageServerDir="$HOME/dev/ImageServer"

    # 2. Set imageFolder to the first argument or the current directory
    local imageFolder="${1:-$(pwd)}"
    local port="${2}" # Capture the optional port argument

    # 3. Check if the target image folder exists
    if [ ! -d "$imageFolder" ]; then
        echo "Error: $imageFolder is not a valid directory."
        return 1
    fi

    # 4. Check if the server script directory exists
    if [ ! -d "$imageServerDir" ]; then
        echo "Error: Server directory $imageServerDir not found."
        return 1
    fi

    # 5. Run the command in a subshell to avoid changing the
    #    current directory of your terminal session.
    (
        # Change to the server's directory
        cd "$imageServerDir" || return

        # If nvm is available and .nvmrc exists, check if we need to switch versions
        if [ -s "$NVM_DIR/nvm.sh" ] && [ -f ".nvmrc" ]; then
            # Read the version spec from .nvmrc (e.g., "18.17.0", "lts/hydrogen")
            local nvmrc_spec
            nvmrc_spec=$(tr -d '[:space:]' < .nvmrc)

            # Get the canonical version for the spec (e.g., "v18.17.0")
            local required_version
            required_version=$(nvm version "$nvmrc_spec")

            # Get the currently active node version
            local current_version
            current_version=$(nvm current)

            # Compare the canonical versions and run "nvm use" only if they differ
            if [ "$current_version" != "$required_version" ]; then
                echo "Node version mismatch. Required: $required_version, Current: $current_version. Switching..."
                nvm use
            else
                echo "Node version ($current_version) already matches .nvmrc."
            fi
        fi

        # Build the arguments for the server command
        local cmd_args=("--path" "$imageFolder")
        if [ -n "$port" ]; then
            cmd_args+=("--port" "$port")
        fi

        # Run the server using tsx, passing the image folder and optional port
        echo "Starting image server for path: $imageFolder"
        npx tsx index.ts "${cmd_args[@]}"
    )
}
```