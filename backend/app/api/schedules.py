from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas import (
    ScheduledBenchmarkCreate,
    ScheduledBenchmarkResponse,
    ScheduledBenchmarkUpdate,
)
from backend.app.services import schedule_service

router = APIRouter(prefix="/api/schedules", tags=["Scheduled Benchmarks"])


@router.post(
    "/",
    response_model=ScheduledBenchmarkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_scheduled_benchmark(
    payload: ScheduledBenchmarkCreate,
    db: Session = Depends(get_db),
):
    try:
        return schedule_service.create_schedule(db, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/", response_model=list[ScheduledBenchmarkResponse])
async def get_scheduled_benchmarks(db: Session = Depends(get_db)):
    return schedule_service.list_schedules(db)


@router.get("/{schedule_id}", response_model=ScheduledBenchmarkResponse)
async def get_scheduled_benchmark(
    schedule_id: int,
    db: Session = Depends(get_db),
):
    schedule = schedule_service.get_schedule(db, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Scheduled benchmark not found.")
    return schedule


@router.patch("/{schedule_id}", response_model=ScheduledBenchmarkResponse)
async def update_scheduled_benchmark(
    schedule_id: int,
    payload: ScheduledBenchmarkUpdate,
    db: Session = Depends(get_db),
):
    schedule = schedule_service.update_schedule(db, schedule_id, payload)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Scheduled benchmark not found.")
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduled_benchmark(
    schedule_id: int,
    db: Session = Depends(get_db),
):
    if not schedule_service.delete_schedule(db, schedule_id):
        raise HTTPException(status_code=404, detail="Scheduled benchmark not found.")
    return None
