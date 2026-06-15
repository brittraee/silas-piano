const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');

let fail=0; const ok=(c,m)=>{ if(!c){console.log('  ✗ '+m); fail++;} else console.log('  ✓ '+m); };

const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true});
const w=dom.window, d=w.document;

// stub Web Audio so initAudio()/playNote() don't throw in jsdom
const noop=()=>({});
const param=()=>({value:0,setValueAtTime:noop,exponentialRampToValueAtTime:noop});
function FakeCtx(){ this.state='running'; this.currentTime=0; this.destination={}; this.sampleRate=44100; }
FakeCtx.prototype.resume=function(){this.state='running';};
FakeCtx.prototype.createGain=function(){return {gain:param(),connect:noop};};
FakeCtx.prototype.createBiquadFilter=function(){return {type:'',frequency:param(),Q:param(),connect:noop};};
FakeCtx.prototype.createOscillator=function(){return {type:'',frequency:param(),connect:noop,start:noop,stop:noop};};
FakeCtx.prototype.createBuffer=function(_c,n){return {getChannelData:()=>new Float32Array(n||8)};};
FakeCtx.prototype.createBufferSource=function(){return {buffer:null,connect:noop,start:noop,stop:noop};};
w.AudioContext=FakeCtx; w.webkitAudioContext=FakeCtx;

// pointer events: jsdom lacks PointerEvent; map to MouseEvent so listeners fire
if(typeof w.PointerEvent==='undefined') w.PointerEvent=w.MouseEvent;
function tap(el){ el.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,cancelable:true})); }

const API=w.__SILAS;
ok(!!API,'app script ran, test hook present');

// tap a song position 1..8 on whichever instrument is mounted (uses the live posToEl map)
function tapPos(p){ tap(API.posToEl[p]); }

// piano renders behind the gate
ok(d.querySelectorAll('.key').length===8,'8 piano keys rendered');
const pianoSongs=API.SONGS.filter(s=>!s.kal).length;   // kalimba-only songs are hidden on piano
ok(d.querySelectorAll('.song').length===pianoSongs,pianoSongs+' piano song buttons rendered');
ok(API.SONGS.every(s=>s.id!=='ants'),'Ants Go Marching removed from song list');

// press start gate
tap(d.getElementById('goBtn')); d.getElementById('goBtn').click();
ok(d.getElementById('gate').style.display==='none','start gate dismissed');
ok(API.state.mode==='free','starts in free play');

// label toggle cycles
const lb=d.getElementById('labelBtn');
const first=d.querySelector('.key .lab').textContent;
lb.click(); const second=d.querySelector('.key .lab').textContent;
ok(first!==second,'label toggle changes key labels ('+first+'→'+second+')');

// ---------- PIANO follow ----------
const hcb=API.SONGS.find(s=>s.id==='hcb');
API.startSong(hcb);
ok(API.state.mode==='follow' && API.state.idx===0,'Hot Cross Buns loaded, idx 0');
ok(d.querySelector('.key.target')!==null,'a piano target key is glowing');

const firstPos=hcb.notes[0];
const wrongPos=firstPos===5?1:5;
tap(API.posToEl[wrongPos]);
ok(API.state.idx===0,'piano wrong tap does not advance');
// no-fail: wrong tap must not scold and must keep guiding
ok(d.querySelector('.wrong')===null,'piano wrong tap adds no "wrong"/shake class');
ok(API.posToEl[firstPos].classList.contains('target'),'piano target still glows after a wrong tap');

// play the whole song correctly through the DOM
hcb.notes.forEach(p=>tapPos(p));
ok(API.state.idx>=hcb.notes.length || API.state.idx===0,'piano song completed (idx='+API.state.idx+')');
const coachTxt=d.getElementById('coach').textContent.toLowerCase();
ok(coachTxt.includes('done')||coachTxt.includes('again'),'completion message shown: "'+d.getElementById('coach').textContent+'"');

