import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransport } from '../../src/account/supabase.js';
const b64=(x)=>Buffer.from(JSON.stringify(x)).toString('base64url');
const uid='11111111-1111-1111-1111-111111111111';
const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})+'.test';
const user={id:uid,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const session=()=>({access_token:token,refresh_token:'fixture-only',expires_in:3600,token_type:'bearer',user:{...user}});
test('official SDK anonymous + link/recovery OTP + bound identity requests (HTTP fixture)', async()=>{
 const prior=globalThis.fetch, calls=[];
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(input);const body=init.body?JSON.parse(init.body):null;const headers=new Headers(init.headers);calls.push({path:url.pathname,body,authorization:headers.get('Authorization')});
  let result={};
  if(url.pathname.endsWith('/signup'))result=session();
  else if(url.pathname.endsWith('/verify')){user.is_anonymous=false;result=session();}
  else if(url.pathname.endsWith('/user'))result=user;
  else if(url.pathname.includes('/rest/v1/player_profiles'))result=[];
  else if(url.pathname.includes('/rest/v1/rpc/save_player_profile'))result={...body,revision:1};
  return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const t=createTransport({appId:'http-fixture',url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'});
 try {
  assert.equal(await t.session(),null);assert.equal((await t.guest()).id,uid);
  await t.load(uid);await t.save(0,{display_name:'fixture',settings:{}},uid);
  await assert.rejects(()=>t.save(0,{display_name:'wrong',settings:{}},'other'),{code:'PT401'});
  await t.sendCode('player@example.com','link');await t.verify('player@example.com','123456','link');
  await t.sendCode('player@example.com','login');await t.verify('player@example.com','123456','login');
  assert.equal(calls.find(x=>x.path.endsWith('/otp')).body.create_user,false);
  assert.deepEqual(calls.filter(x=>x.path.endsWith('/verify')).map(x=>x.body.type),['email_change','email']);
  assert.equal(calls.find(x=>x.path.endsWith('/save_player_profile')).authorization,`Bearer ${token}`);
  assert.equal(calls.filter(x=>x.path.endsWith('/save_player_profile')).length,1);
  // Force global SDK credential to switch while the data request already holds A's token.
  const original=t.client.auth.getSession.bind(t.client.auth);let reads=0;
  t.client.auth.getSession=async()=>{reads++;if(reads===1)return original();return {data:{session:{...session(),access_token:'B-token',user:{...user,id:'B'}}},error:null};};
  await t.save(1,{display_name:'A-only',settings:{}},uid);
  assert.equal(calls.at(-1).authorization,`Bearer ${token}`);
  t.client.auth.getSession=original;
 } finally { await t.client.auth.stopAutoRefresh();globalThis.fetch=prior; }
});
test('service role and secret browser keys rejected',()=>{
 assert.throws(()=>createTransport({appId:'x',url:'https://fixture.supabase.co',publishableKey:'sb_secret_private'}));
 assert.throws(()=>createTransport({appId:'x',url:'https://fixture.supabase.co',publishableKey:b64({})+'.'+b64({role:'service_role'})+'.x'}));
 assert.equal(createTransport({appId:'x',url:'',publishableKey:''}),null);
});
