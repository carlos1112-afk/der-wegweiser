#!/usr/bin/env bash
# Tauscht ein GitHub-OIDC-Token (Datei) gegen ein kurzlebiges Anthropic-Zugriffstoken
# (Workload Identity Federation) und prüft nur, ob der Austausch gelingt.
# Das Token wird NIE ausgegeben. Exit: 0 = Austausch ok, 1 = abgelehnt/ungültig, 2 = Konfiguration fehlt.
set -uo pipefail

url="${ANTHROPIC_OAUTH_URL:-https://api.anthropic.com/v1/oauth/token}"
jwt_file="${ANTHROPIC_IDENTITY_TOKEN_FILE:-}"

missing=0
for name in ANTHROPIC_IDENTITY_TOKEN_FILE ANTHROPIC_FEDERATION_RULE_ID ANTHROPIC_ORGANIZATION_ID ANTHROPIC_SERVICE_ACCOUNT_ID; do
  if [ -z "${!name:-}" ]; then
    echo "::error::Variable $name fehlt (nur der Name wird genannt)." >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 2

if [ ! -s "$jwt_file" ]; then
  echo "::error::OIDC-Token-Datei fehlt oder ist leer." >&2
  exit 2
fi

body=$(jq -n \
  --arg assertion "$(cat "$jwt_file")" \
  --arg rule "$ANTHROPIC_FEDERATION_RULE_ID" \
  --arg org "$ANTHROPIC_ORGANIZATION_ID" \
  --arg sa "$ANTHROPIC_SERVICE_ACCOUNT_ID" \
  --arg ws "${ANTHROPIC_WORKSPACE_ID:-}" \
  '{grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer", assertion:$assertion,
    federation_rule_id:$rule, organization_id:$org, service_account_id:$sa}
   + (if $ws != "" then {workspace_id:$ws} else {} end)')

resp=$(mktemp)
trap 'rm -f "$resp"' EXIT

code=$(curl -sS -o "$resp" -w '%{http_code}' -H 'content-type: application/json' --data "$body" "$url") || {
  echo "::error::Anthropic-Endpunkt nicht erreichbar." >&2
  exit 1
}

if [ "$code" != "200" ]; then
  echo "::error::Austausch abgelehnt (HTTP $code). Grund steht in der Console unter Authentication history." >&2
  exit 1
fi

token=$(jq -r '.access_token // empty' "$resp")
case "$token" in
  sk-ant-oat01-*) echo "OK: Austausch erfolgreich, kurzlebiges Anthropic-Token erhalten (Wert nicht ausgegeben)." ;;
  *) echo "::error::Antwort enthält kein gültiges Zugriffstoken." >&2; exit 1 ;;
esac
