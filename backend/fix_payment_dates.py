"""
Migration script to fix existing payments that are marked as "paid" but don't have paid_at date.
Run this once to fix historical data.
"""
import asyncio
from datetime import datetime, timezone
from sqlite_db import create_database

async def fix_payment_dates():
    db = create_database()
    
    # Find all payments with status "paid" or "partial" but no paid_at
    payments = await db.payments.find({}, {"_id": 0}).to_list(5000)
    
    fixed_count = 0
    for payment in payments:
        needs_update = False
        update_data = {}
        
        # If status is "paid" or "partial" but no paid_at, set it
        if payment.get("status") in ("paid", "partial") and not payment.get("paid_at"):
            update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
            needs_update = True
            print(f"Setting paid_at for payment {payment.get('id')} (status: {payment.get('status')})")
        
        # If paid_amount >= amount, ensure status is "paid" and paid_at is set
        paid_amount = float(payment.get("paid_amount", 0) or 0)
        amount = float(payment.get("amount", 0) or 0)
        
        if paid_amount >= amount and amount > 0:
            if payment.get("status") != "paid":
                update_data["status"] = "paid"
                needs_update = True
                print(f"Setting status to 'paid' for payment {payment.get('id')}")
            
            if not payment.get("paid_at"):
                update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
                needs_update = True
                print(f"Setting paid_at for fully paid payment {payment.get('id')}")
        
        # If paid_amount > 0 but < amount, ensure status is "partial"
        elif paid_amount > 0 and paid_amount < amount:
            if payment.get("status") not in ("partial", "paid"):
                update_data["status"] = "partial"
                needs_update = True
                print(f"Setting status to 'partial' for payment {payment.get('id')}")
            
            if not payment.get("paid_at"):
                update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
                needs_update = True
                print(f"Setting paid_at for partial payment {payment.get('id')}")
        
        if needs_update:
            await db.payments.update_one(
                {"id": payment.get("id")},
                {"$set": update_data}
            )
            fixed_count += 1
    
    print(f"\n✅ Fixed {fixed_count} payments")
    print(f"Total payments in database: {len(payments)}")
    
    # Show summary
    updated_payments = await db.payments.find({}, {"_id": 0}).to_list(5000)
    paid_count = sum(1 for p in updated_payments if p.get("status") == "paid")
    partial_count = sum(1 for p in updated_payments if p.get("status") == "partial")
    pending_count = sum(1 for p in updated_payments if p.get("status") == "pending")
    
    print(f"\nPayment Status Summary:")
    print(f"  Paid: {paid_count}")
    print(f"  Partial: {partial_count}")
    print(f"  Pending: {pending_count}")
    
    # Calculate total revenue
    total_revenue = sum(float(p.get("paid_amount", 0) or 0) for p in updated_payments if p.get("paid_at"))
    print(f"\nTotal Revenue (with paid_at): ₹{total_revenue:,.2f}")

if __name__ == "__main__":
    asyncio.run(fix_payment_dates())
