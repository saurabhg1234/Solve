# Source from the repository root in a fresh scheduled agent session: `. scripts/dispatcher_env.sh`
# Non-secret defaults only. Secrets (ZORA_RUNNER_TOKEN, CRON_SECRET, ZORA_NOTIFICATION_BYPASS, VERCEL_TOKEN)
# come from the cloud environment's secure bindings and are never written here or printed.
export ZORA_APP_URL="${ZORA_APP_URL:-https://zora-mindmap.vercel.app}"
export VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-prj_CMo2oudsZpGIt0JiuYLjV5mPjcyA}"
export VERCEL_ORG_ID="${VERCEL_ORG_ID:-team_5DBsUWiufrEcP2odn32rtSJD}"
export ZORA_WORKER_ID="${ZORA_WORKER_ID:-zora-claude-dispatcher}"
export NODE_USE_ENV_PROXY=1
[ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null 2>&1 || echo "npm ci failed" >&2

# Document toolchain, installed only when a claimed stage needs prepare/build commands: `zora_document_tools`
zora_document_tools() {
  [ -x .zora/venv/bin/python ] || { python3 -m venv .zora/venv && .zora/venv/bin/python -m pip install -q \
    pypdf==6.10.0 python-docx==1.2.0 python-pptx==1.0.2 Pillow==12.3.0 PyMuPDF==1.26.6 lxml==6.1.1 \
    typing_extensions==4.16.0 XlsxWriter==3.2.9; }
  export ZORA_DOCUMENT_PYTHON="$PWD/.zora/venv/bin/python"
}

# Renew a claimed lease every 90 s while the agent reasons between commands (lease lasts 5 min).
# `zora_keepalive <workspace>` starts it; `zora_keepalive_stop` ends it after completion.
zora_keepalive() {
  ( while npm run -s routine -- heartbeat "$1" >/dev/null 2>&1; do sleep 90; done ) </dev/null >/dev/null 2>&1 &
  echo $! > .zora/keepalive.pid
}
zora_keepalive_stop() { [ -f .zora/keepalive.pid ] && kill "$(cat .zora/keepalive.pid)" 2>/dev/null; rm -f .zora/keepalive.pid; }
