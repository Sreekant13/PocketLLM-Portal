# backend/Dockerfile
# Simple Docker image for PocketLLM backend (CPU-only)

FROM node:22-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Environment defaults (can be overridden when running the container)
ENV NODE_ENV=production
ENV OLLAMA_HOST=http://host.docker.internal:11434
ENV MODEL_ID=llama3.2:3b

# Backend listens on 3001
EXPOSE 3001

# Start the Fastify server using your existing dev script
CMD ["npm", "run", "dev"]
