#!/usr/bin/env node
/**
 * regalo-flores — el regalo, en la consola.
 *
 *   npx regalo-flores            # o: node bin/regalo.js
 *   node bin/regalo.js --ayuda
 */
import { crearSalida } from '../src/salida.js';
import { detectaNivel, ESC } from '../src/color.js';
import { regalo, MENSAJE } from '../src/regalo.js';
import { sinGlifo } from '../src/fuente.js';

const AYUDA = `
  regalo-flores — Pinto entre flores amarillas, en cualquier terminal.

  Uso:  regalo-flores [opciones]

    --ancho N        columnas a usar          (las de la terminal)
    --filas N        filas de la terminal     (las de la terminal)
    --mensaje TEXTO  renglón del rótulo; repetible para varios
    --sin-flores     sólo el retrato
    --sin-color      texto pelado, sin ANSI
    --rapido         a doble velocidad
    --lento          con calma
    --velocidad N    multiplicador (1 = normal, 0.5 = el doble de rápido)
    --estatico       lo imprime de una vez, sin animación
    --bucle MODO     auto | rotulo | cinta | no
    --ayuda          esto

  Ctrl-C para salir.
`;

/* ------------------------------------------------------------ opciones -- */

const argv = process.argv.slice(2);
const BOOLEANAS = new Set(['sin-flores', 'sin-color', 'rapido',
                           'lento', 'estatico', 'ayuda', 'help', 'version']);

const banderas = new Map();
const mensajes = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const nombre = a.slice(2);
  if (BOOLEANAS.has(nombre)) banderas.set(nombre, true);
  else if (nombre === 'mensaje') mensajes.push(argv[++i] ?? '');
  else banderas.set(nombre, argv[++i]);
}

if (banderas.has('ayuda') || banderas.has('help')) {
  console.log(AYUDA);
  process.exit(0);
}

const num = (n, def) => (banderas.has(n) ? Number(banderas.get(n)) : def);
const esTTY = Boolean(process.stdout.isTTY);

// por debajo de 33 columnas ni el retrato más pequeño (32) cabe
const ancho = Math.max(33, num('ancho', num('cols', process.stdout.columns || 80)));
const filas = num('filas', process.stdout.rows || null);
const velocidad = banderas.has('velocidad') ? num('velocidad', 1)
  : banderas.has('rapido') ? 0.5
  : banderas.has('lento') ? 1.7 : 1;

// sin terminal delante (una tubería, un fichero) la animación sólo ensucia:
// los "\r" quedarían escritos en el fichero
const modo = banderas.has('estatico') || !esTTY ? 'estatico' : 'animado';

// la fuente de bloques no lo pinta todo; mejor avisar que dejarlos caer callando
if (mensajes.length) {
  const fuera = sinGlifo(mensajes.join(' '));
  if (fuera.length) {
    console.error(`aviso: sin glifo para ${fuera.map((c) => `"${c}"`).join(' ')}` +
                  ' — esos caracteres no salen en el rótulo (añádelos a FUENTE en src/fuente.js)');
  }
}

const salida = crearSalida(process.stdout, {
  ancho,
  nivel: banderas.has('sin-color') ? 'ninguno' : detectaNivel(process.env, esTTY),
  velocidad
});

/* ---------------------------------------------------------------- show -- */

let cerrando = false;
function restaura(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  salida.corta();
  if (esTTY) process.stdout.write(ESC.reset + ESC.muestraCursor + '\n');
  process.exit(codigo);
}

process.on('SIGINT', () => restaura(0));
process.on('SIGTERM', () => restaura(0));

if (esTTY && modo === 'animado') process.stdout.write(ESC.ocultaCursor);

try {
  await regalo(salida, {
    flores: !banderas.has('sin-flores'),
    mensaje: mensajes.filter((m) => m?.trim()).length ? mensajes : MENSAJE,
    modo,
    bucle: modo === 'estatico' ? 'no' : (banderas.get('bucle') ?? 'auto'),
    filas
  });
} finally {
  if (esTTY) process.stdout.write(ESC.reset + ESC.muestraCursor);
}
