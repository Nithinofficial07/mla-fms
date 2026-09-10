<#
  Provision AWS SES email for the MLA File Management System via CloudFormation,
  then print the env vars for Render.

  Prereq: AWS CLI v2 + `aws configure` with an admin-ish key.

  Usage (fresh PowerShell):
    cd C:\Users\91948\Desktop\OFFICE_APP\deploy\aws
    .\provision-ses.ps1                                   # defaults
    .\provision-ses.ps1 -Sender you@example.in -Region ap-south-1

  Re-running is safe (updates the stack in place).
#>
[CmdletBinding()]
param(
  [string]$Stack  = "mla-fms-ses",
  [string]$Sender = "office.samarthsir@gmail.com",
  [string]$Region = "ap-south-1"
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$aws = (Get-Command aws -ErrorAction SilentlyContinue).Source
if (-not $aws) { $aws = "$env:ProgramFiles\Amazon\AWSCLIV2\aws.exe" }
if (-not (Test-Path $aws)) { throw "AWS CLI not found. Install it and run 'aws configure' first." }

Write-Host "==> Deploying stack '$Stack' in $Region  (sender=$Sender)" -ForegroundColor Cyan
& $aws cloudformation deploy `
  --region $Region `
  --stack-name $Stack `
  --template-file ses-email.cfn.yaml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides "SenderEmail=$Sender" `
  --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) { throw "cloudformation deploy failed" }

Write-Host "`n==> Set these in Render -> Environment  (then remove/ignore the SMTP_* vars):" -ForegroundColor Green
Write-Host "-----------------------------------------------------------"
$outs = & $aws cloudformation describe-stacks --region $Region --stack-name $Stack `
  --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
foreach ($k in "EMAIL_PROVIDER","AWS_SES_REGION","EMAIL_FROM","SES_ACCESS_KEY_ID","SES_SECRET_ACCESS_KEY") {
  $o = $outs | Where-Object OutputKey -eq $k
  if ($o) { "{0}={1}" -f $k, $o.OutputValue }
}
Write-Host "-----------------------------------------------------------"
Write-Host "`n!! One manual step: open the verification link SES just emailed to $Sender." -ForegroundColor Yellow
Write-Host "   Check status:  aws ses get-identity-verification-attributes --identities $Sender --region $Region"
Write-Host "   Sandbox: to email anyone other than verified addresses, request production access in the SES console."
