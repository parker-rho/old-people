import logging
from dotenv import load_dotenv
from dedalus_labs import AsyncDedalus, DedalusRunner
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    force=True
)

# Load environment variables
load_dotenv()


def save_selected_element(filename: str, step_number: int, step_text: str, selected_element: dict):
    """
    Saves the selected element for a specific step to the JSON file.
    """
    try:
        with open(filename, "r") as file:
            data = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        logging.error("Failed to read %s for saving", filename)
        return
    
    # Initialize selected_elements array if it doesn't exist
    if "selected_elements" not in data:
        data["selected_elements"] = []
    
    # Add or update the element for this step
    from datetime import datetime
    element_data = {
        "step_number": step_number,
        "step_text": step_text,
        "selected_element": selected_element,
        "timestamp": datetime.now().isoformat()
    }
    
    # Check if this step already exists, update it
    existing_index = next((i for i, item in enumerate(data["selected_elements"]) 
                          if item.get("step_number") == step_number), None)
    
    if existing_index is not None:
        data["selected_elements"][existing_index] = element_data
    else:
        data["selected_elements"].append(element_data)
    
    # Save back to file
    with open(filename, "w") as file:
        json.dump(data, file, indent=4)
    
    logging.info("Saved selected element for step %d to %s", step_number, filename)


def get_selected_elements_history(filename: str) -> list[dict]:
    """
    Retrieves all saved selected elements from the JSON file.
    """
    try:
        with open(filename, "r") as file:
            data = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logging.error("Failed to read %s: %s", filename, str(e))
        return []
    
    return data.get("selected_elements", [])


def read_instructions(filename: str) -> str:
    """
    Reads the generated instructions from a JSON file.
    Returns the most recent instruction set as a string.
    """
    try:
        with open(filename, "r") as file:
            data = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logging.error("Failed to read %s: %s", filename, str(e))
        return ""
    
    if "instructions" in data and len(data["instructions"]) > 0:
        instructions = data["instructions"][-1]  # Get the most recent
        logging.info("Read instructions from %s", filename)
        return instructions
    else:
        logging.error("No instructions found in %s", filename)
        return ""


def parse_steps_from_instructions(instructions: str) -> list[str]:
    """
    Parses the instructions string into individual steps.
    Assumes steps are numbered like "1. Step one\n2. Step two"
    """
    if not instructions or not instructions.strip():
        logging.error("EMPTY instructions received!")
        return []
    
    lines = instructions.split('\n')
    steps = []
    current_step = ""
    
    for line in lines:
        line = line.strip()
        # Check if line starts with a number followed by a period (e.g., "1.", "2.")
        if line and line[0].isdigit() and '.' in line[:4]:
            if current_step:
                steps.append(current_step.strip())
            current_step = line
        elif current_step:
            current_step += " " + line
    
    if current_step:
        steps.append(current_step.strip())
    
    if len(steps) == 0:
        logging.error("NO STEPS PARSED! Raw instructions: %s", instructions[:500])
    else:
        logging.info("Parsed %d steps from instructions", len(steps))
    
    return steps


