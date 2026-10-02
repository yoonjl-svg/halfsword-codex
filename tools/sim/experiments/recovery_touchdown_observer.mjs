// Observer only: native motor *requests*, actual rigid-body foot state and
// explicit pin-foot work around the already identified stand handoff.
export function installRecoveryTouchdownObserver({G,f,row,ledger}){
  const legs=f.joints.filter(j=>/^(thigh|shin|foot)/.test(j.name));
  const byHandle=new Map(legs.map(j=>[j.joint.handle,j]));
  const raw=legs[0].joint.rawSet,method='jointConfigureMotor';
  const descriptor=Object.getOwnPropertyDescriptor(raw,method),original=raw[method];
  const requests=[];
  raw[method]=function(handle,axis,target,velocity,k,d,...rest){
    const j=byHandle.get(handle);
    if(j)requests.push({name:j.name,axis,target,velocity,k,d,
      previousTargetRotVec:j.prevRV?.toArray()??null,
      targetQuaternion:j.target.toArray(),gain:j.gain??1});
    return original.call(this,handle,axis,target,velocity,k,d,...rest);
  };
  const out=[];
  return {
    out,
    afterStep(observation){
      const t=observation.timeS,first=row.scenario==='healthy_getup'?4.216666666666667:5.575;
      if(t>=first-.15&&t<=first+.3){
        const physics=ledger.latest.physics[0];
        const select=s=>s.bodies.filter(b=>/:(thigh|shin|foot)[FB]$/.test(b.label));
        out.push({timeS:t,state:f.state,motorRequests:requests.splice(0),
          nativeAnchorWorld:observation.jointAnchors,
          prePhysicsBodies:select(physics.pre),postPhysicsBodies:select(physics.post),
          pinPaths:Object.fromEntries(Object.entries(physics.balance.byPath).filter(([p])=>p.includes('pinFeet'))),
          massChanges:physics.balance.massPropertyChanges,
          cachedGait:Object.fromEntries(['F','B'].map(k=>{const l=f.gait.legs[k];return[k,{stance:l.stance,ankle:l.ankle.toArray(),plant:l.plant.toArray(),N:l.N,Nf:l.Nf,pinF:l.pinF,pinLim:l.pinLim,extra:l.extra}];}))});
      }else requests.length=0;
    },
    restore(){if(descriptor)Object.defineProperty(raw,method,descriptor);else delete raw[method];},
  };
}
