// Generador de encuentros aleatorios (2026-11-25). Lo inyecta scripts/web/encuentros.py en todas las páginas,
// pero solo trabaja donde hay un <div class="encuentros"> (data-region="Stonelands" lo fija a una región).
// Datos: encuentros/datos.json (compilado por scripts/encuentros/compilar.py). Navegación SPA de Quartz: evento "nav".
(function () {
  const BASE = document.currentScript.src.replace(/encuentros\.js(\?.*)?$/, "")
  const V = (document.currentScript.src.match(/\?v=([\w-]+)/) || [])[1] || ""
  const RAIZ = BASE.replace(/encuentros\/$/, "")
  let DATOS = null

  // ── azar ──
  const d = (n) => 1 + Math.floor(Math.random() * n)
  function dados(expr) {
    // «2d4+2», «1-4», «3», «10d10»
    expr = String(expr || "1").replace(/\s/g, "").replace(/[–—]/g, "-")
    let m = expr.match(/^(\d+)-(\d+)$/)
    if (m) return +m[1] + Math.floor(Math.random() * (+m[2] - +m[1] + 1))
    m = expr.match(/^(\d*)d(\d+)([+-]\d+)?(?:x(\d+))?$/)
    if (m) {
      let t = 0
      for (let i = 0; i < (+m[1] || 1); i++) t += d(+m[2])
      return (t + (+m[3] || 0)) * (+m[4] || 1)
    }
    return parseInt(expr) || 1
  }
  function elegir(lista, peso = (x) => x.peso || 1) {
    const tot = lista.reduce((a, x) => a + peso(x), 0)
    let r = Math.random() * tot
    for (const x of lista) if ((r -= peso(x)) <= 0) return x
    return lista[lista.length - 1]
  }
  const PESO_FREC = { "común": 10, "poco común": 4, "raro": 1, "muy raro": 0.25 }

  // ── nivel de encuentro (DMG 3.5): cada duplicación de criaturas suma 2 ──
  function vdNum(vd) {
    vd = String(vd).trim()
    const f = { "1/2": -1, "1/3": -2, "1/4": -3, "1/6": -4, "1/8": -5, "1/10": -6 }
    if (vd in f) return f[vd]
    return parseFloat(vd) || 0
  }
  function ne(grupos) {
    // grupos: [[vd, cantidad], …]
    const p = grupos.reduce((a, [vd, n]) => a + n * Math.pow(2, vdNum(vd) / 2), 0)
    return p > 0 ? Math.max(1, Math.round(2 * Math.log2(p))) : 0
  }
  function dificultad(ne, ng) {
    const x = ne - ng
    if (x <= -5) return ["trivial", "facil"]
    if (x <= -1) return ["fácil", "facil"]
    if (x === 0) return ["desafiante", "justo"]
    if (x <= 2) return ["difícil", "dificil"]
    if (x <= 4) return ["muy difícil", "dificil"]
    return ["abrumador", "letal"]
  }

  // ── distancia de avistamiento por terreno (DMG 3.5), en metros ──
  const DIST = { llanura: "6d6x6", desierto: "6d6x6", colina: "2d10x3", montana: "4d10x3", bosque: "2d8x3", pantano: "2d8x3", agua: "6d6x6", subterraneo: "2d6x3", ciudad: "1d6x3" }
  const ACTIVIDAD = ["en marcha, de paso", "cazando o buscando comida", "acampados o en su guarida", "comiendo o descansando", "siguiendo el rastro del grupo", "peleando con otra cosa", "vigilando un paso o un punto alto", "durmiendo (si es de día y son nocturnos) o al acecho"]
  const ACTITUD = [[4, "hostil"], [9, "inamistosa"], [15, "indiferente"], [18, "amistosa"], [20, "servicial"]]
  const actitud = () => { const r = d(20); return ACTITUD.find(([t]) => r <= t)[1] }

  // ── tiradas ──
  function criaturaDe(ref) { return (DATOS.criaturas || {})[ref] || null }

  function resolverCriatura(ent, ctx, contexto) {
    const c = criaturaDe(ent.ref) || { nombre: ent.nombre || ent.ref, vd: ent.vd || "1", grupos: [] }
    const ng = ctx.ng
    // grupos posibles: los de la criatura (sin tribus ni campamentos enteros), o la cantidad de la tabla
    let grupos = (c.grupos || []).filter((g) => !g.guarida)
    if (ent.cantidad) grupos = [{ nombre: "", cantidad: ent.cantidad }]
    if (!grupos.length) grupos = [{ nombre: "", cantidad: "1" }]
    // del más chico al más grande; se prueba al azar y se achica si se pasa
    let g = elegir(grupos, (x) => x.peso || 1), n = dados(g.cantidad), el = ne([[c.vd, n]])
    const orden = grupos.slice().sort((a, b) => dados(a.cantidad) - dados(b.cantidad))
    for (let i = 0; el > ng + 3 && i < orden.length; i++) { g = orden[i]; n = dados(g.cantidad); el = ne([[c.vd, n]]) }
    while (el > ng + 3 && n > 1) { n--; el = ne([[c.vd, n]]) }
    const [dif, clase] = dificultad(el, ng)
    const lejos = el > ng + 4
    const terreno = ctx.terreno
    const dist = dados(DIST[terreno] || "2d10x3")
    return {
      tipo: lejos ? "avistamiento" : "criatura",
      titulo: `${n} ${n === 1 ? c.nombre : c.plural || c.nombre}` + (g.nombre ? ` (${g.nombre.toLowerCase()})` : ""),
      enlace: c.pagina,
      lineas: [
        `VD ${c.vd} cada uno · NE ${el} · <b class="enc-${clase}">${dif}</b> para el grupo (NG ${ng})`,
        lejos ? `Demasiado para el grupo: se los ve a lo lejos, a unos ${dist * 4} m, y todavía no los vieron. Se puede evitar el encuentro.`
              : `Distancia: unos ${dist} m · ${ACTIVIDAD[d(ACTIVIDAD.length) - 1]} · actitud ${actitud()}`,
        g.nota ? g.nota : "",
        ent.nota ? ent.nota : "",
        c.pagina ? "" : `<span class="enc-pend">Hoja de juego pendiente en el bestiario.</span>`,
      ],
      fuente: ent.fuente,
    }
  }

  function resolverPerfil(p, ctx) {
    return {
      tipo: "viajeros",
      titulo: p.nombre,
      enlace: p.pagina,
      lineas: [p.descripcion, p.composicion ? `<b>Composición:</b> ${p.composicion}` : "", `Actitud inicial: ${p.actitud && p.actitud !== "variable" ? p.actitud : actitud()}`],
      fuente: p.fuentes,
    }
  }

  function perfilesPara(ctx) {
    const todos = Object.values(DATOS.perfiles || {})
    return todos.filter((p) => (p.donde || []).some((w) => (w.region === ctx.region || w.region === "Cormyr") && (!w.contexto || w.contexto === ctx.contexto || ctx.contexto === "camino" && w.contexto === "campo"))
      && (!p.hora || p.hora === "ambas" || p.hora === ctx.hora) && (!p.epoca || p.epoca === "1374"))
  }

  function tirarCriatura(ctx) {
    const sec = (DATOS.sectores || {})[ctx.sector]
    let tabla = sec && (sec.tablas[ctx.hora] || sec.tablas.dia)
    const base = ((DATOS.base || {})[ctx.terreno] || {})[ctx.hora === "noche" ? "noche" : "dia"] || []
    // capa de la región (70 %) y base del terreno (30 %)
    if (!tabla || !tabla.length || (base.length && Math.random() < 0.3)) tabla = base
    if (!tabla.length) return { tipo: "nada", titulo: "Sin tabla para este terreno todavía", lineas: [] }
    const ent = elegir(tabla, (x) => x.peso || PESO_FREC[x.frecuencia] || 1)
    if (ent.perfil && DATOS.perfiles[ent.perfil]) return resolverPerfil(DATOS.perfiles[ent.perfil], ctx)
    if (ent.viajeros) {
      const ps = perfilesPara(ctx).filter((p) => p.tipo === ent.viajeros)
      if (ps.length) return resolverPerfil(elegir(ps, (p) => PESO_FREC[p.frecuencia] || 1), ctx)
      return tirarViajeros(ctx)
    }
    if (ent.compuesto) return resolverCompuesto(ent, ctx)
    if (ent.texto) return { tipo: "suceso", titulo: ent.nombre, lineas: [ent.texto], fuente: ent.fuente }
    return resolverCriatura(ent, ctx)
  }

  function resolverCompuesto(ent, ctx) {
    const partes = ent.compuesto.map((p) => ({ c: criaturaDe(p.ref) || { nombre: p.ref, vd: "1" }, n: dados(p.cantidad) }))
    const el = ne(partes.map((p) => [p.c.vd, p.n]))
    const [dif, clase] = dificultad(el, ctx.ng)
    const nom = (p) => {
      const t = `${p.n} ${p.n === 1 ? p.c.nombre : p.c.plural || p.c.nombre}`
      return p.c.pagina ? `<a class="internal" href="${RAIZ}${p.c.pagina}">${t}</a>` : t
    }
    return {
      tipo: el > ctx.ng + 4 ? "avistamiento" : "criatura",
      titulo: ent.nombre || "Grupo mixto",
      lineas: [partes.map(nom).join(", "), `NE ${el} · <b class="enc-${clase}">${dif}</b> para el grupo (NG ${ctx.ng})`,
               `Distancia: unos ${dados(DIST[ctx.terreno] || "2d10x3")} m · actitud ${actitud()}`, ent.nota || ""],
      fuente: ent.fuente,
    }
  }

  function tirarViajeros(ctx) {
    // primero el tipo de viajeros (tabla de caminos); después, un perfil propio de Cormyr de ese tipo en la región
    const ps = perfilesPara(ctx)
    const vs = DATOS.viajeros || []
    const v = vs.length ? elegir(vs) : null
    let cand = v && v.tipo ? ps.filter((p) => p.tipo === v.tipo) : []
    if (!cand.length && ps.length && (!v || Math.random() < 0.5)) cand = ps
    if (cand.length) return resolverPerfil(elegir(cand, (p) => PESO_FREC[p.frecuencia] || 1), ctx)
    if (v) return { tipo: "viajeros", titulo: v.nombre, lineas: [v.resumen] }
    return tirarCriatura(ctx)
  }

  function tirarDe(lista, tipo, ctx) {
    const ter = ctx.terreno === "subterraneo" || ctx.terreno === "ciudad" ? "colina" : ctx.terreno
    const xs = (lista || []).filter((x) => !x.pesos || x.pesos[ter])
    if (!xs.length) return tirarCriatura(ctx)
    const x = elegir(xs, (y) => (y.pesos ? y.pesos[ter] : y.peso || 1))
    return { tipo, titulo: x.nombre, lineas: [x.resumen || x.descripcion || ""] }
  }

  function bloque4h(ctx, forzar) {
    const m = (DATOS.master || {})[ctx.contexto === "camino" ? "camino" : "campo"] ||
      [{ hasta: 20, r: "criatura" }, { hasta: 25, r: "clima" }, { hasta: 30, r: "suceso" }, { hasta: 35, r: "viajeros" }, { hasta: 40, r: "doble" }, { hasta: 100, r: "nada" }]
    let r
    do { const x = d(100); r = m.find((e) => x <= e.hasta).r } while (forzar && r === "nada")
    if (r === "doble") return [bloque4h(ctx, true)[0], bloque4h(ctx, true)[0]]
    if (r === "nada") return [{ tipo: "nada", titulo: "Sin novedad", lineas: ["Cuatro horas tranquilas."] }]
    if (r === "criatura") return [tirarCriatura(ctx)]
    if (r === "viajeros") return [tirarViajeros(ctx)]
    if (r === "clima") return [tirarDe(DATOS.clima_terreno, "clima", ctx)]
    return [tirarDe(DATOS.sucesos, "suceso", ctx)]
  }

  // ── interfaz ──
  const ETIQ = { criatura: "Criatura", avistamiento: "Avistamiento", viajeros: "Viajeros", clima: "Clima y terreno", suceso: "Suceso", nada: "Sin novedad" }
  const esc = (s) => String(s == null ? "" : s)

  function tarjeta(res, hora) {
    const t = res.enlace ? `<a class="internal" href="${RAIZ}${res.enlace}">${esc(res.titulo)}</a>` : esc(res.titulo)
    return `<div class="enc-tarjeta enc-t-${res.tipo}"><div class="enc-cab"><span class="enc-etq">${ETIQ[res.tipo] || res.tipo}</span>` +
      (hora ? `<span class="enc-hora">${hora}</span>` : "") + `</div><div class="enc-titulo">${t}</div>` +
      res.lineas.filter(Boolean).map((l) => `<p>${l}</p>`).join("") +
      (res.fuente ? `<p class="enc-fuente">${esc(res.fuente)}</p>` : "") + `</div>`
  }

  function opciones(lista, sel) {
    return lista.map(([v, t]) => `<option value="${v}"${v === sel ? " selected" : ""}>${t}</option>`).join("")
  }

  function montar(div) {
    if (div.dataset.listo) return
    div.dataset.listo = "1"
    const fija = div.dataset.region || ""
    const regiones = Object.keys(DATOS.regiones).sort()
    const reg0 = fija && DATOS.regiones[fija] ? fija : regiones[0]
    div.innerHTML = `
      <div class="enc-panel">
        <div class="enc-fila">
          <label${fija ? ' hidden' : ''}>Región <select data-k="region">${opciones(regiones.map((r) => [r, DATOS.regiones[r].nombre || r]), reg0)}</select></label>
          <label>Zona <select data-k="sector"></select></label>
          <label>Por <select data-k="contexto">${opciones([["campo", "campo traviesa"], ["camino", "camino"]], "campo")}</select></label>
          <label>Hora <select data-k="hora">${opciones([["dia", "de día"], ["noche", "de noche"]], "dia")}</select></label>
        </div>
        <div class="enc-fila">
          <label>Nivel del grupo <input data-k="nivel" type="number" min="1" max="20" value="3"></label>
          <label>Personajes <input data-k="pjs" type="number" min="1" max="10" value="4"></label>
          <button data-a="forzar">Tirar un encuentro</button>
          <button data-a="4h">Viajar 4 horas</button>
          <button data-a="dia">Jornada de viaje</button>
          <button data-a="limpiar" class="enc-sec">Limpiar</button>
        </div>
      </div>
      <div class="enc-res"></div>` +
      (fija ? `<p class="enc-ayuda">Tablas de ${DATOS.regiones[reg0].nombre || reg0} según la zona, la hora y el nivel del grupo. ` +
              `El generador completo, con todas las regiones, está en <a class="internal" href="${RAIZ}para-el-dm/generador-de-encuentros">Generador de encuentros</a>.</p>` : "")
    const q = (k) => div.querySelector(`[data-k="${k}"]`)
    function llenarSectores() {
      const R = DATOS.regiones[q("region").value]
      q("sector").innerHTML = opciones(R.sectores.map((s) => [s.id, s.nombre]), R.sectores[0] && R.sectores[0].id)
    }
    q("region").addEventListener("change", llenarSectores)
    llenarSectores()
    const res = div.querySelector(".enc-res")
    function ctx() {
      const region = q("region").value, R = DATOS.regiones[region]
      const s = R.sectores.find((x) => x.id === q("sector").value) || R.sectores[0] || {}
      const nivel = Math.max(1, Math.min(20, +q("nivel").value || 1)), pjs = +q("pjs").value || 4
      return { region, sector: s.tabla, terreno: s.terreno || R.terreno, contexto: q("contexto").value, hora: q("hora").value,
               ng: Math.max(1, nivel + (pjs >= 6 ? 1 : pjs <= 3 ? -1 : 0)) }
    }
    function poner(htmls) { res.insertAdjacentHTML("afterbegin", htmls.join("")) }
    div.querySelectorAll("button[data-a]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.a, c = ctx()
      if (a === "limpiar") { res.innerHTML = ""; return }
      if (a === "forzar") return poner(bloque4h(c, true).map((r) => tarjeta(r)))
      if (a === "4h") return poner(bloque4h(c, false).map((r) => tarjeta(r)))
      // jornada: 3 bloques de día y 3 de noche (acampados)
      const out = []
      ;[["dia", "Mañana"], ["dia", "Tarde"], ["dia", "Atardecer"], ["noche", "Primera guardia"], ["noche", "Segunda guardia"], ["noche", "Madrugada"]].forEach(([h, et]) => {
        bloque4h({ ...c, hora: h }, false).forEach((r) => out.push(tarjeta(r, et)))
      })
      poner([`<div class="enc-jornada">${out.join("")}</div>`])
    }))
  }

  async function iniciar() {
    const divs = document.querySelectorAll("div.encuentros")
    if (!divs.length) return
    if (!DATOS) {
      try { DATOS = await (await fetch(BASE + "datos.json" + (V ? "?v=" + V : ""))).json() }
      catch (e) { divs.forEach((x) => (x.textContent = "No se pudieron cargar las tablas de encuentros.")); return }
    }
    divs.forEach(montar)
  }
  document.addEventListener("nav", iniciar)
  if (document.readyState !== "loading") iniciar()
})()
