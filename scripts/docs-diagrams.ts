import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

// Regenerate with: bun scripts/docs-diagrams.ts
const assetDir = new URL("../docs/images/diagrams/", import.meta.url)
mkdirSync(assetDir, { recursive: true })
const fontSource =
  "https://fonts.gstatic.com/s/googlesans/v70/4UasrENHsxJlGDuGo1OIlJfC6l_24rlCK1Yo_Iqcsih3SAyH6cAwhX9RPjIUvQ.woff2"
const fontBytes = readFileSync(new URL("./assets/google-sans-latin-v70.woff2", import.meta.url))
const font = fontBytes.toString("base64")
const fontHash = createHash("sha256").update(fontBytes).digest("hex")
const fontLicense = readFileSync(new URL("./assets/OFL-google-sans.txt", import.meta.url), "utf8")
const xml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
const write = (name: string, content: string) => writeFileSync(new URL(name, assetDir), content)

type Palette = {
  bg: string
  panel: string
  panel2: string
  ink: string
  sub: string
  stroke: string
  line: string
  accent: string
}
const themes: Record<string, Palette> = {
  light: {
    bg: "#FCF7F1",
    panel: "#FFFCF8",
    panel2: "#F3EEE8",
    ink: "#16161A",
    sub: "#615D5B",
    stroke: "#CFC7BE",
    line: "#8D8987",
    accent: "#475569",
  },
  dark: {
    bg: "#16161A",
    panel: "#222226",
    panel2: "#2A292D",
    ink: "#F8F4EF",
    sub: "#BBB5B2",
    stroke: "#58565A",
    line: "#A7A1A0",
    accent: "#C5D0DC",
  },
}
const graphText = {
  sources: "CONNECTED SOURCES",
  sdk: ["Outlit SDKs", "Discovery, visits, events"],
  business: ["CRM + billing + product", "Customer records, usage"],
  conversations: ["Conversations + support", "Calls, email, tickets"],
  context: "CUSTOMER CONTEXT GRAPH",
  people: [
    "People and accounts",
    "Visitors → contacts → accounts",
    "Identity and membership links",
  ],
  activity: [
    "Activity and facts",
    "One timeline across sources",
    "What happened and what it means",
  ],
  attention: "Attention + customer profiles",
  api: "CLI · MCP · API",
} as const
const visitorText = {
  actors: ["Visitor", "Outlit Browser SDK", "Outlit"],
  anonymous: "01  ANONYMOUS",
  identified: "02  IDENTIFIED",
  events: [
    ["Visitor", "First visit"],
    ["Outlit Browser SDK", "Pageview + visitor ID"],
    ["Visitor", "Submits email"],
    ["Outlit Browser SDK", "Identify + visitor ID"],
    ["Outlit", "Earlier activity joins contact"],
  ],
} as const
const graphDescription =
  "The Outlit Browser SDK and Outlit server SDKs, CRM customer records, billing and product tools, and conversations and support feed the customer context graph. It links people and accounts with activity and facts. Attention, customer profiles, CLI, MCP, and API use that context."
const visitorDescription =
  "A first visit produces a pageview with a visitor ID. When the visitor submits an email, the Outlit Browser SDK sends identify with the same visitor ID. Outlit links the earlier activity to the contact."
const label = (x: number, y: number, value: string, className = "label") =>
  `<text x="${x}" y="${y}" class="${className}">${xml(value)}</text>`
const card = (x: number, y: number, width: number, height: number, p: Palette) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${p.panel}" class="stroke"/>`
const style = (p: Palette) =>
  `<style>@font-face{font-family:GoogleSansDiagram;src:url(data:font/woff2;base64,${font}) format('woff2');font-style:normal;font-weight:400 700}text{font-family:GoogleSansDiagram,Arial,sans-serif}.eyebrow{font-size:11.5px;letter-spacing:1.5px;font-weight:700;fill:${p.sub}}.label{font-size:15.5px;font-weight:600;fill:${p.ink}}.body,.small{font-size:14.5px;fill:${p.sub}}.stroke{stroke:${p.stroke};stroke-width:1.2}.line{stroke:${p.line};stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round}</style>`
const start = (name: string, description: string, width: number, height: number, p: Palette) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc"><title id="title">${xml(name)}</title><desc id="desc">${xml(description)}</desc><metadata><font-license source="${xml(fontSource)}" sha256="${fontHash}">${xml(fontLicense)}</font-license></metadata>${style(p)}<rect width="${width}" height="${height}" rx="16" fill="${p.bg}"/>`

