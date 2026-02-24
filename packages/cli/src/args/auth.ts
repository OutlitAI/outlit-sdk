import type { ArgsDef } from "citty"
import { OUTLIT_DASHBOARD_URL } from "../lib/config"

export const authArgs = {
  "api-key": {
    type: "string",
    description: `Outlit API key (overrides OUTLIT_API_KEY env var and stored credentials).\nFormat: ok_ followed by 32+ alphanumeric characters.\nGet one at ${OUTLIT_DASHBOARD_URL}`,
  },
} satisfies ArgsDef
