import json,gzip,pathlib,collections
P=pathlib.Path('docs/research/iberian_ai_league_20261019')
r=sorted(sum((json.loads(gzip.decompress((P/f'native-usage-{i}.json.gz').read_bytes())) for i in [0,1]),[]),key=lambda r:r['i'])
assert len(r)==72 and [x['i'] for x in r]==list(range(72))
assert all(x['replayExact'] for x in r)
def summarize(rows):
    out={'n':len(rows),'eligibleOutward':sum(x['eligibleOutward'] for x in rows)}
    for key in ['selected','applied','contacts','guardContacts']:
        total=sum(len(x['usage'][key]) for x in rows)
        out[key]={'total':total,'perRound':total/len(rows),'rounds':sum(bool(x['usage'][key]) for x in rows),
                  'byLine':dict(collections.Counter(e['line'] for x in rows for e in x['usage'][key]))}
    return out
s={'definitions':{'selected':'AI enters non-void defend highL/highR; line change begins a new use',
 'applied':'cover.own, weight>.15, talho/reves name; contiguous active interval including fade; line change begins new interval',
 'contacts':'engine fresh blade contact while applied pose, including fade',
 'guardContacts':'fresh blade contact while applied pose AND same selected non-void defense line',
 'success':'NOT measured: contact does not prove clean block/deflection/prevented injury'},
 'replayExact':72,'fiveSchools':summarize([x for x in r if x['case']['school']!='none']),
 'includingNone':summarize(r),'schools':{k:summarize([x for x in r if x['case']['school']==k]) for k in dict.fromkeys(x['case']['school'] for x in r)}}
(P/'native-usage-summary.json').write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(s,ensure_ascii=False,indent=2))
