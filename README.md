# BlackMamba Input Runtime

## App local

```bash
./bmctl app
```

Abre **BlackMamba Control Room** en `http://127.0.0.1:8147`.

La app centraliza:

- Wake/reinject/verify de xCloud.
- Prueba live de palancas, gatillos, Start, Select/Back, L3, R3 y Guide.
- Doctor avanzado, RAM, recycle, logs y limpieza.
- Cambio rapido entre perfil Fortnite/Xbox fisico y Switch labels.
- Diagnostico de colapso con `./bmctl app-why`.

La app corre como LaunchAgent (`com.blackmamba.control-room`) para que no se
muera cuando termina la terminal que la abrio.

Flujo corto para Fortnite:

```bash
./bmctl fortnite-map
./bmctl app
```

Luego usar `Wake xCloud`, `Verify` y `Botones Live` desde la app.

Runtime local para convertir un control Rock Candy / Nintendo Switch HID en un gamepad Xbox virtual dentro de Xbox Cloud Gaming.

Estado actual:

- macOS detecta el Rock Candy por HID.
- El runtime lee eventos nativos HID.
- El live monitor traduce a eventos semanticos.
- El bridge inyectado por Chrome DevTools presenta un `Xbox 360 Controller` con `mapping: standard`.
- xCloud ya entro a Microsoft Flight Simulator con el control virtual visible.

## Jugar

```bash
./bmctl play
```

Esto arranca:

```text
Rock Candy HID
-> hid-live-source
-> live-monitor websocket
-> semantic runtime
-> CDP-injected Xbox bridge
-> xCloud
```

Si xCloud cambia de pagina, login, juego o pantalla y pierde el control:

```bash
./bmctl reinject
```

Verificar si la pagina actual ve el Xbox virtual:

```bash
./bmctl verify
```

Debe aparecer algo parecido a:

```json
{
  "installed": true,
  "pads": [
    {
      "id": "Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e Product: 028e)",
      "mapping": "standard",
      "buttons": 17,
      "axes": 4
    }
  ]
}
```

## Metacomandos

```bash
./bmctl play       # abre xCloud con bridge CDP
./bmctl reinject   # reinyecta en la pestana xCloud actual
./bmctl verify     # confirma Xbox virtual en navigator.getGamepads()
./bmctl status     # live monitor, HID source y pestanas Chrome
./bmctl doctor     # diagnostico HID / browser / xCloud
./bmctl hid        # arranca HID nativo -> live-monitor
./bmctl stop-hid   # detiene HID source
./bmctl lab        # abre laboratorio visual
./bmctl test       # pruebas offline + smoke live
./bmctl logs       # logs recientes
./bmctl clean      # limpia caches temporales seguros
./bmctl save       # commit local
```

## Arquitectura

```text
runtime/hid-live-source.swift
  lee Rock Candy desde IOHIDManager

runtime/live-monitor.js
  recibe frames por WebSocket
  traduce con profiles/*.normalized.json
  emite semantic-frame

xbox-gamepad-bridge/bridge.js
  se inyecta en la pagina xCloud
  reemplaza navigator.getGamepads()
  presenta Xbox 360 Controller standard

runtime/inject-bridge-cdp.js
  usa Chrome DevTools Protocol
  evita instalar extension manualmente
```

## Diagnostico

Estado del runtime:

```bash
./bmctl status
```

HID puro:

```bash
./hid-raw-monitor.sh
```

Replay de trazas:

```bash
node runtime/replay-trace.js --trace outputs/runtime-frames-20260506-134158.json --expect A
```

Diff semantico entre perfiles:

```bash
node runtime/semantic-diff.js profiles/a.normalized.json profiles/b.normalized.json
```

## Notas importantes

- La ruta que funciono para jugar no fue Steam.
- La ruta funcional es CDP bridge + HID native source.
- `GCVirtualController` no esta disponible en este SDK/macOS actual.
- La extension unpacked puede fallar por carga/inyeccion; CDP es la ruta confiable.
- No borrar `/tmp/blackmamba-xcloud-cdp-profile` mientras se esta jugando.

## Archivos clave

- [bmctl](./bmctl)
- [play-xcloud-cdp-bridge.sh](./play-xcloud-cdp-bridge.sh)
- [runtime/hid-live-source.swift](./runtime/hid-live-source.swift)
- [runtime/live-monitor.js](./runtime/live-monitor.js)
- [runtime/inject-bridge-cdp.js](./runtime/inject-bridge-cdp.js)
- [xbox-gamepad-bridge/bridge.js](./xbox-gamepad-bridge/bridge.js)
- [profiles/rock-candy-wired-controller-for-nintendo-switch-vendor-0e6f-product-0187.normalized.json](./profiles/rock-candy-wired-controller-for-nintendo-switch-vendor-0e6f-product-0187.normalized.json)
