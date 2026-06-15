const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');

// pull the NOTES and SONGS literals straight out of the file
function grab(name){
  const m = html.match(new RegExp('const '+name+'\\s*=\\s*(\\[[\\s\\S]*?\\n\\];)'));
  if(!m) throw new Error('could not find '+name);
  return eval(m[1].replace(/;$/,''));
}
const NOTES = grab('NOTES');
const SONGS = grab('SONGS');

let fail=0;
const ok=(c,m)=>{ if(!c){console.log('  ✗ '+m); fail++;} else console.log('  ✓ '+m); };

console.log('NOTES table:');
ok(NOTES.length===9 && NOTES[0]===null, '9 slots, index 0 is null (1-based)');
for(let p=1;p<=8;p++) ok(NOTES[p]&&typeof NOTES[p].f==='number', 'pos '+p+' = '+NOTES[p].n+' '+NOTES[p].f+'Hz');

console.log('\nSongs: '+SONGS.length+' loaded');
for(const s of SONGS){
  const bad = s.notes.filter(n=>!Number.isInteger(n)||n<1||n>8);
  ok(bad.length===0, s.name+' ('+s.notes.length+' notes) all in range 1..8'+(s.beta?'  [beta]':''));
}

// ---- simulate the exact follow-mode reducer from the app ----
function reducer(){
  return {
    idx:0, done:false,
    tap(pos){
      if(this.done) return;
      if(pos===this.song.notes[this.idx]){ this.idx++; if(this.idx>=this.song.notes.length) this.done=true; }
      // wrong note: no-op (matches app: plays sound, no advance)
    },
    load(s){ this.song=s; this.idx=0; this.done=false; }
  };
}

console.log('\nEnd-to-end follow simulation:');
for(const s of SONGS){
  const r=reducer(); r.load(s);
  // play perfect sequence
  s.notes.forEach(n=>r.tap(n));
  ok(r.done && r.idx===s.notes.length, s.name+': perfect play completes ('+r.idx+'/'+s.notes.length+')');
}

// wrong notes must not advance
console.log('\nWrong-note handling:');
{
  const s=SONGS.find(x=>x.id==='hcb'); const r=reducer(); r.load(s);
  const wrong = s.notes[0]===5?1:5;
  r.tap(wrong); ok(r.idx===0,'wrong first tap does not advance');
  r.tap(s.notes[0]); ok(r.idx===1,'correct tap then advances');
  r.tap(wrong); ok(r.idx===1,'mid-song wrong tap holds position');
  r.tap(s.notes[1]); ok(r.idx===2,'recovers and continues');
}

console.log('\n'+(fail===0?'ALL PASS ✅':(fail+' FAILED ❌')));
process.exit(fail?1:0);
