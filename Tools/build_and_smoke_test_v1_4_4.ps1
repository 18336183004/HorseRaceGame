$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
Write-Host '[1/4] dotnet restore'
dotnet restore .\RaceGame.sln
Write-Host '[2/4] dotnet build Release'
dotnet build .\RaceGame.sln -c Release --no-restore
Write-Host '[3/4] starting API + Admin'
$api = Start-Process dotnet -ArgumentList 'run --project .\Server\RaceGame.Api\RaceGame.Api.csproj --no-build -c Release --urls https://localhost:55229;http://localhost:55230' -PassThru
$admin = Start-Process dotnet -ArgumentList 'run --project .\Server\RaceGame.Admin\RaceGame.Admin.csproj --no-build -c Release --urls https://localhost:55329;http://localhost:55330' -PassThru
try {
    Start-Sleep -Seconds 5
    Write-Host '[4/4] health smoke tests'
    $apiHealth = Invoke-RestMethod -SkipCertificateCheck -Uri 'https://localhost:55229/health'
    $adminHealth = Invoke-RestMethod -SkipCertificateCheck -Uri 'https://localhost:55329/health'
    if ($apiHealth.status -ne 'Healthy') { throw "API unhealthy: $($apiHealth | ConvertTo-Json -Depth 5)" }
    if ($adminHealth.status -ne 'Healthy') { throw "Admin unhealthy: $($adminHealth | ConvertTo-Json -Depth 5)" }
    Write-Host 'BUILD_AND_SMOKE_TEST_V1.4.4 PASS' -ForegroundColor Green
} finally {
    if ($api -and !$api.HasExited) { Stop-Process -Id $api.Id -Force }
    if ($admin -and !$admin.HasExited) { Stop-Process -Id $admin.Id -Force }
}
