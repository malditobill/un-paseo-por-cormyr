// Generador de encuentros aleatorios (2026-11-25). Lo inyecta scripts/web/encuentros.py en todas las páginas,
// pero solo trabaja donde hay un <div class="encuentros"> (data-region="Stonelands" lo fija a una región).
// Datos: encuentros/datos.json (compilado por scripts/encuentros/compilar.py). Navegación SPA de Quartz: evento "nav".
(function () {
  const BASE = document.currentScript.src.replace(/encuentros\.js(\?.*)?$/, "")
  const V = (document.currentScript.src.match(/\?v=([\w-]+)/) || [])[1] || ""
  const RAIZ = BASE.replace(/encuentros\/$/, "")
  let DATOS = null

  // ── azar, con registro de cada tirada (se muestra en la tarjeta) ──
  let T = []
  const anota = (s) => T.push(s)
  const d = (n) => 1 + Math.floor(Math.random() * n)
  const dd = (n) => String(n).padStart(2, "0")
  // «1-4» -> «1d4», «7-16» -> «1d10+6»
  function aDados(expr) {
    expr = String(expr || "1").replace(/\s/g, "").replace(/[–—]/g, "-")
    const m = expr.match(/^(\d+)-(\d+)$/)
    if (m) { const lo = +m[1], hi = +m[2]; return lo === hi ? String(lo) : `1d${hi - lo + 1}${lo - 1 ? "+" + (lo - 1) : ""}` }
    return expr
  }
  function maxDe(expr) {
    const e = aDados(expr), m = e.match(/^(\d*)d(\d+)([+-]\d+)?(?:x(\d+))?$/)
    return m ? ((+m[1] || 1) * +m[2] + (+m[3] || 0)) * (+m[4] || 1) : parseInt(e) || 1
  }
  // tira y anota: «Distancia: 2d10×3 = (4+7)×3 = 33 m»
  function tira(expr, etiqueta, unidad = "") {
    const e = aDados(expr)
    const m = e.match(/^(\d*)d(\d+)([+-]\d+)?(?:x(\d+))?$/)
    if (!m) { const v = parseInt(e) || 1; if (etiqueta) anota(`${etiqueta}: ${v}${unidad} (fijo)`); return v }
    const caras = [], n = +m[1] || 1
    for (let i = 0; i < n; i++) caras.push(d(+m[2]))
    const suma = caras.reduce((a, x) => a + x, 0), mod = +m[3] || 0, mul = +m[4] || 1
    const total = (suma + mod) * mul
    const fx = `${n}d${m[2]}${m[3] || ""}${mul > 1 ? "×" + mul : ""}`
    let det = caras.length > 1 ? `(${caras.join("+")})` : `${caras[0]}`
    if (mod) det = `${det}${mod > 0 ? "+" : ""}${mod}`
    if (mul > 1) det = mod || caras.length === 1 ? `(${det})×${mul}` : `${det}×${mul}`
    if (etiqueta) anota(`${etiqueta}: <b>${fx}</b> = ${det === String(total) ? "" : det + " = "}<b>${total}${unidad}</b>`)
    return total
  }
  // tabla de pesos -> d100 (o d1000 si hay entradas de menos del 1 %) con rangos; tira, anota y devuelve la entrada
  function tabla(lista, peso, etiqueta, nombre) {
    const ps = lista.map((x) => Math.max(0, peso(x)))
    const tot = ps.reduce((a, x) => a + x, 0) || 1
    const caras = ps.some((x) => x > 0 && x / tot < 0.01) ? 1000 : 100
    const hasta = []
    let acc = 0
    ps.forEach((x, i) => { acc += x; hasta.push(Math.max(i ? hasta[i - 1] + 1 : 1, Math.round((acc / tot) * caras))) })
    const tope = Math.max(caras, hasta[hasta.length - 1])
    hasta[hasta.length - 1] = tope
    const r = d(tope)
    const i = hasta.findIndex((h) => r <= h)
    const desde = i ? hasta[i - 1] + 1 : 1
    const ancho = caras === 1000 ? 3 : 2
    const f = (n) => (n === caras ? (caras === 1000 ? "000" : "00") : String(n).padStart(ancho, "0"))
    if (etiqueta) anota(`${etiqueta}: <b>1d${caras}</b> = <b>${f(r)}</b> → ${nombre ? nombre(lista[i]) : ""} <span class="enc-rango">(${f(desde)}–${f(hasta[i])})</span>`)
    return lista[i]
  }
  const PESO_FREC = { "común": 10, "poco común": 4, "raro": 1, "muy raro": 0.25 }
  let LUGAR = ""
  const delLugar = (p) => LUGAR && ((p.pagina || "").toLowerCase().endsWith("/" + LUGAR.toLowerCase().replace(/ /g, "-")) ||
    (p.donde || []).some((w) => (w.detalle || "").includes(LUGAR)) || (p.nombre || "").includes(LUGAR))
  const pesoPerfil = (p) => (PESO_FREC[p.frecuencia] || 1) * (delLugar(p) ? 5 : 1)

  // ── nivel de encuentro (DMG 3.5): cada duplicación de criaturas suma 2 ──
  function vdNum(vd) {
    vd = String(vd).trim()
    const f = { "1/2": -1, "1/3": -2, "1/4": -3, "1/6": -4, "1/8": -5, "1/10": -6 }
    if (vd in f) return f[vd]
    return parseFloat(vd) || 0
  }
  function ne(grupos) {
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
  const ACTIVIDAD = ["en marcha, de paso", "cazando o buscando comida", "acampados o en su guarida", "comiendo o descansando", "siguiendo el rastro del grupo", "peleando con otra cosa", "vigilando un paso o un punto alto", "durmiendo o al acecho"]
  const ACTITUD = [[4, "hostil"], [9, "inamistosa"], [15, "indiferente"], [18, "amistosa"], [20, "servicial"]]
  function actitud() {
    const r = d(20), i = ACTITUD.findIndex(([t]) => r <= t), desde = i ? ACTITUD[i - 1][0] + 1 : 1
    anota(`Actitud: <b>1d20</b> = <b>${dd(r)}</b> → ${ACTITUD[i][1]} <span class="enc-rango">(${dd(desde)}–${dd(ACTITUD[i][0])})</span>`)
    return ACTITUD[i][1]
  }
  function actividad() {
    const r = d(ACTIVIDAD.length)
    anota(`Qué están haciendo: <b>1d${ACTIVIDAD.length}</b> = <b>${r}</b> → ${ACTIVIDAD[r - 1]}`)
    return ACTIVIDAD[r - 1]
  }

  // ── tiradas ──
  function criaturaDe(ref) { return (DATOS.criaturas || {})[ref] || null }

  function resolverCriatura(ent, ctx) {
    const c = criaturaDe(ent.ref) || { nombre: ent.nombre || ent.ref, vd: ent.vd || "1", grupos: [] }
    const ng = ctx.ng
    let grupos = (c.grupos || []).filter((g) => !g.guarida)
    if (ent.cantidad) grupos = [{ nombre: "", cantidad: ent.cantidad }]
    if (!grupos.length) grupos = [{ nombre: "", cantidad: "1" }]
    let g = grupos.length > 1 ? tabla(grupos, (x) => x.peso || 1, "Grupo", (x) => `${x.nombre.toLowerCase()} (${x.cantidad})`) : grupos[0]
    let n = tira(g.cantidad, "Cantidad"), el = ne([[c.vd, n]])
    if (el > ng + 3) {
      // demasiados: se prueba el grupo más chico y, si hace falta, se recorta
      const chico = grupos.slice().sort((a, b) => maxDe(a.cantidad) - maxDe(b.cantidad))[0]
      if (chico !== g) { g = chico; n = tira(g.cantidad, `NE ${el} supera NG+3: grupo más chico (${g.nombre || g.cantidad})`); el = ne([[c.vd, n]]) }
      const antes = n
      while (el > ng + 3 && n > 1) { n--; el = ne([[c.vd, n]]) }
      if (n !== antes) anota(`Ajuste al grupo: de ${antes} a ${n} para no pasar NE ${ng + 3}`)
    }
    const [dif, clase] = dificultad(el, ng)
    const lejos = el > ng + 4
    const dist = tira(DIST[ctx.terreno] || "2d10x3", lejos ? "Distancia (×4: se los ve de lejos)" : "Distancia", " m")
    return {
      tipo: lejos ? "avistamiento" : "criatura",
      titulo: `${n} ${n === 1 ? c.nombre : c.plural || c.nombre}` + (g.nombre ? ` (${g.nombre.toLowerCase()})` : ""),
      enlace: c.pagina,
      lineas: [
        `VD ${c.vd} cada uno · NE ${el} · <b class="enc-${clase}">${dif}</b> para el grupo (NG ${ng})`,
        lejos ? `Demasiado para el grupo: se los ve a lo lejos, a unos ${dist * 4} m, y todavía no los vieron. Se puede evitar el encuentro.`
              : `Distancia: unos ${dist} m · ${actividad()} · actitud ${actitud()}`,
        g.nota ? g.nota : "",
        ent.nota ? ent.nota : "",
        c.pagina ? "" : `<span class="enc-pend">Hoja de juego pendiente en el bestiario.</span>`,
      ],
      fuente: ent.fuente,
    }
  }

  function resolverPerfil(p, ctx) {
    const act = p.actitud && p.actitud !== "variable" ? p.actitud : actitud()
    return {
      tipo: "viajeros",
      titulo: p.nombre,
      enlace: p.pagina,
      lineas: [p.descripcion, p.composicion ? `<b>Composición:</b> ${p.composicion}` : "", `Actitud inicial: ${act}`],
      fuente: p.fuentes,
    }
  }

  function perfilesPara(ctx) {
    const todos = Object.values(DATOS.perfiles || {})
    return todos.filter((p) => (p.donde || []).some((w) => (w.region === ctx.region || w.region === "Cormyr") && (!w.contexto || w.contexto === ctx.contexto || ctx.contexto === "camino" && w.contexto === "campo"))
      && (!p.hora || p.hora === "ambas" || p.hora === ctx.hora) && (!p.epoca || p.epoca === "1374"))
  }

  const nomEnt = (x) => {
    if (x.ref) { const c = criaturaDe(x.ref); return c ? c.nombre : x.ref }
    if (x.perfil && DATOS.perfiles[x.perfil]) return DATOS.perfiles[x.perfil].nombre
    if (x.viajeros) return `viajeros (${x.viajeros})`
    return x.nombre || "?"
  }

  function tirarCriatura(ctx) {
    const sec = (DATOS.sectores || {})[ctx.sector]
    const reg = (sec && (sec.tablas[ctx.hora] || sec.tablas.dia)) || []
    const base = ((DATOS.base || {})[ctx.terreno] || {})[ctx.hora === "noche" ? "noche" : "dia"] || []
    let lista = reg, cual = "de la región"
    if (reg.length && base.length) {
      const r = d(100)
      if (r > 70) { lista = base; cual = "general del terreno" }
      anota(`Qué tabla: <b>1d100</b> = <b>${r === 100 ? "00" : dd(r)}</b> → ${cual} <span class="enc-rango">(01–70 región, 71–00 terreno)</span>`)
    } else if (!reg.length) { lista = base; cual = "general del terreno" }
    if (!lista.length) return { tipo: "nada", titulo: "Sin tabla para este terreno todavía", lineas: [] }
    const ent = tabla(lista, (x) => x.peso || PESO_FREC[x.frecuencia] || 1, `Tabla ${cual}`, nomEnt)
    if (ent.perfil && DATOS.perfiles[ent.perfil]) return resolverPerfil(DATOS.perfiles[ent.perfil], ctx)
    if (ent.viajeros) {
      const ps = perfilesPara(ctx).filter((p) => p.tipo === ent.viajeros)
      if (ps.length) return resolverPerfil(tabla(ps, pesoPerfil, `Perfil de Cormyr (${ent.viajeros})`, (p) => p.nombre), ctx)
      return tirarViajeros(ctx)
    }
    if (ent.compuesto) return resolverCompuesto(ent, ctx)
    if (ent.texto) return { tipo: "suceso", titulo: ent.nombre, lineas: [ent.texto], fuente: ent.fuente }
    return resolverCriatura(ent, ctx)
  }

  function resolverCompuesto(ent, ctx) {
    const partes = ent.compuesto.map((p) => {
      const c = criaturaDe(p.ref) || { nombre: p.ref, vd: "1" }
      return { c, n: tira(p.cantidad, `Cantidad de ${c.plural || c.nombre}`) }
    })
    const el = ne(partes.map((p) => [p.c.vd, p.n]))
    const [dif, clase] = dificultad(el, ctx.ng)
    const nom = (p) => {
      const t = `${p.n} ${p.n === 1 ? p.c.nombre : p.c.plural || p.c.nombre}`
      return p.c.pagina ? `<a class="internal" href="${RAIZ}${p.c.pagina}">${t}</a>` : t
    }
    const dist = tira(DIST[ctx.terreno] || "2d10x3", "Distancia", " m")
    return {
      tipo: el > ctx.ng + 4 ? "avistamiento" : "criatura",
      titulo: ent.nombre || "Grupo mixto",
      lineas: [partes.map(nom).join(", "), `NE ${el} · <b class="enc-${clase}">${dif}</b> para el grupo (NG ${ctx.ng})`,
               `Distancia: unos ${dist} m · actitud ${actitud()}`, ent.nota || ""],
      fuente: ent.fuente,
    }
  }

  function tirarViajeros(ctx) {
    // primero el tipo de viajeros (tabla de caminos); después, un perfil propio de Cormyr de ese tipo en la región
    const ps = perfilesPara(ctx)
    const vs = DATOS.viajeros || []
    const v = vs.length ? tabla(vs, (x) => x.peso || 1, "Tipo de viajeros", (x) => x.nombre.toLowerCase()) : null
    let cand = v && v.tipo ? ps.filter((p) => p.tipo === v.tipo) : []
    if (!cand.length && ps.length) {
      const r = d(2)
      anota(`No hay perfil de ese tipo en la región: <b>1d2</b> = <b>${r}</b> → ${r === 1 ? "otro perfil de la región" : "viajeros genéricos"}`)
      if (r === 1) cand = ps
    }
    if (cand.length) return resolverPerfil(tabla(cand, pesoPerfil, "Perfil de Cormyr", (p) => p.nombre), ctx)
    if (v) return { tipo: "viajeros", titulo: v.nombre, lineas: [v.resumen, `Actitud inicial: ${actitud()}`] }
    return tirarCriatura(ctx)
  }

  function tirarDe(lista, tipo, ctx, etiqueta) {
    const ter = ctx.terreno === "subterraneo" || ctx.terreno === "ciudad" ? "colina" : ctx.terreno
    const xs = (lista || []).filter((x) => (!x.pesos || x.pesos[ter]) && (!x.estaciones || x.estaciones.includes(ctx.estacion)))
    if (!xs.length) return tirarCriatura(ctx)
    const x = tabla(xs, (y) => (y.pesos ? y.pesos[ter] : y.peso || 1), etiqueta, (y) => y.nombre)
    return { tipo, titulo: x.nombre, lineas: [x.resumen || x.descripcion || ""] }
  }

  const CLIMA_ESCENA = { "Tormenta eléctrica": ["tormenta", "lluvia"], "Banco de niebla": ["niebla"], "Vendaval": ["viento"], "Huracán": ["viento", "tormenta"],
    "Tornado": ["viento", "tormenta"], "Ola de frío": ["helada", "nieve"], "Nevada": ["nieve"], "Ventisca": ["nieve", "viento"], "Ola de calor": ["calor"], "Granizada": ["tormenta"] }
  const VECINAS = { invierno: ["otoño", "primavera"], primavera: ["invierno", "verano"], verano: ["primavera", "otoño"], "otoño": ["verano", "invierno"] }
  const USADAS = {}   // escenas ya mostradas por zona: no se repiten hasta agotar las posibles
  function escena(ctx, clima) {
    const clave = ctx.region + "|" + ctx.sectorId
    // escenas que nombran un poblado: en un lugar, solo las suyas o las que no nombran ninguno
    const crudas = (DATOS.escenas || {})[clave] || []
    const nombra = (e) => (e.lugar ? [e.lugar] : e.lugares || [])
    const neutras = crudas.filter((e) => !nombra(e).length)
    const todas = ctx.lugar
      ? crudas.filter((e) => nombra(e).some((n) => ctx.lugar === n || ctx.lugar.startsWith(n + " "))).concat(neutras)
      : (neutras.length >= 6 ? neutras : crudas)
    let xs = todas.filter((e) => e.hora === ctx.hora && e.estacion === ctx.estacion)
    let nota = ""
    if (clima && CLIMA_ESCENA[clima]) {
      const c = todas.filter((e) => CLIMA_ESCENA[clima].includes(e.clima) && [ctx.estacion, ...VECINAS[ctx.estacion]].includes(e.estacion))
      if (c.length) { xs = c; nota = ", " + clima.toLowerCase() }
    }
    if (xs.length < 3 && !nota) {
      const mas = todas.filter((e) => e.hora === ctx.hora && VECINAS[ctx.estacion].includes(e.estacion))
      if (mas.length) { xs = xs.concat(mas); nota = ", con estaciones vecinas" }
    }
    if (!xs.length) xs = todas.filter((e) => e.estacion === ctx.estacion)
    if (!xs.length) xs = todas
    if (!xs.length) return null
    const usadas = (USADAS[clave] = USADAS[clave] || new Set())
    let libres = xs.filter((e) => !usadas.has(e.texto))
    if (!libres.length) { xs.forEach((e) => usadas.delete(e.texto)); libres = xs }
    const r = d(libres.length)
    const e = libres[r - 1]
    usadas.add(e.texto)
    const donde = nombra(e).length && !ctx.lugar ? ` <span class="enc-rango">(escena de ${nombra(e).join(", ")})</span>` : ""
    anota(`Escena (${ctx.estacion}, ${ctx.hora === "noche" ? "de noche" : "de día"}${nota}): <b>1d${libres.length}</b> = <b>${r}</b>${donde}` +
          (libres.length < xs.length ? ` <span class="enc-rango">(entre las ${libres.length} no usadas de ${xs.length})</span>` : ""))
    return e.texto
  }

  const NOMBRE_R = { criatura: "criatura", clima: "clima o terreno", suceso: "suceso", viajeros: "viajeros", doble: "dos encuentros", nada: "nada" }
  function bloque4h(ctx, forzar) {
    const m = ctx.master || (DATOS.master || {})[ctx.contexto === "camino" ? "camino" : "campo"] ||
      [{ hasta: 20, r: "criatura" }, { hasta: 25, r: "clima" }, { hasta: 30, r: "suceso" }, { hasta: 35, r: "viajeros" }, { hasta: 40, r: "doble" }, { hasta: 100, r: "nada" }]
    T = []
    LUGAR = ctx.lugar || ""
    let r
    // forzado: se tira solo sobre los rangos que no son «nada» (p. ej. 1d40 en vez de 1d100)
    const f = (n) => (n === 100 ? "00" : dd(n))
    const como = ctx.terreno === "agua" ? "navegando" : ctx.contexto === "camino" ? "por camino" : "campo traviesa"
    const tramos = m.map((e, i) => ({ r: e.r, desde: i ? m[i - 1].hasta + 1 : 1, hasta: e.hasta }))
    if (forzar) {
      const validos = tramos.filter((e) => e.r !== "nada")
      const total = validos.reduce((a, e) => a + e.hasta - e.desde + 1, 0)
      let x = d(total), elegido = validos[0], acc = 0
      for (const e of validos) { acc += e.hasta - e.desde + 1; if (x <= acc) { elegido = e; break } }
      // rangos del dado reducido, para que se pueda tirar a mano
      let ini = 1
      const rangos = validos.map((e) => { const w = e.hasta - e.desde + 1, s = `${dd(ini)}–${dd(ini + w - 1)} ${NOMBRE_R[e.r]}`; ini += w; return s })
      r = elegido.r
      anota(`Qué pasa en estas ${ctx.horas} horas (${como}), encuentro forzado: <b>1d${total}</b> = <b>${dd(x)}</b> → ${NOMBRE_R[r]} <span class="enc-rango">(${rangos.join(" · ")}; se saltea «nada»)</span>`)
    } else {
      const x = d(100), e = tramos.find((t) => x <= t.hasta)
      r = e.r
      anota(`Qué pasa en estas ${ctx.horas} horas (${como}): <b>1d100</b> = <b>${f(x)}</b> → ${NOMBRE_R[r]} <span class="enc-rango">(${f(e.desde)}–${f(e.hasta)})</span>`)
    }
    const fin = (res) => {
      if (res.tipo !== "nada") res.escena = escena(ctx, res.tipo === "clima" ? res.titulo : null)
      res.tiradas = T; T = []; return res
    }
    if (r === "doble") {
      const nota = T
      const a = bloque4h(ctx, true)[0], b = bloque4h(ctx, true)[0]
      a.tiradas = nota.concat(a.tiradas || [])
      return [a, b]
    }
    if (r === "nada") return [fin({ tipo: "nada", titulo: "Sin novedad", lineas: [`${ctx.horas} horas tranquilas.`] })]
    if (r === "criatura") return [fin(tirarCriatura(ctx))]
    if (r === "viajeros") return [fin(tirarViajeros(ctx))]
    if (r === "clima") return [fin(tirarDe(DATOS.clima_terreno, "clima", ctx, "Tabla de clima y terreno"))]
    return [fin(tirarDe(DATOS.sucesos, "suceso", ctx, "Tabla de sucesos"))]
  }

  // ── interfaz ──
  const ETIQ = { criatura: "Criatura", avistamiento: "Avistamiento", viajeros: "Viajeros", clima: "Clima y terreno", suceso: "Suceso", nada: "Sin novedad" }
  const esc = (s) => String(s == null ? "" : s)

  function tarjeta(res, hora) {
    const t = res.enlace ? `<a class="internal" href="${RAIZ}${res.enlace}">${esc(res.titulo)}</a>` : esc(res.titulo)
    return `<div class="enc-tarjeta enc-t-${res.tipo}"><div class="enc-cab"><span class="enc-etq">${ETIQ[res.tipo] || res.tipo}</span>` +
      (hora ? `<span class="enc-hora">${hora}</span>` : "") + `</div>` + (res.escena ? `<p class="enc-escena">${res.escena}</p>` : "") + `<div class="enc-titulo">${t}</div>` +
      res.lineas.filter(Boolean).map((l) => `<p>${l}</p>`).join("") +
      (res.tiradas && res.tiradas.length ? `<details class="enc-tiradas" open><summary>Tiradas</summary><ol>${res.tiradas.map((s) => `<li>${s}</li>`).join("")}</ol></details>` : "") +
      (res.fuente ? `<p class="enc-fuente">${esc(res.fuente)}</p>` : "") + `</div>`
  }

  function opciones(lista, sel) {
    return lista.map(([v, t]) => `<option value="${v}"${v === sel ? " selected" : ""}>${t}</option>`).join("")
  }


  // ── modo ciudad: barrios, turnos del día y encuentros sobre todo sociales ──
  const TURNOS = [["mañana", "Mañana", "dia"], ["tarde", "Tarde", "dia"], ["noche", "Noche", "noche"], ["madrugada", "Madrugada", "noche"]]
  const ETIQ_C = { guardia: "Guardia", comercio: "Comercio", gente: "Gente", faccion: "Facciones", suceso: "Suceso", peligro: "Peligro", nada: "Sin novedad" }
  function escenaCiudad(C, c) {
    const hora = TURNOS.find((x) => x[0] === c.turno)[2]
    const xs = (C.escenas || []).filter((e) => e.barrio === c.barrio && (!e.hora || e.hora === hora) && (!e.estacion || e.estacion === c.estacion))
    if (!xs.length) return null
    const clave = C.ciudad + "|" + c.barrio + "|" + hora
    const usadas = (USADAS[clave] = USADAS[clave] || new Set())
    let libres = xs.filter((e) => !usadas.has(e.texto))
    if (!libres.length) { xs.forEach((e) => usadas.delete(e.texto)); libres = xs }
    const r = d(libres.length), e = libres[r - 1]
    usadas.add(e.texto)
    anota(`Escena (${c.turno}): <b>1d${libres.length}</b> = <b>${r}</b>`)
    return e.texto
  }
  function turnoCiudad(C, c, forzar) {
    T = []
    const ch = C.chequeo || { dado: 6 }, umbral = ch[c.turno] != null ? ch[c.turno] : 2
    const nb = (C.barrios.find((b) => b.id === c.barrio) || {}).nombre || c.barrio
    if (!forzar) {
      const x = d(ch.dado)
      anota(`¿Hay encuentro esta ${c.turno} (${nb.toLowerCase()})? <b>1d${ch.dado}</b> = <b>${x}</b> → ${x <= umbral ? "sí" : "no"} <span class="enc-rango">(encuentro con ${umbral === 1 ? "1" : "1–" + umbral})</span>`)
      if (x > umbral) { const r = { tipo: "nada", titulo: "Sin novedad", lineas: ["La ciudad sigue a lo suyo."], tiradas: T }; T = []; return r }
    }
    const xs = C.encuentros.filter((e) => (!e.barrios || e.barrios.includes(c.barrio)) && (!e.turnos || e.turnos.includes(c.turno)) &&
      (!e.estaciones || e.estaciones.includes(c.estacion)))
    const e = tabla(xs, (x) => x.peso || 1, `Tabla de ${C.ciudad} (${nb.toLowerCase()}, ${c.turno})`, (x) => x.nombre)
    const lineas = [e.texto]
    let enlace = null, titulo = e.nombre
    if (e.ref && criaturaDe(e.ref)) {
      const cr = criaturaDe(e.ref), n = tira(e.cantidad || "1", "Cantidad")
      titulo = `${e.nombre}: ${n} ${n === 1 ? cr.nombre : cr.plural || cr.nombre}`
      enlace = cr.pagina
      lineas.push(`VD ${cr.vd} cada uno · NE ${ne([[cr.vd, n]])} · <b class="enc-${dificultad(ne([[cr.vd, n]]), c.ng)[1]}">${dificultad(ne([[cr.vd, n]]), c.ng)[0]}</b> para el grupo (NG ${c.ng})`)
    } else if (e.cantidad) {
      lineas.push(`Cuántos: ${tira(e.cantidad, "Cantidad")}`)
    }
    if (e.perfil && DATOS.perfiles[e.perfil]) {
      const p = DATOS.perfiles[e.perfil]
      if (p.composicion) lineas.push(`<b>Composición:</b> ${p.composicion}`)
      if (p.pagina) enlace = enlace || p.pagina
    }
    lineas.push(`Actitud inicial: ${e.actitud || actitud()}`)
    if (e.gancho) lineas.push(`<b>Gancho:</b> ${e.gancho}`)
    if ((e.paginas || []).length) lineas.push(`Ver: ${e.paginas.map(([n, pg]) => `<a class="internal" href="${RAIZ}${pg}">${n}</a>`).join(", ")}`)
    const res = { tipo: e.tipo, titulo, enlace, lineas, fuente: e.fuente }
    res.escena = escenaCiudad(C, c)
    res.tiradas = T; T = []
    return res
  }
  function montarCiudad(div, C) {
    div.innerHTML = `
      <div class="enc-panel">
        <div class="enc-fila">
          <label>Barrio <select data-k="barrio">${opciones(C.barrios.map((b) => [b.id, b.nombre]), C.barrios[0].id)}</select></label>
          <label>Momento <select data-k="turno">${opciones(TURNOS.map((x) => [x[0], x[1]]), "tarde")}</select></label>
          <label>Estación <select data-k="estacion">${opciones([["invierno", "invierno"], ["primavera", "primavera"], ["verano", "verano"], ["otoño", "otoño"]], "otoño")}</select></label>
        </div>
        <div class="enc-fila">
          <label>Nivel del grupo <input data-k="nivel" type="number" min="1" max="20" value="3"></label>
          <label>Personajes <input data-k="pjs" type="number" min="1" max="10" value="4"></label>
          <button data-a="forzar">Tirar un encuentro</button>
          <button data-a="turno">Pasar el momento</button>
          <button data-a="dia">Un día en la ciudad</button>
          <button data-a="limpiar" class="enc-sec">Limpiar</button>
        </div>
      </div>
      <div class="enc-res"></div>
      <p class="enc-ayuda">Encuentros dentro de ${C.ciudad}, por barrio y momento del día. ${C.nota || ""} ` +
      `El generador completo está en <a class="internal" href="${RAIZ}para-el-dm/generador-de-encuentros">Generador de encuentros</a>.</p>`
    const q = (k) => div.querySelector(`[data-k="${k}"]`)
    const res = div.querySelector(".enc-res")
    const ctx = () => {
      const nivel = Math.max(1, Math.min(20, +q("nivel").value || 1)), pjs = +q("pjs").value || 4
      return { barrio: q("barrio").value, turno: q("turno").value, estacion: q("estacion").value, ng: Math.max(1, nivel + (pjs >= 6 ? 1 : pjs <= 3 ? -1 : 0)) }
    }
    const tarjetaC = (r, et) => tarjeta({ ...r, tipo: r.tipo }, et).replace(/<span class="enc-etq">[^<]*<\/span>/, `<span class="enc-etq">${ETIQ_C[r.tipo] || r.tipo}</span>`)
    div.querySelectorAll("button[data-a]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.a, c = ctx()
      if (a === "limpiar") { res.innerHTML = ""; return }
      if (a === "forzar") return res.insertAdjacentHTML("afterbegin", tarjetaC(turnoCiudad(C, c, true)))
      if (a === "turno") return res.insertAdjacentHTML("afterbegin", tarjetaC(turnoCiudad(C, c, false)))
      const out = TURNOS.map(([tn, et]) => tarjetaC(turnoCiudad(C, { ...c, turno: tn }, false), et))
      res.insertAdjacentHTML("afterbegin", `<div class="enc-jornada">${out.join("")}</div>`)
    }))
  }

  function montar(div) {
    if (div.dataset.listo) return
    div.dataset.listo = "1"
    const CI = div.dataset.lugar && (DATOS.ciudades || {})[div.dataset.lugar]
    if (CI) return montarCiudad(div, CI)
    const L = div.dataset.lugar ? (DATOS.lugares || {})[div.dataset.lugar] : null
    const fija = (L && L.region) || div.dataset.region || ""
    const regiones = Object.keys(DATOS.regiones).sort()
    const reg0 = fija && DATOS.regiones[fija] ? fija : regiones[0]
    div.innerHTML = `
      <div class="enc-panel">
        <div class="enc-fila">
          <label${fija ? ' hidden' : ''}>Región <select data-k="region">${opciones(regiones.map((r) => [r, DATOS.regiones[r].nombre || r]), reg0)}</select></label>
          <label>Zona <select data-k="sector"></select></label>
          <label>Por <select data-k="contexto">${opciones([["campo", "campo traviesa"], ["camino", "camino"]], "campo")}</select></label>
          <label>Hora <select data-k="hora">${opciones([["dia", "de día"], ["noche", "de noche"]], "dia")}</select></label>
          <label>Estación <select data-k="estacion">${opciones([["invierno", "invierno"], ["primavera", "primavera"], ["verano", "verano"], ["otoño", "otoño"]], "otoño")}</select></label>
        </div>
        <div class="enc-fila">
          <label>Nivel del grupo <input data-k="nivel" type="number" min="1" max="20" value="3"></label>
          <label>Personajes <input data-k="pjs" type="number" min="1" max="10" value="4"></label>
          <button data-a="forzar">Tirar un encuentro</button>
          <button data-a="4h">Viajar ${(DATOS.regiones[reg0].horas || 4)} horas</button>
          <button data-a="dia">Jornada de viaje</button>
          <button data-a="limpiar" class="enc-sec">Limpiar</button>
        </div>
      </div>
      <div class="enc-res"></div>` +
      (fija ? `<p class="enc-ayuda">${L ? `Alrededores de ${div.dataset.lugar}: tablas de ${DATOS.regiones[reg0].nombre || reg0}, con la gente del lugar más a mano. ` : `Tablas de ${DATOS.regiones[reg0].nombre || reg0} según la zona, la hora y el nivel del grupo. `}` +
              `El generador completo, con todas las regiones, está en <a class="internal" href="${RAIZ}para-el-dm/generador-de-encuentros">Generador de encuentros</a>.</p>` : "")
    const q = (k) => div.querySelector(`[data-k="${k}"]`)
    function llenarSectores() {
      const R = DATOS.regiones[q("region").value]
      const b4 = div.querySelector('[data-a="4h"]')
      if (b4) b4.textContent = `Viajar ${R.horas || 4} horas`
      q("sector").innerHTML = opciones(R.sectores.map((s) => [s.id, s.nombre]), R.sectores[0] && R.sectores[0].id)
    }
    q("region").addEventListener("change", llenarSectores)
    llenarSectores()
    if (L) {
      if (L.sector) q("sector").value = L.sector
      if (L.contexto) q("contexto").value = L.contexto
    }
    const res = div.querySelector(".enc-res")
    function ctx() {
      const region = q("region").value, R = DATOS.regiones[region]
      const s = R.sectores.find((x) => x.id === q("sector").value) || R.sectores[0] || {}
      const nivel = Math.max(1, Math.min(20, +q("nivel").value || 1)), pjs = +q("pjs").value || 4
      return { lugar: div.dataset.lugar || "", master: R.master, horas: R.horas || 4, region, sector: s.tabla, sectorId: s.id, estacion: q("estacion").value, terreno: s.terreno || R.terreno, contexto: q("contexto").value, hora: q("hora").value,
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
      const tramos = c.horas >= 12 ? [["dia", "Día"], ["noche", "Noche"]]
        : [["dia", "Mañana"], ["dia", "Tarde"], ["dia", "Atardecer"], ["noche", "Primera guardia"], ["noche", "Segunda guardia"], ["noche", "Madrugada"]]
      tramos.forEach(([h, et]) => {
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
