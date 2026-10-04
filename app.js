const STORAGE_KEY='kbos-gate-assignments-v1';
const PARKING={
 'DAL':{name:'Delta',pool:'A',range:[1,22]},
 'ACA':{name:'Air Canada / Jazz / PVL',pool:'B',gates:['B1','B2','B3']}, 'JZA':{name:'Air Canada / Jazz / PVL',pool:'B',gates:['B1','B2','B3']}, 'PVL':{name:'Air Canada / Jazz / PVL',pool:'B',gates:['B1','B2','B3']},
 'AAL':{name:'American Airlines',pool:'B',range:[4,22]}, 'BAW':{name:'American Airlines',pool:'B',range:[4,22]},
 'RPA':{name:'Republic Airways',pool:'RPA'},
 'BTQ':{name:'Boutique Air',pool:'B',gates:['B37']}, 'SWA':{name:'Southwest',pool:'B',special:true},
 'UAL':{name:'United',pool:'B',range:[23,31]},
 'EIN':{name:'Aer Lingus',pool:'C',gates:['C20','C21']}, 'KAP':{name:'Cape Air',pool:'C',gates:['C27']},
 'ETD':{name:'Etihad Airways',pool:'C',gates:['C17']}, 'JBU':{name:'JetBlue',pool:'C',range:[8,36]}, 'TAP':{name:'TAP Air Portugal',pool:'C',gates:['C17','C20']}
};
const international=new Set(['ACA','BAW','DLH','AFR','KLM','SWR','ICE','AZA','IBE','VIR','QTR','UAE','EVA','ANA','JAL','TAP','EIN','ETD','SIA','THA','KAL','CPA','ARG','AVIANCA','LATAM']);
const $=id=>document.getElementById(id); let assignments=load();
function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}}catch{return{}}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(assignments));}
function prefix(cs){return cs.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3)}
function expandRange(range){const [a,b]=range; return Array.from({length:b-a+1},(_,i)=>a+i);}
function poolFor(cs,type){const p=prefix(cs), rule=PARKING[p]; if(rule){if(p==='RPA'){return poolForRepublic(cs,type)} if(rule.gates)return rule.gates.slice(); if(rule.special&&p==='SWA')return ['B31A','B31B','B32','B33','B34','B35']; if(rule.pool==='A')return expandRange(rule.range).map(n=>'A'+n); if(rule.pool==='B')return expandRange(rule.range).map(n=>'B'+n); if(rule.pool==='C')return expandRange(rule.range).map(n=>'C'+n)} if(type==='arrival'&&international.has(p))return ['E']; return []}
function poolForRepublic(cs,type){const m=cs.toUpperCase().replace(/[^A-Z0-9]/g,''); if(/^RPA3\d{3}$/.test(m))return expandRange([23,31]).map(n=>'B'+n); if(/^RPA4\d{3}$/.test(m))return expandRange([4,22]).map(n=>'B'+n); if(/^RPA5\d{3}$/.test(m))return expandRange([1,22]).map(n=>'A'+n); return []}
function areaFor(cs,type){const p=prefix(cs),r=PARKING[p]; if(p==='RPA'){const m=cs.toUpperCase().replace(/[^A-Z0-9]/g,''); if(/^RPA3\d{3}$/.test(m))return 'Republic Airways — United'; if(/^RPA4\d{3}$/.test(m))return 'Republic Airways — American'; if(/^RPA5\d{3}$/.test(m))return 'Republic Airways — Delta'; return 'Republic Airways — airline assignment unknown'} if(r)return r.name; if(type==='arrival'&&international.has(p))return 'International — Terminal E'; return 'Unlisted airline / use appropriate terminal-area fallback'}
function occupied(){return new Set(Object.values(assignments).map(x=>x.gate))}
function chooseFallback(cs,type){const pool=poolFor(cs,type), used=occupied(); const available=pool.filter(g=>!used.has(g)); if(!available.length)return null; return available[Math.floor(Math.random()*available.length)]}
function assign(cs,type,manual,real){cs=cs.toUpperCase().trim(); if(!cs)return null; if(assignments[cs]&&!manual&&!real)return {...assignments[cs],existing:true};
 let gate=(manual||real||'').toUpperCase().trim(), source=manual?'Manual override':real?'Real-world':'BVA SOP fallback';
 if(gate && Object.values(assignments).some(x=>x.gate===gate&&x.callsign!==cs)) throw new Error(`Gate ${gate} is already assigned.`);
 if(!gate){gate=chooseFallback(cs,type); if(!gate)throw new Error('No unused gate is available in the appropriate BVA parking pool.');}
 assignments[cs]={callsign:cs,gate,source,area:areaFor(cs,type),type,updated:new Date().toISOString()}; save(); render(); return assignments[cs];
}
function render(){const rows=Object.values(assignments).sort((a,b)=>a.callsign.localeCompare(b.callsign)); $('count').textContent=rows.length; const el=$('assignments'); el.classList.toggle('empty',!rows.length); el.innerHTML=rows.length?rows.map(x=>`<div class="assignment"><div class="gate">${esc(x.gate)}</div><div><div class="callsign">${esc(x.callsign)}</div><div class="sub">${esc(x.area)} · ${esc(x.source)}</div></div><button data-release="${esc(x.callsign)}">Release</button></div>`).join(''):'No active gate assignments.'}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
$('assignForm').addEventListener('submit',e=>{e.preventDefault(); const cs=$('callsign').value,type=$('flightType').value,real=$('realGate').value,manual=$('manualGate').value; try{const x=assign(cs,type,manual,real); showResult(x)}catch(err){showResult({error:err.message})}});
function showResult(x){const r=$('result');r.classList.remove('hidden','good'); if(x.error){r.innerHTML=`<strong>Assignment not made</strong><div class="meta">${esc(x.error)}</div>`;return} r.classList.add('good');r.innerHTML=`<div class="label">${esc(x.source)}</div><div class="gate">${esc(x.gate)}</div><div><strong>${esc(x.callsign)}</strong> · ${esc(x.area)}</div>`}
$('assignments').addEventListener('click',e=>{const cs=e.target.dataset.release;if(!cs)return;delete assignments[cs];save();render()});
$('clearBtn').onclick=()=>{if(confirm('Clear all active gate assignments?')){assignments={};save();render();$('result').classList.add('hidden')}};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(assignments,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kbos-gates-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
$('rules').innerHTML=`<div class="rule"><strong>Delta</strong><span>A1–A22</span></div><div class="rule"><strong>American</strong><span>B4–B22</span></div><div class="rule"><strong>United</strong><span>B23–B31</span></div><div class="rule"><strong>Southwest</strong><span>B31A–B35</span></div><div class="rule"><strong>JetBlue</strong><span>C8–C36</span></div><div class="rule"><strong>Air Canada / Jazz / PVL</strong><span>B1–B3</span></div><div class="rule"><strong>International arrivals</strong><span>Terminal E</span></div><div class="rule"><strong>General aviation</strong><span>Signature</span></div>`;
render();
