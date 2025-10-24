# Blue/Green Deployment Service - Node.js Application

A Node.js application designed for Blue/Green deployment testing with built-in chaos engineering capabilities.

## Overview

This application provides a simple HTTP service that can be deployed in a Blue/Green configuration behind Nginx. It includes endpoints for version checking, health monitoring, and simulated failure scenarios for testing failover mechanisms.

## Features

- **Version Endpoint**: Returns application version and pool information
- **Health Check**: Standard `/healthz` endpoint for container orchestration
- **Chaos Engineering**: Built-in failure simulation for testing failover
- **Custom Headers**: Automatic pool and release identification headers
- **Graceful Shutdown**: Proper SIGTERM/SIGINT handling
- **Docker Ready**: Optimized Dockerfile with health checks

## Endpoints

### GET /version

Returns version information with custom headers.

**Response:**
```json
{
  "pool": "blue",
  "releaseId": "v1-0-0-blue",
  "version": "1.0.0",
  "status": "healthy",
  "timestamp": "2025-01-24T...",
  "uptime": 123.45,
  "environment": {
    "nodeVersion": "v18.x.x",
    "platform": "linux"
  }
}
```

**Headers:**
- `X-App-Pool`: Pool identifier (blue/green)
- `X-Release-Id`: Release identifier

### GET /healthz

Health check endpoint for container orchestration.

**Response:**
```json
{
  "status": "healthy",
  "pool": "blue",
  "timestamp": "2025-01-24T..."
}
```

### POST /chaos/start

Simulates service failures for testing failover.

**Mode can be specified via:**
- Query parameter: `?mode=error` or `?mode=timeout`
- JSON body: `{"mode": "error"}` or `{"mode": "timeout"}`

**Mode Options:**
- `error` - Returns HTTP 500 on all requests
- `timeout` - Request hangs indefinitely

**Examples:**
```bash
# Using query parameter
curl -X POST http://localhost:8081/chaos/start?mode=error

# Using JSON body
curl -X POST http://localhost:8081/chaos/start \
  -H "Content-Type: application/json" \
  -d '{"mode": "timeout"}'
```

**Response:**
```json
{
  "message": "Chaos mode enabled",
  "mode": "error",
  "pool": "blue",
  "timestamp": "2025-01-24T..."
}
```

### POST /chaos/stop

Stops chaos mode and returns service to normal.

**Response:**
```json
{
  "message": "Chaos mode disabled",
  "wasEnabled": true,
  "pool": "blue",
  "timestamp": "2025-01-24T..."
}
```

### GET /

Root endpoint with API documentation.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | Server port | 3000 |
| `APP_HOST` | Server bind address | 0.0.0.0 |
| `APP_POOL` | Pool identifier (blue/green) | unknown |
| `RELEASE_ID` | Release identifier | unknown |

## Docker Images

Pre-built multi-architecture images are available on GitHub Container Registry:

```bash
# Pull Blue image (automatically selects correct architecture)
docker pull ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:blue

# Pull Green image (automatically selects correct architecture)
docker pull ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:green
```

**Supported Architectures:**
- `linux/amd64` - Intel/AMD 64-bit processors
- `linux/arm64` - ARM 64-bit (Apple Silicon M1/M2, AWS Graviton, Raspberry Pi)

### Building Images

Images are automatically built and pushed to GitHub Container Registry via GitHub Actions on every push to main/master/develop branches.

For manual builds, see [BUILD.md](BUILD.md).

## Running Locally

### With Node.js

```bash
# Install dependencies
npm install

# Run the application (Docker default - binds to all interfaces)
APP_PORT=3000 APP_POOL=blue RELEASE_ID=v1-0-0-blue npm start

# Or run locally on localhost only
APP_PORT=3000 APP_HOST=127.0.0.1 APP_POOL=blue RELEASE_ID=v1-0-0-blue npm start
```

### With Docker

```bash
# Run Blue instance
docker run -d \
  --name app-blue \
  -p 8081:3000 \
  -e APP_PORT=3000 \
  -e APP_POOL=blue \
  -e RELEASE_ID=v1-0-0-blue \
  ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:blue

# Run Green instance
docker run -d \
  --name app-green \
  -p 8082:3000 \
  -e APP_PORT=3000 \
  -e APP_POOL=green \
  -e RELEASE_ID=v1-0-0-green \
  ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:green
```

## Testing

### Test Version Endpoint

```bash
curl http://localhost:8081/version
```

### Test Health Check

```bash
curl http://localhost:8081/healthz
```

### Test Chaos Mode

