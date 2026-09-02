# Run in a normal PowerShell (no admin needed) to see what's ready for a
# Docker Desktop deployment on this Windows machine.
#   powershell -ExecutionPolicy Bypass -File deploy\windows\check-prereqs.ps1

function line($n,$ok,$note){ "{0,-28} {1}  {2}" -f $n, ($(if($ok){'[ OK ]'}else{'[ !! ]'})), $note }

Write-Host "`n== MLA FMS deployment prerequisites ==`n"

# CPU virtualization
$virt = (Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled -contains $true `
        -or (Get-ComputerInfo -Property HyperVRequirementVirtualizationFirmwareEnabled -ErrorAction SilentlyContinue).HyperVRequirementVirtualizationFirmwareEnabled
line "CPU virtualization (BIOS)" $virt $(if($virt){""}else{"enable Intel VT-x / AMD-V in BIOS/UEFI"})

# WSL
$wsl = $false; try { wsl.exe --status 2>$null | Out-Null; $wsl = ($LASTEXITCODE -eq 0) } catch {}
line "WSL2" $wsl $(if($wsl){""}else{"run in ADMIN PowerShell:  wsl --install   then reboot"})

# Docker
$docker = $null; try { $docker = (docker version --format '{{.Server.Version}}' 2>$null) } catch {}
line "Docker Engine reachable" ([bool]$docker) $(if($docker){"v$docker"}else{"start Docker Desktop (after WSL2 + reboot)"})

# compose
$compose = $null; try { $compose = (docker compose version 2>$null) } catch {}
line "docker compose" ([bool]$compose) $compose

# AWS CLI (for the S3 CloudFormation step)
$aws = $null; try { $aws = (aws --version 2>&1) } catch {}
line "AWS CLI (for S3 setup)" ([bool]$aws) $(if($aws){$aws}else{"install: https://awscli.amazonaws.com/AWSCLIV2.msi  then: aws configure"})

# ports 80/443 free
foreach($p in 80,443){
  $used = (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue)
  line "TCP port $p free" (-not $used) $(if($used){"in use by PID $($used.OwningProcess -join ',') - free it or Caddy can't bind"}else{""})
}

# deploy/.env present
$envp = Join-Path $PSScriptRoot "..\.env"
line "deploy\.env exists" (Test-Path $envp) $(if(Test-Path $envp){""}else{"copy .env.production.example -> .env and fill it in"})

Write-Host "`nWhen all rows are [ OK ]:  cd deploy ;  docker compose -f docker-compose.prod.yml up -d --build`n"
