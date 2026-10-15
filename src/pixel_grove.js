// 두 번째 시안: 제한된 따뜻한 팔레트와 정수 픽셀로 그리는 숲.
// 기존 시안의 createPixelWind와 같은 인터페이스이며 게임 자원/물리는 사용하지 않는다.
export function createPixelGrove(canvas, reducedMotion) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const background = document.createElement('canvas'), bg = background.getContext('2d', { alpha: false });
  let w = 1, h = 1, treeX = 0, ground = 0, crown = 0, spread = 0;
  let active = false, frame = 0, start = 0, last = -Infinity;
  const random = seed => { const n = Math.sin(seed * 143.71 + 23.53) * 43758.5453; return n - Math.floor(n); };
  const box = (c, x, y, width, height, color) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  };
  function line(c, x1, y1, x2, y2, size, color) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2-x1), Math.abs(y2-y1))));
    for(let i=0;i<=n;i++)box(c,x1+(x2-x1)*i/n,y1+(y2-y1)*i/n,size,size,color);
  }
  function polygon(points,color) {
    // 정수 픽셀 행을 채워 윤곽에도 팔레트의 색만 사용한다.
    const ymin=Math.floor(Math.min(...points.map(p=>p[1]))),ymax=Math.ceil(Math.max(...points.map(p=>p[1])));
    for(let y=ymin;y<=ymax;y++){
      const cuts=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length];
        if((a[1]<=y+.5&&b[1]>y+.5)||(b[1]<=y+.5&&a[1]>y+.5))cuts.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      cuts.sort((a,b)=>a-b);
      for(let i=0;i+1<cuts.length;i+=2)box(bg,Math.ceil(cuts[i]),y,Math.floor(cuts[i+1])-Math.ceil(cuts[i])+1,1,color);
    }
  }
  function ridge(y,amp,period,seed,color){
    const points=[[0,h],[0,y]];
    for(let x=0;x<=w+2;x+=2)points.push([x,y+Math.sin(x/period+seed)*amp+Math.sin(x/11+seed)*2]);
    points.push([w,h]);polygon(points,color);
  }
  function foliage(x,y,rx,ry,seed){
    for(let py=-Math.ceil(ry);py<=ry;py+=2)for(let px=-Math.ceil(rx);px<=rx;px+=2){
      const n=random(seed+px*7+py*31),dist=(px*px)/(rx*rx)+(py*py)/(ry*ry);
      if(dist>1+n*.16)continue;
      let color=py<-.2*ry?(n>.48?'#8e7847':'#796b40'):(n>.62?'#665d36':'#4c482b');
      if(dist>.75&&n>.6)color='#aa8b4e';
      box(bg,x+px,y+py,2+(n>.8?1:0),2,color);
      if(n>.91&&py<ry*.3)box(bg,x+px,y+py,1,1,'#c3a15d');
    }
  }
  function plantedLongsword(){
    // 나무 오른쪽 뿌리 곁. 세로 화면에서는 폭도 고려해 메뉴 아래에 머문다.
    const length=Math.min(h*.29,w*.48),x=treeX+Math.max(12,spread*.27),y=ground+1;
    const lean=.38,up=Math.sqrt(1-lean*lean),blade=Math.max(1,length*.035);
    const p=(across,along)=>[x+across*up+along*lean,y+across*lean-along*up];
    const shape=(points,color)=>polygon(points.map(([u,v])=>p(u,v*length)),color);
    polygon([[x-2,y-1],[x+4,y],[x-10,y+3],[x-16,y+2]],'#292b20');
    // 긴 양날 칼몸: 날의 밝은 면과 중앙의 어두운 면을 분리한다.
    shape([[0,-.035],[-blade-1,.17],[-blade-1,.73],[blade+1,.73],[blade+1,.17]],'#303329');
    shape([[0,-.02],[-blade,.18],[-blade,.72],[blade,.72],[blade,.18]],'#b8bcae');
    shape([[0,.015],[-blade,.18],[-blade,.71],[0,.71]],'#dedcc4');
    shape([[0,.08],[0,.70],[blade*.55,.70],[blade*.55,.19]],'#7d867c');
    // 두 손으로 쥐는 가죽 손잡이와 곧게 뻗은 십자 가드.
    shape([[-blade,.72],[-blade,.95],[blade,.95],[blade,.72]],'#29271f');
    shape([[-blade*.5,.74],[-blade*.5,.94],[blade*.5,.94],[blade*.5,.74]],'#705337');
    for(let v=.77;v<.94;v+=.045)line(bg,...p(-blade*.6,v*length),...p(blade*.6,(v+.012)*length),1,'#a18455');
    const guard=length*.15;
    shape([[-guard,.69],[-guard,.76],[-blade,.78],[blade,.78],[guard,.76],[guard,.69],[blade,.71],[-blade,.71]],'#302d23');
    shape([[-guard+1,.715],[-guard+1,.745],[0,.755],[guard-1,.745],[guard-1,.715],[0,.73]],'#b5ae8b');
    const pommel=blade*1.55;
    shape([[-pommel,.94],[-pommel,1],[0,1.03],[pommel,1],[pommel,.94],[0,.92]],'#302d23');
    shape([[-pommel*.5,.95],[-pommel*.5,.99],[0,1.01],[pommel*.5,.99],[pommel*.5,.95],[0,.94]],'#c1b891');
    // 칼끝을 흙과 풀로 가려 땅 위에 놓인 검이 아니라 꽂힌 검으로 보이게 한다.
    polygon([[x-3,y],[x,y-1],[x+4,y+1],[x+3,y+3],[x-4,y+2]],'#4b4931');
    line(bg,x-2,y+1,x-4,y-3,1,'#77704a');line(bg,x+2,y+1,x+4,y-2,1,'#77704a');
  }
  function drawBackground(){
    box(bg,0,0,w,h,'#544a38');
    box(bg,0,h*.24,w,h*.32,'#60533c');
    box(bg,0,h*.45,w,h*.25,'#716044');
    const sunX=w*.84,sunY=h*.22,r=Math.min(w*.052,h*.072);
    for(let y=-Math.ceil(r);y<=r;y++){
      const x=Math.floor(Math.sqrt(Math.max(0,r*r-y*y)));
      box(bg,sunX-x,sunY+y,x*2+1,1,y<0?'#bda16d':'#a78b59');
    }
    for(let i=0;i<20;i++){
      const x=random(i+100)*w,y=random(i+600)*h*.5;
      box(bg,x,y,9+random(i+120)*w*.15,1,i%3?'#695a40':'#7b6747');
      if(i%3===0)box(bg,x+3,y-1,12,1,'#695a40');
    }
    ridge(h*.55,h*.055,w*.16,2,'#6d6347');
    ridge(h*.61,h*.035,w*.12,5,'#7d7150');
    // 멀리 보이는 폐허와 낮은 숲, 안개에 잠긴 물가.
    const ax=w*.84,ay=h*.58,ah=Math.max(7,h*.10),aw=Math.max(6,w*.033);
    box(bg,ax,ay-ah,aw,ah,'#5c563e');box(bg,ax+2,ay-ah+3,aw-4,ah,'#7d7150');
    box(bg,ax-1,ay-ah,aw+2,2,'#95815a');box(bg,ax+1,ay-ah-2,3,2,'#6c6041');
    for(let i=0;i<32;i++){
      const x=random(i+211)*w,y=h*(.65+random(i+456)*.06),s=h*(.03+random(i+126)*.08);
      box(bg,x,y-s,1,s,'#59583a');
      for(let j=0;j<3;j++){
        const yy=y-s+j*s*.27;
        line(bg,x,yy+3,x-2-j,yy,1,'#62613f');line(bg,x,yy+3,x+2+j,yy-1,1,'#62613f');
      }
    }
    box(bg,0,h*.70,w,h*.10,'#8b7c58');
    for(let i=0;i<30;i++)box(bg,random(i+43)*w,h*(.705+random(i+34)*.08),4+random(i+17)*24,1,i%3?'#9d8960':'#726748');
    ridge(h*.81,h*.014,w*.12,4,'#5e5838');
    ridge(h*.86,h*.018,w*.20,1,'#393b28');
    const p=(x,y)=>[treeX+x*spread,ground-y*crown];
    // 굽은 줄기와 굵기가 다른 가지.
    polygon([p(-.10,0),p(.12,0),p(.04,.22),p(-.01,.42),p(.08,.62),p(.16,.84),p(.12,.94),p(.04,.77),p(-.07,.46),p(-.04,.23)],'#2c2b1f');
    const branches=[[-.02,.40,-.40,.69,.035],[-.4,.69,-.57,.82,.018],[.04,.58,.48,.77,.034],[.48,.77,.75,.82,.016],[.10,.77,-.10,.97,.025],[.13,.80,.38,1.02,.020],[.02,.59,-.34,.88,.022]];
    for(const [x,y,x2,y2,s] of branches)line(bg,...p(x,y),...p(x2,y2),Math.max(1,s*spread),'#2c2b1f');
    for(let i=0;i<34;i++){
      const v=random(i+640)*.7,xx=treeX+(v>.4?(v-.4)*.26:-.02)*spread;
      box(bg,xx+random(i+44)*3,ground-v*crown,1,2+random(i+51)*5,i%3?'#635132':'#867047');
    }
    for(let i=0;i<7;i++)line(bg,treeX,ground-5,treeX+(i-3)*spread*.08,ground+random(i)*4,2,'#29291e');
    const clusters=[[-.49,.86,.26],[-.27,1.01,.27],[.01,1.07,.27],[.31,1.04,.28],[.58,.93,.26],[.77,.82,.22],[.36,.83,.22],[-.49,.69,.19]];
    clusters.forEach(([x,y,r],i)=>foliage(...p(x,y),spread*r,spread*r*.48,173*i));
    plantedLongsword();
    // 풀·돌·낙엽을 작은 픽셀 묶음으로 그린다. 제목이 놓이는 가운데는 비운다.
    for(let i=0;i<145;i++){
      const x=random(i+781)*w,y=h*(.85+random(i+829)*.15),color=['#565336','#717047','#393b28'][i%3];
      if(i%4===0){box(bg,x,y,3,1,'#8d784a');box(bg,x+1,y-1,2,1,'#aa8b51');}
      else{line(bg,x,y,x-1,y-2-random(i+89)*3,1,color);line(bg,x,y,x+2,y-2,1,color);}
    }
    for(let i=0;i<14;i++){
      const x=random(i+923)*w,y=h*(.87+random(i+538)*.11);
      polygon([[x-3,y],[x-1,y-2],[x+2,y-2],[x+4,y],[x+1,y+1]],'#4c4932');box(bg,x,y-2,2,1,'#82734d');
    }
  }
  function draw(t){
    ctx.globalAlpha=1;ctx.drawImage(background,0,0);
    if(!active||reducedMotion.matches)return;
    const gust=Math.max(0,1-t/2.2),travel=t+1.5*(1-Math.exp(-t*2));
    for(let i=0;i<32;i++){
      const age=(travel+random(i+160)*14)%14;
      ctx.globalAlpha=i<10?.8:gust*.8;
      if(ctx.globalAlpha<.02)continue;
      const x=(treeX+random(i+150)*spread*.65+age*(w*.045+random(i+180)*3)+Math.sin(age*1.7+i)*4)%(w+12)-6;
      const y=ground-crown*.9+age*h*.064+Math.sin(age*2+i)*3;
      if(y>ground+4)continue;
      const tilt=Math.floor(t*4+i)%2;
      box(ctx,x,y,2,1,i%3?'#c3a160':'#e0bf77');box(ctx,x+1,y+(tilt?-1:1),2,1,i%3?'#9b7841':'#c3a160');
    }
    if(gust>0){
      ctx.globalAlpha=gust*.22;
      for(let i=0;i<6;i++){
        const x=(t*w*.55+i*w*.19)%(w*1.2)-w*.1,y=h*(.25+random(i+81)*.48);
        for(let j=0;j<3;j++)box(ctx,x+j*7,y+(j%2),4,1,'#d5ba83');
      }
    }
    ctx.globalAlpha=1;
  }
  function resize(){
    const bounds=canvas.getBoundingClientRect(),scale=bounds.width<600?3:4;
    w=Math.max(1,Math.ceil(bounds.width/scale));h=Math.max(1,Math.ceil(bounds.height/scale));
    canvas.width=background.width=w;canvas.height=background.height=h;
    ctx.imageSmoothingEnabled=bg.imageSmoothingEnabled=false;
    treeX=w*(w<h?.035:.15);ground=h*.88;crown=h*.74;spread=Math.min(w*.43,crown*.77);
    drawBackground();draw(active?(performance.now()-start)/1000:0);
  }
  function tick(now){
    if(!active||document.hidden||reducedMotion.matches){frame=0;return;}
    if(now-last>=1000/20){draw((now-start)/1000);last=now;}
    frame=requestAnimationFrame(tick);
  }
  function resume(){if(active&&!frame&&!document.hidden&&!reducedMotion.matches)frame=requestAnimationFrame(tick);}
  function calm(){active=false;cancelAnimationFrame(frame);frame=0;draw(0);}
  function gust(){active=true;start=performance.now();last=-Infinity;draw(0);resume();}
  new ResizeObserver(resize).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();});
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){cancelAnimationFrame(frame);frame=0;draw(0);}else resume();});
  resize();return {calm,gust};
}

