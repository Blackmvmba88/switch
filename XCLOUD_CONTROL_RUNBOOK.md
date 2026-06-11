# Xbox Cloud Control Runbook

## Diagnostico cerrado

El control Rock Candy wired para Nintendo Switch aparece en macOS como HID USB:

```text
VID 0E6F / PID 0187
Rock Candy Wired Controller for Nintendo Switch
```

La pagina local de Gamepad API lo lee, pero Xbox Cloud en macOS no lo acepta como mando compatible. El problema no es el cable ni el control: el consumidor final pide un contrato tipo Xbox/XInput/standard gamepad.

## Ruta software de Virtualización Nativa (Recomendada)

Si no puedes usar Steam Input o el adaptador Mayflash, puedes usar el puente de virtualización nativa de BlackMamba. Este utiliza `GCVirtualController` (disponible en macOS 12+) para crear un control virtual que el sistema reconoce como compatible con Xbox/MFi.

### Requisitos
- macOS 12.0 o superior.
- Swift instalado (incluido con Xcode Command Line Tools).
- El monitor live corriendo (se inicia automáticamente).

### Uso
1. Iniciar el puente:
   ```bash
   ./start-virtual-xbox.sh
   ```
2. Abrir la página de prueba:
   ```text
   gamepad-test/index.html
   ```
3. Conectar el monitor live en la página (`Connect live monitor`).
4. El puente capturará los eventos del navegador y los enviará al control virtual del sistema.
5. Abre `https://www.xbox.com/play` en Chrome o Safari. Debería detectar el control virtual inmediatamente.

Para detenerlo:
```bash
./stop-virtual-xbox.sh
```

Los logs del puente se guardan en:
```text
logs/virtual-xbox-bridge.log
```

---

## Ruta software vía Steam
2. Activar Steam Input para controles Generic y Switch/Nintendo.
3. Agregar Google Chrome como Non-Steam Game.
4. Abrir Chrome desde Steam o Big Picture.
5. Entrar a `https://www.xbox.com/play`.

Script local:

```bash
./play-xcloud.sh
```

Runtime inteligente:

```bash
./blackmamba-gaming-runtime.sh doctor
./blackmamba-gaming-runtime.sh start
./blackmamba-gaming-runtime.sh watch
```

`start` valida control, abre Steam, abre Big Picture y abre Chrome con perfil dedicado para Xbox Cloud.

`watch` queda esperando el control y lanza el stack cuando detecta el Rock Candy conectado.

Diagnostico:

```bash
./play-xcloud.sh --doctor
```

Instalar Steam con Homebrew:

```bash
./play-xcloud.sh --install
```

## Ruta hardware estable

Comprar un adaptador que emita modo XInput/Xbox:

- Mayflash MAGIC-NS 2, recomendado para probar controles wired USB en modo XInput.
- Mayflash MAGIC-X, alternativa mas orientada a compatibilidad Xbox y tambien compatible con macOS.
- 8BitDo USB Adapter 2 solo si el control es Bluetooth compatible; no es ideal para este Rock Candy wired.

Modo esperado en Mayflash:

```text
XInput mode / LED verde
```

## Veredicto sin Steam

Steam queda fuera si no se puede iniciar sesion. Safari tambien fue probado como alternativa sin Steam y Xbox Cloud no tomo el Rock Candy aunque macOS/Chrome si leen botones.

Estado final:

- macOS detecta el Rock Candy: OK.
- Chrome Gamepad API detecta botones/ejes: OK.
- Cruceta/D-Pad en navegador: A9 como POV/hat axis, no B12-B15.
- Xbox Cloud en Chrome/Safari no acepta el HID: NO.
- Steam Input seria la ruta software, pero requiere login Steam.
- Sin Steam, la ruta real es hardware XInput o un control Xbox compatible.

Recomendacion directa:

1. Mas garantizado: control Xbox Series/Xbox One por USB o Bluetooth.
2. Para intentar rescatar el Rock Candy wired: Mayflash MAGIC-NS 2 o MAGIC-X en modo XInput.

