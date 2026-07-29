export interface CustomerListItem {
  id: string
  name: string | null
  domain: string | null
  activatedAt: string | null
  [key: string]: unknown
}

export interface CustomerDetail {
  id: string
  name: string | null
  domain: string | null
  activatedAt: string | null
  [key: string]: unknown
}

export interface CustomerDetailResult {
  customer: CustomerDetail
  [key: string]: unknown
}

export interface CustomerListResult {
  items: CustomerListItem[]
  pagination: {
    hasMore: boolean
    nextCursor: string | null
    total?: number
  }
}

export interface CustomerAnalyticsRow {
  activated_at: string | null
  [column: string]: unknown
}
