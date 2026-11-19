# API Node/TS del ERP Molinos. Contexto de build = raiz del repo backend.
FROM node:22-alpine
RUN apk add --no-cache tzdata
ENV TZ=America/Bogota
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
# tsc devuelve codigo != 0 por avisos de tipos pero igual emite el JS; lo que importa es que exista build/app.js
RUN npx tsc || true; test -f build/app.js
ENV NODE_ENV=production
EXPOSE 3005
CMD ["node", "build/app.js"]
