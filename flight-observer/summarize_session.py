import html
import json
import sys
from pathlib import Path
from collections import Counter

def lines(path):
    if not path.exists():return []
    result=[]
    for line in path.read_text().splitlines():
        try:result.append(json.loads(line))
        except json.JSONDecodeError:pass
    return result

def summarize(session):
    inputs=lines(session/'inputs.jsonl')
    events=lines(session/'mission-events.jsonl')
    observations=lines(session/'observations.jsonl')
    ranges=[]
    presses=Counter()
    previous={}
    devices=set()
    for record in inputs:
        for pad in record.get('controllers',[]):
            devices.add(pad.get('category','unknown'))
            for i,value in enumerate(pad.get('axes',[])):
                if i>=len(ranges):ranges.append([value,value])
                ranges[i]=[min(ranges[i][0],value),max(ranges[i][1],value)]
            for name,value in pad.get('buttons',{}).items():
                key=(pad.get('category'),pad.get('device'),name)
                if value>.5 and previous.get(key,0)<=.5:presses[name]+=1
                previous[key]=value
    summary={'session':session.name,'devices':sorted(devices),'inputChanges':sum(x.get('event')=='input-change' for x in inputs),
             'axisRanges':ranges,'buttonPresses':dict(presses),'imagesAnalyzed':len(observations),
             'visualStates':dict(Counter(x['signal'] for x in observations)),
             'missionEvents':[{k:e[k] for k in ('event','at','reason','missionId') if k in e} for e in events],
             'exactMissionStartVerified':False,'flightReproductionImplemented':False}
    (session/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    rows=[]
    for event in events:
        evidence=event.get('evidence',{})
        evidence=evidence.get('first',evidence)
        image=evidence.get('image')
        relative=Path(image).relative_to(session).as_posix() if image and Path(image).is_relative_to(session) else None
        link=f'<a href="{html.escape(relative)}">Ver evidencia</a>' if relative else ''
        rows.append('<tr>'+''.join('<td>'+html.escape(str(event.get(key,'')))+'</td>' for key in ('at','event','reason'))+'<td>'+link+'</td></tr>')
    page='''<!doctype html><meta charset="utf-8"><title>Flight Observer · Evidencia</title><style>body{max-width:1050px;margin:40px auto;background:#111827;color:#f3f4f6;font:16px system-ui}a{color:#6bf5d2}td,th{text-align:left;padding:12px;border-bottom:1px solid #475569}pre{white-space:pre-wrap}p{line-height:1.6}</style><h1>Observación del manejo</h1><p>Las entradas y las imágenes se registran con tiempos del mismo equipo. La primera observación activa no demuestra el comienzo exacto del vuelo. La detección visual es heurística; consulta las imágenes.</p><h2>Evidencia capturada</h2><pre>'''+html.escape(json.dumps({k:v for k,v in summary.items() if k!='missionEvents'},ensure_ascii=False,indent=2))+'''</pre><h2>Secuencia observada</h2><table><tr><th>Hora</th><th>Evento</th><th>Señal</th><th>Imagen</th></tr>'''+''.join(rows)+'''</table><p>Este informe no implica aprendizaje ni reproducción automática del vuelo.</p>'''
    (session/'report.html').write_text(page)
    return summary
if __name__=='__main__':print(json.dumps(summarize(Path(sys.argv[1]).resolve()),ensure_ascii=False))
