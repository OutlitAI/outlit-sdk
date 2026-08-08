const { chmodSync, existsSync } = require("node:fs")
const path = require("node:path")

const packageRoot = path.dirname(require.resolve("node-pty/package.json"))
const helperCandidates = [
  path.join(packageRoot, "build", "Release", "spawn-helper"),
  path.join(packageRoot, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper"),
]
const spawnHelper = helperCandidates.find(existsSync)
if (spawnHelper) {
  try {
    chmodSync(spawnHelper, 0o755)
  } catch {
    process.stderr.write("Could not set executable permission on the node-pty spawn helper.\n")
  }
}

const { spawn } = require("node-pty")
const scenario = process.argv[2] || "success"
const secret = process.env.PTY_TEST_SECRET || "synthetic-pty-secret"
const fixtureMode = scenario === "throw" ? "throw" : "success"
const command = [
  `bun run tests/fixtures/secret-prompt.ts ${fixtureMode}`,
  "stty -a | tr ';' '\\n' | grep -Eq '(^|[[:space:]])-echo([[:space:]]|$)' && echo __ECHO_OFF__ || echo __ECHO_ON__",
].join("; ")

const terminal = spawn(process.env.SHELL || "/bin/zsh", ["-f", "-c", command], {
  cwd: process.cwd(),
  cols: 120,
  rows: 40,
  env: { ...process.env, CI: "", GITHUB_ACTIONS: "", TERM: "xterm-256color" },
})

let transcript = ""
let acted = false
let finished = false

terminal.onData((data) => {
  transcript += data

  if (!acted && transcript.includes("Fireflies API key")) {
    acted = true
    if (scenario === "success" || scenario === "throw") {
      terminal.write(`${secret}\r`)
    } else if (scenario === "cancel") {
      terminal.write("\x03")
    } else {
      const match = transcript.match(/SECRET_PROMPT_READY:(\d+)/)
      if (!match) return fail("Prompt PID was not printed")
      process.kill(Number(match[1]), scenario)
    }
  }

  if (transcript.includes("__ECHO_ON__")) succeed()
  if (transcript.includes("__ECHO_OFF__")) fail("Terminal echo remained disabled")
})

terminal.onExit(({ exitCode, signal }) => {
  setImmediate(() => {
    if (!finished) fail(`PTY exited before echo verification (exit ${exitCode}, signal ${signal})`)
  })
})

const timeout = setTimeout(() => fail("Timed out waiting for PTY scenario"), 10_000)

function succeed() {
  if (finished) return
  finished = true
  clearTimeout(timeout)
  process.stdout.write(`${JSON.stringify({ transcript, echoEnabled: true })}\n`)
  try {
    terminal.kill()
  } catch {}
}

function fail(message) {
  if (finished) return
  finished = true
  clearTimeout(timeout)
  process.stderr.write(`${message}\n${transcript}\n`)
  try {
    terminal.kill()
  } catch {}
  process.exitCode = 1
}
