import { useState, useEffect, useRef, useCallback } from "react";

// ─── Design system — surveillance dark theme ──────────────────────────────────
const D = {
  bg0:"#080c12", bg1:"#0d1219", bg2:"#121a24", bg3:"#182030",
  accent:"#00e5a0", accentD:"#00b87f", accentL:"rgba(0,229,160,.12)",
  red:"#e84545",   redL:"rgba(232,69,69,.14)",
  amber:"#f5a623", amberL:"rgba(245,166,35,.13)",
  sky:"#3b8bd4",   skyL:"rgba(59,139,212,.13)",
  purple:"#7c5cfc",
  border:"#1a2740", border2:"#223354",
  text:"#c8d8e8",  textM:"#6a8aaa", textD:"#334d68",
  mono:"'JetBrains Mono',monospace",
  sans:"'Sora',sans-serif",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Sora:wght@400;500;600;700&display=swap');
  .cctv * { box-sizing:border-box; margin:0; padding:0; }
  .cctv { background:${D.bg0}; color:${D.text}; font-family:${D.sans}; font-size:13px; min-height:100vh; }
  .cctv input,.cctv select,.cctv textarea,.cctv button { font-family:${D.sans}; }
  .cctv .mono { font-family:${D.mono}; }
  @keyframes cctvBlink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes cctvPulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,229,160,.4)} 50%{opacity:.8;box-shadow:0 0 0 6px rgba(0,229,160,0)} }
  @keyframes cctvAlert { 0%,100%{border-color:${D.red}} 50%{border-color:transparent} }
  @keyframes cctvScan { 0%{transform:translateY(-100%)} 100%{transform:translateY(400%)} }
  @keyframes cctvFade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .cctv .fade-in { animation:cctvFade .22s ease forwards; }
  .cctv ::-webkit-scrollbar { width:4px; }
  .cctv ::-webkit-scrollbar-thumb { background:${D.border2}; border-radius:99px; }
