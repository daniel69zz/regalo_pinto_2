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
  verdeTen: '#8dffc9'       // el fósforo del escaneo
};

const rgbDe = (hex) => aRGB(hex.replace('#', ''));

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
  const sangria = sangriaRotulo(s, rotulo);

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

/** Los espacios que centran el rótulo en la consola. */
export function sangriaRotulo(s, rotulo) {
  return ' '.repeat(Math.max(0, Math.floor((s.ancho - Math.max(...rotulo.map((l) => l.length))) / 2)));
}

/**
 * Repinta el final de la escena una y otra vez: el arcoíris rodando por el
 * rótulo y, encima, los girasoles girando: los de la guirnalda y el grande, el
 * que está junto a Pinto.
 *
 * Es el único sitio donde se sube el cursor.
 *
 * `giro` son los fotogramas de la guirnalda y `flor` los del girasol grande,
 * que va apoyado sobre ella, junto al retrato: son lo único del arte que puede
 * animarse, porque están al final de todo y siguen en pantalla. De Pinto se
 * suele ver sólo la parte de abajo; subir hasta su cara sería pintar a ciegas.
 * Quien decide si caben es `regalo.js`, que sabe cuántas filas tiene la
 * consola: si no, llegan vacíos y se quedan quietos donde los dejó el revelado.
 *
 * Del girasol se repinta sólo su trozo de cada fila: el cursor salta a la
 * columna donde empieza (`flor.columna`) y borra de ahí al final, así que el
 * retrato de la izquierda no se toca.
 *
 * Los girasoles van a `giroFps`, mucho más despacio que el arcoíris, y entre
 * cambio y cambio no se reescriben: se salta por encima con un movimiento de
 * cursor. No es sólo estética —un girasol da la vuelta al sol, no a la
 * lavadora—: un fotograma de guirnalda son unos 9 kB de escapes ANSI, y a la
 * velocidad del arcoíris serían 110 kB/s por curl. A tres por segundo son 30, y
 * el giro se ve igual de bien.
 */
export async function bucleRotulo(s, rotulo,
                                  { fps = 12, desfase = 0.06,
                                    giro = [], flor = null, giroFps = 3 } = {}) {
  if (!rotulo.length) return;
  const sangria = sangriaRotulo(s, rotulo);
  const altoGiro = giro[0]?.length ?? 0;          // filas de la guirnalda
  const altoFlor = altoGiro ? (flor?.marcos[0]?.length ?? 0) : 0;
  // flor + guirnalda + su blanco + rótulo + el blanco de después
  const subir = altoFlor + altoGiro + (altoGiro ? 1 : 0) + rotulo.length + 1;
  let fase = 0;
  let tic = 0;
  let pintado = -1;                               // qué fotograma está en pantalla
  let florPintada = 0;                            // el revelado dejó puesto el primero

  while (s.vivo) {
    s.escribe(ESC.arriba(subir));
    const marco = Math.floor(tic * giroFps / fps);

    if (altoFlor) {
      const m = marco % flor.marcos.length;
      if (m !== florPintada) {
        for (const linea of flor.marcos[m]) {
          s.escribe(ESC.columna(flor.columna) + ESC.limpiaLinea);
          s.linea(linea.length ? pinta(linea, s.nivel, {}) : '');
        }
        florPintada = m;
      } else {
        s.escribe(ESC.abajo(altoFlor));
      }
    }

    if (altoGiro) {
      const m = marco % giro.length;
      if (m !== pintado) {
        for (const linea of giro[m]) {
          s.escribe(ESC.limpiaLinea);
          s.linea(linea.length ? pinta(linea, s.nivel, {}) : '');
        }
        pintado = m;
      } else {
        s.escribe(ESC.abajo(altoGiro));           // no ha cambiado: ni se toca
      }
      s.escribe(ESC.limpiaLinea);
      s.linea();
    }

    for (let i = 0; i < rotulo.length; i++) {
      const linea = rotulo[i];
      s.escribe(ESC.limpiaLinea);
      s.linea(linea.trim() ? sangria + arcoiris(linea, s.nivel, fase - i * desfase) : '');
    }
    s.escribe(ESC.limpiaLinea);
    s.linea();

    fase += 0.012;
    tic++;
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
