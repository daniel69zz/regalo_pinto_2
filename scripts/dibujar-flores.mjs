#!/usr/bin/env node
/**
 * dibujar-flores — genera girasol.png y guirnalda.png. Sin dependencias.
 *
 *   npm run flores      # redibuja los dos PNG
 *   npm run arte        # y de ahí sale src/arte.js
 *
 * Aquí no hay foto que convertir: las flores se dibujan a mano, píxel a píxel, y
 * luego pasan por el mismo conversor que el retrato del regalo original
 * (scripts/foto.mjs), que es el que decide caracteres y color.
 *
 * Dos cosas que no son capricho:
 *
 * - **Se dibuja a 3x y se reduce.** Una celda de terminal se come cinco píxeles
 *   de ancho, así que el conversor ya promedia mucho; si encima los bordes
 *   llegan dentados, los pétalos salen con escalones. Dibujar a 3x y promediar
 *   es el antialias del pobre, y es todo el que hace falta.
 * - **Fondo blanco puro y flores saturadas.** El conversor recorta el fondo por
 *   croma (`key: [225, 12]`: claro y neutro), así que el blanco desaparece y se
 *   ve el fondo de la terminal. Por eso en la flor no hay ni un blanco puro ni
 *   una sombra gris: se irían por el mismo agujero.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ----------------------------------------------------------------- PNG -- */

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Un chunk PNG: longitud + tipo + datos + CRC. */
function trozo(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}

/** PNG de 8 bits RGB, sin filtros (el zlib ya comprime de sobra). */
function escribePNG(ruta, w, h, rgb) {
  const linea = w * 3;
  const crudo = Buffer.alloc(h * (linea + 1));
  for (let y = 0; y < h; y++) {
    crudo[y * (linea + 1)] = 0;                       // filtro None
    Buffer.from(rgb.buffer, y * linea, linea).copy(crudo, y * (linea + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;                                        // 8 bits por canal
  ihdr[9] = 2;                                        // RGB
  writeFileSync(ruta, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]));
}

/* -------------------------------------------------------------- lienzo -- */

const A = 3;                                          // supermuestreo

class Lienzo {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.W = w * A; this.H = h * A;
    this.px = new Uint8Array(this.W * this.H * 3).fill(255);
  }

  /**
   * Pinta la zona [x0,y0]-[x1,y1] (en píxeles finales) con lo que devuelva
   * `fn(x, y)`: un color, o null para dejar lo que hubiera debajo.
   */
  zona(x0, y0, x1, y1, fn) {
    const a0 = Math.max(0, Math.floor(x0 * A)), a1 = Math.min(this.W, Math.ceil(x1 * A));
    const b0 = Math.max(0, Math.floor(y0 * A)), b1 = Math.min(this.H, Math.ceil(y1 * A));
    for (let y = b0; y < b1; y++) {
      for (let x = a0; x < a1; x++) {
        const c = fn((x + 0.5) / A, (y + 0.5) / A);
        if (!c) continue;
        const i = (y * this.W + x) * 3;
        this.px[i] = c[0]; this.px[i + 1] = c[1]; this.px[i + 2] = c[2];
      }
    }
  }

  /** Promedia los bloques de AxA: aquí es donde se suavizan los bordes. */
  reduce() {
    const out = new Uint8Array(this.w * this.h * 3);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < A; dy++) {
          for (let dx = 0; dx < A; dx++) {
            const i = ((y * A + dy) * this.W + x * A + dx) * 3;
            r += this.px[i]; g += this.px[i + 1]; b += this.px[i + 2];
          }
        }
        const j = (y * this.w + x) * 3;
        const n = A * A;
        out[j] = r / n; out[j + 1] = g / n; out[j + 2] = b / n;
      }
    }
    return out;
  }
}

/**
 * Recorta el blanco de alrededor.
 *
 * No es cosmético: el conversor mide el ancho en columnas sobre la imagen
 * entera, así que cada franja de fondo que sobre son columnas de consola
 * tiradas —pedirle 120 y que devuelva 104—. Y de paso deja que la proporción
 * del dibujo sea la que se ve, no la del lienzo en el que se pintó.
 */
