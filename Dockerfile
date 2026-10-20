FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p /data/media
ENV MEDIA_DIR=/data/media
EXPOSE 3000
CMD ["node", "src/index.js"]
