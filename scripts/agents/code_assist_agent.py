import asyncio
import os
from google.antigravity import Agent, LocalAgentConfig

async def run_code_assist_agent():
    """
    Connects to Gemini using the Free Tier (Google AI Studio) specifically configured
    for Code Assistance. 
    This acts as a 'no-cost' code assistant.
    Requires GEMINI_API_KEY environment variable.
    """
    print("--- Running No-Cost Code Assist Agent ---")
    
    config = LocalAgentConfig(
        model="gemini-3.6-flash", 
        system_instructions=(
            "You are an expert AI Code Assistant. Provide clean, efficient, and well-documented code. "
            "Focus on best practices and explain your reasoning concisely."
        )
    )
    
    async with Agent(config=config) as agent:
        prompt = "Schreibe eine kurze Python-Funktion, die überprüft, ob eine Zahl eine Primzahl ist."
        print(f"User: {prompt}\n")
        response = await agent.chat(prompt)
        print("Code Assist Agent:\n", await response.text())

if __name__ == "__main__":
    # Ensure GEMINI_API_KEY is set in your environment or .env file
    asyncio.run(run_code_assist_agent())