```bash
# Start chaos (error mode) - using query parameter
curl -X POST http://localhost:8081/chaos/start?mode=error

# Or start chaos using JSON body
curl -X POST http://localhost:8081/chaos/start \
  -H "Content-Type: application/json" \
  -d '{"mode": "error"}'

# Verify service returns errors
curl http://localhost:8081/version
# Should return 500

# Stop chaos
curl -X POST http://localhost:8081/chaos/stop

# Verify service is healthy again
curl http://localhost:8081/version
# Should return 200
```

## Blue/Green Deployment Setup

This application is designed to be deployed in a Blue/Green configuration behind Nginx for zero-downtime deployments and automatic failover.

### Required Setup

1. **Two instances**: Blue (primary) and Green (backup)
2. **Nginx proxy**: Routes traffic with health-based failover
3. **Health checks**: Automatic detection of failed instances
4. **Port exposure**:
   - Nginx: `8080` (public endpoint)
   - Blue: `8081` (direct access for chaos testing)
   - Green: `8082` (direct access for chaos testing)

### Failover Behavior

- **Normal state**: All traffic goes to Blue
- **Blue fails**: Nginx automatically switches to Green
- **Zero downtime**: Requests retry to Green within same client request
- **Auto-recovery**: When Blue recovers, it becomes available again

### Testing Failover

```bash
# 1. Check baseline (should be Blue)
curl -i http://localhost:8080/version

# 2. Trigger failure on Blue (using query parameter)
curl -X POST http://localhost:8081/chaos/start?mode=error

# Or trigger failure using JSON body
curl -X POST http://localhost:8081/chaos/start \
  -H "Content-Type: application/json" \
  -d '{"mode": "error"}'

# 3. Verify automatic failover to Green
curl -i http://localhost:8080/version
# Should show X-App-Pool: green

# 4. Restore Blue
curl -X POST http://localhost:8081/chaos/stop

# 5. Verify Blue is back
curl -i http://localhost:8080/version
```

## Docker Image Details

### Base Image
- Node.js 18 Alpine Linux
- Multi-architecture support (amd64, arm64)
- Minimal size (~150MB)
- Security-hardened

### Features
- Non-root user (nodejs:nodejs)
- Built-in health checks
- Production dependencies only
- Graceful shutdown handling

### Health Check
```dockerfile
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:${PORT:-3000}/healthz || exit 1
```

## Development

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run dev
```

Uses `nodemon` for auto-reload on file changes.

### Production Mode

```bash
npm start
```

## Dependencies

- **express**: Web framework
- **nodemon** (dev): Auto-reload for development

## Architecture Notes

- **Stateless**: No database or persistent storage
- **12-Factor App**: Configuration via environment variables
- **Cloud-Native**: Ready for container orchestration
- **Graceful Shutdown**: Handles SIGTERM/SIGINT properly

## Chaos Engineering

The chaos endpoints allow testing of:
- Nginx failover behavior
- Load balancer health checks
- Client retry logic
- Monitoring and alerting

**Error Mode** (`mode=error`):
- Returns HTTP 500 on all requests
- Useful for testing immediate failover

**Timeout Mode** (`mode=timeout`):
- Request hangs indefinitely
- Tests timeout handling and connection pooling

## Security Considerations

- Runs as non-root user
- No shell in Alpine image
- Minimal attack surface
- No secrets in image
- Environment-based configuration

## CI/CD

This repository uses GitHub Actions for automated builds:

- **Trigger**: Push to main/master/develop or version tags
- **Build**: Creates both Blue and Green images
- **Push**: Automatically pushes to GitHub Container Registry
- **Tags**: Multiple tags including `blue`, `green`, version tags, and SHA-based tags

See [BUILD.md](BUILD.md) for detailed build information.

## Production Deployment

For production use:
1. Use specific version tags (not `latest`)
2. Enable resource limits in orchestration
3. Configure log aggregation
4. Set up monitoring and alerting
5. Use secrets management for sensitive config
6. Enable TLS termination at load balancer

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs app-blue

# Check health status
docker inspect app-blue | grep Health -A 10
```

### Port already in use

```bash
# Find process using port
lsof -i :8081

# Use different port
docker run -p 9081:3000 ...
```

### Image build fails

```bash
# Clean build cache
docker builder prune

# Rebuild without cache
docker build --no-cache -t blue-green-app:blue .
```

## Contributing

When modifying the application:
1. Update this README if adding/changing endpoints
2. Rebuild images after changes
3. Test locally before deploying
4. Update version in response JSON if needed

## License

MIT

## Links

- **GitHub Repository**: https://github.com/codelikesuraj/docker-nodejs-blue-green-service
- **Docker Images**: https://github.com/codelikesuraj/docker-nodejs-blue-green-service/pkgs/container/docker-nodejs-blue-green-service
- **Build Instructions**: [BUILD.md](BUILD.md)