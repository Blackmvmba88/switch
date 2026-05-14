# Metacomandos

## App principal

```bash
./bmctl app
```

Abre **BlackMamba Control Room**, la app local para jugar, verificar botones,
diagnosticar, reciclar el runtime y ver logs sin memorizar comandos.

Si la app no abre o se cae:

```bash
./bmctl app-why
```

Para detenerla:

```bash
./bmctl app-stop
```

## Flujo recomendado para Fortnite

```bash
./bmctl fortnite-map
./bmctl app
```

Dentro de la app:

1. `Wake xCloud`
2. `Verify`
3. `Botones Live`

## Comandos principales

```bash
./bmctl wake
./bmctl reinject
./bmctl verify
./bmctl buttons
./bmctl status
./bmctl doctor-advanced
./bmctl test
```

Sesion normal:

```bash
./bmctl wake
```

Si ya estas en xCloud y el control deja de responder:

```bash
./bmctl reinject
./bmctl verify
```

Si el runtime se pone inestable:

```bash
./bmctl recycle
./bmctl wake
./bmctl verify
```

Probar botones, gatillos, Start, Select/Back, L3 y R3:

```bash
./bmctl buttons
```

Modo agresivo solo cuando vas a jugar:

```bash
./bmctl game-on
```

Cuando termines:

```bash
./bmctl game-off
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
