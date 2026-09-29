Horticulture Operations Suite v5
================================

Requirements
------------
- Node.js 18 or newer
- A current desktop web browser

Run
---
1. Extract the ZIP to a normal writable folder.
2. Open a terminal in the extracted folder.
3. Run: npm start
4. Open: http://127.0.0.1:4173/

The package has no runtime npm dependencies and does not require npm install.
NSA and Events use browser IndexedDB for local persistence. Each starts with an
empty operational workspace and the built-in 45-item Rate Catalog.

Browser verification
--------------------
1. Install the locked developer dependencies: `npm ci`
2. Install the package-managed Chromium runtime: `npx playwright install chromium`
3. Run `npm test` and `npm run test:browser`.

To use another port:
- macOS/Linux: PORT=8080 npm start
- Windows PowerShell: $env:PORT=8080; npm start

Keep the extracted src directory beside package.json. Do not open the HTML
files directly from disk because browser storage, PDF workers, and routing need
the local HTTP server.
