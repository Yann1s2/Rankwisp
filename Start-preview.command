#!/bin/zsh
set -eu
cd "${0:A:h}/app"
if ! command -v node >/dev/null; then
  echo 'Node.js 22.20+ is required. Install Node.js, then run this launcher again.'
  read -r reply
  exit 1
fi
if curl -fsS http://127.0.0.1:4318/api/health 2>/dev/null | /usr/bin/grep -q Rankwisp; then
  open http://127.0.0.1:4318/de/
  exit 0
fi
if [[ ! -d node_modules ]]; then npm ci --no-audit --no-fund; fi
if [[ ! -d dist ]]; then npm run build; fi
open http://127.0.0.1:4318/de/
exec npm run server
