FROM public.ecr.aws/lambda/nodejs:22

# Install git and other dependencies
RUN dnf install -y git

# Create app directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package.json package-lock.json ./

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Install all dependencies (including dev)
RUN npm ci

# Build the TypeScript code
RUN npm run build

# Create a JavaScript file at the root that redirects to the handler
# This fixes the "Cannot find module 'index'" error in Node 20+
RUN echo "module.exports = require('./dist/index.js');" > index.js

# Set the Lambda handler
CMD [ "index.handler" ]
