# Hoja De Comandos

Esta hoja está pensada para uso diario con el control y la sesión de xCloud.
Incluye validación básica para reducir sorpresas antes de jugar.

## Validación Rápida

```bash
# Sintaxis y smoke test del runtime
./test-runtime.sh

# Verifica que el Control Room responda
curl -fsS http://127.0.0.1:8147/api/status >/dev/null && echo OK

# Revisa el estado del navegador y del puente
./bmctl atlas-status
./bmctl status
```

## Inicio Seguro

```bash
# Levanta el Control Room
./bmctl app

# Abre xCloud sin robar foco
./bmctl play

# Si quieres Atlas, abre la ruta Atlas
./bmctl atlas-jugar
```

## Durante El Juego

```bash
# Verifica que el control sigue vivo
./bmctl verify

# Mira los botones y palancas en vivo
./bmctl buttons

# Estado del runtime
./bmctl status
```

## Cierre Seguro

```bash
# Cierra la sesión de juego
./bmctl close

# Cierra todo, incluido el Control Room
./bmctl shutdown
```

## Modo Hisense

Si quieres mantener el juego en la pantalla externa y no perder el foco:

```bash
# Arranque silencioso para no robar foco
AUTO_SHUTDOWN_WHEN_AWAY=0 ./bmctl play
```

Nota:
- Esto evita que el runtime se cierre solo por cambiar de app.
- No mueve la ventana todavía a una pantalla específica; eso se puede agregar como modo dedicado si me confirmas cómo identifica macOS la Hisense.

## Orden Recomendado

1. `./test-runtime.sh`
2. `./bmctl app`
3. `./bmctl play`
4. `./bmctl verify`
5. `./bmctl buttons`
6. `./bmctl close`

