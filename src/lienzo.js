/**
 * Lienzo: componer bloques de arte y pintarlos en ANSI.
 *
 * Una "línea" es un array de tramos { texto, hex, brillo }. Se trabaja así y no
 * con cadenas ya pintadas porque la escena recolorea el mismo arte muchas veces
 * (el escaneo en verde, la floración a color, el arcoíris del rótulo) y montar
 * los escapes al final evita tener que quitarlos y volverlos a poner.
 */
import { fg, aRGB, realza, mezcla, ESC } from './color.js';
import { tramos } from './arte.js';

/** Un tramo suelto. `hex` a null = texto sin color (espacios, relleno). */
export const T = (texto, hex = null, brillo = 1) => ({ texto, hex, brillo });

/** Columnas que ocupa una línea. */
export const anchoLinea = (linea) => linea.reduce((n, t) => n + t.texto.length, 0);

/** Columnas del bloque entero. */
export const anchoBloque = (lineas) => lineas.reduce((n, l) => Math.max(n, anchoLinea(l)), 0);

/** Rellena por la derecha hasta `n` columnas. */
export function rellena(linea, n) {
  const falta = n - anchoLinea(linea);
  return falta > 0 ? [...linea, T(' '.repeat(falta))] : linea;
}

/** Desplaza un bloque a la derecha para centrarlo en `ancho` columnas. */
export function centra(lineas, ancho) {
  const w = anchoBloque(lineas);
  const pad = Math.max(0, Math.floor((ancho - w) / 2));
  return pad ? lineas.map((l) => (anchoLinea(l) ? [T(' '.repeat(pad)), ...l] : l)) : lineas;
}

/** Arte monocromo (texto plano) -> líneas de lienzo, sin color. */
export function deTexto(filas) {
  return filas.map((f) => (f ? [T(f)] : []));
}

/** Arte del fichero de datos -> líneas de lienzo. */
export function deArte(filas, brillo = 1) {
  return filas.map((fila) => tramos(fila).map(([hex, texto]) =>
    // 000000 es el fondo recortado: sin color, así respeta el fondo de la terminal
    T(texto, hex === '000000' ? null : hex, brillo)));
}

/**
 * Dos bloques uno al lado del otro, centrados verticalmente entre sí
 * (el `align-items: center` de `.arte` en la web).
 */
export function juntar(a, b, hueco = 3) {
  const w = anchoBloque(a);
  const alto = Math.max(a.length, b.length);
  const desfaseA = Math.floor((alto - a.length) / 2);
  const desfaseB = Math.floor((alto - b.length) / 2);
  const out = [];
  for (let i = 0; i < alto; i++) {
    const izq = a[i - desfaseA] ?? [];
    const der = b[i - desfaseB] ?? [];
    out.push([...rellena(izq, w), T(' '.repeat(hueco)), ...der]);
  }
  return out;
}

/** Bloque de líneas vacías, para reservar sitio en el marco. */
export const vacio = (n) => Array.from({ length: n }, () => []);

/**
 * Pinta una línea.
 *
 * - `desde`: color del que se viene (el verde del escaneo, o el negro del
 *   fundido). Con `t` a 0 la línea sale entera de ese color; a 1, con el suyo.
 * - `tinte`: función opcional (rgb, columna) -> rgb, para el arcoíris.
 */
export function pinta(linea, nivel, { desde = null, t = 1, tinte = null, brillo = 1 } = {}) {
  let out = '';
  let col = 0;
  let ultimo = null;     // último escape emitido, para no repetirlo
  let pintado = false;   // ¿se llegó a tocar el color? entonces hay que resetear
  for (const tr of linea) {
    if (!tr.hex || !tr.texto) {                    // relleno: ni escape ni color
      out += tr.texto;
      col += tr.texto.length;
      ultimo = null;
      continue;
    }
    let rgb = realza(aRGB(tr.hex), (tr.brillo ?? 1) * brillo);
    if (desde && t < 1) rgb = mezcla(desde, rgb, t);
    if (tinte) rgb = tinte(rgb, col);
    const esc = nivel === 'ninguno' ? '' : fg(rgb, nivel);
    if (esc !== ultimo) { out += esc; ultimo = esc; pintado ||= Boolean(esc); }
    out += tr.texto;
    col += tr.texto.length;
  }
  // el reset va siempre que se haya pintado algo, aunque la línea acabe en
  // relleno sin color: si no, el color se escapa a la línea siguiente
  return out + (pintado ? ESC.reset : '');
}

