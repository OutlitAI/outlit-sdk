import assert from "node:assert/strict"
import { test } from "node:test"
import { evaluate, githubApi, runGuard } from "./core-contract-guard.mjs"

const ids = Object.fromEntries(
  ["base", "head", "pin", "core", "other"].map((name, i) => [name, String(i + 1).repeat(40)]),
)
const paths = ["packages/tools/src/generated/contracts.ts", "docs/openapi.json"]
const blob = (n) => n.toString(16).repeat(40)

function fixture({ changed = true, accepted = true } = {}) {
  const pr = {
    state: "open",
    head: { sha: ids.head, repo: { full_name: "OutlitAI/outlit-sdk" } },
    base: { sha: ids.base, ref: "main", repo: { full_name: "OutlitAI/outlit-sdk" } },
  }
  const versions = {
    [ids.base]: [blob(6), blob(7)],
    [ids.head]: changed ? [blob(8), blob(9)] : [blob(6), blob(7)],
    [ids.pin]: accepted ? [blob(8), blob(9)] : [blob(6), blob(7)],
  }
  const calls = []
  const statuses = []
  const sdk = async (path, body) => {
    calls.push(path)
    if (path.startsWith("statuses/")) {
      statuses.push(body)
      return {}
    }
    if (path === "pulls/12") return structuredClone(pr)
    if (path === `compare/${pr.base.sha}...${pr.head.sha}`)
      return { merge_base_commit: { sha: ids.base } }
    const match = /^contents\/(.+)\?ref=(.+)$/.exec(path)
    assert.ok(match, `unexpected SDK endpoint: ${path}`)
    return {
      type: "file",
      path: match[1],
      size: 100,
      sha: versions[match[2]][paths.indexOf(match[1])],
    }
  }
  const core = async (path) => {
    calls.push(`Core:${path}`)
    if (path === "git/ref/heads/main") return { object: { sha: ids.core } }
    assert.equal(path, `contents/.github/sdk-contract-source.json?ref=${ids.core}`)
    return {
      type: "file",
      encoding: "base64",
      size: 58,
      content: Buffer.from(JSON.stringify({ commit: ids.pin })).toString("base64"),
    }
  }
  return {
    sdk,
    core,
    pr,
    versions,
    statuses,
    calls,
    number: 12,
    eventHead: ids.head,
    targetUrl: "https://github.com/OutlitAI/outlit-sdk/actions/runs/1",
  }
}

test("unrelated SDK PR succeeds without private Core access", async () => {
  const f = fixture({ changed: false })
  f.core = () => {
    throw new Error("must not read Core")
  }
  assert.equal(await runGuard(f), "Generated contracts unchanged")
  assert.deepEqual(
    f.statuses.map((s) => s.state),
    ["pending", "success"],
  )
})

test("SDK first is blocked; after Core main accepts its exact files the same PR passes", async () => {
  const f = fixture({ accepted: false })
  await assert.rejects(runGuard(f), /Merge the matching Core pin first/)
  assert.deepEqual(
    f.statuses.map((s) => s.state),
    ["pending", "failure"],
  )
  f.versions[ids.pin] = [...f.versions[ids.head]]
  assert.equal(await runGuard(f), "Generated files accepted by Core main")
  assert.deepEqual(
    f.statuses.map((s) => s.state),
    ["pending", "failure", "pending", "success"],
  )
  // No PR source is ever downloaded or executed; blob identities suffice.
  assert.ok(f.calls.every((p) => !p.includes("download") && !p.includes("raw")))
})

test("OpenAPI-only drift is blocked even if TypeScript matches", async () => {
  const f = fixture()
  f.versions[ids.pin][1] = blob(7)
  await assert.rejects(runGuard(f), /Merge the matching Core pin first/)
})

test("an updated SDK head may retain previously accepted files without another Core change", async () => {
  const f = fixture()
  assert.notEqual(ids.pin, ids.head)
  assert.equal(await evaluate(f), "Generated files accepted by Core main")
})

