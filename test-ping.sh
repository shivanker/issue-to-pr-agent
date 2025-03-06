#!/bin/bash
set -e

# Format the payload for the Lambda test
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

# Check for .env file
ENV_FLAG=""
if [ -f .env ]; then
  ENV_FLAG="--env-file .env"
fi

# Test if any container with our image is running
if ! docker ps | grep -q 'project-sensei-local'; then
  echo "Lambda container is not running. Building and starting it..."

  # Build the container if needed
  docker build -t project-sensei-local .

  # Run the container in the background
  echo "Running the container in the background"
  docker run --name project-sensei-test --rm -d -p 9000:8080 $ENV_FLAG project-sensei-local
  echo "Waiting for container to initialize..."
  sleep 3
else
  echo "Lambda container is already running"
fi

echo "Sending GitHub ping event to the Lambda container..."
curl -s -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d "$PAYLOAD" | jq .

echo "Test completed!"