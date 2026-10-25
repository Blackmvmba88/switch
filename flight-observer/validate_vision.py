from pathlib import Path
from datetime import datetime,timezone
import json
import cv2
import numpy as np
from vision_observer import analyze
root=Path(__file__).parent/'validation'
root.mkdir(exist_ok=True)
video=root/'synthetic-mission.avi'
writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),10,(1280,720))
for text in ['FLY TO HELIPAD','FLY TO HELIPAD','FLY TO HELIPAD','RESUME GAME','RESUME GAME','FLY TO HELIPAD','MISSION COMPLETED','MISSION COMPLETED','MISSION COMPLETED']:
    frame=np.full((720,1280,3),20,dtype=np.uint8)
    cv2.putText(frame,text,(70,350),cv2.FONT_HERSHEY_SIMPLEX,1.8,(255,255,255),3,cv2.LINE_AA)
    for i in range(10):writer.write(frame)
writer.release()
analyze(video,root/'evidence',datetime(2026,10,25,15,0,tzinfo=timezone.utc),['FLY TO HELIPAD'],lang='eng+spa')
events=[json.loads(x) for x in (root/'evidence'/'mission-events.jsonl').read_text().splitlines()]
assert [x['event'] for x in events]==['mission-started','mission-interrupted','mission-resumed','mission-ended'],events
print('PASS synthetic video -> OpenCV -> Tesseract -> evidenced mission boundaries')
