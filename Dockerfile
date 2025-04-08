FROM node:18-slim

# Install dependencies required to build native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install deps (this pulls tfjs-node source)
RUN npm install

# Manually rebuild tfjs-node native bindings inside the container
RUN npm rebuild @tensorflow/tfjs-node --build-from-source

# Copy source code
COPY . .

# Expose your backend port
EXPOSE 3000

# Start your server
CMD ["node", "index.js"]