// no-fail: tapping during the celebration window must not be flagged wrong
tapPos(wrongPos);
ok(d.querySelector('.wrong')===null,'tap during celebration is not flagged wrong');

// ---------- KALIMBA follow ----------
API.setView('kalimba');
ok(API.state.view==='kalimba','switched to kalimba view');
ok(d.querySelectorAll('.ktine').length===17,'17 kalimba tines rendered');

const up=API.SONGS.find(s=>s.id==='up');   // Walk Up: 1..8, exercises every song position
API.startSong(up);
ok(API.state.mode==='follow' && API.state.idx===0,'Walk Up loaded on kalimba, idx 0');
ok(d.querySelector('.ktine.target')!==null,'a kalimba target tine is glowing');

// kalimba wrong tap: no advance, no scold, target persists
const kWrong=up.notes[0]===5?1:5;
tap(API.posToEl[kWrong]);
ok(API.state.idx===0,'kalimba wrong tap does not advance');
ok(d.querySelector('.wrong')===null,'kalimba wrong tap adds no "wrong" class');
ok(API.posToEl[up.notes[0]].classList.contains('target'),'kalimba target still glows after a wrong tap');

// play Walk Up through on the kalimba
up.notes.forEach(p=>tapPos(p));
ok(API.state.idx>=up.notes.length || API.state.idx===0,'kalimba song completed (idx='+API.state.idx+')');

// ---------- KALIMBA-RANGE song (Happy Birthday, tine indices not 1..8) ----------
const hbd=API.SONGS.find(s=>s.id==='hbd');
ok(hbd && hbd.kal && Array.isArray(hbd.tines),'Happy Birthday is a kalimba-only (tines) song');
ok(d.querySelector('.song[data-id="hbd"]')!==null,'Happy Birthday shows in the kalimba songbar');
API.startSong(hbd);
ok(API.state.mode==='follow' && API.state.idx===0,'Happy Birthday loaded, idx 0');
ok(d.querySelector('.ktine.target')!==null,'a kalimba target tine glows for a tines-based song');
// wrong tine: no advance, no scold
const firstTine=hbd.tines[0], wrongTine=firstTine===0?1:0;
tap(API.tineToEl[wrongTine]);
ok(API.state.idx===0,'Happy Birthday wrong tine does not advance');
ok(d.querySelector('.wrong')===null,'Happy Birthday wrong tine adds no "wrong" class');
ok(API.tineToEl[firstTine].classList.contains('target'),'Happy Birthday target tine still glows after wrong tap');
// play it through via tine indices
hbd.tines.forEach(i=>tap(API.tineToEl[i]));
ok(API.state.idx>=hbd.tines.length || API.state.idx===0,'Happy Birthday completed via tines (idx='+API.state.idx+')');

// Happy Birthday must NOT appear on piano (only 8 keys = one octave)
API.setView('piano');
ok(d.querySelector('.song[data-id="hbd"]')===null,'Happy Birthday hidden on piano');
ok(API.state.mode==='free','switching to piano during a kalimba-only song drops to free play');

// ---------- DRUMS (free play) ----------
API.setView('drums');
ok(API.state.view==='drums','switched to drums view');
ok(d.querySelectorAll('.pad').length===5,'5 drum pads rendered');
ok(d.getElementById('songbar').style.display==='none','songbar hidden in drums view');
ok(d.getElementById('labelBtn').style.display==='none','label chip hidden in drums view');
let drumThrew=false;
try{ tap(d.querySelector('.pad.mid')); tap(d.querySelector('.pad.cym')); }catch(e){ drumThrew=true; }
ok(!drumThrew,'tapping drum pads does not throw');
ok(API.state.mode==='free','drums are free-play (no follow mode)');
API.setView('piano');   // restore for the free-play check below

// ---------- back to free ----------
d.getElementById('freeBtn').click();
ok(API.state.mode==='free','free button returns to free play');

console.log('\n'+(fail===0?'DOM E2E ALL PASS ✅':(fail+' FAILED ❌')));
process.exit(fail?1:0);
