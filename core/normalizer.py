import time

class InputEvent:
    """
    Normalized Signal Bus Event.
    """
    def __init__(self, device, input_id, value, poll_hz=0):
        self.device = device
        self.input_id = input_id
        self.value = value
        self.timestamp = time.time()
        self.poll_hz = poll_hz

    def to_dict(self):
        return {
            "device": self.device,
            "input": self.input_id,
            "value": round(self.value, 4),
            "timestamp": self.timestamp,
            "poll_hz": self.poll_hz
        }

class RockCandyNormalizer:
    """
    Translates raw bytes from Rock Candy for Nintendo Switch to Normalized Events.
    """
    def __init__(self):
        self.device_name = "rock_candy_switch"

    def normalize(self, raw_packet, poll_hz=0):
        if not raw_packet or len(raw_packet) < 5:
            return []

        events = []

        # Byte 3: LX (0-255, center 128) -> map to [-1.0, 1.0]
        lx_raw = raw_packet[3]
        lx_norm = (lx_raw - 128) / 128.0
        events.append(InputEvent(self.device_name, "LX", lx_norm, poll_hz))

        # Byte 4: LY (0-255, center 128) -> map to [-1.0, 1.0]
        ly_raw = raw_packet[4]
        ly_norm = (ly_raw - 128) / 128.0
        events.append(InputEvent(self.device_name, "LY", ly_norm, poll_hz))

        return events
