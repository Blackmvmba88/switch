# Roadmap

## Milestone 0 - Baseline Funcional

- macOS detecta el Rock Candy por HID.
- El navegador recibe frames por Gamepad API/native source.
- `runtime/live-monitor.js` mantiene WebSocket y semantic frames.
- `profiles/*.normalized.json` separa hardware crudo de intencion semantica.
- `xbox-gamepad-bridge/bridge.js` presenta un gamepad Xbox standard en xCloud.
- `bmctl test` valida replay, DPad A9, botones de sistema y smoke WebSocket.

## Milestone 1 - Operacion Limpia

- Control Room como superficie principal: abrir, verificar, cerrar y mapear.
- `./bmctl close` libera xCloud/CDP/HID/live-monitor sin matar la app.
- `./bmctl shutdown` apaga todo.
- `./bmctl repo-doctor` explica codigo vs runtime local.
- `./bmctl repo-clean` limpia caches repo-locales seguras.
- Documentacion publica con limites reales: bridge browser, no driver XInput.
- Auto-shutdown de sesion: aprende duracion y apaga solo despues de salir de xCloud y estar en otra app.

## Milestone 2 - Perfil Completo Rock Candy

- Captura guiada independiente para cada input.
- DPad como hat-axis `A9`.
- Gatillos digitales/analogicos segun hardware observado.
- Start, Back/Select, L3, R3 y Guide visibles en live buttons.
- Layouts separados: `xbox-physical` para Fortnite y `switch-labels`.

## Milestone 3 - Robustez De Sesion

- Watchdog para reinyectar despues de redirects de xCloud.
- Mejor clasificacion: login, catalogo, launch, stream, game frame.
- Fallback directo si LaunchAgent falla con `bootstrap failed: 5`.
- Alertas cuando `navigator.getGamepads()` queda vacio.
- Limpieza controlada de perfiles temporales sin romper partida activa.

## Milestone 4 - Identity Layer

- Comparar descriptor Rock Candy vs Xbox canonical.
- Mantener `identity/*.json` para perfiles de identidad.
- Evaluar virtual HID/DriverKit solo como backend futuro.
- Mantener CDP bridge como backend web confiable para macOS.

## Milestone 5 - Open Source

- README orientado a Mac-first: macOS detecta bien, el runtime ordena capas.
- CI offline con replay traces.
- Dataset de perfiles y device signatures.
- Guia clara para reportar dispositivos nuevos.
- Separar artefactos historicos de Steam/experimentos en docs de archivo.
