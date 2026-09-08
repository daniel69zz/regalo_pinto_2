# 🎁 regalo-flores · versión consola

Pinto entre flores amarillas en **ASCII de 24 bits** —su retrato, un girasol al
lado y una guirnalda de flores debajo— y el rótulo de felicitación en arcoíris,
en una terminal de verdad. Node y nada más: cero dependencias.

## En local

Hace falta Node 18 o superior (en `.nvmrc` está el 20).

```bash
node bin/regalo.js          # o: npm start
node bin/regalo.js --ayuda  # todas las opciones
```

`Ctrl-C` para salir.

Las flores no son fotos: se dibujan en píxeles y de ahí se convierten a ASCII.
Si quieres tocarlas, están en `scripts/dibujar-flores.mjs`, y
`npm run flores && npm run arte` rehace los PNG y `src/arte.js`.

### Opciones

| CLI | Query | Qué hace | Por defecto |
|---|---|---|---|
| `--ancho N` / `--cols N` | `?cols=` | columnas a usar | las de la terminal / 96 |
| `--filas N` | `?filas=` | filas de la terminal; decide cuánto puede ocupar el rótulo | las de la terminal / 24 |
| `--mensaje TEXTO` | `?mensaje=` | un renglón del rótulo; repetible | el mensaje de cumpleaños |
| `--sin-flores` | `?flores=no` | sólo el retrato, sin flores | con flores |
| `--sin-color` | `?color=no` | texto pelado, sin ANSI | con color |
| `--rapido` / `--lento` / `--velocidad N` | `?velocidad=` | multiplicador de tiempos | `1` |
| `--estatico` | `?estatico` | lo imprime de una vez, sin animación | animado |
| `--bucle auto\|rotulo\|cinta\|no` | `?bucle=` | qué hace al final | `auto` |

`NO_COLOR=1` quita el color y `FORCE_COLOR` (0–3) lo fuerza.

### Por curl, como parrot.live

```bash
npm run servidor            # escucha en el puerto 3000 (PORT para cambiarlo)
```

Y desde otra terminal:

```bash
curl localhost:3000
```

Por curl no hay manera de saber el tamaño de la terminal del otro lado, así que
sin `cols` se asume una consola de 96 columnas y sin `filas`, las 24 de toda la
vida —que es lo que decide cuánto puede ocupar el rótulo—. Para que se ajuste a
tu ventana de verdad:

```bash
curl "localhost:3000?cols=$(tput cols)&filas=$(tput lines)"
```

Quien abra la URL en un navegador ve una página con el comando para copiar.

## Con Docker

```bash
docker build -t regalo-flores .
docker run --rm -p 3000:3000 regalo-flores
curl "localhost:3000?cols=$(tput cols)&filas=$(tput lines)"
```

No hay `npm install` ni fase de build: el proyecto no tiene dependencias y el
arte ya viene generado en `src/arte.js`, así que la imagen es el `node:22-alpine`
de base más cuatro ficheros. Corre como usuario `node`, no como root, y trae
`HEALTHCHECK`.

Para dejarlo puesto en un servidor, escuchando en el 80 y sobreviviendo a
reinicios:

```bash
docker run -d --name regalo -p 80:3000 --restart unless-stopped regalo-flores
```

Dos avisos si lo pones detrás de un proxy (nginx, Caddy, Cloudflare):

- **Nada de buffers por delante.** Si algo acumula la respuesta, la animación
  llega de golpe al final y deja de ser una animación. El servidor manda
  `X-Accel-Buffering: no`, que nginx respeta; en Caddy es `flush_interval -1`, y
  con Cloudflare hay que dejar el DNS en gris.
- **Sin redirigir a HTTPS y sin cortar por tiempo.** `curl` no sigue
  redirecciones sin `-L`, y el bucle final no termina nunca por diseño: quien
  corta es el usuario con `Ctrl-C`.
