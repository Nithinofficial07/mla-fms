#!/usr/bin/env bash
# =============================================================================
# Provision the S3 document-storage bucket + scoped IAM key via CloudFormation,
# then print the four lines to paste into deploy/.env.
#
# Prereqs: AWS CLI v2 configured with an admin-ish profile
#          (aws configure  OR  export AWS_PROFILE=... AWS_REGION=...)
#
# Usage:
#   ./provision-s3.sh                                   # defaults
#   BUCKET=mla-fms-docs-tn APP_ORIGIN=https://mla.tn.gov.in ./provision-s3.sh
#
# Re-running is safe: it updates the stack in place.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

STACK="${STACK:-mla-fms-storage}"
BUCKET="${BUCKET:-mla-fms-documents-prod}"
REGION="${REGION:-${AWS_REGION:-ap-south-1}}"
APP_ORIGIN="${APP_ORIGIN:-*}"

command -v aws >/dev/null || { echo "AWS CLI not found. Install: https://aws.amazon.com/cli/"; exit 1; }

echo "==> Deploying stack '$STACK' in $REGION"
echo "    bucket=$BUCKET  app-origin=$APP_ORIGIN"
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file s3-storage.cfn.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides "BucketName=$BUCKET" "AppOrigin=$APP_ORIGIN" \
  --no-fail-on-empty-changeset

echo
echo "==> Done. Add these to deploy/.env  (STORAGE_PROVIDER=s3):"
echo "-----------------------------------------------------------"
aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AWS_S3_BUCKET'||OutputKey=='AWS_REGION'||OutputKey=='AWS_ACCESS_KEY_ID'||OutputKey=='AWS_SECRET_ACCESS_KEY'].[OutputKey,OutputValue]" \
  --output text | while read -r k v; do echo "$k=$v"; done
echo "STORAGE_PROVIDER=s3"
echo "-----------------------------------------------------------"
echo "(The secret is also stored in the CloudFormation stack. Treat it as sensitive;"
echo " rotate later by deleting/recreating the stack's access key.)"
