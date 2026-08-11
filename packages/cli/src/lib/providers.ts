export function normalizeProviderInput(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")

  return normalized === "gmail" ? "google-mail" : normalized
}
