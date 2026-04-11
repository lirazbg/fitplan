import { useState, useEffect, useRef, useCallback, memo } from "react";

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SK  = "gym_plan_v1";
const CK  = "gym_clients_v1";
const SET = "gym_settings_v1";
const LK  = "gym_library_v1";
const HK  = "gym_history_v1";
const LDK = "gym_lastdates_v1";
const AWK = "gym_active_workout_v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const emptyPlan = () => ({ name:"תכנית חדשה", workoutsPerWeek:3, dayNames:{0:"אימון 1",1:"אימון 2",2:"אימון 3"}, days:{} });
const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function getYTId(url)    { try { const m=url?.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/); return m?m[1]:null; } catch { return null; } }
function getYTThumb(url) { const id=getYTId(url); return id?`https://img.youtube.com/vi/${id}/mqdefault.jpg`:null; }
function isYT(url)       { return !!(url?.includes("youtu")); }
function fmtTime(s)      { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60; return h>0?`${h}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`; }

const MUSCLE_GROUPS = ["כתפיים","חזה","גב","יד קדמית","יד אחורית","בטן","ישבן","רגליים","כל הגוף"];
const MUSCLE_ORDER = ["כתפיים","חזה","גב","יד קדמית","יד אחורית","בטן","ישבן","רגליים","כל הגוף","ללא קטגוריה"];
function muscleRank(g) { const i=MUSCLE_ORDER.indexOf(g); return i===-1?MUSCLE_ORDER.length:i; }

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0f}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:2px}

