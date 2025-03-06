#!/bin/bash
set -e

# Unified test and deployment script for issue-to-pr-agent

function show_help() {
  echo "Usage: ./test.sh [COMMAND]"
  echo ""
  echo "Commands:"
  echo "  local      - Test with local sample data"
  echo "  webhook    - Start webhook server for ngrok testing"
  echo "  container  - Build and test with Docker container"
  echo "  ping       - Send test ping event to running container"
  echo "  debug      - Access container shell for debugging"
  echo "  help       - Show this help message"
  echo ""
  exit 0
}

# Check for .env file
if [ -f .env ]; then
  ENV_FLAG="--env-file .env"
else
  echo "Warning: No .env file found. Using default environment variables."
  ENV_FLAG=""
fi

case "$1" in
  local)
    echo "Running local test with sample data..."
    npm run test:local
    ;;

  webhook)
    echo "Starting webhook server..."
    npm run webhook
    ;;

  container)
    echo "Building and running container..."
    docker build -t project-sensei-local .

    # Stop container if already running
    docker stop project-sensei-local 2>/dev/null || true

    if [ "$2" == "detach" ]; then
      echo "Running container in background..."
      docker run --name project-sensei-local --rm -d -p 9000:8080 $ENV_FLAG project-sensei-local
      echo "Container running! To test: ./test.sh ping"
    else
      echo "Running container in foreground (Ctrl+C to stop)..."
      docker run --name project-sensei-local --rm -p 9000:8080 $ENV_FLAG project-sensei-local
    fi
    ;;

  ping)
    echo "Sending GitHub ping event to container..."
    PAYLOAD=$(cat <<EOF
{
  "headers": {
    "request-method": "POST",
    "accept": "*/*",
    "content-type": "application/json",
    "user-agent": "GitHub-Hookshot/e43c576",
    "x-github-delivery": "85240cf0-fabd-11ef-921c-bd13567f8cec",
    "x-github-event": "ping",
    "x-github-hook-id": "533790625",
    "x-github-hook-installation-target-id": "1168904",
    "x-github-hook-installation-target-type": "integration"
  },
  "body": "{\"zen\":\"Favor focus over features.\",\"hook_id\":533790625,\"hook\":{\"type\":\"App\",\"id\":533790625,\"name\":\"web\",\"active\":true,\"events\":[\"issues\",\"issue_comment\",\"pull_request_review\",\"pull_request_review_comment\",\"pull_request_review_thread\"],\"config\":{\"content_type\":\"json\",\"insecure_ssl\":\"0\",\"url\":\"https://vvwleqwbpw4npxojqkdlunbaxe0hcckf.lambda-url.us-east-1.on.aws/\"},\"updated_at\":\"2025-03-06T19:02:16Z\",\"created_at\":\"2025-03-06T19:02:16Z\",\"app_id\":1168904,\"deliveries_url\":\"https://api.github.com/app/hook/deliveries\"}}",
  "isBase64Encoded": false
}
EOF
    )
    curl -s -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
      -d "$PAYLOAD" | jq .
    ;;

  debug)
    echo "Starting interactive shell in container..."
    docker build -t project-sensei-local .
    docker run -it --rm --entrypoint /bin/bash project-sensei-local
    ;;

  help|*)
    show_help
    ;;
esac