// All arms keep the same outward motion and ordinary contact gates.
const motion={onlyOutward:true,duration:.18,hold:.10,recover:.20,hand:[0,0,0],angle:[0,0],normalGuide:.24};
export const CONTROL_MODES=[
 {...motion,id:'alone',label:'쓸기만',floor:1,controlHold:.12},
 {...motion,id:'short',label:'10% · 0.12초',floor:.10,controlHold:.12},
 {...motion,id:'long',label:'10% · 0.60초',floor:.10,controlHold:.60},
];
