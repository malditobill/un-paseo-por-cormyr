// Caminos, fronteras y zonas del mapa (2026-11-23). Dibuja web/mapa/trazos.json dentro de un SVG en píxeles
// del mapa base. Lo usan mapa.js (sitio) y editor.js (copia local).
//
// trazos.json = { capas: [{ id, nombre, visible }], trazos: [trazo] }
// trazo = { id, capa, tipo: "linea" | "zona", clase, nombre, desc, u, color, ancho, trazo: "lleno" | "puntos" | "rayas",
//           relleno, opacidad, nodos: [{ p: [x, y], a: [x, y] | null, b: [x, y] | null }] }
//   p = punto de la curva; a = manija de entrada; b = manija de salida (Bézier cúbica). Sin manijas = tramo recto.
window.MAPA_TRAZOS = (function () {
  const NS = "http://www.w3.org/2000/svg"
  const CLASES = {
    "camino-principal": { txt: "Camino principal", color: "#b08d3c", ancho: 3, trazo: "lleno" },
    "camino-secundario": { txt: "Camino secundario", color: "#b08d3c", ancho: 2, trazo: "rayas" },
    sendero: { txt: "Sendero", color: "#8a6a1f", ancho: 1.6, trazo: "puntos" },
    frontera: { txt: "Frontera", color: "#3d3265", ancho: 2, trazo: "rayas" },
    rio: { txt: "Río", color: "#3d3265", ancho: 2, trazo: "lleno" },
    zona: { txt: "Zona", color: "#6b2a3a", ancho: 1.5, trazo: "rayas", relleno: "#6b2a3a", opacidad: 0.22 },
  }
  const TIPO_TXT = Object.fromEntries(Object.entries(CLASES).map(([k, v]) => [k, v.txt]))
  TIPO_TXT.linea = "Camino"

  const f = (n) => Math.round(n * 10) / 10
  // camino SVG de una lista de nodos
  function d(nodos, cerrado) {
    if (!nodos.length) return ""
    let s = `M${f(nodos[0].p[0])} ${f(nodos[0].p[1])}`
    const tramo = (A, B) => {
      const c1 = A.b || A.p, c2 = B.a || B.p
      s += A.b || B.a
        ? ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(B.p[0])} ${f(B.p[1])}`
        : ` L${f(B.p[0])} ${f(B.p[1])}`
    }
    for (let i = 1; i < nodos.length; i++) tramo(nodos[i - 1], nodos[i])
    if (cerrado && nodos.length > 2) { tramo(nodos[nodos.length - 1], nodos[0]); s += " Z" }
    return s
  }
  function guiones(t) {
    const w = +t.ancho || 2
    if (t.trazo === "puntos") return `0 ${f(w * 2.6)}`
    if (t.trazo === "rayas") return `${f(w * 4)} ${f(w * 3)}`
    return ""
  }
  function el(tag, attrs, padre) {
    const e = document.createElementNS(NS, tag)
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== "") e.setAttribute(k, attrs[k])
    if (padre) padre.appendChild(e)
    return e
  }
  // dibuja todo (menos la capa de herramientas del editor, que se conserva)
  function dibujar(svg, datos, opts = {}) {
    ;[...svg.children].forEach((c) => { if (c.id !== "ed-ui") c.remove() })
    const ui = svg.querySelector("#ed-ui")
    svg.classList.toggle("editando", !!opts.editar)
    for (const capa of datos.capas) {
      const g = el("g", { class: "capa", "data-capa": capa.id })
      if (capa.visible === false) g.style.display = "none"
      g.classList.add("capa-" + capa.id)
      for (const t of datos.trazos.filter((x) => x.capa === capa.id)) {
        const zona = t.tipo === "zona"
        const gt = el("g", { class: `trazo trazo-${t.tipo}`, "data-id": t.id, "data-nombre": t.nombre || "" }, g)
        const camino = d(t.nodos, zona)
        if (zona) el("path", { class: "relleno", d: camino, fill: t.relleno || t.color, "fill-opacity": t.opacidad ?? 0.22, stroke: "none" }, gt)
        el("path", {
          class: "vis", d: camino, fill: "none", stroke: t.color || "#b08d3c", "stroke-width": t.ancho || 2,
          "stroke-dasharray": guiones(t), "stroke-linecap": "round", "stroke-linejoin": "round",
        }, gt)
        el("path", { class: "hit", d: camino, fill: zona && opts.editar ? "transparent" : "none", stroke: "transparent",
          "stroke-width": Math.max(14, (t.ancho || 2) + 10) }, gt)
      }
      svg.insertBefore(g, ui || null)
    }
  }
  // muestra chica para las referencias
  function muestra(t) {
    if (!t) return '<span class="ref-ic"></span>'
    const w = Math.min(+t.ancho || 2, 3.5)
    const dash = t.trazo === "puntos" ? `0 ${f(w * 2.6)}` : t.trazo === "rayas" ? `${f(w * 3)} ${f(w * 2.2)}` : ""
    const cuerpo = t.tipo === "zona"
      ? `<rect x="3" y="5" width="18" height="14" rx="2" fill="${t.relleno || t.color}" fill-opacity="${t.opacidad ?? 0.22}" stroke="${t.color}" stroke-width="1.4" stroke-dasharray="${dash}"/>`
      : `<path d="M2 16 C8 4 16 20 22 8" fill="none" stroke="${t.color}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${dash}"/>`
    return `<span class="ref-ic"><svg viewBox="0 0 24 24" width="20" height="20">${cuerpo}</svg></span>`
  }
  return { CLASES, TIPO_TXT, d, guiones, dibujar, muestra, el, NS }
})()
