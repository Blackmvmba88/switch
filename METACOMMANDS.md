# Metacomandos

## Uso Normal

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
./bmctl doctor-advanced
./bmctl buttons
./bmctl ram
./bmctl logs
```

`buttons` muestra palancas, gatillos, Back/Select, Start, L3, R3 y Guide.

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