function graph(p: Palette) {
  const t = graphText
  return `${start("Customer context graph", graphDescription, 720, 448, p)}
${label(32, 32, t.sources, "eyebrow")}
${card(32, 48, 208, 72, p)}${label(48, 76, t.sdk[0])}${label(48, 101, t.sdk[1], "small")}
${card(256, 48, 208, 72, p)}${label(272, 76, t.business[0])}${label(272, 101, t.business[1], "small")}
${card(480, 48, 208, 72, p)}${label(496, 76, t.conversations[0])}${label(496, 101, t.conversations[1], "small")}
<path d="M136 120v21h448v-21M360 141v25" class="line"/><circle cx="360" cy="168" r="3" fill="${p.accent}"/>
<rect x="32" y="177" width="656" height="153" rx="14" fill="${p.panel2}" class="stroke"/>${label(52, 202, t.context, "eyebrow")}<line x1="52" y1="213" x2="668" y2="213" class="stroke"/>
${label(52, 241, t.people[0])}${label(52, 266, t.people[1], "body")}${label(52, 292, t.people[2], "small")}
<line x1="350" y1="227" x2="350" y2="307" class="stroke"/>
${label(376, 241, t.activity[0])}${label(376, 266, t.activity[1], "body")}${label(376, 292, t.activity[2], "small")}
<path d="M360 330v24M184 354h352M184 354v35M536 354v35" class="line"/>
${card(32, 389, 304, 43, p)}${label(48, 416, t.attention)}
${card(384, 389, 304, 43, p)}${label(400, 416, t.api)}
</svg>`
}
function graphMobile(p: Palette) {
  const t = graphText
  return `${start("Customer context graph", graphDescription, 350, 615, p)}
${label(18, 27, t.sources, "eyebrow")}
${card(18, 39, 314, 60, p)}${label(32, 64, t.sdk[0])}${label(32, 85, t.sdk[1], "small")}
${card(18, 106, 314, 60, p)}${label(32, 131, t.business[0])}${label(32, 152, t.business[1], "small")}
${card(18, 173, 314, 60, p)}${label(32, 198, t.conversations[0])}${label(32, 219, t.conversations[1], "small")}
<path d="M175 233v21" class="line"/><circle cx="175" cy="255" r="3" fill="${p.accent}"/>
<rect x="18" y="264" width="314" height="208" rx="12" fill="${p.panel2}" class="stroke"/>${label(32, 289, t.context, "eyebrow")}<line x1="32" y1="300" x2="318" y2="300" class="stroke"/>
${label(32, 327, t.people[0])}${label(32, 349, t.people[1], "body")}${label(32, 370, t.people[2], "small")}
<line x1="32" y1="387" x2="318" y2="387" class="stroke"/>
${label(32, 414, t.activity[0])}${label(32, 436, t.activity[1], "body")}${label(32, 457, t.activity[2], "small")}
<path d="M175 472v32H9v85M9 544h9M9 589h9" class="line"/>
${card(18, 525, 314, 37, p)}${label(32, 549, t.attention)}
${card(18, 570, 314, 37, p)}${label(32, 594, t.api)}
</svg>`
}
function sequence(p: Palette) {
  const t = visitorText
  return `${start("From anonymous visit to known contact", visitorDescription, 720, 420, p)}
<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="${p.accent}" stroke-width="1.5"/></marker></defs>
${card(36, 24, 156, 43, p)}${label(87, 51, t.actors[0])}
${card(282, 24, 156, 43, p)}<text x="360" y="51" text-anchor="middle" class="label">${xml(t.actors[1])}</text>
${card(528, 24, 156, 43, p)}${label(584, 51, t.actors[2])}
<path d="M114 67v292M360 67v292M606 67v292" stroke="${p.stroke}" stroke-width="1.2" stroke-dasharray="4 6"/>
<rect x="32" y="89" width="656" height="112" rx="12" fill="${p.panel2}"/>${label(48, 111, t.anonymous, "eyebrow")}
<path d="M114 143H353" class="line" marker-end="url(#arrow)"/>${label(185, 133, t.events[0][1], "body")}
<path d="M360 174H599" class="line" marker-end="url(#arrow)"/>${label(389, 164, t.events[1][1], "body")}
<rect x="32" y="217" width="656" height="112" rx="12" fill="${p.panel2}"/>${label(48, 239, t.identified, "eyebrow")}
<path d="M114 271H353" class="line" marker-end="url(#arrow)"/>${label(176, 261, t.events[2][1], "body")}
<path d="M360 302H599" class="line" marker-end="url(#arrow)"/>${label(389, 292, t.events[3][1], "body")}
<path d="M606 329v27" class="line" marker-end="url(#arrow)"/>
${card(470, 363, 218, 39, p)}${label(486, 388, t.events[4][1], "body")}
</svg>`
}
function sequenceMobile(p: Palette) {
  const rows = visitorText.events
    .map(([actor, message], i) => {
      const y = 35 + i * 90
      return `${card(28, y, 304, 74, p)}<circle cx="18" cy="${y + 18}" r="11" fill="${p.accent}"/><text x="18" y="${y + 22}" text-anchor="middle" font-size="10" font-weight="700" fill="${p.bg}">${String(i + 1).padStart(2, "0")}</text>${label(43, y + 27, actor.toUpperCase(), "eyebrow")}${label(43, y + 54, message, "body")}`
    })
    .join("")
  return `${start("From anonymous visit to known contact", visitorDescription, 350, 495, p)}<path d="M18 53v395" class="line"/>${rows}</svg>`
}
for (const [name, p] of Object.entries(themes)) {
  write(`context-graph-${name}.svg`, graph(p))
  write(`context-graph-mobile-${name}.svg`, graphMobile(p))
  write(`visitor-sequence-${name}.svg`, sequence(p))
  write(`visitor-sequence-mobile-${name}.svg`, sequenceMobile(p))
}
