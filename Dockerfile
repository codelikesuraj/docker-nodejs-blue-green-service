# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (will be overridden by env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:${APP_PORT:-3000}/healthz || exit 1

# Start the application
CMD ["node", "server.js"]
