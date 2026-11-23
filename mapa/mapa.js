// Mapa interactivo del reino (2026-11-23). Se carga en todas las páginas (lo inyecta scripts/web/mapa.py),
// pero solo trabaja donde hay un <div id="mapa-reino">. Leaflet (BSD-2) se carga recién ahí.
// Funciona con la navegación sin recarga de Quartz: escucha el evento "nav".
(function () {
  const BASE = document.currentScript.src.replace(/mapa\.js(\?.*)?$/, "") // …/mapa/
  const V = (document.currentScript.src.match(/\?v=([\w-]+)/) || [])[1] || ""
  const conV = (u) => (V ? u + "?v=" + V : u)
  const RAIZ = BASE.replace(/mapa\/$/, "")
  const W = 6144, H = 4096, Z = 5
  const TIPOS = { region: "Región", paraje: "Paraje" } // el resto, desde iconos.js
  const CAPAS = [
    ["Ciudades", ["capital", "ciudad", "arrasada"]],
    ["Pueblos y aldeas", ["pueblo", "aldea", "caserio"]],
    ["Castillos, ruinas y otros lugares", ["castillo", "ruina", "templo", "sitio"]],
    ["Regiones y parajes", ["region", "paraje"]],
    ["Fuera del reino", ["extranjera"]],
  ]
  let leaflet = null

  function cargar(tag, attrs) {
    return new Promise((ok, mal) => {
      const e = document.createElement(tag)
      Object.assign(e, attrs)
      e.onload = ok
      e.onerror = mal
      document.head.appendChild(e)
    })
  }
  function cargarLeaflet() {
    if (!leaflet) {
      leaflet = Promise.all([
        cargar("link", { rel: "stylesheet", href: conV(BASE + "leaflet/leaflet.css") }),
        cargar("link", { rel: "stylesheet", href: conV(BASE + "mapa.css") }),
        cargar("script", { src: conV(BASE + "leaflet/leaflet.js") }),
        cargar("script", { src: conV(BASE + "iconos.js") }),
      ])
    }
    return leaflet
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

  function armar(el, lugares) {
    el.innerHTML = ""
    const lienzo = document.createElement("div")
    lienzo.className = "mapa-lienzo"
    const barra = document.createElement("div")
    barra.className = "mapa-barra"
    barra.innerHTML =
      '<input type="search" class="mapa-buscar" placeholder="Buscar un lugar…" list="mapa-lista" aria-label="Buscar un lugar">' +
      '<datalist id="mapa-lista">' + lugares.map((l) => `<option value="${esc(l.n)}">`).join("") + "</datalist>" +
      '<button type="button" class="mapa-completa" aria-pressed="false">Pantalla completa</button>'
    el.append(barra, lienzo)

    const map = L.map(lienzo, { crs: L.CRS.Simple, zoomSnap: 0, zoomDelta: 0.5, wheelPxPerZoomLevel: 120, attributionControl: false })
    const lim = L.latLngBounds(map.unproject([0, H], Z), map.unproject([W, 0], Z))
    L.tileLayer(conV(BASE + "teselas/{z}/{x}_{y}.webp"), {
      minZoom: 0, maxNativeZoom: Z, maxZoom: Z + 2, bounds: lim, noWrap: true,
    }).addTo(map)
    map.fitBounds(lim)
    map.setMinZoom(map.getZoom())
    map.setMaxZoom(Z + 1.5)
    map.setMaxBounds(lim.pad(0.05))

    const grupos = {}, porNombre = {}
    const control = L.control.layers(null, null, { collapsed: true, position: "topright" })
    for (const [titulo, tipos] of CAPAS) {
      const g = L.layerGroup().addTo(map)
      tipos.forEach((t) => (grupos[t] = g))
      control.addOverlay(g, titulo)
    }
    control.addTo(map)

    const ICONOS = window.MAPA_ICONOS || {}
    for (const k in ICONOS) TIPOS[k] = ICONOS[k][1]
    for (const l of lugares) {
      const ic = ICONOS[l.t]
      const area = !ic
      const s = ic ? ic[0] : 0
      const icono = L.divIcon({
        className: `lugar lugar-${l.t}`,
        html: area ? `<span class="et">${esc(l.n)}</span>` : `<span class="pt">${ic[2]}</span><span class="et">${esc(l.n)}</span>`,
        iconSize: area ? null : [s, s],
        iconAnchor: area ? null : [s / 2, s / 2],
      })
      const m = L.marker(map.unproject([l.x, l.y], Z), { icon: icono, title: l.n, riseOnHover: true })
      let html = `<div class="mapa-popup"><b>${esc(l.n)}</b><small>${TIPOS[l.t] || ""}</small>`
      if (l.r) html += `<p>${esc(l.r)}</p>`
      if (l.u) html += `<a href="${RAIZ}${encodeURI(l.u)}" class="internal">Leer el artículo →</a>`
      html += "</div>"
      m.bindPopup(html, { minWidth: 240, maxWidth: 300, autoPanPadding: [30, 30] })
      m.addTo(grupos[l.t])
      porNombre[l.n.toLowerCase()] = m
    }

    // Qué se ve según el acercamiento: de lejos, regiones y ciudades; de cerca, todo.
    const zonas = () => {
      const z = map.getZoom() - map.getMinZoom()
      lienzo.classList.toggle("ver-pueblos", z >= 0.75)
      lienzo.classList.toggle("ver-parajes", z >= 1.25)
      lienzo.classList.toggle("lejos", map.getZoom() < 1.75) // mapa chico (pantallas angostas): letras menores
    }
    map.on("zoomend", zonas)
    zonas()

    // Referencias: un recuadro en la barra derecha (pantallas anchas) y, en pantallas angostas, dentro del mapa.
    // Tocar una referencia muestra u oculta ese tipo de lugar.
    const presentes = new Set(lugares.map((l) => l.t))
    const ORDEN = [
      ["Asentamientos", ["capital", "ciudad", "arrasada", "pueblo", "aldea", "caserio"]],
      ["Otros lugares", ["castillo", "ruina", "templo", "sitio", "extranjera"]],
      ["Nombres", ["region", "paraje"]],
    ]
    const muestra = (t) => ICONOS[t]
      ? `<span class="ref-ic">${ICONOS[t][2]}</span>`
      : `<span class="ref-ic ref-txt ref-${t}">${t === "region" ? "AB" : "Ab"}</span>`
    let refHtml = '<h3 class="ref-titulo">Referencias</h3>'
    for (const [g, ts] of ORDEN) {
      const usados = ts.filter((t) => presentes.has(t))
      if (!usados.length) continue
      refHtml += `<p class="ref-grupo">${g}</p><ul>` + usados.map((t) =>
        `<li><button type="button" data-tipo="${t}" aria-pressed="true">${muestra(t)}<span>${esc(TIPOS[t] || t)}</span></button></li>`).join("") + "</ul>"
    }
    const alternar = (t) => {
      const oculto = lienzo.classList.toggle("sin-" + t)
      document.querySelectorAll(`.mapa-ref button[data-tipo="${t}"]`).forEach((b) => b.setAttribute("aria-pressed", String(!oculto)))
    }
    const conectar = (raiz) => raiz.querySelectorAll("button[data-tipo]").forEach((b) => b.addEventListener("click", () => alternar(b.dataset.tipo)))
    const barraDer = document.querySelector(".sidebar.right")
    if (barraDer) {
      barraDer.querySelector(".mapa-referencias")?.remove()
      const caja = document.createElement("div")
      caja.className = "mapa-referencias mapa-ref"
      caja.innerHTML = refHtml
      const toc = barraDer.querySelector(".toc")
      toc ? toc.after(caja) : barraDer.appendChild(caja)
      conectar(caja)
    }
    const RefControl = L.Control.extend({
      onAdd() {
        const d = L.DomUtil.create("details", "mapa-ref mapa-ref-control")
        d.innerHTML = "<summary>Referencias</summary>" + refHtml.replace(/<h3[^>]*>.*?<\/h3>/, "")
        L.DomEvent.disableClickPropagation(d)
        L.DomEvent.disableScrollPropagation(d)
        conectar(d)
        return d
      },
    })
    new RefControl({ position: "bottomleft" }).addTo(map)

    const buscar = barra.querySelector(".mapa-buscar")
    buscar.addEventListener("change", () => {
      const m = porNombre[buscar.value.trim().toLowerCase()]
      if (!m) return
      map.flyTo(m.getLatLng(), Math.max(map.getZoom(), map.getMinZoom() + 1.5))
      map.once("moveend", () => m.openPopup())
    })
    const completa = barra.querySelector(".mapa-completa")
    completa.addEventListener("click", () => {
      const on = el.classList.toggle("pantalla-completa")
      completa.setAttribute("aria-pressed", on)
      completa.textContent = on ? "Salir de pantalla completa" : "Pantalla completa"
      setTimeout(() => map.invalidateSize(), 50)
    })
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && el.classList.contains("pantalla-completa")) completa.click()
    })
  }

  async function iniciar() {
    const el = document.getElementById("mapa-reino")
    if (!el || el.dataset.listo) return
    el.dataset.listo = "1"
    try {
      await cargarLeaflet()
      const lugares = await fetch(conV(BASE + "lugares.json")).then((r) => r.json())
      armar(el, lugares)
    } catch (e) {
      el.textContent = "No se pudo cargar el mapa."
      delete el.dataset.listo
    }
  }
  document.addEventListener("nav", iniciar)
  if (document.readyState !== "loading") iniciar()
  else document.addEventListener("DOMContentLoaded", iniciar)
})()