function recortaAlContenido(px, w, h, margen = 2) {
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const croma = Math.max(r, g, b) - Math.min(r, g, b);
      if (r > 249 && g > 249 && b > 249 && croma < 4) continue;   // fondo
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  x0 = Math.max(0, x0 - margen); y0 = Math.max(0, y0 - margen);
  x1 = Math.min(w - 1, x1 + margen); y1 = Math.min(h - 1, y1 + margen);
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  const out = new Uint8Array(nw * nh * 3);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const a = ((y + y0) * w + x + x0) * 3, b = (y * nw + x) * 3;
      out[b] = px[a]; out[b + 1] = px[a + 1]; out[b + 2] = px[a + 2];
    }
  }
  return { px: out, w: nw, h: nh };
}

/* --------------------------------------------------------------- color -- */

const lim = (v) => Math.max(0, Math.min(255, Math.round(v)));
const mezcla = (a, b, t) => [a[0] + (b[0] - a[0]) * t,
                             a[1] + (b[1] - a[1]) * t,
                             a[2] + (b[2] - a[2]) * t];
const sombra = (c, k) => [lim(c[0] * k), lim(c[1] * k), lim(c[2] * k)];

/** Ruido determinista: la misma flor cada vez que se ejecuta. */
const azar = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* --------------------------------------------------------------- flor --- */

const PETALO = {
  base:  [206, 126, 20],      // arranque, a la sombra del disco
  medio: [244, 178, 34],
  punta: [255, 226, 122]
};
const DISCO = {
  fondo:   [86, 56, 16],
  semilla: [52, 34, 11],
  claro:   [138, 92, 26],
  flósculo:[243, 196, 72]     // los que ya se han abierto, en el borde
};
const TALLO = { oscuro: [58, 104, 32], claro: [110, 168, 60] };
const HOJA  = { base: [54, 104, 30], punta: [116, 176, 62], vena: [150, 200, 92] };

/**
 * Una corona de pétalos. Devuelve, para un punto, en qué pétalo cae y dónde:
 * `t` de la base a la punta, `borde` del nervio al filo, `k` el número de pétalo.
 *
 * El perfil (el ancho según se sube) es un seno: estrecho al nacer, ancho a
 * media altura y en punta al final. Es lo que hace que parezcan pétalos y no
 * porciones de tarta.
 */
function corona(dx, dy, { n, fase, r0, r1, ancho }) {
  const r = Math.hypot(dx, dy);
  if (r < r0 || r > r1) return null;
  const sector = 2 * Math.PI / n;
  const th = Math.atan2(dy, dx);
  const k = Math.round((th - fase) / sector);
  const a = th - fase - k * sector;
  // cada pétalo, un poco distinto: ni la naturaleza los hace iguales
  const largo = 0.86 + 0.14 * azar(k * 7.3 + n);
  const t = (r - r0) / ((r1 - r0) * largo);
  if (t > 1) return null;
  const medio = (sector / 2) * ancho * Math.pow(Math.sin(Math.PI * (0.06 + t * 0.94)), 0.7);
  if (Math.abs(a) > medio) return null;
  return { t, borde: Math.abs(a) / medio, k };
}

/** Color de un punto del pétalo: gradiente a la punta y filo en sombra. */
function tintaPetalo(p, atenua = 1) {
  const base = p.t < 0.45
    ? mezcla(PETALO.base, PETALO.medio, p.t / 0.45)
    : mezcla(PETALO.medio, PETALO.punta, (p.t - 0.45) / 0.55);
  // el nervio central, un pelín más claro; el filo, en sombra: eso es lo que
  // separa un pétalo del de al lado cuando todo esto sea un carácter de ancho
  const k = 1 - 0.34 * Math.pow(p.borde, 1.7) + 0.05 * (1 - p.borde);
  return sombra(base, k * atenua);
}

/**
 * La cabeza de la flor: dos coronas de pétalos (la de detrás más apagada, que
 * es lo que da el volumen) y el disco de semillas en espiral de Fibonacci.
 */
