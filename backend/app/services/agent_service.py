
import json
import time
from datetime import datetime

from sqlalchemy.orm import Session

from backend.app.agents.mock_agent import MockAgent
from backend.app.models import AgentExecution


class AgentService:
    def __init__(self):
        self.agents = {}
        self.register_agent(MockAgent())

    def register_agent(self, agent):
        self.agents[agent.name] = agent

    def list_agents(self):
        return [
            {
                "name": agent.name,
                "description": agent.description,
            }
            for agent in self.agents.values()
        ]

    def get_agent(self, agent_name: str):
        return self.agents.get(agent_name)

    def execute_agent(
        self,
        db: Session,
        agent_name: str,
        prompt: str,
    ):
        agent = self.get_agent(agent_name)

        if agent is None:
            raise ValueError(f"Agent '{agent_name}' not found.")

        start_time = time.perf_counter()

        trace_events = [
            {
                "event": "execution_started",
                "timestamp": datetime.utcnow().isoformat(),
            }
        ]

        try:
            result = agent.execute(prompt)

            trace_events.append({
                "event": "agent_response",
                "timestamp": datetime.utcnow().isoformat(),
            })

            duration_ms = round(
                (time.perf_counter() - start_time) * 1000,
                2,
            )

            trace_events.append({
                "event": "execution_completed",
                "timestamp": datetime.utcnow().isoformat(),
            })

            execution = AgentExecution(
                agent_name=agent.name,
                prompt=prompt,
                output=result["output"],
                provider=result["metadata"].get("provider"),
                model=result["metadata"].get("model"),
                status="completed",
                duration_ms=duration_ms,
                trace=json.dumps(trace_events),
            )

            db.add(execution)
            db.commit()
            db.refresh(execution)

            return {
                "execution_id": execution.id,
                "agent_name": agent.name,
                "prompt": prompt,
                "output": result["output"],
                "metadata": result["metadata"],
                "status": execution.status,
                "duration_ms": duration_ms,
            }

        except Exception as error:
            db.rollback()

            duration_ms = round(
                (time.perf_counter() - start_time) * 1000,
                2,
            )

            trace_events.append({
                "event": "execution_failed",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(error),
            })

            failed_execution = AgentExecution(
                agent_name=agent.name,
                prompt=prompt,
                output=None,
                status="failed",
                error=str(error),
                duration_ms=duration_ms,
                trace=json.dumps(trace_events),
            )

            db.add(failed_execution)
            db.commit()

            raise


agent_service = AgentService()