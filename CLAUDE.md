# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Commands
- Install dependencies: `npm install`
- Start server: `npm start` or `tsx server.ts`
- Run tests: `npm test` or `tsx tests.ts`
- Build: `npm run build`
- Server options: `--path [directory] --port [port] --pass [password] --clean-thumbnails`

## Code Style Guidelines
- Use ES modules syntax with TypeScript imports
- Explicit typing on all functions and variables
- Use camelCase for variables and functions, PascalCase for classes
- Error handling via try/catch blocks with console.error for logging
- Path handling: Use path.join() for cross-platform compatibility
- Async/await for asynchronous operations
- HTML templating via string replacements ({{PLACEHOLDER}})
- Node 22+ compatibility
- File operations prefer fs/promises module with proper error handling
- URL encoding for paths in links to handle special characters
- Properly handle null/undefined checks
- Use type assertions only when necessary