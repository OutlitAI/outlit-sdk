import {
  collectProviderCredentials,
  SetupCancelledError,
} from "../../src/commands/integrations/setup-input"

const mode = process.argv[2] ?? "success"
console.log(`SECRET_PROMPT_READY:${process.pid}`)

try {
  await collectProviderCredentials("fireflies")
  if (mode === "throw") throw new Error("synthetic post-prompt failure")
  console.log("SECRET_PROMPT_DONE")
} catch (error) {
  if (error instanceof SetupCancelledError) {
    console.log("SECRET_PROMPT_CANCELLED")
  } else {
    console.log("SECRET_PROMPT_FAILED")
  }
}
