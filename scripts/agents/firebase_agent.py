import asyncio
from firebase_admin import initialize_app, credentials
from firebase_admin import ai

# This script demonstrates how to use Firebase AI logic.
# See documentation for 'firebase-ai-logic-basics' skill.

async def run_firebase_genai():
    """
    Connects to Firebase AI using the Firebase Admin SDK.
    Make sure you have initialized the Firebase environment and enabled the AI API.
    """
    print("--- Running Firebase AI Agent ---")
    
    # Initialize the app with default credentials or service account
    # credentials.Certificate('path/to/serviceAccountKey.json')
    try:
        initialize_app()
    except ValueError:
        pass # App already initialized

    # You can access the models provided by Firebase GenAI
    model = ai.get_model('gemini-3.6-flash')
    
    try:
        response = await model.generate_content("Hallo Firebase AI! Kannst du das bestätigen?")
        print("Firebase GenAI:", response.text)
    except Exception as e:
        print(f"Error connecting to Firebase AI: {e}")
        print("Ensure Firebase AI is configured correctly in your Firebase project.")

if __name__ == "__main__":
    # To run this:
    # pip install firebase-admin
    # Ensure you are authenticated with Firebase.
    
    asyncio.run(run_firebase_genai())
