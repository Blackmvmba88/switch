import unittest
from core.filters import KalmanFilter, DeadzoneManager
from core.normalizer import RockCandyNormalizer

class TestCyberneticCore(unittest.TestCase):
    def test_deadzone(self):
        dm = DeadzoneManager(base_deadzone=0.1)
        self.assertEqual(dm.apply(0.05), 0.0)
        self.assertEqual(dm.apply(0.15), 0.15)
        self.assertEqual(dm.apply(-0.05), 0.0)

    def test_kalman_stability(self):
        kf = KalmanFilter(process_variance=1e-5, measurement_variance=1e-2)
        # Steady input should converge
        val = 0
        for _ in range(100):
            val = kf.update(0.5)
        self.assertAlmostEqual(val, 0.5, places=2)

    def test_normalization(self):
        norm = RockCandyNormalizer()
        # Mock packet: ReportID, ButtonsX2, LX=255 (Full Right), LY=0 (Full Up)
        packet = [0, 0, 0, 255, 0]
        events = norm.normalize(packet)
        lx = next(e for e in events if e.input_id == "LX")
        ly = next(e for e in events if e.input_id == "LY")
        self.assertAlmostEqual(lx.value, 0.992, places=2)
        self.assertAlmostEqual(ly.value, -1.0, places=2)

if __name__ == "__main__":
    unittest.main()
