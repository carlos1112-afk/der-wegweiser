import os
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
import httpx
from google import genai
from google.genai import types
from contextlib import asynccontextmanager
import json
import asyncio
import time
import sys

# Idle timeout in seconds (default: 300s / 5 minutes). Can be set via IDLE_TIMEOUT env var.
IDLE_TIMEOUT = int(os.environ.get("IDLE_TIMEOUT", 300))
last_request_time = time.time()

def update_activity():
    global last_request_time
    last_request_time = time.time()

async def idle_checker():
    """Monitors activity and automatically exits when idle for longer than IDLE_TIMEOUT."""
    print(f"[Vertex Proxy] Idle auto-shutdown timer active (Timeout: {IDLE_TIMEOUT}s)")
    while True:
        await asyncio.sleep(5)
        idle_duration = time.time() - last_request_time
        if idle_duration >= IDLE_TIMEOUT:
            print(f"[Vertex Proxy] No activity detected for {int(idle_duration)}s (limit: {IDLE_TIMEOUT}s). Shutting down automatically...")
            os._exit(0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(idle_checker())
    yield

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Vertex AI OpenAI-Compatible Proxy", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

proxy_stats = {
    "total_requests": 0,
    "local_requests": 0,
    "fallback_requests": 0
}

client = None

def get_client():
    global client
    if client is None:
        client = genai.Client(vertexai=True, project="der-wegweiser", location="us-central1")
    return client

def extract_text_from_content(content):
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(item.get("text", ""))
                elif "text" in item:
                    parts.append(str(item["text"]))
        return "\n".join(parts)
    return str(content) if content is not None else ""

@app.get("/v1/models")
async def list_models():
    update_activity()
    return {
        "object": "list",
        "data": [
            {
                "id": "gemini-2.5-flash",
                "object": "model",
                "created": 1700000000,
                "owned_by": "google"
            },
            {
                "id": "gemini-2.5-pro",
                "object": "model",
                "created": 1700000000,
                "owned_by": "google"
            }
        ]
    }

@app.get("/v1/proxy/stats")
async def get_stats():
    return JSONResponse(content=proxy_stats)

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    update_activity()
    proxy_stats["total_requests"] += 1
    
    body = await request.json()
    stream = body.get("stream", False)
    
    local_url = os.environ.get("LOCAL_LLAMA_URL", "http://127.0.0.1:8080/v1/chat/completions")
    
    try:
        if stream:
            async def try_local_stream():
                client = httpx.AsyncClient()
                try:
                    req = client.build_request("POST", local_url, json=body, timeout=3.0)
                    resp = await client.send(req, stream=True)
                    if resp.status_code == 200:
                        proxy_stats["local_requests"] += 1
                        async def stream_generator():
                            async for chunk in resp.aiter_bytes():
                                update_activity()
                                yield chunk
                            await client.aclose()
                        return True, StreamingResponse(stream_generator(), media_type="text/event-stream")
                    else:
                        await client.aclose()
                except Exception as e:
                    await client.aclose()
                    print(f"[Vertex Proxy] Local backend failed: {e}")
                return False, None
                
            success, response = await try_local_stream()
            if success:
                return response
        else:
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(local_url, json=body, timeout=3.0)
                    if resp.status_code == 200:
                        proxy_stats["local_requests"] += 1
                        return JSONResponse(status_code=resp.status_code, content=resp.json())
                except Exception as e:
                    print(f"[Vertex Proxy] Local backend failed: {e}")
    except Exception:
        pass

    # 2) Fallback to OpenRouter
    print("[Vertex Proxy] Falling back to OpenRouter...")
    proxy_stats["fallback_requests"] += 1
    openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    
    # Overwrite model for OpenRouter fallback
    body["model"] = "google/gemini-2.5-flash:free"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json"
    }

    if stream:
        async def fallback_stream_generator():
            client = httpx.AsyncClient()
            try:
                req = client.build_request("POST", openrouter_url, json=body, headers=headers, timeout=30.0)
                resp = await client.send(req, stream=True)
                async for chunk in resp.aiter_bytes():
                    update_activity()
                    yield chunk
            except Exception as e:
                print(f"[Vertex Proxy] OpenRouter fallback failed: {e}")
                err_data = json.dumps({"error": {"message": f"Proxy Fallback Exception: {str(e)}", "type": "proxy_error"}})
                yield f"data: {err_data}\n\ndata: [DONE]\n\n".encode("utf-8")
            finally:
                await client.aclose()
        return StreamingResponse(fallback_stream_generator(), media_type="text/event-stream")
    else:
        async with httpx.AsyncClient() as client:
            fb_resp = await client.post(openrouter_url, json=body, headers=headers, timeout=30.0)
            try:
                content = fb_resp.json()
            except:
                content = fb_resp.text
            return JSONResponse(status_code=fb_resp.status_code, content=content)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 1337))
    print(f"Starting Vertex Proxy on port {port} (Idle Timeout: {IDLE_TIMEOUT}s)...")
    uvicorn.run(app, host="127.0.0.1", port=port)
