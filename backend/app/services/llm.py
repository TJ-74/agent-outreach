import json
from openai import AzureOpenAI
from langchain_openai import AzureChatOpenAI
from app.config import get_settings

_client: AzureOpenAI | None = None
_chat_model: AzureChatOpenAI | None = None
_creative_model: AzureChatOpenAI | None = None
_mini_model: AzureChatOpenAI | None = None


def get_llm() -> AzureOpenAI:
    global _client
    if _client is None:
        s = get_settings()
        _client = AzureOpenAI(
            azure_endpoint=s.azure_openai_endpoint,
            api_key=s.azure_openai_api_key,
            api_version=s.azure_openai_api_version,
        )
    return _client


def get_chat_model() -> AzureChatOpenAI:
    """Singleton LangChain chat model used by the LangGraph agent."""
    global _chat_model
    if _chat_model is None:
        s = get_settings()
        _chat_model = AzureChatOpenAI(
            azure_deployment=s.azure_openai_deployment,
            azure_endpoint=s.azure_openai_endpoint,
            api_key=s.azure_openai_api_key,
            api_version=s.azure_openai_api_version,
            temperature=1,  # Azure deployment only supports default (1)
        )
    return _chat_model


def get_creative_chat_model() -> AzureChatOpenAI:
    """Higher-temperature model for creative tasks like email composition."""
    global _creative_model
    if _creative_model is None:
        s = get_settings()
        _creative_model = AzureChatOpenAI(
            azure_deployment=s.azure_openai_deployment,
            azure_endpoint=s.azure_openai_endpoint,
            api_key=s.azure_openai_api_key,
            api_version=s.azure_openai_api_version,
            temperature=1,  # Azure deployment only supports default (1)
        )
    return _creative_model


def get_mini_chat_model() -> AzureChatOpenAI:
    """Fast, cheap model (e.g. GPT-5-mini) for structured tasks: planning, SQL gen, summarization."""
    global _mini_model
    if _mini_model is None:
        s = get_settings()
        _mini_model = AzureChatOpenAI(
            azure_deployment=s.azure_openai_mini_deployment,
            azure_endpoint=s.azure_openai_endpoint,
            api_key=s.azure_openai_api_key,
            api_version=s.azure_openai_api_version,
            temperature=1,  # GPT-5-mini only supports default (1)
        )
    return _mini_model


def chat_json(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 1,
    deployment: str | None = None,
) -> tuple[dict, int]:
    """Send a chat completion request and parse a JSON response.

    Returns (parsed_dict, total_tokens).
    """
    s = get_settings()
    client = get_llm()

    response = client.chat.completions.create(
        model=deployment or s.azure_openai_deployment,
        temperature=temperature,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = response.choices[0].message.content or "{}"
    tokens = response.usage.total_tokens if response.usage else 0
    return json.loads(content), tokens


def chat_text(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 1,
) -> tuple[str, int]:
    """Send a chat completion request and return raw text.

    Returns (text, total_tokens).
    """
    s = get_settings()
    client = get_llm()

    response = client.chat.completions.create(
        model=s.azure_openai_deployment,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = response.choices[0].message.content or ""
    tokens = response.usage.total_tokens if response.usage else 0
    return content, tokens
