import base64
import re

with open(r'C:\Users\paulo\.gemini\antigravity-ide\brain\45938aa3-66f6-47c8-9064-184a41c5926a\.system_generated\steps\533\output.txt', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'data:image/jpeg;base64,([A-Za-z0-9+/=]+)', text)
if m:
    b64 = m.group(1)
    data = base64.b64decode(b64)
    with open(r'c:\.PROJETOS.ANTIGRAVITY\SANTINHO.4333\public\colinha_canvas_gerada.jpg', 'wb') as out:
        out.write(data)
    print('SUCCESS, size:', len(data))
else:
    print('No match')
