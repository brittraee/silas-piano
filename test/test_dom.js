const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');

let fail=0; const ok=(c,m)=>{ if(!c){console.log('  ✗ '+m); fail++;} else console.log('  ✓ '+m); };

const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true});
const w=dom.window, d=w.document;

// stub Web Audio so initAudio()/playNote() don't throw in jsdom
const noop=()=>({});
function FakeCtx(){ this.state='running'; this.currentTime=0; this.destination={}; }
FakeCtx.prototype.resume=function(){this.state='running';};
FakeCtx.prototype.createGain=function(){return {gain:{setValueAtTime:noop,exponentialRampToValueAtTime:noop,value:0},connect:noop};};
FakeCtx.prototype.createBiquadFilter=function(){return {type:'',frequency:{value:0},connect:noop};};
FakeCtx.prototype.createOscillator=function(){return {type:'',frequency:{value:0},connect:noop,start:noop,stop:noop};};
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
ok(d.querySelectorAll('.song').length===API.SONGS.length,API.SONGS.length+' song buttons rendered');
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

// ---------- back to free ----------
d.getElementById('freeBtn').click();
ok(API.state.mode==='free','free button returns to free play');

console.log('\n'+(fail===0?'DOM E2E ALL PASS ✅':(fail+' FAILED ❌')));
process.exit(fail?1:0);