function cabeza(l, cx, cy, radio, { n = 21, disco = 0.38 } = {}) {
  const rDisco = radio * disco;
  const x0 = cx - radio, x1 = cx + radio, y0 = cy - radio, y1 = cy + radio;

  // corona de detrás: pétalos más cortos, girados medio sector y a la sombra
  l.zona(x0, y0, x1, y1, (x, y) => {
    const p = corona(x - cx, y - cy, {
      n: n - 4, fase: Math.PI / (n - 4), r0: rDisco * 0.86, r1: radio * 0.9, ancho: 0.94
    });
    return p ? tintaPetalo(p, 0.78) : null;
  });

  // corona de delante
  l.zona(x0, y0, x1, y1, (x, y) => {
    const p = corona(x - cx, y - cy, {
      n, fase: 0, r0: rDisco * 0.82, r1: radio, ancho: 0.9
    });
    return p ? tintaPetalo(p) : null;
  });

  // disco: fondo con viñeta (más oscuro al centro, como en la flor de verdad)
  l.zona(cx - rDisco, cy - rDisco, cx + rDisco, cy + rDisco, (x, y) => {
    const d = Math.hypot(x - cx, y - cy) / rDisco;
    if (d > 1) return null;
    if (d > 0.88) {
      // el anillo de flósculos abiertos, con su festón
      const th = Math.atan2(y - cy, x - cx);
      const festón = 0.5 + 0.5 * Math.sin(th * n * 1.6);
      return mezcla(DISCO.flósculo, DISCO.claro, 0.35 * festón);
    }
    return mezcla(DISCO.semilla, DISCO.fondo, Math.pow(d, 0.7));
  });

  // semillas: espiral de Fibonacci (ángulo áureo), que es como se colocan
  const dorado = Math.PI * (3 - Math.sqrt(5));
  const semillas = Math.round(260 * (rDisco / 70) ** 2);
  for (let i = semillas; i > 0; i--) {
    const rr = rDisco * 0.86 * Math.sqrt(i / semillas);
    const th = i * dorado;
    const sx = cx + rr * Math.cos(th), sy = cy + rr * Math.sin(th);
    const rad = rDisco * (0.052 + 0.03 * (rr / rDisco));
    const tono = mezcla(DISCO.semilla, DISCO.claro, 0.25 + 0.75 * (rr / rDisco) * azar(i));
    l.zona(sx - rad, sy - rad, sx + rad, sy + rad, (x, y) => {
      const d = Math.hypot(x - sx, y - sy) / rad;
      if (d > 1) return null;
      return sombra(tono, 1 - 0.3 * d * d);           // cada semilla, abombada
    });
  }
}

/** Traza un tallo por una curva de Bézier, con el grosor que se le diga. */
function tallo(l, p0, p1, p2, { grosor = 13, hasta = 1 } = {}) {
  const pasos = 260;
  for (let i = 0; i <= pasos * hasta; i++) {
    const t = i / pasos;
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    const g = grosor * (0.72 + 0.28 * t);             // engorda hacia abajo
    l.zona(x - g, y - g, x + g, y + g, (px, py) => {
      const d = (px - x) / g;
      if (Math.abs(d) > 1 || Math.hypot(px - x, py - y) > g) return null;
      // luz por la izquierda: sin esto el tallo es una barra plana
      return mezcla(TALLO.claro, TALLO.oscuro, Math.min(1, Math.abs(d + 0.35)));
    });
  }
}

/** Un trazo por una polilínea: el tallo que recorre la guirnalda de punta a punta. */
function traza(l, puntos, grosor) {
  puntos.forEach(([x, y], i) => {
    const g = grosor(i / (puntos.length - 1));
    l.zona(x - g, y - g, x + g, y + g, (px, py) => {
      if (Math.hypot(px - x, py - y) > g) return null;
      return mezcla(TALLO.claro, TALLO.oscuro, Math.min(1, Math.abs((px - x) / g + 0.35)));
    });
  });
}

