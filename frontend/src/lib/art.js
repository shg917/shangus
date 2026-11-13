import {bossAt} from './core.js';
export function drawArena(canvas,level,avatar='a') {
 const ctx=canvas.getContext('2d'); if(!ctx)return;
 const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,canvas.clientWidth*ratio);canvas.height=Math.max(1,canvas.clientHeight*ratio);
 ctx.setTransform(canvas.width/720,0,0,canvas.height/420,0,0);
 const bg=ctx.createLinearGradient(0,0,0,420);bg.addColorStop(0,'#141d13');bg.addColorStop(1,'#414d2b');ctx.fillStyle=bg;ctx.fillRect(0,0,720,420);
 const glow=ctx.createRadialGradient(510,160,5,510,160,250);glow.addColorStop(0,'#a2b85a55');glow.addColorStop(1,'#11190000');ctx.fillStyle=glow;ctx.fillRect(0,0,720,420);
 ctx.strokeStyle='#75825325';ctx.lineWidth=2;
 for(let x=-400;x<1100;x+=90){ctx.beginPath();ctx.moveTo(360+(x-360)*.2,260);ctx.lineTo(x,420);ctx.stroke();}
 for(let y=280;y<420;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(720,y);ctx.stroke();}
 ctx.fillStyle='#0c140e';ctx.fillRect(30,80,8,200);ctx.fillRect(250,80,8,200);ctx.fillRect(30,85,230,7);
 for(let x=65;x<235;x+=47){ctx.fillRect(x,160,10,75);ctx.fillRect(x-10,181,30,28);}
 ctx.fillStyle='#d4fc5222';ctx.font='900 74px sans-serif';ctx.fillText('NO EASY REPS',40,65);
 function shape(points,fill,stroke='#1a2114'){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
 function ellipse(x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
 // Original geometric gym character, inspired by the muscular silhouette discussion.
 const skin=bossAt(level).color;
 ellipse(525,335,106,19,'#09100988');ctx.save();ctx.translate(520,325);ctx.scale(1.2,1.2);
 shape([[-34,-69],[-4,-66],[-10,-20],[-24,0],[-48,0],[-40,-14]],skin);
 shape([[4,-66],[34,-69],[40,-20],[49,-2],[25,1],[16,-12]],skin);
 shape([[-36,-82],[38,-82],[34,-54],[14,-45],[0,-57],[-16,-44],[-36,-54]],'#28351f');
 shape([[-48,-171],[-76,-157],[-95,-122],[-88,-97],[-100,-56],[-86,-43],[-72,-72],[-65,-110],[-45,-132]],skin);
 shape([[49,-171],[77,-155],[94,-121],[87,-96],[101,-57],[89,-44],[74,-72],[65,-110],[45,-132]],skin);
 shape([[-48,-175],[-18,-181],[18,-181],[48,-175],[65,-150],[55,-122],[35,-98],[31,-77],[-31,-77],[-36,-99],[-54,-122],[-65,-150]],skin);
 shape([[-50,-160],[-31,-171],[-7,-165],[-1,-145],[-12,-129],[-43,-132],[-54,-146]],'#ffffff25');
 shape([[50,-160],[31,-171],[7,-165],[1,-145],[12,-129],[43,-132],[54,-146]],'#ffffff25');
 for(let y=-122;y<-80;y+=13){shape([[-22,y],[-3,y+1],[-3,y+10],[-18,y+10]],'#00000025');shape([[22,y],[3,y+1],[3,y+10],[18,y+10]],'#00000025');}
 shape([[-18,-181],[-22,-202],[-12,-218],[9,-218],[21,-203],[17,-183],[0,-175]],skin);
 ctx.fillStyle='#26321b';ctx.fillRect(-12,-201,7,3);ctx.fillRect(5,-201,7,3);ctx.fillRect(-6,-188,12,3);
 if(level<100){shape([[86,-55],[112,-55],[108,-19],[90,-19]],'#d4fc52');shape([[85,-61],[113,-61],[113,-53],[85,-53]],'#253715');ctx.fillStyle='#354c1d';ctx.font='900 13px sans-serif';ctx.fillText('P',95,-32);}
 else if(level<500){ellipse(99,-45,29,29,'#172111');ellipse(99,-45,21,21,'#687f48');ellipse(99,-45,8,8,'#172111');ctx.fillStyle='#c6dc99';ctx.font='900 10px sans-serif';ctx.fillText('20',94,-27);}
 else{ctx.fillStyle='#92a17a';ctx.fillRect(-130,-74,260,9);ctx.fillStyle='#26311d';for(const x of [-130,-116,107,121]){ctx.fillRect(x,-104,10,69);}if(level>=2000){shape([[-24,-220],[-22,-235],[-10,-226],[0,-242],[10,-226],[23,-235],[24,-220]],'#d4fc52');}}
 ctx.restore();
 ellipse(160,340,60,11,'#09100988');ctx.save();ctx.translate(155,333);const shirt=avatar==='a'?'#d4fc52':'#c3b4ff';
 shape([[-20,-55],[-1,-55],[-9,-2],[-30,-2]],'#283422');shape([[1,-55],[21,-55],[31,-3],[11,-3]],'#33412a');
 shape([[-22,-112],[18,-114],[33,-91],[21,-52],[-22,-52],[-31,-90]],shirt);
 shape([[-23,-104],[-40,-80],[-30,-58],[-20,-72]],'#cca384');shape([[23,-106],[40,-90],[57,-112],[66,-105],[44,-69],[27,-78]],'#cca384');
 ellipse(0,-133,20,24,'#dbb08b');shape([[-21,-139],[-12,-159],[13,-156],[23,-139],[8,-142],[-7,-136]],'#263021');
 ctx.save();ctx.translate(61,-112);ctx.rotate(-.35);ctx.fillStyle='#9fae86';ctx.fillRect(-30,-4,60,8);ctx.fillStyle='#2e3a23';ctx.fillRect(-32,-18,14,36);ctx.fillRect(18,-18,14,36);ctx.restore();ctx.restore();
 ctx.font='12px sans-serif';ctx.fillStyle='#c7d4ad';ctx.fillText('나의 아바타',113,377);ctx.fillStyle='#dce9c3';ctx.fillText(bossAt(level).slogan,465,377);
}
