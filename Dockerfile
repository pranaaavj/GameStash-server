# Stage 1: Building the application
FROM node:23-slim AS build

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./

RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
&& npm ci --omit=dev \
&& npm rebuild @tensorflow/tfjs-node --build-from-source \
&& apt-get purge -y build-essential python3 make g++ \
&& apt-get autoremove -y \
&& rm -rf /var/lib/apt/lists/*

COPY . .

# Stage 2: Running the application
FROM node:23-slim

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY --from=build /app /app

EXPOSE 3000

CMD ["node", "index.js"]