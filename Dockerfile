FROM node:22-bookworm-slim
WORKDIR /app
COPY geomoka-source.tar.gz /tmp/geomoka-source.tar.gz
RUN tar -xzf /tmp/geomoka-source.tar.gz -C /tmp && cp -a /tmp/geomoka-deploy/. /app/ && rm -rf /tmp/geomoka-deploy /tmp/geomoka-source.tar.gz
RUN npm install
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm","run","start","--","-p","3000"]
