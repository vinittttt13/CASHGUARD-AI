# PowerShell Setup & Verification Script for CashGuard-AI Dockerized MCP Server
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CashGuard-AI: Setup Dockerized MCP Server (Approach 1) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Docker Engine
Write-Host "`n[1/3] Checking Docker daemon status..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host " Docker detected: $dockerVersion" -ForegroundColor Green
    docker ps | Out-Null
} catch {
    Write-Error "Docker is not running or not found in PATH. Please start Docker Desktop and retry."
    exit 1
}

# 2. Build MCP Image
Write-Host "`n[2/3] Building cashguard-mcp:latest Docker image..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = Split-Path -Parent $scriptDir
$mcpDir = Join-Path $rootDir "mcp"

docker build -t cashguard-mcp:latest -f (Join-Path $mcpDir "Dockerfile") $mcpDir
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed. Check Dockerfile and requirements.txt."
    exit 1
}
Write-Host " Docker image 'cashguard-mcp:latest' built successfully." -ForegroundColor Green

# 3. Test Container Execution
Write-Host "`n[3/3] Testing container environment..." -ForegroundColor Yellow
$testOutput = docker run --rm --entrypoint python cashguard-mcp:latest -c "import mcp, psycopg2, redis; print('All core MCP packages loaded successfully.')"
if ($LASTEXITCODE -eq 0) {
    Write-Host " Container self-test passed: $testOutput" -ForegroundColor Green
} else {
    Write-Warning " Container test encountered a problem."
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Setup Complete! Shared configs are active at:" -ForegroundColor Green
Write-Host "   - .agents/plugins/cashguard-mcp/mcp_config.json" -ForegroundColor Gray
Write-Host "   - .agents/mcp_config.json" -ForegroundColor Gray
Write-Host "   - .vscode/mcp.json" -ForegroundColor Gray
Write-Host "   - .cursor/mcp.json" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