`;

// ─── Mock data ────────────────────────────────────────────────────────────────
const CAMERAS = [
  {id:"CAM-01",name:"Main Gate",        loc:"Entrance",    zone:"Security", res:"1080p",fps:30,ip:"192.168.1.101",status:"online", rec:true, motion:true,  night:true,  icon:"🚪",  angle:110},
  {id:"CAM-02",name:"Reception",        loc:"Admin Block", zone:"Admin",    res:"1080p",fps:30,ip:"192.168.1.102",status:"online", rec:true, motion:false, night:false, icon:"🏢",  angle:90 },
  {id:"CAM-03",name:"Assembly Ground",  loc:"Open Area",   zone:"Academic", res:"4K",   fps:25,ip:"192.168.1.103",status:"online", rec:true, motion:false, night:true,  icon:"🏟️", angle:160},
  {id:"CAM-04",name:"JSS Corridor A",   loc:"JSS Block",   zone:"Academic", res:"1080p",fps:30,ip:"192.168.1.104",status:"online", rec:true, motion:true,  night:false, icon:"🚶", angle:120},
  {id:"CAM-05",name:"SSS Block",        loc:"SSS Block",   zone:"Academic", res:"720p", fps:25,ip:"192.168.1.105",status:"online", rec:true, motion:false, night:false, icon:"🏫", angle:100},
  {id:"CAM-06",name:"Science Lab",      loc:"Lab Block",   zone:"Academic", res:"1080p",fps:30,ip:"192.168.1.106",status:"online", rec:true, motion:false, night:false, icon:"🔬", angle:90 },
  {id:"CAM-07",name:"Library",          loc:"Library",     zone:"Academic", res:"1080p",fps:30,ip:"192.168.1.107",status:"online", rec:true, motion:false, night:false, icon:"📚", angle:120},
  {id:"CAM-08",name:"Sports Field",     loc:"Field",       zone:"Sports",   res:"4K",   fps:30,ip:"192.168.1.108",status:"online", rec:false,motion:false, night:true,  icon:"⚽", angle:180},
  {id:"CAM-09",name:"Hostel Block A",   loc:"Hostel A",    zone:"Hostel",   res:"1080p",fps:25,ip:"192.168.1.109",status:"online", rec:true, motion:false, night:true,  icon:"🛏️",angle:90 },
  {id:"CAM-10",name:"Hostel Block B",   loc:"Hostel B",    zone:"Hostel",   res:"1080p",fps:25,ip:"192.168.1.110",status:"online", rec:true, motion:false, night:true,  icon:"🛏️",angle:90 },
  {id:"CAM-11",name:"Canteen",          loc:"Canteen",     zone:"Common",   res:"720p", fps:20,ip:"192.168.1.111",status:"online", rec:true, motion:false, night:false, icon:"🍽️",angle:130},
  {id:"CAM-12",name:"Staff Car Park",   loc:"Car Park",    zone:"Security", res:"1080p",fps:30,ip:"192.168.1.112",status:"offline",rec:false,motion:false, night:true,  icon:"🚗", angle:150},
];

const ALERTS_DATA = [
  {id:"A001",type:"motion",  title:"Motion detected",       cam:"CAM-01",camName:"Main Gate",       time:"09:14:32",desc:"Sustained motion near gate area",          sev:"high"},
  {id:"A002",type:"motion",  title:"Motion detected",       cam:"CAM-04",camName:"JSS Corridor A",  time:"09:08:17",desc:"Multiple persons — after-hours access",      sev:"high"},
  {id:"A003",type:"access",  title:"Restricted zone entry", cam:"CAM-06",camName:"Science Lab",      time:"08:52:44",desc:"Unscheduled access during closed hours",     sev:"medium"},
  {id:"A004",type:"offline", title:"Camera offline",        cam:"CAM-12",camName:"Staff Car Park",   time:"07:30:00",desc:"Connection lost — check power or cable",     sev:"low"},
  {id:"A005",type:"access",  title:"Visitor gate event",    cam:"CAM-01",camName:"Main Gate",        time:"07:12:09",desc:"Unregistered vehicle detected at gate",      sev:"medium"},
];

const RECORDINGS_DATA = [
  {id:"R001",cam:"CAM-01",name:"Main Gate",      date:"2026-06-07",start:"06:00",end:"18:00",dur:"12h 00m",size:"8.4 GB", events:3},
  {id:"R002",cam:"CAM-04",name:"JSS Corridor",   date:"2026-06-07",start:"06:00",end:"18:00",dur:"12h 00m",size:"6.1 GB", events:1},
  {id:"R003",cam:"CAM-03",name:"Assembly Ground", date:"2026-06-06",start:"06:00",end:"20:00",dur:"14h 00m",size:"22.3 GB",events:0},
  {id:"R004",cam:"CAM-09",name:"Hostel Block A",  date:"2026-06-06",start:"18:00",end:"06:00",dur:"12h 00m",size:"5.9 GB", events:2},
  {id:"R005",cam:"CAM-07",name:"Library",         date:"2026-06-05",start:"07:00",end:"17:00",dur:"10h 00m",size:"4.7 GB", events:0},
];

const MAP_POSITIONS = {
  "CAM-01":{x:44, y:80}, "CAM-02":{x:100,y:38}, "CAM-03":{x:185,y:118},
  "CAM-04":{x:258,y:58}, "CAM-05":{x:312,y:78}, "CAM-06":{x:224,y:158},
  "CAM-07":{x:342,y:158},"CAM-08":{x:192,y:218},"CAM-09":{x:430,y:78},
  "CAM-10":{x:430,y:138},"CAM-11":{x:152,y:38}, "CAM-12":{x:402,y:218},
};

// ─── Primitives ───────────────────────────────────────────────────────────────
const Pill = ({children,color="green",size="sm"}) => {
  const cols = {green:{bg:D.accentL,text:D.accentD},red:{bg:D.redL,text:D.red},amber:{bg:D.amberL,text:D.amber},sky:{bg:D.skyL,text:D.sky},gray:{bg:"rgba(100,130,160,.12)",text:D.textM}};
  const c = cols[color]||cols.gray;
  return <span style={{display:"inline-block",padding:size==="xs"?"1px 6px":"2px 9px",borderRadius:99,fontSize:size==="xs"?9:10,fontWeight:700,fontFamily:D.mono,background:c.bg,color:c.text,textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{children}</span>;
};

const Btn = ({children,onClick,variant="ghost",style={}}) => {
  const vs = {
    accent:{background:D.accent,color:D.bg0,border:"none"},
    ghost:{background:"transparent",color:D.textM,border:`1px solid ${D.border2}`},
    danger:{background:D.redL,color:D.red,border:`1px solid ${D.red}44`},
    active:{background:D.accentL,color:D.accent,border:`1px solid ${D.accent}44`},
  };
  return <button onClick={onClick} style={{padding:"6px 13px",borderRadius:6,fontSize:11,fontWeight:500,cursor:"pointer",transition:"all .15s",fontFamily:D.sans,...(vs[variant]||vs.ghost),...style}}>{children}</button>;
};

const Panel = ({children,style={}}) => (
  <div style={{background:D.bg1,border:`1px solid ${D.border}`,borderRadius:9,padding:"13px 15px",...style}}>{children}</div>
);

const PanelTitle = ({children}) => (
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
    <div style={{width:3,height:13,background:D.accent,borderRadius:2}}/>
    <span style={{fontSize:10,fontWeight:700,color:D.textM,textTransform:"uppercase",letterSpacing:"1px"}}>{children}</span>
  </div>
);

const StatCard = ({label,value,color=D.text}) => (
  <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:8,padding:"10px 14px"}}>
    <div style={{fontFamily:D.mono,fontSize:22,fontWeight:600,color,lineHeight:1}}>{value}</div>
    <div style={{fontSize:10,color:D.textM,marginTop:5,textTransform:"uppercase",letterSpacing:".5px"}}>{label}</div>
  </div>
);

const Toggle = ({on,onChange,label}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${D.border}`,cursor:"pointer"}} onClick={()=>onChange(!on)}>
    <span style={{fontSize:12,color:D.text}}>{label}</span>
    <div style={{width:34,height:18,borderRadius:99,background:on?D.accent:D.border2,position:"relative",transition:"background .2s",flexShrink:0}}>
      <div style={{width:12,height:12,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?19:3,transition:"left .2s"}}/>
    </div>
  </div>
);

