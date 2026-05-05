# XOutput Portable - Nintendo Switch Controller Mapping

Repositorio local para conservar y documentar la configuracion funcional de XOutput que permite usar el control **Rock Candy Wired Controller for Nintendo Switch** como un control compatible con **Xbox 360 / XInput** en Windows.

## Estado Actual

Funciona en Windows con esta cadena:

```text
Rock Candy Wired Controller for Nintendo Switch
-> DirectInput / HID
-> XOutput
-> ViGEm / Nefarius Virtual Gamepad Emulation Bus
-> Xbox 360 Controller for Windows
-> Juegos que esperan XInput
```

Ruta actual del programa:

```text
C:\Users\BlackMamba\Nueva carpeta\XOutput-portable\XOutput.exe
```

Acceso directo detectado:

```text
C:\Users\BlackMamba\Desktop\XOutput.exe - Acceso directo.lnk
```

## Archivos Importantes

| Archivo | Funcion |
|---|---|
| `XOutput.exe` | Aplicacion Windows que lee el control por DirectInput/HID y crea un control virtual XInput. |
| `settings.json` | Configuracion critica del mapeo. Este archivo guarda botones, sticks, gatillos y auto-start. |
| `XOutput.log` | Log local de ejecucion. No se versiona porque cambia constantemente. |
| `scripts/check-windows-xoutput.ps1` | Diagnostico rapido para confirmar proceso, driver, dispositivo y archivos. |
| `scripts/backup-settings.ps1` | Crea respaldos fechados de `settings.json`. |
| `docs/controller-mapping.md` | Mapeo definitivo que debe replicarse en macOS. |
| `docs/macos-migration.md` | Plan tecnico para migrar o replicar el objetivo en macOS. |

## Hardware Detectado

Segun `XOutput.log`, el control configurado es:

```text
InstanceName: Rock Candy Wired Controller for Nintendo Switch
ProductName: Rock Candy Wired Controller for Nintendo Switch
VID: 0E6F
PID: 0187
InputDevice GUID: 51565030-465d-11f1-8001-444553540000
```

El control virtual creado en Windows aparece como:

```text
Xbox 360 Controller for Windows
```

Driver virtual requerido:

```text
Nefarius Virtual Gamepad Emulation Bus
```

## Uso En Windows

1. Conecta el control Rock Candy / Nintendo Switch por USB.
2. Ejecuta:

```powershell
.\XOutput.exe
```

3. Verifica que el perfil `Controller` inicie automaticamente.
4. En Windows debe aparecer un control virtual:

```text
Controlador de Xbox 360 para Windows
```

5. Abre el juego. El juego debe detectar el control como XInput/Xbox.

## Diagnostico Rapido

Desde PowerShell, en esta carpeta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-windows-xoutput.ps1
```

El diagnostico revisa:

- si `XOutput.exe` existe;
- si `settings.json` existe y es JSON valido;
- si XOutput esta corriendo;
- si Windows detecta el control Nintendo Switch/Rock Candy;
- si existe el control virtual Xbox 360;
- si esta instalado el bus virtual Nefarius/ViGEm.

## Backup Del Mapeo

Antes de tocar el mapeo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-settings.ps1
```

Esto crea un respaldo en:

```text
backups\settings-YYYYMMDD-HHMMSS.json
```

## Git

Inicializar repo local:

```powershell
git init -b main
git add .gitattributes .gitignore README.md docs scripts settings.json
git commit -m "Document XOutput controller mapping"
```

Nota: `XOutput.exe` es un binario de terceros. Para un repo privado local se puede versionar si necesitas portabilidad total, pero para un repo publico conviene documentar la fuente de descarga y no redistribuir el ejecutable.

## Preparacion Para macOS

XOutput y ViGEm son tecnologia Windows. En macOS no existe el mismo flujo `ViGEm -> Xbox 360 virtual controller`.

## Mac Quick Start

1. Conecta el control al Mac por USB.
2. Abre Steam y prueba Steam Input primero.
3. Usa `docs/controller-mapping.md` como mapa obligatorio.
4. Configura el control como layout tipo Xbox 360.
5. Verifica botones A/B/X/Y, LB/RB, LT/RT, sticks y D-Pad.
6. Si `L2 / LT` aparece presionado en reposo, invierte ese eje/gatillo.

La fuente de verdad del mapeo esta aqui:

```text
docs/controller-mapping.md
```

Ese documento indica exactamente como esta programado este control y como debe reconstruirse en Mac.

Objetivo correcto para macOS:

```text
Control Nintendo Switch
-> HID / GameController.framework
-> herramienta de remapeo compatible con macOS
-> juego o app que acepte el control
```

Rutas posibles:

- usar soporte nativo de macOS/Steam si el juego lo permite;
- usar Steam Input para remapear controles;
- usar una herramienta macOS tipo Enjoyable/ControllerMate-equivalente si solo se necesita mapear a teclado/mouse;
- desarrollar un mapper propio con IOKit/GameController.framework si se necesita control avanzado;
- evitar depender de ViGEm, porque es Windows-only.

Detalle completo en:

```text
docs/macos-migration.md
```

## Riesgos

- Si cambia el GUID del dispositivo, `settings.json` puede dejar de mapear el control correcto.
- Si se desinstala Nefarius Virtual Gamepad Emulation Bus, XOutput puede abrir pero no crear el control virtual.
- Si otro mapper esta activo al mismo tiempo, puede haber doble input.
- En macOS no se puede asumir compatibilidad directa con `settings.json`.

## Controles Probados

| Control | VID | PID | Windows | macOS |
|---|---|---|---|---|
| Rock Candy Wired Controller for Nintendo Switch | `0E6F` | `0187` | OK con XOutput + ViGEm | Pendiente de validacion fisica; usar `docs/controller-mapping.md`. |

## Regla Operativa

`settings.json` es el activo principal. Antes de editarlo, hacer backup. Si algo deja de funcionar, restaurar el ultimo backup conocido.

Para portar a Mac, no cambiar el layout por intuicion. Replicar primero `docs/controller-mapping.md` y despues ajustar solo si una herramienta de macOS reporta ejes invertidos.
