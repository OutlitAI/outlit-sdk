/**
 * Simple test server for Playwright E2E tests.
 * Serves:
 * - Test HTML fixtures from __tests__/e2e/fixtures/
 * - Built SDK from dist/
 */

import fs from "node:fs"
import http from "node:http"
import path from "node:path"

// Resolve paths relative to the package root
// This works regardless of how the script is run (tsx, node, etc.)
const PACKAGE_ROOT = path.resolve(process.cwd())

const PORT = 3456
const FIXTURES_DIR = path.join(PACKAGE_ROOT, "__tests__", "e2e", "fixtures")
const DIST_DIR = path.join(PACKAGE_ROOT, "dist")

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath)
  return MIME_TYPES[ext] || "application/octet-stream"
}

const server = http.createServer((req, res) => {
  const fullUrl = req.url || "/"

  // Parse URL to extract pathname (strip query parameters)
  const urlObj = new URL(fullUrl, `http://localhost:${PORT}`)
  const pathname = urlObj.pathname

  // CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }

  let filePath: string

  // Route SDK files from dist/
  if (
    pathname.startsWith("/outlit.") ||
    (pathname.includes(".js") && !pathname.includes(".html"))
  ) {
    const fileName = path.basename(pathname)
    filePath = path.join(DIST_DIR, fileName)
  } else {
    // Route HTML files from fixtures/
    const fileName = pathname === "/" ? "test-page.html" : pathname
    filePath = path.join(FIXTURES_DIR, fileName)
  }

  // Prevent directory traversal
  if (!filePath.startsWith(FIXTURES_DIR) && !filePath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end("Forbidden")
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404)
        res.end(`Not found: ${pathname}`)
      } else {
        res.writeHead(500)
        res.end("Internal Server Error")
      }
      return
    }

    res.writeHead(200, { "Content-Type": getMimeType(filePath) })
    res.end(data)
  })
})

server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`)
  console.log(`Serving fixtures from: ${FIXTURES_DIR}`)
  console.log(`Serving SDK from: ${DIST_DIR}`)
})
