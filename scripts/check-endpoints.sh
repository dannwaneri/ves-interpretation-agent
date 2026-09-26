#!/usr/bin/env bash
# Checks which MCP tools each endpoint serves. Run this after both endpoints
# exist and their URLs are filled in in .env.
#
#   scripts/check-endpoints.sh
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source .env
set +a

check() {
  local label="$1" var_name="$2" url="$3"
  echo "== $label ($var_name) =="
  if [ -z "$url" ]; then
    echo "  not set in .env"
    echo
    return
  fi
  local body
  body=$(curl -s -X POST "$url" \
    -H "Authorization: Bearer $SANITY_CONTEXT_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}')
  local names
  names=$(echo "$body" | grep -o '"name":"[a-zA-Z_]*"' | sed 's/"name":"//;s/"$//' | sort -u)
  if [ -z "$names" ]; then
    echo "  no tool names found in response:"
    echo "  $body"
  else
    echo "$names" | sed 's/^/  - /'
  fi
  echo
}

check "Knowledge Base endpoint" "SANITY_MCP_URL" "${SANITY_MCP_URL:-}"
check "GROQ / dataset endpoint" "SANITY_GROQ_MCP_URL" "${SANITY_GROQ_MCP_URL:-}"

echo "Expected on the KB endpoint:   initial_context, knowledge_base_read"
echo "Expected on the GROQ endpoint: initial_context, schema_explorer, groq_query, array_field_reader"
