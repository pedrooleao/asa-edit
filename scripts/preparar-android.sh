#!/bin/bash
# Prepara o projeto Android para montar o APK:
#   1. o "projeto Node" que vai dentro do APK: o servidor do Asa Edit
#      (app/main), a interface montada (app/ui-dist) e o ws;
#   2. o Node.js para Android (nodejs-mobile): libnode.so por arquitetura e os
#      cabecalhos, em android/app/libnode/.
# Rode depois de `npm run build:ui`. Precisa do `gh` (no GitHub Actions ja vem)
# ou de NODEJS_MOBILE_ZIP apontando para o .zip ja baixado.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$RAIZ/android/app"
test -f "$RAIZ/app/ui-dist/index.html" || { echo "Falta a interface: rode npm run build:ui"; exit 1; }

echo "1/2  projeto Node dentro do APK"
PROJ="$ANDROID/src/main/assets/nodejs-project"
rm -rf "$PROJ"
mkdir -p "$PROJ/app/main" "$PROJ/node_modules"
for f in servidor.js wing.js esquema.js snap.js esquema.json.gz; do cp "$RAIZ/app/main/$f" "$PROJ/app/main/"; done
cp -R "$RAIZ/app/ui-dist" "$PROJ/app/ui-dist"
cp -R "$RAIZ/node_modules/ws" "$PROJ/node_modules/ws"
node -e "
const p = require('$RAIZ/package.json');
require('fs').writeFileSync('$PROJ/package.json', JSON.stringify({ name: p.name, version: p.version, main: 'app/main/servidor.js' }, null, 2));
"
du -sh "$PROJ"

echo "2/2  Node.js para Android (nodejs-mobile)"
if [ -d "$ANDROID/libnode/bin" ] && [ -f "$ANDROID/libnode/include/node/node.h" ]; then
  echo "     ja esta em android/app/libnode"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ZIP="${NODEJS_MOBILE_ZIP:-}"
if [ -z "$ZIP" ]; then
  gh release download --repo nodejs-mobile/nodejs-mobile --pattern '*android*.zip' --dir "$TMP"
  ZIP="$(ls "$TMP"/*android*.zip | head -1)"
fi
echo "     $(basename "$ZIP")"
unzip -q "$ZIP" -d "$TMP/nm"
NODE_H="$(find "$TMP/nm" -name node.h -path '*include*' | head -1)"
test -n "$NODE_H" || { echo "node.h nao achado no zip"; exit 1; }
rm -rf "$ANDROID/libnode"
mkdir -p "$ANDROID/libnode/include" "$ANDROID/libnode/bin"
cp -R "$(dirname "$NODE_H")" "$ANDROID/libnode/include/node"
while IFS= read -r so; do
  abi="$(basename "$(dirname "$so")")"
  mkdir -p "$ANDROID/libnode/bin/$abi"
  cp "$so" "$ANDROID/libnode/bin/$abi/"
  echo "     $abi"
done < <(find "$TMP/nm" -name libnode.so)
