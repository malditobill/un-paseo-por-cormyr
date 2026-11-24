// Botón «ancho completo» (2026-11-24), como el «Expand» de la Forgotten Realms Wiki: esconde las barras laterales
// y deja la columna central a todo el ancho. La elección queda guardada en este navegador.
// Lo inyecta scripts/web/mapa.py en todas las páginas; funciona con la navegación sin recarga de Quartz («nav»).
(function () {
  const CLAVE = "cronica-ancho-completo"
  const html = document.documentElement
  const leer = () => { try { return localStorage.getItem(CLAVE) === "1" } catch (e) { return false } }
  const guardar = (v) => { try { localStorage.setItem(CLAVE, v ? "1" : "0") } catch (e) {} }
  const ICONO_ABRIR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>'
  const ICONO_CERRAR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>'

  function aplicar(v) {
    html.classList.toggle("cronica-ancha", v)
    const b = document.querySelector(".boton-expandir")
    if (b) {
      b.setAttribute("aria-pressed", String(v))
      b.title = v ? "Volver al ancho normal" : "Ancho completo"
      b.setAttribute("aria-label", b.title)
      b.innerHTML = v ? ICONO_CERRAR : ICONO_ABRIR
    }
    window.dispatchEvent(new Event("resize")) // el mapa (Leaflet) se reacomoda al nuevo ancho
  }
  function poner() {
    const centro = document.querySelector(".center")
    if (!centro || centro.querySelector(".boton-expandir")) return aplicar(leer())
    const b = document.createElement("button")
    b.type = "button"
    b.className = "boton-expandir"
    b.addEventListener("click", () => { const v = !html.classList.contains("cronica-ancha"); guardar(v); aplicar(v) })
    centro.prepend(b)
    aplicar(leer())
  }
  html.classList.toggle("cronica-ancha", leer()) // antes de pintar, para que no salte
  document.addEventListener("nav", poner)
  if (document.readyState !== "loading") poner()
  else document.addEventListener("DOMContentLoaded", poner)
})()
