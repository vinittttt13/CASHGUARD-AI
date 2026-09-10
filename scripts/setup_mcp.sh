#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "   CashGuard-AI: Setup Dockerized MCP Server (Approach 1) "
echo "=========================================================="

# 1. Verify Docker Engine
echo -e "\n[1/3] Checking Docker daemon status..."
if ! command -v docker &> /dev/null; then
    echo "Error: Docker command not found. Please install Docker." >&2
    exit 1
fi

docker ps > /dev/null 2>&1 || {
    echo "Error: Docker daemon is not accessible or running." >&2
    exit 1
}
echo " Docker is operational."

# 2. Build MCP Image
echo -e "\n[2/3] Building cashguard-mcp:latest Docker image..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MCP_DIR="$ROOT_DIR/mcp"

docker build -t cashguard-mcp:latest -f "$MCP_DIR/Dockerfile" "$MCP_DIR"
echo " Docker image 'cashguard-mcp:latest' built successfully."

# 3. Test Container Execution
echo -e "\n[3/3] Testing container environment..."
docker run --rm --entrypoint python cashguard-mcp:latest -c "import mcp, psycopg2, redis; print('All core MCP packages loaded successfully.')"

echo -e "\n=========================================================="
echo " Setup Complete! Shared configs are active at:"
echo "   - .agents/plugins/cashguard-mcp/mcp_config.json"
echo "   - .agents/mcp_config.json"
echo "   - .vscode/mcp.json"
echo "   - .cursor/mcp.json"
echo "=========================================================="
