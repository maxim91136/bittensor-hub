Docs Index
===========

This folder contains documentation related to issuance history, emission metrics and halving projection fields produced by `fetch_network.py` and exposed via the network API.

Files
-----

- `HALVING_ESTIMATES.md` — Detailed documentation of the `halving_estimates` array and projection metadata. Explains fields like `threshold`, `remaining`, `eta`, `emission_used`, `step`, and `delta`.

- `ISSUANCE_HISTORY_README.md` — Operational notes about how issuance snapshots are collected and stored in Cloudflare KV (`issuance_history`), security considerations for CI, and how to backfill or test locally.

How to use
----------
- For frontend or API work, prefer `HALVING_ESTIMATES.md` for field semantics and examples.
- For operational guidance on the scheduled job and KV handling, consult `ISSUANCE_HISTORY_README.md`.

Want this linked from the repository root `README.md`? I can add a short pointer there as well.
