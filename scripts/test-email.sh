#!/bin/zsh
# One-off: verify the Resend pipeline (API key + verified FROM domain) by
# sending a single test email to EMAIL_SUPPORT. Values are never echoed.
set -euo pipefail
cd "$(dirname "$0")/.."

KEY=$(grep -E "^RESEND_API_KEY=" .dev.vars | head -1 | cut -d= -f2-)
KEY=${KEY#\"}
KEY=${KEY%\"}
FROM=$(grep -E "^EMAIL_FROM=" .dev.vars | head -1 | cut -d= -f2-)
FROM=${FROM#\"}
FROM=${FROM%\"}
TO=$(grep -E "^EMAIL_SUPPORT=" .dev.vars | head -1 | cut -d= -f2-)
TO=${TO#\"}
TO=${TO%\"}

BODY=$(python3 - "$FROM" "$TO" <<'PY'
import json, sys
payload = {
    "from": sys.argv[1],
    "to": [sys.argv[2]],
    "subject": "TapMe — email pipeline test",
    "html": "<p>Email pipeline test after go-live env sync. You can delete this email.</p>",
}
print(json.dumps(payload))
PY
)

RESP=$(curl -s -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY")

echo "$RESP" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if d.get("id"):
    print("EMAIL SENT OK (resend id present)")
else:
    print("RESEND ERROR:", json.dumps(d)[:300])
'
