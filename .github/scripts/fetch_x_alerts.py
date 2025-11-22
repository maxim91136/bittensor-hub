#!/usr/bin/env python3
"""Fetch latest Tweets for a user (TAO Alert) and write to file / stdout.

Usage:
  X_BEARER_TOKEN='...' X_USER_ID='...' python3 .github/scripts/fetch_x_alerts.py --out alerts.json --max 5
"""
import os
import sys
import json
import argparse
from datetime import datetime, timezone
import time

try:
    import requests
except Exception:
    requests = None

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def fetch_tweets(bearer_token: str, user_id: str, max_results: int = 5, max_attempts: int = 3, backoff_seconds: int = 2, since_id: str | None = None):
    url = f"https://api.twitter.com/2/users/{user_id}/tweets"
    params = {
        'max_results': min(100, max_results),
        'tweet.fields': 'created_at,edit_history_tweet_ids,author_id'
    }
    headers = {'Authorization': f'Bearer {bearer_token}', 'Accept': 'application/json'}

    attempt = 0
    while True:
        attempt += 1
        if since_id:
            params['since_id'] = str(since_id)
        if requests:
            try:
                resp = requests.get(url, headers=headers, params=params, timeout=15)
            except Exception as e:
                if attempt >= max_attempts:
                    raise
                sleep_for = backoff_seconds * (2 ** (attempt - 1))
                print(f"Request failed (attempt {attempt}/{max_attempts}) with error {e}, retrying in {sleep_for}s")
                import time; time.sleep(sleep_for)
                continue
        else:
            # fallback to standard library
            from urllib.request import Request, urlopen
            from urllib.parse import urlencode
            query = urlencode({k: str(v) for k, v in params.items()})
            req = Request(url + '?' + query, headers=headers)
            try:
                with urlopen(req, timeout=15) as r:
                    raw = r.read()
                class R:
                    status_code = 200
                    headers = {}
                    def json(self):
                        return json.loads(raw)
                resp = R()
            except Exception as e:
                if attempt >= max_attempts:
                    raise
                sleep_for = backoff_seconds * (2 ** (attempt - 1))
                print(f"Stdlib request failed (attempt {attempt}/{max_attempts}) error: {e}, retrying in {sleep_for}s")
                time.sleep(sleep_for)
                continue

        # Handle HTTP responses
        status_code = getattr(resp, 'status_code', 200)
        # If requests, also get headers
        resp_headers = getattr(resp, 'headers', {})
        if status_code == 429:
            reset = None
            # Twitter often includes x-rate-limit-reset (epoch seconds) header
            if isinstance(resp_headers, dict):
                reset = resp_headers.get('x-rate-limit-reset') or resp_headers.get('X-Rate-Limit-Reset')
            if reset:
                try:
                    reset_ts = int(reset)
                    import time
                    now_ts = int(time.time())
                    wait = max(0, reset_ts - now_ts)
                    print(f"Rate limited: will wait until reset in {wait}s")
                    # If reset is soon, wait before next attempt; otherwise use backoff
                    if wait <= 60:
                        time.sleep(wait + 1)
                    else:
                        # If the wait is long, break earlier and let the job fail
                        # If the wait is longer than 5 minutes, write a _skipped file and exit gracefully
                        if wait > 300:
                            skipped = {'fetched_at': now_iso(), 'alerts': [], '_skipped': True, 'wait_seconds': wait}
                            return skipped
                        if attempt >= max_attempts:
                            raise RuntimeError(f"Rate limited and reset too far in future ({wait}s)")
                        time.sleep(backoff_seconds * (2 ** (attempt - 1)))
                except Exception:
                    # fallback generic sleep
                    if attempt >= max_attempts:
                        raise RuntimeError("Rate limited and failed to parse reset header")
                    import time; time.sleep(backoff_seconds * (2 ** (attempt - 1)))
                continue
            else:
                # generic handling for 429 without reset header
                if attempt >= max_attempts:
                    raise RuntimeError("Rate limited (429) and no more attempts left")
                import time; time.sleep(backoff_seconds * (2 ** (attempt - 1)))
                continue

        if status_code == 401:
            # Unauthorized access: token may be missing/invalid/expired
            raise PermissionError('Unauthorized: HTTP 401 received from X API. Check X_BEARER_TOKEN validity and permission scopes (read/tweets).')
        if 400 <= status_code:
            # non-429 client/server errors
            try:
                body = resp.json() if hasattr(resp, 'json') else None
            except Exception:
                body = None
            raise RuntimeError(f"X API error: status={status_code} body={body}")
        data = resp.json() if hasattr(resp, 'json') else None
        # Successful response - exit retry loop
        break

    tweets = data.get('data', []) if data else []
    alerts = []
    for t in tweets[:max_results]:
        alerts.append({
            'id': t.get('id'),
            'text': t.get('text'),
            'edit_history_tweet_ids': t.get('edit_history_tweet_ids') or [],
            'author_id': t.get('author_id'),
            'created_at': t.get('created_at')
        })
    return {'fetched_at': now_iso(), 'alerts': alerts}

def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--out', '-o', help='Write output JSON to path (default: x_alerts_latest.json)')
    p.add_argument('--since', help='Only return tweets with ID greater than (i.e., more recent) than this Tweet ID', default=None)
    p.add_argument('--max', '-m', help='Max number of tweets to fetch', type=int, default=5)
    args = p.parse_args(argv)

    bearer = os.getenv('X_BEARER_TOKEN')
    user_id = os.getenv('X_USER_ID')
    if not bearer or not user_id:
        print('X_BEARER_TOKEN and X_USER_ID must be set', file=sys.stderr)
        sys.exit(2)

    attempts = int(os.getenv('RETRY_ATTEMPTS', '3'))
    backoff = int(os.getenv('RETRY_BACKOFF', '2'))
    since_id = args.since or os.getenv('SINCE_ID')
    try:
        out = fetch_tweets(bearer, user_id, args.max, max_attempts=attempts, backoff_seconds=backoff, since_id=since_id)
        out_str = json.dumps(out, indent=2)
        out_path = args.out or 'x_alerts_latest.json'
        if out_path:
            with open(out_path, 'w', encoding='utf-8') as fh:
                fh.write(out_str)
            print('Wrote', out_path)
        else:
            print(out_str)
    except PermissionError as e:
        print('Unauthorized error:', e, file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print('Error', e, file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
