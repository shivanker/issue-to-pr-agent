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

echo "Sending GitHub ping event to the Lambda container..."
curl -s -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d "$PAYLOAD" | jq .

echo "Test completed!"