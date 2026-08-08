import { describe, expect, test } from "bun:test"
import { validateHandoffUrl } from "../../../src/commands/integrations/setup"
import { parseSetupConfig, SetupInputError } from "../../../src/commands/integrations/setup-input"

describe("integration setup input", () => {
  test("parses one strict provider configuration without allowing provider in stdin", () => {
    expect(
      parseSetupConfig(
        JSON.stringify({
          credentials: {
            username: "service-user",
            secret: "synthetic-secret",
            projectId: "123",
            region: "us",
          },
          configuration: {
            kind: "mixpanel_mapping",
            mapping: { mode: "group_key", groupKey: "company_id" },
            confirm: true,
          },
        }),
        "mixpanel",
      ),
    ).toEqual({
      provider: "mixpanel",
      credentials: {
        username: "service-user",
        secret: "synthetic-secret",
        projectId: "123",
        region: "us",
      },
      configuration: {
        kind: "mixpanel_mapping",
        mapping: { mode: "group_key", groupKey: "company_id" },
        confirm: true,
      },
    })
  })

  test.each([
    ["multiple JSON values", "{} {}"],
    ["an array", "[]"],
    ["a provider", '{"provider":"fireflies"}'],
    ["an unknown key", '{"credentials":{"apiKey":"synthetic"},"extra":true}'],
    ["credentials for the wrong provider", '{"credentials":{"apiToken":"synthetic"}}'],
  ])("rejects %s", (_label, input) => {
    expect(() => parseSetupConfig(input, "fireflies")).toThrow(SetupInputError)
  })

  test.each([
    ["an empty required credential", "fireflies", { credentials: { apiKey: "" } }],
    [
      "a Stripe key outside the generated restricted-key pattern",
      "stripe",
      { connectionMode: "restricted_key", credentials: { apiKey: "sk_not_restricted" } },
    ],
    [
      "an empty CRM mapping outside the generated item bound",
      "hubspot",
      { configuration: { kind: "crm_mapping", mappings: [], confirm: true } },
    ],
  ])("rejects %s", (_label, provider, input) => {
    expect(() => parseSetupConfig(JSON.stringify(input), provider)).toThrow(SetupInputError)
  })

  test("allows only exact configured-origin handoffs without URL credentials or fragments", () => {
    expect(
      validateHandoffUrl(
        "https://app.outlit.ai/integrations/connect?session=abc",
        "https://app.outlit.ai",
      ),
    ).toBe("https://app.outlit.ai/integrations/connect?session=abc")

    for (const unsafe of [
      "https://provider.example/connect",
      "https://user:password@app.outlit.ai/connect",
      "https://app.outlit.ai/connect#token",
      "https://app.outlit.ai/connect?api_key=synthetic",
      "https://app.outlit.ai/connect?next=phx_synthetic",
    ]) {
      expect(() => validateHandoffUrl(unsafe, "https://app.outlit.ai")).toThrow()
    }
  })

  test("allows exact loopback HTTP handoffs only for configured development origins", () => {
    expect(validateHandoffUrl("/integrations/connect", "http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000/integrations/connect",
    )
    expect(() =>
      validateHandoffUrl("http://localhost:3000/integrations/connect", "http://127.0.0.1:3000"),
    ).toThrow()
  })
})
