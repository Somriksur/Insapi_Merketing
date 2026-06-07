"""AI-style helpers using deterministic local fallbacks."""
from __future__ import annotations

from typing import Any, Dict, List


async def generate_insights(stats: Dict[str, Any]) -> List[str]:
    """Return 3-5 short, sharp insights for the dashboard."""
    return _fallback_insights(stats)


async def forecast_revenue(history: List[Dict[str, Any]], target: float) -> Dict[str, Any]:
    """Return predicted month-end revenue and a one-line note."""
    return _fallback_forecast(history, target)


async def prioritize_tasks(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return tasks reordered with an ai_score (0-100) and short reason."""
    return _fallback_priority(tasks)


async def weekly_summary(stats: Dict[str, Any]) -> str:
    """Return a short paragraph summarising the week's performance."""
    return _fallback_summary(stats)


def _fallback_insights(s: Dict[str, Any]) -> List[str]:
    monthly = s.get("monthly_revenue", 0)
    target = s.get("monthly_target", 30000)
    pending = s.get("pending_amount", 0)
    insights = [
        f"Monthly revenue at Rs. {monthly:,.0f} of Rs. {target:,.0f} target.",
        f"Pending payments worth Rs. {pending:,.0f} can close the gap fast.",
        "Reel editing is your highest-margin format; book 2 more this week.",
        "Send polite reminders for invoices overdue beyond 7 days.",
    ]
    return insights


def _fallback_forecast(history: List[Dict[str, Any]], target: float) -> Dict[str, Any]:
    if not history:
        return {"predicted_total": 0, "confidence": 0.5, "note": "Not enough data to forecast yet."}
    avg = sum(h.get("amount", 0) for h in history) / max(1, len(history))
    pred = avg * 30
    return {
        "predicted_total": round(pred, 2),
        "confidence": 0.6,
        "note": "On track to beat target." if pred >= target else "Below target; push more billable work.",
    }


def _fallback_priority(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    weight = {"urgent": 90, "high": 75, "medium": 50, "low": 25}
    out = []
    for task in tasks:
        score = weight.get(task.get("priority", "medium"), 50)
        if task.get("billable_amount", 0) > 0:
            score += 5
        out.append({**task, "ai_score": min(100, score), "ai_reason": "Heuristic priority score."})
    out.sort(key=lambda item: item["ai_score"], reverse=True)
    return out


def _fallback_summary(s: Dict[str, Any]) -> str:
    return (
        f"You earned Rs. {s.get('weekly_revenue', 0):,.0f} this week and completed "
        f"{s.get('tasks_completed_week', 0)} tasks. Keep the streak going by clearing "
        f"{s.get('pending_tasks', 0)} pending tasks early next week."
    )
