# Use Node.js LTS version pinned to specific digest for security and reproducibility
FROM node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY server.js ./
COPY utils ./utils
COPY public ./public
COPY certs ./certs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app/certs
USER appuser

# Health check (using HTTPS)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('https').get({hostname:'127.0.0.1',port:3000,path:'/api/health',rejectUnauthorized:false},(r)=>{process.exit(r.statusCode===200?0:1)})"

# Start the application
CMD ["node", "server.js"]
