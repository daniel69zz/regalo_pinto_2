/**
 * Salida: escribir a una terminal o a un socket sin atragantarse.
 *
 * Lo mismo sirve para `process.stdout` que para la respuesta HTTP de un `curl`,
 * y por eso hay dos cosas que no se pueden dar por hechas: que el otro lado lea
 * tan rápido como escribimos (de ahí el drain) y que siga ahí (de ahí `vivo`).
 * Si el usuario corta con Ctrl-C, la escena tiene que enterarse y parar, no
 * seguir animando contra una tubería rota.
 */
import { ESC } from './color.js';

export function crearSalida(stream, { ancho, nivel, velocidad = 1 } = {}) {
  let vivo = true;
  let drenado = true;
  let esperandoDrain = null;

  const muere = () => {
    vivo = false;
    if (esperandoDrain) { esperandoDrain(); esperandoDrain = null; }
  };

  stream.on?.('close', muere);
  stream.on?.('error', muere);
  stream.on?.('drain', () => {
    drenado = true;
    if (esperandoDrain) { esperandoDrain(); esperandoDrain = null; }
  });

  return {
    ancho,
    nivel,
    velocidad,
    get vivo() { return vivo; },
    corta: muere,

    escribe(s) {
      if (!vivo || !s) return;
      try { drenado = stream.write(s); } catch { muere(); }
    },

    linea(s = '') { this.escribe(s + '\n'); },

    /** Reescribe la línea actual (sin saltar): el truco que hace que todo esto
     *  funcione igual con 200 filas de terminal que con 24. */
    reescribe(s) { this.escribe('\r' + ESC.limpiaLinea + s); },

    async espera(ms) {
      if (!vivo) return;
      if (!drenado) await new Promise((r) => { esperandoDrain = r; });
      const t = Math.round(ms * velocidad);
      if (t > 0 && vivo) await new Promise((r) => setTimeout(r, t));
    }
  };
}
