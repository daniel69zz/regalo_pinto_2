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
docker compose up -d --build
curl "localhost:2999?cols=$(tput cols)&filas=$(tput lines)"
```

El contenedor escucha en el **2999** y se publica en el 2999 del host. Lo mismo
sin compose:

```bash
docker build -t regalo-flores .
docker run -d --name regalo-flores -p 2999:2999 --restart unless-stopped regalo-flores
```

No hay `npm install` ni fase de build: el proyecto no tiene dependencias y el
arte ya viene generado en `src/arte.js`, así que la imagen es el `node:22-alpine`
de base más cuatro ficheros. Corre como usuario `node`, no como root, trae
`HEALTHCHECK` y se apaga limpio (`docker compose down` no espera a las escenas
que no terminan nunca).

### Detrás del nginx que ya tienes

No hay que tocar nada de lo que ya sirve: se añade un `server` más y nginx elige
por `server_name` antes que por `default_server`, así que el bloque del regalo
gana al comodín sin molestar al resto. En `deploy/regalo.conf.template` está
escrito; cambia el `server_name` por tu dominio y ponlo donde corresponda.

Lo único que hay que decidir es **cómo llega tu nginx al contenedor**:

```bash
docker ps --format '{{.Names}}' | grep -i nginx
```

- **No imprime nada** → tu nginx corre en el host. La plantilla sirve tal cual
  (`proxy_pass http://127.0.0.1:2999`). Cópiala a
  `/etc/nginx/sites-available/regalo.conf`, enlázala en `sites-enabled/` y
  `nginx -t && systemctl reload nginx`.
- **Imprime un nombre** → tu nginx está en un contenedor, y ahí `127.0.0.1` es
  su propia loopback. Dos salidas, las dos comentadas en la plantilla: meter los
  dos contenedores en la misma red y llamarlo por su nombre (`regalo-flores`),
  que es la buena y además permite quitar el `ports:` del compose; o, si
  prefieres no tocarle la red a nada, apuntar a la puerta de enlace del host
  (`172.17.0.1:2999` en la red por defecto), que funciona precisamente porque el
  puerto está publicado.

Si tu nginx en contenedor usa las plantillas de la imagen oficial
(`nginx/templates/*.conf.template`), copia el fichero ahí y **reinicia** el
contenedor: `envsubst` sólo las procesa al arrancar, un `reload` no las mira. Y
antes de tocar producción, el ensayo en seco que está al principio de la
plantilla valida la sintaxis sin tirar nada.

Falta lo de fuera: un registro **A** del dominio apuntando a la IP del VPS y el
puerto 80 abierto (`ufw allow 80/tcp`). Y entonces `curl tu-dominio` sirve el
regalo. Sin dominio funciona igual con `curl IP-DEL-VPS:2999`.

Dos avisos, tengas proxy o no:

- **Nada de buffers por delante.** Si algo acumula la respuesta, la animación
  llega de golpe al final y deja de ser una animación. El servidor manda
  `X-Accel-Buffering: no`, la plantilla apaga `proxy_buffering`; en Caddy es
  `flush_interval -1`, y con Cloudflare hay que dejar el DNS en gris.
- **Sin redirigir a HTTPS y sin cortar por tiempo.** `curl` no sigue
  redirecciones sin `-L`, y el bucle final no termina nunca por diseño: quien
  corta es el usuario con `Ctrl-C`. Por eso el bloque 80 no redirige y los
  timeouts del proxy están en una hora.

Un detalle de seguridad: Docker publica los puertos **por delante de ufw**, así
que con `2999:2999` el puerto queda abierto a Internet —que es lo que hace falta
para entrar por `curl IP:2999`—. Si delante va un nginx del host y no quieres
que asome, cambia esa línea del compose por `127.0.0.1:2999:2999`.
