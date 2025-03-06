FROM public.ecr.aws/lambda/nodejs:22

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

# Set the Lambda handler
CMD [ "index.handler" ]
