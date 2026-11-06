
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models import AgentExecution
from backend.app.services.agent_service import agent_service


router = APIRouter(
    prefix="/api/agents",
    tags=["Agents"],
)


@router.get("/")
async def list_agents():
    return {
        "agents": agent_service.list_agents()
    }


@router.post("/{agent_name}/execute")
async def execute_agent(
    agent_name: str,
    request: dict,
    db: Session = Depends(get_db),
):
    prompt = request.get("prompt")

    if not isinstance(prompt, str) or not prompt.strip():
        raise HTTPException(
            status_code=422,
            detail="A non-empty prompt is required.",
        )

    try:
        return agent_service.execute_agent(
            db=db,
            agent_name=agent_name,
            prompt=prompt,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )


@router.get("/executions")
async def list_executions(
    db: Session = Depends(get_db),
):
    executions = db.query(AgentExecution).order_by(
        AgentExecution.id.desc()
    ).all()

    return [
        {
            "id": item.id,
            "agent_name": item.agent_name,
            "prompt": item.prompt,
            "output": item.output,
            "status": item.status,
            "duration_ms": item.duration_ms,
            "executed_at": item.executed_at,
        }
        for item in executions
    ]


@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: int,
    db: Session = Depends(get_db),
):
    execution = db.query(AgentExecution).filter(
        AgentExecution.id == execution_id
    ).first()

    if execution is None:
        raise HTTPException(
            status_code=404,
            detail="Execution not found.",
        )

    return {
        "id": execution.id,
        "agent_name": execution.agent_name,
        "prompt": execution.prompt,
        "output": execution.output,
        "provider": execution.provider,
        "model": execution.model,
        "status": execution.status,
        "error": execution.error,
        "duration_ms": execution.duration_ms,
        "executed_at": execution.executed_at,
        "trace": json.loads(execution.trace),
    }


@router.get("/metrics")
async def get_execution_metrics(
    db: Session = Depends(get_db),
):
    total = db.query(AgentExecution).count()

    completed = db.query(AgentExecution).filter(
        AgentExecution.status == "completed"
    ).count()

    failed = db.query(AgentExecution).filter(
        AgentExecution.status == "failed"
    ).count()

    average_duration = db.query(
        func.avg(AgentExecution.duration_ms)
    ).scalar()

    minimum_duration = db.query(
        func.min(AgentExecution.duration_ms)
    ).scalar()

    maximum_duration = db.query(
        func.max(AgentExecution.duration_ms)
    ).scalar()

    success_rate = (
        round((completed / total) * 100, 2)
        if total else 0.0
    )

    return {
        "total_executions": total,
        "completed_executions": completed,
        "failed_executions": failed,
        "success_rate": success_rate,
        "average_duration_ms": round(
            average_duration or 0.0, 2
        ),
        "minimum_duration_ms": round(
            minimum_duration or 0.0, 2
        ),
        "maximum_duration_ms": round(
            maximum_duration or 0.0, 2
        ),
    }


@router.get("/metrics/by-agent")
async def get_agent_metrics(
    db: Session = Depends(get_db),
):
    rows = db.query(
        AgentExecution.agent_name,
        func.count(AgentExecution.id).label("total"),
        func.sum(
            func.cast(
                AgentExecution.status == "completed",
                type_=__import__("sqlalchemy").Integer,
            )
        ).label("completed"),
        func.sum(
            func.cast(
                AgentExecution.status == "failed",
                type_=__import__("sqlalchemy").Integer,
            )
        ).label("failed"),
        func.avg(AgentExecution.duration_ms).label(
            "average_duration"
        ),
    ).group_by(
        AgentExecution.agent_name
    ).all()

    return [
        {
            "agent_name": row.agent_name,
            "total_executions": row.total,
            "completed_executions": row.completed or 0,
            "failed_executions": row.failed or 0,
            "success_rate": round(
                ((row.completed or 0) / row.total) * 100,
                2,
            ) if row.total else 0.0,
            "average_duration_ms": round(
                row.average_duration or 0.0,
                2,
            ),
        }
        for row in rows
    ]


@router.get("/metrics/recent")
async def get_recent_executions(
    limit: int = 10,
    db: Session = Depends(get_db),
):
    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=422,
            detail="Limit must be between 1 and 100.",
        )

    executions = db.query(AgentExecution).order_by(
        AgentExecution.id.desc()
    ).limit(limit).all()

    return [
        {
            "id": item.id,
            "agent_name": item.agent_name,
            "status": item.status,
            "duration_ms": item.duration_ms,
            "executed_at": item.executed_at,
        }
        for item in executions
    ]