import { mountBattle } from './battle.js';
import style from './ui.css?inline';
const mode=new URLSearchParams(location.search).get('mode')||'explore';
const make=(id,assignedWeapon)=>({id,assignedWeapon,hp:100,injuries:[],skills:{german:3,italian:3,iberian:3,japanese:3,chinese:3},status:'ready',limbs:{}});
const pending={id:'ford-preview',mode,allies:[make('player','longsword')],enemies:[]};
if(mode==='duel')pending.enemies=[make('bran','longsword')];
if(mode==='team'){pending.allies.push(make('isolde','longsword'));pending.enemies=[make('bran','longsword'),make('liao','qinggang')];}
const host=document.getElementById('app'),root=host.attachShadow({mode:'open'});
try{await mountBattle({root,style,pending,onCheckpoint:()=>{},onLeave:()=>location.reload(),onComplete:()=>true});}catch(e){console.error(e);root.innerHTML='<p style="padding:30px;color:#eee">전장을 불러오지 못했습니다. 새로고침해 주세요.</p>';}