async def select_element_for_step(step: str, annotated_html: list[dict]) -> dict:
    """
    Uses Dedalus AI to identify which element from the annotated HTML
    matches the action required in the given step.
    
    Args:
        step: A single instruction step (e.g., "1. Click the microphone icon to unmute")
        annotated_html: List of interactive elements with id, tag, and text
        
    Returns:
        The element object that matches the step, or None if no interaction needed
    """
    client = AsyncDedalus()
    runner = DedalusRunner(client)
    
    logging.info("Selecting element for step: %s", step[:50])
    
    # Convert annotated HTML to a clean JSON string
    elements_json = json.dumps(annotated_html, indent=2)
    
    prompt = f"""You are an expert at matching user instructions to webpage elements for elderly users.

INSTRUCTION STEP:
{step}

AVAILABLE ELEMENTS:
{elements_json}

YOUR TASK:
Identify which element (if any) the user should interact with for this step.

MATCHING RULES:
1. **Action Words**: 
   - "click/tap/press" → look for buttons, links
   - "type/enter/input" → look for input fields, textareas
   - "select/choose" → look for select dropdowns, buttons
   
2. **Fuzzy Matching** (these are equivalent):
   - "Log in" = "Login" = "Sign in" = "Sign In" = "log in"
   - "Email" = "email address" = "E-mail"
   - "Password" = "pass" = "pwd"
   - "Search" = "Find" = magnifying glass icon
   
3. **Prioritize by Type**:
   - For "click the X button" → prefer tag="button" over tag="a"
   - For "type in X" → prefer tag="input" or textarea
   - Look at element's "type" and "role" fields for hints
   
4. **Informational Steps** (return null for these):
   - "Wait for..."
   - "You will see..."
   - "Remember to..."
   - Steps with NO specific element to click/type

EXAMPLES:
Step: "Click the Log In button"
Elements: [{{"id": "ai-1", "tag": "button", "text": "Sign in"}}, {{"id": "ai-2", "tag": "a", "text": "Register"}}]
→ Answer: {{"id": "ai-1", "tag": "button", "text": "Sign in"}}
(matched because "Log In" ≈ "Sign in" and it's a button)

Step: "Type your email address in the email box"
Elements: [{{"id": "ai-3", "tag": "input", "text": "Email or phone number", "type": "text"}}, {{"id": "ai-4", "tag": "button", "text": "Submit"}}]
→ Answer: {{"id": "ai-3", "tag": "input", "text": "Email or phone number", "type": "text"}}
(matched because it's an input field for email)

Step: "Wait for the page to load"
→ Answer: null
(informational, no interaction needed)

OUTPUT FORMAT:
- Return ONLY the JSON object of the matching element
- OR return: null
- NO explanations, NO extra text"""

    result = await runner.run(
        input=prompt,
        model=["anthropic/claude-sonnet-4-20250514"],  # Claude is more precise at element matching
        stream=False,
        max_steps=1,
    )
    
    # Parse the AI response
    response = result.final_output.strip()
    
    if response.lower() == "null" or not response:
        logging.info("No element interaction needed for this step")
        return None
    
    try:
        # Try to parse as JSON
        element = json.loads(response)
        logging.info("Selected element: %s", element.get("id"))
        return element
    except json.JSONDecodeError:
        logging.error("Failed to parse AI response as JSON: %s", response)
        return None


async def process_instructions_step_by_step(
    instructions_file: str, 
    annotated_html: list[dict],
    step_index: int = 0
) -> dict:
    """
    Processes a single step from the instructions and returns the element to interact with.
    
    Args:
        instructions_file: Path to JSON file containing instructions
        annotated_html: List of interactive elements from the webpage
        step_index: Which step to process (0-indexed)
        
    Returns:
        Dictionary with step info and selected element
    """
    # Read instructions
    instructions = read_instructions(instructions_file)
    if not instructions:
        return {"error": "No instructions found"}
    
    # Parse into steps
    steps = parse_steps_from_instructions(instructions)
    
    if step_index >= len(steps):
        logging.info("All steps completed!")
        return {
            "completed": True,
            "total_steps": len(steps),
            "message": "All steps completed!"
        }
    
    # Get the current step
    current_step = steps[step_index]
    logging.info("Processing step %d of %d", step_index + 1, len(steps))
    
    # Select the element for this step
    selected_element = await select_element_for_step(current_step, annotated_html)
    
    # Save the selected element to file
    save_selected_element(instructions_file, step_index + 1, current_step, selected_element)
    
    return {
        "step_number": step_index + 1,
        "total_steps": len(steps),
        "step_text": current_step,
        "selected_element": selected_element,
        "completed": False
    }


async def process_all_steps(instructions_file: str, annotated_html: list[dict]) -> list[dict]:
    """
    Processes ALL steps from instructions and returns elements for each.
    Useful for testing/debugging the full flow.
    
    Returns:
        List of dictionaries, one per step with selected element
    """
    instructions = read_instructions(instructions_file)
    if not instructions:
        return [{"error": "No instructions found"}]
    
    steps = parse_steps_from_instructions(instructions)
    results = []
    
    for i, step in enumerate(steps):
        logging.info("="*50)
        logging.info("Processing step %d/%d", i+1, len(steps))
        
        selected_element = await select_element_for_step(step, annotated_html)
        
        results.append({
            "step_number": i + 1,
            "step_text": step,
            "selected_element": selected_element
        })
    
    return results


# Example usage
if __name__ == "__main__":
    import asyncio
    
    # Example annotated HTML (simplified)
    sample_html = [
        {"id": "ai-1", "tag": "button", "text": "Mute"},
        {"id": "ai-2", "tag": "button", "text": "Unmute"},
        {"id": "ai-3", "tag": "a", "text": "Settings"},
        {"id": "ai-4", "tag": "div", "text": "Volume Control"},
    ]
    
    async def main():
        # Process step 0 (first step)
        result = await process_instructions_step_by_step(
            "dedalus/dedalus.json",
            sample_html,
            step_index=0
        )
        print(json.dumps(result, indent=2))
    
    asyncio.run(main())
