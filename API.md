# BlackMamba Runtime API

## Purpose

Minimal local API for operating the runtime as a product.

## Start

```bash
./start-api.sh
```

If port `8147` is already occupied by a non-BlackMamba service, startup fails explicitly.

## Stop

```bash
./stop-api.sh
```

## Endpoints

- `GET /health`
- `GET /ready`
- `GET /api/v1/runtime`
- `GET /api/status`
- `GET /api/doctor`
- `GET /api/verify`
- `GET /api/work`
- `GET /api/play`
- `POST /api/v1/game/connect`
- `POST /api/v1/game/disconnect`
- `POST /api/v1/game/reconnect`
- `POST /api/v1/game/close`

## Game Mode

- `connect` activa `game`
- `disconnect` inicia cierre con gracia
- `reconnect` cancela el cierre si vuelve a tiempo
- `close` fuerza salida inmediata
- La gracia por defecto es `10s`

## bmctl Close

`bmctl close` fuerza el cierre del runtime y confirma que el estado final quede en:

- `runtime.active = false`
- `gameMode.state = stopped`

Si el API no responde, el comando falla en vez de fingir cierre.

## Notes

- The API shells out to `bmctl` for the current runtime behavior.
- It is meant to become the stable product surface for orchestration.
- POST endpoints now validate JSON body strictly:
  - Invalid JSON returns `400 { ok: false, error: "invalid_json" }`
  - Oversized payload returns `413 { ok: false, error: "payload_too_large" }`
- Optional env vars:
  - `API_MAX_BODY_BYTES` (default `1048576`)
  - `BMCTL_HTTP_TIMEOUT_MS` (default `5000`)
