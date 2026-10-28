import base64
import contextlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import textwrap
import unittest
from unittest.mock import patch

import exchange
import workflow


REPO = Path(__file__).resolve().parents[2]
WORKFLOW = REPO / '.github/workflows/dev-exchange.yml'


def run_block(name):
    text = WORKFLOW.read_text().split('      - name: ' + name + '\n', 1)[1]
    text = text.split('\n      - ', 1)[0].split('        run: |\n', 1)[1]
    return textwrap.dedent(text)


class RetryTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.directory = Path(temp.name)
        self.source = self.directory / 'source'
        self.output = self.directory / 'reports'
        self.cfg = exchange.config(REPO)
        path = self.source / 'docs/dev_exchange/config.json'
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(self.cfg))
        self.calls = []

    def gh(self, endpoint):
        self.calls.append(endpoint)
        if '/git/ref/' in endpoint:
            return {'object': {'sha': 'a' * 40}}
        if '/commits/' in endpoint:
            return {'sha': 'b' * 40}
        day = re.search(r'/devmeet/(\d{4}-\d{2}-\d{2})\.', endpoint)[1]
        markdown = ('# Peer ' + day + '\n').encode()
        start, end = exchange.window(day, self.cfg)
        manifest = dict(schema_version=1, status='published', date=day,
                        repo=self.cfg['peer_repo'], source_sha='b' * 40,
                        report_id=exchange.report_id(self.cfg['peer_repo'], end),
                        window={'start_exclusive': start.isoformat(), 'end_inclusive': end.isoformat()},
                        markdown_sha256=exchange.digest(markdown),
                        authored_decision_record='absent', notes_blob_sha=None, notes_sha256=None)
        data = exchange.serialized(manifest) if '.json?' in endpoint else markdown
        return {'encoding': 'base64', 'size': len(data), 'content': base64.b64encode(data).decode()}

    def receive(self, day='2026-10-27', now='2026-10-28T00:02:00+09:00', batch=False, gh=None):
        operation = exchange.receive_with_deferred if batch else exchange.receive
        return operation(day, self.source, self.output, gh=gh or self.gh, now=now)

    def defer(self, day):
        return self.receive(day, now='2026-10-28T04:50:05+09:00')

    def test_observed_late_run_has_no_peer_calls_and_retains_retry_date(self):
        result = self.defer('2026-10-27')
        self.assertEqual(self.calls, [])
        self.assertEqual(exchange.result_outcome(result), 'deferred')
        self.assertEqual(result['date'], '2026-10-27')
        self.assertEqual(result['next_eligible_at'], '2026-10-29T00:00:00+09:00')
        self.assertNotIn('error_type', result)
        self.assertFalse(result['semantic_review_performed'])
        receipts = list((self.output / 'docs/dev_exchange/inbox/2026-10-27').glob('*.json'))
        self.assertEqual(json.loads(receipts[0].read_text()), result)

    def test_next_eligible_window_before_midnight_and_at_close(self):
        for now, expected in [('2026-10-27T23:59:59+09:00', '2026-10-28T00:00:00+09:00'),
                              ('2026-10-28T00:20:00+09:00', '2026-10-29T00:00:00+09:00')]:
            self.assertEqual(self.receive(now=now)['next_eligible_at'], expected)
        self.assertEqual(self.calls, [])

    def test_next_window_retries_original_day_and_preserves_receipt(self):
        self.defer('2026-10-26')
        prior = {p: p.read_bytes() for p in self.output.rglob('*') if p.is_file()}
        result = self.receive(batch=True)
        self.assertEqual([r['date'] for r in result['results']], ['2026-10-27', '2026-10-26'])
        self.assertEqual(exchange.result_outcome(result), 'completed')
        self.assertEqual(result['deferred_dates_remaining'], [])
        self.assertTrue(any('/2026-10-26.json?' in call for call in self.calls))
        for path, data in prior.items():
            self.assertEqual(path.read_bytes(), data)

    def test_duplicate_schedule_preserves_verified_bytes_and_avoids_peer_calls(self):
        self.receive(batch=True)
        before = {p: p.read_bytes() for p in self.output.rglob('*') if p.is_file()}
        self.calls.clear()
        result = self.receive(batch=True, now='2026-10-28T00:07:00+09:00')
        self.assertEqual(result['results'][0]['status'], 'already_received')
        self.assertEqual(self.calls, [])
        self.assertEqual(before, {p: p.read_bytes() for p in self.output.rglob('*') if p.is_file()})

    def test_bounded_backlog_current_first_then_three_oldest(self):
        for day in ('2026-10-26', '2026-10-25', '2026-10-24', '2026-10-23'):
            self.defer(day)
        result = self.receive(batch=True)
        self.assertEqual([r['date'] for r in result['results']],
                         ['2026-10-27', '2026-10-23', '2026-10-24', '2026-10-25'])
        self.assertEqual(result['deferred_dates_remaining'], ['2026-10-26'])
        retry = self.receive(batch=True, now='2026-10-28T00:07:00+09:00')
        self.assertEqual(retry['deferred_dates_remaining'], [])

    def test_late_batch_does_not_read_peer_snapshots_or_contact_backlog(self):
        self.defer('2026-10-26')
        peer = self.output / 'docs/dev_exchange/inbox/2026-10-26/peer.json'
        peer.write_text('Not JSON: must never be opened by queue discovery')
        result = self.receive(batch=True, now='2026-10-28T04:50:00+09:00')
        self.assertEqual(len(result['results']), 1)
        self.assertEqual(exchange.result_outcome(result), 'deferred')
        self.assertEqual(result['deferred_dates_remaining'], ['2026-10-26'])
        self.assertEqual(self.calls, [])

    def test_deadline_between_dates_stops_batch(self):
        self.defer('2026-10-25')
        self.defer('2026-10-26')
        # Switch only after the first date has fully finished snapshot/receipt writes.
        original = exchange.receive
        ended = [False]
        def wrapped(day, *args, **kwargs):
            kwargs['now'] = '2026-10-28T00:20:00+09:00' if ended[0] else '2026-10-28T00:19:59+09:00'
            value = original(day, *args, **kwargs)
            ended[0] = True
            return value
        with patch.object(exchange, 'receive', side_effect=wrapped):
            result = self.receive(batch=True)
        self.assertEqual([r['status'] for r in result['results']], ['peer_received', exchange.DEFERRED])
        self.assertEqual(exchange.result_outcome(result), 'deferred')
        self.assertEqual(len(self.calls), 4)
        self.assertEqual(result['deferred_dates_remaining'], ['2026-10-25', '2026-10-26'])

    def test_real_errors_remain_failures_and_stop_batch(self):
        self.defer('2026-10-26')
        for code, status in [(403, 'api_error'), (404, 'peer_missing'), (500, 'api_error')]:
            with self.subTest(code=code):
                def denied(_):
                    raise exchange.APIError(code)
                result = self.receive(batch=True, gh=denied)
                self.assertEqual(result['results'][0]['status'], status)
                self.assertEqual(exchange.result_outcome(result), 'failed')
                self.assertEqual(len(result['results']), 1)

    def test_old_error_shaped_deferral_is_queued_but_real_error_needs_review(self):
        self.defer('2026-10-26')
        directory = self.output / 'docs/dev_exchange/inbox/2026-10-26'
        path = next(directory.glob('*.json'))
        value = json.loads(path.read_text())
        value['error_type'] = 'ExchangeWindowClosed'
        value.pop('next_eligible_at')
        path.write_text(json.dumps(value))
        self.assertEqual(exchange.deferred_days(self.output, '2026-10-27', self.cfg), ['2026-10-26'])
        value['status'] = 'api_error'
        exchange.append_receipt(directory, exchange.iso(value['received_at']), value)
        self.assertEqual(exchange.deferred_days(self.output, '2026-10-27', self.cfg), [])

    def test_completed_date_is_not_requeued_by_later_outside_window_rerun(self):
        self.receive('2026-10-26')
        self.defer('2026-10-26')
        self.assertEqual(exchange.deferred_days(self.output, '2026-10-27', self.cfg), [])

    def test_unknown_or_mixed_failure_status_never_becomes_success(self):
        for status in ('api_error', 'peer_invalid', 'provenance_unverified', 'peer_missing', 'new_status'):
            self.assertEqual(exchange.result_outcome({'status': status}), 'failed')
        result = {'status': 'receive_batch', 'results': [{'status': 'api_error'}, {'status': exchange.DEFERRED}]}
        self.assertEqual(exchange.result_outcome(result), 'failed')

    def test_cli_exit_codes_and_machine_readable_status(self):
        original = exchange.receive
        for now, gh, expected in [('2026-10-28T04:50:00+09:00', self.gh, 0),
                                  ('2026-10-28T00:02:00+09:00', lambda _: (_ for _ in ()).throw(exchange.APIError(403)), 1),
                                  ('2026-10-28T00:07:00+09:00', self.gh, 0)]:
            def operation(day, root, output):
                return original(day, root, output, now=now, gh=gh)
            argv = ['exchange.py', 'receive', '--date', '2026-10-27', '--repo-root', str(self.source), '--output-root', str(self.output)]
            stream = io.StringIO()
            with patch.object(sys, 'argv', argv), patch.object(exchange, 'receive', side_effect=operation), contextlib.redirect_stdout(stream):
                self.assertEqual(exchange.main(), expected)
            self.assertFalse(json.loads(stream.getvalue())['semantic_review_performed'])


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.cfg = exchange.config(REPO)

    def resolve(self, schedule, created='2026-10-27T19:49:17Z', event='schedule', mode='', day=''):
        return exchange.resolve_request(self.cfg, event, schedule, mode, day, created)

    def test_all_yaml_schedules_route_to_correct_operation(self):
        schedules = re.findall(r"cron: '([^']+)'", WORKFLOW.read_text())
        self.assertEqual(set(schedules), set(exchange.PUBLISH_SCHEDULES) | {exchange.RECEIVE_SCHEDULE})
        for schedule in schedules:
            expected = 'receive' if schedule == exchange.RECEIVE_SCHEDULE else 'publish'
            result = self.resolve(schedule)
            self.assertEqual(result['mode'], expected)
            self.assertEqual(result['retry_deferred'], expected == 'receive')
            self.assertEqual(result['date'], '2026-10-27')
        self.assertEqual(self.resolve('0 15 * * *')['mode'], 'receive')
        with self.assertRaises(ValueError):
            self.resolve('45 19 * * *')

    def test_every_receive_slot_is_inside_window_and_off_hour(self):
        minutes, hour, *_ = exchange.RECEIVE_SCHEDULE.split()
        for minute in map(int, minutes.split(',')):
            self.assertNotEqual(minute, 0)
            exchange.check_exchange_window(self.cfg, exchange.iso(f'2026-10-27T{hour}:{minute:02}:00Z'))

    def test_dispatch_exact_date_and_push_never_start_backlog_receive(self):
        for mode in ('validate', 'publish', 'receive'):
            result = self.resolve('', event='workflow_dispatch', mode=mode, day='2026-10-24')
            self.assertEqual(result, {'mode': mode, 'date': '2026-10-24', 'retry_deferred': False})
        self.assertEqual(self.resolve('', event='push')['mode'], 'publish')
        self.assertEqual(self.resolve('', created='2026-10-27T14:29:59Z', event='push')['date'], '2026-10-26')
        self.assertEqual(self.resolve('', created='2026-10-27T14:30:00Z', event='push')['date'], '2026-10-27')

    def test_summary_rejects_empty_invalid_unknown_and_nonzero_success(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for raw, code in [('', 0), ('not json', 0), ('[]', 0), ('{}', 0), ('{"status":"peer_received"}', 1)]:
                (root / 'result').write_text(raw)
                self.assertEqual(workflow.summarize(root / 'result', code, root / 'output', root / 'summary'), 1)

    def test_real_workflow_resolve_shell_uses_run_creation_and_outputs_strings(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'source').symlink_to(REPO, target_is_directory=True)
            (root / 'gh').write_text('#!/bin/sh\nprintf "2026-10-27T19:49:17Z\\n"\n')
            (root / 'gh').chmod(0o755)
            env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                       GITHUB_EVENT_NAME='schedule', SCHEDULE=exchange.RECEIVE_SCHEDULE,
                       REQUEST_MODE='', REQUEST_DATE='', GITHUB_REPOSITORY='yoonjl-svg/halfsword-codex',
                       GITHUB_RUN_ID='40572529260', GITHUB_OUTPUT=str(root / 'output'), GITHUB_STEP_SUMMARY=str(root / 'summary'))
            subprocess.run(['bash', '-euo', 'pipefail', '-c', run_block('Resolve reporting day without moving the cutoff')], cwd=root, env=env, check=True, capture_output=True)
            self.assertEqual((root / 'output').read_text(), 'mode=receive\ndate=2026-10-27\nretry_deferred=true\n')

    def test_real_collection_shell_preserves_deferrals_and_errors(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'source').symlink_to(REPO, target_is_directory=True)
            # Stub only the network-capable exchange process; run the actual adapter.
            wrapper = '#!' + sys.executable + '\n' + textwrap.dedent('''\
                import os, sys
                from pathlib import Path
                if any(arg.endswith('/exchange.py') for arg in sys.argv):
                    Path('args').write_text(' '.join(sys.argv))
                    print(os.environ['TEST_RESULT'])
                    sys.exit(int(os.environ['TEST_EXIT']))
                os.execv(sys.executable, [sys.executable, *sys.argv[1:]])
                ''')
            (root / 'python3').write_text(wrapper)
            (root / 'python3').chmod(0o755)
            for status, code, outcome in [(exchange.DEFERRED, 0, 'deferred'), ('peer_received', 0, 'completed'),
                                           ('document_received_unverified', 0, 'completed'), ('api_error', 1, 'failed'), ('peer_invalid', 1, 'failed')]:
                env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'], RUNNER_TEMP=str(root),
                           GITHUB_OUTPUT=str(root / 'output'), GITHUB_STEP_SUMMARY=str(root / 'summary'),
                           EXCHANGE_MODE='receive', EXCHANGE_DATE='2026-10-27', RETRY_DEFERRED='true',
                           TEST_RESULT=json.dumps({'status': status, 'date': '2026-10-27'}), TEST_EXIT=str(code))
                result = subprocess.run(['bash', '-euo', 'pipefail', '-c', run_block('Publish or receive fixed-day documents')], cwd=root, env=env, capture_output=True)
                self.assertEqual(result.returncode, 1 if outcome == 'failed' else 0, result.stderr)
                self.assertIn('--retry-deferred', (root / 'args').read_text())
                self.assertTrue((root / 'output').read_text().endswith(f'outcome={outcome}\n'))
                self.assertIn('not performed', (root / 'summary').read_text())


if __name__ == '__main__':
    unittest.main()
