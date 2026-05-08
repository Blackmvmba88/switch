import time

class InputPipeline:
    """
    Decoupled Pipeline that orchestrates the flow of input data.
    Flow: HID -> Normalizer -> [Filters] -> Telemetry -> [Output]
    """
    def __init__(self, normalizer, telemetry):
        self.normalizer = normalizer
        self.telemetry = telemetry
        self.filters = []
        self.listeners = []

    def add_filter(self, filter_obj):
        self.filters.append(filter_obj)

    def add_listener(self, listener_func):
        self.listeners.append(listener_func)

    def process_raw(self, raw_packet):
        # Measure packet timing at the start of process
        self.telemetry.mark_packet()

        stats = self.telemetry.get_stats()
        poll_hz = stats.get("poll_hz", 0)

        events = self.normalizer.normalize(raw_packet, poll_hz=poll_hz)

        processed_events = []
        for event in events:
            # Apply filters in sequence
            val = event.value
            for f in self.filters:
                if hasattr(f, 'apply'):
                    val = f.apply(val)
                elif hasattr(f, 'update'):
                    val = f.update(val)

            event.value = val
            processed_events.append(event)

            # Notify listeners
            for listener in self.listeners:
                listener(event)

        return processed_events
