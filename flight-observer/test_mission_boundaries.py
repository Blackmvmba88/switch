import unittest
from mission_boundaries import MissionBoundaries

class BoundariesTest(unittest.TestCase):
    def setUp(self): self.detector = MissionBoundaries()
    def feed(self, second, signal):
        return self.detector.observe({'at':f'2026-10-25T14:30:{second:02d}Z',
          'signal':signal,'evidence':{'frame':f'frame-{second}.png'}})
    def start(self):
        self.assertEqual(self.feed(0,'pilot_control'), [])
        return self.feed(2,'pilot_control')[0]
    def test_mission_pause_resume_end_and_next(self):
        start = self.start()
        self.assertEqual(start['event'],'mission-started')
        self.assertEqual(start['at'],'2026-10-25T14:30:00Z')
        self.assertEqual(self.feed(3,'paused')[0]['event'],'mission-interrupted')
        self.assertEqual(self.feed(4,'stream_lost'),[])
        self.assertEqual(self.feed(5,'pilot_control')[0]['missionId'],start['missionId'])
        self.assertEqual(self.feed(6,'results'),[])
        end = self.feed(8,'results')[0]
        self.assertEqual(end['event'],'mission-ended')
        self.assertEqual(end['missionId'],start['missionId'])
        self.assertEqual(self.feed(9,'results'),[])
        self.feed(10,'pilot_control')
        self.assertNotEqual(self.feed(12,'pilot_control')[0]['missionId'],start['missionId'])
    def test_no_end_for_idle_unknown_or_loading(self):
        self.start()
        for i, signal in enumerate(['unknown','loading','stream_lost','paused'],3):
            self.assertFalse(any(e['event']=='mission-ended' for e in self.feed(i,signal)))
    def test_transient_results_not_terminal(self):
        self.start();self.feed(3,'results');self.feed(4,'pilot_control')
        self.assertIsNotNone(self.detector.mission)
    def test_no_start_from_paused_or_menu(self):
        self.assertEqual(self.feed(0,'paused'),[])
        self.assertEqual(self.feed(2,'menu'),[])
    def test_evidence_required(self):
        with self.assertRaises(ValueError):
            self.detector.observe({'at':'2026-10-25T15:00:00Z','signal':'pilot_control'})
    def test_stale_evidence_not_confirmation(self):
        self.feed(0,'pilot_control');self.assertEqual(self.feed(20,'pilot_control'),[])
    def test_failure_end(self):
        self.start();self.feed(3,'mission_failed')
        self.assertEqual(self.feed(5,'mission_failed')[0]['reason'],'mission_failed')

if __name__ == '__main__': unittest.main()
