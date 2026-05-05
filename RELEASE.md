# Release v0.1.0

## Nombre

XOutput Portable - Nintendo Switch Controller Mapping

## Objetivo

Hacer que un control economico **Rock Candy Wired Controller for Nintendo Switch** funcione en Windows como control **Xbox 360 / XInput** usando XOutput y ViGEm.

## Incluye

- `XOutput.exe`
- `settings.json` funcional
- diagnostico Windows en `scripts/check-windows-xoutput.ps1`
- respaldo de configuracion en `scripts/backup-settings.ps1`
- guia completa en `README.md`
- plan de migracion a macOS en `docs/macos-migration.md`

## Compatibilidad

### Windows

Estado: funcional validado.

Requisitos:

- Windows
- Nefarius Virtual Gamepad Emulation Bus / ViGEm instalado
- control Rock Candy Wired Controller for Nintendo Switch

### macOS

Estado: experimental/documental.

XOutput y ViGEm son Windows-only. En macOS este release sirve como referencia del mapeo, pero no como app nativa. La ruta recomendada es probar primero Steam Input o soporte nativo del juego.

## Verificacion Ejecutada

En Windows se valido:

- `settings.json` parsea correctamente
- `XOutput.exe` existe
- XOutput esta corriendo
- control fisico detectado por VID/PID `VID_0E6F&PID_0187`
- control virtual Xbox 360 detectado por `VID_045E&PID_028E`
- Nefarius Virtual Gamepad Emulation Bus detectado

## Riesgo Principal

Si el GUID del control cambia en otra maquina, puede ser necesario remapear o ajustar `settings.json`.

