import base64
import json
import subprocess
import unittest
from unittest.mock import patch
import exchange

class GitPublicationTests(unittest.TestCase):
    def test_fresh_fetch_and_same_commit_pair_with_full_validation(self):
        cfg={'repo':'yoonjl-svg/halfsword-codex','report_ref':'dev-exchange','daily_path':'docs/devmeet','timezone':'Asia/Seoul','report_hour':'23:30','operational_cutoff':'2026-10-01T18:00:00+09:00'}
        day='2026-10-18';start,end=exchange.window(day,cfg);sha='a'*40
        md=exchange.missing_note_sections().encode()
        manifest={'schema_version':1,'status':'published','date':day,'report_id':exchange.report_id(cfg['repo'],end),'repo':cfg['repo'],'source_sha':'b'*40,'window':{'start_exclusive':start.isoformat(),'end_inclusive':end.isoformat()},'authored_decision_record':'absent','notes_blob_sha':None,'notes_sha256':None,'markdown_sha256':exchange.digest(md)}
        files={sha+':docs/devmeet/'+day+'.md':md,sha+':docs/devmeet/'+day+'.json':json.dumps(manifest).encode()}
        calls=[]
        def git(root,*args):
            calls.append(args)
            if args[0]=='fetch':return b''
            if args==('rev-parse','FETCH_HEAD'):return sha.encode()
            return files[args[1]]
        with patch.object(exchange,'config',return_value=cfg),patch.object(exchange,'git',side_effect=git):
            r=exchange.check_publication_git('/unused',day)
            self.assertEqual(r['archive_sha'],sha)
            self.assertEqual(r['transport'],'fresh_https_git_fetch')
            self.assertEqual(calls[0],('fetch','--no-tags','https://github.com/yoonjl-svg/halfsword-codex.git','refs/heads/dev-exchange'))
            files[sha+':docs/devmeet/'+day+'.md']=b'changed'
            with self.assertRaisesRegex(ValueError,'hash mismatch'):exchange.check_publication_git('/unused',day)
            def missing(root,*args):
                if args[0]=='show':raise subprocess.CalledProcessError(128,['git'])
                return git(root,*args)
            with patch.object(exchange,'git',side_effect=missing):
                with self.assertRaisesRegex(ValueError,'Overdue publication missing'):exchange.check_publication_git('/unused',day)
