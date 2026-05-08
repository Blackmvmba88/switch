# Propuesta: El Futuro del Repo (Cybernetic Input Runtime)

Para que este repositorio pase de ser un "backup de configuración" a algo **imprescindible**, debe transformarse en el **cerebro intermedio** entre el hardware y el juego.

## Pilares de la Transformación

### 1. Observabilidad Total (Telemetry)
No basta con mapear. Debemos saber qué está pasando.
- **Métricas en tiempo real:** Latencia de entrada (input lag), jitter del polling rate y deriva de los sticks (drift).
- **Dashboard:** Una interfaz (CLI o Web) que muestre la "salud" del control.

### 2. Estabilización Cibernética (PID Control)
Implementar algoritmos de control industrial para el movimiento de cámara y apuntado.
- **Suavizado PID:** Eliminar el ruido de los sensores sin introducir lag perceptible.
- **Deadzone Dinámica:** El software detecta el drift y ajusta el área muerta automáticamente en tiempo real.

### 3. Capa de Intención (Intent Layer)
Uso de modelos matemáticos para predecir qué quiere hacer el usuario.
- **Snap-to-target asistido:** No es un aimbot, es un "corrector de trayectoria" basado en la velocidad del stick.
- **Perfiles Contextuales:** El control se comporta distinto si estás en un menú o en combate.

### 4. Abstracción Multiplataforma
- Un nucleo en **Python** o **Rust** que corra en Windows, macOS y Linux, usando librerías como `hidapi`.

## Roadmap de Implementación
1. [x] Estructura de carpetas para el Core.
2. [x] Prototipo de Telemetría (`core/telemetry.py`).
3. [x] Núcleo HID real (`core/hid_backend.py`).
4. [x] Pipeline Modular Desacoplado (`core/pipeline.py`).
5. [x] Filtros DSP (PID, Kalman).
6. [x] Grabador de Datasets (`scripts/record_dataset.py`).
7. [ ] Capa de Intención (ML/Neural Engine).
