/**
 * El regalo entero, de principio a fin.
 *
 * No sabe si escribe en una terminal o en un socket: recibe una `salida` y
 * escribe. Eso es lo que permite que `bin/regalo.js` y `server.js` cuenten
 * exactamente lo mismo.
 */
import { componer, MENSAJE, ALTO_A_CIEGAS } from './layout.js';
import { pinta } from './lienzo.js';
import {
  PALETA, tinta, revelaArte, revelaRotulo,
  arcoiris, bucleRotulo, bucleCinta
} from './escena.js';

export { MENSAJE };

/** Lo único que se escribe además del arte y el rótulo: la firma del mensaje. */
const CIERRE = ['con retraso, pero con todo el cariño'];
/** La misma firma para consolas estrechas: si se parte en dos, el bucle final
 *  sube menos líneas de las que ha escrito y el rótulo se descuadra. */
const CIERRE_CORTO = ['con todo el cariño'];

/**
 * @param {object} s        salida (src/salida.js)
 * @param {object} opciones
 *   flores   las flores amarillas (girasol y guirnalda)  (true)
 *   mensaje  renglones del rótulo
 *   modo     'animado' | 'estatico'
 *   bucle    'auto' | 'rotulo' | 'cinta' | 'no'
 *   filas    alto de la consola, si se sabe (decide el bucle en 'auto')
 */
export async function regalo(s, opciones = {}) {
  const {
    flores = true,
    mensaje = MENSAJE,
    modo = 'animado',
    bucle = 'auto',
    filas = null
  } = opciones;

  const escena = componer(s.ancho, { flores, mensaje, mono: s.nivel === 'ninguno', filas });
  const { arte, rotulo, desfase } = escena;

  if (modo === 'estatico') {
    estatico(s, escena);
    return escena;
  }

  s.linea();                       // un respiro entre el prompt y el retrato
  await revelaArte(s, arte);
  await revelaRotulo(s, rotulo, { desfase });

  const cual = bucle === 'auto' ? eligeBucle(filas, rotulo) : bucle;
  if (cual === 'rotulo') {
    // aquí el cierre lo escribe el propio bucle: cada vuelta sube hasta el
    // rótulo y lo repinta todo, y si ya estuviera escrito lo machacaría
    await bucleRotulo(s, rotulo, { cola: despedida(s), desfase });
    return escena;
  }

  cierra(s, escena);
  if (cual === 'cinta') {
    await bucleCinta(s, { texto: `¡FELIZ CUMPLEAÑOS!  ·  ${CIERRE[0]}` });
  }
  return escena;
}

/**
 * El bucle final sube el cursor y repinta el rótulo, así que sólo vale si el
 * rótulo cabe entero en pantalla. Con `filas` se sabe de sobra; por curl no hay
 * manera, y ahí se da por hecha la consola más pequeña que se estila —para eso
 * `layout.js` deja el rótulo a la altura de caber en ella—. Si aun así no cabe
 * (un `--mensaje` kilométrico), la cinta de una línea, que es segura siempre.
 */
function eligeBucle(filas, rotulo) {
  return (filas ?? ALTO_A_CIEGAS) > rotulo.length + 4 ? 'rotulo' : 'cinta';
}

/** Las líneas de despedida, centradas y ya pintadas. */
function despedida(s, textos = CIERRE) {
  if (textos === CIERRE && textos.some((t) => t.length > s.ancho)) textos = CIERRE_CORTO;
  return textos.map((t) =>
    ' '.repeat(Math.max(0, Math.floor((s.ancho - t.length) / 2))) + tinta(t, PALETA.gris, s.nivel));
}

function cierra(s, escena, textos = CIERRE) {
  for (const l of despedida(s, textos)) s.linea(l);
  s.linea();
}

/**
 * Sin animación: para cuando la salida no es una terminal (una tubería, un
 * fichero) o el usuario pide `--estatico`. Nada de "\r" ni de cursor, que en un
 * fichero se ven como basura.
 */
function estatico(s, escena) {
  s.linea();
  for (const linea of escena.arte) s.linea(linea.length ? pinta(linea, s.nivel, {}) : '');
  s.linea();
  if (escena.rotulo.length) {
    const ancho = Math.max(...escena.rotulo.map((l) => l.length));
    const margen = ' '.repeat(Math.max(0, Math.floor((s.ancho - ancho) / 2)));
    // el arcoíris queda congelado, con el desfase por renglón de la web
    escena.rotulo.forEach((l, i) => {
      s.linea(l.trim() ? margen + arcoiris(l, s.nivel, -i * escena.desfase) : '');
    });
    s.linea();
  }
  cierra(s, escena);
}
