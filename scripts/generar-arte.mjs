#!/usr/bin/env node
/**
 * generar-arte — reescribe src/arte.js a partir de pinto.png y girasol.png.
 *
 *   npm run arte              # regenera todos los tamaños
 *   npm run arte -- --ver 96  # además lo pinta en la terminal para revisarlo
 *
 * Aquí se generan varios anchos de cada imagen porque la terminal, al revés que
 * el navegador, no puede reescalar: si el retrato no cabe, se parte. El que se
 * usa lo decide `layout.js` mirando el ancho real de la consola.
 *
 * Los tamaños van de ocho en ocho columnas (y el girasol más apretado todavía)
 * porque cada salto que no existe son columnas de consola desperdiciadas: con
 * la escalera antigua —96, 72, 48, 32— una terminal de 100 columnas se
 * conformaba con el retrato de 72 y perdía un tercio del detalle que cabía.
 * El tope son 120 columnas, que a 546 px de original todavía salen a cuatro
 * píxeles por celda; de ahí para arriba se estaría ampliando, no detallando.
 *
 * El retrato es una foto; las flores no: las dibuja `npm run flores` en
 * `scripts/dibujar-flores.mjs`, y por eso llevan otros ajustes (fondo recortado
 * por croma, sin viñeta y sin invertir en monocromo).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarImagen, aAscii } from './foto.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Sin color el arte no se lee: con `minden: 0.78` todas las celdas llevan
 * carácter y la forma la pone el color, así que en monocromo sale un borrón.
 * La versión de repuesto vuelve al ASCII clásico, con huecos.
 *
 * Y hay dos, porque la polaridad no es la misma. En el retrato, densidad
 * invertida: es una cara clara sobre un fondo oscuro y lo que dibuja es la
 * sombra. En las flores, sin invertir: son amarillas de punta a punta sobre un
 * fondo recortado, y al invertirlas los pétalos —lo más claro— se quedaban en
 * blanco y la flor desaparecía. Así los pétalos van densos y el disco de
 * semillas hace de hueco en el centro, que es lo que se ve de verdad.
 */
const MONO_FOTO = { invert: true, minden: 0, pg: 3 };
const MONO_FLOR = { invert: false, minden: 0, pg: 1 };

/** Mismos ajustes que el regalo web, salvo `aspect` (celda de terminal, 0.5). */
const RETRATO = {
  fichero: 'pinto.png',
  anchos: [120, 112, 104, 96, 88, 80, 72, 64, 56, 48, 40, 32],
  opciones: {},
  mono: MONO_FOTO
};

/**
 * Las flores se dibujan sobre blanco y se recortan por croma (`key`: claro y
 * neutro), así que el fondo desaparece y se ve el de la terminal. Sin viñeta,
 * que aquí no hay foto que encuadrar, y con `sat` bajo: el dibujo ya viene
 * saturado de casa y subirlo más deja los pétalos en un amarillo plano de
 * rotulador, sin volumen.
 */
const FLOR = { key: [225, 12], vig: 0, crop: [0, 0, 1, 1], minden: 0.78, piso: 0.14, sat: 1.15 };

/** El girasol que acompaña al retrato, a su derecha. */
const GIRASOL = {
  fichero: 'girasol.png',
  anchos: [56, 48, 42, 36, 30, 26, 22, 18],
  opciones: FLOR,
  mono: MONO_FLOR
};

/**
 * La guirnalda, que va tumbada debajo de los dos.
 *
 * Sus anchos no son los de una figura suelta sino los del conjunto ya montado
 * (retrato + hueco + girasol), que es contra lo que se mide: se coge la mayor
 * que quepa y se centra debajo. De ahí que lleguen hasta 176.
 */
const GUIRNALDA = {
  fichero: 'guirnalda.png',
  anchos: [176, 160, 144, 128, 112, 96, 84, 72, 60, 48],
  opciones: { ...FLOR, piso: 0.18 },
  mono: MONO_FLOR
};

