"""OpenCV + Tesseract observation of recorded simulator video.

No screen capture or input injection. Video must contain only the intended game.
Start signatures require calibration; unknown frames never create boundaries.
"""
import argparse
import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
import cv2
import numpy as np
import pytesseract
import shutil
import os
import shlex
pytesseract.pytesseract.tesseract_cmd = shutil.which("tesseract") or "/opt/homebrew/bin/tesseract"
from mission_boundaries import MissionBoundaries


def normalized(text):
    return re.sub(r'\s+', ' ', ''.join(c for c in unicodedata.normalize('NFD',text.lower()) if unicodedata.category(c)!='Mn')).strip()


def classify(text, start_patterns=()):
    text=normalized(text)
    if all(phrase in text for phrase in ('reiniciar', 'finalizar vuelo', 'menu principal')):
        return 'paused', 'pause-menu: reiniciar + finalizar vuelo + menu principal'
    # Pause/connection warnings outrank all background text.
    groups=[('stream_lost',('disconnected','conexion perdida','connection lost','reconectando')),
      ('paused',('seguir jugando','continue playing','resume game','reanudar','juego en pausa','pause menu')),
      ('menu',('abandon mission?','quit mission?','abandonar la mision?','salir de la mision?')),
      ('mission_failed',('mission failed','mision fallida','mision fracasada','you crashed','te has estrellado')),
      ('results',('mission completed','mission complete','mision completada','mision cumplida','mission results','resultados de la mision','actividad completada','activity completed','vuelo completado','flight completed')),
      ('abandoned',('mission abandoned','mision abandonada')),
      ('loading',('loading','cargando')),
      ('menu',('ready to fly','listo para volar','start mission','iniciar mision'))]
    for signal, phrases in groups:
        for phrase in phrases:
            if phrase in text:
                return signal, phrase
    # The observed H125 mission HUD combines task steps and flight instruments.
    task_panel = 'pasos de la mision' in text or 'mission steps' in text
    instruments = sum(word in text for word in ('airspeed','altitude','power'))
    if task_panel and instruments >= 2:
        return 'pilot_control', 'active-mission-HUD: task steps + flight instruments'
    # Bare cockpit instruments never establish a mission boundary.
    for phrase in start_patterns:
        phrase=normalized(phrase)
        if phrase and phrase in text:
            return 'pilot_control',phrase
    return 'unknown',None


def read_frame(frame, lang='eng'):
    models=Path(os.environ.get('FLIGHT_OBSERVER_TESSDATA',str(Path(__file__).parent/'tessdata')))
    if not models.is_dir():
        models=Path.home()/'Flight-Observer'/'tessdata'
    data_option=' --tessdata-dir '+shlex.quote(str(models))
    gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
    # Retain full scene evidence; enlarge text on small streams.
    if gray.shape[1]<1600:
        gray=cv2.resize(gray,None,fx=2,fy=2,interpolation=cv2.INTER_CUBIC)
    gray=cv2.createCLAHE(clipLimit=2.0,tileGridSize=(8,8)).apply(gray)
    words=pytesseract.image_to_data(gray,lang=lang,config='--psm 11'+data_option,output_type=pytesseract.Output.DICT,timeout=5)
    accepted=[t for t,c in zip(words['text'],words['conf']) if t.strip() and float(c)>=55]
    text = ' '.join(accepted)
    h,w=frame.shape[:2]
    menu=frame[int(h*.30):int(h*.72),int(w*.74):]
    if menu.size:
        text += ' ' + pytesseract.image_to_string(menu,lang=lang,config='--psm 6'+data_option,timeout=5)
    return text


def analyze(video,out,start_at,start_patterns,interval=1,lang='eng'):
    out.mkdir(parents=True,exist_ok=True)
    capture=cv2.VideoCapture(str(video))
    if not capture.isOpened(): raise RuntimeError('Cannot open video')
    detector=MissionBoundaries()
    previous=None
    index=0
    try:
        with (out/'observations.jsonl').open('w') as observations, (out/'mission-events.jsonl').open('w') as events:
            while True:
                seconds=index*interval
                capture.set(cv2.CAP_PROP_POS_MSEC,seconds*1000)
                ok,frame=capture.read()
                if not ok:break
                thumb=cv2.resize(cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY),(160,90))
                delta=None if previous is None else float(np.mean(cv2.absdiff(thumb,previous)))
                previous=thumb
                text=read_frame(frame,lang)
                signal,matched=classify(text,start_patterns)
                image=out/f'frame-{index:06d}.jpg'
                if not cv2.imwrite(str(image),frame):raise RuntimeError('Cannot save evidence frame')
                observation={'at':(start_at+timedelta(seconds=seconds)).isoformat(), 'signal':signal,
                  'evidence':{'image':str(image.resolve()),'video':str(video.resolve()),'videoSeconds':seconds,
                    'ocrText':text,'matched':matched,'sceneDifference':delta,'classification':'heuristic-needs-calibration'}}
                observations.write(json.dumps(observation,ensure_ascii=False)+'\n');observations.flush()
                for event in detector.observe(observation):
                    events.write(json.dumps(event,ensure_ascii=False)+'\n');events.flush()
                    print(json.dumps(event,ensure_ascii=False),flush=True)
                index+=1
    finally:capture.release()
    print(json.dumps({'analyzedFrames':index,'output':str(out),'liveCapture':False}))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('video',type=Path)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--start-at',required=True,help='Actual video recording start, ISO 8601 with timezone')
    parser.add_argument('--active-cue',action='append',default=[],help='Calibrated active-mission text, never a start button')
    parser.add_argument('--lang',default='eng')
    args=parser.parse_args()
    start=datetime.fromisoformat(args.start_at.replace('Z','+00:00'))
    if start.tzinfo is None:parser.error('--start-at must include timezone')
    analyze(args.video,args.out,start,args.active_cue,lang=args.lang)
