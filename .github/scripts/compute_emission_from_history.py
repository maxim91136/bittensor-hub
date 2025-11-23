#!/usr/bin/env python3
"""Compute emission stats from an issuance_history.json file.

This mirrors the emission calculation in fetch_network.py and prints results.
"""
import json
import os
from datetime import datetime, timezone
import math

INFILE = os.path.join(os.getcwd(), 'issuance_history.json')

def compute_per_interval_deltas(hist):
    out = []
    for i in range(1, len(hist)):
        a = hist[i - 1]
        b = hist[i]
        dt = b['ts'] - a['ts']
        if dt <= 0:
            continue
        delta = b['issuance'] - a['issuance']
        per_day = delta * (86400.0 / dt)
        out.append({'ts': b['ts'], 'per_day': per_day})
    return out

def winsorized_mean(arr, trim=0.1):
    n = len(arr)
    if n == 0:
        return None
    s = sorted(arr)
    k = int(n * trim)
    if k >= n // 2:
        return sum(s) / len(s)
    trimmed = s[k:n - k]
    if not trimmed:
        return sum(s) / len(s)
    return sum(trimmed) / len(trimmed)

def main():
    if not os.path.exists(INFILE):
        print('issuance_history.json not found, run generate_test_issuance_history.py first')
        return
    with open(INFILE, 'r') as f:
        hist = json.load(f)
    per_interval_deltas = compute_per_interval_deltas(hist)
    deltas_last_24h = [d['per_day'] for d in per_interval_deltas if d['ts'] >= (int(datetime.now(timezone.utc).timestamp()) - 86400)]
    emission_daily = winsorized_mean(deltas_last_24h, 0.1)
    daily_groups = {}
    for d in per_interval_deltas:
        day = datetime.fromtimestamp(d['ts'], timezone.utc).strftime('%Y-%m-%d')
        daily_groups.setdefault(day, []).append(d['per_day'])
    days_sorted = sorted(daily_groups.keys())
    daily_means = [sum(daily_groups[day]) / len(daily_groups[day]) for day in days_sorted]
    emission_7d = None
    emission_30d = None
    emission_sd_7d = None
    if daily_means:
        last7 = daily_means[-7:]
        if last7:
            emission_7d = winsorized_mean(last7, 0.1)
            mean7 = emission_7d
            sd7 = math.sqrt(sum((v - mean7) ** 2 for v in last7) / len(last7)) if len(last7) > 0 else 0
            emission_sd_7d = sd7
        last30 = daily_means[-30:]
        if last30:
            emission_30d = winsorized_mean(last30, 0.1)
    print('emission_daily:', emission_daily)
    print('emission_7d:', emission_7d)
    print('emission_30d:', emission_30d)
    print('emission_sd_7d:', emission_sd_7d)
    print('per_interval_samples:', len(per_interval_deltas))

if __name__ == '__main__':
    main()
