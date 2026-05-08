import time
import json
from collections import deque

class InputTelemetry:
    """
    Advanced Telemetry Engine for Cybernetic Input Runtime.
    Focuses on Polling Rate, Jitter, and Packet Timing.
    """
    def __init__(self, window_size=1000):
        self.history = deque(maxlen=window_size)
        self.start_time = time.time()
        self.last_packet_time = None
        self.intervals = deque(maxlen=window_size)

    def mark_packet(self):
        now = time.time()
        if self.last_packet_time is not None:
            interval = now - self.last_packet_time
            self.intervals.append(interval)
        self.last_packet_time = now

    def record_event(self, event_dict):
        # Store event for dataset recording if needed
        pass

    def get_stats(self):
        if not self.intervals:
            return {"status": "no_data"}

        avg_interval = sum(self.intervals) / len(self.intervals)
        polling_rate = 1.0 / avg_interval if avg_interval > 0 else 0

        # Jitter: standard deviation of intervals
        variance = sum((x - avg_interval) ** 2 for x in self.intervals) / len(self.intervals)
        jitter = variance ** 0.5

        return {
            "uptime": round(time.time() - self.start_time, 2),
            "poll_hz": round(polling_rate, 2),
            "avg_interval_ms": round(avg_interval * 1000, 4),
            "jitter_ms": round(jitter * 1000, 4),
            "sample_count": len(self.intervals)
        }
