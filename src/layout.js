/**
 * Qué cabe en esta consola.
 *
 * La web reescala el arte con `font-size`; una terminal no puede, así que el
 * arte viene generado en varios tamaños y aquí se elige.
 *
 * Pinto y el girasol grande van juntos, uno al lado del otro, y las flores
 * amarillas se reparten alrededor:
 *
 * - **El girasol, al lado del retrato y tan grande como él**, aunque para eso
 *   haya que encoger a Pinto. Los dos van apoyados abajo, de pie sobre la
 *   guirnalda, que es donde la flor más cerca queda del final de la escena.
 * - **Y girando, si puede.** El bucle final sólo repinta lo que sigue en
 *   pantalla, así que para que la flor gire tiene que caber, de su cabeza para
 *   abajo, con la guirnalda y el rótulo. Se prueban las parejas de
 *   más a menos flor y, en cada una, de más a menos Pinto, y gana la primera
 *   que quepa girando sin dejar el rótulo en texto pelado. Si ninguna, la
 *   pareja con la flor más grande, quieta.
 * - **La guirnalda va siempre**, tumbada debajo y centrada, a lo ancho de lo
 *   que haya montado arriba. Es la que pone las flores en cualquier consola.
 * - **Sólo en consolas donde no cabe la pareja**, el girasol se pone debajo
 *   del retrato para que haya flores igual.
 */
import { RETRATO, GIRASOL, GUIRNALDA,
         RETRATO_BRILLO, GIRASOL_BRILLO, GUIRNALDA_BRILLO } from './arte.js';
import { deArte, deTexto, juntar, centra, anchoBloque, rellena, vacio } from './lienzo.js';
import { render as rotuloBloques, rotuloPlano } from './fuente.js';

export const HUECO = 3;          // columnas entre el retrato y el girasol
export const ALTO_A_CIEGAS = 24; // filas que se suponen cuando no se sabe (curl)
/**
 * El mensaje del 21 de septiembre, el día de regalar flores amarillas: empieza
 * la primavera en el sur y, desde Floricienta, es la flor de quien quiere de
 * verdad. Los girasoles de la escena giran buscando el sol, y el mensaje va de
 * eso. Renglones de 20 letras como mucho, que a más la fuente de bloques ya no
 * cabe en 104 columnas y el renglón se parte (el primero se parte a propósito,
 * en "¡FELIZ 21 DE" y "SEPTIEMBRE!", que queda de titular).
 */
