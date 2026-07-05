from backend.agents import build_reader_agent, build_search_agent, writer_chain, critic_chain


def _to_str(value) -> str:
    """
    Normalise whatever an agent / chain returns into a plain string.

    Handles:
      • already a string                          → returned as-is
      • LangChain AIMessage / BaseMessage         → .content extracted
      • Anthropic SDK Message object              → .content list extracted
      • list of content blocks (dicts or objects) → text blocks joined
    """
    if isinstance(value, str):
        return value

    # LangChain message objects expose .content directly
    if hasattr(value, "content"):
        value = value.content

    # Anthropic SDK returns content as a list of typed blocks
    if isinstance(value, list):
        parts = []
        for block in value:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block["text"])
            elif hasattr(block, "type") and block.type == "text":
                parts.append(block.text)
        return "\n".join(parts)

    return str(value)


def run_research_pipeline(topic: str) -> dict:
    state = {}

    print("\n" + "=" * 50)
    print("Step 1 – search agent is working …")
    print("=" * 50)

    search_agent = build_search_agent()
    search_result = search_agent.invoke({
        "input": f"Find recent, reliable and detailed information about: {topic}"
    })
    state["search_result"] = _to_str(search_result.get("output", ""))
    print("\nSearch result:\n", state["search_result"])

    print("\n" + "=" * 50)
    print("Step 2 – reader agent is scraping top resources …")
    print("=" * 50)

    reader_agent = build_reader_agent()
    reader_result = reader_agent.invoke({
        "input": (
            f"Based on the following search results about '{topic}', "
            f"pick the most relevant URL and scrape it for deeper content.\n\n"
            f"Search Results:\n{state['search_result'][:800]}"
        )
    })
    state["scraped_content"] = _to_str(reader_result.get("output", ""))
    print("\nScraped content:\n", state["scraped_content"])

    print("\n" + "=" * 50)
    print("Step 3 – writer is drafting the report …")
    print("=" * 50)

    research_combined = (
        f"SEARCH RESULTS:\n{state['search_result']}\n\n"
        f"DETAILED SCRAPED CONTENT:\n{state['scraped_content']}"
    )
    state["report"] = _to_str(writer_chain.invoke({
        "topic": topic,
        "research": research_combined,
    }))
    print("\nFinal report:\n", state["report"])

    print("\n" + "=" * 50)
    print("Step 4 – critic is reviewing the report …")
    print("=" * 50)

    state["feedback"] = _to_str(critic_chain.invoke({
        "report": state["report"],
    }))
    print("\nCritic feedback:\n", state["feedback"])

    return state


if __name__ == "__main__":
    topic = input("\nEnter a research topic: ")
    run_research_pipeline(topic)