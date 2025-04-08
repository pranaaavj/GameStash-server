FROM node:18-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN npm install

RUN npm rebuild @tensorflow/tfjs-node --build-from-source

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]