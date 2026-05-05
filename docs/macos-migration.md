# Migracion A macOS

## Punto De Partida

La configuracion actual funciona en Windows porque XOutput usa un bus virtual compatible con XInput:

```text
DirectInput/HID -> XOutput -> ViGEm -> Xbox 360 Controller
```

Ese modelo no es portable directamente a macOS.

## Diferencia Tecnica

Windows:

- XOutput lee dispositivos DirectInput/HID.
- ViGEm crea un gamepad virtual tipo Xbox 360.
- Los juegos ven un control XInput.

macOS:

- No usa XInput como capa nativa.
- No usa ViGEm.
- Los controles modernos pasan por HID, Bluetooth/USB y `GameController.framework`.
- Muchos juegos dependen de Steam Input o soporte nativo.

## Estrategia Recomendada

### Opcion 1: Steam Input

Mejor primera ruta si el juego esta en Steam.

1. Conectar el control al Mac.
2. Abrir Steam.
3. Activar soporte de controles Nintendo/Switch si aparece.
4. Crear layout por juego.
5. Probar sticks, botones y gatillos desde el configurador de Steam.

Ventaja: no requiere driver virtual propio.

### Opcion 2: Soporte Nativo Del Juego

Algunos juegos aceptan controles HID o Nintendo Switch directamente.

1. Conectar control.
2. Abrir ajustes del juego.
3. Revisar si detecta el control.
4. Ajustar layout dentro del juego.

Ventaja: menor latencia y menos piezas.

### Opcion 3: Mapper A Teclado/Mouse

Si el juego no acepta gamepad pero acepta teclado:

```text
Control -> mapper macOS -> teclado/mouse
```

Sirve para juegos simples, launchers o apps que no requieren analogico fino.

Limitacion: los sticks analogicos pueden perder precision si se convierten a teclas.

### Opcion 4: Mapper Propio

Si se necesita control total:

- leer HID con IOKit;
- mapear entradas con `GameController.framework`;
- emitir acciones hacia la app objetivo;
- opcionalmente integrar perfiles por juego.

Esto ya seria desarrollo real, no solo configuracion.

## Que No Hay Que Asumir

- `XOutput.exe` no corre nativamente en macOS.
- `ViGEm` no existe como equivalente directo en macOS.
- `settings.json` no es un formato estandar multiplataforma.
- Un juego que en Windows ve "Xbox 360 Controller" no necesariamente vera lo mismo en macOS.

## Informacion Que Debemos Conservar

Del setup actual hay que preservar:

```text
VID: 0E6F
PID: 0187
Nombre: Rock Candy Wired Controller for Nintendo Switch
Mapa funcional: settings.json
```

## Plan De Validacion En Mac

1. Confirmar que macOS detecta el dispositivo por USB.
2. Confirmar si Steam lo detecta.
3. Probar un juego con soporte nativo.
4. Documentar diferencias de botones.
5. Crear un perfil equivalente.
6. Si no hay soporte suficiente, evaluar mapper dedicado.

## Resultado Esperado

El objetivo no es portar XOutput literalmente. El objetivo es replicar el comportamiento:

```text
Que el control de Nintendo Switch sea reconocido correctamente por juegos en macOS.
```

