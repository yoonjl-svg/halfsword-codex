import base64
import hashlib
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import exchange


class ExchangeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'source'
        self.output = Path(self.temp.name) / 'reports'
        self.root.mkdir()
        self.cfg = {'team': 'codex', 'repo': 'yoonjl-svg/halfsword-codex',
                    'report_ref': 'dev-exchange', 'daily_path': 'docs/devmeet', 'peer_daily_path': 'docs/devmeet', 'peer_repo': 'yoonjl-svg/halfsword',
                    'peer_ref': 'main', 'timezone': 'Asia/Seoul',
                    'operational_cutoff': '2026-10-01T18:00:00+09:00',
                    'technical_base': '14bcf1fe6bd205c775db91aa4ca36b9841b6d2bd', 'report_hour': '23:30'}
        path = self.root / 'docs/dev_exchange/config.json'
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(self.cfg))
        self.run_git('init', '-q')
        self.run_git('config', 'user.email', 'test@example.invalid')
        self.run_git('config', 'user.name', 'Test')
        self.commit('baseline', '2026-10-01T17:00:00+09:00')

    def run_git(self, *args, env=None):
        return subprocess.check_output(['git', '-C', str(self.root), *args], env=env).decode().strip()

    def commit(self, subject, stamp, path='game.txt', data=None):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(subject if data is None else data)
        self.run_git('add', '.')
        env = dict(os.environ, GIT_AUTHOR_DATE=stamp, GIT_COMMITTER_DATE=stamp)
        self.run_git('commit', '-qm', subject, env=env)
        return self.run_git('rev-parse', 'HEAD')

    def publish(self, day='2026-10-01', now='2026-10-02T00:00:00+09:00'):
        return exchange.publish(day, self.root, self.output, now=now, gh=lambda _: {'workflow_runs': []})

    def peer_api(self, stale=False, bad_hash=False):
        markdown = b'# Peer authored notes\n'
        end = exchange.window('2026-10-01', self.cfg)[1]
        notes = b'notes'
        blob_sha = hashlib.sha1(b'blob 5\0notes').hexdigest()
        value = {'schema_version': 1, 'status': 'published', 'date': '2026-09-30' if stale else '2026-10-01',
                 'repo': self.cfg['peer_repo'], 'report_id': exchange.report_id(self.cfg['peer_repo'], end),
                 'source_sha': 'c' * 40,
                 'window': {'start_exclusive': self.cfg['operational_cutoff'], 'end_inclusive': end.isoformat()},
                 'authored_decision_record': 'present', 'notes_path': 'docs/dev_exchange/notes/2026-10-01.md',
                 'markdown_sha256': '0' * 64 if bad_hash else exchange.digest(markdown),
                 'notes_blob_sha': blob_sha, 'notes_sha256': exchange.digest(notes)}
        raw = json.dumps(value).encode()
        calls = []

        def gh(endpoint):
            calls.append(endpoint)
            if '/git/ref/' in endpoint:
                return {'object': {'sha': 'b' * 40}}
            if '/commits/' in endpoint:
                return {'sha': 'c' * 40}
            if '/notes/' in endpoint:
                self.assertTrue(endpoint.endswith('?ref=' + 'c' * 40))
                return {'encoding': 'base64', 'size': len(notes), 'content': base64.b64encode(notes).decode(), 'sha': blob_sha}
            self.assertTrue(endpoint.endswith('?ref=' + 'b' * 40))
            data = raw if '.json?' in endpoint else markdown
            return {'encoding': 'base64', 'size': len(data), 'content': base64.b64encode(data).decode()}
        return gh, calls

    def test_window_cutoff_and_next_day(self):
        start, end = exchange.window('2026-10-01', self.cfg)
        self.assertEqual(start.isoformat(), self.cfg['operational_cutoff'])
        self.assertEqual(end.isoformat(), '2026-10-01T23:30:00+09:00')
        self.assertEqual(exchange.window('2026-10-02', self.cfg)[0], end)
        with self.assertRaises(ValueError):
            self.publish(now='2026-10-01T23:29:59+09:00')
        self.assertFalse(self.output.exists())

    def test_commit_boundaries_notes_and_late_source_selection(self):
        self.commit('excluded start', '2026-10-01T18:00:00+09:00')
        self.commit('feature', '2026-10-01T20:00:00+09:00')
        note = exchange.missing_note_sections() + '\n# Decision\n'
        self.commit('note', '2026-10-01T21:00:00+09:00', 'docs/dev_exchange/notes/2026-10-01.md', note)
        end_sha = self.commit('inclusive end', '2026-10-01T23:30:00+09:00')
        head = self.commit('future source', '2026-10-02T01:00:00+09:00')
        value = self.publish(now='2026-10-02T04:00:00+09:00')
        self.assertEqual(value['source_sha'], end_sha)
        self.assertEqual(value['source_observed_head'], head)
        self.assertEqual(value['commit_count'], 2)
        self.assertEqual(value['notes_sha256'], exchange.digest(note.encode()))
        self.assertEqual(value['deployment']['status'], 'none_in_bounded_query')
        self.assertFalse(value['deployment']['currently_live_verified'])

    def test_missing_note_not_no_activity_and_noise_filtered(self):
        self.commit('feature', '2026-10-01T19:00:00+09:00')
        self.commit('Prepare verified source transfer', '2026-10-01T20:00:00+09:00')
        self.commit('exchange only', '2026-10-01T21:00:00+09:00', 'tools/dev_exchange/tool.py')
        value = self.publish()
        self.assertEqual(value['authored_decision_record'], 'absent')
        self.assertEqual(value['commit_count'], 1)
        self.assertIsNone(value['notes_sha256'])
        markdown = (self.output / 'docs/devmeet/2026-10-01.md').read_text()
        self.assertIn('활동이 없었다는 뜻이 아닙니다', markdown)

    def test_immutable_publication_and_previous_receipt(self):
        self.commit('feature', '2026-10-01T19:00:00+09:00')
        first = self.publish()
        path = self.output / 'docs/devmeet/2026-10-01.md'
        before = path.read_bytes()
        self.commit('next feature', '2026-10-02T21:00:00+09:00')
        self.assertEqual(self.publish()['status'], 'unchanged')
        self.assertEqual(path.read_bytes(), before)
        second = self.publish('2026-10-02', '2026-10-03T00:00:00+09:00')
        self.assertEqual(second['previous_report_id'], first['report_id'])
        self.assertEqual(second['previous_source_sha'], first['source_sha'])
        path.write_text('tampered')
        with self.assertRaises(ValueError):
            self.publish()

    def test_missing_peer_has_failed_receipt_without_fallback(self):
        def missing(_):
            raise RuntimeError('GitHub API read failed (exit 1)')
        value = exchange.receive('2026-10-01', self.root, self.output, gh=missing, now='2026-10-02T00:00:00+09:00')
        self.assertEqual(value['status'], 'api_error')
        directory = self.output / 'docs/dev_exchange/inbox/2026-10-01'
        self.assertEqual(len(list(directory.glob('*.json'))), 1)
        self.assertFalse((directory / 'peer.md').exists())
        self.assertNotIn('private', value['error'])

    def test_stale_peer_and_hash_mismatch(self):
        for options in ({'stale': True}, {'bad_hash': True}):
            gh, _ = self.peer_api(**options)
            value = exchange.receive('2026-10-01', self.root, self.output, gh=gh, now='2026-10-02T00:00:00+09:00')
            self.assertEqual(value['status'], 'peer_invalid')
            self.assertFalse(value['semantic_review_performed'])
        directory = self.output / 'docs/dev_exchange/inbox/2026-10-01'
        self.assertEqual(len(list(directory.glob('*.json'))), 2)
        self.assertFalse((directory / 'peer.json').exists())

    def test_valid_peer_idempotent_but_not_semantically_reviewed(self):
        gh, calls = self.peer_api()
        now = datetime(2026, 10, 2, tzinfo=timezone.utc)
        first = exchange.receive('2026-10-01', self.root, self.output, gh=gh, now=now)
        directory = self.output / 'docs/dev_exchange/inbox/2026-10-01'
        snapshot = (directory / 'peer.md').read_bytes()
        (directory / 'review.md').write_text('human review notes preserved')
        second = exchange.receive('2026-10-01', self.root, self.output, gh=gh, now=now)
        self.assertEqual(first['status'], 'peer_received')
        self.assertEqual(second['status'], 'already_received')
        self.assertEqual((directory / 'peer.md').read_bytes(), snapshot)
        self.assertEqual(len(list(directory.glob('2026*.json'))), 1)
        self.assertFalse(first['semantic_review_performed'])
        self.assertEqual(first['review_status'], 'review_pending')
        self.assertEqual((directory / 'review.md').read_text(), 'human review notes preserved')
        self.assertEqual(second['review_status'], 'unchanged')
        self.assertEqual(first['peer_branch_sha'], 'b' * 40)
        self.assertEqual(first['notes_blob_sha'], hashlib.sha1(b'blob 5\0notes').hexdigest())
        self.assertEqual(len(calls), 5)

    def test_peer_invalid_source_sha_and_source_write_guard(self):
        gh, _ = self.peer_api()
        def invalid_source(endpoint):
            value = gh(endpoint)
            if '.json?' in endpoint:
                decoded = json.loads(base64.b64decode(value['content']))
                decoded['source_sha'] = 'not-a-sha'
                raw = json.dumps(decoded).encode()
                value.update(size=len(raw), content=base64.b64encode(raw).decode())
            return value
        value = exchange.receive('2026-10-01', self.root, self.output, gh=invalid_source, now='2026-10-02T00:00:00+09:00')
        self.assertEqual(value['status'], 'peer_invalid')
        with self.assertRaises(ValueError):
            exchange.publish('2026-10-01', self.root, self.root, now='2026-10-02T00:00:00+09:00')

    def test_receipt_cutoff_and_api_classification(self):
        def unexpected(_):
            self.fail('Early receive must not call API')
        with self.assertRaises(ValueError):
            exchange.receive('2026-10-01', self.root, self.output, gh=unexpected, now='2026-10-01T23:59:59+09:00')
        for status, expected in ((404, 'peer_missing'), (403, 'api_error')):
            def failed(_):
                raise exchange.APIError(status)
            result = exchange.receive('2026-10-01', self.root, self.output, gh=failed, now='2026-10-02T00:00:00+09:00')
            self.assertEqual(result['status'], expected)

    def test_source_provenance_failure_prevents_snapshot(self):
        gh, _ = self.peer_api()
        def unavailable(endpoint):
            if '/commits/' in endpoint:
                raise exchange.APIError(404)
            return gh(endpoint)
        result = exchange.receive('2026-10-01', self.root, self.output, gh=unavailable, now='2026-10-02T00:00:00+09:00')
        self.assertEqual(result['status'], 'provenance_unverified')
        self.assertFalse((self.output / 'docs/dev_exchange/inbox/2026-10-01/peer.md').exists())

    def test_source_note_hash_failure_and_path_safety(self):
        gh, _ = self.peer_api()
        def bad_note(endpoint):
            value = gh(endpoint)
            if '/notes/' in endpoint:
                value['content'] = base64.b64encode(b'wrong').decode()
            return value
        result = exchange.receive('2026-10-01', self.root, self.output, gh=bad_note, now='2026-10-02T00:00:00+09:00')
        self.assertEqual(result['status'], 'provenance_unverified')
        for path in ('../secret.md', 'docs/dev_exchange/notes/../secret.md', '/docs/dev_exchange/notes/x.md'):
            with self.assertRaises(ValueError):
                exchange.safe_notes_path(path)

    def test_relative_note_links_are_pinned_with_raw_hash_preserved(self):
        raw = exchange.missing_note_sections() + '\n[design](../../strike/foo.md#part)\n[external](https://example.invalid/)\n'
        self.commit('note', '2026-10-01T21:00:00+09:00', 'docs/dev_exchange/notes/2026-10-01.md', raw)
        result = self.publish()
        markdown = (self.output / 'docs/devmeet/2026-10-01.md').read_text()
        self.assertIn(f"https://github.com/{self.cfg['repo']}/blob/{result['source_sha']}/docs/strike/foo.md#part", markdown)
        self.assertEqual(result['notes_sha256'], exchange.digest(raw.encode()))
        self.assertEqual(result['notes_link_rewrite']['count'], 1)

    def test_reachable_development_history_survives_mechanical_merge(self):
        main = self.run_git('symbolic-ref', '--short', 'HEAD')
        self.run_git('checkout', '-qb', 'development')
        real = self.commit('real development', '2026-10-01T20:00:00+09:00', 'real.py')
        self.run_git('checkout', '-q', main)
        self.commit('Prepare verified source transfer', '2026-10-01T21:00:00+09:00', '.codex-transfer/state')
        env = dict(os.environ, GIT_AUTHOR_DATE='2026-10-01T22:00:00+09:00', GIT_COMMITTER_DATE='2026-10-01T22:00:00+09:00')
        self.run_git('merge', '--no-ff', '-qm', 'Import verified Codex source', 'development', env=env)
        result = self.publish()
        self.assertEqual(result['commit_count'], 1)
        self.assertEqual(result['commits'][0]['sha'], real)

    def test_cli_has_no_clock_override(self):
        result = subprocess.run(['python3', '-B', str(Path(exchange.__file__)), 'publish', '--date', '2026-10-01', '--repo-root', str(self.root), '--output-root', str(self.output), '--now', '2026-10-02T00:00:00+09:00'], capture_output=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn(b'unrecognized arguments: --now', result.stderr)

    def test_absent_authored_note_requires_only_source_commit_provenance(self):
        gh, calls = self.peer_api()
        def absent(endpoint):
            value = gh(endpoint)
            if '/devmeet/' in endpoint and '.json?' in endpoint:
                decoded = json.loads(base64.b64decode(value['content']))
                decoded.update(authored_decision_record='absent', notes_blob_sha=None, notes_sha256=None)
                raw = json.dumps(decoded).encode()
                value.update(size=len(raw), content=base64.b64encode(raw).decode())
            return value
        result = exchange.receive('2026-10-01', self.root, self.output, gh=absent, now='2026-10-02T00:00:00+09:00')
        self.assertEqual(result['status'], 'peer_received')
        self.assertEqual(result['provenance_status'], 'source_commit_verified_no_authored_notes')
        self.assertFalse(any('/notes/' in endpoint for endpoint in calls))

    def test_schema_and_window_mismatch_rejected(self):
        gh, _ = self.peer_api()
        for changed in ({'schema_version': 2}, {'window': {'start_exclusive': self.cfg['operational_cutoff'], 'end_inclusive': '2026-10-02T23:30:00+09:00'}}):
            def wrong(endpoint):
                value = gh(endpoint)
                if '/devmeet/' in endpoint and '.json?' in endpoint:
                    decoded = json.loads(base64.b64decode(value['content']))
                    decoded.update(changed)
                    raw = json.dumps(decoded).encode()
                    value.update(size=len(raw), content=base64.b64encode(raw).decode())
                return value
            result = exchange.receive('2026-10-01', self.root, self.output, gh=wrong, now='2026-10-02T00:00:00+09:00')
            self.assertEqual(result['status'], 'peer_invalid')

    def test_plain_markdown_is_received_but_never_verified_and_retry_preserves(self):
        current = [b'# 2026-10-01 Fable daily\n\nAuthored decisions.\n']
        def plain(endpoint):
            if '/git/ref/' in endpoint:
                return {'object': {'sha': 'b' * 40}}
            self.assertIn('/contents/docs/devmeet/2026-10-01.', endpoint)
            self.assertTrue(endpoint.endswith('?ref=' + 'b' * 40))
            if '.json?' in endpoint:
                raise exchange.APIError(404)
            data = current[0]
            return {'encoding': 'base64', 'size': len(data), 'content': base64.b64encode(data).decode()}
        now = '2026-10-02T00:00:00+09:00'
        first = exchange.receive('2026-10-01', self.root, self.output, gh=plain, now=now)
        directory = self.output / 'docs/dev_exchange/inbox/2026-10-01'
        self.assertEqual(first['status'], 'document_received_unverified')
        self.assertTrue(first['source_provenance_unverified'])
        self.assertFalse(first['semantic_review_performed'])
        self.assertFalse((directory / 'peer.json').exists())
        original = (directory / 'peer-unverified.md').read_bytes()
        current[0] += b'Added later.\n'
        second = exchange.receive('2026-10-01', self.root, self.output, gh=plain, now=now)
        self.assertEqual(second['status'], 'document_received_unverified')
        self.assertEqual((directory / 'peer-unverified.md').read_bytes(), original)
        self.assertNotEqual(second['snapshot_path'], 'peer-unverified.md')
        gh, _ = self.peer_api()
        proof = exchange.receive('2026-10-01', self.root, self.output, gh=gh, now=now)
        self.assertEqual(proof['status'], 'peer_received')
        self.assertEqual((directory / 'peer-unverified.md').read_bytes(), original)

    def test_plain_missing_or_wrong_date_is_not_received(self):
        for missing in (False, True):
            def plain(endpoint):
                if '/git/ref/' in endpoint:
                    return {'object': {'sha': 'b' * 40}}
                if '.json?' in endpoint or missing:
                    raise exchange.APIError(404)
                data = b'# 2026-09-30 stale\n'
                return {'encoding': 'base64', 'size': len(data), 'content': base64.b64encode(data).decode()}
            result = exchange.receive('2026-10-01', self.root, self.output, gh=plain, now='2026-10-02T00:00:00+09:00')
            self.assertEqual(result['status'], 'peer_missing' if missing else 'peer_invalid')

    def test_public_paths_six_sections_and_ledger(self):
        self.commit('ledger', '2026-10-01T19:00:00+09:00', 'docs/dev_exchange/ledger.md', '# Ledger\n[record](notes/2026-10-01.md)\n')
        result = self.publish()
        path = self.output / 'docs/devmeet/2026-10-01.md'
        markdown = path.read_text()
        headings = [line for line in markdown.splitlines() if line.startswith('## ')]
        self.assertEqual(len(headings), 6)
        self.assertLess(markdown.index('## 2.'), markdown.index('### 자동 소스 변경'))
        self.assertLess(markdown.index('### 자동 소스 변경'), markdown.index('## 3.'))
        ledger = (self.output / 'docs/devmeet/ledger.md').read_text()
        self.assertIn('/blob/' + result['source_sha'] + '/docs/dev_exchange/notes/2026-10-01.md', ledger)
        self.assertFalse((self.output / 'docs/dev_exchange/daily').exists())

    def test_old_report_retry_does_not_rewind_newer_ledger(self):
        self.commit('old ledger', '2026-10-01T19:00:00+09:00', 'docs/dev_exchange/ledger.md', '# Old ledger\n')
        self.publish()
        self.commit('new ledger', '2026-10-02T19:00:00+09:00', 'docs/dev_exchange/ledger.md', '# New ledger\n')
        self.publish('2026-10-02', '2026-10-03T00:00:00+09:00')
        ledger = self.output / 'docs/devmeet/ledger.md'
        before = ledger.read_bytes()
        result = self.publish()
        self.assertEqual(result['status'], 'unchanged')
        self.assertEqual(result['ledger_status'], 'unchanged')
        self.assertEqual(ledger.read_bytes(), before)
        self.assertIn(b'New ledger', before)

    def test_first_old_date_backfill_preserves_latest_ledger(self):
        self.commit('old ledger', '2026-10-01T19:00:00+09:00', 'docs/dev_exchange/ledger.md', '# Old ledger\n')
        self.commit('new ledger', '2026-10-02T19:00:00+09:00', 'docs/dev_exchange/ledger.md', '# New ledger\n')
        self.publish('2026-10-02', '2026-10-03T00:00:00+09:00')
        ledger = self.output / 'docs/devmeet/ledger.md'
        before = ledger.read_bytes()
        self.assertFalse((self.output / 'docs/devmeet/2026-10-01.json').exists())
        result = self.publish()
        self.assertEqual(result['status'], 'published')
        self.assertTrue((self.output / 'docs/devmeet/2026-10-01.json').exists())
        self.assertEqual(ledger.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
