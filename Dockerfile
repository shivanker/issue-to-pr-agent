FROM public.ecr.aws/lambda/nodejs:22

# Install packages
RUN dnf install -y git tar gcc gcc-c++ make

# Create symbolic links for compilers that Aider's dependencies expect
RUN ln -sf /usr/bin/aarch64-amazon-linux-gcc /usr/bin/aarch64-linux-gnu-gcc
RUN ln -sf /usr/bin/aarch64-amazon-linux-g++ /usr/bin/aarch64-linux-gnu-g++

# Fool aider into installing in /opt/bin/.local/bin
RUN mkdir -p /opt/bin/.local/bin
ENV HOME="/opt/bin"
# Install Aider in a location accessible to Lambda execution user
RUN curl -LsSf https://aider.chat/install.sh | sh
# Move aider from root's directory to a location accessible by Lambda user
ENV PATH="/opt/bin/.local/bin:${PATH}"
ENV HOME="/root"


# Create app directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package.json package-lock.json ./

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY aider-config/ /opt/bin/

# Some other paths that aider uses
RUN mkdir -p /opt/bin/.aider
RUN touch /opt/bin/.env

# Make sure the whole installation dir is executable by all users
RUN chmod -R 777 /opt/bin/

# Install all dependencies (including dev)
RUN npm ci

# Build the TypeScript code
RUN npm run build

# Create a JavaScript file at the root that redirects to the handler
# This fixes the "Cannot find module 'index'" error in Node 20+
RUN echo "module.exports = require('./dist/index.js');" > index.js

# Set the Lambda handler
CMD [ "index.handler" ]
