/**
 * foto — convierte una imagen en arte ASCII en color de 24 bits.
 *
 * Portado de `scripts/foto-a-ascii.mjs` del regalo web (mismo algoritmo y mismo
 * formato de salida) pero como módulo, para que `generar-arte.mjs` pueda pedir
 * varios anchos de una tacada.
 *
 * Sin dependencias: decodifica el PNG a mano con el zlib de Node.
 * Si le pasas un JPEG y estás en macOS, lo convierte antes con `sips`.
 *
 * El realce de bordes (edge) está portado de ascii-view, de Xander Gouws
 * (MIT, https://github.com/gouwsxander/ascii-view): detecta bordes con Sobel y
 * sustituye el carácter por la línea que sigue su dirección. Apagado por
 * defecto, igual que en el original.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ---------------------------------------------------------------- PNG ---- */

const CANALES = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Decodifica un PNG de 8 bits (gris, RGB, paleta, o con alfa) a {w,h,lum,rgb}. */
function leerPNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('No es un PNG.');

  let p = 8, w = 0, h = 0, prof = 0, tipo = 0, entrelazado = 0;
  const idat = [];
  let paleta = null;

  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const tag = buf.toString('ascii', p + 4, p + 8);
    const datos = buf.subarray(p + 8, p + 8 + len);

    if (tag === 'IHDR') {
      w = datos.readUInt32BE(0);
      h = datos.readUInt32BE(4);
      prof = datos[8];
      tipo = datos[9];
      entrelazado = datos[12];
    } else if (tag === 'PLTE') {
      paleta = datos;
    } else if (tag === 'IDAT') {
      idat.push(datos);
    } else if (tag === 'IEND') break;

    p += 12 + len;                                    // len + tag + datos + CRC
  }

  if (prof !== 8) throw new Error(`Profundidad ${prof} bits no soportada (usa 8).`);
  if (entrelazado) throw new Error('PNG entrelazado (Adam7) no soportado.');

  const canales = CANALES[tipo];
  if (!canales) throw new Error(`Tipo de color ${tipo} no soportado.`);

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = canales;                                // bytes por píxel (8 bits)
  const stride = w * bpp;
  const pix = Buffer.alloc(h * stride);

  // deshacer los filtros por scanline (spec PNG §9)
  for (let y = 0; y < h; y++) {
    const filtro = raw[y * (stride + 1)];
    const linea = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const dst = y * stride;
    const arriba = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? pix[dst + x - bpp] : 0;    // izquierda
      const b = y > 0 ? pix[arriba + x] : 0;          // arriba
      const c = (x >= bpp && y > 0) ? pix[arriba + x - bpp] : 0;  // diagonal
      let v = linea[x];

      switch (filtro) {
        case 0: break;                                // None
        case 1: v += a; break;                        // Sub
        case 2: v += b; break;                        // Up
        case 3: v += (a + b) >> 1; break;             // Average
        case 4: {                                     // Paeth
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`Filtro PNG desconocido: ${filtro}`);
      }
      pix[dst + x] = v & 0xff;
    }
  }

  // RGB y luminancia por píxel
  const n = w * h;
  const rgb = new Uint8Array(n * 3);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let r, g, b;
    const o = i * bpp;
    if (tipo === 3) {
      const k = pix[o] * 3;
      r = paleta[k]; g = paleta[k + 1]; b = paleta[k + 2];
    } else if (tipo === 0 || tipo === 4) {
      r = g = b = pix[o];
    } else {
      r = pix[o]; g = pix[o + 1]; b = pix[o + 2];
    }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  return { w, h, lum, rgb };
}

/** Si no es PNG y hay `sips` (macOS), lo convierte a PNG temporal. */
export function cargarImagen(ruta) {
  const buf = readFileSync(ruta);
  if (buf.readUInt32BE(0) === 0x89504e47) return leerPNG(buf);

  const tmp = join(tmpdir(), `foto-ascii-${Date.now()}.png`);
  try {
    execFileSync('sips', ['-s', 'format', 'png', ruta, '--out', tmp], { stdio: 'ignore' });
  } catch {
    throw new Error('Solo leo PNG. Convierte la imagen a PNG y vuelve a intentarlo.');
  }
  return leerPNG(readFileSync(tmp));
}

/* -------------------------------------------------------------- Opciones -- */

/**
 * `aspect` es la relación ancho/alto de la celda del terminal, y aquí es 0.5,
 * no el 0.6 del regalo web: allí el CSS es `line-height: 1` sobre JetBrains
 * Mono (celda 0.6 de ancho por 1 de alto), mientras que casi cualquier terminal
 * separa las líneas un ~20% más. Con 0.6 la cara sale estirada a lo alto.
 */
