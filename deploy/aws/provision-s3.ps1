<#
  Provision the S3 document-storage bucket + scoped IAM key via CloudFormation,
  then print the values for deploy\.env.  Windows / PowerShell version of
  provision-s3.sh.

  Prereqs: AWS CLI v2 installed and `aws configure` done (admin-ish key).

  Usage (from a fresh PowerShell):
    cd C:\Users\91948\Desktop\OFFICE_APP\deploy\aws
    .\provision-s3.ps1 -Domain https://mlaoffice.example.in
    .\provision-s3.ps1 -Bucket mla-fms-docs-tn -Region ap-south-1 -Domain https://mla.tn.gov.in
#>
[CmdletBinding()]
param(
  [string]$Stack  = "mla-fms-storage",
  [string]$Bucket = "mla-fms-documents-prod",
  [string]$Region = "ap-south-1",
  [string]$Domain = "*"          # your app origin, e.g. https://mlaoffice.example.in
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# find aws.exe even if PATH isn't refreshed in this session
$aws = (Get-Command aws -ErrorAction SilentlyContinue).Source
if (-not $aws) { $aws = "$env:ProgramFiles\Amazon\AWSCLIV2\aws.exe" }
if (-not (Test-Path $aws)) { throw "AWS CLI not found. Install it and run 'aws configure' first." }

Write-Host "==> Deploying stack '$Stack' in $Region  (bucket=$Bucket  origin=$Domain)" -ForegroundColor Cyan
& $aws cloudformation deploy `
  --region $Region `
  --stack-name $Stack `
  --template-file s3-storage.cfn.yaml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides "BucketName=$Bucket" "AppOrigin=$Domain" `
  --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) { throw "cloudformation deploy failed" }

Write-Host "`n==> Add these lines to deploy\.env :" -ForegroundColor Green
Write-Host "-----------------------------------------------------------"
"STORAGE_PROVIDER=s3"
$outs = & $aws cloudformation describe-stacks --region $Region --stack-name $Stack `
  --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
foreach ($o in $outs) {
  if ($o.OutputKey -in @("AWS_S3_BUCKET","AWS_REGION","AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY")) {
    "{0}={1}" -f $o.OutputKey, $o.OutputValue
  }
}
Write-Host "-----------------------------------------------------------"
Write-Host "(The secret is also stored in the CloudFormation stack outputs - treat as sensitive.)" -ForegroundColor DarkYellow
