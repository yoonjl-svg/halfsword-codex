// Same outward24 motion; native effort ceilings only, no control-gain reduction.
const motion={onlyOutward:true,duration:.18,hold:.10,recover:.20,hand:[0,0,0],angle:[0,0],normalGuide:.24};
export const FORCE_MODES=[
 {...motion,id:'alone',label:'쓸기만 · 감소 없음',floor:1,forceHold:.24,forceRecovery:.24},
 {...motion,id:'previous',label:'이전 −75% · 0.60초',floor:.25,forceHold:.60,forceRecovery:.24},
 {...motion,id:'candidate',label:'새 안 −80% · 0.60초',floor:.20,forceHold:.60,forceRecovery:.40},
];
