# Documentation references and editorial decisions

Research date: 2026-09-27. These are documentation design references, not claims that Outlit implements other vendors' features.

| Reference | Useful pattern | Application to Outlit |
| --- | --- | --- |
| [Vitally getting started](https://docs.vitally.io/en/collections/8822562-getting-started) | Separate learning paths for admins, CSMs, and CS leaders; connect data before automation. | App-first setup, with an obvious path for people who operate accounts and a deeper path for workspace setup. |
| [Attio workflows](https://attio.com/help/reference/automations/workflows/overview-of-workflows) | Short definition, up-front access information, links to creation, reference, and troubleshooting. | Explain each concept before its controls; put availability and prerequisites where readers need them. |
| [Clay signals](https://university.clay.com/docs/signals) | Required inputs, setup steps, editing, and practical limitations in one discoverable guide. | Explain what sources support a churn or expansion assessment and what to check when evidence is missing. |
| [Pylon account intelligence](https://support.usepylon.com/collections/5447165779-account_management) | Customer context and routine account work grouped together. | Keep customer profiles, evidence, ownership, and follow-through near renewal and monitoring guides. |
| [Vitally automated playbooks](https://docs.vitally.io/en/articles/9918977-automated-playbooks) | Explicit operational semantics and caveats alongside setup. | Be precise about notification destinations, approvals, actual execution, retries, and incomplete data; do not import Vitally's behavior. |

## Editorial approach

- The main reader is a CS/GTM operator protecting and growing long-tail revenue.
- Start with the user's task and a direct answer. Explain product terms in plain language.
- Tutorials get a reader to an observable result. How-to pages solve a particular task. Concepts explain behavior and limitations. Reference pages preserve precise contracts.
- Examples use a fictional customer and explicitly illustrative values. Marketing mockup numbers are not defaults or promised scores.
- Include implemented features behind flags, per the user's explicit instruction. Describe availability in customer language, rather than exposing internal flag identifiers.
- Use a consistent guide shape where helpful: purpose, prerequisites, steps, expected result, troubleshooting, next step. Do not force empty boilerplate sections.
- Screenshots must show verified product UI using appropriate demo data. Diagrams can explain the data-to-evidence-to-action flow without implying a fictional screen exists.
- Technical pages retain exact names, auth boundaries, pagination, errors, source visibility, and write semantics. Agent recipes require evidence and distinguish missing data from a negative finding.

## Agent discovery

[Mintlify's llms.txt documentation](https://www.mintlify.com/docs/ai/llmstxt) confirms that navigation, site description, and page descriptions feed generated indexes and Markdown exports. Prefer these generated resources to a manually duplicated catalog. Keep internal maintainer artifacts outside public navigation and indexing.

An agent starting page should distinguish the Outlit product MCP (authorized customer access) from any documentation-search MCP (public documentation search). Link to canonical API and command references. Discoverability work is not evidence of improved search rankings; hosted output checks remain part of the deployment handoff.
