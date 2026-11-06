from abc import ABC, abstractmethod
from typing import Any


class BaseAgent(ABC):
    def __init__(
            self, 
            name: str,
            description: str,
    ):
        self.name = name 
        self.description = description

    @abstractmethod
    def execute(self, prompt: str) -> dict[str, Any]:
        """
        Execute an agent prompt.

        Returns a dictionary containing:
        - output
        - metadata
        """
        raise NotImplementedError 