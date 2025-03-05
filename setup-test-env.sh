#!/bin/bash

# Check if .env file exists
if [ -f .env ]; then
  read -p ".env file already exists. Do you want to overwrite it? (y/n): " overwrite
  if [ "$overwrite" != "y" ]; then
    echo "Setup cancelled. Existing .env file will not be modified."
    exit 0
  fi
fi

# Copy the example env file
cp .env.example .env

echo "Created .env file from example template."
echo "Please edit the .env file with your GitHub App credentials."

# Open the .env file in the default editor
if [ -n "$EDITOR" ]; then
  $EDITOR .env
elif command -v nano >/dev/null 2>&1; then
  nano .env
elif command -v vim >/dev/null 2>&1; then
  vim .env
else
  echo "Please edit the .env file manually with your preferred text editor."
fi

echo ""
echo "=== Testing Environment Setup ==="
echo "1. Fill in your GitHub App credentials in the .env file"
echo "2. For local testing with sample data: npm run test:local"
echo "3. For testing with real GitHub events:"
echo "   - Run: npm run webhook"
echo "   - In another terminal: ngrok http 3000"
echo "   - Configure your GitHub App webhook URL to the ngrok URL"
echo ""
echo "For more detailed instructions, see LOCAL_TESTING.md"