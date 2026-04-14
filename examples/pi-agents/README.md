# Outlit Pi Agents

This example shows how to build a Pi agent with `@outlit/pi`. It ships a churn-review agent that can use Outlit customer intelligence tools, a Pi skill, and a prompt template.

## What You Get

- Outlit customer tools registered in Pi through `@outlit/pi`
- Generic `outlit` skill from `@outlit/pi` for tool selection
- `/outlit-churn-review` command for starting a churn review
- `/churn-review` prompt template for repeatable reviews
- `outlit-churn-review` skill with the review playbook and output format

## Setup

Install Pi if you do not already have it:

```bash
npm install -g @mariozechner/pi-coding-agent
```

Install this example package's dependencies:

```bash
cd examples/pi-agents
npm install
```

Set your Outlit API key:

```bash
export OUTLIT_API_KEY=ok_your_api_key
```

Optionally point at staging or a local Outlit environment:

```bash
export OUTLIT_API_URL=https://staging.app.outlit.ai
```

To try the agent from this example directory:

```bash
pi install -l .
pi
```

To use the agent in one of your own projects, run the install command from that project instead:

```bash
cd /path/to/your/project
pi install -l /path/to/outlit-sdk/examples/pi-agents
pi
```

## Running the Churn Agent

Use the slash command for a specific customer:

```text
/outlit-churn-review Acme
```

Use it without arguments for a portfolio scan:

```text
/outlit-churn-review
```

Use the prompt template when you want to edit the prompt before sending:

```text
/churn-review Acme
```

Free-form requests also work because the package includes a skill:

```text
Which paying customers look most likely to churn this week?
```

## How It Works

`extensions/outlit-churn-agent.ts` is the only TypeScript code. It imports `createOutlitPiExtension` from `@outlit/pi`, registers the default Outlit customer intelligence tools, and adds a small `/outlit-churn-review` command.

The extension does not know how to call Outlit directly. `@outlit/pi` creates Pi tool definitions from `@outlit/tools`, and `@outlit/tools` calls Outlit's public `/api/tools/call` endpoint with your `OUTLIT_API_KEY`.

The example package loads both its local churn skill and the generic `outlit` skill from `@outlit/pi`. Pi does not automatically expose resources from dependency packages, so this package references `./node_modules/@outlit/pi/skills` in `package.json`.

`skills/outlit-churn-review/SKILL.md` gives the model the churn review playbook. `prompts/churn-review.md` gives users a reusable slash prompt.

## Prompt vs Workflow

The Outlit tools are registered when Pi loads this package. Any prompt in that Pi session can use those tools when the model decides they are relevant.

`/churn-review` is a prompt template. It expands into text and starts a normal agent turn with access to the registered tools.

`/outlit-churn-review` is an extension command. It creates a better churn-review prompt from the command arguments and sends that prompt to Pi. It does not run a fixed sequence of API calls.

The churn agent is therefore agentic: the prompt and skill tell the model what evidence to gather, and the model chooses which Outlit tools to call and in what order. If you need a deterministic workflow, create a custom Pi tool or command that calls Outlit APIs directly in the exact sequence you need.

## Customizing The Agent

Pass `toolNames` to `createOutlitPiExtension` only when you intentionally want a different toolset.

For example, expose every customer tool, including SQL tools, for more advanced internal agents:

```ts
import { allCustomerToolNames, createOutlitPiExtension } from "@outlit/pi"

export default createOutlitPiExtension({
  toolNames: allCustomerToolNames,
})
```

The default toolset does not include SQL tools. That keeps the first customer-facing agent focused on customer intelligence APIs with narrower schemas. Use `allCustomerToolNames` when SQL access is appropriate for your team.

Keep integration setup or integration-management actions outside the Pi agent unless you are intentionally building an internal admin package. Customer-facing agents should usually read customer intelligence, not modify integration configuration.

## Minimal Agent

If you only want the Outlit tools with no churn-specific guidance, your extension can be this small:

```ts
import { createOutlitPiExtension } from "@outlit/pi"

export default createOutlitPiExtension()
```

That registers the default customer intelligence tools and reads `OUTLIT_API_KEY` / `OUTLIT_API_URL` from the environment.
