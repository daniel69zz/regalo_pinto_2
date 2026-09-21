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
  revelaArte, revelaRotulo, arcoiris, sangriaRotulo, bucleRotulo, bucleCinta
} from './escena.js';

export { MENSAJE };

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
  const { arte, rotulo, desfase, giro, flor } = escena;

  if (modo === 'estatico') {
    estatico(s, escena);
    return escena;
  }

  s.linea();                       // un respiro entre el prompt y el retrato
  await revelaArte(s, arte);
  await revelaRotulo(s, rotulo, { desfase });

  const cual = bucle === 'auto' ? eligeBucle(filas, rotulo) : bucle;
  if (cual === 'rotulo') {
    await bucleRotulo(s, rotulo, { desfase, ...queGira(filas, rotulo, giro, flor) });
    return escena;
  }

  if (cual === 'cinta') await bucleCinta(s, { texto: '¡FELIZ 21 DE SEPTIEMBRE!' });
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

/**
 * ¿Giran los girasoles o se quedan quietos?
 *
 * Para animarlos hay que subir el cursor por encima de ellos, así que tiene que
 * constar que siguen en pantalla: guirnalda + rótulo y sus dos líneas en
 * blanco, más la fila donde se queda el cursor, todo dentro de las filas de la
 * consola. El girasol grande está encima de la guirnalda, así que sólo gira si
 * gira ella y además cabe él. Lo que no cabe llega vacío y el bucle lo deja
 * quieto donde lo dejó el revelado.
 */
function queGira(filas, rotulo, giro, flor) {
  const alto = filas ?? ALTO_A_CIEGAS;
  const debajo = rotulo.length + 2;
  const altoGiro = giro?.[0]?.length ?? 0;
  if (!altoGiro || alto <= altoGiro + debajo) return { giro: [], flor: null };
  const altoFlor = flor?.marcos[0]?.length ?? 0;
  return { giro, flor: altoFlor && alto > altoFlor + altoGiro + debajo ? flor : null };
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
    const margen = sangriaRotulo(s, escena.rotulo);
    // el arcoíris queda congelado, con el desfase por renglón de la web
    escena.rotulo.forEach((l, i) => {
      s.linea(l.trim() ? margen + arcoiris(l, s.nivel, -i * escena.desfase) : '');
    });
    s.linea();
  }
}
