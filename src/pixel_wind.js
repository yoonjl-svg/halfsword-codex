// 모노톤 픽셀 배경은 크기 변경 때 한 번 만들고, 잎과 바람만 24fps 이하로 덧그린다.
export function createPixelWind(canvas, reducedMotion) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const backdrop = document.createElement('canvas'), bg = backdrop.getContext('2d', { alpha: false });
  let width = 0, height = 0, frame = 0, started = 0, active = false, last = -Infinity;
  let treeX = 0, ground = 0, crown = 0, spread = 0;
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  function line(c, x1, y1, x2, y2, thickness, color) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) rect(c, x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, thickness, thickness, color);
  }
  function polygon(c, points, color) {
    c.fillStyle = color; c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y)));
    c.closePath(); c.fill();
  }
  function ridge(top, amplitude, frequency, color, seed) {
    const points = [[0, height], [0, top]];
    for (let x = 0; x <= width + 3; x += 3) points.push([x, top + Math.sin(x / frequency + seed) * amplitude + hash(x + seed) * 3]);
    points.push([width, height]); polygon(bg, points, color);
  }
  function tree(x, y, size, reach, dark, bark = false) {
    const p = (a, b) => [x + a * reach, y - b * size];
    polygon(bg, [p(-.065, 0), p(.085, 0), p(.025, .23), p(-.005, .42), p(.075, .70), p(.15, .92), p(.10, .95), p(.01, .73), p(-.045, .43)], dark);
    const branches = [[-.015,.39,-.35,.66,.033],[-.35,.66,-.52,.75,.014],[.01,.61,.38,.78,.028],[.38,.78,.72,.80,.013],[.075,.73,-.12,.91,.023],[-.12,.91,-.31,.98,.012],[.11,.84,.35,1,.016],[.03,.65,-.47,.86,.014],[.39,.78,.48,.94,.012]];
    for (const [a,b,c,d,t] of branches) line(bg, ...p(a,b), ...p(c,d), Math.max(1,t*reach), dark);
    for (let i = 0; i < 7; i++) line(bg, x + i - 3, y - 7, x + (i-3)*reach*.06, y + hash(i)*5, Math.max(1,reach*.02), dark);
    if (bark) for (let i = 0; i < 30; i++) {
      const h = hash(i+12)*.69, tx = x + (h>.4 ? (h-.4)*.25 : -.02)*reach;
      rect(bg, tx+hash(i)*3, y-h*size, 1, 2+hash(i+4)*5, i%3?'#484848':'#626262');
    }
  }
  function paintBackdrop() {
    rect(bg,0,0,width,height,'#353535');
    // 넓게 끊어진 하늘 층과 희미한 산등성이. 모든 좌표는 낮은 해상도에서 그린다.
    for (let i=0;i<40;i++) rect(bg,hash(i+20)*width,hash(i+60)*height*.63,12+hash(i)*65,1,'#383838');
    ridge(height*.52,height*.043,width*.15,'#404040',2);
    ridge(height*.59,height*.035,width*.12,'#484848',3);
    ridge(height*.65,height*.029,width*.18,'#505050',1);
    for (let i=0;i<25;i++) {
      const x=hash(i+200)*width,y=height*(.60+hash(i+22)*.07),s=height*(.05+hash(i+71)*.09);
      tree(x,y,s,s*.55,'#414141');
    }
    for (let i=0;i<18;i++) rect(bg,hash(i+50)*width,height*(.59+hash(i+30)*.15),20+hash(i+14)*width*.3,1,i%2?'#575757':'#4e4e4e');
    ridge(height*.77,height*.021,width*.17,'#353535',4);
    ridge(height*.85,height*.027,width*.28,'#272727',2);
    tree(treeX,ground,crown,spread,'#181818',true);
    // 가지 끝마다 작은 잎 묶음을 겹쳐 성긴 수관을 그린다.
    const clusters=[[-.45,.81,.23],[-.25,.96,.24],[.02,1.02,.24],[.31,.99,.27],[.57,.87,.24],[.72,.79,.20],[.18,.84,.2],[-.48,.70,.16]];
    for (let k=0;k<clusters.length;k++) {
      const [cx,cy,r]=clusters[k];
      for (let i=0;i<120;i++) {
        const a=hash(i+k*121)*Math.PI*2,d=Math.sqrt(hash(i+45+k*77));
        const x=treeX+spread*(cx+Math.cos(a)*r*d),y=ground-crown*cy+Math.sin(a)*r*spread*.38*d;
        const color=['#242424','#292929','#303030','#3b3b3b'][Math.floor(hash(i+k*20+10)*4)];
        rect(bg,x,y,2+hash(i+43)*6,1+hash(i+98)*3,color);
      }
    }
    // 가까운 바닥의 돌과 풀. 제목이 놓이는 가운데는 비운다.
    for(let i=0;i<85;i++) {
      const x=hash(i+300)*width,y=height*(.87+hash(i+140)*.13);
      if(hash(i+750)>.65) polygon(bg,[[x-3,y],[x-2,y-2],[x+2,y-3],[x+4,y],[x+1,y+1]],'#383838');
      else { line(bg,x,y,x-1,y-2-hash(i+600)*5,1,'#171717'); line(bg,x,y,x+3,y-1-hash(i+650)*3,1,'#171717'); }
    }
    for(let i=0;i<130;i++) rect(bg,hash(i+900)*width,height*(.84+hash(i+360)*.16),1+hash(i+440)*2,1,i%4?'#303030':'#4b4b4b');
  }
  function resize() {
    const box=canvas.getBoundingClientRect(), scale=box.width<600?2:3;
    width=Math.max(1,Math.ceil(box.width/scale));height=Math.max(1,Math.ceil(box.height/scale));
    canvas.width=backdrop.width=width;canvas.height=backdrop.height=height;
    ctx.imageSmoothingEnabled=false;bg.imageSmoothingEnabled=false;
    treeX=width*(width<height?.055:.17);ground=height*.85;crown=height*.76;spread=Math.min(width*.48,crown*.75);
    paintBackdrop();draw(active?(performance.now()-started)/1000:0);
  }
  function leaf(x,y,turn,color,large=false) {
    const pixels=turn%2?[[0,0],[1,-1],[2,-1],[3,-2],[1,0],[2,0]]:[[0,0],[1,0],[2,1],[3,1],[1,1],[2,2]];
    const size=large?2:1;
    for(const [px,py] of pixels)rect(ctx,x+px*size,y+py*size,size,size,color);
  }
  function draw(t) {
    ctx.globalAlpha=1;ctx.drawImage(backdrop,0,0);
    if(!active||reducedMotion.matches)return;
    const gust=Math.max(0,1-t/2.2),travel=t+1.8*(1-Math.exp(-t*2));
    for(let i=0;i<44;i++) {
      const extra=i>=12;
      ctx.globalAlpha=extra?gust*.85:.65;
      if(ctx.globalAlpha<=.01)continue;
      const cycle=9+hash(i+29)*9,age=(travel+hash(i+83)*cycle)%cycle;
      const x=((treeX+hash(i+7)*spread*.9+age*(width*.045+hash(i+18)*5)+Math.sin(age*1.8+i)*7)%(width+20))-10;
      const y=ground-crown*(.78+hash(i+41)*.22)+age*(height*.065)+Math.sin(age*2+i)*4;
      if(y>ground+9)continue;
      leaf(x,y,Math.floor(t*5+i),['#939393','#b5b5b5','#717171','#575757'][i%4],i%17===0);
    }
    // 짧게 끊어진 픽셀 줄로 돌풍을 표현한다.
    if(gust>0)for(let i=0;i<8;i++) {
      ctx.globalAlpha=gust*.12;
      const x=((t*width*.52+i*width*.17)%(width*1.3))-width*.15,y=height*(.24+hash(i+19)*.49);
      for(let j=0;j<4;j++)rect(ctx,x+j*7,y+Math.round(Math.sin(t*2+j*.7+i)*2),4+hash(i+j)*5,1,'#d0d0d0');
    }
    ctx.globalAlpha=1;
  }
  function tick(now) {
    if(!active||document.hidden||reducedMotion.matches){frame=0;return;}
    if(now-last>=1000/24){draw((now-started)/1000);last=now;}
    frame=requestAnimationFrame(tick);
  }
  function resume(){if(active&&!frame&&!document.hidden&&!reducedMotion.matches)frame=requestAnimationFrame(tick);}
  function calm(){active=false;cancelAnimationFrame(frame);frame=0;draw(0);}
  function gust(){started=performance.now();last=-Infinity;active=true;draw(0);resume();}
  new ResizeObserver(resize).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();});
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){cancelAnimationFrame(frame);frame=0;draw(0);}else resume();});
  resize();return {gust,calm};
}
