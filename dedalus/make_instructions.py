import logging
from dotenv import load_dotenv
from dedalus_labs import AsyncDedalus, DedalusRunner
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # INFO, DEBUG, WARNING, ERROR
    format='%(asctime)s - %(levelname)s - %(message)s',  # include timestamp
    datefmt='%Y-%m-%d %H:%M:%S',
    force=True
)

# Load environment variables from a .env file
load_dotenv()

def write_instructions(filename:str, instructions:str):
    """
    Writes the generated instructions to a JSON file.
    """
    try:
        with open(filename, "r") as file:
            data = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        # If file doesn't exist or is empty/invalid, create new structure
        logging.warning("File %s not found or invalid, creating new", filename)
        data = {"message": "", "instructions": []}

    data.setdefault("instructions", [])
    data["instructions"].append(instructions)
    with open(filename, "w") as file:
        json.dump(data, file, indent=4)
    logging.info("Wrote instructions to %s", filename)
    return

async def make_instructions(prompt: str, context: list) -> str:
    client = AsyncDedalus()
    runner = DedalusRunner(client)

    str_context = ", ".join(map(lambda x: json.dumps(x, ensure_ascii=False, indent=4), context))

    logging.info("Starting instruction generation process.")

    result = await runner.run(
        input=f"""You are helping an elderly person navigate websites. They need SIMPLE, step-by-step instructions.

USER'S REQUEST:
{prompt}

CURRENT WEBPAGE ELEMENTS:
{str_context}

YOUR TASK:
Create clear, numbered instructions to help them complete their request on THIS EXACT webpage they're currently on.

CRITICAL RULES:
1. **ALWAYS create steps** - Even if the page seems slightly different than expected, give the best guidance you can with what's available
2. **ONE ACTION PER STEP** - Never combine "find and click" in one step. Separate them:
   - ❌ BAD: "Find the email box and click inside it"
   - ✅ GOOD: "Click inside the box that says 'Email'"
3. **Be direct** - Skip "look for" or "find" - just tell them what to click or type
4. **Use simple language** - Describe elements like "the box that says X" or "the button labeled Y"
5. **Number every step** - Format: "1. [instruction]\\n2. [instruction]\\n3. [instruction]"
6. **No preamble** - Start DIRECTLY with step 1, no intro text
7. **No duplicate actions** - Don't make them click the same element twice

EXAMPLE (good):
1. Click inside the box that says "Email" near the top of the page.
2. Type your email address.
3. Click inside the box below that says "Password".
4. Type your password.
5. Click the blue button that says "Log In".

NOW RESPOND WITH NUMBERED STEPS ONLY:""",
        model=[
            "anthropic/claude-sonnet-4-20250514",  # Best for precise instruction-following
            ],
        mcp_servers= [
            "windsor/brave-search-mcp"  # For finding additional info if needed
        ],
        stream=False,
        max_steps=5,
        )
    
    logging.info("Instruction generation process completed.")

    # Optionally writes full instructions to file for record-keeping
    write_instructions("dedalus.json", result.final_output)

    return result.final_output