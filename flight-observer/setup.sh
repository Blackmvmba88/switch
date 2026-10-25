#!/bin/zsh
set -euo pipefail
SOURCE_DIR="${0:A:h}"
RUNTIME_DIR="$HOME/Flight-Observer"
mkdir -p "$RUNTIME_DIR/native" "$RUNTIME_DIR/tessdata"
if [[ "$SOURCE_DIR" != "$RUNTIME_DIR" ]]; then
  for name in mission_boundaries.py vision_observer.py live_worker.py summarize_session.py requirements.txt build.sh test_mission_boundaries.py test_vision_observer.py validate_vision.py report_watch.py; do
    cp "$SOURCE_DIR/$name" "$RUNTIME_DIR/$name"
  done
  cp "$SOURCE_DIR/native/FlightObserver.swift" "$RUNTIME_DIR/native/FlightObserver.swift"
  if [[ ! -f "$RUNTIME_DIR/vision-config.json" ]]; then
    cp "$SOURCE_DIR/vision-config.json" "$RUNTIME_DIR/vision-config.json"
  fi
fi
command -v swiftc >/dev/null
command -v tesseract >/dev/null || { print 'Instala Tesseract con brew install tesseract'; exit 1; }
python3 -m venv "$RUNTIME_DIR/.venv"
"$RUNTIME_DIR/.venv/bin/pip" install -r "$SOURCE_DIR/requirements.txt"
cp "$(brew --prefix)/share/tessdata/eng.traineddata" "$RUNTIME_DIR/tessdata/eng.traineddata"
if [[ ! -f "$RUNTIME_DIR/tessdata/spa.traineddata" ]]; then
  curl -fL https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/spa.traineddata -o "$RUNTIME_DIR/tessdata/spa.traineddata"
fi
MODEL_HASH="$(shasum -a 256 "$RUNTIME_DIR/tessdata/spa.traineddata")"
[[ "$MODEL_HASH" == 6f2e04d02774a18f01bed44b1111f2cd7f3ba7ac9dc4373cd3f898a40ea6b464* ]] || { print 'El modelo español no coincide con el validado'; exit 1; }
zsh "$RUNTIME_DIR/build.sh"
print "Candidato preparado en $RUNTIME_DIR/.build/Flight Observer.app"
print 'No se reemplaza una app instalada ni se reinicia la sesión en curso.'
