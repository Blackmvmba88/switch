# BlackMamba Python Control Room

Base local en Python para exponer el runtime del control por API.

## Objetivo

- Mantener la lógica de estado y layout fuera de la UI.
- Exponer una API local para que una app desktop o web la consuma.
- Servir como puente limpio hacia una futura `.app` y luego `.dmg`.

## Arranque

```bash
python3 -m python.control_room_api
```

Por defecto escucha en `127.0.0.1:8811`.

## Endpoints

- `GET /api/health`
- `GET /api/status`
- `GET /api/layout`
- `POST /api/layout/save`
- `POST /api/layout/load`
- `GET /api/controller/live`
- `POST /api/rec/dpad`

