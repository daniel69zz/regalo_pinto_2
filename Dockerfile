# El regalo por HTTP, en un contenedor.
#
#   docker compose up -d --build          # en el VPS: queda en el 2999
#   curl "localhost:2999?cols=$(tput cols)&filas=$(tput lines)"
#
# o a mano, sin compose:
#
#   docker build -t regalo-flores .
#   docker run -d --name regalo-flores -p 2999:2999 --restart unless-stopped regalo-flores
#
# No hay `npm install` ni fase de build: el proyecto no tiene dependencias y el
# arte ASCII ya viene generado en src/arte.js. Copiar los cuatro ficheros que
# hacen falta es literalmente todo.

FROM node:22-alpine

# El 2999 es el puerto del contenedor y el que se publica en el VPS (2999:2999).
# `server.js` lee PORT, así que cambiarlo aquí es cambiarlo en todas partes.
ENV NODE_ENV=production \
    PORT=2999 \
    HOST=0.0.0.0

WORKDIR /app

# sólo lo que se ejecuta: ni los PNG originales ni los scripts de generación,
# que son cosa del desarrollo (`npm run arte`), no del servidor
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY bin ./bin

# el usuario `node` viene en la imagen oficial; nada de correr como root
USER node

EXPOSE 2999

# Ojo con el agente: si dijera "curl" el servidor le devolvería la animación,
# que no termina nunca, y el healthcheck se quedaría colgado hasta el timeout.
# Con cualquier otro agente contesta la página HTML y cierra.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/',{headers:{'user-agent':'healthcheck'}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Node es PID 1 aquí. `server.js` atiende SIGTERM y corta las escenas en marcha
# antes de cerrar; si no, `docker stop` esperaría a peticiones que no terminan
# nunca y acabaría matando el proceso a SIGKILL.
CMD ["node", "server.js"]
