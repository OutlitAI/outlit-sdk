import type { PublicToolName } from "./contracts.js"
import {
  apiKeyValidationFailureSchema,
  apiKeyValidationSuccessSchema,
  publicToolContracts,
} from "./generated/contracts.js"

type Simplify<T> = { [TKey in keyof T]: T[TKey] } & {}

type RequiredSchemaKeys<TSchema> = TSchema extends {
  readonly required: readonly (infer TRequired)[]
}
  ? Extract<TRequired, string>
  : never

type ObjectProperties<TProperties extends Readonly<Record<string, unknown>>, TSchema> = Simplify<
  {
    [TKey in keyof TProperties as TKey extends RequiredSchemaKeys<TSchema>
      ? TKey
      : never]-?: JsonSchemaValue<TProperties[TKey]>
  } & {
    [TKey in keyof TProperties as TKey extends RequiredSchemaKeys<TSchema>
      ? never
      : TKey]?: JsonSchemaValue<TProperties[TKey]>
  }
>

/** Converts the generated JSON Schema literals into their TypeScript result shapes. */
export type JsonSchemaValue<TSchema> = TSchema extends {
  readonly anyOf: readonly (infer TOption)[]
}
  ? JsonSchemaValue<TOption>
  : TSchema extends { readonly oneOf: readonly (infer TOption)[] }
    ? JsonSchemaValue<TOption>
    : TSchema extends { readonly const: infer TValue }
      ? TValue
      : TSchema extends { readonly enum: readonly (infer TValue)[] }
        ? TValue
        : TSchema extends { readonly type: "array"; readonly items: infer TItem }
          ? JsonSchemaValue<TItem>[]
          : TSchema extends {
                readonly type: "object"
                readonly properties: infer TProperties extends Readonly<Record<string, unknown>>
              }
            ? ObjectProperties<TProperties, TSchema>
            : TSchema extends {
                  readonly type: "object"
                  readonly additionalProperties: infer TAdditional
                }
              ? TAdditional extends Readonly<Record<string, unknown>>
                ? Record<string, JsonSchemaValue<TAdditional>>
                : Record<string, unknown>
              : TSchema extends { readonly type: "string" }
                ? string
                : TSchema extends { readonly type: "number" | "integer" }
                  ? number
                  : TSchema extends { readonly type: "boolean" }
                    ? boolean
                    : TSchema extends { readonly type: "null" }
                      ? null
                      : unknown

export type PublicToolResult<TToolName extends PublicToolName> = JsonSchemaValue<
  (typeof publicToolContracts)[TToolName]["outputSchema"]
>

export type ApiKeyValidationSuccess = JsonSchemaValue<typeof apiKeyValidationSuccessSchema>
export type ApiKeyValidationFailure = JsonSchemaValue<typeof apiKeyValidationFailureSchema>

export type CustomerListResult = PublicToolResult<"outlit_list_customers">
export type CustomerListItem = CustomerListResult["items"][number]
export type CustomerDetailResult = PublicToolResult<"outlit_get_customer">
export type CustomerDetail = CustomerDetailResult["customer"]
export type CustomerRelationshipResult = PublicToolResult<"outlit_get_customer_relationship">
export type CustomerRelationship = CustomerRelationshipResult["relationship"]
export type AttentionListResult = PublicToolResult<"outlit_list_attention_items">
export type AttentionItemSummary = AttentionListResult["items"][number]
export type AttentionItemResult = PublicToolResult<"outlit_get_attention_item">
export type AttentionItem = AttentionItemResult

export interface CustomerAnalyticsRow {
  activated_at: string | null
  [column: string]: unknown
}
