export function joinList(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(", ") : "--"
}
