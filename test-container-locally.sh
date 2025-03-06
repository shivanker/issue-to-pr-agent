#!/bin/bash
set -e

MODE="foreground"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -d|--detach) MODE="background"; shift ;;
    -h|--help)
      echo "Usage: $0 [-d|--detach]"
      echo "  -d, --detach    Run container in detached mode (background)"
      echo "  -h, --help      Show this help message"
      exit 0
      ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
done

# Check for .env file
ENV_FLAG=""
if [ -f .env ]; then
  echo "=== Using environment variables from .env file ==="
  ENV_FLAG="--env-file .env"
else
  echo "=== No .env file found, continuing without environment variables ==="
fi

# Build the container
echo "=== Building Docker container ==="
docker build -t project-sensei-local .

# Check if container is already running
RUNNING_CONTAINERS=$(docker ps -q --filter ancestor=project-sensei-local)
if [ -n "$RUNNING_CONTAINERS" ]; then
  echo "=== Stopping existing container ==="
  docker stop $RUNNING_CONTAINERS
fi

# Run the container with environment variables
if [ "$MODE" = "background" ]; then
  echo "=== Running Lambda container in background ==="
  docker run --name project-sensei-local --rm -d -p 9000:8080 $ENV_FLAG project-sensei-local
  echo "=== Container is running in the background ==="
  echo "=== To test, run: ./test-ping.sh ==="
  echo "=== To check logs: docker logs project-sensei-local ==="
  echo "=== To stop: docker stop project-sensei-local ==="
else
  echo "=== Running Lambda container in foreground ==="
  echo "=== Press Ctrl+C to stop the container ==="
  docker run --name project-sensei-local --rm -p 9000:8080 $ENV_FLAG project-sensei-local
fi

# The curl command examples are now in test-ping.sh