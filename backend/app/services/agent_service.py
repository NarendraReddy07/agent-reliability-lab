import json
import time
from datetime import datetime, timezone, timedelta

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

    @staticmethod
    def _create_trace_event(
        event: str,
        start_time: float,
        start_datetime: datetime,
        **details,
    ):
        elapsed_ms = max(
            0.0,
            (time.perf_counter() - start_time) * 1000,
        )

        event_timestamp = start_datetime + timedelta(
            microseconds=round(elapsed_ms * 1000)
        )

        return {
            "event": event,
            "timestamp": event_timestamp.isoformat(),
            "elapsed_ms": round(elapsed_ms, 3),
            **details,
        }

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
        start_datetime = datetime.now(timezone.utc)

        trace_events = [
            {
                "event": "execution_started",
                "timestamp": start_datetime.isoformat(),
                "elapsed_ms": 0.0,
            }
        ]

        try:
            agent_start = time.perf_counter()
            result = agent.execute(prompt)

            agent_duration = (
                time.perf_counter() - agent_start
            ) * 1000

            trace_events.append(
                self._create_trace_event(
                    "agent_response",
                    start_time,
                    start_datetime,
                    duration_ms=round(agent_duration, 3),
                )
            )

            duration_ms = round(
                (time.perf_counter() - start_time) * 1000,
                3,
            )

            trace_events.append(
                self._create_trace_event(
                    "execution_completed",
                    start_time,
                    start_datetime,
                    duration_ms=duration_ms,
                )
            )

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
                3,
            )

            trace_events.append(
                self._create_trace_event(
                    "execution_failed",
                    start_time,
                    start_datetime,
                    duration_ms=duration_ms,
                    error=str(error),
                )
            )

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