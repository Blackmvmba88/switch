# Mapeo Definitivo Del Control

Este documento es la fuente de verdad para replicar en macOS el mismo comportamiento que ya funciona en Windows con XOutput.

## Identidad Del Control

Control fisico:

```text
Nombre: Rock Candy Wired Controller for Nintendo Switch
VID: 0E6F
PID: 0187
XOutput InputDevice GUID: 51565030-465d-11f1-8001-444553540000
```

Control virtual equivalente en Windows:

```text
Xbox 360 Controller for Windows
XInput target: Xbox 360 layout
```

Perfil XOutput:

```text
Name: Controller
Id: c9f55366-20e4-4d92-ad5b-9744b9d0a8da
StartWhenConnected: true
ForceFeedbackDevice: 51565030-465d-11f1-8001-444553540000
```

## Regla Para macOS

En macOS no se debe inventar otro layout. El objetivo es replicar este contrato:

```text
El control fisico Rock Candy / Nintendo Switch debe comportarse como un control Xbox 360 estandar.
```

Cuando una herramienta de macOS pida asignar botones, usa la columna `Salida esperada` como destino y la columna `Entrada XOutput` como referencia del boton/eje fisico ya validado.

## Tabla De Mapeo

| Salida esperada | Entrada XOutput | Tipo | Min | Max | Deadzone | Nota para macOS |
|---|---:|---|---:|---:|---:|---|
| A | 21 | Boton | 0.0 | 1.0 | 0.0 | Mapear al boton A del layout Xbox. |
| B | 22 | Boton | 0.0 | 1.0 | 0.0 | Mapear al boton B del layout Xbox. |
| X | 20 | Boton | 0.0 | 1.0 | 0.0 | Mapear al boton X del layout Xbox. |
| Y | 23 | Boton | 0.0 | 1.0 | 0.0 | Mapear al boton Y del layout Xbox. |
| L1 / LB | 24 | Boton | 0.0 | 1.0 | 0.0 | Hombro izquierdo. |
| R1 / RB | 25 | Boton | 0.0 | 1.0 | 0.0 | Hombro derecho. |
| L2 / LT | 26 | Gatillo | 1.0 | 0.0 | 0.0 | Gatillo izquierdo invertido. Respetar inversion. |
| R2 / RT | 27 | Gatillo | 0.0 | 1.0 | 0.0 | Gatillo derecho normal. |
| Back / Select | 28 | Boton | 0.0 | 1.0 | 0.0 | Boton equivalente a Back/View. |
| Start / Menu | 29 | Boton | 0.0 | 1.0 | 0.0 | Boton equivalente a Start/Menu. |
| L3 | 30 | Boton | 0.0 | 1.0 | 0.0 | Click del stick izquierdo. |
| R3 | 31 | Boton | 0.0 | 1.0 | 0.0 | Click del stick derecho. |
| Home / Guide | 33 | Boton | 0.0 | 1.0 | 0.0 | Boton Home/Guide si la herramienta lo soporta. |
| LX | 16 | Eje analogico | 0.0 | 1.0 | 0.0 | Stick izquierdo horizontal. |
| LY | 12 | Eje analogico | 0.0 | 1.0 | 0.0 | Stick izquierdo vertical. |
| RX | 8 | Eje analogico | 0.0 | 1.0 | 0.0 | Stick derecho horizontal. |
| RY | 4 | Eje analogico | 0.0 | 1.0 | 0.0 | Stick derecho vertical. |
| D-Pad Up | 1000 | POV/D-Pad | 0.0 | 1.0 | 0.0 | Cruceta arriba. |
| D-Pad Down | 1001 | POV/D-Pad | 0.0 | 1.0 | 0.0 | Cruceta abajo. |
| D-Pad Left | 1002 | POV/D-Pad | 0.0 | 1.0 | 0.0 | Cruceta izquierda. |
| D-Pad Right | 1003 | POV/D-Pad | 0.0 | 1.0 | 0.0 | Cruceta derecha. |

## Detalle Critico

El unico valor invertido en el perfil actual es:

```text
L2 / LT
InputType: 26
MinValue: 1.0
MaxValue: 0.0
```

Si en macOS el gatillo izquierdo queda presionado todo el tiempo, se debe invertir ese eje o gatillo en la herramienta de remapeo.

## Contrato De Compatibilidad

Una configuracion en macOS se considera equivalente si cumple:

1. Los botones A/B/X/Y producen el mismo resultado esperado por un layout Xbox.
2. Los hombros y gatillos quedan en LB/RB/LT/RT.
3. `L2 / LT` respeta la inversion si la lectura nativa lo requiere.
4. Los sticks izquierdo y derecho conservan ejes separados.
5. La cruceta funciona como D-Pad, no como stick analogico.
6. El juego o Steam Input ve el control con un layout consistente tipo Xbox.

## Prueba Manual Minima

En Mac, despues de configurar:

1. Abrir Steam Input o el panel de prueba de la herramienta usada.
2. Presionar cada boton fisico una vez.
3. Confirmar que la salida coincide con la tabla.
4. Mover ambos sticks en circulos completos.
5. Probar L2 y R2 lentamente.
6. Si L2 aparece activado en reposo, invertirlo.

## Archivo Original

El mapeo original vive en:

```text
settings.json
```

Ese archivo no es un formato nativo de macOS. Es la referencia tecnica para reconstruir el perfil en otra herramienta.

