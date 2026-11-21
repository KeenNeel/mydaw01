/* MyDAW のサンプル曲（本体の「開く」から読み込まれる）*/
/* =====================================================================
   サンプル曲（「開く」→ サンプル曲 から読み込む）
   各曲: コード・メロディ・演奏パターン・音色・エフェクト・マスター・パン/音量・テンポ・キー・スウィングまで作り込み
   聴きどころ（転調・ブレイク・キメ・偽終止・カデンツァ など）を各曲に入れている
   ===================================================================== */
const SMP_NOTE={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
let smpSeed=7;
const smpR=()=>{smpSeed=(smpSeed*16807)%2147483647;return smpSeed/2147483647};
const smpH=(v,sp)=>v+(smpR()-.5)*(sp??8);
function smpPitch(s){const m=/^([A-G])([#b]?)(-?\d)$/.exec(s);if(!m)throw new Error('音名: '+s);return 12*(+m[3]+1)+SMP_NOTE[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)}
/* "C5:1 r:.5 >E5:.5 ~G5:2 C4+E4:1" → 音符列（> アクセント / ~ 次の音までつなぐ / + 和音） */
function smpMel(str,q0,o={}){
 const out=[];let q=q0;const leg=o.leg??.9,v0=o.v??80,tr=o.tr||0;
 for(let tk of String(str).split(/\s+/)){
  if(!tk||tk==='|')continue;
  let acc=0,full=false;
  while(/^[>~]/.test(tk)){if(tk[0]==='>')acc+=12;else full=true;tk=tk.slice(1)}
  const i=tk.lastIndexOf(':'),nm=tk.slice(0,i),l=+tk.slice(i+1);
  if(!(l>0))throw new Error('長さ: '+tk);
  if(nm!=='r')for(const p of nm.split('+').map(smpPitch))out.push({p:p+tr,q,l:full?l:Math.max(.08,l*leg-(l>=1?.03:0)),v:v0+acc});
  q+=l;
 }
 out.end=q;return out;
}
function smpPhrases(list,q0,o){const groups=[];let q=q0;for(const s of list){const m=smpMel(s,q,o);groups.push(m);q=m.end}return{notes:groups.flat(),groups,end:q}}
/* 歌詞: フレーズごとに1音1モーラ（ずれたら SMP_LYR に記録）*/
const SMP_LYR={};
function smpLyr(groups,lines,tag){
 let miss=0;groups.forEach((g,i)=>{const m=lyrMorae(lines[i]||'');miss+=Math.abs(m.length-g.length);g.forEach((n,j)=>{if(j<m.length)n.lyr=m[j]})});
 SMP_LYR[tag]=miss;return miss;
}
/* ダイアトニックのハモリ（steps=2 で3度上）*/
function smpHarm(L,root,mode,steps){
 const sc=mode==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
 return L.map(n=>{const rel=n.p-root,oct=Math.floor(rel/12),pc=((rel%12)+12)%12;let i=6;while(i>0&&sc[i]>pc)i--;
  const up=i+steps;return{...n,p:root+12*(oct+Math.floor(up/7))+sc[up%7]+(pc-sc[i]),v:n.v-10}});
}
/* コード進行テキストを移調 */
const SMP_FLAT=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
function smpTrProg(text,k){return String(text).replace(/(^|[\s|\/])([A-G][#b]?)/g,(m,pre,r)=>pre+SMP_FLAT[((parsePC(r)+k)%12+12)%12])}
const smpClipNotes=(L,start)=>L.map(n=>{const x={id:uid('n'),p:n.p,s:+(n.q-start).toFixed(6),l:+(+n.l).toFixed(6),v:Math.max(1,Math.min(127,Math.round(n.v)))};if(n.lyr)x.lyr=n.lyr;return x});
const smpN=(L,p,q,l,v)=>L.push({p,q,l,v});
const smpIv=ch=>(CHORD_Q[ch.q]||CHORD_Q.maj).iv;
const smpBassPc=ch=>(((ch.bass!=null?ch.bass:ch.root)%12)+12)%12;
const smpLow=(pc,lo)=>lo+(((pc-lo)%12)+12)%12;
/* lo 以上に密集配置した和音（n 音・noRoot でルート抜き）*/
function smpVoice(ch,lo,n,noRoot){
 let iv=smpIv(ch);if(noRoot&&iv.length>3)iv=iv.slice(1);
 let ps=[...new Set(iv.map(i=>smpLow(ch.root+i,lo)))].sort((a,b)=>a-b);
 const base=ps.slice();let k=0;while(n&&ps.length<n){ps.push(base[k%base.length]+12*(1+Math.floor(k/base.length)));k++}
 return n?ps.slice(0,n):ps;
}
/* 人間らしい揺れ: タイミング（四分音符単位）と強さ */
function smpHum(L,t,v){for(const n of L){n.q=Math.max(0,n.q+(smpR()-.5)*2*t);n.v=n.v+(smpR()-.5)*2*v}}
function smpTrack(type,o){
 const t=newTrack(type);t.name=o.name;if(o.tone)t.tone=o.tone;t.vol=o.vol??-8;t.pan=o.pan||0;
 t.color=TRACK_COLORS[(o.ci||0)%TRACK_COLORS.length];
 t.fx=(o.fx||[]).map(f=>Array.isArray(f)?smpFx(f[0],f[1]):smpFx(f));
 const L=o.notes||[];
 if(o.hum!==false&&L.length){const h=o.hum||(type==='drum'?[.004,3]:[.007,4]);smpHum(L,h[0],h[1])}
 if(L.length){const endQ=S.sections.reduce((a,x)=>a+x.bars,0)*qpbar();for(const n of L)if(n.q+n.l>endQ)n.l=Math.max(.05,endQ-n.q);}
 if(L.length){const s=o.start??Math.floor(Math.min(...L.map(n=>n.q))/qpbar())*qpbar(),e=o.end??Math.ceil(Math.max(...L.map(n=>n.q+n.l))/qpbar()-1e-6)*qpbar();
  t.clips.push({id:uid('c'),start:s,len:e-s,name:o.clip||o.name,notes:smpClipNotes(L,s)})}
 return t;
}
function smpMaster(list,vol){S.master.fx=list.map(f=>smpFx(f[0],f[1]));S.master.lim=true;S.master.limV=2;S.master.vol=vol||0}
/* 曲の骨組み（名前・テンポ・キー・区間・ガイドのコード）*/
function smpBegin(o){
 smpSeed=o.seed||7;
 S.name=o.name;S.sig=o.sig||{n:4,d:4};S.bpm=o.bpm;S.tempo=[{q:0,bpm:o.bpm}];S.key={root:o.key[0],mode:o.key[1]};S.swing=o.swing||50;
 S.sections=o.secs.map(([name,bars,ci])=>({id:uid('s'),name,bars,color:SEC_COLORS[ci%SEC_COLORS.length]}));ensureBars();
 const B=qpbar(),len=o.secs.reduce((a,x)=>a+x[1],0)*B,sec={};let acc=0;
 o.secs.forEach(([nm,bars])=>{sec[nm]={q0:acc,bars,q1:acc+bars*B};acc+=bars*B});
 const g=newTrack('chord');g.name='コード';g.guide=true;g.mute=true;g.color=TRACK_COLORS[5];
 const r=barTextToChords(o.prog);if(r.errs.length)console.warn('サンプル曲のコード',r.errs);
 g.clips.push({id:uid('c'),start:0,len,name:'コード進行',chords:r.chords});
 const CH=guideChords(g);
 const chAt=q=>{const c=CH.find(c=>q>=c.a-1e-6&&q<c.b-1e-6);return c?c.ch:CH[CH.length-1].ch};
 const same=(a,b)=>a.root===b.root&&a.q===b.q&&a.bass===b.bass;
 const inS=(q,...names)=>names.some(nm=>sec[nm]&&q>=sec[nm].q0-1e-6&&q<sec[nm].q1-1e-6);
 return{B,len,sec,g,CH,chAt,same,inS,bars:len/B,progLen:r.len};
}
function smpTempo(L){L.sort((a,b)=>a.q-b.q);const out=[];for(const p of L){const last=out[out.length-1];if(last&&Math.abs(last.q-p.q)<1e-6)last.bpm=p.bpm;else out.push({q:+p.q.toFixed(6),bpm:Math.round(p.bpm*10)/10})}out[0].q=0;S.tempo=out;S.bpm=out[0].bpm}
function smpRamp(L,qa,qb,from,to,step){step=step||1;const n=Math.max(1,Math.round((qb-qa)/step));for(let k=0;k<n;k++)L.push({q:qa+k*(qb-qa)/n,bpm:from+(to-from)*(k+1)/n})}
function smpFinish(tracks,lyrT,sel,o={}){
 if(lyrT){lyrT.smpVocal=true;if(o.dry)lyrT.smpVocalDry=true}
 const au=newTrack('audio');au.name='Audio 1';au.color=TRACK_COLORS[6];
 S.tracks=[...tracks,au];S.lyrTrack=lyrT?lyrT.id:null;S.sel=(sel||lyrT||tracks[1]).id;
 setTimeout(()=>{try{syncTop()}catch(e){}try{instPreload(S.tracks)}catch(e){}},50);
}
/* ギターアンプ代わり: クリーンのギターに EQ → ディストーション → キャビネット風の EQ・ローパス */
const SMPAMP=(drive,o={})=>[['eq',{hp:o.hp??110,low:-2,mid:o.mid??3,midf:o.midf??800,high:o.pre??1}],['dist',{drive,tone:o.tone??3600,mix:1,out:o.out??.5}],['eq',{hp:80,low:o.low??1.5,mid:-2.5,midf:420,high:-2}],['filter',{type:0,freq:o.cab??5200,q:.7}]];
/* よく使うエフェクトの組み合わせ */
const SMPFX={
 hall:(mix,decay)=>['reverb',{mix:mix??.28,decay:decay??2.8,pre:.03,tone:7500}],
 plate:(mix,decay)=>['reverb',{mix:mix??.22,decay:decay??1.8,pre:.012,tone:10000}],
 room:(mix)=>['reverb',{mix:mix??.16,decay:1.1,pre:.006,tone:7000}],
 glue:(thr,ratio,gain)=>['rcomp',{thr:thr??-20,ratio:ratio??2.5,att:.012,rel:.2,gain:gain??1}],
 warmEq:(hp)=>['eq',{hp:hp??60,low:.5,mid:-1.5,midf:350,high:1.5}]
};

/* =====================================================================
   1. しっとりトリオ（フルート＋ナイロンギター＋ウッドベース＋ドラム）
   F → G に転調・フルートだけが走るストップタイム・最後は 9th の和音でフェルマータ
   ===================================================================== */
function sampleTrio(){
 const C=smpBegin({name:'夕凪のテラス（フルート・トリオ）',bpm:76,swing:60,key:[5,'major'],seed:11,
  secs:[['イントロ',4,0],['A',8,1],['B',8,4],['ブレイク',2,6],["A'（転調）",8,2],['エンディング',4,5]],
  prog:'| Bbmaj7 | Am7 | Gm7 | C7sus4 C7 |'+
   ' Fmaj7 | Am7 | Bbmaj7 | C7sus4 C7 | Fmaj7 | Dm7 | Gm7 | C7 |'+
   ' Bbmaj7 | Am7 | Gm7 | Fmaj7 | Bbmaj7 | A7 | Dm7 G7 | Gm7 C7 |'+
   ' Gm7 C7 | Am7 D7 |'+
   ' Gmaj7 | Bm7 | Cmaj7 | D7sus4 D7 | Gmaj7 | Em7 | Am7 | D7 |'+
   ' Cmaj7 | D7sus4 | Gmaj7 | Gmaj9 |'});
 const {B,sec,chAt,same,inS}=C,SA="A'（転調）";
 /* テンポ: ブレイクで少し溜め、エンディングで大きくリタルダンド */
 const T=[{q:0,bpm:76}];smpRamp(T,sec['ブレイク'].q0,sec['ブレイク'].q1,76,68,1);T.push({q:sec[SA].q0,bpm:76});
 smpRamp(T,sec['エンディング'].q0+2*B,sec['エンディング'].q1,76,46,1);smpTempo(T);
 /* フルート */
 const A=['r:1 A4:.5 C5:.5 E5:1.5 D5:.5','C5:3 r:.5 A4:.5','D5:.5 F5:.5 A5:1.5 G5:.5 F5:1','G5:2 F5:.5 E5:1.5',
          'r:.5 A4:.5 C5:.5 F5:.5 E5:1 C5:1','D5:2.5 F5:.5 A5:1','G5:1.5 F5:.5 D5:1 Bb4:1'];
 const Bm=['F5:1 Bb5:1.5 A5:.5 F5:1','E5:1.5 G5:.5 C5:2','D5:1 F5:1.5 E5:.5 D5:1','C5:3 r:.5 C5:.5',
           'D5:.5 F5:.5 A5:1 C6:1.5 Bb5:.5','A5:1.5 G5:.5 E5:1 C#5:1','D5:1.5 F5:.5 B4:1 D5:1','Bb4:1 A4:.5 G4:.5 E5:2'];
 const RUN=['G4:.25 Bb4:.25 D5:.25 F5:.25 A5:.5 G5:.5 E5:.25 G5:.25 Bb5:.25 C6:.25 ~D6:1','C6:.25 B5:.25 A5:.25 G5:.25 E5:.5 C5:.5 D5:.25 F#5:.25 A5:.25 C6:.25 ~B5:1'];
 const fo={leg:.97,v:76};
 const fl=[...smpPhrases([...A,'C5:3 r:1'],sec.A.q0,fo).notes,...smpPhrases(Bm,sec.B.q0,{...fo,v:82}).notes,
  ...smpPhrases(RUN,sec['ブレイク'].q0,{leg:1,v:84}).notes,
  ...smpPhrases([...A,'C5:1 D5:.5 E5:.5 G5:2'],sec[SA].q0,{...fo,v:84,tr:2}).notes,
  ...smpPhrases(['B5:1.5 A5:.5 G5:2','A5:3 G5:.5 F#5:.5','~G5:4','r:.5 B5:.5 ~A5:3'],sec['エンディング'].q0,{...fo,v:74}).notes];
 fl.forEach(n=>{n.v=smpH(n.v+(n.l>=1.5?5:0)+(n.p>=81?5:0)-(n.l<=.25?6:0),5)});
 /* ナイロンギター: 指弾きのアルペジオ（2拍ごとに 低音→和音の3音・よく響かせる）*/
 const gt=[];
 for(let b=0;b<C.bars;b++){const s=b*B;
  if(inS(s,'ブレイク')){const hits=b===sec['ブレイク'].q0/B?[0]:[0,2];for(const o of hits){const ch=chAt(s+o);[smpLow(smpBassPc(ch),40),...smpVoice(ch,55,4)].forEach((p,i)=>smpN(gt,p,s+o+i*.04,o?1.8:1.6,smpH(62,4)))}continue}
  if(b===C.bars-1){const ch=chAt(s),v=smpVoice(ch,59,5);[smpLow(smpBassPc(ch),40),smpLow(smpBassPc(ch),40)+7,...v].forEach((p,i)=>smpN(gt,p,s+i*.11,4-i*.11,smpH(58-i,3)));continue}
  for(let h=0;h<2;h++){const q=s+h*2,ch=chAt(q),v=smpVoice(ch,55,4),bs=smpLow(smpBassPc(ch),40);
   smpN(gt,bs,q,2,smpH(b<2?56:62,4));
   [v[1],v[2],v[3]].forEach((p,i)=>smpN(gt,p,q+.5+i*.5,1.55-i*.5,smpH(46+(i===1?4:0),5)));
   if(h===1&&b%4===3)smpN(gt,v[0]+12,q+1.75,.3,smpH(40,4));
  }
 }
 /* ウッドベース: A は2ビート、B と A' はウォーキング */
 const bs=[],low=pc=>smpLow(pc,31);
 const walkBar=s=>{for(let k=0;k<4;k++){const q=s+k,ch=chAt(q),nx=chAt(q+1),start=k===0||!same(chAt(q-1),ch),chg=!same(nx,ch);
  let p;if(start)p=low(smpBassPc(ch));else if(chg){const t=low(smpBassPc(nx));p=k%2?t-1:t+2}else{const iv=smpIv(ch);p=low(ch.root%12)+(k===1?iv[1]:iv[2])}
  smpN(bs,p,q,.92,smpH(start?84:74,5))}};
 for(let b=2;b<C.bars;b++){const s=b*B,ch=chAt(s);
  if(b<4){smpN(bs,low(smpBassPc(ch)),s,b===3?1.9:3.8,72);if(b===3)smpN(bs,low(smpBassPc(chAt(s+2))),s+2,1.9,70);continue}
  if(inS(s,'ブレイク')){const hits=b===sec['ブレイク'].q0/B?[0]:[0,2];for(const o of hits)smpN(bs,low(smpBassPc(chAt(s+o))),s+o,o?1.8:1.5,80);continue}
  if(b===C.bars-1){smpN(bs,low(smpBassPc(ch))-12+12,s,4,72);continue}
  if(inS(s,'B',SA)||inS(s,'エンディング')&&b<C.bars-2){walkBar(s);continue}
  const c2=chAt(s+2);smpN(bs,low(smpBassPc(ch)),s,1.85,smpH(82,5));
  smpN(bs,same(c2,ch)?low(ch.root%12)+smpIv(ch)[2]:low(smpBassPc(c2)),s+2,1.6,smpH(72,5));
  if(b%2)smpN(bs,low(smpBassPc(chAt(s+4)))-1,s+3.5,.45,60);
 }
 /* ドラム（生ドラム: ライドのレガート＋ペダルハット＋キックのフェザー）*/
 const dr=[],rim=[];
 for(let b=2;b<C.bars;b++){const s=b*B;
  if(b<4){[0,1,2,3].forEach(k=>smpN(dr,51,s+k,.5,smpH(28+b*4,4)));continue}
  if(inS(s,'ブレイク')){if(b===sec['ブレイク'].q0/B)smpN(dr,49,s,3,58),smpN(dr,36,s,.5,52);else{smpN(dr,36,s,.5,46);smpN(dr,51,s+2,.5,44);for(let i=0;i<6;i++)smpN(dr,38,s+3+i/6,.16,24+i*6)}continue}
  if(b===C.bars-1){smpN(dr,51,s,4,48);smpN(dr,49,s,4,40);smpN(dr,36,s,.5,40);continue}
  const loud=inS(s,'B',SA),base=loud?50:42;
  [[0,1],[1,.9],[1.5,.6],[2,1],[3,.9],[3.5,.6]].forEach(([o,m])=>smpN(dr,51,s+o,.5,smpH(base*m+(o%2===1?6:0),4)));
  smpN(dr,44,s+1,.5,smpH(34,3));smpN(dr,44,s+3,.5,smpH(36,3));
  smpN(dr,36,s,.5,smpH(32,3));smpN(dr,36,s+2,.5,smpH(24,3));
  smpN(rim,37,s+3,.4,smpH(loud?58:48,4));if(loud&&b%2)smpN(rim,37,s+2.5,.4,smpH(36,4));
  if(s===sec[SA].q0)smpN(dr,49,s,3,64);
 }
 /* A' で ストリングスがそっと入る */
 const st=[];for(let b=sec[SA].q0/B;b<C.bars;b++){const s=b*B;smpVoice(chAt(s),55,4,true).forEach(p=>smpN(st,p,s,B*.99,smpH(b===sec[SA].q0/B?40:50,3)))}
 const tFl=smpTrack('midi',{name:'フルート',tone:'tj_flute',vol:-5,pan:.06,ci:3,fx:[['eq',{hp:180,low:0,mid:-1,midf:900,high:1.5}],SMPFX.glue(-22,2,1),['delay',{time:.75,fb:.2,mix:.09,tone:3500}],SMPFX.hall(.28,2.8)],notes:fl,clip:'メロディ（フルート）'});
 const tGt=smpTrack('midi',{name:'ナイロンギター',tone:'waf_nylon',vol:-9,pan:-.3,ci:4,fx:[SMPFX.warmEq(70),SMPFX.glue(-20,2,1),['chorus',{mix:.14,rate:.3,depth:.25}],SMPFX.hall(.22,2.4)],notes:gt,start:0,clip:'指弾きアルペジオ'});
 const tBs=smpTrack('midi',{name:'ウッドベース',tone:'waf_ac_bass',vol:-6,pan:.1,ci:2,fx:[['eq',{hp:35,low:1.5,mid:-1,midf:450,high:.5}],SMPFX.glue(-20,3,1),SMPFX.room(.1)],notes:bs,clip:'2ビート／ウォーキング'});
 const tDr=smpTrack('drum',{name:'ドラム',tone:'kit_vd',vol:-13,pan:0,ci:1,fx:[['eq',{hp:40,low:-1,mid:-1,midf:600,high:1}],SMPFX.hall(.22,1.9)],notes:dr,clip:'ジャズ・レガート'});
 const tRim=smpTrack('drum',{name:'クロススティック',tone:'kit_wd_FluidR3_GM_sf2_file',vol:-19,pan:-.12,ci:1,fx:[SMPFX.hall(.25,1.8)],notes:rim,clip:'4拍目'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_slow_strings',vol:-18,pan:.28,ci:5,fx:[SMPFX.hall(.38,3.2)],notes:st,clip:"A' から"});
 smpMaster([['eq',{hp:25,low:.5,mid:0,midf:1000,high:1.5}],['rcomp',{thr:-18,ratio:1.8,att:.03,rel:.3,gain:1}],['reverb',{mix:.07,decay:2.4,pre:.02,tone:8000}],['limiter',{thr:-1.2,gain:1}]],7.5);
 smpFinish([C.g,tDr,tRim,tBs,tGt,tSt,tFl],null,tFl);
}

/* =====================================================================
   2. ハードロック（テンポが加速／減速する疾走リフ）
   キメ → ラストサビで E マイナー → F# マイナーに転調、ツイン・リードのハモリ
   ===================================================================== */
function sampleRock(){
 const RF=' Em | Em | Em | Em:2 D:.5 C:.5 B:1 |';
 const C=smpBegin({name:'レッドライン・ランナー（ハードロック）',bpm:138,swing:50,key:[4,'minor'],seed:23,
  secs:[['イントロ',4,0],['リフ',8,1],['加速',4,3],['サビ',8,4],['スロー',4,5],['再加速',4,3],['キメ',2,6],['ラストサビ（転調）',8,4],['エンディング',2,6]],
  prog:'|'+RF+RF+RF+' C | D | C | B7 | Em | C | G | D | Em | C | D | D | Am | C | Em | B7 |'+RF+' C:2 D:2 | C#7 | F#m | D | A | E | F#m | D | E | C#7 | F#m | F#m |'});
 const {B,sec,chAt}=C,LS='ラストサビ（転調）';
 const T=[{q:0,bpm:138}];
 smpRamp(T,sec['加速'].q0,sec['加速'].q1,138,168);
 smpRamp(T,sec['サビ'].q1-B,sec['サビ'].q1,168,150);
 T.push({q:sec['スロー'].q0,bpm:100});
 smpRamp(T,sec['再加速'].q0,sec['再加速'].q1,100,176);
 smpRamp(T,sec['エンディング'].q0,sec['エンディング'].q1,176,104);
 smpTempo(T);
 const RIFF1='E2:.5 E2:.25 E2:.25 G2:.5 E2:.5 A2:.5 E2:.25 E2:.25 Bb2:.25 A2:.25 G2:.5';
 const RIFF2='E2:.5 E2:.25 E2:.25 G2:.5 E2:.5 D3:.5 C3:.5 B2:1';
 const roots=[];
 const riff=(q0,bars)=>{for(let b=0;b<bars;b++)roots.push(...smpMel(b%4===3?RIFF2:RIFF1,q0+b*B,{leg:.92,v:100}))};
 const chug=(q0,bars,acc)=>{for(let b=0;b<bars;b++){const s=q0+b*B;for(let i=0;i<8;i++){const q=s+i/2,r=smpLow(smpBassPc(chAt(q)),40);roots.push({p:r,q,l:i%2?.22:.45,v:(acc&&acc.includes(i))?112:90})}}};
 riff(sec['イントロ'].q0,4);riff(sec['リフ'].q0,8);chug(sec['加速'].q0,4,[0,3,6]);chug(sec['サビ'].q0,8,[0,3,6]);
 for(let b=0;b<4;b++){const s=sec['スロー'].q0+b*B;roots.push({p:smpLow(smpBassPc(chAt(s)),40),q:s,l:3.9,v:96})}
 riff(sec['再加速'].q0,4);
 /* キメ: 全員でユニゾンのブレイク → C#7 を伸ばして転調 */
 {const s=sec['キメ'].q0;[0,.75,1.5,2,2.75,3.5].forEach(o=>roots.push({p:smpLow(smpBassPc(chAt(s+o)),40),q:s+o,l:o===3.5?.45:.3,v:118}));roots.push({p:49,q:s+B,l:3.9,v:120})}
 chug(sec[LS].q0,8,[0,2,3,6]);
 roots.push({p:42,q:sec['エンディング'].q0,l:3.9,v:118},{p:42,q:sec['エンディング'].q0+B,l:3.6,v:124});
 const power=(L,dt)=>L.flatMap(n=>{const pm=(n.p===40||n.p===42)&&n.l<=.3&&!n.kime;const l=pm?.18:n.l,v=pm?n.v-14:n.v;return[n.p,n.p+7,n.p+12].map((p,i)=>({p,q:n.q+(dt||0)+i*.004,l,v:smpH(v-(i?6:0),5)}))});
 const gL=power(roots,0),gR=power(roots,.012);
 const CHO=['E4:1 G4:.5 A4:.5 B4:1.5 A4:.5','G4:1.5 E4:.5 G4:1 A4:1','B4:1 D5:1.5 B4:.5 A4:1','A4:2 F#4:1 D4:1',
            'E4:.5 G4:.5 B4:.5 E5:1.5 D5:.5 B4:.5','C5:1.5 B4:.5 G4:1 E4:1','F#4:1 A4:1 D5:1 C5:.5 A4:.5'];
 const ldLast=smpPhrases([...CHO,'B4:2 A4:.5 F#4:.5 D#4:1'],sec[LS].q0,{leg:.97,v:108,tr:2}).notes;
 const ld=[...smpPhrases(['E4:1 G4:1 C5:1 E5:1','D5:1 F#4:1 A4:1 D5:1','E5:1 G5:1 C6:1 B5:1','B5:2 A5:1 F#5:1'],sec['加速'].q0,{leg:.96,v:92}).notes,
  ...smpPhrases([...CHO,'B4:3 r:1'],sec['サビ'].q0,{leg:.97,v:100}).notes,
  ...smpPhrases(['E5:2 C5:1 A4:1','G4:1.5 C5:.5 E5:2','B4:3 G4:1','F#4:2 D#5:2'],sec['スロー'].q0,{leg:.99,v:96}).notes,
  ...smpPhrases(['E5:.5 E5:.25 E5:.25 G5:.5 E5:.5 A5:.5 E5:.25 E5:.25 Bb5:.25 A5:.25 G5:.5','~C#6:4'],sec['キメ'].q0,{leg:.9,v:104}).notes,
  ...ldLast,{p:78,q:sec['エンディング'].q0,l:7.6,v:112}];
 ld.forEach(n=>n.v=smpH(n.v,5));
 /* ツイン・リード（ラストサビだけ・3度上のハモリ）*/
 const hm=smpHarm(ldLast.filter(n=>n.q<sec[LS].q1-B),6,'minor',2);hm.forEach(n=>{n.q+=.008;n.v=smpH(n.v+2,4)});
 const bs=roots.map(n=>({p:n.p-12,q:n.q,l:n.l<=.3?.22:n.l*.95,v:smpH(n.v-4,5)}));
 const og=[];for(const nm of ['サビ','スロー',LS]){const sc=sec[nm];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;for(const p of smpVoice(chAt(s),55,4))smpN(og,p,s,B*.98,nm==='スロー'?80:70)}}
 const dr=[],fill=(s,big)=>{[[3,50],[3.25,50],[3.5,47],[3.75,43]].forEach(([o,p],i)=>smpN(dr,p,s+o,.25,100+i*6));if(big)[2,2.25,2.5,2.75].forEach((o,i)=>smpN(dr,38,s+o,.25,80+i*8))};
 const grooveRiff=(q0,bars,lastFill)=>{for(let b=0;b<bars;b++){const s=q0+b*B,last=b===bars-1;
  if(b===0)smpN(dr,49,s,2,112);
  [0,.75,2,2.5].forEach(o=>smpN(dr,36,s+o,.5,smpH(110,5)));smpN(dr,38,s+1,.5,smpH(112,4));if(!(last&&lastFill))smpN(dr,38,s+3,.5,smpH(114,4));
  for(let i=0;i<8;i++)if(!(last&&lastFill&&i>=6))smpN(dr,42,s+i/2,.5,smpH(i%2?70:96,5));
  if(last&&lastFill)fill(s,false)}};
 {const s0=sec['イントロ'].q0;[3,3.25,3.5,3.75].forEach((o,i)=>smpN(dr,38,s0+B+o,.25,70+i*12));grooveRiff(s0+2*B,2,true)}
 grooveRiff(sec['リフ'].q0,8,true);
 for(let b=0;b<4;b++){const s=sec['加速'].q0+b*B;if(b===0)smpN(dr,49,s,2,110);
  for(let k=0;k<4;k++)smpN(dr,36,s+k,.5,112);
  if(b<3){smpN(dr,38,s+1,.5,110);smpN(dr,38,s+3,.5,112);for(let i=0;i<8;i++)smpN(dr,46,s+i/2,.4,smpH(i%2?74:90,5))}
  else for(let i=0;i<16;i++)smpN(dr,38,s+i/4,.25,64+i*3.6)}
 const drive=(q0,bars,dbl)=>{for(let b=0;b<bars;b++){const s=q0+b*B,last=b===bars-1;
  smpN(dr,49,s,2,b%2?100:118);if(b===0&&dbl)smpN(dr,57,s,2,110);
  if(dbl)for(let i=0;i<8;i++)smpN(dr,36,s+i/2,.4,smpH(i%2?96:112,5));else [0,1.5,2,2.5].forEach(o=>smpN(dr,36,s+o,.5,smpH(110,5)));
  smpN(dr,38,s+1,.5,smpH(116,4));if(!last)smpN(dr,38,s+3,.5,smpH(118,4));
  for(let i=0;i<8;i++)if(!(last&&i>=6))smpN(dr,51,s+i/2,.5,smpH(i%2?78:96,5));
  if(last)fill(s,true)}};
 drive(sec['サビ'].q0,8,false);
 for(let b=0;b<4;b++){const s=sec['スロー'].q0+b*B;if(b===0)smpN(dr,49,s,3,116);
  smpN(dr,36,s,.5,104);smpN(dr,36,s+2.5,.5,96);smpN(dr,38,s+2,.5,112);
  for(let k=0;k<4;k++)smpN(dr,51,s+k,.5,smpH(80,5));if(b===3)[3,3.5].forEach((o,i)=>smpN(dr,[47,43][i],s+o,.5,104))}
 grooveRiff(sec['再加速'].q0,4,true);
 {const s=sec['キメ'].q0;[0,.75,1.5,2,2.75,3.5].forEach(o=>{smpN(dr,36,s+o,.4,122);smpN(dr,49,s+o,.6,o?104:122)});
  for(let i=0;i<16;i++)smpN(dr,[38,38,50,50,47,47,45,45,43,43,41,41,38,38,38,38][i],s+B+i/4,.25,80+i*2.8)}
 drive(sec[LS].q0,8,true);
 {const s=sec['エンディング'].q0;smpN(dr,49,s,4,124);smpN(dr,57,s,4,118);smpN(dr,36,s,.5,124);
  for(let i=0;i<12;i++)smpN(dr,[50,50,47,47,45,45,43,43,41,41,38,38][i],s+1+i/4,.25,90+i*2.5);
  smpN(dr,49,s+B,4,127);smpN(dr,57,s+B,4,120);smpN(dr,36,s+B,.5,127);smpN(dr,38,s+B,.5,120)}
 const tDr=smpTrack('drum',{name:'ドラム',tone:'kit_vd',vol:-5,ci:1,fx:[['eq',{hp:30,low:2,mid:-1.5,midf:450,high:2}],['rcomp',{thr:-18,ratio:3.5,att:.006,rel:.12,gain:1.2}],SMPFX.room(.16)],notes:dr,start:0,clip:'ロック・ビート'});
 const tBs=smpTrack('midi',{name:'ベース（ピック）',tone:'waf_pick_bass',vol:-6,pan:0,ci:2,fx:[['eq',{hp:35,low:2,mid:1.5,midf:800,high:0}],['dist',{drive:.15,tone:3000,mix:.3,out:.8}],['rcomp',{thr:-20,ratio:4,gain:1.2}]],notes:bs,start:0,clip:'リフ＆8分刻み'});
 const gfx=hi=>[['eq',{hp:90,low:-1,mid:-2.5,midf:450,high:hi}],['rcomp',{thr:-20,ratio:3,att:.01,rel:.15,gain:1.15}],SMPFX.room(.1)];
 const tGL=smpTrack('midi',{name:'リズムギター L（ディストーション）',tone:'waf_clean_gtr',vol:-9,pan:-.75,ci:4,fx:[...SMPAMP(.8,{tone:3300,mid:3}),...gfx(1.5).slice(1)],notes:gL,start:0,clip:'疾走リフ（L）',hum:[.005,3]});
 const tGR=smpTrack('midi',{name:'リズムギター R（オーバードライブ）',tone:'waf_lp_clean',vol:-9,pan:.75,ci:4,fx:[...SMPAMP(.68,{tone:3700,mid:2,midf:1100}),...gfx(2).slice(1)],notes:gR,start:0,clip:'疾走リフ（R・ダブル）',hum:[.005,3]});
 const lfx=[...SMPAMP(.62,{tone:4300,mid:4,midf:1000,cab:6000}),['rcomp',{thr:-22,ratio:3,gain:1.15}],['delay',{time:.75,fb:.3,mix:.17,tone:3800}],SMPFX.plate(.22,2)];
 const tLd=smpTrack('midi',{name:'リードギター',tone:'waf_lp_clean',vol:-5,pan:-.12,ci:3,fx:lfx,notes:ld,clip:'リードメロディ'});
 const tHm=smpTrack('midi',{name:'リードギター（ハモリ）',tone:'waf_clean_gtr',vol:-8,pan:.18,ci:3,fx:lfx,notes:hm,clip:'ツイン・リード'});
 const tOg=smpTrack('midi',{name:'オルガン',tone:'waf_organ',vol:-17,pan:.3,ci:0,fx:[['rotary',{mix:.7}],SMPFX.room(.14)],notes:og,clip:'オルガン'});
 smpMaster([['eq',{hp:30,low:1.5,mid:.5,midf:2000,high:1.5}],['rcomp',{thr:-18,ratio:3,att:.015,rel:.15,gain:1.3}],['tape',{drive:.05,wobble:0,tone:12000}],['exciter',{amount:.15,freq:6000}],['limiter',{thr:-1.2,gain:1}]],0);
 smpFinish([C.g,tDr,tBs,tGL,tGR,tLd,tHm,tOg],null,tLd);
}

/* =====================================================================
   3. 回転木馬（オーケストラ＋オルゴールのワルツ 3/4）
   いったん止まりかけ → ハープのグリッサンド → A♭ に転調して加速しながら再び回り出す
   ===================================================================== */
function sampleCarousel(){
 const PA='| F | F | C7 | C7 | C7 | C7 | F | F |',PA2=' F | F7 | Bb | Bbm | F | C7 | F | F |',SA="A'（転調）";
 const AB=PA.slice(1)+PA2;
 const C=smpBegin({name:'回転木馬の午後（オーケストラ＆オルゴール）',bpm:150,swing:50,key:[5,'major'],sig:{n:3,d:4},seed:37,
  secs:[['オルゴール前奏',8,0],['A',16,1],['B',16,4],['止まりかけ',4,6],[SA,16,2],['コーダ',8,5]],
  prog:PA+AB+' Bb | Bb | F | F | C7 | C7 | F | F | Bb | Bb | F | D7 | Gm | C7 | F | C7 |'+' Db | Bbm | Eb7 | Eb7 |'+smpTrProg(AB,3)+smpTrProg(PA.slice(1),3)});
 const {B,sec,chAt}=C;
 const MA=['C5:1 F5:1 A5:1','C6:2 A5:1','G5:1 Bb5:1 G5:1','E5:2 C5:1','D5:1 E5:1 G5:1','Bb5:2 G5:1','A5:1 G5:1 F5:1','F5:2 C5:1',
           'F5:1 A5:1 C6:1','Eb6:2 C6:1','D6:1 C6:1 Bb5:1','Db6:2 Bb5:1','A5:1 C6:1 A5:1','G5:2 E5:1','F5:3','r:3'];
 const MB=['D6:2 C6:1','Bb5:2 F5:1','A5:1 C6:1 A5:1','F5:3','G5:1 Bb5:1 E5:1','G5:3','A5:1 F5:1 C5:1','F5:3',
           'D6:1 F6:1 D6:1','Bb5:3','C6:1 A5:1 F5:1','F#5:2 A5:1','Bb5:1 D6:1 Bb5:1','G5:2 E5:1','F5:3','E5:1 G5:1 C6:1'];
 /* テンポ: 止まりかけで 150→48、A' は 72 から加速して 150、コーダでねじが切れる */
 const T=[{q:0,bpm:150}];smpRamp(T,sec['止まりかけ'].q0,sec['止まりかけ'].q1-B,150,62,1);T.push({q:sec['止まりかけ'].q1-B,bpm:48});
 T.push({q:sec[SA].q0,bpm:72});smpRamp(T,sec[SA].q0,sec[SA].q0+4*B,72,150,1);
 smpRamp(T,sec['コーダ'].q0+2*B,sec['コーダ'].q1,150,62,1);smpTempo(T);
 /* オルゴール */
 const mb=[...smpPhrases(MA.slice(0,8),sec['オルゴール前奏'].q0,{leg:1,v:84}).notes,...smpPhrases(MA,sec.A.q0,{leg:1,v:88}).notes,
  ...smpPhrases(['F5:1 Ab5:1 Db6:1','Db6:2 Bb5:1','G5:1 Bb5:1 Db6:1','~Eb6:3'],sec['止まりかけ'].q0,{leg:1,v:78}).notes,
  ...smpPhrases(MA,sec[SA].q0,{leg:1,v:68,tr:3}).notes,...smpPhrases(MA.slice(0,7).concat(['~F5:3']),sec['コーダ'].q0,{leg:1,v:80,tr:3}).notes];
 const mbLow=[];for(const nm of ['オルゴール前奏','止まりかけ','コーダ'])for(let b=0;b<sec[nm].bars;b++){const s=sec[nm].q0+b*B,ch=chAt(s),r=smpLow(smpBassPc(ch),53),v=smpVoice(ch,60,2),last=b===sec[nm].bars-1&&nm!=='オルゴール前奏';
  smpN(mbLow,r,s,last?3:1.2,66);if(!last)v.forEach(p=>{smpN(mbLow,p,s+1,.9,46);smpN(mbLow,p,s+2,.9,44)})}
 mb.push(...mbLow);
 for(const n of mb)if(n.q>=sec['コーダ'].q0)n.v=Math.max(30,n.v-(n.q-sec['コーダ'].q0)*1.1);
 mb.forEach(n=>n.v=smpH(n.v,5));
 /* ピチカート・ベース（ウン）とハープ（パッパ）*/
 const bs=[],hp=[];
 for(const nm of ['A','B',SA]){const sc=sec[nm];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B,ch=chAt(s),r=smpLow(smpBassPc(ch),36);
  smpN(bs,(nm==='B'&&b%2)?smpLow((ch.root+7)%12,36):r,s,.85,smpH(86,5));
  if(nm!=='B'||b%4===3)smpVoice(ch,57,3).forEach(p=>{smpN(hp,p,s+1,.8,smpH(56,5));smpN(hp,p,s+2,.8,smpH(50,5))});
  else{const v=smpVoice(ch,53,3);[v[0],v[1],v[2],v[0]+12,v[1]+12,v[2]+12].forEach((p,i)=>smpN(hp,p,s+i*.5,1.6,smpH(50+i*3,4)))}
 }}
 /* ハープのグリッサンド（止まりかけの最後の拍 → A'）*/
 {const q0=sec[SA].q0-1,sc=[3,5,7,8,10,0,1];const L=[];for(let o=63;o<=87;o++)if(sc.includes(o%12))L.push(o);L.forEach((p,i)=>smpN(hp,p,q0+i/L.length,1.4,40+i*2.5))}
 /* ストリングス（B は白玉、A' は対旋律）: 2種類を重ねて厚く */
 const st=[],cs=[];for(const nm of ['B',SA]){const sc=sec[nm];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;smpVoice(chAt(s),53,4).forEach(p=>smpN(st,p,s,B*.99,nm==='B'?50:56))}}
 {const sc=sec[SA];for(let b=4;b<sc.bars;b++){const s=sc.q0+b*B,v=smpVoice(chAt(s),55,3);smpN(cs,b%2?v[2]:v[1],s,B*.98,smpH(66,4))}}
 /* B のメロディ: ソロ・バイオリン＋フルート（1オクターブ下）、チェレスタが合いの手 */
 const vn=smpPhrases(MB,sec.B.q0,{leg:1,v:84}).notes;vn.forEach(n=>n.v=smpH(n.v+(n.l>=2?6:0),5));
 const flB=smpPhrases(MB,sec.B.q0,{leg:.98,v:70,tr:-12}).notes;
 const ce=[];for(let b=0;b<16;b++){const s=sec.B.q0+b*B;if(b%2===1){const v=smpVoice(chAt(s),76,3);v.reverse().forEach((p,i)=>smpN(ce,p,s+i,.9,smpH(50,5)))}}
 /* A' のメロディ: トランペット＋グロッケン＋オルゴール、ブラスが和音 */
 const tp=smpPhrases(MA,sec[SA].q0,{leg:.96,v:90,tr:3-12}).notes;tp.forEach(n=>n.v=smpH(n.v,5));
 const brs=[];{const sc=sec[SA];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;smpVoice(chAt(s),53,3).forEach(p=>{smpN(brs,p,s+1,.6,smpH(64,4));smpN(brs,p,s+2,.6,smpH(58,4))})}}
 const gl=[...smpPhrases(MA,sec.A.q0,{leg:1,v:56}).notes.filter(n=>n.l>=2),...smpPhrases(MA,sec[SA].q0,{leg:1,v:72,tr:3}).notes];
 gl.forEach(n=>n.v=smpH(n.v,5));
 /* 打楽器（A'）*/
 const pc=[];{const sc=sec[SA];smpN(pc,49,sc.q0,3,84);for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;smpN(pc,36,s,.5,smpH(58,5));smpN(pc,54,s+1,.4,smpH(34,4));smpN(pc,54,s+2,.4,smpH(30,4));
  if(b%2===0)smpN(pc,81,s,1,smpH(58,4));if(b%4===0&&b)smpN(pc,49,s,2,52)}}
 smpN(pc,81,sec['コーダ'].q1-B,2,40);
 const tMb=smpTrack('midi',{name:'オルゴール',tone:'waf_musicbox',vol:-5,pan:-.12,ci:3,fx:[['eq',{hp:200,high:1}],SMPFX.hall(.32,2.6)],notes:mb,start:0,clip:'オルゴール',hum:[.003,3]});
 const tVn=smpTrack('midi',{name:'バイオリン（ソロ）',tone:'waf_violin',vol:-8,pan:.12,ci:3,fx:[['eq',{hp:180,mid:-1,midf:1200,high:1}],SMPFX.hall(.3,2.8)],notes:vn,clip:'B メロディ'});
 const tFl=smpTrack('midi',{name:'フルート',tone:'tj_flute',vol:-12,pan:-.2,ci:6,fx:[SMPFX.hall(.3,2.8)],notes:flB,clip:'B メロディ（下）'});
 const tTp=smpTrack('midi',{name:'トランペット',tone:'waf_trumpet',vol:-9,pan:-.05,ci:0,fx:[['eq',{hp:150,mid:-1.5,midf:1500,high:.5}],SMPFX.hall(.26,2.6)],notes:tp,clip:"A' メロディ"});
 const tBr=smpTrack('midi',{name:'ブラス（和音）',tone:'waf_brass',vol:-17,pan:.22,ci:0,fx:[SMPFX.hall(.3,2.6)],notes:brs,clip:'パッパ'});
 const tGl=smpTrack('midi',{name:'グロッケン',tone:'waf_glock',vol:-15,pan:.3,ci:6,fx:[SMPFX.hall(.3,2.6)],notes:gl,clip:'きらきら'});
 const tCe=smpTrack('midi',{name:'チェレスタ',tone:'waf_celesta',vol:-14,pan:.4,ci:6,fx:[SMPFX.hall(.32,2.6)],notes:ce,clip:'合いの手'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_strings',vol:-16,pan:.3,ci:5,fx:[SMPFX.hall(.32,3)],notes:st,clip:'白玉'});
 const tCs=smpTrack('midi',{name:'ストリングス（対旋律）',tone:'waf_slow_strings',vol:-14,pan:-.28,ci:5,fx:[SMPFX.hall(.34,3)],notes:cs,clip:"A' の対旋律"});
 const tHp=smpTrack('midi',{name:'ハープ',tone:'waf_harp',vol:-11,pan:-.35,ci:4,fx:[SMPFX.hall(.28,2.6)],notes:hp,clip:'ワルツの刻み・グリッサンド'});
 const tBs=smpTrack('midi',{name:'ピチカート・ベース（ウン）',tone:'waf_ac_bass',vol:-9,pan:.05,ci:2,fx:[SMPFX.hall(.18,2.4)],notes:bs,clip:'1拍目'});
 const tPc=smpTrack('drum',{name:'打楽器',tone:'kit_wd_FluidR3_GM_sf2_file',vol:-15,pan:0,ci:1,fx:[SMPFX.hall(.3,2.6)],notes:pc,clip:'大太鼓・トライアングル'});
 smpMaster([['eq',{hp:28,low:.5,mid:-.5,midf:500,high:1.5}],['rcomp',{thr:-18,ratio:1.8,att:.03,rel:.3,gain:1}],['exciter',{amount:.12,freq:7000}],['widener',{width:.25,mix:.35}],['reverb',{mix:.1,decay:3,pre:.03,tone:7500}],['limiter',{thr:-1.2,gain:1}]],5);
 smpFinish([C.g,tPc,tBs,tHp,tSt,tCs,tMb,tVn,tFl,tTp,tBr,tGl,tCe],null,tMb);
}

/* =====================================================================
   4. ボサノバ（歌もの・歌詞「若き日の思い出と今の幸せ」）
   2番サビで G → A♭ に半音転調、最後は ♭VI（偽終止）の和音へ逸れてからタグで締める
   ===================================================================== */
const SMP_BOSSA_LYR={
 a1:['はるかなあのなつ','じてんしゃこいでた','かぜがほほなでて','ゆめをみていた'],
 b1:['いまはきみのそば','ちいさなひだまり','ゆっくりあるいていく','ふたりで'],
 a2:['あおいそらのした','わらいころげたひ','いまもむねのおく','やさしくひかる'],
 b2:['まどべのこーひー','ゆうひがとけてく','あのころのぼくらに','ほほえむ'],
 tag:['あのころのぼくらに','ほほえむ']};
const SMP_BOSSA_KANJI='（Aメロ）遥かなあの夏 自転車こいでた 風が頬なでて 夢を見ていた\n（サビ）今は君のそば 小さな陽だまり ゆっくり歩いていく ふたりで\n（Aメロ2）青い空の下 笑い転げた日 今も胸の奥 やさしく光る\n（サビ2）窓辺のコーヒー 夕陽が溶けてく あの頃の僕らに 微笑む\n（タグ）あの頃の僕らに 微笑む';
function sampleBossa(){
 const IN='| Gmaj7 | Cmaj7 | Gmaj7 | Am7 D7 |',PA=' Gmaj7 | Gmaj7 | Am7 | D7 | Bm7 | E7 | Am7 | D7 |',PB=' Cmaj7 | Cm7 | Bm7 | E7 | Am7 | D7 | Gmaj7 | Am7 D7 |';
 const C=smpBegin({name:'あの夏の坂道（ボサノバ）',bpm:132,swing:50,key:[7,'major'],seed:41,
  secs:[['イントロ',4,0],['Aメロ',8,1],['サビ',8,4],['間奏',4,5],['Aメロ2',8,1],['サビ2（転調）',8,4],['タグ',4,3],['アウトロ',4,0]],
  prog:IN+PA+PB+IN.slice(1)+PA.replace(/ D7 \|$/,' Bbm7 Eb7 |')+smpTrProg(PB,1)+smpTrProg(' Am7 | D7 | Ebmaj7 | Ebmaj7 | Gmaj9 | Cmaj7 | Gmaj9 | Gmaj9 |',1)});
 const {B,sec,chAt,inS}=C,S2='サビ2（転調）';
 const MA=['r:.5 B4:.5 B4:.5 A4:.5 B4:1 D5:1 | E5:1.5 D5:.5 B4:2','r:.5 C5:.5 C5:.5 B4:.5 C5:1 E5:1 | D5:1.5 C5:.5 A4:2',
           'r:.5 D5:.5 D5:.5 C#5:.5 D5:1 F#5:1 | E5:1.5 D5:.5 G#4:2','r:.5 C5:.5 B4:.5 A4:.5 G4:1 A4:.5 G4:.5 | F#4:3 r:1'];
 const MB=['E5:1 E5:.5 D5:.5 E5:1 G5:1 | G5:1.5 F5:.5 Eb5:2','D5:1 D5:.5 C#5:.5 D5:1 F#5:1 | E5:1.5 D5:.5 B4:2',
           'C5:1 C5:.5 B4:.5 C5:1 E5:1 | D5:1.5 C5:.5 A4:1 F#4:1','B4:1 A4:.5 B4:.5 G4:2 | r:4'];
 const vo={leg:.92,v:80};
 const pa1=smpPhrases(MA,sec['Aメロ'].q0,vo),pb1=smpPhrases(MB,sec['サビ'].q0,{...vo,v:86});
 const pa2=smpPhrases([...MA.slice(0,3),'r:.5 C5:.5 B4:.5 A4:.5 G4:1 A4:.5 G4:.5 | F4:3 r:1'],sec['Aメロ2'].q0,vo);
 const pb2=smpPhrases(MB,sec[S2].q0,{...vo,v:90,tr:1});
 const pt=smpPhrases([MB[2],'Bb4:1 G4:.5 Bb4:.5 ~G4:2 | r:4'],sec['タグ'].q0,{...vo,v:84,tr:1});
 smpLyr(pa1.groups,SMP_BOSSA_LYR.a1,'a1');smpLyr(pb1.groups,SMP_BOSSA_LYR.b1,'b1');smpLyr(pa2.groups,SMP_BOSSA_LYR.a2,'a2');smpLyr(pb2.groups,SMP_BOSSA_LYR.b2,'b2');smpLyr(pt.groups,SMP_BOSSA_LYR.tag,'tag');
 const voc=[...pa1.notes,...pb1.notes,...pa2.notes,...pb2.notes,...pt.notes];voc.forEach(n=>n.v=smpH(n.v+(n.l>=1.5?3:0),5));
 /* ハモリ（転調後のサビ2・3度上、歌詞つき）*/
 const har=[...smpHarm(pb2.notes,8,'major',2),...smpHarm(pt.groups[0],8,'major',2)];
 S.sections.forEach(s=>{const k={'Aメロ':'a1','サビ':'b1','Aメロ2':'a2',[S2]:'b2','タグ':'tag'}[s.name];if(k)s.lyr=SMP_BOSSA_LYR[k].join('\n')});
 /* ナイロンギター: 親指（1・3拍）＋ 2小節パターンのシンコペーション（裏は次のコードを先取り）*/
 const gt=[],HITS=[0,1.5,3,5,6.5];
 for(let b=0;b<C.bars;b++){const s=b*B;
  if(b===C.bars-1){const ch=chAt(s);[smpLow(smpBassPc(ch),40),...smpVoice(ch,55,5,true)].forEach((p,i)=>smpN(gt,p,s+i*.1,3.8,smpH(58,3)));continue}
  for(const o of [0,2]){const ch=chAt(s+o),r=smpLow(smpBassPc(ch),40);smpN(gt,o===2&&chAt(s).root===ch.root?r+7-(r+7>52?12:0):r,s+o,1.8,smpH(60,4))}
  for(const h of HITS){const q=(b%2?s-B:s)+h;if(q<s-1e-6||q>=s+B-1e-6)continue;
   const ch=chAt(q%1?q+.5:q);smpVoice(ch,55,3,true).forEach((p,i)=>smpN(gt,p,q+i*.012,q%1?.6:.9,smpH(50,5)))}
 }
 const bs=[];
 for(let b=4;b<C.bars;b++){const s=b*B,c1=chAt(s),c2=chAt(s+2),lo=pc=>smpLow(pc,33);
  if(b===C.bars-1){smpN(bs,lo(smpBassPc(c1)),s,3.8,74);continue}
  smpN(bs,lo(smpBassPc(c1)),s,1.5,smpH(80,4));
  smpN(bs,c2.root===c1.root?lo((c1.root+7)%12):lo(smpBassPc(c2)),s+2,1.5,smpH(70,4));
  const nx=chAt(s+B);if(nx.root!==c2.root&&b%2)smpN(bs,lo(smpBassPc(nx)),s+3.5,.45,smpH(60,4));
 }
 const dr=[];
 for(let b=2;b<C.bars;b++){const s=b*B;
  for(let i=0;i<8;i++)smpN(dr,70,s+i/2,.3,smpH(i%2?34:24,3));
  if(b<4)continue;
  if(b===C.bars-1){smpN(dr,36,s,.5,40);continue}
  smpN(dr,36,s,.5,smpH(42,3));smpN(dr,36,s+2,.5,smpH(36,3));smpN(dr,36,s+1.5,.3,22);smpN(dr,36,s+3.5,.3,22);
  for(const h of HITS){const q=(b%2?s-B:s)+h;if(q>=s-1e-6&&q<s+B-1e-6)smpN(dr,37,q,.3,smpH(44,4))}
 }
 /* ローズ（サビ・タグ）・ストリングス（転調後）・フルート（イントロ・間奏・アウトロ）*/
 const rh=[],st=[];
 for(const nm of ['サビ',S2,'タグ']){const sc=sec[nm];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B,two=chAt(s).root!==chAt(s+2).root;for(const o of (two?[0,2]:[0]))smpVoice(chAt(s+o),60,3,true).forEach(p=>smpN(rh,p,s+o,two?1.95:3.9,smpH(42,3)))}}
 for(let b=sec[S2].q0/B;b<C.bars;b++){const s=b*B;smpVoice(chAt(s),55,4,true).forEach(p=>smpN(st,p,s,B*.99,smpH(inS(s,'タグ')?60:48,3)))}
 const fl=[...smpPhrases(['D5:1.5 B4:.5 G4:2','E5:1.5 C5:.5 G4:2','D5:1 B4:1 A4:1 G4:1','A4:2 F#4:2'],sec['イントロ'].q0,{leg:.96,v:66}).notes,
  ...smpPhrases(['B4:.5 D5:.5 G5:1.5 F#5:.5 D5:1','E5:.5 G5:.5 C6:1.5 B5:.5 G5:1','F#5:1 D5:1 B4:1 G4:1','A4:1 C5:1 F#5:2'],sec['間奏'].q0,{leg:.96,v:72}).notes,
  ...smpPhrases(['D5:3 B4:1','E5:4','D5:2 F#5:1 A5:1','~B5:4'],sec['アウトロ'].q0,{leg:.96,v:62,tr:1}).notes];
 fl.forEach(n=>n.v=smpH(n.v,4));
 const tVo=smpTrack('midi',{name:'ボーカル（メロディ・歌詞つき）',tone:'tj_saxophone',vol:-6,pan:0,ci:3,fx:[['eq',{hp:150,mid:-1.5,midf:700,high:1}],SMPFX.glue(-22,2.5,1),['delay',{time:.75,fb:.22,mix:.08,tone:3500}],SMPFX.hall(.26,2.4)],notes:voc,clip:'歌メロ（歌詞つき）'});
 const tHa=smpTrack('midi',{name:'ハモリ（3度上・歌詞つき）',tone:'waf_oohs',vol:-15,pan:.22,ci:3,fx:[SMPFX.hall(.34,2.6)],notes:har,clip:'サビ2 のハモリ'});
 const tGt=smpTrack('midi',{name:'ナイロンギター',tone:'waf_nylon',vol:-8,pan:-.25,ci:4,fx:[SMPFX.warmEq(70),SMPFX.glue(-20,2,1),SMPFX.hall(.2,2.2)],notes:gt,start:0,clip:'ボサノバ・パターン'});
 const tBs=smpTrack('midi',{name:'ウッドベース',tone:'waf_ac_bass',vol:-8,pan:.12,ci:2,fx:[['eq',{hp:35,low:1.5,mid:-1,midf:450}],SMPFX.glue(-20,3,1)],notes:bs,clip:'ルート＆5度'});
 const tDr=smpTrack('drum',{name:'パーカッション',tone:'kit_wd_FluidR3_GM_sf2_file',vol:-16,pan:.18,ci:1,fx:[['eq',{hp:60,high:1}],SMPFX.hall(.22,1.8)],notes:dr,clip:'クラーベ＆シェイカー'});
 const tRh=smpTrack('midi',{name:'ローズ',tone:'smp_rhodes',vol:-16,pan:.35,ci:0,fx:[['chorus',{mix:.3,rate:.4,depth:.35}],SMPFX.hall(.26,2.4)],notes:rh,clip:'サビの白玉'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_slow_strings',vol:-18,pan:-.3,ci:5,fx:[SMPFX.hall(.38,3)],notes:st,clip:'転調後'});
 const tFl=smpTrack('midi',{name:'フルート',tone:'tj_flute',vol:-12,pan:-.38,ci:6,fx:[SMPFX.hall(.32,2.6)],notes:fl,clip:'イントロ・間奏・アウトロ'});
 smpMaster([['tilt',{tilt:-.5,center:1200}],['rcomp',{thr:-18,ratio:2,att:.02,rel:.25,gain:1}],['reverb',{mix:.07,decay:2.2,pre:.02,tone:8000}],['limiter',{thr:-1.2,gain:1}]],9.5);
 smpFinish([C.g,tDr,tBs,tGt,tRh,tSt,tFl,tHa,tVo],tVo,tVo);
}

/* =====================================================================
   5. ピアノソロ（ノクターン風・ルバート）
   中間部の頂点 → 右手のカデンツァ（細かい下降と上昇）→ 再現 → 最後は ♭VI に逸れる偽終止からコーダ
   ===================================================================== */
function sampleNocturne(){
 const A2='| Eb | Cm | Ab | Abm | Eb/Bb | C7 | Fm7 Bb7 |';
 const C=smpBegin({name:'夜想（ピアノ・ソロ）',bpm:60,swing:50,key:[3,'major'],seed:53,
  secs:[['序奏',2,0],['A',8,1],['A2',8,1],['中間部',8,4],['再現',8,2],['コーダ',4,5]],
  prog:'| Eb | Ab/Eb | Eb | Cm | Ab | Bb7 | Eb | Gm7 C7 | Fm | Bb7 '+A2+' Eb | Cm | G7 | Cm | C7 | Fm | Ab | Ebmaj7 | Bb7 '+A2+' B | Ab | Abm | Eb | Eb |'});
 const {B,sec,chAt,inS}=C;
 const MA=['G5:3 F5:.5 Eb5:.5','Eb5:1.5 D5:.5 C5:1 G5:1','C6:2.5 Bb5:.5 Ab5:1','G5:1.5 F5:.5 D5:2','Bb4:1 Eb5:1 G5:1.5 Bb5:.5','Bb5:1.5 G5:.5 E5:1 G5:1','Ab5:2 G5:.5 F5:.5 C5:1','D5:1 F5:1 Bb5:1 Ab5:1'];
 const MA2=[...MA.slice(0,3),'B5:1.5 Ab5:.5 Eb5:2','G5:1 Bb5:1 Eb6:1.5 D6:.5','C6:1 Bb5:1 G5:1 E5:1','F5:1 Ab5:1 G5:.5 F5:.5 D5:1','~Eb5:4'];
 const MB=['G5:.5 Ab5:.5 G5:.5 F5:.5 Eb5:1 C5:1','D5:1 F5:1 B5:1.5 Ab5:.5','G5:1.5 Eb5:.5 C6:2','Bb5:1 G5:1 E5:1 Db6:1','C6:1.5 Ab5:.5 F5:1 Ab5:1','C6:1.5 Bb5:.5 Ab5:1 Eb5:1','G5:2 Bb5:1 D6:1'];
 const arch=(L,q0,base,amp)=>L.forEach(n=>{const x=((n.q-q0)%(4*B))/(4*B);n.v=smpH(base+amp*Math.sin(Math.PI*x)+(n.l>=2?4:0),4)});
 const a=smpPhrases(MA,sec.A.q0,{leg:.98}).notes;arch(a,sec.A.q0,66,14);
 const a2=smpPhrases(MA2,sec.A2.q0,{leg:.98}).notes;arch(a2,sec.A2.q0,68,16);
 const mb=smpPhrases(MB,sec['中間部'].q0,{leg:.96}).notes;arch(mb,sec['中間部'].q0,74,20);
 /* 中間部の頂点（5〜7小節）は右手もオクターブ */
 const mbO=mb.filter(n=>n.q>=sec['中間部'].q0+4*B).map(n=>({...n,p:n.p-12,v:n.v-14}));
 /* カデンツァ: B♭7 の分散和音を2オクターブ駆け下り、半音階で駆け上がって A♭ で止まる */
 const cad=[],cq=sec['中間部'].q1-B,dn=[94,92,89,86,82,80,77,74,70,68,65,62],up=[62,63,64,65,66,67];
 dn.forEach((p,i)=>smpN(cad,p,cq+i/6,.2,86-i*2.5));up.forEach((p,i)=>smpN(cad,p,cq+2+i/6,.2,56+i*3));smpN(cad,80,cq+3,1,70);
 const ar=smpPhrases(MA2,sec['再現'].q0,{leg:.98}).notes;arch(ar,sec['再現'].q0,78,16);
 const arO=ar.map(n=>({...n,p:n.p-12,v:n.v-16}));
 /* 再現は長い音の前に回音の装飾 */
 const orn=[];ar.filter(n=>n.l>=2&&n.q<sec['再現'].q1-B).forEach(n=>[2,0,-1].forEach((d,i)=>orn.push({p:n.p+d,q:n.q-.3+i*.1,l:.1,v:n.v-16})));
 const co=smpPhrases(['Eb6:2 C6:1 Ab5:1','B5:2 Ab5:1 F5:1','~G5:4'],sec['コーダ'].q0,{leg:.98}).notes;arch(co,sec['コーダ'].q0,64,10);
 const rh=[...a,...a2,...mb,...mbO,...cad,...ar,...arO,...orn,...co];
 /* 左手: 2拍ごとに 低音→和音を3連符で上下（ペダルで響かせる）、頂点はオクターブの低音 */
 const lh=[];
 for(let b=0;b<C.bars;b++){const s=b*B,mid=inS(s,'中間部'),peak=mid&&s>=sec['中間部'].q0+4*B;
  if(s===cq){const ch=chAt(s);[34,46,53,56].forEach((p,i)=>smpN(lh,p,s+i*.03,4,62-i*4));continue}
  if(b===C.bars-1){const ch=chAt(s),bsn=smpLow(smpBassPc(ch),36);[bsn,bsn+7,bsn+12,bsn+16,bsn+19,bsn+24,bsn+28,bsn+31,bsn+36].forEach((p,i)=>smpN(i<5?lh:rh,p,s+i*.14,4.2-i*.14,smpH(52+i*2,3)));continue}
  for(let h=0;h<2;h++){const q0=s+h*2,ch=chAt(q0),bsn=smpLow(smpBassPc(ch),36),v=smpVoice(ch,bsn+6,3),seq=[bsn,v[0],v[1],v[2],v[1],v[0]];
   if(peak)smpN(lh,bsn-12,q0,2.05,smpH(58,3));
   seq.forEach((p,i)=>{const q=q0+i/3;smpN(lh,p,q,q0+2-q+.06,smpH(i===0?(mid?62:55):(mid?48:41)+(i===3?5:0)+(peak?6:0),4))})}
 }
 /* ルバート */
 const T=[{q:0,bpm:58}];
 const breath=q=>{T.push({q:q-1,bpm:52},{q,bpm:60})};
 [sec.A.q0+4*B,sec.A.q1,sec.A2.q0+4*B,sec.A2.q1,sec['再現'].q0+4*B].forEach(breath);
 T.push({q:sec.A.q0,bpm:60});
 smpRamp(T,sec['中間部'].q0,sec['中間部'].q0+4*B,60,68,2);smpRamp(T,sec['中間部'].q0+4*B,cq,68,62,2);
 T.push({q:cq,bpm:70});smpRamp(T,cq+2,cq+4,64,34,.5);T.push({q:sec['再現'].q0,bpm:58});
 smpRamp(T,sec['再現'].q1-B-2,sec['再現'].q1-B,60,48,1);T.push({q:sec['再現'].q1-B,bpm:50});
 T.push({q:sec['コーダ'].q0,bpm:56});smpRamp(T,sec['コーダ'].q0+2*B,sec['コーダ'].q1,56,36,1);
 smpTempo(T);
 const pfx=()=>[['eq',{hp:30,low:.5,mid:-1,midf:400,high:1}],['rcomp',{thr:-20,ratio:1.6,att:.02,rel:.3,gain:1.08}],SMPFX.hall(.26,3)];
 const tR=smpTrack('midi',{name:'ピアノ（右手）',tone:'smp_sal_hq',vol:-1,pan:.12,ci:3,fx:pfx(),notes:rh,clip:'旋律',hum:[.006,3]});
 const tL=smpTrack('midi',{name:'ピアノ（左手）',tone:'smp_sal_hq',vol:-3,pan:-.12,ci:0,fx:pfx(),notes:lh,start:0,clip:'3連アルペジオ',hum:[.005,3]});
 smpMaster([['eq',{hp:25,low:0,mid:0,midf:1000,high:1}],['rcomp',{thr:-14,ratio:1.4,att:.04,rel:.4,gain:1.05}],['reverb',{mix:.12,decay:3.4,pre:.03,tone:7000}],['limiter',{thr:-1.2,gain:1}]],10);
 smpFinish([C.g,tL,tR],null,tR);
}

/* =====================================================================
   6. 80s テクノポップ風オリジナル（インスト）
   B の最後に全員の16分のキメ → 1小節のブレイク → C マイナーから D マイナーへ転調
   ===================================================================== */
function sampleTechno(){
 const PA=' Cm | Ab | Bb | Gm | Cm | Ab | Fm | G7 |',SA="A'（転調）";
 const C=smpBegin({name:'ネオン・グリッド（80s テクノポップ風）',bpm:126,swing:50,key:[0,'minor'],seed:61,
  secs:[['イントロ',4,0],['A',8,1],['B',8,4],['ブレイク',1,6],[SA,8,2],['アウトロ',4,5]],
  prog:'| Cm | Cm | Ab | Bb |'+PA+' Ab | Bb | Gm | Cm | Fm | Bb | Eb | G | A7 |'+smpTrProg(PA,2)+' Dm | Bb | C | Dm |'});
 const {B,sec,chAt,inS}=C;
 const kq=sec['B'].q1-B,KIME=[0,.75,1.5,2.25,3,3.5];
 const MA=['G5:.5 G5:.5 Eb5:.5 C5:.5 D5:.5 Eb5:.5 G5:1','Ab5:1.5 G5:.5 Eb5:1 C5:1','D5:.5 D5:.5 F5:.5 Bb5:.5 Ab5:.5 G5:.5 F5:1','G5:1.5 F5:.5 D5:2',
           'G5:.5 G5:.5 Eb5:.5 C5:.5 D5:.5 Eb5:.5 C6:1','C6:1.5 Bb5:.5 Ab5:1 Eb5:1','F5:.5 Ab5:.5 C6:.5 Ab5:.5 F5:1 Eb5:1','D5:1 F5:1 G5:1 B5:1'];
 const MB=['C6:2 Eb6:2','D6:3 Bb5:1','D6:1 Bb5:1 G5:2','C6:4','Ab5:2 C6:2','D6:2 F6:2','Eb6:2 G6:1 Eb6:1'];
 const ld=[...smpPhrases(MA,sec.A.q0,{leg:.62,v:90}).notes,...smpPhrases(MB,sec.B.q0,{leg:.98,v:84}).notes,...smpPhrases(MA,sec[SA].q0,{leg:.62,v:96,tr:2}).notes,
  ...smpPhrases(['D6:2 A5:2','F5:2 D5:2','C6:2 G5:2','~D6:4'],sec['アウトロ'].q0,{leg:.96,v:86}).notes];
 KIME.forEach(o=>smpN(ld,[79,79,83,83,86,86][KIME.indexOf(o)],kq+o,.3,104));
 ld.forEach(n=>n.v=smpH(n.v,3));
 const bell=smpPhrases(MA,sec[SA].q0,{leg:.8,v:70,tr:14}).notes;
 const bs=[];for(let b=0;b<C.bars;b++){const s=b*B;
  if(b===C.bars-1){smpN(bs,smpLow(smpBassPc(chAt(s)),36),s,3.5,100);continue}
  if(s===kq){KIME.forEach(o=>smpN(bs,smpLow(smpBassPc(chAt(s)),36),s+o,.3,110));continue}
  if(inS(s,'ブレイク'))continue;
  for(let i=0;i<8;i++){const q=s+i/2,r=smpLow(smpBassPc(chAt(q)),36);smpN(bs,r+(i%2?12:0),q,.42,i%2?84:104)}}
 const ar=[];for(let b=0;b<C.bars-1;b++){const s=b*B;if(s===kq)continue;const up=inS(s,SA)?12:0;
  for(let i=0;i<16;i++){const q=s+i/4,v=smpVoice(chAt(q),60,3),seq=[v[0],v[1],v[2],v[0]+12,v[2],v[1]];smpN(ar,seq[i%6]+up,q,.22,smpH(i%4===0?78:62,3)+(inS(s,'ブレイク')?i*2:0))}}
 const pd=[],cr=[];for(let b=0;b<C.bars;b++){const s=b*B;if(s===kq||inS(s,'ブレイク'))continue;smpVoice(chAt(s),55,4).forEach(p=>smpN(pd,p,s,B*.99,58));if(inS(s,'B',SA))smpVoice(chAt(s),60,3).forEach(p=>smpN(cr,p,s,B*.99,inS(s,SA)?60:66))}
 {const v=smpVoice(chAt(kq),55,4);KIME.forEach(o=>v.forEach(p=>smpN(pd,p+12,kq+o,.3,90)))}
 const dr=[];
 for(let b=0;b<C.bars;b++){const s=b*B,intro=b<4,last=b===C.bars-1,secEnd=[sec.A.q0,sec.B.q0,sec['アウトロ'].q0].includes(s+B);
  if(last){smpN(dr,36,s,.5,118);smpN(dr,49,s,3,108);continue}
  if(s===kq){KIME.forEach(o=>{smpN(dr,36,s+o,.4,120);smpN(dr,38,s+o,.4,112)});smpN(dr,49,s+3.5,2,110);continue}
  if(inS(s,'ブレイク')){for(let i=0;i<16;i++)smpN(dr,38,s+i/4,.25,40+i*5);continue}
  [0,2,2.5].forEach(o=>smpN(dr,36,s+o,.5,smpH(112,4)));
  if(!intro||b>=2){smpN(dr,38,s+1,.5,smpH(108,3));if(!secEnd)smpN(dr,38,s+3,.5,smpH(110,3))}
  if(inS(s,'B',SA)){smpN(dr,39,s+1,.5,96);smpN(dr,39,s+3,.5,96)}
  for(let i=0;i<16;i++)if(!(secEnd&&i>=12))smpN(dr,42,s+i/4,.25,smpH(i%4===0?82:i%2?50:66,3));
  if(inS(s,SA))smpN(dr,46,s+1.5,.4,70),smpN(dr,46,s+3.5,.4,70);
  if([sec.A.q0,sec.B.q0,sec[SA].q0].includes(s))smpN(dr,49,s,2,112);
  if(secEnd)[3,3.25,3.5,3.75].forEach((o,i)=>smpN(dr,i<2?38:[50,47][i-2],s+o,.25,92+i*8));
 }
 /* 効果音: ブレイクで逆再生シンバル → 転調の頭にインパクト */
 const fxn=[{p:64,q:sec['ブレイク'].q0,l:B,v:96},{p:62,q:sec[SA].q0,l:2,v:100},{p:66,q:sec.B.q0-2*B,l:2*B,v:70}];
 const tDr=smpTrack('drum',{name:'ドラムマシン',tone:'kit_sd_LM-2',vol:-5,ci:1,fx:[['eq',{hp:30,low:1.5,high:1.5}],['rcomp',{thr:-18,ratio:3,att:.005,gain:1.15}],['reverb',{mix:.18,decay:.9,pre:.005,tone:8000}]],notes:dr,start:0,clip:'テクノ・ビート',hum:false});
 const tBs=smpTrack('midi',{name:'シーケンス・ベース',tone:'waf_synth_bass',vol:-6,ci:2,fx:[['eq',{hp:30,low:1.5,mid:1,midf:900}],['rcomp',{thr:-20,ratio:4,gain:1.15}]],notes:bs,start:0,clip:'8分オクターブ',hum:false});
 const tAr=smpTrack('midi',{name:'アルペジオ',tone:'syn_pluck',vol:-13,pan:-.38,ci:0,fx:[['chorus',{mix:.25,rate:.6,depth:.3}],['pingpong',{time:.75,mix:.24,fb:.35}],SMPFX.plate(.18,1.6)],notes:ar,start:0,clip:'16分アルペジオ',hum:false});
 const tPd=smpTrack('midi',{name:'パッド',tone:'waf_pad_warm',vol:-16,pan:.3,ci:5,fx:[['chorus',{mix:.4}],SMPFX.hall(.3,3)],notes:pd,start:0,clip:'パッド'});
 const tCr=smpTrack('midi',{name:'クワイア',tone:'waf_choir',vol:-16,pan:-.12,ci:5,fx:[['phaser',{mix:.3,rate:.2,depth:.5,fb:.3}],SMPFX.hall(.34,3)],notes:cr,clip:"B と A' のクワイア"});
 const tLd=smpTrack('midi',{name:'リード',tone:'waf_lead_saw',vol:-8,pan:.05,ci:3,fx:[['chorus',{mix:.2,rate:.5,depth:.3}],['delay',{time:.75,mix:.2,fb:.32,tone:4000}],SMPFX.plate(.2,1.8)],notes:ld,clip:'メロディ',hum:false});
 const tBl=smpTrack('midi',{name:'FMベル',tone:'syn_bell',vol:-18,pan:.38,ci:6,fx:[['pingpong',{time:.5,mix:.2}],SMPFX.hall(.3,2.6)],notes:bell,clip:"A' のオクターブ重ね",hum:false});
 const tFx=smpTrack('midi',{name:'効果音',tone:'sfx',vol:-14,pan:0,ci:6,fx:[SMPFX.hall(.3,3)],notes:fxn,clip:'ライザー・インパクト',hum:false});
 smpMaster([['eq',{hp:28,low:1.5,mid:-.5,midf:500,high:2}],['rcomp',{thr:-18,ratio:2.5,att:.015,rel:.15,gain:1.25}],['tape',{drive:.04,wobble:.02,tone:12000}],['widener',{width:.3,mix:.4}],['limiter',{thr:-1.2,gain:1}]],0);
 smpFinish([C.g,tDr,tBs,tAr,tPd,tCr,tLd,tBl,tFx],null,tLd);
}

/* =====================================================================
   7. 80s アイドルポップ風オリジナル（歌もの・オリジナル歌詞）
   静かな「落ちサビ」→ ドラムのフィル → C から D♭ へ半音上げてラストサビ（ハモリつき）
   ===================================================================== */
const SMP_IDOL_LYR={a:['ゆうやけのうみで','はしゃぐきみのこえ','すなにかいたなまえ','なみがさらう'],b:['ことばにできなくて','むねのおくでゆれてる'],s:['ときめきさんせっと','ふたりだけ','このまましずまないで','すきよ']};
const SMP_IDOL_KANJI='（Aメロ）夕焼けの海で はしゃぐ君の声 砂に書いた名前 波がさらう\n（Bメロ）言葉にできなくて 胸の奥で揺れてる\n（サビ）ときめきサンセット ふたりだけ このまま沈まないで 好きよ';
function sampleIdol(){
 const SB=' Fmaj7 | G | Em7 | Am7 | Fmaj7 | G | C | C |',LS='ラストサビ（転調）';
 const C=smpBegin({name:'ときめきサンセット（80s アイドルポップ風）',bpm:140,swing:50,key:[0,'major'],seed:71,
  secs:[['イントロ',4,0],['Aメロ',8,1],['Bメロ',4,3],['サビ',8,4],['落ちサビ',4,5],['フィル',1,6],[LS,8,4],['アウトロ',4,0]],
  prog:'| Fmaj7 | G | Em7 | Am7 | C | Am7 | Dm7 | G7 | C | Am7 | Dm7 | G7 | Fmaj7 | G | Em7 Am7 | Dm7 G7 |'+SB+' Fmaj7 | G | Em7 | Am7 | Ab7 |'+smpTrProg(SB,1)+smpTrProg(' Fmaj7 G | C | Fmaj7 G | C |',1)});
 const {B,sec,chAt,inS}=C;
 const vo={leg:.9,v:84};
 const SABI=['C5:1.5 D5:.5 E5:1 C5:1 | D5:1.5 C5:.5 B4:1 G4:1','B4:1.5 C5:.5 D5:1 B4:1 | C5:3 r:1',
  'A4:.5 C5:.5 F5:1 E5:.5 D5:.5 C5:1 | D5:1 E5:.5 D5:.5 G5:2','E5:1.5 D5:.5 ~C5:2 | r:4'];
 const pa=smpPhrases(['r:.5 E4:.5 G4:.5 A4:.5 G4:1 E4:1 | C5:1.5 A4:.5 G4:2','r:.5 F4:.5 A4:.5 C5:.5 A4:1 F4:1 | D5:1.5 B4:.5 G4:2',
  'r:.5 E4:.5 G4:.5 A4:.5 G4:1 E4:1 | C5:1 D5:.5 E5:.5 C5:2','D5:1 C5:.5 A4:.5 F4:1 A4:1 | G4:3 r:1'],sec['Aメロ'].q0,vo);
 const pb=smpPhrases(['A4:.5 A4:.5 A4:.5 G4:.5 A4:1 C5:1 | B4:1.5 A4:.5 G4:2','G4:.5 G4:.5 G4:.5 E4:.5 G4:1 C5:1 | D5:2 r:.5 G4:.5 A4:.5 B4:.5'],sec['Bメロ'].q0,{...vo,v:86});
 const ps=smpPhrases(SABI,sec['サビ'].q0,{...vo,v:92});
 const po=smpPhrases(SABI.slice(0,2),sec['落ちサビ'].q0,{...vo,v:74,leg:.95});
 const pl=smpPhrases(SABI,sec[LS].q0,{...vo,v:96,tr:1});
 smpLyr(pa.groups,SMP_IDOL_LYR.a,'ia');smpLyr(pb.groups,SMP_IDOL_LYR.b,'ib');smpLyr(ps.groups,SMP_IDOL_LYR.s,'is');smpLyr(po.groups,SMP_IDOL_LYR.s.slice(0,2),'io');smpLyr(pl.groups,SMP_IDOL_LYR.s,'il');
 const voc=[...pa.notes,...pb.notes,...ps.notes,...po.notes,...pl.notes];voc.forEach(n=>n.v=smpH(n.v,4));
 const har=smpHarm(pl.notes,1,'major',2);
 S.sections.forEach(s=>{const k={'Aメロ':'a','Bメロ':'b','サビ':'s',[LS]:'s'}[s.name];if(k)s.lyr=SMP_IDOL_LYR[k].join('\n');if(s.name==='落ちサビ')s.lyr=SMP_IDOL_LYR.s.slice(0,2).join('\n')});
 const RIFF=['C6:.5 G5:.5 A5:.5 C6:.5 E6:1 D6:.5 C6:.5','B5:.5 G5:.5 A5:.5 B5:.5 D6:2','G5:.5 B5:.5 E6:.5 D6:.5 B5:1 G5:1','C6:.5 E6:.5 A6:1 G6:1 E6:1'];
 const bl=[...smpPhrases(RIFF,sec['イントロ'].q0,{leg:.85,v:82}).notes,...smpPhrases(['C6:.5 E6:.5 G6:1 F6:1 E6:1','C6:4','C6:.5 E6:.5 G6:1 F6:1 E6:1','~C6:4'],sec['アウトロ'].q0,{leg:.85,v:80,tr:1}).notes];
 const glk=bl.map(n=>({...n,v:n.v-14}));
 const quiet=q=>inS(q,'落ちサビ');
 const bs=[];for(let b=0;b<C.bars;b++){const s=b*B;
  if(b===C.bars-1){smpN(bs,smpLow(smpBassPc(chAt(s)),36),s,3.6,100);continue}
  if(quiet(s)){if(s>=sec['落ちサビ'].q0+2*B)smpN(bs,smpLow(smpBassPc(chAt(s)),33),s,3.8,70);continue}
  if(inS(s,'フィル')){[0,1.5,2,3,3.5].forEach(o=>smpN(bs,smpLow(smpBassPc(chAt(s)),33),s+o,.4,100));continue}
  for(let i=0;i<8;i++){const q=s+i/2,r=smpLow(smpBassPc(chAt(q)),33);smpN(bs,r+([2,6].includes(i)?12:0),q,i%2?.32:.44,smpH(i%2?78:96,4))}}
 const ep=[],pn=[];for(let b=0;b<C.bars;b++){const s=b*B;
  if(b===C.bars-1){smpVoice(chAt(s),57,4).forEach(p=>smpN(ep,p,s,3.8,64));continue}
  if(quiet(s)){const ch=chAt(s);smpN(pn,smpLow(smpBassPc(ch),36),s,3.9,58);smpVoice(ch,55,4).forEach((p,i)=>{smpN(pn,p,s+.5+i*.5,3.4-i*.5,smpH(48,3))});continue}
  if(inS(s,'フィル')){smpVoice(chAt(s),57,4).forEach(p=>smpN(ep,p,s,.5,80));continue}
  [[0,1.4],[1.5,.5],[2.5,.5],[3,.95]].forEach(([o,l])=>smpVoice(chAt(s+o),57,4).forEach(p=>smpN(ep,p,s+o,l,smpH(o?54:62,3))))}
 const st=[],br=[],oo=[];
 for(const nm of ['Bメロ','サビ','落ちサビ',LS]){const sc=sec[nm];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B,two=chAt(s).root!==chAt(s+2).root;for(const o of (two?[0,2]:[0]))smpVoice(chAt(s+o),60,4).forEach(p=>smpN(st,p,s+o,two?1.96:3.96,smpH(nm==='落ちサビ'?50:nm==='Bメロ'?54:62,3)))}}
 for(const nm of ['サビ',LS]){const sc=sec[nm];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;smpVoice(chAt(s),60,3).forEach(p=>smpN(br,p,s,.6,smpH(86,3)));if(b<sc.bars-1)smpVoice(chAt(s+B),60,3).forEach(p=>smpN(br,p,s+3.5,.4,smpH(80,3)));
  smpVoice(chAt(s),64,3).forEach(p=>smpN(oo,p,s,3.9,52))}}
 {const s=sec['フィル'].q0;smpVoice(chAt(s),60,3).forEach(p=>{[0,1.5].forEach(o=>smpN(br,p,s+o,.4,96));smpN(br,p,s+3,.9,100)})}
 const dr=[];
 for(let b=0;b<C.bars;b++){const s=b*B,last=b===C.bars-1,inSb=inS(s,'サビ',LS),secEnd=[sec['Aメロ'].q0,sec['Bメロ'].q0,sec['サビ'].q0,sec['アウトロ'].q0].includes(s+B);
  if(last){smpN(dr,36,s,.5,120);smpN(dr,49,s,3,112);continue}
  if(quiet(s)){if(s===sec['落ちサビ'].q0)smpN(dr,49,s,4,70);continue}
  if(inS(s,'フィル')){smpN(dr,36,s,.5,110);smpN(dr,49,s,2,100);[0,1.5].forEach(o=>smpN(dr,38,s+o,.4,110));for(let i=0;i<8;i++)smpN(dr,[50,50,47,47,45,45,43,43][i],s+2+i/4,.25,92+i*4);continue}
  [0,1.5,2].forEach(o=>smpN(dr,36,s+o,.5,smpH(110,3)));if(inSb)smpN(dr,36,s+3.5,.4,90);
  smpN(dr,38,s+1,.5,smpH(110,3));if(!secEnd)smpN(dr,38,s+3,.5,smpH(112,3));
  for(let i=0;i<8;i++)if(!(secEnd&&i>=6))smpN(dr,inSb&&i%2?46:42,s+i/2,.4,smpH(i%2?62:84,3));
  if(inSb)smpN(dr,54,s+1,.4,60),smpN(dr,54,s+3,.4,60);
  if([sec['Aメロ'].q0,sec['Bメロ'].q0,sec['サビ'].q0,sec[LS].q0].includes(s)||(inSb&&b%4===0))smpN(dr,49,s,2,112);
  if(secEnd)[3,3.25,3.5,3.75].forEach((o,i)=>smpN(dr,[50,50,47,43][i],s+o,.25,96+i*6));
 }
 const fxn=[{p:64,q:sec['フィル'].q0,l:B,v:90},{p:62,q:sec[LS].q0,l:2,v:90}];
 const tDr=smpTrack('drum',{name:'ドラム（80s）',tone:'kit_sd_LM-2',vol:-6,ci:1,fx:[['eq',{hp:30,low:1.5,high:2}],['rcomp',{thr:-18,ratio:3,att:.006,gain:1.15}],['reverb',{mix:.24,decay:1.4,pre:.01,tone:9000}]],notes:dr,start:0,clip:'8ビート',hum:false});
 const tBs=smpTrack('midi',{name:'ベース',tone:'waf_finger_bass',vol:-7,ci:2,fx:[['eq',{hp:35,low:1.5,mid:1,midf:800}],['rcomp',{thr:-20,ratio:4,gain:1.15}]],notes:bs,start:0,clip:'8分＋オクターブ'});
 const tEp=smpTrack('midi',{name:'エレピ',tone:'waf_epiano',vol:-13,pan:-.3,ci:0,fx:[['chorus',{mix:.4,rate:.6,depth:.4}],SMPFX.plate(.22,1.8)],notes:ep,start:0,clip:'バッキング'});
 const tPn=smpTrack('midi',{name:'ピアノ（落ちサビ）',tone:'smp_sal_hq',vol:-9,pan:-.1,ci:0,fx:[SMPFX.hall(.3,2.6)],notes:pn,clip:'落ちサビ'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_strings',vol:-16,pan:.3,ci:5,fx:[SMPFX.hall(.32,2.8)],notes:st,clip:'白玉'});
 const tBr=smpTrack('midi',{name:'ブラス',tone:'waf_brass',vol:-15,pan:.2,ci:4,fx:[SMPFX.plate(.22,1.8)],notes:br,clip:'サビのキメ'});
 const tOo=smpTrack('midi',{name:'コーラス',tone:'waf_oohs',vol:-18,pan:-.2,ci:5,fx:[SMPFX.hall(.34,2.8)],notes:oo,clip:'サビのウー'});
 const tBl=smpTrack('midi',{name:'ベル',tone:'syn_bell',vol:-13,pan:.35,ci:6,fx:[['delay',{time:.75,mix:.18,fb:.3}],SMPFX.hall(.26,2.4)],notes:bl,clip:'イントロ・リフ'});
 const tGk=smpTrack('midi',{name:'グロッケン（ベルの重ね）',tone:'waf_glock',vol:-17,pan:-.35,ci:6,fx:[SMPFX.hall(.28,2.4)],notes:glk,clip:'イントロ・リフ'});
 const tHa=smpTrack('midi',{name:'ハモリ（3度上・歌詞つき）',tone:'waf_oohs',vol:-15,pan:.2,ci:3,fx:[SMPFX.hall(.32,2.4)],notes:har,clip:'ラストサビのハモリ'});
 const tVo=smpTrack('midi',{name:'ボーカル（メロディ・歌詞つき）',tone:'tj_flute',vol:-5,pan:0,ci:3,fx:[['eq',{hp:180,mid:-1,midf:900,high:1.5}],SMPFX.glue(-22,2.5,1),['delay',{time:.75,mix:.1,fb:.25,tone:3500}],SMPFX.plate(.24,2)],notes:voc,clip:'歌メロ（歌詞つき）'});
 const tFx=smpTrack('midi',{name:'効果音',tone:'sfx',vol:-16,pan:0,ci:6,fx:[SMPFX.hall(.3,3)],notes:fxn,clip:'転調前',hum:false});
 smpMaster([['eq',{hp:28,low:1,mid:-.5,midf:400,high:2}],['rcomp',{thr:-18,ratio:2.5,att:.02,rel:.2,gain:1.25}],['exciter',{amount:.18,freq:6000}],['widener',{width:.25,mix:.35}],['reverb',{mix:.06,decay:2,pre:.02,tone:8000}],['limiter',{thr:-1.2,gain:1}]],4.9);
 smpFinish([C.g,tDr,tBs,tEp,tPn,tSt,tBr,tOo,tBl,tGk,tFx,tHa,tVo],tVo,tVo);
}

/* ---------- 一覧 ---------- */
const SAMPLE_SONGS=[
 {id:'edm',no:'デフォルト',name:'EDM デモ（ハイスピード）',meta:'150 BPM・A マイナー → B マイナー',desc:'ドロップ直前の一瞬の無音、ライザーとインパクト、ラストドロップで全音上へ転調する豪華な EDM（起動時の曲）',build:defaultSongEDM},
 {id:'trio',no:'1',name:'夕凪のテラス',meta:'76 BPM・F → G・スウィング 60%',desc:'生録フルートとナイロンギター・ウッドベース・ドラムのしっとりトリオ。フルートだけが駆けるブレイクから転調し、9th の和音で静かに終わる（インスト）',build:sampleTrio},
 {id:'rock',no:'2',name:'レッドライン・ランナー',meta:'138→168→100→176 BPM・Em → F#m',desc:'左右ダブルの疾走リフ。加速・急減速・再加速し、全員のキメから転調してツイン・リードのハモリへ（インスト）',build:sampleRock},
 {id:'carousel',no:'3',name:'回転木馬の午後',meta:'150 BPM・F → A♭・3/4 ワルツ',desc:'オルゴールで始まるワルツ。いったん止まりかけ、ハープのグリッサンドで A♭ に転調して加速しながら再び回り出す（インスト）',build:sampleCarousel},
 {id:'bossa',no:'4',name:'あの夏の坂道',meta:'132 BPM・G → A♭・歌詞あり',desc:'静かなボサノバ。テーマは「若き日の思い出と今の幸せ」。2番サビで半音転調、最後は偽終止に逸れてからタグで締める',build:sampleBossa},
 {id:'nocturne',no:'5',name:'夜想',meta:'約 60 BPM（ルバート）・E♭ メジャー',desc:'グランドピアノ独奏。中間部の頂点から右手のカデンツァ、再現の最後は ♭VI へ逸れる偽終止（インスト）',build:sampleNocturne},
 {id:'techno',no:'6',name:'ネオン・グリッド',meta:'126 BPM・Cm → Dm',desc:'80s テクノポップ風のオリジナル。全員の16分のキメ → 1小節のブレイク → 転調（インスト）',build:sampleTechno},
 {id:'idol',no:'7',name:'ときめきサンセット',meta:'140 BPM・C → D♭・歌詞あり',desc:'80s アイドルポップ風のオリジナル。静かな落ちサビからフィルで半音上げてラストサビへ（ハモリつき）',build:sampleIdol}];

function loadSample(id){
 const s=SAMPLE_SONGS.find(x=>x.id===id);if(!s)return false;
 if(S.playing)stop();
 resetEverything();
 try{if(typeof AE!=='undefined'&&AE.buses){AE.buses.forEach(b=>{try{b.g.disconnect()}catch(e){}});AE.buses.clear()}}catch(e){}
 if(typeof BUFS!=='undefined')BUFS.clear();
 S.tracks=[];S.sections=[];S.bars=16;
 s.build();
 ensureBars();
 S.tracks.forEach(t=>{if(t.type==='audio')t.monitor=false});
 afterStateReplace();
 HIST.stack=[];HIST.redo=[];HIST.last=projSnap();HIST.saved=HIST.last;
 applyAll();updateTitle();if(typeof setPos==='function')setPos(0);
 try{instPreload(S.tracks)}catch(e){}
 toast('サンプル曲を開きました: '+s.name);
 if(S.tracks.some(t=>t.smpVocal))setTimeout(()=>smpZunda({auto:true}),400);
 return true;
}
/* 「開く」: ファイル or サンプル曲 */
const _smpOpenFile=openProjectDialog;
openProjectDialog=function(){
 const guard=fn=>{checkHistory();if(HIST.last!==HIST.saved){
   openModal('未保存の変更があります',el('div',{},el('p',{},'保存せずにサンプル曲を開きますか？'),
    el('div',{style:'display:flex;gap:8px'},el('button',{class:'pri',onclick:()=>{closeModal();fn()}},'開く'),el('button',{onclick:closeModal},'キャンセル'))))}
  else{closeModal();fn()}};
 const list=el('div',{class:'smpList'},...SAMPLE_SONGS.map(s=>el('button',{class:'smpCard','data-id':s.id,onclick:()=>guard(()=>loadSample(s.id))},
  el('span',{class:'smpNo'},s.no),el('b',{},s.name),el('span',{class:'smpMeta'},s.meta),el('span',{class:'smpDesc'},s.desc))));
 openModal('開く',el('div',{},
  el('div',{style:'display:flex;gap:8px;align-items:center;margin-bottom:10px'},el('button',{class:'pri',id:'smpFile',onclick:()=>{closeModal();_smpOpenFile()}},'📂 ファイルから開く…'),el('span',{class:'dim'},'保存したプロジェクト（.dawproj.json）')),
  el('h4',{style:'margin:6px 0'},'サンプル曲'),list,
  el('p',{class:'dim',style:'font-size:12px;margin-top:8px'},'サンプル曲はすべてこのアプリ用のオリジナル曲です。開いたあとは自由に編集・保存できます。')));
 $('.modal').classList.add('wide');
};
/* =====================================================================
   サンプル曲（追加分）＋ ずんだもん（VOICEVOX）の歌声トラック自動生成
   バラード／パイプオルガン／ハチャメチャ／クールジャズ／アンビエント／モールス・テクノ
   ===================================================================== */
/* ---------- 追加の音色（WebAudioFont GeneralUser GS ほか）---------- */
for(const [id,file,name,gm] of [
 ['waf_church_organ','0190','チャーチオルガン（パイプ）',19],['waf_reed_organ','0200','リードオルガン',20],['waf_harpsichord','0060','チェンバロ',6],
 ['waf_clav','0070','クラビネット',7],['waf_xylo','0130','シロフォン',13],['waf_tuba','0580','チューバ',58],['waf_whistle','0780','口笛',78],
 ['waf_ocarina','0790','オカリナ',79],['waf_calliope','0820','カリオペ・リード',82],['waf_woodblock','1150','ウッドブロック',115],['waf_tinkle','1120','ティンクルベル',112],
 ['waf_pad_choir','0910','クワイア・パッド',91],['waf_pad_bowed','0920','ボウド・パッド',92],['waf_fx_crystal','0980','クリスタル',98],['waf_fx_atmos','0990','アトモスフィア',99]]){
 const url=GH('surikov/webaudiofontdata','sound/'+file+'_GeneralUserGS_sf2_file.js'),cat=gmCat(gm),local=isLocalUrl(url),pad=/パッド/.test(cat)||gm>=88&&gm<104||gm===19||gm===20;
 regTone({id,cat,name,desc:'WebAudioFont (GeneralUserGS)',eng:'waf',url,local,src:local?'local':'net',fb:fbFor(cat,name,gm),rel:pad?.8:.4,att:pad?.04:.004,loop:true});
}
regTone({id:'sine_beep',cat:'シンセ',name:'サイン波ビープ（モールス）',desc:'まじりけのないサイン波。モールス信号のような電子音',w:'sine',a:.002,d:.05,s:1,r:.012,f:14000,g:.3,src:'builtin'});

/* ---------- 共通の部品 ---------- */
/* ウォーキング・ベース（拍頭はルート、コードが変わる前は半音のアプローチ）*/
function smpWalk(C,s,L,lo,v){for(let k=0;k<4;k++){const q=s+k,ch=C.chAt(q),nx=C.chAt(q+1),start=k===0||!C.same(C.chAt(q-1),ch),chg=!C.same(nx,ch);
 let p;if(start)p=smpLow(smpBassPc(ch),lo);else if(chg){const t=smpLow(smpBassPc(nx),lo);p=k%2?t-1:t+1}else{const iv=smpIv(ch);p=smpLow(ch.root%12,lo)+(k===1?iv[1]:iv[2])}
 smpN(L,p,q,.9,smpH(start?(v||84):(v||84)-10,5))}}
/* コードに合うスケールの音（ソロ用スケールの1番目）*/
function smpScalePcs(ch){try{const id=scaleChoices('chord',ch)[0];return SOLO_SC[id].iv.map(i=>(ch.root+i)%12)}catch(e){return smpIv(ch).map(i=>(ch.root+i)%12)}}
/* ジャズのアドリブ風フレーズ（拍頭はコードの音・間はスケールの音や半音のつなぎ、2小節ごとに息つぎ）*/
function smpJazzLine(C,q0,bars,lo,hi,o={}){
 const out=[];let p=o.start||Math.round((lo+hi)/2),dir=1;
 for(let b=0;b<bars;b++){const s=q0+b*C.B,breath=(b%2===1);
  for(let k=0;k<8;k++){const q=s+k*.5;if(breath&&k>=6)break;if(k%2===1&&smpR()<(o.rest||.12))continue;
   const ch=C.chAt(q),ct=smpIv(ch).map(i=>(ch.root+i)%12),pool=k%2===0?ct:smpScalePcs(ch);
   if(smpR()<.2)dir=-dir;if(p>hi-3)dir=-1;if(p<lo+3)dir=1;
   let np=p;for(let d=1;d<=5;d++){const c=p+dir*d;if(pool.includes(((c%12)+12)%12)){np=c;break}}
   if(o.tri&&k%2===0&&smpR()<o.tri){[0,1,2].forEach(j=>out.push({p:np+(j===1?(dir>0?2:-1):0),q:q+j/6,l:.15,v:smpH(64,5)}));p=np;continue}
   out.push({p:np,q,l:k%2?.42:.48,v:smpH(k%2?60:72,5)});p=np;
   if(o.oct)out.push({p:np+12,q,l:k%2?.42:.48,v:smpH(k%2?52:62,5)});
  }}
 return out;
}
/* モールス信号（短点＝u、長点＝3u、文字の間＝3u、単語の間＝7u）*/
const SMP_MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..'};
function smpMorse(text,q0,u,p,v){const out=[];let q=q0;
 for(const w of String(text).split(' ')){if(!w){continue}for(const ch of w){const code=SMP_MORSE[ch];if(!code)continue;for(const s of code){const l=s==='.'?u:3*u;out.push({p,q,l:l*.92,v});q+=l+u}q+=2*u}q+=4*u}
 out.end=q;return out;}

/* =====================================================================
   8. バラード（歌もの）: ピアノ1本で始まり、少しずつ厚くなる。間奏にギターソロ、最後は全音上げて大サビ
   ===================================================================== */
const SMP_BALLAD_LYR={a1:['あめあがりのまちで','ひとりたちどまる','ちいさなこえが','わたしをよんだ'],s1:['ひかりのほうへ','あるいてく','なくしたゆめさえ','いだいて'],
 a2:['ふるいしゃしんのなか','わらうきみがいる','わすれないよと','ほしにちかうよ'],s2:['あしたのほうへ','てをのばす','かさねたひびさえ','いだいて']};
const SMP_BALLAD_KANJI='（Aメロ）雨上がりの街で ひとり立ち止まる 小さな声が 私を呼んだ\n（サビ）光の方へ 歩いてく なくした夢さえ 抱いて\n（Aメロ2）古い写真の中 笑う君がいる 忘れないよと 星に誓うよ\n（サビ2）明日の方へ 手をのばす 重ねた日々さえ 抱いて\n（大サビ）光の方へ 歩いてく なくした夢さえ 抱いて';
function sampleBallad(){
 const PA=' D | A/C# | Bm | Bm/A | G | D/F# | Em7 | A7sus4 A7 |',PS=' G | A/G | F#m7 | Bm7 | Em7 | A7sus4 A7 | D | Bb C |',BS='大サビ（転調）';
 const C=smpBegin({name:'ひかりの方へ（ピアノ・バラード）',bpm:72,swing:50,key:[2,'major'],seed:83,
  secs:[['イントロ',4,0],['Aメロ',8,1],['サビ',8,4],['Aメロ2',8,1],['サビ2',8,4],['ギターソロ',8,6],[BS,8,4],['アウトロ',4,0]],
  prog:'| D | Gmaj7 | D/F# | Em7 A7sus4 |'+PA+PS+PA+PS+' Bm | G | D | A | Bm | G | Em7 | A7sus4 A7 |'+smpTrProg(' G | A/G | F#m7 | Bm7 | Em7 | A7sus4 A7 | D | D |',2)+' A | E/G# | F#m7 B7sus4 | E |'});
 const {B,sec,chAt,inS}=C;
 const T=[{q:0,bpm:72}];smpRamp(T,sec['ギターソロ'].q1-1,sec['ギターソロ'].q1,72,64,.5);T.push({q:sec[BS].q0,bpm:72});smpRamp(T,sec['アウトロ'].q0+2*B,sec['アウトロ'].q1,72,50,1);smpTempo(T);
 const MA=['r:1 F#4:.5 A4:.5 A4:1 B4:.5 A4:.5 | A4:1.5 G4:.5 F#4:1 E4:1','r:1 D4:.5 F#4:.5 B4:1 C#5:.5 B4:.5 | B4:1.5 A4:.5 F#4:2',
           'r:1 G4:.5 G4:.5 B4:1 D5:1 | D5:1.5 C#5:.5 A4:2','r:.5 E4:.5 G4:.5 B4:.5 A4:1 G4:1 | F#4:2 E4:2'];
 const MS=['B4:1 D5:1 D5:1.5 E5:.5 | E5:1 D5:1 C#5:2','C#5:1 A4:1 C#5:1.5 D5:.5 | D5:3 r:1','B4:1 E5:1 E5:1.5 F#5:.5 | E5:1 D5:1 C#5:1 A4:1','D5:2 F#4:1 A4:1 | ~D5:4'];
 const vo={leg:.92,v:80};
 const p1=smpPhrases(MA,sec['Aメロ'].q0,vo),p2=smpPhrases(MS,sec['サビ'].q0,{...vo,v:86}),p3=smpPhrases(MA,sec['Aメロ2'].q0,{...vo,v:82}),p4=smpPhrases(MS,sec['サビ2'].q0,{...vo,v:90}),p5=smpPhrases(MS,sec[BS].q0,{...vo,v:96,tr:2});
 smpLyr(p1.groups,SMP_BALLAD_LYR.a1,'ba1');smpLyr(p2.groups,SMP_BALLAD_LYR.s1,'bs1');smpLyr(p3.groups,SMP_BALLAD_LYR.a2,'ba2');smpLyr(p4.groups,SMP_BALLAD_LYR.s2,'bs2');smpLyr(p5.groups,SMP_BALLAD_LYR.s1,'bs3');
 const voc=[...p1.notes,...p2.notes,...p3.notes,...p4.notes,...p5.notes];voc.forEach(n=>n.v=smpH(n.v+(n.l>=1.5?3:0),4));
 S.sections.forEach(s=>{const k={'Aメロ':'a1','サビ':'s1','Aメロ2':'a2','サビ2':'s2',[BS]:'s1'}[s.name];if(k)s.lyr=SMP_BALLAD_LYR[k].join('\n')});
 /* ピアノ: イントロは分散和音、歌に入ると4分の和音、大サビは8分で押す */
 const pr=[],pl=[];
 for(let b=0;b<C.bars;b++){const s=b*B,intro=inS(s,'イントロ','アウトロ'),big=inS(s,BS),last=b===C.bars-1;
  const lvl=inS(s,'Aメロ')?52:inS(s,'サビ')?58:inS(s,'Aメロ2')?60:inS(s,'サビ2','ギターソロ')?64:big?70:54;
  if(last){const ch=chAt(s),bs=smpLow(smpBassPc(ch),31);[bs,bs+12,bs+19,...smpVoice(ch,60,4),smpVoice(ch,60,4)[0]+12].forEach((p,i)=>smpN(i<3?pl:pr,p,s+i*.1,4,smpH(56-i,3)));continue}
  for(const h of [0,2]){const ch=chAt(s+h),bsn=smpLow(smpBassPc(ch),36),v=smpVoice(ch,59,4,false);
   smpN(pl,bsn-12,s+h,1.95,smpH(lvl,3));smpN(pl,bsn,s+h,1.95,smpH(lvl-6,3));
   if(intro){[v[0],v[1],v[2],v[3]].forEach((p,i)=>smpN(pr,p,s+h+i*.5,2-i*.5,smpH(lvl-4+i*2,3)));continue}
   if(big){for(let k=0;k<4;k++)v.slice(0,3).forEach(p=>smpN(pr,p,s+h+k*.5,.46,smpH(k%2?lvl-8:lvl,3)));continue}
   for(const k of [0,1])v.slice(0,3).forEach(p=>smpN(pr,p,s+h+k,.94,smpH(k?lvl-6:lvl,3)));
  }}
 /* ベース（サビから）・オルガン（サビから）・ストリングス（Aメロ2から）・クワイア（サビ2から）*/
 const bs=[],og=[],st=[],ch2=[],rg=[];
 for(let b=0;b<C.bars;b++){const s=b*B;if(!inS(s,'サビ','Aメロ2','サビ2','ギターソロ',BS))continue;
  for(const h of [0,2]){const ch=chAt(s+h),r=smpLow(smpBassPc(ch),31),big=inS(s,BS);
   if(big){for(let k=0;k<4;k++)smpN(bs,k===3?smpLow(smpBassPc(chAt(s+h+2)),31)-(k===3?0:0):r,s+h+k*.5,.45,smpH(k%2?74:86,4))}
   else{smpN(bs,r,s+h,1.4,smpH(84,4));smpN(bs,h?smpLow(smpBassPc(chAt(s+B)),31)-1:r+7,s+h+1.5,.45,smpH(66,4))}}
  smpVoice(chAt(s),55,4).forEach(p=>smpN(og,p,s,B*.99,inS(s,'サビ')?46:54));
  if(inS(s,'Aメロ2','サビ2','ギターソロ',BS))smpVoice(chAt(s),60,4).forEach(p=>smpN(st,p,s,B*.99,inS(s,BS)?66:54));
  if(inS(s,'サビ2',BS))smpVoice(chAt(s),62,3).forEach(p=>smpN(ch2,p,s,B*.99,inS(s,BS)?70:58));
  if(inS(s,'サビ2',BS)){for(let k=0;k<8;k++){const q=s+k/2,v=smpVoice(chAt(q),52,4);smpN(rg,v[k%4],q,.48,smpH(k%2?56:66,4))}}
 }
 /* 大サビでは ストリングスが高い対旋律 */
 {const sc=sec[BS];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B,v=smpVoice(chAt(s),76,3);smpN(st,b%2?v[2]:v[1],s,B*.98,smpH(70,3))}}
 /* ギターソロ（クリーンの音に ディストーション・エフェクト）*/
 const gs=smpPhrases(['F#5:1.5 E5:.5 D5:.5 B4:.5 D5:1','E5:2 D5:.5 B4:.5 G4:1','A4:.5 B4:.5 D5:.5 E5:.5 F#5:1 A5:1','~A5:3 G5:.25 F#5:.25 E5:.5',
  'F#5:.25 E5:.25 D5:.25 B4:.25 D5:.5 E5:.5 F#5:1 B5:1','D6:1.5 B5:.5 A5:.5 G5:.5 E5:1','G5:.5 F#5:.5 E5:.5 D5:.5 B4:1 D5:1','E5:2 C#5:1 A4:1'],sec['ギターソロ'].q0,{leg:.98,v:96}).notes;
 /* 装飾: 長い音の前に下からのスライド */
 gs.filter(n=>n.l>=1.4).forEach(n=>gs.push({p:n.p-2,q:n.q-.12,l:.12,v:n.v-16}));
 gs.push(...smpPhrases(['r:2 E6:2','~E6:4','r:2 B5:1 C#6:1','~E6:4'],sec[BS].q1-4*B,{leg:1,v:84}).notes);
 /* ドラム: Aメロ2 からクロススティック → サビ2 でフル → 大サビでさらに大きく */
 const dr=[],tb=[];
 for(let b=0;b<C.bars;b++){const s=b*B;if(!inS(s,'Aメロ2','サビ2','ギターソロ',BS))continue;
  const a2=inS(s,'Aメロ2'),big=inS(s,BS),secEnd=[sec['サビ2'].q0,sec['ギターソロ'].q0,sec[BS].q0,sec['アウトロ'].q0].includes(s+B);
  if([sec['サビ2'].q0,sec['ギターソロ'].q0,sec[BS].q0].includes(s)||(big&&b%2===0))smpN(dr,49,s,2,big?112:100);
  smpN(dr,36,s,.5,smpH(a2?70:96,4));smpN(dr,36,s+2.5,.5,smpH(a2?60:88,4));if(big)smpN(dr,36,s+2,.5,84);
  if(a2){smpN(dr,37,s+1,.4,smpH(64,4));smpN(dr,37,s+3,.4,smpH(68,4))}else{smpN(dr,38,s+1,.5,smpH(104,4));if(!secEnd)smpN(dr,38,s+3,.5,smpH(108,4))}
  for(let i=0;i<8;i++)if(!(secEnd&&i>=6))smpN(dr,inS(s,'ギターソロ')?51:big&&i%2?46:42,s+i/2,.4,smpH(i%2?(a2?34:56):(a2?48:76),4));
  if(secEnd)[3,3.25,3.5,3.75].forEach((o,i)=>smpN(dr,[50,48,45,43][i],s+o,.25,92+i*7));
  if(big){smpN(tb,54,s+1,.3,smpH(70,4));smpN(tb,54,s+3,.3,smpH(74,4));for(const o of [.5,1.5,2.5,3.5])smpN(tb,54,s+o,.2,smpH(44,4))}
 }
 const tP_R=smpTrack('midi',{name:'ピアノ（右手）',tone:'smp_sal_hq',vol:-5,pan:.12,ci:3,fx:[['eq',{hp:40,mid:-1,midf:400,high:1}],SMPFX.glue(-20,1.8),SMPFX.hall(.24,2.6)],notes:pr,start:0,clip:'和音'});
 const tP_L=smpTrack('midi',{name:'ピアノ（左手）',tone:'smp_sal_hq',vol:-6,pan:-.12,ci:0,fx:[['eq',{hp:30,mid:-1,midf:300}],SMPFX.hall(.24,2.6)],notes:pl,start:0,clip:'低音'});
 const tVo=smpTrack('midi',{name:'メインメロディ（歌詞つき）',tone:'tj_flute',vol:-7,pan:0,ci:3,fx:[['eq',{hp:160,high:1}],SMPFX.glue(-22,2.5),SMPFX.hall(.26,2.4)],notes:voc,clip:'歌メロ（歌詞つき）'});
 const tBs=smpTrack('midi',{name:'ベース',tone:'waf_finger_bass',vol:-8,pan:.05,ci:2,fx:[['eq',{hp:35,low:1.5,mid:-1,midf:500}],SMPFX.glue(-20,3)],notes:bs,clip:'ベース'});
 const tOg=smpTrack('midi',{name:'オルガン',tone:'waf_organ',vol:-19,pan:-.3,ci:0,fx:[['rotary',{speed:1.2,mix:.6}],SMPFX.hall(.3,2.6)],notes:og,clip:'オルガン'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_strings',vol:-15,pan:.32,ci:5,fx:[SMPFX.hall(.34,3)],notes:st,clip:'ストリングス'});
 const tCh=smpTrack('midi',{name:'クワイア',tone:'waf_choir',vol:-17,pan:-.22,ci:5,fx:[SMPFX.hall(.38,3.2)],notes:ch2,clip:'アー'});
 const tRg=smpTrack('midi',{name:'エレキギター（アルペジオ・クランチ）',tone:'waf_clean_gtr',vol:-15,pan:.42,ci:4,fx:[...SMPAMP(.3,{tone:4500,mid:1}),['delay',{time:.75,mix:.14,fb:.25}],SMPFX.hall(.22,2.2)],notes:rg,clip:'アルペジオ'});
 const tGs=smpTrack('midi',{name:'リードギター（ディストーション）',tone:'waf_lp_clean',vol:-6,pan:-.08,ci:3,fx:[...SMPAMP(.62,{tone:4200,mid:4,midf:1000,cab:6000}),['rcomp',{thr:-22,ratio:3,gain:1.1}],['delay',{time:.75,mix:.2,fb:.32,tone:3500}],SMPFX.plate(.26,2.2)],notes:gs,clip:'ギターソロ'});
 const tDr=smpTrack('drum',{name:'ドラム',tone:'kit_vd',vol:-9,ci:1,fx:[['eq',{hp:30,low:1.5,mid:-1,midf:450,high:1.5}],['rcomp',{thr:-18,ratio:3,att:.006,gain:1.1}],SMPFX.hall(.18,1.8)],notes:dr,clip:'バラード'});
 const tTb=smpTrack('drum',{name:'タンバリン',tone:'kit_wd_FluidR3_GM_sf2_file',vol:-17,pan:.3,ci:1,fx:[SMPFX.hall(.2,1.8)],notes:tb,clip:'大サビ'});
 smpMaster([['eq',{hp:28,low:.5,mid:-.5,midf:400,high:1.5}],['rcomp',{thr:-18,ratio:2,att:.02,rel:.25,gain:1}],['reverb',{mix:.06,decay:2.4,pre:.02,tone:8000}],['limiter',{thr:-1.2,gain:1}]],7.8);
 smpFinish([C.g,tDr,tTb,tBs,tP_L,tP_R,tOg,tSt,tCh,tRg,tGs,tVo],tVo,tVo);
}

/* =====================================================================
   9. パイプオルガン（インスト）: 重い和音の序奏 → 16分で駆けるトッカータ → フーガ → 足鍵盤のソロ → ピカルディの終止
   ===================================================================== */
function sampleOrgan(){
 const C=smpBegin({name:'大聖堂の前奏曲とフーガ（パイプオルガン）',bpm:46,swing:50,key:[7,'minor'],seed:97,
  secs:[['序奏（グラーヴェ）',4,0],['トッカータ',8,1],['フーガ',8,4],['頂点',4,6],['終結',4,5]],
  prog:'| Gm | Cm/Eb D7/F# | Gm Eb | Adim7 D7 | Gm | Gm | Cm/G | Gm | Eb | Cm | Am7b5 D7 | Gm | Gm | Gm | Dm | Dm A7 | Gm | Cm D7 | Eb Cm | D | Eb | Cm/Eb | Adim7 | D7 | Gm | Cm/G | Gm/D D7 | G |'});
 const {B,sec,chAt}=C,G0='序奏（グラーヴェ）';
 const T=[{q:0,bpm:46}];T.push({q:sec['トッカータ'].q0,bpm:88});T.push({q:sec['フーガ'].q0,bpm:80});T.push({q:sec['頂点'].q0,bpm:66});
 smpRamp(T,sec['頂点'].q1-2,sec['頂点'].q1,66,40,.5);T.push({q:sec['終結'].q0,bpm:54});smpRamp(T,sec['終結'].q0+2*B,sec['終結'].q1,54,32,1);smpTempo(T);
 const rh=[],lh=[],pd=[];
 const chordAll=(s,l,v,oct)=>{const ch=chAt(s);smpVoice(ch,62,4).forEach(p=>smpN(rh,p,s,l,v));smpVoice(ch,50,3).forEach(p=>smpN(lh,p,s,l,v-4));const r=smpLow(smpBassPc(ch),36);smpN(pd,r,s,l,v);if(oct)smpN(pd,r-12,s,l,v-6)};
 /* 序奏: 重厚な和音のロングトーン、最後は右手の上の声でトリル */
 {const q0=sec[G0].q0;chordAll(q0,4,92,true);chordAll(q0+B,2,90,true);chordAll(q0+B+2,2,92,true);chordAll(q0+2*B,2,90,true);chordAll(q0+2*B+2,2,94,true);chordAll(q0+3*B,2,94,true);
  const d7=q0+3*B+2;smpVoice(chAt(d7),50,3).forEach(p=>smpN(lh,p,d7,2,90));smpN(pd,38,d7,2,92);smpN(pd,26,d7,2,86);smpN(rh,66,d7,2,86);smpN(rh,72,d7,2,86);
  for(let i=0;i<14;i++)smpN(rh,i%2?82:81,d7+i*.125,.12,i%2?70:80);smpN(rh,81,d7+1.75,.25,84)}
 /* トッカータ: 右手は16分の分散和音と音階、左手は8分、足鍵盤は保続音から歩く */
 {const sc=sec['トッカータ'];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;
  for(let k=0;k<4;k++){const q=s+k,ch=chAt(q),v=smpVoice(ch,67,3),seq=[v[0],v[1],v[2],v[0]+12];
   if(b%2===0)(k%2?seq.slice().reverse():seq).forEach((p,i)=>smpN(rh,p,q+i/4,.24,smpH(i===0?84:72,4)));
   else{const pcs=[7,9,10,0,2,3,6].map(x=>x);const scl=[];let p=v[0]+(k%2?12:0);for(let i=0;i<4;i++){scl.push(p);let n=p+(k%2?-1:1);while(!pcs.includes(((n%12)+12)%12))n+=k%2?-1:1;p=n}scl.forEach((p,i)=>smpN(rh,p,q+i/4,.24,smpH(i===0?84:70,4)))}
   const lv=smpVoice(ch,50,3);[lv[0],lv[2]].forEach((p,i)=>smpN(lh,p,q+i/2,.46,smpH(76,4)));
  }
  if(b<2){if(b===0)smpN(pd,31,s,8,90),smpN(pd,43,s,8,88)}else for(let k=0;k<4;k++){const ch=chAt(s+k),r=smpLow(smpBassPc(ch),36);smpN(pd,k%2?r+7-(r+7>55?12:0):r,s+k,.9,smpH(84,4))}
 }}
 /* フーガ: 主題（右手）→ 応答（左手・属調）＋対旋律 → 足鍵盤に主題 → 終止 */
 {const sc=sec['フーガ'],SUBJ=['G4:.5 D5:.5 Bb4:.25 A4:.25 G4:.5 F#4:.5 G4:.25 A4:.25 Bb4:.5 C5:.5','D5:.25 C5:.25 Bb4:.25 A4:.25 G4:.5 Eb5:.5 D5:1 r:1'];
  rh.push(...smpPhrases(SUBJ,sc.q0,{leg:.94,v:84}).notes);
  lh.push(...smpPhrases(SUBJ,sc.q0+2*B,{leg:.94,v:80,tr:-5}).notes);
  rh.push(...smpPhrases(['F5:1 E5:.5 D5:.5 C#5:1 D5:1','E5:.5 F5:.5 G5:.5 F5:.5 E5:1 D5:.5 C#5:.5'],sc.q0+2*B,{leg:.95,v:78}).notes);
  pd.push(...smpPhrases(SUBJ,sc.q0+4*B,{leg:.95,v:90,tr:-24}).notes);
  for(let b=4;b<6;b++){const s=sc.q0+b*B;for(let k=0;k<4;k++){const q=s+k,ch=chAt(q),v=smpVoice(ch,67,3),seq=k%2?[v[2],v[1],v[0],v[1]]:[v[0],v[1],v[2],v[1]];seq.forEach((p,i)=>smpN(rh,p,q+i/4,.24,smpH(i?68:80,4)));smpVoice(ch,52,2).forEach((p,i)=>smpN(lh,p,q+i/2,.46,smpH(72,4)))}}
  rh.push(...smpPhrases(['Eb5:.5 G5:.5 Bb5:.5 G5:.5 C5:.5 Eb5:.5 G5:.5 Eb5:.5','D5:.25 C5:.25 Bb4:.25 A4:.25 Bb4:.25 A4:.25 G4:.25 F#4:.25 ~D5:2'],sc.q0+6*B,{leg:.94,v:84}).notes);
  lh.push(...smpPhrases(['C4:1 Bb3:1 A3:1 G3:1','F#3:2 ~A3:2'],sc.q0+6*B,{leg:.96,v:80}).notes);
  pd.push(...smpPhrases(['Eb2:2 C2:2','~D2:4'],sc.q0+6*B,{leg:.98,v:90}).notes);}
 /* 頂点: 付点リズムの重い和音、足鍵盤が16分で駆け上がる。最後の1拍は全休止 */
 {const sc=sec['頂点'];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B,ch=chAt(s);
  const hits=b===3?[[0,1.4],[1.5,.24],[1.75,1.2]]:[[0,1.4],[1.75,.24],[2,1.4],[3.75,.24]];
  for(const [o,l] of hits){smpVoice(ch,64,4).forEach(p=>smpN(rh,p,s+o,l,smpH(96,3)));smpVoice(ch,50,3).forEach(p=>smpN(lh,p,s+o,l,smpH(92,3)))}
  if(b===2){const ar=[45,48,51,54,57,54,51,48,45,48,51,54,57,60,63,66];ar.forEach((p,i)=>smpN(pd,p-12,s+i/4,.23,smpH(92,3)))}
  else if(b===3){smpN(pd,38,s,3,96);smpN(pd,26,s,3,92)}
  else{const r=smpLow(smpBassPc(ch),36);smpN(pd,r,s,3.9,94);smpN(pd,r-12,s,3.9,90)}}}
 /* 終結: 長い和音の中を内声が動き、最後はト長調（ピカルディの3度）で輝いて終わる */
 {const sc=sec['終結'],s=sc.q0;
  [[0,[70,74,79],[55,62],[31,43],4],[B,[72,75,79],[55,63],[31,43],4],[2*B,[70,74,79],[50,62],[38,50],2],[2*B+2,[69,72,78],[50,60],[38,50],2],[3*B,[71,74,79,83],[55,62,67],[31,43],5.5]].forEach(([o,r,l,p,len])=>{r.forEach(x=>smpN(rh,x,s+o,len,96));l.forEach(x=>smpN(lh,x,s+o,len,92));p.forEach(x=>smpN(pd,x,s+o,len,96))});
  lh.push(...smpPhrases(['D4:.5 C4:.5 Bb3:.5 A3:.5 G3:1 Bb3:1','C4:.5 D4:.5 Eb4:.5 D4:.5 C4:1 Bb3:1'],s,{leg:.96,v:74}).notes);}
 const ofx=()=>[['eq',{hp:24,low:1,mid:-1,midf:600,high:1.5}],['reverb',{mix:.42,decay:5.6,pre:.06,tone:6500}]];
 const tR=smpTrack('midi',{name:'第1鍵盤（右手）',tone:'waf_church_organ',vol:-6,pan:.18,ci:3,fx:ofx(),notes:rh,start:0,clip:'右手',hum:[.002,1]});
 const tL=smpTrack('midi',{name:'第2鍵盤（左手）',tone:'waf_church_organ',vol:-8,pan:-.18,ci:0,fx:ofx(),notes:lh,start:0,clip:'左手',hum:[.002,1]});
 const tP=smpTrack('midi',{name:'足鍵盤（ペダル）',tone:'waf_church_organ',vol:-5,pan:0,ci:2,fx:[['eq',{hp:20,low:2,mid:-1,midf:300,high:-1}],['reverb',{mix:.42,decay:5.6,pre:.06,tone:5500}]],notes:pd,start:0,clip:'ペダル',hum:[.002,1]});
 smpMaster([['eq',{hp:22,low:1,mid:-.5,midf:500,high:1}],['rcomp',{thr:-16,ratio:1.6,att:.03,rel:.4,gain:1}],['reverb',{mix:.14,decay:6,pre:.05,tone:6000}],['widener',{width:.3,mix:.35}],['limiter',{thr:-1.2,gain:1}]],3);
 smpFinish([C.g,tP,tL,tR],null,tR);
}

/* =====================================================================
   10. ハチャメチャ（歌もの・完全ドライ）: 2小節ごとに楽器も伴奏の型も入れ替わる。コードは遠くへ飛び、最後は転調してもっと速く
   ===================================================================== */
const SMP_CHAOS_LYR={a:['でたらめぱれーど','ねこがたいこうつ','かさがそらをとぶよ','おなべがうたいだす'],b:['ぐるぐるり','さかさまに','ほしがおどる','へんなひだ'],a2:['でたらめぱれーど','いぬがぴあのひく','くもはわたがしだよ','みんなでおどろうよ'],e:['おしまいだ']};
const SMP_CHAOS_KANJI='（A）でたらめパレード 猫が太鼓打つ 傘が空を飛ぶよ お鍋が歌い出す\n（B）ぐるぐるり さかさまに 星が踊る 変な日だ\n（A\'）でたらめパレード 犬がピアノ弾く 雲はわたがしだよ みんなで踊ろうよ\n（おしまい）おしまいだ';
function sampleChaos(){
 const PA=' C | Ab | E | Bb | Db | A | D7 | G7 |',SA="A'（転調）";
 const C=smpBegin({name:'でたらめパレード（ハチャメチャ）',bpm:132,swing:50,key:[0,'major'],seed:103,
  secs:[['イントロ',2,0],['A',8,1],['B',8,4],['ブレイク',2,6],[SA,8,2],['おしまい',2,5]],
  prog:'| C | F# |'+PA+' Fm6 | B7 | Em | C7 | Fmaj7 | Eb7 | Abmaj7 | G7 | E7 | Bb7 |'+smpTrProg(PA,3)+' Ab | C |'});
 const {B,sec,chAt,inS}=C;
 const T=[{q:0,bpm:132},{q:sec.B.q0,bpm:92},{q:sec['ブレイク'].q0,bpm:168},{q:sec[SA].q0,bpm:150}];smpRamp(T,sec['おしまい'].q0,sec['おしまい'].q1,150,84,1);smpTempo(T);
 const MA=['C5:.5 E5:.5 G5:1 r:.5 G5:.5 E5:1 | Eb5:1 C5:1 Ab4:2','B4:.5 B4:.5 G#4:1 E5:1 r:1 | D5:.5 F5:.5 Bb5:1 ~F5:2',
           'Ab4:.5 F4:.5 Db5:1 F5:.5 Ab5:.5 F5:1 | E5:1 C#5:1 A4:2','F#5:.5 F#5:.5 A5:.5 F#5:.5 D5:1 C5:1 | B4:1 D5:1 F5:1 r:1'];
 const MB=['Ab4:2 D5:2 | D#5:1 F#5:1 A5:2','G5:2 E5:1 B4:1 | Bb4:2 C5:2','A4:1 C5:1 E5:2 | Db5:1 Bb4:1 G4:2','C5:1 Eb5:1 G5:2 | F5:2 ~B4:2'];
 const vo={leg:.86,v:86};
 const pa=smpPhrases(MA,sec.A.q0,vo),pb=smpPhrases(MB,sec.B.q0,{...vo,leg:.95}),pa2=smpPhrases(MA,sec[SA].q0,{...vo,tr:3}),pe=smpPhrases(['r:1 C5:.5 C5:.5 Eb5:1 Ab5:1 | ~G5:2 r:2'],sec['おしまい'].q0,vo);
 smpLyr(pa.groups,SMP_CHAOS_LYR.a,'ca');smpLyr(pb.groups,SMP_CHAOS_LYR.b,'cb');smpLyr(pa2.groups,SMP_CHAOS_LYR.a2,'ca2');smpLyr(pe.groups,SMP_CHAOS_LYR.e,'ce');
 const voc=[...pa.notes,...pb.notes,...pa2.notes,...pe.notes];
 S.sections.forEach(s=>{const k={A:'a',B:'b',[SA]:'a2','おしまい':'e'}[s.name];if(k)s.lyr=SMP_CHAOS_LYR[k].join('\n')});
 /* 伴奏: 2小節ごとに「楽器」と「型」がガラッと変わる（同時に鳴るのは2〜3つまで）*/
 const P={tuba:[],toy:[],steel:[],harp:[],sitar:[],xylo:[],acc:[],kazoo:[],wood:[]},dr=[],fx=[];
 const band=(s,kind)=>{for(let bb=0;bb<2;bb++){const q0=s+bb*B,ch=chAt(q0),r=smpLow(smpBassPc(ch),36),v=smpVoice(ch,60,3);
  if(kind===0){smpN(P.tuba,r-12,q0,.5,96);smpN(P.tuba,r-5,q0+2,.5,90);[1,3].forEach(o=>v.forEach(p=>smpN(P.toy,p+12,q0+o,.3,74)));[0,2].forEach(o=>smpN(dr,36,q0+o,.3,100));[1,3].forEach(o=>smpN(dr,39,q0+o,.3,92))}
  if(kind===1){[.5,1.5,2.5,3.5].forEach(o=>v.forEach(p=>smpN(P.steel,p,q0+o,.35,84)));[0,.75,1.5,2,2.75,3.5].forEach(o=>smpN(dr,36,q0+o,.3,96));[1,3].forEach(o=>smpN(dr,56,q0+o,.3,88))}
  if(kind===2){for(let i=0;i<16;i++)smpN(P.harp,[v[0],v[1],v[2],v[1]][i%4]+(i>=8?12:0),q0+i/4,.22,i%4?66:82);[0,1.5,3].forEach(o=>smpN(P.wood,84,q0+o,.2,96));smpN(dr,36,q0,.3,100)}
  if(kind===3){smpN(P.sitar,r+12,q0,3.8,74);smpN(P.sitar,r+19,q0,3.8,64);[0,.5,1.5,2,3].forEach((o,i)=>smpN(dr,[50,47,45,47,43][i],q0+o,.3,88));smpN(dr,39,q0+3,.3,96)}
  if(kind===4){smpVoice(ch,55,4).forEach(p=>smpN(P.acc,p,q0,3.8,72));smpN(dr,36,q0,.4,100);smpN(dr,39,q0+2,.4,88)}}};
 [0,1,2,3].forEach(i=>band(sec.A.q0+i*2*B,i));
 [4,4,4,4].forEach((k,i)=>band(sec.B.q0+i*2*B,k));
 [2,0,3,1].forEach((k,i)=>band(sec[SA].q0+i*2*B,k));
 /* B: カズー風の合いの手とシロフォン */
 P.kazoo.push(...smpPhrases(['r:2 F5:.5 Ab5:.5 F5:1 | r:2 D#5:.5 B4:.5 F#5:1','r:2 E5:.5 G5:.5 B5:1 | r:2 E5:.5 G5:.5 Bb5:1','r:2 C5:.5 F5:.5 A5:1 | r:2 G5:.5 Bb5:.5 Db6:1','r:2 Eb5:.5 G5:.5 C6:1 | r:1 B4:.25 D5:.25 F5:.25 Ab5:.25 G5:2'],sec.B.q0,{leg:.8,v:80}).notes);
 for(let i=0;i<8;i++){const s=sec.B.q0+i*B,v=smpVoice(chAt(s),72,3);v.forEach((p,j)=>smpN(P.xylo,p,s+3+j/4,.2,70+j*6))}
 /* イントロ: 三全音の飛び（C → F#）を変な楽器の組み合わせで */
 {const s=sec['イントロ'].q0;smpVoice(chAt(s),60,3).forEach(p=>smpN(P.toy,p+12,s,1.5,90));smpN(P.tuba,24,s,1.5,100);smpVoice(chAt(s+B),60,3).forEach(p=>smpN(P.steel,p,s+B,1.5,90));smpN(P.tuba,30,s+B,1.5,100);
  fx.push({p:67,q:s+1.5,l:.5,v:90},{p:67,q:s+B+1.5,l:.5,v:90})}
 /* ブレイク: 全員止まって、効果音と口笛だけ */
 {const s=sec['ブレイク'].q0;fx.push({p:67,q:s,l:.5,v:100},{p:70,q:s+1,l:1,v:96},{p:67,q:s+2.5,l:.5,v:100},{p:68,q:s+B,l:1.5,v:96},{p:62,q:s+2*B-.5,l:.5,v:110});
  P.kazoo.push(...smpPhrases(['G#5:.25 B5:.25 D6:.25 F6:.25 r:1 E6:.5 r:.5 B5:.25 G#5:.25 r:.5','r:.5 F5:.25 D5:.25 r:.5 Bb5:2 r:.5'],s,{leg:.85,v:84}).notes)}
 /* おしまい: 全員で ジャーン（A♭ → C）*/
 {const s=sec['おしまい'].q0;for(const [o,k] of [[0,0],[B,1]]){const ch=chAt(s+o);smpVoice(ch,60,3).forEach(p=>{smpN(P.toy,p+12,s+o,3,96);smpN(P.steel,p,s+o,3,90);smpN(P.acc,p,s+o,3,86)});smpN(P.tuba,smpLow(smpBassPc(ch),36)-12,s+o,3,104);smpN(dr,49,s+o,3,110);smpN(dr,36,s+o,.4,120)}fx.push({p:62,q:s+B,l:2,v:110})}
 const dry=f=>[['eq',{hp:40,...f}]];
 const tVo=smpTrack('midi',{name:'メインメロディ（口笛・歌詞つき）',tone:'waf_whistle',vol:-6,pan:0,ci:3,fx:dry({high:1}),notes:voc,clip:'歌メロ（歌詞つき）'});
 const mk=(nm,tone,L,vol,pan,ci)=>smpTrack('midi',{name:nm,tone,vol,pan,ci,fx:dry({}),notes:L,clip:nm});
 const ts=[mk('チューバ','waf_tuba',P.tuba,-7,-.1,2),mk('おもちゃのピアノ（チェレスタ）','waf_celesta',P.toy,-10,.45,6),mk('スチールドラム','waf_steeldrum',P.steel,-10,-.45,4),
  mk('チェンバロ','waf_harpsichord',P.harp,-11,.35,0),mk('シタール','waf_sitar',P.sitar,-11,-.35,7),mk('アコーディオン','waf_accordion',P.acc,-12,.25,5),
  mk('シロフォン','waf_xylo',P.xylo,-12,-.5,6),mk('ウッドブロック','waf_woodblock',P.wood,-12,.55,1)];
 const tKz=smpTrack('midi',{name:'カズー風（合いの手）',tone:'syn_voice',vol:-10,pan:.3,ci:3,fx:[['robot',{pitch:180,metal:.35,ring:30,mix:.5}],['eq',{hp:200,mid:4,midf:1400}]],notes:P.kazoo.map(n=>({...n,lyr:'ぶ'})),clip:'合いの手'});
 const tDr=smpTrack('drum',{name:'リズムマシン（808）',tone:'kit_sd_TR-808',vol:-8,ci:1,fx:dry({low:1}),notes:dr,clip:'いろいろな型',hum:false});
 const tFx=smpTrack('midi',{name:'効果音（ビヨーン）',tone:'sfx',vol:-14,ci:6,fx:dry({}),notes:fx,clip:'効果音',hum:false});
 smpMaster([['eq',{hp:28,low:.5,mid:0,midf:1000,high:1.5}],['rcomp',{thr:-16,ratio:2,att:.02,rel:.2,gain:1}],['limiter',{thr:-1.2,gain:1}]],3);
 smpFinish([C.g,tDr,...ts,tKz,tFx,tVo],tVo,tVo,{dry:true});
}

/* =====================================================================
   11. クールジャズ（インスト）: ピアノ＋ブラシのドラム＋クリーンのジャズギター＋ウッドベース
   テーマはギターとピアノのオクターブ・ユニゾン → ピアノソロ → ギターソロ（オクターブ奏法）→ テーマ → リディアンの和音で終わる
   ===================================================================== */
function sampleCoolJazz(){
 const HA=' Fmaj9 | Bb13 | Am7 | D7b9 | Gm9 | C13 | Am7 D7#9 | Gm9 C7b9 |',HB=' Fmaj9 | Bb13 | Am7 | Abm7 Db9 | Gm9 | C7b9 | Fmaj9 | Fmaj9 |';
 const C=smpBegin({name:'真夜中のラウンジ（クールジャズ）',bpm:116,swing:64,key:[5,'major'],seed:107,
  secs:[['イントロ',4,0],['テーマ',8,1],["テーマ'",8,1],['ピアノソロ',8,4],['ギターソロ',8,6],['テーマ（再）',8,2],['エンディング',4,5]],
  prog:'| Gm9 | C13 | Am7 | D7b9 |'+HA+HB+HA+HA+HB+' Gm9 C13 | Am7 D7b9 | Gm9 C7b9 | Fmaj7#11 |'});
 const {B,sec,chAt,inS}=C;
 const T=[{q:0,bpm:116}];smpRamp(T,sec['エンディング'].q0+2*B,sec['エンディング'].q1,116,64,1);smpTempo(T);
 const MA=['r:.5 E5:.5 G5:.5 A5:.5 C6:1 A5:1','Ab5:1.5 G5:.5 F5:1 D5:1','r:.5 C5:.5 E5:.5 G5:.5 B5:1 A5:1','F#5:1.5 Eb5:.5 C5:1 A4:1','r:.5 Bb4:.5 D5:.5 F5:.5 A5:1 G5:1','E5:1.5 D5:.5 Bb4:1 G4:1','C5:1 E5:1 F#5:1 A5:1','G5:2 E5:1 Db5:1'];
 const MB=[...MA.slice(0,3),'B4:1 Eb5:1 F5:1 Ab5:1',MA[4],'E5:1 G5:1 Bb5:1 Db6:1','A5:2 E5:1 C5:1','~G5:4'];
 const head=(q0,list,v)=>smpPhrases(list,q0,{leg:.9,v}).notes;
 const pm=[...head(sec['テーマ'].q0,MA,80),...head(sec["テーマ'"].q0,MB,80),...head(sec['テーマ（再）'].q0,MB,84)];
 const gm=pm.map(n=>({...n,p:n.p-12,v:n.v-4}));
 /* ソロ（アドリブ風）*/
 const ps=smpJazzLine(C,sec['ピアノソロ'].q0,8,64,86,{start:72,tri:.15,rest:.12});
 const gsl=smpJazzLine(C,sec['ギターソロ'].q0,8,55,72,{start:62,oct:true,rest:.3});
 /* コンピング: ピアノの左手はルートなしのボイシング（チャールストン）、ギターはソロ以外で4分の刻み */
 const pc=[],gc=[];
 for(let b=0;b<C.bars;b++){const s=b*B;if(b===C.bars-1)continue;
  const pat=b%2?[[0,.9],[1.5,.4],[3,.4]]:[[0,.9],[1.5,.45],[2.5,.4]];
  if(!inS(s,'イントロ'))for(const [o,l] of pat)smpVoice(chAt(s+o+(o%1?.5:0)),52,4,true).forEach(p=>smpN(pc,p,s+o,l,smpH(inS(s,'ピアノソロ')?50:56,4)));
  else smpVoice(chAt(s),52,4,true).forEach((p,i)=>smpN(pc,p,s+i*.12,3.6,smpH(52,3)));
  if(inS(s,'ピアノソロ'))for(let k=0;k<4;k++)smpVoice(chAt(s+k),48,3,true).forEach(p=>smpN(gc,p,s+k,.6,smpH(k%2?40:46,3)));
 }
 if(true){const s=sec['イントロ'].q0;pm.push(...smpPhrases(['r:1 D5:.5 F5:.5 A5:1 C6:1','~E6:4','r:1 C5:.5 E5:.5 G5:1 B5:1','~A5:2 F#5:1 Eb5:1'],s,{leg:.95,v:66}).notes)}
 /* エンディング: 最後はリディアン（Fmaj7#11）の和音を転がして、ギターはハーモニクス風に高い音 */
 {const s=sec['エンディング'].q1-B;[29,41,57,64,67,71,76].forEach((p,i)=>smpN(i<2?pc:pc,p,s+i*.1,4,smpH(60-i*2,2)));smpN(gc,81,s+.8,3.2,56);smpN(gc,88,s+1,3,50)}
 const bs=[];for(let b=0;b<C.bars;b++){const s=b*B;if(b===C.bars-1){smpN(bs,29,s,4,72);continue}if(inS(s,'イントロ')){smpN(bs,smpLow(smpBassPc(chAt(s)),31),s,1.8,70);smpN(bs,smpLow(smpBassPc(chAt(s+2)),31)+7,s+2,1.8,64);continue}smpWalk(C,s,bs,31,82)}
 /* ドラム（ブラシ風）: スネアは弱いタップを細かく回し、2・4拍で少し強く。シュッという擦りは効果音を柔らかく */
 const br=[],sw=[],cy=[];
 for(let b=0;b<C.bars;b++){const s=b*B;if(inS(s,'イントロ')&&b<2)continue;
  if(b===C.bars-1){smpN(cy,51,s,4,56);smpN(cy,36,s,.4,40);continue}
  for(let i=0;i<16;i++){const a=i%8===4;smpN(br,38,s+i/4,.2,smpH(a?46:16+(i%2?0:6),4))}
  smpN(sw,63,s,1.9,smpH(54,4));smpN(sw,63,s+2,1.9,smpH(50,4));
  [[0,1],[1,.85],[1.5,.55],[2,1],[3,.85],[3.5,.55]].forEach(([o,m])=>smpN(cy,51,s+o,.5,smpH(46*m+(o%2===1?4:0),3)));
  smpN(cy,44,s+1,.4,smpH(38,3));smpN(cy,44,s+3,.4,smpH(40,3));smpN(cy,36,s,.4,smpH(30,3));
  if(inS(s,'ギターソロ','テーマ（再）')&&b%4===3)smpN(br,38,s+3.5,.3,62);
 }
 const tPm=smpTrack('midi',{name:'ピアノ（テーマ・ソロ）',tone:'smp_sal_hq',vol:-6,pan:.18,ci:3,fx:[['eq',{hp:40,mid:-1,midf:350,high:.5}],SMPFX.glue(-20,1.8),SMPFX.room(.18)],notes:[...pm,...ps],clip:'テーマとソロ'});
 const tPc=smpTrack('midi',{name:'ピアノ（左手のコンピング）',tone:'smp_sal_hq',vol:-10,pan:.08,ci:0,fx:[SMPFX.room(.18)],notes:pc,start:0,clip:'コンピング'});
 const tGm=smpTrack('midi',{name:'ジャズギター（クリーン）',tone:'waf_jazz_gtr',vol:-7,pan:-.32,ci:4,fx:[['eq',{hp:90,low:1,mid:-1.5,midf:900,high:-2}],SMPFX.glue(-20,2),SMPFX.room(.16)],notes:[...gm,...gsl],clip:'テーマ（オクターブ下）とソロ'});
 const tGc=smpTrack('midi',{name:'ジャズギター（刻み）',tone:'waf_jazz_gtr',vol:-15,pan:-.45,ci:4,fx:[['eq',{hp:100,high:-3}],SMPFX.room(.14)],notes:gc,clip:'4分の刻み'});
 const tBs=smpTrack('midi',{name:'ウッドベース',tone:'waf_ac_bass',vol:-6,pan:.1,ci:2,fx:[['eq',{hp:35,low:1.5,mid:-1,midf:450}],SMPFX.glue(-20,3)],notes:bs,start:0,clip:'ウォーキング'});
 const tBr=smpTrack('drum',{name:'ブラシ（スネア）',tone:'kit_vd',vol:-12,pan:-.05,ci:1,fx:[['filter',{type:0,freq:3800,q:.6}],SMPFX.room(.2)],notes:br,clip:'ブラシのタップ',hum:[.006,3]});
 const tSw=smpTrack('midi',{name:'ブラシ（スウィッシュ）',tone:'sfx',vol:-30,pan:-.05,ci:1,fx:[['filter',{type:0,freq:2200,q:.5}],['eq',{hp:400}],SMPFX.room(.2)],notes:sw,clip:'シュッ',hum:false});
 const tCy=smpTrack('drum',{name:'ライド＆ハット',tone:'kit_vd',vol:-14,pan:.12,ci:1,fx:[['eq',{hp:60,high:-1}],SMPFX.room(.2)],notes:cy,clip:'ライド'});
 smpMaster([['eq',{hp:28,low:.5,mid:-.5,midf:350,high:1}],['rcomp',{thr:-18,ratio:1.8,att:.03,rel:.3,gain:1}],['tape',{drive:.04,wobble:.02,tone:11000}],['reverb',{mix:.06,decay:1.8,pre:.015,tone:7500}],['limiter',{thr:-1.2,gain:1}]],5);
 smpFinish([C.g,tBr,tSw,tCy,tBs,tPc,tGc,tPm,tGm],null,tPm);
}

/* =====================================================================
   12. アンビエント（インスト）: 冷たく澄んだリディアンの響き、シマー・リバーブ、重なり合う声。頂で ♭VI に光が差す
   ===================================================================== */
function sampleAmbient(){
 const W2=' Dmaj9 | E/D | Bm9 | A/C# | Gmaj7#11 | E/G# | Asus4 | A |';
 const C=smpBegin({name:'極光（アンビエント）',bpm:64,swing:50,key:[2,'major'],seed:113,
  secs:[['氷原',8,0],['揺らめき',8,1],['光の帯',8,4],['頂',8,6],['余韻',8,5]],
  prog:'| Dmaj9 | Dmaj9 | E/D | E/D | Bm9 | Bm9 | Gmaj7#11 | Asus4 |'+W2+W2+' Gmaj7#11 | A | Bm9 | F#m7 | Gmaj7#11 | A | Dmaj9 | Bbmaj7#11 | Cmaj7#11 | Cmaj7#11 | Dmaj9 | Dmaj9 | E/D | E/D | Dmaj9 | Dmaj9 |'});
 const {B,sec,chAt,inS}=C;
 const T=[{q:0,bpm:64}];smpRamp(T,sec['余韻'].q1-2*B,sec['余韻'].q1,64,52,1);smpTempo(T);
 /* ドローン（D と A）とパッド（広い配置）*/
 const dn=[],pd=[];for(let b=0;b<C.bars;b+=4){const s=b*B;smpN(dn,26,s,4*B,64);smpN(dn,38,s,4*B,58);smpN(dn,45,s,4*B,50)}
 for(let b=0;b<C.bars;b++){const s=b*B,ch=chAt(s),r=smpLow(smpBassPc(ch),48),v=smpVoice(ch,62,4,true);[r,r+7,...v].forEach(p=>smpN(pd,p,s,B*1.02,smpH(inS(s,'頂')?64:52,3)))}
 /* ハープ: 2オクターブ上がって下りる8分のアルペジオ（揺らめきから）*/
 const hp=[];for(let b=sec['揺らめき'].q0/B;b<sec['余韻'].q0/B+4;b++){const s=b*B,v=smpVoice(chAt(s),55,4),seq=[v[0],v[1],v[2],v[3],v[0]+12,v[1]+12,v[2]+12,v[3]+12];seq.forEach((p,i)=>smpN(hp,p,s+i/2,1.6,smpH(48+(i<4?i*3:(7-i)*3),3)))}
 /* ベル（チェレスタ）: 氷のかけらのように、ときどき高い音がこぼれる */
 const bl=[];for(let b=0;b<C.bars;b++){if(!inS(b*B,'氷原','光の帯','余韻'))continue;const s=b*B,pcs=smpScalePcs(chAt(s));for(let k=0;k<3;k++){if(smpR()<.45)continue;const q=s+Math.floor(smpR()*8)/2;let p=79+Math.floor(smpR()*12);while(!pcs.includes(p%12))p++;smpN(bl,p,q,1.5,smpH(52,6))}}
 /* 声: 主旋律（クワイア）＋4度下と1オクターブ下を重ねた「ウー」 */
 const MEL=['F#5:4','G#5:2 E5:2','F#5:3 D5:1','C#5:4','B4:2 D5:2','E5:2 G#5:2','A5:3 E5:1','~E5:4'];
 const MEL2=['B4:2 C#5:2','~A4:4','B4:2 F#4:2','A4:3 C#5:1','D5:2 C#5:2','~E5:4','F#5:4','~F5:4'];
 const cm=[...smpPhrases(MEL,sec['光の帯'].q0,{leg:1,v:70}).notes,...smpPhrases(MEL2,sec['頂'].q0,{leg:1,v:82}).notes];
 const oo=cm.flatMap(n=>[{...n,p:n.p-5,v:n.v-14},{...n,p:n.p-12,v:n.v-12}]);
 /* ストリングス（光の帯と頂）・遠い太鼓（頂の頭）*/
 const st=[],tk=[];for(let b=sec['光の帯'].q0/B;b<sec['余韻'].q0/B;b++){const s=b*B;smpVoice(chAt(s),50,4).forEach(p=>smpN(st,p,s,B*1.01,smpH(inS(s,'頂')?70:56,3)))}
 for(let b=0;b<8;b+=2){const s=sec['頂'].q0+b*B;smpN(tk,43,s,1,72);smpN(tk,41,s+.02,1,64);smpN(tk,49,s,4,40)}
 const shim=(m)=>['shimmer',{mix:m,decay:6,fb:.5,shift:12}];
 const tDn=smpTrack('midi',{name:'ドローン（D・A）',tone:'waf_pad_warm',vol:-16,ci:2,fx:[['eq',{hp:28,low:1,mid:-3,midf:300}],SMPFX.hall(.4,6)],notes:dn,start:0,clip:'ドローン',hum:false});
 const tPd=smpTrack('midi',{name:'パッド（ヘイロー）',tone:'waf_pad_halo',vol:-15,pan:-.15,ci:5,fx:[['eq',{hp:120,mid:-2,midf:350,high:2}],shim(.32),['widener',{width:.7,mix:.7}],SMPFX.hall(.45,6)],notes:pd,start:0,clip:'パッド',hum:false});
 const tHp=smpTrack('midi',{name:'ハープ',tone:'waf_harp',vol:-14,pan:.3,ci:4,fx:[['pingpong',{time:.75,mix:.3,fb:.45,tone:5000}],SMPFX.hall(.42,5)],notes:hp,clip:'アルペジオ'});
 const tBl=smpTrack('midi',{name:'チェレスタ（氷のベル）',tone:'waf_celesta',vol:-15,pan:-.4,ci:6,fx:[['pingpong',{time:1.5,mix:.4,fb:.5,tone:7000}],shim(.45),SMPFX.hall(.5,6)],notes:bl,clip:'こぼれる音'});
 const tCm=smpTrack('midi',{name:'クワイア（主旋律）',tone:'waf_choir',vol:-9,pan:.05,ci:3,fx:[['eq',{hp:180,mid:-1.5,midf:500,high:2}],shim(.3),SMPFX.hall(.5,6)],notes:cm,clip:'アー'});
 const tOo=smpTrack('midi',{name:'声の重なり（4度下・オクターブ下）',tone:'waf_oohs',vol:-15,pan:-.25,ci:5,fx:[shim(.35),SMPFX.hall(.55,6)],notes:oo,clip:'ウー'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_slow_strings',vol:-15,pan:.35,ci:5,fx:[['eq',{hp:80,mid:-2,midf:400,high:1}],SMPFX.hall(.45,5)],notes:st,clip:'ストリングス'});
 const tTk=smpTrack('drum',{name:'遠い太鼓',tone:'kit_vd',vol:-16,ci:1,fx:[['filter',{type:0,freq:1800,q:.6}],SMPFX.hall(.6,6)],notes:tk,clip:'頂'});
 smpMaster([['eq',{hp:26,low:0,mid:-1.5,midf:320,high:2.5}],['rcomp',{thr:-18,ratio:1.6,att:.05,rel:.5,gain:1}],['widener',{width:.45,mix:.5}],['reverb',{mix:.14,decay:6,pre:.04,tone:8000}],['limiter',{thr:-1.2,gain:1}]],8);
 smpFinish([C.g,tTk,tDn,tPd,tSt,tHp,tBl,tOo,tCm],null,tCm);
}

/* =====================================================================
   13. モールス（歌もの・完全ドライ）: サイン波のモールス信号＋808。サビの合いの手は本物の「SOS」
   ===================================================================== */
const SMP_MORSE_LYR={a:['こちらきち','きこえるか','ほしのうみ','そのむこう','あとすこし','とどけたい','いそいでつうしん'],s:['いそいでつうしん','えすおーえす','ひかりのしんごう','とどいてよ']};
const SMP_MORSE_KANJI='（Aメロ）こちら基地 聞こえるか 星の海 その向こう あと少し 届けたい 急いで通信\n（サビ）急いで通信 SOS 光の信号 届いてよ';
function sampleMorse(){
 const PS=' Db | Eb | Cm | Fm | Db | Eb | C | C |';
 const C=smpBegin({name:'いそいで通信（モールス・テクノ）',bpm:128,swing:50,key:[5,'minor'],seed:127,
  secs:[['イントロ',4,0],['Aメロ',8,1],['サビ',8,4],['ブレイク（SOS）',4,6],['ラストサビ',8,4],['アウトロ',4,5]],
  prog:'| Fm | Fm | Db | Eb | Fm | Fm | Db | Eb | Fm | Fm | Db | C |'+PS+' Fm | Fm | Fm | C |'+PS+' Fm | Db | Eb | Fm |'});
 const {B,sec,chAt,inS}=C;
 const MA=['C5:.5 C5:.5 C5:.5 Ab4:.5 C5:1 r:1','Eb5:.5 Eb5:.5 C5:.5 Bb4:.5 Ab4:1 r:1','Ab4:.5 Ab4:.5 F4:.5 Ab4:.5 Db5:1 r:1','Bb4:.5 Bb4:.5 G4:.5 Bb4:.5 Eb5:1 r:1',
           'C5:.5 C5:.5 C5:.5 Ab4:.5 C5:1 r:1','F5:.5 Eb5:.5 C5:.5 Ab4:.5 F4:1 r:1','F4:.5 Ab4:.5 Db5:.5 F5:.5 Eb5:1 Db5:1 | E5:1 C5:1 r:2'];
 const MS=['F5:1.5 Eb5:.5 F5:1 Ab5:1 | G5:1.5 F5:.5 Eb5:1 Bb4:1','C5:1 Eb5:.5 G5:.5 C6:1 Bb5:1 | Ab5:3 r:1','F5:1.5 Eb5:.5 F5:1 Ab5:1 | Bb5:1.5 Ab5:.5 G5:1 Eb5:1','E5:1 G5:1 C6:1 Bb5:1 | C6:3 r:1'];
 const vo={leg:.7,v:88};
 const pa=smpPhrases(MA,sec['Aメロ'].q0,vo),ps=smpPhrases(MS,sec['サビ'].q0,{...vo,leg:.85,v:92}),pl=smpPhrases(MS,sec['ラストサビ'].q0,{...vo,leg:.85,v:96});
 smpLyr(pa.groups,SMP_MORSE_LYR.a,'ma');smpLyr(ps.groups,SMP_MORSE_LYR.s,'ms');smpLyr(pl.groups,SMP_MORSE_LYR.s,'ml');
 const voc=[...pa.notes,...ps.notes,...pl.notes];
 S.sections.forEach(s=>{const k={'Aメロ':'a','サビ':'s','ラストサビ':'s'}[s.name];if(k)s.lyr=SMP_MORSE_LYR[k].join('\n')});
 /* モールス: イントロ「CQ CQ」、Aメロ「HURRY」、サビ「SOS」、ブレイク「SOS SOS」と「K（どうぞ）」、アウトロは送信終わりの「AR」*/
 const mo=[],mo2=[],u=.25;
 const put=(L,txt,q0,p,v)=>{const m=smpMorse(txt,q0,u,p,v);L.push(...m);return m.end};
 put(mo,'CQ CQ',sec['イントロ'].q0,84,92);
 for(let i=0;i<2;i++)put(mo2,'HURRY',sec['Aメロ'].q0+i*4*B,91,62);
 for(const nm of ['サビ','ラストサビ'])for(let i=0;i<4;i++)put(mo,'SOS',sec[nm].q0+i*2*B+.5,84,90);
 {let q=sec['ブレイク（SOS）'].q0;q=put(mo,'SOS',q,84,100);q=put(mo,'SOS',q+.5,88,104);put(mo2,'K',q+.25,91,86)}
 put(mo,'AR',sec['アウトロ'].q0+2*B,84,96);
 /* 808: キック・クラップ・ハット・カウベル、ブレイクは心臓の鼓動のようなキックだけ */
 const dr=[],bs=[],stb=[];
 for(let b=0;b<C.bars;b++){const s=b*B,intro=inS(s,'イントロ'),brk=inS(s,'ブレイク（SOS）'),sabi=inS(s,'サビ','ラストサビ'),out=inS(s,'アウトロ'),last=b===C.bars-1;
  if(last){smpN(dr,36,s,.5,120);smpN(dr,49,s,3,96);smpN(bs,smpLow(smpBassPc(chAt(s)),29),s,3,110);continue}
  if(brk){smpN(dr,36,s,.5,110);smpN(dr,36,s+.75,.5,80);if(b===sec['ブレイク（SOS）'].q1/B-1)for(let i=0;i<8;i++)smpN(dr,39,s+2+i/4,.2,60+i*8);continue}
  for(let i=0;i<16;i++)if(!intro||b>=2)smpN(dr,42,s+i/4,.2,i%4===2?92:i%2?46:64);
  if(intro){if(b>=2)smpN(dr,36,s,.5,100);continue}
  const kicks=sabi?[0,1,2,3]:[0,.75,2,2.5];kicks.forEach(o=>smpN(dr,36,s+o,.5,112));
  [1,3].forEach(o=>smpN(dr,39,s+o,.4,104));
  if(sabi)[.5,1.5,2.5,3.5].forEach(o=>smpN(dr,46,s+o,.3,70));
  if(b%2===1)[1.75,3.25].forEach(o=>smpN(dr,56,s+o,.25,80));
  if(!out){const r=smpLow(smpBassPc(chAt(s)),29);kicks.forEach(o=>smpN(bs,smpLow(smpBassPc(chAt(s+o)),29),s+o,sabi?.45:.7,104))}
  else smpN(bs,smpLow(smpBassPc(chAt(s)),29),s,3.8,100);
  if(sabi)[.5,1.5,2.5,3.5].forEach(o=>smpVoice(chAt(s+o),60,3).forEach(p=>smpN(stb,p,s+o,.18,80)));
 }
 const D=f=>[['eq',{hp:30,...f}]];
 const tVo=smpTrack('midi',{name:'メインメロディ（ロボ声・歌詞つき）',tone:'syn_voice',vol:-6,pan:0,ci:3,fx:[['robot',{pitch:140,metal:.5,ring:40,mix:.55}],['eq',{hp:180,mid:2,midf:1600}]],notes:voc,clip:'歌メロ（歌詞つき）',hum:false});
 const tMo=smpTrack('midi',{name:'モールス信号（サイン波）',tone:'sine_beep',vol:-11,pan:.18,ci:6,fx:D({}),notes:mo,start:0,clip:'CQ・SOS・AR',hum:false});
 const tMo2=smpTrack('midi',{name:'モールス信号（遠い局）',tone:'sine_beep',vol:-18,pan:-.45,ci:6,fx:[['eq',{hp:600}],['filter',{type:2,freq:1500,q:2}]],notes:mo2,clip:'HURRY・QRT',hum:false});
 const tDr=smpTrack('drum',{name:'TR-808',tone:'kit_sd_TR-808',vol:-6,ci:1,fx:[...D({low:1.5,high:1}),['rcomp',{thr:-16,ratio:3,att:.004,gain:1.1}]],notes:dr,start:0,clip:'808',hum:false});
 const tBs=smpTrack('midi',{name:'808ベース',tone:'syn_808',vol:-6,ci:2,fx:D({low:1}),notes:bs,clip:'808ベース',hum:false});
 const tSt=smpTrack('midi',{name:'シンセ・スタブ',tone:'syn_pluck',vol:-15,pan:-.2,ci:0,fx:D({high:1}),notes:stb,clip:'裏打ち',hum:false});
 smpMaster([['eq',{hp:26,low:1,mid:-.5,midf:450,high:1.5}],['rcomp',{thr:-16,ratio:2.5,att:.01,rel:.15,gain:1}],['limiter',{thr:-1.2,gain:1}]],2);
 smpFinish([C.g,tDr,tBs,tSt,tMo,tMo2,tVo],tVo,tVo,{dry:true});
}

SAMPLE_SONGS.push(
 {id:'ballad',no:'8',name:'ひかりの方へ',meta:'72 BPM・D → E・歌詞あり＋ずんだもん',desc:'ピアノ1本で始まり、ベース・オルガン・ドラム・ストリングス・クワイアと少しずつ厚くなるバラード。間奏はギターソロ、最後は全音上げて大サビ',build:sampleBallad},
 {id:'organ',no:'9',name:'大聖堂の前奏曲とフーガ',meta:'46〜88 BPM・G マイナー → G メジャー',desc:'パイプオルガン。重厚な和音の序奏、16分で駆けるトッカータ、主題を受け渡すフーガ、足鍵盤の駆け上がり、ピカルディの3度で終わる（インスト）',build:sampleOrgan},
 {id:'chaos',no:'10',name:'でたらめパレード',meta:'132→92→168→150 BPM・転調だらけ・完全ドライ',desc:'2小節ごとに楽器も伴奏の型も入れ替わる、規格外のハチャメチャ曲。チューバ・おもちゃのピアノ・スチールドラム・シタール…（歌詞あり＋ずんだもん）',build:sampleChaos},
 {id:'cooljazz',no:'11',name:'真夜中のラウンジ',meta:'116 BPM・F メジャー・スウィング 64%',desc:'ピアノとブラシのドラムが中心のクールジャズ。テーマはギターとピアノのオクターブ・ユニゾン、ピアノソロ、ギターのオクターブ奏法ソロ（インスト）',build:sampleCoolJazz},
 {id:'ambient',no:'12',name:'極光',meta:'64 BPM・D リディアン',desc:'オーロラを眺めるような冷たく壮大なアンビエント。シマー・リバーブ、重なり合う声、ハープ、氷のようなベル。頂で ♭VI の光が差す（インスト）',build:sampleAmbient},
 {id:'morse',no:'13',name:'いそいで通信',meta:'128 BPM・F マイナー・完全ドライ',desc:'サイン波のモールス信号（CQ・HURRY・SOS・AR を本物の符号で）と TR-808 のテクノ。歌詞のテーマは「急いで通信」（歌詞あり＋ずんだもん）',build:sampleMorse});

/* =====================================================================
   ずんだもん（VOICEVOX）の歌声トラック: 歌詞つきのメインメロディから自動で作る
   VOICEVOX を起動していなければ「未生成」のトラックを置き、あとから作り直せる
   ===================================================================== */
async function smpZunda(o={}){
 const src=S.tracks.filter(t=>t.smpVocal&&t.clips.some(c=>(c.notes||[]).some(n=>n.lyr)));if(!src.length){if(!o.auto)toast('歌詞つきのメインメロディがありません');return false}
 const myName=S.name;let made=0;
 for(const mt of src){
  let at=S.tracks.find(t=>t.vvOf===mt.id);
  if(!at){at=newTrack('audio');at.vvOf=mt.id;at.color=TRACK_COLORS[4];at.vol=-3;at.pan=0;
   at.fx=(mt.smpVocalDry?[['eq',{hp:120,mid:1.5,midf:2500,high:1}],['rcomp',{thr:-20,ratio:3,gain:1}]]:[['eq',{hp:120,mid:1.5,midf:2500,high:1}],['rcomp',{thr:-20,ratio:3,gain:1}],['delay',{time:.75,mix:.1,fb:.25,tone:3500}],['reverb',{mix:.2,decay:2.2,pre:.02,tone:8000}]]).map(f=>smpFx(f[0],f[1]));
   S.tracks.splice(S.tracks.indexOf(mt)+1,0,at)}
  at.name='ずんだもん（VOICEVOX・未生成）';
  renderLanes();renderRows();renderSide();
  try{if(!VV.connected){toast('VOICEVOX に接続しています…');await vvConnect()}}
  catch(e){toast('VOICEVOX を起動すると、ずんだもんの歌声トラックを作れます（VOICEVOX ボタン →「サンプル曲のずんだもんを作る」）');return false}
  const zs=VV.singers.find(s=>/ずんだもん/.test(s.name)&&/ノーマル/.test(s.name))||VV.singers.find(s=>/ずんだもん/.test(s.name));
  if(!zs)toast('VOICEVOX に「ずんだもん」の歌声が見つからないため、'+VV.singers[0].name+' で歌わせます');
  const keep={singer:VV.singer,teacher:VV.teacher,shift:VV.shift};
  VV.singer=(zs||VV.singers[0]).id;const zt=VV.teachers.find(s=>/ずんだもん/.test(s.name));if(zt)VV.teacher=zt.id;VV.shift='auto';
  try{
   const items=mt.clips.flatMap(c=>(c.notes||[]).filter(n=>n.lyr&&n.s<(c.len||1e9)).map(n=>({n,q:c.start+n.s})));
   const ph=vvPhrasesItems(items),shift=vvShiftFor(ph),clips=[];
   let k=0;
   for(const p of ph){
    if(S.name!==myName)return false;   // 途中で別の曲を開いたらやめる
    k++;toast(`ずんだもんが歌っています… ${k}/${ph.length}`);
    const {t0,score}=vvScore(p,shift,n=>n.lyr||'');
    const buf=await vvRender(score);const lead=Math.max(0,-t0);
    const cl={id:uid('c'),start:Math.max(0,qAt(Math.max(0,t0))),offset:lead,dur:Math.max(.01,buf.duration-lead),name:'VOICEVOX:ずんだもん',buf};
    BUFS.set(cl.id,buf);clips.push(cl);
   }
   at.clips=clips;at.name='ずんだもん（VOICEVOX）';made++;
   if(!mt.smpGuide){mt.smpGuide=true;mt.vol=(mt.vol||0)-9;mt.name=mt.name.replace(/（.*）$/,'')+'（ガイド）'}
  }catch(e){toast(e.message||String(e));return false}
  finally{Object.assign(VV,keep)}
 }
 renderLanes();renderRows();renderSide();try{instPreload(S.tracks)}catch(e){}
 HIST.last=projSnap();HIST.saved=HIST.last;
 if(made)toast('ずんだもんの歌声トラックを作りました（VOICEVOX:ずんだもん）');
 return made>0;
}
/* VOICEVOX の画面に「サンプル曲のずんだもんを作る」ボタン */
{const _o=openVvModal;openVvModal=function(){_o();if(S.tracks.some(t=>t.smpVocal)){const b=el('button',{class:'addfx',id:'vvZunda',onclick:()=>{closeModal();smpZunda()}},'🎤 サンプル曲のずんだもんを作る（歌詞つきメロディ全体）');const box=$('#mBody>div')||$('#mBody');box.append(b)}}}
/* =====================================================================
   サンプル曲の作り直し（デフォルト〜7）: 構成を長く・展開を豊かに
   ・和音は前の和音に一番近い形へつなぐ（ボイスリーディング）
   ・セクションごとにドラムの型・音数・強さを変え、区切りにフィル
   ===================================================================== */
/* 前の和音に近い形で n 音を lo..hi に並べる（noRoot: 4和音以上ならルートを省く）*/
function smpVL(ch,prev,lo,hi,n,noRoot){
 let iv=smpIv(ch).slice();if(noRoot&&iv.length>3)iv=iv.slice(1);
 if(iv.length>n){const drop=iv.indexOf(7);if(drop>0&&iv.length-1>=n)iv.splice(drop,1)}
 iv=iv.slice(0,Math.max(n,1));
 const pcs=iv.map(i=>(((ch.root+i)%12)+12)%12);while(pcs.length<n)pcs.push(pcs[pcs.length%Math.max(1,iv.length)]);
 const cands=[];
 for(let r=0;r<pcs.length;r++){const order=[...pcs.slice(r),...pcs.slice(0,r)];
  for(let base=lo;base<lo+12;base++){if(base%12!==order[0])continue;const v=[base];for(let k=1;k<order.length;k++){let p=v[k-1]+1;while(p%12!==order[k])p++;v.push(p)}if(v[v.length-1]<=hi)cands.push(v)}}
 if(!cands.length)return smpVoice(ch,lo,n,noRoot);
 const mid=(lo+hi)/2,score=v=>prev&&prev.length===v.length?v.reduce((a,p,i)=>a+Math.abs(p-prev[i]),0):Math.abs(v.reduce((a,b)=>a+b,0)/v.length-mid)*v.length;
 cands.sort((a,b)=>score(a)-score(b));return cands[0];
}
/* 和音トラック: 区間 [q0,q1) を拍 beats ごとに（コードが変わる所でも）ボイスリーディングで並べる */
function smpPadVL(C,L,q0,q1,lo,hi,n,v,o={}){
 let prev=o.prev||null,q=q0;
 while(q<q1-1e-6){const ch=C.chAt(q);let e=q+(o.step||C.B);for(let x=q+.5;x<e;x+=.5)if(!C.same(C.chAt(x),ch)){e=x;break}e=Math.min(e,q1);
  const vc=smpVL(ch,prev,lo,hi,n,o.noRoot);vc.forEach((p,i)=>smpN(L,p,q,(e-q)*(o.leg||.98),smpH(typeof v==='function'?v(q,i):v,3)));prev=vc;q=e}
 return prev;
}
const smpSecs=()=>{let q=0;return S.sections.map(s=>{const B=qpbar(),o={name:s.name,q0:q,bars:s.bars,q1:q+s.bars*B};q=o.q1;return o})};

/* =====================================================================
   7. ときめきサンセット（80s アイドルポップ）— フルサイズ
   イントロ → A → B → サビ → 間奏 → A2 → B2 → サビ2 → 落ちサビ → フィル（半音上げ）→ ラストサビ → アウトロ
   ===================================================================== */
SMP_IDOL_LYR.sL=[...SMP_IDOL_LYR.s.slice(0,3),'すきよー'];
SMP_IDOL_LYR.a2=['よぞらにまたたく','ちいさなほしたち','ねがいをかけたなら','かなうかしら'];
SMP_IDOL_LYR.b2=['すなおになれなくて','ためいきがほしになる'];
function sampleIdol2(){
 const IN=' Fmaj7 | G | Em7 | Am7 |',PA=' C | Am7 | Dm7 | G7 | C | Am7 | Dm7 | G7 |',PB=' Fmaj7 | G | Em7 Am7 | Dm7 G7 |',SB=' Fmaj7 | G | Em7 | Am7 | Fmaj7 | G | C | C |',LS='ラストサビ（転調）';
 const C=smpBegin({name:'ときめきサンセット（80s アイドルポップ）',bpm:140,swing:50,key:[0,'major'],seed:71,
  secs:[['イントロ',4,0],['Aメロ',8,1],['Bメロ',4,3],['サビ',8,4],['間奏',4,0],['Aメロ2',8,1],['Bメロ2',4,3],['サビ2',8,4],['落ちサビ',4,5],['フィル',1,6],[LS,8,4],['アウトロ',4,0]],
  prog:'|'+IN+PA+PB+SB+IN+PA+PB+SB+' Fmaj7 | G | Em7 | Am7 | Ab7 |'+smpTrProg(SB,1)+smpTrProg(' Fmaj7 G | Em7 Am7 | Dm7 G7 | C |',1)});
 const {B,sec,chAt,inS}=C;
 const vo={leg:.9,v:84};
 const MA=['r:.5 E4:.5 G4:.5 A4:.5 G4:1 E4:1 | C5:1.5 A4:.5 G4:2','r:.5 F4:.5 A4:.5 C5:.5 A4:1 F4:1 | D5:1.5 B4:.5 G4:2',
  'r:.5 E4:.5 G4:.5 A4:.5 G4:1 E4:1 | C5:1 D5:.5 E5:.5 C5:2','D5:1 C5:.5 A4:.5 F4:1 A4:1 | G4:3 r:1'];
 const MB=['A4:.5 A4:.5 A4:.5 G4:.5 A4:1 C5:1 | B4:1.5 A4:.5 G4:2','G4:.5 G4:.5 G4:.5 E4:.5 G4:1 C5:1 | D5:2 r:.5 G4:.5 A4:.5 B4:.5'];
 const SABI=['C5:1.5 D5:.5 E5:1 C5:1 | D5:1.5 C5:.5 B4:1 G4:1','B4:1.5 C5:.5 D5:1 B4:1 | C5:3 r:1',
  'A4:.5 C5:.5 F5:1 E5:.5 D5:.5 C5:1 | D5:1 E5:.5 D5:.5 G5:2','E5:1.5 D5:.5 ~C5:2 | r:4'];
 const SABI_LAST=[...SABI.slice(0,2),'A4:.5 C5:.5 F5:1 E5:.5 D5:.5 C5:1 | D5:1 E5:.5 F5:.5 ~G5:2','A5:1.5 G5:.5 ~E5:2 | ~C5:4'];
 const pa=smpPhrases(MA,sec['Aメロ'].q0,vo),pb=smpPhrases(MB,sec['Bメロ'].q0,{...vo,v:86}),ps=smpPhrases(SABI,sec['サビ'].q0,{...vo,v:92});
 const pa2=smpPhrases(MA,sec['Aメロ2'].q0,vo),pb2=smpPhrases(MB,sec['Bメロ2'].q0,{...vo,v:88}),ps2=smpPhrases(SABI,sec['サビ2'].q0,{...vo,v:94});
 const po=smpPhrases(SABI.slice(0,2),sec['落ちサビ'].q0,{...vo,v:74,leg:.95}),pl=smpPhrases(SABI_LAST,sec[LS].q0,{...vo,v:98,tr:1});
 smpLyr(pa.groups,SMP_IDOL_LYR.a,'ia');smpLyr(pb.groups,SMP_IDOL_LYR.b,'ib');smpLyr(ps.groups,SMP_IDOL_LYR.s,'is');
 smpLyr(pa2.groups,SMP_IDOL_LYR.a2,'ia2');smpLyr(pb2.groups,SMP_IDOL_LYR.b2,'ib2');smpLyr(ps2.groups,SMP_IDOL_LYR.s,'is2');
 smpLyr(po.groups,SMP_IDOL_LYR.s.slice(0,2),'io');smpLyr(pl.groups,SMP_IDOL_LYR.sL,'il');
 const voc=[pa,pb,ps,pa2,pb2,ps2,po,pl].flatMap(x=>x.notes);voc.forEach(n=>n.v=smpH(n.v+(n.l>=1.5?3:0),4));
 S.sections.forEach(s=>{const k={'Aメロ':'a','Bメロ':'b','サビ':'s','Aメロ2':'a2','Bメロ2':'b2','サビ2':'s',[LS]:'sL'}[s.name];if(k)s.lyr=SMP_IDOL_LYR[k].join('\n');if(s.name==='落ちサビ')s.lyr=SMP_IDOL_LYR.s.slice(0,2).join('\n')});
 /* ハモリ: サビ2 は3度下、ラストは3度上（歌詞つき）*/
 const har=[...smpHarm(ps2.notes,0,'major',5).map(n=>({...n,p:n.p-12,v:n.v-4})),...smpHarm(pl.notes,1,'major',2)];
 /* イントロ／間奏／アウトロのベル・リフ（グロッケンを重ねる）*/
 const RIFF=['C6:.5 G5:.5 A5:.5 C6:.5 E6:1 D6:.5 C6:.5','B5:.5 G5:.5 A5:.5 B5:.5 D6:2','G5:.5 B5:.5 E6:.5 D6:.5 B5:1 G5:1','C6:.5 E6:.5 A6:1 G6:1 E6:1'];
 const bl=[...smpPhrases(RIFF,sec['イントロ'].q0,{leg:.85,v:82}).notes,...smpPhrases([...RIFF.slice(0,3),'C6:.5 E6:.5 A6:1 B6:1 ~C7:1'],sec['間奏'].q0,{leg:.85,v:86}).notes,
  ...smpPhrases(['C6:.5 E6:.5 G6:1 F6:1 E6:1','D6:.5 E6:.5 D6:1 C6:1 A5:1','C6:.5 E6:.5 G6:1 F6:1 E6:1','~C6:4'],sec['アウトロ'].q0,{leg:.85,v:80,tr:1}).notes];
 const glk=bl.map(n=>({...n,v:n.v-12}));
 const quiet=q=>inS(q,'落ちサビ'),chorus=q=>inS(q,'サビ','サビ2',LS,'間奏');
 /* ベース: A は8分＋オクターブ、B はシンコペーション、サビは16分の駆け上がりも */
 const bs=[];for(let b=0;b<C.bars;b++){const s=b*B,lo=pc=>smpLow(pc,33),r=lo(smpBassPc(chAt(s)));
  if(b===C.bars-1){smpN(bs,r,s,3.6,100);continue}
  if(quiet(s)){if(s>=sec['落ちサビ'].q0+2*B)smpN(bs,r,s,3.8,70);continue}
  if(inS(s,'フィル')){[0,1.5,2,3,3.5].forEach(o=>smpN(bs,r,s+o,.4,104));continue}
  if(inS(s,'イントロ')&&b<2){smpN(bs,r,s,1.8,86);smpN(bs,r,s+2.5,1.4,80);continue}
  if(inS(s,'Bメロ','Bメロ2')){[[0,.9,96],[1.5,.4,80],[2,.9,92],[3,.4,78],[3.5,.4,86]].forEach(([o,l,v])=>smpN(bs,lo(smpBassPc(chAt(s+o))),s+o,l,smpH(v,4)));continue}
  for(let i=0;i<8;i++){const q=s+i/2,rr=lo(smpBassPc(chAt(q)));smpN(bs,rr+([2,6].includes(i)?12:0),q,i%2?.32:.44,smpH(i%2?78:96,4))}
  const nx=chAt(s+B);if(chorus(s)&&b%2===1&&!C.same(nx,chAt(s))){const t=lo(smpBassPc(nx));for(let k=bs.length-1;k>=0;k--)if(bs[k].q>=s+3.25-1e-6)bs.splice(k,1);bs.forEach(n=>{if(n.q>=s+3-1e-6&&n.q<s+3.25)n.l=.22});[t-5,t-3,t-1].forEach((p,i)=>smpN(bs,p,s+3.25+i*.25,.22,84+i*6))}
 }
 /* エレピ（A・B）とピアノ（落ちサビ）・ストリングス・ブラス・コーラス */
 const ep=[],pn=[],st=[],br=[],oo=[],gt=[],cs=[];let prevE=null;
 for(let b=0;b<C.bars;b++){const s=b*B;
  if(b===C.bars-1){smpVL(chAt(s),prevE,57,72,4).forEach(p=>smpN(ep,p,s,3.8,64));continue}
  if(quiet(s)){const ch=chAt(s);smpN(pn,smpLow(smpBassPc(ch),36),s,3.9,58);smpVL(ch,null,55,72,4).forEach((p,i)=>smpN(pn,p,s+.5+i*.5,3.4-i*.5,smpH(48,3)));continue}
  if(inS(s,'フィル')){smpVL(chAt(s),prevE,57,72,4).forEach(p=>smpN(ep,p,s,.5,80));continue}
  for(const [o,l] of [[0,1.4],[1.5,.5],[2.5,.5],[3,.95]]){const vc=smpVL(chAt(s+o),prevE,57,72,4);prevE=vc;vc.forEach(p=>smpN(ep,p,s+o,l,smpH(o?54:62,3)))}
 }
 for(const nm of ['Bメロ','サビ','Bメロ2','サビ2','落ちサビ',LS])smpPadVL(C,st,sec[nm].q0,sec[nm].q1,60,79,4,nm==='落ちサビ'?48:nm.startsWith('B')?54:62,{step:2});
 /* サビ2 とラストは、ストリングスの対旋律（高いところから降りてくる）*/
 for(const nm of ['サビ2',LS]){const sc=sec[nm];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B,ch=chAt(s),t=smpVL(ch,null,74,88,3);smpN(cs,t[2],s,1.9,smpH(70,3));smpN(cs,t[1],s+2,1.9,smpH(66,3))}}
 for(const nm of ['サビ','サビ2',LS]){const sc=sec[nm];let pv=null;for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B,vc=smpVL(chAt(s),pv,62,76,3);pv=vc;vc.forEach(p=>smpN(br,p,s,.6,smpH(88,3)));
  if(b<sc.bars-1)smpVL(chAt(s+B),vc,62,76,3).forEach(p=>smpN(br,p,s+3.5,.4,smpH(82,3)));smpVL(chAt(s),null,64,79,3).forEach(p=>smpN(oo,p,s,3.9,52))}}
 {const s=sec['フィル'].q0;smpVL(chAt(s),null,62,76,3).forEach(p=>{[0,1.5].forEach(o=>smpN(br,p,s+o,.4,98));smpN(br,p,s+3,.9,104)})}
 /* クリーン・ギターのカッティング（A2・サビ2・ラスト）: 16分のミュートと裏のアクセント */
 for(const nm of ['Aメロ2','Bメロ2','サビ2',LS,'間奏']){const sc=sec[nm];let pv=null;for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;
  for(let i=0;i<16;i++){const q=s+i/4,vc=smpVL(chAt(q),pv,64,79,3);pv=vc;const acc=[2,6,10,14].includes(i),mute=!acc&&i%2===1;if(i%4===0&&!acc&&smpR()<.3)continue;
   vc.forEach((p,k)=>smpN(gt,p,q+k*.008,mute?.08:acc?.22:.12,smpH(mute?38:acc?78:54,4)))}}}
 /* ドラム（80s・ゲート気味のスネア）*/
 const dr=[],fill=(s,big)=>{const seq=big?[[2,50],[2.25,50],[2.5,48],[2.75,48],[3,47],[3.25,45],[3.5,43],[3.75,41]]:[[3,50],[3.25,50],[3.5,47],[3.75,43]];seq.forEach(([o,p],i)=>smpN(dr,p,s+o,.25,92+i*(big?4:7)))};
 const ends=new Set(smpSecs().map(x=>x.q1));
 for(let b=0;b<C.bars;b++){const s=b*B,last=b===C.bars-1,secEnd=ends.has(s+B),nextBig=[sec['サビ'].q0,sec['サビ2'].q0,sec['間奏'].q0].includes(s+B);
  if(last){smpN(dr,36,s,.5,120);smpN(dr,49,s,3,112);smpN(dr,57,s,3,104);continue}
  if(quiet(s)){if(s===sec['落ちサビ'].q0)smpN(dr,49,s,4,70);if(s===sec['落ちサビ'].q1-B)for(let i=0;i<8;i++)smpN(dr,38,s+2+i/4,.25,40+i*7);continue}
  if(inS(s,'フィル')){smpN(dr,36,s,.5,110);smpN(dr,49,s,2,100);[0,1.5].forEach(o=>smpN(dr,38,s+o,.4,110));for(let i=0;i<8;i++)smpN(dr,[50,50,47,47,45,45,43,43][i],s+2+i/4,.25,92+i*4);continue}
  if(inS(s,'イントロ')&&b<2){smpN(dr,36,s,.5,104);if(b===0)smpN(dr,49,s,2,100);for(let i=0;i<8;i++)smpN(dr,42,s+i/2,.3,smpH(i%2?50:66,3));if(b===1)fill(s,false);continue}
  const A=inS(s,'Aメロ','Aメロ2'),Bm=inS(s,'Bメロ','Bメロ2'),Sb=chorus(s);
  if(A){[0,2.5].forEach(o=>smpN(dr,36,s+o,.5,smpH(104,3)))}else if(Bm){[0,1,2,3].forEach(o=>smpN(dr,36,s+o,.5,smpH(100,3)))}else{[0,1.5,2,3.5].forEach(o=>smpN(dr,36,s+o,.5,smpH(110,3)))}
  smpN(dr,38,s+1,.5,smpH(A?100:110,3));if(!secEnd)smpN(dr,38,s+3,.5,smpH(A?102:112,3));
  if(Bm&&!secEnd&&b%2===1)smpN(dr,38,s+3.75,.25,64);
  for(let i=0;i<8;i++)if(!(secEnd&&i>=6))smpN(dr,Sb&&i%2?46:42,s+i/2,.4,smpH(i%2?(A?52:62):(A?72:84),3));
  if(Sb)smpN(dr,54,s+1,.4,58),smpN(dr,54,s+3,.4,58);
  if(smpSecs().some(x=>x.q0===s&&x.name!=='イントロ')||(Sb&&b%4===0))smpN(dr,49,s,2,112);
  if(secEnd)fill(s,nextBig);
 }
 const fxn=[{p:66,q:sec['サビ'].q0-2*B,l:2*B,v:62},{p:64,q:sec['フィル'].q0,l:B,v:90},{p:62,q:sec[LS].q0,l:2,v:92},{p:62,q:sec['サビ'].q0,l:2,v:70}];
 const tDr=smpTrack('drum',{name:'ドラム（80s）',tone:'kit_sd_LM-2',vol:-6,ci:1,fx:[['eq',{hp:30,low:1.5,high:2}],['rcomp',{thr:-18,ratio:3,att:.006,gain:1}],['reverb',{mix:.24,decay:1.2,pre:.01,tone:9000}]],notes:dr,start:0,clip:'8ビート＋フィル',hum:false});
 const tBs=smpTrack('midi',{name:'ベース',tone:'waf_finger_bass',vol:-7,ci:2,fx:[['eq',{hp:35,low:1.5,mid:1,midf:800}],['rcomp',{thr:-20,ratio:4,gain:1}]],notes:bs,start:0,clip:'8分・シンコペ・駆け上がり'});
 const tEp=smpTrack('midi',{name:'エレピ',tone:'waf_epiano',vol:-13,pan:-.3,ci:0,fx:[['chorus',{mix:.4,rate:.6,depth:.4}],SMPFX.plate(.22,1.8)],notes:ep,start:0,clip:'バッキング'});
 const tGt=smpTrack('midi',{name:'ギター（カッティング）',tone:'waf_clean_gtr',vol:-16,pan:.42,ci:4,fx:[['eq',{hp:220,low:-2,mid:1.5,midf:2200,high:1.5}],['rcomp',{thr:-22,ratio:3,gain:1}],['chorus',{mix:.2,rate:.8,depth:.25}],SMPFX.room(.12)],notes:gt,clip:'16分カッティング',hum:[.004,3]});
 const tPn=smpTrack('midi',{name:'ピアノ（落ちサビ）',tone:'smp_sal_hq',vol:-9,pan:-.1,ci:0,fx:[SMPFX.hall(.3,2.6)],notes:pn,clip:'落ちサビ'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_strings',vol:-16,pan:.3,ci:5,fx:[SMPFX.hall(.32,2.8)],notes:st,clip:'白玉'});
 const tCs=smpTrack('midi',{name:'ストリングス（対旋律）',tone:'waf_violin',vol:-16,pan:-.25,ci:5,fx:[['eq',{hp:250,high:1}],SMPFX.hall(.34,2.8)],notes:cs,clip:'サビ2・ラストの対旋律'});
 const tBr=smpTrack('midi',{name:'シンセ・ブラス',tone:'waf_synth_brass',vol:-15,pan:.2,ci:4,fx:[['chorus',{mix:.25}],SMPFX.plate(.22,1.8)],notes:br,clip:'サビのキメ'});
 const tOo=smpTrack('midi',{name:'コーラス',tone:'waf_oohs',vol:-18,pan:-.2,ci:5,fx:[SMPFX.hall(.34,2.8)],notes:oo,clip:'サビのウー'});
 const tBl=smpTrack('midi',{name:'ベル',tone:'syn_bell',vol:-13,pan:.35,ci:6,fx:[['delay',{time:.75,mix:.18,fb:.3}],SMPFX.hall(.26,2.4)],notes:bl,clip:'リフ（イントロ・間奏・アウトロ）'});
 const tGk=smpTrack('midi',{name:'グロッケン（ベルの重ね）',tone:'waf_glock',vol:-17,pan:-.35,ci:6,fx:[SMPFX.hall(.28,2.4)],notes:glk,clip:'リフ'});
 const tHa=smpTrack('midi',{name:'ハモリ（歌詞つき）',tone:'waf_oohs',vol:-15,pan:.2,ci:3,fx:[SMPFX.hall(.32,2.4)],notes:har,clip:'サビ2・ラストのハモリ'});
 const tVo=smpTrack('midi',{name:'ボーカル（メロディ・歌詞つき）',tone:'tj_flute',vol:-5,pan:0,ci:3,fx:[['eq',{hp:180,mid:-1,midf:900,high:1.5}],SMPFX.glue(-22,2.5,1),['delay',{time:.75,mix:.1,fb:.25,tone:3500}],SMPFX.plate(.24,2)],notes:voc,clip:'歌メロ（歌詞つき）'});
 const tFx=smpTrack('midi',{name:'効果音',tone:'sfx',vol:-16,pan:0,ci:6,fx:[SMPFX.hall(.3,3)],notes:fxn,clip:'ライザー・インパクト',hum:false});
 smpMaster([['eq',{hp:28,low:1,mid:-.5,midf:400,high:2}],['rcomp',{thr:-18,ratio:2.5,att:.02,rel:.2,gain:1}],['exciter',{amount:.15,freq:6000}],['widener',{width:.25,mix:.35}],['reverb',{mix:.06,decay:2,pre:.02,tone:8000}],['limiter',{thr:-1.2,gain:1}]],4.9);
 smpFinish([C.g,tDr,tBs,tEp,tGt,tPn,tSt,tCs,tBr,tOo,tBl,tGk,tFx,tHa,tVo],tVo,tVo);
}


/* =====================================================================
   4. あの夏の坂道（ボサノバ）— 間奏にナイロンギターのソロ、打楽器とローズを充実
   ===================================================================== */
function sampleBossa2(){
 const IN='| Gmaj7 | Cmaj7 | Gmaj7 | Am7 D7 |',PA=' Gmaj7 | Gmaj7 | Am7 | D7 | Bm7 | E7 | Am7 | D7 |',PB=' Cmaj7 | Cm7 | Bm7 | E7 | Am7 | D7 | Gmaj7 | Am7 D7 |';
 const C=smpBegin({name:'あの夏の坂道（ボサノバ）',bpm:132,swing:50,key:[7,'major'],seed:41,
  secs:[['イントロ',4,0],['Aメロ',8,1],['サビ',8,4],['間奏（ギター・ソロ）',8,5],['Aメロ2',8,1],['サビ2（転調）',8,4],['タグ',4,3],['アウトロ',4,0]],
  prog:IN+PA+PB+PA+PA.replace(/ D7 \|$/,' Bbm7 Eb7 |')+smpTrProg(PB,1)+smpTrProg(' Am7 | D7 | Ebmaj7 | Ebmaj7 | Gmaj9 | Cmaj7 | Gmaj9 | Gmaj9 |',1)});
 const {B,sec,chAt,inS}=C,S2='サビ2（転調）',SO='間奏（ギター・ソロ）';
 const MA=['r:.5 B4:.5 B4:.5 A4:.5 B4:1 D5:1 | E5:1.5 D5:.5 B4:2','r:.5 C5:.5 C5:.5 B4:.5 C5:1 E5:1 | D5:1.5 C5:.5 A4:2',
           'r:.5 D5:.5 D5:.5 C#5:.5 D5:1 F#5:1 | E5:1.5 D5:.5 G#4:2','r:.5 C5:.5 B4:.5 A4:.5 G4:1 A4:.5 G4:.5 | F#4:3 r:1'];
 const MB=['E5:1 E5:.5 D5:.5 E5:1 G5:1 | G5:1.5 F5:.5 Eb5:2','D5:1 D5:.5 C#5:.5 D5:1 F#5:1 | E5:1.5 D5:.5 B4:2',
           'C5:1 C5:.5 B4:.5 C5:1 E5:1 | D5:1.5 C5:.5 A4:1 F#4:1','B4:1 A4:.5 B4:.5 G4:2 | r:4'];
 const vo={leg:.92,v:80};
 const pa1=smpPhrases(MA,sec['Aメロ'].q0,vo),pb1=smpPhrases(MB,sec['サビ'].q0,{...vo,v:86});
 const pa2=smpPhrases([...MA.slice(0,3),'r:.5 C5:.5 B4:.5 A4:.5 G4:1 A4:.5 G4:.5 | F4:3 r:1'],sec['Aメロ2'].q0,vo);
 const pb2=smpPhrases(MB,sec[S2].q0,{...vo,v:90,tr:1});
 const pt=smpPhrases([MB[2],'Bb4:1 G4:.5 Bb4:.5 ~G4:2 | r:4'],sec['タグ'].q0,{...vo,v:84,tr:1});
 smpLyr(pa1.groups,SMP_BOSSA_LYR.a1,'a1');smpLyr(pb1.groups,SMP_BOSSA_LYR.b1,'b1');smpLyr(pa2.groups,SMP_BOSSA_LYR.a2,'a2');smpLyr(pb2.groups,SMP_BOSSA_LYR.b2,'b2');smpLyr(pt.groups,SMP_BOSSA_LYR.tag,'tag');
 const voc=[...pa1.notes,...pb1.notes,...pa2.notes,...pb2.notes,...pt.notes];voc.forEach(n=>n.v=smpH(n.v+(n.l>=1.5?3:0),5));
 const har=[...smpHarm(pb2.notes,8,'major',2),...smpHarm(pt.groups[0],8,'major',2)];
 S.sections.forEach(s=>{const k={'Aメロ':'a1','サビ':'b1','Aメロ2':'a2',[S2]:'b2','タグ':'tag'}[s.name];if(k)s.lyr=SMP_BOSSA_LYR[k].join('\n')});
 /* ナイロンギター: 親指（1・3拍）＋ 2小節パターン（ルートを省いたテンションの和音・前の和音に近い形で）*/
 const gt=[],HITS=[0,1.5,3,5,6.5];let pv=null;
 for(let b=0;b<C.bars;b++){const s=b*B,solo=inS(s,SO);
  if(b===C.bars-1){const ch=chAt(s);[smpLow(smpBassPc(ch),40),...smpVL(ch,pv,52,72,5,true)].forEach((p,i)=>smpN(gt,p,s+i*.1,3.8,smpH(58,3)));continue}
  for(const o of [0,2]){const ch=chAt(s+o),r=smpLow(smpBassPc(ch),40);smpN(gt,o===2&&chAt(s).root===ch.root?r+7-(r+7>52?12:0):r,s+o,1.8,smpH(solo?52:60,4))}
  for(const h of HITS){const q=(b%2?s-B:s)+h;if(q<s-1e-6||q>=s+B-1e-6)continue;
   const ch=chAt(q%1?q+.5:q),vc=smpVL(ch,pv,52,67,3,true);pv=vc;vc.forEach((p,i)=>smpN(gt,p,q+i*.012,q%1?.6:.9,smpH(solo?42:50,5)))}
 }
 /* ギター・ソロ（間奏・単音）: ゆったり始まり、後半は3連の装飾も */
 const so=[...smpPhrases(['r:1 B4:.5 D5:.5 F#5:1.5 E5:.5','D5:1 B4:1 A4:2'],sec[SO].q0,{leg:.95,v:76}).notes,
  ...smpJazzLine(C,sec[SO].q0+2*B,5,64,81,{rest:.2,tri:.18,start:71}),
  ...smpPhrases(['A5:.5 F#5:.5 D5:.5 B4:.5 A4:1 F#4:1'],sec[SO].q1-B,{leg:.95,v:74}).notes];
 so.forEach(n=>n.v=smpH(n.v+4,4));
 const bs=[];
 for(let b=4;b<C.bars;b++){const s=b*B,c1=chAt(s),c2=chAt(s+2),lo=pc=>smpLow(pc,33);
  if(b===C.bars-1){smpN(bs,lo(smpBassPc(c1)),s,3.8,74);continue}
  smpN(bs,lo(smpBassPc(c1)),s,1.5,smpH(80,4));
  smpN(bs,c2.root===c1.root?lo((c1.root+7)%12):lo(smpBassPc(c2)),s+2,1.5,smpH(70,4));
  const nx=chAt(s+B);if(nx.root!==c2.root&&b%2)smpN(bs,lo(smpBassPc(nx)),s+3.5,.45,smpH(60,4));
 }
 /* 打楽器: シェイカーの16分（強弱）・リムのボサノバ・クラーベ・ブラシのキック、区切りに小さなフィル */
 const dr=[];const ends=new Set(smpSecs().map(x=>x.q1));
 for(let b=2;b<C.bars;b++){const s=b*B,last=b===C.bars-1;
  for(let i=0;i<16;i++)smpN(dr,70,s+i/4,.2,smpH(i%4===2?58:i%2?30:44,3));
  if(b<4)continue;
  if(last){smpN(dr,36,s,.5,52);smpN(dr,51,s,3,40);continue}
  smpN(dr,36,s,.5,smpH(58,3));smpN(dr,36,s+2,.5,smpH(50,3));smpN(dr,36,s+1.5,.3,34);smpN(dr,36,s+3.5,.3,34);
  for(const h of HITS){const q=(b%2?s-B:s)+h;if(q>=s-1e-6&&q<s+B-1e-6)smpN(dr,37,q,.3,smpH(62,4))}
  if(inS(s,'サビ',S2,'タグ'))for(const k of [0,1,2,3])smpN(dr,51,s+k,.5,smpH(k%2?34:42,3));
  if(ends.has(s+B))[3,3.33,3.67].forEach((o,i)=>smpN(dr,38,s+o,.25,40+i*8));
 }
 /* ローズ（全体・柔らかく）・ストリングス（転調後）・フルート（イントロ・サビの合いの手・アウトロ）*/
 const rh=[],st=[];let pr=null;
 for(let b=4;b<C.bars;b++){const s=b*B,two=chAt(s).root!==chAt(s+2).root;
  for(const o of (two?[0,2]:[0,2.5])){const vc=smpVL(chAt(s+o),pr,58,74,4,true);pr=vc;vc.forEach(p=>smpN(rh,p,s+o+(o===2.5?0:0),two?1.9:(o?1.4:2.4),smpH(inS(s,'Aメロ','Aメロ2')?34:42,3)))}}
 smpPadVL(C,st,sec[S2].q0,C.bars*B,55,72,4,(q)=>inS(q,'タグ')?60:48,{noRoot:true});
 const fl=[...smpPhrases(['D5:1.5 B4:.5 G4:2','E5:1.5 C5:.5 G4:2','D5:1 B4:1 A4:1 G4:1','A4:2 F#4:2'],sec['イントロ'].q0,{leg:.96,v:66}).notes,
  ...smpPhrases(['r:4 r:2.5 G5:.5 F#5:.5 E5:.5','r:4 r:2.5 F#5:.5 E5:.5 D5:.5','r:4 r:3 A5:.5 G5:.5','r:4 r:2 B4:.5 D5:.5 G5:1'],sec['サビ'].q0,{leg:.9,v:60}).notes,
  ...smpPhrases(['D5:3 B4:1','E5:4','D5:2 F#5:1 A5:1','~B5:4'],sec['アウトロ'].q0,{leg:.96,v:62,tr:1}).notes];
 fl.forEach(n=>n.v=smpH(n.v,4));
 const tVo=smpTrack('midi',{name:'ボーカル（メロディ・歌詞つき）',tone:'tj_saxophone',vol:-6,pan:0,ci:3,fx:[['eq',{hp:150,mid:-1.5,midf:700,high:1}],SMPFX.glue(-22,2.5,1),['delay',{time:.75,fb:.22,mix:.08,tone:3500}],SMPFX.hall(.26,2.4)],notes:voc,clip:'歌メロ（歌詞つき）'});
 const tHa=smpTrack('midi',{name:'ハモリ（3度上・歌詞つき）',tone:'waf_oohs',vol:-15,pan:.22,ci:3,fx:[SMPFX.hall(.34,2.6)],notes:har,clip:'サビ2 のハモリ'});
 const tGt=smpTrack('midi',{name:'ナイロンギター',tone:'waf_nylon',vol:-8,pan:-.25,ci:4,fx:[SMPFX.warmEq(70),SMPFX.glue(-20,2,1),SMPFX.hall(.2,2.2)],notes:gt,start:0,clip:'ボサノバ・パターン'});
 const tSo=smpTrack('midi',{name:'ナイロンギター（ソロ）',tone:'waf_nylon',vol:-6,pan:.18,ci:4,fx:[['eq',{hp:120,mid:1.5,midf:1800,high:1}],SMPFX.glue(-22,2,1),['delay',{time:.75,fb:.2,mix:.1,tone:3500}],SMPFX.hall(.24,2.4)],notes:so,clip:'間奏のソロ'});
 const tBs=smpTrack('midi',{name:'ウッドベース',tone:'waf_ac_bass',vol:-8,pan:.12,ci:2,fx:[['eq',{hp:35,low:1.5,mid:-1,midf:450}],SMPFX.glue(-20,3,1)],notes:bs,clip:'ルート＆5度'});
 const tDr=smpTrack('drum',{name:'パーカッション',tone:'kit_wd_FluidR3_GM_sf2_file',vol:-12,pan:.18,ci:1,fx:[['eq',{hp:60,high:1}],SMPFX.hall(.2,1.6)],notes:dr,clip:'シェイカー・リム・ブラシ'});
 const tRh=smpTrack('midi',{name:'ローズ',tone:'smp_rhodes',vol:-15,pan:.35,ci:0,fx:[['chorus',{mix:.3,rate:.4,depth:.35}],SMPFX.hall(.26,2.4)],notes:rh,clip:'柔らかいコンピング'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_slow_strings',vol:-18,pan:-.3,ci:5,fx:[SMPFX.hall(.38,3)],notes:st,clip:'転調後'});
 const tFl=smpTrack('midi',{name:'フルート',tone:'tj_flute',vol:-12,pan:-.38,ci:6,fx:[SMPFX.hall(.32,2.6)],notes:fl,clip:'イントロ・合いの手・アウトロ'});
 smpMaster([['tilt',{tilt:-.5,center:1200}],['rcomp',{thr:-18,ratio:2,att:.02,rel:.25,gain:1}],['reverb',{mix:.07,decay:2.2,pre:.02,tone:8000}],['limiter',{thr:-1.2,gain:1}]],9.5);
 smpFinish([C.g,tDr,tBs,tGt,tRh,tSt,tFl,tSo,tHa,tVo],tVo,tVo);
}

/* =====================================================================
   デフォルト曲: EDM（150 BPM・A マイナー → B マイナー・約1分40秒）
   イントロ → ビルドアップ（スネアロール・一瞬の無音）→ ドロップ（フック2種）→ ブレイク（ピアノとクワイア）
   → ラストドロップ（全音上・オクターブ重ね・対旋律）→ アウトロ
   ===================================================================== */
function defaultSongEDM2(){
 const L4=' Am | F | C | G |',LD='ラストドロップ（転調）';
 const C=smpBegin({name:'EDM デモ（ハイスピード）',bpm:150,swing:50,key:[9,'minor'],seed:5,
  secs:[['イントロ',8,0],['ビルドアップ',8,1],['ドロップ',16,4],['ブレイク',8,5],[LD,16,3],['アウトロ',4,0]],
  prog:'|'+L4+L4+L4+L4+L4+L4+L4+L4+' F | G | Em | Am | F | G | E7sus4 | E7 |'+smpTrProg(L4+L4+L4+' Am | F | G | Am |',2)+smpTrProg(' Am | F | G | Am |',2)});
 const {B,sec,chAt,inS}=C,qI=sec['イントロ'].q0,qB=sec['ビルドアップ'].q0,qD=sec['ドロップ'].q0,qK=sec['ブレイク'].q0,qL=sec[LD].q0,qO=sec['アウトロ'].q0,len=C.len;
 const N=(L,p,q,l,v)=>L.push({p,q,l,v:Math.max(1,Math.min(127,Math.round(v)))});
 const tones=ch=>smpIv(ch).slice(0,3).map(i=>ch.root+i);
 /* ---------- ドラム ---------- */
 const dr=[];
 const beat=(q0,bars,big)=>{for(let b=0;b<bars;b++){const s=q0+b*B,last=b===bars-1;
  for(let k=0;k<4;k++){N(dr,36,s+k,.5,124);if(k%2)N(dr,39,s+k,.5,112),N(dr,38,s+k,.5,big?92:80);N(dr,46,s+k+.5,.5,big?96:88)}
  for(let i=0;i<16;i++){if(last&&i>=12)continue;if(i%4===2)continue;N(dr,42,s+i/4,.25,i%2?58:76)}
  if(b%4===0)N(dr,49,s,2,big?118:110);
  if(b%8===7&&!last){N(dr,38,s+3.5,.25,96);N(dr,38,s+3.75,.25,104)}
  if(last){[0,.25,.5,.75].forEach((d,i)=>N(dr,38,s+3+d,.25,96+i*8));if(big)N(dr,50,s+3.5,.25,104),N(dr,47,s+3.75,.25,110)}}};
 for(let b=0;b<8;b++){const s=qI+b*B;if(b<4){N(dr,42,s+2,.25,40+b*6);if(b===3)for(let i=0;i<4;i++)N(dr,38,s+3+i/4,.25,50+i*10);continue}
  for(let k=0;k<4;k++){N(dr,36,s+k,.5,b<6?108:116);N(dr,46,s+k+.5,.5,70+b*3);if(b>=6&&k%2)N(dr,39,s+k,.5,96)}for(let i=1;i<16;i+=2)N(dr,42,s+i/4,.25,44+b*3);if(b===4)N(dr,49,s,2,100)}
 for(let b=0;b<8;b++){const s=qB+b*B;
  if(b<4){for(let k=0;k<4;k++){N(dr,36,s+k,.5,112);N(dr,42,s+k+.5,.25,66)}N(dr,39,s+1,.5,100);N(dr,39,s+3,.5,100);if(b===0)N(dr,49,s,2,104);continue}
  const div=[1,2,4,8][b-4];for(let i=0;i<4*div;i++){const q=s+i/div;if(b===7&&q>=s+3-1e-6)break;const pr=((b-4)*4+i/div)/16;N(dr,38,q,1/div,56+pr*68);if(b>=6)N(dr,39,q,1/div,40+pr*60)}
  if(b<6)for(let k=0;k<4;k++)N(dr,36,s+k,.5,110)}
 beat(qD,16,false);
 for(let b=0;b<8;b++){const s=qK+b*B;if(b===0)N(dr,49,s,4,100);if(b<6){if(b>=2)for(let k=0;k<4;k++)N(dr,46,s+k+.5,.5,40+b*3)}else for(let i=0;i<16*(b-5);i++){const q=s+i/(4*(b-5));if(b===7&&q>=s+3-1e-6)break;N(dr,38,q,.125,50+((b-6)*16+i)*1.6)}}
 beat(qL,16,true);
 for(let b=0;b<4;b++){const s=qO+b*B;if(b===0){N(dr,49,s,4,120);N(dr,57,s,4,110);N(dr,36,s,.5,124)}if(b===3)N(dr,49,s,4,90)}
 /* ---------- ベース ---------- */
 const bs=[],lowR=ch=>{let r=33+((smpBassPc(ch)%12)+12)%12;if(r>40)r-=12;return r};
 for(let b=4;b<8;b++){const s=qI+b*B;for(let k=0;k<4;k++)N(bs,lowR(chAt(s+k)),s+k+.5,.42,90+b*2)}
 for(let b=0;b<8;b++){const s=qB+b*B,r=lowR(chAt(s));if(b<4)for(let k=0;k<4;k++)N(bs,r,s+k+.5,.42,100);else if(b<6)for(let i=0;i<8;i++)N(bs,r+(i%2?12:0),s+i/2,.4,92+b*2);else if(b===6)for(let i=0;i<16;i++)N(bs,r+(i%4===2?12:0),s+i/4,.22,88+i);else for(let i=0;i<12;i++)N(bs,r,s+i/4,.22,100)}
 const roll=(q0,bars,v2)=>{for(let b=0;b<bars;b++){const s=q0+b*B;for(let k=0;k<4;k++){const r=lowR(chAt(s+k));[.25,.5,.75].forEach((o,j)=>N(bs,r+(j===1?12:0)+(v2&&k===3&&j===2&&b%2?7:0),s+k+o,.2,j===1?108:96))}}};
 roll(qD,16,false);
 for(let b=0;b<8;b++){const s=qK+b*B;if(b<6)N(bs,lowR(chAt(s)),s,B*.95,b<2?70:84);else for(let i=0;i<8;i++)N(bs,lowR(chAt(s)),s+i/2,.4,80+i*3)}
 roll(qL,16,true);
 N(bs,lowR(chAt(qO)),qO,B*2,110);
 /* ---------- スーパーソウ（ドロップは伸ばし＋ラストは裏のスタブ）・パッド・ピアノ ---------- */
 const sw=[],pd=[],pn=[];
 smpPadVL(C,sw,qD,qK,60,76,4,92);
 smpPadVL(C,sw,qL,qO,62,78,4,96);
 for(let b=0;b<16;b++){const s=qL+b*B;let pv=null;for(let k=0;k<4;k++){const vc=smpVL(chAt(s+k),pv,72,88,3);pv=vc;vc.forEach(p=>N(sw,p,s+k+.5,.3,80))}}
 for(let b=0;b<4;b++){const s=qB+4*B+b*B;smpVL(chAt(s),null,60,76,4).forEach(p=>N(sw,p,s,B*.98,48+b*14))}
 smpPadVL(C,pd,qI,qO+B*4,45,64,3,(q)=>inS(q,'ブレイク')?84:inS(q,'イントロ','アウトロ')?72:58);
 {let pv=null;for(let b=0;b<8;b++){const s=qK+b*B,ch=chAt(s),vc=smpVL(ch,pv,57,74,4);pv=vc;N(pn,lowR(ch)+12,s,3.9,66);N(pn,lowR(ch)+24,s,3.9,58);
  [0,1.5,2.5,3].forEach((o,i)=>vc.forEach(p=>N(pn,p,s+o,o===0?1.4:.9,smpH(i?50:62,3))))}}
 /* ---------- リード（フック）: ドロップ前半 A・後半 B（高く跳ねる答え）---------- */
 const HOOK=[[[0,.5,76],[.5,.5,76],[1,.5,81],[1.5,.5,79],[2,.75,76],[2.75,.25,74],[3,1,72]],
             [[0,.5,72],[.5,.5,72],[1,.5,77],[1.5,.5,76],[2,.75,72],[2.75,.25,69],[3,1,72]],
             [[0,.5,79],[.5,.5,79],[1,.5,76],[1.5,.5,79],[2,.5,84],[2.5,.5,83],[3,1,79]],
             [[0,.5,74],[.5,.25,74],[.75,.25,76],[1,.5,79],[1.5,.5,83],[2,1,83],[3,.5,81],[3.5,.5,79]]];
 const HOOKB=[[[0,.25,81],[.25,.25,84],[.5,.5,88],[1,.5,86],[1.5,.5,84],[2,1,81],[3,.5,79],[3.5,.5,81]],
              [[0,.75,84],[.75,.25,81],[1,.5,77],[1.5,.5,81],[2,1,84],[3,.5,86],[3.5,.5,84]],
              [[0,.5,84],[.5,.5,83],[1,.5,79],[1.5,.5,76],[2,.5,79],[2.5,.5,84],[3,1,88]],
              [[0,.5,86],[.5,.5,86],[1,.5,83],[1.5,.5,79],[2,1,83],[3,.25,81],[3.25,.25,83],[3.5,.5,86]]];
 const HOOK_END=[[0,.25,79],[.25,.25,81],[.5,.25,83],[.75,.25,86],[1,1.5,88],[2.5,.5,86],[3,1,84]];
 const ld=[],hook=(q0,bars,tr,v)=>{for(let b=0;b<bars;b++){const s=q0+b*B,pat=b%8===7?HOOK_END:(b>=8?HOOKB:HOOK)[b%4];for(const [o,l,p] of pat)N(ld,p+tr,s+o,l*.92,v+(o===0?8:0))}};
 hook(qD,16,0,98);hook(qL,16,2,104);
 for(let i=ld.length-1;i>=0;i--)if(ld[i].q>=qL+15*B)ld.splice(i,1);
 N(ld,83,qL+15*B,B*.9,112);N(ld,78,qL+15*B,B*.9,96);
 /* ビルドアップ後半にフックを少しだけ（プラックで予告）*/
 const pl=[],arp=(q0,bars,vb,lift)=>{for(let b=0;b<bars;b++){const s=q0+b*B;for(let i=0;i<16;i++){const q=s+i/4,t=tones(chAt(q)).map(p=>57+((p-57)%12+12)%12).sort((x,y)=>x-y),seq=[t[0],t[1],t[2],t[0]+12,t[2],t[1]+12,t[2]+12,t[1]+12];N(pl,seq[i%8]+(lift&&b>=bars/2?12:0),q,.2,vb+(i%4===0?14:0)+(lift?b*3:0))}}};
 arp(qI,8,62,false);arp(qB,8,66,true);arp(qD,16,56,false);arp(qK+4*B,4,60,true);arp(qL,16,58,false);arp(qO,2,54,false);
 for(const [o,l,p] of HOOK[0].concat(HOOK[1].map(([a,b,c])=>[a+4,b,c])))N(pl,p+12,qB+4*B+o,l*.6,78);
 /* ラストドロップの対旋律（オクターブ上のリードは別トラック）*/
 const ld2=ld.filter(n=>n.q>=qL).map(n=>({...n,p:n.p+12,v:n.v-22}));
 const cm=[];for(let b=0;b<15;b++){const s=qL+b*B,ch=chAt(s),t=smpVL(ch,null,64,76,3);N(cm,t[1],s,1.9,74);N(cm,t[2],s+2,1.9,70)}
 /* クワイア（ブレイクとラスト）*/
 const cr=[];smpPadVL(C,cr,qK,qK+8*B,57,72,3,86);smpPadVL(C,cr,qL,qO,59,74,3,72);
 /* ブレイクのメロディ（ピアノの上でベルが歌う）*/
 const bl=smpPhrases(['A5:1.5 G5:.5 E5:2','D5:1 E5:1 G5:2','E5:1.5 D5:.5 B4:2','C5:1 D5:1 E5:2','A5:1.5 G5:.5 E5:2','D5:1 E5:1 G5:1 A5:1','B5:2 A5:2','G#5:2 ~B5:2'],qK,{leg:.95,v:76}).notes;
 /* 効果音 */
 const sf=[{p:66,q:qI+6*B,l:2*B,v:70},{p:60,q:qB,l:B*7,v:96},{p:62,q:qD,l:2,v:110},{p:65,q:qD,l:4,v:110},{p:64,q:qD+B*15,l:B,v:84},{p:61,q:qK,l:B*2,v:80},{p:60,q:qK+B*4,l:B*3.75,v:96},{p:66,q:qK+B*6,l:B*2,v:86},{p:62,q:qL,l:2,v:118},{p:65,q:qL,l:4,v:118},{p:62,q:qO,l:2,v:100}];
 /* ドロップ直前の一瞬の無音（最後の1拍）*/
 const all=[dr,bs,sw,pd,pn,ld,pl,cr,bl];
 for(const w of [qD,qL])for(const L of all)for(let i=L.length-1;i>=0;i--){const n=L[i];if(n.q>=w-1-1e-6&&n.q<w-1e-6){L.splice(i,1);continue}if(n.q<w-1&&n.q+n.l>w-1)n.l=Math.max(.05,w-1-n.q)}
 const fx=(id,o)=>[id,o];
 const tDr=smpTrack('drum',{name:'ドラム',tone:'kit_electro',vol:-2,ci:1,fx:[fx('eq',{hp:28,low:2,mid:-1,midf:450,high:2}),fx('rcomp',{thr:-18,ratio:3,att:.005,rel:.12,gain:1}),fx('reverb',{mix:.1,decay:1,pre:.005,tone:9000})],notes:dr,start:0,clip:'EDM ビート',hum:false});
 const tBs=smpTrack('midi',{name:'ベース',tone:'syn_sbass',vol:-4,ci:2,fx:[fx('sidechain',{depth:.55}),fx('eq',{hp:28,low:2,mid:1,midf:900,high:0}),fx('dist',{drive:.12,tone:3500,mix:.25,out:.8}),fx('rcomp',{thr:-20,ratio:4,gain:1})],notes:bs,start:0,clip:'転がるベース',hum:false});
 const tSw=smpTrack('midi',{name:'スーパーソウ',tone:'syn_supersaw',vol:-9,ci:4,fx:[fx('sidechain',{depth:.7,release:.3}),fx('chorus',{mix:.2,rate:.4,depth:.3}),fx('widener',{width:.7,mix:.6}),fx('reverb',{mix:.26,decay:2.8,pre:.02,tone:9000})],notes:sw,clip:'コード（スーパーソウ）',hum:false});
 const tLd=smpTrack('midi',{name:'リード',tone:'waf_lead_saw',vol:-5,ci:3,fx:[fx('chorus',{mix:.2,rate:.5,depth:.3}),fx('delay',{time:.75,mix:.2,fb:.3,tone:4500}),fx('reverb',{mix:.22,decay:2.6,pre:.02,tone:9000})],notes:ld,clip:'フック（リード）',hum:false});
 const tL2=smpTrack('midi',{name:'リード（オクターブ上）',tone:'syn_supersaw',vol:-11,pan:.15,ci:3,fx:[fx('widener',{width:.7,mix:.7}),fx('reverb',{mix:.3,decay:3,pre:.02,tone:9000})],notes:ld2,clip:'フック（オクターブ上）',hum:false});
 const tCm=smpTrack('midi',{name:'対旋律（ストリングス）',tone:'waf_strings',vol:-14,pan:-.3,ci:5,fx:[fx('sidechain',{depth:.4}),fx('reverb',{mix:.34,decay:3,pre:.02,tone:8000})],notes:cm,clip:'ラストの対旋律',hum:false});
 const tPl=smpTrack('midi',{name:'プラック',tone:'syn_pluck',vol:-10,pan:-.25,ci:0,fx:[fx('pingpong',{time:.75,mix:.26,fb:.35}),fx('reverb',{mix:.22,decay:2.2})],notes:pl,start:0,clip:'アルペジオ',hum:false});
 const tPd=smpTrack('midi',{name:'パッド',tone:'waf_pad_halo',vol:-13,pan:.25,ci:6,fx:[fx('sidechain',{depth:.6}),fx('chorus',{mix:.35}),fx('reverb',{mix:.38,decay:3.6,pre:.03,tone:8000})],notes:pd,start:0,clip:'パッド',hum:false});
 const tPn=smpTrack('midi',{name:'ピアノ（ブレイク）',tone:'smp_sal_hq',vol:-8,pan:-.1,ci:0,fx:[fx('eq',{hp:60,high:1.5}),fx('reverb',{mix:.34,decay:3.2,pre:.02,tone:8000})],notes:pn,clip:'ブレイクのピアノ',hum:false});
 const tBl=smpTrack('midi',{name:'ベル（ブレイク）',tone:'syn_bell',vol:-12,pan:.2,ci:6,fx:[fx('pingpong',{time:.75,mix:.24,fb:.3}),fx('reverb',{mix:.36,decay:3.4})],notes:bl,clip:'ブレイクのメロディ',hum:false});
 const tCr=smpTrack('midi',{name:'クワイア',tone:'waf_choir',vol:-11,ci:5,fx:[fx('chorus',{mix:.3}),fx('reverb',{mix:.4,decay:3.6,pre:.04,tone:8000})],notes:cr,clip:'クワイア',hum:false});
 const tFx=smpTrack('midi',{name:'効果音（ライザー・インパクト）',tone:'sfx',vol:-10,ci:6,fx:[fx('reverb',{mix:.3,decay:3})],notes:sf,start:0,clip:'ライザー・インパクト',hum:false});
 smpMaster([['eq',{hp:28,low:2,mid:-1,midf:500,high:2}],['ott',{depth:.3}],['rcomp',{thr:-18,ratio:2.5,att:.01,rel:.12,gain:1}],['widener',{width:.3,mix:.4}],['limiter',{thr:-1.2,gain:1}]],4.5);
 smpFinish([C.g,tDr,tBs,tSw,tLd,tL2,tCm,tPl,tPd,tPn,tBl,tCr,tFx],null,tLd);
 S.lyrTrack=tLd.id;
}

/* =====================================================================
   6. ネオン・グリッド（80s テクノポップ風）— イントロで少しずつ重なり、A を2回（2回目はベルとハット）、
   B の最後に全員の16分のキメ → 1小節のブレイク → D マイナーへ転調して A'・B' → アウトロ
   ===================================================================== */
function sampleTechno2(){
 const PA=' Cm | Ab | Bb | Gm | Cm | Ab | Fm | G7 |',PB=' Ab | Bb | Gm | Cm | Fm | Bb | Eb | G |',SA="A'（転調）",SB="B'（転調）";
 const C=smpBegin({name:'ネオン・グリッド（80s テクノポップ風）',bpm:126,swing:50,key:[0,'minor'],seed:61,
  secs:[['イントロ',8,0],['A',8,1],['A2',8,1],['B',8,4],['ブレイク',1,6],[SA,8,2],[SB,8,4],['アウトロ',4,5]],
  prog:'| Cm | Cm | Ab | Bb | Cm | Cm | Ab | Bb |'+PA+PA+PB+' A7 |'+smpTrProg(PA+PB,2)+' Dm | Bb | C | Dm |'});
 const {B,sec,chAt,inS}=C;
 const kq=sec['B'].q1-B,KIME=[0,.75,1.5,2.25,3,3.5];
 const MA=['G5:.5 G5:.5 Eb5:.5 C5:.5 D5:.5 Eb5:.5 G5:1','Ab5:1.5 G5:.5 Eb5:1 C5:1','D5:.5 D5:.5 F5:.5 Bb5:.5 Ab5:.5 G5:.5 F5:1','G5:1.5 F5:.5 D5:2',
           'G5:.5 G5:.5 Eb5:.5 C5:.5 D5:.5 Eb5:.5 C6:1','C6:1.5 Bb5:.5 Ab5:1 Eb5:1','F5:.5 Ab5:.5 C6:.5 Ab5:.5 F5:1 Eb5:1','D5:1 F5:1 G5:1 B5:1'];
 const MB=['C6:2 Eb6:2','D6:3 Bb5:1','D6:1 Bb5:1 G5:2','C6:4','Ab5:2 C6:2','D6:2 F6:2','Eb6:2 G6:1 Eb6:1','D6:2 B5:2'];
 const ld=[...smpPhrases(MA,sec.A.q0,{leg:.62,v:88}).notes,...smpPhrases(MA,sec.A2.q0,{leg:.62,v:94}).notes,...smpPhrases(MB.slice(0,7),sec.B.q0,{leg:.98,v:86}).notes,
  ...smpPhrases(MA,sec[SA].q0,{leg:.62,v:98,tr:2}).notes,...smpPhrases(MB.slice(0,7).concat(['~E6:4']),sec[SB].q0,{leg:.98,v:96,tr:2}).notes,
  ...smpPhrases(['D6:2 A5:2','F5:2 D5:2','C6:2 G5:2','~D6:4'],sec['アウトロ'].q0,{leg:.96,v:86}).notes];
 KIME.forEach((o,i)=>smpN(ld,[79,79,83,83,86,86][i],kq+o,.3,104));
 ld.forEach(n=>n.v=smpH(n.v,3));
 const bell=[...smpPhrases(MA,sec.A2.q0,{leg:.8,v:64,tr:12}).notes,...smpPhrases(MA,sec[SA].q0,{leg:.8,v:70,tr:14}).notes];
 /* 対旋律（B' のストリングス・シンセ）: 長い音で上から降りる */
 const cm=[];{const sc=sec[SB];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B,t=smpVL(chAt(s),null,67,81,3);smpN(cm,t[2],s,1.9,72);smpN(cm,t[1],s+2,1.9,66)}}
 const bs=[];for(let b=0;b<C.bars;b++){const s=b*B,r=smpLow(smpBassPc(chAt(s)),36);
  if(b===C.bars-1){smpN(bs,r,s,3.5,100);continue}
  if(s===kq){KIME.forEach(o=>smpN(bs,r,s+o,.3,110));continue}
  if(inS(s,'ブレイク'))continue;
  if(inS(s,'イントロ')&&b<4){if(b>=2)for(let k=0;k<4;k++)smpN(bs,r,s+k,.3,70+b*6);continue}
  for(let i=0;i<8;i++){const q=s+i/2,rr=smpLow(smpBassPc(chAt(q)),36);smpN(bs,rr+(i%2?12:0),q,.42,i%2?84:104)}}
 const ar=[];for(let b=0;b<C.bars-1;b++){const s=b*B;if(s===kq)continue;const up=inS(s,SA,SB)?12:0;
  for(let i=0;i<16;i++){const q=s+i/4,v=smpVoice(chAt(q),60,3),seq=[v[0],v[1],v[2],v[0]+12,v[2],v[1]];smpN(ar,seq[i%6]+up,q,.22,smpH(i%4===0?78:62,3)+(inS(s,'ブレイク')?i*2:0)+(inS(s,'イントロ')?-14+b*2:0))}}
 const pd=[],cr=[];
 smpPadVL(C,pd,sec.A.q0,kq,53,70,4,58);smpPadVL(C,pd,sec[SA].q0,sec['アウトロ'].q1,55,72,4,58);smpPadVL(C,pd,sec['イントロ'].q0+4*B,sec.A.q0,53,70,4,46);
 smpPadVL(C,cr,sec.B.q0,kq,60,76,3,66);smpPadVL(C,cr,sec[SA].q0,sec['アウトロ'].q0,62,78,3,60);
 {const v=smpVL(chAt(kq),null,67,80,4);KIME.forEach(o=>v.forEach(p=>smpN(pd,p,kq+o,.3,90)))}
 const dr=[];const ends=new Set(smpSecs().map(x=>x.q1));
 for(let b=0;b<C.bars;b++){const s=b*B,intro=inS(s,'イントロ'),last=b===C.bars-1,secEnd=ends.has(s+B);
  if(last){smpN(dr,36,s,.5,118);smpN(dr,49,s,3,108);continue}
  if(s===kq){KIME.forEach(o=>{smpN(dr,36,s+o,.4,120);smpN(dr,38,s+o,.4,112)});smpN(dr,49,s+3.5,2,110);continue}
  if(inS(s,'ブレイク')){for(let i=0;i<16;i++)smpN(dr,38,s+i/4,.25,40+i*5);continue}
  if(intro&&b<4){if(b>=2)for(let i=0;i<16;i++)smpN(dr,42,s+i/4,.25,smpH(i%4===0?60:40,3));continue}
  [0,2,2.5].forEach(o=>smpN(dr,36,s+o,.5,smpH(112,4)));if(inS(s,'A2','B',SA,SB))smpN(dr,36,s+3.5,.4,90);
  if(!intro||b>=6){smpN(dr,38,s+1,.5,smpH(108,3));if(!secEnd)smpN(dr,38,s+3,.5,smpH(110,3))}
  if(inS(s,'A2','B',SA,SB)){smpN(dr,39,s+1,.5,96);smpN(dr,39,s+3,.5,96)}
  for(let i=0;i<16;i++)if(!(secEnd&&i>=12))smpN(dr,42,s+i/4,.25,smpH(i%4===0?82:i%2?50:66,3));
  if(inS(s,'A2',SA,SB))smpN(dr,46,s+1.5,.4,70),smpN(dr,46,s+3.5,.4,70);
  if(smpSecs().some(x=>x.q0===s&&x.name!=='イントロ')||(b%8===4&&!intro))smpN(dr,49,s,2,112);
  if(secEnd)[3,3.25,3.5,3.75].forEach((o,i)=>smpN(dr,i<2?38:[50,47][i-2],s+o,.25,92+i*8));
 }
 const fxn=[{p:66,q:sec['イントロ'].q0+6*B,l:2*B,v:70},{p:64,q:sec['ブレイク'].q0,l:B,v:96},{p:62,q:sec[SA].q0,l:2,v:100},{p:66,q:sec.B.q0-2*B,l:2*B,v:70},{p:62,q:sec.A.q0,l:2,v:80}];
 const tDr=smpTrack('drum',{name:'ドラムマシン',tone:'kit_sd_LM-2',vol:-5,ci:1,fx:[['eq',{hp:30,low:1.5,high:1.5}],['rcomp',{thr:-18,ratio:3,att:.005,gain:1}],['reverb',{mix:.18,decay:.9,pre:.005,tone:8000}]],notes:dr,start:0,clip:'テクノ・ビート',hum:false});
 const tBs=smpTrack('midi',{name:'シーケンス・ベース',tone:'waf_synth_bass',vol:-6,ci:2,fx:[['eq',{hp:30,low:1.5,mid:1,midf:900}],['rcomp',{thr:-20,ratio:4,gain:1}]],notes:bs,start:0,clip:'8分オクターブ',hum:false});
 const tAr=smpTrack('midi',{name:'アルペジオ',tone:'syn_pluck',vol:-13,pan:-.38,ci:0,fx:[['chorus',{mix:.25,rate:.6,depth:.3}],['pingpong',{time:.75,mix:.24,fb:.35}],SMPFX.plate(.18,1.6)],notes:ar,start:0,clip:'16分アルペジオ',hum:false});
 const tPd=smpTrack('midi',{name:'パッド',tone:'waf_pad_warm',vol:-16,pan:.3,ci:5,fx:[['chorus',{mix:.4}],SMPFX.hall(.3,3)],notes:pd,clip:'パッド'});
 const tCr=smpTrack('midi',{name:'クワイア',tone:'waf_choir',vol:-16,pan:-.12,ci:5,fx:[['phaser',{mix:.3,rate:.2,depth:.5,fb:.3}],SMPFX.hall(.34,3)],notes:cr,clip:"B と A'・B' のクワイア"});
 const tCm=smpTrack('midi',{name:'シンセ・ストリングス（対旋律）',tone:'waf_synth_strings',vol:-14,pan:.25,ci:5,fx:[['chorus',{mix:.3}],SMPFX.hall(.3,2.8)],notes:cm,clip:"B' の対旋律"});
 const tLd=smpTrack('midi',{name:'リード',tone:'waf_lead_saw',vol:-8,pan:.05,ci:3,fx:[['chorus',{mix:.2,rate:.5,depth:.3}],['delay',{time:.75,mix:.2,fb:.32,tone:4000}],SMPFX.plate(.2,1.8)],notes:ld,clip:'メロディ',hum:false});
 const tBl=smpTrack('midi',{name:'FMベル',tone:'syn_bell',vol:-18,pan:.38,ci:6,fx:[['pingpong',{time:.5,mix:.2}],SMPFX.hall(.3,2.6)],notes:bell,clip:"A2・A' のオクターブ重ね",hum:false});
 const tFx=smpTrack('midi',{name:'効果音',tone:'sfx',vol:-14,pan:0,ci:6,fx:[SMPFX.hall(.3,3)],notes:fxn,clip:'ライザー・インパクト',hum:false});
 smpMaster([['eq',{hp:28,low:1.5,mid:-.5,midf:500,high:2}],['rcomp',{thr:-18,ratio:2.5,att:.015,rel:.15,gain:1}],['tape',{drive:.04,wobble:.02,tone:12000}],['widener',{width:.3,mix:.4}],['limiter',{thr:-1.2,gain:1}]],0);
 smpFinish([C.g,tDr,tBs,tAr,tPd,tCr,tCm,tLd,tBl,tFx],null,tLd);
}

/* =====================================================================
   2. レッドライン・ランナー — サビのあとに 8 小節のギターソロを追加
   ===================================================================== */
function sampleRock2(){
 const RF=' Em | Em | Em | Em:2 D:.5 C:.5 B:1 |';
 const C=smpBegin({name:'レッドライン・ランナー（ハードロック）',bpm:138,swing:50,key:[4,'minor'],seed:23,
  secs:[['イントロ',4,0],['リフ',8,1],['加速',4,3],['サビ',8,4],['ギターソロ',8,6],['スロー',4,5],['再加速',4,3],['キメ',2,6],['ラストサビ（転調）',8,4],['エンディング',2,6]],
  prog:'|'+RF+RF+RF+' C | D | C | B7 | Em | C | G | D | Em | C | D | D | Em | C | D | B7 | Em | C | Am | B7 | Am | C | Em | B7 |'+RF+' C:2 D:2 | C#7 | F#m | D | A | E | F#m | D | E | C#7 | F#m | F#m |'});
 const {B,sec,chAt}=C,LS='ラストサビ（転調）';
 const T=[{q:0,bpm:138}];
 smpRamp(T,sec['加速'].q0,sec['加速'].q1,138,168);
 smpRamp(T,sec['サビ'].q1-B,sec['サビ'].q1,168,150);
 T.push({q:sec['スロー'].q0,bpm:100});
 smpRamp(T,sec['再加速'].q0,sec['再加速'].q1,100,176);
 smpRamp(T,sec['エンディング'].q0,sec['エンディング'].q1,176,104);
 smpTempo(T);
 const RIFF1='E2:.5 E2:.25 E2:.25 G2:.5 E2:.5 A2:.5 E2:.25 E2:.25 Bb2:.25 A2:.25 G2:.5';
 const RIFF2='E2:.5 E2:.25 E2:.25 G2:.5 E2:.5 D3:.5 C3:.5 B2:1';
 const roots=[];
 const riff=(q0,bars)=>{for(let b=0;b<bars;b++)roots.push(...smpMel(b%4===3?RIFF2:RIFF1,q0+b*B,{leg:.92,v:100}))};
 const chug=(q0,bars,acc)=>{for(let b=0;b<bars;b++){const s=q0+b*B;for(let i=0;i<8;i++){const q=s+i/2,r=smpLow(smpBassPc(chAt(q)),40);roots.push({p:r,q,l:i%2?.22:.45,v:(acc&&acc.includes(i))?112:90})}}};
 riff(sec['イントロ'].q0,4);riff(sec['リフ'].q0,8);chug(sec['加速'].q0,4,[0,3,6]);chug(sec['サビ'].q0,8,[0,3,6]);chug(sec['ギターソロ'].q0,8,[0,3,6]);
 for(let b=0;b<4;b++){const s=sec['スロー'].q0+b*B;roots.push({p:smpLow(smpBassPc(chAt(s)),40),q:s,l:3.9,v:96})}
 riff(sec['再加速'].q0,4);
 /* キメ: 全員でユニゾンのブレイク → C#7 を伸ばして転調 */
 {const s=sec['キメ'].q0;[0,.75,1.5,2,2.75,3.5].forEach(o=>roots.push({p:smpLow(smpBassPc(chAt(s+o)),40),q:s+o,l:o===3.5?.45:.3,v:118}));roots.push({p:49,q:s+B,l:3.9,v:120})}
 chug(sec[LS].q0,8,[0,2,3,6]);
 roots.push({p:42,q:sec['エンディング'].q0,l:3.9,v:118},{p:42,q:sec['エンディング'].q0+B,l:3.6,v:124});
 const power=(L,dt)=>L.flatMap(n=>{const pm=(n.p===40||n.p===42)&&n.l<=.3&&!n.kime;const l=pm?.18:n.l,v=pm?n.v-14:n.v;return[n.p,n.p+7,n.p+12].map((p,i)=>({p,q:n.q+(dt||0)+i*.004,l,v:smpH(v-(i?6:0),5)}))});
 const gL=power(roots,0),gR=power(roots,.012);
 const CHO=['E4:1 G4:.5 A4:.5 B4:1.5 A4:.5','G4:1.5 E4:.5 G4:1 A4:1','B4:1 D5:1.5 B4:.5 A4:1','A4:2 F#4:1 D4:1',
            'E4:.5 G4:.5 B4:.5 E5:1.5 D5:.5 B4:.5','C5:1.5 B4:.5 G4:1 E4:1','F#4:1 A4:1 D5:1 C5:.5 A4:.5'];
 const ldLast=smpPhrases([...CHO,'B4:2 A4:.5 F#4:.5 D#4:1'],sec[LS].q0,{leg:.97,v:108,tr:2}).notes;
 const ld=[...smpPhrases(['E4:1 G4:1 C5:1 E5:1','D5:1 F#4:1 A4:1 D5:1','E5:1 G5:1 C6:1 B5:1','B5:2 A5:1 F#5:1'],sec['加速'].q0,{leg:.96,v:92}).notes,
  ...smpPhrases([...CHO,'B4:3 r:1'],sec['サビ'].q0,{leg:.97,v:100}).notes,
  ...smpPhrases(['E5:2 C5:1 A4:1','G4:1.5 C5:.5 E5:2','B4:3 G4:1','F#4:2 D#5:2'],sec['スロー'].q0,{leg:.99,v:96}).notes,
  ...smpPhrases(['E5:.5 E5:.25 E5:.25 G5:.5 E5:.5 A5:.5 E5:.25 E5:.25 Bb5:.25 A5:.25 G5:.5','~C#6:4'],sec['キメ'].q0,{leg:.9,v:104}).notes,
  ...ldLast,{p:78,q:sec['エンディング'].q0,l:7.6,v:112}];
 /* ギターソロ: E マイナー・ペンタで歌い出し → 16分の下降 → 駆け上がって B7 の高い F# でのばす */
 const SOLO=['B4:.5 D5:.5 E5:1 ~E5:.5 D5:.25 E5:.25 G5:1','A5:.75 G5:.25 E5:.5 G5:.5 E5:.5 D5:.5 B4:1','D5:.25 E5:.25 F#5:.25 A5:.25 D6:1.5 C6:.5 A5:.5 F#5:.5','D#5:.5 F#5:.5 A5:.5 ~B5:2.5',
  'E6:.25 D6:.25 B5:.25 A5:.25 D6:.25 B5:.25 A5:.25 G5:.25 B5:.25 A5:.25 G5:.25 E5:.25 A5:.25 G5:.25 E5:.25 D5:.25','E5:.5 G5:.5 A5:.5 C6:.5 ~B5:1 A5:.5 G5:.5',
  'A4:.25 C5:.25 E5:.25 A5:.25 C6:.25 E6:.25 A6:.5 G6:.25 E6:.25 C6:.25 A5:.25 G5:.5 E5:.5','F#5:.25 A5:.25 B5:.25 D#6:.25 ~F#6:3'];
 const so=smpPhrases(SOLO,sec['ギターソロ'].q0,{leg:.95,v:106}).notes;
 /* 長い音の前にチョーキング風の装飾（全音下からすくい上げる）*/
 so.filter(n=>n.l>=1).forEach(n=>so.push({p:n.p-2,q:n.q-.12,l:.1,v:n.v-12}));
 ld.push(...so);
 ld.forEach(n=>n.v=smpH(n.v,5));
 /* ツイン・リード（ラストサビだけ・3度上のハモリ）*/
 const hm=smpHarm(ldLast.filter(n=>n.q<sec[LS].q1-B),6,'minor',2);hm.forEach(n=>{n.q+=.008;n.v=smpH(n.v+2,4)});
 const bs=roots.map(n=>({p:n.p-12,q:n.q,l:n.l<=.3?.22:n.l*.95,v:smpH(n.v-4,5)}));
 const og=[];for(const nm of ['サビ','ギターソロ','スロー',LS]){const sc=sec[nm];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;for(const p of smpVoice(chAt(s),55,4))smpN(og,p,s,B*.98,nm==='スロー'?80:70)}}
 const dr=[],fill=(s,big)=>{[[3,50],[3.25,50],[3.5,47],[3.75,43]].forEach(([o,p],i)=>smpN(dr,p,s+o,.25,100+i*6));if(big)[2,2.25,2.5,2.75].forEach((o,i)=>smpN(dr,38,s+o,.25,80+i*8))};
 const grooveRiff=(q0,bars,lastFill)=>{for(let b=0;b<bars;b++){const s=q0+b*B,last=b===bars-1;
  if(b===0)smpN(dr,49,s,2,112);
  [0,.75,2,2.5].forEach(o=>smpN(dr,36,s+o,.5,smpH(110,5)));smpN(dr,38,s+1,.5,smpH(112,4));if(!(last&&lastFill))smpN(dr,38,s+3,.5,smpH(114,4));
  for(let i=0;i<8;i++)if(!(last&&lastFill&&i>=6))smpN(dr,42,s+i/2,.5,smpH(i%2?70:96,5));
  if(last&&lastFill)fill(s,false)}};
 {const s0=sec['イントロ'].q0;[3,3.25,3.5,3.75].forEach((o,i)=>smpN(dr,38,s0+B+o,.25,70+i*12));grooveRiff(s0+2*B,2,true)}
 grooveRiff(sec['リフ'].q0,8,true);
 for(let b=0;b<4;b++){const s=sec['加速'].q0+b*B;if(b===0)smpN(dr,49,s,2,110);
  for(let k=0;k<4;k++)smpN(dr,36,s+k,.5,112);
  if(b<3){smpN(dr,38,s+1,.5,110);smpN(dr,38,s+3,.5,112);for(let i=0;i<8;i++)smpN(dr,46,s+i/2,.4,smpH(i%2?74:90,5))}
  else for(let i=0;i<16;i++)smpN(dr,38,s+i/4,.25,64+i*3.6)}
 const drive=(q0,bars,dbl)=>{for(let b=0;b<bars;b++){const s=q0+b*B,last=b===bars-1;
  smpN(dr,49,s,2,b%2?100:118);if(b===0&&dbl)smpN(dr,57,s,2,110);
  if(dbl)for(let i=0;i<8;i++)smpN(dr,36,s+i/2,.4,smpH(i%2?96:112,5));else [0,1.5,2,2.5].forEach(o=>smpN(dr,36,s+o,.5,smpH(110,5)));
  smpN(dr,38,s+1,.5,smpH(116,4));if(!last)smpN(dr,38,s+3,.5,smpH(118,4));
  for(let i=0;i<8;i++)if(!(last&&i>=6))smpN(dr,51,s+i/2,.5,smpH(i%2?78:96,5));
  if(last)fill(s,true)}};
 drive(sec['サビ'].q0,8,false);drive(sec['ギターソロ'].q0,8,false);
 for(let b=0;b<4;b++){const s=sec['スロー'].q0+b*B;if(b===0)smpN(dr,49,s,3,116);
  smpN(dr,36,s,.5,104);smpN(dr,36,s+2.5,.5,96);smpN(dr,38,s+2,.5,112);
  for(let k=0;k<4;k++)smpN(dr,51,s+k,.5,smpH(80,5));if(b===3)[3,3.5].forEach((o,i)=>smpN(dr,[47,43][i],s+o,.5,104))}
 grooveRiff(sec['再加速'].q0,4,true);
 {const s=sec['キメ'].q0;[0,.75,1.5,2,2.75,3.5].forEach(o=>{smpN(dr,36,s+o,.4,122);smpN(dr,49,s+o,.6,o?104:122)});
  for(let i=0;i<16;i++)smpN(dr,[38,38,50,50,47,47,45,45,43,43,41,41,38,38,38,38][i],s+B+i/4,.25,80+i*2.8)}
 drive(sec[LS].q0,8,true);
 {const s=sec['エンディング'].q0;smpN(dr,49,s,4,124);smpN(dr,57,s,4,118);smpN(dr,36,s,.5,124);
  for(let i=0;i<12;i++)smpN(dr,[50,50,47,47,45,45,43,43,41,41,38,38][i],s+1+i/4,.25,90+i*2.5);
  smpN(dr,49,s+B,4,127);smpN(dr,57,s+B,4,120);smpN(dr,36,s+B,.5,127);smpN(dr,38,s+B,.5,120)}
 const tDr=smpTrack('drum',{name:'ドラム',tone:'kit_vd',vol:-5,ci:1,fx:[['eq',{hp:30,low:2,mid:-1.5,midf:450,high:2}],['rcomp',{thr:-18,ratio:3.5,att:.006,rel:.12,gain:1.2}],SMPFX.room(.16)],notes:dr,start:0,clip:'ロック・ビート'});
 const tBs=smpTrack('midi',{name:'ベース（ピック）',tone:'waf_pick_bass',vol:-6,pan:0,ci:2,fx:[['eq',{hp:35,low:2,mid:1.5,midf:800,high:0}],['dist',{drive:.15,tone:3000,mix:.3,out:.8}],['rcomp',{thr:-20,ratio:4,gain:1.2}]],notes:bs,start:0,clip:'リフ＆8分刻み'});
 const gfx=hi=>[['eq',{hp:90,low:-1,mid:-2.5,midf:450,high:hi}],['rcomp',{thr:-20,ratio:3,att:.01,rel:.15,gain:1.15}],SMPFX.room(.1)];
 const tGL=smpTrack('midi',{name:'リズムギター L（ディストーション）',tone:'waf_clean_gtr',vol:-9,pan:-.75,ci:4,fx:[...SMPAMP(.8,{tone:3300,mid:3}),...gfx(1.5).slice(1)],notes:gL,start:0,clip:'疾走リフ（L）',hum:[.005,3]});
 const tGR=smpTrack('midi',{name:'リズムギター R（オーバードライブ）',tone:'waf_lp_clean',vol:-9,pan:.75,ci:4,fx:[...SMPAMP(.68,{tone:3700,mid:2,midf:1100}),...gfx(2).slice(1)],notes:gR,start:0,clip:'疾走リフ（R・ダブル）',hum:[.005,3]});
 const lfx=[...SMPAMP(.62,{tone:4300,mid:4,midf:1000,cab:6000}),['rcomp',{thr:-22,ratio:3,gain:1.15}],['delay',{time:.75,fb:.3,mix:.17,tone:3800}],SMPFX.plate(.22,2)];
 const tLd=smpTrack('midi',{name:'リードギター',tone:'waf_lp_clean',vol:-5,pan:-.12,ci:3,fx:lfx,notes:ld,clip:'リードメロディ'});
 const tHm=smpTrack('midi',{name:'リードギター（ハモリ）',tone:'waf_clean_gtr',vol:-8,pan:.18,ci:3,fx:lfx,notes:hm,clip:'ツイン・リード'});
 const tOg=smpTrack('midi',{name:'オルガン',tone:'waf_organ',vol:-17,pan:.3,ci:0,fx:[['rotary',{mix:.7}],SMPFX.room(.14)],notes:og,clip:'オルガン'});
 smpMaster([['eq',{hp:30,low:1.5,mid:.5,midf:2000,high:1.5}],['rcomp',{thr:-18,ratio:3,att:.015,rel:.15,gain:1.3}],['tape',{drive:.05,wobble:0,tone:12000}],['exciter',{amount:.15,freq:6000}],['limiter',{thr:-1.2,gain:1}]],0);
 smpFinish([C.g,tDr,tBs,tGL,tGR,tLd,tHm,tOg],null,tLd);
}

/* =====================================================================
   1. 夕凪のテラス — B のあとにフルートのアドリブ・ソロ（ベースはウォーキング、ライドが前に出る）
   ===================================================================== */
function sampleTrio2(){
 const C=smpBegin({name:'夕凪のテラス（フルート・トリオ）',bpm:76,swing:60,key:[5,'major'],seed:11,
  secs:[['イントロ',4,0],['A',8,1],['B',8,4],['フルート・ソロ',8,3],['ブレイク',2,6],["A'（転調）",8,2],['エンディング',4,5]],
  prog:'| Bbmaj7 | Am7 | Gm7 | C7sus4 C7 |'+
   ' Fmaj7 | Am7 | Bbmaj7 | C7sus4 C7 | Fmaj7 | Dm7 | Gm7 | C7 |'+
   ' Bbmaj7 | Am7 | Gm7 | Fmaj7 | Bbmaj7 | A7 | Dm7 G7 | Gm7 C7 |'+
   ' Fmaj7 | Am7 | Bbmaj7 | C7sus4 C7 | Fmaj7 | Dm7 | Gm7 | C7 |'+
   ' Gm7 C7 | Am7 D7 |'+
   ' Gmaj7 | Bm7 | Cmaj7 | D7sus4 D7 | Gmaj7 | Em7 | Am7 | D7 |'+
   ' Cmaj7 | D7sus4 | Gmaj7 | Gmaj9 |'});
 const {B,sec,chAt,same,inS}=C,SA="A'（転調）";
 /* テンポ: ブレイクで少し溜め、エンディングで大きくリタルダンド */
 const T=[{q:0,bpm:76}];smpRamp(T,sec['ブレイク'].q0,sec['ブレイク'].q1,76,68,1);T.push({q:sec[SA].q0,bpm:76});
 smpRamp(T,sec['エンディング'].q0+2*B,sec['エンディング'].q1,76,46,1);smpTempo(T);
 /* フルート */
 const A=['r:1 A4:.5 C5:.5 E5:1.5 D5:.5','C5:3 r:.5 A4:.5','D5:.5 F5:.5 A5:1.5 G5:.5 F5:1','G5:2 F5:.5 E5:1.5',
          'r:.5 A4:.5 C5:.5 F5:.5 E5:1 C5:1','D5:2.5 F5:.5 A5:1','G5:1.5 F5:.5 D5:1 Bb4:1'];
 const Bm=['F5:1 Bb5:1.5 A5:.5 F5:1','E5:1.5 G5:.5 C5:2','D5:1 F5:1.5 E5:.5 D5:1','C5:3 r:.5 C5:.5',
           'D5:.5 F5:.5 A5:1 C6:1.5 Bb5:.5','A5:1.5 G5:.5 E5:1 C#5:1','D5:1.5 F5:.5 B4:1 D5:1','Bb4:1 A4:.5 G4:.5 E5:2'];
 const RUN=['G4:.25 Bb4:.25 D5:.25 F5:.25 A5:.5 G5:.5 E5:.25 G5:.25 Bb5:.25 C6:.25 ~D6:1','C6:.25 B5:.25 A5:.25 G5:.25 E5:.5 C5:.5 D5:.25 F#5:.25 A5:.25 C6:.25 ~B5:1'];
 const fo={leg:.97,v:76};
 const fl=[...smpPhrases([...A,'C5:3 r:1'],sec.A.q0,fo).notes,...smpPhrases(Bm,sec.B.q0,{...fo,v:82}).notes,
  ...smpPhrases(RUN,sec['ブレイク'].q0,{leg:1,v:84}).notes,
  ...smpPhrases([...A,'C5:1 D5:.5 E5:.5 G5:2'],sec[SA].q0,{...fo,v:84,tr:2}).notes,
  ...smpPhrases(['B5:1.5 A5:.5 G5:2','A5:3 G5:.5 F#5:.5','~G5:4','r:.5 B5:.5 ~A5:3'],sec['エンディング'].q0,{...fo,v:74}).notes];
 /* フルート・ソロ（アドリブ風）: 拍頭はコードの音、間はスケール、ときどき3連の装飾 */
 const SOQ=sec['フルート・ソロ'].q0;
 fl.push(...smpPhrases(['r:.5 C5:.5 F5:.5 A5:.5 C6:1.5 A5:.5'],SOQ,{leg:.95,v:80}).notes,...smpJazzLine(C,SOQ+B,6,67,86,{rest:.18,tri:.16,start:77}),
  ...smpPhrases(['Bb5:.5 A5:.5 G5:.5 E5:.5 C5:1 r:1'],SOQ+7*B,{leg:.95,v:78}).notes);
 fl.forEach(n=>{n.v=smpH(n.v+(n.l>=1.5?5:0)+(n.p>=81?5:0)-(n.l<=.25?6:0),5)});
 /* ナイロンギター: 指弾きのアルペジオ（2拍ごとに 低音→和音の3音・よく響かせる）*/
 const gt=[];
 for(let b=0;b<C.bars;b++){const s=b*B;
  if(inS(s,'ブレイク')){const hits=b===sec['ブレイク'].q0/B?[0]:[0,2];for(const o of hits){const ch=chAt(s+o);[smpLow(smpBassPc(ch),40),...smpVoice(ch,55,4)].forEach((p,i)=>smpN(gt,p,s+o+i*.04,o?1.8:1.6,smpH(62,4)))}continue}
  if(b===C.bars-1){const ch=chAt(s),v=smpVoice(ch,59,5);[smpLow(smpBassPc(ch),40),smpLow(smpBassPc(ch),40)+7,...v].forEach((p,i)=>smpN(gt,p,s+i*.11,4-i*.11,smpH(58-i,3)));continue}
  for(let h=0;h<2;h++){const q=s+h*2,ch=chAt(q),v=smpVoice(ch,55,4),bs=smpLow(smpBassPc(ch),40);
   smpN(gt,bs,q,2,smpH(b<2?56:62,4));
   [v[1],v[2],v[3]].forEach((p,i)=>smpN(gt,p,q+.5+i*.5,1.55-i*.5,smpH(46+(i===1?4:0),5)));
   if(h===1&&b%4===3)smpN(gt,v[0]+12,q+1.75,.3,smpH(40,4));
  }
 }
 /* ウッドベース: A は2ビート、B と A' はウォーキング */
 const bs=[],low=pc=>smpLow(pc,31);
 const walkBar=s=>{for(let k=0;k<4;k++){const q=s+k,ch=chAt(q),nx=chAt(q+1),start=k===0||!same(chAt(q-1),ch),chg=!same(nx,ch);
  let p;if(start)p=low(smpBassPc(ch));else if(chg){const t=low(smpBassPc(nx));p=k%2?t-1:t+2}else{const iv=smpIv(ch);p=low(ch.root%12)+(k===1?iv[1]:iv[2])}
  smpN(bs,p,q,.92,smpH(start?84:74,5))}};
 for(let b=2;b<C.bars;b++){const s=b*B,ch=chAt(s);
  if(b<4){smpN(bs,low(smpBassPc(ch)),s,b===3?1.9:3.8,72);if(b===3)smpN(bs,low(smpBassPc(chAt(s+2))),s+2,1.9,70);continue}
  if(inS(s,'ブレイク')){const hits=b===sec['ブレイク'].q0/B?[0]:[0,2];for(const o of hits)smpN(bs,low(smpBassPc(chAt(s+o))),s+o,o?1.8:1.5,80);continue}
  if(b===C.bars-1){smpN(bs,low(smpBassPc(ch))-12+12,s,4,72);continue}
  if(inS(s,'B','フルート・ソロ',SA)||inS(s,'エンディング')&&b<C.bars-2){walkBar(s);continue}
  const c2=chAt(s+2);smpN(bs,low(smpBassPc(ch)),s,1.85,smpH(82,5));
  smpN(bs,same(c2,ch)?low(ch.root%12)+smpIv(ch)[2]:low(smpBassPc(c2)),s+2,1.6,smpH(72,5));
  if(b%2)smpN(bs,low(smpBassPc(chAt(s+4)))-1,s+3.5,.45,60);
 }
 /* ドラム（生ドラム: ライドのレガート＋ペダルハット＋キックのフェザー）*/
 const dr=[],rim=[];
 for(let b=2;b<C.bars;b++){const s=b*B;
  if(b<4){[0,1,2,3].forEach(k=>smpN(dr,51,s+k,.5,smpH(28+b*4,4)));continue}
  if(inS(s,'ブレイク')){if(b===sec['ブレイク'].q0/B)smpN(dr,49,s,3,58),smpN(dr,36,s,.5,52);else{smpN(dr,36,s,.5,46);smpN(dr,51,s+2,.5,44);for(let i=0;i<6;i++)smpN(dr,38,s+3+i/6,.16,24+i*6)}continue}
  if(b===C.bars-1){smpN(dr,51,s,4,48);smpN(dr,49,s,4,40);smpN(dr,36,s,.5,40);continue}
  const loud=inS(s,'B','フルート・ソロ',SA),base=loud?54:46;
  [[0,1],[1,.9],[1.5,.6],[2,1],[3,.9],[3.5,.6]].forEach(([o,m])=>smpN(dr,51,s+o,.5,smpH(base*m+(o%2===1?6:0),4)));
  smpN(dr,44,s+1,.5,smpH(34,3));smpN(dr,44,s+3,.5,smpH(36,3));
  smpN(dr,36,s,.5,smpH(32,3));smpN(dr,36,s+2,.5,smpH(24,3));
  smpN(rim,37,s+3,.4,smpH(loud?58:48,4));if(loud&&b%2)smpN(rim,37,s+2.5,.4,smpH(36,4));
  if(s===sec[SA].q0)smpN(dr,49,s,3,64);
 }
 /* A' で ストリングスがそっと入る */
 const st=[];for(let b=sec[SA].q0/B;b<C.bars;b++){const s=b*B;smpVoice(chAt(s),55,4,true).forEach(p=>smpN(st,p,s,B*.99,smpH(b===sec[SA].q0/B?40:50,3)))}
 const tFl=smpTrack('midi',{name:'フルート',tone:'tj_flute',vol:-5,pan:.06,ci:3,fx:[['eq',{hp:180,low:0,mid:-1,midf:900,high:1.5}],SMPFX.glue(-22,2,1),['delay',{time:.75,fb:.2,mix:.09,tone:3500}],SMPFX.hall(.28,2.8)],notes:fl,clip:'メロディ（フルート）'});
 const tGt=smpTrack('midi',{name:'ナイロンギター',tone:'waf_nylon',vol:-9,pan:-.3,ci:4,fx:[SMPFX.warmEq(70),SMPFX.glue(-20,2,1),['chorus',{mix:.14,rate:.3,depth:.25}],SMPFX.hall(.22,2.4)],notes:gt,start:0,clip:'指弾きアルペジオ'});
 const tBs=smpTrack('midi',{name:'ウッドベース',tone:'waf_ac_bass',vol:-6,pan:.1,ci:2,fx:[['eq',{hp:35,low:1.5,mid:-1,midf:450,high:.5}],SMPFX.glue(-20,3,1),SMPFX.room(.1)],notes:bs,clip:'2ビート／ウォーキング'});
 const tDr=smpTrack('drum',{name:'ドラム',tone:'kit_vd',vol:-13,pan:0,ci:1,fx:[['eq',{hp:40,low:-1,mid:-1,midf:600,high:1}],SMPFX.hall(.22,1.9)],notes:dr,clip:'ジャズ・レガート'});
 const tRim=smpTrack('drum',{name:'クロススティック',tone:'kit_wd_FluidR3_GM_sf2_file',vol:-19,pan:-.12,ci:1,fx:[SMPFX.hall(.25,1.8)],notes:rim,clip:'4拍目'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_slow_strings',vol:-18,pan:.28,ci:5,fx:[SMPFX.hall(.38,3.2)],notes:st,clip:"A' から"});
 smpMaster([['eq',{hp:25,low:.5,mid:0,midf:1000,high:1.5}],['rcomp',{thr:-18,ratio:1.8,att:.03,rel:.3,gain:1}],['reverb',{mix:.07,decay:2.4,pre:.02,tone:8000}],['limiter',{thr:-1.2,gain:1}]],7.5);
 smpFinish([C.g,tDr,tRim,tBs,tGt,tSt,tFl],null,tFl);
}

/* =====================================================================
   3. 回転木馬の午後 — ストリングスをなめらかな和音のつなぎに、チェロの対旋律を追加
   ===================================================================== */
function sampleCarousel2(){
 const PA='| F | F | C7 | C7 | C7 | C7 | F | F |',PA2=' F | F7 | Bb | Bbm | F | C7 | F | F |',SA="A'（転調）";
 const AB=PA.slice(1)+PA2;
 const C=smpBegin({name:'回転木馬の午後（オーケストラ＆オルゴール）',bpm:150,swing:50,key:[5,'major'],sig:{n:3,d:4},seed:37,
  secs:[['オルゴール前奏',8,0],['A',16,1],['B',16,4],['止まりかけ',4,6],[SA,16,2],['コーダ',8,5]],
  prog:PA+AB+' Bb | Bb | F | F | C7 | C7 | F | F | Bb | Bb | F | D7 | Gm | C7 | F | C7 |'+' Db | Bbm | Eb7 | Eb7 |'+smpTrProg(AB,3)+smpTrProg(PA.slice(1),3)});
 const {B,sec,chAt}=C;
 const MA=['C5:1 F5:1 A5:1','C6:2 A5:1','G5:1 Bb5:1 G5:1','E5:2 C5:1','D5:1 E5:1 G5:1','Bb5:2 G5:1','A5:1 G5:1 F5:1','F5:2 C5:1',
           'F5:1 A5:1 C6:1','Eb6:2 C6:1','D6:1 C6:1 Bb5:1','Db6:2 Bb5:1','A5:1 C6:1 A5:1','G5:2 E5:1','F5:3','r:3'];
 const MB=['D6:2 C6:1','Bb5:2 F5:1','A5:1 C6:1 A5:1','F5:3','G5:1 Bb5:1 E5:1','G5:3','A5:1 F5:1 C5:1','F5:3',
           'D6:1 F6:1 D6:1','Bb5:3','C6:1 A5:1 F5:1','F#5:2 A5:1','Bb5:1 D6:1 Bb5:1','G5:2 E5:1','F5:3','E5:1 G5:1 C6:1'];
 /* テンポ: 止まりかけで 150→48、A' は 72 から加速して 150、コーダでねじが切れる */
 const T=[{q:0,bpm:150}];smpRamp(T,sec['止まりかけ'].q0,sec['止まりかけ'].q1-B,150,62,1);T.push({q:sec['止まりかけ'].q1-B,bpm:48});
 T.push({q:sec[SA].q0,bpm:72});smpRamp(T,sec[SA].q0,sec[SA].q0+4*B,72,150,1);
 smpRamp(T,sec['コーダ'].q0+2*B,sec['コーダ'].q1,150,62,1);smpTempo(T);
 /* オルゴール */
 const mb=[...smpPhrases(MA.slice(0,8),sec['オルゴール前奏'].q0,{leg:1,v:84}).notes,...smpPhrases(MA,sec.A.q0,{leg:1,v:88}).notes,
  ...smpPhrases(['F5:1 Ab5:1 Db6:1','Db6:2 Bb5:1','G5:1 Bb5:1 Db6:1','~Eb6:3'],sec['止まりかけ'].q0,{leg:1,v:78}).notes,
  ...smpPhrases(MA,sec[SA].q0,{leg:1,v:68,tr:3}).notes,...smpPhrases(MA.slice(0,7).concat(['~F5:3']),sec['コーダ'].q0,{leg:1,v:80,tr:3}).notes];
 const mbLow=[];for(const nm of ['オルゴール前奏','止まりかけ','コーダ'])for(let b=0;b<sec[nm].bars;b++){const s=sec[nm].q0+b*B,ch=chAt(s),r=smpLow(smpBassPc(ch),53),v=smpVoice(ch,60,2),last=b===sec[nm].bars-1&&nm!=='オルゴール前奏';
  smpN(mbLow,r,s,last?3:1.2,66);if(!last)v.forEach(p=>{smpN(mbLow,p,s+1,.9,46);smpN(mbLow,p,s+2,.9,44)})}
 mb.push(...mbLow);
 for(const n of mb)if(n.q>=sec['コーダ'].q0)n.v=Math.max(30,n.v-(n.q-sec['コーダ'].q0)*1.1);
 mb.forEach(n=>n.v=smpH(n.v,5));
 /* ピチカート・ベース（ウン）とハープ（パッパ）*/
 const bs=[],hp=[];
 for(const nm of ['A','B',SA]){const sc=sec[nm];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B,ch=chAt(s),r=smpLow(smpBassPc(ch),36);
  smpN(bs,(nm==='B'&&b%2)?smpLow((ch.root+7)%12,36):r,s,.85,smpH(86,5));
  if(nm!=='B'||b%4===3)smpVoice(ch,57,3).forEach(p=>{smpN(hp,p,s+1,.8,smpH(56,5));smpN(hp,p,s+2,.8,smpH(50,5))});
  else{const v=smpVoice(ch,53,3);[v[0],v[1],v[2],v[0]+12,v[1]+12,v[2]+12].forEach((p,i)=>smpN(hp,p,s+i*.5,1.6,smpH(50+i*3,4)))}
 }}
 /* ハープのグリッサンド（止まりかけの最後の拍 → A'）*/
 {const q0=sec[SA].q0-1,sc=[3,5,7,8,10,0,1];const L=[];for(let o=63;o<=87;o++)if(sc.includes(o%12))L.push(o);L.forEach((p,i)=>smpN(hp,p,q0+i/L.length,1.4,40+i*2.5))}
 /* ストリングス（B は白玉、A' は対旋律）: 2種類を重ねて厚く */
 const st=[],cs=[];for(const nm of ['B',SA])smpPadVL(C,st,sec[nm].q0,sec[nm].q1,53,72,4,nm==='B'?50:56);
 {const sc=sec[SA];for(let b=4;b<sc.bars;b++){const s=sc.q0+b*B,v=smpVoice(chAt(s),55,3);smpN(cs,b%2?v[2]:v[1],s,B*.98,smpH(66,4))}}
 /* B のメロディ: ソロ・バイオリン＋フルート（1オクターブ下）、チェレスタが合いの手 */
 const vn=smpPhrases(MB,sec.B.q0,{leg:1,v:84}).notes;vn.forEach(n=>n.v=smpH(n.v+(n.l>=2?6:0),5));
 const flB=smpPhrases(MB,sec.B.q0,{leg:.98,v:70,tr:-12}).notes;
 const ce=[];for(let b=0;b<16;b++){const s=sec.B.q0+b*B;if(b%2===1){const v=smpVoice(chAt(s),76,3);v.reverse().forEach((p,i)=>smpN(ce,p,s+i,.9,smpH(50,5)))}}
 /* A' のメロディ: トランペット＋グロッケン＋オルゴール、ブラスが和音 */
 const tp=smpPhrases(MA,sec[SA].q0,{leg:.96,v:90,tr:3-12}).notes;tp.forEach(n=>n.v=smpH(n.v,5));
 const brs=[];{const sc=sec[SA];for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;smpVoice(chAt(s),53,3).forEach(p=>{smpN(brs,p,s+1,.6,smpH(64,4));smpN(brs,p,s+2,.6,smpH(58,4))})}}
 const gl=[...smpPhrases(MA,sec.A.q0,{leg:1,v:56}).notes.filter(n=>n.l>=2),...smpPhrases(MA,sec[SA].q0,{leg:1,v:72,tr:3}).notes];
 gl.forEach(n=>n.v=smpH(n.v,5));
 /* 打楽器（A'）*/
 const pc=[];{const sc=sec[SA];smpN(pc,49,sc.q0,3,84);for(let b=0;b<sc.bars;b++){const s=sc.q0+b*B;smpN(pc,36,s,.5,smpH(58,5));smpN(pc,54,s+1,.4,smpH(34,4));smpN(pc,54,s+2,.4,smpH(30,4));
  if(b%2===0)smpN(pc,81,s,1,smpH(58,4));if(b%4===0&&b)smpN(pc,49,s,2,52)}}
 smpN(pc,81,sec['コーダ'].q1-B,2,40);
 /* チェロの対旋律（A の後半・A'）: コードの音を半音・全音でなめらかにつなぐ */
 const ce2=[];for(const [nm,b0] of [['A',8],[SA,0]]){const sc=sec[nm];let prev=55;for(let b=b0;b<sc.bars;b++){const s=sc.q0+b*B,ch=chAt(s),pcs=smpIv(ch).map(i=>(ch.root+i)%12);
  let best=prev,bd=99;for(let p=45;p<=62;p++){if(!pcs.includes(p%12))continue;const d=Math.abs(p-prev)+(p===prev?1.5:0)+(p%12===ch.root%12?.8:0);if(d<bd){bd=d;best=p}}prev=best;smpN(ce2,best,s,B*.97,smpH(nm==='A'?58:66,3))}}
 const tMb=smpTrack('midi',{name:'オルゴール',tone:'waf_musicbox',vol:-5,pan:-.12,ci:3,fx:[['eq',{hp:200,high:1}],SMPFX.hall(.32,2.6)],notes:mb,start:0,clip:'オルゴール',hum:[.003,3]});
 const tVn=smpTrack('midi',{name:'バイオリン（ソロ）',tone:'waf_violin',vol:-8,pan:.12,ci:3,fx:[['eq',{hp:180,mid:-1,midf:1200,high:1}],SMPFX.hall(.3,2.8)],notes:vn,clip:'B メロディ'});
 const tFl=smpTrack('midi',{name:'フルート',tone:'tj_flute',vol:-12,pan:-.2,ci:6,fx:[SMPFX.hall(.3,2.8)],notes:flB,clip:'B メロディ（下）'});
 const tTp=smpTrack('midi',{name:'トランペット',tone:'waf_trumpet',vol:-9,pan:-.05,ci:0,fx:[['eq',{hp:150,mid:-1.5,midf:1500,high:.5}],SMPFX.hall(.26,2.6)],notes:tp,clip:"A' メロディ"});
 const tBr=smpTrack('midi',{name:'ブラス（和音）',tone:'waf_brass',vol:-17,pan:.22,ci:0,fx:[SMPFX.hall(.3,2.6)],notes:brs,clip:'パッパ'});
 const tGl=smpTrack('midi',{name:'グロッケン',tone:'waf_glock',vol:-15,pan:.3,ci:6,fx:[SMPFX.hall(.3,2.6)],notes:gl,clip:'きらきら'});
 const tCe=smpTrack('midi',{name:'チェレスタ',tone:'waf_celesta',vol:-14,pan:.4,ci:6,fx:[SMPFX.hall(.32,2.6)],notes:ce,clip:'合いの手'});
 const tSt=smpTrack('midi',{name:'ストリングス',tone:'waf_strings',vol:-16,pan:.3,ci:5,fx:[SMPFX.hall(.32,3)],notes:st,clip:'白玉'});
 const tCs=smpTrack('midi',{name:'ストリングス（対旋律）',tone:'waf_slow_strings',vol:-14,pan:-.28,ci:5,fx:[SMPFX.hall(.34,3)],notes:cs,clip:"A' の対旋律"});
 const tHp=smpTrack('midi',{name:'ハープ',tone:'waf_harp',vol:-11,pan:-.35,ci:4,fx:[SMPFX.hall(.28,2.6)],notes:hp,clip:'ワルツの刻み・グリッサンド'});
 const tBs=smpTrack('midi',{name:'ピチカート・ベース（ウン）',tone:'waf_ac_bass',vol:-9,pan:.05,ci:2,fx:[SMPFX.hall(.18,2.4)],notes:bs,clip:'1拍目'});
 const tPc=smpTrack('drum',{name:'打楽器',tone:'kit_wd_FluidR3_GM_sf2_file',vol:-15,pan:0,ci:1,fx:[SMPFX.hall(.3,2.6)],notes:pc,clip:'大太鼓・トライアングル'});
 const tVc=smpTrack('midi',{name:'チェロ（対旋律）',tone:'waf_cello',vol:-12,pan:.15,ci:5,fx:[['eq',{hp:60,mid:-1,midf:400}],SMPFX.hall(.3,2.8)],notes:ce2,clip:"A 後半・A' の対旋律"});
 smpMaster([['eq',{hp:28,low:.5,mid:-.5,midf:500,high:1.5}],['rcomp',{thr:-18,ratio:1.8,att:.03,rel:.3,gain:1}],['exciter',{amount:.12,freq:7000}],['widener',{width:.25,mix:.35}],['reverb',{mix:.1,decay:3,pre:.03,tone:7500}],['limiter',{thr:-1.2,gain:1}]],5);
 smpFinish([C.g,tPc,tBs,tHp,tSt,tCs,tVc,tMb,tVn,tFl,tTp,tBr,tGl,tCe],null,tMb);
}

/* ---------- 一覧の差し替え ---------- */
{const set=(id,f,o)=>{const x=SAMPLE_SONGS.find(z=>z.id===id);if(x){x.build=f;if(o)Object.assign(x,o)}};
 set('edm',defaultSongEDM2,{meta:'150 BPM・A マイナー → B マイナー・約1分40秒',desc:'ドロップ直前の一瞬の無音、ライザーとインパクト。2種類のフック、ピアノとクワイアのブレイク、ラストドロップは全音上でオクターブと対旋律が重なる豪華な EDM（起動時の曲）'});
 set('trio',sampleTrio2,{desc:'生録フルートとナイロンギター・ウッドベース・ドラムのしっとりトリオ。フルートのアドリブ・ソロのあと、フルートだけが駆けるブレイクから転調し、9th の和音で静かに終わる（インスト）'});
 set('rock',sampleRock2,{desc:'左右ダブルの疾走リフ。加速してサビ → ペンタトニックで歌い走るギターソロ → 急減速・再加速し、全員のキメから転調してツイン・リードのハモリへ（インスト）'});
 set('carousel',sampleCarousel2,{desc:'オルゴールで始まるワルツ。チェロの対旋律が寄り添い、いったん止まりかけ、ハープのグリッサンドで A♭ に転調して加速しながら再び回り出す（インスト）'});
 set('bossa',sampleBossa2,{meta:'132 BPM・G → A♭・歌詞あり（ずんだもん）',desc:'静かなボサノバ。テーマは「若き日の思い出と今の幸せ」。間奏はナイロンギターのソロ、2番サビで半音転調、最後は偽終止に逸れてからタグで締める'});
 set('techno',sampleTechno2,{meta:'126 BPM・Cm → Dm・約1分40秒',desc:'80s テクノポップ風。少しずつ重なるイントロ、2回目の A でベルが重なり、全員の16分のキメ → 1小節のブレイク → 転調して A\'・B\'（インスト）'});
 set('idol',sampleIdol2,{meta:'140 BPM・C → D♭・歌詞あり（ずんだもん）・約2分',desc:'80s アイドルポップ風のフルサイズ。2番はギターのカッティングとストリングスの対旋律、静かな落ちサビからフィルで半音上げてラストサビへ（ハモリつき）'});
}
/* 歌もの: 曲名の横に「歌: ずんだもん」 */
for(const x of SAMPLE_SONGS)if(['bossa','idol','ballad','chaos','morse'].includes(x.id)&&!/ずんだもん/.test(x.meta))x.meta+='・歌: ずんだもん';
{const _o=openProjectDialog;openProjectDialog=function(){_o();const p=[...document.querySelectorAll('.modal p.dim')].pop();if(p&&!/VOICEVOX/.test(p.textContent))p.textContent+=' 歌もの（4・7・8・10・13・14〜24）の歌声は VOICEVOX:ずんだもん（埋め込み済み・VOICEVOX が無くても鳴ります）。14〜24 の民族音楽も歌詞つきで、VOICEVOX を起動していれば、開いたときにずんだもんが歌います（起動していないときはガイドの声で鳴ります）。'}}
defaultSongEDM=defaultSongEDM2;
/* ---------- 音量バランス（実際に鳴らして測った値: SMP_BAL）を曲に当てる ---------- */
function smpApplyBal(id){
 const B=typeof SMP_BAL!=='undefined'&&SMP_BAL[id];if(!B)return;
 if(B.m!=null)S.master.vol=B.m;
 for(const t of S.tracks){const v=B.t&&B.t[t.name];if(!v)continue;t.vol=v[0];
  if(v[1]!=null){t.fx=t.fx||[];let tr=t.fx.find(f=>f.fx==='trim');if(!tr){tr={id:uid('f'),fx:'trim',power:'on',vals:[0],open:false};t.fx.push(tr)}tr.vals[0]=v[1]}}
}
for(const x of SAMPLE_SONGS){const f=x.build;x.build=()=>{f();smpApplyBal(x.id)}}
defaultSongEDM=()=>{defaultSongEDM2();smpApplyBal('edm')};
/* ---------- ずんだもんの歌声（VOICEVOX:ずんだもん）を埋め込みデータから読み込む ----------
   SMP_VV[id] = {v:音量dB, g:ガイドを下げる量dB, c:[[開始(拍),頭の余白(秒),長さ(秒),データ内の位置(24kHzのサンプル),サンプル数],…], b:MP3(base64)}
   VOICEVOX が無くてもすぐ歌が入る。歌詞やメロディを変えたら VOICEVOX ボタン →「サンプル曲のずんだもんを作る」で作り直せる */
let SMP_CUR=null;const SMP_VV_DEC=new Map();
for(const x of SAMPLE_SONGS){const f=x.build;x.build=()=>{SMP_CUR=x.id;f()}}
/* 歌声データ（MP3）は曲ごとの別ファイル demo/vv_<曲>.js。初めてその曲を開いたときだけ読み込む */
function smpVvFetch(id){return new Promise((res,rej)=>{const E=SMP_VV[id];if(E.b)return res();const s=document.createElement('script');s.src=(typeof DEMO!=='undefined'?DEMO.base:'demo/')+'vv_'+id+'.js';
 s.onload=()=>E.b?res():rej(new Error('歌声データが空です'));s.onerror=()=>rej(new Error('歌声のファイル vv_'+id+'.js を読み込めませんでした'));document.head.append(s)})}
function SMP_VV_LOAD(id,b){if(SMP_VV[id])SMP_VV[id].b=b}
async function smpVvDecode(id,E){
 if(SMP_VV_DEC.has(id))return SMP_VV_DEC.get(id);
 if(!E.b)await smpVvFetch(id);
 const bin=atob(E.b),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
 const p=ensureAudio().decodeAudioData(u8.buffer);SMP_VV_DEC.set(id,p);
 try{return await p}catch(e){SMP_VV_DEC.delete(id);throw e}
}
async function smpZundaEmbed(id,E){
 const mt=S.tracks.find(t=>t.smpVocal);if(!mt)return false;
 const myName=S.name;
 let full;try{full=await smpVvDecode(id,E)}catch(e){toast('ずんだもんの歌声データを読めませんでした（'+(e.message||e)+'）');return false}
 if(S.name!==myName)return false;
 let at=S.tracks.find(t=>t.vvOf===mt.id);
 if(!at){at=newTrack('audio');at.vvOf=mt.id;at.color=TRACK_COLORS[4];at.pan=0;
  at.fx=(mt.smpVocalDry?[['eq',{hp:120,mid:1.5,midf:2500,high:1}],['rcomp',{thr:-20,ratio:3,gain:1}]]:[['eq',{hp:120,mid:1.5,midf:2500,high:1}],['rcomp',{thr:-20,ratio:3,gain:1}],['delay',{time:.75,mix:.1,fb:.25,tone:3500}],['reverb',{mix:.2,decay:2.2,pre:.02,tone:8000}]]).map(f=>smpFx(f[0],f[1]));
  S.tracks.splice(S.tracks.indexOf(mt)+1,0,at)}
 at.vol=E.v??-3;
 const R=full.sampleRate,src=full.getChannelData(0),k=R/24000,clips=[];
 for(const [start,offset,dur,t0,n] of E.c){
  const s0=Math.round(t0*k),len=Math.min(Math.round(n*k),src.length-s0);if(len<=0)continue;
  const ab=new AudioBuffer({numberOfChannels:1,length:len,sampleRate:R});ab.copyToChannel(src.subarray(s0,s0+len),0);
  const cl={id:uid('c'),start,offset,dur:Math.min(dur,ab.duration-offset),name:'VOICEVOX:ずんだもん',buf:ab};BUFS.set(cl.id,ab);clips.push(cl);
 }
 at.clips=clips;at.name='ずんだもん（VOICEVOX）';
 if(!mt.smpGuide){mt.smpGuide=true;mt.smpOrigName=mt.name;mt.vol=(mt.vol||0)-(E.g??12);mt.name=mt.name.replace(/（.*）$/,'')+'（ガイド）'}
 renderLanes();renderRows();renderSide();
 HIST.last=projSnap();HIST.saved=HIST.last;
 return true;
}
{const _z=smpZunda;smpZunda=async function(o={}){const E=typeof SMP_VV!=='undefined'&&SMP_CUR&&SMP_VV[SMP_CUR];
 if(o.auto&&E&&!window.SMP_VV_SKIP&&S.tracks.some(t=>t.smpVocal)){try{if(await smpZundaEmbed(SMP_CUR,E))return true}catch(e){console.warn('ずんだもん',e)}}
 return _z(o)}}
/* サンプル曲の音量バランス（実際に鳴らして測り、役割ごとの目標に合わせた値）: {曲:{m:マスター音量, t:{トラック名:[音量, トリム]}}} */
const SMP_BAL={"edm":{"m":18,"t":{"ドラム":[9.8],"ベース":[-4,4.9],"スーパーソウ":[-2],"リード":[-3.7],"リード（オクターブ上）":[-1],"対旋律（ストリングス）":[-6],"プラック":[-4.7],"パッド":[-9.5],"ピアノ（ブレイク）":[1.5],"ベル（ブレイク）":[2.8],"クワイア":[-5],"効果音（ライザー・インパクト）":[-5.7]}},"trio":{"m":5,"t":{"ドラム":[9.2],"クロススティック":[2.7],"ウッドベース":[-5.1],"ナイロンギター":[8.2],"ストリングス":[-11],"フルート":[4]}},"rock":{"m":-4.5,"t":{"ドラム":[4],"ベース（ピック）":[-6,2.8],"リズムギター L（ディストーション）":[-9,-7.8],"リズムギター R（オーバードライブ）":[-9,-7.8],"リードギター":[-5,-0.4],"リードギター（ハモリ）":[-8,-2],"オルガン":[-12]}},"carousel":{"m":5,"t":{"打楽器":[-1],"ピチカート・ベース（ウン）":[-6.1],"ハープ":[-11.7],"ストリングス":[-12.2],"ストリングス（対旋律）":[-7.2],"チェロ（対旋律）":[-6.4],"オルゴール":[-7.2],"バイオリン（ソロ）":[-5.4],"フルート":[-3.5],"トランペット":[0.9],"ブラス（和音）":[-6.2],"グロッケン":[-2.3],"チェレスタ":[-7.8]}},"bossa":{"m":6.5,"t":{"パーカッション":[-3],"ウッドベース":[-6.4],"ナイロンギター":[5.3],"ローズ":[-11.6],"ストリングス":[-12.9],"フルート":[-5],"ナイロンギター（ソロ）":[12],"ハモリ（3度上・歌詞つき）":[-3],"ボーカル（メロディ・歌詞つき）":[-1]}},"nocturne":{"m":1.7,"t":{"ピアノ（左手）":[5.5],"ピアノ（右手）":[11.5]}},"techno":{"m":0.6,"t":{"ドラムマシン":[7.2],"シーケンス・ベース":[-6.7],"アルペジオ":[-1.9],"パッド":[-10.9],"クワイア":[-4.8],"シンセ・ストリングス（対旋律）":[-2.4],"リード":[-2],"FMベル":[-2.5],"効果音":[-2.9]}},"idol":{"m":9.3,"t":{"ドラム（80s）":[1.8],"ベース":[-2.6],"エレピ":[-12.6],"ギター（カッティング）":[-14.5],"ピアノ（落ちサビ）":[7.8],"ストリングス":[-12],"ストリングス（対旋律）":[-9.3],"シンセ・ブラス":[-10.1],"コーラス":[-8.8],"ベル":[0.9],"グロッケン（ベルの重ね）":[-4.1],"効果音":[-5.4],"ハモリ（歌詞つき）":[-2.6],"ボーカル（メロディ・歌詞つき）":[0.9]}},"ballad":{"m":7.1,"t":{"ドラム":[8],"タンバリン":[0.1],"ベース":[-1.3],"ピアノ（左手）":[3.1],"ピアノ（右手）":[5.3],"オルガン":[-10.8],"ストリングス":[-11],"クワイア":[-8.5],"エレキギター（アルペジオ・クランチ）":[-15,-10.2],"リードギター（ディストーション）":[-6,0.1],"メインメロディ（歌詞つき）":[-0.7]}},"organ":{"m":1.3,"t":{"足鍵盤（ペダル）":[-4.7],"第2鍵盤（左手）":[-6.3],"第1鍵盤（右手）":[-7.1]}},"chaos":{"m":6.1,"t":{"リズムマシン（808）":[-5.2],"チューバ":[4],"おもちゃのピアノ（チェレスタ）":[-12.3],"スチールドラム":[-7.6],"チェンバロ":[-9.5],"シタール":[-4.8],"アコーディオン":[-12.9],"シロフォン":[0.8],"ウッドブロック":[12],"カズー風（合いの手）":[-10,12],"効果音（ビヨーン）":[-11.1],"メインメロディ（口笛・歌詞つき）":[-0.2]}},"cooljazz":{"m":-3.7,"t":{"ブラシ（スネア）":[6.2],"ブラシ（スウィッシュ）":[7.5],"ライド＆ハット":[8.2],"ウッドベース":[-5.6],"ピアノ（左手のコンピング）":[-1],"ジャズギター（刻み）":[-10.4],"ピアノ（テーマ・ソロ）":[12],"ジャズギター（クリーン）":[1.3]}},"ambient":{"m":2.8,"t":{"遠い太鼓":[-3.3],"ドローン（D・A）":[-11],"パッド（ヘイロー）":[-12.5],"ストリングス":[-11.3],"ハープ":[-11.4],"チェレスタ（氷のベル）":[-9.9],"声の重なり（4度下・オクターブ下）":[-6],"クワイア（主旋律）":[2.5]}},"morse":{"m":10.7,"t":{"TR-808":[-3.5],"808ベース":[-9.6],"シンセ・スタブ":[-1.9],"モールス信号（サイン波）":[-5.7],"モールス信号（遠い局）":[-11.5],"メインメロディ（ロボ声・歌詞つき）":[-6,12]}}};
/* 歌声の並び（データ本体は vv_<曲>.js）*/
const SMP_VV={"bossa": {"v": 7.0, "g": 12, "c": [[15.834192, 0, 23.92533, 0, 574208], [67.342625, 0, 4.06399, 575408, 97536], [111.839615, 0, 23.92533, 674144, 574208], [163.345892, 0, 4.05331, 1249552, 97280], [175.345796, 0, 5.96265, 1348032, 143104]]}, "idol": {"v": 7.6, "g": 12, "c": [[15.794734, 0, 24.29866, 0, 583168], [71.299087, 0, 9.08798, 584368, 218112], [111.793288, 0, 24.29866, 803680, 583168], [167.295246, 0, 9.08798, 1388048, 218112], [191.304736, 0, 6.85866, 1607360, 164608], [211.305008, 0, 14.22932, 1773168, 341504]]}, "ballad": {"v": 8.2, "g": 12, "c": [[16.636554, 0, 6.26132, 0, 150272], [24.636329, 0, 6.19732, 151472, 148736], [32.641195, 0, 23.00798, 301408, 552192], [59.640513, 0, 2.78399, 854800, 66816], [63.645292, 0, 13.84533, 922816, 332288], [80.638314, 0, 6.26132, 1256304, 150272], [88.638093, 0, 6.18667, 1407776, 148480], [96.645709, 0, 23.00798, 1557456, 552192], [123.643563, 0, 2.78399, 2110848, 66816], [127.642234, 0, 13.84533, 2178864, 332288], [175.68439, 0, 12.77866, 2512352, 306688], [191.646255, 0, 13.84533, 2820240, 332288]]}, "chaos": {"v": 7.2, "g": 12, "c": [[7.333011, 0, 24.192, 0, 580608], [53.544636, 0, 12.24533, 581808, 293888], [79.15863, 0, 12.84265, 876896, 308224], [112.29345, 0, 3.10399, 1186320, 74496]]}, "morse": {"v": 8.3, "g": 12, "c": [[15.36, 0, 14.42132, 0, 346112], [47.36, 0, 14.81599, 347312, 355584], [95.36, 0, 14.81599, 704096, 355584]]}, "korea": {"v": -3, "g": 12, "c": [[11.59342, 0, 23.76533, 0, 570368], [42.593128, 0, 13.26932, 571568, 318464], [71.602503, 0, 24.512, 891232, 588288], [103.59798, 0, 23.76533, 1480720, 570368], [134.600806, 0, 7.25333, 2052288, 174080]]}, "okinawa": {"v": -3, "g": 12, "c": [[15.544699, 0, 23.98932, 0, 575744], [51.538972, 0, 18.66664, 576944, 448000], [95.533132, 0, 23.98932, 1026144, 575744], [131.535344, 0, 24.41599, 1603088, 585984], [171.335093, 0, 9.61066, 2190272, 230656]]}, "china": {"v": -3, "g": 12, "c": [[15.705577, 0, 24.512, 0, 588288], [43.655561, 0, 24.512, 589488, 588288], [71.652339, 0, 7.37066, 1178976, 176896], [95.656745, 0, 24.512, 1357072, 588288], [123.654772, 0, 23.64798, 1946560, 567552], [150.649028, 0, 8.22399, 2515312, 197376]]}, "africa": {"v": -3, "g": 12, "c": [[23.30082, 0, 3.02932, 0, 72704], [35.301192, 0, 2.97599, 73904, 71424], [47.294039, 0, 3.02932, 146528, 72704], [59.293909, 0, 3.02932, 220432, 72704], [71.298982, 0, 21.08798, 294336, 506112], [143.29905, 0, 3.02932, 801648, 72704], [155.301899, 0, 2.98667, 875552, 71680], [167.306703, 0, 3.01866, 948432, 72448], [179.306694, 0, 3.02932, 1022080, 72704], [191.299489, 0, 21.08798, 1095984, 506112]]}, "india": {"v": -3, "g": 12, "c": [[47.559199, 0, 24.37333, 0, 584960], [82.553387, 0, 8.53331, 586160, 204800], [95.554786, 0, 11.42399, 792160, 274176], [127.565522, 0, 24.37333, 1067536, 584960], [162.555314, 0, 8.53331, 1653696, 204800], [175.565387, 0, 11.42399, 1859696, 274176]]}, "mexico": {"v": -3, "g": 12, "c": [[23.204361, 0, 24.13866, 0, 579328], [86.205917, 0, 12.88533, 580528, 309248], [143.199273, 0, 24.13866, 890976, 579328], [206.204195, 0, 12.88533, 1471504, 309248]]}, "hawaii": {"v": -3, "g": 12, "c": [[15.555603, 0, 23.70132, 0, 568832], [49.563534, 0, 20.97066, 570032, 503296], [111.565388, 0, 23.69066, 1074528, 568576], [145.562788, 0, 20.97066, 1644304, 503296]]}, "andes": {"v": -3, "g": 12, "c": [[15.670256, 0, 24.512, 0, 588288], [55.495071, 0, 14.912, 589488, 357888], [111.503408, 0, 24.512, 948576, 588288], [151.497793, 0, 14.912, 1538064, 357888]]}, "celtic": {"v": -3, "g": 12, "c": [[11.493789, 0, 22.33599, 0, 536064], [107.138598, 0, 24.37333, 537264, 584960], [159.833883, 0, 9.37599, 1123424, 225024]]}, "arabia": {"v": -3, "g": 12, "c": [[15.710006, 0, 24.512, 0, 588288], [51.546691, 0, 19.17866, 589488, 460288], [111.54848, 0, 24.512, 1050976, 588288], [147.543289, 0, 19.18932, 1640464, 460544]]}, "bali": {"v": -3, "g": 12, "c": [[39.622241, 0, 22.62399, 0, 542976], [67.622765, 0, 24.192, 544176, 580608], [97.619143, 0, 5.25866, 1125984, 126208], [135.420696, 0, 22.61331, 1253392, 542720], [163.617023, 0, 24.20265, 1797312, 580864], [193.626013, 0, 5.24798, 2379376, 125952]]}};
/* =====================================================================
   世界の民族音楽のデモ曲（14〜24）: 歌詞つき・音数は少なめ・構成に工夫
   どの曲も「イントロのテーマ → 歌 → サビ → 楽器の間奏 → 2 番 → 最後に一工夫（転調・テンポアップ・ブレイクなど）→ テーマで終わる」
   メロディはその土地の音階で手書き。伴奏はコードから作るが、1 小節に鳴る音は少なく
   ベースは生のウッドベース（VSCO 2）、ギターはアコースティック（実録）
   ===================================================================== */
const W5_KIT='kit_wd_FluidR3_GM_sf2_file',W5_VO='waf_oohs';
function w5Begin(o){const C=smpBegin({...o,secs:o.secs.map(s=>[s[0],s[1],s[2]]),prog:o.secs.map(s=>s[3]).join(' | ')});C.tag=o.tag;return C}
/* 歌: [区間, メロディ, 歌詞, 追加の設定] */
function w5Voc(C,plan,MEL,LYR,o={}){let out=[];for(const [nm,mk,lk,op] of plan){const s=C.sec[nm];if(!s)continue;const p=smpPhrases(MEL[mk],s.q0,{leg:.93,v:84,...o,...(op||{})});
 if(lk&&LYR[lk]){smpLyr(p.groups,LYR[lk],C.tag+'_'+nm);const x=S.sections.find(z=>z.name===nm);if(x)x.lyr=LYR[lk].join('\n')}out=out.concat(p.notes)}return out}
const w5Line=(C,nm,ph,o={},off=0)=>C.sec[nm]?smpPhrases(ph,C.sec[nm].q0+off,{leg:.92,v:80,...o}).notes:[];
function w5Bars(C,names,fn){for(const nm of names){const s=C.sec[nm];if(!s)continue;for(let b=0;b<s.bars;b++){const q=s.q0+b*C.B;fn(q,b,nm,C.chAt(q),s)}}}
function w5Hits(L,s,pat,dv=0){for(const [n,o,v,l] of pat)smpN(L,n,s+o,l||.25,smpH(v+dv,4))}
function w5Arp(L,C,s,offs,idx,len,lo,n,v){const ch=C.chAt(s),vs=smpVoice(ch,lo,n||4,false);offs.forEach((o,i)=>{const p=vs[idx[i]%vs.length]+12*Math.floor(idx[i]/vs.length);smpN(L,p,s+o,len,smpH(v-(i?6:0),4))})}
function w5Long(L,C,q0,q1,lo,hi,v){let prev=Math.round((lo+hi)/2),q=q0;while(q<q1-1e-6){const ch=C.chAt(q);let e=q+C.B;while(e<q1-1e-6&&C.same(C.chAt(e),ch))e+=C.B;
 const pcs=smpIv(ch).map(i=>(i+ch.root)%12);let best=prev,bd=99;for(let p=lo;p<=hi;p++)if(pcs.includes(p%12)&&Math.abs(p-prev)<bd){bd=Math.abs(p-prev);best=p}smpN(L,best,q,e-q-.05,v);prev=best;q=e}}
function w5Gliss(L,pcs,lo,hi,q,dur,v,down){const ps=[];for(let p=lo;p<=hi;p++)if(pcs.includes(((p%12)+12)%12))ps.push(p);if(down)ps.reverse();const st=dur/ps.length;ps.forEach((p,i)=>smpN(L,p,q+i*st,st*1.6,v-8+i*12/ps.length))}
function w5Dia(L,root,mode,steps){const sc=mode==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
 return L.map(n=>{const rel=n.p-root,oct=Math.floor(rel/12),pc=((rel%12)+12)%12;let i=6;while(i>0&&sc[i]>pc)i--;const up=i+steps,o2=Math.floor(up/7),k=((up%7)+7)%7;return{...n,p:root+12*(oct+o2)+sc[k]+(pc-sc[i]),v:n.v-8}})}
function w5Trem(L,p,q,len,step,v){for(let t=0;t<len-1e-6;t+=step)smpN(L,p,q+t,step*.9,smpH(v-(t%(step*2)?8:0),3))}
function w5Bass(L,C,s,pat,lo){for(const [o,l,d,v] of pat){const q=s+o;if(q>=C.len-1e-6)continue;const ch=C.chAt(q),r=smpLow(smpBassPc(ch),lo||28);
 const nx=C.chAt(Math.min(q+l+.01,C.len-.01)),p=d==='5'?r+7:d==='8'?r+12:d==='3'?r+(smpIv(ch)[1]??4):d==='app'?smpLow(smpBassPc(nx),lo||28)-1:d==='-5'?r-5:r;smpN(L,p,q,l*.92,smpH(v||88,4))}}
function w5Strum(L,C,s,pat,lo,n){for(const [o,l,v,up] of pat){const ch=C.chAt(s+o);let vs=smpVoice(ch,lo,n||5,false);if(up)vs=vs.slice(-4).reverse();vs.forEach((p,j)=>smpN(L,p,s+o+j*.014,l,smpH(v-(up?10:0)-j,3)))}}
/* 声（ガイドの歌）と、よく使う楽器の設定 */
const w5VoTrack=(notes,o={})=>smpTrack('midi',{name:'うた（歌詞つき）',tone:W5_VO,vol:o.vol??-5,pan:0,ci:3,fx:[['eq',{hp:160,mid:1.5,midf:2400,high:1}],SMPFX.glue(-22,2.5),SMPFX.plate(o.rev??.14,1.6)],notes,clip:'歌'});
const w5Bs=(notes,o={})=>smpTrack('midi',{name:o.name||'ウッドベース',tone:'smp_upright',vol:o.vol??-7,pan:.05,ci:2,fx:[['eq',{hp:32,low:1.5,mid:1,midf:900}],SMPFX.glue(-20,3)],notes,clip:o.clip||'ベース'});
const w5AG=(notes,o={})=>smpTrack('midi',{name:o.name||'アコースティックギター',tone:'tj_guitar-acoustic',vol:o.vol??-11,pan:o.pan??-.25,ci:0,fx:[['eq',{hp:110,mid:-1,midf:350,high:1}],SMPFX.room(.1)],notes,clip:o.clip||'ギター'});

/* =====================================================================
   14. 韓国「アリランの風」 3/4・ヨナ抜きに近い 5 音音階。カヤグム（琴）・テグム（尺八）・チャンゴ
   工夫: 最後のサビの頭 2 小節は琴と歌だけ → 全員が戻る
   ===================================================================== */
function w5Korea(){
 const C=w5Begin({tag:'kr',name:'アリランの風',bpm:80,swing:60,key:[7,'major'],sig:{n:3,d:4},seed:1401,
  secs:[['イントロ',4,0,'G | Em | C | D'],['Aメロ',8,1,'G | G | Em | Em | C | D | G | G'],['サビ',8,3,'C | D | Bm | Em | Am | C | D | G'],['間奏',4,4,'Em | C | D | G'],
   ['Aメロ2',8,1,'G | G | Em | Em | C | D | G | G'],['サビ2',8,3,'C | D | Bm | Em | Am | C | D | G'],['終わりのサビ',8,3,'C | D | Bm | Em | Am | C | D | G'],['アウトロ',4,0,'C | D | G | G']]});
 const {B,sec}=C,last=sec['終わりのサビ'];
 const MEL={A:['D4:1 G4:1.5 A4:.5 | B4:1.5 A4:.5 G4:1','E4:1 G4:1 A4:1 | B4:.5 A4:.5 G4:2','B4:1 D5:1.5 E5:.5 | D5:1 B4:1 A4:1','G4:1 A4:.5 B4:.5 A4:1 | ~G4:3'],
  S:['D5:1.5 E5:.5 G5:1 | E5:1.5 D5:.5 B4:1','D5:1 E5:1 D5:1 | B4:1.5 A4:.5 G4:1','A4:1 B4:1 D5:1 | E5:1.5 G5:.5 E5:1','D5:1 B4:.5 A4:.5 B4:1 | ~G4:3']};
 const LYR={a1:['やまをこえて','かぜがうたう','とおいさとの','はなのいろ'],s1:['ありらんかぜ','こころをのせ','あいたいひと','まつあなた'],
  a2:['みちはつづく','ゆめのなかへ','ちいさなひが','ゆれるまど'],s3:['ありらんかぜ','こころをのせ','あいたいひと','またあえる']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:88}],['Aメロ2','A','a2',{v:84}],['サビ2','S','s1',{v:90}],['終わりのサビ','S','s3',{v:92}]],MEL,LYR);
 /* カヤグム: 8 分の分散和音。サビの前に 5 音音階のグリッサンド */
 const ko=[],pent=[7,9,11,2,4];
 w5Bars(C,['イントロ','Aメロ','サビ','間奏','Aメロ2','サビ2','終わりのサビ','アウトロ'],(s,b,nm)=>{const sb=/サビ/.test(nm);
  w5Arp(ko,C,s,[0,.5,1,1.5,2,2.5],sb?[0,2,3,4,3,2]:[0,2,3,2,1,2],.9,55,4,sb?70:62);if(nm==='アウトロ'&&b===3){ko.length-=6;smpVoice(C.chAt(s),55,4,false).forEach((p,i)=>smpN(ko,p,s+i*.08,3,60))}});
 for(const nm of ['サビ','サビ2','終わりのサビ'])w5Gliss(ko,pent,62,86,sec[nm].q0-1,1,70);
 /* テグム（尺八）: イントロのテーマ・歌の合間の返し・間奏・後半は長い音の対旋律 */
 const dg=[...w5Line(C,'イントロ',['r:1 D5:2 | E5:.5 D5:.5 B4:2 | r:1 G5:1.5 E5:.5 | ~D5:3'],{v:82}),...w5Line(C,'間奏',['G5:1 E5:.5 D5:.5 B4:1 | D5:1.5 E5:.5 D5:1 | B4:.5 A4:.5 G4:1 A4:1 | ~B4:3'],{v:86}),
  ...w5Line(C,'アウトロ',['D5:2 B4:1 | A4:1.5 B4:.5 A4:1 | ~G4:6'],{v:78})];
 for(const nm of ['Aメロ','Aメロ2'])[1,3].forEach(i=>dg.push(...smpMel('D5:.5 B4:.5 A4:1',sec[nm].q0+i*6+4,{v:66})));
 for(const nm of ['サビ2','終わりのサビ']){const s=sec[nm];w5Long(dg,C,s.q0+(nm==='終わりのサビ'?2*B:0),s.q1,74,86,58)}
 /* チャンゴ: ドン（低）・クン・ダッ（縁）。区切りでタタタタ */
 const jg=[];
 w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','終わりのサビ','アウトロ'],(s,b,nm,ch,S0)=>{if(nm==='終わりのサビ'&&b<2)return;if(nm==='アウトロ'&&b>1)return;const sb=/サビ|間奏/.test(nm),end=b===S0.bars-1;
  w5Hits(jg,s,[[45,0,sb?92:80],[37,0,60],[41,1,sb?76:66],[37,2,sb?72:62]]);if(sb)w5Hits(jg,s,[[41,2.5,58]]);if(end)w5Hits(jg,s,[[37,2,60],[37,2.25,68],[37,2.5,76],[37,2.75,86]])});
 smpN(jg,52,last.q0+2*B,3,80);
 const bs=[];w5Bars(C,['Aメロ','サビ','Aメロ2','サビ2','終わりのサビ','アウトロ'],(s,b,nm)=>{if(nm==='終わりのサビ'&&b<2)return;if(nm==='アウトロ'&&b>2)return;w5Bass(bs,C,s,/サビ/.test(nm)?[[0,2,'r',88],[2,1,'5',66]]:[[0,2.8,'r',80]],31)});
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc);
 smpFinish([C.g,smpTrack('midi',{name:'カヤグム（琴）',tone:'waf_koto',vol:-11,pan:-.3,ci:0,fx:[SMPFX.room(.12)],notes:ko,start:0,clip:'分散和音'}),
  smpTrack('drum',{name:'チャンゴ（太鼓）',tone:W5_KIT,vol:-13,pan:.15,ci:1,fx:[['eq',{hp:40}],SMPFX.room(.1)],notes:jg,clip:'チャンダン'}),w5Bs(bs),
  smpTrack('midi',{name:'テグム（尺八）',tone:'waf_shakuhachi',vol:-10,pan:.25,ci:4,fx:[['eq',{hp:200}],SMPFX.plate(.16,1.8)],notes:dg,start:0,clip:'テーマと返し'}),tVo],tVo);
}
/* =====================================================================
   15. 沖縄「島風の唄」 琉球音階（ド・ミ・ファ・ソ・シ）。三線・島太鼓・指笛
   工夫: 最後はテンポを上げてカチャーシー（手拍子と囃子「いーやーさーさー」）
   ===================================================================== */
function w5Okinawa(){
 const C=w5Begin({tag:'ok',name:'島風の唄',bpm:92,swing:56,key:[0,'major'],seed:1501,
  secs:[['イントロ',4,0,'C | F | G7 | C'],['Aメロ',8,1,'C | C | F | C | Em | F | G7 | C'],['サビ',8,3,'F | G7 | C | Em | F | G7 | C | C'],['間奏',4,4,'C | F | G7 | C'],
   ['Aメロ2',8,1,'C | C | F | C | Em | F | G7 | C'],['サビ2',8,3,'F | G7 | C | Em | F | G7 | C | C'],['カチャーシー',8,6,'C | F | G7 | C | C | F | G7 | C'],['終わり',2,0,'G7 | C']]});
 const {B,sec}=C;
 const T=[{q:0,bpm:92}];smpRamp(T,sec['サビ2'].q1-2,sec['サビ2'].q1,92,74,.5);T.push({q:sec['カチャーシー'].q0,bpm:132});smpRamp(T,sec['終わり'].q0+4,sec['終わり'].q1,132,100,1);smpTempo(T);
 const MEL={A:['E4:1 F4:1 G4:1.5 B4:.5 | C5:1.5 B4:.5 G4:2','F4:1 G4:.5 F4:.5 E4:1 F4:1 | E4:1.5 C4:.5 C4:2','B4:1 G4:1 E4:1 G4:1 | F4:1.5 G4:.5 E4:2','F4:1 G4:1 B4:1 G4:1 | ~C5:4'],
  S:['C5:1.5 C5:.5 F5:1 E5:1 | F5:1.5 E5:.5 C5:1 B4:1','C5:1 E5:1 G5:1.5 E5:.5 | ~E5:2 B4:2','F5:1 E5:.5 C5:.5 E5:1 F5:1 | G5:1.5 F5:.5 E5:1 B4:1','C5:1 B4:.5 G4:.5 E4:1 F4:1 | ~E4:2 C4:2'],
  K:['C5:1 C5:.5 C5:.5 B4:1 G4:1 | E4:1 F4:1 G4:2','E5:1 E5:1 C5:1 B4:1 | ~C5:4']};
 const LYR={a1:['しおかぜふけば','きびのはがゆれて','とおいうみなり','ははのうた'],s1:['しまかぜよふいて','わたしのこえ','うみをこえてとどけ','あのひとのそば'],
  a2:['つきよのはまべ','さんしんのねいろ','ほしがまたたく','ゆめのうた'],k:['いーやーさーさー','はいやーせ','すーりーさーさー','はいやーさ']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:88}],['Aメロ2','A','a2'],['サビ2','S','s1',{v:90}]],MEL,LYR);
 {const s=sec['カチャーシー'],p=smpPhrases([...MEL.K,...MEL.K],s.q0,{leg:.85,v:92});smpLyr(p.groups,LYR.k,'ok_k');S.sections.find(x=>x.name==='カチャーシー').lyr=LYR.k.join('\n');voc.push(...p.notes)}
 /* 三線: イントロのテーマ、歌に寄りそう（歌の音を短く弾く）、合間の手 */
 const sn=[...w5Line(C,'イントロ',['C5:.5 B4:.5 G4:.5 F4:.5 E4:1 G4:1 | F4:.5 E4:.5 C4:1 E4:1 F4:1 | G4:.5 B4:.5 C5:.5 B4:.5 G4:1 F4:1 | E4:1 C4:1 C4:2'],{leg:.6,v:86}),
  ...w5Line(C,'間奏',['E5:.5 C5:.5 B4:.5 G4:.5 F4:1 G4:1 | B4:.5 C5:.5 B4:.5 G4:.5 E4:2 | F4:.5 G4:.5 B4:.5 C5:.5 B4:1 G4:1 | ~C5:4'],{leg:.6,v:88}),
  ...w5Line(C,'終わり',['G4:.5 B4:.5 C5:.5 B4:.5 G4:1 F4:1 | ~C4:4'],{leg:.6,v:84})];
 for(const n of voc)if(n.q<sec['カチャーシー'].q0)sn.push({p:n.p-12,q:n.q,l:Math.min(.45,n.l),v:n.v-22});
 w5Bars(C,['カチャーシー'],s=>{const ch=C.chAt(s),r=smpLow(ch.root,48);[0,.5,1,1.5,2,2.5,3,3.5].forEach((o,i)=>smpN(sn,i%2?r+7:r+(i%4?12:0),s+o,.4,smpH(i%2?66:80,4)))});
 /* 島太鼓・サンバ（拍子木で代用）・カチャーシーは手拍子 */
 const dr=[];
 w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','カチャーシー','終わり'],(s,b,nm,ch,S0)=>{const k=nm==='カチャーシー',sb=/サビ/.test(nm)||k;
  if(nm==='終わり'){if(b===1){smpN(dr,41,s,1,96);smpN(dr,49,s,3,80)}return}
  w5Hits(dr,s,[[41,0,sb?96:84],[45,2.5,sb?80:70],[41,3,sb?84:74]]);if(sb)w5Hits(dr,s,[[75,.5,58],[75,1.5,62],[75,2.5,58],[75,3.5,66]]);
  if(k)w5Hits(dr,s,[[39,1,84],[39,3,88],[39,3.5,56]]);if(b===S0.bars-1&&!k)w5Hits(dr,s,[[45,3,70],[45,3.25,76],[41,3.5,84],[41,3.75,90]])});
 /* 指笛: カチャーシーでピューッと */
 const wh=[];for(const o of [0,4*B])w5Gliss(wh,[0,2,4,5,7,9,11],84,96,sec['カチャーシー'].q0+o+2,.6,86);smpN(wh,96,sec['カチャーシー'].q0+2.6,.8,84);smpN(wh,96,sec['カチャーシー'].q0+4*B+2.6,.8,84);
 const bs=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','カチャーシー'],(s,b,nm)=>w5Bass(bs,C,s,nm==='カチャーシー'?[[0,1,'r',92],[1,1,'5',76],[2,1,'8',80],[3,1,'5',76]]:[[0,1.5,'r',86],[2,1.5,'5',72]],28));
 smpN(bs,smpLow(0,28),sec['終わり'].q0+B,3,90);
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc);
 smpFinish([C.g,smpTrack('midi',{name:'三線（三味線で代用）',tone:'waf_shamisen',vol:-10,pan:-.25,ci:0,fx:[['eq',{hp:150,mid:1,midf:1800}],SMPFX.room(.1)],notes:sn,start:0,clip:'三線'}),
  smpTrack('drum',{name:'島太鼓・手拍子',tone:W5_KIT,vol:-12,pan:.1,ci:1,fx:[['eq',{hp:40}],SMPFX.room(.1)],notes:dr,clip:'太鼓'}),w5Bs(bs),
  smpTrack('midi',{name:'指笛（ホイッスル）',tone:'waf_whistle',vol:-16,pan:.35,ci:4,fx:[SMPFX.room(.14)],notes:wh,clip:'指笛'}),tVo],tVo);
}
/* =====================================================================
   16. 中国「月下の茶会」 5 音音階（ド・レ・ミ・ソ・ラ）。古箏（琴）・二胡（フィドル）・笛子・琵琶（三味線のトレモロ）
   工夫: 区間の頭に古箏のグリッサンド、二胡は歌の下で長い音を「すべらせて」入る
   ===================================================================== */
function w5China(){
 const C=w5Begin({tag:'cn',name:'月下の茶会',bpm:70,swing:50,key:[5,'major'],seed:1601,
  secs:[['序',4,0,'F | Dm | Bb | C'],['Aメロ',8,1,'F | Dm | Bb | F | Gm | C | Dm | C'],['サビ',8,3,'Bb | C | Am | Dm | Gm | C | F | F'],['間奏',4,4,'Dm | Bb | C | F'],
   ['Aメロ2',8,1,'F | Dm | Bb | F | Gm | C | Dm | C'],['サビ2',8,3,'Bb | C | Am | Dm | Gm | C | F | F'],['終わり',4,0,'Bb | C | F | F']]});
 const {B,sec}=C;
 const T=[{q:0,bpm:60}];T.push({q:sec['Aメロ'].q0,bpm:70});smpRamp(T,sec['終わり'].q0+2*B,sec['終わり'].q1,70,52,1);smpTempo(T);
 const MEL={A:['C4:1 F4:1 G4:1 A4:1 | ~D5:1.5 C5:.5 A4:2','D5:1 C5:.5 A4:.5 G4:1 F4:1 | G4:1.5 A4:.5 F4:2','G4:1 A4:1 C5:1.5 D5:.5 | C5:1 A4:1 G4:2','A4:1 G4:.5 F4:.5 D4:1 F4:1 | ~G4:4'],
  S:['F5:1.5 D5:.5 C5:1 D5:1 | C5:1 A4:1 G4:2','A4:1 C5:1 D5:1 F5:1 | ~D5:2 C5:1 A4:1','G4:1.5 A4:.5 C5:1 D5:1 | F5:1.5 G5:.5 F5:1 D5:1','C5:1 A4:.5 G4:.5 A4:1 C5:1 | ~F4:4']};
 const LYR={a1:['つきがのぼれば','ちゃのかおりがする','はるかなともよ','いまはどこに'],s1:['つきのひかりに','おもいをのせて','しずかにながれて','いつのひにか'],
  a2:['かぜがふきぬけ','たけのはがゆれる','ちゃわんのなかに','つきがゆれる']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:88}],['Aメロ2','A','a2'],['サビ2','S','s1',{v:90}]],MEL,LYR);
 const pent=[5,7,9,0,2];
 /* 古箏: 低い分散和音（1 小節に 4 音）＋区間の頭でグリッサンド */
 const gz=[];w5Bars(C,['序','Aメロ','サビ','間奏','Aメロ2','サビ2','終わり'],(s,b,nm)=>{if(nm==='終わり'&&b===3){smpVoice(C.chAt(s),48,5,false).forEach((p,i)=>smpN(gz,p,s+i*.12,4,64));return}
  w5Arp(gz,C,s,[0,1,2,3],[0,2,3,1],1.8,48,4,/サビ/.test(nm)?66:58)});
 for(const nm of ['序','サビ','間奏','サビ2'])w5Gliss(gz,pent,60,93,sec[nm].q0-(nm==='序'?0:1),1,74);
 /* 二胡: 序のテーマ・サビは長い音の対旋律（下からすべり込む） */
 const eh=[...w5Line(C,'序',['r:2 C5:1.5 D5:.5 | F5:2 D5:1 C5:1 | A4:1.5 G4:.5 F4:1 G4:1 | ~A4:4'],{v:78})];
 for(const nm of ['サビ','Aメロ2','サビ2']){const s=sec[nm],L=[];w5Long(L,C,s.q0,s.q1,nm==='Aメロ2'?57:65,nm==='Aメロ2'?69:77,nm==='サビ2'?66:56);for(const n of L){eh.push({p:n.p-2,q:n.q,l:.14,v:n.v-10},{p:n.p,q:n.q+.14,l:n.l-.14,v:n.v})}}
 /* 笛子: 間奏のメロディと終わり */
 const dz=[...w5Line(C,'間奏',['A5:.5 G5:.5 F5:1 D5:1 C5:1 | D5:1.5 F5:.5 G5:2 | A5:.5 C6:.5 A5:.5 G5:.5 F5:1 D5:1 | ~F5:4'],{v:84}),...w5Line(C,'終わり',['C6:2 A5:1 G5:1 | F5:1.5 G5:.5 A5:2 | ~F5:8'],{v:74})];
 /* 琵琶: 間奏で速いトレモロ */
 const pp=[];w5Bars(C,['間奏'],s=>{const ch=C.chAt(s);w5Trem(pp,smpLow(ch.root,57),s,2,.125,62);w5Trem(pp,smpLow(ch.root,57)+7,s+2,2,.125,58)});
 /* 打楽器: 木魚（ウッドブロック）と銅鑼の代わり（チャイナ・シンバル） */
 const pc=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2'],(s,b,nm)=>{const sb=/サビ|間奏/.test(nm);w5Hits(pc,s,[[76,0,sb?78:66],[77,1,60],[76,2,sb?72:62],[77,3,58]]);if(sb)w5Hits(pc,s,[[77,3.5,52]]);if(b===0)smpN(pc,52,s,2,sb?80:64)});
 smpN(pc,52,sec['終わり'].q0+3*B,4,72);
 const bs=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','終わり'],(s,b,nm)=>{if(nm==='終わり'&&b>2)return;w5Bass(bs,C,s,/サビ/.test(nm)?[[0,2,'r',84],[2,2,'5',70]]:[[0,3.8,'r',76]],29)});
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc,{rev:.16});
 smpFinish([C.g,smpTrack('midi',{name:'古箏（琴）',tone:'waf_koto',vol:-11,pan:-.3,ci:0,fx:[SMPFX.room(.14)],notes:gz,start:0,clip:'古箏'}),
  smpTrack('midi',{name:'二胡（フィドル）',tone:'waf_fiddle',vol:-14,pan:.3,ci:5,fx:[['eq',{hp:180}],SMPFX.hall(.16,2.2)],notes:eh,start:0,clip:'二胡'}),
  smpTrack('midi',{name:'笛子（フルート）',tone:'tj_flute',vol:-11,pan:.15,ci:4,fx:[['eq',{hp:250}],SMPFX.plate(.15,1.8)],notes:dz,clip:'笛子'}),
  smpTrack('midi',{name:'琵琶（三味線のトレモロ）',tone:'waf_shamisen',vol:-15,pan:-.15,ci:6,fx:[SMPFX.room(.1)],notes:pp,clip:'琵琶'}),
  smpTrack('drum',{name:'木魚・銅鑼',tone:W5_KIT,vol:-15,pan:.2,ci:1,fx:[SMPFX.room(.12)],notes:pc,clip:'打楽器'}),w5Bs(bs,{vol:-9}),tVo],tVo);
}
/* =====================================================================
   17. アフリカ「サバンナの朝」 12/8。カリンバ 2 本のからみ・ベル・ジャンベ・呼びかけと返し（コール＆レスポンス）
   工夫: 前半は歌の呼びかけにコーラスが答える → サビでいっしょに歌う → 間奏はドラムだけのブレイク
   ===================================================================== */
function w5Africa(){
 const C=w5Begin({tag:'af',name:'サバンナの朝',bpm:140,swing:50,key:[5,'major'],sig:{n:12,d:8},seed:1701,
  secs:[['イントロ',4,0,'F | Bb | C | F'],['Aメロ',8,1,'F | Bb | C | F | F | Bb | C | F'],['サビ',8,3,'F | Bb | C | F | F | Bb | C | F'],['間奏',4,4,'F | Bb | C | F'],
   ['Aメロ2',8,1,'F | Bb | C | F | F | Bb | C | F'],['サビ2',8,3,'F | Bb | C | F | F | Bb | C | F'],['アウトロ',4,0,'F | Bb | C | F']]});
 const {B,sec}=C;
 const MEL={A:['C5:1.5 A4:1 C5:.5 D5:1.5 C5:1.5 | r:6','E5:1 D5:.5 C5:1 A4:.5 G4:3 | r:6','A4:1 C5:.5 D5:1 C5:.5 A4:1.5 F4:1.5 | r:6','G4:1 A4:.5 C5:1 E5:.5 D5:1.5 C5:1.5 | r:6'],
  S:['F5:1.5 F5:1 E5:.5 D5:1.5 C5:1.5 | D5:1 C5:.5 Bb4:1 A4:.5 Bb4:1.5 D5:1.5','E5:1.5 G5:1 E5:.5 D5:1.5 C5:1.5 | A4:1 C5:.5 A4:1 G4:.5 F4:3',
   'A5:1.5 G5:1 F5:.5 D5:1.5 C5:1.5 | D5:1 C5:.5 Bb4:1 A4:.5 Bb4:1.5 D5:1.5','E5:1.5 G5:1 E5:.5 C5:1.5 E5:1.5 | ~F5:6']};
 const LYR={a1:['あさがきた','ひがのぼる','さあうたおう','てをたたこう'],s1:['ひかりのなかでおどろう','かぜがうたをはこぶよ','そらのしたでてをとろう','あたらしいひ'],a2:['かわのおと','とりがなく','わらいごえが','まちにひびく']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:90}],['Aメロ2','A','a2'],['サビ2','S','s1',{v:94}]],MEL,LYR);
 /* コーラスの返し（Aメロの 2・4・6・8 小節目）と、サビは 3 度下でハモる */
 const ch=[];const ans=['D5:1.5 C5:1 Bb4:.5 A4:3','C5:1.5 A4:1 G4:.5 F4:3'];
 for(const nm of ['Aメロ','Aメロ2']){const s=sec[nm];for(let i=0;i<4;i++){const p=smpPhrases([ans[i%2]],s.q0+(2*i+1)*B,{leg:.9,v:76});smpLyr(p.groups,[i%2?'あーおー':'えーおー'],'af_ans');
  for(const n of p.notes){ch.push(n);const pcs=smpIv(C.chAt(n.q)).map(k=>(k+C.chAt(n.q).root)%12);let lo=n.p-3;while(!pcs.includes(((lo%12)+12)%12))lo--;ch.push({...n,p:lo,v:n.v-8})}}}
 for(const nm of ['サビ','サビ2'])ch.push(...w5Dia(voc.filter(n=>n.q>=sec[nm].q0&&n.q<sec[nm].q1),5,'major',-2).map(n=>({...n,v:n.v-6})));
 /* カリンバ 2 本（表と裏でからむ） */
 const k1=[],k2=[];
 w5Bars(C,['イントロ','Aメロ','サビ','間奏','Aメロ2','サビ2','アウトロ'],(s,b,nm)=>{if(nm==='間奏'&&b<2)return;const v=C.chAt(s),vs=smpVoice(v,65,4,false);
  [[0,0],[1,2],[2,1],[3,3],[4.5,2],[5,1]].forEach(([o,i])=>smpN(k1,vs[i],s+o,.45,smpH(o%1.5?64:76,4)));
  if(nm!=='イントロ'||b>=2)[[.5,3],[1.5,2],[2.5,3],[3.5,1],[4,3],[5.5,2]].forEach(([o,i])=>smpN(k2,vs[i]+12,s+o,.4,smpH(58,4)))});
 /* ベル（12/8 の基本形）・ジャンベ（低・高・スラップ）・シェイカー */
 const dr=[];const bell=[0,1,2,2.5,3.5,4.5,5.5];
 w5Bars(C,['イントロ','Aメロ','サビ','間奏','Aメロ2','サビ2','アウトロ'],(s,b,nm,ch0,S0)=>{const full=/サビ|間奏/.test(nm),intro=nm==='イントロ';
  if(!(intro&&b<2))for(const o of bell)smpN(dr,67,s+o,.2,smpH(o===0?74:62,4));
  if(intro)return;
  w5Hits(dr,s,[[64,0,90],[64,3,84],[63,1.5,76],[63,2,70],[62,1,full?82:70],[63,4.5,76],[63,5,70],[62,4,full?84:72]]);
  if(full)for(let i=0;i<12;i++)smpN(dr,70,s+i*.5,.2,smpH(i%3?40:54,4));
  if(nm==='間奏'&&b<2)for(let i=0;i<12;i++)smpN(dr,i%3===0?64:i%2?62:63,s+i*.5,.3,smpH(74+i*2,4));
  if(nm==='アウトロ'&&b===3)smpN(dr,49,s,3,70)});
 const bs=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','アウトロ'],(s,b,nm)=>{if(nm==='間奏'&&b<2)return;w5Bass(bs,C,s,[[0,1.5,'r',92],[3,1,'5',76],[4.5,.5,'8',70],[5,1,'app',72]],29)});
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc);
 smpFinish([C.g,smpTrack('midi',{name:'カリンバ 1',tone:'waf_kalimba',vol:-11,pan:-.35,ci:0,fx:[SMPFX.room(.1)],notes:k1,start:0,clip:'表'}),
  smpTrack('midi',{name:'カリンバ 2',tone:'waf_kalimba',vol:-14,pan:.35,ci:6,fx:[SMPFX.room(.1)],notes:k2,start:0,clip:'裏'}),
  smpTrack('drum',{name:'ジャンベ・ベル',tone:W5_KIT,vol:-11,pan:.1,ci:1,fx:[['eq',{hp:40}],SMPFX.room(.1)],notes:dr,start:0,clip:'リズム'}),w5Bs(bs),
  smpTrack('midi',{name:'コーラス（返し）',tone:'waf_choir',vol:-13,pan:-.1,ci:5,fx:[['eq',{hp:180}],SMPFX.hall(.16,2)],notes:ch,clip:'返し'}),tVo],tVo);
}
/* =====================================================================
   18. インド「ガンジスの夕べ」 ラーガ・ヤマン（夕方のラーガ）。タンプーラの持続音・シタール・タブラ・バーンスリー
   工夫: 自由なテンポのアーラープで始まり、タブラが入ってガト → 歌 → 最後はテンポを上げてジャーラ、3 回くり返して決める（ティハイ）
   ===================================================================== */
function w5India(){
 const D='D | D | D | D',D8=D+' | '+D;
 const C=w5Begin({tag:'in',name:'ガンジスの夕べ',bpm:88,swing:50,key:[2,'major'],seed:1801,
  secs:[['アーラープ',4,0,D],['ガト',8,4,D8],['うた',8,1,'D | D | D | D | E/D | E/D | D | D'],['サビ',8,3,'D | D | A | A | D | E/D | D | D'],['間奏',4,4,D],
   ['うた2',8,1,'D | D | D | D | E/D | E/D | D | D'],['サビ2',8,3,'D | D | A | A | D | E/D | D | D'],['ジャーラ',8,6,D8],['終わり',2,0,'D | D']]});
 const {B,sec}=C;
 const T=[{q:0,bpm:54}];T.push({q:sec['ガト'].q0,bpm:88});smpRamp(T,sec['ジャーラ'].q0,sec['ジャーラ'].q0+4*B,88,124,1);smpRamp(T,sec['終わり'].q0,sec['終わり'].q1,124,70,1);smpTempo(T);
 const MEL={A:['A4:1 B4:.5 A4:.5 F#4:1 G#4:.5 A4:.5 | ~B4:2 A4:2','C#5:1 B4:.5 A4:.5 G#4:1 F#4:1 | E4:1.5 F#4:.5 D4:2','F#4:1 G#4:1 B4:1 C#5:1 | D5:1.5 C#5:.5 B4:1 A4:1','G#4:1 B4:.5 A4:.5 F#4:1 E4:1 | ~D4:4'],
  S:['D5:1.5 E5:.5 F#5:1 E5:1 | D5:1 C#5:1 B4:2','C#5:1 D5:.5 C#5:.5 B4:1 G#4:1 | A4:3 r:1','F#5:1.5 G#5:.5 A5:1 G#5:1 | F#5:1 E5:.5 D5:.5 C#5:2','B4:1 C#5:1 A4:1 F#4:1 | ~D5:4']};
 const LYR={a1:['ゆうべのかわべで','ともしびながして','ねがいをこめては','みずにうかべ'],s1:['ながれてゆけよ','ほしのうみへ','いのりのひかりが','よるにさく'],a2:['かねのねがひびく','まちにひがともり','はるかなやまから','かぜがふいて']};
 const voc=w5Voc(C,[['うた','A','a1'],['サビ','S','s1',{v:88}],['うた2','A','a2'],['サビ2','S','s1',{v:90}]],MEL,LYR);
 /* タンプーラ: パ・サ・サ・サ（A・D・D・D）をずっと */
 const tp=[];for(let q=0;q<C.len-1e-6;q+=B)[[45,0],[50,1],[50,2],[38,3]].forEach(([p,o])=>smpN(tp,p,q+o,1.9,smpH(50,3)));
 /* シタール: アーラープ（ゆっくり）・ガトのテーマ・歌の合間・間奏の速い節（ターン）・ジャーラ */
 const yam=[2,4,6,8,9,11,1];
 const st=[...w5Line(C,'アーラープ',['r:1 A4:1.5 B4:.5 | ~A4:2 G#4:1 F#4:1 | E4:1 F#4:.5 G#4:.5 A4:2 | ~D4:4'],{v:76}),
  ...w5Line(C,'ガト',['D5:.5 C#5:.5 B4:.5 A4:.5 B4:1 A4:1 | F#4:.5 G#4:.5 A4:1 ~B4:2 | C#5:.5 D5:.5 E5:1 D5:.5 C#5:.5 B4:1 | A4:1 G#4:.5 F#4:.5 ~E4:2',
   'F#4:.5 G#4:.5 A4:.5 B4:.5 C#5:1 D5:1 | E5:1.5 D5:.5 C#5:1 B4:1 | A4:.5 B4:.5 G#4:.5 A4:.5 F#4:1 E4:1 | ~D4:4'],{v:82}),
  ...w5Line(C,'間奏',['A5:.25 G#5:.25 F#5:.25 E5:.25 D5:.25 C#5:.25 B4:.25 A4:.25 B4:.5 C#5:.5 D5:1 | F#5:.25 E5:.25 D5:.25 C#5:.25 B4:.25 A4:.25 G#4:.25 F#4:.25 G#4:.5 A4:.5 B4:1 | D5:.25 E5:.25 F#5:.25 G#5:.25 A5:.5 G#5:.5 F#5:.5 E5:.5 D5:1 | ~A4:4'],{v:86,leg:.85})];
 for(const n of st.slice())if(n.l>=1.5)st.push({p:n.p-2,q:n.q-.12,l:.1,v:n.v-20});
 for(const nm of ['うた','うた2'])[0,1,2,3].forEach(i=>st.push(...smpMel(i%2?'E5:.5 D5:.5 C#5:.5 B4:.5':'A4:.5 B4:.5 C#5:.5 B4:.5',sec[nm].q0+i*8+6,{v:60})));
 {const s=sec['ジャーラ'];for(let b=0;b<6;b++){const q=s.q0+b*B,mel=[62,69,66,64,62,61,59,61];for(let i=0;i<16;i++)smpN(st,i%2?74:mel[(b*2+Math.floor(i/2))%8]+(b>=3?12:0),q+i*.25,.22,smpH(i%2?52:78,4))}
  const tih=s.q0+6*B+.5;for(let k=0;k<3;k++)['A5:.5 F#5:.5 E5:.5 D5:.5 r:.5'].forEach(m=>st.push(...smpMel(m,tih+k*2.5,{v:88+k*4})));smpN(st,62,sec['終わり'].q0,6,80);smpN(st,74,sec['終わり'].q0,6,70)}
 /* バーンスリー（竹笛）: サビの返しと、2 番のサビは長い音の対旋律 */
 const bn=[];for(const nm of ['サビ'])[1,3].forEach(i=>bn.push(...smpMel('A5:1 F#5:.5 E5:.5',sec[nm].q0+i*8+6,{v:70})));
 {const s=sec['サビ2'];w5Long(bn,C,s.q0,s.q1,78,90,58)}
 /* タブラ: ティーンタール（16 拍）。ダー＝低＋高、ディン、ティン、ター */
 const tb=[],bol={dha:[[64,92],[63,76]],dhin:[[64,82],[62,70]],tin:[[62,70]],ta:[[63,74]]};
 const tt=['dha','dhin','dhin','dha','dha','dhin','dhin','dha','dha','tin','tin','ta','ta','dhin','dhin','dha'];
 w5Bars(C,['ガト','うた','サビ','間奏','うた2','サビ2','ジャーラ'],(s,b,nm)=>{const cyc=(b%4)*4,fast=nm==='ジャーラ'||nm==='間奏';
  for(let k=0;k<4;k++){for(const [n,v] of bol[tt[cyc+k]])smpN(tb,n,s+k,.3,smpH(v,4));if(fast||/サビ/.test(nm))smpN(tb,62,s+k+.5,.2,smpH(52,4));if(fast)smpN(tb,63,s+k+.75,.2,smpH(46,4))}});
 {const tih=sec['ジャーラ'].q0+6*B+.5;for(let k=0;k<3;k++)[0,.5,1,1.5].forEach((o,i)=>smpN(tb,i===0?64:63,tih+k*2.5+o,.3,84+k*4))}
 smpN(tb,64,sec['終わり'].q0,1,96);smpN(tb,63,sec['終わり'].q0,1,80);
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc,{rev:.16});
 smpFinish([C.g,smpTrack('midi',{name:'タンプーラ（持続音）',tone:'waf_sitar',vol:-19,pan:-.2,ci:5,fx:[['filter',{type:0,freq:3500,q:.6}],SMPFX.hall(.16,2.6)],notes:tp,start:0,clip:'パ・サ・サ・サ'}),
  smpTrack('midi',{name:'シタール',tone:'waf_sitar',vol:-10,pan:.2,ci:0,fx:[['eq',{hp:120,mid:1,midf:2000}],SMPFX.plate(.14,1.8)],notes:st,start:0,clip:'シタール'}),
  smpTrack('midi',{name:'バーンスリー（竹笛）',tone:'tj_flute',vol:-12,pan:-.15,ci:4,fx:[['eq',{hp:250}],SMPFX.hall(.16,2)],notes:bn,clip:'竹笛'}),
  smpTrack('drum',{name:'タブラ（コンガで代用）',tone:W5_KIT,vol:-11,pan:.1,ci:1,fx:[['eq',{hp:50,mid:1.5,midf:900}],SMPFX.room(.1)],notes:tb,clip:'ティーンタール'}),tVo],tVo);
}
/* =====================================================================
   19. メキシコ「ひまわりの広場」 3/4 のランチェラ。トランペット 2 本・バイオリン・アコギ（ズン・チャッ・チャッ）・ギタロン（ウッドベース）
   工夫: トランペットのファンファーレで始まり、サビではトランペットが合いの手、最後はマリアッチらしい決めで終わる
   ===================================================================== */
function w5Mexico(){
 const AP='G | G | D7 | D7 | D7 | D7 | G | G | G | G7 | C | C | G | D7 | G | G',SP='C | C | G | G | D7 | D7 | G | G | C | C | G | Em | Am | D7 | G | G';
 const C=w5Begin({tag:'mx',name:'ひまわりの広場',bpm:160,swing:50,key:[7,'major'],sig:{n:3,d:4},seed:1901,
  secs:[['ファンファーレ',8,0,'G | C | D7 | G | C | Am | D7 | G'],['Aメロ',16,1,AP],['サビ',16,3,SP],['間奏',8,4,'C | G | D7 | G | C | G | D7 | G'],['Aメロ2',16,1,AP],['サビ2',16,3,SP],['エンディング',6,0,'C | D7 | G | D7 | G | G']]});
 const {B,sec}=C;
 const T=[{q:0,bpm:160}];smpRamp(T,sec['エンディング'].q0+3*B,sec['エンディング'].q0+5*B,160,110,1);smpTempo(T);
 const MEL={A:['D4:1 G4:1 A4:1 | B4:2 G4:1 | A4:1 B4:1 C5:1 | ~A4:3','A4:1 C5:1 B4:1 | A4:2 F#4:1 | G4:1 A4:1 B4:1 | ~G4:3','B4:1 D5:1 B4:1 | F5:2 D5:1 | E5:1 D5:1 C5:1 | ~E5:3','D5:1 B4:1 G4:1 | A4:1.5 B4:.5 C5:1 | B4:2 A4:1 | ~G4:3'],
  S:['E5:2 E5:1 | G5:2 E5:1 | D5:2 B4:1 | ~D5:3','C5:2 C5:1 | F#5:2 E5:1 | D5:1 C5:1 B4:1 | ~G4:3','E5:1 F#5:1 G5:1 | A5:2 G5:1 | G5:2 E5:1 | ~B4:3','C5:1 E5:1 D5:1 | C5:2 A4:1 | ~G4:6']};
 const LYR={a1:['ひまわりのひろばで','あなたをまちわびて','ぎたーのおとがなる','まつりのよるがくる'],s1:['さあおどろうよ','たいようのしたで','こころのままにね','あいのうたを'],
  a2:['はなびがよぞらへと','ひかりのはなさかせ','ばいおりんがうたう','みんなでてをとろう']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:90}],['Aメロ2','A','a2'],['サビ2','S','s1',{v:94}]],MEL,LYR,{leg:.9});
 /* トランペット: ファンファーレ（3 度下でハモる）・サビの合いの手・エンディング */
 const fan=w5Line(C,'ファンファーレ',['D5:1 D5:.5 D5:.5 G5:1 | B5:2 A5:1 | G5:1 F#5:1 E5:1 | ~D5:3 | E5:1 E5:.5 E5:.5 C5:1 | A5:2 G5:1 | F#5:1 E5:1 F#5:1 | ~G5:3'],{leg:.8,v:96});
 const tr1=[...fan],tr2=[...w5Dia(fan,7,'major',-2)];
 for(const nm of ['サビ','サビ2'])[0,1,2].forEach(i=>{const q=sec[nm].q0+i*12+9,f=smpMel('D5:.5 E5:.5 G5:1 r:1',q,{leg:.7,v:88});tr1.push(...f);tr2.push(...w5Dia(f,7,'major',-2))});
 {const e=sec['エンディング'],f=smpMel('E5:1 E5:.5 E5:.5 G5:1 | F#5:1 A5:1 C6:1 | B5:3 | A5:1 C6:1 F#5:1 | ~G5:3 | G5:.5 r:2.5',e.q0,{leg:.8,v:100});tr1.push(...f);tr2.push(...w5Dia(f,7,'major',-2))}
 /* バイオリン: 間奏のメロディ（3 度でハモる）と、歌の合間 */
 const vl=w5Line(C,'間奏',['G5:1 A5:1 B5:1 | C6:2 B5:1 | A5:1 G5:1 F#5:1 | ~G5:3 | E5:1 F#5:1 G5:1 | A5:2 G5:1 | F#5:1 E5:1 D5:1 | ~G5:3'],{v:84});
 for(const nm of ['Aメロ','Aメロ2'])[0,1,2,3].forEach(i=>vl.push(...smpMel('B5:1 A5:1 G5:1',sec[nm].q0+i*12+9,{v:62})));
 const vl2=w5Dia(vl.filter(n=>n.q>=sec['間奏'].q0&&n.q<sec['間奏'].q1),7,'major',-2);
 /* ギター（ズン・チャッ・チャッ）・ギタロン（1 拍目に根音と 5 度を交互に） */
 const gt=[],bs=[];
 w5Bars(C,['ファンファーレ','Aメロ','サビ','間奏','Aメロ2','サビ2','エンディング'],(s,b,nm)=>{const e=nm==='エンディング';if(e&&b===5){smpVoice(C.chAt(s),52,5,false).forEach((p,j)=>smpN(gt,p,s+j*.02,.4,90));smpN(bs,smpLow(7,31),s,.6,96);return}
  if(e&&b===4){w5Strum(gt,C,s,[[0,2.8,84]],52,5);smpN(bs,smpLow(7,31),s,2.8,90);return}
  w5Strum(gt,C,s,[[1,.35,74],[2,.35,68]],55,4);w5Bass(bs,C,s,[[0,.9,b%2?'5':'r',92]],31)});
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc);
 smpFinish([C.g,smpTrack('midi',{name:'トランペット 1',tone:'tj_trumpet',vol:-10,pan:-.2,ci:4,fx:[['eq',{hp:200,high:-1}],SMPFX.plate(.14,1.6)],notes:tr1,start:0,clip:'ファンファーレ'}),
  smpTrack('midi',{name:'トランペット 2',tone:'tj_trumpet',vol:-13,pan:-.35,ci:4,fx:[['eq',{hp:200,high:-1}],SMPFX.plate(.14,1.6)],notes:tr2,start:0,clip:'ハモリ'}),
  smpTrack('midi',{name:'バイオリン',tone:'tj_violin',vol:-12,pan:.3,ci:5,fx:[['eq',{hp:200}],SMPFX.plate(.14,1.8)],notes:[...vl,...vl2],clip:'バイオリン'}),
  w5AG(gt,{name:'アコースティックギター（ビウエラ）',vol:-12,pan:.2,clip:'ズン・チャッ・チャッ'}),w5Bs(bs,{name:'ギタロン（ウッドベース）',clip:'ギタロン'}),tVo],tVo);
}
/* =====================================================================
   20. ハワイ「虹の入り江」 スラックキー・ギター（交互ベース）・スチールギター風のスライド・イプー（ひょうたんの太鼓）
   工夫: 最後はハワイアン定番の「ヴァンプ」（II7 → V7 → I）でしめる
   ===================================================================== */
function w5Hawaii(){
 const AP='F | F | Bb | F | G7 | C7 | F | C7',SP='Bb | F | G7 | C7 | Bb | F | G7 C7 | F';
 const C=w5Begin({tag:'hw',name:'虹の入り江',bpm:88,swing:60,key:[5,'major'],seed:2001,
  secs:[['イントロ',4,0,'F | Bb | C7 | F'],['Aメロ',8,1,AP],['サビ',8,3,SP],['間奏',8,4,AP],['Aメロ2',8,1,AP],['サビ2',8,3,SP],['ヴァンプ',4,0,'G7 | C7 | F | F']]});
 const {B,sec}=C;
 const T=[{q:0,bpm:88}];smpRamp(T,sec['ヴァンプ'].q0+B,sec['ヴァンプ'].q1,88,64,1);smpTempo(T);
 const MEL={A:['C4:1 F4:1 A4:1.5 G4:.5 | F4:1 A4:1 C5:2','D5:1.5 C5:.5 Bb4:1 A4:1 | G4:1 A4:.5 F4:2.5','B4:1 A4:1 G4:1 D5:1 | C5:1.5 Bb4:.5 G4:2','A4:1 F4:1 G4:1 A4:1 | ~G4:4'],
  S:['D5:1 D5:1 F5:1.5 D5:.5 | C5:1 A4:1 F4:2','G4:1 A4:1 B4:1 D5:1 | ~C5:2 Bb4:1 G4:1','D5:1 F5:1 G5:1.5 F5:.5 | D5:1 C5:1 A4:2','G4:1 B4:1 C5:1 E5:1 | ~F5:4']};
 const LYR={a1:['なみのささやき','やしのかげゆれ','あまいかぜふく','いりえのひ'],s1:['にじのはしかけ','あろはのうたを','ふたりうたおう','あいのしま'],a2:['ゆうひがおちて','そらあかねいろ','ほしがまたたく','ゆめのなか']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:88}],['Aメロ2','A','a2'],['サビ2','S','s1',{v:90}]],MEL,LYR);
 /* スラックキー: 親指で根音と 5 度を交互、指で和音のつまみ（裏拍） */
 const gt=[];
 w5Bars(C,['イントロ','Aメロ','サビ','間奏','Aメロ2','サビ2','ヴァンプ'],(s,b,nm)=>{const v=smpVoice(C.chAt(s),60,3,false),half=C.chAt(s+2),v2=smpVoice(half,60,3,false);
  if(nm==='ヴァンプ'&&b===3){smpVoice(C.chAt(s),48,6,false).forEach((p,j)=>smpN(gt,p,s+j*.06,4,70));return}
  w5Bass(gt,C,s,[[0,.9,'r',78],[1,.9,'5',68],[2,.9,'r',76],[3,.9,'5',66]],40);
  [[.5,v],[1.5,v],[2.5,v2],[3.5,v2]].forEach(([o,vs],i)=>{vs.slice(i%2).forEach((p,j)=>smpN(gt,p,s+o+j*.01,.45,smpH(62,4)))});if(b%2===1)smpN(gt,v2[2]+12,s+3,.5,64)});
 /* スチールギター風: 区間の終わりのつなぎ・間奏のソロ（下から滑り上げる） */
 const slide=L=>{for(const n of L.slice())if(n.l>=.9){L.push({p:n.p-3,q:n.q-.18,l:.08,v:n.v-16},{p:n.p-2,q:n.q-.11,l:.07,v:n.v-12},{p:n.p-1,q:n.q-.05,l:.05,v:n.v-8})}return L};
 const sg=slide([...w5Line(C,'イントロ',['C6:2 A5:1 F5:1 | D5:2 F5:2 | E5:1 G5:1 Bb5:1 C6:1 | ~A5:4'],{v:80}),
  ...w5Line(C,'間奏',['C5:1 F5:1 A5:1.5 G5:.5 | F5:1 A5:1 C6:2 | D6:1.5 C6:.5 Bb5:1 A5:1 | G5:1 A5:.5 F5:2.5 | B5:1 A5:1 G5:1 D6:1 | C6:1.5 Bb5:.5 G5:2 | A5:1 F5:1 G5:1 A5:1 | ~G5:4'],{v:82}),
  ...w5Line(C,'ヴァンプ',['B5:1 A5:1 G5:1 F5:1 | E5:1 G5:1 Bb5:1 C6:1 | ~A5:8'],{v:76})]);
 for(const nm of ['Aメロ','Aメロ2'])[1,3].forEach(i=>sg.push(...slide(smpMel('A5:1 C6:1',sec[nm].q0+i*8+6,{v:60}))));
 /* イプー（ひょうたん）: ドン・パッ。サビからシェイカー */
 const ip=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','ヴァンプ'],(s,b,nm)=>{if(nm==='ヴァンプ'&&b>1)return;const sb=/サビ|間奏/.test(nm);w5Hits(ip,s,[[64,0,86],[63,1,70],[64,1.5,66],[63,2,76],[62,3,70]]);if(sb)for(let i=0;i<8;i++)smpN(ip,70,s+i*.5,.2,smpH(i%2?38:50,4))});
 const bs=[];w5Bars(C,['サビ','間奏','Aメロ2','サビ2','ヴァンプ'],(s,b,nm)=>{if(nm==='ヴァンプ'&&b===3){smpN(bs,smpLow(5,29),s,3,86);return}w5Bass(bs,C,s,[[0,1.5,'r',86],[2,1,'5',72],[3,1,'app',66]],29)});
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc);
 smpFinish([C.g,w5AG(gt,{name:'スラックキー・ギター（アコギ）',vol:-10,pan:-.2,clip:'交互ベース'}),
  smpTrack('midi',{name:'スチールギター風（スライド）',tone:'waf_clean_gtr',vol:-12,pan:.3,ci:4,fx:[['eq',{hp:220,high:1}],['chorus',{mix:.2,rate:4.5,depth:.15}],SMPFX.plate(.16,2)],notes:sg,start:0,clip:'スライド'}),
  smpTrack('drum',{name:'イプー・シェイカー',tone:W5_KIT,vol:-14,pan:.15,ci:1,fx:[SMPFX.room(.1)],notes:ip,clip:'イプー'}),w5Bs(bs),tVo],tVo);
}
/* =====================================================================
   21. アンデス「コンドルの空」 ワイニョ（タン・タタ のリズム）。ケーナ・サンポーニャ 2 本の掛け合い・ボンボ・アコギのかき鳴らし
   工夫: 自由なテンポのケーナで始まり、間奏はサンポーニャ 2 本が 1 音ずつ交互に吹く（ホケット）、最後はテンポを上げる
   ===================================================================== */
function w5Andes(){
 const AP='Am | Am | C | G | C | Am | G | Am',SP='Am | Am | C | C | G | Em | C G | Am';
 const C=w5Begin({tag:'an',name:'コンドルの空',bpm:100,swing:50,key:[9,'minor'],seed:2101,
  secs:[['イントロ',4,0,'Am | C | G | Am'],['Aメロ',8,1,AP],['サビ',8,3,SP],['間奏',8,4,AP],['Aメロ2',8,1,AP],['サビ2',8,3,SP],['早いワイニョ',8,6,SP],['終わり',2,0,'E7 | Am']]});
 const {B,sec}=C;
 const T=[{q:0,bpm:66}];T.push({q:sec['Aメロ'].q0,bpm:100});smpRamp(T,sec['早いワイニョ'].q0,sec['早いワイニョ'].q0+2*B,100,128,.5);smpRamp(T,sec['終わり'].q0+B,sec['終わり'].q1,128,90,1);smpTempo(T);
 const MEL={A:['A4:.5 C5:.25 C5:.25 D5:1 C5:.5 A4:.5 G4:1 | A4:.5 G4:.25 E4:.25 G4:1 ~A4:2','C5:.5 D5:.25 D5:.25 E5:1 D5:.5 C5:.5 D5:1 | C5:.5 A4:.25 G4:.25 A4:1 ~G4:2',
   'E5:.5 G5:.25 G5:.25 E5:1 D5:.5 C5:.5 D5:1 | E5:.5 D5:.25 C5:.25 A4:1 ~C5:2','D5:.5 C5:.25 A4:.25 G4:1 A4:.5 C5:.5 E4:1 | ~A4:4'],
  S:['A5:1.5 G5:.5 E5:1 D5:1 | E5:1 D5:.5 C5:.5 A4:2','C5:1.5 D5:.5 E5:1 G5:1 | ~E5:2 D5:1 C5:1','D5:1 E5:1 G5:1 A5:1 | G5:1.5 E5:.5 D5:2','C5:1 D5:1 E5:1 G4:1 | ~A4:4']};
 const LYR={a1:['たかいやまのむこうがわに','ちいさなむらがみえてくる','ははのよぶこえかぜにのり','あおぞらにきえる'],s1:['こんどるよとべよ','はてなきそらを','わたしのゆめも','つれてゆけ'],
  a2:['ほしがきらめくよるのみち','ひとりあるいてふりかえる','とおいむかしのやくそくを','いまもおぼえてる']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:88}],['Aメロ2','A','a2'],['サビ2','S','s1',{v:90}]],MEL,LYR);
 /* ケーナ: 自由なテンポのイントロ・サビ2 は 3 度上でハモ・早いワイニョでテーマ */
 const qn=[...w5Line(C,'イントロ',['r:1 E5:1 A5:2 | G5:1 E5:.5 D5:.5 C5:2 | D5:1 E5:1 G5:1.5 E5:.5 | ~A5:4'],{v:84}),
  ...w5Dia(voc.filter(n=>n.q>=sec['サビ2'].q0&&n.q<sec['サビ2'].q1),9,'minor',2).map(n=>({...n,v:n.v-10})),
  ...w5Line(C,'早いワイニョ',['A5:.5 C6:.25 C6:.25 D6:1 C6:.5 A5:.5 G5:1 | A5:.5 G5:.25 E5:.25 G5:1 ~A5:2 | C6:.5 D6:.25 D6:.25 E6:1 D6:.5 C6:.5 D6:1 | C6:.5 A5:.25 G5:.25 A5:1 ~G5:2',
   'E6:.5 G6:.25 G6:.25 E6:1 D6:.5 C6:.5 D6:1 | E6:.5 D6:.25 C6:.25 A5:1 ~C6:2 | D6:.5 C6:.25 A5:.25 G5:1 A5:.5 C6:.5 E5:1 | ~A5:4'],{v:88}),
  ...w5Line(C,'終わり',['G#5:1 B5:1 D6:1 E6:1 | ~A5:4'],{v:86})];
 /* サンポーニャ 2 本: 間奏で 1 音ずつ交互（ホケット）。早いワイニョは 3 度下で */
 const z1=[],z2=[];{const h=smpPhrases(MEL.A,sec['間奏'].q0,{leg:.9,v:84}).notes.map(n=>({...n,p:n.p+12}));h.forEach((n,i)=>(i%2?z2:z1).push(n))}
 z2.push(...w5Dia(qn.filter(n=>n.q>=sec['早いワイニョ'].q0&&n.q<sec['早いワイニョ'].q1),9,'minor',-2).map(n=>({...n,p:n.p-12})));
 /* ギター（チャランゴの代わり）: タン・タタ のかき鳴らし */
 const gt=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','早いワイニョ','終わり'],(s,b,nm)=>{if(nm==='終わり'){if(b===1)w5Strum(gt,C,s,[[0,3,86]],52,5);else w5Strum(gt,C,s,[[0,.4,80],[1,.4,74],[2,.4,80],[3,.4,74]],52,5);return}
  for(const h of [0,2])w5Strum(gt,C,s+h,[[0,.45,80],[.5,.22,64,1],[.75,.22,70]],55,4)});
 /* ボンボ（低い太鼓）とふちのカッ */
 const dr=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','早いワイニョ','終わり'],(s,b,nm,ch,S0)=>{if(nm==='終わり'){if(b===1)smpN(dr,41,s,1,100);return}const sb=nm!=='Aメロ'&&nm!=='Aメロ2';
  for(const h of [0,2])w5Hits(dr,s+h,[[41,0,sb?96:84],[37,.5,64],[41,.75,sb?78:68]]);if(b===S0.bars-1)w5Hits(dr,s,[[41,3,80],[41,3.25,86],[41,3.5,92],[41,3.75,98]])});
 const bs=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','早いワイニョ','終わり'],(s,b,nm)=>{if(nm==='終わり'){smpN(bs,smpLow(b?9:4,28),s,b?3:3.8,90);return}w5Bass(bs,C,s,[[0,.5,'r',90],[.75,.25,'r',70],[1,.9,'5',76],[2,.5,'r',88],[2.75,.25,'r',68],[3,.9,'app',72]],28)});
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc);
 smpFinish([C.g,w5AG(gt,{name:'アコースティックギター（かき鳴らし）',vol:-12,pan:-.25,clip:'ワイニョ'}),
  smpTrack('midi',{name:'ケーナ（フルート）',tone:'tj_flute',vol:-10,pan:.2,ci:4,fx:[['eq',{hp:250}],SMPFX.plate(.15,1.8)],notes:qn,start:0,clip:'ケーナ'}),
  smpTrack('midi',{name:'サンポーニャ 1',tone:'waf_panflute',vol:-11,pan:-.35,ci:6,fx:[SMPFX.room(.12)],notes:z1,clip:'ホケット'}),
  smpTrack('midi',{name:'サンポーニャ 2',tone:'waf_panflute',vol:-11,pan:.35,ci:6,fx:[SMPFX.room(.12)],notes:z2,clip:'ホケット'}),
  smpTrack('drum',{name:'ボンボ',tone:W5_KIT,vol:-12,pan:.05,ci:1,fx:[['eq',{hp:40}],SMPFX.room(.1)],notes:dr,clip:'ボンボ'}),w5Bs(bs),tVo],tVo);
}
/* =====================================================================
   22. アイルランド「霧の丘」 6/8。ティン・ホイッスル・フィドル・バウロン（枠太鼓）・アコギ
   工夫: 歌はゆったり、間奏と最後はテンポを上げてジグ（フィドルが 3 度下でハモる）
   ===================================================================== */
function w5Celtic(){
 const AP='D | G | D | A | D | G | A | D',SP='G | D | Em | A | G | D | A | D',JP='D | G | D | A | D | G | A | D';
 const C=w5Begin({tag:'ie',name:'霧の丘',bpm:132,swing:50,key:[2,'major'],sig:{n:6,d:8},seed:2201,
  secs:[['イントロ',4,0,'D | G | A | D'],['Aメロ',8,1,AP],['サビ',8,3,SP],['ジグ',16,4,JP+' | '+JP],['Aメロ2',8,1,AP],['サビ2',8,3,SP],['サビ3',8,3,SP],['ジグ2',16,6,JP+' | '+JP],['終わり',2,0,'A | D']]});
 const {B,sec}=C;
 const T=[{q:0,bpm:100}];T.push({q:sec['Aメロ'].q0,bpm:132});T.push({q:sec['ジグ'].q0,bpm:172});T.push({q:sec['Aメロ2'].q0,bpm:132});T.push({q:sec['サビ3'].q0,bpm:132});T.push({q:sec['ジグ2'].q0,bpm:176});smpRamp(T,sec['終わり'].q0,sec['終わり'].q1,176,120,.5);smpTempo(T);
 const MEL={A:['A4:1 F#4:.5 A4:1 B4:.5 | D5:1.5 B4:1 A4:.5','F#4:1 A4:.5 D5:1 C#5:.5 | ~B4:1.5 A4:1.5','A4:1 B4:.5 D5:1 E5:.5 | F#5:1.5 E5:1 D5:.5','E5:1 D5:.5 C#5:1 A4:.5 | ~D5:3'],
  S:['B4:1 D5:.5 G5:1 F#5:.5 | E5:1 D5:.5 F#5:1.5','E5:1 G5:.5 F#5:1 E5:.5 | ~E5:1.5 C#5:1.5','D5:1 G5:.5 B5:1 A5:.5 | F#5:1 E5:.5 D5:1.5','E5:1 F#5:.5 E5:1 C#5:.5 | ~D5:3']};
 const LYR={a1:['きりたつおかに','ふるいうたが','かぜにのってくる','なつかしく'],s1:['かえろうさとへ','みどりのみち','ひかりさすおか','わがこきょう'],a2:['ひつじのむれが','おかをこえる','かねのねひびく','ゆうぐれに']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:88}],['Aメロ2','A','a2'],['サビ2','S','s1',{v:90}],['サビ3','S','s1',{v:94}]],MEL,LYR);
 const JIG=['D5:.5 F#5:.5 A5:.5 B5:.5 A5:.5 F#5:.5 | G5:.5 E5:.5 G5:.5 B5:.5 A5:.5 G5:.5 | F#5:.5 A5:.5 F#5:.5 E5:.5 D5:.5 E5:.5 | F#5:.5 E5:.5 D5:.5 C#5:.5 B4:.5 A4:.5',
  'D5:.5 F#5:.5 A5:.5 B5:.5 A5:.5 F#5:.5 | G5:.5 B5:.5 G5:.5 E5:.5 F#5:.5 G5:.5 | A5:.5 F#5:.5 D5:.5 E5:.5 C#5:.5 A4:.5 | ~D5:3'];
 /* ホイッスル: ゆっくりのイントロ・歌の合間・ジグ */
 const wh=[...w5Line(C,'イントロ',['A5:1.5 F#5:1 E5:.5 | D5:1 E5:.5 G5:1.5 | F#5:1 E5:.5 C#5:1 A4:.5 | ~D5:3'],{v:80}),...w5Line(C,'ジグ',JIG,{leg:.85,v:86}),...w5Line(C,'ジグ2',[...JIG,...JIG],{leg:.85,v:90}),...w5Line(C,'終わり',['C#6:1.5 E6:1.5 | ~D6:3'],{v:86})];
 for(const nm of ['Aメロ','Aメロ2'])[1,3].forEach(i=>wh.push(...smpMel('A5:.5 B5:.5 A5:.5',sec[nm].q0+i*6+4.5,{v:58})));
 /* フィドル: サビは長い音、ジグは 3 度下でハモる */
 const fd=[...w5Line(C,'ジグ',JIG,{leg:.85,v:84},8*B).map(n=>({...n,p:n.p-12})),...w5Dia(wh.filter(n=>n.q>=sec['ジグ2'].q0&&n.q<sec['ジグ2'].q1),2,'major',-2)];
 for(const nm of ['サビ','サビ2','サビ3'])w5Long(fd,C,sec[nm].q0+(nm==='サビ3'?4*B:0),sec[nm].q1,62,74,nm==='サビ'?54:62);
 /* アコギ（DADGAD 風・6/8 のかき鳴らし）・バウロン・ベース */
 const gt=[];w5Bars(C,['イントロ','Aメロ','サビ','ジグ','Aメロ2','サビ2','サビ3','ジグ2','終わり'],(s,b,nm)=>{if(nm==='終わり'&&b===1){w5Strum(gt,C,s,[[0,2.8,86]],50,6);return}
  if(nm==='イントロ'){w5Strum(gt,C,s,[[0,2.8,66]],50,6);return}w5Strum(gt,C,s,[[0,.45,80],[1,.2,62,1],[1.5,.45,74],[2.5,.2,60,1]],50,6)});
 const dr=[];w5Bars(C,['サビ','ジグ','Aメロ2','サビ2','サビ3','ジグ2','終わり'],(s,b,nm)=>{if(nm==='サビ3'&&b<4)return;if(nm==='終わり'){if(b===1)smpN(dr,41,s,1,96);return}const j=/ジグ/.test(nm);
  w5Hits(dr,s,[[41,0,j?94:82],[45,.5,52],[45,1,58],[41,1.5,j?86:74],[45,2,54],[45,2.5,60]])});
 const bs=[];w5Bars(C,['Aメロ','サビ','ジグ','Aメロ2','サビ2','サビ3','ジグ2','終わり'],(s,b,nm)=>{if(nm==='サビ3'&&b<4)return;if(nm==='終わり'){smpN(bs,smpLow(b?2:9,28),s,2.8,88);return}w5Bass(bs,C,s,[[0,1.4,'r',88],[1.5,1.4,'5',74]],28)});
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc);
 smpFinish([C.g,w5AG(gt,{vol:-12,pan:-.25,clip:'6/8 のかき鳴らし'}),
  smpTrack('midi',{name:'ティン・ホイッスル',tone:'waf_whistle',vol:-12,pan:.25,ci:4,fx:[['eq',{hp:300,high:-1.5}],SMPFX.plate(.14,1.6)],notes:wh,start:0,clip:'ホイッスル'}),
  smpTrack('midi',{name:'フィドル',tone:'waf_fiddle',vol:-12,pan:-.1,ci:5,fx:[['eq',{hp:200}],SMPFX.hall(.15,2)],notes:fd,clip:'フィドル'}),
  smpTrack('drum',{name:'バウロン（枠太鼓）',tone:W5_KIT,vol:-14,pan:.1,ci:1,fx:[['eq',{hp:45}],SMPFX.room(.1)],notes:dr,clip:'バウロン'}),w5Bs(bs),tVo],tVo);
}
/* =====================================================================
   23. アラビア「砂漠の星」 マカーム・ヒジャーズ（レ・ミ♭・ファ#・ソ・ラ・シ♭・ド）。カーヌーン（琴）・ネイ（尺八）・弦楽器のユニゾン・ダラブッカ
   工夫: 自由なテンポのタクシーム（即興）で始まり、サビ 2 は弦楽器が歌にこたえる
   ===================================================================== */
function w5Arabia(){
 const AP='D | D | Gm | D | Cm | D | Gm | D',SP='D | Gm | D | D | Gm | Cm | D | D';
 const C=w5Begin({tag:'ar',name:'砂漠の星',bpm:90,swing:50,key:[2,'minor'],seed:2301,
  secs:[['タクシーム',4,0,'D | D | Gm | D'],['Aメロ',8,1,AP],['サビ',8,3,SP],['間奏',8,4,AP],['Aメロ2',8,1,AP],['サビ2',8,3,SP],['終わり',4,0,'Gm | Cm | D | D']]});
 const {B,sec}=C;
 const T=[{q:0,bpm:58}];T.push({q:sec['Aメロ'].q0,bpm:90});smpRamp(T,sec['終わり'].q0+2*B,sec['終わり'].q1,90,56,1);smpTempo(T);
 const MEL={A:['A4:1 Bb4:.5 A4:.5 G4:1 F#4:1 | G4:1.5 F#4:.5 Eb4:1 D4:1','G4:1 A4:1 Bb4:1.5 C5:.5 | Bb4:1 A4:.5 G4:.5 ~A4:2','C5:1 Bb4:.5 A4:.5 G4:1 Eb4:1 | F#4:1.5 G4:.5 A4:2','Bb4:1 A4:.5 G4:.5 F#4:1 Eb4:1 | ~D4:4'],
  S:['D5:1.5 Eb5:.5 D5:1 C5:1 | Bb4:1 C5:.5 Bb4:.5 A4:2','A4:1 Bb4:1 C5:1 D5:1 | ~Eb5:2 D5:2','G5:1.5 F#5:.5 G5:1 A5:1 | G5:1 Eb5:.5 D5:.5 C5:2','Bb4:1 C5:1 A4:1 Eb5:1 | ~D5:4']};
 const LYR={a1:['すなのうみをわたる','すずのねがひびく','つきのかげをあび','たびはつづく'],s1:['ほしよみちしるべ','わたしをみて','あすのみちてらせ','ゆめのはて'],a2:['かぜがすなをまいて','とおいまちあかり','いずみのほとりで','ゆめをみよう']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:88}],['Aメロ2','A','a2'],['サビ2','S','s1',{v:90}]],MEL,LYR);
 const hij=[2,3,6,7,9,10,0];
 /* ネイ（尺八）: タクシーム・歌の合間・終わり */
 const ny=[...w5Line(C,'タクシーム',['r:1 A4:2 Bb4:1 | ~A4:2 G4:1 F#4:1 | G4:1.5 Bb4:.5 A4:1 G4:.5 F#4:.5 | Eb4:1 F#4:1 ~D4:2'],{v:78}),...w5Line(C,'終わり',['G4:1 Bb4:1 A4:2 | Eb5:1 D5:.5 C5:.5 Bb4:2 | A4:1 G4:.5 F#4:.5 Eb4:2 | ~D4:4'],{v:74})];
 for(const nm of ['Aメロ','Aメロ2'])[1,3].forEach(i=>ny.push(...smpMel('D5:.5 C5:.5 Bb4:.5 A4:.5',sec[nm].q0+i*8+6,{v:60})));
 /* カーヌーン（琴）: タクシームの分散和音・間奏のトレモロのソロ・歌の下で 8 分のアルペジオ */
 const qa=[];w5Bars(C,['タクシーム','Aメロ','サビ','Aメロ2','サビ2','終わり'],(s,b,nm)=>{if(nm==='タクシーム'){smpVoice(C.chAt(s),50,4,false).forEach((p,i)=>smpN(qa,p,s+i*.15,3,58));return}if(nm==='終わり'&&b===3){smpVoice(C.chAt(s),50,5,false).forEach((p,i)=>smpN(qa,p,s+i*.1,4,62));return}
  w5Arp(qa,C,s,[0,1,1.5,2.5,3],[0,2,1,3,2],.9,50,4,/サビ/.test(nm)?64:56)});
 {const sol=smpPhrases(['A5:1 Bb5:.5 A5:.5 G5:1 F#5:1 | G5:1.5 F#5:.5 Eb5:1 D5:1','G5:1 A5:1 Bb5:1.5 C6:.5 | Bb5:1 A5:.5 G5:.5 ~A5:2','C6:1 Bb5:.5 A5:.5 G5:1 Eb5:1 | F#5:1.5 G5:.5 A5:2','Bb5:1 A5:.5 G5:.5 F#5:1 Eb5:1 | ~D5:4'],sec['間奏'].q0,{v:80}).notes;
  for(const n of sol)if(n.l>=1)w5Trem(qa,n.p,n.q,n.l,.125,n.v);else qa.push(n)}
 /* 弦楽器のユニゾン: サビ 2 で歌にこたえる・間奏の後半 */
 const sx=[];for(const nm of ['サビ2'])[0,1,2,3].forEach(i=>sx.push(...smpMel(i%2?'D5:.5 C5:.5 Bb4:.5 A4:.5':'G5:.5 F#5:.5 Eb5:.5 D5:.5',sec[nm].q0+i*8+6,{v:74})));
 sx.push(...w5Line(C,'間奏',['r:8 r:8 r:8','D5:1 Eb5:1 F#5:1 G5:1 | A5:2 ~D5:2'],{v:70}));
 /* ダラブッカ: マクスーム（ドン・タッ・・タッ・ドン・・タッ・）とリク（タンバリン） */
 const dr=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','終わり'],(s,b,nm,ch,S0)=>{if(nm==='終わり'&&b>1)return;const sb=/サビ|間奏/.test(nm);
  w5Hits(dr,s,[[64,0,90],[62,.5,72],[62,1.5,76],[64,2,86],[62,3,78]]);if(sb)w5Hits(dr,s,[[54,0,58],[54,1,46],[54,2,54],[54,3,46],[62,3.5,56]]);if(b===S0.bars-1)w5Hits(dr,s,[[62,3,74],[62,3.25,80],[62,3.5,86],[64,3.75,92]])});
 smpN(dr,64,sec['終わり'].q0+3*B,1,90);
 const bs=[];w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2','終わり'],(s,b,nm)=>{if(nm==='終わり'){smpN(bs,smpLow(smpBassPc(C.chAt(s)),28),s,3.8,80);return}w5Bass(bs,C,s,[[0,1.5,'r',88],[2,1,'r',80],[3,1,'5',70]],28)});
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc,{rev:.16});
 smpFinish([C.g,smpTrack('midi',{name:'カーヌーン（琴）',tone:'waf_koto',vol:-11,pan:-.25,ci:0,fx:[SMPFX.room(.12)],notes:qa,start:0,clip:'カーヌーン'}),
  smpTrack('midi',{name:'ネイ（尺八）',tone:'waf_shakuhachi',vol:-11,pan:.25,ci:4,fx:[['eq',{hp:200}],SMPFX.hall(.16,2.2)],notes:ny,start:0,clip:'ネイ'}),
  smpTrack('midi',{name:'弦楽器（ユニゾン）',tone:'waf_strings',vol:-14,pan:.1,ci:5,fx:[['eq',{hp:180}],SMPFX.hall(.16,2.2)],notes:sx,clip:'こたえ'}),
  smpTrack('drum',{name:'ダラブッカ・リク',tone:W5_KIT,vol:-12,pan:-.05,ci:1,fx:[['eq',{hp:50}],SMPFX.room(.1)],notes:dr,clip:'マクスーム'}),w5Bs(bs),tVo],tVo);
}
/* =====================================================================
   24. バリ「ガムランの夜明け」 ペロッグ音階（ミ・ファ・ソ・シ・ド）。鉄琴 2 台のからみ（コテカン）・ゴング・クンダン
   工夫: 全員の一撃で始まり、間奏でだんだん速く → 急に止まる（アンセル）→ 一撃 → 最後はゆっくり消える
   ===================================================================== */
function w5Bali(){
 const E='Em | Em | C | Em',E8=E+' | '+E;
 const C=w5Begin({tag:'ba',name:'ガムランの夜明け',bpm:76,swing:50,key:[4,'minor'],seed:2401,
  secs:[['一撃',2,6,'Em | Em'],['ゆっくり',8,0,E8],['Aメロ',8,1,E8],['サビ',8,3,'C | Em | C | Em | C | G | C | Em'],['間奏',8,4,E8],['Aメロ2',8,1,E8],['サビ2',8,3,'C | Em | C | Em | C | G | C | Em'],['終わり',4,0,'C | Em | C | Em']]});
 const {B,sec}=C;
 const T=[{q:0,bpm:84},{q:sec['ゆっくり'].q0,bpm:62}];smpRamp(T,sec['ゆっくり'].q0+6*B,sec['Aメロ'].q0,62,76,1);smpRamp(T,sec['間奏'].q0,sec['間奏'].q0+6*B,76,118,1);T.push({q:sec['Aメロ2'].q0,bpm:76});smpRamp(T,sec['終わり'].q0,sec['終わり'].q1,76,48,1);smpTempo(T);
 const MEL={A:['E4:1 G4:1 F4:1 E4:1 | B4:1.5 C5:.5 B4:2','G4:1 B4:1 C5:1 B4:.5 G4:.5 | F4:2 E4:2','B4:1 C5:1 E5:1.5 C5:.5 | B4:1 G4:1 F4:2','G4:1 F4:.5 E4:.5 F4:1 G4:1 | ~E4:4'],
  S:['E5:1.5 C5:.5 B4:1 C5:1 | E5:1 F5:1 E5:2','C5:1 B4:.5 G4:.5 B4:1 C5:1 | B4:2 G4:2','G5:1.5 F5:.5 E5:1 C5:1 | B4:1 C5:1 E5:2','F5:1 E5:.5 C5:.5 B4:1 G4:1 | ~E5:4']};
 const LYR={a1:['よあけのたなだ','きりがながれる','はなをそなえて','かみにいのる'],s1:['かねのねひびく','しまのあさやけ','ひかりのなかで','いのちめざめ'],a2:['こどもがはしる','みちのむこうへ','かぜがはこんだ','あまいかおり']};
 const voc=w5Voc(C,[['Aメロ','A','a1'],['サビ','S','s1',{v:88}],['Aメロ2','A','a2'],['サビ2','S','s1',{v:90}]],MEL,LYR);
 const pel=[4,5,7,11,0];
 /* 骨格の旋律（1 拍に 1 音・チュンポン）→ 低い鉄琴（ジュブラグ）と、2 台のからみ（コテカン） */
 const core=[64,67,65,64,71,72,71,67, 67,71,72,71,65,65,64,64];
 const jb=[],g1=[],g2=[],near=(p,d)=>{const idx=[];for(let x=52;x<=96;x++)if(pel.includes(x%12))idx.push(x);const i=idx.indexOf(p);return idx[Math.max(0,Math.min(idx.length-1,i+d))]};
 w5Bars(C,['ゆっくり','Aメロ','サビ','間奏','Aメロ2','サビ2','終わり'],(s,b,nm)=>{for(let k=0;k<4;k++){const p=core[(b*4+k)%16],q=s+k;
   if(k%2===0)smpN(jb,p-12,q,1.9,smpH(70,3));
   if(nm==='ゆっくり'||nm==='終わり'){smpN(g1,p+12,q,.9,smpH(60,3));continue}
   const hi=p+12,up=near(hi,1);[[hi,0],[up,.25],[hi,.5],[up,.75]].forEach(([x,o],i)=>(i%2?g2:g1).push({p:i%2?near(x,1):x,q:q+o,l:.24,v:smpH(i%2?60:70,3)}))}});
 /* 一撃と、止め（アンセル） */
 const hit=q=>{[52,64,71,76].forEach(p=>smpN(jb,p,q,2,96));[76,83].forEach(p=>smpN(g1,p,q,1,96))};hit(0);hit(sec['Aメロ2'].q0-1);
 /* ゴング（大きな周期の区切り）・クンダン（太鼓）・チェンチェン（シンバル）・クンプリ（拍） */
 const gg=[],dr=[];
 for(let q=0;q<C.len-1e-6;q+=4*B)smpN(gg,40,q,8,90);smpN(gg,40,sec['終わり'].q1-B,8,86);
 w5Bars(C,['Aメロ','サビ','間奏','Aメロ2','サビ2'],(s,b,nm)=>{const fast=nm==='間奏',sb=/サビ/.test(nm)||fast;
  for(let k=0;k<4;k++)smpN(dr,53,s+k,.3,smpH(58,3));
  w5Hits(dr,s,[[64,0,84],[63,.75,70],[62,1.5,74],[64,2,80],[63,2.5,68],[62,3.25,72]]);
  if(sb)for(let i=0;i<16;i++)if(i%4!==0)smpN(dr,55,s+i*.25,.15,smpH(i%2?40:52,3));
  if(fast&&b===7)w5Hits(dr,s,[[64,2,90],[63,2.25,90],[62,2.5,94],[64,2.75,100],[49,3,100]])});
 /* 間奏の最後の 1 拍は全員休み（アンセル） */
 {const a=sec['Aメロ2'].q0-1.5;for(const L of [g1,g2,jb,dr])for(let i=L.length-1;i>=0;i--)if(L[i].q>=a&&L[i].q<sec['Aメロ2'].q0-1-1e-6)L.splice(i,1)}
 smpMaster([SMPFX.glue(-18,2,1)],0);
 const tVo=w5VoTrack(voc,{rev:.16});
 smpFinish([C.g,smpTrack('midi',{name:'鉄琴（ジュブラグ）',tone:'waf_tubular',vol:-14,pan:-.15,ci:0,fx:[['eq',{hp:80}],SMPFX.hall(.14,2.4)],notes:jb,start:0,clip:'骨格の旋律'}),
  smpTrack('midi',{name:'鉄琴（コテカン 表）',tone:'waf_vibes',vol:-13,pan:-.35,ci:6,fx:[SMPFX.room(.12)],notes:g1,start:0,clip:'表'}),
  smpTrack('midi',{name:'鉄琴（コテカン 裏）',tone:'waf_vibes',vol:-13,pan:.35,ci:6,fx:[SMPFX.room(.12)],notes:g2,start:0,clip:'裏'}),
  smpTrack('midi',{name:'ゴング（低い鐘）',tone:'waf_tubular',vol:-15,pan:0,ci:5,fx:[['filter',{type:0,freq:1800,q:.5}],SMPFX.hall(.16,3)],notes:gg,start:0,clip:'ゴング'}),
  smpTrack('drum',{name:'クンダン・チェンチェン',tone:W5_KIT,vol:-13,pan:.1,ci:1,fx:[['eq',{hp:50}],SMPFX.room(.1)],notes:dr,clip:'クンダン'}),tVo],tVo);
}
SAMPLE_SONGS.push(
 {id:'korea',no:'14',name:'アリランの風',meta:'80 BPM・3/4・G・韓国・歌詞あり',desc:'カヤグム（琴）の分散和音とテグム（尺八）、チャンゴの太鼓。最後のサビは琴と歌だけで始まり、全員が戻ってくる。',build:w5Korea},
 {id:'okinawa',no:'15',name:'島風の唄',meta:'92→132 BPM・C・沖縄（琉球音階）・歌詞あり',desc:'三線が歌に寄りそい、島太鼓が刻む。最後はテンポを上げてカチャーシー（手拍子・囃子・指笛）。',build:w5Okinawa},
 {id:'china',no:'16',name:'月下の茶会',meta:'60→70 BPM・F・中国（5 音音階）・歌詞あり',desc:'古箏のグリッサンド、二胡のすべり込む長い音、笛子と琵琶のトレモロの間奏。静かな月夜の歌。',build:w5China},
 {id:'africa',no:'17',name:'サバンナの朝',meta:'12/8・F・アフリカ・歌詞あり',desc:'カリンバ 2 本のからみとベル、ジャンベ。歌の呼びかけにコーラスが答え、サビでいっしょに歌う。',build:w5Africa},
 {id:'india',no:'18',name:'ガンジスの夕べ',meta:'54→88→124 BPM・D・インド（ラーガ・ヤマン）・歌詞あり',desc:'タンプーラの持続音にシタールのアーラープ → タブラが入って歌 → 最後はジャーラで速くなり、3 回くり返して決める。',build:w5India},
 {id:'mexico',no:'19',name:'ひまわりの広場',meta:'160 BPM・3/4・G・メキシコ（マリアッチ）・歌詞あり',desc:'トランペット 2 本のファンファーレ、バイオリン、ズン・チャッ・チャッのギターとギタロン。サビにトランペットの合いの手。',build:w5Mexico},
 {id:'hawaii',no:'20',name:'虹の入り江',meta:'88 BPM・F・スウィング・ハワイ・歌詞あり',desc:'スラックキー・ギターの交互ベース、スライドするスチールギター風、イプーの太鼓。最後はハワイアンのヴァンプ。',build:w5Hawaii},
 {id:'andes',no:'21',name:'コンドルの空',meta:'66→100→128 BPM・Am・アンデス・歌詞あり',desc:'ケーナの自由なイントロ、ワイニョのリズム。間奏はサンポーニャ 2 本が 1 音ずつ交互に吹き、最後は速くなる。',build:w5Andes},
 {id:'celtic',no:'22',name:'霧の丘',meta:'6/8・132→172 BPM・D・アイルランド・歌詞あり',desc:'ティン・ホイッスルとフィドル、アコギとバウロン。ゆったりの歌と、テンポを上げたジグが交互に来る。3 回目のサビは歌とギターだけで始まる。',build:w5Celtic},
 {id:'arabia',no:'23',name:'砂漠の星',meta:'58→90 BPM・D ヒジャーズ・アラビア・歌詞あり',desc:'ネイ（尺八）の即興で始まり、カーヌーンのトレモロのソロ、ダラブッカのマクスーム。サビ 2 は弦楽器が歌に答える。',build:w5Arabia},
 {id:'bali',no:'24',name:'ガムランの夜明け',meta:'62→118→48 BPM・E ペロッグ・バリ・歌詞あり',desc:'鉄琴 2 台が 1 音ずつからむコテカンとゴング。間奏でだんだん速くなり、急に止まって一撃、最後はゆっくり消える。',build:w5Bali},
);
for(const x of SAMPLE_SONGS)if(['korea','okinawa','china','africa','india','mexico','hawaii','andes','celtic','arabia','bali'].includes(x.id)&&!/ずんだもん/.test(x.meta))x.meta+='・歌: ずんだもん';
/* =====================================================================
   デモ曲の品質の見直し ＋ 新しい 5 曲
   見直し（全曲に読み込み時にかける）:
    ・歪み系（ディストーション・ビットクラッシャー・OTT・テープ）は薄く。リバーブ・ディレイも控えめに
    ・シンセの簡易音色で代わりがきく楽器は、ネットの実録サンプル（WebAudioFont・tonejs・Salamander など）に
    ・音域ごとの交通整理: ベース・ドラム以外は低域を軽くカット、メロディの下で鳴るパッド類は少し下げて薄く
   ===================================================================== */
const S4_TONE_MAP={syn_bell:'waf_celesta',syn_pluck:'waf_harp',syn_voice:'waf_oohs',syn_sbass:'waf_synth_bass',syn_epiano:'smp_rhodes',syn_piano:'smp_sal_hq',syn_strings:'waf_strings',syn_brass:'waf_brass',syn_organ:'waf_organ'};
const S4_LEAD=/flute|sax|trumpet|violin|whistle|oboe|clarinet|lead|harmonica|panflute/;
const S4_PAD=/pad|strings|choir|oohs|organ|synth_strings/;
function s4FxVal(f,k){const i=rFxKeys(f.fx).indexOf(k);return i>=0?i:-1}
function s4Cap(f,k,max,min){const i=s4FxVal(f,k);if(i<0)return;if(max!=null&&f.vals[i]>max)f.vals[i]=max;if(min!=null&&f.vals[i]<min)f.vals[i]=min}
function s4TameFx(list,dry){
 for(const f of list||[]){if(!RFXDEF[f.fx])continue;
  if(f.fx==='dist'){s4Cap(f,'drive',.1);s4Cap(f,'mix',.35)}
  else if(f.fx==='crush'){s4Cap(f,'mix',.15);s4Cap(f,'bits',null,10)}
  else if(f.fx==='ott'){s4Cap(f,'mix',.25)}
  else if(f.fx==='tape'){s4Cap(f,'drive',.2);s4Cap(f,'wobble',.1)}
  else if(f.fx==='reverb'){s4Cap(f,'mix',dry?.22:.18);s4Cap(f,'decay',3.2)}
  else if(f.fx==='delay'){s4Cap(f,'mix',.15);s4Cap(f,'fb',.35)}
  else if(f.fx==='chorus'){s4Cap(f,'mix',.35)}
 }
}
function s4Polish(id){
 const lead=S.tracks.find(t=>t.id===S.lyrTrack)||S.tracks.find(t=>t.type==='midi'&&S4_LEAD.test(t.tone||''));
 for(const t of S.tracks){
  if(t.fx)s4TameFx(t.fx,id==='nocturne');
  if(t.type!=='midi'&&t.type!=='drum')continue;
  const m=S4_TONE_MAP[t.tone];if(m&&TONES.some(x=>x.id===m))t.tone=m;
  /* ベースは生のウッドベース、ギターはアコースティック（ナイロン弦は使わない）。ロック・電子音楽の曲はエレキのまま */
  if(/^(waf_nylon|tj_guitar-nylon)$/.test(t.tone||'')){t.tone='tj_guitar-acoustic';t.name=t.name.replace('ナイロンギター','アコースティックギター').replace('ナイロン','アコギ')}
  if(!/^(rock|techno|edm|chaos)$/.test(id)&&/^(waf_ac_bass|waf_fretless|waf_finger_bass|tj_bass-electric)$/.test(t.tone||'')){t.tone='smp_upright';if(/ベース/.test(t.name)&&!/ウッド/.test(t.name))t.name=t.name.replace('ベース','ウッドベース')}
  if(t.type!=='midi'||t.guide)continue;
  const ns=t.clips.flatMap(c=>c.notes||[]);if(!ns.length)continue;
  const lo=Math.min(...ns.map(n=>n.p)),avgP=ns.reduce((a,n)=>a+n.p,0)/ns.length,bassy=avgP<50||/bass/.test(t.tone||'');
  /* ベース以外は低域を軽くカット（すでに EQ があれば HPF だけ底上げ） */
  if(!bassy){const hp=Math.max(70,Math.min(140,440*Math.pow(2,(lo-69)/12)*.7));let eq=t.fx.find(f=>f.fx==='eq');
   if(eq){const i=s4FxVal(eq,'hp');if(i>=0&&eq.vals[i]<hp)eq.vals[i]=Math.round(hp)}else t.fx.unshift(smpFx('eq',{hp:Math.round(hp)}))}
  /* メロディの下のパッド類（和音がぶ厚いもの）は少し下げる */
  if(lead&&t!==lead&&S4_PAD.test(t.tone||'')){const poly=ns.length/Math.max(1,new Set(t.clips.flatMap(c=>(c.notes||[]).map(n=>Math.round(((c.start||0)+n.s)*4)))).size);if(poly>2.2)t.vol=Math.min(t.vol,(lead.vol??-8)-4)-1}
 }
 for(const t of S.tracks)if(t.type==='audio'&&t.fx)s4TameFx(t.fx);
 s4TameFx(S.master.fx);
}

/* 全曲に品質の見直しをかける（新曲も含む） */
for(const x of SAMPLE_SONGS){const f=x.build;x.build=()=>{SMP_CUR=x.id;f();try{s4Polish(x.id)}catch(e){console.warn('s4Polish',e)}}}
for(const x of SAMPLE_SONGS){x.desc=String(x.desc||'').replace(/ナイロンギター/g,'アコースティックギター').replace(/ナイロン/g,'アコギ');x.meta=String(x.meta||'').replace(/ナイロン/g,'アコギ')}
/* デモ曲の音量バランス（実際の音を測って役割ごとに合わせた値。tools で作り直せる）*/
const SMP_MIX={"edm":{"t":{"ドラム":6,"ベース":-13.5,"スーパーソウ":-4.5,"リード":-3.5,"リード（オクターブ上）":0.5,"対旋律（ストリングス）":-6,"プラック":-11.5,"パッド":-12,"ピアノ（ブレイク）":-0.5,"ベル（ブレイク）":-6.5,"クワイア":-13,"効果音（ライザー・インパクト）":-3.5,"Audio 1":-12},"m":1},"trio":{"t":{"ドラム":6,"クロススティック":-0.5,"ウッドベース":-7.5,"アコースティックギター":-6.5,"ストリングス":-19,"フルート":-3,"Audio 1":-12},"m":8.5},"rock":{"t":{"ドラム":-12,"ベース（ピック）":-11,"リズムギター L（ディストーション）":-16.5,"リズムギター R（オーバードライブ）":-16,"リードギター":-3,"リードギター（ハモリ）":-15,"オルガン":-21,"Audio 1":-12},"m":2.5},"carousel":{"t":{"打楽器":3.5,"ピチカート・ウッドベース（ウン）":-1.5,"ハープ":-13.5,"ストリングス":-16.5,"ストリングス（対旋律）":-7.5,"チェロ（対旋律）":-3.5,"オルゴール":-9,"バイオリン（ソロ）":-3,"フルート":-3,"トランペット":-1,"ブラス（和音）":-4.5,"グロッケン":-2,"チェレスタ":-7.5,"Audio 1":-12},"m":2},"bossa":{"t":{"パーカッション":-2,"ウッドベース":-9.5,"アコースティックギター":-10.5,"ローズ":-16.5,"ストリングス":-21,"フルート":-9,"アコースティックギター（ソロ）":-3.5,"ハモリ（3度上・歌詞つき）":-10,"ボーカル（メロディ・歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":8,"z":{"パーカッション":-2,"ウッドベース":-9,"アコースティックギター":-10.5,"ローズ":-16,"ストリングス":-21,"フルート":-9,"アコースティックギター（ソロ）":-4.5,"ハモリ（3度上・歌詞つき）":-10,"ボーカル（ガイド）":-22,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":7.5},"nocturne":{"t":{"ピアノ（左手）":-8.5,"ピアノ（右手）":-3,"Audio 1":-12},"m":14},"techno":{"t":{"ドラムマシン":1,"シーケンス・ベース":-13.5,"アルペジオ":-12.5,"パッド":-16,"クワイア":-13,"シンセ・ストリングス（対旋律）":-1.5,"リード":-3,"FMベル":-7,"効果音":-3,"Audio 1":-12},"m":1.5},"idol":{"t":{"ドラム（80s）":-10.5,"ウッドベース":-12,"エレピ":-21,"ギター（カッティング）":-22,"ピアノ（落ちサビ）":-5.5,"ストリングス":-22.5,"ストリングス（対旋律）":-14.5,"シンセ・ブラス":-20,"コーラス":-18,"ベル":-14,"グロッケン（ベルの重ね）":-7.5,"効果音":-8.5,"ハモリ（歌詞つき）":-11,"ボーカル（メロディ・歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":7.5,"z":{"ドラム（80s）":-10,"ウッドベース":-11,"エレピ":-20,"ギター（カッティング）":-21,"ピアノ（落ちサビ）":-4,"ストリングス":-21.5,"ストリングス（対旋律）":-13,"シンセ・ブラス":-18.5,"コーラス":-17,"ベル":-12.5,"グロッケン（ベルの重ね）":-6.5,"効果音":-7.5,"ハモリ（歌詞つき）":-9.5,"ボーカル（ガイド）":-20.5,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":6.5},"ballad":{"t":{"ドラム":-2.5,"タンバリン":-2,"ウッドベース":-7.5,"ピアノ（左手）":-3,"ピアノ（右手）":-5.5,"オルガン":-18,"ストリングス":-21.5,"クワイア":-19,"エレキギター（アルペジオ・クランチ）":-4.5,"リードギター（ディストーション）":-7.5,"メインメロディ（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":7.5,"z":{"ドラム":-6,"タンバリン":-3,"ウッドベース":-8.5,"ピアノ（左手）":-3.5,"ピアノ（右手）":-6.5,"オルガン":-19,"ストリングス":-22,"クワイア":-19.5,"エレキギター（アルペジオ・クランチ）":-5.5,"リードギター（ディストーション）":-9,"メインメロディ（ガイド）":-22.5,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":8},"organ":{"t":{"足鍵盤（ペダル）":-4.5,"第2鍵盤（左手）":-10,"第1鍵盤（右手）":-3,"Audio 1":-12},"m":4.5},"chaos":{"t":{"リズムマシン（808）":-13.5,"チューバ":-1,"おもちゃのピアノ（チェレスタ）":-21,"スチールドラム":-16.5,"チェンバロ":-15,"シタール":-11.5,"アコーディオン":-21,"シロフォン":-2,"ウッドブロック":6,"カズー風（合いの手）":-16,"効果音（ビヨーン）":-11.5,"メインメロディ（口笛・歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":6.5,"z":{"リズムマシン（808）":-13.5,"チューバ":-1,"おもちゃのピアノ（チェレスタ）":-21,"スチールドラム":-16.5,"チェンバロ":-14.5,"シタール":-11.5,"アコーディオン":-21,"シロフォン":-2,"ウッドブロック":6,"カズー風（合いの手）":-16,"効果音（ビヨーン）":-11.5,"メインメロディ（ガイド）":-20,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":6.5},"cooljazz":{"t":{"ブラシ（スネア）":-1.5,"ブラシ（スウィッシュ）":0.5,"ライド＆ハット":2,"ウッドベース":-15,"ピアノ（左手のコンピング）":-12,"ジャズギター（刻み）":-19,"ピアノ（テーマ・ソロ）":-3,"ジャズギター（クリーン）":-14.5,"Audio 1":-12},"m":12},"ambient":{"t":{"遠い太鼓":-16.5,"ドローン（D・A）":-19,"パッド（ヘイロー）":-23.5,"ストリングス":-24.5,"ハープ":-20.5,"チェレスタ（氷のベル）":-9.5,"声の重なり（4度下・オクターブ下）":-14,"クワイア（主旋律）":-3,"Audio 1":-12},"m":12.5},"morse":{"t":{"TR-808":-6,"808ベース":-10,"シンセ・スタブ":-10,"モールス信号（サイン波）":-3,"モールス信号（遠い局）":-9,"メインメロディ（ロボ声・歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":1,"z":{"TR-808":-15.5,"808ベース":-16.5,"シンセ・スタブ":-16.5,"モールス信号（サイン波）":-9.5,"モールス信号（遠い局）":-15.5,"メインメロディ（ガイド）":-26.5,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":7},"korea":{"t":{"カヤグム（琴）":-6,"チャンゴ（太鼓）":-3,"ウッドベース":-9,"テグム（尺八）":-6.5,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":9.5,"z":{"カヤグム（琴）":-5,"チャンゴ（太鼓）":-2,"ウッドベース":-7.5,"テグム（尺八）":-5.5,"うた（ガイド）":-20,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":8},"okinawa":{"t":{"三線（三味線で代用）":-4.5,"島太鼓・手拍子":-4.5,"ウッドベース":-7.5,"指笛（ホイッスル）":-17,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":10,"z":{"三線（三味線で代用）":-3,"島太鼓・手拍子":-3,"ウッドベース":-6,"指笛（ホイッスル）":-16,"うた（ガイド）":-20,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":8.5},"china":{"t":{"古箏（琴）":-4,"二胡（フィドル）":-9.5,"笛子（フルート）":-12,"琵琶（三味線のトレモロ）":-0.5,"木魚・銅鑼":-5.5,"ウッドベース":-8,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":8.5,"z":{"古箏（琴）":-3.5,"二胡（フィドル）":-8.5,"笛子（フルート）":-11,"琵琶（三味線のトレモロ）":0.5,"木魚・銅鑼":-4.5,"ウッドベース":-7,"うた（ガイド）":-20.5,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":7.5},"africa":{"t":{"カリンバ 1":-10.5,"カリンバ 2":-7,"ジャンベ・ベル":-9,"ウッドベース":-7.5,"コーラス（返し）":-10.5,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":9.5,"z":{"カリンバ 1":-9.5,"カリンバ 2":-6,"ジャンベ・ベル":-7.5,"ウッドベース":-6.5,"コーラス（返し）":-9.5,"うた（ガイド）":-20.5,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":8},"india":{"t":{"タンプーラ（持続音）":-14,"シタール":-6,"バーンスリー（竹笛）":-9,"タブラ（コンガで代用）":-10.5,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":9.5,"z":{"タンプーラ（持続音）":-13,"シタール":-5,"バーンスリー（竹笛）":-8,"タブラ（コンガで代用）":-9.5,"うた（ガイド）":-20,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":8.5},"mexico":{"t":{"トランペット 1":-13,"トランペット 2":-16,"バイオリン":-9,"アコースティックギター（ビウエラ）":-13,"ギタロン（ウッドベース）":-9,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":8.5,"z":{"トランペット 1":-12,"トランペット 2":-15.5,"バイオリン":-8,"アコースティックギター（ビウエラ）":-12,"ギタロン（ウッドベース）":-8.5,"うた（ガイド）":-20.5,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":8},"hawaii":{"t":{"スラックキー・ギター（アコギ）":-12.5,"スチールギター風（スライド）":-15,"イプー・シェイカー":-7.5,"ウッドベース":-7,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":9.5,"z":{"スラックキー・ギター（アコギ）":-11,"スチールギター風（スライド）":-14,"イプー・シェイカー":-6.5,"ウッドベース":-5.5,"うた（ガイド）":-20,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":8},"andes":{"t":{"アコースティックギター（かき鳴らし）":-15,"ケーナ（フルート）":-12,"サンポーニャ 1":-10.5,"サンポーニャ 2":-12.5,"ボンボ":-5.5,"ウッドベース":-8.5,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":8,"z":{"アコースティックギター（かき鳴らし）":-14.5,"ケーナ（フルート）":-11,"サンポーニャ 1":-9.5,"サンポーニャ 2":-12,"ボンボ":-4.5,"ウッドベース":-8,"うた（ガイド）":-20.5,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":7},"celtic":{"t":{"アコースティックギター":-15,"ティン・ホイッスル":-9,"フィドル":-8.5,"バウロン（枠太鼓）":-6.5,"ウッドベース":-10.5,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":8.5,"z":{"アコースティックギター":-14.5,"ティン・ホイッスル":-8.5,"フィドル":-8,"バウロン（枠太鼓）":-6,"ウッドベース":-10,"うた（ガイド）":-21,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":8},"arabia":{"t":{"カーヌーン（琴）":-5,"ネイ（尺八）":-7,"弦楽器（ユニゾン）":-7.5,"ダラブッカ・リク":-7,"ウッドベース":-11.5,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":8.5,"z":{"カーヌーン（琴）":-4,"ネイ（尺八）":-6,"弦楽器（ユニゾン）":-6.5,"ダラブッカ・リク":-6,"ウッドベース":-10.5,"うた（ガイド）":-20,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":7.5},"bali":{"t":{"鉄琴（ジュブラグ）":-7.5,"鉄琴（コテカン 表）":-14.5,"鉄琴（コテカン 裏）":-12.5,"ゴング（低い鐘）":-13,"クンダン・チェンチェン":-7.5,"うた（歌詞つき）":-3,"ずんだもん（VOICEVOX・未生成）":-3,"Audio 1":-12},"m":10,"z":{"鉄琴（ジュブラグ）":-6,"鉄琴（コテカン 表）":-13.5,"鉄琴（コテカン 裏）":-11.5,"ゴング（低い鐘）":-12,"クンダン・チェンチェン":-6.5,"うた（ガイド）":-20,"ずんだもん（VOICEVOX）":-3,"Audio 1":-12},"zm":9}};
/* 各トラックの役割（音量バランスを測るときの目安。歌＝主役・ドラム・ベース・伴奏・合いの手・パッド・小物）*/
const SMP_ROLE={"edm": {"ドラム": "drums", "ベース": "bass", "スーパーソウ": "harm", "リード": "lead", "リード（オクターブ上）": "harm", "対旋律（ストリングス）": "harm", "プラック": "harm", "パッド": "pad", "ピアノ（ブレイク）": "counter", "ベル（ブレイク）": "counter", "クワイア": "pad", "効果音（ライザー・インパクト）": "perc"}, "trio": {"ドラム": "drums", "クロススティック": "perc", "ウッドベース": "bass", "アコースティックギター": "harm", "ストリングス": "pad", "フルート": "lead"}, "rock": {"ドラム": "drums", "ベース（ピック）": "bass", "リズムギター L（ディストーション）": "harm", "リズムギター R（オーバードライブ）": "harm", "リードギター": "lead", "リードギター（ハモリ）": "harmony", "オルガン": "pad"}, "carousel": {"打楽器": "drums", "ピチカート・ウッドベース（ウン）": "bass", "ハープ": "harm", "ストリングス": "pad", "ストリングス（対旋律）": "harm", "チェロ（対旋律）": "counter", "オルゴール": "counter", "バイオリン（ソロ）": "lead", "フルート": "counter", "トランペット": "counter", "ブラス（和音）": "harm", "グロッケン": "perc", "チェレスタ": "harm"}, "bossa": {"パーカッション": "drums", "ウッドベース": "bass", "アコースティックギター": "harm", "ローズ": "harm", "ストリングス": "pad", "フルート": "counter", "アコースティックギター（ソロ）": "counter", "ハモリ（3度上・歌詞つき）": "harmony", "ボーカル（メロディ・歌詞つき）": "lead"}, "nocturne": {"ピアノ（左手）": "harm", "ピアノ（右手）": "lead"}, "techno": {"ドラムマシン": "drums", "シーケンス・ベース": "bass", "アルペジオ": "harm", "パッド": "pad", "クワイア": "pad", "シンセ・ストリングス（対旋律）": "counter", "リード": "lead", "FMベル": "counter", "効果音": "perc"}, "idol": {"ドラム（80s）": "drums", "ウッドベース": "bass", "エレピ": "harm", "ギター（カッティング）": "harm", "ピアノ（落ちサビ）": "harm", "ストリングス": "pad", "ストリングス（対旋律）": "harm", "シンセ・ブラス": "harm", "コーラス": "pad", "ベル": "counter", "グロッケン（ベルの重ね）": "perc", "効果音": "perc", "ハモリ（歌詞つき）": "harmony", "ボーカル（メロディ・歌詞つき）": "lead"}, "ballad": {"ドラム": "drums", "タンバリン": "perc", "ウッドベース": "bass", "ピアノ（左手）": "harm", "ピアノ（右手）": "harm", "オルガン": "pad", "ストリングス": "pad", "クワイア": "pad", "エレキギター（アルペジオ・クランチ）": "harm", "リードギター（ディストーション）": "counter", "メインメロディ（歌詞つき）": "lead"}, "organ": {"足鍵盤（ペダル）": "bass", "第2鍵盤（左手）": "harm", "第1鍵盤（右手）": "lead"}, "chaos": {"リズムマシン（808）": "drums", "チューバ": "bass", "おもちゃのピアノ（チェレスタ）": "harm", "スチールドラム": "harm", "チェンバロ": "harm", "シタール": "harm", "アコーディオン": "harm", "シロフォン": "counter", "ウッドブロック": "perc", "カズー風（合いの手）": "counter", "効果音（ビヨーン）": "perc", "メインメロディ（口笛・歌詞つき）": "lead"}, "cooljazz": {"ブラシ（スネア）": "drums", "ブラシ（スウィッシュ）": "perc", "ライド＆ハット": "drums", "ウッドベース": "bass", "ピアノ（左手のコンピング）": "harm", "ジャズギター（刻み）": "harm", "ピアノ（テーマ・ソロ）": "lead", "ジャズギター（クリーン）": "counter"}, "ambient": {"遠い太鼓": "perc", "ドローン（D・A）": "pad", "パッド（ヘイロー）": "pad", "ストリングス": "pad", "ハープ": "harm", "チェレスタ（氷のベル）": "counter", "声の重なり（4度下・オクターブ下）": "harm", "クワイア（主旋律）": "lead"}, "morse": {"TR-808": "drums", "808ベース": "bass", "シンセ・スタブ": "harm", "モールス信号（サイン波）": "counter", "モールス信号（遠い局）": "perc", "メインメロディ（ロボ声・歌詞つき）": "lead"}, "korea": {"カヤグム（琴）": "harm", "チャンゴ（太鼓）": "drums", "ウッドベース": "bass", "テグム（尺八）": "counter", "うた（歌詞つき）": "lead"}, "okinawa": {"三線（三味線で代用）": "harm", "島太鼓・手拍子": "drums", "ウッドベース": "bass", "指笛（ホイッスル）": "perc", "うた（歌詞つき）": "lead"}, "china": {"古箏（琴）": "harm", "二胡（フィドル）": "counter", "笛子（フルート）": "counter", "琵琶（三味線のトレモロ）": "counter", "木魚・銅鑼": "perc", "ウッドベース": "bass", "うた（歌詞つき）": "lead"}, "africa": {"カリンバ 1": "harm", "カリンバ 2": "harm", "ジャンベ・ベル": "drums", "ウッドベース": "bass", "コーラス（返し）": "harmony", "うた（歌詞つき）": "lead"}, "india": {"タンプーラ（持続音）": "pad", "シタール": "counter", "バーンスリー（竹笛）": "counter", "タブラ（コンガで代用）": "drums", "うた（歌詞つき）": "lead"}, "mexico": {"トランペット 1": "counter", "トランペット 2": "harm", "バイオリン": "counter", "アコースティックギター（ビウエラ）": "harm", "ギタロン（ウッドベース）": "bass", "うた（歌詞つき）": "lead"}, "hawaii": {"スラックキー・ギター（アコギ）": "harm", "スチールギター風（スライド）": "counter", "イプー・シェイカー": "drums", "ウッドベース": "bass", "うた（歌詞つき）": "lead"}, "andes": {"アコースティックギター（かき鳴らし）": "harm", "ケーナ（フルート）": "counter", "サンポーニャ 1": "counter", "サンポーニャ 2": "counter", "ボンボ": "drums", "ウッドベース": "bass", "うた（歌詞つき）": "lead"}, "celtic": {"アコースティックギター": "harm", "ティン・ホイッスル": "counter", "フィドル": "counter", "バウロン（枠太鼓）": "drums", "ウッドベース": "bass", "うた（歌詞つき）": "lead"}, "arabia": {"カーヌーン（琴）": "harm", "ネイ（尺八）": "counter", "弦楽器（ユニゾン）": "counter", "ダラブッカ・リク": "drums", "ウッドベース": "bass", "うた（歌詞つき）": "lead"}, "bali": {"鉄琴（ジュブラグ）": "harm", "鉄琴（コテカン 表）": "harm", "鉄琴（コテカン 裏）": "harm", "ゴング（低い鐘）": "pad", "クンダン・チェンチェン": "drums", "うた（歌詞つき）": "lead"}};
function smpApplyMix(id,key){const M=SMP_MIX[id];if(!M)return;const T=M[key||'t'];if(!T)return;for(const t of S.tracks){const v=T[t.name];if(v!=null)t.vol=v}const m=key==='z'?M.zm:M.m;if(m!=null)S.master.vol=m}
for(const x of SAMPLE_SONGS){const f=x.build;x.build=()=>{f();const R=SMP_ROLE[x.id];if(R)for(const t of S.tracks)if(R[t.name])t.mixRole=R[t.name];smpApplyMix(x.id)}}
{const _e=smpZundaEmbed;smpZundaEmbed=async function(id,E){const r=await _e(id,E);if(r&&SMP_MIX[id]&&SMP_MIX[id].z){smpApplyMix(id,'z');try{renderRows();renderSide();HIST.last=projSnap();HIST.saved=HIST.last}catch(e){}}return r}}
