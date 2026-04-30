;(() => {
  if (window.outlit?._loaded) return
  if (location.hostname !== "docs.outlit.ai") return

  const script = document.createElement("script")
  script.async = true
  script.src = "https://cdn.outlit.ai/stable/outlit.js"
  script.dataset.publicKey = "pk_K8WwRMwU8RoMCzcg3Dj25JNoIand-ifg"
  script.dataset.trackPageviews = "true"
  script.dataset.trackForms = "true"
  script.dataset.autoIdentify = "true"

  document.head.appendChild(script)
})()
