#!/bin/bash
# Monta o Asa Edit.app e o .dmg (Apple Silicon), sem empacotador: copia o
# Electron.app, poe o codigo do Asa dentro, troca nome e icone, assina em modo
# ad-hoc e monta a imagem. O mesmo caminho da Mesa de Playback (scripts/
# montar-app.sh de la), que funciona no Mac do Pedro e no GitHub Actions.
# Rode depois de `npm run build:ui`. So funciona no macOS.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
NOME="Asa Edit"
VERSAO="$(node -p "require('$RAIZ/package.json').version")"
ID="br.pedro.asaedit"

test -f "$RAIZ/app/ui-dist/index.html" || { echo "Falta a interface: rode npm run build:ui"; exit 1; }
test -f "$RAIZ/build/icon.icns" || { echo "Falta build/icon.icns: rode python3 scripts/fazer-icone.py"; exit 1; }

# Montar fora do projeto: no Desktop o iCloud gruda atributos no bundle e o
# codesign recusa.
OFICINA="$(mktemp -d)"
trap 'rm -rf "$OFICINA"' EXIT
SAIDA="$RAIZ/dist"
MONTAGEM="$OFICINA/montagem/$NOME.app"
APP="$OFICINA/$NOME.app"
COPIAR="ditto --norsrc --noextattr --noacl"

rm -rf "$SAIDA"
mkdir -p "$SAIDA" "$OFICINA/montagem"

echo "1/7  copiando o Electron"
$COPIAR "$RAIZ/node_modules/electron/dist/Electron.app" "$MONTAGEM"

echo "2/7  colocando o codigo do Asa"
REC="$MONTAGEM/Contents/Resources/app"
mkdir -p "$REC/app"
$COPIAR "$RAIZ/app/main" "$REC/app/main"
$COPIAR "$RAIZ/app/ui-dist" "$REC/app/ui-dist"
# package.json enxuto: so o que o Electron le (nome, versao, main).
node -e "
const p = require('$RAIZ/package.json');
const fora = { name: p.name, productName: 'Asa Edit', version: p.version, description: p.description, author: p.author, license: p.license, main: p.main };
require('fs').writeFileSync('$REC/package.json', JSON.stringify(fora, null, 2));
"
# A unica dependencia de producao: o ws.
$COPIAR "$RAIZ/node_modules/ws" "$REC/node_modules/ws"

echo "3/7  icone e nome do executavel"
$COPIAR "$RAIZ/build/icon.icns" "$MONTAGEM/Contents/Resources/electron.icns"
mv "$MONTAGEM/Contents/MacOS/Electron" "$MONTAGEM/Contents/MacOS/$NOME"

echo "4/7  ajustando o Info.plist"
PLIST="$MONTAGEM/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName $NOME" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $NOME" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable $NOME" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $ID" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSAO" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSAO" "$PLIST"
# Pedido de rede local (macOS 15+): o Asa procura a mesa e recebe medidores.
/usr/libexec/PlistBuddy -c "Add :NSLocalNetworkUsageDescription string 'O Asa Edit conversa com a mesa WING e com os celulares dos músicos pela rede.'" "$PLIST" 2>/dev/null || true

echo "5/7  copia limpa do bundle"
find "$MONTAGEM" -name ".DS_Store" -delete
$COPIAR "$MONTAGEM" "$APP"
rm -rf "$OFICINA/montagem"

echo "6/7  assinando em modo ad-hoc"
# Sem conta da Apple nao da para assinar de verdade, mas arm64 sem assinatura
# nenhuma nem abre ("danificado"). De dentro para fora, sem --deep.
assinar() {
  xattr -d com.apple.FinderInfo "$1" 2>/dev/null || true
  codesign --force --sign - "$1" 2>&1 | grep -v "replacing existing signature" || true
}
while IFS= read -r -d '' lib; do assinar "$lib"; done < <(
  find "$APP/Contents/Frameworks" -type f \( -name "*.dylib" -o -name "*.node" \) -print0
)
for h in "$APP/Contents/Frameworks/"*.app; do [ -e "$h" ] && assinar "$h"; done
for f in "$APP/Contents/Frameworks/"*.framework; do [ -e "$f" ] && assinar "$f/Versions/A"; done
assinar "$APP"
codesign --verify --strict "$APP"
echo "     assinatura ok"

echo "7/7  montando o .dmg"
STAGE="$(mktemp -d)"
$COPIAR "$APP" "$STAGE/$NOME.app"
ln -s /Applications "$STAGE/Applications"
DMG="$SAIDA/Asa Edit $VERSAO.dmg"
hdiutil create -volname "$NOME" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"
echo
echo "pronto: $DMG  ($(du -h "$DMG" | cut -f1))"
