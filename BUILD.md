# Building Docker Images

This document explains how to build and push the Docker images for the Blue/Green deployment service.

## Automated Builds (GitHub Actions)

The repository includes a GitHub Actions workflow that automatically builds and pushes Docker images to GitHub Container Registry (ghcr.io).

### Trigger Conditions

The workflow runs on:
- **Push to main/master/develop branches**: Builds and pushes images
- **Push tags** (e.g., `v1.0.0`): Builds and pushes versioned images
- **Pull requests**: Builds images (without pushing)
- **Manual trigger**: Via GitHub Actions UI

### Multi-Architecture Support

Images are built for multiple architectures:
- **linux/amd64** - Intel/AMD 64-bit (most common)
- **linux/arm64** - ARM 64-bit (Apple Silicon M1/M2, AWS Graviton, Raspberry Pi)

Docker automatically pulls the correct architecture for your platform.

### Image Tags

Each build creates multiple tags for both Blue and Green images:

**Blue Image:**
- `ghcr.io/[owner]/[repo]:blue` (latest)
- `ghcr.io/[owner]/[repo]:blue-[git-sha]`
- `ghcr.io/[owner]/[repo]:[branch]-blue`
- `ghcr.io/[owner]/[repo]:[version]-blue` (for tagged releases)

**Green Image:**
- `ghcr.io/[owner]/[repo]:green` (latest)
- `ghcr.io/[owner]/[repo]:green-[git-sha]`
- `ghcr.io/[owner]/[repo]:[branch]-green`
- `ghcr.io/[owner]/[repo]:[version]-green` (for tagged releases)

### Setup Requirements

1. **Enable GitHub Packages**: Your repository must have GitHub Packages enabled (enabled by default)

2. **Permissions**: The workflow uses `GITHUB_TOKEN` which is automatically provided by GitHub Actions with the necessary permissions.

3. **First Run**: On the first workflow run, GitHub will create the package. You may need to:
   - Go to your repository settings
   - Navigate to "Packages"
   - Make the package public (if desired)

### Viewing Built Images

After a successful build:

1. Go to your GitHub repository
2. Click on "Packages" in the right sidebar
3. You'll see the Docker images listed
4. Click on an image to view all available tags

### Using the Images

Pull the images from GitHub Container Registry:

```bash
# Pull Blue image
docker pull ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:blue

# Pull Green image
docker pull ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:green

# Pull specific version
docker pull ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:v1.0.0-blue
```

For public repositories, no authentication is needed. For private repositories:

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Then pull the image
docker pull ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:blue
```

## Manual Builds (Local Development)

### Build Both Images

```bash
# Build Blue image (single architecture)
docker build -t ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:blue \
  --build-arg APP_POOL=blue \
  --build-arg RELEASE_ID=v1-0-0-blue \
  .

# Build Green image (single architecture)
docker build -t ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:green \
  --build-arg APP_POOL=green \
  --build-arg RELEASE_ID=v1-0-0-green \
  .
```

### Build Multi-Architecture Images

To build for multiple architectures locally, use buildx:

```bash
# Create and use a buildx builder
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# Build and push Blue image for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:blue \
  --build-arg APP_POOL=blue \
  --build-arg RELEASE_ID=v1-0-0-blue \
  --push \
  .

# Build and push Green image for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:green \
  --build-arg APP_POOL=green \
  --build-arg RELEASE_ID=v1-0-0-green \
  --push \
  .
```

### Build with Local Tags

For local testing, you can use simpler tags:

```bash
# Build for local testing
docker build -t blue-green-app:blue .
docker build -t blue-green-app:green .
```

### Push Images Manually

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u [username] --password-stdin

# Push Blue image
docker push ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:blue

# Push Green image
docker push ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:green
```

## Build Arguments

The Dockerfile doesn't require build arguments by default, but you can pass them if needed:

| Argument | Description | Default |
|----------|-------------|---------|
| `APP_POOL` | Pool identifier (blue/green) | Set at runtime via env var |
| `RELEASE_ID` | Release identifier | Set at runtime via env var |

**Note:** These are typically set as environment variables at runtime, not build time.

## Image Details

### Base Image
- **Node.js 18 Alpine Linux**
- Minimal size (~150MB compressed)
- Security-hardened

### Features
- Non-root user (nodejs:nodejs)
- Built-in health checks
- Production dependencies only
- Graceful shutdown handling
- No shell (security hardening)

### Exposed Ports
- `3000` - Application HTTP port

### Health Check
```dockerfile
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:${APP_PORT:-3000}/healthz || exit 1
```

## Image Size Optimization

The `.dockerignore` file excludes unnecessary files:
- Git history and config
- Documentation files
- Development files
- IDE configuration
- Docker-related files
- Test files

This keeps the image size minimal while including only production dependencies.

## Troubleshooting

### Build Fails in CI

1. **Check workflow logs**: Go to Actions tab and view the failed workflow
2. **Verify Dockerfile**: Ensure the Dockerfile is valid
3. **Check dependencies**: Ensure `package.json` lists all required dependencies

### Image Won't Push

1. **Check permissions**: Ensure `GITHUB_TOKEN` has `packages:write` permission
2. **Repository settings**: Verify GitHub Packages is enabled
3. **Package visibility**: Check if package exists and has correct permissions

### Image Too Large

1. **Use Alpine base**: Already using `node:18-alpine`
2. **Production deps only**: Using `npm ci --only=production`
3. **Check .dockerignore**: Ensure unnecessary files are excluded
4. **Layer caching**: Docker buildx uses layer caching for faster builds

### Can't Pull Image

1. **Authentication**: Login to ghcr.io with your GitHub token
2. **Package visibility**: Ensure package is public or you have access
3. **Correct tag**: Verify you're using the correct image tag
4. **Repository name**: Ensure the full path is correct (case-sensitive)

## Example: Complete Build and Deploy Workflow

```bash
# 1. Push code to trigger build
git add .
git commit -m "Update application"
git push origin main

# 2. Wait for GitHub Actions to build images
# View progress at: https://github.com/codelikesuraj/docker-nodejs-blue-green-service/actions

# 3. Pull the built images
docker pull ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:blue
docker pull ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:green

# 4. Run with docker-compose
docker-compose up -d
```

## Release Versioning

To create a versioned release:

```bash
# Tag the release
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will build and push:
# - ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:v1.0.0-blue
# - ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:v1.0.0-green
# - ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:1.0-blue
# - ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:1.0-green
```

## Security Considerations

1. **Token Security**: Never commit GitHub tokens to the repository
2. **Image Scanning**: Consider adding vulnerability scanning to the workflow
3. **Non-root User**: Images run as non-root user (nodejs:nodejs)
4. **Minimal Base**: Alpine Linux provides minimal attack surface
5. **No Secrets**: Never include secrets or credentials in the image

## Next Steps

After images are built and pushed:

1. Use the images in your `docker-compose.yml` or deployment configuration
2. Reference them in `.env` file: `BLUE_IMAGE=ghcr.io/codelikesuraj/docker-nodejs-blue-green-service:blue`
3. Deploy using the pre-built images (no rebuild required)

## Support

For issues with:
- **Image builds**: Check GitHub Actions logs
- **GitHub Packages**: See [GitHub Packages documentation](https://docs.github.com/packages)
- **Docker**: See [Docker documentation](https://docs.docker.com)