import time
import json
import csv
from core.hid_backend import MockHIDBackend
from core.normalizer import RockCandyNormalizer
from core.telemetry import InputTelemetry
from core.pipeline import InputPipeline

def record_session(duration_sec=5, filename="experiments/dataset_raw.csv"):
    print(f"🔴 Recording session for {duration_sec}s...")

    hid = MockHIDBackend()
    normalizer = RockCandyNormalizer()
    telemetry = InputTelemetry()
    pipeline = InputPipeline(normalizer, telemetry)

    data = []

    def csv_listener(event):
        data.append([
            event.timestamp,
            event.device,
            event.input_id,
            event.value,
            event.poll_hz
        ])

    pipeline.add_listener(csv_listener)

    start = time.time()
    try:
        while time.time() - start < duration_sec:
            raw = hid.read_raw()
            if raw:
                pipeline.process_raw(raw)
            else:
                time.sleep(0.001)
    finally:
        with open(filename, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "device", "input", "value", "poll_hz"])
            writer.writerows(data)

        print(f"✅ Saved {len(data)} events to {filename}")
        print("Final Telemetry:", json.dumps(telemetry.get_stats(), indent=2))
        hid.close()

if __name__ == "__main__":
    record_session()
