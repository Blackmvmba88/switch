"""Process completed native screenshots and link evidence to raw controller input."""
import json
import os
import signal
import sys
import time
from datetime import datetime,timezone
from pathlib import Path
import cv2
import numpy as np
from mission_boundaries import MissionBoundaries
from vision_observer import classify,read_frame
from summarize_session import summarize

root=Path(__file__).resolve().parent
session=Path(sys.argv[1])
config_path=root/'vision-config.json'
state=MissionBoundaries()
running=True
seen=set()
previous=None
last_meta=None
last_gap=None

def stop(*_):
    global running
    running=False
signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)

def atomic(path,obj):
    temporary=path.with_suffix('.tmp')
    temporary.write_text(json.dumps(obj,ensure_ascii=False,indent=2))
    temporary.replace(path)

def append(path,obj):
    with path.open('a') as handle:
        handle.write(json.dumps(obj,ensure_ascii=False)+'\n')

def emit(observation):
    append(session/'observations.jsonl',observation)
    for event in state.observe(observation):
        event['inputsFile']=str(session/'inputs.jsonl')
        append(session/'mission-events.jsonl',event)
        atomic(session/'latest-mission-event.json',event)

parent_pid=os.getppid()
while running and os.getppid()==parent_pid:
    paths=sorted((session/'frames').glob('*.json'))
    todo=[p for p in paths if p.name not in seen]
    if len(todo)>3:
        # Bound lag; skipped observations become an explicit unknown interval.
        for path in todo[:-3]:
            seen.add(path.name)
        latest_skipped=json.loads(todo[-4].read_text())
        emit({'at':latest_skipped['at'],'signal':'unknown','evidence':{'reason':'OCR backlog, skipped frames','metadata':str(todo[-4])}})
        todo=todo[-3:]
    for path in todo:
        try:
            meta=json.loads(path.read_text())
            config=json.loads(config_path.read_text())
            frame=cv2.imread(meta['image'])
            if frame is None:raise RuntimeError('Missing evidence image')
            text=read_frame(frame,config.get('language','eng+spa'))
            signal_name,matched=classify(text,config.get('active_cues',[]))
            thumb=cv2.resize(cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY),(160,90))
            delta=None if previous is None else float(np.mean(cv2.absdiff(thumb,previous)))
            previous=thumb
            observation={'at':meta['at'],'signal':signal_name,'evidence':{
                'image':meta['image'],'metadata':str(path),'ocrText':text,'matched':matched,
                'sceneDifference':delta,'inputSnapshot':meta['inputSnapshot'],
                'classification':'heuristic-needs-real-mission-validation'}}
            emit(observation)
            atomic(session/'vision-status.json',{'at':meta['at'],'signal':signal_name,
                'missionState':state.state,'missionId':state.mission,'ocrText':text,
                'activeCuesConfigured':bool(config.get('active_cues')),
                'calibrated':config.get('calibrated',False),'evidence':meta['image']})
            last_meta=meta;last_gap=None;seen.add(path.name)
        except Exception as error:
            append(session/'vision-errors.jsonl',{'at':datetime.now(timezone.utc).isoformat(),'metadata':str(path),'error':str(error)})
            seen.add(path.name)
    if last_meta and last_gap is None:
        now=datetime.now(timezone.utc)
        if (now-datetime.fromisoformat(last_meta['at'].replace('Z','+00:00'))).total_seconds()>8:
            emit({'at':now.isoformat(),'signal':'unknown','evidence':{'reason':'capture gap longer than 8 seconds','lastImage':last_meta['image']}})
            last_gap=now
    if todo:
        try:summarize(session)
        except Exception as error:
            append(session/'vision-errors.jsonl',{'error':'report: '+str(error)})
    time.sleep(.2)
