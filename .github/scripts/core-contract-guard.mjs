import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const context = "Core Contract Merge Order"
const sdkRepo = "OutlitAI/outlit-sdk"
const coreRepo = "OutlitAI/Core"
const paths = ["packages/tools/src/generated/contracts.ts", "docs/openapi.json"]
const shaPattern = /^[a-f0-9]{40}$/

function sha(value) {
  if (typeof value !== "string" || !shaPattern.test(value))
    throw new Error("Invalid commit/blob identity")
  return value
}

function validatePr(pr) {
  if (pr.state !== "open" || pr.base?.ref !== "main" || pr.base?.repo?.full_name !== sdkRepo) {
    throw new Error("Expected an open SDK PR targeting main")
  }
  sha(pr.head?.sha)
  sha(pr.base?.sha)
}

async function blobs(api, ref) {
  return Promise.all(
    paths.map(async (path) => {
      const file = await api(`contents/${path}?ref=${sha(ref)}`)
      if (file.type !== "file" || file.path !== path || file.size > 5_000_000) {
        throw new Error("Generated contract must be a bounded regular file")
      }
      return sha(file.sha)
    }),
  )
}

export async function evaluate({ sdk, core, number, pr }) {
  validatePr(pr)
  // The current base tip may contain contracts added after an unrelated PR branched.
  // Only edits since the merge base belong to this PR.
  const comparison = await sdk(`compare/${pr.base.sha}...${pr.head.sha}`)
  const mergeBase = sha(comparison.merge_base_commit?.sha)
  const [base, head] = await Promise.all([blobs(sdk, mergeBase), blobs(sdk, pr.head.sha)])
  let coreCommit
  if (head.some((blob, i) => blob !== base[i])) {
    if (pr.head.repo?.full_name !== sdkRepo)
      throw new Error("Contract companions must use an SDK repository branch")
    const ref = await core("git/ref/heads/main")
    coreCommit = sha(ref.object?.sha)
    const file = await core(`contents/.github/sdk-contract-source.json?ref=${coreCommit}`)
    let pin
    try {
      if (file.type !== "file" || file.encoding !== "base64" || file.size > 1024) throw new Error()
      pin = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"))
    } catch {
      throw new Error("Core main has no readable SDK contract pin")
    }
    if (!pin || Object.keys(pin).length !== 1) throw new Error("Invalid Core SDK contract pin")
    const accepted = await blobs(sdk, sha(pin.commit))
    if (head.some((blob, i) => blob !== accepted[i])) {
      throw new Error(
        "Merge the matching Core pin first, then rerun this guard; labels do not bypass it",
      )
    }
    if (sha((await core("git/ref/heads/main")).object?.sha) !== coreCommit) {
      throw new Error("Core main changed during verification; rerun the guard")
    }
  }
  const current = await sdk(`pulls/${number}`)
  validatePr(current)
  if (current.head.sha !== pr.head.sha || current.base.sha !== pr.base.sha) {
    throw new Error("SDK PR changed during verification; rerun the guard")
  }
  return coreCommit ? "Generated files accepted by Core main" : "Generated contracts unchanged"
}

// All API paths are constructed here. Never follow a PR-supplied URL or execute fetched files.
export function githubApi(repo, token, request = fetch) {
  return async (path, body) => {
    if (!token)
      throw new Error(
        repo === coreRepo
          ? "CORE_CONTRACTS_READ_TOKEN is required for contract changes"
          : "GITHUB_TOKEN is required",
      )
    const response = await request(`https://api.github.com/repos/${repo}/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    }).catch(() => {
      throw new Error("GitHub transport failed")
    })
    if (!response.ok) throw new Error(`GitHub request failed (HTTP ${response.status})`)
    return response.json().catch(() => {
      throw new Error("GitHub response was not valid JSON")
    })
  }
}

export async function runGuard({ sdk, core, number, eventHead, targetUrl }) {
  if (!Number.isSafeInteger(number) || number < 1)
    throw new Error("A positive PR number is required")
  // Event head lets us revoke an older success even if the first live PR read fails.
  let pr
  const head = sha(eventHead ?? (pr = await sdk(`pulls/${number}`)).head?.sha)
  const status = (state, description) =>
    sdk(`statuses/${head}`, {
      state,
      context,
      description,
      target_url: targetUrl,
    })
  await status("pending", "Checking generated contracts against Core acceptance")
  try {
    pr ??= await sdk(`pulls/${number}`)
    if (pr.head?.sha !== head) throw new Error("SDK PR head changed; rerun the guard")
    const result = await evaluate({ sdk, core, number, pr })
    await status("success", result)
    return result
  } catch (error) {
    await status("failure", "Contract evidence missing or mismatched; see trusted guard logs")
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.env.GITHUB_REPOSITORY !== sdkRepo) throw new Error("Unexpected repository")
    if (!["pull_request_target", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME))
      throw new Error("Unexpected event")
    if (
      process.env.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      process.env.GITHUB_REF !== "refs/heads/main"
    )
      throw new Error("Manual guard must run from main")
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
    const number = Number(event.pull_request?.number ?? event.inputs?.pr)
    const result = await runGuard({
      sdk: githubApi(sdkRepo, process.env.GITHUB_TOKEN),
      core: githubApi(coreRepo, process.env.CORE_CONTRACTS_READ_TOKEN),
      number,
      eventHead: event.pull_request?.head?.sha,
      targetUrl: `https://github.com/${sdkRepo}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    })
    console.log(result)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