/** Una hoja lanceolada, con su nervio y sus venas. */
function hoja(l, x, y, largo, ancho, giro) {
  const cos = Math.cos(giro), sin = Math.sin(giro);
  const r = largo + ancho;
  l.zona(x - r, y - r, x + r, y + r, (px, py) => {
    const dx = px - x, dy = py - y;
    const u = (dx * cos + dy * sin) / largo;          // 0 en el tallo, 1 en la punta
    const v = (-dx * sin + dy * cos);                 // a un lado y otro del nervio
    if (u < 0 || u > 1) return null;
    const medio = ancho * Math.pow(Math.sin(Math.PI * u), 0.65);
    if (Math.abs(v) > medio) return null;
    const b = Math.abs(v) / medio;
    let c = mezcla(HOJA.base, HOJA.punta, 0.25 + 0.75 * u);
    if (Math.abs(v) < 1.6) c = HOJA.vena;             // nervio central
    else if (Math.abs((u * 9) % 1 - 0.5) < 0.06 && b < 0.85) c = mezcla(c, HOJA.vena, 0.5);
    return sombra(c, 1 - 0.22 * b * b);
  });
}

/* ------------------------------------------------------------- cuadros -- */

/**
 * La protagonista: un girasol de frente, con el tallo y dos hojas.
 *
 * Va sola y bien grande porque es la que manda en la escena: en una consola
 * ancha se dibuja a 120 columnas, y a ese tamaño el disco de semillas se ve
 * semilla a semilla.
 */
function dibujaGirasol() {
  const l = new Lienzo(510, 580);
  tallo(l, [262, 400], [272, 500], [252, 590], { grosor: 13 });
  hoja(l, 268, 496, 132, 40, -0.24 + Math.PI);        // hoja izquierda
  hoja(l, 266, 538, 112, 34, -0.34);                  // hoja derecha
  cabeza(l, 255, 246, 238, { n: 22, disco: 0.4 });
  return l;
}

/**
 * La guirnalda: una rama de flores amarillas que se tumba debajo del retrato.
 *
 * Va apaisada a propósito (1200x210, casi seis a uno). En una consola el
 * retrato manda por ancho, y lo que le queda libre es lo de abajo: una franja
 * de ocho o diez filas donde una rama cabe entera y una maceta no.
 *
 * Las flores van de más grande en el centro a más pequeña en las puntas, y el
 * tallo hace una onda muy suave: en ASCII una línea recta se lee como un
 * subrayado, y la onda es lo que la convierte en rama.
 */
function dibujaGuirnalda() {
  const l = new Lienzo(1200, 210);
  const onda = (x) => 112 + 24 * Math.sin((x - 40) / 1120 * Math.PI * 2);

  const puntos = [];
  for (let x = 46; x <= 1154; x += 3) puntos.push([x, onda(x)]);
  traza(l, puntos, (t) => 6.5 + 2.5 * Math.sin(Math.PI * t));

  // hojas alternando arriba y abajo, para que la rama tenga fondo
  const hojas = [[95, -1], [200, 1], [285, -1], [390, 1], [520, -1], [660, 1],
                 [790, -1], [890, 1], [1000, -1], [1105, 1]];
  hojas.forEach(([x, lado], i) => {
    const largo = 62 + 22 * azar(i * 3.1);
    hoja(l, x, onda(x), largo, largo * 0.32,
         lado * (0.75 + 0.35 * azar(i * 5.7)) + (i % 2 ? Math.PI : 0));
  });

  // y las flores encima, la mayor en el centro
  const flores = [[135, 46], [300, 58], [465, 74], [620, 92], [790, 74], [950, 58], [1085, 46]];
  for (const [x, r] of flores) {
    cabeza(l, x, onda(x), r, { n: r > 70 ? 15 : 12, disco: 0.34 });
  }
  return l;
}

for (const [nombre, dibujo] of [['girasol.png', dibujaGirasol()],
                                ['guirnalda.png', dibujaGuirnalda()]]) {
  const r = recortaAlContenido(dibujo.reduce(), dibujo.w, dibujo.h);
  escribePNG(join(RAIZ, nombre), r.w, r.h, r.px);
  console.error(`→ ${nombre}  (${r.w}x${r.h}, proporción ${(r.h / r.w).toFixed(2)})`);
}
