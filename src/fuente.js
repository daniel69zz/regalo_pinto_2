/**
 * Fuente de bloques 4x6 para el rótulo final.
 *
 * Portada de `scripts/texto-a-ascii.mjs` del regalo web, pero aquí se compone
 * en caliente en vez de generarse a mano: la terminal puede ser de 200 columnas
 * o de 60, y el rótulo tiene que reajustarse solo.
 *
 * Está hecha a mano en vez de con figlet porque hacen falta la Ñ y la ¡, que
 * las fuentes figlet estándar no traen. La fila 0 de cada glifo está reservada
 * para el acento y va vacía en casi todos: es lo que permite poner la tilde
 * encima sin descuadrar el renglón.
 */

const B = '█';
const g = (...filas) => filas.map((f) => f.replace(/\./g, ' ').replace(/#/g, B));

export const ALTO = 6;

// 4 de ancho x 6 de alto; la primera fila es para el acento.
// Los signos estrechos (espacio, puntuación) van a 2, que si no bailan.
export const FUENTE = {
  'A': g('....', '.##.', '#..#', '####', '#..#', '#..#'),
  'B': g('....', '###.', '#..#', '###.', '#..#', '###.'),
  'C': g('....', '.###', '#...', '#...', '#...', '.###'),
  'D': g('....', '###.', '#..#', '#..#', '#..#', '###.'),
  'E': g('....', '####', '#...', '###.', '#...', '####'),
  'F': g('....', '####', '#...', '###.', '#...', '#...'),
  'G': g('....', '.###', '#...', '#.##', '#..#', '.###'),
  'H': g('....', '#..#', '#..#', '####', '#..#', '#..#'),
  'I': g('....', '####', '.##.', '.##.', '.##.', '####'),
  'J': g('....', '####', '..#.', '..#.', '#.#.', '.##.'),
  'K': g('....', '#..#', '#.#.', '##..', '#.#.', '#..#'),
  'L': g('....', '#...', '#...', '#...', '#...', '####'),
  'M': g('....', '#..#', '####', '####', '#..#', '#..#'),
  'N': g('....', '#..#', '##.#', '####', '#.##', '#..#'),
  'Ñ': g('.##.', '#..#', '##.#', '####', '#.##', '#..#'),
  'O': g('....', '.##.', '#..#', '#..#', '#..#', '.##.'),
  'P': g('....', '###.', '#..#', '###.', '#...', '#...'),
  'Q': g('....', '.##.', '#..#', '#..#', '#.#.', '.#.#'),
  'R': g('....', '###.', '#..#', '###.', '#.#.', '#..#'),
  'S': g('....', '.###', '#...', '.##.', '...#', '###.'),
  'T': g('....', '####', '.##.', '.##.', '.##.', '.##.'),
  'U': g('....', '#..#', '#..#', '#..#', '#..#', '.##.'),
  'V': g('....', '#..#', '#..#', '#..#', '.##.', '.##.'),
  'W': g('....', '#..#', '#..#', '####', '####', '#..#'),
  'X': g('....', '#..#', '.##.', '.##.', '.##.', '#..#'),
  'Y': g('....', '#..#', '#..#', '.##.', '.##.', '.##.'),
  'Z': g('....', '####', '...#', '.##.', '#...', '####'),
  'Á': g('.##.', '.##.', '#..#', '####', '#..#', '#..#'),
  'É': g('.##.', '####', '#...', '###.', '#...', '####'),
  'Í': g('.##.', '####', '.##.', '.##.', '.##.', '####'),
  'Ó': g('.##.', '.##.', '#..#', '#..#', '#..#', '.##.'),
  'Ú': g('.##.', '#..#', '#..#', '#..#', '#..#', '.##.'),
  '0': g('....', '.##.', '#.##', '##.#', '#..#', '.##.'),
  '1': g('....', '.##.', '###.', '.##.', '.##.', '####'),
  '2': g('....', '###.', '...#', '.##.', '#...', '####'),
  '3': g('....', '###.', '...#', '.##.', '...#', '###.'),
  '4': g('....', '#..#', '#..#', '####', '...#', '...#'),
  '5': g('....', '####', '#...', '###.', '...#', '###.'),
  '6': g('....', '.###', '#...', '###.', '#..#', '.##.'),
  '7': g('....', '####', '...#', '..#.', '.#..', '.#..'),
  '8': g('....', '.##.', '#..#', '.##.', '#..#', '.##.'),
  '9': g('....', '.##.', '#..#', '.###', '...#', '###.'),
  '¡': g('....', '.##.', '....', '.##.', '.##.', '.##.'),
  '!': g('....', '.##.', '.##.', '.##.', '....', '.##.'),
  '¿': g('....', '.##.', '....', '#..#', '#...', '.##.'),
  '?': g('....', '###.', '...#', '.##.', '....', '.##.'),
  '-': g('....', '....', '....', '####', '....', '....'),
  '.': g('..', '..', '..', '..', '..', '##'),
  ',': g('..', '..', '..', '..', '##', '#.'),
  ':': g('..', '..', '##', '..', '##', '..'),
  ' ': g('..', '..', '..', '..', '..', '..')          // el espacio va más estrecho
};

/** Normaliza a lo que la fuente sabe pintar: mayúsculas y sin caracteres raros. */
export function normaliza(texto) {
  return [...texto.toUpperCase()].filter((ch) => FUENTE[ch]).join('');
}

/** Caracteres del texto que la fuente no sabe pintar (y que se caen del rótulo). */
export function sinGlifo(texto) {
  return [...new Set([...texto.toUpperCase()])].filter((ch) => !FUENTE[ch]);
}

/** Cuántas columnas ocupa un texto ya compuesto. */
export function ancho(texto) {
  const chars = [...texto];
  if (!chars.length) return 0;
  return chars.reduce((n, ch) => n + (FUENTE[ch]?.[0].length ?? 0) + 1, 0) - 1;
}

/** Un renglón de texto -> 6 filas de bloques. */
export function rotulo(texto) {
  const filas = Array.from({ length: ALTO }, () => '');
  for (const ch of texto.toUpperCase()) {
    const glifo = FUENTE[ch];
    if (!glifo) throw new Error(`Sin glifo para "${ch}". Añádelo a FUENTE en src/fuente.js.`);
    for (let i = 0; i < ALTO; i++) filas[i] += glifo[i] + ' ';
  }
  return filas.map((f) => f.replace(/\s+$/, ''));
}

/**
 * Parte un renglón en los que hagan falta para no pasar de `max` columnas.
 * Si una palabra suelta ya no cabe, se devuelve igual: el que la eligió sabrá.
 */
function parte(texto, max) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const salida = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ancho(prueba) <= max || !actual) actual = prueba;
    else { salida.push(actual); actual = p; }
  }
  if (actual) salida.push(actual);
  return salida;
}

