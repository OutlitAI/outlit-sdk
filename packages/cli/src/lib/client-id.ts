import pkg from "../../package.json"

/** The request header that names the calling package and its version. */
export const CLIENT_HEADER = "x-outlit-client"

/**
 * Who the CLI says it is on every request to Core, as `<package>/<version>`. Core uses it to tell a
 * CLI below a release's minimum version to upgrade. The version is inlined from package.json at build
 * time, as `CLI_VERSION` is.
 */
export const CLI_CLIENT = `@outlit/cli/${pkg.version}`
