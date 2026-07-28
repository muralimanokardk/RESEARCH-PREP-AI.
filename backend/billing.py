"""
Razorpay Subscriptions integration for Research Prep AI.
Exposes /api/billing routes:
  POST /api/billing/subscription   → create subscription, returns { short_url, subscription_id }
  POST /api/billing/webhook        → Razorpay webhook (signature-verified)
  GET  /api/billing/status         → current user's plan/tier/next_billing
  POST /api/billing/cancel         → cancel (immediate or at period end)
  GET  /api/billing/plans          → static plan catalog for the paywall UI

Also exposes `require_quota(user, feature, db)` to gate features.
"""
from __future__ import annotations
import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
import razorpay

log = logging.getLogger("billing")

# ---------------------------------------------------------------------------
# Plan catalog (INR, paise units)
# ---------------------------------------------------------------------------
PLAN_CATALOG = {
    "student": {
        "tier": "student",
        "name": "Student",
        "amount_paise": 74900,      # ₹749/month (~$9)
        "amount_display": "₹749",
        "period": "monthly",
        "interval": 1,
        "features": [
            "Unlimited projects",
            "100 paper uploads / month",
            "20 topic generations / day",
            "Proposal & citation builder",
        ],
    },
    "pro": {
        "tier": "pro",
        "name": "Research Pro",
        "amount_paise": 239900,     # ₹2,399/month (~$29)
        "amount_display": "₹2,399",
        "period": "monthly",
        "interval": 1,
        "features": [
            "Everything in Student",
            "Unlimited paper uploads",
            "200 topic generations / day",
            "10-slide PPT generator",
            "AI Tutor (Stella) chat",
            "Priority Claude Sonnet 4.5 responses",
        ],
    },
}

# feature → per-tier quota (soft daily/monthly limits, 0 = disabled, big # = unlimited)
FEATURE_QUOTAS = {
    "topic_gens_day":     {"free": 5,   "student": 20,  "pro": 200},
    "paper_uploads_month":{"free": 3,   "student": 100, "pro": 1000},
    "ppt_unlock":         {"free": 0,   "student": 0,   "pro": 999},
    "chat_msgs_day":      {"free": 5,   "student": 50,  "pro": 500},
    "proposal_gens_month":{"free": 1,   "student": 20,  "pro": 200},
}


class CreateSubscriptionIn(BaseModel):
    tier: str = Field(pattern="^(student|pro)$")


class CancelIn(BaseModel):
    cancel_at_period_end: bool = False


# ---------------------------------------------------------------------------
# Client / plan bootstrap
# ---------------------------------------------------------------------------
def _client() -> razorpay.Client:
    key_id = os.environ.get("RAZORPAY_KEY_ID", "")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret or "placeholder" in key_id or "placeholder" in key_secret:
        raise HTTPException(
            status_code=503,
            detail="Razorpay is not configured yet. Add RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET to /app/backend/.env.",
        )
    return razorpay.Client(auth=(key_id, key_secret))


async def _ensure_plans(db) -> dict:
    """Return {'student_plan_id': ..., 'pro_plan_id': ...}. Creates plans in Razorpay if missing."""
    seed = await db.billing_plans.find_one({"_id": "seed"}, {"_id": 0})
    student_id = os.environ.get("RAZORPAY_STUDENT_PLAN_ID") or (seed or {}).get("student_plan_id")
    pro_id = os.environ.get("RAZORPAY_PRO_PLAN_ID") or (seed or {}).get("pro_plan_id")
    if student_id and pro_id:
        return {"student_plan_id": student_id, "pro_plan_id": pro_id}

    rz = _client()
    if not student_id:
        s = PLAN_CATALOG["student"]
        created = rz.plan.create({
            "period": s["period"],
            "interval": s["interval"],
            "item": {"name": s["name"], "amount": s["amount_paise"], "currency": "INR",
                     "description": "Research Prep AI Student subscription"},
            "notes": {"tier": "student"},
        })
        student_id = created["id"]
    if not pro_id:
        p = PLAN_CATALOG["pro"]
        created = rz.plan.create({
            "period": p["period"],
            "interval": p["interval"],
            "item": {"name": p["name"], "amount": p["amount_paise"], "currency": "INR",
                     "description": "Research Prep AI Pro subscription"},
            "notes": {"tier": "pro"},
        })
        pro_id = created["id"]

    await db.billing_plans.update_one(
        {"_id": "seed"},
        {"$set": {"student_plan_id": student_id, "pro_plan_id": pro_id,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"student_plan_id": student_id, "pro_plan_id": pro_id}


# ---------------------------------------------------------------------------
# Feature gating (used from other modules)
# ---------------------------------------------------------------------------
async def get_effective_tier(db, user_id: str) -> str:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "billing": 1})
    return ((user or {}).get("billing") or {}).get("plan_tier", "free")


