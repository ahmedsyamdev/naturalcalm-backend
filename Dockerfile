FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Ensure uploads directory exists and persists
RUN mkdir -p /app/public/uploads/images/track \
             /app/public/uploads/images/program \
             /app/public/uploads/images/category \
             /app/public/uploads/images/avatar \
             /app/public/uploads/audio

EXPOSE 5000

# Mount /app/public/uploads as a volume in Coolify to persist uploaded files
VOLUME ["/app/public/uploads"]

CMD ["node", "dist/server.js"]
