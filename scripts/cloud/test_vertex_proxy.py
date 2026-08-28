import requests
import json

def test_proxy():
    url = "http://127.0.0.1:1337/v1/chat/completions"
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": "gemini-2.5-flash",
        "messages": [
            {"role": "user", "content": "Hallo! Bist du bereit für Arena 3?"}
        ],
        "temperature": 0.7
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        print("Status Code:", response.status_code)
        print("Response JSON:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print("Error connecting to proxy:", e)

if __name__ == "__main__":
    test_proxy()
