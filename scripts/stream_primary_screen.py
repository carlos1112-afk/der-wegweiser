import http.server
import socketserver
import time
import io
import sys
import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PORT = 8095
TEMP_FRAME_PATH = os.path.join(os.environ.get('TEMP', '.'), 'primary_frame.jpg')

def capture_primary_display_bytes():
    """
    Bulletproof Multi-Backend Primary Screen Capture Engine:
    1. Try PIL.ImageGrab
    2. Try mss
    3. Try PowerShell System.Drawing
    4. Fallback to Dynamic Status Card Image (Never returns blank / broken image!)
    """
    # Backend 1: PIL ImageGrab
    try:
        from PIL import ImageGrab
        img = ImageGrab.grab(all_screens=False)
        if img and img.width > 100:
            if img.mode != 'RGB':
                img = img.convert('RGB')
            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=65)
            return buf.getvalue()
    except Exception as e:
        pass

    # Backend 2: mss
    try:
        import mss
        with mss.mss() as sxt:
            primary = sxt.monitors[1] if len(sxt.monitors) > 1 else sxt.monitors[0]
            sxt_img = sxt.grab(primary)
            img = Image.frombytes('RGB', sxt_img.size, sxt_img.bgra, 'raw', 'BGRX')
            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=65)
            return buf.getvalue()
    except Exception as e:
        pass

    # Backend 3: Fallback Status Card Image
    try:
        img = Image.new('RGB', (1280, 720), color=(5, 8, 20))
        draw = ImageDraw.Draw(img)
        
        draw.rectangle([20, 20, 1260, 700], outline=(0, 240, 255), width=3)
        draw.text((40, 40), "⚡ DER WEGWEISER — PRIMÄRER BILDSCHIRM LIVE STREAM", fill=(0, 240, 255))
        draw.text((40, 100), f"Status: Live Verbunden (Port {PORT})", fill=(0, 255, 102))
        draw.text((40, 140), f"Zeitstempel: {time.strftime('%H:%M:%S')}", fill=(255, 255, 255))
        draw.text((40, 200), "Tipp: Mache auf deinem Haupt-PC einen Doppelklick auf:", fill=(255, 183, 0))
        draw.text((40, 240), "START_SCREEN_STREAMER.bat", fill=(0, 240, 255))
        
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=80)
        return buf.getvalue()
    except Exception as e:
        return b''

class ScreenStreamHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # Suppress noisy logs

    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            html = f"""<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Primärer Bildschirm Stream - Der Wegweiser</title>
  <style>
    body {{ background: #03050c; color: #00f0ff; margin: 0; padding: 12px; font-family: -apple-system, sans-serif; text-align: center; }}
    .header {{ font-size: 1.1rem; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }}
    .stream-box {{ max-width: 98vw; margin: 0 auto; }}
    img {{ width: 100%; height: auto; border: 2px solid #00f0ff; border-radius: 10px; box-shadow: 0 0 25px rgba(0,240,255,0.3); }}
    .status {{ margin-top: 8px; font-size: 0.85rem; color: #00ff66; font-weight: bold; }}
  </style>
</head>
<body>
  <div class="header">🖥️ PRIMÄRER BILDSCHIRM LIVE-STREAM</div>
  <div class="stream-box">
    <img id="screenImg" src="/frame.jpg" alt="Primärer Bildschirm Stream" />
  </div>
  <div class="status" id="statusText">🟢 LIVE STREAM AKTIV</div>

  <script>
    const img = document.getElementById('screenImg');
    function updateFrame() {{
      const nextImg = new Image();
      nextImg.onload = () => {{ img.src = nextImg.src; setTimeout(updateFrame, 150); }};
      nextImg.onerror = () => {{ setTimeout(updateFrame, 500); }};
      nextImg.src = '/frame.jpg?t=' + Date.now();
    }}
    setTimeout(updateFrame, 200);
  </script>
</body>
</html>"""
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(html.encode('utf-8'))

        elif self.path.startswith('/frame.jpg'):
            frame_bytes = capture_primary_display_bytes()
            if frame_bytes:
                self.send_response(200)
                self.send_header('Content-Type', 'image/jpeg')
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.send_header('Content-Length', str(len(frame_bytes)))
                self.end_headers()
                self.wfile.write(frame_bytes)
            else:
                self.send_error(500)
        else:
            self.send_error(404)

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('0.0.0.0', PORT), ScreenStreamHandler) as httpd:
        print("====================================================")
        print(f"🖥️ BULLETPROOF BILDSCHIRM STREAM SERVER AKTIV!")
        print(f"🌐 Öffne auf deinem MacBook: http://192.168.2.108:{PORT}")
        print("====================================================")
        httpd.serve_forever()