## No gastar tiempo aqui

- Remapear a teclado: Xbox Cloud necesita mando para juegos de mando.
- HID raw en navegador: Chrome lo ve, Xbox Cloud no lo acepta.
- JS Gamepad hacks: pueden cambiar `navigator.getGamepads()`, pero no garantizan que el runtime de Xbox Cloud use esa capa.

## Layout Steam obligatorio

Si Chrome abre desde Steam pero Xbox Cloud escribe teclas o no responde como mando:

1. Steam Library -> Chrome.
2. Controller Layout.
3. Templates -> Gamepad.
4. Guardar como `xcloud-clean`.
5. Evitar templates Keyboard/Mouse.

Validacion profunda:

```text
Steam -> Settings -> Controller -> Test Device Inputs
```

Si ahi responde, el problema es layout. Si ahi no responde, el problema es HID/Steam/macOS.

## Daemon opcional

El archivo:

```text
com.blackmamba.gaming-runtime.plist.template
```

es una plantilla de LaunchAgent para correr:

```bash
./blackmamba-gaming-runtime.sh watch
```

No se instala automaticamente para evitar dejar procesos permanentes sin confirmacion.

## Controller Doctor

El input lab ahora tiene una herramienta reusable:

```bash
./controller-doctor.sh doctor
./controller-doctor.sh detect
./controller-doctor.sh baseline rock-candy-switch-wired
./controller-doctor.sh matrix
./controller-doctor.sh watch
./controller-doctor.sh export-json
./controller-doctor.sh export-md
./controller-doctor.sh list-signatures
```

Watcher automatico:

```bash
./start-controller-watch.sh
./stop-controller-watch.sh
```

Cuando detecta conexion/desconexion, corre `doctor`; cuando hay conexion, actualiza:

```text
reports/latest.json
reports/latest.md
logs/controller-doctor-watch.log
```

## Sample Session Capture

La pagina:

```text
gamepad-test/index.html
```

incluye captura de sesion:

1. `Start capture`
2. Presionar botones, sticks, gatillos y cruceta.
3. `Stop`
4. `Download JSON`

El JSON incluye muestras raw y perfil inferido:

```text
rawSamples
profile.axes
profile.buttons
profile.dpad
```

Para importar una captura descargada:

```bash
./import-controller-sample.sh /path/to/controller-sample.json
```

Las muestras importadas y perfiles generados quedan en:

```text
samples/
profiles/
```

El importador genera un perfil normalizado con:

```text
semantic
ranges
deadzones
dpad
triggerMode
dpadMode
```

## Runtime Frame Protocol

El primer runtime de traduccion vive en:

```text
runtime/translate-sample.js
RUNTIME_PROTOCOL.md
```

Flujo:

```bash
./import-controller-sample.sh /path/to/controller-sample.json
./translate-latest-sample.sh
```

Produce:

```text
outputs/runtime-frames-*.json
```

Cada frame usa semantica portable:

```text
buttons.A.pressed
transitions.A.justPressed
transitions.A.heldMs
axes.LX.value
```

La firma conocida vive en:

```text
device-signatures/rock-candy-switch-wired.json
```

Baselines incluidas:

```text
device-signatures/rock-candy-switch-wired.json
device-signatures/xbox-wireless-controller.json
device-signatures/mayflash-xinput-adapter.json
```

Salida baseline actual:

```text
HID visible: PASS
Browser Gamepad API: PASS
D-Pad/cross: A9 hat axis
XInput identity: FAIL
xcloud direct support: FAIL
Xbox identity confidence: 0.22
cloud gaming ready: NO
```

Los reportes se guardan en:

```text
reports/
```

Tambien se actualizan symlinks:

```text
reports/latest.json
reports/latest.md
```

Matriz actual:

```text
mayflash-xinput-adapter  EXPECTED  EXPECTED  PASS  EXPECTED
rock-candy-switch-wired  PASS      PASS      FAIL  FAIL
xbox-wireless-controller PASS      PASS      PASS  PASS
```
