# syntax=docker/dockerfile:1
FROM node:22-slim AS base

# install necessary tools
FROM base AS tools
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        git \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps the function bootstrap relies on system-wide so that
# per-function ``pip install --target`` calls don't have to re-fetch them. The
# ``--break-system-packages`` flag is required on PEP-668-managed bases.
RUN python3 -m pip install --no-cache-dir --break-system-packages \
        grpcio \
        grpcio-tools \
        protobuf


FROM tools AS runner
WORKDIR /app
COPY dist .
RUN yarn install --production --network-timeout 600000
ENV DEFAULT_PASSWORD=spica
ENV FUNCTION_GRPC_ADDRESS=0.0.0.0:5688
ENV FUNCTION_PYTHON_BOOTSTRAP_PATH=/app/packages/api/function/runtime/python/dist/bootstrap/main.py
ENV FUNCTION_PYTHON_EXECUTABLE=python3
ENTRYPOINT ["node","src/main.js"]