# El regalo por HTTP, en un contenedor.
#
#   docker build -t regalo-flores .
#   docker run --rm -p 3000:3000 regalo-flores
#   curl "localhost:3000?cols=$(tput cols)&filas=$(tput lines)"
#
# No hay `npm install` ni fase de build: el proyecto no tiene dependencias y el
# arte ASCII ya viene generado en src/arte.js. Copiar los cuatro ficheros que
# hacen falta es literalmente todo.

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
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

EXPOSE 3000

# Ojo con el agente: si dijera "curl" el servidor le devolvería la animación,
# que no termina nunca, y el healthcheck se quedaría colgado hasta el timeout.
# Con cualquier otro agente contesta la página HTML y cierra.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/',{headers:{'user-agent':'healthcheck'}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Node es PID 1 aquí. `server.js` atiende SIGTERM y corta las escenas en marcha
# antes de cerrar; si no, `docker stop` esperaría a peticiones que no terminan
# nunca y acabaría matando el proceso a SIGKILL.
CMD ["node", "server.js"]
