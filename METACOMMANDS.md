# Metacomandos

Comandos principales:

```bash
./bmctl play
./bmctl reinject
./bmctl verify
./bmctl status
./bmctl doctor
./bmctl test
```

Sesion normal:

```bash
./bmctl play
```

Si ya estas en xCloud y el control deja de responder:

```bash
./bmctl reinject
./bmctl verify
```

Si el runtime se queda sin frames:

```bash
./bmctl hid
./bmctl status
```

Si Chrome lleno el disco con perfiles temporales:

```bash
./bmctl clean
```

Guardar avance local:

```bash
./bmctl save
```

Atajos con URL:

```bash
URL="https://www.xbox.com/es-MX/play" ./bmctl play
URL="https://www.xbox.com/es-MX/play/launch/microsoft-flight-simulator-2024/9P38D19T7LRV" ./bmctl play
```

Debug:

```bash
tail -f logs/hid-live-source.log
tail -f "$HOME/Library/Application Support/BlackMambaInput/logs/live-events.jsonl"
```

