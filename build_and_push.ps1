param (
    [string]$Version = (Get-Date -Format "yyyyMMdd-HHmmss")
)

$acrUrl = "insurancecr.azurecr.io"
Write-Host "Building and pushing images with tag: $Version"

Write-Host "Building health-records-service..."
docker build -t $acrUrl/aegis-health-records:$Version -f ./services/health-records-service/Dockerfile ./services/health-records-service
Write-Host "Pushing health-records-service..."
docker push $acrUrl/aegis-health-records:$Version

Write-Host "Building medication-service..."
docker build -t $acrUrl/aegis-medication:$Version -f ./services/medication-service/Dockerfile ./services/medication-service
Write-Host "Pushing medication-service..."
docker push $acrUrl/aegis-medication:$Version

Write-Host "Building api-gateway..."
docker build -t $acrUrl/aegis-api-gateway:$Version -f ./services/api-gateway/Dockerfile .
Write-Host "Pushing api-gateway..."
docker push $acrUrl/aegis-api-gateway:$Version

Write-Host "Building ai-service..."
docker build -t $acrUrl/aegis-ai:$Version -f ./services/ai-service/Dockerfile ./services/ai-service
Write-Host "Pushing ai-service..."
docker push $acrUrl/aegis-ai:$Version

Write-Host "Building notification-worker..."
docker build -t $acrUrl/aegis-notification-worker:$Version -f ./services/notification-worker/Dockerfile ./services/notification-worker
Write-Host "Pushing notification-worker..."
docker push $acrUrl/aegis-notification-worker:$Version

Write-Host "Building client..."
docker build -t $acrUrl/aegis-client:$Version -f ./client/Dockerfile .
Write-Host "Pushing client..."
docker push $acrUrl/aegis-client:$Version

Write-Host "All images built and pushed successfully with tag: $Version"