export const MENSAJE = [
  '¡Feliz 21 de septiembre weeeee!',
  'No te olvides que no estas sola xd',
  'Se le quiere mucho',
  'PD: esto lo hice hace mucho tiempo xd ksksk'
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
 * Las parejas retrato + girasol que caben en horizontal: de más a menos flor y,
 * para cada girasol, de más a menos Pinto. `componer` se queda con la primera
 * que le sirva. Manda la flor: es la protagonista junto a Pinto, y el retrato
 * se encoge lo que haga falta para dejarle sitio.
 *
 * Los dos se quedan en una banda: el girasol, entre 0.7 y 1.2 veces el ancho
 * del retrato. Por debajo, la flor vuelve a ser un adorno de la foto; por
 * encima, Pinto se queda en sello de correos al lado de una flor enorme, y el
 * regalo es suyo.
 */
const TOPE_GIRASOL = 1.2;
const SUELO_GIRASOL = 0.7;
/** Por debajo de esto la guirnalda no se lee: son cuatro filas de nada. */
const MINIMO_GUIRNALDA = 48;
/**
 * Lo que se le consiente encoger a la guirnalda para que la flor gire: hasta
 * la mitad del ancho de la pareja. Es la peana, no la protagonista, y sus
 * filas son las que la flor necesita; mejor una guirnalda más corta que un
 * Pinto de juguete.
 */
const GUIRNALDA_CORTA = 0.5;

function parejas(util) {
  const salida = [];
  for (const girasol of GIRASOL) {
    for (const retrato of RETRATOS) {
      if (retrato.cols + HUECO + girasol.cols > util) continue;
      if (girasol.cols > retrato.cols * TOPE_GIRASOL) break;   // los que quedan, más pequeños
      if (girasol.cols >= retrato.cols * SUELO_GIRASOL) salida.push({ retrato, girasol });
    }
  }
  if (salida.length) return salida;
  // sin banda antes que apilarlos: en una consola justa, mejor la pareja
  // descompensada que partida en dos pisos
  for (const girasol of GIRASOL) {
    const retrato = mayorQueQuepa(RETRATOS, util - girasol.cols - HUECO);
    if (retrato) return [{ retrato, girasol }];
  }
  return [];
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
 * `nivel` es el escalón, para poder comparar dos rótulos: 0 es el más vistoso.
 */
function escalasRotulo(mensaje, max) {
  return [
    { nivel: 0, porRenglon: 6, filas: rotuloBloques(mensaje, max) },
    { nivel: 1, porRenglon: 3, filas: rotuloBloques(mensaje, max, { compacta: true }) },
    { nivel: 2, porRenglon: 3, filas: titularYTexto(mensaje, max) },
    { nivel: 3, porRenglon: 1, filas: rotuloPlano(mensaje, max) }
  ].filter((e) => e.filas?.length);
}

/** Lo más ancho que se pone el rótulo, aunque la consola dé para más. */
const TOPE_ROTULO = 104;
/**
 * El rótulo más modesto con el que se acepta que la flor gire: el titular en
 * bloques y el resto en texto espaciado. Por debajo, todo en texto espaciado,
 * el mensaje pierde más de lo que gana la flor, y mejor que se quede quieta.
 */
const NIVEL_MINIMO_GIRANDO = 2;
/**
 * Las filas que, con la flor girando, quedan en pantalla además de la flor, la
 * guirnalda y el rótulo: el blanco de antes y el de después del rótulo, la
 * fila donde se queda el cursor y una de aire. Es lo que el bucle final sube y
 * baja, así que si no cabe, la flor se sale por arriba.
 */
const AIRE_GIRANDO = 4;

/**
 * El retrato —con el girasol al lado, si se le pasa— y la guirnalda debajo.
 *
 * Devuelve las filas montadas, los fotogramas del giro de la guirnalda y los
 * del girasol (`flor`), con la columna en la que empieza dentro del bloque. Los
 * dos van apoyados abajo y no centrados: así las filas de la flor son las
 * últimas antes de la guirnalda, y el bucle final tiene que subir lo menos
 * posible para hacerla girar; y si la flor es la más alta, Pinto se queda de
 * pie a su lado en vez de flotando a media altura.
 */
function montaArte(retratoV, girasolV, { flores, util, bloqueDe, guirnalda = null }) {
  const bRetrato = bloqueDe(retratoV, RETRATO_BRILLO);
  let arte = bRetrato;
  let colocacion = 'solo';
  let flor = null;

  if (girasolV) {
    const marcos = marcosIguales(girasolV, GIRASOL_BRILLO, bloqueDe);
    arte = juntar(bRetrato, marcos[0], HUECO, { abajo: true });
    flor = { marcos, desde: anchoBloque(bRetrato) + HUECO };
    colocacion = 'lado';
  }

  // la guirnalda, tumbada debajo y centrada: es la peana de la escena, no un
  // tercer protagonista. Se mide contra el conjunto ya montado, no contra la
  // consola, y por debajo de 48 columnas no se pone: a esa escala son cuatro
  // filas de puré amarillo.
  const anchoPar = anchoBloque(arte);
  const guirnaldaV = guirnalda ?? (flores && anchoPar >= MINIMO_GUIRNALDA
    ? mayorQueQuepa(GUIRNALDA, anchoPar) : null);

  let giro = [];
  if (guirnaldaV) {
    giro = marcosIguales(guirnaldaV, GUIRNALDA_BRILLO, bloqueDe).map((b) => centra(b, anchoPar));
    arte = [...arte, ...giro[0]];
    colocacion = girasolV ? 'lado y peana' : 'peana';
  } else if (flores && !girasolV) {
    // consola de juguete: sin sitio para la pareja, la flor se pone debajo,
    // que peor que una flor pequeña es ninguna flor
    const abajo = mayorQueQuepa(GIRASOL, Math.min(util, Math.max(22, Math.round(retratoV.cols * 0.7))));
    if (abajo) {
      arte = [...arte, ...vacio(1), ...centra(bloqueDe(abajo, GIRASOL_BRILLO), anchoPar)];
      colocacion = 'abajo';
    }
  }
  // sin guirnalda debajo el bucle final no llega hasta la flor
  if (!guirnaldaV) flor = null;
  return { arte, giro, colocacion, guirnaldaV, flor };
}

/**
 * Los fotogramas de algo que gira, listos para pintarse unos encima de otros.
 *
 * Se rellenan todos al ancho del más ancho porque el conversor le quita a cada
 * fila los espacios del final, y si cada fotograma se centrara por el suyo, la
 * flor tiritaría una columna a cada vuelta.
 */
function marcosIguales(v, brillo, bloqueDe) {
  const marcos = v.marcos.map((m) => bloqueDe(m, brillo));
  const w = Math.max(...marcos.map(anchoBloque));
  return marcos.map((b) => b.map((l) => (l.length ? rellena(l, w) : l)));
}

/**
 * La escala del rótulo que cabe en `presupuesto` filas, o null.
 *
 * Las escalas se guardan por ancho, porque al elegir pareja se prueban muchas
 * y casi todas dan el mismo ancho de rótulo: componer la fuente de bloques
 * cada vez sería repetir el mismo trabajo veinte veces.
 */
function escalaQueCabe(escalasDe, anchoRotulo, presupuesto) {
  return escalasDe(anchoRotulo).find((e) => e.filas.length <= presupuesto) ?? null;
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
  const alto = filas ?? ALTO_A_CIEGAS;
  const cache = new Map();
  const escalasDe = (w) => {
    if (!cache.has(w)) cache.set(w, escalasRotulo(mensaje, w));
    return cache.get(w);
  };
  // el rótulo se mide contra las imágenes, no contra la consola: a la misma
  // anchura que el arte, con tope, que en un monitor de 240 columnas se
  // desparrama
  const anchoRotuloDe = (anchoArte) => Math.min(util, anchoArte, TOPE_ROTULO);

  // la pareja: la primera que quepa con la flor girando y, si ninguna, la de
  // la flor más grande, quieta. Para cada pareja se prueba la guirnalda de más
  // a menos, que sus filas son las que le faltan a la flor. Se mide con los
  // números de cada tamaño, sin montar nada, que son muchas.
  const candidatas = flores ? parejas(util) : [];
  let elegida = candidatas[0] ? { ...candidatas[0], guirnalda: null } : null;
  busca: for (const c of candidatas) {
    const anchoPar = c.retrato.cols + HUECO + c.girasol.cols;
    for (const guirnalda of GUIRNALDA) {
      if (guirnalda.cols > anchoPar) continue;
      if (guirnalda.cols < Math.max(MINIMO_GUIRNALDA, anchoPar * GUIRNALDA_CORTA)) break;
      const presupuesto = Math.min(Math.max(c.retrato.alto, c.girasol.alto) + guirnalda.alto,
                                   alto - AIRE_GIRANDO - guirnalda.alto - c.girasol.alto);
      const escala = escalaQueCabe(escalasDe, anchoRotuloDe(anchoPar), presupuesto);
      if (escala && escala.nivel <= NIVEL_MINIMO_GIRANDO) {
        elegida = { ...c, guirnalda };
        break busca;
      }
    }
  }

  const retratoV = elegida?.retrato
    ?? mayorQueQuepa(RETRATOS, util) ?? RETRATOS[RETRATOS.length - 1];
  const girasolV = elegida?.girasol ?? null;
  const { arte, giro, colocacion, guirnaldaV, flor } =
    montaArte(retratoV, girasolV, { flores, util, bloqueDe, guirnalda: elegida?.guirnalda });

  // el rótulo, con el presupuesto de siempre: sin pasar del alto de las
  // imágenes, que si no el mensaje se come la escena, y cabiendo en pantalla
  // con la guirnalda, porque el bucle final sube el cursor y lo repinta entero
  // (si no cabe, el arcoíris no rueda y sale la cinta de una línea). Si la
  // flor gira, además, le deja sitio a ella.
  const filasGiro = giro[0]?.length ?? 0;
  const filasFlor = flor?.marcos[0].length ?? 0;
  const anchoRotulo = anchoRotuloDe(anchoBloque(arte));
  const conFlor = flor ? escalaQueCabe(escalasDe, anchoRotulo, Math.min(arte.length,
                                       alto - AIRE_GIRANDO - filasGiro - filasFlor)) : null;
  const escala = (conFlor && conFlor.nivel <= NIVEL_MINIMO_GIRANDO ? conFlor : null)
    ?? escalaQueCabe(escalasDe, anchoRotulo,
                     Math.min(arte.length, Math.max(6, alto - 6 - filasGiro)))
    ?? escalasDe(anchoRotulo).at(-1)
    ?? { nivel: 4, porRenglon: 1, filas: [] };

  const pad = Math.max(0, Math.floor((ancho - anchoBloque(arte)) / 2));
  return {
    arte: centra(arte, ancho),
    // las filas del final del arte que saben girar, listas para repintarse
    giro: giro.map((b) => centra(b, ancho)),
    // el girasol de al lado del retrato: sus fotogramas y la columna de la
    // consola (desde 0) en la que empiezan, para repintarlo sin tocar a Pinto
    flor: flor ? { marcos: flor.marcos, columna: pad + flor.desde } : null,
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
    anchoArte: anchoBloque(arte),
    // filas totales, por si hay que decidir si la escena cabe de una pieza
    alto: arte.length + escala.filas.length + 4
  };
}
