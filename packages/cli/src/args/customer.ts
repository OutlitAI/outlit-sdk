import type { ArgsDef } from "citty"
import { outputError } from "../lib/output"
import { hiddenArg, labeledPositional } from "../lib/strict-args"

export const CUSTOMER_SELECTOR_HINT = "Customer domain (acme.com), exact name, or ID"

/** The one customer selector: `--customer`. `--customer-id` stays as a hidden alias. */
export const customerFlagArgs = {
  customer: {
    type: "string",
    description: CUSTOMER_SELECTOR_HINT,
  },
  "customer-id": hiddenArg({
    type: "string",
    description: "Compatibility alias for --customer",
  }),
} satisfies ArgsDef

/** `<customer>` positional plus the `--customer` flag, for commands about one customer. */
export const customerArgs = {
  customerPositional: labeledPositional("customer", {
    type: "positional",
    description: `${CUSTOMER_SELECTOR_HINT}; same as --customer`,
    required: false,
  }),
  ...customerFlagArgs,
} satisfies ArgsDef

export type CustomerSelectorArgs = {
  customerPositional?: unknown
  customer?: unknown
  "customer-id"?: unknown
}

/**
 * Reads the customer from `<customer>`, `--customer`, or `--customer-id`. Giving more than one
 * is fine only when they agree. A supplied but blank customer is an error, never "all customers".
 */
export function readCustomerSelector(
  args: CustomerSelectorArgs,
  json: boolean,
): string | undefined {
  const given: Array<{ source: string; value: string }> = []
  for (const [source, value] of [
    ["<customer>", args.customerPositional],
    ["--customer", args.customer],
    ["--customer-id", args["customer-id"]],
  ] as const) {
    if (value === undefined) continue
    const trimmed = typeof value === "string" ? value.trim() : ""
    if (!trimmed) {
      return outputError(
        { message: `${source} needs a customer domain, name, or ID`, code: "invalid_input" },
        json,
      )
    }
    given.push({ source, value: trimmed })
  }

  const distinct = [...new Set(given.map((entry) => entry.value))]
  if (distinct.length > 1) {
    return outputError(
      {
        message: `Give one customer; got ${given
          .map((entry) => `${entry.source} ${entry.value}`)
          .join(" and ")}`,
        code: "invalid_input",
      },
      json,
    )
  }

  return distinct[0]
}

export function requireCustomerSelector(
  args: CustomerSelectorArgs,
  command: string,
  json: boolean,
): string {
  const customer = readCustomerSelector(args, json)
  if (customer) return customer

  return outputError(
    {
      message: `Provide a customer: \`${command} <customer>\` or \`${command} --customer <domain|name|id>\``,
      code: "missing_input",
    },
    json,
  )
}
