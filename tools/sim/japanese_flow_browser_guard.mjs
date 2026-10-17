import {flowGuard} from './japanese_flow_model.mjs';
const kind=new URLSearchParams(location.search).get('flowStudy')??'base';
const Parent=flowGuard(kind);
export class PlayerParryGuard extends Parent {
 constructor(...args){super(...args);this.researchKind=kind;}
}
