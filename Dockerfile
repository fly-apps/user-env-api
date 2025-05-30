FROM oven/bun:1 as builder

WORKDIR /app

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Start a new stage for the runtime
FROM oven/bun:1-slim

WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lockb ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/server.ts ./

# Expose the port the app runs on
EXPOSE 8080

# Start the server
CMD ["bun", "run", "server.ts"] 