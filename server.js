#!/usr/bin/env node
/**
 * El regalo por HTTP, como parrot.live:
 *
 *   curl regalo.donde-lo-subas.com
 *
 * Se sirve el mismo espectáculo que en local. La única diferencia es que por
 * curl no hay forma de saber el tamaño de la terminal del otro lado, así que se
 * asume una consola normalita y se admite que la digan:
 *
 *   curl "regalo...?cols=$(tput cols)&filas=$(tput lines)"
 *
 * Un navegador (o cualquier cosa que no sea curl/wget/httpie) recibe en su
 * lugar una página con el comando para copiar.
 */
import { createServer } from 'node:http';
import { crearSalida } from './src/salida.js';
import { regalo, MENSAJE } from './src/regalo.js';

const PUERTO = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

/** Ancho por defecto: prudente, que cabe de sobra en una consola de 80. */
const ANCHO_POR_DEFECTO = 96;

const CLIENTES_CONSOLA = /^(curl|wget|httpie|http|powershell|fetch|libcurl|xh|aria2)/i;

const entero = (v, def, min, max) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Lo que pide el cliente por query, ya saneado. */
function opcionesDe(url) {
  const q = url.searchParams;
  const mensajes = q.getAll('mensaje')
    .flatMap((m) => m.split('\n'))
    .map((m) => m.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 5);

  const ancho = entero(q.get('cols') ?? q.get('ancho'), ANCHO_POR_DEFECTO, 33, 300);
  const filas = q.has('filas') || q.has('rows')
    ? entero(q.get('filas') ?? q.get('rows'), null, 8, 200) : null;

  return {
    ancho,
    filas,
    velocidad: Number(q.get('velocidad')) > 0 ? Math.min(4, Number(q.get('velocidad'))) : 1,
    color: q.get('color') !== 'no',
    flores: q.get('flores') !== 'no' && !q.has('sin-flores'),
    modo: q.has('estatico') ? 'estatico' : 'animado',
    bucle: ['auto', 'rotulo', 'cinta', 'no'].includes(q.get('bucle')) ? q.get('bucle') : 'auto',
    mensaje: mensajes.length ? mensajes : MENSAJE
  };
}

const PAGINA = (host) => `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>regalo · consola</title>
<style>
  :root { color-scheme: dark }
  body { background:#05090b; color:#8dffc9; margin:0; min-height:100vh;
         display:grid; place-items:center; text-align:center;
         font:16px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; padding:24px }
  h1 { font-size:1.1rem; font-weight:400; color:#6f8a80; letter-spacing:.12em; text-transform:uppercase }
  code { display:block; background:#0b1417; border:1px solid #173a2c; border-radius:10px;
         padding:16px 20px; margin:18px auto; max-width:min(90vw,640px); overflow-x:auto;
         color:#46ff9c; text-align:left; white-space:pre }
  p { color:#6f8a80; max-width:52ch; margin-inline:auto }
  a { color:#5ce0ff }
</style>
<h1>sudo unlock-gift</h1>
<div>
  <p>Esto se ve en una terminal, no aquí.</p>
  <code>curl ${host}</code>
  <p>Y si quieres que se ajuste a tu ventana (y que el rótulo se quede
     dando vueltas hasta que cortes con Ctrl-C):</p>
  <code>curl "${host}?cols=$(tput cols)&amp;filas=$(tput lines)"</code>
  <p>Pinto entre flores amarillas, en ASCII de 24 bits, y el rótulo en arcoíris. Ctrl-C para salir.</p>
</div>
`;

/** Espectáculos en marcha, para poder cortarlos al apagar. */
const enMarcha = new Set();

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const agente = req.headers['user-agent'] || '';
  const consola = CLIENTES_CONSOLA.test(agente) || url.searchParams.has('consola');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Sólo GET.\n');
  }

  if (!consola) {
    const host = (req.headers.host || `localhost:${PUERTO}`).replace(/\/$/, '');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(req.method === 'HEAD' ? '' : PAGINA(host));
  }

  res.writeHead(200, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-cache, no-store',
    // que ningún proxy (nginx, Cloudflare) acumule la respuesta: si no, la
    // animación llega de golpe al final y deja de ser una animación
    'x-accel-buffering': 'no'
  });
  if (req.method === 'HEAD') return res.end();

  const o = opcionesDe(url);
  const salida = crearSalida(res, {
    ancho: o.ancho,
    nivel: o.color ? 'verdadero' : 'ninguno',
    velocidad: o.velocidad
  });
  req.on('close', () => salida.corta());
  enMarcha.add(salida);

  try {
    await regalo(salida, o);
  } catch (e) {
    if (salida.vivo) console.error('fallo sirviendo el regalo:', e.message);
  } finally {
    enMarcha.delete(salida);
  }
  res.end();
});

servidor.listen(PUERTO, HOST, () => {
  console.log(`\n  Regalo servido en http://localhost:${PUERTO}`);
  console.log(`  Pruébalo:  curl "localhost:${PUERTO}?cols=$(tput cols)&filas=$(tput lines)"\n`);
});

/**
 * Apagado limpio, que es lo que hace falta dentro de un contenedor.
 *
 * El bucle final no termina nunca por diseño: quien corta es el usuario con
 * Ctrl-C. Así que un `server.close()` a secas se quedaría esperando a que
 * terminen peticiones que no van a terminar, `docker stop` agotaría sus diez
 * segundos de cortesía y acabaría a SIGKILL. Por eso primero se cortan las
 * escenas en marcha y luego se cierra.
 */
let apagando = false;
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    if (apagando) process.exit(0);
    apagando = true;
    for (const salida of enMarcha) salida.corta();
    servidor.close(() => process.exit(0));
    // por si alguna conexión se resiste
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
