"""Small Actions adapter; no peer access and no clock override."""
import argparse
import json
import os
from pathlib import Path

import exchange


def summarize(path, exit_code, output, summary):
    try:
        result = json.loads(Path(path).read_text())
        if not isinstance(result, dict):
            raise ValueError('Expected an object')
    except (OSError, ValueError):
        result = {'status': 'failed_before_receipt'}
    outcome = 'failed' if exit_code else exchange.result_outcome(result)
    # Do not interpolate arbitrary peer strings into Actions command/output files.
    with open(output, 'a') as stream:
        stream.write(f'outcome={outcome}\n')
    with open(summary, 'a') as stream:
        stream.write(f'\nExchange outcome: **{outcome}**. Semantic AI review: **not performed**.\n\n')
        for item in result.get('results', [result]):
            stream.write(f"- Reporting day: `{item.get('date', 'unknown')}`; document status: `{item.get('status', 'unknown')}`.\n")
            if item.get('status') == exchange.DEFERRED:
                stream.write(f"  Next eligible window starts: `{item.get('next_eligible_at', 'next midnight')}`; receipt remains pending. This is not a receipt success or an exact retry appointment.\n")
        if result.get('deferred_dates_remaining'):
            stream.write('\nOlder deferred dates still pending: ' + ', '.join(result['deferred_dates_remaining']) + '.\n')
    return 1 if outcome == 'failed' else 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--result', required=True)
    parser.add_argument('--exit-code', required=True, type=int)
    args = parser.parse_args()
    return summarize(args.result, args.exit_code, os.environ['GITHUB_OUTPUT'], os.environ['GITHUB_STEP_SUMMARY'])


if __name__ == '__main__':
    raise SystemExit(main())