export const POR_DEFECTO = {
  cols: 96,
  invert: false,        // en color la polaridad normal es la buena
  gamma: 1,
  pg: 1,
  vig: 1,
  aspect: 0.5,
  loP: 1,
  hiP: 99,
  ramp: ' .:-=+*#%@',
  crop: [0.02, 0, 0.98, 0.88],
  // color
  piso: 0.05,           // suelo de brillo: sube los oscuros
  expo: 0.75,           // curva del brillo
  sat: 1.35,            // saturación
  paso: 14,             // cuantización de color (agrupa tramos)
  minden: 0.78,         // densidad mínima: con color, el hueco resta
  edge: 0,              // umbral de bordes Sobel (0 = apagado)
  edgemax: 1,
  edgemodo: 'char',
  edgeboost: 1.6,
  key: null,            // [lum, croma]: recorta el fondo claro y neutro
  keymin: 0.35
};

/* -------------------------------------------------------------- ASCII ---- */

/** Devuelve {texto, color, cols, filas}: `color` son las filas en el formato del regalo. */
export function aAscii(img, opciones = {}) {
  const o = { ...POR_DEFECTO, ...opciones };
  const { w, h, lum, rgb } = img;
  const [fx0, fy0, fx1, fy1] = o.crop;
  const x0 = Math.floor(fx0 * w), y0 = Math.floor(fy0 * h);
  const x1 = Math.ceil(fx1 * w),  y1 = Math.ceil(fy1 * h);
  const cw = x1 - x0, ch = y1 - y0;

  const cols = o.cols;
  const rows = Math.max(1, Math.round(ch * (cols / cw) * o.aspect));

  // muestreo por bloques: la media del área hace de antialias
  const celda = [];      // luminancia media
  const color = [];      // color medio
  const cobertura = [];  // fracción de la celda que no es fondo
  for (let r = 0; r < rows; r++) {
    const ya = y0 + Math.floor(r * ch / rows);
    const yb = Math.max(y0 + Math.floor((r + 1) * ch / rows), ya + 1);
    const fila = [], filaC = [], filaCob = [];
    for (let c = 0; c < cols; c++) {
      const xa = x0 + Math.floor(c * cw / cols);
      const xb = Math.max(x0 + Math.floor((c + 1) * cw / cols), xa + 1);
      let s = 0, sr = 0, sg = 0, sb = 0, n = 0, dentro = 0;
      for (let y = ya; y < Math.min(yb, h); y++) {
        for (let x = xa; x < Math.min(xb, w); x++) {
          const i = y * w + x;
          n++;
          if (o.key) {
            // fondo = claro y neutro. El croma es lo que separa el blanco del
            // papel de un crema o un beige, que tienen la misma luminancia.
            const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
            const croma = Math.max(r, g, b) - Math.min(r, g, b);
            if (lum[i] >= o.key[0] && croma <= o.key[1]) continue;
          }
          s += lum[i];
          sr += rgb[i * 3]; sg += rgb[i * 3 + 1]; sb += rgb[i * 3 + 2];
          dentro++;
        }
      }
      fila.push(dentro ? s / dentro : 0);
      filaC.push(dentro ? [sr / dentro, sg / dentro, sb / dentro] : [0, 0, 0]);
      filaCob.push(n ? dentro / n : 0);
    }
    celda.push(fila);
    color.push(filaC);
    cobertura.push(filaCob);
  }

  // Bordes por Sobel sobre la rejilla de celdas (idea de gouwsxander/ascii-view).
  const bordes = o.edge > 0 ? sobel(celda, rows, cols) : null;

  // normalización por percentiles: usa todo el rango de la rampa
  const plano = celda.flat().sort((a, b) => a - b);
  const lo = plano[Math.floor(plano.length * o.loP / 100)];
  const hi = plano[Math.min(plano.length - 1, Math.floor(plano.length * o.hiP / 100))];
  const rango = Math.max(1e-6, hi - lo);

  const ramp = o.ramp;
  const texto = [];        // versión monocroma
  const tramos = [];       // versión en color, ya comprimida

  for (let r = 0; r < rows; r++) {
    let linea = '';
    const celdas = [];
    for (let c = 0; c < cols; c++) {
      // viñeta elíptica: apaga el fondo claro de alrededor
      let f = 1;
      if (o.vig > 0) {
        const nx = (c / (cols - 1) - 0.5) * 2;
        const ny = (r / (rows - 1) - 0.5) * 2;
        const d = Math.hypot(nx, ny) / 1.15;
        f = Math.max(0, 1 - o.vig * Math.max(0, Math.min(1, (d - 0.45) / 0.55)) ** 1.4);
      }

      // --- recorte: fuera del dibujo no se pinta nada ---
      const cob = cobertura[r][c];
      if (o.key && cob < o.keymin) { linea += ' '; celdas.push([0, 0, 0, ' ']); continue; }

      // --- densidad: qué carácter toca ---
      let t = Math.min(1, Math.max(0, (celda[r][c] - lo) / rango)) ** o.gamma;
      if (o.invert) t = 1 - t;
      t **= o.pg;
      // suelo de densidad: con color interesa que toda celda tenga carácter,
      // porque el color ya lleva la imagen y el hueco sólo resta.
      t = (o.minden + (1 - o.minden) * t) * f;
      if (o.key) t *= Math.min(1, cob / 0.85);      // bordes del recorte, suaves
      let ch = ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];

      // si la celda cae en un borde, manda la línea direccional
      let esBorde = false;
      if (bordes && bordes.mag[r * cols + c] >= o.edge && f > 0.15) {
        esBorde = true;
        if (o.edgemodo !== 'color' && t <= o.edgemax) {
          ch = charDeAngulo(bordes.ang[r * cols + c]);
        }
      }
      linea += ch;

      // --- color: el de la foto, pero visible sobre negro ---
      let [R, G, B] = color[r][c];
      const Lc = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      R = Lc + (R - Lc) * o.sat;                       // saturación
      G = Lc + (G - Lc) * o.sat;
      B = Lc + (B - Lc) * o.sat;
      // el pelo casi negro se perdería contra el fondo de la terminal:
      // se le sube el suelo de brillo conservando el tono.
      const objetivo = 255 * (o.piso + (1 - o.piso) * (Lc / 255) ** o.expo) * f;
      const k = Lc > 1 ? objetivo / Lc : 0;
      const kb = (esBorde && o.edgemodo === 'color') ? o.edgeboost : 1;
      const c2 = (v) => Math.max(0, Math.min(255, Math.round(v * k * kb)));
      celdas.push([c2(R), c2(G), c2(B), ch]);
    }
    texto.push(linea.replace(/\s+$/, ''));
    tramos.push(comprime(celdas, o.paso).map(([c, t]) => c + t).join('|'));
  }

  // recorta filas vacías arriba y abajo, en las dos versiones a la vez
  let ini = 0, fin = texto.length;
  while (ini < fin && !texto[ini].trim()) ini++;
  while (fin > ini && !texto[fin - 1].trim()) fin--;

  return {
    texto: texto.slice(ini, fin),
    color: tramos.slice(ini, fin),
    cols,
    filas: fin - ini
  };
}