export async function paintPixelWordmark(heading,{
  text='Stillness',font='600 32px Cinzel',height=47,baseline=34,tracking=1,
}={}){
  try {
    await document.fonts.load(font,text);
    if(!document.fonts.check(font,text))return;
    const mask=document.createElement('canvas'),m=mask.getContext('2d');
    m.font=font;
    const letters=[...text];
    const width=Math.ceil(letters.reduce((n,c)=>n+m.measureText(c).width+tracking,0))+12;
    mask.width=width;mask.height=height;m.font=font;m.fillStyle='#fff';
    let x=6;for(const letter of letters){m.fillText(letter,x,baseline);x+=m.measureText(letter).width+tracking;}
    const pixels=m.getImageData(0,0,width,height).data,points=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>=110)points.push([x,y]);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.setAttribute('aria-hidden','true');
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#21180f';for(const [x,y] of points)ctx.fillRect(x+1,y+3,2,2);
    ctx.fillStyle='#422d18';for(const [x,y] of points)ctx.fillRect(x-1,y-1,3,3);
    for(const [x,y] of points){const band=y*47/height;ctx.fillStyle=band<17?'#ffe8ae':band<26?'#e7c57c':band<32?'#c59b50':'#a47735';ctx.fillRect(x,y,1,1);}
    heading.append(canvas);heading.dataset.painted='true';
  } catch { /* 글꼴/캔버스가 준비되지 않으면 기존 웹폰트 제목을 보여 준다. */ }
}
