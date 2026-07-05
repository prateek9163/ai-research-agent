from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from backend.tools import web_search, scrape_url
import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("G_API_KEY"),
    temperature=0
)

# search agent
def build_search_agent():
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a research assistant. Search for detailed and reliable information."),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    agent = create_tool_calling_agent(llm, [web_search], prompt)
    return AgentExecutor(agent=agent, tools=[web_search], verbose=True)


# reader agent 
def build_reader_agent():
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a web scraper assistant. Scrape URLs for detailed content."),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    agent = create_tool_calling_agent(llm, [scrape_url], prompt)
    return AgentExecutor(agent=agent, tools=[scrape_url], verbose=True)


# writer chain
writer_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert research writer. Write clear, structured, and insightful reports."),
    ("human", """
Write a detailed research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report as:
- Introduction
- Key Findings (minimum 3 well-explained points)
- Conclusion
- Sources (list all URLs found in the research)

Be detailed, factual, and professional.
""")
])

writer_chain = writer_prompt | llm | StrOutputParser()


# critic chain 
critic_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a sharp and constructive research critic. Be honest and specific."),
    ("human", """Review the research report below and evaluate it strictly.

Report:
{report}

Respond in this exact format:

Score: X/10

Strengths:
- ...
- ...

Areas to Improve:
- ...
- ...

One line verdict:
..."""),
])

critic_chain = critic_prompt | llm | StrOutputParser()