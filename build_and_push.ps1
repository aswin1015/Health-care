<#
.SYNOPSIS
    Build and push all Aegis Health Docker images to Azure Container Registry.
.USAGE
    .\build_and_push.ps1 -AcrName "aegisacr1234"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AcrName
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

function Write-Step($msg) { Write-Host "`n🔷 $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  ✅ $msg" -ForegroundColor Green }

Write-Step "Logging into ACR: $AcrName"
az acr login --name $AcrName
$ACR_SERVER = (az acr show --name $AcrName --query loginServer -o tsv)
Write-OK "ACR Server: $ACR_SERVER"

$IMAGES = @(
    # (Name, BuildContext, Dockerfile)
    @("api-gateway",              ".",                                    "services/api-gateway/Dockerfile"),
    @("health-records-service",   ".",                                    "services/health-records-service/Dockerfile"),
    @("medication-service",       ".",                                    "services/medication-service/Dockerfile"),
    @("ai-service",               ".",                                    "services/ai-service/Dockerfile"),
    @("notification-worker",      ".",                                    "services/notification-worker/Dockerfile"),
    @("imaging-service",          "services/imaging-service",             "services/imaging-service/Dockerfile"),
    @("diagnostic-agent-service", "services/diagnostic-agent-service",   "services/diagnostic-agent-service/Dockerfile"),
    @("client",                   ".",                                    "client/Dockerfile")
)

foreach ($img in $IMAGES) {
    $name = $img[0]; $ctx = $img[1]; $df = $img[2]
    $tag  = "$ACR_SERVER/${name}:latest"
    Write-Step "[$name] Building..."
    docker build -t $tag -f (Join-Path $ROOT $df) (Join-Path $ROOT $ctx)
    Write-Step "[$name] Pushing to ACR..."
    docker push $tag
    Write-OK "$name → $tag"
}

Write-Host "`n🎉 All images pushed to $ACR_SERVER" -ForegroundColor Green
