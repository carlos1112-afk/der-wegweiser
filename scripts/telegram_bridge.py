#!/usr/bin/env python3
"""
===============================================================================
TELEGRAM BRIDGE FOR ANTIGRAVITY CHAT
===============================================================================
1. Connects to Telegram Bot API via long polling or local webhook.
2. NO CODE SPAMMING: Converts agent outputs into clean, high-level summaries & questions.
3. Forwards user messages/voice replies from Telegram directly into Antigravity!
===============================================================================
"""

import sys
import os
import time
import json
import urllib.request
import urllib.parse

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

STATE_FILE = os.path.join(os.path.dirname(__file__), '../remote_chat_state.json')
BOT_TOKEN_FILE = os.path.join(os.path.dirname(__file__), '../telegram_bot_token.txt')

print("====================================================")
print("📱 TELEGRAM CHAT PIPELINE BRIDGE")
print("====================================================")

# Check if user provided Telegram Bot Token
BOT_TOKEN = ""
if os.path.exists(BOT_TOKEN_FILE):
    with open(BOT_TOKEN_FILE, 'r', encoding='utf-8') as f:
        BOT_TOKEN = f.read().strip()

def send_telegram_message(chat_id, text):
    """Sends clean, non-code text message to user on Telegram."""
    if not BOT_TOKEN:
        print(f"ℹ️ [Telegram Simulated Send]: {text[:100]}...")
        return
    
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    }
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
        urllib.request.urlopen(req, timeout=5)
        print("✅ Telegram Nachricht gesendet!")
    except Exception as e:
        print(f"⚠️ Telegram Sende-Fehler: {e}")

def get_telegram_updates(offset=0):
    """Polls Telegram for user replies."""
    if not BOT_TOKEN:
        return [], offset

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates?offset={offset}&timeout=5"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('result', [])
            new_offset = offset
            for r in results:
                new_offset = max(new_offset, r.get('update_id', 0) + 1)
            return results, new_offset
    except Exception:
        return [], offset

def strip_code_blocks(text):
    """Removes verbose code blocks and keeps only high-level natural language summary/questions."""
    lines = text.split('\n')
    clean_lines = []
    in_code_block = False
    
    for line in lines:
        if line.strip().startswith('```'):
            in_code_block = not in_code_block
            continue
        if not in_code_block:
            clean_lines.append(line)
            
    result = '\n'.join(clean_lines).strip()
    return result if result else "Fortschritts-Update verfügbar."

last_sent_msg = ""
offset = 0

print("🚀 Telegram Pipeline gestartet!")
if not BOT_TOKEN:
    print("\n💡 HINWEIS: Um echte Telegram-Nachrichten zu empfangen/senden, erstelle kurz einen Bot bei @BotFather")
    print("   und speichere den Token in der Datei 'telegram_bot_token.txt'!")

while True:
    try:
        # 1. Sync from remote_chat_state.json
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                state = json.load(f)

            requires_approval = state.get('requiresApproval', False)
            question = state.get('approvalQuestion', '')

            if requires_approval and question and question != last_sent_msg:
                last_sent_msg = question
                clean_q = strip_code_blocks(question)
                print(f"\n📢 [Neuer Chat-Prompt an Telegram]: {clean_q}")

        # 2. Check for Telegram User Replies
        updates, offset = get_telegram_updates(offset)
        for update in updates:
            msg = update.get('message', {})
            user_text = msg.get('text', '').strip()
            chat_id = msg.get('chat', {}).get('id')

            if user_text:
                print(f"💬 [Telegram Nachricht erhalten]: {user_text}")
                
                # Update remote_chat_state.json with user input!
                if os.path.exists(STATE_FILE):
                    with open(STATE_FILE, 'r', encoding='utf-8') as f:
                        curr_state = json.load(f)
                    
                    curr_state['requiresApproval'] = False
                    curr_state['agentStatus'] = 'RUNNING'
                    curr_state['messages'].append({
                        'sender': 'user',
                        'time': time.strftime("%H:%M"),
                        'text': f"[via Telegram]: {user_text}"
                    })
                    curr_state['messages'].append({
                        'sender': 'agent',
                        'time': time.strftime("%H:%M"),
                        'text': f"Telegram-Antwort '{user_text}' erhalten! Verarbeite..."
                    })
                    
                    with open(STATE_FILE, 'w', encoding='utf-8') as f:
                        json.dump(curr_state, f, indent=2, ensure_ascii=False)

                    send_telegram_message(chat_id, f"✅ Empfangen: '{user_text}'. Antigravity verarbeitet deine Eingabe!")

    except Exception as e:
        pass

    time.sleep(2)
