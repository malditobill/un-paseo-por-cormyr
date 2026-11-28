// Clima, calendario de Harptos y fases de Selûne (2026-11-27).
// Lo inyecta scripts/web/clima.py en todas las páginas; trabaja donde hay un <div class="clima">:
//   data-region="Stonelands" / data-lugar="Suzail"  → recuadro «Clima de hoy» del lugar
//   data-modo="almanaque"                          → almanaque completo (página «Para el DM/Clima y calendario»)
// Determinístico: la misma fecha y el mismo perfil dan siempre el mismo clima (todos los lectores ven lo mismo).
// Fecha del mundo: avanza 1:1 con la real (1 de enero = 1 de Hammer; año DR = año real − 652, que conserva los bisiestos).
// Datos: clima/datos.json. Navegación SPA de Quartz: evento "nav".
(function () {
  const BASE = document.currentScript.src.replace(/clima\.js(\?.*)?$/, "")
  const V = (document.currentScript.src.match(/\?v=([\w-]+)/) || [])[1] || ""
  const RAIZ = BASE.replace(/clima\/$/, "")
  let D = null

  // ───────────── Calendario de Harptos ─────────────
  const MESES = [
    ["Hammer", "Deepwinter", "Pleno Invierno"],
    ["Alturiak", "The Claw of Winter", "La Garra del Invierno"],
    ["Ches", "The Claw of the Sunsets", "La Garra de los Ocasos"],
    ["Tarsakh", "The Claw of the Storms", "La Garra de las Tormentas"],
    ["Mirtul", "The Melting", "El Deshielo"],
    ["Kythorn", "The Time of Flowers", "El Tiempo de las Flores"],
    ["Flamerule", "Summertide", "La Marea del Verano"],
    ["Eleasias", "Highsun", "Sol Alto"],
    ["Eleint", "The Fading", "El Desvanecer"],
    ["Marpenoth", "Leaffall", "La Caída de las Hojas"],
    ["Uktar", "The Rotting", "La Podredumbre"],
    ["Nightal", "The Drawing Down", "El Repliegue"],
  ]
  // festivos fuera de los meses: van después del mes indicado
  const FESTIVOS = { 0: "Midwinter", 3: "Greengrass", 6: "Midsummer", 8: "Highharvestide", 10: "Feast of the Moon" }
  const FESTIVO_ES = { Midwinter: "fiesta de pleno invierno; en Suzail, Deadwinter Day", Greengrass: "fiesta de la primavera",
    Midsummer: "fiesta de pleno verano", Shieldmeet: "día del Escudo, cada cuatro años", Highharvestide: "fiesta de la cosecha",
    "Feast of the Moon": "fiesta de la Luna, de los difuntos" }
  // equinoccios y solsticios del calendario
  const ASTRO = { "2-19": "equinoccio de primavera", "5-20": "solsticio de verano", "8-21": "equinoccio de otoño", "11-20": "solsticio de invierno" }
  const ORD = ["primer", "segundo", "tercer", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo"]
  const ORDF = ["primera", "segunda", "tercera"]

  const bisiesto = (y) => y % 4 === 0
  const largo = (y) => (bisiesto(y) ? 366 : 365)

  // lista de días del año: {mes, dia} o {festivo}
  const _anios = {}
  function diasDel(y) {
    if (_anios[y]) return _anios[y]
    const xs = []
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= 30; d++) xs.push({ mes: m, dia: d })
      if (FESTIVOS[m]) xs.push({ festivo: FESTIVOS[m] })
      if (m === 6 && bisiesto(y)) xs.push({ festivo: "Shieldmeet" })
    }
    return (_anios[y] = xs)
  }
  // fecha = {anio, n} con n = ordinal 1..365/366
  const fechaDe = (anio, n) => ({ anio, n, ...diasDel(anio)[n - 1] })
  function ordinal(anio, mes, dia) { return diasDel(anio).findIndex((x) => x.mes === mes && x.dia === dia) + 1 }
  function ordinalFestivo(anio, nombre) { return diasDel(anio).findIndex((x) => x.festivo === nombre) + 1 }
  function mover(f, k) {
    let { anio, n } = f
    n += k
    while (n < 1) { anio--; n += largo(anio) }
    while (n > largo(anio)) { n -= largo(anio); anio++ }
    return fechaDe(anio, n)
  }
  function hoy() {
    const r = new Date(), ini = new Date(r.getFullYear(), 0, 1)
    const n = Math.round((new Date(r.getFullYear(), r.getMonth(), r.getDate()) - ini) / 864e5) + 1
    return fechaDe(r.getFullYear() - 652, n)
  }
  // días desde la medianoche del 1 de Hammer de 1372 DR
  function absoluto(f) {
    let a = 0, y = 1372
    const ciclos = Math.floor((f.anio - 1372) / 4)
    a += ciclos * 1461; y += ciclos * 4
    while (y < f.anio) a += largo(y++)
    return a + f.n - 1
  }
  function estacionDe(f) {
    const a = ordinal(f.anio, 2, 19), b = ordinal(f.anio, 5, 20), c = ordinal(f.anio, 8, 21), d = ordinal(f.anio, 11, 20)
    return f.n >= d || f.n < a ? "invierno" : f.n < b ? "primavera" : f.n < c ? "verano" : "otoño"
  }
  // Regla de la crónica: todo mes o día de Harptos lleva entre paréntesis su equivalente gregoriano
  // (mismo ordinal del año; año gregoriano = DR + 652, así coinciden los bisiestos).
  const GREG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
  function greg(f) { const g = new Date(f.anio + 652, 0, f.n); return `${g.getDate()} de ${GREG[g.getMonth()]}` }
  function nombreFecha(f, corto) {
    if (f.festivo) return corto ? `${f.festivo} (${greg(f)})` : `${f.festivo} (${greg(f)}), ${FESTIVO_ES[f.festivo]}`
    const [mes, , es] = MESES[f.mes]
    if (corto) return `${f.dia} de ${mes} (${greg(f)})`
    const dec = Math.floor((f.dia - 1) / 10), dd = (f.dia - 1) % 10
    return `${f.dia} de ${mes} (${greg(f)}), ${ORD[dd]} día de la ${ORDF[dec]} tenday de ${es}`
  }
  function notasDelDia(f) {
    const xs = []
    if (!f.festivo && ASTRO[`${f.mes}-${f.dia}`]) xs.push(ASTRO[`${f.mes}-${f.dia}`])
    for (const e of D.festividades || []) if (!f.festivo && e.mes === f.mes && e.dia === f.dia)
      xs.push(`<a href="${RAIZ}${e.enlace.split("/").map(encodeURIComponent).join("/")}">${e.nombre}</a> en ${e.donde}`)
    return xs
  }

  // ───────────── Selûne ─────────────
  // Llena a medianoche del 1 de Hammer de 1372 DR; período 30 días, 10 h 30 min (48 lunaciones cada 4 años).
  const SINODICO = 30.4375
  function luna(f) {
    const t = absoluto(f) + 0.9 // de noche, hacia las 21:30
    const fase = (((t / SINODICO) % 1) + 1) % 1 // 0 = llena, 0,5 = nueva
    const edad = ((fase + 0.5) % 1) * SINODICO // días desde la luna nueva
    const luz = (1 + Math.cos(2 * Math.PI * fase)) / 2
    const q = SINODICO / 4
    let nombre
    if (edad < 1.2 || edad > SINODICO - 1.2) nombre = "luna nueva"
    else if (Math.abs(edad - q) < 1.2) nombre = "cuarto creciente"
    else if (Math.abs(edad - 2 * q) < 1.2) nombre = "luna llena"
    else if (Math.abs(edad - 3 * q) < 1.2) nombre = "cuarto menguante"
    else nombre = edad < q ? "creciente" : edad < 2 * q ? "gibosa creciente" : edad < 3 * q ? "gibosa menguante" : "menguante"
    return { fase, edad, luz, nombre, creciente: edad < 2 * q }
  }
  function proximaLuna(f, objetivo) { // objetivo: 0 llena, 0.5 nueva
    for (let k = 1; k <= 31; k++) { const g = mover(f, k), l = luna(g), l0 = luna(mover(g, -1))
      const pasa = objetivo === 0 ? l0.fase > 0.9 && l.fase < 0.1 : l0.fase < 0.5 && l.fase >= 0.5
      if (pasa) return g }
    return null
  }
  function svgLuna(l, tam = 34) {
    const r = tam / 2 - 1, c = tam / 2
    // terminador: elipse de semieje |cos| ; lado iluminado a la derecha si crece
    const k = Math.cos(2 * Math.PI * l.fase) // 1 llena, -1 nueva
    const lado = l.creciente ? 1 : 0
    const rx = Math.abs(k) * r
    const iluminada = `M ${c} ${c - r} A ${r} ${r} 0 0 ${lado} ${c} ${c + r} A ${rx} ${r} 0 0 ${(k > 0) === !!lado ? 1 : 0} ${c} ${c - r} Z`
    return `<svg class="cl-luna" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}" role="img" aria-label="${l.nombre}">` +
      `<circle cx="${c}" cy="${c}" r="${r}" class="cl-luna-sombra"/><path d="${iluminada}" class="cl-luna-luz"/>` +
      `<circle cx="${c}" cy="${c}" r="${r}" class="cl-luna-borde"/></svg>`
  }

  // ───────────── Sol (latitud supuesta) ─────────────
  function sol(f) {
    const lat = (D.latitud || 45) * Math.PI / 180
    const decl = -23.44 * Math.cos(2 * Math.PI * (f.n + 10) / 365) * Math.PI / 180
    const cosH = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl))
    const H = Math.acos(Math.max(-1, Math.min(1, cosH))) * 180 / Math.PI / 15
    const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}`
    return { sale: hm(12 - H), pone: hm(12 + H), horas: 2 * H }
  }

  // ───────────── Azar con semilla ─────────────
  function semilla(s) { let h = 1779033703 ^ s.length
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 } }
  const azar = (clave) => semilla(clave)
  const dado = (r, n) => 1 + Math.floor(r() * n)

  // ───────────── Clima ─────────────
  function normal(f) {
    // normales a mitad de cada mes (día 15), interpoladas por ordinal
    const N = D.normales, marcas = N.map((_, m) => ordinal(f.anio, m, 15))
    const L = largo(f.anio)
    let i = marcas.findIndex((x) => x > f.n) - 1
    if (i === -2) i = 11
    const a = i < 0 ? 11 : i, b = (a + 1) % 12
    let x0 = marcas[a], x1 = marcas[b], x = f.n
    if (i < 0) x0 -= L
    if (b === 0) x1 += L
    const t = (x - x0) / (x1 - x0), s = (1 - Math.cos(Math.PI * t)) / 2
    return [N[a][0] + (N[b][0] - N[a][0]) * s, N[a][1] + (N[b][1] - N[a][1]) * s]
  }
  // anomalía suave del reino: nudos cada 3 días
  function anomalia(f) {
    const t = absoluto(f), k = Math.floor(t / 3), u = (t - 3 * k) / 3
    const g = (i) => { const r = azar("anom" + i); return (r() + r() + r() - 1.5) * 3.2 }
    const s = (1 - Math.cos(Math.PI * u)) / 2
    return g(k) * (1 - s) + g(k + 1) * s
  }
  // suceso del reino según la tabla de clima aleatorio (bandas por estación)
  function suceso(f) {
    const est = estacionDe(f), b = D.bandas[est], r = azar("dia" + absoluto(f))
    const d100 = dado(r, 100)
    let tipo = d100 <= b[0] ? "normal" : d100 <= b[1] ? "anormal" : d100 <= b[2] ? "inclemente" : d100 <= b[3] ? "tormenta" : "temporal"
    return { tipo, d100, r, est }
  }
  // ola de calor o de frío: dura 1d4 días desde el día en que sale
  function ola(f) {
    for (let k = 0; k < 4; k++) {
      const g = mover(f, -k), s = suceso(g)
      if (s.tipo !== "anormal") continue
      const r = azar("ola" + absoluto(g)), dur = dado(r, 4), sub = dado(r, 100)
      if (k < dur) return { signo: sub <= 50 ? 1 : -1, sub, desde: k }
    }
    return null
  }
  function ajustePerfil(P, est) {
    let dMax = P.dMax || 0, dMin = P.dMin || 0
    if (est === "invierno") { dMax += P.inviernoMax || 0; dMin += P.inviernoMin || 0 }
    if (est === "verano") { dMax += P.veranoMax || 0 }
    return [dMax, dMin]
  }
  const VIENTOS = [["en calma", 0, 6], ["leve", 6, 16], ["moderado", 18, 32], ["fuerte", 34, 48], ["muy fuerte", 50, 80], ["vendaval", 82, 119], ["huracanado", 121, 280]]
  const DIRS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"]
  function direccion(r, est, perfil) {
    // vientos dominantes del oeste; en invierno del norte y noroeste; en la costa, brisas del lago (sur)
    const pesos = est === "invierno" ? [3, 1, 0, 0, 1, 1, 3, 4] : est === "verano" ? [1, 0, 1, 1, 2, 4, 3, 1] : [2, 1, 1, 1, 1, 3, 4, 2]
    if (perfil === "costa" && est !== "invierno") pesos[4] += 3
    let t = r() * pesos.reduce((a, x) => a + x, 0)
    for (let i = 0; i < 8; i++) { t -= pesos[i]; if (t < 0) return DIRS[i] }
    return "oeste"
  }
  const sensacion = (T, v) => (T <= 10 && v >= 5 ? 13.12 + 0.6215 * T - 11.37 * Math.pow(v, 0.16) + 0.3965 * T * Math.pow(v, 0.16) : T)

  function perfilDe(div) {
    if (div.dataset.perfil) return div.dataset.perfil
    const lugar = div.dataset.lugar, region = div.dataset.region
    if (lugar && D.lugares[lugar]) return D.lugares[lugar]
    if (lugar && D._lugaresEnc && D._lugaresEnc[lugar]) {
      const l = D._lugaresEnc[lugar]
      return D.sectores[`${l.region}~${l.sector}`] || D.regiones[l.region] || "llanura"
    }
    return D.regiones[region] || "llanura"
  }

  function clima(f, perfil, lugar, sinArrastre) {
    // una ventisca dura 1d3 días: si empezó antes y sigue, hoy también hay ventisca
    if (!sinArrastre) for (let k = 1; k <= 2; k++) {
      const g = mover(f, -k)
      if (suceso(g).tipo !== "temporal") continue
      const prev = clima(g, perfil, lugar, true)
      if (prev.precip === "ventisca" && prev.horas / 24 > k) {
        const hoyC = clima(f, perfil, lugar, true)
        const fr = Math.min(hoyC.max, prev.max) - 1
        return { ...hoyC, max: fr, min: Math.min(hoyC.min, fr - 4), cielo: "tormentoso", precip: "ventisca", horas: prev.horas - 24 * k,
          momento: null, viento: 5, vientoNombre: VIENTOS[5][0], kmh: Math.max(prev.kmh - 8 * k, 82), dir: prev.dir,
          sens: Math.round(sensacion(Math.min(hoyC.min, fr - 4), Math.max(prev.kmh - 8 * k, 82))), humManana: "alta", humTarde: "alta",
          detalle: ["sigue la del " + nombreFecha(g, true)], tipo: "temporal", ola: null }
      }
    }
    const P = D.perfiles[perfil] || D.perfiles.llanura
    const s = suceso(f), est = s.est
    const loc = azar(`loc${perfil}${absoluto(f)}`)
    let [max, min] = normal(f)
    const [dMax, dMin] = ajustePerfil(P, est)
    const an = anomalia(f) + (loc() - 0.5) * 1.6
    max += dMax + an; min += dMin + an * 0.8
    const o = ola(f)
    if (o) { max += 6 * o.signo; min += 6 * o.signo }
    // amplitud diaria: menos con cielo cubierto
    const cubierto = s.tipo === "inclemente" || s.tipo === "tormenta" || s.tipo === "temporal"
    if (cubierto) { const m = (max + min) / 2; max = m + (max - m) * 0.6; min = m - (m - min) * 0.6 }
    max = Math.round(max); min = Math.round(Math.min(min, max - 2))

    const r = s.r
    let cielo = "despejado", precip = null, horas = 0, viento = 1, detalle = []
    const frio = max <= 0, mixto = !frio && min <= 0 && max <= 3
    const nieve = (perfil === "montaña" && max <= 4) || frio
    if (s.tipo === "normal" || s.tipo === "anormal") {
      const c = loc()
      cielo = c < 0.4 ? "despejado" : c < 0.75 ? "nubes sueltas" : "cubierto"
      viento = loc() < 0.6 ? 1 : 2
      if (s.tipo === "anormal" && o) detalle.push(o.signo > 0 ? (est === "invierno" ? "deshielo de pleno invierno" : "ola de calor") : "ola de frío")
      if (s.tipo === "anormal" && !o) viento = 2 + (loc() < 0.5 ? 1 : 0)
    } else if (s.tipo === "inclemente") {
      cielo = "cubierto"
      const t = dado(r, 100)
      if (t <= 30) { precip = "niebla"; horas = dado(r, 4) + dado(r, 4) }
      else if (t <= 90) { precip = nieve ? "nieve" : mixto ? "aguanieve" : "lluvia"; horas = dado(r, 4) + dado(r, 4) }
      else { precip = frio || mixto ? "aguanieve" : "granizo"; horas = precip === "granizo" ? dado(r, 4) : dado(r, 4) + dado(r, 4) }
      viento = loc() < 0.5 ? 1 : 2
    } else if (s.tipo === "tormenta") {
      cielo = "tormentoso"
      precip = nieve || mixto ? "tormenta de nieve" : "tormenta eléctrica"
      horas = Math.max(1, dado(r, 4) + dado(r, 4) - 1)
      viento = 4
    } else {
      cielo = "tormentoso"
      const t = dado(r, 100)
      if (nieve || est === "invierno" && max <= 2) { precip = "ventisca"; horas = 24 * dado(r, 3) }
      else if ((est === "verano" || est === "primavera") && P.tornado && t <= 15) { precip = "tornado"; horas = 1 }
      else { precip = "vendaval"; horas = dado(r, 6); }
      viento = precip === "tornado" ? 6 : 5
      if (precip === "vendaval" && t > 60 && !nieve) detalle.push("con chaparrones")
    }
    // viento según el perfil (montaña y páramo más, bosque y pantano menos), sin pasar de categoría de tormenta
    if (viento <= 3) viento = Math.max(0, Math.min(3, viento + Math.round((P.viento || 0) * loc())))
    if (viento <= 1 && loc() < 0.25) viento = 0
    const [vn, vlo, vhi] = VIENTOS[viento]
    const kmh = Math.round(vlo + (vhi - vlo) * loc())
    const dir = viento === 0 ? null : direccion(loc, est, perfil)
    // niebla o neblina matinal propia del lugar
    const neblina = D.neblinas.includes(lugar) ? 0.15 : 0
    if (!precip && viento <= 1 && loc() < (P.niebla || 0) + neblina) detalle.push(est === "invierno" || est === "otoño" ? "niebla al amanecer" : "neblina matinal")
    // humedad
    const hBase = (P.humedad || 0) + (precip && precip !== "vendaval" ? 2 : 0) + (cielo === "cubierto" ? 1 : 0) + (est === "verano" ? 0 : 1)
    const hum = (v) => (v <= 1 ? "baja" : v <= 3 ? "moderada" : "alta")
    const humManana = hum(hBase + 1), humTarde = hum(hBase - (est === "verano" ? 1 : 0))
    const sens = Math.round(sensacion(min, kmh))
    const momento = precip && horas < 24 ? ["de madrugada", "por la mañana", "al mediodía", "por la tarde", "al anochecer", "de noche"][dado(azar("mom" + absoluto(f)), 6) - 1] : null
    return { perfil, nombrePerfil: P.nombre, est, max, min, cielo, precip, horas, momento, viento, vientoNombre: vn, kmh, dir, sens, humManana, humTarde, detalle, d100: s.d100, tipo: s.tipo, ola: o }
  }

  // ───────────── Efectos de juego (SRD 3.5, en métrico) ─────────────
  function efectos(c) {
    const xs = []
    if (c.min < -29) xs.push("<b>Frío extremo</b> (bajo −29 °C): 1d6 de daño letal por minuto, sin salvación, y además salvación de Fortaleza (CD 15, +1 por cada tirada anterior) o 1d4 de daño no letal. La armadura de metal quema como un <i>chill metal</i>.")
    else if (c.min < -18) xs.push("<b>Frío intenso</b> (bajo −18 °C): sin protección, salvación de Fortaleza cada 10 minutos (CD 15, +1 por cada tirada anterior) o 1d6 de daño no letal. Con ropa de invierno, una vez por hora.")
    else if (c.min < 4) xs.push(`<b>Frío</b> (bajo 4 °C${c.max < 4 ? " todo el día" : " de noche"}): sin protección, salvación de Fortaleza cada hora (CD 15, +1 por cada tirada anterior) o 1d6 de daño no letal. La ropa de invierno lo evita.`)
    if (c.max > 43) xs.push("<b>Calor intenso</b> (más de 43 °C): salvación de Fortaleza cada 10 minutos (CD 15, +1 por cada tirada anterior) o 1d4 de daño no letal; −4 con ropa gruesa o armadura.")
    else if (c.max > 32) xs.push("<b>Calor</b> (más de 32 °C): salvación de Fortaleza cada hora (CD 15, +1 por cada tirada anterior) o 1d4 de daño no letal; −4 con ropa gruesa o armadura.")
    if (c.max < 4 || c.min < 4) xs.push("Quien sufre daño no letal por frío o calor queda <b>fatigado</b> hasta recuperarlo.")
    const W = {
      2: "Viento moderado: 50 % de apagar llamas pequeñas sin proteger, como velas.",
      3: "Viento fuerte: apaga las llamas sin proteger; −2 a los ataques a distancia y a Escuchar. Criaturas Diminutas o menores: Fortaleza CD 10 o derribadas.",
      4: "Viento muy fuerte: apaga las llamas sin proteger y 50 % las protegidas (faroles); −4 a los ataques a distancia y a Escuchar. Fortaleza CD 15: las Diminutas salen volando, las Pequeñas caen derribadas, las Medianas no pueden avanzar contra el viento.",
      5: "Vendaval: ataques a distancia imposibles (armas de asedio −4), −8 a Escuchar, 75 % de apagar llamas protegidas. Fortaleza CD 18: Pequeñas o menores salen volando, Medianas derribadas, Grandes y Enormes no avanzan. Caen ramas y árboles.",
      6: "Tornado: todo ataque a distancia y toda prueba de Escuchar son imposibles. Fortaleza CD 30 o ser arrastrado hacia el embudo: 1d10 asaltos girando, 6d6 de daño por asalto, y luego despedido.",
    }
    if (W[c.viento]) xs.push(W[c.viento])
    const PR = {
      "niebla": "Niebla: no se ve (ni con visión en la oscuridad) más allá de 1,5 m; a esa distancia, ocultación (20 % de fallo).",
      "lluvia": "Lluvia: visibilidad a la mitad (−4 a Avistar y Buscar); a las llamas, los ataques a distancia y Escuchar, como viento muy fuerte.",
      "nieve": "Nieve: como la lluvia para la vista y los ataques a distancia; entrar en una casilla nevada cuesta 2 casillas de movimiento. Un día de nevada deja 1d6 × 2,5 cm de nieve.",
      "aguanieve": "Aguanieve: como la lluvia mientras cae (75 % de apagar llamas protegidas); en el suelo, como la nieve. Si después hiela, deja placas de hielo: 2 casillas de movimiento y +5 a la CD de Equilibrio y Piruetas.",
      "granizo": "Granizo: no reduce la vista, pero −4 a Escuchar; 5 % de que haga 1 punto de daño letal a todo lo que esté al descubierto. Suele acompañar 1d4 horas de lluvia.",
      "tormenta de nieve": "Tormenta de nieve: visibilidad a un cuarto (−8 a Avistar, Buscar y Escuchar), ataques a distancia imposibles salvo armas de asedio (−4); apaga velas y antorchas, 50 % los faroles. Deja 1d6 × 2,5 cm de nieve.",
      "tormenta eléctrica": "Tormenta eléctrica: visibilidad a un cuarto (−8 a Avistar, Buscar y Escuchar), ataques a distancia imposibles salvo armas de asedio (−4); apaga velas y antorchas, 50 % los faroles. Rayos: en el centro de la tormenta, uno por minuto durante una hora (1d10 × d8 de daño eléctrico; peligro con armadura de metal). Una de cada diez trae un tornado.",
      "ventisca": "Ventisca: visibilidad nula (Avistar, Buscar, Escuchar y ataques a distancia imposibles), frío y nieve espesa (1d3 × 30 cm). Fortaleza CD 20 contra el viento según el tamaño. Dura 1d3 días.",
      "vendaval": "Vendaval: visibilidad nula por el viento y el polvo, 75 % de apagar llamas protegidas; Fortaleza CD 20 contra el viento según el tamaño.",
      "tornado": "Tornado (VD 10): dura 1d6 × 10 minutos y avanza a unos 50 km/h; arranca árboles y derriba casas.",
    }
    if (PR[c.precip]) xs.push(PR[c.precip])
    if (c.detalle.some((x) => /niebla|neblina/.test(x))) xs.push("Niebla o neblina de las primeras horas: hasta media mañana, no se ve más allá de 1,5 m en los bajos.")
    return xs
  }

  // ───────────── Presentación ─────────────
  const ICONO = { despejado: "☀︎", "nubes sueltas": "⛅︎", cubierto: "☁︎", tormentoso: "☈" }
  const ICONO_P = { lluvia: "☂︎", nieve: "❄︎", aguanieve: "❄︎", granizo: "☂︎", niebla: "≋", "tormenta de nieve": "❄︎", "tormenta eléctrica": "☈", ventisca: "❄︎", vendaval: "≈", tornado: "☈" }
  const grados = (t) => `${t < 0 ? "−" : ""}${Math.abs(t)} °C`
  function frase(c) {
    let s = c.cielo
    if (c.precip) {
      const dur = c.horas >= 24 ? `${c.horas / 24} día${c.horas > 24 ? "s" : ""}` : `unas ${c.horas} hora${c.horas > 1 ? "s" : ""}`
      s = `${c.precip} ${c.momento || ""}, ${dur}`.replace(/\s+,/, ",")
    }
    if (c.detalle.length) s += ", " + c.detalle.join(", ")
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  function resumen(c) {
    return `${ICONO_P[c.precip] || ICONO[c.cielo] || ""} ${grados(c.max)} / ${grados(c.min)} · ${frase(c).toLowerCase()}`
  }
  function informe(f, perfil, lugar, titulo) {
    const c = clima(f, perfil, lugar), l = luna(f), s = sol(f)
    const notas = notasDelDia(f)
    const llena = proximaLuna(f, 0), nueva = proximaLuna(f, 0.5)
    const vientoTxt = c.viento === 0 ? "En calma" : `${c.vientoNombre.charAt(0).toUpperCase() + c.vientoNombre.slice(1)}, del ${c.dir}, unos ${c.kmh} km/h`
    const ef = efectos(c)
    return `<div class="cl-informe">
      <div class="cl-cab"><span>${titulo || c.nombrePerfil}</span><span>${c.est}</span></div>
      <div class="cl-fecha">${nombreFecha(f)}${f.anio ? ` <span class="cl-anio">${f.anio} DR</span>` : ""}</div>
      ${notas.length ? `<div class="cl-notas">${notas.join(" · ")}</div>` : ""}
      <div class="cl-cuerpo">
        <div class="cl-principal">
          <div class="cl-icono">${ICONO_P[c.precip] || ICONO[c.cielo] || ""}</div>
          <div><div class="cl-temp"><b>${grados(c.max)}</b> <span>/ ${grados(c.min)}</span></div>
          <div class="cl-frase">${frase(c)}</div></div>
        </div>
        <dl class="cl-datos">
          <dt>Viento</dt><dd>${vientoTxt}</dd>
          ${c.sens < c.min - 1 ? `<dt>Sensación térmica</dt><dd>${grados(c.sens)} de noche</dd>` : ""}
          <dt>Humedad</dt><dd>${c.humManana} por la mañana, ${c.humTarde} por la tarde</dd>
          <dt>Sol</dt><dd>sale a las ${s.sale}, se pone a las ${s.pone} (${s.horas.toFixed(1).replace(".", ",")} h de luz)</dd>
          <dt>Selûne</dt><dd class="cl-dd-luna">${svgLuna(l, 22)} ${l.nombre} (${Math.round(l.luz * 100)} %)${llena && l.nombre !== "luna llena" ? `; llena el ${nombreFecha(llena, true)}` : ""}${nueva && l.nombre !== "luna nueva" ? `; nueva el ${nombreFecha(nueva, true)}` : ""}</dd>
        </dl>
      </div>
      ${ef.length ? `<details class="cl-efectos"><summary>Efectos de juego</summary><ul>${ef.map((x) => `<li>${x}</li>`).join("")}</ul></details>` : ""}
    </div>`
  }

  // recuadro en regiones y lugares
  function montarLugar(div) {
    const perfil = perfilDe(div), lugar = div.dataset.lugar || div.dataset.region
    let f = hoy(), dia = 0
    const pintar = () => {
      div.innerHTML = informe(f, perfil, lugar, lugar) +
        `<div class="cl-nav"><button data-k="-1">‹ día anterior</button>${dia ? `<button data-k="0">hoy</button>` : ""}<button data-k="1">día siguiente ›</button></div>`
      div.querySelectorAll("button[data-k]").forEach((b) => b.addEventListener("click", () => {
        const k = +b.dataset.k
        dia = k === 0 ? 0 : dia + k
        f = mover(hoy(), dia); pintar()
      }))
      const sum = div.closest("details")?.querySelector("summary .cl-sum")
      if (sum && dia === 0) sum.innerHTML = resumen(clima(f, perfil, lugar))
    }
    pintar()
  }

  // almanaque: elegir lugar y fecha; mes completo con luna, fiestas y clima
  function montarAlmanaque(div) {
    const opcionesLugar = [
      ...Object.entries(D.perfiles).map(([k, p]) => [`perfil:${k}`, p.nombre]),
    ]
    const regiones = Object.keys(D.regiones).sort()
    const lugares = Object.keys(D.lugares).sort()
    let f = hoy()
    const selMes = MESES.map(([m], i) => `<option value="m${i}">${m} (${GREG[i]})</option>`).join("") +
      ["Midwinter", "Greengrass", "Midsummer", "Shieldmeet", "Highharvestide", "Feast of the Moon"].map((x) => {
        const g = fechaDe(1376, ordinalFestivo(1376, x)), fn = x === "Shieldmeet" ? greg(g) : greg(fechaDe(1374, ordinalFestivo(1374, x)))
        return `<option value="f${x}">${x} (${fn})</option>` }).join("")
    div.innerHTML = `<div class="cl-panel"><div class="cl-fila">
        <label>Lugar <select data-k="lugar">
          <optgroup label="Regiones">${regiones.map((r) => `<option value="region:${r}">${r}</option>`).join("")}</optgroup>
          <optgroup label="Ciudades y pueblos">${lugares.map((r) => `<option value="lugar:${r}">${r}</option>`).join("")}</optgroup>
          <optgroup label="Tipo de terreno">${opcionesLugar.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</optgroup>
        </select></label>
        <label>Año DR <input type="number" data-k="anio" min="1" max="2000"></label>
        <label>Mes <select data-k="mes">${selMes}</select></label>
        <label>Día <input type="number" data-k="dia" min="1" max="30"></label>
        <button data-a="-1">‹</button><button data-a="hoy">Hoy</button><button data-a="1">›</button>
      </div></div><div class="cl-res"></div><div class="cl-mes"></div>`
    const q = (k) => div.querySelector(`[data-k="${k}"]`)
    q("lugar").value = "region:Cormyr"
    const res = div.querySelector(".cl-res"), mes = div.querySelector(".cl-mes")
    function lugarSel() {
      const [t, v] = q("lugar").value.split(":")
      if (t === "perfil") return { perfil: v, lugar: null, titulo: D.perfiles[v].nombre }
      const falso = { dataset: t === "region" ? { region: v } : { lugar: v } }
      return { perfil: perfilDe(falso), lugar: v, titulo: v }
    }
    function aControles() {
      q("anio").value = f.anio
      q("mes").value = f.festivo ? "f" + f.festivo : "m" + f.mes
      q("dia").value = f.festivo ? "" : f.dia
      q("dia").disabled = !!f.festivo
    }
    function deControles() {
      const anio = parseInt(q("anio").value) || f.anio, m = q("mes").value
      let n
      if (m[0] === "f") { n = ordinalFestivo(anio, m.slice(1)); if (n <= 0) n = ordinal(anio, 6, 30) }
      else n = ordinal(anio, +m.slice(1), Math.min(30, Math.max(1, parseInt(q("dia").value) || 1)))
      f = fechaDe(anio, n)
    }
    function pintar() {
      aControles()
      const L = lugarSel()
      res.innerHTML = informe(f, L.perfil, L.lugar, L.titulo)
      // mes del día elegido (si es festivo, el mes anterior)
      const m = f.festivo ? diasDel(f.anio)[f.n - 2].mes : f.mes
      const celdas = []
      for (let d = 1; d <= 30; d++) {
        const g = fechaDe(f.anio, ordinal(f.anio, m, d)), c = clima(g, L.perfil, L.lugar), l = luna(g)
        const notas = notasDelDia(g)
        celdas.push(`<button class="cl-celda${g.n === f.n ? " cl-sel" : ""}${notas.length ? " cl-fiesta" : ""}" data-n="${g.n}" title="${nombreFecha(g, true)}: ${frase(c)}${notas.length ? " — " + notas.join(", ").replace(/<[^>]+>/g, "") : ""}">
          <span class="cl-n">${d}</span>${svgLuna(l, 14)}<span class="cl-i">${ICONO_P[c.precip] || ICONO[c.cielo]}</span>
          <span class="cl-t">${c.max}°/${c.min}°</span></button>`)
      }
      const fest = diasDel(f.anio).filter((x, i) => x.festivo && diasDel(f.anio)[i - 1]?.mes === m)
      const festHtml = fest.map((x) => { const g = fechaDe(f.anio, ordinalFestivo(f.anio, x.festivo)); const c = clima(g, L.perfil, L.lugar)
        return `<button class="cl-celda cl-festivo${g.n === f.n ? " cl-sel" : ""}" data-n="${g.n}" title="${nombreFecha(g, true)}: ${frase(c)}"><span class="cl-n">${x.festivo} (${greg(g)})</span>${svgLuna(luna(g), 14)}<span class="cl-i">${ICONO_P[c.precip] || ICONO[c.cielo]}</span><span class="cl-t">${c.max}°/${c.min}°</span></button>` }).join("")
      mes.innerHTML = `<div class="cl-mes-cab">${MESES[m][0]} (${GREG[m]}) <span>· ${MESES[m][2]}</span> · ${f.anio} DR</div>
        <div class="cl-rejilla">${[0, 1, 2].map((t) => `<div class="cl-tenday"><div class="cl-tenday-n">${ORDF[t]} tenday</div>${celdas.slice(t * 10, t * 10 + 10).join("")}</div>`).join("")}</div>
        ${festHtml ? `<div class="cl-festivos">${festHtml}</div>` : ""}`
      mes.querySelectorAll("button[data-n]").forEach((b) => b.addEventListener("click", () => { f = fechaDe(f.anio, +b.dataset.n); pintar() }))
    }
    ;["anio", "mes", "dia"].forEach((k) => q(k).addEventListener("change", () => { deControles(); pintar() }))
    q("lugar").addEventListener("change", pintar)
    div.querySelectorAll("button[data-a]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.a
      f = a === "hoy" ? hoy() : mover(f, +a); pintar()
    }))
    pintar()
  }

  // API para otras herramientas (p. ej. el generador de encuentros toma la estación del día)
  // ───────────── Cabecera: la fecha de hoy, Selûne y el tiempo en un lugar del reino al azar ─────────────
  // Va en el hueco a la izquierda del logo (pantallas anchas). Cambia de lugar cada 20 s (no mientras el mouse está encima).
  // Quartz rehace el <body> al navegar: se vuelve a crear en cada "nav", con el mismo lugar.
  let rotador = null, lugarCab = null
  function poolCabecera() {
    const fuera = new Set(D.fueraDelReino || [])
    return Object.keys(D._enlaces || {}).filter((x) => !fuera.has(x))
  }
  function perfilDeNombre(nombre) {
    return perfilDe({ dataset: D.regiones[nombre] && !D.lugares[nombre] ? { region: nombre } : { lugar: nombre } })
  }
  function ubicarCabecera(el) {
    const logoH = Math.min(260, innerHeight * 0.3)
    const libre = (innerWidth - logoH * 2.98) / 2 - 30
    // alineado con el marco de la barra lateral izquierda, si está a la vista
    const s = document.querySelector(".left.sidebar"), rs = s && s.getBoundingClientRect()
    const izq = rs && rs.width > 150 ? rs.left + 8 : 16
    const ancho = Math.min(rs && rs.width > 150 ? rs.width - 30 : 280, libre + 16 - izq)
    const ok = innerWidth > 800 && ancho >= 200
    el.hidden = !ok
    if (ok) { el.style.left = izq + "px"; el.style.width = ancho + "px"; el.style.height = logoH + "px" }
    el.classList.toggle("clc-compacta", logoH < 235)
  }
  function pintarCabecera(el, otro) {
    const pool = poolCabecera()
    if (!pool.length) return
    if (otro || !lugarCab) { let x; do { x = pool[Math.floor(Math.random() * pool.length)] } while (pool.length > 1 && x === lugarCab); lugarCab = x }
    const f = hoy(), l = luna(f), c = clima(f, perfilDeNombre(lugarCab), lugarCab)
    const dia = f.festivo ? f.festivo : `${f.dia} de ${MESES[f.mes][0]}`
    const sub = f.festivo ? FESTIVO_ES[f.festivo] : `${ORD[(f.dia - 1) % 10]} día de la ${ORDF[Math.floor((f.dia - 1) / 10)]} tenday`
    const notas = notasDelDia(f)
    const href = (p) => RAIZ + p.split("/").map(encodeURIComponent).join("/")
    const viento = c.viento === 0 ? "sin viento" : `viento ${c.vientoNombre}${c.dir ? " del " + c.dir : ""}`
    el.innerHTML = `
      <div class="clc-fecha">${svgLuna(l, 46)}<div>
        <div class="clc-dia">${dia}</div><div class="clc-greg">(${greg(f)})</div>
        <div class="clc-sub clc-tenday">${sub}</div><div class="clc-sub">Selûne: ${l.nombre}</div>
        ${notas.length ? `<div class="clc-nota">${notas.join(" · ")}</div>` : ""}</div></div>
      <div class="clc-sep"></div>
      <div class="clc-lugar">El tiempo en <a href="${href(D._enlaces[lugarCab])}">${lugarCab}</a></div>
      <div class="clc-clima"><span class="clc-icono">${ICONO_P[c.precip] || ICONO[c.cielo] || ""}</span><span><b>${grados(c.max)}</b> / ${grados(c.min)}</span></div>
      <div class="clc-frase">${frase(c)}; ${viento}.</div>
      <div class="clc-pie"><button type="button" class="clc-otro" title="Otro lugar">otro lugar ↻</button><a href="${href("para-el-dm/clima-y-calendario")}">almanaque ›</a></div>`
    el.querySelector(".clc-otro").addEventListener("click", () => pintarCabecera(el, true))
  }
  function montarCabecera() {
    if (!D._enlaces) return
    let el = document.getElementById("cl-cabecera")
    if (!el) {
      el = document.createElement("aside")
      el.id = "cl-cabecera"
      el.setAttribute("aria-label", "Almanaque de hoy")
      document.body.appendChild(el)
    }
    ubicarCabecera(el)
    pintarCabecera(el)
    if (!rotador) {
      rotador = setInterval(() => {
        const e = document.getElementById("cl-cabecera")
        if (!e || e.hidden || e.matches(":hover")) return
        e.classList.add("clc-cambia")
        setTimeout(() => { pintarCabecera(e, true); e.classList.remove("clc-cambia") }, 400)
      }, 20000)
      addEventListener("resize", () => { const e = document.getElementById("cl-cabecera"); if (e) ubicarCabecera(e) })
    }
  }

  async function cargar() {
    if (!D) D = await (await fetch(BASE + "datos.json" + (V ? "?v=" + V : ""))).json()
    return D
  }
  window.CormyrClima = { cargar, hoy, mover, fechaDe, ordinal, estacionDe, luna, sol, nombreFecha, clima, efectos, frase, absoluto }

  async function iniciar() {
    const divs = document.querySelectorAll("div.clima")
    try { await cargar() }
    catch (e) { divs.forEach((x) => (x.textContent = "No se pudo cargar el clima.")); return }
    montarCabecera()
    divs.forEach((div) => {
      if (div.dataset.montado) return
      div.dataset.montado = "1"
      div.dataset.modo === "almanaque" ? montarAlmanaque(div) : montarLugar(div)
    })
  }
  document.addEventListener("nav", iniciar)
  if (document.readyState !== "loading") iniciar()
})()
