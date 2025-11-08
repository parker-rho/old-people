import logging
from dotenv import load_dotenv
from dedalus_labs import AsyncDedalus, DedalusRunner
from dedalus_labs.utils.streaming import stream_async
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # INFO, DEBUG, WARNING, ERROR
    format='%(asctime)s - %(levelname)s - %(message)s',  # include timestamp
    datefmt='%Y-%m-%d %H:%M:%S',
    force=True
)

# Example usage
# logging.info("Program started")
# logging.warning("This is a warning")
# logging.error("An error occurred")

# Load environment variables from a .env file
load_dotenv()

def read_convo(filename:str) -> list[str]:
    """
    Returns the current conversation with the user from a JSON file in the format of an array.
    The most recent message is at the end of the array.
    """
    with open(filename, "r") as file:
        data = json.load(file)
    logging.info("Read conversation from %s", filename)
    return data["convo"]

def write_instructions(filename:str, instructions:str):
    """
    Writes the generated instructions to a JSON file.
    """
    with open(filename, "r") as file:
        data = json.load(file)

    data.setdefault("instructions", [])
    data["instructions"].append(instructions)
    with open(filename, "w") as file:
        json.dump(data, file, indent=4)
    logging.info("Wrote instructions to %s", filename)
    return

async def make_instructions():
    client = AsyncDedalus()
    runner = DedalusRunner(client)

    logging.info("Starting instruction generation process.")

    result = await runner.run(
        input="""Use your tools to read from dedalus.json and use the entire context of the conversation to
        answer the most recent prompt by searching the internet for instructions. Then write the instructions
        back to dedalus.json with your tools. Return True if writing was successful, False otherwise in the
        final output.""",
        model=["openai/gpt-5"],
        mcp_servers= "windsor/brave-search-mcp",  # Privacy-focused web search
        tools=[read_convo, write_instructions],
        stream=False,
        max_steps=7,
        )
        
    if result.final_output:
        logging.info("Successfully wrote instructions.")
    else:
        logging.error("Failed to write instructions.")

    return result.final_output