test("closed PRs, wrong bases, forks with contract changes, malformed refs fail closed", async () => {
  for (const mutate of [
    (f) => {
      f.pr.state = "closed"
    },
    (f) => {
      f.pr.base.ref = "other"
    },
    (f) => {
      f.pr.base.repo.full_name = "other/repo"
    },
    (f) => {
      f.pr.head.repo.full_name = "other/fork"
    },
    (f) => {
      f.pr.head.sha = "main"
    },
  ]) {
    const f = fixture()
    mutate(f)
    await assert.rejects(runGuard(f))
    assert.equal(f.statuses.at(-1).state, "failure")
  }
})

test("private read failures replace previous successful status with a failure", async () => {
  const f = fixture()
  await runGuard(f)
  f.core = () => {
    throw new Error("no access")
  }
  await assert.rejects(runGuard(f), /no access/)
  assert.deepEqual(
    f.statuses.map((s) => s.state),
    ["pending", "success", "pending", "failure"],
  )
})

test("API errors and malformed or absent pins never authorize a merge", async () => {
  for (const file of [
    {},
    { type: "file", encoding: "base64", size: 3, content: "e30=" },
    { type: "file", encoding: "base64", size: 3, content: "!!" },
  ]) {
    const f = fixture()
    const core = f.core
    f.core = (path) => (path.startsWith("contents/") ? file : core(path))
    await assert.rejects(runGuard(f))
    assert.equal(f.statuses.at(-1).state, "failure")
  }
})

test("Core advancement or SDK head/base advancement during verification rejects stale evidence", async () => {
  for (const target of ["Core", "head", "base"]) {
    const f = fixture()
    if (target === "Core") {
      const core = f.core
      let reads = 0
      f.core = (path) =>
        path === "git/ref/heads/main" && ++reads > 1 ? { object: { sha: ids.other } } : core(path)
    } else {
      const sdk = f.sdk
      let reads = 0
      f.sdk = (path, body) => {
        if (path === "pulls/12" && ++reads > 1) f.pr[target].sha = ids.other
        return sdk(path, body)
      }
    }
    await assert.rejects(runGuard(f), /changed during verification/)
    assert.equal(f.statuses.at(-1).state, "failure")
  }
})

test("an event for a superseded head never reports success", async () => {
  const f = fixture()
  f.eventHead = ids.other
  await assert.rejects(runGuard(f), /head changed/)
  assert.deepEqual(
    f.statuses.map((s) => s.state),
    ["pending", "failure"],
  )
})

test("GitHub client keeps credentials scoped, disables redirects and redacts API errors", async () => {
  const client = githubApi("OutlitAI/Core", "test-only", async (url, options) => {
    assert.equal(url, "https://api.github.com/repos/OutlitAI/Core/git/ref/heads/main")
    assert.equal(options.redirect, "error")
    assert.ok(options.signal)
    assert.equal(options.headers.Authorization, "Bearer test-only")
    return {
      ok: false,
      status: 403,
      json: () => {
        throw new Error("private response must not be read")
      },
    }
  })
  await assert.rejects(client("git/ref/heads/main"), {
    message: "GitHub request failed (HTTP 403)",
  })
  await assert.rejects(
    githubApi("OutlitAI/Core", "")("git/ref/heads/main"),
    /CORE_CONTRACTS_READ_TOKEN/,
  )
})

test("an unrelated PR behind SDK main does not inherit a contract-change requirement", async () => {
  const f = fixture({ changed: false })
  // SDK main advanced its artifacts, but this PR has not edited them since branching.
  f.pr.base.sha = ids.other
  f.versions[ids.other] = [blob(8), blob(9)]
  f.core = () => {
    throw new Error("unrelated PR must not need Core access")
  }
  assert.equal(await runGuard(f), "Generated contracts unchanged")
  assert.deepEqual(
    f.statuses.map((s) => s.state),
    ["pending", "success"],
  )
})

test("missing merge-base evidence fails instead of treating the PR as unchanged", async () => {
  const f = fixture({ changed: false })
  const sdk = f.sdk
  f.sdk = (path, body) => (path.startsWith("compare/") ? {} : sdk(path, body))
  await assert.rejects(runGuard(f), /Invalid commit/)
  assert.equal(f.statuses.at(-1).state, "failure")
})
