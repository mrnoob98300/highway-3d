(async()=>{'use strict';
const root=document.getElementById('gameShell'), canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
function hudIcon(type){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({sound:'<path d="m11 5-6 4H2v6h3l6 4Z"/><path d="M15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/>',muted:'<path d="m11 5-6 4H2v6h3l6 4Z"/><path d="m16 9 6 6m0-6-6 6"/>',fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',pause:'<path d="M8 5v14M16 5v14"/>'}[type])+'</svg>';}
$('muteBtn').innerHTML=hudIcon('sound');$('fullscreenBtn').innerHTML=hudIcon('fullscreen');$('pauseBtn').innerHTML=hudIcon('pause');

let W=1000,H=600,DPR=1,mode='menu',time=0,last=0,travel=0,distance=0,coins=0,health=100,nitro=0,boost=false,best=0,flash=0,invincible=0,spawnT=2,coinT=1.1,itemId=0,playerX=0,velocity=0,keyLeft=false,keyRight=false,toastLeft=0,shake=0;
let braking=false,driveFactor=1,forwardSpeed=0,starting=false;let objects=[],sparks=[],renderFaces=[];let hudElapsed=0,taskElapsed=0,simulationDebt=0,lastDrawTime=-Infinity;
try{best=Number(localStorage.getItem('highway-rush-3d-best')||0)||0}catch(e){}
$('best').innerHTML=String(best).padStart(5,'0')+' <small>m</small>';
// Fullscreen remains optional; the game never blocks play with an orientation prompt.
const shellEl=root.closest('.shell');
function refreshMobileLayout(){document.body.classList.toggle('mobile-game',matchMedia('(pointer:coarse)').matches||innerWidth<=950||innerHeight<=540);}
refreshMobileLayout();window.addEventListener('resize',refreshMobileLayout);
async function enterFullscreen(){try{if(!document.fullscreenElement&&shellEl.requestFullscreen)await shellEl.requestFullscreen({navigationUI:'hide'});else if(!document.fullscreenElement&&shellEl.webkitRequestFullscreen)shellEl.webkitRequestFullscreen();if(document.fullscreenElement&&screen.orientation?.lock)try{await screen.orientation.lock('landscape')}catch{} }catch{}refreshMobileLayout();}
$('fullscreenBtn').onclick=async()=>{if(document.fullscreenElement){try{await document.exitFullscreen()}catch{}}else await enterFullscreen()};


document.addEventListener('fullscreenchange',()=>{const full=!!document.fullscreenElement;$('fullscreenBtn').innerHTML=hudIcon(full?'close':'fullscreen');$('fullscreenBtn').setAttribute('aria-label',full?'Exit fullscreen':'Enter fullscreen');refreshMobileLayout()});
const R=(a,b)=>Math.random()*(b-a)+a,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
// ================= PROCEDURAL AUDIO (Web Audio API) =================
let ACTX=null,masterGain=null,engOsc=null,engGain=null,engFilt=null,boostOsc=null,boostGain=null,muted=false,audioReady=false;
function ensureAudio(){if(ACTX)return;try{ACTX=new(window.AudioContext||window.webkitAudioContext)();masterGain=ACTX.createGain();masterGain.gain.value=.45;masterGain.connect(ACTX.destination);
 engOsc=ACTX.createOscillator();engOsc.type='triangle';engOsc.frequency.value=55;engGain=ACTX.createGain();engGain.gain.value=0;engFilt=ACTX.createBiquadFilter();engFilt.type='lowpass';engFilt.frequency.value=420;engFilt.Q.value=.7;
 engOsc.connect(engFilt);engFilt.connect(engGain);engGain.connect(masterGain);engOsc.start();
 boostOsc=ACTX.createOscillator();boostOsc.type='triangle';boostOsc.frequency.value=90;boostGain=ACTX.createGain();boostGain.gain.value=0;const bf=ACTX.createBiquadFilter();bf.type='bandpass';bf.frequency.value=900;bf.Q.value=2;
 boostOsc.connect(bf);bf.connect(boostGain);boostGain.connect(masterGain);boostOsc.start();audioReady=true;initSampleAudio()}catch(e){muted=true}}
function resumeAudio(){ensureAudio();if(ACTX&&ACTX.state==='suspended')ACTX.resume().catch(()=>{})}
function beep(freq,dur,type,vol,slide){if(muted||!ACTX)return;const t=ACTX.currentTime,o=ACTX.createOscillator(),g=ACTX.createGain();o.type=type||'square';o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,slide),t+dur);g.gain.setValueAtTime(vol||.15,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(masterGain);o.start(t);o.stop(t+dur+.02)}
function noiseBurst(dur,vol,hp){if(muted||!ACTX)return;const t=ACTX.currentTime,len=Math.floor(ACTX.sampleRate*dur),buf=ACTX.createBuffer(1,len,ACTX.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.4);const s=ACTX.createBufferSource();s.buffer=buf;const f=ACTX.createBiquadFilter();f.type=hp?'highpass':'lowpass';f.frequency.value=hp||800;const g=ACTX.createGain();g.gain.setValueAtTime(vol||.2,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(masterGain);s.start(t)}
const sampledSounds=new Map();let engineVoice=null,windVoice=null,lastGear=0,duckUntil=0;
function sampleLoop(name){const source=ACTX.createBufferSource(),gain=ACTX.createGain();source.buffer=sampledSounds.get(name);source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(masterGain);source.start();return {source,gain};}
async function initSampleAudio(){if(!window.HIGHWAY_AUDIO)return;await Promise.all(Object.entries(window.HIGHWAY_AUDIO).map(async([key,value])=>{try{const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);sampledSounds.set(key,await ACTX.decodeAudioData(bytes.buffer))}catch{}}));if(sampledSounds.has('engine'))engineVoice=sampleLoop('engine');if(sampledSounds.has('wind'))windVoice=sampleLoop('wind');}
function playSound(name,volume=.5,rate=1){if(muted||!ACTX||!sampledSounds.has(name))return false;const source=ACTX.createBufferSource(),gain=ACTX.createGain();source.buffer=sampledSounds.get(name);source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(masterGain);source.start();source.onended=()=>{source.disconnect();gain.disconnect()};if(name==='hit'||name==='bomb')duckUntil=ACTX.currentTime+.4;return true;}
const SFX={brake(){if(!playSound('brake',.4))noiseBurst(.2,.1,900)},
 coin(){if(playSound('coin',0.6))return;beep(880,.08,'sine',.12,1320);beep(1320,.12,'sine',.08,1760)},
 nitro(){if(playSound('nitro',0.55))return;beep(220,.15,'sawtooth',.1,440);beep(440,.25,'triangle',.08,880)},
 heal(){if(playSound('heal',0.55))return;beep(523,.1,'sine',.1);setTimeout(()=>beep(659,.1,'sine',.1),70);setTimeout(()=>beep(784,.18,'sine',.12),140)},
 hit(){if(playSound('hit',0.75))return;noiseBurst(.22,.35,180);beep(90,.2,'sawtooth',.18,40)},
 bomb(){if(playSound('bomb',0.85))return;noiseBurst(.35,.4,120);beep(60,.3,'square',.2,30)},
 boostOn(){if(playSound('boost',0.65))return;beep(180,.08,'sawtooth',.12,360);noiseBurst(.15,.15,400)},
 win(){if(playSound('win',0.6))return;beep(523,.12,'triangle',.12);setTimeout(()=>beep(659,.12,'triangle',.12),100);setTimeout(()=>beep(784,.12,'triangle',.12),200);setTimeout(()=>beep(1046,.35,'sine',.15),320)},
 lose(){if(playSound('lose',0.6))return;beep(300,.2,'sawtooth',.15,120);setTimeout(()=>beep(180,.35,'sawtooth',.12,60),150)},
 click(){if(playSound('click',0.35))return;beep(600,.04,'square',.06)},
 start(){if(playSound('start',0.5))return;beep(150,.1,'sawtooth',.1,300);setTimeout(()=>beep(300,.15,'sawtooth',.1,500),80)},
 pass(){if(playSound('pass',0.35))return;beep(200,.05,'triangle',.04,100)},
 ready(){if(playSound('ready',0.5))return;beep(660,.08,'sine',.1);setTimeout(()=>beep(990,.15,'sine',.12),90)}
};
function updateEngine(speedNorm,boosting,running){if(!audioReady)return;const t=ACTX.currentTime,active=running&&!muted,gear=Math.min(6,Math.max(1,Math.floor(forwardSpeed/12)+1)),rpmNorm=forwardSpeed<2?.22:.3+(forwardSpeed%12)/12*.65;
 if(active&&lastGear&&gear!==lastGear)playSound('shift',.13);lastGear=active?gear:0;
 if(engineVoice){const modelScale=V.model==='truck'?.7:V.model==='bike'?1.4:V.model==='garage:formula'?1.15:1;engineVoice.source.playbackRate.setTargetAtTime((.75+rpmNorm*1.05)*modelScale,t,.11);engineVoice.gain.gain.setTargetAtTime(active?(.08+.10*clamp(speedNorm,0,1))*(t<duckUntil?.5:1):0,t,.1)}
 if(windVoice)windVoice.gain.gain.setTargetAtTime(active?.035*speedNorm+(boosting?.07:0):0,t,.12);
 engGain.gain.setTargetAtTime(active&&!engineVoice?.035+.025*speedNorm:0,t,.1);engOsc.frequency.setTargetAtTime(45+rpmNorm*90,t,.12);engFilt.frequency.setTargetAtTime(300+speedNorm*600,t,.12);boostGain.gain.setTargetAtTime(active&&boosting?.025:0,t,.08);}
function resize(){let r=root.getBoundingClientRect();W=Math.max(320,r.width);H=Math.max(180,r.height);DPR=Math.min(2,devicePixelRatio||1);canvas.width=2;canvas.height=2}resize();new ResizeObserver(resize).observe(root);
let pT0=performance.now(),pT=0,steerInput=0,skidMarks=[],camSmooth=0;
let world3D=null;
function draw(){
 const now=performance.now(),dt=clamp((now-pT0)/1000,0,.12);pT0=now;pT+=dt;
 if(mode==='hub')travel+=dt*8;
 if(world3D)world3D.render({dt,mode,travel,playerX,velocity,speed:forwardSpeed,vehicleId:mode==='hub'?prev:SV.sel,steer:clamp(velocity/(8.2*(V.hnd||1)),-1,1),objects,boost,braking,invincible,color:mode==='hub'?(SV.paint[prev]||VEH[prev].c):V.col,model:mode==='hub'?VEH[prev].m:V.model,look:task?.look||'day'});
 const name=document.getElementById('modelName');if(name){name.hidden=mode!=='hub';if(name.textContent!==VEH[prev].n.toUpperCase())name.textContent=VEH[prev].n.toUpperCase()}
 root.style.setProperty('--hit-flash',Math.max(0,flash*1.6));
}

// ================= META: save, vehicles, levels, hub =================
let SV={coins:400,own:[0],sel:0,up:{},unlocked:1},V={},maxHP=100,lvl=1,selLv=1,prev=0,tab='veh',task=null,passed=0,gN=0,hits=0,lives=3,endless=false;
try{Object.assign(SV,JSON.parse(localStorage.getItem('hr3d-save')||'{}'))}catch(e){}
SV.paint=SV.paint||{};SV.pown=SV.pown||{};if(!SV.apexDefault){SV.sel=0;SV.own=Array.from(new Set([0,...SV.own]));SV.apexDefault=true;if(SV.paint[0]==='#5fe333')delete SV.paint[0]}lvl=selLv=SV.unlocked;
const ROUTES=[{id:'worldCity',name:'City Connected',start:60,asset:'worldCity'},{id:'worldDesert',name:'Desert Connected',start:60,asset:'worldDesert'},{id:'worldSnow',name:'Alpine Connected',start:60,asset:'worldSnow'},{id:'worldCoast',name:'Coast Connected',start:60,asset:'worldCoast'},{id:'worldNature',name:'Nature Connected',start:60,asset:'worldNature'}];if(!ROUTES.some(r=>r.id===SV.route))SV.route='worldNature';SV.roadIndex=SV.roadIndex===1?1:0;
const LANE_COUNT=2,LANE_SPACING=5.375,LANE_LIMIT=3.8,laneX=l=>(l-.5)*LANE_SPACING;let launchRemaining=0,brakeWas=false;
const saveSV=()=>{try{localStorage.setItem('hr3d-save',JSON.stringify(SV))}catch(e){}};
const VEH=[
{id:0,n:'APEX GT Supercar',p:0,m:'super',c:'#b90819',g:'rgba(225,30,55,.6)',s:[1,1,25]},
{id:1,n:'Muscle GT',p:600,m:'muscle',c:'#ff8a1f',str:'#1b1b1f',g:'rgba(255,140,30,.6)',s:[1.06,.95,26]},
{id:2,n:'Drift King',p:1500,m:'sport',c:'#2f7bff',str:'#ffffff',g:'rgba(50,130,255,.65)',s:[1.1,1.15,27]},
{id:3,n:'Phantom',p:3200,m:'muscle',c:'#2b303b',str:'#ff2a4a',g:'rgba(255,40,80,.55)',s:[1.16,1.05,29]},
{id:4,n:'Solar Flare',p:6000,m:'super',c:'#ffd21f',str:'#14161c',g:'rgba(255,210,40,.65)',s:[1.22,1.12,31]},
{id:5,n:'Crimson Apex',p:11000,m:'super',c:'#e11d3a',str:'#f4f4f4',g:'rgba(255,30,60,.65)',s:[1.3,1.18,33]},
{id:6,n:'Neon Ghost',p:18000,m:'hyper',c:'#18d6e8',str:'#0b1a33',g:'rgba(30,230,255,.75)',s:[1.38,1.26,36]},
{id:7,n:'Gold Emperor',p:30000,m:'hyper',c:'#e2b33c',str:'#2a1c05',g:'rgba(255,200,70,.8)',s:[1.48,1.32,40]},
{id:8,n:'Street Bike',p:2500,m:'bike',c:'#ff5a1f',g:'rgba(255,100,30,.6)',s:[1.2,1.4,28],a:-25},
{id:9,n:'Cargo Hauler',p:4000,m:'truck',c:'#d9dde3',g:'rgba(200,220,255,.5)',s:[.95,.8,26],a:60},
{id:10,n:'Super Bike',p:9000,m:'bike',c:'#2f9bff',g:'rgba(50,160,255,.7)',s:[1.42,1.5,34],a:-25},
{id:11,n:'Monster Rig',p:15000,m:'truck',c:'#c0272d',g:'rgba(255,50,50,.65)',s:[1.15,.9,32],a:90},
{id:12,n:'Formula Race Car',p:0,m:'garage:formula',c:'#d52b31',g:'rgba(220,40,45,.55)',s:[1.2,1.35,32]},
{id:13,n:'Atlantic Hypercar',p:0,m:'garage:atlantic',c:'#1e5792',g:'rgba(50,120,210,.55)',s:[1.35,1.1,35]},
{id:14,n:'Viper Wedge',p:0,m:'garage:viper',c:'#8bd02d',g:'rgba(140,220,45,.55)',s:[1.28,1.25,34]},
{id:15,n:'Heritage Sport Coupe',p:0,m:'garage:heritage',c:'#bdc3c8',g:'rgba(180,195,210,.55)',s:[1.14,1.3,30]},
{id:16,n:'Solar Track Hypercar',p:0,m:'garage:solar',c:'#f47a22',g:'rgba(250,120,40,.55)',s:[1.32,1.23,36]}];
if(!SV.garagePackUnlocked){SV.own=Array.from(new Set([...SV.own,12,13,14,15,16]));SV.garagePackUnlocked=true;}
if(!SV.career8){if(SV.sel===0)SV.sel=16;SV.career8=true;}if(!SV.polish11Default){if(SV.sel===16)SV.sel=13;SV.polish11Default=true;}prev=SV.sel;SV.results=SV.results||{};

const PAL=['#e11d3a','#ff8a1f','#ffd21f','#5fe333','#18d6e8','#2f7bff','#a74edc','#f4f4f4','#2b303b'],HW={bike:1.1,truck:2.8};
const UP=id=>{const u=SV.up[id]=SV.up[id]||[];while(u.length<6)u.push(0);return u};
function applyV(){const d=VEH[SV.sel],u=UP(d.id);V={col:SV.paint[d.id]||d.c,model:d.m,str:d.str,glow:d.g,spd:d.s[0]*(1+u[0]*.04),hnd:d.s[1]*(1+u[1]*.06),nit:d.s[2]+u[2]*3,mg:u[4]*.4,inv:1.25+u[5]*.3,ax:d.m==='bike'?-.45:d.m==='truck'?.5:0,cn:10+Math.floor(lvl/25)};maxHP=Math.max(50,100+(d.a||0)+u[3]*10)}
applyV();
const WORLDS=[
{id:'worldNature',name:'Nature Connected',short:'VALLEY',label:'FOREST ROUTE',color:'#8aca93',icon:'forest'},
{id:'worldCity',name:'City Connected',short:'CITY',label:'CITY EXPRESSWAY',color:'#7cc8ef',icon:'city'},
{id:'worldSnow',name:'Alpine Connected',short:'MOUNTAIN',label:'ALPINE PASS',color:'#d6e5f4',icon:'snow'},
{id:'worldDesert',name:'Desert Connected',short:'DESERT',label:'DESERT RUN',color:'#edb06a',icon:'desert'},
{id:'worldCoast',name:'Coast Connected',short:'CORAL COAST',label:'COASTAL HIGHWAY',color:'#71e1d7',icon:'coast'}];
let nearMisses=0,gates=0,boostSeconds=0,gateT=3,powerT=4,mapPage=Math.floor((selLv-1)/10),currentRoute=null;
const MISSION_TYPES=['dist','pass','clean','gates','nitro','sprint','near','boost','survive','coins'];
function mkTask(n){const t=MISSION_TYPES[(n-1)%10],w=WORLDS[(n-1)%5],T={dist:600+n*9,pass:5+Math.floor(n*.12),clean:450+n*7,gates:4+Math.floor(n/25),nitro:3+Math.floor(n/35),sprint:800+n*6,near:3+Math.floor(n/25),boost:8+Math.floor(n/15),survive:35+Math.floor(n*.35),coins:25+Math.floor(n*.7)}[t];
 const title={dist:'OPEN ROAD',pass:'TRAFFIC WEAVER',clean:'CLEAN ESCAPE',gates:'CHECKPOINT RUN',nitro:'NITRO HUNTER',sprint:'TIME ATTACK',near:'CLOSE CALLS',boost:'BOOST MASTER',survive:'SURVIVAL RUN',coins:'GOLD RUSH'}[t],limit=t==='sprint'?55+Math.floor(n*.3):0;
 return{t,T,rw:150+n*30,title,world:w,route:w.id,roadIndex:Math.floor((n-1)/5)%2,look:['day','golden','overcast','sunset'][Math.floor((n-1)/5)%4],limit,tx:{dist:`Reach ${T} m`,coins:`Collect ${T} coins`,pass:`Overtake ${T} vehicles`,nitro:`Collect ${T} nitro canisters`,clean:`Drive ${T} m without a collision`,gates:`Pass ${T} cyan checkpoints`,sprint:`Reach ${T} m in ${limit} seconds`,near:`Make ${T} safe near misses`,boost:`Boost for ${T} seconds`,survive:`Survive ${T} seconds`}[t],help:{dist:'Follow the curves and reach the finish.',pass:'Pass traffic while keeping your car intact.',clean:'One collision ends this challenge. Brake when you need space.',gates:'Steer through the glowing cyan gate in the marked lane.',nitro:'Blue canisters appear frequently. Collect them before traffic blocks your lane.',sprint:'Beat the countdown. You begin with a full nitro tank.',near:'Pass close beside traffic without touching it. Leave a little space.',boost:'Hold NITRO with a full tank. Collect canisters to recharge.',survive:'Stay alive until the timer finishes. Traffic grows denser.',coins:'Follow gold trails. Only this mission requires coins.'}[t]};}
function missionProgress(){return task.t==='coins'?coins:task.t==='pass'?passed:task.t==='nitro'?gN:task.t==='gates'?gates:task.t==='near'?nearMisses:task.t==='boost'?boostSeconds:task.t==='survive'?time:distance;}
function checkTask(){if(!task)return;
 if(endless){lvl=Math.min(100,1+Math.floor(distance/300));$('taskTxt').textContent=`ENDLESS • ${'♥'.repeat(lives)}${'♡'.repeat(3-lives)} • ${Math.floor(distance)} m`;$('taskFill').style.width=(distance%300)/3+'%';return}
 const v=Math.min(missionProgress(),task.T),timer=task.limit?' • '+Math.max(0,Math.ceil(task.limit-time))+'s LEFT':'';
 $('taskTxt').textContent=`${String(lvl).padStart(2,'0')} · ${task.title} · ${Math.floor(v)}/${task.T}${timer}`;$('taskFill').style.width=v/task.T*100+'%';
 if(v>=task.T&&mode==='run')end('win');else if(task.limit&&time>=task.limit&&mode==='run')end('timeout');}
// Full-screen garage, campaign atlas and vehicle upgrades.
const $b=$('tabBody'),upCost=(i,u)=>Math.round(200*(u[i]+1)*(1+SV.sel*.5));
const UI=['⚙','◎','ϟ','◇','⊕','⬡'];let carThumbs={};
const carOrder=[16,13,14,15,12,0,1,2,3,4,5,6,7,8,9,10,11];
function carStrip(){return '<div class="garage-strip" aria-label="Garage vehicles">'+carOrder.map(id=>{const v=VEH[id],owned=SV.own.includes(id);return `<button class="car-card ${prev===id?'active':''} ${owned?'':'locked'}" data-v="${id}" aria-label="Preview ${v.n}" aria-pressed="${prev===id}"><span class="car-tag">${SV.sel===id?'EQUIPPED':owned?'OWNED':'LOCKED'}</span>${carThumbs[id]?`<img src="${carThumbs[id]}" alt="${v.n}">`:'<span class="thumb-placeholder">'+(v.m==='bike'?'BIKE':v.m==='truck'?'TRUCK':'SPORT')+'</span>'}<b>${v.n}</b></button>`}).join('')+'</div>';}
function worldIcon(type){const trees='<path d="M24 75V48M53 78V35M78 72V49" stroke="#64533b" stroke-width="5"/><path d="M9 52 24 20 39 52Z M34 43 53 5 72 43Z M62 53 78 21 94 53Z" fill="#72a67d"/>';
return '<svg viewBox="0 0 100 85" aria-hidden="true">'+({forest:trees,city:'<path d="M8 76V34H30V76M35 76V10H62V76M68 76V25H92V76" fill="#41728b" stroke="#8bd7ec" stroke-width="2"/><path d="M41 20H56M41 32H56M41 44H56M15 45H24M75 37H85M75 49H85" stroke="#d9f6ff" stroke-width="3"/>',snow:'<path d="M3 79 37 10 63 64 79 30 99 79Z" fill="#839fb0"/><path d="m37 10-14 29 14-7 13 5Z M79 30 69 49 79 43 88 49Z" fill="#ecfaff"/>',desert:'<path d="M0 79 16 52 34 57 42 20 68 18 77 55 100 79" fill="#ae6742"/><path d="M11 78V47M11 61H3V51M11 66H19V54" stroke="#8ca66e" stroke-width="4"/>',coast:'<path d="M0 67Q20 53 42 66T100 64V85H0" fill="#59bcb9"/><path d="M55 75 64 20" stroke="#987652" stroke-width="5"/><path d="M64 21Q39-2 28 29Q44 17 64 21Q80-1 96 18Q80 14 64 21Q83 22 88 42Q72 29 64 21" fill="#70ad87"/>'}[type])+'</svg>';}
function atlasSVG(){return `<svg class="atlas-art" viewBox="0 0 1200 650" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#7fc4cd" stroke-opacity=".06"/></pattern><linearGradient id="land" x2="1" y2="1"><stop stop-color="#284b42"/><stop offset="1" stop-color="#152e36"/></linearGradient></defs><rect width="1200" height="650" fill="#0b222e"/><path d="M-30 108Q128 3 280 91T579 45Q730 0 846 115T1180 93L1280 429Q1082 549 934 494T659 579Q472 642 301 535T-20 540Z" fill="url(#land)" stroke="#547b75" stroke-width="2"/><path d="M673-25Q560 123 669 245T566 448Q506 537 568 680" fill="none" stroke="#215568" stroke-width="32"/><path d="M673-25Q560 123 669 245T566 448Q506 537 568 680" fill="none" stroke="#548b98" stroke-width="1"/><path d="M-20 303Q223 150 382 283T725 291T1240 246M-10 343Q223 190 382 323T725 331T1240 286M-10 383Q223 230 382 363T725 371T1240 326M-20 422Q223 270 382 403T725 411T1240 366" fill="none" stroke="#7da18b" stroke-opacity=".09" stroke-width="1"/><path d="M56 154 102 78 148 155 180 105 214 164M735 173 780 97 825 172 860 121 904 183M365 474 403 418 441 480" fill="none" stroke="#a3bcac" stroke-opacity=".23" stroke-width="2"/><rect width="1200" height="650" fill="url(#grid)"/></svg>`;}
function campaign(){const first=mapPage*10+1,k=mkTask(selLv),points=[[8,65],[17,43],[27,57],[37,32],[47,47],[57,25],[67,44],[77,24],[86,43],[93,63]],path=points.map((p,i)=>(i?'L':'M')+p[0]+','+p[1]).join(' ');
return `<div class="campaign">${atlasSVG()}<div class="atlas-heading"><span>CAREER / CHAPTER ${String(mapPage+1).padStart(2,'0')}</span><h2>THE OPEN WORLD TOUR</h2><p>5 worlds · 100 missions · one road to the top</p></div><svg class="atlas-route" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#091c26" stroke-width="1.8"/><path d="${path}" fill="none" stroke="#a8bdac" stroke-opacity=".65" stroke-width=".35" stroke-dasharray=".8 .65"/></svg>${points.map((p,i)=>{const n=first+i,m=mkTask(n),locked=n>SV.unlocked;return `<button class="map-node ${locked?'locked':n<SV.unlocked?'complete':'available'} ${selLv===n?'selected':''}" data-l="${n}" style="left:${p[0]}%;top:${p[1]}%;--region:${m.world.color}" aria-label="Level ${n}: ${m.title}, ${m.world.name}${locked?', locked':''}" aria-disabled="${locked}"><span class="node-number">${locked?'⌑':n<SV.unlocked?'✓':n}</span><small>${String(n).padStart(2,'0')} / ${m.world.short}</small></button>`}).join('')}<div class="chapter-nav"><button data-page="${mapPage-1}" ${mapPage===0?'disabled':''} aria-label="Previous chapter">‹</button><span>CHAPTER ${mapPage+1} / 10</span><button data-page="${mapPage+1}" ${mapPage===9?'disabled':''} aria-label="Next chapter">›</button></div><article class="mission-brief"><div class="region-icon" style="--region:${k.world.color}">${worldIcon(k.world.icon)}</div><div class="brief-copy"><small>LEVEL ${String(selLv).padStart(2,'0')} / ${k.world.name.toUpperCase()} / ${k.roadIndex?'FLYOVER':'UNDERPASS'} / ${k.look.toUpperCase()}</small><h3>${k.title}</h3><p>${k.tx}</p><span>${k.help}</span></div><div class="brief-action"><b>+ ${k.rw} COINS</b><button class="play-btn" id="goBtn">RACE LEVEL ${selLv} <span>➜</span></button></div></article></div>`;}
function vehicleStats(v){const items=[['TOP SPEED',Math.round(v.s[0]*280)+' KM/H',(v.s[0]-.7)/.9],['HANDLING',Math.round(v.s[1]*70),v.s[1]/1.6],['NITRO',v.s[2]+' / PICKUP',v.s[2]/45],['ARMOR',Math.max(50,100+(v.a||0))+' HP',Math.max(50,100+(v.a||0))/200]];return items.map(([name,value,progress])=>`<div class="spec"><span>${name}<b>${value}</b></span><i><u style="width:${Math.min(100,Math.max(10,progress*100))}%"></u></i></div>`).join('');}
function garage(){const v=VEH[prev],owned=SV.own.includes(prev);return `<div class="garage-title"><small>THE COLLECTION / ${String(carOrder.indexOf(prev)+1).padStart(2,'0')} OF ${VEH.length}</small><h1>${v.n}</h1><span>${v.m==='bike'?'SUPERBIKE':v.m==='truck'?'HEAVY DUTY':'PERFORMANCE SERIES'} <i>●</i> ${owned?'IN YOUR GARAGE':'AVAILABLE TO BUY'}</span></div><aside class="garage-specs"><div class="spec-heading">VEHICLE SPECS<span>${SV.sel===prev?'EQUIPPED':'PREVIEW'}</span></div>${vehicleStats(v)}<div class="car-switch"><button data-cycle="-1" aria-label="Previous car">‹</button><span>${String(carOrder.indexOf(prev)+1).padStart(2,'0')} / ${VEH.length}</span><button data-cycle="1" aria-label="Next car">›</button></div>${owned?`<button class="equip-btn" data-s="${prev}" ${SV.sel===prev?'disabled':''}>${SV.sel===prev?'✓ EQUIPPED':'EQUIP VEHICLE'}</button>`:`<button class="equip-btn" data-b="${prev}" ${SV.coins<v.p?'disabled':''}>BUY · ✦ ${v.p.toLocaleString()}</button>`}<button class="play-btn" data-open="play">CAREER <span>➜</span></button></aside><div class="garage-caption"><i></i> LIVE 3D PREVIEW <span>SELECT YOUR NEXT DRIVE</span></div>${carStrip()}`;}
function upgrades(){const d=VEH[SV.sel],u=UP(d.id),pw=SV.pown[d.id]||[],cur=SV.paint[d.id]||d.c;return `<div class="garage-title"><small>PERFORMANCE WORKSHOP</small><h1>${d.n}</h1><span>MAKE IT YOURS</span></div><aside class="workshop"><h3>PAINT & PERFORMANCE</h3><p>New paint: 150 coins. Owned colors are free.</p><div class="pal">${PAL.map(c=>`<button aria-label="Paint ${c}" class="pc${c===cur?' on':''}" data-p="${c}" style="background:${c}"${c!==cur&&c!==d.c&&!pw.includes(c)&&SV.coins<150?' disabled':''}></button>`).join('')}</div>`+['ENGINE / top speed','HANDLING / steering','NITRO / charge per pickup','ARMOR / max health','MAGNET / pickup range','SHIELD / collision protection'].map((name,i)=>{const cost=upCost(i,u);return `<div class="upgrade-row"><div><b>${name.split(' / ')[0]}</b><small>${name.split(' / ')[1]}</small><div class="pips">${[0,1,2,3,4].map(q=>`<u class="${q<u[i]?'f':''}"></u>`).join('')}</div></div><button data-u="${i}" ${u[i]>=5||SV.coins<cost?'disabled':''}>${u[i]>=5?'MAX':'✦ '+cost}</button></div>`}).join('')+'</aside><button class="workshop-back" data-open="veh">‹ BACK TO GARAGE</button>';}
function endlessMenu(){return `<div class="endless-screen">${atlasSVG()}<div class="atlas-heading"><span>FREE DRIVE</span><h2>CHOOSE YOUR WORLD</h2><p>No finish line. Three lives. Your distance record.</p></div><div class="world-options">${WORLDS.map(w=>`<button data-route="${w.id}" class="${SV.route===w.id?'selected':''}" style="--region:${w.color}">${worldIcon(w.icon)}<b>${w.name}</b><span>${w.label}</span></button>`).join('')}</div><div class="road-options"><button data-road="0" class="${SV.roadIndex===0?'selected':''}">UNDERPASS ROUTE</button><button data-road="1" class="${SV.roadIndex===1?'selected':''}">FLYOVER ROUTE</button></div><div class="endless-bottom"><span>BEST ENDLESS <b>${SV.endBest||0} m</b></span><button id="goBtn" class="play-btn">START ENDLESS ➜</button></div></div>`;}
function renderHub(){root.dataset.hubtab=tab;$('wallet').textContent=SV.coins.toLocaleString();document.querySelectorAll('.tabs button').forEach(b=>{b.classList.toggle('on',b.dataset.t===tab);b.setAttribute('aria-current',b.dataset.t===tab?'page':'false')});$b.innerHTML=tab==='play'?campaign():tab==='endless'?endlessMenu():tab==='upg'?upgrades():garage();}
$b.onclick=e=>{const t=e.target.closest('[data-road],[data-open],[data-cycle],[data-page],[data-route],[data-p],[data-b],[data-s],[data-u],[data-l],[data-v],#goBtn');if(!t||t.disabled)return;resumeAudio();SFX.click();const d=t.dataset;
 if(t.id==='goBtn'){endless=tab==='endless';lvl=endless?1:selLv;start();return}
 if(d.road!==undefined){SV.roadIndex=+d.road;}
 else if(d.open){tab=d.open;if(tab==='play')mapPage=Math.floor((selLv-1)/10)}
 else if(d.page!==undefined)mapPage=clamp(+d.page,0,9);
 else if(d.route){SV.route=d.route;}
 else if(d.cycle){const pos=carOrder.indexOf(prev);prev=carOrder[(pos+Number(d.cycle)+carOrder.length)%carOrder.length]}
 else if(d.p!==undefined){const id=SV.sel,pw=SV.pown[id]=SV.pown[id]||[];if(pw.includes(d.p)||d.p===VEH[id].c||SV.coins>=150){if(!pw.includes(d.p)&&d.p!==VEH[id].c){SV.coins-=150;pw.push(d.p)}SV.paint[id]=d.p;if(world3D)Object.assign(carThumbs,world3D.thumbnails([{...VEH[id],c:d.p}]))}}
 else if(d.b!==undefined){const v=VEH[+d.b];if(SV.coins>=v.p){SV.coins-=v.p;SV.own.push(v.id);SV.sel=prev=v.id}}
 else if(d.s!==undefined)SV.sel=prev=+d.s;
 else if(d.u!==undefined){const i=+d.u,u=UP(SV.sel),c=upCost(i,u);if(u[i]<5&&SV.coins>=c){SV.coins-=c;u[i]++}}
 else if(d.l!==undefined){if(+d.l<=SV.unlocked)selLv=+d.l;else{toast('COMPLETE LEVEL '+SV.unlocked+' TO UNLOCK');return}}
 else if(d.v!==undefined)prev=+d.v;
 saveSV();applyV();renderHub();if(d.cycle)$b.querySelector('.car-card.active')?.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'})};
document.querySelector('.tabs').onclick=e=>{const t=e.target.closest('[data-t]')?.dataset.t;if(t){tab=t;prev=SV.sel;if(tab==='play')mapPage=Math.floor((selLv-1)/10);renderHub()}};
function openHub(){$('launchCue').hidden=true;updateEngine(0,false,false);root.classList.add('in-hub');mode='hub';tab='veh';flash=0;toastLeft=0;$('toast').classList.remove('show');objects=[];sparks=[];boost=false;braking=false;playerX=0;selLv=Math.min(selLv,SV.unlocked);prev=SV.sel;$('overlay').classList.add('hidden');$('taskHud').style.display='none';$('hub').classList.remove('hidden');renderHub()}
$('nextBtn').onclick=()=>{endless=false;lvl=Math.min(100,lvl+1);selLv=lvl;start()};$('menuBtn').onclick=openHub;
function updateHUD(force=false){if(!force&&hudElapsed<.08)return;hudElapsed=0; $('distance').innerHTML=String(Math.floor(distance)).padStart(5,'0')+' <small>m</small>';$('coins').textContent='✦ '+coins;$('speed').textContent=String(Math.round(forwardSpeed*3.6));$('healthVal').textContent=Math.round(health/maxHP*100)+'%';$('healthFill').style.width=health/maxHP*100+'%';$('nitroVal').textContent=Math.round(nitro)+'%';$('nitroFill').style.width=nitro+'%';const full=nitro>=100;$('nitroState').textContent=boost?'BOOST':full?'FULL':'CHARGING';$('nitroHint').textContent=full?'READY — PRESS NITRO':'COLLECT BLUE CANISTERS';$('nitroBtn').classList.toggle('ready',full);$('brakeBtn').classList.toggle('active',braking&&mode==='run')}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');toastLeft=.7}
async function start(){if(starting||!world3D)return;starting=true;const nextTask=endless?{t:'endless',T:1e9,rw:0,tx:'Endless run',look:'day'}:mkTask(lvl),routeId=endless?SV.route:nextTask.route,route=ROUTES.find(r=>r.id===routeId)||ROUTES[0];
 try{await world3D.setMap(route.asset,endless?SV.roadIndex:nextTask.roadIndex)}catch(error){console.error(error);toast('MAP COULD NOT LOAD — TRY AGAIN');return}finally{starting=false}
 world3D.resetCamera();currentRoute=route.id;resumeAudio();SFX.start();root.classList.remove('in-hub');if(endless)lvl=1;lives=3;task=nextTask;passed=gN=hits=nearMisses=gates=boostSeconds=0;gateT=2;powerT=3;applyV();$('hub').classList.add('hidden');$('taskHud').style.display='block';$('nextBtn').style.display='none';mode='run';braking=false;brakeWas=false;launchRemaining=.85;driveFactor=0;forwardSpeed=0;time=0;travel=world3D.launchDistance();distance=0;coins=0;health=maxHP;nitro=['sprint','boost'].includes(task.t)?100:0;boost=false;playerX=laneX(0);velocity=0;keyLeft=false;keyRight=false;objects=[];sparks=[];skidMarks=[];spawnT=4.5;coinT=4;
 if(task.t==='coins'||endless)addCoinTrail(0,-85,13);
 if(task.t==='nitro')objects.push({id:++itemId,kind:'nitro',x:laneX(0),z:-85,done:false});
 invincible=0;flash=0;toastLeft=0;$('toast').classList.remove('show');steerInput=0;camSmooth=0;$('overlay').classList.add('hidden');checkTask();updateHUD(true);draw();$('launchCue').hidden=false;$('launchCue').textContent='READY'}
function end(why){braking=false;boost=false;
 const won=why==='win';mode='over';boost=false;updateEngine(0,false,false);won?SFX.win():SFX.lose();const d=Math.floor(distance);let rw=0;
 if(d>best){best=d;try{localStorage.setItem('highway-rush-3d-best',String(best))}catch(e){}}
 if(won){rw=task.rw;if(lvl===SV.unlocked&&lvl<100)SV.unlocked++;SV.results[lvl]={stars:hits===0?3:hits<3?2:1,time:Math.round(time),map:currentRoute}}
 if(endless&&d>(SV.endBest||0))SV.endBest=d;SV.coins+=coins+rw;saveSV();
 $('best').innerHTML=String(best).padStart(5,'0')+' <small>m</small>';
 $('menuTag').textContent=won?'LEVEL '+lvl+' COMPLETE':why==='timeout'?'TIME IS UP':why==='clean'?'TASK FAILED — YOU GOT HIT':(endless?'OUT OF LIVES':'CRASHED OUT');
 $('menuTitle').innerHTML=won?'LEVEL<br><em>CLEARED</em>':'GAME<br><em>OVER</em>';
 $('menuText').innerHTML=`Distance <b>${d}m</b> • Coins <b>✦${coins}</b>${won?` • Bonus <b>✦${rw}</b>`:''}<br>${endless?'Best endless: '+Math.max(SV.endBest||0,d)+' m':'Task: '+task.tx}`;
 $('playBtn').textContent=won?'REPLAY LEVEL →':'RETRY →';$('nextBtn').style.display=won&&lvl<100?'':'none';$('overlay').classList.remove('hidden')}
const TM={sedan:[1.75,1.76,2.65],suv:[1.85,1.82,2.7],sport:[1.75,1.76,2.6],truck:[2.4,2.1,4.2],bike:[.9,1.3,1.8]},CC=['#de4234','#efb83f','#4777f0','#a74edc','#ee8097','#31b2aa','#d4e0ec','#f27d2a'];
const NSP={sedan:[.30,.44],suv:[.26,.38],sport:[.44,.58],truck:[.14,.27],bike:[.40,.54]},NWV={sedan:.30,suv:.22,sport:.45,truck:.10,bike:.50},CITY=['KHI','LHR','ISB','PSH','QTA','MUX'],BRAND=['CARGO','SPEEDEX','TRANS-PK','HAULER','NOOR'];
function mk(lane,z){const r=Math.random(),model=r<.28?'sedan':r<.43?'suv':r<.58?'sport':r<.8?'truck':'bike',t=TM[model],s=R(NSP[model][0],NSP[model][1]);
 objects.push({id:++itemId,kind:'car',x:laneX(lane),z,color:CC[Math.floor(R(0,CC.length))],model,hx:t[1],hz:t[2],done:false,
  lane,tl:lane,tx:laneX(lane),sp0:s,sp:s,ph:Math.random(),lean:0,vx:0,sig:0,sigT:0,sigOff:0,cd:R(.2,1.2),wv:NWV[model]*(1+lvl*.01),bk:false,bkp:false,
  art:Math.random()<.6,pax:Math.random()<.3,plate:CITY[Math.floor(R(0,CITY.length))]+'-'+(10+Math.floor(R(0,90))),brand:BRAND[Math.floor(R(0,BRAND.length))]})}
// NPC traffic: own speed, keeps distance to the car ahead, signals then changes lanes
function npcAI(o,dt,base){if(o.oncoming)return;
 let tg=o.sp0,br=false;
 for(const q of objects){if(q===o||q.oncoming||q.kind!=='car'||q.done||q.z>=o.z||Math.abs(q.x-o.x)>2.1)continue;const d=o.z-q.z,th=(o.hz+q.hz)*1.1+3;
  if(d<th){tg=Math.min(tg,Math.max(.08,q.sp-.04));if(d<th*.8)br=true}}
 o.sp+=(tg-o.sp)*Math.min(1,dt*3);
 o.ph+=o.sp*base*dt*.55;
 const dx=o.tx-o.x;
 if(Math.abs(dx)>.01){const sp=o.model==='bike'?3.4:o.model==='truck'?1.7:2.5,mv=Math.sign(dx)*Math.min(Math.abs(dx),sp*dt);o.x+=mv;o.vx=mv/Math.max(dt,.001)}else{o.x=o.tx;o.vx=0}
 o.lean+=((o.vx||0)*(o.model==='bike'?.075:.04)-o.lean)*Math.min(1,dt*7);
 if(o.sigT>0){o.sigT-=dt;if(o.sigT<=0){o.lane=o.tl;o.tx=laneX(o.tl);o.sigOff=.7}}
 else{
  if(o.sigOff>0){o.sigOff-=dt;if(o.sigOff<=0)o.sig=0}
  o.cd-=dt;
  if(o.cd<=0){o.cd=R(.5,.9);
   if(!o.sig&&o.z>-168&&o.z<-95&&Math.random()<o.wv){const d=Math.random()<.5?-1:1,nl=o.lane+d;
    if(nl>=0&&nl<LANE_COUNT&&!objects.some(q=>q!==o&&!q.oncoming&&q.kind==='car'&&!q.done&&(q.tl===nl||q.lane===nl)&&Math.abs(q.z-o.z)<22)){o.sig=d;o.sigT=.9;o.tl=nl;o.bkp=Math.random()<.6}}}}
 o.bk=br||(o.sigT>0&&o.bkp);
}
function spawn(){const lane=Math.floor(R(0,LANE_COUNT));mk(lane,-175);if(Math.random()<.2)mk(1-lane,-203);if(Math.random()<.65){mk(Math.floor(R(0,LANE_COUNT)),-195);const o=objects.at(-1);o.oncoming=true;o.x+=13.625;o.tx=o.x;o.sp=o.sp0=.6;}}
// More collectible trails; hazards have their own capped probability at every level.
function addCoinTrail(lane,z,count=10){
 for(let i=0;i<count;i++)objects.push({id:++itemId,kind:'coin',x:laneX(lane),z:z-i*5.4,done:false});
}
function spawnPickups(){
 const available=[0,1].filter(l=>!objects.some(o=>o.kind==='car'&&!o.done&&Math.abs(o.x-laneX(l))<1.4&&o.z>-195&&o.z<-115));
 const lanes=available.length?available:[0,1],lane=lanes[Math.floor(R(0,lanes.length))],t=task?.t;
 if(endless||t==='coins'){addCoinTrail(lane,-145,t==='coins'?12:V.cn);if(Math.random()<.4&&lanes.length>1)addCoinTrail(lanes[(lanes.indexOf(lane)+1)%lanes.length],-170,6)}
 else if(!['clean','sprint','gates'].includes(t)&&Math.random()<.2)addCoinTrail(lane,-145,3);
 if(Math.random()<.55){const r=Math.random(),kind=r<.15&&t!=='clean'?'bomb':health<maxHP&&r<.4?'heal':'nitro';objects.push({id:++itemId,kind,x:laneX(lane),z:-150,done:false})}
}
function missionSpawns(dt){if(driveFactor<=.05)return;
 if(task.t==='gates'){gateT-=dt;if(gateT<=0){const lane=Math.floor(R(0,LANE_COUNT));objects.push({id:++itemId,kind:'gate',x:laneX(lane),z:-90,done:false});for(const o of objects)if(o.kind==='car'&&Math.abs(o.x-laneX(lane))<2&&Math.abs(o.z+90)<20)o.done=true;gateT=6.5}}
 if(task.t==='nitro'||task.t==='boost'||task.t==='sprint'){powerT-=dt;if(powerT<=0){objects.push({id:++itemId,kind:'nitro',x:laneX(Math.floor(R(0,LANE_COUNT))),z:-105,done:false});powerT=task.t==='nitro'?3:5}}
}
function update(dt){hudElapsed+=dt;taskElapsed+=dt;if(mode!=='run')return;if(launchRemaining>0){launchRemaining=Math.max(0,launchRemaining-dt);$('launchCue').textContent=launchRemaining>.3?'READY':'GO';$('launchCue').hidden=launchRemaining===0;updateEngine(0,false,true);return;}if(braking){boost=false;if(!brakeWas&&forwardSpeed>10)SFX.brake()}brakeWas=braking;time+=dt;invincible=Math.max(0,invincible-dt);
 // analog steering: buttons = full, touch drag = proportional
 let steer=(keyRight?1:0)-(keyLeft?1:0);if(Math.abs(steerInput)>Math.abs(steer))steer=steerInput;
 const maxV=8.2*V.hnd,acc=22*V.hnd;
 if(Math.abs(steer)>.02){velocity+=steer*acc*dt;if(Math.abs(velocity)>3.5&&Math.abs(steer)>.6&&skidMarks.length<256&&Math.random()<.08)skidMarks.push({x:playerX+R(-.15,.15),z:2.6,a:.35})}
 else velocity*=Math.exp(-7.5*dt);
 velocity=clamp(velocity,-maxV,maxV);playerX=clamp(playerX+velocity*dt,-LANE_LIMIT,LANE_LIMIT);
 if(Math.abs(playerX)>=LANE_LIMIT){velocity*=.3;playerX=clamp(playerX,-LANE_LIMIT,LANE_LIMIT)}
const base=(25+lvl*.1+Math.min(40,time*.3))*V.spd,target=braking?0:Math.min(base+(boost?27:0),world3D.cornerAdvisory(travel)+(boost?2:0)),rate=braking?25:forwardSpeed<target?(boost?12:6)*V.spd:7;forwardSpeed+=Math.sign(target-forwardSpeed)*Math.min(Math.abs(target-forwardSpeed),rate*dt);if(forwardSpeed<.005)forwardSpeed=0;const speed=forwardSpeed;driveFactor=clamp(speed/Math.max(1,base),0,1); travel+=speed*dt;distance+=speed*dt*.75;missionSpawns(dt);if(boost){boostSeconds+=dt;nitro=Math.max(0,nitro-29*dt);if(nitro<=0)boost=false}
if(driveFactor>.05){spawnT-=dt;coinT-=dt;}if(spawnT<=0){spawn();spawnT=Math.max(.65,(task.t==='survive'?1.35:task.t==='clean'?2.6:1.95)-time*.006-lvl*.006)}if(coinT<=0){spawnPickups();coinT=task.t==='coins'||endless?R(1.8,2.6):R(4,6)}
for(const o of objects){if(o.kind==='car'&&!o.done)npcAI(o,dt,base);o.z+=(o.kind==='car'?speed+(o.oncoming?1:-1)*o.sp*base:speed)*dt;if(o.done)continue;if(o.kind==='car'&&!o.oncoming&&o.z>5&&!o.ps){o.ps=1;passed++;const gap=Math.abs(o.x-playerX)-(o.hx+V.ax);if(gap>.05&&gap<1.3){nearMisses++;toast('CLOSE CALL +1');SFX.pass()}else if(Math.random()<.35)SFX.pass()}const dz=Math.abs(o.z-3),dx=Math.abs(o.x-playerX);if(dz<(o.hz||2)&&dx<(o.hx?o.hx+V.ax:1.35+(o.kind==='coin'?V.mg:0))){
o.done=true;if(o.kind==='car'||o.kind==='bomb'){if(invincible<=0){health=Math.max(0,health-25);invincible=V.inv;flash=.28;toast('-25 HEALTH');hits++;(o.kind==='bomb'?SFX.bomb:SFX.hit)();if(task.t==='clean'){end('clean');break}if(health<=0){if(endless&&lives>1){lives--;health=maxHP;invincible=2.5;toast('LIFE LOST • '+lives+' LEFT');for(const q of objects)if(q.kind==='car'&&q.z>-70)q.done=true}else{end();break}}}}else if(o.kind==='coin'){coins++;toast('✦ +1 COIN');SFX.coin()}else if(o.kind==='gate'){gates++;toast('CHECKPOINT '+gates+' / '+task.T);SFX.heal()}else if(o.kind==='heal'){health=Math.min(maxHP,health+25);toast('♥ +25 HEALTH');SFX.heal()}else{const was=nitro;nitro=Math.min(100,nitro+V.nit);gN++;toast(nitro>=100?'⚡ NITRO READY':'+'+V.nit+' NITRO');SFX.nitro();if(was<100&&nitro>=100)SFX.ready()}}}
objects=objects.filter(o=>!o.done&&o.z<18&&o.z>-310);if(toastLeft>0){toastLeft-=dt;if(toastLeft<=0)$('toast').classList.remove('show')}flash=Math.max(0,flash-dt);if(taskElapsed>=.08){checkTask();taskElapsed=0}updateHUD();const spdN=clamp((25+lvl*.1+Math.min(40,time*.3))*V.spd/70,0,1.4);updateEngine(clamp(forwardSpeed/75,0,1.5),boost,true)}
function frame(t){const elapsed=clamp((t-last)/1000||0,0,.12);last=t;if(document.hidden){simulationDebt=0;requestAnimationFrame(frame);return}simulationDebt+=elapsed;let steps=0;while(simulationDebt>=1/60&&steps<8){update(1/60);simulationDebt-=1/60;steps++}const interval=mode==='pause'?100:mode==='hub'?1000/30:1000/60;if(t-lastDrawTime>=interval-.5){draw();lastDrawTime=t}requestAnimationFrame(frame)}
 document.addEventListener('visibilitychange',()=>{last=performance.now();pT0=last;simulationDebt=0;if(document.hidden&&mode==='run')$('pauseBtn').click()});
$('playBtn').onclick=()=>{if(mode==='pause'){$('overlay').classList.add('hidden');mode='run'}else start()};$('pauseBtn').onclick=()=>{if(mode==='run'){mode='pause';boost=false;braking=false;updateEngine(0,false,false);$('menuTag').textContent='TAKE A BREAK';$('menuTitle').innerHTML='RACE<br><em>PAUSED</em>';$('menuText').textContent='Your highway is waiting';$('playBtn').textContent='RESUME RACE →';$('overlay').classList.remove('hidden')}else if(mode==='pause'){$('overlay').classList.add('hidden');mode='run'}};
function hold(id,on,off){let el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);on();el.classList.add('pressed')});const stop=()=>{off();el.classList.remove('pressed')};['pointerup','pointercancel','lostpointercapture'].forEach(event=>el.addEventListener(event,stop))}
function nitroStart(){if(mode!=='run'||braking)return;if(nitro>=100||boost){if(!boost)SFX.boostOn();boost=true}else toast('COLLECT NITRO FIRST')}
hold('leftBtn',()=>{keyLeft=true;steerInput=-1},()=>{keyLeft=false;if(!keyRight)steerInput=0});hold('rightBtn',()=>{keyRight=true;steerInput=1},()=>{keyRight=false;if(!keyLeft)steerInput=0});hold('nitroBtn',nitroStart,()=>boost=false);hold('brakeBtn',()=>{if(mode==='run'){braking=true;boost=false}},()=>braking=false);
window.addEventListener('keydown',e=>{let k=e.key.toLowerCase();if(['arrowleft','arrowright',' ','arrowup','arrowdown','s','a','d'].includes(k)&&mode==='run')e.preventDefault();if(k==='arrowleft'||k==='a'){keyLeft=true;steerInput=-1}if(k==='arrowright'||k==='d'){keyRight=true;steerInput=1}if((k===' '||k==='arrowup')&&!e.repeat)nitroStart();if((k==='s'||k==='arrowdown')&&mode==='run'){braking=true;boost=false}if(k==='p'&&!e.repeat)$('pauseBtn').click();if(k==='enter'&&!e.repeat&&mode!=='run'&&mode!=='hub')$('playBtn').click()});window.addEventListener('keyup',e=>{let k=e.key.toLowerCase();if(k==='arrowleft'||k==='a'){keyLeft=false;if(!keyRight)steerInput=0}if(k==='arrowright'||k==='d'){keyRight=false;if(!keyLeft)steerInput=0}if(k==='s'||k==='arrowdown')braking=false;if(k===' '||k==='arrowup')boost=false});window.addEventListener('blur',()=>{braking=false;boost=false;keyLeft=false;keyRight=false;steerInput=0});let initial=null;canvas.addEventListener('pointerdown',e=>{if(mode!=='run')return;initial=e.clientX;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(initial===null)return;const diff=e.clientX-initial;steerInput=clamp(diff/(W*.22),-1,1);keyLeft=steerInput<-.15;keyRight=steerInput>.15});['pointerup','pointercancel'].forEach(x=>canvas.addEventListener(x,()=>{initial=null;keyLeft=false;keyRight=false;steerInput=0}));$('muteBtn').onclick=()=>{resumeAudio();muted=!muted;$('muteBtn').innerHTML=hudIcon(muted?'muted':'sound');if(muted){updateEngine(0,false,false);if(masterGain)masterGain.gain.value=0}else if(masterGain)masterGain.gain.value=.45};
updateHUD();openHub();
const loading=document.createElement('div');loading.className='asset-loading';loading.textContent='LOADING VEHICLES…';if(!document.getElementById('bootScreen'))root.append(loading);window.highwayBootProgress?.(76,'Preparing vehicle models');
try{
 world3D=await window.createHighwayWorld(root,window.HIGHWAY_ASSETS);delete window.HIGHWAY_ASSETS;window.highwayBootProgress?.(92,'Preparing your garage');carThumbs=world3D.thumbnails(VEH.map(v=>({...v,c:SV.paint[v.id]||v.c})));renderHub();
 loading.remove();saveSV();window.highwayBootReady?.();
 const modelName=document.createElement('div');modelName.id='modelName';root.append(modelName);
 const route=document.createElement('div');route.className='route-label';route.textContent='DIVIDED HIGHWAY • TWO-WAY TRAFFIC';root.append(route);
 // Read-only runtime snapshot for diagnostics and game verification.
 window.highwayDebug={snapshot:()=>({mode,level:lvl,mission:task?{type:task.t,target:task.T,progress:missionProgress(),limit:task.limit}:null,route:currentRoute,audioClips:sampledSounds.size,nearMisses,gates,boostSeconds,travel,distance,playerX,coins,health,nitro,braking,forwardSpeed,driveFactor,launchRemaining,boost,selected:VEH[SV.sel].n,coinObjects:objects.filter(o=>o.kind==='coin').length,trees:world3D.stats.trees,treeSpecies:world3D.stats.treeSpecies,render:{...world3D.stats},roadOffsets:[-40,-100,-160].map(z=>world3D.offset(z))})};
 last=performance.now();requestAnimationFrame(frame);
}catch(error){console.error('3D assets failed',error);loading.textContent='3D could not start. Please enable WebGL / hardware acceleration and reopen index.html.';loading.classList.add('failed');window.highwayBootFail?.()}

['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,()=>{resumeAudio()}, {once:true}));
})();
