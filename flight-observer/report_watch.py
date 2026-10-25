import json
import time
from pathlib import Path
from summarize_session import summarize
root=Path(__file__).resolve().parent
print('Flight Observer: automatic report refresh started',flush=True)
while True:
    try:
        status=json.loads((root/'status.json').read_text())
        summarize(Path(status['session']))
    except (FileNotFoundError,json.JSONDecodeError,OSError):pass
    time.sleep(5)
