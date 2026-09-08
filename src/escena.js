/**
 * La escena: el arte y el rótulo, revelados en una terminal de verdad.
 *
 * Todo el movimiento se hace reescribiendo la línea actual con "\r": nunca se
 * repinta un bloque más alto que la pantalla, así que da igual que la consola
 * tenga 24 filas o 80, y funciona igual por SSH o por curl, donde el tamaño ni
 * se sabe. El único sitio donde se sube el cursor es el bucle final, y sólo si
 * consta que el rótulo cabe entero.
 */
import { ESC, fg, hsl, aRGB } from './color.js';
import { pinta } from './lienzo.js';

/** Paleta de la terminal del regalo (misma que src/styles/global.css). */
export const PALETA = {
  verdeTen: '#8dffc9',      // el fósforo del escaneo
  gris:     '#6f8a80'       // la línea de despedida bajo el rótulo
};

const rgbDe = (hex) => aRGB(hex.replace('#', ''));
const col = (hex, nivel) => (nivel === 'ninguno' ? '' : fg(rgbDe(hex), nivel));

/** Texto suelto ya pintado. */
export function tinta(texto, hex, nivel) {
  if (nivel === 'ninguno') return texto;
  return col(hex, nivel) + texto + ESC.reset;
}

/* -------------------------------------------------------------- arte ---- */

/**
 * Revela el arte fila a fila: primero pasa el escáner en verde fósforo y, en
 * cuanto termina la fila, florece a color. Es la misma revelación de la web
 * (escaneo y luego cascada), reducida a lo que cabe hacer en una sola línea.
 */
export async function revelaArte(s, arte, { paso = 34 } = {}) {
  const verde = rgbDe(PALETA.verdeTen);
  for (const linea of arte) {
    if (!s.vivo) return;
    if (!linea.length) { s.linea(); continue; }

    const ancho = linea.reduce((n, t) => n + t.texto.length, 0);
    const trozos = Math.max(1, Math.ceil(ancho / paso));
    for (let k = 1; k <= trozos; k++) {
      const hasta = Math.round(ancho * k / trozos);
      s.reescribe(pinta(recorta(linea, hasta), s.nivel, { desde: verde, t: 0 }));
      await s.espera(9);
      if (!s.vivo) return;
    }
    // floración: la misma fila, ya con el color de la foto
    s.reescribe(pinta(linea, s.nivel, {}));
    s.linea();
    await s.espera(11);
  }
}

/** Los primeros `n` caracteres de una línea, respetando los tramos. */
function recorta(linea, n) {
  const out = [];
  let queda = n;
  for (const t of linea) {
    if (queda <= 0) break;
    out.push(t.texto.length <= queda ? t : { ...t, texto: t.texto.slice(0, queda) });
    queda -= t.texto.length;
  }
  return out;
}

/* ------------------------------------------------------------ rótulo ---- */

/**
 * Arcoíris: el mismo de `@keyframes arcoiris` de la web, donde cada renglón
 * entero va de un color y arranca desfasado del anterior. Aquí el tono se
 * mueve además por columna, pero muy poco (un tercio de vuelta a lo largo de
 * cien columnas): lo justo para que el color viaje, sin convertir cada letra en
 * un escape ANSI distinto, que por curl se nota en el ancho de banda.
 *
 * Lo que se cuantiza es sólo la parte que aporta la columna: eso agrupa
 * caracteres seguidos en un mismo escape (que es de lo que se trata) mientras
 * la fase sigue corriendo continua. Cuantizarla también, como se hacía antes,
 * dejaba el color quieto dos o tres fotogramas y luego lo hacía saltar.
 */
export function arcoiris(texto, nivel, fase, { paso = 0.003, pasos = 32 } = {}) {
  if (nivel === 'ninguno') return texto;
  let out = '';
  let ultimo = null;
  [...texto].forEach((ch, i) => {
    if (ch === ' ') { out += ch; return; }
    const h = fase + Math.round(i * paso * pasos) / pasos;
    const esc = fg(hsl(h, 0.78, 0.7), nivel);
    if (esc !== ultimo) { out += esc; ultimo = esc; }
    out += ch;
  });
  return out + (ultimo ? ESC.reset : '');
}

