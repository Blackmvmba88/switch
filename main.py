import time
import json
from core.hid_backend import MockHIDBackend
from core.normalizer import RockCandyNormalizer
from core.filters import KalmanFilter, DeadzoneManager
from core.telemetry import InputTelemetry
from core.pipeline import InputPipeline

def cybernetic_runtime_loop():
    print("🚀 Starting Cybernetic Input Runtime (Modular Pipeline)")

    # 1. Initialize Components
    hid = MockHIDBackend()
    normalizer = RockCandyNormalizer()
    telemetry = InputTelemetry()

    # 2. Setup Pipeline
    pipeline = InputPipeline(normalizer, telemetry)
    pipeline.add_filter(DeadzoneManager(base_deadzone=0.08))
    pipeline.add_filter(KalmanFilter(process_variance=1e-4, measurement_variance=1e-2))

    # 3. Listener for visualization
    def on_event(event):
        if event.input_id == "LX" and int(time.time() * 100) % 50 == 0:
            print(f"[Bus] {event.input_id}: {event.value:+.4f} (Poll: {event.poll_hz:.1f}Hz)")

    pipeline.add_listener(on_event)

    print("--- Polling device at 250Hz ---")

    try:
        count = 0
        while count < 500:
            raw = hid.read_raw()
            if raw:
                pipeline.process_raw(raw)
                count += 1
            else:
                time.sleep(0.001)

    except KeyboardInterrupt:
        pass
    finally:
        print("\n--- Final Runtime Telemetry ---")
        print(json.dumps(telemetry.get_stats(), indent=2))
        hid.close()

if __name__ == "__main__":
    cybernetic_runtime_loop()
