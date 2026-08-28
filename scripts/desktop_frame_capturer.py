import time
import os
import io
import sys
from PIL import ImageGrab, Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

TEMP_FRAME_PATH = os.path.join(os.environ.get('TEMP', '.'), 'active_screen.jpg')

print("====================================================")
print("📸 ECHTER BILDSCHIRM CAPTURER LAUFT IN DEINER SITZUNG!")
print(f"📁 Ziel: {TEMP_FRAME_PATH}")
print("====================================================")

while True:
    try:
        # Capture Primary Screen in User's Active Desktop Session
        img = ImageGrab.grab(all_screens=False)
        if img:
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Save frame directly to temp file
            img.save(TEMP_FRAME_PATH, format='JPEG', quality=65)
    except Exception as e:
        print(f"⚠️ Capture retry: {e}")

    time.sleep(0.15) # ~6.5 FPS
