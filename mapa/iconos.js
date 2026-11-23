// Íconos del mapa por jerarquía (2026-11-23). Estilo grabado: violeta del sitio, oro viejo de acento,
// halo de papel para que se lean sobre cualquier dibujo. Rangos de población según el DMG 3.5.
// Lo usan mapa.js (en el sitio) y la lámina de muestra (paleta de íconos).
window.MAPA_ICONOS = (function () {
  const V = "#3d3265", O = "#b08d3c", P = "#faf7ee", G = "#6e6690"
  const svg = (cuerpo) =>
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round">${cuerpo}</svg>`
  const estrella = (cx, cy, R, r) => {
    let d = ""
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R
      d += (i ? "L" : "M") + (cx + q * Math.cos(a)).toFixed(2) + " " + (cy + q * Math.sin(a)).toFixed(2)
    }
    return d + "Z"
  }
  return {
    // nombre: [tamaño en px, etiqueta, svg]
    capital: [38, "Capital del reino", svg(
      `<circle cx="16" cy="16" r="14.5" fill="${P}" stroke="${V}" stroke-width="2.2"/>` +
      `<circle cx="16" cy="16" r="11.6" fill="none" stroke="${O}" stroke-width="1.3"/>` +
      `<circle cx="16" cy="16" r="9.6" fill="none" stroke="${V}" stroke-width="0.8"/>` +
      `<path d="${estrella(16, 16.6, 7.6, 3.2)}" fill="${V}" stroke="${O}" stroke-width="0.7"/>`)],
    ciudad: [30, "Ciudad", svg(
      `<circle cx="16" cy="16" r="12.5" fill="${P}" stroke="${V}" stroke-width="2.4"/>` +
      `<circle cx="16" cy="16" r="9.2" fill="none" stroke="${O}" stroke-width="1.4"/>` +
      `<circle cx="16" cy="16" r="5.6" fill="${V}"/>`)],
    pueblo: [20, "Pueblo (más de 900 habitantes)", svg(
      `<circle cx="16" cy="16" r="11" fill="${P}" stroke="${V}" stroke-width="2.6"/>` +
      `<circle cx="16" cy="16" r="6.4" fill="${V}"/>`)],
    aldea: [15, "Aldea (400 a 900)", svg(
      `<circle cx="16" cy="16" r="10.5" fill="${V}" stroke="${P}" stroke-width="3"/>`)],
    caserio: [11, "Caserío (menos de 400)", svg(
      `<circle cx="16" cy="16" r="9" fill="${P}" stroke="${V}" stroke-width="5"/>`)],
    castillo: [24, "Castillo o fortaleza", svg(
      `<path d="M7 29 V12 H9.5 V8 H12.5 V12 H14.5 V8 H17.5 V12 H19.5 V8 H22.5 V12 H25 V29 Z" fill="${V}" stroke="${P}" stroke-width="1.6"/>` +
      `<path d="M13.5 29 V23 Q16 20.2 18.5 23 V29 Z" fill="${O}"/>` +
      `<path d="M16 8 V2.5 M16 2.5 L21 4 L16 5.5" fill="${O}" stroke="${O}" stroke-width="1.1"/>`)],
    ruina: [24, "Ruina", svg(
      `<path d="M7 29 V13 L9.5 10.5 L11 13 L12.5 9 V14 L15.5 11.5 L17 15 L19 10 L20.5 13 L22.5 12 L25 16 V29 Z" fill="${P}" stroke="${V}" stroke-width="1.8"/>` +
      `<path d="M9.5 18 H14 M17 21 H23 M9.5 24 H13 M18 26 H23" stroke="${V}" stroke-width="1"/>` +
      `<path d="M13.5 29 V24.5 Q16 22 18.5 24.5 V29" fill="none" stroke="${O}" stroke-width="1.3"/>`)],
    arrasada: [30, "Ciudad arrasada", svg(
      `<circle cx="16" cy="16" r="12.5" fill="${P}" stroke="${V}" stroke-width="2" stroke-dasharray="3.2 2.4"/>` +
      `<path d="M9 23 L23 9 M9 9 L23 23" stroke="${V}" stroke-width="2.4"/>` +
      `<circle cx="16" cy="16" r="3" fill="${O}"/>`)],
    templo: [22, "Templo o monasterio", svg(
      `<path d="M4.5 13 L16 4.5 L27.5 13 Z" fill="${O}" stroke="${V}" stroke-width="1.6"/>` +
      `<path d="M7 13 V27 M12.3 13 V27 M19.7 13 V27 M25 13 V27" stroke="${V}" stroke-width="2"/>` +
      `<path d="M4.5 28.5 H27.5" stroke="${V}" stroke-width="2.4"/>`)],
    sitio: [18, "Lugar notable", svg(
      `<path d="M16 3 L28 16 L16 29 L4 16 Z" fill="${P}" stroke="${V}" stroke-width="2.2"/>` +
      `<path d="M16 9.5 L22.5 16 L16 22.5 L9.5 16 Z" fill="${O}"/>`)],
    extranjera: [20, "Ciudad de otro reino", svg(
      `<circle cx="16" cy="16" r="11.5" fill="${P}" stroke="${G}" stroke-width="2.2"/>` +
      `<circle cx="16" cy="16" r="4.6" fill="${G}"/>`)],
  }
})()
