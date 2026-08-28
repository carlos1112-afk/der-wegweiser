import subprocess
import asyncio
from google.antigravity import Agent, LocalAgentConfig, GeminiAPIEndpoint

def get_gcloud_token():
    try:
        # Fetch the token from gcloud CLI
        result = subprocess.run(["gcloud", "auth", "print-access-token"], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print("Error fetching gcloud token. Ensure you have run 'gcloud auth login'.")
        return None

async def run_gcloud_agent():
    print("--- Running GCloud CLI Agent ---")
    token = get_gcloud_token()
    if not token:
        return

    # Use the gcloud token as a bearer token for Vertex AI or Gemini Developer API.
    # Note: Using the gcloud access token works best with Vertex AI.
    import os
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "your-gcp-project")
    
    config = LocalAgentConfig(
        model="gemini-3.6-flash",
        vertex=True,
        project=project_id,
        location="us-central1"
        # The Antigravity SDK automatically uses Google Auth (ADC) when vertex=True,
        # which utilizes the same credentials as 'gcloud auth application-default login'.
        # Passing the token explicitly here isn't strictly necessary for the SDK, 
        # but demonstrates the concept.
    )
    
    async with Agent(config=config) as agent:
        response = await agent.chat("Hallo, bist du der gcloud CLI Agent?")
        print("GCloud Agent:", await response.text())

if __name__ == "__main__":
    asyncio.run(run_gcloud_agent())
