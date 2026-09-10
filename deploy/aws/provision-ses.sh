#!/usr/bin/env bash
# Provision AWS SES email via CloudFormation, then print the env vars for Render.
# Prereq: AWS CLI v2 + `aws configure`.
#
#   cd deploy/aws && ./provision-ses.sh
#   SENDER=you@example.in REGION=ap-south-1 ./provision-ses.sh
set -euo pipefail
cd "$(dirname "$0")"

STACK="${STACK:-mla-fms-ses}"
SENDER="${SENDER:-office.samarthsir@gmail.com}"
REGION="${REGION:-${AWS_REGION:-ap-south-1}}"

command -v aws >/dev/null || { echo "AWS CLI not found. Install: https://aws.amazon.com/cli/"; exit 1; }

echo "==> Deploying stack '$STACK' in $REGION (sender=$SENDER)"
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file ses-email.cfn.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides "SenderEmail=$SENDER" \
  --no-fail-on-empty-changeset

echo
echo "==> Set these in Render -> Environment (remove/ignore the SMTP_* vars):"
echo "-----------------------------------------------------------"
aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='EMAIL_PROVIDER'||OutputKey=='AWS_SES_REGION'||OutputKey=='EMAIL_FROM'||OutputKey=='SES_ACCESS_KEY_ID'||OutputKey=='SES_SECRET_ACCESS_KEY'].[OutputKey,OutputValue]" \
  --output text | while read -r k v; do echo "$k=$v"; done
echo "-----------------------------------------------------------"
echo
echo "!! One manual step: open the verification link SES emailed to $SENDER."
echo "   Check:  aws ses get-identity-verification-attributes --identities $SENDER --region $REGION"
echo "   Sandbox: request SES production access in the console to email non-verified addresses."