/**
 * Media altura: cada dos filas de bloques se funden en una sola con los medios
 * bloques ▀ ▄ █. Mismo ancho, la mitad de alto, para cuando el rótulo a tamaño
 * completo saldría más aparatoso que las propias imágenes.
 */
export function aMediaAltura(filas) {
  const w = Math.max(...filas.map((f) => f.length));
  const llenas = filas.map((f) => f.padEnd(w));
  const salida = [];
  for (let i = 0; i < llenas.length; i += 2) {
    let linea = '';
    for (let c = 0; c < w; c++) {
      const arriba = llenas[i][c] === B;
      const abajo = (llenas[i + 1] ?? '')[c] === B;
      linea += arriba && abajo ? B : arriba ? '▀' : abajo ? '▄' : ' ';
    }
    salida.push(linea.replace(/\s+$/, ''));
  }
  return salida;
}

/**
 * Compone varios renglones centrados entre sí, reajustados a `max` columnas.
 * Devuelve `null` si ni partiendo por palabras cabe: entonces el que llama
 * tira del rótulo de texto plano.
 *
 * Con `compacta`, los renglones salen a media altura (3 filas en vez de 6).
 */
export function render(lineas, max = Infinity, { compacta = false } = {}) {
  const renglones = lineas
    .map((l) => normaliza(l))
    .flatMap((l) => parte(l, max))
    .filter(Boolean);
  if (!renglones.length) return null;
  if (renglones.some((l) => ancho(l) > max)) return null;

  const bloques = renglones.map((r) => (compacta ? aMediaAltura(rotulo(r)) : rotulo(r)));
  const total = Math.max(...bloques.flat().map((f) => f.length));
  const salida = [];
  bloques.forEach((b, i) => {
    if (i) salida.push('');                            // aire entre renglones
    // cada renglón centrado respecto al más ancho
    const w = Math.max(...b.map((f) => f.length));
    const pad = ' '.repeat(Math.floor((total - w) / 2));
    for (const f of b) salida.push((pad + f).replace(/\s+$/, ''));
  });
  return salida;
}

/**
 * Plan B para consolas muy estrechas: por debajo de ~54 columnas ni
 * "CUMPLEAÑOS!" cabe en bloques (11 letras x 5 = 54), así que el rótulo pasa a
 * texto espaciado. Menos vistoso, pero legible, que es de lo que se trata.
 */
export function rotuloPlano(lineas, max) {
  const salida = [];
  if (!lineas.some((l) => l.trim())) return [];
  for (const linea of lineas) {
    const palabras = linea.toUpperCase().split(/\s+/).filter(Boolean);
    let actual = [];
    const suelta = () => {
      if (actual.length) salida.push(actual.join('  '));
      actual = [];
    };
    for (const p of palabras) {
      const espaciada = [...p].join(' ');
      const prueba = [...actual, espaciada].join('  ');
      if (prueba.length <= max || !actual.length) actual.push(espaciada);
      else { suelta(); actual = [espaciada]; }
    }
    suelta();
  }
  if (!salida.length) return [];
  const total = Math.max(...salida.map((l) => l.length));
  return salida.map((l) => ' '.repeat(Math.floor((total - l.length) / 2)) + l);
}
