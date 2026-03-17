from __future__ import annotations

from typing import Annotated, Sequence
from typing_extensions import TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    lead_id: str
    user_id: str
    task_type: str
    plan: list[dict]
    current_step: int
    step_results: list[dict]
    gathered_data: str