// ─── Feed Simulation ──────────────────────────────────────────────────────────
const FeedScreen = ({cam,large=false,time}) => {
  const isOffline = cam.status==="offline";
  const sz = large ? 36 : 22;
  if(isOffline) return (
    <div style={{width:"100%",aspectRatio:"16/9",background:"#050810",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,position:"relative"}}>
      <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.015) 2px,rgba(255,255,255,.015) 4px)"}}/>
      <span style={{fontSize:sz}}>📵</span>
      <span style={{fontFamily:D.mono,fontSize:large?12:9,color:D.red}}>SIGNAL LOST</span>
      <span style={{fontFamily:D.mono,fontSize:large?10:8,color:D.textD}}>{cam.ip}</span>
    </div>
  );
  return (
    <div style={{width:"100%",aspectRatio:"16/9",background:"#060b12",position:"relative",overflow:"hidden"}}>
      {/* Scanline */}
      <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.018) 3px,rgba(255,255,255,.018) 4px)",pointerEvents:"none"}}/>
      {/* Scene */}
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:sz,opacity:.2}}>{cam.icon}</span>
      </div>
      {/* Motion box */}
      {cam.motion && (
        <div style={{position:"absolute",left:"20%",top:"25%",width:"20%",height:"32%",border:"1.5px solid "+D.red,background:"rgba(232,69,69,.07)"}}>
          <div style={{position:"absolute",top:-16,left:0,background:D.red,color:"#fff",fontSize:8,fontFamily:D.mono,padding:"1px 5px",borderRadius:2}}>MOTION</div>
        </div>
      )}
      {/* Overlay */}
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",padding:large?"8px 10px":"5px 7px"}}>
          <span style={{fontFamily:D.mono,fontSize:large?11:8,color:D.accent,background:"rgba(0,229,160,.12)",padding:"2px 7px",borderRadius:3}}>{cam.id}</span>
          <span style={{fontFamily:D.mono,fontSize:large?10:8,color:D.textM}}>{cam.res}·{cam.fps}fps</span>
        </div>
        <div style={{marginTop:"auto",display:"flex",justifyContent:"space-between",alignItems:"center",padding:large?"8px 10px":"5px 7px"}}>
          <span style={{fontFamily:D.mono,fontSize:large?10:8,color:D.textM}}>{time||"--:--:--"}</span>
          {cam.motion
            ? <span style={{background:"rgba(232,69,69,.85)",color:"#fff",fontFamily:D.mono,fontSize:large?10:8,fontWeight:700,padding:"2px 7px",borderRadius:3,display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:"#fff",animation:"cctvBlink .5s infinite",display:"inline-block"}}/>MOTION
              </span>
            : cam.rec
              ? <span style={{display:"flex",alignItems:"center",gap:4,fontFamily:D.mono,fontSize:large?10:8,color:D.red}}>
                  <span style={{width:5,height:5,borderRadius:"50%",background:D.red,animation:"cctvBlink .8s infinite",display:"inline-block"}}/>REC
                </span>
              : null}
        </div>
      </div>
    </div>
  );
};

