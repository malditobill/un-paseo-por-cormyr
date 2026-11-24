// Mapa interactivo del reino (2026-11-23). Se carga en todas las páginas (lo inyecta scripts/web/mapa.py),
// pero solo trabaja donde hay un <div id="mapa-reino">. Leaflet (BSD-2) se carga recién ahí.
// Funciona con la navegación sin recarga de Quartz: escucha el evento "nav".
(function () {
  const BASE = document.currentScript.src.replace(/mapa\.js(\?.*)?$/, "") // …/mapa/
  const V = (document.currentScript.src.match(/\?v=([\w-]+)/) || [])[1] || ""
  const conV = (u) => (V ? u + "?v=" + V : u)
  const RAIZ = BASE.replace(/mapa\/$/, "")
  const Z = 5
  let W = 6144, H = 4096 // se reemplazan con las medidas de lugares.json
  const TIPOS = { region: "Región mayor", region2: "Región menor", paraje: "Paraje" } // el resto, desde iconos.js
  // Estilos de fábrica por tipo de lugar; web/mapa/estilos.json (editor) los reemplaza.
  // zoom = nivel de zoom (escala) desde el que aparece; el mapa completo en la columna de la web se ve a ~2,3.
  const H0 = { contorno: true, contornoColor: "#faf7ee", contornoAncho: 2, rot: 0, espaciado: 0.02, cursiva: false, mayus: false, fuente: "Cormorant SC" }
  const ESTILOS_BASE = {
    capital: { ...H0, icono: "capital", tam: 38, tamTexto: 23, peso: 700, color: "#3d3265", zoom: 0, posicion: "abajo" },
    ciudad: { ...H0, icono: "ciudad", tam: 30, tamTexto: 21, peso: 700, color: "#3d3265", zoom: 0, posicion: "derecha" },
    arrasada: { ...H0, icono: "arrasada", tam: 30, tamTexto: 21, peso: 700, color: "#3d3265", zoom: 0, posicion: "derecha" },
    pueblo: { ...H0, icono: "pueblo", tam: 20, tamTexto: 18, peso: 600, color: "#262040", zoom: 3, posicion: "derecha" },
    aldea: { ...H0, icono: "aldea", tam: 15, tamTexto: 17, peso: 600, color: "#262040", zoom: 3.25, posicion: "derecha" },
    caserio: { ...H0, icono: "caserio", tam: 11, tamTexto: 16, peso: 500, color: "#262040", zoom: 3.75, posicion: "derecha" },
    castillo: { ...H0, icono: "castillo", tam: 24, tamTexto: 17, peso: 600, color: "#262040", zoom: 3.25, posicion: "derecha" },
    ruina: { ...H0, icono: "ruina", tam: 24, tamTexto: 17, peso: 600, color: "#262040", zoom: 3.5, posicion: "derecha" },
    templo: { ...H0, icono: "templo", tam: 22, tamTexto: 17, peso: 600, color: "#262040", zoom: 3.5, posicion: "derecha" },
    sitio: { ...H0, icono: "sitio", tam: 18, tamTexto: 17, peso: 600, color: "#262040", zoom: 3.5, posicion: "derecha" },
    extranjera: { ...H0, icono: "extranjera", tam: 20, tamTexto: 17, peso: 500, cursiva: true, color: "#5d5574", zoom: 2.75, posicion: "derecha" },
    region: { ...H0, icono: "", tam: 0, tamTexto: 22, peso: 700, mayus: true, espaciado: 0.14, color: "#5b2a6e", zoom: 0, posicion: "centro" },
    region2: { ...H0, icono: "", tam: 0, tamTexto: 16, peso: 600, mayus: true, espaciado: 0.1, color: "#5b2a6e", zoom: 2.5, posicion: "centro" },
    paraje: { ...H0, icono: "", tam: 0, tamTexto: 17, peso: 600, cursiva: true, espaciado: 0.04, color: "#4a3f78", zoom: 3.5, posicion: "centro" },
  }
  // tipografías del desplegable: [nombre, consulta de Google Fonts]
  const FUENTES = [
    ["Cormorant SC", "Cormorant+SC:wght@400;500;600;700"],
    ["Cormorant Garamond", "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600"],
    ["EB Garamond", "EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600"],
    ["Cinzel", "Cinzel:wght@400;500;600;700"],
    ["Cinzel Decorative", "Cinzel+Decorative:wght@400;700"],
    ["IM Fell English", "IM+Fell+English:ital@0;1"],
    ["IM Fell English SC", "IM+Fell+English+SC"],
    ["IM Fell DW Pica", "IM+Fell+DW+Pica:ital@0;1"],
    ["Uncial Antiqua", "Uncial+Antiqua"],
    ["MedievalSharp", "MedievalSharp"],
    ["Pirata One", "Pirata+One"],
  ]
  const fuentesCargadas = new Set()
  function cargarFuentes(lista) {
    const q = [...new Set(lista)].filter((f) => f && !fuentesCargadas.has(f)).map((f) => (FUENTES.find((x) => x[0] === f) || [])[1]).filter(Boolean)
    if (!q.length) return
    lista.forEach((f) => fuentesCargadas.add(f))
    const k = document.createElement("link")
    k.rel = "stylesheet"
    k.href = "https://fonts.googleapis.com/css2?" + q.map((x) => "family=" + x).join("&") + "&display=swap"
    document.head.appendChild(k)
  }
  const CAPAS = [
    ["Ciudades", ["capital", "ciudad", "arrasada"]],
    ["Pueblos y aldeas", ["pueblo", "aldea", "caserio"]],
    ["Castillos, ruinas y otros lugares", ["castillo", "ruina", "templo", "sitio"]],
    ["Regiones y parajes", ["region", "region2", "paraje"]],
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
        cargar("script", { src: conV(BASE + "trazos.js") }),
      ])
    }
    return leaflet
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

  function armar(el, datos, trazos, estilos) {
    const lugares = Array.isArray(datos) ? datos : datos.lugares
    if (!Array.isArray(datos)) { W = datos.w; H = datos.h }
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

    // Editor (dirección terminada en #editar): mover lugares y dibujar caminos, fronteras y zonas.
    // Solo en la copia local (localhost), servida por scripts/web/mapa_editor.py; en el sitio publicado no se activa.
    // #mover queda como modo simple de copiar y pegar posiciones.
    const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || window.MAPA_EDITOR_SERVIDOR === 1
    const EDITAR = LOCAL && location.hash === "#editar"
    const MOVER = LOCAL && (location.hash === "#mover" || EDITAR)
    const movidos = new Map()
    let panel = null
    if (MOVER && !EDITAR) {
      panel = document.createElement("div")
      panel.className = "mapa-mover"
      panel.innerHTML =
        "<p><b>Modo mover.</b> Arrastrá cada lugar a su posición correcta (se ven todos, a cualquier zoom). " +
        "Cuando termines, copiá los cambios y pegáselos a Claude.</p>" +
        '<textarea readonly rows="6" aria-label="Posiciones nuevas" placeholder="Todavía no moviste nada."></textarea>' +
        '<div class="mapa-mover-botones"><button type="button" class="mover-copiar">Copiar cambios</button>' +
        '<span class="mover-estado" role="status"></span></div>'
      el.append(panel)
      panel.querySelector(".mover-copiar").addEventListener("click", () => {
        const ta = panel.querySelector("textarea"), est = panel.querySelector(".mover-estado")
        const ok = () => (est.textContent = `Copiado: ${movidos.size} lugar(es).`)
        const mal = () => { ta.select(); est.textContent = "Seleccioné el texto: copialo con Ctrl+C." }
        try { navigator.clipboard.writeText(ta.value).then(ok, mal) } catch (e) { mal() }
      })
    }
    const mostrarMovidos = () => {
      panel.querySelector("textarea").value = [...movidos].map(([n, [x, y]]) => `${n}\t${x}\t${y}`).join("\n")
      panel.querySelector(".mover-estado").textContent = `${movidos.size} lugar(es) movido(s).`
    }

    let verTodo = false
    const capaTrazos = { alternarZona() {} } // se completa más abajo, cuando se dibujan los trazos
    const map = L.map(lienzo, { crs: L.CRS.Simple, zoomSnap: 0, zoomDelta: 0.5, wheelPxPerZoomLevel: 120, attributionControl: false })
    const lim = L.latLngBounds(map.unproject([0, H], Z), map.unproject([W, 0], Z))
    L.tileLayer(conV(BASE + "teselas/{z}/{x}_{y}.webp"), {
      minZoom: 0, maxNativeZoom: Z, maxZoom: Z + 2, bounds: lim, noWrap: true,
    }).addTo(map)
    map.fitBounds(lim)
    map.setMinZoom(map.getZoom())
    map.setMaxZoom(Z + 1.5)
    map.setMaxBounds(lim.pad(0.05))
    // si cambia el tamaño del marco (p. ej. «ancho completo»), el zoom mínimo se recalcula; si estaba en la vista
    // completa, se vuelve a encuadrar el mapa entero
    if (!EDITAR) map.on("resize", () => {
      const enVistaCompleta = map.getZoom() - map.getMinZoom() < 0.05
      map.setMinZoom(0)
      map.setMinZoom(map.getBoundsZoom(lim))
      if (enVistaCompleta) map.fitBounds(lim)
    })

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
    // Estilos por tipo (web/mapa/estilos.json sobre los de fábrica) y ajustes por lugar (rot, dx, dy).
    const E = {}
    for (const t in ESTILOS_BASE) E[t] = Object.assign({ nombre: TIPOS[t] || t }, ESTILOS_BASE[t], (estilos || {})[t] || {})
    for (const t in E) TIPOS[t] = E[t].nombre
    const estiloCss = document.createElement("style")
    el.appendChild(estiloCss)
    cargarFuentes(EDITAR ? FUENTES.map((f) => f[0]) : Object.values(E).map((e) => e.fuente))
    const POS = {
      derecha: ["calc(100% + 4px)", "50%", "translate(0,-50%)", "left center"],
      izquierda: ["-4px", "50%", "translate(-100%,-50%)", "right center"],
      abajo: ["50%", "calc(100% + 2px)", "translate(-50%,0)", "center top"],
      arriba: ["50%", "-2px", "translate(-50%,-100%)", "center bottom"],
      centro: ["50%", "50%", "translate(-50%,-50%)", "center"],
    }
    const halo = (e) => {
      if (!e.contorno) return "none"
      const w = +e.contornoAncho || 2, c = e.contornoColor || "#faf7ee", out = []
      for (let a = 0; a < 360; a += 30) out.push(`${(Math.cos((a * Math.PI) / 180) * w).toFixed(2)}px ${(Math.sin((a * Math.PI) / 180) * w).toFixed(2)}px 0 ${c}`)
      out.push(`0 0 ${w + 2}px ${c}`)
      return out.join(",")
    }
    const aplicarCss = () => {
      let css = ""
      for (const t in E) {
        const e = E[t], p = POS[e.posicion] || POS.derecha
        css += `.lugar-${t} .et{font-family:"${e.fuente}",Georgia,serif;--fs:${e.tamTexto}px;font-size:var(--fs);` +
          `font-weight:${e.peso};font-style:${e.cursiva ? "italic" : "normal"};text-transform:${e.mayus ? "uppercase" : "none"};` +
          `letter-spacing:${e.espaciado}em;color:${e.color};text-shadow:${halo(e)};left:${p[0]};top:${p[1]};transform-origin:${p[3]}}` +
          `.mapa-lienzo.lejos .lugar-${t} .et{font-size:calc(var(--fs)*.62)!important}` +
          `.mapa-lienzo.oz-${t} .lugar-${t}{display:none}\n`
      }
      estiloCss.textContent = css
    }
    // transformación del nombre: posición del tipo + corrimiento y giro propios (y giro del tipo)
    const etTransform = (l) => {
      const e = E[l.t] || {}, p = POS[e.posicion] || POS.derecha
      return `${p[2]} translate(${l.dx || 0}px,${l.dy || 0}px) rotate(${(+e.rot || 0) + (+l.rot || 0)}deg)`
    }
    const crearIcono = (l) => {
      const e = E[l.t] || {}, ic = e.icono && ICONOS[e.icono]
      const s = ic ? +e.tam || ic[0] : 0
      return L.divIcon({
        className: `lugar lugar-${l.t}`,
        html: `${ic ? `<span class="pt">${ic[2]}</span>` : ""}<span class="et" style="transform:${etTransform(l)}">${esc(l.n)}</span>`,
        iconSize: [s, s],
        iconAnchor: [s / 2, s / 2],
      })
    }
    const marcas = []
    const agregarMarca = (l) => {
      const m = L.marker(map.unproject([l.x, l.y], Z), { icon: crearIcono(l), title: l.n, riseOnHover: true, draggable: MOVER })
      if (MOVER) {
        m.on("dragend", () => {
          const p = map.project(m.getLatLng(), Z)
          l.x = Math.round(p.x); l.y = Math.round(p.y)
          movidos.set(l.n, [l.x, l.y])
          if (panel) mostrarMovidos()
          if (EDITAR) document.dispatchEvent(new CustomEvent("mapa-movido", { detail: { n: l.n, x: l.x, y: l.y } }))
        })
      }
      if (EDITAR) {
        m.on("click", () => document.dispatchEvent(new CustomEvent("mapa-lugar-elegido", { detail: l })))
      } else {
        let html = `<div class="mapa-popup"><b>${esc(l.n)}</b><small>${esc(TIPOS[l.t] || "")}</small>`
        if (l.r) html += `<p>${esc(l.r)}</p>`
        if (l.u) html += `<a href="${RAIZ}${encodeURI(l.u)}" class="internal">Leer el artículo →</a>`
        html += "</div>"
        m.bindPopup(html, { minWidth: 240, maxWidth: 300, autoPanPadding: [30, 30] })
      }
      m.addTo(grupos[l.t] || grupos.pueblo)
      porNombre[l.n.toLowerCase()] = m
      marcas.push({ l, m })
      if (l.t === "region" || l.t === "region2" || l.t === "paraje") m.on("click", () => capaTrazos.alternarZona(l.n))
      return m
    }
    lugares.forEach(agregarMarca)
    aplicarCss()
    const aplicarEstilos = () => {
      for (const t in E) TIPOS[t] = E[t].nombre
      aplicarCss()
      marcas.forEach(({ l, m }) => m.setIcon(crearIcono(l)))
      zonas()
    }
    const moverNombre = (l) => {
      const x = marcas.find((k) => k.l === l)
      const et = x && x.m.getElement() && x.m.getElement().querySelector(".et")
      if (et) et.style.transform = etTransform(l)
    }

    // Caminos, fronteras y zonas (web/mapa/trazos.json): un solo SVG en píxeles del mapa base.
    const T = window.MAPA_TRAZOS
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    svg.classList.add("mapa-trazos")
    L.svgOverlay(svg, lim, { interactive: false, pane: "overlayPane" }).addTo(map)
    const datosTrazos = trazos || { capas: [], trazos: [] }
    const zonaActiva = new Set(), capasOcultas = new Set()
    const pintar = () => {
      cargarFuentes(datosTrazos.trazos.map((t) => t.rotulo && t.rotulo.activo && t.rotulo.fuente).filter(Boolean))
      T.dibujar(svg, datosTrazos, { editar: EDITAR, escala: 2 ** (map.getZoom() - Z), zoom: map.getZoom(), todo: verTodo })
      capasOcultas.forEach((id) => svg.querySelectorAll(`.capa[data-capa="${id}"]`).forEach((g) => (g.style.display = "none")))
      svg.querySelectorAll(".trazo-zona").forEach((g) => g.classList.toggle("activa", zonaActiva.has(g.dataset.nombre)))
      // nombres de regiones con zona: en granate
      lienzo.querySelectorAll(".lugar-region, .lugar-region2, .lugar-paraje").forEach((e) =>
        e.classList.toggle("con-zona", datosTrazos.trazos.some((t) => t.tipo === "zona" && t.nombre === e.title)))
    }
    capaTrazos.alternarZona = (nombre) => {
      if (!datosTrazos.trazos.some((t) => t.tipo === "zona" && t.nombre === nombre)) return
      zonaActiva.has(nombre) ? zonaActiva.delete(nombre) : zonaActiva.add(nombre)
      pintar()
    }
    capaTrazos.datos = datosTrazos
    capaTrazos.pintar = pintar
    pintar()
    if (!EDITAR) map.on("zoomend", pintar) // el editor ya redibuja en cada zoom
    // tocar un camino o una frontera abre su ficha
    svg.addEventListener("click", (e) => {
      if (EDITAR) return
      const g = e.target.closest(".trazo")
      if (!g) return
      const t = datosTrazos.trazos.find((x) => x.id === g.dataset.id)
      if (!t || (!t.nombre && !t.desc)) return
      L.DomEvent.stop(e)
      let html = `<div class="mapa-popup"><b>${esc(t.nombre || "")}</b><small>${esc(T.TIPO_TXT[t.clase || t.tipo] || "")}</small>`
      if (t.desc) html += `<p>${esc(t.desc)}</p>`
      if (t.u) html += `<a href="${RAIZ}${encodeURI(t.u)}" class="internal">Leer el artículo →</a>`
      html += "</div>"
      L.popup({ minWidth: 240, maxWidth: 300 }).setLatLng(map.mouseEventToLatLng(e)).setContent(html).openOn(map)
      if (t.tipo === "zona") capaTrazos.alternarZona(t.nombre)
    })

    // Qué se ve según el acercamiento: de lejos, regiones y ciudades; de cerca, todo.
    // Visibilidad por escala real del mapa (nivel de zoom de Leaflet), no por el tamaño de la ventana:
    // así el editor muestra exactamente lo que se ve en la web al mismo zoom. «Mostrar todo» es solo del editor.
    function zonas() {
      const z = map.getZoom()
      for (const t in E) lienzo.classList.toggle("oz-" + t, !verTodo && z < (+E[t].zoom || 0))
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
      ["Nombres", ["region", "region2", "paraje"]],
    ]
    const muestra = (t) => ICONOS[t]
      ? `<span class="ref-ic">${ICONOS[t][2]}</span>`
      : `<span class="ref-ic ref-txt ref-${t}">${t === "region" ? "AB" : t === "region2" ? "ab" : "Ab"}</span>`
    let refHtml = '<h3 class="ref-titulo">Referencias</h3>'
    for (const [g, ts] of ORDEN) {
      const usados = ts.filter((t) => presentes.has(t))
      if (!usados.length) continue
      refHtml += `<p class="ref-grupo">${g}</p><ul>` + usados.map((t) =>
        `<li><button type="button" data-tipo="${t}" aria-pressed="true">${muestra(t)}<span>${esc(TIPOS[t] || t)}</span></button></li>`).join("") + "</ul>"
    }
    const capasUsadas = datosTrazos.capas.filter((c) => c.visible !== false && datosTrazos.trazos.some((t) => t.capa === c.id))
    if (capasUsadas.length) {
      refHtml += '<p class="ref-grupo">Caminos, fronteras y zonas</p><ul>' + capasUsadas.map((c) => {
        const ej = datosTrazos.trazos.find((t) => t.capa === c.id)
        return `<li><button type="button" data-capa="${esc(c.id)}" aria-pressed="true">${T.muestra(ej, datosTrazos)}<span>${esc(c.nombre)}</span></button></li>`
      }).join("") + "</ul>"
    }
    const alternar = (t) => {
      const oculto = lienzo.classList.toggle("sin-" + t)
      document.querySelectorAll(`.mapa-ref button[data-tipo="${t}"]`).forEach((b) => b.setAttribute("aria-pressed", String(!oculto)))
    }
    const alternarCapa = (id) => {
      const oculto = !capasOcultas.has(id)
      oculto ? capasOcultas.add(id) : capasOcultas.delete(id)
      pintar()
      document.querySelectorAll(`.mapa-ref button[data-capa="${id}"]`).forEach((b) => b.setAttribute("aria-pressed", String(!oculto)))
    }
    const conectar = (raiz) => {
      raiz.querySelectorAll("button[data-tipo]").forEach((b) => b.addEventListener("click", () => alternar(b.dataset.tipo)))
      raiz.querySelectorAll("button[data-capa]").forEach((b) => b.addEventListener("click", () => alternarCapa(b.dataset.capa)))
    }
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
      if (e.key === "Escape" && el.classList.contains("pantalla-completa") && !EDITAR) completa.click()
    })
    return { map, svg, lienzo, el, W, H, Z, datos: datosTrazos, lugares, pintar, porNombre, EDITAR, E, aplicarEstilos, moverNombre, marcas, ICONOS, FUENTES, POS, agregarMarca, crearIcono,
      verTodo: (v) => { if (v === undefined) return verTodo; verTodo = !!v; zonas(); pintar() } }
  }

  async function iniciar() {
    const el = document.getElementById("mapa-reino")
    if (!el || el.dataset.listo) return
    el.dataset.listo = "1"
    try {
      await cargarLeaflet()
      const datos = await fetch(conV(BASE + "lugares.json")).then((r) => r.json())
      const opc = (n) => fetch(conV(BASE + n)).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      const [trazos, estilos] = await Promise.all([opc("trazos.json"), opc("estilos.json")])
      const ctx = armar(el, datos, trazos, estilos)
      if (ctx.EDITAR) {
        await cargar("script", { src: BASE + "editor.js?t=" + Date.now() })
        window.MAPA_EDITOR.iniciar(ctx)
      }
    } catch (e) {
      el.textContent = "No se pudo cargar el mapa."
      delete el.dataset.listo
    }
  }
  document.addEventListener("nav", iniciar)
  if (document.readyState !== "loading") iniciar()
  else document.addEventListener("DOMContentLoaded", iniciar)
})()
