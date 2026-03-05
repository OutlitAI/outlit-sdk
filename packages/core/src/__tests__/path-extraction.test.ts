import { describe, expect, it } from "vitest"
import { extractPathFromUrl } from "../utils"

describe("extractPathFromUrl", () => {
  it("returns pathname for standard web URLs", () => {
    expect(extractPathFromUrl("https://app.example.com/settings/api-keys")).toBe(
      "/settings/api-keys",
    )
  })

  it("uses hash path for Electron-style file URLs", () => {
    expect(
      extractPathFromUrl(
        "file:///Applications/Superset.app/Contents/Resources/app.asar/dist/renderer/index.html#/settings/api-keys",
      ),
    ).toBe("/settings/api-keys")
  })

  it("keeps file pathname when no hash route exists", () => {
    expect(extractPathFromUrl("file:///Applications/Superset.app/index.html")).toBe(
      "/Applications/Superset.app/index.html",
    )
  })

  it("uses hash path for custom protocol index URLs", () => {
    expect(extractPathFromUrl("app://desktop/index.html#/workspace/abc123")).toBe(
      "/workspace/abc123",
    )
  })

  it("uses hash path for root web hash-routing URLs", () => {
    expect(extractPathFromUrl("https://app.example.com/#/workspace/abc123")).toBe(
      "/workspace/abc123",
    )
  })

  it("does not treat root anchor fragments as hash routes", () => {
    expect(extractPathFromUrl("https://app.example.com/#faq")).toBe("/")
  })

  it("uses hash path for /index.html web hash-routing URLs", () => {
    expect(extractPathFromUrl("https://app.example.com/index.html#/workspace/abc123")).toBe(
      "/workspace/abc123",
    )
  })

  it("does not treat /index.html anchor fragments as hash routes", () => {
    expect(extractPathFromUrl("https://app.example.com/index.html#faq")).toBe("/index.html")
  })

  it("does not use hash for non-root web URLs", () => {
    expect(extractPathFromUrl("https://app.example.com/docs#getting-started")).toBe("/docs")
  })

  it("normalizes hash routes that do not start with slash", () => {
    expect(extractPathFromUrl("file:///app/index.html#settings")).toBe("/settings")
  })

  it("falls back to slash on invalid URL", () => {
    expect(extractPathFromUrl("not a real url")).toBe("/")
  })
})
