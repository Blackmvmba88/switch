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

`fortnite-map` deja ABXY como Xbox por posicion fisica, no por la letra impresa:

| Fisico | Letra Switch | Xbox |
| --- | --- | --- |
| Abajo | B | A |
| Derecha | A | B |
| Izquierda | Y | X |
| Arriba | X | Y |

La cruz/D-pad tambien queda cubierta. Este control la reporta como eje `A9`,
y el bridge la convierte a botones Xbox:

| Cruz | Fuente | Xbox |
| --- | --- | --- |
| Arriba | `A9=-1` | `buttons[12]` |
| Abajo | `A9=0.143` | `buttons[13]` |
| Izquierda | `A9=0.714` | `buttons[14]` |
| Derecha | `A9=-0.429` | `buttons[15]` |

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

Si estas conectado por cable, usa:

```bash
./bmctl net-wired
./bmctl net-status
```

`net-wired` apaga Wi-Fi, refresca DNS local y reinicia el monitor para que la
ruta quede por Ethernet.

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