.btn-p{background:linear-gradient(135deg,#6c3fff,#a855f7);color:#fff;border:none;border-radius:12px;cursor:pointer;font-family:'Rubik',sans-serif;font-weight:600;font-size:14px;padding:11px 22px;transition:all .2s}
.btn-p:active{transform:scale(.97)}
.btn-g{background:rgba(255,255,255,.06);color:#c0c0d8;border:1px solid rgba(255,255,255,.1);border-radius:12px;cursor:pointer;font-family:'Rubik',sans-serif;font-weight:600;font-size:13px;padding:10px 18px;transition:all .2s}
.btn-g:active{background:rgba(255,255,255,.12)}
.btn-d{background:rgba(255,80,80,.1);color:#ff5555;border:1px solid rgba(255,80,80,.25);border-radius:8px;cursor:pointer;font-family:'Rubik',sans-serif;font-weight:600;font-size:12px;padding:7px 14px;transition:all .2s}
.btn-grn{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:none;border-radius:12px;cursor:pointer;font-family:'Rubik',sans-serif;font-weight:600;font-size:13px;padding:10px 18px;transition:all .2s}

.card{background:linear-gradient(145deg,#12121e,#1a1a2a);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:20px}
.day-card{background:linear-gradient(145deg,#12121e,#181828);border:1px solid rgba(108,63,255,.15);border-radius:16px;padding:14px 16px;transition:all .2s}
.client-card{background:linear-gradient(145deg,#12121e,#181828);border:1px solid rgba(108,63,255,.15);border-radius:16px;padding:14px 16px;transition:all .2s}

.inp{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#e8e8f0;font-family:'Rubik',sans-serif;font-size:14px;width:100%;direction:rtl;outline:none;transition:border-color .2s}
.inp:focus{border-color:rgba(108,63,255,.55);background:rgba(108,63,255,.06)}
.inp::placeholder{color:#555570}
.inp-w{background:rgba(255,255,255,.05);border:1px solid rgba(108,63,255,.25);border-radius:8px;padding:6px 8px;color:#e8e8f0;font-family:'Rubik',sans-serif;font-size:14px;font-weight:600;width:72px;text-align:center;direction:ltr;outline:none;transition:border-color .2s}
.inp-w:focus{border-color:#a855f7;background:rgba(108,63,255,.08)}
.inp-w::placeholder{color:#7777aa;font-weight:500}

.tag{background:rgba(108,63,255,.15);color:#a855f7;border:1px solid rgba(108,63,255,.3);border-radius:8px;padding:3px 10px;font-size:12px;font-weight:600}
.tag-grn{background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.25);border-radius:8px;padding:3px 10px;font-size:12px;font-weight:600}

.back-btn{background:none;border:none;color:#8888aa;cursor:pointer;font-family:'Rubik',sans-serif;font-size:15px;display:flex;align-items:center;gap:6px;padding:0}
.tab-btn{flex:1;border:none;border-radius:10px;cursor:pointer;font-family:'Rubik',sans-serif;font-weight:600;font-size:12px;padding:8px 4px;transition:all .2s}
.tab-on{background:linear-gradient(135deg,#6c3fff,#a855f7);color:#fff}
.tab-off{background:transparent;color:#666688}

.set-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.set-row:last-child{border-bottom:none}
.pbar{height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
.pfill{height:100%;background:linear-gradient(90deg,#6c3fff,#a855f7);border-radius:2px;transition:width .4s}

.stopwatch{font-size:40px;font-weight:800;letter-spacing:2px;background:linear-gradient(135deg,#e8e8f0,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:2000;padding:20px}
.confirm-box{background:#1a1a2a;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:24px;width:100%;max-width:320px;direction:rtl;text-align:center}
.logo-area{border:2px dashed rgba(108,63,255,.3);border-radius:14px;padding:18px;text-align:center;cursor:pointer;transition:all .2s;background:rgba(108,63,255,.04)}

@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.up{animation:up .22s ease forwards}
.yt-btn{background:rgba(255,0,0,.12);border:1px solid rgba(255,0,0,.25);color:#ff5555;border-radius:8px;padding:5px 12px;font-family:'Rubik',sans-serif;font-size:12px;font-weight:700;cursor:pointer}
`;

// ══════════════════════════════════════════════════════════════════════════════
// SMALL STANDALONE COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function ConfirmDialog({ msg, onYes, onNo, yesLabel="כן, מחק", yesStyle={} }) {
  return (
    <div className="confirm-overlay" onClick={onNo}>
      <div className="confirm-box" onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:28,marginBottom:12}}>🗑️</div>
        <p style={{fontSize:15,fontWeight:600,color:"#e8e8f0",marginBottom:20,lineHeight:1.5}}>{msg}</p>
        <div style={{display:"flex",gap:10}}>
          <button className="btn-d" style={{flex:1,padding:"10px 0",fontSize:14,borderRadius:12,...yesStyle}} onClick={onYes}>{yesLabel}</button>
          <button className="btn-g" style={{flex:1,padding:"10px 0",fontSize:14}} onClick={onNo}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function YouTubeModal({ url, title, onClose }) {
  const id = getYTId(url); if (!id) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:3000,padding:16}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:480,background:"#12121e",borderRadius:16,overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          <span style={{fontSize:14,fontWeight:700,color:"#e8e8f0",direction:"rtl",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</span>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.08)",border:"none",color:"#e8e8f0",borderRadius:8,width:30,height:30,fontSize:16,cursor:"pointer",marginRight:10,flexShrink:0}}>✕</button>
        </div>
        <div style={{position:"relative",paddingBottom:"56.25%",height:0}}>
          <iframe src={`https://www.youtube.com/embed/${id}?autoplay=1`} title={title} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}}/>
        </div>
      </div>
    </div>
  );
}

function Stopwatch({ startTime, onTick }) {
  const [elapsed, setElapsed] = useState(Math.max(0, Math.floor((Date.now()-startTime)/1000)));
  useEffect(() => {
    setElapsed(Math.max(0, Math.floor((Date.now()-startTime)/1000)));
    const id = setInterval(() => { const s=Math.max(0,Math.floor((Date.now()-startTime)/1000)); setElapsed(s); onTick?.(s); }, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return <div><div className="stopwatch">{fmtTime(elapsed)}</div><div style={{color:"#666688",fontSize:11,marginTop:2,marginBottom:10}}>זמן אימון</div></div>;
}

function Stepper({ value, onChange, min=1, max=20 }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <button className="btn-g" style={{width:30,height:30,padding:0,fontSize:18,borderRadius:8,flexShrink:0}} onClick={()=>onChange(Math.max(min,value-1))}>−</button>
      <span style={{fontSize:15,fontWeight:700,color:"#e8e8f0",minWidth:24,textAlign:"center"}}>{value}</span>
      <button className="btn-g" style={{width:30,height:30,padding:0,fontSize:18,borderRadius:8,flexShrink:0}} onClick={()=>onChange(Math.min(max,value+1))}>+</button>
    </div>
  );
}

// Input that keeps local state while focused
function FInput({ value, onSave, placeholder, ltr=false, style={}, className="inp", rows }) {
  const [local, setLocal] = useState(value??'');
  const focused = useRef(false);
  useEffect(()=>{ if(!focused.current) setLocal(value??''); },[value]);
  const props = { className, style:{...(ltr?{direction:"ltr",textAlign:"left"}:{}), ...style}, placeholder,
    value:local, onFocus:()=>{focused.current=true;}, onBlur:()=>{focused.current=false;onSave(local);},
    onChange:e=>setLocal(e.target.value), onKeyDown:e=>e.key==="Enter"&&!rows&&onSave(local) };
  return rows ? <textarea {...props} rows={rows} style={{...props.style,resize:"none"}}/> : <input {...props}/>;
}

function WInput({ value, onSave, placeholder="—" }) {
  const ref = useRef(null);
  const lastVal = useRef(value??'');
  useEffect(()=>{
    if(ref.current && document.activeElement!==ref.current){
      ref.current.value = value??'';
      lastVal.current = value??'';
    }
  },[value]);
  return <input ref={ref} className="inp-w" type="number" inputMode="decimal" min="0" step="0.5"
    placeholder={placeholder} defaultValue={value??''}
    onBlur={e=>{ if(e.target.value!==lastVal.current){lastVal.current=e.target.value;onSave(e.target.value);} }}/>;
}

function RInput({ value, onSave, placeholder="—" }) {
  const ref = useRef(null);
  const lastVal = useRef(value??'');
  useEffect(()=>{
    if(ref.current && document.activeElement!==ref.current){
      ref.current.value = value??'';
      lastVal.current = value??'';
    }
  },[value]);
  return <input ref={ref} className="inp-w" type="number" inputMode="numeric" min="0" step="1"
    placeholder={placeholder} defaultValue={value??''}
    onBlur={e=>{ if(e.target.value!==lastVal.current){lastVal.current=e.target.value;onSave(e.target.value);} }}/>;
}

function LogoUploader({ logoUrl, onUpload, onRemove, onAskConfirm }) {
  const ref = useRef();
  function handle(e) { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>onUpload(ev.target.result); r.readAsDataURL(f); e.target.value=""; }
  return (
    <div>
      {logoUrl && <div style={{textAlign:"center",marginBottom:12}}><img src={logoUrl} alt="לוגו" style={{maxHeight:75,maxWidth:180,objectFit:"contain",borderRadius:10}}/></div>}
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={handle}/>
      <div className="logo-area" onClick={()=>ref.current.click()}>
        <div style={{fontSize:24,marginBottom:4}}>🖼️</div>
        <p style={{color:"#9999bb",fontSize:13}}>{logoUrl?"לחץ להחלפת הלוגו":"לחץ להעלאת לוגו"}</p>
      </div>
      {logoUrl && <button className="btn-d" style={{width:"100%",marginTop:10,borderRadius:10}} onClick={()=>onAskConfirm("להסיר את הלוגו?",onRemove)}>🗑 הסר לוגו</button>}
    </div>
  );
}

function ExerciseHistory({ name, sessions }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if(!sessions||sessions.length===0) return null;
  const visible = showAll ? sessions : sessions.slice(0,3);
  const hasMore = sessions.length > 3;
  return (
    <div style={{width:"100%",marginBottom:8}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",textAlign:"right",padding:"10px 14px",background:open?"rgba(108,63,255,.15)":"rgba(255,255,255,.05)",border:open?"1px solid rgba(108,63,255,.4)":"1px solid rgba(255,255,255,.1)",borderRadius:open?"12px 12px 0 0":12,color:"#e8e8f0",fontFamily:"'Rubik',sans-serif",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{name}</span><span style={{fontSize:11,color:"#666688"}}>{sessions.length} אימונים {open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(108,63,255,.2)",borderTop:"none",borderRadius:"0 0 12px 12px",padding:"14px"}}>
          {visible.map((s,si)=>(
            <div key={si} style={{marginBottom:si<visible.length-1?18:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{background:"linear-gradient(135deg,#6c3fff,#a855f7)",borderRadius:8,padding:"3px 12px",fontSize:12,fontWeight:700,color:"#fff"}}>
                  {si===0?"אחרון":si===1?"לפני שניים":"לפני שלושה"}
                </div>
                <span style={{fontSize:12,color:"#666688"}}>📅 {s.date}</span>
              </div>
              <div style={{display:"flex",gap:10,padding:"4px 0 8px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
                <div style={{width:36,textAlign:"center",fontSize:10,color:"#555570",fontWeight:600}}>סט</div>
                <div style={{flex:1,textAlign:"center",fontSize:10,color:"#555570",fontWeight:600}}>משקל</div>
                <div style={{flex:1,textAlign:"center",fontSize:10,color:"#555570",fontWeight:600}}>חזרות</div>
                <div style={{flex:1,textAlign:"center",fontSize:10,color:"#555570",fontWeight:600}}>הושלם</div>
              </div>
              {s.sets.map((st,i)=>(
                <div key={i} className="set-row">
                  <div style={{width:36,height:32,borderRadius:8,flexShrink:0,background:st.done?"linear-gradient(135deg,#22c55e,#16a34a)":"rgba(255,80,80,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:st.done?"#fff":"#ff5555"}}>{st.setNum}</div>
                  <div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:st.weight?"#e8e8f0":"#444460"}}>{st.weight||"—"}</div>
                  <div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:st.reps?"#e8e8f0":"#444460"}}>{st.reps||"—"}</div>
                  <div style={{flex:1,textAlign:"center",fontSize:12,fontWeight:600,color:st.done?"#4ade80":"#ff5555"}}>{st.done?"✓":"✕"}</div>
                </div>
              ))}
              {si<visible.length-1&&<div style={{height:1,background:"rgba(255,255,255,.06)",margin:"14px 0 0"}}/>}
            </div>
          ))}
          {hasMore&&<button onClick={()=>setShowAll(o=>!o)} style={{width:"100%",marginTop:12,padding:"7px 0",background:"rgba(108,63,255,.08)",border:"1px solid rgba(108,63,255,.2)",borderRadius:8,color:"#a855f7",fontFamily:"'Rubik',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {showAll?`▲ הצג פחות`:`▼ הצג עוד ${sessions.length-3} אימונים`}
          </button>}
        </div>
      )}
    </div>
  );
}

function ExGraphButton({ id, name, firstExId, getExHistory }) {
  const [open, setOpen] = useState(false);
  const data = getExHistory(id);
  const hasW = data.some(d=>d.maxWeight>0), hasR = data.some(d=>d.avgReps>0);

  function LineChart({ values, color, unit }) {
    if(values.length<1) return null;
    const max=Math.max(...values.map(d=>d.v),1);
    const min=Math.min(...values.map(d=>d.v).filter(v=>v>0), max);
    const range=max-min||1;
    const W=300, H=80, pad=8;
    const pts=values.map((d,i)=>{
      const x=values.length===1?W/2:pad+(i/(values.length-1))*(W-pad*2);
      const y=d.v>0?H-pad-((d.v-min)/range)*(H-pad*2):H-pad;
      return{x,y,v:d.v,date:d.date};
    });
    const path=pts.filter(p=>p.v>0).map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
    const last=pts[pts.length-1];
    const first=pts.find(p=>p.v>0);
    const diff=last&&first&&last.v>0?last.v-first.v:0;
    return (
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:"#9999bb",fontWeight:600,marginBottom:8}}>
          {unit==='ק"ג'?'💪 משקל מקסימלי':'🔁 ממוצע חזרות'} ({unit})
        </div>
        <div style={{position:"relative",overflowX:"auto"}}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block"}}>
            {/* Grid lines */}
            {[0,0.25,0.5,0.75,1].map((t,i)=>(
              <line key={i} x1={pad} y1={pad+(t*(H-pad*2))} x2={W-pad} y2={pad+(t*(H-pad*2))}
                stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
            ))}
            {/* Fill under line */}
            {pts.filter(p=>p.v>0).length>1&&<path
              d={`${path} L${pts.filter(p=>p.v>0).at(-1).x},${H-pad} L${pts.find(p=>p.v>0).x},${H-pad} Z`}
              fill={color==="purple"?"rgba(108,63,255,.15)":"rgba(34,197,94,.1)"}/>}
            {/* Line */}
            {pts.filter(p=>p.v>0).length>1&&<path d={path} fill="none"
              stroke={color==="purple"?"#a855f7":"#4ade80"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
            {/* Dots + values */}
            {pts.filter(p=>p.v>0).map((p,i)=>(
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="4" fill={color==="purple"?"#a855f7":"#4ade80"}/>
                <text x={p.x} y={p.y-8} textAnchor="middle" fontSize="9"
                  fill={color==="purple"?"#c084fc":"#86efac"} fontFamily="Rubik,sans-serif" fontWeight="700">
                  {p.v}
                </text>
              </g>
            ))}
          </svg>
          {/* X axis dates */}
          <div style={{display:"flex",justifyContent:"space-between",padding:`0 ${pad}px`,marginTop:2}}>
            {pts.map((d,i)=><div key={i} style={{fontSize:9,color:"#555570",textAlign:"center",flex:1,overflow:"hidden"}}>{d.date}</div>)}
          </div>
        </div>
        {/* Stats row */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
          <div style={{background:color==="purple"?"rgba(108,63,255,.1)":"rgba(34,197,94,.08)",borderRadius:8,padding:"4px 10px",fontSize:11}}>
            <span style={{color:"#666688"}}>מקס׳: </span>
            <span style={{color:color==="purple"?"#a855f7":"#4ade80",fontWeight:700}}>{Math.max(...values.map(d=>d.v))} {unit}</span>
          </div>
          <div style={{background:color==="purple"?"rgba(108,63,255,.1)":"rgba(34,197,94,.08)",borderRadius:8,padding:"4px 10px",fontSize:11}}>
            <span style={{color:"#666688"}}>אחרון: </span>
            <span style={{color:color==="purple"?"#a855f7":"#4ade80",fontWeight:700}}>{last?.v||0} {unit}</span>
          </div>
          {diff!==0&&<div style={{background:diff>0?"rgba(34,197,94,.08)":"rgba(255,80,80,.08)",borderRadius:8,padding:"4px 10px",fontSize:11}}>
            <span style={{color:diff>0?"#4ade80":"#ff5555",fontWeight:700}}>{diff>0?"📈 +":"📉 "}{diff} {unit}</span>
          </div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{width:"100%",marginBottom:8}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",textAlign:"right",padding:"10px 14px",background:open?"rgba(108,63,255,.15)":"rgba(255,255,255,.05)",border:open?"1px solid rgba(108,63,255,.4)":"1px solid rgba(255,255,255,.1)",borderRadius:open?"12px 12px 0 0":12,color:"#e8e8f0",fontFamily:"'Rubik',sans-serif",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{name}</span><span style={{fontSize:11,color:"#666688"}}>{data.length} אימונים {open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(108,63,255,.2)",borderTop:"none",borderRadius:"0 0 12px 12px",padding:"16px 14px"}}>
          {data.length===0
            ? <p style={{color:"#555570",fontSize:13,textAlign:"center"}}>אין נתונים עדיין</p>
            : <>
                {hasW&&<LineChart values={data.map(d=>({v:d.maxWeight,date:d.date}))} color="purple" unit='ק"ג'/>}
                {hasR&&<LineChart values={data.map(d=>({v:d.avgReps,date:d.date}))} color="green" unit="חז׳"/>}
                {!hasW&&!hasR&&<p style={{color:"#555570",fontSize:13,textAlign:"center"}}>לא הוזנו משקלים או חזרות</p>}
              </>
          }
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LIBRARY SUB-COMPONENTS (outside App so tabs don't remount)
// ══════════════════════════════════════════════════════════════════════════════

function LibExercises({ library, setLibrary, askConfirm, setView, editingExId, setEditingExId, quickPick=false, onQuickPick, setYtModal }) {
  const groups = {};
  library.exercises.forEach(ex => { const g=ex.muscleGroup||"ללא קטגוריה"; if(!groups[g])groups[g]=[]; groups[g].push(ex); });

  return (
    <div>
      <button className="btn-p" style={{width:"100%",marginBottom:16,fontSize:13}} onClick={()=>setView("addExercise")}>+ הוסף תרגיל למאגר</button>
      {library.exercises.length===0
        ? <div className="card" style={{textAlign:"center",color:"#555570",padding:32}}><div style={{fontSize:36,marginBottom:10}}>🔧</div><p>אין תרגילים עדיין</p></div>
        : Object.entries(groups).sort((a,b)=>muscleRank(a[0])-muscleRank(b[0])).map(([group,exs])=>(
          <div key={group} style={{marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{height:1,flex:1,background:"rgba(108,63,255,.2)"}}/>
              <span style={{fontSize:12,fontWeight:700,color:"#a855f7",background:"rgba(108,63,255,.1)",border:"1px solid rgba(108,63,255,.25)",borderRadius:8,padding:"3px 14px"}}>{group} ({exs.length})</span>
              <div style={{height:1,flex:1,background:"rgba(108,63,255,.2)"}}/>
            </div>
            {exs.map((ex,i)=>(
              <div key={ex.id} className="card up" style={{marginBottom:8,animationDelay:`${i*.04}s`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:editingExId===ex.id?12:0}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{ex.name}</div>
                    <div style={{fontSize:12,color:"#666688",marginTop:2,display:"flex",gap:8}}>
                      <span>{ex.sets} סטים · {ex.targetReps} חזרות</span>
                      {isYT(ex.youtubeUrl)&&<span style={{color:"#ff5555",cursor:"pointer"}} onClick={()=>setYtModal({url:ex.youtubeUrl,title:ex.name})}>▶ YouTube</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {quickPick && <button className="btn-p" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>onQuickPick(ex)}>+ בחר</button>}
                    <button className="btn-g" style={{fontSize:11,padding:"5px 9px"}} onClick={()=>setEditingExId(editingExId===ex.id?null:ex.id)}>{editingExId===ex.id?"✕":"✏️"}</button>
                    <button className="btn-d" style={{fontSize:11,padding:"5px 8px"}} onClick={()=>askConfirm("למחוק תרגיל?",()=>{setLibrary(p=>({...p,exercises:p.exercises.filter(e=>e.id!==ex.id)}));setEditingExId(null);})}>🗑</button>
                  </div>
                </div>
                {editingExId===ex.id && <ExerciseForm ex={ex} onSave={updated=>{setLibrary(p=>({...p,exercises:p.exercises.map(e=>e.id===ex.id?{...e,...updated}:e)}));setEditingExId(null);}} onCancel={()=>setEditingExId(null)}/>}
              </div>
            ))}
          </div>
        ))
      }
      {library.exercises.length>0 && <button className="btn-p" style={{width:"100%",marginTop:4,fontSize:13}} onClick={()=>setView("addExercise")}>+ הוסף תרגיל למאגר</button>}
    </div>
  );
}


// ─── ExerciseBrowser — grouped by muscle, used everywhere ────────────────────
function ExerciseBrowser({ exercises, selected, onToggle }) {
  const [activeGroup, setActiveGroup] = useState("");
  const groups = {};
  exercises.forEach(ex => { const g=ex.muscleGroup||"ללא קטגוריה"; if(!groups[g])groups[g]=[]; groups[g].push(ex); });
  const groupNames = Object.keys(groups).sort((a,b)=>muscleRank(a)-muscleRank(b));
  const shown = activeGroup ? (groups[activeGroup]||[]) : exercises;
  const isSelected = id => selected.some(s=>s.id===id);
  return (
    <div>
      {/* Group filter */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
        <button onClick={()=>setActiveGroup("")} style={{padding:"4px 10px",borderRadius:7,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Rubik',sans-serif",
          background:activeGroup===""?"linear-gradient(135deg,#6c3fff,#a855f7)":"rgba(255,255,255,.05)",
          borderColor:activeGroup===""?"#a855f7":"rgba(255,255,255,.12)",color:activeGroup===""?"#fff":"#9999bb"}}>הכל</button>
        {groupNames.map(g=><button key={g} onClick={()=>setActiveGroup(a=>a===g?"":g)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Rubik',sans-serif",
          background:activeGroup===g?"linear-gradient(135deg,#6c3fff,#a855f7)":"rgba(255,255,255,.05)",
          borderColor:activeGroup===g?"#a855f7":"rgba(255,255,255,.12)",color:activeGroup===g?"#fff":"#9999bb"}}>{g}</button>)}
      </div>
      {/* Grouped list */}
      <div style={{maxHeight:220,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
        {activeGroup
          ? (groups[activeGroup]||[]).map(ex=>{const sel=isSelected(ex.id);return(
              <div key={ex.id} onClick={()=>onToggle(ex)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:sel?"rgba(108,63,255,.12)":"rgba(255,255,255,.03)",borderRadius:9,cursor:"pointer",border:`1px solid ${sel?"rgba(108,63,255,.4)":"rgba(255,255,255,.07)"}`,transition:"all .15s"}}>
                <span style={{fontSize:13,fontWeight:sel?700:500}}>{ex.name}</span>
                <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${sel?"#a855f7":"rgba(255,255,255,.2)"}`,background:sel?"linear-gradient(135deg,#6c3fff,#a855f7)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {sel&&<span style={{color:"#fff",fontSize:13,fontWeight:700}}>✓</span>}
                </div>
              </div>);})
          : groupNames.map(g=>(
            <div key={g}>
              <div style={{fontSize:11,fontWeight:700,color:"#a855f7",padding:"6px 4px 4px",marginTop:4}}>{g}</div>
              {groups[g].map(ex=>{const sel=isSelected(ex.id);return(
                <div key={ex.id} onClick={()=>onToggle(ex)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:sel?"rgba(108,63,255,.12)":"rgba(255,255,255,.03)",borderRadius:9,cursor:"pointer",border:`1px solid ${sel?"rgba(108,63,255,.4)":"rgba(255,255,255,.07)"}`,marginBottom:2,transition:"all .15s"}}>
                  <span style={{fontSize:13,fontWeight:sel?700:500}}>{ex.name}<span style={{fontSize:11,color:"#666688",marginRight:6}}> · {ex.sets}×{ex.targetReps}</span></span>
                  <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${sel?"#a855f7":"rgba(255,255,255,.2)"}`,background:sel?"linear-gradient(135deg,#6c3fff,#a855f7)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {sel&&<span style={{color:"#fff",fontSize:13,fontWeight:700}}>✓</span>}
                  </div>
                </div>);})}
            </div>))
        }
      </div>
    </div>
  );
}

function LibWorkouts({ library, setLibrary, askConfirm, setView, quickPick=false, onQuickPick, setYtModal }) {
  const [creating, setCreating] = useState(false);
  const [wName, setWName] = useState("");
  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editSelected, setEditSelected] = useState([]);

  // Sort exercises by muscle group alphabetically
  function sortByMuscle(exs) {
    return [...exs].sort((a,b)=>muscleRank(a.muscleGroup||"ללא קטגוריה")-muscleRank(b.muscleGroup||"ללא קטגוריה"));
  }

  function save() {
    if (!wName.trim()) { alert("תן שם לאימון"); return; }
    setLibrary(p=>({...p,workouts:[...p.workouts,{id:Date.now(),name:wName.trim(),exercises:selected,savedAt:new Date().toLocaleDateString("he-IL")}]}));
    setWName(""); setSelected([]); setCreating(false);
  }

  function startEdit(w) {
    setEditingId(w.id); setEditName(w.name); setEditSelected(w.exercises||[]);
  }

  function saveEdit() {
    if (!editName.trim()) { alert("תן שם לאימון"); return; }
    setLibrary(p=>({...p,workouts:p.workouts.map(w=>w.id===editingId?{...w,name:editName.trim(),exercises:editSelected}:w)}));
    setEditingId(null);
  }

  return (
    <div>
      {!creating && <button className="btn-p" style={{width:"100%",marginBottom:14,fontSize:13}} onClick={()=>setCreating(true)}>+ צור אימון חדש</button>}
      {creating && (
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontWeight:700,fontSize:15}}>אימון חדש</span>
            <button className="btn-g" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>{setCreating(false);setWName("");setSelected([]);}}>✕ ביטול</button>
          </div>
          <input className="inp" style={{marginBottom:12}} placeholder="שם האימון..." value={wName} onChange={e=>setWName(e.target.value)}/>
          {selected.length>0 && <div style={{background:"rgba(108,63,255,.07)",borderRadius:10,padding:"8px 10px",marginBottom:10}}>
            <p style={{fontSize:12,color:"#a855f7",marginBottom:6,fontWeight:600}}>נבחרו ({selected.length}):</p>
            {selected.map((ex,i)=>(
              <div key={ex.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 6px",marginBottom:2}}>
                <span style={{fontSize:13}}>{ex.name}</span>
                <button style={{background:"none",border:"none",color:"#ff5555",cursor:"pointer",fontSize:16}} onClick={()=>setSelected(p=>p.filter(s=>s.id!==ex.id))}>✕</button>
              </div>
            ))}
          </div>}
          {library.exercises.length===0
            ? <p style={{fontSize:12,color:"#555570",textAlign:"center",padding:12}}>אין תרגילים במאגר — <span style={{color:"#a855f7",cursor:"pointer"}} onClick={()=>setView("addExercise")}>הוסף תחילה</span></p>
            : <ExerciseBrowser exercises={library.exercises.filter(e=>!selected.find(s=>s.id===e.id))} selected={selected} onToggle={ex=>setSelected(p=>p.find(s=>s.id===ex.id)?p.filter(s=>s.id!==ex.id):[...p,ex])}/>
          }
          <button className="btn-p" style={{width:"100%",marginTop:12,padding:11}} onClick={save}>💾 שמור אימון</button>
        </div>
      )}

      {library.workouts.length===0
        ? <div className="card" style={{textAlign:"center",color:"#555570",padding:28}}><div style={{fontSize:32,marginBottom:8}}>💪</div><p>אין אימונים שמורים</p></div>
        : library.workouts.map((w,i)=>(
          <div key={w.id} className="card up" style={{marginBottom:10,animationDelay:`${i*.04}s`}}>
            {editingId===w.id ? (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontWeight:700,fontSize:15}}>עריכת אימון</span>
                  <button className="btn-g" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setEditingId(null)}>✕ ביטול</button>
                </div>
                <input className="inp" style={{marginBottom:12}} value={editName} onChange={e=>setEditName(e.target.value)}/>
                {editSelected.length>0 && <div style={{background:"rgba(108,63,255,.07)",borderRadius:10,padding:"8px 10px",marginBottom:10}}>
                  <p style={{fontSize:12,color:"#a855f7",marginBottom:6,fontWeight:600}}>נבחרו ({editSelected.length}):</p>
                  {editSelected.map((ex,ei)=>(
                    <div key={ex.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 6px",marginBottom:2}}>
                      <span style={{fontSize:13}}>{ex.name}</span>
                      <button style={{background:"none",border:"none",color:"#ff5555",cursor:"pointer",fontSize:16}} onClick={()=>setEditSelected(p=>p.filter(s=>s.id!==ex.id))}>✕</button>
                    </div>
                  ))}
                </div>}
                <ExerciseBrowser exercises={library.exercises.filter(e=>!editSelected.find(s=>s.id===e.id))} selected={editSelected} onToggle={ex=>setEditSelected(p=>p.find(s=>s.id===ex.id)?p.filter(s=>s.id!==ex.id):[...p,ex])}/>
                <button className="btn-p" style={{width:"100%",marginTop:10,padding:10}} onClick={saveEdit}>💾 שמור שינויים</button>
              </div>
            ) : (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15}}>{w.name}</div>
                    <div style={{color:"#666688",fontSize:12,marginTop:2}}>{w.exercises?.length||0} תרגילים · {w.savedAt}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn-g" style={{fontSize:11,padding:"5px 9px"}} onClick={()=>startEdit(w)}>✏️</button>
                    <button className="btn-d" style={{fontSize:11,padding:"5px 8px"}} onClick={()=>askConfirm("למחוק אימון?",()=>setLibrary(p=>({...p,workouts:p.workouts.filter(x=>x.id!==w.id)})))}>🗑</button>
                    {quickPick && <button className="btn-p" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>onQuickPick(w)}>+ בחר</button>}
                  </div>
                </div>
                {/* Full exercise list */}
                {(w.exercises||[]).length>0 && (
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {(w.exercises||[]).map((ex,ei)=>(
                      <div key={ei} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:"rgba(255,255,255,.03)",borderRadius:8}}>
                        <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
                          <button onClick={()=>{
                            if(ei===0) return;
                            const exs=[...(w.exercises||[])];
                            [exs[ei-1],exs[ei]]=[exs[ei],exs[ei-1]];
                            setLibrary(p=>({...p,workouts:p.workouts.map(x=>x.id===w.id?{...x,exercises:exs}:x)}));
                          }} style={{background:"none",border:"none",color:ei===0?"#333355":"#a855f7",cursor:ei===0?"default":"pointer",fontSize:12,padding:"0 2px",lineHeight:1,fontFamily:"'Rubik',sans-serif"}}>▲</button>
                          <button onClick={()=>{
                            if(ei===(w.exercises||[]).length-1) return;
                            const exs=[...(w.exercises||[])];
                            [exs[ei+1],exs[ei]]=[exs[ei],exs[ei+1]];
                            setLibrary(p=>({...p,workouts:p.workouts.map(x=>x.id===w.id?{...x,exercises:exs}:x)}));
                          }} style={{background:"none",border:"none",color:ei===(w.exercises||[]).length-1?"#333355":"#a855f7",cursor:ei===(w.exercises||[]).length-1?"default":"pointer",fontSize:12,padding:"0 2px",lineHeight:1,fontFamily:"'Rubik',sans-serif"}}>▼</button>
                        </div>
                        <div style={{width:20,height:20,borderRadius:6,background:"rgba(108,63,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#a855f7",flexShrink:0}}>{ei+1}</div>
                        <div style={{flex:1}}>
                          <span style={{fontSize:13,fontWeight:600}}>{ex.name}</span>
                          {ex.muscleGroup&&<span style={{fontSize:11,color:"#a855f7",marginRight:6}}> · {ex.muscleGroup}</span>}
                        </div>
                        {isYT(ex.youtubeUrl)&&<button onClick={()=>setYtModal({url:ex.youtubeUrl,title:ex.name})} style={{background:"rgba(255,0,0,.15)",border:"1px solid rgba(255,0,0,.3)",borderRadius:6,width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,padding:0}}>▶</button>}
                        <span style={{fontSize:11,color:"#666688"}}>{ex.sets}×{ex.targetReps}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      }
    </div>
  );
}

function LibPlans({ library, setLibrary, askConfirm, clients=[], selectedClient, setSelClient, setActivePlan, onApplied }) {
  const [creating, setCreating] = useState(false);
  const [pName, setPName] = useState("");
  const [pWeek, setPWeek] = useState(3);
  const [pDays, setPDays] = useState({});
  const [editPlanId, setEditPlanId] = useState(null);
  const [editPlanName, setEditPlanName] = useState("");
  const [editPlanWeek, setEditPlanWeek] = useState(3);
  const [editPlanDays, setEditPlanDays] = useState({});
  const [assignPlan, setAssignPlan] = useState(null); // plan waiting for client selection

  function save() {
    if (!pName.trim()) { alert("תן שם לתכנית"); return; }
    const assignedCount = Array.from({length:pWeek},(_,i)=>pDays[i]).filter(Boolean).length;
    if (assignedCount < pWeek) { alert(`חסרים אימונים — שובצו ${assignedCount} מתוך ${pWeek}`); return; }
    const days={};
    Object.entries(pDays).forEach(([i,w])=>{ if(w) { const fresh=library.workouts.find(x=>x.id===w.id)||w; days[i]={exercises:(fresh.exercises||[]).map(e=>({...e,id:Date.now()+Math.random(),weights:{},reps:{}}))}; } });
    const plan={id:Date.now(),savedAt:new Date().toLocaleDateString("he-IL"),name:pName,workoutsPerWeek:pWeek,
      dayNames:Object.fromEntries(Array.from({length:pWeek},(_,i)=>[i,pDays[i]?.name||`אימון ${i+1}`])),days};
    setLibrary(p=>({...p,plans:[...p.plans,plan]}));
    setPName(""); setPDays({}); setPWeek(3); setCreating(false);
  }

  return (
    <>
    <div>
      {!creating && <button className="btn-p" style={{width:"100%",marginBottom:14,fontSize:13}} onClick={()=>setCreating(true)}>+ צור תכנית חדשה</button>}
      {creating && (
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontWeight:700,fontSize:15}}>תכנית חדשה</span>
            <button className="btn-g" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>{setCreating(false);setPName("");setPDays({});setPWeek(3);}}>✕ ביטול</button>
          </div>
          <input className="inp" style={{marginBottom:12}} placeholder="שם התכנית..." value={pName} onChange={e=>setPName(e.target.value)}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:13,color:"#9999bb"}}>אימונים בשבוע</span>
            <Stepper value={pWeek} min={1} max={7} onChange={setPWeek}/>
          </div>
          {Array.from({length:pWeek},(_,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{width:26,height:26,borderRadius:7,background:"rgba(108,63,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#a855f7",flexShrink:0}}>{i+1}</div>
              <select style={{flex:1,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:8,color:"#e8e8f0",padding:"6px 8px",fontSize:12,fontFamily:"'Rubik',sans-serif"}}
                value={pDays[i]?.id||""} onChange={e=>{const w=library.workouts.find(w=>String(w.id)===e.target.value);setPDays(p=>({...p,[i]:w||undefined}));}}>
                <option value="">בחר אימון...</option>
                {library.workouts.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {pDays[i]&&<button className="btn-d" style={{fontSize:10,padding:"4px 7px"}} onClick={()=>setPDays(p=>{const d={...p};delete d[i];return d;})}>✕</button>}
            </div>
          ))}
          {library.workouts.length===0&&<p style={{fontSize:12,color:"#555570",textAlign:"center",marginTop:8}}>צור אימונים קודם</p>}
          <button className="btn-p" style={{width:"100%",marginTop:12,padding:11}} onClick={save}>💾 שמור תכנית</button>
        </div>
      )}
      {library.plans.length===0
        ? <div className="card" style={{textAlign:"center",color:"#555570",padding:28}}><div style={{fontSize:32,marginBottom:8}}>📋</div><p>אין תכניות שמורות</p></div>
        : library.plans.map((plan,i)=>(
          <div key={plan.id} className="card up" style={{marginBottom:10,animationDelay:`${i*.04}s`}}>
            {editPlanId===plan.id ? (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontWeight:700,fontSize:15}}>עריכת תכנית</span>
                  <button className="btn-g" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setEditPlanId(null)}>✕ ביטול</button>
                </div>
                <input className="inp" style={{marginBottom:12}} value={editPlanName} onChange={e=>setEditPlanName(e.target.value)}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <span style={{fontSize:13,color:"#9999bb"}}>אימונים בשבוע</span>
                  <Stepper value={editPlanWeek} min={1} max={7} onChange={setEditPlanWeek}/>
                </div>
                {Array.from({length:editPlanWeek},(_,di)=>(
                  <div key={di} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <div style={{width:24,height:24,borderRadius:6,background:"rgba(108,63,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#a855f7",flexShrink:0}}>{di+1}</div>
                    <select style={{flex:1,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:8,color:"#e8e8f0",padding:"6px 8px",fontSize:12,fontFamily:"'Rubik',sans-serif"}}
                      value={editPlanDays[di]?.id||""} onChange={e=>{const w=library.workouts.find(w=>String(w.id)===e.target.value);setEditPlanDays(p=>({...p,[di]:w||undefined}));}}>
                      <option value="">בחר אימון...</option>
                      {library.workouts.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    {editPlanDays[di]&&<button className="btn-d" style={{fontSize:10,padding:"4px 7px"}} onClick={()=>setEditPlanDays(p=>{const d={...p};delete d[di];return d;})}>✕</button>}
                  </div>
                ))}
                <button className="btn-p" style={{width:"100%",marginTop:10,padding:10}} onClick={()=>{
                  if(!editPlanName.trim()){alert("תן שם לתכנית");return;}
                  const assignedCount=Array.from({length:editPlanWeek},(_,i)=>editPlanDays[i]).filter(Boolean).length;
                  if(assignedCount<editPlanWeek){alert(`חסרים אימונים — שובצו ${assignedCount} מתוך ${editPlanWeek}`);return;}
                  const days={};
                  Object.entries(editPlanDays).forEach(([i,w])=>{if(w){const fresh=library.workouts.find(x=>x.id===w.id)||w;days[i]={exercises:(fresh.exercises||[]).map(e=>({...e,id:Date.now()+Math.random(),weights:{},reps:{}}))};} });
                  setLibrary(p=>({...p,plans:p.plans.map(pl=>pl.id===plan.id?{...pl,name:editPlanName,workoutsPerWeek:editPlanWeek,
                    dayNames:Object.fromEntries(Array.from({length:editPlanWeek},(_,i)=>[i,editPlanDays[i]?.name||`אימון ${i+1}`])),days}:pl)}));
                  setEditPlanId(null);
                }}>💾 שמור שינויים</button>
              </div>
            ) : (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15}}>{plan.name}</div>
                  <div style={{color:"#666688",fontSize:12,marginTop:3}}>{plan.workoutsPerWeek} אימונים · {plan.savedAt}</div>
                </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  <button className="btn-p" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>setAssignPlan(plan)}>שבץ</button>
                  <button className="btn-g" style={{fontSize:11,padding:"5px 9px"}} onClick={()=>{setEditPlanId(plan.id);setEditPlanName(plan.name);setEditPlanWeek(plan.workoutsPerWeek);
                    const d={};Object.entries(plan.days||{}).forEach(([i,day])=>{if(day?.exercises?.length){const wId=library.workouts.find(w=>w.exercises?.[0]?.name===day.exercises[0]?.name)?.id;if(wId)d[i]=library.workouts.find(w=>w.id===wId);}});setEditPlanDays(d);}}>✏️</button>
                  <button className="btn-d" style={{fontSize:11,padding:"5px 8px"}} onClick={()=>askConfirm("למחוק תכנית?",()=>setLibrary(p=>({...p,plans:p.plans.filter(x=>x.id!==plan.id)})))}>🗑</button>
                </div>
              </div>
            )}
          </div>
        ))
      }
    </div>

    {/* Client selector modal */}
    {assignPlan && (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:20}} onClick={()=>setAssignPlan(null)}>
        <div style={{background:"#1a1a2a",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,padding:24,width:"100%",maxWidth:320,direction:"rtl"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{fontSize:16,fontWeight:800}}>שבץ תכנית למתאמן</h3>
            <button onClick={()=>setAssignPlan(null)} style={{background:"rgba(255,255,255,.08)",border:"none",color:"#e8e8f0",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:14}}>✕</button>
          </div>
          <p style={{fontSize:13,color:"#a855f7",fontWeight:600,marginBottom:14}}>{assignPlan.name}</p>
          {clients.length===0
            ? <p style={{color:"#555570",fontSize:13,textAlign:"center"}}>אין מתאמנים — הוסף מתאמן קודם</p>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {clients.map(c=>(
                  <button key={c.id} onClick={()=>{
                    setSelClient(c.id);
                    setActivePlan({...assignPlan,id:undefined,savedAt:undefined});
                    setAssignPlan(null);
                    onApplied();
                  }} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(108,63,255,.2)",borderRadius:12,cursor:"pointer",fontFamily:"'Rubik',sans-serif",transition:"all .15s",width:"100%",textAlign:"right"}}>
                    <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#6c3fff,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>{c.name[0]}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14,color:"#e8e8f0"}}>{c.name}</div>
                      <div style={{fontSize:11,color:"#666688",marginTop:2}}>{c.plan?.workoutsPerWeek||0} אימונים בשבוע</div>
                    </div>
                    <span style={{color:"#a855f7",fontSize:18}}>←</span>
                  </button>
                ))}
              </div>
          }
        </div>
      </div>
    )}
    </>
  );
}
function ExerciseForm({ ex, onSave, onCancel }) {
  const [name, setName]         = useState(ex?.name||"");
  const [mg, setMg]             = useState(ex?.muscleGroup||"");
  const [desc, setDesc]         = useState(ex?.description||"");
  const [sets, setSets]         = useState(ex?.sets||3);
  const [reps, setReps]         = useState(ex?.targetReps||12);
  const [yt, setYt]             = useState(ex?.youtubeUrl||"");

  return (
    <div style={{borderTop:ex?"1px solid rgba(255,255,255,.07)":undefined,paddingTop:ex?12:0}}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div><p style={{fontSize:12,color:"#9999bb",marginBottom:5,fontWeight:600}}>שם התרגיל *</p>
          <input className="inp" value={name} placeholder="לדוג׳: לחיצת חזה" onChange={e=>setName(e.target.value)}/></div>
        <div><p style={{fontSize:12,color:"#9999bb",marginBottom:5,fontWeight:600}}>קבוצת שריר</p>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {MUSCLE_GROUPS.map(m=><button key={m} onClick={()=>setMg(p=>p===m?"":m)}
              style={{padding:"4px 10px",borderRadius:7,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Rubik',sans-serif",
                background:mg===m?"linear-gradient(135deg,#6c3fff,#a855f7)":"rgba(255,255,255,.05)",
                borderColor:mg===m?"#a855f7":"rgba(255,255,255,.12)",color:mg===m?"#fff":"#9999bb"}}>{m}</button>)}
          </div>
        </div>
        <div><p style={{fontSize:12,color:"#9999bb",marginBottom:5,fontWeight:600}}>הסבר קצר</p>
          <textarea className="inp" rows={2} style={{resize:"none"}} placeholder="תיאור קצר..." value={desc} onChange={e=>setDesc(e.target.value)}/></div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}><p style={{fontSize:12,color:"#9999bb",marginBottom:5,fontWeight:600}}>סטים</p><Stepper value={sets} onChange={setSets}/></div>
          <div style={{flex:1}}><p style={{fontSize:12,color:"#9999bb",marginBottom:5,fontWeight:600}}>חזרות</p><Stepper value={reps} min={1} max={100} onChange={setReps}/></div>
        </div>
        <div><p style={{fontSize:12,color:"#9999bb",marginBottom:5,fontWeight:600}}>קישור YouTube</p>
          <input className="inp" dir="ltr" style={{textAlign:"left"}} placeholder="https://youtube.com/..." value={yt} onChange={e=>setYt(e.target.value)}/></div>
        {isYT(yt)&&getYTThumb(yt)&&<img src={getYTThumb(yt)} style={{width:"100%",borderRadius:8,opacity:.85}} alt=""/>}
        <div style={{display:"flex",gap:8}}>
          <button className="btn-p" style={{flex:1,padding:"9px 0",fontSize:13}} onClick={()=>{if(!name.trim())return;onSave({name,muscleGroup:mg,description:desc,sets,targetReps:reps,youtubeUrl:yt});}}>💾 שמור</button>
          {onCancel&&<button className="btn-g" style={{padding:"9px 14px",fontSize:13}} onClick={onCancel}>ביטול</button>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXERCISE PICKER — multi-select from library
// ══════════════════════════════════════════════════════════════════════════════
function ExercisePicker({ library, alreadyAdded=[], inPlan=[], onAdd, onClose, onGoToLib }) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState([]);
  const [activeGroup, setActiveGroup] = useState("");

  const groups = {};
  library.exercises.forEach(ex=>{ const g=ex.muscleGroup||"ללא קטגוריה"; if(!groups[g])groups[g]=[]; groups[g].push(ex); });

  const filtered = library.exercises.filter(e =>
    !alreadyAdded.includes(e.id) &&
    (!activeGroup || e.muscleGroup===activeGroup) &&
    (!filter || e.name.includes(filter) || e.muscleGroup?.includes(filter))
  );

  const toggle = (ex) => setSelected(p => p.find(s=>s.id===ex.id) ? p.filter(s=>s.id!==ex.id) : [...p,ex]);
  const isSelected = (id) => selected.some(s=>s.id===id);

  function addAll() { if(selected.length>0) { onAdd(selected); onClose(); } }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:999}} onClick={onClose}>
      <div style={{background:"#12121e",borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto",direction:"rtl"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontSize:17,fontWeight:800}}>📚 בחר תרגילים</h3>
          <button className="btn-g" style={{padding:"5px 12px",fontSize:12}} onClick={onClose}>✕</button>
        </div>

        <input className="inp" style={{marginBottom:10}} placeholder="חפש תרגיל..." value={filter} onChange={e=>setFilter(e.target.value)}/>

        {/* Group filter */}
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
          <button onClick={()=>setActiveGroup("")} style={{padding:"4px 10px",borderRadius:7,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Rubik',sans-serif",background:activeGroup===""?"linear-gradient(135deg,#6c3fff,#a855f7)":"rgba(255,255,255,.05)",borderColor:activeGroup===""?"#a855f7":"rgba(255,255,255,.12)",color:activeGroup===""?"#fff":"#9999bb"}}>הכל</button>
          {Object.keys(groups).map(g=><button key={g} onClick={()=>setActiveGroup(g===activeGroup?"":g)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Rubik',sans-serif",background:activeGroup===g?"linear-gradient(135deg,#6c3fff,#a855f7)":"rgba(255,255,255,.05)",borderColor:activeGroup===g?"#a855f7":"rgba(255,255,255,.12)",color:activeGroup===g?"#fff":"#9999bb"}}>{g}</button>)}
        </div>

        {/* Exercise list */}
        {library.exercises.length===0
          ? <div style={{textAlign:"center",color:"#555570",padding:24}}>
              <p>המאגר ריק</p>
              <button className="btn-p" style={{marginTop:12,fontSize:13}} onClick={()=>{onClose();onGoToLib();}}>+ הוסף תרגיל למאגר</button>
            </div>
          : filtered.length===0
            ? <p style={{color:"#555570",textAlign:"center",padding:16}}>לא נמצאו תרגילים</p>
            : filtered.map(ex=>{
                const sel = isSelected(ex.id);
                const alreadyInPlan = inPlan.includes(ex.id);
                return (
                  <div key={ex.id} onClick={()=>toggle(ex)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:sel?"rgba(108,63,255,.12)":"rgba(255,255,255,.03)",borderRadius:12,cursor:"pointer",border:`1px solid ${sel?"rgba(108,63,255,.4)":"rgba(255,255,255,.07)"}`,marginBottom:6,transition:"all .15s"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontWeight:700,fontSize:14}}>{ex.name}</span>
                        {isYT(ex.youtubeUrl)&&<span style={{fontSize:9,color:"#ff4444",background:"rgba(255,0,0,.15)",border:"1px solid rgba(255,0,0,.3)",borderRadius:5,padding:"1px 5px",fontWeight:700}}>▶</span>}
                        {alreadyInPlan&&<span style={{fontSize:11,color:"#4ade80",background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.3)",borderRadius:6,padding:"1px 7px",fontWeight:600}}>✓ בתכנית</span>}
                      </div>
                      <div style={{fontSize:11,color:"#666688",marginTop:2}}>{ex.muscleGroup&&<span style={{color:"#a855f7"}}>{ex.muscleGroup} · </span>}{ex.sets} סטים · {ex.targetReps} חזרות</div>
                    </div>
                    <div style={{width:26,height:26,borderRadius:8,border:`2px solid ${sel?"#a855f7":"rgba(255,255,255,.2)"}`,background:sel?"linear-gradient(135deg,#6c3fff,#a855f7)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                      {sel&&<span style={{color:"#fff",fontSize:14,fontWeight:700}}>✓</span>}
                    </div>
                  </div>
                );
              })
        }

        {/* Add button */}
        {selected.length>0 && (
          <div style={{position:"sticky",bottom:0,paddingTop:12,background:"#12121e"}}>
            <button className="btn-p" style={{width:"100%",padding:13,fontSize:15}} onClick={addAll}>
              + הוסף {selected.length} תרגיל{selected.length>1?"ים":""} לאימון
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Preview modal — shown when tapping a day
function PreviewModal({ plan, dayIdx, getDayName, onClose, onStart, isTrainer, onYt, getLastPerf, onShowHistory }) {
  const exs = [...(plan.days[dayIdx]?.exercises||[])];
  const scrollRef = useRef(null);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.78)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:999}} onClick={onClose}>
      <div ref={scrollRef} style={{background:"#12121e",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480,maxHeight:"82vh",overflowY:"auto",direction:"rtl"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><h3 style={{fontSize:17,fontWeight:800}}>{getDayName(dayIdx)}</h3><p style={{fontSize:11,color:"#666688",marginTop:2}}>{exs.length} תרגילים</p></div>
          <button className="btn-g" style={{padding:"6px 14px",fontSize:12}} onClick={onClose}>✕ סגור</button>
        </div>
        {exs.length===0
          ? <p style={{color:"#555570",textAlign:"center",padding:20}}>אין תרגילים</p>
          : exs.map((ex,idx)=>{
              const lp=getLastPerf&&getLastPerf(ex.id,ex.name), last=lp?.[0];
              const maxW=last?Math.max(...last.sets.map(s=>parseFloat(s.weight)||0)):0;
              const totalR=last?last.sets.filter(s=>s.done).reduce((a,s)=>a+(parseFloat(s.reps)||0),0):0;
              const doneC=last?last.sets.filter(s=>s.done).length:0;
              const trend=lp?.length>1?Math.max(...lp[0].sets.map(s=>parseFloat(s.weight)||0))-Math.max(...lp[1].sets.map(s=>parseFloat(s.weight)||0)):null;
              return (
                <div key={ex.id} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"12px 14px",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{flex:1}}>
                      {ex.muscleGroup&&<div style={{fontSize:11,color:"#a855f7",fontWeight:700,marginBottom:3,letterSpacing:.3}}>{ex.muscleGroup}</div>}
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{fontWeight:700,fontSize:14}}>{idx+1}. {ex.name}</span>
                      </div>
                      <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
                        <span className="tag" style={{fontSize:10}}>{ex.sets} סטים</span>
                        {ex.targetReps&&<span className="tag" style={{fontSize:10}}>🎯 {ex.targetReps} חזרות</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:5,flexShrink:0}}>
                      {lp&&onShowHistory&&<button style={{background:"rgba(168,85,247,.15)",border:"1px solid rgba(168,85,247,.3)",color:"#a855f7",borderRadius:7,padding:"3px 8px",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'Rubik',sans-serif"}} onClick={()=>onShowHistory(ex.name,lp)}>📋</button>}
                      {isYT(ex.youtubeUrl)&&<button className="yt-btn" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>onYt&&onYt(ex.youtubeUrl,ex.name)}>▶</button>}
                    </div>
                  </div>
                  {isTrainer&&last&&(
                    <div style={{background:"rgba(0,0,0,.25)",borderRadius:10,padding:"10px 12px",marginTop:4}}>
                      <div style={{fontSize:10,color:"#666688",marginBottom:7,fontWeight:600}}>📊 אחרון — {last.date}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:trend?7:0}}>
                        <div style={{textAlign:"center",background:"rgba(108,63,255,.1)",borderRadius:8,padding:"6px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#a855f7"}}>{maxW||"—"}</div><div style={{fontSize:9,color:"#666688",marginTop:1}}>מקס׳ ק"ג</div></div>
                        <div style={{textAlign:"center",background:"rgba(34,197,94,.08)",borderRadius:8,padding:"6px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#4ade80"}}>{totalR||"—"}</div><div style={{fontSize:9,color:"#666688",marginTop:1}}>חזרות</div></div>
                        <div style={{textAlign:"center",background:doneC===ex.sets?"rgba(34,197,94,.08)":"rgba(255,165,0,.08)",borderRadius:8,padding:"6px 4px"}}><div style={{fontSize:16,fontWeight:800,color:doneC===ex.sets?"#4ade80":"#ffa500"}}>{doneC}/{last.sets.length}</div><div style={{fontSize:9,color:"#666688",marginTop:1}}>סטים</div></div>
                      </div>
                      {trend!==null&&trend!==0&&<div style={{fontSize:11,fontWeight:700,color:trend>0?"#4ade80":"#ff5555",textAlign:"center"}}>{trend>0?"📈":"📉"} {trend>0?"+":""}{trend} ק"ג</div>}
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:7}}>
                        {last.sets.map((s,i)=><div key={i} style={{background:"rgba(255,255,255,.05)",borderRadius:6,padding:"2px 8px",fontSize:10,color:"#c0c0d8",display:"flex",gap:2}}><span style={{color:"#a855f7",fontWeight:700}}>סט{s.setNum}</span>{s.weight&&<span>{s.weight}ק</span>}{s.reps&&<span>×{s.reps}</span>}<span style={{color:s.done?"#4ade80":"#ff5555"}}>{s.done?"✓":"✕"}</span></div>)}
                      </div>
                    </div>
                  )}
                  {!isTrainer&&last&&(
                    <div style={{background:"rgba(108,63,255,.07)",borderRadius:8,padding:"7px 10px",marginTop:4}}>
                      <div style={{fontSize:10,color:"#a855f7",fontWeight:700,marginBottom:4}}>📊 אחרון — {last.date}</div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {last.sets.map((s,i)=><div key={i} style={{background:"rgba(255,255,255,.06)",borderRadius:6,padding:"2px 7px",fontSize:10,color:"#c0c0d8",display:"flex",gap:2}}><span style={{color:"#a855f7",fontWeight:700}}>סט{s.setNum}</span>{s.weight&&<span>{s.weight}ק</span>}{s.reps&&<span>×{s.reps}</span>}{s.done&&<span style={{color:"#4ade80"}}>✓</span>}</div>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        }
        {!isTrainer&&exs.length>0&&<button className="btn-p" style={{width:"100%",marginTop:16,padding:13,fontSize:14}} onClick={()=>{onClose();onStart(dayIdx);}}>▶ התחל אימון</button>}
        {exs.length>4&&<div style={{display:"flex",justifyContent:"center",marginTop:14}}>
          <button onClick={()=>scrollRef.current?.scrollTo({top:0,behavior:"smooth"})}
            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:"6px 16px",color:"#666688",fontFamily:"'Rubik',sans-serif",fontSize:12,cursor:"pointer"}}>
            ↑ חזרה למעלה
          </button>
        </div>}
      </div>
    </div>
  );
}

const ClientSearchInput = memo(function ClientSearchInput({ onSearch }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);
  function handleChange(e) {
    const v = e.target.value;
    setVal(v);
    onSearch(v);
  }
  return (
    <div style={{position:"relative",marginBottom:16}}>
      <input ref={ref} className="inp" placeholder="🔍 חפש מתאמן..." value={val}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
        onChange={handleChange}/>
      {val&&<button onMouseDown={e=>{e.preventDefault();ref.current?.focus();}} onClick={()=>{setVal("");onSearch("");}}
        style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#666688",cursor:"pointer",fontSize:16}}>✕</button>}
    </div>
  );
});

function ClientCard({ c, idx, openClientEdit, askConfirm, removeClient, setSelClient, setActivePlan, setView, toggleFavorite }) {
  const lastS=c.history?.[0];
  const totalSessions=c.history?.length||0;
  let monthsStr="";
  if (c.joinedAt) {
    const [d,m,y]=c.joinedAt.split(".").map(Number);
    const joined=new Date(y,m-1,d);
    const now=new Date();
    const months=Math.floor((now-joined)/(1000*60*60*24*30.5));
    monthsStr=months===0?"פחות מחודש":months===1?"חודש אחד":`${months} חודשים`;
  }
  const now=new Date();
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-now.getDay()); weekStart.setHours(0,0,0,0);
  const weekEnd=new Date(weekStart); weekEnd.setDate(weekStart.getDate()+7);
  let exsDoneThisWeek=0;
  (c.history||[]).forEach(s=>{
    if(!s.date) return;
    const [sd,sm,sy]=s.date.split(".").map(Number);
    const dd=new Date(sy,sm-1,sd);
    if(dd>=weekStart && dd<weekEnd) {
      (s.exercises||[]).forEach(ex=>{
        if(ex.sets?.length>0&&ex.sets.every(st=>st.done)) exsDoneThisWeek++;
      });
    }
  });
  const weeklyTarget=(c.plan?.days ? Object.values(c.plan.days).reduce((a,day)=>a+(day?.exercises?.length||0),0) : 0);
  const pct=weeklyTarget>0?Math.round((exsDoneThisWeek/weeklyTarget)*100):0;
  return (
    <div className="client-card up" style={{animationDelay:`${idx*.05}s`}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{width:42,height:42,borderRadius:11,background:"linear-gradient(135deg,#6c3fff,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800,color:"#fff",flexShrink:0,marginTop:2}}>{c.name[0]}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:5}}>{c.name}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {c.joinedAt&&<span style={{fontSize:11,color:"#9999bb",background:"rgba(255,255,255,.05)",borderRadius:6,padding:"2px 8px"}}>📅 הצטרף {c.joinedAt}</span>}
            {lastS&&<span style={{fontSize:11,color:"#4ade80",background:"rgba(34,197,94,.08)",borderRadius:6,padding:"2px 8px"}}>🏋️ אחרון: {lastS.date}</span>}
          </div>
          {weeklyTarget>0&&(
            <div style={{marginTop:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:11,color:"#9999bb"}}>ביצוע שבועי</span>
                <span style={{fontSize:11,fontWeight:700,color:pct>=100?"#4ade80":pct>=50?"#a855f7":"#ff5555"}}>{exsDoneThisWeek}/{weeklyTarget} תרגילים · {pct}%</span>
              </div>
              <div className="pbar"><div className="pfill" style={{width:`${Math.min(100,pct)}%`,background:pct>=100?"linear-gradient(90deg,#22c55e,#4ade80)":pct>=50?"linear-gradient(90deg,#6c3fff,#a855f7)":"linear-gradient(90deg,#ff5555,#ff8888)"}}/></div>
            </div>
          )}
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginTop:10,justifyContent:"flex-end"}}>
        <button onClick={()=>toggleFavorite(c.id)} style={{fontSize:16,padding:"4px 8px",background:"none",border:"none",cursor:"pointer",color:c.favorite?"#fbbf24":"#444460",transition:"all .2s"}}>
          {c.favorite?"★":"☆"}
        </button>
        <button className="btn-g" style={{fontSize:11,padding:"6px 10px"}} onClick={()=>openClientEdit(c.id)}>✏️ ערוך</button>
        <button className="btn-g" style={{fontSize:11,padding:"6px 10px"}} onClick={()=>{setSelClient(c.id);setActivePlan(c.plan);setView("athleteHome");}}>👁</button>
        <button className="btn-d" style={{fontSize:11,padding:"6px 8px"}} onClick={()=>askConfirm(`למחוק את ${c.name}?`,()=>removeClient(c.id))}>🗑</button>
      </div>
    </div>
  );
}

function ClientList({ clients, openClientEdit, askConfirm, removeClient, setSelClient, setActivePlan, setView, toggleFavorite, titleAbove }) {
  const inputRef = useRef(null);
  const [search, setSearch] = useState("");

  return (
    <div>
      <div style={{position:"relative",marginBottom:16}}>
        <input
          ref={inputRef}
          className="inp"
          placeholder="🔍 חפש מתאמן..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onPointerDown={e => e.preventDefault()}
            onClick={() => { setSearch(""); if(inputRef.current) inputRef.current.value = ""; }}
            style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#666688",cursor:"pointer",fontSize:16}}>✕</button>
        )}
      </div>
      {titleAbove}
      {clients.length === 0
        ? <div className="card" style={{textAlign:"center",color:"#555570",padding:36}}><div style={{fontSize:40,marginBottom:12}}>👥</div><p>אין מתאמנים עדיין</p></div>
        : (() => {
            const filtered = search ? clients.filter(c => c.name.includes(search)) : clients;
            return filtered.length === 0
              ? <div className="card" style={{textAlign:"center",color:"#555570",padding:20}}>לא נמצאו מתאמנים</div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[...filtered].sort((a,b)=>{
                    if(!!b.favorite !== !!a.favorite) return (b.favorite?1:0)-(a.favorite?1:0);
                    const dateA=a.joinedAt?a.joinedAt.split(".").reverse().join(""):""
                    const dateB=b.joinedAt?b.joinedAt.split(".").reverse().join(""):""
                    const dateCmp=dateB.localeCompare(dateA);
                    if(dateCmp!==0) return dateCmp;
                    return b.id - a.id; // same date — newest added first
                  }).map((c,idx) => <ClientCard key={c.id} c={c} idx={idx} openClientEdit={openClientEdit} askConfirm={askConfirm} removeClient={removeClient} setSelClient={setSelClient} setActivePlan={setActivePlan} setView={setView} toggleFavorite={toggleFavorite}/>)}
                </div>;
          })()
      }
    </div>
  );
}
function AddClientInput({ onAdd }) {
  const [name, setName] = useState("");
  function submit() { if(!name.trim()) return; onAdd(name.trim()); setName(""); }
  return (
    <div className="card" style={{marginBottom:18}}>
      <p style={{fontSize:13,color:"#9999bb",marginBottom:10,fontWeight:600}}>הוסף מתאמן חדש</p>
      <div style={{display:"flex",gap:8}}>
        <input className="inp" placeholder="שם המתאמן" value={name}
          onChange={e=>setName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&submit()}/>
        <button className="btn-p" style={{whiteSpace:"nowrap",padding:"10px 16px"}} onClick={submit}>+ הוסף</button>
      </div>
    </div>
  );
}


export default function App() {

  // ── State ──────────────────────────────────────────────────────────────────
  const [settings,    setSettings]    = useState(()=>load(SET,{gymName:"חדר הכושר שלי",logoUrl:null}));
  const [clients,     setClients]     = useState(()=>load(CK,[]));
  const [activePlan,  setActivePlan]  = useState(()=>load(SK,emptyPlan()));
  const [library,     setLibrary]     = useState(()=>{
    const saved=load(LK,null);
    if(saved) return saved;
    return {plans:[],workouts:[],exercises:[
      {id:Date.now()+1, name:"לחיצת חזה במוט", muscleGroup:"חזה", sets:3, targetReps:10,
       description:"שכב על הספסל, אחוז במוט ברוחב כתפיים. הורד לחזה ולחץ למעלה בקו ישר.",
       youtubeUrl:"https://www.youtube.com/watch?v=0I6q9NqK9tM",
       savedAt:new Date().toLocaleDateString("he-IL")}
    ]};
  });
  const [myHistory,   setMyHistory]   = useState(()=>load(HK,[]));
  const [lastDates,   setLastDates]   = useState(()=>load(LDK,{}));
  const [activeWorkout,setActiveWorkout]=useState(()=>load(AWK,null));

  const [view,        setView]        = useState("trainer");
  const [selClient,   setSelClient]   = useState(null);
  const [selDay,      setSelDay]      = useState(null);
  const [previewDay,  setPreviewDay]  = useState(null);
  const [ytModal,     setYtModal]     = useState(null);
  const [confirmDlg,  setConfirmDlg]  = useState(null);
  const [histModal,   setHistModal]   = useState(null);
  const [libTab,      setLibTab]      = useState("exercises");
  const [libReturn,   setLibReturn]   = useState("trainer");
  const [progressFrom, setProgressFrom] = useState("clientEdit");
  const [editExId,    setEditExId]    = useState(null);
  const [wName,       setWName]       = useState("");
  const [wExercises,  setWExercises]  = useState([]);
  const [showPicker,  setShowPicker]  = useState(false);
  const [workoutPickerDay, setWorkoutPickerDay] = useState(null);
  const [workoutPickerTab, setWorkoutPickerTab] = useState("workouts");
  const [showAssignLog, setShowAssignLog] = useState(false);
  const [quickLibPick, setQuickLibPick] = useState(null); // {type:"workout"|"exercise"|"exercises", data}
  const [editDayDirty, setEditDayDirty] = useState(false);
  const [editDaySnapshot, setEditDaySnapshot] = useState(null);
  const [completedSets,setCompletedSets]=useState({});
  const [newClientName, setNewClientName]=useState("");
  const [clientSearch, setClientSearch]=useState("");
  const [exitConfirm, setExitConfirm] = useState(false);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [showAllHist, setShowAllHist] = useState(false);
  const [openExId, setOpenExId] = useState(new Set());
  const [summary,     setSummary]     = useState(null);
  const elapsedRef = useRef(0);
  const startRef   = useRef(null);

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(()=>save(SET,settings),[settings]);
  useEffect(()=>save(CK,clients),[clients]);
  useEffect(()=>save(SK,activePlan),[activePlan]);
  useEffect(()=>save(LK,library),[library]);

  // Add sample exercise if not already in library
  useEffect(()=>{
    const exercises = [
      { id:"sample-bench-press",    name:"לחיצת חזה במוט",         muscleGroup:"חזה",      sets:4, targetReps:8,  description:"שכב על הספסל, אחוז במוט ברוחב כתפיים. הורד לחזה ולחץ למעלה.", youtubeUrl:"https://www.youtube.com/watch?v=0I6q9NqK9tM" },
      { id:"sample-incline-press",  name:"לחיצה אלכסונית במוט",   muscleGroup:"חזה",      sets:3, targetReps:10, description:"ספסל בזווית 30-45 מעלות. מכוון לחלק העליון של החזה.", youtubeUrl:"https://www.youtube.com/watch?v=IP4oeKh1Sd4" },
      { id:"sample-chest-fly",      name:"פרפר עם דמבלים",         muscleGroup:"חזה",      sets:3, targetReps:12, description:"שכב על ספסל, פרש הידיים לצדדים בקשת רחבה וסגור.", youtubeUrl:"https://www.youtube.com/watch?v=0I6q9NqK9tM" },
      { id:"sample-squat",          name:"סקוואט",                  muscleGroup:"רגליים",   sets:4, targetReps:8,  description:"עמוד עם רגליים ברוחב כתפיים. רד עד ל-90 מעלות.", youtubeUrl:"https://www.youtube.com/watch?v=bEv6CCg2BC8" },
      { id:"sample-rdl",            name:"דדליפט רומני",            muscleGroup:"רגליים",   sets:3, targetReps:10, description:"הישאר ישר, הרד לאורך הרגליים עם כיפוף ברכיים קל.", youtubeUrl:"https://www.youtube.com/watch?v=hCDzSR6bW10" },
      { id:"sample-legpress",       name:"לג פרס",                  muscleGroup:"רגליים",   sets:3, targetReps:12, description:"שב במכשיר, דחוף את הפלטפורמה בכוח רגליים.", youtubeUrl:"https://www.youtube.com/watch?v=IZxyjW7MPJQ" },
      { id:"sample-latpull",        name:"מתח מכונה",               muscleGroup:"גב",       sets:4, targetReps:10, description:"אחוז בבר ברוחב. משוך מטה לחזה תוך כדי כיפוף המרפקים.", youtubeUrl:"https://www.youtube.com/watch?v=QHZkxphcO6U" },
      { id:"sample-row",            name:"חתירה עם מוט",            muscleGroup:"גב",       sets:4, targetReps:8,  description:"כפוף קדימה, משוך את המוט לבטן תחתונה.", youtubeUrl:"https://www.youtube.com/watch?v=FWJR5Ve8bnQ" },
      { id:"sample-pullup",         name:"מתח",                     muscleGroup:"גב",       sets:3, targetReps:8,  description:"אחוז בבר, משוך גופך עד שהסנטר מעל הבר.", youtubeUrl:"https://www.youtube.com/watch?v=eGo4IYlbE5g" },
      { id:"sample-ohp",            name:"לחיצת כתפיים במוט",      muscleGroup:"כתפיים",   sets:3, targetReps:10, description:"עמוד, לחץ את המוט מעל הראש ישירות למעלה.", youtubeUrl:"https://www.youtube.com/watch?v=2yjwXTZQDDI" },
      { id:"sample-lateral",        name:"הרמת צדדים",              muscleGroup:"כתפיים",   sets:3, targetReps:15, description:"הרם דמבלים לצדדים עד לגובה הכתפיים.", youtubeUrl:"https://www.youtube.com/watch?v=3VcKaXpzqRo" },
      { id:"sample-curl",           name:"כפיפת מרפק עם מוט",      muscleGroup:"יד קדמית", sets:3, targetReps:12, description:"אחוז במוט כף יד למעלה. כופף את המרפקים.", youtubeUrl:"https://www.youtube.com/watch?v=kwG2ipFRgfo" },
      { id:"sample-hammer",         name:"האמר קרל",                muscleGroup:"יד קדמית", sets:3, targetReps:12, description:"אחוז בדמבלים ניטרלי. כופף את המרפקים.", youtubeUrl:"https://www.youtube.com/watch?v=CFBZ4jN1CMI" },
      { id:"sample-tricepext",      name:"הארכת מרפק (כבל)",       muscleGroup:"יד אחורית",sets:3, targetReps:12, description:"עמוד מול כבל, לחץ מטה עם שתי ידיים.", youtubeUrl:"https://www.youtube.com/watch?v=6SS6K3lAwZ8" },
      { id:"sample-dip",            name:"דיפ",                     muscleGroup:"יד אחורית",sets:3, targetReps:10, description:"תמוך על שתי ידיים, רד ועלה.", youtubeUrl:"https://www.youtube.com/watch?v=2z8JmcrW-As" },
      { id:"sample-plank",          name:"פלאנק",                   muscleGroup:"בטן",      sets:3, targetReps:30, description:"שמור על גוף ישר כמו קרש. החזק 30-60 שניות.", youtubeUrl:"https://www.youtube.com/watch?v=pSHjTRCQxIw" },
      { id:"sample-crunch",         name:"כפיפות בטן",              muscleGroup:"בטן",      sets:3, targetReps:20, description:"שכב, ידיים מאחורי הראש, כופף ועלה.", youtubeUrl:"https://www.youtube.com/watch?v=Xyd_fa5zoEU" },
      { id:"sample-hipthrust",      name:"היפ ת'ראסט",             muscleGroup:"ישבן",     sets:4, targetReps:12, description:"כתפיים על ספסל, מוט על הירכיים. דחוף מהישבן.", youtubeUrl:"https://www.youtube.com/watch?v=xDmFkJxPzeM" },
      { id:"sample-lunge",          name:"לאנג'",                   muscleGroup:"ישבן",     sets:3, targetReps:12, description:"צעד קדימה ורד עד שהברך מגיעה לרצפה.", youtubeUrl:"https://www.youtube.com/watch?v=QOVaHwm-Q6U" },
      // סמית' מאשין
      { id:"smith-squat",           name:"סקוואט סמית'",            muscleGroup:"רגליים",   sets:4, targetReps:10, description:"רגליים קדימה מהמוט. רד עמוק, שמור על גב ישר.", youtubeUrl:"https://www.youtube.com/watch?v=8xHqFPFDCCM" },
      { id:"smith-bench",           name:"לחיצת חזה סמית'",         muscleGroup:"חזה",      sets:4, targetReps:10, description:"שכב על ספסל, הורד לחזה ולחץ למעלה בסמית'.", youtubeUrl:"https://www.youtube.com/watch?v=xioapEt95bk" },
      { id:"smith-incline",         name:"לחיצה אלכסונית סמית'",   muscleGroup:"חזה",      sets:3, targetReps:10, description:"ספסל בזווית 30-45. מכוון לחלק העליון של החזה.", youtubeUrl:"https://www.youtube.com/watch?v=TpDUjbMD7tY" },
      { id:"smith-ohp",             name:"לחיצת כתפיים סמית'",     muscleGroup:"כתפיים",   sets:3, targetReps:10, description:"עמוד או שב, לחץ את המוט מעל הראש.", youtubeUrl:"https://www.youtube.com/watch?v=FMVHKN5tFK0" },
      { id:"smith-row",             name:"חתירה סמית'",             muscleGroup:"גב",       sets:3, targetReps:10, description:"כפוף קדימה, משוך את המוט לבטן בסמית'.", youtubeUrl:"https://www.youtube.com/watch?v=2oFMODwFmWA" },
      { id:"smith-lunge",           name:"לאנג' סמית'",             muscleGroup:"ישבן",     sets:3, targetReps:12, description:"צעד קדימה עם המוט על הכתפיים. שמור על גב ישר.", youtubeUrl:"https://www.youtube.com/watch?v=hqH3E5vPpC8" },
      { id:"smith-calf",            name:"עליית עקבים סמית'",      muscleGroup:"רגליים",   sets:4, targetReps:15, description:"עמוד על גבי מדרגה, עלה על קצות האצבעות.", youtubeUrl:"https://www.youtube.com/watch?v=gwLzBJYoWlI" },
      // פולי (כבל)
      { id:"cable-fly",             name:"פרפר כבל",                muscleGroup:"חזה",      sets:3, targetReps:12, description:"עמוד בין שני כבלים, פרש ידיים וסגור לפנים החזה.", youtubeUrl:"https://www.youtube.com/watch?v=WEM9FCIPlxQ" },
      { id:"cable-row",             name:"חתירה כבל ישיבה",        muscleGroup:"גב",       sets:4, targetReps:10, description:"שב מול הכבל, משוך הידית לבטן תוך כדי כיפוף מרפקים.", youtubeUrl:"https://www.youtube.com/watch?v=GZbfZ033f74" },
      { id:"cable-tricep",          name:"הארכת מרפק כבל",         muscleGroup:"יד אחורית",sets:3, targetReps:12, description:"עמוד מול פולי עליון, לחץ מטה עד ליישור מלא.", youtubeUrl:"https://www.youtube.com/watch?v=vB5OHsJ3EME" },
      { id:"cable-curl",            name:"כפיפת מרפק כבל",         muscleGroup:"יד קדמית", sets:3, targetReps:12, description:"עמוד מול פולי תחתון, כופף את המרפקים.", youtubeUrl:"https://www.youtube.com/watch?v=NFzTWp2qpiE" },
      { id:"cable-lateral",         name:"הרמת צד כבל",            muscleGroup:"כתפיים",   sets:3, targetReps:15, description:"עמוד בצד הכבל, הרם ידית הצידה עד גובה הכתף.", youtubeUrl:"https://www.youtube.com/watch?v=PPjOPomHIt8" },
      { id:"cable-pullthrough",     name:"פול-תרו כבל",            muscleGroup:"ישבן",     sets:3, targetReps:12, description:"עמוד עם גב לכבל, כופף ירכיים וסגור עם כוח הישבן.", youtubeUrl:"https://www.youtube.com/watch?v=hCRmVQjHqqo" },
      { id:"cable-crunch",          name:"כפיפות בטן כבל",         muscleGroup:"בטן",      sets:3, targetReps:15, description:"ברכיים על הרצפה, כפוף את הגו מטה מול פולי עליון.", youtubeUrl:"https://www.youtube.com/watch?v=_mRoB1MkiNQ" },
      { id:"cable-facepull",        name:"פייס פול",               muscleGroup:"כתפיים",   sets:3, targetReps:15, description:"משוך את ידית הכבל לכיוון הפנים, מרפקים גבוהים.", youtubeUrl:"https://www.youtube.com/watch?v=rep-qVOkqgk" },
      { id:"cable-straight-arm",    name:"פול-דאון זרוע ישרה",    muscleGroup:"גב",       sets:3, targetReps:12, description:"עמוד מול פולי עליון, הורד את הזרועות הישרות מטה.", youtubeUrl:"https://www.youtube.com/watch?v=GlLDMVFQMfY" },
    ];
    setLibrary(p=>{
      const toAdd = exercises.filter(e=>!p.exercises.some(x=>x.id===e.id))
        .map(e=>({...e, savedAt:new Date().toLocaleDateString("he-IL")}));
      if(toAdd.length===0) return p;
      return {...p, exercises:[...p.exercises, ...toAdd]};
    });
  },[]);
  useEffect(()=>save(HK,myHistory),[myHistory]);
  useEffect(()=>save(LDK,lastDates),[lastDates]);
  useEffect(()=>{ activeWorkout?save(AWK,activeWorkout):localStorage.removeItem(AWK); },[activeWorkout]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const activeDays = Array.from({length:activePlan.workoutsPerWeek},(_,i)=>i);
  const getDayName = i => activePlan.dayNames?.[i]||`אימון ${i+1}`;
  const askConfirm = (msg,onYes,yesLabel,yesStyle) => setConfirmDlg({msg,onYes,yesLabel,yesStyle});

  const Wrap = ({children}) => (
    <div style={{minHeight:"100vh",background:"#0a0a0f",fontFamily:"'Rubik',sans-serif",color:"#e8e8f0",direction:"rtl"}}>
      <style>{CSS}</style>
      {confirmDlg&&<ConfirmDialog msg={confirmDlg.msg} onYes={()=>{confirmDlg.onYes();setConfirmDlg(null);}} onNo={()=>setConfirmDlg(null)} yesLabel={confirmDlg.yesLabel} yesStyle={confirmDlg.yesStyle}/>}
      <div style={{maxWidth:480,margin:"0 auto",padding:"24px 16px"}}>
        {children}
        <div style={{display:"flex",justifyContent:"center",padding:"24px 0 8px"}}>
          <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}
            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:"7px 18px",color:"#666688",fontFamily:"'Rubik',sans-serif",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all .2s"}}
            onMouseOver={e=>e.currentTarget.style.color="#e8e8f0"}
            onMouseOut={e=>e.currentTarget.style.color="#666688"}>
            ↑ חזרה למעלה
          </button>
        </div>
      </div>
    </div>
  );

  function GymHeader() {
    return (
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        {settings.logoUrl
          ? <img src={settings.logoUrl} alt="לוגו" style={{width:48,height:48,borderRadius:12,objectFit:"cover"}}/>
          : <div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,#6c3fff,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>💪</div>
        }
        <div>
          <div style={{fontWeight:800,fontSize:18}}>{settings.gymName}</div>
          <div style={{fontSize:11,color:"#666688"}}>{clients.length} מתאמנים</div>
        </div>
      </div>
    );
  }

  // ── Client functions ───────────────────────────────────────────────────────
  function addClient(name) { setClients(p=>[...p,{id:Date.now(),name,plan:emptyPlan(),history:[],joinedAt:new Date().toLocaleDateString("he-IL")}]); }
  function removeClient(id) { setClients(p=>p.filter(c=>c.id!==id)); }
  function toggleFavorite(id) { setClients(p=>p.map(c=>c.id===id?{...c,favorite:!c.favorite}:c)); }
  function openClientEdit(id) { const c=clients.find(c=>c.id===id); if(!c)return; setSelClient(id); setActivePlan(c.plan); setView("clientEdit"); }
  function logAssignment(clientId, workoutName, exercises) {
    const entry = {
      date: new Date().toLocaleDateString("he-IL"),
      workoutName,
      exercises: exercises.map(e=>({name:e.name, muscleGroup:e.muscleGroup||""}))
    };
    setClients(p=>p.map(c=>c.id===clientId?{...c,assignLog:[entry,...(c.assignLog||[])].slice(0,30)}:c));
  }

  function saveClientPlan() { setClients(p=>p.map(c=>c.id===selClient?{...c,plan:activePlan}:c)); setView("trainer"); }
  function saveClientPlanInPlace() { setClients(p=>p.map(c=>c.id===selClient?{...c,plan:activePlan}:c)); }
  function sendPlan(id) { setClients(p=>p.map(c=>c.id===id?{...c,plan:activePlan}:c)); alert("התכנית נשלחה! ✅"); }

  // ── Plan functions ─────────────────────────────────────────────────────────
  function setPlanField(f,v) { setActivePlan(p=>({...p,[f]:v})); }
  function updateWorkoutsPerWeek(n) { setActivePlan(p=>({...p,workoutsPerWeek:n,dayNames:Object.fromEntries(Array.from({length:n},(_,i)=>[i,p.dayNames?.[i]||`אימון ${i+1}`]))})); }
  function updateDayName(i,v) { setActivePlan(p=>{const dn={...(p.dayNames||{})};dn[i]=v||`אימון ${i+1}`;return{...p,dayNames:dn};}); }
  function removeExercise(day,id) {
    setActivePlan(p=>{const exs=p.days[day]?.exercises||[];const removed=exs.find(e=>e.id===id);
      return{...p,archivedExercises:{...p.archivedExercises,...(removed?{[removed.id]:removed.name}:{})},days:{...p.days,[day]:{exercises:exs.filter(e=>e.id!==id)}}};});
  }
  function updateExField(day,id,f,v) { setActivePlan(p=>({...p,days:{...p.days,[day]:{exercises:(p.days[day]?.exercises||[]).map(e=>e.id===id?{...e,[f]:v}:e)}}})); }
  function addExtraSet(day,id) { updateExField(day,id,"sets",(activePlan.days[day]?.exercises||[]).find(e=>e.id===id)?.sets+1||4); }
  function removeExtraSet(day,id) { const ex=(activePlan.days[day]?.exercises||[]).find(e=>e.id===id); if(ex&&ex.sets>1) updateExField(day,id,"sets",ex.sets-1); }
  function updateWeight(day,id,i,v) { setActivePlan(p=>({...p,days:{...p.days,[day]:{exercises:(p.days[day]?.exercises||[]).map(e=>e.id===id?{...e,weights:{...e.weights,[i]:v}}:e)}}})); }
  function updateReps(day,id,i,v) { setActivePlan(p=>({...p,days:{...p.days,[day]:{exercises:(p.days[day]?.exercises||[]).map(e=>e.id===id?{...e,reps:{...e.reps,[i]:v}}:e)}}})); }

  // ── Add exercises from picker to day ──────────────────────────────────────
  function addExercisesToDay(exs) {
    const newExs = exs.map(e=>({...e,id:Date.now()+Math.random(),libraryId:e.id,weights:{},reps:{}}));
    setActivePlan(p=>({...p,days:{...p.days,[selDay]:{exercises:[...(p.days[selDay]?.exercises||[]),...newExs]}}}));
  }

  // ── Workout functions ──────────────────────────────────────────────────────
  function getLastPerf(exId,exName) {
    const hist=selClient?(clients.find(c=>c.id===selClient)?.history||[]):myHistory;
    if(!hist.length) return null;
    const results=[];
    for(const s of hist){const ex=s.exercises?.find(e=>e.id===exId)||(exName?s.exercises?.find(e=>e.name===exName):null);if(ex?.sets?.length)results.push({date:s.date,sets:ex.sets});if(results.length===3)break;}
    return results.length?results:null;
  }

  function toggleSet(exId,i) {
    setCompletedSets(prev=>{const k=`${exId}-${i}`;const next={...prev,[k]:!prev[k]};setActiveWorkout(aw=>aw?{...aw,completedSets:next}:aw);return next;});
  }

  function autoCompleteSet(exId, setIdx, weights, reps) {
    // called after every weight/reps change — auto-mark done if both filled
    const exWeights = weights;
    const exReps = reps;
    const hasWeight = exWeights?.[setIdx] && String(exWeights[setIdx]).trim() !== "";
    const hasReps   = exReps?.[setIdx]   && String(exReps[setIdx]).trim()   !== "";
    const k = `${exId}-${setIdx}`;
    setCompletedSets(prev=>{
      const newDone = hasWeight && hasReps;
      if(prev[k]===newDone) return prev; // no change
      const next={...prev,[k]:newDone};
      setActiveWorkout(aw=>aw?{...aw,completedSets:next}:aw);
      return next;
    });
  }

  function pauseWorkout() {
    const currentElapsed = Math.floor((Date.now() - startRef.current) / 1000);
    elapsedRef.current = currentElapsed;
    setActiveWorkout(aw=>aw?{...aw,completedSets,startTime:startRef.current,elapsed:currentElapsed,paused:true}:aw);
    setView(selClient?"athleteHome":"trainer");
  }

  function startWorkout(day) {
    if(activeWorkout&&activeWorkout.dayIdx===day){
      setSelDay(day);
      setCompletedSets(activeWorkout.completedSets);
      elapsedRef.current=activeWorkout.elapsed||0;
      startRef.current=Date.now()-((activeWorkout.elapsed||0)*1000);
    }
    else{setSelDay(day);setCompletedSets({});elapsedRef.current=0;startRef.current=Date.now();setActiveWorkout({dayIdx:day,startTime:Date.now(),completedSets:{}});}
    setView("workout");
  }

  function finishWorkout() {
    // flush any open inputs before saving
    if(document.activeElement) document.activeElement.blur();
    setTimeout(()=>{
    const exs=activePlan.days[selDay]?.exercises||[];
    const today=new Date().toLocaleDateString("he-IL");
    const s={dayName:getDayName(selDay),dayIdx:selDay,date:today,duration:elapsedRef.current,
      startTime:startRef.current,
      exercises:exs.map(ex=>({id:ex.id,name:ex.name,sets:Array.from({length:ex.sets},(_,i)=>({setNum:i+1,weight:ex.weights?.[i]||"",reps:ex.reps?.[i]||(ex.targetReps?""+ex.targetReps:"")||"",done:!!completedSets[`${ex.id}-${i}`]}))}))};;
    setSummary(s);
    setLastDates(p=>({...p,[selDay]:today}));
    if(selClient) setClients(p=>p.map(c=>c.id===selClient?{...c,history:[s,...(c.history||[])].slice(0,30)}:c));
    else setMyHistory(p=>[s,...p].slice(0,30));
    setActiveWorkout(null);
    setWorkoutStarted(false);
    window.scrollTo(0,0);
    setView("summary");
    },200);
  }

  // ── History modal ──────────────────────────────────────────────────────────
  function HistModal() {
    if(!histModal) return null;
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.78)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:999}} onClick={()=>setHistModal(null)}>
        <div style={{background:"#12121e",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480,maxHeight:"80vh",overflowY:"auto",direction:"rtl"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <h3 style={{fontSize:17,fontWeight:800}}>{histModal.exName}</h3>
            <button className="btn-g" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setHistModal(null)}>✕ סגור</button>
          </div>
          {histModal.sessions.map((session,si)=>(
            <div key={si} style={{marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{background:"linear-gradient(135deg,#6c3fff,#a855f7)",borderRadius:8,padding:"3px 12px",fontSize:12,fontWeight:700,color:"#fff"}}>{si===0?"אחרון":si===1?"לפני שניים":"לפני שלושה"}</div>
                <span style={{fontSize:12,color:"#666688"}}>📅 {session.date}</span>
              </div>
              <div style={{display:"flex",gap:10,padding:"4px 0 8px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
                {["סט","משקל","חזרות","הושלם"].map((h,i)=><div key={i} style={{[i===0?"width":"flex"]:i===0?36:1,textAlign:"center",fontSize:10,color:"#555570",fontWeight:600}}>{h}</div>)}
              </div>
              {session.sets.map((s,i)=>(
                <div key={i} className="set-row">
                  <div style={{width:36,height:32,borderRadius:8,flexShrink:0,background:s.done?"linear-gradient(135deg,#22c55e,#16a34a)":"rgba(255,80,80,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:s.done?"#fff":"#ff5555"}}>{s.setNum}</div>
                  <div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:s.weight?"#e8e8f0":"#444460"}}>{s.weight||"—"}</div>
                  <div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:s.reps?"#e8e8f0":"#444460"}}>{s.reps||"—"}</div>
                  <div style={{flex:1,textAlign:"center",fontSize:12,fontWeight:600,color:s.done?"#4ade80":"#ff5555"}}>{s.done?"✓":"✕"}</div>
                </div>
              ))}
              {si<histModal.sessions.length-1&&<div style={{height:1,background:"rgba(255,255,255,.06)",margin:"14px 0 0"}}/>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: TRAINER HOME ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="trainer") {
    function addC() { if(!newClientName.trim())return; addClient(newClientName.trim()); setNewClientName(""); }
    return (
      <Wrap>
        {/* Centered logo + gym name */}
        <div style={{textAlign:"center",marginBottom:22,paddingTop:8}}>
          {settings.logoUrl
            ? <img src={settings.logoUrl} alt="לוגו" style={{maxHeight:72,maxWidth:180,objectFit:"contain",marginBottom:10,borderRadius:12}}/>
            : <div style={{width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,#6c3fff,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:"0 8px 30px rgba(108,63,255,.35)",margin:"0 auto 10px"}}>💪</div>
          }
          <div style={{fontWeight:800,fontSize:20,background:"linear-gradient(135deg,#e8e8f0,#a855f7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{settings.gymName}</div>
          <div style={{fontSize:12,color:"#555570",marginTop:3}}>{clients.length} מתאמנים</div>
        </div>

        {/* Action buttons row */}
        <div style={{display:"flex",gap:8,marginBottom:16,justifyContent:"center"}}>
          <button className="btn-g" style={{fontSize:12,padding:"7px 14px"}} onClick={()=>{setLibReturn("trainer");setLibTab("exercises");setView("library");}}>📚 מאגר תרגילים</button>
          <button className="btn-g" style={{fontSize:12,padding:"7px 12px"}} onClick={()=>setView("settings")}>⚙️</button>
        </div>

        {/* Search */}
        

        {/* Section title + add client */}
        <AddClientInput onAdd={addClient}/>
        <ClientList clients={clients} openClientEdit={openClientEdit} askConfirm={askConfirm} removeClient={removeClient} setSelClient={setSelClient} setActivePlan={setActivePlan} setView={setView} toggleFavorite={toggleFavorite} titleAbove={<h2 style={{fontSize:17,fontWeight:800,marginTop:18,marginBottom:10}}>המתאמנים שלי</h2>}/>
      </Wrap>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: LIBRARY ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="library") {
    const tabs=[
      {id:"exercises",label:`🔧 תרגילים${library.exercises.length>0?` (${library.exercises.length})`:""}`},
      {id:"workouts",label:`💪 אימונים${library.workouts.length>0?` (${library.workouts.length})`:""}`},
      {id:"plans",label:`📋 תכניות${library.plans.length>0?` (${library.plans.length})`:""}`},
    ];
    return (
      <Wrap>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <button className="back-btn" onClick={()=>setView(libReturn)}>→ חזרה</button>
          <h2 style={{fontSize:19,fontWeight:800}}>📚 מאגר תרגילים</h2>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:18,background:"rgba(255,255,255,.04)",padding:5,borderRadius:14,border:"1px solid rgba(255,255,255,.07)"}}>
          {tabs.map(t=><button key={t.id} className={`tab-btn ${libTab===t.id?"tab-on":"tab-off"}`} onClick={()=>setLibTab(t.id)}>{t.label}</button>)}
        </div>
        {libReturn==="clientEdit" && (
          <div style={{background:"linear-gradient(135deg,rgba(108,63,255,.2),rgba(168,85,247,.1))",border:"1px solid rgba(108,63,255,.35)",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#c0a0ff"}}>
            💡 לחץ על אימון או תרגיל כדי לשבץ לתכנית. לחץ ← חזרה לביטול.
          </div>
        )}
        {libTab==="exercises"&&<LibExercises library={library} setLibrary={setLibrary} askConfirm={askConfirm} setView={setView} editingExId={editExId} setEditingExId={setEditExId}
          quickPick={libReturn==="clientEdit"} onQuickPick={ex=>{setQuickLibPick({type:"exercise",data:ex});setView("clientEdit");}} setYtModal={setYtModal}/>}
        {libTab==="workouts"&&<LibWorkouts library={library} setLibrary={setLibrary} askConfirm={askConfirm} setView={setView}
          quickPick={libReturn==="clientEdit"} onQuickPick={w=>{setQuickLibPick({type:"workout",data:w});setView("clientEdit");}} setYtModal={setYtModal}/>}
        {libTab==="plans"&&<LibPlans library={library} setLibrary={setLibrary} askConfirm={askConfirm}
          clients={clients} selectedClient={selClient} setSelClient={setSelClient}
          setActivePlan={setActivePlan} onApplied={()=>setView("clientEdit")}/>}
        {ytModal&&<YouTubeModal url={ytModal.url} title={ytModal.title} onClose={()=>setYtModal(null)}/>}
      </Wrap>
    );
  }

  // ── Add exercise view ──────────────────────────────────────────────────────
  if (view==="addExercise") {
    return (
      <Wrap>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button className="back-btn" onClick={()=>{setLibTab("exercises");setView("library");}}>→ חזרה</button>
          <h2 style={{fontSize:18,fontWeight:800}}>🔧 תרגיל חדש</h2>
        </div>
        <div className="card">
          <ExerciseForm onSave={data=>{setLibrary(p=>({...p,exercises:[...p.exercises,{...data,id:Date.now(),savedAt:new Date().toLocaleDateString("he-IL")}]}));setLibTab("exercises");setView("library");}}/>
        </div>
      </Wrap>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: SETTINGS ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="settings") return (
    <Wrap>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:26}}>
        <button className="back-btn" onClick={()=>setView("trainer")}>→ חזרה</button>
        <h2 style={{fontSize:19,fontWeight:800}}>הגדרות מכון</h2>
      </div>
      <div className="card" style={{marginBottom:14}}>
        <p style={{fontSize:13,color:"#9999bb",marginBottom:10,fontWeight:600}}>שם המכון</p>
        <FInput value={settings.gymName} placeholder="שם חדר הכושר" onSave={v=>setSettings(s=>({...s,gymName:v}))}/>
      </div>
      <div className="card" style={{marginBottom:14}}>
        <p style={{fontSize:13,color:"#9999bb",marginBottom:10,fontWeight:600}}>לוגו המכון</p>
        <LogoUploader logoUrl={settings.logoUrl} onUpload={url=>setSettings(s=>({...s,logoUrl:url}))} onRemove={()=>setSettings(s=>({...s,logoUrl:null}))} onAskConfirm={askConfirm}/>
      </div>
      <button className="btn-g" style={{width:"100%"}} onClick={()=>setView("trainer")}>✅ סיום</button>
    </Wrap>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: CLIENT PLAN EDITOR ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="clientEdit") {
    const client=clients.find(c=>c.id===selClient);
    return (
      <Wrap>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
          <button className="back-btn" onClick={saveClientPlan}>→ שמור וחזור</button>
          <h2 style={{fontSize:17,fontWeight:800}}>תכנית של {client?.name}</h2>
        </div>
        <p style={{color:"#555570",fontSize:11,marginBottom:16}}>לחץ "שמור וחזור" לשמירה</p>

        <div className="card" style={{marginBottom:14}}>
          <FInput value={activePlan.name} placeholder="שם התכנית" style={{fontWeight:700,fontSize:15,marginBottom:14}} onSave={v=>setPlanField("name",v)}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:14,color:"#9999bb"}}>אימונים בשבוע</span>
            <Stepper value={activePlan.workoutsPerWeek} onChange={updateWorkoutsPerWeek}/>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          {activeDays.map(i=>{
            const exs=activePlan.days[i]?.exercises||[];
            const lastS=client?.history?.find(h=>h.dayIdx===i);
            return (
              <div key={i} className="day-card">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(108,63,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#a855f7",flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <FInput value={getDayName(i)} placeholder={`אימון ${i+1}`} onSave={v=>updateDayName(i,v)} style={{fontWeight:700,fontSize:14,background:"transparent",border:"none",padding:0,outline:"none",width:"100%"}}/>
                      <div style={{color:"#666688",fontSize:11,marginTop:1}}>
                        {exs.length} תרגילים
                        {lastS&&<span style={{color:"#4ade80",marginRight:6}}> · אחרון: {lastS.date}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {exs.length>0&&<button className="btn-g" style={{padding:"6px 10px",fontSize:12}} onClick={()=>setPreviewDay(i)}>{lastS?"📋 צפה":"👁 צפה"}</button>}
                    <button className="btn-g" style={{padding:"6px 10px",fontSize:12}} onClick={()=>{
                      setSelDay(i);
                      setEditDaySnapshot(JSON.parse(JSON.stringify(activePlan.days[i]||{exercises:[]})));
                      setEditDayDirty(false);
                      setView("editDay");
                    }}>✏️ ערוך</button>
                    {exs.length>0&&<button className="btn-d" style={{padding:"6px 8px",fontSize:11}} onClick={()=>askConfirm(`למחוק את כל האימון "${getDayName(i)}"? ההיסטוריה נשמרת.`,()=>{
                      const archived={};
                      exs.forEach(e=>{archived[e.id]=e.name;});
                      setActivePlan(p=>{
                        const dn={...(p.dayNames||{})};
                        dn[i]=`אימון ${i+1}`;
                        return {...p,dayNames:dn,archivedExercises:{...p.archivedExercises,...archived},days:{...p.days,[i]:{exercises:[]}}};
                      });
                    })}>🗑</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{display:"flex",gap:10,marginBottom:10}}>
          <button className="btn-p" style={{width:"100%"}} onClick={saveClientPlanInPlace}>💾 שמור</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {client?.history?.length>0&&<button className="btn-g" style={{flex:1,fontSize:12}} onClick={()=>{setProgressFrom("clientEdit");setView("clientProgress");window.scrollTo(0,0);}}>📈 התקדמות</button>}
          <button className="btn-g" style={{flex:1,fontSize:12}} onClick={()=>setShowAssignLog(true)}>📋 היסטוריית שיבוצים</button>
        </div>
        <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"12px 14px"}}>
          <p style={{fontSize:12,color:"#9999bb",fontWeight:600,marginBottom:10}}>📚 מאגר מהיר — תכניות</p>
          {library.plans.length===0
            ? <p style={{fontSize:12,color:"#555570",textAlign:"center",padding:"8px 0"}}>אין תכניות שמורות</p>
            : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {library.plans.map(plan=>(
                  <button key={plan.id} onClick={()=>{
                    if(plan.workoutsPerWeek !== activePlan.workoutsPerWeek) {
                      askConfirm(`התכנית "${plan.name}" מכילה ${plan.workoutsPerWeek} אימונים בשבוע, אבל המתאמן מוגדר ל-${activePlan.workoutsPerWeek} אימונים. שנה תחילה את מספר האימונים השבועיים של המתאמן.`, ()=>{}, "הבנתי", {background:"rgba(108,63,255,.2)",borderColor:"rgba(108,63,255,.4)",color:"#a855f7"});
                      return;
                    }
                    askConfirm(`להחליף את התכנית הנוכחית ב"${plan.name}"?`,()=>{
                      setActivePlan({...plan,id:undefined,savedAt:undefined});
                      setClients(p=>p.map(c=>c.id===selClient?{...c,plan:{...plan,id:undefined,savedAt:undefined}}:c));
                      // Log all workouts in the plan
                      if(selClient) {
                        Object.values(plan.days||{}).forEach(day=>{
                          if(day?.exercises?.length>0) logAssignment(selClient, plan.name, day.exercises);
                        });
                      }
                    });
                  }} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",background:"rgba(108,63,255,.07)",border:"1px solid rgba(108,63,255,.2)",borderRadius:10,cursor:"pointer",fontFamily:"'Rubik',sans-serif",color:"#e8e8f0",textAlign:"right"}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>{plan.name}</div>
                      <div style={{fontSize:11,color:"#666688",marginTop:1}}>{plan.workoutsPerWeek} אימונים · {Object.values(plan.days||{}).reduce((a,d)=>a+(d?.exercises?.length||0),0)} תרגילים</div>
                    </div>
                    <span style={{fontSize:12,color:"#a855f7",marginRight:8}}>שבץ ←</span>
                  </button>
                ))}
              </div>
          }
        </div>

        {previewDay!==null&&<PreviewModal plan={activePlan} dayIdx={previewDay} getDayName={getDayName} onClose={()=>setPreviewDay(null)} onStart={()=>{}} isTrainer={true} onYt={(url,title)=>setYtModal({url,title})} getLastPerf={getLastPerf} onShowHistory={(name,sessions)=>{setPreviewDay(null);setHistModal({exName:name,sessions});}}/>}

        {/* Day picker for quick library assignment */}
        {quickLibPick && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:20}} onClick={()=>setQuickLibPick(null)}>
            <div style={{background:"#1a1a2a",border:"1px solid rgba(108,63,255,.3)",borderRadius:18,padding:24,width:"100%",maxWidth:340,direction:"rtl"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <h3 style={{fontSize:16,fontWeight:800}}>לאיזה יום לשבץ?</h3>
                <button onClick={()=>setQuickLibPick(null)} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:18}}>✕</button>
              </div>
              <p style={{fontSize:12,color:"#a855f7",marginBottom:16,fontWeight:600}}>{quickLibPick.type==="workout"?quickLibPick.data.name:quickLibPick.data.name}</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {activeDays.map(i=>(
                  <button key={i} onClick={()=>{
                    const exs = quickLibPick.type==="workout"
                      ? (quickLibPick.data.exercises||[]).map(e=>({...e,id:Date.now()+Math.random(),libraryId:e.id,weights:{},reps:{}}))
                      : [{...quickLibPick.data,id:Date.now()+Math.random(),libraryId:quickLibPick.data.id,weights:{},reps:{}}];
                    setActivePlan(p=>({...p,days:{...p.days,[i]:{exercises:[...(p.days[i]?.exercises||[]),...exs]}}}));
                    if(selClient) setClients(p=>p.map(c=>c.id===selClient?{...c,plan:{...activePlan,days:{...activePlan.days,[i]:{exercises:[...(activePlan.days[i]?.exercises||[]),...exs]}}}}:c));
                    if(quickLibPick.type==="workout" && selClient) logAssignment(selClient, quickLibPick.data.name, quickLibPick.data.exercises||[]);
                    setQuickLibPick(null);
                  }} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"rgba(108,63,255,.08)",border:"1px solid rgba(108,63,255,.2)",borderRadius:12,cursor:"pointer",fontFamily:"'Rubik',sans-serif",color:"#e8e8f0",transition:"all .15s"}}>
                    <span style={{fontWeight:600,fontSize:14}}>{getDayName(i)}</span>
                    <span style={{fontSize:12,color:"#666688"}}>{activePlan.days[i]?.exercises?.length||0} תרגילים</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showAssignLog && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:999}} onClick={()=>setShowAssignLog(false)}>
            <div style={{background:"#12121e",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480,maxHeight:"80vh",overflowY:"auto",direction:"rtl"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <h3 style={{fontSize:17,fontWeight:800}}>📋 היסטוריית שיבוצים</h3>
                <button className="btn-g" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setShowAssignLog(false)}>✕ סגור</button>
              </div>
              {(clients.find(c=>c.id===selClient)?.history||[]).length===0
                ? <p style={{color:"#555570",textAlign:"center",padding:20}}>אין אימונים שבוצעו עדיין</p>
                : (clients.find(c=>c.id===selClient)?.history||[]).map((s,i)=>(
                <div key={i} className="card" style={{marginBottom:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontWeight:700,fontSize:15}}>{s.dayName}</div>
                    <span style={{fontSize:11,color:"#666688"}}>📅 {s.date}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {(s.exercises||[]).map((ex,ei)=>(
                      <div key={ei} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 6px",background:"rgba(255,255,255,.03)",borderRadius:7}}>
                        <div style={{width:18,height:18,borderRadius:5,background:"rgba(108,63,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#a855f7",flexShrink:0}}>{ei+1}</div>
                        <span style={{fontSize:12,fontWeight:600,flex:1}}>{ex.name}</span>
                        {ex.muscleGroup&&<span style={{fontSize:10,color:"#a855f7"}}>{ex.muscleGroup}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {ytModal&&<YouTubeModal url={ytModal.url} title={ytModal.title} onClose={()=>setYtModal(null)}/>}
        <HistModal/>
      </Wrap>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: EDIT DAY ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="editDay") {
    const dayExs=activePlan.days[selDay]?.exercises||[];
    const alreadyIds=dayExs.map(e=>e.libraryId||e.id);
    const backDest=selClient!=null?"clientEdit":"trainer";

    function saveEdit() {
      setEditDaySnapshot(JSON.parse(JSON.stringify(activePlan.days[selDay]||{exercises:[]})));
      setEditDayDirty(false);
      if (selClient) setClients(p=>p.map(c=>c.id===selClient?{...c,plan:activePlan}:c));
    }
    function handleBack() {
      setYtModal(null);
      if (editDayDirty) {
        askConfirm("השינויים לא נשמרו. שמור כדי לשמור, או צא ללא שמירה.", ()=>{
          if (editDaySnapshot) setActivePlan(p=>({...p,days:{...p.days,[selDay]:editDaySnapshot}}));
          setEditDayDirty(false);
          setView(backDest);
        }, "צא ללא שמירה", {background:"rgba(255,120,0,.2)",borderColor:"rgba(255,120,0,.4)",color:"#ffa040"});
      } else {
        setView(backDest);
      }
    }

    return (
      <Wrap>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <button className="back-btn" onClick={handleBack}>→ חזרה</button>
          <h2 style={{fontSize:18,fontWeight:800}}>{getDayName(selDay)}</h2>
          <button className="btn-p" style={{fontSize:12,padding:"7px 14px",opacity:editDayDirty?1:.5}} onClick={saveEdit}>💾 שמור</button>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
          {dayExs.map((ex,idx)=>(
            <div key={ex.id} className="card up" style={{animationDelay:`${idx*.05}s`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <button onClick={()=>{
                      if(idx===0) return;
                      const exs=[...dayExs];
                      [exs[idx-1],exs[idx]]=[exs[idx],exs[idx-1]];
                      setActivePlan(p=>({...p,days:{...p.days,[selDay]:{...p.days[selDay],exercises:exs}}}));
                      if(selClient) setClients(p=>p.map(c=>c.id===selClient?{...c,plan:{...activePlan,days:{...activePlan.days,[selDay]:{...activePlan.days[selDay],exercises:exs}}}}:c));
                      setEditDayDirty(false);
                    }} style={{background:"rgba(108,63,255,.1)",border:"1px solid rgba(108,63,255,.25)",borderRadius:7,color:idx===0?"#333355":"#a855f7",cursor:idx===0?"default":"pointer",fontSize:15,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>▲</button>
                    <button onClick={()=>{
                      if(idx===dayExs.length-1) return;
                      const exs=[...dayExs];
                      [exs[idx+1],exs[idx]]=[exs[idx],exs[idx+1]];
                      setActivePlan(p=>({...p,days:{...p.days,[selDay]:{...p.days[selDay],exercises:exs}}}));
                      if(selClient) setClients(p=>p.map(c=>c.id===selClient?{...c,plan:{...activePlan,days:{...activePlan.days,[selDay]:{...activePlan.days[selDay],exercises:exs}}}}:c));
                      setEditDayDirty(false);
                    }} style={{background:"rgba(108,63,255,.1)",border:"1px solid rgba(108,63,255,.25)",borderRadius:7,color:idx===dayExs.length-1?"#333355":"#a855f7",cursor:idx===dayExs.length-1?"default":"pointer",fontSize:15,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>▼</button>
                  </div>
                </div>
                <div style={{flex:1,minWidth:0,textAlign:"right"}}>
                  {ex.muscleGroup&&<div style={{fontSize:11,color:"#a855f7",fontWeight:700,marginBottom:3,letterSpacing:.3}}>{ex.muscleGroup}</div>}
                  <span style={{fontWeight:700,fontSize:15}}>{ex.name}</span>
                </div>
                <button className="btn-d" style={{fontSize:11,flexShrink:0,marginRight:0,marginBottom:"auto"}} onClick={()=>askConfirm(`להסיר "${ex.name}"?`,()=>{removeExercise(selDay,ex.id);setEditDayDirty(true);})}>🗑</button>
              </div>
              {ex.description&&<p style={{fontSize:12,color:"#888899",marginBottom:8,lineHeight:1.5}}>{ex.description}</p>}
              {isYT(ex.youtubeUrl)&&getYTThumb(ex.youtubeUrl)&&<div style={{marginBottom:8,position:"relative",cursor:"pointer"}} onClick={()=>setYtModal({url:ex.youtubeUrl,title:ex.name})}><img src={getYTThumb(ex.youtubeUrl)} style={{width:"100%",borderRadius:10,opacity:.85}} alt=""/><div style={{position:"absolute",bottom:8,right:8,width:24,height:24,borderRadius:6,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"rgba(255,255,255,.8)"}}>▶</div></div>}
              <div style={{display:"flex",gap:12}}>
                <div style={{flex:1}}><div style={{fontSize:12,color:"#9999bb",marginBottom:6,fontWeight:600}}>סטים</div><Stepper value={ex.sets} onChange={v=>{updateExField(selDay,ex.id,"sets",v);setEditDayDirty(true);}}/></div>
                <div style={{flex:1}}><div style={{fontSize:12,color:"#9999bb",marginBottom:6,fontWeight:600}}>חזרות מומלצות</div><Stepper value={ex.targetReps||12} min={1} max={100} onChange={v=>{updateExField(selDay,ex.id,"targetReps",v);setEditDayDirty(true);}}/></div>
              </div>
              {(()=>{const lp=getLastPerf(ex.id,ex.name);return lp?.[0]?(
                <div style={{background:"rgba(108,63,255,.07)",border:"1px solid rgba(108,63,255,.2)",borderRadius:10,padding:"10px 12px",marginTop:10}}>
                  <div style={{fontSize:11,color:"#a855f7",fontWeight:700,marginBottom:7}}>📊 אחרון — {lp[0].date}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {lp[0].sets.map((s,i)=>(
                      <div key={i} style={{background:"rgba(255,255,255,.06)",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#c0c0d8",display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:44}}>
                        <span style={{color:"#a855f7",fontWeight:700,fontSize:10}}>סט {s.setNum}</span>
                        <span style={{fontWeight:700,fontSize:12,color:"#e8e8f0"}}>{s.weight||"—"}<span style={{fontSize:9,color:"#666688"}}> ק"ג</span></span>
                        <span style={{fontSize:11,color:"#9999bb"}}>×{s.reps||"—"}</span>
                        {s.done&&<span style={{color:"#4ade80",fontSize:9}}>✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ):null;})()}
            </div>
          ))}
        </div>

        <button className="btn-p" style={{width:"100%",padding:14,fontSize:15}} onClick={()=>setShowPicker(true)}>📚 הוסף תרגילים מהמאגר</button>
        <button className="btn-g" style={{width:"100%",marginTop:8,padding:12,fontSize:14}} onClick={()=>{setWorkoutPickerTab("workouts");setWorkoutPickerDay(selDay);}}>💪 שבץ אימון מהמאגר</button>
        {library.exercises.length===0&&<p style={{textAlign:"center",padding:"10px 0",color:"#555570",fontSize:13}}>המאגר ריק — <span style={{color:"#a855f7",cursor:"pointer"}} onClick={()=>setView("addExercise")}>הוסף תרגיל</span></p>}
        <button className="btn-p" style={{width:"100%",marginTop:10,padding:12,opacity:editDayDirty?1:.5}} onClick={saveEdit}>💾 שמור שינויים</button>

        {showPicker&&<ExercisePicker library={library} alreadyAdded={alreadyIds}
          inPlan={Object.values(activePlan.days||{}).flatMap(d=>(d?.exercises||[]).map(e=>e.libraryId||e.id))}
          onAdd={exs=>{addExercisesToDay(exs);setEditDayDirty(true);}} onClose={()=>setShowPicker(false)} onGoToLib={()=>{setShowPicker(false);setView("addExercise");}}/>}

        {/* Workout & Plan picker */}
        {workoutPickerDay!==null && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:999}} onClick={()=>setWorkoutPickerDay(null)}>
            <div style={{background:"#12121e",borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:480,maxHeight:"80vh",overflowY:"auto",direction:"rtl"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <h3 style={{fontSize:17,fontWeight:800}}>שבץ מהמאגר</h3>
                <button className="btn-g" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setWorkoutPickerDay(null)}>✕</button>
              </div>

              {/* Tabs */}
              <div style={{display:"flex",gap:6,marginBottom:14,background:"rgba(255,255,255,.04)",padding:4,borderRadius:12}}>
                <button className={`tab-btn ${workoutPickerTab==="workouts"?"tab-on":"tab-off"}`} style={{flex:1}} onClick={()=>setWorkoutPickerTab("workouts")}>💪 אימונים</button>
                <button className={`tab-btn ${workoutPickerTab==="plans"?"tab-on":"tab-off"}`} style={{flex:1}} onClick={()=>setWorkoutPickerTab("plans")}>📋 תכניות</button>
              </div>

              {workoutPickerTab==="workouts" && (
                library.workouts.length===0
                  ? <p style={{color:"#555570",textAlign:"center",padding:20}}>אין אימונים שמורים</p>
                  : library.workouts.map(w=>(
                    <div key={w.id} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(108,63,255,.2)",borderRadius:14,padding:"12px 14px",marginBottom:10,cursor:"pointer"}}
                      onClick={()=>{
                        const newExs=(w.exercises||[]).map(e=>({...e,id:Date.now()+Math.random(),libraryId:e.id,weights:{},reps:{}}));
                        setActivePlan(p=>({...p,days:{...p.days,[workoutPickerDay]:{exercises:[...(p.days[workoutPickerDay]?.exercises||[]),...newExs]}}}));
                        setActivePlan(p=>{const dn={...(p.dayNames||{})};if(!dn[workoutPickerDay]||dn[workoutPickerDay]===`אימון ${workoutPickerDay+1}`)dn[workoutPickerDay]=w.name;return {...p,dayNames:dn};});
                        if(selClient) logAssignment(selClient, w.name, w.exercises||[]);
                        setWorkoutPickerDay(null);
                        setEditDayDirty(true);
                      }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div style={{fontWeight:700,fontSize:15}}>{w.name}</div>
                        <span style={{fontSize:11,color:"#a855f7",background:"rgba(108,63,255,.12)",border:"1px solid rgba(108,63,255,.25)",borderRadius:8,padding:"2px 8px"}}>{w.exercises?.length||0} תרגילים</span>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        {(w.exercises||[]).map((e,ei)=>(
                          <div key={ei} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 6px",background:"rgba(255,255,255,.03)",borderRadius:7}}>
                            <div style={{width:18,height:18,borderRadius:5,background:"rgba(108,63,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#a855f7",flexShrink:0}}>{ei+1}</div>
                            <span style={{fontSize:12,fontWeight:600,flex:1}}>{e.name}</span>
                            {e.muscleGroup&&<span style={{fontSize:10,color:"#666688"}}>{e.muscleGroup}</span>}
                            {isYT(e.youtubeUrl)&&<span style={{fontSize:9,color:"#ff4444",background:"rgba(255,0,0,.15)",border:"1px solid rgba(255,0,0,.3)",borderRadius:5,padding:"1px 5px",fontWeight:700,flexShrink:0}}>▶</span>}
                            <span style={{fontSize:10,color:"#555570"}}>{e.sets}×{e.targetReps}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              )}

              {workoutPickerTab==="plans" && (
                library.plans.length===0
                  ? <p style={{color:"#555570",textAlign:"center",padding:20}}>אין תכניות שמורות</p>
                  : library.plans.map(plan=>(
                    <div key={plan.id} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(108,63,255,.2)",borderRadius:14,padding:"12px 14px",marginBottom:10}}>
                      <div style={{fontWeight:700,fontSize:15,marginBottom:3}}>{plan.name}</div>
                      <div style={{color:"#666688",fontSize:12,marginBottom:10}}>{plan.workoutsPerWeek} אימונים בשבוע</div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {Array.from({length:plan.workoutsPerWeek},(_,di)=>{
                          const dayExsP=plan.days?.[di]?.exercises||[];
                          const dayNm=plan.dayNames?.[di]||`אימון ${di+1}`;
                          return dayExsP.length>0?(
                            <div key={di} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(108,63,255,.06)",borderRadius:10,padding:"8px 12px",cursor:"pointer",border:"1px solid rgba(108,63,255,.15)"}}
                              onClick={()=>{
                                const newExs=dayExsP.map(e=>({...e,id:Date.now()+Math.random(),libraryId:e.id,weights:{},reps:{}}));
                                setActivePlan(p=>({...p,days:{...p.days,[workoutPickerDay]:{exercises:[...(p.days[workoutPickerDay]?.exercises||[]),...newExs]}}}));
                                setActivePlan(p=>{const dn={...(p.dayNames||{})};if(!dn[workoutPickerDay]||dn[workoutPickerDay]===`אימון ${workoutPickerDay+1}`)dn[workoutPickerDay]=dayNm;return {...p,dayNames:dn};});
                                if(selClient) logAssignment(selClient, dayNm, dayExsP);
                                setWorkoutPickerDay(null);
                                setEditDayDirty(true);
                              }}>
                              <div>
                                <span style={{fontWeight:600,fontSize:13}}>{dayNm}</span>
                                <span style={{fontSize:11,color:"#666688",marginRight:8}}>{dayExsP.length} תרגילים</span>
                              </div>
                              <span style={{color:"#a855f7",fontSize:13}}>שבץ ←</span>
                            </div>
                          ):null;
                        })}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </Wrap>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: ATHLETE HOME ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="athleteHome") {
    const isTrainer=!!selClient;
    const client=selClient?clients.find(c=>c.id===selClient):null;
    const totalEx=activeDays.reduce((a,i)=>a+(activePlan.days[i]?.exercises?.length||0),0);

    return (
      <Wrap>
        {/* Active workout banner */}
        {activeWorkout&&(
          <div style={{background:"linear-gradient(135deg,rgba(34,197,94,.15),rgba(22,163,74,.1))",border:"1px solid rgba(34,197,94,.35)",borderRadius:14,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:13,fontWeight:700,color:"#4ade80"}}>🏋️ אימון בהמשך</div><div style={{fontSize:11,color:"#666688",marginTop:2}}>{getDayName(activeWorkout.dayIdx)}</div></div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn-grn" style={{fontSize:12,padding:"7px 14px"}} onClick={()=>startWorkout(activeWorkout.dayIdx)}>▶ המשך</button>
              <button className="btn-d" style={{fontSize:11,padding:"7px 10px"}} onClick={()=>setActiveWorkout(null)}>✕</button>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isTrainer?16:0}}>
          {isTrainer&&<button className="back-btn" onClick={()=>setView("trainer")}>← חזור למאמן</button>}
        </div>

        {/* Logo + name */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:22,marginTop:isTrainer?0:0}}>
          {settings.logoUrl
            ? <img src={settings.logoUrl} alt="לוגו" style={{maxHeight:80,maxWidth:200,objectFit:"contain",marginBottom:10,borderRadius:12}}/>
            : <div style={{width:60,height:60,background:"linear-gradient(135deg,#6c3fff,#a855f7)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:"0 8px 30px rgba(108,63,255,.4)",marginBottom:10}}>💪</div>
          }
          <h1 style={{fontSize:19,fontWeight:800,background:"linear-gradient(135deg,#e8e8f0,#a855f7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{settings.gymName}</h1>
          {client&&<p style={{fontSize:14,color:"#9999bb",marginTop:4,fontWeight:600}}>{client.name}</p>}
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
          <div className="card" style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,color:"#a855f7"}}>{activePlan.workoutsPerWeek}</div><div style={{color:"#666688",fontSize:12,marginTop:2}}>אימונים בשבוע</div></div>
          <div className="card" style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,color:"#a855f7"}}>{totalEx}</div><div style={{color:"#666688",fontSize:12,marginTop:2}}>סה"כ תרגילים</div></div>
        </div>

        <div className="card" style={{marginBottom:18,textAlign:"center",padding:"14px 20px"}}>
          <div style={{fontSize:17,fontWeight:700}}>{activePlan.name}</div>
        </div>

        {/* Day list */}
        <h2 style={{fontSize:14,fontWeight:700,color:"#9999bb",marginBottom:10}}>ימי האימון</h2>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          {(()=>{
            const hist=selClient?(clients.find(c=>c.id===selClient)?.history||[]):myHistory;
            const lastSession=hist[0]; // most recent overall
            return activeDays.map(i=>{
            const exs=activePlan.days[i]?.exercises||[];
            const lastS=hist.find(h=>h.dayIdx===i);
            const isLastTrained=lastSession&&lastSession.dayIdx===i;
            return (
              <div key={i} className="day-card up" style={{animationDelay:`${i*.05}s`,cursor:exs.length>0?"pointer":"default"}}
                onClick={()=>{
                  if(exs.length>0){
                    setSelDay(i);
                    setCompletedSets(activeWorkout&&activeWorkout.dayIdx===i?activeWorkout.completedSets:{});
                    setWorkoutStarted(activeWorkout&&activeWorkout.dayIdx===i);
                    setOpenExId(new Set());
                    window.scrollTo(0,0);
                    setView("workout");
                  }
                }}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                    <div style={{width:32,height:32,borderRadius:9,background:"rgba(108,63,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#a855f7",flexShrink:0}}>{i+1}</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:15}}>{getDayName(i)}</div>
                      <div style={{color:"#666688",fontSize:11,marginTop:2}}>
                        {exs.length>0?`${exs.length} תרגילים`:"ריק"}
                        {isLastTrained&&lastSession.date&&<span style={{color:"#4ade80",marginRight:6}}> · אחרון: {lastSession.date}</span>}
                      </div>
                    </div>
                  </div>
                  {activeWorkout&&activeWorkout.dayIdx===i&&<span style={{fontSize:12,color:"#a855f7",fontWeight:700}}>▶ מושהה</span>}
                </div>
                {exs.length>0&&<div className="pbar" style={{marginTop:8}}><div className="pfill" style={{width:"100%"}}/></div>}
              </div>
            );
          });
          })()}
        </div>

        {previewDay!==null&&<PreviewModal plan={activePlan} dayIdx={previewDay} getDayName={getDayName} onClose={()=>setPreviewDay(null)} onStart={startWorkout} isTrainer={isTrainer} onYt={(url,title)=>setYtModal({url,title})} getLastPerf={getLastPerf} onShowHistory={(name,sessions)=>{setPreviewDay(null);setHistModal({exName:name,sessions});}}/>}
        {ytModal&&<YouTubeModal url={ytModal.url} title={ytModal.title} onClose={()=>setYtModal(null)}/>}
        <HistModal/>

        {/* Progress button */}
        {(selClient?client?.history?.length:myHistory.length)>0&&(
          <button className="btn-g" style={{width:"100%",marginTop:6,fontSize:13}} onClick={()=>{setProgressFrom("athleteHome");setView(selClient?"clientProgress":"progress");window.scrollTo(0,0);}}>
            📈 {selClient?`התקדמות ${client?.name}`:"ההתקדמות שלי"}
          </button>
        )}

        {!isTrainer&&<div style={{marginTop:16,textAlign:"center"}}><button className="back-btn" style={{margin:"0 auto",fontSize:13,color:"#555570"}} onClick={()=>setView("trainer")}>← חזור למאמן</button></div>}
      </Wrap>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: CLIENT PROGRESS ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="clientProgress") {
    const client=clients.find(c=>c.id===selClient); if(!client){setView("trainer");return null;}
    const hist=client.history||[];
    // Build name-based map — key=name, aggregate across all sessions
    const exNames=new Set();
    hist.forEach(s=>s.exercises?.forEach(e=>{if(e.name)exNames.add(e.name);}));
    const exMap={}; exNames.forEach(n=>{exMap[n]=n;});
    const exIds=[...exNames];
    function getExHist(exName) {
      return hist.map(s=>{
        const ex=s.exercises?.find(e=>e.name===exName);
        if(!ex)return null;
        const ws=ex.sets.map(st=>parseFloat(st.weight)||0).filter(w=>w>0);
        const rs=ex.sets.map(st=>parseFloat(st.reps)||0).filter(r=>r>0);
        if(!ws.length&&!rs.length)return null;
        return{date:s.date,maxWeight:ws.length?Math.max(...ws):0,avgReps:rs.length?Math.round(rs.reduce((a,b)=>a+b,0)/rs.length):0};
      }).filter(Boolean).reverse();
    }
    return (
      <Wrap>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
          <button className="back-btn" onClick={()=>setView(progressFrom)}>→ חזרה</button>
          <h2 style={{fontSize:19,fontWeight:800}}>📈 התקדמות {client.name}</h2>
        </div>
        <h3 style={{fontSize:14,fontWeight:700,color:"#9999bb",marginBottom:10}}>היסטוריית אימונים</h3>
        {(()=>{
          const visible = showAllHist ? hist : hist.slice(0,3);
          return (
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
              {hist.length===0
                ? <div className="card" style={{textAlign:"center",color:"#555570",padding:24}}>אין אימונים עדיין</div>
                : <>
                  {visible.map((s,i)=>(
                    <div key={i} className="card" style={{padding:"14px 18px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontWeight:700,fontSize:15}}>{s.dayName}</div><div style={{color:"#666688",fontSize:12,marginTop:3,display:"flex",gap:12}}><span>📅 {s.date}</span>{s.startTime&&<span>🕐 {new Date(s.startTime).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</span>}{s.duration>0&&<span>⏱ {fmtTime(s.duration)}</span>}</div></div>
                        <div style={{fontSize:22}}>{"🏆"}</div>
                      </div>
                    </div>
                  ))}
                  {hist.length>3&&<button onClick={()=>setShowAllHist(o=>!o)} style={{width:"100%",padding:"8px 0",background:"rgba(108,63,255,.08)",border:"1px solid rgba(108,63,255,.2)",borderRadius:10,color:"#a855f7",fontFamily:"'Rubik',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    {showAllHist?`▲ הצג פחות`:`▼ הצג עוד ${hist.length-3} אימונים`}
                  </button>}
                </>
              }
            </div>
          );
        })()}
        {(()=>{
  // Build per-exercise session history
  const exSessionMap={};
  const exMuscleMap={};
  // Build muscle map from library first (most up-to-date)
  library.exercises.forEach(e=>{ if(e.name&&e.muscleGroup) exMuscleMap[e.name]=e.muscleGroup; });
  Object.values(activePlan.days||{}).forEach(day=>(day?.exercises||[]).forEach(e=>{ if(e.name&&e.muscleGroup&&!exMuscleMap[e.name]) exMuscleMap[e.name]=e.muscleGroup; }));
  hist.forEach(s=>{
    (s.exercises||[]).forEach(ex=>{
      const nm=ex.name; if(!nm) return;
      if(!exSessionMap[nm]) exSessionMap[nm]=[];
      if(!exMuscleMap[nm]&&ex.muscleGroup) exMuscleMap[nm]=ex.muscleGroup;
      const allDone=(ex.sets||[]).length>0&&(ex.sets||[]).every(st=>st.done);
      if(allDone&&exSessionMap[nm].length<3) exSessionMap[nm].push({date:s.date,sets:ex.sets||[]});
    });
  });
  const names=Object.keys(exSessionMap).filter(nm=>exSessionMap[nm].some(s=>s.sets.some(st=>st.weight||st.reps)));
  // group by muscle
  const muscleGroups={};
  names.forEach(nm=>{
    const g=exMuscleMap[nm]||"ללא קטגוריה";
    if(!muscleGroups[g]) muscleGroups[g]=[];
    muscleGroups[g].push(nm);
  });
  const sortedMuscles=Object.keys(muscleGroups).sort((a,b)=>muscleRank(a)-muscleRank(b));
  return names.length>0?<>
    <h3 style={{fontSize:14,fontWeight:700,color:"#9999bb",marginBottom:12}}>היסטוריה לפי תרגיל</h3>
    {sortedMuscles.map(muscle=>(
      <div key={muscle} style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{height:1,flex:1,background:"rgba(108,63,255,.2)"}}/>
          <span style={{fontSize:11,fontWeight:700,color:"#a855f7",background:"rgba(108,63,255,.12)",border:"1px solid rgba(108,63,255,.25)",borderRadius:8,padding:"3px 12px"}}>{muscle}</span>
          <div style={{height:1,flex:1,background:"rgba(108,63,255,.2)"}}/>
        </div>
        {muscleGroups[muscle].map(nm=><ExerciseHistory key={nm} name={nm} sessions={exSessionMap[nm]}/>)}
      </div>
    ))}
  </>:null;
})()}
      </Wrap>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: PROGRESS (athlete) ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="progress") {
    const hist=myHistory;
    // Build name-based map — key=name, aggregate across all sessions
    const exNames=new Set();
    hist.forEach(s=>s.exercises?.forEach(e=>{if(e.name)exNames.add(e.name);}));
    const exMap={}; exNames.forEach(n=>{exMap[n]=n;});
    const exIds=[...exNames];
    function getExHist(exName) {
      return hist.map(s=>{
        const ex=s.exercises?.find(e=>e.name===exName);
        if(!ex)return null;
        const ws=ex.sets.map(st=>parseFloat(st.weight)||0).filter(w=>w>0);
        const rs=ex.sets.map(st=>parseFloat(st.reps)||0).filter(r=>r>0);
        if(!ws.length&&!rs.length)return null;
        return{date:s.date,maxWeight:ws.length?Math.max(...ws):0,avgReps:rs.length?Math.round(rs.reduce((a,b)=>a+b,0)/rs.length):0};
      }).filter(Boolean).reverse();
    }
    return (
      <Wrap>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
          <button className="back-btn" onClick={()=>setView("athleteHome")}>→ חזרה</button>
          <h2 style={{fontSize:19,fontWeight:800}}>📈 ההתקדמות שלי</h2>
        </div>
        <h3 style={{fontSize:14,fontWeight:700,color:"#9999bb",marginBottom:10}}>היסטוריית אימונים</h3>
        {(()=>{
          const visible = showAllHist ? hist : hist.slice(0,3);
          return (
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
              {hist.length===0
                ? <div className="card" style={{textAlign:"center",color:"#555570",padding:24}}>אין אימונים עדיין</div>
                : <>
                  {visible.map((s,i)=>(
                    <div key={i} className="card" style={{padding:"14px 18px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontWeight:700,fontSize:15}}>{s.dayName}</div><div style={{color:"#666688",fontSize:12,marginTop:3,display:"flex",gap:12}}><span>📅 {s.date}</span>{s.startTime&&<span>🕐 {new Date(s.startTime).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</span>}{s.duration>0&&<span>⏱ {fmtTime(s.duration)}</span>}</div></div>
                        <div style={{fontSize:22}}>{"🏆"}</div>
                      </div>
                    </div>
                  ))}
                  {hist.length>3&&<button onClick={()=>setShowAllHist(o=>!o)} style={{width:"100%",padding:"8px 0",background:"rgba(108,63,255,.08)",border:"1px solid rgba(108,63,255,.2)",borderRadius:10,color:"#a855f7",fontFamily:"'Rubik',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    {showAllHist?`▲ הצג פחות`:`▼ הצג עוד ${hist.length-3} אימונים`}
                  </button>}
                </>
              }
            </div>
          );
        })()}
        {(()=>{
  // Build per-exercise session history
  const exSessionMap={};
  const exMuscleMap={};
  // Build muscle map from library first (most up-to-date)
  library.exercises.forEach(e=>{ if(e.name&&e.muscleGroup) exMuscleMap[e.name]=e.muscleGroup; });
  Object.values(activePlan.days||{}).forEach(day=>(day?.exercises||[]).forEach(e=>{ if(e.name&&e.muscleGroup&&!exMuscleMap[e.name]) exMuscleMap[e.name]=e.muscleGroup; }));
  hist.forEach(s=>{
    (s.exercises||[]).forEach(ex=>{
      const nm=ex.name; if(!nm) return;
      if(!exSessionMap[nm]) exSessionMap[nm]=[];
      if(!exMuscleMap[nm]&&ex.muscleGroup) exMuscleMap[nm]=ex.muscleGroup;
      const allDone=(ex.sets||[]).length>0&&(ex.sets||[]).every(st=>st.done);
      if(allDone&&exSessionMap[nm].length<3) exSessionMap[nm].push({date:s.date,sets:ex.sets||[]});
    });
  });
  const names=Object.keys(exSessionMap).filter(nm=>exSessionMap[nm].some(s=>s.sets.some(st=>st.weight||st.reps)));
  // group by muscle
  const muscleGroups={};
  names.forEach(nm=>{
    const g=exMuscleMap[nm]||"ללא קטגוריה";
    if(!muscleGroups[g]) muscleGroups[g]=[];
    muscleGroups[g].push(nm);
  });
  const sortedMuscles=Object.keys(muscleGroups).sort((a,b)=>muscleRank(a)-muscleRank(b));
  return names.length>0?<>
    <h3 style={{fontSize:14,fontWeight:700,color:"#9999bb",marginBottom:12}}>היסטוריה לפי תרגיל</h3>
    {sortedMuscles.map(muscle=>(
      <div key={muscle} style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{height:1,flex:1,background:"rgba(108,63,255,.2)"}}/>
          <span style={{fontSize:11,fontWeight:700,color:"#a855f7",background:"rgba(108,63,255,.12)",border:"1px solid rgba(108,63,255,.25)",borderRadius:8,padding:"3px 12px"}}>{muscle}</span>
          <div style={{height:1,flex:1,background:"rgba(108,63,255,.2)"}}/>
        </div>
        {muscleGroups[muscle].map(nm=><ExerciseHistory key={nm} name={nm} sessions={exSessionMap[nm]}/>)}
      </div>
    ))}
  </>:null;
})()}
      </Wrap>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: WORKOUT ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="workout") {
    const exs=activePlan.days[selDay]?.exercises||[];
    const totalSets=exs.reduce((a,e)=>a+e.sets,0);
    const doneSets=Object.values(completedSets).filter(Boolean).length;
    const pct=totalSets>0?Math.round((doneSets/totalSets)*100):0;
    const finished=pct===100&&totalSets>0;

    // Group by muscle — sorted anatomically
    const groups={};
    exs.forEach((ex,idx)=>{const g=ex.muscleGroup||"כללי";if(!groups[g])groups[g]=[];groups[g].push({ex,idx});});
    const sortedGroups=Object.entries(groups).sort((a,b)=>muscleRank(a[0])-muscleRank(b[0]));

    return (
      <Wrap>
        <div style={{display:"flex",alignItems:"center",marginBottom:6}}>
          <button className="back-btn" onClick={()=>workoutStarted?setExitConfirm(true):(setView(selClient?"athleteHome":"trainer"))}>→ חזרה</button>
        </div>
        <h2 style={{fontSize:22,fontWeight:800,textAlign:"center",marginBottom:10}}>{getDayName(selDay)}</h2>

        {/* Start button — shown only before workout starts */}
        {!workoutStarted&&(
          <button className="btn-p" style={{width:"100%",padding:14,fontSize:15,marginBottom:16,fontWeight:800}} onClick={()=>{
            if(activeWorkout&&activeWorkout.dayIdx===selDay){
              startRef.current=Date.now()-((activeWorkout.elapsed||0)*1000);
              elapsedRef.current=activeWorkout.elapsed||0;
            } else {
              startRef.current=Date.now();
              elapsedRef.current=0;
              // אפס משקלים וחזרות לאימון חדש
              setActivePlan(p=>({...p,days:{...p.days,[selDay]:{...p.days[selDay],exercises:(p.days[selDay]?.exercises||[]).map(e=>({...e,weights:{},reps:{}}))}}}));
              setActiveWorkout({dayIdx:selDay,startTime:Date.now(),completedSets:{}});
            }
            setWorkoutStarted(true);
          }}>{ activeWorkout&&activeWorkout.dayIdx===selDay ? "▶ המשך אימון" : "▶ התחל אימון" }</button>
        )}

        {/* Exit confirm */}
        {exitConfirm&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:20}}>
            <div style={{background:"#1a1a2a",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:28,width:"100%",maxWidth:320,direction:"rtl",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
              <h3 style={{fontSize:17,fontWeight:800,marginBottom:8}}>לצאת מהאימון?</h3>
              <p style={{fontSize:13,color:"#9999bb",marginBottom:22,lineHeight:1.5}}>ניתן להמשיך מאוחר יותר</p>
              <div style={{display:"flex",gap:10,marginBottom:8}}>
                <button className="btn-d" style={{flex:1,padding:"11px 0",fontSize:14,borderRadius:12}} onClick={()=>{setActiveWorkout(aw=>aw?{...aw,completedSets}:aw);setExitConfirm(false);setView(selClient?"athleteHome":"trainer");}}>⏸ השהה</button>
                <button className="btn-p" style={{flex:1,padding:"11px 0",fontSize:14}} onClick={()=>{setExitConfirm(false);finishWorkout();}}>🏁 סיים</button>
              </div>
              <button className="btn-g" style={{width:"100%",marginBottom:8,fontSize:13,color:"#ff5555",borderColor:"rgba(255,80,80,.3)"}}
                onClick={()=>{setExitConfirm(false);askConfirm("לבטל את האימון לחלוטין? כל הנתונים יימחקו.",()=>{setActiveWorkout(null);setCompletedSets({});setWorkoutStarted(false);setView(selClient?"athleteHome":"trainer");},"בטל אימון",{background:"rgba(255,80,80,.15)",borderColor:"rgba(255,80,80,.4)",color:"#ff5555"});}}>
                🗑 בטל אימון (ללא שמירה)
              </button>
              <button className="btn-g" style={{width:"100%",fontSize:13}} onClick={()=>setExitConfirm(false)}>המשך אימון</button>
            </div>
          </div>
        )}

        {/* Timer + progress */}
        {workoutStarted&&<div className="card" style={{marginBottom:16,textAlign:"center"}}>
          <Stopwatch startTime={startRef.current} onTick={s=>{elapsedRef.current=s;}}/>
          <div style={{fontSize:26,fontWeight:800,color:finished?"#4ade80":"#a855f7"}}>{pct}%</div>
          <div style={{color:"#666688",fontSize:12}}>{doneSets}/{totalSets} סטים הושלמו</div>
          <div className="pbar" style={{marginTop:8}}><div className="pfill" style={{width:`${pct}%`,background:finished?"linear-gradient(90deg,#22c55e,#4ade80)":undefined}}/></div>
          {finished&&<div style={{marginTop:10,color:"#4ade80",fontWeight:700,fontSize:13}}>🎉 סיימת!</div>}
        </div>}

        {/* Exercises grouped */}
        <div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {exs.map((ex,idx)=>{
                const doneFx=Array.from({length:ex.sets},(_,i)=>`${ex.id}-${i}`).filter(k=>completedSets[k]).length;
                const allDone=doneFx===ex.sets;
                const isOpen=openExId.has(ex.id);
                const thumb=getYTThumb(ex.youtubeUrl);
                const cardBorder=allDone?"rgba(34,197,94,.3)":isOpen?"rgba(108,63,255,.5)":"rgba(108,63,255,.2)";
                return (
                  <div key={ex.id} className="up" style={{borderRadius:16,overflow:"hidden",border:`1px solid ${cardBorder}`,background:"linear-gradient(145deg,#12121e,#1a1a2a)",animationDelay:`${idx*.05}s`,transition:"border-color .2s"}}>

                    {/* ── Header card ── */}
                    <div style={{display:"flex",alignItems:"stretch",minHeight:90}}>
                      {/* Thumbnail or purple placeholder */}
                      <div style={{width:100,flexShrink:0,position:"relative",cursor:isYT(ex.youtubeUrl)?"pointer":"default"}}
                        onClick={()=>isYT(ex.youtubeUrl)&&setYtModal({url:ex.youtubeUrl,title:ex.name})}>
                        {thumb
                          ? <img src={thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#6c3fff33,#a855f711)"}}/>
                        }
                        {isYT(ex.youtubeUrl)&&<div style={{position:"absolute",bottom:6,right:6,width:22,height:22,borderRadius:5,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,.8)"}}>▶</div>}
                      </div>

                      {/* Info */}
                      <div style={{flex:1,padding:"12px 14px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                            {allDone&&<span style={{fontSize:14}}>✅</span>}
                            <span style={{fontSize:15,fontWeight:700,color:"#e8e8f0"}}>{ex.name}</span>
                          </div>
                          <div style={{fontSize:12,color:"#888899"}}>{ex.sets} סטים × {ex.targetReps||12} חזרות{ex.muscleGroup&&<span style={{color:"#4ade80",fontWeight:600,marginRight:6}}> · {ex.muscleGroup}</span>}</div>
                          <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap",alignItems:"center"}}>
                            <span className={allDone?"tag-grn":"tag"} style={{fontSize:10}}>{doneFx}/{ex.sets} הושלמו</span>
                            {(()=>{const lp=getLastPerf(ex.id,ex.name);return lp?<button onClick={()=>setHistModal({exName:ex.name,sessions:lp})} style={{background:"rgba(168,85,247,.15)",border:"1px solid rgba(168,85,247,.3)",color:"#a855f7",borderRadius:8,padding:"2px 8px",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'Rubik',sans-serif"}}>📋</button>:null;})()}
                            {(()=>{
                              const lp=getLastPerf(ex.id,ex.name);
                              const lastSets=lp?.[0]?.sets||[];
                              const lastMaxWeight=lastSets.length?Math.max(...lastSets.map(s=>parseFloat(s.weight)||0)):0;
                              const startWeight=lastMaxWeight>0?Math.round(lastMaxWeight*0.8)||lastMaxWeight:null;
                              return startWeight?<span style={{fontSize:10,color:"#4ade80",fontWeight:700}}>🏁 {lastMaxWeight} ק"ג</span>:null;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Expand button ── */}
                    <button onClick={()=>{if(!workoutStarted)return;setOpenExId(prev=>{const s=new Set(prev);s.has(ex.id)?s.delete(ex.id):s.add(ex.id);return s;})}}
                      style={{width:"100%",padding:"9px 14px",background:"rgba(108,63,255,.08)",border:"none",borderTop:"1px solid rgba(108,63,255,.15)",color:"#a855f7",fontFamily:"'Rubik',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"background .2s"}}>
                      <span style={{fontSize:14,transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s",display:"inline-block"}}>↓</span>
                      {isOpen?"סגור":"לחץ כדי לערוך"}
                    </button>

                    {/* ── Sets table (expanded) ── */}
                    {isOpen&&(
                      <div style={{padding:"12px 14px",borderTop:"1px solid rgba(108,63,255,.15)"}}>
                        {ex.description&&<p style={{fontSize:12,color:"#666688",marginBottom:10,lineHeight:1.4}}>{ex.description}</p>}
                        <div style={{display:"flex",gap:8,padding:"3px 0 8px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
                          <div style={{width:36,textAlign:"center",fontSize:10,color:"#555570",fontWeight:600}}>סט</div>
                          <div style={{width:72,textAlign:"center",fontSize:10,color:"#555570",fontWeight:600}}>משקל ק"ג</div>
                          <div style={{width:72,textAlign:"center",fontSize:10,color:"#555570",fontWeight:600}}>חזרות</div>
                          <div style={{flex:1,textAlign:"center",fontSize:10,color:"#555570",fontWeight:600}}>בוצע</div>
                        </div>
                        {(()=>{
                          const lp=getLastPerf(ex.id,ex.name);
                          const lastSets=lp?.[0]?.sets||[];
                          // fallback: use max weight from last session if specific set has no weight
                          const lastMaxWeight=lastSets.length?Math.max(...lastSets.map(s=>parseFloat(s.weight)||0)).toString():"";
                          const allSameWeight=lastSets.length>1&&lastSets.every(s=>parseFloat(s.weight||0)===parseFloat(lastSets[0]?.weight||0)&&parseFloat(s.weight||0)>0);
                          return Array.from({length:ex.sets},(_,i)=>{
                          const k=`${ex.id}-${i}`,done=completedSets[k];
                          const rawLastW=lastSets[i]?.weight||lastMaxWeight||"";
                          const lastWeight=i===0&&rawLastW&&!allSameWeight?String(Math.round(parseFloat(rawLastW)*0.8)||parseFloat(rawLastW)):rawLastW;
                          return (
                            <div key={i} className="set-row">
                              <div style={{width:36,height:32,borderRadius:8,flexShrink:0,background:done?"linear-gradient(135deg,#6c3fff,#a855f7)":"rgba(108,63,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:done?"#fff":"#a855f7"}}>{i+1}</div>
                              <WInput value={ex.weights?.[i]??""} placeholder={lastWeight||"—"} onSave={workoutStarted?v=>{
                                updateWeight(selDay,ex.id,i,v);
                                const effectiveReps={...ex.reps};
                                if(!effectiveReps[i]&&ex.targetReps) effectiveReps[i]=String(ex.targetReps);
                                autoCompleteSet(ex.id,i,{...ex.weights,[i]:v},effectiveReps);
                              }:()=>{}}/>
                              <RInput value={ex.reps?.[i]??(ex.targetReps?""+ex.targetReps:"12")} placeholder={ex.targetReps?""+ex.targetReps:"12"} onSave={workoutStarted?v=>{
                                updateReps(selDay,ex.id,i,v);
                                autoCompleteSet(ex.id,i,ex.weights,{...ex.reps,[i]:v});
                              }:()=>{}}/>
                              {(()=>{
                                const w=ex.weights?.[i]; const r=ex.reps?.[i];
                                const wOk=(w!=null&&w!==""&&parseFloat(w)>0)||(lastWeight&&parseFloat(lastWeight)>0);
                                const rOk=(r!=null&&r!==""&&parseFloat(r)>0)||(ex.targetReps&&parseFloat(ex.targetReps)>0);
                                const btnOk=workoutStarted&&(done||( wOk&&rOk));
                                return <button onClick={()=>{
                                if(!workoutStarted) return;
                                if(done){ toggleSet(ex.id,i); return; }
                                const wVal=ex.weights?.[i]; const hasW=wVal!=null&&wVal!==""&&parseFloat(wVal)>0;
                                const rVal=ex.reps?.[i];    const hasR=rVal!=null&&rVal!==""&&parseFloat(rVal)>0;
                                const effectiveWeight=hasW?wVal:lastWeight;
                                const effectiveReps=hasR?rVal:(ex.targetReps&&parseFloat(ex.targetReps)>0?""+ex.targetReps:"");
                                if(!effectiveWeight||parseFloat(effectiveWeight)<=0||!effectiveReps||parseFloat(effectiveReps)<=0) return;
                                if(!hasW&&effectiveWeight) updateWeight(selDay,ex.id,i,effectiveWeight);
                                if(!hasR&&effectiveReps)   updateReps(selDay,ex.id,i,effectiveReps);
                                toggleSet(ex.id,i);
                              }}
                                style={{flex:1,height:32,borderRadius:8,border:"none",cursor:btnOk?"pointer":"not-allowed",background:done?"linear-gradient(135deg,#22c55e,#16a34a)":"rgba(255,255,255,.05)",color:done?"#fff":"#666688",fontFamily:"'Rubik',sans-serif",fontSize:13,fontWeight:600,transition:"all .2s",opacity:btnOk?1:0.35}}>
                                {done?"✓ בוצע":"סמן"}
                              </button>;
                              })()}
                            </div>
                          );
                        });
                        })()}
                        <div style={{display:"flex",gap:8,marginTop:8}}>
                          <button style={{flex:1,background:"rgba(108,63,255,.1)",color:"#a855f7",border:"1px solid rgba(108,63,255,.25)",borderRadius:8,cursor:"pointer",fontFamily:"'Rubik',sans-serif",fontWeight:600,fontSize:12,padding:"6px 14px"}} onClick={()=>addExtraSet(selDay,ex.id)}>+ סט נוסף</button>
                          {ex.sets>(ex.originalSets??ex.sets)&&<button onClick={()=>removeExtraSet(selDay,ex.id)} style={{background:"rgba(255,80,80,.1)",color:"#ff5555",border:"1px solid rgba(255,80,80,.25)",borderRadius:8,cursor:"pointer",fontFamily:"'Rubik',sans-serif",fontWeight:600,fontSize:12,padding:"6px 14px"}}>− הסר סט</button>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
        </div>{/* end opacity wrapper */}

        {workoutStarted&&<div style={{margin:"16px 0 8px",padding:"10px 16px",borderRadius:12,background:doneSets===totalSets&&totalSets>0?"rgba(34,197,94,.1)":"rgba(255,80,80,.06)",border:`1px solid ${doneSets===totalSets&&totalSets>0?"rgba(34,197,94,.4)":"rgba(255,80,80,.2)"}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,fontWeight:700,color:doneSets===totalSets&&totalSets>0?"#4ade80":"#9999bb"}}>
            {doneSets===totalSets&&totalSets>0?"✅ כל הסטים הושלמו!":"סטים שהושלמו"}
          </span>
          <span style={{fontSize:15,fontWeight:800,color:doneSets===totalSets&&totalSets>0?"#4ade80":"#ff5555"}}>{doneSets}/{totalSets}</span>
        </div>}

        {workoutStarted&&<div style={{display:"flex",gap:10,marginTop:20}}>
          <button className="btn-g" style={{flex:1,padding:15,fontSize:14}} onClick={pauseWorkout}>⏸ השהה אימון</button>
          <button className="btn-p" style={{flex:2,padding:15,fontSize:15,background:"linear-gradient(135deg,#22c55e,#16a34a)"}} onClick={finishWorkout}>🏁 סיים אימון</button>
        </div>}
        {workoutStarted&&<button onClick={()=>askConfirm("לבטל את האימון לחלוטין? כל הנתונים יימחקו.",()=>{setActiveWorkout(null);setCompletedSets({});setWorkoutStarted(false);setView(selClient?"athleteHome":"trainer");},"בטל אימון",{background:"rgba(255,80,80,.15)",borderColor:"rgba(255,80,80,.4)",color:"#ff5555"})}
          style={{width:"100%",marginTop:8,padding:"6px 0",fontSize:12,color:"#ff5555",background:"rgba(255,80,80,.06)",border:"1px solid rgba(255,80,80,.2)",borderRadius:10,cursor:"pointer",fontFamily:"'Rubik',sans-serif",fontWeight:600}}>
          🗑 בטל אימון
        </button>}
        {ytModal&&<YouTubeModal url={ytModal.url} title={ytModal.title} onClose={()=>setYtModal(null)}/>}
        <HistModal/>
      </Wrap>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── VIEW: SUMMARY ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="summary"&&summary) {
    const totalDone=summary.exercises.reduce((a,e)=>a+e.sets.filter(x=>x.done).length,0);
    const totalAll=summary.exercises.reduce((a,e)=>a+e.sets.length,0);
    return (
      <Wrap>
        <div style={{display:"flex",justifyContent:"flex-start",marginBottom:16}}>
          <button className="back-btn" onClick={()=>setView(selClient?"athleteHome":"trainer")}>🏠 חזור לתפריט</button>
        </div>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:8}}>🏆</div>
          <h1 style={{fontSize:22,fontWeight:800,background:"linear-gradient(135deg,#4ade80,#22c55e)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>סיכום אימון</h1>
          <p style={{color:"#666688",fontSize:13,marginTop:4}}>{summary.dayName}</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
          <div className="card" style={{textAlign:"center",padding:"14px 10px"}}><div style={{fontSize:20,fontWeight:800,color:"#a855f7"}}>{fmtTime(summary.duration)}</div><div style={{color:"#666688",fontSize:11,marginTop:2}}>זמן</div></div>
          <div className="card" style={{textAlign:"center",padding:"14px 10px"}}><div style={{fontSize:20,fontWeight:800,color:"#a855f7"}}>{summary.exercises.length}</div><div style={{color:"#666688",fontSize:11,marginTop:2}}>תרגילים</div></div>
          <div className="card" style={{textAlign:"center",padding:"14px 10px"}}><div style={{fontSize:20,fontWeight:800,color:"#4ade80"}}>{totalDone}/{totalAll}</div><div style={{color:"#666688",fontSize:11,marginTop:2}}>סטים</div></div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {summary.exercises.map((ex,idx)=>(
            <div key={idx} className="card">
              <div style={{fontWeight:700,fontSize:15,marginBottom:10}}>{ex.name}</div>
              <div style={{display:"flex",gap:10,padding:"2px 0 8px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
                {["סט","משקל","חזרות","הושלם"].map((h,i)=><div key={i} style={{[i===0?"width":"flex"]:i===0?36:1,fontSize:10,color:"#555570",fontWeight:600,textAlign:"center"}}>{h}</div>)}
              </div>
              {ex.sets.map((st,si)=>(
                <div key={si} className="set-row">
                  <div style={{width:36,height:30,borderRadius:8,flexShrink:0,background:st.done?"linear-gradient(135deg,#22c55e,#16a34a)":"rgba(255,80,80,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:st.done?"#fff":"#ff5555"}}>{st.setNum}</div>
                  <div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:600,color:st.weight?"#e8e8f0":"#444460"}}>{st.weight||"—"}</div>
                  <div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:600,color:st.reps?"#e8e8f0":"#444460"}}>{st.reps||"—"}</div>
                  <div style={{flex:1,textAlign:"center",fontSize:12,fontWeight:600,color:st.done?"#4ade80":"#ff5555"}}>{st.done?"✓":"✕"}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <button className="btn-p" style={{width:"100%",padding:15,fontSize:15}} onClick={()=>setView(selClient?"athleteHome":"trainer")}>🏠 חזור לתפריט</button>
      </Wrap>
    );
  }

  return null;
}
