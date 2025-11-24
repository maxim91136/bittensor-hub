Halving Estimates and Projection Metadata
=========================================

This document describes the additional fields the `fetch_network.py` producer writes into the `metrics` Cloudflare KV entry (and thus into `network.json`). These fields are intended for frontends and API consumers that display or analyze supply-halving projections.

halving_estimates
------------------
An array of objects, one per configured halving threshold. Each object contains:

- `threshold` (number): target total issuance for the halving event.
- `remaining` (number): tokens remaining until the threshold (threshold - current issuance).
- `days` (number|null): projected days until the threshold at the `emission_used` rate (rounded to 3 decimals), or `null` if projection not possible.
- `eta` (ISO timestamp|null): estimated date/time when the threshold will be reached, or `null`.
- `method` (string|null): projection method used (e.g. `emission_daily`, `emission_7d`, `emission_daily_low_confidence`, `mean_from_intervals`).
- `emission_used` (number|null): the TAO/day emission rate used to calculate the ETA for this specific threshold.
- `step` (int|null): 1-based index of the halving event (1 = next halving, 2 = following, ...). `null` if the threshold was malformed.
- `delta` (number|null): difference from previous issuance point (useful to see how much this step adds relative to previous step). Typically equals `threshold - previous_threshold` for planned thresholds or `threshold - current_issuance` for the first step.

Projection metadata (top-level fields)
--------------------------------------
- `avg_emission_for_projection` (number|null): the emission rate selected for projection (rounded); may be `emission_7d`, `emission_daily`, or a mean from intervals depending on data availability.
- `projection_method` (string|null): which method was used to choose the projection rate.
- `projection_confidence` (string): `'low'|'medium'|'high'` depending on days of history used (signals reliability).
- `projection_days_used` (int|null): how many days of data were effectively used to build the projection.

History diagnostics
-------------------
- `history_samples` (int): number of snapshots in the local `issuance_history` used to compute deltas.
- `per_interval_samples` (int): number of per-interval delta samples computed from the history.
- `days_of_history` (float|null): approximate days covered by the stored history (e.g. 0.8).

Example `halving_estimates` entry
---------------------------------

```
{
  "step": 1,
  "threshold": 10500000.0,
  "delta": 129636.373871,
  "remaining": 129636.373871,
  "days": 18.027,
  "eta": "2025-12-12T17:41:26.716320+00:00",
  "method": "emission_daily_low_confidence",
  "emission_used": 7191.158758
}
```

Notes
-----
- `emission_used` is included per-entry so consumers can display or debug the exact rate used for that ETA. The simulation halves the emission after each threshold is reached; therefore the `emission_used` for step N is expected to be approximately half of step N-1.
- If projection confidence is `low`, consumers may choose to hide ETA values or annotate them as low-confidence.


Maintainers: update this doc if the producer script changes the projection fields or their semantics.
