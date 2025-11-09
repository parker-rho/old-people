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

# Example usage
# logging.info("Program started")
# logging.warning("This is a warning")
# logging.error("An error occurred")

# Load environment variables from a .env file
load_dotenv()

# def read_convo(filename:str) -> list[str]:
#     """
#     Returns the current conversation with the user from a JSON file in the format of an array.
#     The most recent message is at the end of the array.
#     """
#     with open(filename, "r") as file:
#         data = json.load(file)
#     logging.info("Read conversation from %s", filename)
#     return data["convo"]

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

async def make_instructions(prompt: str) -> str:
    client = AsyncDedalus()
    runner = DedalusRunner(client)

    logging.info("Starting instruction generation process.")

    result = await runner.run(
        input="Follow these instructions strictly and do nothing else extra: \n1. Given prompt" + prompt 
        +  """give an answer formatted in steps for an elderly person who struggles with the internet 
        by browsing the internet for instructions. 
        2. Set these instructions as the final output and nothing else.
        3. Terminate entirely and stop all processing.""",
        model=[
            "openai/gpt-4.1-mini",
            # "claude-sonnet-4-20250514",
            ],
        mcp_servers= [
            # "joerup/exa-mcp",        # Semantic search engine
            "windsor/brave-search-mcp"  # Privacy-focused web search
        ],
        stream=False,
        max_steps=5,
        )
    
    logging.info("Instruction generation process completed.")

    # Optionally writes full instructions to file for record-keeping
    write_instructions("dedalus.json", result.final_output)

    return result.final_output