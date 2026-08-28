import asyncio
import os
from google.antigravity import Agent, LocalAgentConfig

async def run_gemini_free_tier():
    """
    Connects to the Google AI Studio (Free Tier or standard paid tier).
    Requires the GEMINI_API_KEY environment variable.
    """
    print("--- Running Gemini (Google AI Studio) ---")
    
    # By default, LocalAgentConfig uses Google AI Studio.
    # The SDK automatically picks up GEMINI_API_KEY from the environment.
    config = LocalAgentConfig(
        model="gemini-3.6-flash", 
        system_instructions="You are a helpful assistant powered by Gemini."
    )
    
    async with Agent(config=config) as agent:
        response = await agent.chat("Hallo Gemini, wie geht es dir?")
        print("Gemini:", await response.text())


async def run_vertex_ai_agent():
    """
    Connects to Gemini Enterprise Agent Platform (formerly Vertex AI).
    Requires 'gcloud auth application-default login' and a GCP project.
    """
    print("\n--- Running Gemini (Enterprise Agent Platform / Vertex AI) ---")
    
    # You must provide the project and location (region).
    # Replace 'your-gcp-project' with your actual Project ID.
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "your-gcp-project")
    
    try:
        config = LocalAgentConfig(
            model="gemini-3.6-flash",
            vertex=True,
            project=project_id,
            location="us-central1"
        )
        
        async with Agent(config=config) as agent:
            response = await agent.chat("Hallo Vertex AI, was sind deine Fähigkeiten?")
            print("Vertex AI:", await response.text())
    except Exception as e:
        print(f"Error connecting to Vertex AI: {e}")
        print("Stellen Sie sicher, dass 'gcloud auth application-default login' ausgeführt wurde.")

if __name__ == "__main__":
    # To run this, ensure google-antigravity SDK is installed:
    # pip install google-antigravity
    
    # asyncio.run(run_gemini_free_tier())
    # asyncio.run(run_vertex_ai_agent())
    print("Execute the functions inside this script by uncommenting the lines above.")
