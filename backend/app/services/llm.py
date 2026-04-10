import json
from openai import AzureOpenAI
from langchain_openai import AzureChatOpenAI
from app.config import get_settings

DEPLOYMENT = "gpt-5.3-chat"

_client: AzureOpenAI | None = None
_chat_model: AzureChatOpenAI | None = None


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
    """Singleton LangChain chat model."""
    global _chat_model
    if _chat_model is None:
        s = get_settings()
        _chat_model = AzureChatOpenAI(
            azure_deployment=DEPLOYMENT,
            azure_endpoint=s.azure_openai_endpoint,
            api_key=s.azure_openai_api_key,
            api_version=s.azure_openai_api_version,
            temperature=1,
        )
    return _chat_model


def get_creative_chat_model() -> AzureChatOpenAI:
    """Same model — kept as separate accessor for callers that request creative mode."""
    return get_chat_model()


def get_mini_chat_model() -> AzureChatOpenAI:
    """Same model — kept for callers that previously used a separate mini deployment."""
    return get_chat_model()


def chat_json(
    system_prompt: str,
    user_prompt: str,
    deployment: str | None = None,
) -> tuple[dict, int]:
    """Send a chat completion and parse a JSON response.

    Returns (parsed_dict, total_tokens).
    """
    client = get_llm()
    s = get_settings()

    response = client.chat.completions.create(
        model=deployment or DEPLOYMENT,
        temperature=1,
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
) -> tuple[str, int]:
    """Send a chat completion and return raw text.

    Returns (text, total_tokens).
    """
    client = get_llm()
    s = get_settings()

    response = client.chat.completions.create(
        model=DEPLOYMENT,
        temperature=1,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = response.choices[0].message.content or ""
    tokens = response.usage.total_tokens if response.usage else 0
    return content, tokens
