import pkg from "../package.json" with { type: "json" }

/** This package's version, inlined from package.json at build time. */
export const OUTLIT_TOOLS_VERSION: string = pkg.version

/** The client id this package sends by default: `<package>/<version>`. */
export const OUTLIT_TOOLS_CLIENT = `@outlit/tools/${OUTLIT_TOOLS_VERSION}`
