import time
import hid

class HIDBackend:
    """
    Hardware Abstraction Layer for HID devices.
    """
    def __init__(self, vid=None, pid=None):
        self.vid = vid
        self.pid = pid
        self.device = None
        self.is_connected = False

    def list_devices(self):
        return hid.enumerate()

    def open(self, vid=None, pid=None):
        vid = vid or self.vid
        pid = pid or self.pid
        try:
            self.device = hid.device()
            self.device.open(vid, pid)
            self.device.set_nonblocking(True)
            self.is_connected = True
            return True
        except Exception as e:
            print(f"Error opening device {vid}:{pid}: {e}")
            return False

    def read_raw(self, size=64):
        if not self.device:
            return None
        return self.device.read(size)

    def close(self):
        if self.device:
            self.device.close()
            self.is_connected = False

class MockHIDBackend(HIDBackend):
    """
    High-fidelity Mock for environments without physical hardware.
    Simulates real timing, jitter, and noise.
    """
    def __init__(self, vid=0x0E6F, pid=0x0187):
        super().__init__(vid, pid)
        self.is_connected = True
        self._last_read = time.time()
        self._polling_rate = 250 # Hz

    def read_raw(self, size=64):
        # Simulate 250Hz timing
        now = time.time()
        elapsed = now - self._last_read
        if elapsed < (1.0 / self._polling_rate):
            return None

        self._last_read = now

        # Simulate a Switch Rock Candy packet (simplified)
        # Byte 0: Report ID, Bytes 1-2: Buttons, Byte 3: LX, Byte 4: LY...
        packet = [0] * size
        import random
        # Random noise on LX (Byte 3) and LY (Byte 4)
        packet[3] = 128 + random.randint(-2, 2)
        packet[4] = 128 + random.randint(-2, 2)
        return packet
