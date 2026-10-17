// 03:00: the Yue dead walk and duel again. Scenery only, no combat actors.
import * as T from 'three';
import {buildDunhuang} from './stage_dunhuang.js';
import {beginNight} from './stage_night_variants.js';
import {animate} from './stage_night_second.js';
import {addYueApparitions} from './stage_yue_apparitions.js';

export function buildDunhuangNight(scene,lights){
 // Restore the native cart/cargo. The rejected empty cradle and boat are gone.
 const {stage,root}=beginNight(scene,lights,buildDunhuang,'dunhuang_night',{boundaryFires:false});
 scene.fog=new T.Fog(0x28354a,85,330);
 lights.hemi.intensity=.94;lights.sun.intensity=.69;stage.sunOffset={x:-10,y:13,z:-7};
 lights.sun.position.set(-10,13,-7);
 stage.fighterLight={color:0xd2c9bd,rimColor:0xbdcedb,rim:1.12,level:.57};
 const ghosts=addYueApparitions(root);
 root.userData.stories=['오와 월의 망령들이 절벽을 따라 서로 반대 방향으로 걷는다. 끝에 닿으면 옅어졌다가 다시 나타난다.',
  '여덟 쌍의 오·월 병사가 전장 사방에서 전진 베기·받아내기·반격을 주고받는다. 끝나지 않은 두 군대의 전투 기억.'];
 root.userData.storyRule='사용자가 앞선 소품 대신 사방에 흩어진 두 군대의 움직임과 교전 하나의 스펙터클로 대체함';
 root.userData.details={duel:[13.2,1,-5.4],procession:[14.7,1,3]};root.userData.addedColliders=0;
 return animate(stage,root,[ghosts]);
}