async def require_quota(db, user_id: str, feature: str, cost: int = 1) -> None:
    """Enforce per-tier quotas. Raises HTTPException(402) if exceeded."""
    if feature not in FEATURE_QUOTAS:
        return
    tier = await get_effective_tier(db, user_id)
    limit = FEATURE_QUOTAS[feature].get(tier, 0)
    if limit <= 0 and tier == "free" and feature == "ppt_unlock":
        raise HTTPException(status_code=402,
                            detail={"error": "upgrade_required", "feature": feature,
                                    "message": "Upgrade to Research Pro to generate presentations."})

    # per-day or per-month window
    now = datetime.now(timezone.utc)
    if feature.endswith("_day"):
        window = now.strftime("%Y-%m-%d")
    else:
        window = now.strftime("%Y-%m")

    doc = await db.usage.find_one({"user_id": user_id, "feature": feature, "window": window})
    used = (doc or {}).get("count", 0)
    if used + cost > limit:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "quota_exceeded",
                "feature": feature,
                "tier": tier,
                "limit": limit,
                "used": used,
                "message": f"You've hit the {tier} tier limit for this feature. Upgrade for higher quotas.",
            },
        )
    await db.usage.update_one(
        {"user_id": user_id, "feature": feature, "window": window},
        {"$inc": {"count": cost}, "$setOnInsert": {"created_at": now.isoformat()}},
        upsert=True,
    )