/**
 * Aparece el rótulo, renglón a renglón, con un barrido de izquierda a derecha.
 *
 * `desfase` es lo que gira el tono de una fila a la siguiente: viene de
 * `layout.js` ya dividido entre las filas que ocupa un renglón, para que el
 * arcoíris se desfase de renglón a renglón —como en la web— y no dentro de cada
 * letra, que la dejaba con seis colores y ninguno.
 */
export async function revelaRotulo(s, rotulo, { fase = 0, desfase = 0.06 } = {}) {
  if (!rotulo.length) return;
  const margen = Math.max(0, Math.floor((s.ancho - Math.max(...rotulo.map((l) => l.length))) / 2));
  const sangria = ' '.repeat(margen);

  s.linea();
  for (let i = 0; i < rotulo.length; i++) {
    if (!s.vivo) return;
    const linea = rotulo[i];
    if (!linea.trim()) { s.linea(); await s.espera(60); continue; }
    const trozos = Math.max(1, Math.ceil(linea.length / 26));
    for (let k = 1; k <= trozos; k++) {
      const hasta = Math.round(linea.length * k / trozos);
      s.reescribe(sangria + arcoiris(linea.slice(0, hasta), s.nivel, fase - i * desfase));
      await s.espera(9);
      if (!s.vivo) return;
    }
    s.linea();
  }
  s.linea();
}

/**
 * Repinta el rótulo entero una y otra vez, con el arcoíris rodando.
 *
 * Es el único sitio donde se sube el cursor, y por eso `cola` (las líneas de
 * despedida) se repinta aquí dentro: si se hubiera escrito antes, cada vuelta
 * la machacaría. En la primera vuelta el rótulo ya está en pantalla y la cola
 * no, así que se sube menos.
 */
export async function bucleRotulo(s, rotulo, { cola = [], fps = 12, desfase = 0.06 } = {}) {
  if (!rotulo.length) return;
  const margen = Math.max(0, Math.floor((s.ancho - Math.max(...rotulo.map((l) => l.length))) / 2));
  const sangria = ' '.repeat(margen);
  const primera = rotulo.length + 1;              // rótulo + su línea en blanco
  const total = primera + cola.length;
  let subir = primera;
  let fase = 0;

  while (s.vivo) {
    s.escribe(ESC.arriba(subir));
    for (let i = 0; i < rotulo.length; i++) {
      const linea = rotulo[i];
      s.escribe(ESC.limpiaLinea);
      s.linea(linea.trim() ? sangria + arcoiris(linea, s.nivel, fase - i * desfase) : '');
    }
    s.escribe(ESC.limpiaLinea);
    s.linea();
    for (const linea of cola) { s.escribe(ESC.limpiaLinea); s.linea(linea); }
    subir = total;
    fase += 0.012;
    await s.espera(1000 / fps);
  }
}

/**
 * Bucle de una sola línea, para cuando no consta que el rótulo quepa en la
 * pantalla (por curl no hay manera de saberlo). Una cinta que rueda, como el
 * loro: se queda ahí hasta que cortas con Ctrl-C.
 */
export async function bucleCinta(s, { texto = '', fps = 18 } = {}) {
  const cinta = `   ${texto}   ·`;
  const ancho = Math.max(24, Math.min(s.ancho - 2, 78));
  const doble = cinta.repeat(Math.ceil((ancho + cinta.length) / cinta.length) + 1);
  const margen = ' '.repeat(Math.max(0, Math.floor((s.ancho - ancho) / 2)));
  let p = 0;
  let fase = 0;

  while (s.vivo) {
    const trozo = doble.slice(p, p + ancho);
    s.reescribe(margen + arcoiris(trozo, s.nivel, fase, { paso: 0.008, pasos: 48 }));
    p = (p + 1) % cinta.length;
    fase += 0.008;                 // una vuelta de arcoíris cada ~7s, como el rótulo
    await s.espera(1000 / fps);
  }
}