/** Sobel 3x3 sobre la rejilla de celdas ya reducida (0..255 -> 0..1). */
function sobel(celda, rows, cols) {
  const mag = new Float32Array(rows * cols);
  const ang = new Float32Array(rows * cols);
  const at = (y, x) => celda[Math.min(rows - 1, Math.max(0, y))]
                            [Math.min(cols - 1, Math.max(0, x))] / 255;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const sx = -at(y - 1, x - 1) + at(y - 1, x + 1)
                 - 2 * at(y, x - 1)     + 2 * at(y, x + 1)
                 - at(y + 1, x - 1) + at(y + 1, x + 1);
      const sy = -at(y - 1, x - 1) - 2 * at(y - 1, x) - at(y - 1, x + 1)
                 + at(y + 1, x - 1) + 2 * at(y + 1, x) + at(y + 1, x + 1);
      const i = y * cols + x;
      mag[i] = Math.hypot(sx, sy);
      ang[i] = Math.atan2(sy, sx) * 180 / Math.PI;
    }
  }
  return { mag, ang };
}

/**
 * El gradiente es perpendicular al borde: un gradiente vertical (90°) significa
 * un borde horizontal, y por eso le toca "_".
 */
function charDeAngulo(a) {
  if ((a >= 22.5 && a <= 67.5) || (a >= -157.5 && a <= -112.5)) return '\\';
  if ((a >= 67.5 && a <= 112.5) || (a >= -112.5 && a <= -67.5)) return '_';
  if ((a >= 112.5 && a <= 157.5) || (a >= -67.5 && a <= -22.5)) return '/';
  return '|';
}

/**
 * Agrupa una fila en tramos [colorHex, texto]. Los caracteres contiguos con el
 * mismo color van juntos: si no, sale un escape ANSI por carácter.
 */
function comprime(celdas, paso) {
  const q = (v) => Math.min(255, Math.round(v / paso) * paso);
  const hex = (v) => q(v).toString(16).padStart(2, '0');
  const out = [];
  for (const [r, g, b, ch] of celdas) {
    const col = ch === ' ' ? '000000' : hex(r) + hex(g) + hex(b);
    const ult = out[out.length - 1];
    if (ult && ult[0] === col) ult[1] += ch;
    else out.push([col, ch]);
  }
  if (out.length && !out[out.length - 1][1].trim()) out.pop();
  return out;                       // [[colorHex, texto], ...]
}