# ---------------------------------------------------------------------------
# Router factory (bound to a `db` and `get_current_user` from the main app)
# ---------------------------------------------------------------------------
def build_router(db, get_current_user):
    router = APIRouter(prefix="/api/billing", tags=["billing"])

    @router.get("/plans")
    async def list_plans():
        return {
            "currency": "INR",
            "plans": [
                {
                    "tier": "free",
                    "name": "Free",
                    "amount_paise": 0,
                    "amount_display": "₹0",
                    "features": [
                        "5 topic generations / day",
                        "3 paper uploads / month",
                        "1 proposal / month",
                        "Basic AI tutor",
                    ],
                },
                {k: v for k, v in PLAN_CATALOG["student"].items()},
                {k: v for k, v in PLAN_CATALOG["pro"].items()},
            ],
        }

    @router.get("/status")
    async def status(current=Depends(get_current_user)):
        u = await db.users.find_one({"id": current["id"]}, {"_id": 0, "billing": 1})
        b = (u or {}).get("billing") or {}
        return {
            "tier": b.get("plan_tier", "free"),
            "status": b.get("status", "free"),
            "next_billing_at": b.get("next_billing_at"),
            "cancel_at_period_end": b.get("cancel_at_period_end", False),
            "subscription_id": b.get("subscription_id"),
        }

    @router.post("/subscription")
    async def create_subscription(body: CreateSubscriptionIn, current=Depends(get_current_user)):
        plans = await _ensure_plans(db)
        plan_id = plans["student_plan_id"] if body.tier == "student" else plans["pro_plan_id"]
        rz = _client()
        try:
            sub = rz.subscription.create({
                "plan_id": plan_id,
                "total_count": 12,
                "customer_notify": 1,
                "notes": {"user_id": str(current["id"]), "tier": body.tier},
            })
        except Exception as e:
            log.exception("Razorpay subscription.create failed")
            raise HTTPException(status_code=502, detail=f"Razorpay error: {e}")

        await db.users.update_one(
            {"id": current["id"]},
            {"$set": {
                "billing.subscription_id": sub["id"],
                "billing.plan_tier": body.tier,       # optimistic
                "billing.status": sub.get("status", "created"),
                "billing.cancel_at_period_end": False,
                "billing.updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {
            "subscription_id": sub["id"],
            "short_url": sub.get("short_url"),
            "status": sub.get("status"),
            "tier": body.tier,
        }

    @router.post("/cancel")
    async def cancel(body: CancelIn, current=Depends(get_current_user)):
        u = await db.users.find_one({"id": current["id"]}, {"_id": 0, "billing": 1})
        sub_id = ((u or {}).get("billing") or {}).get("subscription_id")
        if not sub_id:
            raise HTTPException(status_code=404, detail="No active subscription")
        rz = _client()
        try:
            if body.cancel_at_period_end:
                rz.subscription.cancel(sub_id, {"cancel_at_cycle_end": 1})
                await db.users.update_one(
                    {"id": current["id"]},
                    {"$set": {"billing.cancel_at_period_end": True,
                              "billing.updated_at": datetime.now(timezone.utc).isoformat()}},
                )
                return {"ok": True, "cancel_at_period_end": True}
            rz.subscription.cancel(sub_id)
            await db.users.update_one(
                {"id": current["id"]},
                {"$set": {"billing.status": "cancelled", "billing.plan_tier": "free",
                          "billing.updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            return {"ok": True, "cancelled": True}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Razorpay error: {e}")

    @router.post("/webhook")
    async def webhook(request: Request,
                      x_razorpay_signature: Optional[str] = Header(None),
                      x_razorpay_event_id: Optional[str] = Header(None)):
        raw = await request.body()
        body_text = raw.decode("utf-8")
        secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
        if not secret or "placeholder" in secret:
            raise HTTPException(status_code=503, detail="Webhook secret not configured")
        if not x_razorpay_signature:
            raise HTTPException(status_code=400, detail="Missing signature")

        # dedupe
        if x_razorpay_event_id:
            seen = await db.webhook_events.find_one({"event_id": x_razorpay_event_id})
            if seen:
                return {"ok": True, "deduped": True}

        try:
            razorpay.Client(auth=("k", "k")).utility.verify_webhook_signature(
                body_text, x_razorpay_signature, secret
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid signature")

        event = json.loads(body_text)
        event_type = event.get("event", "")
        entity = ((event.get("payload") or {}).get("subscription") or {}).get("entity") or {}
        sub_id = entity.get("id")
        notes = entity.get("notes") or {}
        user_id = notes.get("user_id")

        update: dict = {
            "billing.subscription_id": sub_id,
            "billing.razorpay_status": entity.get("status"),
            "billing.cancel_at_period_end": bool(entity.get("cancel_at_cycle_end", False)),
            "billing.next_billing_at": entity.get("charge_at") or entity.get("current_end"),
            "billing.updated_at": datetime.now(timezone.utc).isoformat(),
        }
        tier = notes.get("tier", "student")

        if event_type in {"subscription.activated", "subscription.charged"}:
            update["billing.plan_tier"] = tier
            update["billing.status"] = "active"
        elif event_type in {"subscription.cancelled", "subscription.completed",
                            "subscription.halted", "subscription.expired"}:
            update["billing.status"] = "cancelled"
            update["billing.plan_tier"] = "free"

        if user_id:
            await db.users.update_one({"id": user_id}, {"$set": update})

        if x_razorpay_event_id:
            await db.webhook_events.insert_one({
                "event_id": x_razorpay_event_id,
                "type": event_type,
                "received_at": datetime.now(timezone.utc).isoformat(),
            })
        return {"ok": True, "event": event_type}

    return router
