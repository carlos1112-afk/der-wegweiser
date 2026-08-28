import asyncio
import os
from google.antigravity import Agent, LocalOpenAIAgentConfig

async def run_openrouter_agent():
    """
    Connects to OpenRouter using the LocalOpenAIAgentConfig, 
    since OpenRouter is compatible with the OpenAI API format.
    Requires OPENROUTER_API_KEY.
    """
    print("--- Running OpenRouter Agent ---")
    
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("Please set the OPENROUTER_API_KEY environment variable.")
        return

    # OpenRouter base URL
    base_url = "https://openrouter.ai/api/v1"
    
    # You can specify any model available on OpenRouter, e.g. claude-3-haiku, llama-3, etc.
    model_name = "anthropic/claude-3-haiku" 

    config = LocalOpenAIAgentConfig(
        model=model_name,
        base_url=base_url,
        api_key=api_key,
        system_instructions="You are a helpful OpenRouter assistant."
    )
    
    async with Agent(config=config) as agent:
        response = await agent.chat("Hello from the Antigravity SDK via OpenRouter!")
        print(f"{model_name}:", await response.text())

if __name__ == "__main__":
    # To run this:
    # pip install google-antigravity
    # set OPENROUTER_API_KEY=your_key
    
    asyncio.run(run_openrouter_agent())
