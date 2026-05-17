# Metacomandos

## Uso Normal

```bash
./install.sh
```

```bash
./bmctl app
./bmctl game-on
./bmctl verify
```

Si el control deja de responder en xCloud:

```bash
./bmctl reinject
./bmctl verify
```

Cuando termines:

```bash
./bmctl close
```

Si quieres cerrar todo:

```bash
./bmctl shutdown
```

## Fortnite

```bash
./bmctl fortnite-map
./bmctl game-on
```

Regresar etiquetas Nintendo/Switch:

```bash
./bmctl switch-map
```

## Diagnostico

```bash
./bmctl status
./bmctl net-status
./bmctl sessions
./bmctl doctor-advanced
./bmctl buttons
./bmctl ram
./bmctl logs
```

`buttons` muestra palancas, gatillos, Back/Select, Start, L3, R3 y Guide.

`sessions` muestra cuanto duraron tus sesiones cerradas y el promedio que el
runtime va aprendiendo.

## Red Para Cloud Gaming

```bash
./bmctl net-on
./bmctl net-status
./bmctl net-off
```

`game-on` activa `net-on` automaticamente. El modo red mantiene la Mac despierta,
refresca DNS local una vez y monitorea latencia/jitter/perdida contra gateway,
internet y xCloud.

## Estabilidad

```bash
./bmctl recycle
./bmctl reinject
```

Si Chrome/CDP no responde:

```bash
./bmctl close
./bmctl game-on
```

## Repo Limpio

Ver que es codigo y que es runtime local:

```bash
./bmctl repo-doctor
```

Limpiar caches repo-locales seguras:

```bash
./bmctl repo-clean
```

Empaquetar beta limpia:

```bash
./bmctl preflight
./bmctl package-beta
```

## Validacion

```bash
./bmctl test
```

El resultado bueno termina en:

```text
OK runtime robust
```

## URLs

```bash
URL="https://www.xbox.com/es-MX/play" ./bmctl play
URL="https://www.xbox.com/es-MX/play/launch/microsoft-flight-simulator-2024/9P38D19T7LRV" ./bmctl play
```

## Logs Utiles

```bash
tail -f logs/hid-live-source.log
tail -f "$HOME/Library/Application Support/BlackMambaInput/logs/live-events.jsonl"
tail -f "$HOME/Library/Application Support/BlackMambaInput/logs/xcloud-bridge-agent.err.log"
```
