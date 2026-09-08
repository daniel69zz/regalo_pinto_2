/**
 * Color ANSI.
 *
 * El arte guarda el color real de la foto en hex; aquí se traduce a lo que
 * entienda la terminal que hay delante: 24 bits si puede, 256 si no, 16 en el
 * peor caso, y nada si el usuario no quiere color.
 */

export const ESC = {
  reset: '\x1b[0m',
  ocultaCursor: '\x1b[?25l',
  muestraCursor: '\x1b[?25h',
  limpiaLinea: '\x1b[K',
  limpiaAbajo: '\x1b[J',
  arriba: (n) => (n > 0 ? `\x1b[${n}F` : ''),   // n líneas arriba, a la columna 1
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

/**
 * Qué color admite la terminal.
 * Respeta NO_COLOR (no-color.org) y FORCE_COLOR, como cualquier herramienta CLI.
 */
export function detectaNivel(env = process.env, esTTY = process.stdout.isTTY) {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 'ninguno';
  if (env.FORCE_COLOR === '0') return 'ninguno';
  if (env.FORCE_COLOR === '1') return '16';
  if (env.FORCE_COLOR === '2') return '256';
  if (env.FORCE_COLOR === '3' || env.FORCE_COLOR === 'true') return 'verdadero';
  if (env.TERM === 'dumb') return 'ninguno';
  const ct = (env.COLORTERM || '').toLowerCase();
  if (ct.includes('truecolor') || ct.includes('24bit')) return 'verdadero';
  // iTerm, Apple Terminal moderno, VS Code, Kitty, WezTerm... todos con 24 bits
  if (/^(iterm|apple_terminal|vscode|hyper|kitty|wezterm|ghostty|warpterminal)/i
      .test(env.TERM_PROGRAM || '')) return 'verdadero';
  if (/256(color)?/.test(env.TERM || '')) return '256';
  if (!esTTY && !env.TERM) return 'verdadero';   // tubería o socket: se asume moderno
  return env.TERM ? '16' : 'verdadero';
}

/** "aabbcc" -> [170, 187, 204] */
export function aRGB(hex) {
  return [parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)];
}

const lim = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * Sube el brillo sin desaturar: en la web esto lo hacía un `filter:brightness()`
 * de CSS que compensaba las scanlines. Aquí compensa el fondo de la terminal,
 * que se come los tonos medios de la foto.
 */
export function realza([r, g, b], brillo) {
  if (brillo === 1) return [r, g, b];
  return [lim(r * brillo), lim(g * brillo), lim(b * brillo)];
}

/** RGB -> índice de la paleta de 256 (cubo 6x6x6 + rampa de grises). */
function a256([r, g, b]) {
  if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return 232 + Math.round((r - 8) / 247 * 24);
  }
  const q = (v) => Math.round(v / 255 * 5);
  return 16 + 36 * q(r) + 6 * q(g) + q(b);
}

// los 16 básicos, con los valores que usa casi toda terminal
const BASICOS = [
  [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
  [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
  [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
  [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255]
];

function a16([r, g, b]) {
  let mejor = 0, dist = Infinity;
  for (let i = 0; i < 16; i++) {
    const [R, G, B] = BASICOS[i];
    // ponderada por sensibilidad del ojo: si no, los rosas caen en gris
    const d = 2 * (r - R) ** 2 + 4 * (g - G) ** 2 + 3 * (b - B) ** 2;
    if (d < dist) { dist = d; mejor = i; }
  }
  return mejor < 8 ? 30 + mejor : 90 + (mejor - 8);
}

/** Escape de color de primer plano para un RGB, según el nivel de la terminal. */
export function fg(rgb, nivel) {
  switch (nivel) {
    case 'verdadero': return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    case '256':       return `\x1b[38;5;${a256(rgb)}m`;
    case '16':        return `\x1b[${a16(rgb)}m`;
    default:          return '';
  }
}

/** Mezcla dos colores. `t` de 0 (a) a 1 (b). */
export function mezcla(a, b, t) {
  return [lim(a[0] + (b[0] - a[0]) * t),
          lim(a[1] + (b[1] - a[1]) * t),
          lim(a[2] + (b[2] - a[2]) * t)];
}

/** HSL -> RGB, para el arcoíris del rótulo. h en vueltas (0..1). */
export function hsl(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return lim((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [f(0), f(8), f(4)];
}
