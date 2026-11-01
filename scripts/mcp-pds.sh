#!/usr/bin/env bash
# Avvia il server MCP `pds` anche da client che non caricano la shell dell'utente
# (OpenChamber, app grafiche): trova Node 22 e pnpm, carica il .env, poi parte.
# Lo stdout è il canale del protocollo: qui non si stampa niente.
set -e
cd "$(dirname "$0")/.."

# Token e variabili del progetto (stesso .env di direnv), se il client non le ha passate.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# Node/pnpm: se pnpm non è già nel PATH prova i gestori di versione più comuni.
if ! command -v pnpm >/dev/null 2>&1; then
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1
    nvm use >/dev/null 2>&1 || true
  fi
fi
if ! command -v pnpm >/dev/null 2>&1 && command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)" >/dev/null 2>&1
  fnm use >/dev/null 2>&1 || true
fi
export PATH="$HOME/.volta/bin:$HOME/.local/share/pnpm:$PATH"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pds: pnpm non trovato (serve Node 22 e pnpm, vedi README)" >&2
  exit 1
fi

exec pnpm --silent --filter @penpot-ds/scripts pds
