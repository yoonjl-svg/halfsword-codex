// Backward Euler for the damping term of one paired point spring.
// K is the symmetric effective inverse-mass matrix at the common world point.
// No fallback impulse is returned on a nonfinite/non-SPD system: experiments
// must fail clearly rather than silently applying the rejected explicit step.
export function implicitPointImpulse(force, dt, damping, K) {
  const all=[...force,dt,damping,...K.flat()];
  if(!all.every(Number.isFinite)||dt<=0||damping<0) throw new Error('Invalid implicit point input');
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(Math.abs(K[i][j]-K[j][i])>1e-7*Math.max(1,Math.abs(K[i][j]),Math.abs(K[j][i]))) throw new Error('Point inverse mass must be symmetric');
  const det2=K[0][0]*K[1][1]-K[0][1]*K[1][0];
  const det3=K[0][0]*(K[1][1]*K[2][2]-K[1][2]*K[2][1])-K[0][1]*(K[1][0]*K[2][2]-K[1][2]*K[2][0])+K[0][2]*(K[1][0]*K[2][1]-K[1][1]*K[2][0]);
  if(!(K[0][0]>0&&det2>0&&det3>0))throw new Error('Point inverse mass is not SPD');
  const A=K.map((row,i)=>row.map((x,j)=>(i===j?1:0)+dt*damping*x));
  const L=Array.from({length:3},()=>[0,0,0]);
  for(let i=0;i<3;i++)for(let j=0;j<=i;j++){
    let value=A[i][j];for(let k=0;k<j;k++)value-=L[i][k]*L[j][k];
    if(i===j){if(!(value>0)||!Number.isFinite(value))throw new Error('Implicit point system is not SPD');L[i][j]=Math.sqrt(value);}
    else L[i][j]=value/L[j][j];
  }
  const y=[0,0,0],J=[0,0,0];
  for(let i=0;i<3;i++){let b=dt*force[i];for(let k=0;k<i;k++)b-=L[i][k]*y[k];y[i]=b/L[i][i];}
  for(let i=2;i>=0;i--){let b=y[i];for(let k=i+1;k<3;k++)b-=L[k][i]*J[k];J[i]=b/L[i][i];}
  const Ku=K.map(row=>row.reduce((sum,x,j)=>sum+x*J[j],0));
  const residual=A.map((row,i)=>row.reduce((sum,x,j)=>sum+x*J[j],0)-dt*force[i]);
  if(!J.every(Number.isFinite)||Math.hypot(...J)>dt*Math.hypot(...force)*(1+1e-8)+1e-12)throw new Error('Implicit point impulse exceeds original budget');
  return {impulse:J,pointVelocityChange:Ku,residualNorm:Math.hypot(...residual)};
}

// Rapier exposes an effective WORLD inverse inertia tensor, including locked
// rotations. Its m11..m33 accessors avoid guessing packed storage order.
export function pointInverseMass(body,p,j) {
  const com=body.worldCom(),r={x:p.x-com.x,y:p.y-com.y,z:p.z-com.z};
  const t={x:r.y*j.z-r.z*j.y,y:r.z*j.x-r.x*j.z,z:r.x*j.y-r.y*j.x};
  const I=body.effectiveWorldInvInertia(),m=body.effectiveInvMass();
  const w={x:I.m11*t.x+I.m12*t.y+I.m13*t.z,y:I.m21*t.x+I.m22*t.y+I.m23*t.z,z:I.m31*t.x+I.m32*t.y+I.m33*t.z};
  return {x:m.x*j.x+w.y*r.z-w.z*r.y,y:m.y*j.y+w.z*r.x-w.x*r.z,z:m.z*j.z+w.x*r.y-w.y*r.x};
}
