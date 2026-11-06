from typing import Any

from backend.app.agents.base import BaseAgent


class MockAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Mock Support Agent",
            description="A deterministic customer support agent for testing.",
        )

    def execute(self, prompt: str) -> dict[str, Any]:
        normalized_prompt = prompt.lower()

        if "refund" in normalized_prompt:
            output = (
                "Customers can request a refund within 30 days."
            )
        elif "shipping" in normalized_prompt:
            output = (
                "Orderss are typically delivered within 5 busisness days."
            )
        else:
            output = (
                "I am a mock support agent. "
                "I cannot answer that question yet."
            )

        return {
            "output": output,
            "metadata": {
                "agent": self.name,
                "provider": "mock",
                "model": "deterministic-mock",
            },
        }