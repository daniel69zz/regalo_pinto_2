/**
 * Qué cabe en esta consola.
 *
 * La web reescala el arte con `font-size`; una terminal no puede, así que el
 * arte viene generado en varios tamaños y aquí se elige.
 *
 * Manda el retrato: Pinto sale lo más grande que quepa. Las flores amarillas se
 * reparten alrededor sin quitarle sitio:
 *
 * - **La guirnalda va siempre**, tumbada debajo y centrada, a lo ancho de lo
 *   que haya montado arriba. Es la que pone las flores en cualquier consola.
 * - **El girasol de al lado, sólo si sale gratis.** Se compara el retrato que
 *   cabría solo con el que cabe haciéndole hueco a la flor, y si por meterla
 *   hubiera que encoger a Pinto, no se mete: las flores ya están abajo, y lo
 *   que no se puede es achicar a la protagonista para adornarla.
 * - **Sólo en consolas de menos de 48 columnas**, donde no cabe guirnalda que
 *   se lea, el girasol se pone debajo del retrato para que haya flores igual.
 */
import { RETRATO, GIRASOL, GUIRNALDA,
         RETRATO_BRILLO, GIRASOL_BRILLO, GUIRNALDA_BRILLO } from './arte.js';
import { deArte, deTexto, juntar, centra, anchoBloque, vacio } from './lienzo.js';
import { render as rotuloBloques, rotuloPlano } from './fuente.js';

export const HUECO = 3;          // columnas entre el retrato y el girasol
export const ALTO_A_CIEGAS = 24; // filas que se suponen cuando no se sabe (curl)
export const MENSAJE = [
  '¡Feliz cumpleaños!',
  'Perdon por el retraso',
  'Prometo no olvidarlo',
  'De nuevo xd pipipi'
];

const mayorQueQuepa = (lista, max) =>
  lista.find((v) => v.cols <= max) ?? null;

/**
 * Lo más ancho que se pone el retrato, aunque la consola dé para más.
 *
 * El arte está generado hasta 120 columnas, pero a ese tamaño son 66 filas: en
 * una ventana normal la cara ocupa dos pantallas y todo lo demás —el rótulo, la
 * guirnalda, la propia letra de la terminal— parece de juguete al lado. A 96
 * son 53 filas, que es el tamaño al que ya se ve la foto con todo su detalle, y
 * la escena se lee de una vez.
 *
 * Lo que sobra de ancho no se desperdicia: al no gastarlo el retrato, la regla
 * de más abajo puede volver a poner el girasol a su lado.
 */
const TOPE_RETRATO = 96;
const RETRATOS = RETRATO.filter((v) => v.cols <= TOPE_RETRATO);

/**
 * La pareja más grande que cabe en horizontal: se prueban los retratos de mayor
 * a menor y se coge el primero que deje hueco para algún girasol a su derecha.
 * Manda que salgan juntos, no que el retrato sea enorme.
 *
 * El girasol se queda en una banda: ni más de ~0.7 del retrato —al mismo tamaño
 * deja de acompañar y se convierte en el segundo protagonista, que es justo lo
 * que evita la web con su `align-items: center`— ni menos de un tercio, que es
 * cuando pasa de acompañante a sello de correos. Ese suelo es lo que impide que
 * el retrato se lo coma todo: entre un retrato de 88 con un girasol de 18 y uno
 * de 80 con un girasol de 25, la pareja equilibrada se ve mejor.
 */
const TOPE_GIRASOL = 0.7;
const SUELO_GIRASOL = 0.3;
/**
 * Lo que se le consiente encoger al retrato por meter la flor al lado: nada.
 *
 * Con el tope de 96 columnas casi siempre sobra sitio a la derecha, así que la
 * flor cabe sin quitarle un escalón a Pinto. Y cuando no cabe, no se pone: la
 * guirnalda de abajo ya lleva las flores.
 */
const COSTE_MAXIMO = 0.95;
/** Por debajo de esto la guirnalda no se lee: son cuatro filas de nada. */
const MINIMO_GUIRNALDA = 48;

function pareja(util, suelo = SUELO_GIRASOL) {
  for (const retrato of RETRATOS) {
    if (retrato.cols > util) continue;
    const tope = Math.max(GIRASOL[GIRASOL.length - 1].cols, Math.round(retrato.cols * TOPE_GIRASOL));
    const girasol = mayorQueQuepa(GIRASOL, Math.min(tope, util - retrato.cols - HUECO));
    if (girasol && girasol.cols >= retrato.cols * suelo) return { retrato, girasol };
  }
  // sin suelo antes que apilarlos: en una consola justa, mejor un girasol
  // pequeño al lado que la pareja partida en dos pisos
  return suelo > 0 ? pareja(util, 0) : null;
}

const anchoDe = (lineas) => Math.max(0, ...lineas.map((l) => l.length));

/** Empuja un bloque de texto n columnas a la derecha (las vacías se quedan). */
const empuja = (lineas, n) => (n > 0 ? lineas.map((l) => (l ? ' '.repeat(n) + l : l)) : lineas);

/**
 * El titular en bloques y el resto del mensaje en texto espaciado: el escalón
 * intermedio para cuando el mensaje entero en bloques no cabe, pero renunciar a
 * ellos del todo sería quedarse sin fiesta.
 */
