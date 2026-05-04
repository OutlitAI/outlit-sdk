type StorageName = "localStorage" | "sessionStorage"

const jsdomWindow = globalThis.window

function createMemoryStorage(): Storage {
  const items = new Map<string, string>()

  return {
    get length() {
      return items.size
    },
    clear() {
      items.clear()
    },
    getItem(key: string) {
      return items.get(key) ?? null
    },
    key(index: number) {
      return Array.from(items.keys())[index] ?? null
    },
    removeItem(key: string) {
      items.delete(key)
    },
    setItem(key: string, value: string) {
      items.set(key, value)
    },
  }
}

function installStorage(name: StorageName): void {
  const existing = jsdomWindow?.[name]
  const storage =
    existing && typeof existing.clear === "function" ? existing : createMemoryStorage()

  Object.defineProperty(globalThis, name, {
    value: storage,
    configurable: true,
  })

  if (jsdomWindow && typeof jsdomWindow[name]?.clear !== "function") {
    Object.defineProperty(jsdomWindow, name, {
      value: storage,
      configurable: true,
    })
  }
}

installStorage("localStorage")
installStorage("sessionStorage")
