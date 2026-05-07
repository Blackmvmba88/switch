# Roadmap

## Milestone 0 - Estado que ya funciona

- Rock Candy visible por macOS HID.
- `hid-live-source.swift` genera frames continuos aunque Chrome no vea el gamepad.
- `live-monitor.js` mantiene bus WebSocket y semantic frames.
- `bridge.js` presenta un Xbox 360 standard gamepad dentro de xCloud.
- `bmctl play`, `bmctl reinject`, `bmctl verify`, `bmctl status`.

## Milestone 1 - Robustez de sesion

- Watchdog para reinyectar automaticamente despues de redirects de xCloud.
- Detector de pagina activa: login, catalogo, launch, stream.
- Auto `Page.addScriptToEvaluateOnNewDocument` en todos los targets xbox.com.
- Monitor que alerte si `navigator.getGamepads()` queda vacio.
- Limpieza controlada de perfiles temporales sin romper partida activa.

## Milestone 2 - Perfil completo Rock Candy

- Captura guiada completa A/B/X/Y/LB/RB/LT/RT/Start/Back/L3/R3.
- Sticks LX/LY/RX/RY desde IOHID con deadzones reales.
- Hat A9 estable con neutral `1.286` y fallback `3.286`.
- Remap Nintendo/Xbox configurable por perfil.

## Milestone 3 - Identity layer

- Comparar descriptor Rock Candy vs Xbox canonical.
- Construir schema `identity/*.json` para Xbox/XInput canonical.
- Evaluar IOHIDUserDevice con entitlements reales.
- Mantener CDP bridge como backend web y virtual HID como backend sistema.

## Milestone 4 - Productizacion local

- LaunchAgent para `hid-live-source`.
- LaunchAgent para auto reinjection CDP cuando Chrome/xCloud aparece.
- UI local para perfiles y remap.
- Export de reportes: markdown/json/screenshot.

## Milestone 5 - Open source / repo limpio

- Separar `fixtures/`, `profiles/`, `runtime/`, `xbox-gamepad-bridge/`.
- Quitar scripts historicos Steam que ya no son ruta principal.
- README publico con warning claro: macOS browser bridge, no driver XInput real.
- CI offline con replay traces.