function genera({ fichero, anchos, opciones, mono }) {
  const img = cargarImagen(join(RAIZ, fichero));
  return anchos.map((cols) => {
    const { color, filas } = aAscii(img, { ...opciones, cols });
    const plano = aAscii(img, { ...opciones, ...mono, cols }).texto;
    const ancho = Math.max(...color.map((f) =>
      f.split('|').map((t) => t.slice(6)).join('').length));
    return { pedido: cols, cols: ancho, filas, color, plano };
  });
}

const retrato = genera(RETRATO);
const girasol = genera(GIRASOL);
const guirnalda = genera(GUIRNALDA);

const bloque = (v) => v.map((t) =>
  `  {\n    cols: ${t.cols}, alto: ${t.filas},\n` +
  `    color: \`\n${t.color.join('\n')}\n\`,\n` +
  `    plano: \`\n${t.plano.join('\n')}\n\`\n  }`
).join(',\n');

const salida = `/**
 * Arte ASCII en color, generado desde pinto.png y girasol.png.
 *
 * NO SE EDITA A MANO: sale de \`npm run arte\` (scripts/generar-arte.mjs).
 *
 * Una fila por línea. Cada fila son tramos separados por "|", y cada tramo son
 * 6 dígitos hex de color seguidos de su texto:  "2b2320..:|d9a17c###"
 * Los caracteres contiguos del mismo color van agrupados: si no, sale un escape
 * ANSI por carácter y el retrato pesa cuatro veces más.
 *
 * De cada imagen hay varios tamaños porque la terminal no reescala: el que toca
 * lo elige src/layout.js según el ancho real de la consola. Y de cada tamaño
 * hay dos versiones: \`filas\` (en color) y \`mono\` (texto plano, para terminales
 * sin color, NO_COLOR o cuando la salida va a un fichero).
 */

/** Parte una fila en tramos [colorHex, texto]. */
export function tramos(fila) {
  return fila ? fila.split('|').map((s) => [s.slice(0, 6), s.slice(6)]) : [];
}

const parte = (s) => s.replace(/^\\n/, '').replace(/\\n$/, '').split('\\n');
const filas = (a) => a.map((v) => ({ ...v, filas: parte(v.color), mono: parte(v.plano) }));

/**
 * Retrato de Pinto, de mayor a menor.
 *
 * El brillo se sube un poco al pintar, no en los datos: un carácter ASCII sólo
 * entinta parte de su celda, así que el mismo color se ve más apagado en la
 * terminal que en la foto. No se sube más porque a 1.45 se queman los brillos
 * (un 8% de los caracteres) y la cara se va a blanco. Nada que ver con el
 * \`brightness(1.9)\` de la web, que compensaba las scanlines del CSS.
 */
export const RETRATO = filas([
${bloque(retrato)}
]);
export const RETRATO_BRILLO = 1.2;

/**
 * El girasol que acompaña al retrato, de mayor a menor.
 *
 * Un poco de brillo porque un carácter ASCII sólo entinta parte de su celda y
 * el amarillo se apaga; poco, que los pétalos ya rozan el 255 en la punta y lo
 * siguiente es que se vayan a blanco y se pierda el filo.
 */
export const GIRASOL = filas([
${bloque(girasol)}
]);
export const GIRASOL_BRILLO = 1.15;

/**
 * La guirnalda de flores, tumbada debajo de los dos.
 *
 * Se elige por el ancho del conjunto ya montado, no por el de la consola, y se
 * centra debajo: es la peana de la escena, no un tercer protagonista.
 */
export const GUIRNALDA = filas([
${bloque(guirnalda)}
]);
export const GUIRNALDA_BRILLO = 1.15;
`;

const destino = join(RAIZ, 'src/arte.js');
writeFileSync(destino, salida);

const kb = (Buffer.byteLength(salida) / 1024).toFixed(1);
console.error(`→ src/arte.js  (${kb} kB)`);
for (const t of [...retrato, ...girasol, ...guirnalda]) {
  console.error(`   ${String(t.cols).padStart(3)} x ${String(t.filas).padStart(2)} caracteres`);
}
