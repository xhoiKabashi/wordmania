param(
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$ruleName = "FJALEMANIA LIVE (TCP $Port)"

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule already exists: $ruleName"
  exit 0
}

try {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $Port `
    -Action Allow `
    -Profile Private | Out-Null

  Write-Host "Added firewall rule: $ruleName (Private networks)."
  Write-Host "Open on your phone: http://<THIS-PC-IP>:$Port/?phone=1"
  Write-Host "The IP is printed when you run 'npm start'."
} catch {
  Write-Host ""
  Write-Host "Could not add the firewall rule." -ForegroundColor Yellow
  Write-Host "Run this from an Administrator PowerShell:"
  Write-Host "  npm run firewall"
  Write-Host ""
  Write-Host "Or allow Node.js on Private networks when Windows asks."
  exit 1
}
