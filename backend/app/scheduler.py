import asyncio
import logging

from backend.app.database import SessionLocal
from backend.app.services.schedule_service import run_due_schedules

logger = logging.getLogger(__name__)


def run_scheduler_tick() -> int:
    """Create and close the SQLAlchemy session in the worker thread."""
    db = SessionLocal()
    try:
        return run_due_schedules(db)
    finally:
        db.close()


async def benchmark_scheduler_loop():
    """Poll due schedules every 15 seconds while the API process is running."""
    while True:
        try:
            completed = await asyncio.to_thread(run_scheduler_tick)
            if completed:
                logger.info("Scheduled benchmark runs completed: %s", completed)
        except Exception:
            logger.exception("Scheduled benchmark polling failed.")

        await asyncio.sleep(15)