function titularYTexto(mensaje, max) {
  const titular = rotuloBloques(mensaje.slice(0, 1), max, { compacta: true });
  if (!titular) return null;
  const texto = rotuloPlano(mensaje.slice(1), max);
  if (!texto.length) return titular;
  // cada bloque viene centrado respecto a sí mismo; se alinean entre ellos
  const w = Math.max(anchoDe(titular), anchoDe(texto));
  return [
    ...empuja(titular, Math.floor((w - anchoDe(titular)) / 2)),
    '',
    ...empuja(texto, Math.floor((w - anchoDe(texto)) / 2))
  ];
}

/**
 * Las escalas del rótulo, de más a menos aparatoso. `porRenglon` son las filas
 * que ocupa un renglón, que es lo que decide cuánto se desfasa el arcoíris de
 * una fila a la siguiente (en la web el desfase es por renglón, no por fila).
 */
function escalasRotulo(mensaje, max) {
  return [
    { porRenglon: 6, filas: rotuloBloques(mensaje, max) },
    { porRenglon: 3, filas: rotuloBloques(mensaje, max, { compacta: true }) },
    { porRenglon: 3, filas: titularYTexto(mensaje, max) },
    { porRenglon: 1, filas: rotuloPlano(mensaje, max) }
  ].filter((e) => e.filas?.length);
}

/**
 * Elige tamaños y compone la escena.
 * Devuelve las filas ya montadas (retrato + flores) y el rótulo aparte, porque
 * la animación los revela en momentos distintos.
 */
export function componer(ancho, { flores = true, mensaje = MENSAJE, mono = false, filas = null } = {}) {
  // sin color, el arte de la web es un borrón: todas las celdas llevan carácter
  // y la forma la pone el color. Para eso está la versión monocroma.
  const bloqueDe = (v, brillo) => (mono ? deTexto(v.mono) : deArte(v.filas, brillo));
  // una columna de margen: escribir justo en la última hace que algunas
  // terminales adelanten el salto de línea y descuadren el barrido con "\r"
  const util = Math.max(20, ancho - 1);
  const aSolas = mayorQueQuepa(RETRATOS, util) ?? RETRATOS[RETRATOS.length - 1];
  const juntos = flores ? pareja(util) : null;
  // la flor de al lado, sólo si no le cuesta a Pinto más de un escalón
  const vale = Boolean(juntos) && juntos.retrato.cols >= aSolas.cols * COSTE_MAXIMO;
  const retratoV = vale ? juntos.retrato : aSolas;
  const girasolV = vale ? juntos.girasol : null;

  const bRetrato = bloqueDe(retratoV, RETRATO_BRILLO);
  let arte = bRetrato;
  let colocacion = 'solo';

  if (girasolV) {
    arte = juntar(bRetrato, bloqueDe(girasolV, GIRASOL_BRILLO), HUECO);
    colocacion = 'lado';
  }

  // la guirnalda, tumbada debajo y centrada: es la peana de la escena, no un
  // tercer protagonista. Se mide contra el conjunto ya montado, no contra la
  // consola, y por debajo de 48 columnas no se pone: a esa escala son cuatro
  // filas de puré amarillo.
  const anchoPar = anchoBloque(arte);
  const guirnaldaV = flores && anchoPar >= MINIMO_GUIRNALDA
    ? mayorQueQuepa(GUIRNALDA, anchoPar) : null;

  if (guirnaldaV) {
    arte = [...arte, ...centra(bloqueDe(guirnaldaV, GUIRNALDA_BRILLO), anchoPar)];
    colocacion = girasolV ? 'lado y peana' : 'peana';
  } else if (flores && !girasolV) {
    // consola de juguete: sin sitio para la guirnalda, la flor se pone debajo,
    // que peor que una flor pequeña es ninguna flor
    const abajo = mayorQueQuepa(GIRASOL, Math.min(util, Math.max(22, Math.round(retratoV.cols * 0.7))));
    if (abajo) {
      arte = [...arte, ...vacio(1), ...centra(bloqueDe(abajo, GIRASOL_BRILLO), anchoPar)];
      colocacion = 'abajo';
    }
  }

  const anchoArte = anchoBloque(arte);

  // el rótulo se mide contra las imágenes, no contra la consola: a la misma
  // anchura que el arte (con tope, que en un monitor de 240 columnas se
  // desparrama) y sin pasar de su alto, que si no el mensaje se come la escena.
  // Y tiene que caber también en la pantalla, porque el bucle final sube el
  // cursor y lo repinta entero: si no cabe, el arcoíris no rueda y en su lugar
  // sale la cinta de una línea. Por curl no se sabe el alto, así que se toma la
  // medida de la consola más pequeña que se estila (24 filas).
  const anchoRotulo = Math.min(util, anchoArte, 104);
  const presupuesto = Math.min(arte.length, Math.max(6, (filas ?? ALTO_A_CIEGAS) - 6));
  const escalas = escalasRotulo(mensaje, anchoRotulo);
  const escala = escalas.find((e) => e.filas.length <= presupuesto)
    ?? escalas[escalas.length - 1]
    ?? { porRenglon: 1, filas: [] };

  return {
    arte: centra(arte, ancho),
    rotulo: escala.filas,
    // cuánto gira el tono de una fila a la siguiente, para que el arcoíris se
    // desfase por renglón y no dentro de cada letra
    desfase: 0.06 / escala.porRenglon,
    colocacion,
    tamanos: {
      retrato: `${retratoV.cols}x${retratoV.alto}`,
      girasol: girasolV ? `${girasolV.cols}x${girasolV.alto}` : null,
      guirnalda: guirnaldaV ? `${guirnaldaV.cols}x${guirnaldaV.alto}` : null
    },
    anchoArte,
    // filas totales, por si hay que decidir si la escena cabe de una pieza
    alto: arte.length + escala.filas.length + 4
  };
}
