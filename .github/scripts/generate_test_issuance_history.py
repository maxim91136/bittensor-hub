#!/usr/bin/env python3
"""Generate synthetic issuance_history JSON file for local testing.

This script creates a history with N entries spaced approx 15 minutes apart and
increments issuance in small amounts to simulate emission, then writes to
issuance_history.json in the current directory.
"""
import json
import os
from datetime import datetime, timezone, timedelta

OUTFILE = os.path.join(os.getcwd(), 'issuance_history.json')

def generate_history(days=3, start_issuance=10300000.0, per_day_emission=7200.0):
    # 96 samples per day (15 min) approximate
    samples_per_day = 96
    total_samples = samples_per_day * days
    history = []
    now = datetime.now(timezone.utc)
    start_ts = int((now - timedelta(days=days)).timestamp())
    # Baseline per-sample issuance
    per_sample = per_day_emission / samples_per_day
    issuance = float(start_issuance)
    for i in range(total_samples):
        ts = start_ts + i * 900  # 900 seconds => ~15 minutes
        # add a little noise
        issuance += per_sample * (1 + (0.02 * ((i % 5) - 2)))
        history.append({'ts': ts, 'issuance': round(issuance, 9)})
    return history

def main():
    hist = generate_history(days=7)
    with open(OUTFILE, 'w') as f:
        json.dump(hist, f, indent=2)
    print(f"Wrote {len(hist)} synthetic issuance snapshots to {OUTFILE}")

if __name__ == '__main__':
    main()
