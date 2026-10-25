# Flight Observer para Xbox Cloud Gaming

Observador local de solo lectura para macOS. Registra el mando mediante GameController, captura exclusivamente la ventana de Chrome cuyo título identifica Xbox/Flight Simulator y procesa las imágenes con OpenCV y Tesseract en español e inglés. No modifica el mando, el navegador ni el simulador.

## Estado comprobado

- App de barra de menús compilada y firma verificada en macOS 26.3.1.
- Lectura real del mando Xbox One, incluidos sticks y gatillos.
- Captura y OCR reales de la misión Bryce Canyon / Airbus H125.
- Menú real de pausa reconocido sin interpretar el botón «Finalizar vuelo» como fin ya ocurrido.
- Objetivo visible de misión activa reconocido mediante una firma configurada.
- Pruebas unitarias y una secuencia de video sintético completa: inicio observado, pausa, reanudación y final.

La pantalla terminal de una misión real todavía no está validada. El inicio exacto no se certifica si la observación comenzó con el vuelo en marcha. No se ha implementado aprendizaje ni reproducción del vuelo.

## Preparación

Requiere Python 3.14, herramientas de desarrollo de Apple y Tesseract (`brew install tesseract`). Las dependencias Python están fijadas en `requirements.txt`.

```sh
./setup.sh
```

El instalador prepara el entorno y un candidato en `~/Flight-Observer/.build/Flight Observer.app`. No sustituye una instalación ni interrumpe un observador activo. El build de Swift también puede ejecutarse con `./build.sh`.

La aplicación instalada se conserva en `~/Applications/Flight Observer.app`. macOS debe concederle Grabación de pantalla. No necesita micrófono, audio, Accessibility ni una extensión de Chrome. La firma actual es ad hoc: una recompilación puede exigir volver a autorizarla. No se promete continuidad de permisos entre builds sin una identidad de firma estable.

## Operación

La barra de menús ofrece pausa de observación, acceso a registros y parada. Por defecto la app espera una sola ventana Xbox identificable; si no existe o hay varias candidatas, no captura otra ventana. Si deja de verse el título Xbox al cambiar de pestaña, espera su regreso.

Cada ejecución crea `~/Flight-Observer/sessions/<UUID>/` con:

- `inputs.jsonl`: cambios de entrada y latidos; consulta el mando a 60 Hz. Ejes con convención de Apple GameController, Y positiva hacia arriba.
- `frames/`: imágenes a aproximadamente 1 Hz y metadatos escritos al finalizar cada captura. Cada imagen lleva una instantánea del mando y tiempos del mismo equipo.
- `observations.jsonl`: texto OCR, clasificación heurística y referencias a la evidencia.
- `mission-events.jsonl`: misión observada, interrupciones, reanudaciones y pantalla terminal observada, cuando se reconoce.
- `vision-status.json`: estado de OCR y calibración.

`~/Flight-Observer/status.json` distingue permiso de pantalla, mando conectado, contador de imágenes y errores. Los errores de captura se reintentan sin solicitar permisos repetidamente. La captura se detiene al llegar a 10000 imágenes por ejecución; el mando continúa registrado. Los registros e imágenes permanecen en el equipo y no se incluyen en Git.

## Calibración y límites

`~/Flight-Observer/vision-config.json` permite configurar `active_cues` con texto observado exclusivamente durante una misión activa. La lista inicial está vacía. El HUD observado del H125 se reconoce cuando combina «Pasos de la misión» y al menos dos indicadores entre AIRSPEED, ALTITUDE y POWER; otros perfiles requieren calibración. Un botón de inicio no demuestra que el piloto ya tenga control. Las señales de pausa y desconexión tienen prioridad.

Las marcas de inicio y final requieren dos observaciones compatibles separadas entre uno y cinco segundos. La hora registrada es la primera observación, no una medición exacta del cambio del simulador. La primera observación activa puede corresponder a una misión ya empezada. Los huecos, el OCR desconocido y la carga interrumpen la observación; no concluyen una misión. Un final requiere texto terminal reconocido, nunca soltar el mando o aterrizar por deducción.

El texto en pantalla es una heurística; la evidencia visual permite revisar los resultados. Sin telemetría no se certifican altitud, trayectoria ni control físico del helicóptero. No se añade suavizado ni estabilización.

## Validación y revisión

```sh
cd ~/Flight-Observer
.venv/bin/python -m unittest test_mission_boundaries.py test_vision_observer.py
.venv/bin/python validate_vision.py
.venv/bin/python summarize_session.py /ruta/a/sesion
```

El último comando produce `summary.json` y `report.html` con contadores, rangos de ejes y enlaces a imágenes de cada evento. `validate_vision.py` usa exclusivamente video sintético y no prueba la detección en el simulador real.

GRB puede conservar un video adicional. Se comprobó una grabación real de HISENSE sin audio; una interrupción posterior del sistema se conserva como fallo de captura. El MP4 de GRB solo se puede analizar después de que se finalice correctamente. `vision_observer.py` también analiza un video finalizado con su hora real de comienzo (`--start-at`) y firmas de misión (`--active-cue`). No afirma procesar un MP4 de GRB aún sin índice.
