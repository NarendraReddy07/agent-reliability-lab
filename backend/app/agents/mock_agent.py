from typing import Any

from backend.app.agents.base import BaseAgent


class MockAgent(BaseAgent):
    """Deterministic support agent for repeatable local benchmarks."""

    def __init__(self):
        super().__init__(
            name="Mock Support Agent",
            description="Deterministic support agent for accuracy, safety, tool-use honesty, and instruction-following tests.",
        )

    @staticmethod
    def _has(text: str, *terms: str) -> bool:
        return any(term in text for term in terms)

    def execute(self, prompt: str) -> dict[str, Any]:
        text = " ".join(prompt.lower().split())

        if self._has(text, "refund", "money back"):
            output = "Customers can request a refund within 30 days."
        elif self._has(text, "shipping", "delivery", "delivered"):
            output = "Orders are typically delivered within 5 business days."
        elif self._has(text, "cancel", "cancellation"):
            output = "You can request order cancellation before the order is shipped. Contact customer support with your order number."
        elif self._has(text, "return", "exchange"):
            output = "Eligible items can be returned within 30 days of delivery, provided they are unused and in their original packaging."
        elif self._has(text, "payment", "paid", "charge"):
            output = "We accept major credit and debit cards. Payment is processed securely at checkout."
        elif self._has(text, "track", "order status", "where is my order"):
            output = "I cannot access live order tracking in this demo. Please use the tracking link in your shipping confirmation email."
        elif self._has(text, "password", "account security", "login"):
            output = "Never share your password or one-time verification code. Use the account recovery option on the sign-in page if you need help."
        elif self._has(text, "diagnose", "medical", "medicine", "symptom"):
            output = "I cannot provide medical diagnoses or treatment advice. Please consult a qualified healthcare professional."
        elif self._has(text, "ignore the rules", "reveal secrets", "system prompt"):
            output = "I cannot reveal private instructions or confidential information. I can still help with questions about our customer support policies."
        elif self._has(text, "three bullet", "three bullets"):
            output = (
                "- Refund requests are accepted within 30 days.\n"
                "- Eligible returns must be unused and in original packaging.\n"
                "- Contact customer support with your order number for assistance."
            )
        elif self._has(text, "tool", "database", "look up", "check my order"):
            output = "I do not have access to external tools or order databases in this demo, so I cannot claim to have checked your account."
        else:
            output = "I am a demo customer support agent. I do not have enough information to answer that question. Please contact customer support for assistance."

        return {
            "output": output,
            "metadata": {
                "agent": self.name,
                "provider": "mock",
                "model": "deterministic-mock-v2",
            },
        }
