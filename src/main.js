/**
 * Grudge Fishing — standalone 3D fishing game
 * Grudge Studio Forge · Three.js + Cloudflare D1/R2
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const API = 'https://grudge-fishing-api.grudge.workers.dev';
const R2 = 'https://assets.grudge-studio.com/models/fishing';
const CHAR_BASE = 'https://assets.grudge-studio.com/models/characters';

const CHARACTERS = [
  { id: 'human', name: 'Human', emoji: '⚔️', color: '#c0a050' },
  { id: 'barbarian', name: 'Barbarian', emoji: '🪓', color: '#cc4444' },
  { id: 'elf', name: 'Elf', emoji: '🏹', color: '#44cc66' },
  { id: 'dwarf', name: 'Dwarf', emoji: '⛏️', color: '#aa8844' },
  { id: 'orc', name: 'Orc', emoji: '💀', color: '#669944' },
  { id: 'undead', name: 'Undead', emoji: '👻', color: '#8866aa' },
];
const RODS = [
  { id: 1, name: 'Driftwood', tier: 'T1', emoji: '🪵' },
  { id: 2, name: 'Bamboo', tier: 'T2', emoji: '🎋' },
  { id: 3, name: 'Iron', tier: 'T3', emoji: '⚙️' },
  { id: 4, name: 'Mithril', tier: 'T4', emoji: '💎' },
  { id: 5, name: 'Leviathan', tier: 'T5', emoji: '🐉' },
];

const WaterVertShader = `
  varying vec2 vUv; varying vec3 vWorldPos; uniform float uTime;
  void main() {
    vUv = uv; vec3 pos = position;
    pos.y += sin(pos.x*0.8+uTime*0.7)*0.15 + sin(pos.z*0.6+uTime*0.5)*0.12 + cos(pos.x*0.3+pos.z*0.5+uTime*0.3)*0.08;
    vWorldPos = (modelMatrix * vec4(pos,1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
  }
`;
const WaterFragShader = `
  precision highp float; varying vec2 vUv; varying vec3 vWorldPos;
  uniform float uTime; uniform vec3 uDeepColor; uniform vec3 uShallowColor; uniform vec3 uFoamColor;
  #define TAU 6.28318530718
  vec3 caustic(vec2 uv) {
    vec2 p = mod(uv*TAU,TAU)-250.0; float time = uTime*0.4+23.0;
    vec2 i = vec2(p); float c = 1.0; float inten = 0.005;
    for(int n=0;n<4;n++){float t=time*(1.0-(3.5/float(n+1)));i=p+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));c+=1.0/length(vec2(p.x/(sin(i.x+t)/inten),p.y/(cos(i.y+t)/inten)));}
    c/=4.0; c=1.17-pow(c,1.4); vec3 color=vec3(pow(abs(c),8.0)); return clamp(color+vec3(0.0,0.35,0.5),0.0,1.0);
  }
  void main() {
    vec2 wUv = vWorldPos.xz*0.05; vec3 caust = caustic(wUv*1.5+uTime*0.02);
    float depth = smoothstep(-2.0,8.0,length(vWorldPos.xz));
    vec3 wc = mix(uShallowColor,uDeepColor,depth); float foam = smoothstep(0.4,0.0,depth)*0.3;
    wc = mix(wc,uFoamColor,foam); wc += caust*0.12; float alpha = mix(0.7,0.9,depth);
    gl_FragColor = vec4(wc,alpha);
  }
`;

let scene,camera,renderer,controls,clock,mixer=null,characterModel=null,rodModel=null,selectedRod=1,selectedChar='human';
const gltfLoader = new GLTFLoader();
let fishingState='idle',castResult=null,biteTimer=0,reelWindowTimer=0,tension=0.5,tensionSpeed=0,reelProgress=0,bobberTime=0;
let totalCatches=0,totalXp=0,totalGold=0;
let bobber=null,bobberTarget=new THREE.Vector3(),fishingLine=null,fishingLineGeom=null,waterMesh=null,waterMat=null;
let swimFish=[],splashParticles=null,splashLife=0;

function initScene(){const canvas=document.getElementById('game-canvas');clock=new THREE.Clock();scene=new THREE.Scene();scene.background=new THREE.Color(0x87ceeb);scene.fog=new THREE.FogExp2(0x87ceeb,0.008);camera=new THREE.PerspectiveCamera(55,window.innerWidth/window.innerHeight,0.1,500);camera.position.set(3,4,8);renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;controls=new OrbitControls(camera,canvas);controls.target.set(0,1,0);controls.enableDamping=true;controls.dampingFactor=0.08;controls.maxPolarAngle=Math.PI*0.48;controls.minDistance=3;controls.maxDistance=30;controls.update();scene.add(new THREE.HemisphereLight(0x87ceeb,0x2d5a27,0.6));const sun=new THREE.DirectionalLight(0xfff4e0,2.0);sun.position.set(20,30,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.near=1;sun.shadow.camera.far=80;sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;scene.add(sun);const fill=new THREE.DirectionalLight(0x8ec8f0,0.4);fill.position.set(-10,15,-10);scene.add(fill);window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight)});}

function createIsland(){const geo=new THREE.CircleGeometry(12,64);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getY(i),d=Math.sqrt(x*x+z*z);const h=Math.max(0,(1-d/12)*2.5*(0.7+0.3*Math.sin(x*0.5)*Math.cos(z*0.4)));const n=Math.sin(x*3.7+z*2.3)*0.15+Math.cos(x*1.3+z*4.1)*0.1;pos.setZ(i,h+n*(1-d/12));}geo.computeVertexNormals();const mat=new THREE.MeshStandardMaterial({color:0xd4a84b,roughness:0.95});const m=new THREE.Mesh(geo,mat);m.rotation.x=-Math.PI/2;m.position.y=-0.15;m.receiveShadow=true;m.castShadow=true;scene.add(m);const gGeo=new THREE.RingGeometry(4,8,32);const gMat=new THREE.MeshStandardMaterial({color:0x4a7c3f,roughness:0.9,transparent:true,opacity:0.5});const g=new THREE.Mesh(gGeo,gMat);g.rotation.x=-Math.PI/2;g.position.y=0.01;scene.add(g);for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2+Math.random()*0.3,d=4+Math.random()*3;createPalmTree(Math.cos(a)*d,Math.sin(a)*d);}for(let i=0;i<5;i++){const a=Math.random()*Math.PI*2,d=6+Math.random()*4;const rg=new THREE.DodecahedronGeometry(0.3+Math.random()*0.5,1);const rm=new THREE.MeshStandardMaterial({color:0x666666,roughness:0.85,flatShading:true});const r=new THREE.Mesh(rg,rm);r.position.set(Math.cos(a)*d,0.1,Math.sin(a)*d);r.rotation.set(Math.random(),Math.random(),Math.random());r.scale.y=0.6;r.castShadow=true;scene.add(r);}}
function createPalmTree(x,z){const g=new THREE.Group();const tg=new THREE.CylinderGeometry(0.08,0.12,3,8);const tm=new THREE.MeshStandardMaterial({color:0x8B6914,roughness:0.9});const t=new THREE.Mesh(tg,tm);t.position.y=1.5;t.rotation.z=Math.sin(x)*0.15;t.castShadow=true;g.add(t);for(let i=0;i<6;i++){const fg=new THREE.PlaneGeometry(2,0.4,8,1);const fp=fg.attributes.position;for(let j=0;j<fp.count;j++)fp.setZ(j,-Math.abs(fp.getX(j))*0.5);fg.computeVertexNormals();const fm=new THREE.MeshStandardMaterial({color:0x2d7a2d,side:THREE.DoubleSide,roughness:0.8});const f=new THREE.Mesh(fg,fm);f.position.y=3;f.rotation.y=(i/6)*Math.PI*2;f.rotation.x=0.6;f.castShadow=true;g.add(f);}g.position.set(x,0,z);scene.add(g);}

function createWater(){const geo=new THREE.PlaneGeometry(200,200,128,128);waterMat=new THREE.ShaderMaterial({vertexShader:WaterVertShader,fragmentShader:WaterFragShader,uniforms:{uTime:{value:0},uDeepColor:{value:new THREE.Color(0x0a3d5c)},uShallowColor:{value:new THREE.Color(0x1a8a9a)},uFoamColor:{value:new THREE.Color(0xc8e6f0)}},transparent:true,side:THREE.DoubleSide});waterMesh=new THREE.Mesh(geo,waterMat);waterMesh.rotation.x=-Math.PI/2;waterMesh.position.y=-0.3;waterMesh.receiveShadow=true;scene.add(waterMesh);}

async function createDock(){try{const gltf=await gltfLoader.loadAsync(`${R2}/environment/Dock_Long.glb`);const d=gltf.scene;d.scale.setScalar(0.012);d.position.set(0,0.05,-5);d.rotation.y=Math.PI;d.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});scene.add(d);}catch{const pm=new THREE.MeshStandardMaterial({color:0x8B6914,roughness:0.85});const pg=new THREE.BoxGeometry(2,0.1,6);const p=new THREE.Mesh(pg,pm);p.position.set(0,0.2,-5);p.castShadow=true;p.receiveShadow=true;scene.add(p);const postGeo=new THREE.CylinderGeometry(0.06,0.06,1.5,6);for(const px of[-0.8,0.8])for(const pz of[-3,-5,-7]){const post=new THREE.Mesh(postGeo,pm);post.position.set(px,-0.3,pz);post.castShadow=true;scene.add(post);}}}

function createBobber(){const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06,12,12),new THREE.MeshStandardMaterial({color:0xff3333})));const b=new THREE.Mesh(new THREE.SphereGeometry(0.05,12,12),new THREE.MeshStandardMaterial({color:0xffffff}));b.position.y=-0.04;g.add(b);const s=new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.005,0.08,4),new THREE.MeshStandardMaterial({color:0x333333}));s.position.y=0.07;g.add(s);g.visible=false;scene.add(g);bobber=g;fishingLineGeom=new THREE.BufferGeometry();fishingLineGeom.setAttribute('position',new THREE.BufferAttribute(new Float32Array(90),3));fishingLine=new THREE.Line(fishingLineGeom,new THREE.LineBasicMaterial({color:0x888888,transparent:true,opacity:0.6}));fishingLine.visible=false;fishingLine.frustumCulled=false;scene.add(fishingLine);const c=25,pG=new THREE.BufferGeometry();pG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(c*3),3));pG.setAttribute('velocity',new THREE.BufferAttribute(new Float32Array(c*3),3));splashParticles=new THREE.Points(pG,new THREE.PointsMaterial({color:0xaaddff,size:0.04,transparent:true,opacity:0.8}));splashParticles.visible=false;scene.add(splashParticles);}

async function loadCharacter(raceId){setLoadText(`Loading ${raceId}...`);if(characterModel){scene.remove(characterModel);mixer=null;}try{const gltf=await gltfLoader.loadAsync(`${CHAR_BASE}/${raceId}.glb`);characterModel=gltf.scene;characterModel.scale.setScalar(0.01);characterModel.position.set(0,0.15,-3);characterModel.rotation.y=Math.PI;characterModel.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});scene.add(characterModel);if(gltf.animations.length>0){mixer=new THREE.AnimationMixer(characterModel);mixer.clipAction(gltf.animations[0]).play();}}catch(e){console.warn('Character load failed:',e.message);characterModel=null;}}

async function spawnAmbientFish(){try{const res=await fetch(`${API}/api/fishing/species?rarity=common`);const sp=await res.json();for(const fish of sp.slice(0,4)){try{const gltf=await gltfLoader.loadAsync(fish.model_url);const m=gltf.scene;m.scale.setScalar(0.008);const x=(Math.random()-0.5)*20,z=-8-Math.random()*12,y=-0.8-Math.random()*1.5;m.position.set(x,y,z);m.rotation.y=Math.random()*Math.PI*2;scene.add(m);swimFish.push({model:m,speed:0.3+Math.random()*0.5,phase:Math.random()*Math.PI*2,baseX:x,baseY:y,dir:Math.random()>0.5?1:-1});}catch{}}}catch(e){console.warn('Ambient fish load failed:',e.message);}}

async function apiCast(){try{const r=await fetch(`${API}/api/fishing/cast`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player_id:'guest',rod_id:selectedRod,player_level:1+Math.floor(totalCatches/5),biome:'coastal'})});return await r.json();}catch{return null;}}
async function apiCatch(fishId,weight){try{const r=await fetch(`${API}/api/fishing/catch`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player_id:'guest',fish_species_id:fishId,rod_id:selectedRod,weight})});return await r.json();}catch{return null;}}

async function castLine(){if(fishingState!=='idle')return;setState('casting');castResult=await apiCast();bobberTarget.set((Math.random()-0.5)*2,-0.3,-8-Math.random()*4);bobber.position.set(0,2,-3);bobber.visible=true;fishingLine.visible=true;setTimeout(()=>{bobber.position.copy(bobberTarget);triggerSplash(bobberTarget);setState('waiting');biteTimer=castResult?castResult.bite_delay_ms/1000:5+Math.random()*8;},800);}
function startReel(){if(fishingState!=='bite')return;setState('reeling');tension=0.5;tensionSpeed=0;reelProgress=0;}
function pumpReel(){if(fishingState!=='reeling')return;tensionSpeed+=0.15;reelProgress+=0.02/(castResult?.difficulty||0.5);}
function cancelFishing(){if(fishingState==='idle')return;bobber.visible=false;fishingLine.visible=false;setState('idle');}
async function fishCaught(){setState('catching');bobber.visible=false;fishingLine.visible=false;totalCatches++;let cr=null;if(castResult){cr=await apiCatch(castResult.fish_species_id,castResult.weight);totalXp+=castResult.base_xp;totalGold+=castResult.base_gold;}showCatchPopup(castResult,cr);updateHudStats();setTimeout(()=>setState('idle'),2500);}
function fishEscaped(){setState('failed');bobber.visible=false;fishingLine.visible=false;setTimeout(()=>setState('idle'),1500);}

function setState(s){fishingState=s;const b=document.getElementById('state-badge'),bc=document.getElementById('btn-cast'),br=document.getElementById('btn-reel'),tp=document.getElementById('tension-panel');const l={idle:'READY',casting:'CASTING...',waiting:'WAITING FOR BITE...',bite:'🐟 FISH ON! REEL!',reeling:'REELING...',catching:'🎉 CAUGHT!',failed:'💨 GOT AWAY!'};b.textContent=l[s]||s;bc.disabled=s!=='idle';br.disabled=s!=='bite'&&s!=='reeling';tp.classList.toggle('visible',s==='reeling');}
function updateHudStats(){document.getElementById('stat-catches').textContent=totalCatches;document.getElementById('stat-xp').textContent=totalXp;document.getElementById('stat-gold').textContent=totalGold;}
function showCatchPopup(c,cr){if(!c)return;document.getElementById('catch-name').textContent=c.fish_name;document.getElementById('catch-weight').textContent=`${c.weight} lbs`;const re=document.getElementById('catch-rarity');re.textContent=c.rarity;re.className=`catch-rarity rarity-${c.rarity}`;document.getElementById('catch-xp').textContent=`+${c.base_xp} XP • +${c.base_gold} Gold`;document.getElementById('catch-record').style.display=cr?.is_personal_record?'':'none';const p=document.getElementById('catch-popup');p.classList.add('show');setTimeout(()=>p.classList.remove('show'),2500);}
function setLoadText(t){const e=document.getElementById('load-text');if(e)e.textContent=t;}

function updateFishingLine(){if(!fishingLine.visible)return;const rt=new THREE.Vector3(0,2.5,-3),bp=bobber.position,p=fishingLineGeom.attributes.position.array;for(let i=0;i<30;i++){const t=i/29;p[i*3]=THREE.MathUtils.lerp(rt.x,bp.x,t);p[i*3+2]=THREE.MathUtils.lerp(rt.z,bp.z,t);p[i*3+1]=THREE.MathUtils.lerp(rt.y,bp.y,t)-Math.sin(t*Math.PI)*0.4*(1-t*0.5);}fishingLineGeom.attributes.position.needsUpdate=true;}
function triggerSplash(pos){const p=splashParticles.geometry.attributes.position.array,v=splashParticles.geometry.attributes.velocity.array;for(let i=0;i<p.length/3;i++){p[i*3]=pos.x+(Math.random()-.5)*.15;p[i*3+1]=pos.y;p[i*3+2]=pos.z+(Math.random()-.5)*.15;v[i*3]=(Math.random()-.5)*2;v[i*3+1]=1.5+Math.random()*2.5;v[i*3+2]=(Math.random()-.5)*2;}splashParticles.geometry.attributes.position.needsUpdate=true;splashParticles.visible=true;splashLife=0.8;}
function updateSplash(dt){splashLife-=dt;if(splashLife<=0){splashParticles.visible=false;return;}const p=splashParticles.geometry.attributes.position.array,v=splashParticles.geometry.attributes.velocity.array;for(let i=0;i<p.length/3;i++){p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt;v[i*3+1]-=9.8*dt;}splashParticles.geometry.attributes.position.needsUpdate=true;splashParticles.material.opacity=splashLife;}

function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();bobberTime+=dt;controls.update();if(mixer)mixer.update(dt);if(waterMat)waterMat.uniforms.uTime.value+=dt;for(const f of swimFish){f.phase+=dt*f.speed;f.model.position.x=f.baseX+Math.sin(f.phase)*3*f.dir;f.model.position.y=f.baseY+Math.sin(f.phase*2)*0.08;f.model.rotation.y=Math.atan2(Math.cos(f.phase)*f.dir,-Math.sin(f.phase)*f.dir);if(f.model.position.z<-22)f.model.position.z=-8;f.model.position.z+=Math.cos(f.phase)*dt*f.speed*f.dir*0.3;}
switch(fishingState){case'waiting':bobber.position.y=-0.3+Math.sin(bobberTime*2)*0.02;biteTimer-=dt;if(biteTimer<=0){setState('bite');reelWindowTimer=(castResult?.reel_window_ms||3000)/1000;triggerSplash(bobber.position);}break;case'bite':bobber.position.y=-0.3+Math.sin(bobberTime*12)*0.08-0.05;reelWindowTimer-=dt;if(reelWindowTimer<=0)fishEscaped();break;case'reeling':{const diff=castResult?.difficulty||0.5;const pull=(Math.sin(bobberTime*3.5)*0.5+Math.random()*0.3)*diff;tensionSpeed+=(pull-0.3)*dt*2;tensionSpeed*=0.95;tension+=tensionSpeed*dt;tension=Math.max(0,Math.min(1,tension));if(tension<=0.05||tension>=0.95){fishEscaped();break;}if(tension>0.3&&tension<0.7)reelProgress+=dt*0.15/diff;bobber.position.lerpVectors(bobberTarget,new THREE.Vector3(0,-0.3,-3),reelProgress);bobber.position.y=-0.3+Math.sin(bobberTime*6)*0.04;document.getElementById('tension-marker').style.left=`${tension*100}%`;document.getElementById('progress-fill').style.width=`${reelProgress*100}%`;if(reelProgress>=1.0)fishCaught();break;}}
updateFishingLine();if(splashParticles.visible)updateSplash(dt);renderer.render(scene,camera);}

function buildRodPanel(){const p=document.getElementById('rod-panel');p.innerHTML=RODS.map(r=>`<button class="rod-btn ${r.id===selectedRod?'active':''}" data-rod="${r.id}" title="${r.name} Rod (${r.tier})"><span class="rod-icon">${r.emoji}</span><span class="rod-tier">${r.tier}</span></button>`).join('');p.addEventListener('click',e=>{const b=e.target.closest('.rod-btn');if(!b)return;selectedRod=parseInt(b.dataset.rod);p.querySelectorAll('.rod-btn').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.rod)===selectedRod));});}
function buildCharPanel(){const p=document.getElementById('char-panel');p.innerHTML=CHARACTERS.map(c=>`<button class="char-btn ${c.id===selectedChar?'active':''}" data-char="${c.id}" title="${c.name}" style="border-color:${c.color}">${c.emoji}</button>`).join('');p.addEventListener('click',async e=>{const b=e.target.closest('.char-btn');if(!b)return;selectedChar=b.dataset.char;p.querySelectorAll('.char-btn').forEach(b=>b.classList.toggle('active',b.dataset.char===selectedChar));await loadCharacter(selectedChar);});}
function setupControls(){document.getElementById('btn-cast').addEventListener('click',castLine);document.getElementById('btn-reel').addEventListener('click',()=>{if(fishingState==='bite')startReel();else if(fishingState==='reeling')pumpReel();});document.getElementById('btn-cancel').addEventListener('click',cancelFishing);window.addEventListener('click',()=>{if(fishingState==='reeling')pumpReel();});window.addEventListener('keydown',e=>{switch(e.code){case'KeyF':castLine();break;case'KeyR':if(fishingState==='bite')startReel();else if(fishingState==='reeling')pumpReel();break;case'Escape':cancelFishing();break;}});}

async function boot(){initScene();setLoadText('Building island...');createIsland();setLoadText('Creating ocean...');createWater();setLoadText('Placing dock...');await createDock();createBobber();setLoadText('Spawning fish...');await spawnAmbientFish();setLoadText('Loading character...');await loadCharacter(selectedChar);buildRodPanel();buildCharPanel();setupControls();updateHudStats();setState('idle');document.getElementById('loading').classList.add('hidden');animate();}
boot();
