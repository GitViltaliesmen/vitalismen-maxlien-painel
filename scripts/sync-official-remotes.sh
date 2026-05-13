#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-codex-vitpower-unified-front}"
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/vps_auditoria_codex}"

git push origin "$BRANCH"
GIT_SSH_COMMAND="ssh -i $VPS_SSH_KEY" git push vps "$BRANCH"

echo "OK: sincronizado em origin e vps: $BRANCH"
