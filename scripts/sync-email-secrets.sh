#!/bin/zsh
# Sync email-related env values from .dev.vars to production wrangler secrets.
# Values are piped directly — never echoed to the terminal.
set -euo pipefail
cd "$(dirname "$0")/.."

KEYS=(EMAIL_BRAND_NAME EMAIL_FROM EMAIL_REPLY_TO EMAIL_SUPPORT RESEND_API_KEY)

for KEY in $KEYS; do
  VALUE=$(grep -E "^${KEY}=" .dev.vars | head -1 | cut -d= -f2-)
  VALUE=${VALUE#\"}
  VALUE=${VALUE%\"}
  if [ -n "$VALUE" ]; then
    printf '%s' "$VALUE" | npx wrangler secret put "$KEY" >/tmp/secret-put.log 2>&1
    if grep -qE "(Success! Uploaded|Success! Created)" /tmp/secret-put.log; then
      echo "-> $KEY set on production"
    else
      echo "-> $KEY FAILED:"
      tail -3 /tmp/secret-put.log
      exit 1
    fi
  else
    echo "-> $KEY missing in .dev.vars, skipped"
  fi
done
