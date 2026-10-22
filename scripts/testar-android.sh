#!/bin/bash
# Teste do APK num Android emulado (GitHub Actions): instala, abre, e pelo
# servidor que roda dentro do app conecta no emulador da WING, que roda na
# maquina do teste (para o Android emulado, ela e' o 10.0.2.2).
#   ./scripts/testar-android.sh "dist/Asa Edit 0.3.0.apk"
set -uo pipefail
APK="$1"
adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -n br.pedro.asaedit/.MainActivity
adb forward tcp:8730 tcp:8730
ok=0
# Os medidores vem por UDP da WING para o app; a rede do emulador nao deixa
# esse UDP entrar, entao aqui so o controle e' conferido.
node scripts/teste-fumaca.js 10.0.2.2 8730 --sem-medidores && ok=1
adb shell screencap -p /sdcard/tela.png && adb pull /sdcard/tela.png android-tela.png || true
if [ $ok != 1 ]; then
  # O app le o node.log da vez anterior ao abrir e repassa ao logcat.
  echo "--- abrindo de novo para ver o erro da primeira vez"
  adb shell am force-stop br.pedro.asaedit
  adb shell am start -n br.pedro.asaedit/.MainActivity
  sleep 8
fi
echo "--- logcat (Asa Edit e Node)"
adb logcat -d -s AsaNode:* AsaEdit:* AndroidRuntime:E DEBUG:* libc:F | tail -150
echo "--- falhas (pilha do crash)"
adb logcat -d -b crash | head -80
[ $ok = 1 ] || { echo "o APK nao funcionou"; exit 1; }
