"""Segment missions from timestamped, evidenced game-state observations.

This module never interprets controller activity as a mission boundary.
Feed JSONL observations on stdin; derived lifecycle events are emitted on stdout.
The visual/telemetry provider must supply the classified observations.
"""
import json
import sys
import uuid
from datetime import datetime

class MissionBoundaries:
    def __init__(self):
        self.mission = None
        self.state = 'waiting'
        self.candidate = None
        self.last_at = None

    def observe(self, observation):
        at = observation['at']
        instant = datetime.fromisoformat(at.replace('Z', '+00:00'))
        if instant.tzinfo is None:
            raise ValueError('Observation requires timezone')
        if self.last_at is not None and instant <= self.last_at:
            raise ValueError('Observations must have increasing timestamps')
        self.last_at = instant
        signal = observation['signal']
        evidence = observation.get('evidence')
        if not evidence:
            raise ValueError('Evidence is required')
        if signal in {'unknown', 'loading', 'stream_lost', 'paused'}:
            self.candidate = None
            if self.mission and self.state != 'interrupted':
                self.state = 'interrupted'
                return [self.event('mission-interrupted', at, signal, evidence)]
            return []
        if signal == 'pilot_control':
            if self.mission:
                self.candidate = None
                if self.state == 'interrupted':
                    self.state = 'active'
                    return [self.event('mission-resumed', at, signal, evidence)]
                return []
            kind = 'mission-started'
        elif signal in {'results', 'mission_failed', 'abandoned'}:
            if not self.mission:
                self.candidate = None
                return []
            kind = 'mission-ended'
        else:
            self.candidate = None
            return []
        if not self.candidate or self.candidate['signal'] != signal:
            self.candidate = {'signal': signal, 'at': at, 'instant': instant, 'evidence': evidence}
            return []
        # Confirm sustained evidence, preserving the first observation as boundary.
        duration = (instant - self.candidate['instant']).total_seconds()
        if duration < 1:
            return []
        if duration > 5:
            self.candidate = {'signal': signal, 'at': at, 'instant': instant, 'evidence': evidence}
            return []
        candidate = self.candidate
        self.candidate = None
        if kind == 'mission-started':
            self.mission = str(uuid.uuid4())
            self.state = 'active'
        result = self.event(kind, candidate['at'], signal,
                            {'first': candidate['evidence'], 'confirmation': evidence})
        result['confirmedAt'] = at
        result['boundaryBasis'] = 'first-observed-active' if kind == 'mission-started' else 'observed-terminal-screen'
        result['exactMissionStartVerified'] = False
        if kind == 'mission-ended':
            self.mission = None
            self.state = 'waiting'
        return [result]

    def event(self, kind, at, reason, evidence):
        return {'event':kind, 'missionId':self.mission, 'at':at,
                'reason':reason, 'evidence':evidence}

if __name__ == '__main__':
    detector = MissionBoundaries()
    for line in sys.stdin:
        if line.strip():
            for event in detector.observe(json.loads(line)):
                print(json.dumps(event, ensure_ascii=False), flush=True)