// ─── TAB: LIVE VIEW ───────────────────────────────────────────────────────────
const LiveView = ({time}) => {
  const [layout,   setLayout]  = useState("3x3");
  const [selected, setSelected]= useState(null);

  const cols = {1:1,"2x2":2,"3x3":3,"4x4":4}[layout]||3;
  const cams = selected && layout==="1" ? CAMERAS : CAMERAS.slice(0, cols*cols);

  return (
    <div className="fade-in">
      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <StatCard label="Cameras Online" value={CAMERAS.filter(c=>c.status==="online").length} color={D.accent}/>
        <StatCard label="Active Alerts"  value={ALERTS_DATA.filter(a=>a.sev==="high").length}  color={D.red}/>
        <StatCard label="Recording Now"  value={CAMERAS.filter(c=>c.rec).length}/>
        <StatCard label="Storage Used"   value="68%" color={D.amber}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 210px",gap:12}}>
        {/* Feed grid */}
        <div>
          {selected && layout==="1" ? (
            <div>
              <div style={{background:D.bg1,border:`1px solid ${D.border}`,borderRadius:9,overflow:"hidden",marginBottom:10}}>
                <FeedScreen cam={CAMERAS.find(c=>c.id===selected)||CAMERAS[0]} large time={time}/>
                <div style={{display:"flex",gap:8,padding:"10px 13px",background:D.bg2,borderTop:`1px solid ${D.border}`,flexWrap:"wrap"}}>
                  {["⏺ REC","⏸ Pause","📸 Snapshot","🔊 Audio","🌙 Night IR","🔍 Zoom"].map(b=>(
                    <Btn key={b}>{b}</Btn>
                  ))}
                  <div style={{flex:1}}/>
                  <span style={{fontFamily:D.mono,fontSize:10,color:D.textM,alignSelf:"center"}}>
                    {CAMERAS.find(c=>c.id===selected)?.name} · {CAMERAS.find(c=>c.id===selected)?.loc} · {CAMERAS.find(c=>c.id===selected)?.res}
                  </span>
                </div>
              </div>
              {/* Thumbnails */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:5}}>
                {CAMERAS.map(c=>(
                  <div key={c.id} onClick={()=>setSelected(c.id)} style={{background:D.bg1,border:`1.5px solid ${c.id===selected?D.accent:c.motion?D.red:D.border}`,borderRadius:6,overflow:"hidden",cursor:"pointer",transition:"border-color .15s",animation:c.motion?"cctvAlert 1s infinite":"none"}}>
                    <FeedScreen cam={c} time={time}/>
                    <div style={{padding:"3px 5px",fontFamily:D.mono,fontSize:8,color:D.textM,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:8}}>
              {cams.map(cam=>(
                <div key={cam.id} onClick={()=>setSelected(cam.id)} style={{background:D.bg1,border:`1.5px solid ${cam.id===selected?D.accent:cam.motion?D.red:D.border}`,borderRadius:8,overflow:"hidden",cursor:"pointer",transition:"border-color .15s",animation:cam.motion?"cctvAlert .9s infinite":"none"}}>
                  <FeedScreen cam={cam} time={time}/>
                  <div style={{padding:"7px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:600}}>{cam.name}</div>
                      <div style={{fontFamily:D.mono,fontSize:9,color:D.textM}}>{cam.loc} · {cam.zone}</div>
                    </div>
                    {cam.status==="offline"
                      ? <Pill color="red" size="xs">OFFLINE</Pill>
                      : cam.motion ? <Pill color="red" size="xs">⚠ MOTION</Pill>
                      : cam.rec    ? <Pill color="green" size="xs">⏺ REC</Pill>
                      : <Pill color="gray" size="xs">IDLE</Pill>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Panel>
            <PanelTitle>Layout</PanelTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
              {[["1","⬜"],["2x2","⊞"],["3x3","⊟"],["4x4","⊠"]].map(([v,ic])=>(
                <button key={v} onClick={()=>{setLayout(v);if(v!=="1")setSelected(null);}} style={{padding:"7px 3px",borderRadius:6,border:`1px solid ${layout===v?D.accent:D.border}`,background:layout===v?D.accentL:"transparent",color:layout===v?D.accent:D.textM,fontSize:16,cursor:"pointer",textAlign:"center"}}>{ic}</button>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle>Live Alerts</PanelTitle>
            {ALERTS_DATA.filter(a=>a.sev==="high").map(a=>(
              <div key={a.id} style={{display:"flex",gap:9,padding:"8px 0",borderBottom:`1px solid ${D.border}`,cursor:"pointer",alignItems:"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:6,background:a.type==="motion"?D.redL:D.amberL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                  {a.type==="motion"?"👁":"🔐"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,marginBottom:2}}>{a.title}</div>
                  <div style={{fontFamily:D.mono,fontSize:9,color:D.textM}}>{a.cam} · {a.time}</div>
                </div>
              </div>
            ))}
          </Panel>

          <Panel>
            <PanelTitle>Camera Zones</PanelTitle>
            {["Security","Academic","Hostel","Sports","Admin","Common"].map(zone=>{
              const count = CAMERAS.filter(c=>c.zone===zone).length;
              const online = CAMERAS.filter(c=>c.zone===zone&&c.status==="online").length;
              return (
                <div key={zone} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${D.border}`,fontSize:11}}>
                  <span style={{color:D.textM}}>{zone}</span>
                  <span style={{fontFamily:D.mono,fontSize:10,color:online<count?D.amber:D.accent}}>{online}/{count}</span>
                </div>
              );
            })}
          </Panel>
        </div>
      </div>
    </div>
  );
};

// ─── TAB: RECORDINGS ─────────────────────────────────────────────────────────
const Recordings = ({time}) => {
  const [playhead, setPlayhead] = useState(45);
  const tlRef = useRef(null);

  const segs=[{l:0,r:22,type:"rec"},{l:22,r:28,type:"motion"},{l:28,r:55,type:"rec"},{l:55,r:63,type:"motion"},{l:63,r:90,type:"rec"}];

  const handleTLClick = e => {
    if(!tlRef.current) return;
    const rect = tlRef.current.getBoundingClientRect();
    setPlayhead(Math.max(0,Math.min(100,((e.clientX-rect.left)/rect.width)*100)));
  };

  return (
    <div className="fade-in">
      <Panel style={{marginBottom:12}}>
        <PanelTitle>Recording Timeline — Today</PanelTitle>
        <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <select style={{padding:"6px 10px",background:D.bg2,border:`1px solid ${D.border}`,borderRadius:6,color:D.text,fontSize:12,outline:"none"}}>
            {CAMERAS.map(c=><option key={c.id}>{c.id} — {c.name}</option>)}
          </select>
          <input type="date" defaultValue="2026-06-07" style={{padding:"6px 10px",background:D.bg2,border:`1px solid ${D.border}`,borderRadius:6,color:D.text,fontSize:12,outline:"none"}}/>
          <Btn variant="accent">Load</Btn>
        </div>

        {/* Timeline */}
        <div ref={tlRef} onClick={handleTLClick} style={{height:32,background:D.bg2,borderRadius:5,position:"relative",overflow:"hidden",border:`1px solid ${D.border}`,cursor:"crosshair",marginBottom:8}}>
          {[0,4,8,12,16,20].map(h=>(
            <div key={h} style={{position:"absolute",left:`${(h/24)*100}%`,top:0,bottom:0,borderLeft:`1px solid ${D.border}`,display:"flex",alignItems:"flex-end",paddingBottom:2}}>
              <span style={{fontFamily:D.mono,fontSize:8,color:D.textD,marginLeft:2}}>{String(h).padStart(2,"0")}:00</span>
            </div>
          ))}
          {segs.map((s,i)=>(
            <div key={i} style={{position:"absolute",top:4,height:24,borderRadius:3,left:s.l+"%",width:(s.r-s.l)+"%",background:s.type==="rec"?"rgba(232,69,69,.45)":"rgba(245,166,35,.55)"}}/>
          ))}
          <div style={{position:"absolute",top:0,bottom:0,left:playhead+"%",width:"1.5px",background:D.accent,zIndex:3}}/>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:12}}>
            {[["Recording","rgba(232,69,69,.5)"],["Motion Event","rgba(245,166,35,.6)"]].map(([l,bg])=>(
              <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontFamily:D.mono,fontSize:10,color:D.textM}}>
                <span style={{width:10,height:6,background:bg,borderRadius:1,display:"inline-block"}}/>
                {l}
              </span>
            ))}
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <Btn>⏮</Btn>
            <Btn variant="active">▶ Play</Btn>
            <Btn>⏭</Btn>
            <span style={{fontFamily:D.mono,fontSize:10,color:D.textM}}>{String(Math.floor(playhead*.24*60)).padStart(2,"0")}:{String(Math.floor((playhead*.24*60%1)*60)).padStart(2,"0")} / 18:00</span>
          </div>
        </div>
      </Panel>

      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:12}}>
        <div>
          <PanelTitle>Saved Recordings</PanelTitle>
          <div style={{background:D.bg1,border:`1px solid ${D.border}`,borderRadius:9,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:D.bg2}}>
                  {["Camera","Date","Duration","Size","Events","Actions"].map(h=>(
                    <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:D.textM,textTransform:"uppercase",letterSpacing:".5px",borderBottom:`1px solid ${D.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECORDINGS_DATA.map(r=>(
                  <tr key={r.id} style={{borderBottom:`1px solid ${D.border}`,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=D.bg2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"9px 12px",fontSize:12,fontWeight:600}}>{r.name}<div style={{fontFamily:D.mono,fontSize:9,color:D.textM}}>{r.cam}</div></td>
                    <td style={{padding:"9px 12px",fontFamily:D.mono,fontSize:11,color:D.textM}}>{r.date}</td>
                    <td style={{padding:"9px 12px",fontFamily:D.mono,fontSize:11}}>{r.dur}</td>
                    <td style={{padding:"9px 12px",fontFamily:D.mono,fontSize:11,color:D.textM}}>{r.size}</td>
                    <td style={{padding:"9px 12px"}}>{r.events>0?<span style={{color:D.amber,fontWeight:700,fontFamily:D.mono,fontSize:12}}>{r.events}</span>:<span style={{color:D.textD}}>—</span>}</td>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{display:"flex",gap:5}}>
                        <Btn style={{fontSize:10,padding:"3px 8px"}}>▶ Play</Btn>
                        <Btn style={{fontSize:10,padding:"3px 8px"}}>⬇ Download</Btn>
                        <Btn variant="danger" style={{fontSize:10,padding:"3px 8px"}}>🗑</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Panel>
          <PanelTitle>Storage Overview</PanelTitle>
          {[["Total Capacity","2.0 TB",D.text],["Used","1.36 TB",D.amber],["Free","640 GB",D.accent],["Retention Policy","30 days",D.text],["Auto-Delete","Enabled",D.accent],["Codec","H.265 (HEVC)",D.text]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${D.border}`,fontSize:11}}>
              <span style={{color:D.textM}}>{l}</span>
              <span style={{fontFamily:D.mono,fontWeight:600,color:c}}>{v}</span>
            </div>
          ))}
          <div style={{marginTop:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:D.textM,marginBottom:5}}><span>Storage usage</span><span>68%</span></div>
            <div style={{height:6,background:D.bg2,borderRadius:99,overflow:"hidden",border:`1px solid ${D.border}`}}>
              <div style={{width:"68%",height:"100%",background:`linear-gradient(90deg,${D.accent},${D.amber})`,borderRadius:99}}/>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

// ─── TAB: ALERTS ─────────────────────────────────────────────────────────────
const Alerts = () => {
  const [filter, setFilter] = useState("All");
  const [dismissed, setDismissed] = useState([]);

  const displayed = ALERTS_DATA.filter(a=>{
    if(dismissed.includes(a.id)) return false;
    if(filter==="All") return true;
    if(filter==="High") return a.sev==="high";
    if(filter==="Motion") return a.type==="motion";
    if(filter==="Access") return a.type==="access";
    if(filter==="Offline") return a.type==="offline";
    return true;
  });

  const sevColor = s => s==="high"?D.red:s==="medium"?D.amber:D.textM;
  const typeIcon = t => t==="motion"?"👁":t==="access"?"🔐":"📵";

  return (
    <div className="fade-in">
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <StatCard label="High Priority"  value={ALERTS_DATA.filter(a=>a.sev==="high").length}   color={D.red}/>
        <StatCard label="Medium Priority" value={ALERTS_DATA.filter(a=>a.sev==="medium").length} color={D.amber}/>
        <StatCard label="Motion Events"  value={ALERTS_DATA.filter(a=>a.type==="motion").length}/>
        <StatCard label="Camera Offline" value={ALERTS_DATA.filter(a=>a.type==="offline").length}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:12}}>
        <div>
          <div style={{display:"flex",gap:7,marginBottom:12,flexWrap:"wrap"}}>
            {["All","High","Motion","Access","Offline"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{padding:"5px 13px",borderRadius:99,border:`1px solid ${filter===f?D.accent:D.border}`,background:filter===f?D.accentL:"transparent",color:filter===f?D.accent:D.textM,fontSize:11,cursor:"pointer",fontFamily:D.sans}}>{f}</button>
            ))}
          </div>
          <div style={{background:D.bg1,border:`1px solid ${D.border}`,borderRadius:9,overflow:"hidden"}}>
            {displayed.length===0 && <div style={{padding:"30px",textAlign:"center",color:D.textM,fontSize:13}}>No alerts matching this filter.</div>}
            {displayed.map(a=>(
              <div key={a.id} style={{display:"flex",gap:12,padding:"12px 14px",borderBottom:`1px solid ${D.border}`,cursor:"pointer",transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background=D.bg2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{width:38,height:38,borderRadius:9,background:a.sev==="high"?D.redL:D.amberL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{typeIcon(a.type)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:600}}>{a.title}</span>
                    <span style={{fontFamily:D.mono,fontSize:10,color:D.textD}}>{a.time}</span>
                  </div>
                  <div style={{fontSize:11,color:D.textM,marginBottom:4}}>{a.cam} — {a.camName}</div>
                  <div style={{fontSize:10,color:D.textD}}>{a.desc}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
                  <Pill color={a.sev==="high"?"red":a.sev==="medium"?"amber":"gray"} size="xs">{a.sev}</Pill>
                  <div style={{display:"flex",gap:5}}>
                    <Btn style={{fontSize:10,padding:"3px 8px"}}>View</Btn>
                    <Btn variant="danger" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>setDismissed(p=>[...p,a.id])}>Dismiss</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Panel>
            <PanelTitle>Alert Notifications</PanelTitle>
            {[["Motion Detection","on"],["Email Notifications","off"],["SMS Alerts","on"],["Auto-Dismiss After 24h","on"],["Sound Alarm","off"],["Push Notifications","on"]].map(([l,s])=>{
              const [on,setOn] = useState(s==="on");
              return <Toggle key={l} on={on} onChange={setOn} label={l}/>;
            })}
          </Panel>
          <Panel>
            <PanelTitle>Notify Contacts</PanelTitle>
            {[["Head of Security","security@greenfield.edu.ng"],["School Principal","principal@greenfield.edu.ng"],["IT Administrator","it@greenfield.edu.ng"]].map(([n,e])=>(
              <div key={n} style={{padding:"7px 0",borderBottom:`1px solid ${D.border}`}}>
                <div style={{fontSize:11,fontWeight:600}}>{n}</div>
                <div style={{fontFamily:D.mono,fontSize:9,color:D.textM,marginTop:2}}>{e}</div>
              </div>
            ))}
            <button style={{marginTop:10,width:"100%",padding:"7px",borderRadius:6,border:`1px solid ${D.border}`,background:"transparent",color:D.textM,fontSize:11,cursor:"pointer",fontFamily:D.sans}}>+ Add Contact</button>
          </Panel>
        </div>
      </div>
    </div>
  );
};

// ─── TAB: CAMPUS MAP ─────────────────────────────────────────────────────────
const CampusMap = () => {
  const [hoveredCam, setHoveredCam] = useState(null);

  return (
    <div className="fade-in" style={{display:"grid",gridTemplateColumns:"1fr 220px",gap:12}}>
      <Panel style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${D.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,fontWeight:700,color:D.textM,textTransform:"uppercase",letterSpacing:".8px"}}>Campus Floor Plan — Camera Positions</span>
          <div style={{display:"flex",gap:10}}>
            {[["●",D.accent,"Online"],[" ●",D.red,"Alert"],["●",D.textD,"Offline"]].map(([ic,col,l])=>(
              <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontFamily:D.mono,fontSize:10,color:D.textM}}>
                <span style={{color:col,fontSize:8}}>{ic}</span>{l}
              </span>
            ))}
          </div>
        </div>
        <svg width="100%" viewBox="0 0 510 300" style={{display:"block",background:D.bg2}}>
          {/* Buildings */}
          {[
            [38,22,105,72,"Admin Block"],
            [152,22,145,72,"Classrooms"],
            [308,22,158,72,"Hostel Block"],
            [38,108,205,84,"Assembly Ground"],
            [258,108,195,84,"Sports Field"],
            [38,208,145,64,"Library / Lab"],
            [198,208,112,64,"Canteen"],
            [324,208,130,64,"Car Park"],
          ].map(([x,y,w,h,label])=>(
            <g key={label}>
              <rect x={x} y={y} width={w} height={h} rx={4} fill={D.bg3} stroke={D.border} strokeWidth={.5}/>
              <text x={x+w/2} y={y+h/2+2} textAnchor="middle" fontSize={8} fill={D.textD} fontFamily="Sora">{label}</text>
            </g>
          ))}
          {/* Gate */}
          <rect x={20} y={118} width={16} height={44} rx={2} fill={D.bg3} stroke={D.accent} strokeWidth={1}/>
          <text x={28} y={143} textAnchor="middle" fontSize={6} fill={D.accent} fontFamily="Sora">GATE</text>
          {/* Camera markers */}
          {CAMERAS.map(cam=>{
            const pos = MAP_POSITIONS[cam.id];
            if(!pos) return null;
            const col = cam.motion ? D.red : cam.status==="offline" ? D.textD : D.accent;
            const bg  = cam.motion ? "rgba(232,69,69,.18)" : cam.status==="offline" ? "rgba(50,70,100,.15)" : D.accentL;
            return (
              <g key={cam.id} style={{cursor:"pointer"}} onMouseEnter={()=>setHoveredCam(cam.id)} onMouseLeave={()=>setHoveredCam(null)}>
                <circle cx={pos.x+11} cy={pos.y+11} r={hoveredCam===cam.id?14:11} fill={bg} stroke={col} strokeWidth={1.5} style={{transition:"r .15s"}}/>
                <text x={pos.x+11} y={pos.y+15} textAnchor="middle" fontSize={10} fill={col}>📷</text>
                {cam.motion && <circle cx={pos.x+19} cy={pos.y+3} r={4} fill={D.red} stroke={D.bg2} strokeWidth={1.5}/>}
                <text x={pos.x+11} y={pos.y+30} textAnchor="middle" fontSize={7} fill={D.textM} fontFamily="JetBrains Mono">{cam.id}</text>
                {hoveredCam===cam.id && (
                  <g>
                    <rect x={pos.x-18} y={pos.y-30} width={58} height={20} rx={4} fill={D.bg1} stroke={D.border} strokeWidth={.5}/>
                    <text x={pos.x+11} y={pos.y-17} textAnchor="middle" fontSize={8} fill={D.text} fontFamily="Sora">{cam.name}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </Panel>

      <Panel>
        <PanelTitle>All Cameras</PanelTitle>
        <div style={{maxHeight:360,overflowY:"auto"}}>
          {CAMERAS.map(cam=>(
            <div key={cam.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${D.border}`,cursor:"pointer"}} onMouseEnter={()=>setHoveredCam(cam.id)} onMouseLeave={()=>setHoveredCam(null)}>
              <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:cam.status==="offline"?D.textD:cam.motion?D.red:D.accent,animation:cam.motion?"cctvBlink .5s infinite":"none"}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cam.name}</div>
                <div style={{fontFamily:D.mono,fontSize:8,color:D.textM}}>{cam.id}</div>
              </div>
              <Pill color={cam.status==="offline"?"red":cam.motion?"red":"green"} size="xs">{cam.status==="offline"?"OFF":cam.motion?"ALERT":"OK"}</Pill>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

// ─── TAB: CAMERAS ────────────────────────────────────────────────────────────
const CameraList = () => {
  const [zone, setZone] = useState("All");
  const zones = ["All",...[...new Set(CAMERAS.map(c=>c.zone))]];
  const filtered = zone==="All" ? CAMERAS : CAMERAS.filter(c=>c.zone===zone);

  return (
    <div className="fade-in">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {zones.map(z=>(
            <button key={z} onClick={()=>setZone(z)} style={{padding:"5px 13px",borderRadius:99,border:`1px solid ${zone===z?D.accent:D.border}`,background:zone===z?D.accentL:"transparent",color:zone===z?D.accent:D.textM,fontSize:11,cursor:"pointer",fontFamily:D.sans}}>{z}</button>
          ))}
        </div>
        <Btn variant="accent">+ Add Camera</Btn>
      </div>
      <div style={{background:D.bg1,border:`1px solid ${D.border}`,borderRadius:9,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:D.bg2}}>
              {["Camera ID","Name","Location","Zone","Resolution","FPS","IP Address","Night Vision","Status","Actions"].map(h=>(
                <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:D.textM,textTransform:"uppercase",letterSpacing:".4px",borderBottom:`1px solid ${D.border}`,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c=>(
              <tr key={c.id} style={{borderBottom:`1px solid ${D.border}`,transition:"background .1s",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=D.bg2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"9px 12px",fontFamily:D.mono,fontSize:11,color:D.accent}}>{c.id}</td>
                <td style={{padding:"9px 12px",fontSize:12,fontWeight:600}}>{c.name}</td>
                <td style={{padding:"9px 12px",fontSize:11,color:D.textM}}>{c.loc}</td>
                <td style={{padding:"9px 12px"}}><span style={{background:D.bg3,border:`1px solid ${D.border}`,borderRadius:5,padding:"2px 8px",fontSize:10,fontFamily:D.mono,color:D.textM}}>{c.zone}</span></td>
                <td style={{padding:"9px 12px",fontFamily:D.mono,fontSize:11}}>{c.res}</td>
                <td style={{padding:"9px 12px",fontFamily:D.mono,fontSize:11,color:D.textM}}>{c.fps}</td>
                <td style={{padding:"9px 12px",fontFamily:D.mono,fontSize:10,color:D.textM}}>{c.ip}</td>
                <td style={{padding:"9px 12px",textAlign:"center"}}>{c.night?<span style={{color:D.accent}}>✓</span>:<span style={{color:D.textD}}>—</span>}</td>
                <td style={{padding:"9px 12px"}}><Pill color={c.status==="online"?"green":"red"} size="xs">{c.status.toUpperCase()}</Pill></td>
                <td style={{padding:"9px 12px"}}>
                  <div style={{display:"flex",gap:5}}>
                    <Btn style={{fontSize:10,padding:"3px 8px"}}>View</Btn>
                    <Btn style={{fontSize:10,padding:"3px 8px"}}>Edit</Btn>
                    <Btn variant="danger" style={{fontSize:10,padding:"3px 8px"}}>🗑</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── TAB: SETTINGS ───────────────────────────────────────────────────────────
const Settings = () => {
  const [connStatus, setConnStatus] = useState(null);
  const testConn = () => {
    setConnStatus("testing");
    setTimeout(()=>setConnStatus("ok"), 1500);
  };

  const InputField = ({label,defaultValue,type="text"})=>(
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:10,fontWeight:700,color:D.textM,textTransform:"uppercase",letterSpacing:".5px",marginBottom:5}}>{label}</label>
      <input type={type} defaultValue={defaultValue} style={{width:"100%",padding:"8px 11px",background:D.bg2,border:`1px solid ${D.border}`,borderRadius:6,color:D.text,fontFamily:D.sans,fontSize:12,outline:"none"}} onFocus={e=>e.target.style.borderColor=D.accent} onBlur={e=>e.target.style.borderColor=D.border}/>
    </div>
  );
  const SelectField = ({label,options})=>(
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:10,fontWeight:700,color:D.textM,textTransform:"uppercase",letterSpacing:".5px",marginBottom:5}}>{label}</label>
      <select style={{width:"100%",padding:"8px 11px",background:D.bg2,border:`1px solid ${D.border}`,borderRadius:6,color:D.text,fontFamily:D.sans,fontSize:12,outline:"none",cursor:"pointer"}}>
        {options.map(o=><option key={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fade-in">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div>
          <Panel style={{marginBottom:12}}>
            <PanelTitle>Recording Settings</PanelTitle>
            <SelectField label="Default Resolution" options={["1080p (Full HD)","4K (Ultra HD)","720p (HD)"]}/>
            <SelectField label="Frame Rate" options={["30 fps","25 fps","15 fps"]}/>
            <SelectField label="Video Codec" options={["H.265 (HEVC) — Recommended","H.264 (AVC)","MJPEG"]}/>
            <InputField label="Retention Period (days)" defaultValue="30" type="number"/>
            <SelectField label="Recording Schedule" options={["24/7 Continuous","School Hours Only (6AM–8PM)","Motion Triggered Only"]}/>
          </Panel>
          <Panel>
            <PanelTitle>Storage & Backup</PanelTitle>
            <InputField label="Primary Storage Path" defaultValue="/mnt/cctv/primary"/>
            <InputField label="Backup Storage Path" defaultValue="/mnt/cctv/backup"/>
            <SelectField label="Cloud Backup" options={["Disabled","AWS S3","Google Cloud Storage","Azure Blob Storage"]}/>
          </Panel>
        </div>

        <div>
          <Panel style={{marginBottom:12}}>
            <PanelTitle>Motion Detection</PanelTitle>
            {[["Global Motion Detection","on"],["Save Motion Clips Separately","on"],["Send Immediate Alert","on"],["Annotate with Bounding Box","on"],["After-Hours Sensitivity Boost","off"]].map(([l,s])=>{
              const [on,setOn] = useState(s==="on");
              return <Toggle key={l} on={on} onChange={setOn} label={l}/>;
            })}
            <div style={{marginTop:12}}>
              <label style={{display:"block",fontSize:10,fontWeight:700,color:D.textM,textTransform:"uppercase",letterSpacing:".5px",marginBottom:7}}>Motion Sensitivity</label>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <input type="range" min={1} max={10} defaultValue={6} style={{flex:1}}/>
                <span style={{fontFamily:D.mono,fontSize:11,color:D.text,minWidth:24}}>6</span>
              </div>
            </div>
          </Panel>

          <Panel style={{marginBottom:12}}>
            <PanelTitle>Access Control</PanelTitle>
            {[["Require Login to View Feeds","on"],["Log All Viewer Access","on"],["Two-Factor Auth for Admin","off"],["Watermark on Recordings","on"]].map(([l,s])=>{
              const [on,setOn] = useState(s==="on");
              return <Toggle key={l} on={on} onChange={setOn} label={l}/>;
            })}
          </Panel>

          <Panel>
            <PanelTitle>NVR / DVR Integration</PanelTitle>
            <InputField label="NVR IP Address" defaultValue="192.168.1.200"/>
            <SelectField label="Stream Protocol" options={["RTSP (Standard)","ONVIF","HLS (HTTP Live Streaming)"]}/>
            <InputField label="Username" defaultValue="admin"/>
            <InputField label="Password" defaultValue="••••••••" type="password"/>
            <div style={{display:"flex",gap:10,alignItems:"center",marginTop:4}}>
              <Btn onClick={testConn} variant={connStatus==="ok"?"active":"ghost"}>{connStatus==="testing"?"Testing…":"Test Connection"}</Btn>
              {connStatus==="ok" && <span style={{fontFamily:D.mono,fontSize:10,color:D.accent}}>✓ Connected · 4ms latency</span>}
            </div>
          </Panel>
        </div>
      </div>
      <div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:14}}>
        <Btn>Reset to Defaults</Btn>
        <Btn variant="accent">💾 Save All Settings</Btn>
      </div>
    </div>
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function CCTVModule() {
  const [tab,  setTab]  = useState("live");
  const [time, setTime] = useState("");

  useEffect(()=>{
    const update = () => setTime(new Date().toTimeString().slice(0,8));
    update();
    const t = setInterval(update, 1000);
    return ()=>clearInterval(t);
  },[]);

  const TABS = [
    {id:"live",       label:"⬤ Live View"},
    {id:"recordings", label:"⏺ Recordings"},
    {id:"alerts",     label:`⚠ Alerts (${ALERTS_DATA.filter(a=>a.sev==="high").length})`},
    {id:"map",        label:"🗺 Campus Map"},
    {id:"cameras",    label:"📷 Cameras"},
    {id:"settings",   label:"⚙ Settings"},
  ];

  const PAGE = {live:<LiveView time={time}/>, recordings:<Recordings time={time}/>, alerts:<Alerts/>, map:<CampusMap/>, cameras:<CameraList/>, settings:<Settings/>};

  const online = CAMERAS.filter(c=>c.status==="online").length;
  const highAlerts = ALERTS_DATA.filter(a=>a.sev==="high").length;

  return (
    <div className="cctv">
      <style>{CSS}</style>

      {/* Topbar */}
      <div style={{background:D.bg1,borderBottom:`1px solid ${D.border}`,padding:"0 18px",height:50,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:D.accent,animation:"cctvPulse 2s infinite"}}/>
          <span style={{fontFamily:D.mono,fontSize:13,fontWeight:600,color:D.accent,letterSpacing:"1.5px"}}>CCTV CONTROL</span>
        </div>
        <div style={{width:1,height:20,background:D.border,margin:"0 4px"}}/>
        <span style={{fontFamily:D.mono,fontSize:11,color:D.textM}}>Greenfield Academy · Main Campus</span>
        <div style={{width:1,height:20,background:D.border,margin:"0 4px"}}/>
        <span style={{fontFamily:D.mono,fontSize:11,color:D.textM}}>{time}</span>
        <div style={{width:1,height:20,background:D.border,margin:"0 4px"}}/>
        <span style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:99,fontSize:10,fontWeight:700,fontFamily:D.mono,background:D.accentL,color:D.accent,border:`1px solid ${D.accent}44`}}>
          <span>●</span> {online} LIVE
        </span>
        {highAlerts>0&&<span style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:99,fontSize:10,fontWeight:700,fontFamily:D.mono,background:D.redL,color:D.red,border:`1px solid ${D.red}44`,animation:"cctvBlink 1.2s infinite"}}>
          ⚠ {highAlerts} ALERTS
        </span>}
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button style={{padding:"5px 13px",borderRadius:6,border:`1px solid ${D.border2}`,background:"transparent",color:D.textM,fontSize:11,cursor:"pointer",fontFamily:D.sans}}>📥 Export Log</button>
          <button style={{padding:"5px 13px",borderRadius:6,border:`1px solid ${D.border2}`,background:"transparent",color:D.textM,fontSize:11,cursor:"pointer",fontFamily:D.sans}}>🔒 Lock Screen</button>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{display:"flex",gap:1,background:D.bg1,borderBottom:`1px solid ${D.border}`,padding:"0 18px"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"11px 16px",border:"none",borderBottom:`2px solid ${tab===t.id?D.accent:"transparent"}`,background:"transparent",color:tab===t.id?D.accent:D.textM,fontSize:12,fontWeight:500,cursor:"pointer",transition:"all .15s",fontFamily:D.sans}}>{t.label}</button>
        ))}
      </div>

      {/* Main content */}
      <div style={{padding:16,overflowY:"auto",flex:1}}>
        {PAGE[tab]}
      </div>
    </div>
  );
}
