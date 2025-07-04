# Use the official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Make the binary executable
RUN chmod +x dist/server.js

# Set environment variables (these should be overridden at runtime)
ENV NANGO_CONNECTION_ID=""
ENV NANGO_INTEGRATION_ID=""
ENV NANGO_BASE_URL="https://api.nango.dev"
ENV NANGO_SECRET_KEY=""

# Expose port (if needed)
EXPOSE 3000

# Run the server
CMD ["node", "dist/server.js"]
