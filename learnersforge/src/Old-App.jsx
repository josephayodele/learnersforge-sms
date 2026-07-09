import { useState, useEffect, useCallback, useMemo } from "react";

const C = {
  navy:"#0D1B2A", navyMid:"#1A2E45", navyLight:"#243B55",
  accent:"#2ECC9A", accentDark:"#1FAF82", accentLight:"#E8FBF4",
  amber:"#F59E0B", amberLight:"#FEF3C7",
  coral:"#EF4444", coralLight:"#FEE2E2",
  sky:"#3B82F6", skyLight:"#EFF6FF",
  purple:"#8B5CF6", purpleLight:"#F5F3FF",
  orange:"#F97316", orangeLight:"#FFF7ED",
  teal:"#14B8A6", tealLight:"#F0FDFA",
  text:"#0D1B2A", textMid:"#4B5563", textMuted:"#9CA3AF",
  border:"#E5E7EB", borderDark:"#D1D5DB",
  surface:"#FFFFFF", pageBg:"#F8FAFC", sidebarW:240,
};

const G = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Sora',sans-serif;background:${C.pageBg};color:${C.text};}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-thumb{background:${C.borderDark};border-radius:99px;}
  input,select,textarea,button{font-family:'Sora',sans-serif;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:translateY(0);}}
  @keyframes slideUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes qrScan{0%{top:8px;}50%{top:calc(100% - 8px);}100%{top:8px;}}
  .fi{animation:fadeIn .25s ease forwards;}
  .su{animation:slideUp .28s ease forwards;}
`;

// ── Primitives ────────────────────────────────────────────────────────────────
const Badge = ({color="gray",children,size="md"}) => {
  const m={green:{bg:C.accentLight,text:C.accentDark},red:{bg:C.coralLight,text:"#991B1B"},amber:{bg:C.amberLight,text:"#92400E"},blue:{bg:C.skyLight,text:"#1D4ED8"},purple:{bg:C.purpleLight,text:"#6D28D9"},orange:{bg:C.orangeLight,text:"#9A3412"},teal:{bg:C.tealLight,text:"#0F766E"},gray:{bg:"#F3F4F6",text:C.textMid}};
  const c=m[color]||m.gray;
  return <span style={{display:"inline-block",padding:size==="sm"?"1px 8px":"2px 10px",borderRadius:99,fontSize:size==="sm"?10:11,fontWeight:700,letterSpacing:".3px",background:c.bg,color:c.text,textTransform:"uppercase",whiteSpace:"nowrap"}}>{children}</span>;
};
const Avatar = ({initials,size=36,color=C.accent}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:color+"22",border:`2px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:700,color,flexShrink:0}}>{initials}</div>
);
const Card = ({children,style={},onClick}) => (
  <div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px",cursor:onClick?"pointer":"default",transition:"box-shadow .15s,transform .15s",...style}}
    onMouseEnter={e=>{if(onClick){e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.08)";e.currentTarget.style.transform="translateY(-1px)";}}}
    onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateY(0)"}}
  >{children}</div>
);
const Btn = ({children,onClick,variant="primary",size="md",style={},disabled}) => {
  const base={display:"inline-flex",alignItems:"center",gap:6,border:"none",borderRadius:8,fontWeight:600,cursor:disabled?"not-allowed":"pointer",transition:"all .15s",opacity:disabled?.5:1,fontSize:size==="sm"?12:size==="lg"?15:13,padding:size==="sm"?"5px 12px":size==="lg"?"11px 22px":"8px 16px"};
  const vs={primary:{background:C.accent,color:"#fff"},secondary:{background:C.surface,color:C.text,border:`1px solid ${C.border}`},danger:{background:C.coral,color:"#fff"},ghost:{background:"transparent",color:C.textMid},navy:{background:C.navy,color:"#fff"},amber:{background:C.amber,color:"#fff"},teal:{background:C.teal,color:"#fff"}};
  return <button disabled={disabled} onClick={onClick} style={{...base,...(vs[variant]||vs.primary),...style}} onMouseEnter={e=>{if(!disabled)e.currentTarget.style.filter="brightness(1.08)"}} onMouseLeave={e=>{e.currentTarget.style.filter="none"}}>{children}</button>;
};
const Input = ({label,value,onChange,placeholder,type="text",style={}}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...style}}>
    {label&&<label style={{fontSize:11,fontWeight:700,color:C.textMid,letterSpacing:".4px",textTransform:"uppercase"}}>{label}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:"none",background:C.surface,color:C.text,transition:"border .15s"}}
      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
  </div>
);
const Sel = ({label,value,onChange,options,style={}}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...style}}>
    {label&&<label style={{fontSize:11,fontWeight:700,color:C.textMid,letterSpacing:".4px",textTransform:"uppercase"}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:"none",background:C.surface,color:C.text,cursor:"pointer"}}>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  </div>
);
const Tabs = ({tabs,active,onChange}) => (
  <div style={{display:"flex",gap:2,background:"#F1F5F9",borderRadius:10,padding:4,flexWrap:"wrap"}}>
    {tabs.map(t=><button key={t.id} onClick={()=>onChange(t.id)} style={{padding:"7px 14px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s",background:active===t.id?C.surface:"transparent",color:active===t.id?C.text:C.textMid,boxShadow:active===t.id?"0 1px 4px rgba(0,0,0,.08)":"none"}}>{t.label}</button>)}
  </div>
);
const Toggle = ({value,onChange,label}) => (
  <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>onChange(!value)}>
    <div style={{width:40,height:22,borderRadius:99,background:value?C.accent:C.border,position:"relative",transition:"background .2s",flexShrink:0}}>
      <div style={{width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:value?21:3,transition:"left .2s"}}/>
    </div>
    {label&&<span style={{fontSize:13,color:C.textMid}}>{label}</span>}
  </div>
);
const Modal = ({title,onClose,children,width=560}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(13,27,42,.65)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} className="su" style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:width,maxHeight:"92vh",overflow:"auto",boxShadow:"0 24px 60px rgba(0,0,0,.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 22px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.surface,zIndex:1}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.textMuted,lineHeight:1}}>×</button>
      </div>
      <div style={{padding:"18px 22px"}}>{children}</div>
    </div>
  </div>
);
const StatCard = ({label,value,sub,color=C.accent,icon}) => (
  <Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div>
        <div style={{fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:".5px",textTransform:"uppercase",marginBottom:7}}>{label}</div>
        <div style={{fontSize:26,fontWeight:700}}>{value}</div>
        {sub&&<div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{sub}</div>}
      </div>
      {icon&&<div style={{width:40,height:40,borderRadius:10,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{icon}</div>}
    </div>
  </Card>
);
const RichBar = () => (
  <div style={{display:"flex",gap:3,padding:"5px 9px",background:"#F8FAFC",borderBottom:`1px solid ${C.border}`,borderRadius:"8px 8px 0 0",flexWrap:"wrap"}}>
    {[["B"],["I"],["U"],["|"],["x²"],["x₂"],["|"],["√"],["∑"],["∫"],["π"],["≥"],["≤"],["≠"],["|"],["📷"],["🔢"]].map((it,i)=>
      it[0]==="|"?<div key={i} style={{width:1,background:C.border,margin:"0 2px"}}/>:
      <button key={i} style={{padding:"3px 6px",borderRadius:5,border:`1px solid ${C.border}`,background:C.surface,fontSize:it[0].length>1?11:13,fontWeight:600,cursor:"pointer",minWidth:25,color:C.text}} onMouseEnter={e=>e.currentTarget.style.background=C.accentLight} onMouseLeave={e=>e.currentTarget.style.background=C.surface}>{it[0]}</button>
    )}
  </div>
);
const RichArea = ({value,onChange,placeholder,minHeight=90}) => (
  <div>
    <RichBar/>
    <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",padding:"9px 12px",borderRadius:"0 0 8px 8px",border:`1px solid ${C.border}`,borderTop:"none",fontSize:13,minHeight,resize:"vertical",outline:"none",fontFamily:"Sora,sans-serif",lineHeight:1.7}}/>
  </div>
);

// ── Data ──────────────────────────────────────────────────────────────────────
const STUDENTS = [
  {id:"ST001",name:"Amara Okonkwo",   class:"JSS 3A",gpa:3.7,fees:"Paid",  avatar:"AO"},
  {id:"ST002",name:"Kofi Mensah",     class:"SSS 2B",gpa:3.2,fees:"Owing", avatar:"KM"},
  {id:"ST003",name:"Fatima Al-Hassan",class:"JSS 1C",gpa:3.9,fees:"Paid",  avatar:"FA"},
  {id:"ST004",name:"David Nwachukwu", class:"SSS 3A",gpa:2.8,fees:"Owing", avatar:"DN"},
  {id:"ST005",name:"Chidinma Eze",    class:"JSS 2B",gpa:4.0,fees:"Paid",  avatar:"CE"},
  {id:"ST006",name:"Ibrahim Musa",    class:"SSS 1A",gpa:3.5,fees:"Paid",  avatar:"IM"},
];
const STAFF = [
  {id:"TC001",name:"Mrs. Blessing Adeyemi",subject:"Mathematics",   dept:"Sciences",  status:"Active"},
  {id:"TC002",name:"Mr. Charles Osei",     subject:"English Language",dept:"Languages",status:"Active"},
  {id:"TC003",name:"Ms. Ngozi Ike",        subject:"Biology",        dept:"Sciences",  status:"On Leave"},
  {id:"TC004",name:"Mr. Yusuf Abdullahi",  subject:"History",        dept:"Humanities",status:"Active"},
];
const SUBJECTS  = ["Mathematics","English Language","Biology","Physics","Chemistry","History","Geography","Agricultural Science","Civic Education","Computer Studies"];
const CLASSES   = ["JSS 1A","JSS 1B","JSS 2A","JSS 2B","JSS 3A","JSS 3B","SSS 1A","SSS 1B","SSS 2A","SSS 2B","SSS 3A","SSS 3B"];
const DAYS      = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const EXAMS     = [
  {id:"EX001",title:"Mathematics Mid-Term",class:"SSS 2",duration:60,questions:30,status:"Active",  type:"MCQ"},
  {id:"EX002",title:"English Comprehension",class:"JSS 3",duration:45,questions:20,status:"Draft",  type:"Mixed"},
  {id:"EX003",title:"Biology Theory",       class:"SSS 3",duration:90,questions:15,status:"Completed",type:"Essay"},
];
const CBT_QS = [
  {id:1,type:"mcq",  marks:2,text:"Which formula gives the area of a circle?",options:["A=πr²","A=2πr","A=πd","A=r²"],answer:0},
  {id:2,type:"mcq",  marks:2,text:"What is the value of √144?",options:["11","12","13","14"],answer:1},
  {id:3,type:"short",marks:5,text:"Define the Pythagorean theorem and write its formula.",answer:""},
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard", label:"Dashboard",        icon:"🏠",group:"main"},
  {id:"students",  label:"Students",          icon:"👨‍🎓",group:"academic"},
  {id:"staff",     label:"Staff",             icon:"👩‍🏫",group:"academic"},
  {id:"attendance",label:"Attendance",        icon:"✅",group:"academic"},
  {id:"grades",    label:"Grades",            icon:"📊",group:"academic"},
  {id:"timetable", label:"Timetable",         icon:"📅",group:"academic"},
  {id:"cbt",       label:"CBT Exams",         icon:"💻",group:"exams"},
  {id:"cbt-create",label:"Create Exam",       icon:"✏️",group:"exams"},
  {id:"cbt-take",  label:"Take Exam",         icon:"📝",group:"exams"},
  {id:"ai-tools",  label:"AI Teaching Tools", icon:"🤖",group:"ai"},
  {id:"fees",      label:"Fees & Finance",    icon:"💳",group:"admin"},
  {id:"messaging", label:"Messaging",         icon:"💬",group:"admin"},
  {id:"hostel",    label:"Hostel",            icon:"🏠",group:"admin"},
  {id:"inventory", label:"Inventory",         icon:"📦",group:"admin"},
  {id:"library",   label:"Library",           icon:"📚",group:"admin"},
  {id:"settings",  label:"Settings",          icon:"⚙️",group:"admin"},
];
const GROUPS={main:"Main",academic:"Academics",exams:"Examinations",ai:"AI Tools",admin:"Administration"};

const Sidebar = ({active,onNav,collapsed,setCollapsed}) => {
  const groups=[...new Set(NAV.map(n=>n.group))];
  return (
    <aside style={{width:collapsed?64:C.sidebarW,minHeight:"100vh",background:C.navy,display:"flex",flexDirection:"column",transition:"width .25s",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto",overflowX:"hidden"}}>
      <div style={{padding:"18px 14px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${C.navyLight}`}}>
        <div style={{width:32,height:32,borderRadius:9,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>⚡</div>
        {!collapsed&&<span style={{color:"#fff",fontWeight:700,fontSize:15,letterSpacing:"-.3px"}}>LearnersForge</span>}
      </div>
      <nav style={{flex:1,padding:"10px 8px"}}>
        {groups.map(g=>{
          const items=NAV.filter(n=>n.group===g);
          return (
            <div key={g} style={{marginBottom:18}}>
              {!collapsed&&<div style={{fontSize:9,fontWeight:700,color:"#4B6080",letterSpacing:"1.2px",textTransform:"uppercase",padding:"0 8px 6px"}}>{GROUPS[g]}</div>}
              {items.map(item=>(
                <button key={item.id} onClick={()=>onNav(item.id)}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:collapsed?0:9,padding:collapsed?"8px 0":"8px 10px",justifyContent:collapsed?"center":"flex-start",borderRadius:9,border:"none",cursor:"pointer",background:active===item.id?C.accent+"22":"transparent",color:active===item.id?C.accent:"#8DA4C0",fontSize:12,fontWeight:active===item.id?600:400,transition:"all .15s",marginBottom:1}}
                  onMouseEnter={e=>{if(active!==item.id){e.currentTarget.style.background="#1A2E4540";e.currentTarget.style.color="#C8D8E8";}}}
                  onMouseLeave={e=>{if(active!==item.id){e.currentTarget.style.background="transparent";e.currentTarget.style.color="#8DA4C0";}}}
                >
                  <span style={{fontSize:15}}>{item.icon}</span>
                  {!collapsed&&<span>{item.label}</span>}
                  {!collapsed&&active===item.id&&<div style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:C.accent}}/>}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
      <button onClick={()=>setCollapsed(!collapsed)} style={{padding:"12px 14px",background:"transparent",border:"none",color:"#4B6080",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:collapsed?"center":"flex-start",gap:8,fontSize:11,borderTop:`1px solid ${C.navyLight}`}}>
        <span style={{fontSize:15}}>{collapsed?"→":"←"}</span>{!collapsed&&"Collapse"}
      </button>
    </aside>
  );
};

// ── Topbar ────────────────────────────────────────────────────────────────────
const TITLES={dashboard:"Dashboard",students:"Student Management",staff:"Staff Management",attendance:"Attendance",grades:"Grades & Report Cards",timetable:"Timetable",cbt:"CBT Exams","cbt-create":"Create Exam","cbt-take":"Take Exam","ai-tools":"AI Teaching Tools",fees:"Fees & Finance",messaging:"Messaging",hostel:"Hostel Management",inventory:"Inventory",library:"Library Management",settings:"Settings"};
const Topbar = ({page,onNav}) => (
  <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
    <div>
      <h1 style={{fontSize:16,fontWeight:700}}>{TITLES[page]||page}</h1>
      <div style={{fontSize:10,color:C.textMuted}}>2025/2026 · 2nd Term</div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <button style={{background:"#F1F5F9",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,color:C.textMid,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
        🔔<span style={{background:C.coral,color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>3</span>
      </button>
      <div onClick={()=>onNav("settings")} style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",padding:"4px 10px",borderRadius:8,transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#F1F5F9"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <Avatar initials="SA" size={30} color={C.accent}/>
        <div style={{lineHeight:1.3}}>
          <div style={{fontSize:12,fontWeight:600}}>Super Admin</div>
          <div style={{fontSize:10,color:C.textMuted}}>Greenfield Academy</div>
        </div>
      </div>
    </div>
  </header>
);

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = ({onNav}) => (
  <div className="fi">
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:18}}>
      <StatCard label="Total Students" value="1,284" sub="↑ 12 this term"     color={C.accent} icon="👨‍🎓"/>
      <StatCard label="Teaching Staff" value="68"    sub="4 on leave"          color={C.sky}   icon="👩‍🏫"/>
      <StatCard label="Attendance Rate" value="94.2%" sub="1,208 present today" color={C.amber} icon="✅"/>
      <StatCard label="Fees Collected" value="₦18.4M" sub="₦2.1M outstanding"  color={C.purple} icon="💳"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:14}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700}}>Weekly Attendance</div><Badge color="green">This Week</Badge>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:88}}>
          {[92,96,88,94,97].map((v,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:10,fontWeight:600,color:C.textMid}}>{v}%</div>
              <div style={{width:"100%",background:C.accent,borderRadius:"4px 4px 0 0",height:v*.72}}/>
              <div style={{fontSize:9,color:C.textMuted}}>{"MTWTF"[i]}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Active Exams</div>
        {EXAMS.map(e=>(
          <div key={e.id} onClick={()=>onNav("cbt")} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
            <div style={{fontSize:12,fontWeight:600}}>{e.title}</div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
              <span style={{fontSize:10,color:C.textMuted}}>{e.class}·{e.duration}min</span>
              <Badge color={e.status==="Active"?"green":e.status==="Draft"?"amber":"gray"} size="sm">{e.status}</Badge>
            </div>
          </div>
        ))}
        <Btn onClick={()=>onNav("cbt")} variant="ghost" size="sm" style={{marginTop:8,color:C.accent}}>View all →</Btn>
      </Card>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Recent Students</div>
        {STUDENTS.slice(0,4).map(s=>(
          <div key={s.id} onClick={()=>onNav("students")} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
            <Avatar initials={s.avatar} size={28} color={C.accent}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{s.name}</div><div style={{fontSize:10,color:C.textMuted}}>{s.class}</div></div>
            <Badge color={s.fees==="Paid"?"green":"red"} size="sm">{s.fees}</Badge>
          </div>
        ))}
      </Card>
      <Card>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Quick Actions</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["✏️","Create Exam","cbt-create"],["🤖","AI Questions","ai-tools"],["✅","Attendance","attendance"],["📊","Grades","grades"],["💬","Message","messaging"],["💳","Payments","fees"]].map(([ic,lb,pg])=>(
            <button key={lb} onClick={()=>onNav(pg)} style={{padding:"10px",borderRadius:9,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",gap:7,fontSize:12,fontWeight:500,transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.background=C.accentLight;e.currentTarget.style.borderColor=C.accent;}} onMouseLeave={e=>{e.currentTarget.style.background=C.surface;e.currentTarget.style.borderColor=C.border;}}>
              <span style={{fontSize:16}}>{ic}</span>{lb}
            </button>
          ))}
        </div>
      </Card>
    </div>
  </div>
);

// ── Students ──────────────────────────────────────────────────────────────────
const Students = () => {
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);
  const filtered=STUDENTS.filter(s=>s.name.toLowerCase().includes(search.toLowerCase()));
  if(selected) return (
    <div className="fi">
      <Btn onClick={()=>setSelected(null)} variant="secondary" size="sm" style={{marginBottom:16}}>← Back</Btn>
      <div style={{display:"grid",gridTemplateColumns:"270px 1fr",gap:16}}>
        <Card>
          <div style={{textAlign:"center",padding:"6px 0 14px"}}>
            <Avatar initials={selected.avatar} size={66} color={C.accent}/>
            <div style={{marginTop:10,fontSize:15,fontWeight:700}}>{selected.name}</div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{selected.class}</div>
            <Badge color={selected.fees==="Paid"?"green":"red"}>{selected.fees}</Badge>
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,display:"flex",flexDirection:"column",gap:9}}>
            {[["ID",selected.id],["GPA",selected.gpa+" / 4.0"],["Status","Active"],["Guardian","Mr. Emmanuel Okonkwo"],["Phone","+234 801 234 5678"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:C.textMuted}}>{k}</span><span style={{fontWeight:600}}>{v}</span></div>
            ))}
          </div>
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card>
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Academic Performance</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
              {[["Mathematics",78,C.sky],["English",85,C.accent],["Biology",72,C.amber],["Physics",90,C.purple],["Chemistry",68,C.coral],["History",82,C.sky]].map(([s,v,c])=>(
                <div key={s} style={{padding:"10px 11px",borderRadius:9,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{s}</div>
                  <div style={{fontSize:19,fontWeight:700,color:v>=80?C.accentDark:v>=60?C.amber:C.coral}}>{v}%</div>
                  <div style={{marginTop:4,height:4,borderRadius:99,background:C.border}}><div style={{height:4,borderRadius:99,background:c,width:v+"%"}}/></div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>Attendance</div>
            <div style={{display:"flex",gap:14}}>
              {[["Present","187","green"],["Absent","12","red"],["Late","6","amber"]].map(([l,v,c])=>(
                <div key={l} style={{flex:1,padding:"11px",borderRadius:9,background:C[c+"Light"]||"#F3F4F6",textAlign:"center"}}>
                  <div style={{fontSize:19,fontWeight:700}}>{v}</div>
                  <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
  return (
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <Input value={search} onChange={setSearch} placeholder="🔍 Search students…" style={{width:250}}/>
        <div style={{display:"flex",gap:8}}><Btn variant="secondary">📥 Import CSV</Btn><Btn variant="primary">+ Add Student</Btn></div>
      </div>
      <Card style={{padding:0}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:`1px solid ${C.border}`,background:"#F8FAFC"}}>{["Student","ID","Class","GPA","Fees","Action"].map(h=><th key={h} style={{padding:"10px 15px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:".5px"}}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((s,i)=>(
              <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`,transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"10px 15px"}}><div style={{display:"flex",alignItems:"center",gap:9}}><Avatar initials={s.avatar} size={28} color={[C.accent,C.sky,C.purple,C.amber,C.coral][i%5]}/><span style={{fontSize:12,fontWeight:600}}>{s.name}</span></div></td>
                <td style={{padding:"10px 15px",fontSize:11,color:C.textMuted,fontFamily:"monospace"}}>{s.id}</td>
                <td style={{padding:"10px 15px",fontSize:12}}>{s.class}</td>
                <td style={{padding:"10px 15px",fontSize:13,fontWeight:700,color:s.gpa>=3.5?C.accentDark:s.gpa>=2.5?C.amber:C.coral}}>{s.gpa}</td>
                <td style={{padding:"10px 15px"}}><Badge color={s.fees==="Paid"?"green":"red"} size="sm">{s.fees}</Badge></td>
                <td style={{padding:"10px 15px"}}><Btn onClick={()=>setSelected(s)} size="sm" variant="secondary">View</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};



// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE  — QR/Biometric, Excused/Unexcused, Early Dismissal, Comments
// ═══════════════════════════════════════════════════════════════════════════════
const STATUS_OPTS = [
  { value:"present",           label:"✅ Present" },
  { value:"absent-excused",    label:"🔵 Absent – Excused" },
  { value:"absent-unexcused",  label:"🔴 Absent – Unexcused" },
  { value:"late",              label:"⏰ Late" },
  { value:"late-excused",      label:"🔵 Late – Excused" },
  { value:"early-dismissal",   label:"🚪 Early Dismissal" },
];

const QRScanner = ({ onClose, onScan }) => {
  const [scanned, setScanned] = useState([]);
  const [scanning, setScanning] = useState(true);

  useState(() => {
    let i = 0;
    const t = setInterval(() => {
      if (i < STUDENTS.length) {
        setScanned(p => [...p, { id: STUDENTS[i].id, name: STUDENTS[i].name, time: new Date().toLocaleTimeString() }]);
        i++;
      } else {
        setScanning(false);
        clearInterval(t);
      }
    }, 800);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <div style={{ display:"flex", gap:16, marginBottom:18 }}>
        {/* Viewfinder */}
        <div style={{ width:196, height:196, borderRadius:12, background:"#0D1B2A", position:"relative", overflow:"hidden", flexShrink:0 }}>
          {[{top:8,left:8},{top:8,right:8},{bottom:8,left:8},{bottom:8,right:8}].map((pos,i) => (
            <div key={i} style={{ position:"absolute", width:22, height:22, border:"3px solid "+C.accent,
              borderBottomWidth: "top" in pos ? 0 : "3px",
              borderTopWidth:    "bottom" in pos ? 0 : "3px",
              borderRightWidth:  "left" in pos ? 0 : "3px",
              borderLeftWidth:   "right" in pos ? 0 : "3px",
              ...pos
            }}/>
          ))}
          {scanning && (
            <div style={{ position:"absolute", left:8, right:8, height:2, background:C.accent, boxShadow:"0 0 8px "+C.accent, animation:"qrScan 1.5s linear infinite" }}/>
          )}
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:scanning?C.accent:"#2ECC9A", fontSize:11, fontWeight:600 }}>
            {scanning ? "SCANNING…" : "DONE ✓"}
          </div>
        </div>
        {/* Results */}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.textMid, marginBottom:8, textTransform:"uppercase", letterSpacing:".4px" }}>Scan Results</div>
          <div style={{ maxHeight:160, overflowY:"auto", display:"flex", flexDirection:"column", gap:5 }}>
            {scanned.map((s,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", borderRadius:7, background:C.accentLight, fontSize:12, animation:"fadeIn .3s ease" }}>
                <span style={{ fontWeight:600, color:C.accentDark }}>{s.name}</span>
                <span style={{ color:C.textMuted }}>{s.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display:"flex", gap:9, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => onScan(scanned)} disabled={scanned.length === 0}>
          ✅ Apply ({scanned.length}) Scans
        </Btn>
      </div>
    </div>
  );
};

const BiometricModal = ({ onClose, onDone }) => {
  const [step, setStep] = useState("ready");
  useState(() => {
    if (step === "scanning") {
      const t = setTimeout(() => setStep("done"), 2000);
      return () => clearTimeout(t);
    }
  }, [step]);
  return (
    <div style={{ textAlign:"center", padding:"10px 0" }}>
      <div style={{ width:80, height:80, borderRadius:"50%", background:step==="done"?C.accentLight:"#F1F5F9", border:`3px solid ${step==="done"?C.accent:step==="scanning"?C.sky:C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 16px", transition:"all .3s" }}>
        {step === "done" ? "✅" : "👆"}
      </div>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>
        {step==="ready" ? "Place Finger on Scanner" : step==="scanning" ? "Reading…" : "Fingerprint Matched!"}
      </div>
      <div style={{ fontSize:12, color:C.textMid, marginBottom:20 }}>
        {step==="done" ? "Kofi Mensah — ST002 marked Present" : "Hold still while the sensor reads your fingerprint"}
      </div>
      <div style={{ display:"flex", gap:9, justifyContent:"center" }}>
        {step==="ready"    && <Btn variant="primary" onClick={() => setStep("scanning")}>Start Scan</Btn>}
        {step==="scanning" && <Btn variant="ghost" disabled>Scanning…</Btn>}
        {step==="done"     && <><Btn variant="secondary" onClick={() => setStep("ready")}>Scan Next</Btn><Btn variant="primary" onClick={onDone}>Done</Btn></>}
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </div>
    </div>
  );
};

const Attendance = () => {
  const [method,  setMethod]  = useState("manual");
  const [modal,   setModal]   = useState(null);
  const [records, setRecords] = useState(
    Object.fromEntries(STUDENTS.map(s => [s.id, { status:"", comment:"", dismissTime:"" }]))
  );

  const setField = (id, key, val) => setRecords(p => ({ ...p, [id]: { ...p[id], [key]: val } }));
  const countBy  = prefix => Object.values(records).filter(r => r.status.startsWith(prefix)).length;
  const totalMarked = Object.values(records).filter(r => r.status).length;

  const applyQR = scanned => {
    setRecords(p => {
      const n = { ...p };
      scanned.forEach(sc => { if (n[sc.id]) n[sc.id] = { ...n[sc.id], status:"present" }; });
      return n;
    });
    setModal(null);
  };

  const statusBorderColor = s => ({
    present:"#2ECC9A", "absent-excused":"#3B82F6", "absent-unexcused":"#EF4444",
    late:"#F59E0B", "late-excused":"#3B82F6", "early-dismissal":"#F97316",
  })[s] || C.border;

  return (
    <div className="fi">
      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:2, background:"#F1F5F9", borderRadius:10, padding:4 }}>
          {[["manual","✏️ Manual"],["qr","📷 QR Code"],["biometric","👆 Biometric"]].map(([v,l]) => (
            <button key={v} onClick={() => { setMethod(v); if (v !== "manual") setModal(v); }}
              style={{ padding:"6px 14px", borderRadius:8, border:"none", fontSize:12, fontWeight:600, cursor:"pointer",
                background:method===v?C.surface:"transparent", color:method===v?C.text:C.textMid,
                boxShadow:method===v?"0 1px 4px rgba(0,0,0,.08)":"none", transition:"all .15s" }}>{l}</button>
          ))}
        </div>
        <Sel label="" value="JSS 3A" onChange={() => {}} options={CLASSES.map(c => ({ value:c, label:c }))} style={{ width:140 }}/>
        <Sel label="" value="Monday" onChange={() => {}} options={DAYS.map(d => ({ value:d, label:d }))} style={{ width:130 }}/>
        <div style={{ marginLeft:"auto", display:"flex", gap:9 }}>
          <Btn variant="secondary" size="sm">📥 Download Register</Btn>
          <Btn variant="primary" disabled={totalMarked===0}>✅ Submit ({totalMarked}/{STUDENTS.length})</Btn>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {[["Present",countBy("present"),C.accent],["Absent",countBy("absent"),C.coral],["Late",countBy("late"),C.amber],["Early Dismiss",countBy("early-dismissal"),C.orange],["Unmarked",STUDENTS.length-totalMarked,C.textMuted]].map(([l,v,col]) => (
          <div key={l} style={{ flex:1, minWidth:90, padding:"11px 13px", background:col+"14", borderRadius:10, border:`1px solid ${col}28` }}>
            <div style={{ fontSize:20, fontWeight:700, color:col }}>{v}</div>
            <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Register */}
      <Card style={{ padding:0 }}>
        {STUDENTS.map((s, i) => {
          const rec = records[s.id];
          const isED = rec.status === "early-dismissal";
          return (
            <div key={s.id} style={{ borderBottom: i < STUDENTS.length-1 ? `1px solid ${C.border}` : "none", padding:"12px 18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <Avatar initials={s.avatar} size={32} color={C.accent}/>
                <div style={{ minWidth:150 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{s.name}</div>
                  <div style={{ fontSize:10, color:C.textMuted }}>{s.id}</div>
                </div>

                {/* Status dropdown */}
                <select value={rec.status} onChange={e => setField(s.id, "status", e.target.value)}
                  style={{ padding:"6px 10px", borderRadius:8, border:`1.5px solid ${rec.status ? statusBorderColor(rec.status) : C.border}`,
                    fontSize:12, outline:"none", background:rec.status?C.accentLight:C.surface,
                    fontFamily:"Sora,sans-serif", cursor:"pointer", flex:1, minWidth:200 }}>
                  <option value="">— Mark attendance —</option>
                  {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {/* Early dismissal time picker */}
                {isED && (
                  <input type="time" value={rec.dismissTime} onChange={e => setField(s.id, "dismissTime", e.target.value)}
                    style={{ padding:"6px 10px", borderRadius:8, border:`1px solid ${C.orange}`, fontSize:12, outline:"none", background:C.orangeLight, width:110 }}/>
                )}

                {rec.status && (
                  <Badge color={{ present:"green","absent-excused":"blue","absent-unexcused":"red",late:"amber","late-excused":"blue","early-dismissal":"orange" }[rec.status]||"gray"} size="sm">
                    {STATUS_OPTS.find(o => o.value === rec.status)?.label.replace(/^[^\s]+\s/, "")}
                  </Badge>
                )}
              </div>

              {/* Optional comment */}
              <div style={{ marginTop:7, marginLeft:44 }}>
                <input value={rec.comment} onChange={e => setField(s.id, "comment", e.target.value)}
                  placeholder="Optional comment — reason, medical note, parent call…"
                  style={{ width:"100%", maxWidth:560, padding:"5px 10px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:11,
                    outline:"none", color:C.textMid, fontFamily:"Sora,sans-serif", background:"#FAFAFA" }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e  => e.target.style.borderColor = C.border}/>
              </div>
            </div>
          );
        })}
      </Card>

      {modal==="qr"        && <Modal title="📷 QR Code Scanner"   onClose={() => setModal(null)} width={500}><QRScanner      onClose={() => setModal(null)} onScan={applyQR}/></Modal>}
      {modal==="biometric" && <Modal title="👆 Biometric Scanner" onClose={() => setModal(null)} width={400}><BiometricModal onClose={() => setModal(null)} onDone={() => setModal(null)}/></Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GRADES  — CA types, psychomotor, affective, comments, cumulative, report card
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_CA = [
  { id:"ca1",  label:"1st C.A.",      max:10, enabled:true  },
  { id:"ca2",  label:"2nd C.A.",      max:10, enabled:true  },
  { id:"asn",  label:"Assignment",    max:10, enabled:true  },
  { id:"mid",  label:"Mid-Term Test", max:10, enabled:false },
  { id:"exam", label:"Exam",          max:60, enabled:true  },
];
const PSYCHOMOTOR = ["Handwriting","Drawing / Craft","Physical Education","Music","Practical Skills","Participation","Leadership","Team Work","Public Speaking"];
const AFFECTIVE   = ["Punctuality","Neatness","Attentiveness","Honesty","Cooperation","Diligence","Relationship with Others"];
const gradeLabel  = v => v>=75?"A1":v>=70?"B2":v>=65?"B3":v>=60?"C4":v>=55?"C5":v>=50?"C6":v>=45?"D7":v>=40?"E8":"F9";
const gradeColor  = g => g.startsWith("A")?"green":g.startsWith("B")?"blue":g.startsWith("C")?"amber":"red";

const TraitSel = ({ value, onChange }) => (
  <select value={value||""} onChange={e => onChange(e.target.value)}
    style={{ padding:"3px 6px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:11, outline:"none", background:C.surface }}>
    <option value="">—</option>
    {["Excellent","Very Good","Good","Fair","Poor"].map(r => <option key={r} value={r}>{r}</option>)}
  </select>
);

const Grades = () => {
  const [tab,           setTab]           = useState("scores");
  const [caTypes,       setCaTypes]       = useState(DEFAULT_CA);
  const [cumTerms,      setCumTerms]      = useState({ t1:true, t2:true, t3:false });
  const [comments,      setComments]      = useState(Object.fromEntries(STUDENTS.map(s => [s.id, { teacher:"", principal:"" }])));
  const [psycho,        setPsycho]        = useState(Object.fromEntries(STUDENTS.map(s => [s.id, {}])));
  const [affective,     setAffective]     = useState(Object.fromEntries(STUDENTS.map(s => [s.id, {}])));
  const [showCAConfig,  setShowCAConfig]  = useState(false);

  const enabledCA   = caTypes.filter(c => c.enabled);
  const caTotal     = enabledCA.reduce((a, c) => a + c.max, 0);
  const mockScore   = (sid, cid) => Math.min(enabledCA.find(c=>c.id===cid)?.max||10, ((sid.charCodeAt(2)+cid.charCodeAt(0))%enabledCA.find(c=>c.id===cid)?.max)+1);
  const totalFor    = sid => enabledCA.reduce((a, c) => a + mockScore(sid, c.id), 0);

  return (
    <div className="fi">
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <Tabs tabs={[{id:"scores",label:"📊 Scores"},{id:"psychomotor",label:"🏃 Psychomotor"},{id:"affective",label:"💙 Affective"},{id:"cumulative",label:"📈 Cumulative"},{id:"reportcard",label:"🖨 Report Card"}]} active={tab} onChange={setTab}/>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <Btn variant="secondary" size="sm" onClick={() => setShowCAConfig(true)}>⚙️ CA Settings</Btn>
          <Btn variant="primary"   size="sm">💾 Save</Btn>
        </div>
      </div>

      {/* ── SCORES ── */}
      {tab==="scores" && (
        <div>
          <div style={{ display:"flex", gap:10, marginBottom:14 }}>
            <Sel label="" value="SSS 2B"       onChange={() => {}} options={CLASSES.map(c=>({value:c,label:c}))}    style={{ width:150 }}/>
            <Sel label="" value="Mathematics"  onChange={() => {}} options={SUBJECTS.map(s=>({value:s,label:s}))}   style={{ width:200 }}/>
            <Sel label="" value="2nd Term"     onChange={() => {}} options={["1st Term","2nd Term","3rd Term"].map(t=>({value:t,label:t}))} style={{ width:140 }}/>
          </div>
          <Card style={{ padding:0, overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:680 }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                  <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Student</th>
                  {enabledCA.map(c => (
                    <th key={c.id} style={{ padding:"10px 9px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>
                      {c.label}<br/><span style={{ fontWeight:400, fontSize:9 }}>/{c.max}</span>
                    </th>
                  ))}
                  <th style={{ padding:"10px 9px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Total<br/><span style={{ fontWeight:400, fontSize:9 }}>/100</span></th>
                  <th style={{ padding:"10px 9px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {STUDENTS.map(s => {
                  const total = totalFor(s.id);
                  const g = gradeLabel(total);
                  return (
                    <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"9px 14px" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><Avatar initials={s.avatar} size={24} color={C.accent}/><span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span></div></td>
                      {enabledCA.map(c => (
                        <td key={c.id} style={{ padding:"7px 7px", textAlign:"center" }}>
                          <input type="number" min={0} max={c.max} defaultValue={mockScore(s.id,c.id)}
                            style={{ width:46, padding:"4px 4px", textAlign:"center", borderRadius:6, border:`1px solid ${C.border}`, fontSize:12, fontWeight:600, outline:"none" }}
                            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
                        </td>
                      ))}
                      <td style={{ padding:"9px 9px", textAlign:"center", fontSize:13, fontWeight:700, color:total>=60?C.accentDark:total>=40?C.amber:C.coral }}>{total}</td>
                      <td style={{ padding:"9px 9px", textAlign:"center" }}><Badge color={gradeColor(g)} size="sm">{g}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Teacher & Principal Comments */}
          <Card style={{ marginTop:14 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>💬 Class Teacher & Principal Comments</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {STUDENTS.map(s => (
                <div key={s.id} style={{ padding:"12px 14px", borderRadius:10, border:`1px solid ${C.border}`, background:"#F8FAFC" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <Avatar initials={s.avatar} size={22} color={C.accent}/>
                    <span style={{ fontSize:12, fontWeight:700 }}>{s.name}</span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {[["Class Teacher's Comment","teacher","e.g. A brilliant student who needs to improve time management…"],["Principal / Head Teacher's Comment","principal","e.g. Keep up the excellent work. We expect great results next term…"]].map(([lbl,key,ph]) => (
                      <div key={key}>
                        <label style={{ fontSize:10, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".4px", display:"block", marginBottom:4 }}>{lbl}</label>
                        <textarea value={comments[s.id][key]} onChange={e => setComments(p => ({ ...p, [s.id]: { ...p[s.id], [key]: e.target.value } }))}
                          placeholder={ph}
                          style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, fontSize:12, resize:"none", outline:"none", minHeight:58, fontFamily:"Sora,sans-serif", lineHeight:1.6 }}
                          onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── PSYCHOMOTOR ── */}
      {tab==="psychomotor" && (
        <Card style={{ padding:0, overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:820 }}>
            <thead>
              <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", minWidth:160 }}>Student</th>
                {PSYCHOMOTOR.map(t => <th key={t} style={{ padding:"10px 8px", textAlign:"center", fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", maxWidth:88 }}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {STUDENTS.map(s => (
                <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"8px 14px" }}><div style={{ display:"flex", alignItems:"center", gap:7 }}><Avatar initials={s.avatar} size={22} color={C.accent}/><span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span></div></td>
                  {PSYCHOMOTOR.map(t => (
                    <td key={t} style={{ padding:"6px 6px", textAlign:"center" }}>
                      <TraitSel value={(psycho[s.id]||{})[t]} onChange={v => setPsycho(p => ({ ...p, [s.id]: { ...(p[s.id]||{}), [t]:v } }))}/>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── AFFECTIVE ── */}
      {tab==="affective" && (
        <Card style={{ padding:0, overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", minWidth:160 }}>Student</th>
                {AFFECTIVE.map(t => <th key={t} style={{ padding:"10px 8px", textAlign:"center", fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", maxWidth:90 }}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {STUDENTS.map(s => (
                <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"8px 14px" }}><div style={{ display:"flex", alignItems:"center", gap:7 }}><Avatar initials={s.avatar} size={22} color={C.accent}/><span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span></div></td>
                  {AFFECTIVE.map(t => (
                    <td key={t} style={{ padding:"6px 6px", textAlign:"center" }}>
                      <TraitSel value={(affective[s.id]||{})[t]} onChange={v => setAffective(p => ({ ...p, [s.id]: { ...(p[s.id]||{}), [t]:v } }))}/>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── CUMULATIVE ── */}
      {tab==="cumulative" && (
        <div>
          <Card style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>📈 Select Terms to Include in Cumulative Average</div>
            <div style={{ display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
              {[["t1","1st Term"],["t2","2nd Term"],["t3","3rd Term"]].map(([k,l]) => (
                <Toggle key={k} value={cumTerms[k]} onChange={v => setCumTerms(p => ({ ...p, [k]:v }))} label={l}/>
              ))}
              <span style={{ marginLeft:"auto", fontSize:12, color:C.textMid }}>
                Averaging across <strong>{Object.values(cumTerms).filter(Boolean).length}</strong> term(s)
              </span>
            </div>
          </Card>
          <Card style={{ padding:0 }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                  <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Student</th>
                  {cumTerms.t1 && <th style={{ padding:"10px 10px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>1st Term</th>}
                  {cumTerms.t2 && <th style={{ padding:"10px 10px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>2nd Term</th>}
                  {cumTerms.t3 && <th style={{ padding:"10px 10px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>3rd Term</th>}
                  <th style={{ padding:"10px 10px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Cumulative</th>
                  <th style={{ padding:"10px 10px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {STUDENTS.map(s => {
                  const base = parseInt(s.id.slice(-1));
                  const t1=62+base*3, t2=65+base*2, t3=70+base;
                  const vals = [cumTerms.t1&&t1, cumTerms.t2&&t2, cumTerms.t3&&t3].filter(Boolean);
                  const avg  = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
                  const g    = gradeLabel(avg);
                  return (
                    <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"10px 14px" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><Avatar initials={s.avatar} size={24} color={C.accent}/><span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span></div></td>
                      {cumTerms.t1 && <td style={{ padding:"10px 10px", textAlign:"center", fontSize:13, fontWeight:600 }}>{t1}</td>}
                      {cumTerms.t2 && <td style={{ padding:"10px 10px", textAlign:"center", fontSize:13, fontWeight:600 }}>{t2}</td>}
                      {cumTerms.t3 && <td style={{ padding:"10px 10px", textAlign:"center", fontSize:13, fontWeight:600 }}>{t3}</td>}
                      <td style={{ padding:"10px 10px", textAlign:"center", fontSize:15, fontWeight:700, color:avg>=60?C.accentDark:avg>=40?C.amber:C.coral }}>{avg}</td>
                      <td style={{ padding:"10px 10px", textAlign:"center" }}><Badge color={gradeColor(g)} size="sm">{g}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── REPORT CARD ── */}
      {tab==="reportcard" && (
        <div>
          <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"flex-end", flexWrap:"wrap" }}>
            <Sel label="Student" value={STUDENTS[0].id} onChange={() => {}} options={STUDENTS.map(s=>({value:s.id,label:s.name}))} style={{ width:220 }}/>
            <Sel label="Term"    value="2nd Term"        onChange={() => {}} options={["1st Term","2nd Term","3rd Term"].map(t=>({value:t,label:t}))} style={{ width:150 }}/>
            <Btn variant="secondary" size="sm">📥 Download PDF</Btn>
            <Btn variant="secondary" size="sm">📄 Download Word</Btn>
          </div>
          <Card style={{ maxWidth:680, margin:"0 auto", border:"2px solid "+C.border }}>
            <div style={{ textAlign:"center", borderBottom:`2px solid ${C.navy}`, paddingBottom:12, marginBottom:14 }}>
              <div style={{ fontSize:18, fontWeight:700, color:C.navy }}>GREENFIELD ACADEMY</div>
              <div style={{ fontSize:11, color:C.textMid }}>12 Education Lane, Lagos · +234 800 123 4567</div>
              <div style={{ fontSize:13, fontWeight:700, marginTop:8, color:C.accent }}>STUDENT REPORT CARD — 2nd Term 2025/2026</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12, marginBottom:14 }}>
              {[["Student Name","Amara Okonkwo"],["Student ID","ST001"],["Class","SSS 2B"],["Position","3rd / 42"],["Next Term Begins","Sep 8, 2026"],["Date Issued","Jul 18, 2026"]].map(([k,v]) => (
                <div key={k} style={{ display:"flex", gap:6 }}><span style={{ color:C.textMuted, minWidth:120 }}>{k}:</span><span style={{ fontWeight:600 }}>{v}</span></div>
              ))}
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:14 }}>
              <thead>
                <tr style={{ background:C.navy }}>
                  {["Subject","CA1","CA2","Asn","Exam","Total","Grade","Remark"].map(h => (
                    <th key={h} style={{ padding:"7px 9px", fontSize:10, fontWeight:700, color:"#C8D8E8", textTransform:"uppercase", textAlign:"center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.slice(0,6).map((s, i) => {
                  const total = 55+i*4; const g = gradeLabel(total);
                  return (
                    <tr key={s} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#F8FAFC":"#fff" }}>
                      <td style={{ padding:"7px 9px", fontSize:12, fontWeight:600 }}>{s}</td>
                      {[7+i,6+i,8+i,34+i*2].map((v,j) => <td key={j} style={{ padding:"7px 9px", textAlign:"center", fontSize:12 }}>{v}</td>)}
                      <td style={{ padding:"7px 9px", textAlign:"center", fontSize:13, fontWeight:700, color:total>=60?C.accentDark:C.amber }}>{total}</td>
                      <td style={{ padding:"7px 9px", textAlign:"center" }}><Badge color={gradeColor(g)} size="sm">{g}</Badge></td>
                      <td style={{ padding:"7px 9px", textAlign:"center", fontSize:11, color:C.textMid }}>{total>=70?"Excellent":total>=60?"Good":"Average"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              {[["Class Teacher's Comment","Amara is a focused student. With more effort in Chemistry, she will excel.","— Mrs. B. Adeyemi"],["Principal's Comment","Commendable performance. Continue to strive for excellence in all subjects.","— Dr. O. Fashola, Principal"]].map(([title,text,sig]) => (
                <div key={title} style={{ padding:"10px 12px", borderRadius:9, background:"#F8FAFC", border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", marginBottom:5 }}>{title}</div>
                  <div style={{ fontSize:12, lineHeight:1.6, color:C.textMid }}>{text}</div>
                  <div style={{ fontSize:10, color:C.textMuted, marginTop:6 }}>{sig}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* CA Config Modal */}
      {showCAConfig && (
        <Modal title="⚙️ Continuous Assessment Settings" onClose={() => setShowCAConfig(false)} width={560}>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <p style={{ fontSize:12, color:C.textMid }}>Enable/disable components and set their maximum marks. Total enabled marks must equal 100.</p>
            {caTypes.map((c, i) => (
              <div key={c.id} style={{ display:"grid", gridTemplateColumns:"auto 1fr auto 60px", gap:10, alignItems:"center", padding:"9px 12px", borderRadius:9, border:`1px solid ${C.border}`, background:c.enabled?"#F8FAFC":"#fff" }}>
                <input type="checkbox" checked={c.enabled} onChange={e => setCaTypes(p => p.map((x,j) => j===i ? {...x,enabled:e.target.checked} : x))} style={{ width:15, height:15, cursor:"pointer" }}/>
                <input value={c.label} onChange={e => setCaTypes(p => p.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                  style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:13, outline:"none" }}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
                <span style={{ fontSize:12, color:C.textMid, whiteSpace:"nowrap" }}>Max score:</span>
                <input type="number" value={c.max} onChange={e => setCaTypes(p => p.map((x,j) => j===i ? {...x,max:parseInt(e.target.value)||0} : x))}
                  style={{ padding:"6px 8px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:13, outline:"none", textAlign:"center" }}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
              </div>
            ))}
            <div style={{ padding:"9px 12px", borderRadius:9, fontSize:12, fontWeight:700,
              background: caTotal===100 ? C.accentLight : C.amberLight,
              color:      caTotal===100 ? C.accentDark  : "#92400E" }}>
              Total: {caTotal} / 100 {caTotal===100 ? "✅" : "⚠️ Must equal 100"}
            </div>
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8 }}>Apply Settings To:</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <Btn size="sm" variant="secondary">This Class Only</Btn>
                <Btn size="sm" variant="amber">🔁 All Classes in School</Btn>
                <Btn size="sm" variant="secondary">↗ Replicate to Other Terms</Btn>
              </div>
            </div>
            <div style={{ display:"flex", gap:9, justifyContent:"flex-end", marginTop:4 }}>
              <Btn variant="secondary" onClick={() => setShowCAConfig(false)}>Cancel</Btn>
              <Btn variant="primary"   onClick={() => setShowCAConfig(false)}>💾 Save Settings</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIMETABLE  — editable period intervals, inline cell editing
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_PERIODS = [
  "7:30 – 8:10","8:10 – 8:50","8:50 – 9:30","9:30 – 10:10",
  "10:10 – 10:30 (Break)","10:30 – 11:10","11:10 – 11:50",
  "11:50 – 12:30","12:30 – 1:10 (Lunch)","1:10 – 1:50","1:50 – 2:30",
];
const SUBJ_COLORS = {
  Mathematics:"#3B82F622", "English Language":"#2ECC9A22", Biology:"#F59E0B22",
  Physics:"#8B5CF622", Chemistry:"#EF444422", History:"#6EE7B722",
  Geography:"#14B8A622", "Agricultural Science":"#F9731622", "Civic Education":"#D1D5DB",
  "Computer Studies":"#3B82F611", Break:"#F3F4F6", Lunch:"#F3F4F6",
  Assembly:"#F8FAFC", "Free Period":"#F8FAFC",
};
const ALL_SUBJECTS = [...SUBJECTS, "Break","Lunch","Assembly","Free Period"];
const FILL = {
  0:["Mathematics","English Language","Biology","Physics","Chemistry","History","Break","Geography","Lunch","Computer Studies","Civic Education"],
  1:["English Language","Mathematics","Physics","Chemistry","Biology","Break","History","Mathematics","Lunch","Geography","Agricultural Science"],
  2:["Biology","Physics","English Language","History","Break","Mathematics","Chemistry","Civic Education","Lunch","Computer Studies","Geography"],
  3:["Chemistry","Geography","Mathematics","Break","English Language","Biology","Physics","History","Lunch","Agricultural Science","Computer Studies"],
  4:["History","Chemistry","Break","Geography","Mathematics","Physics","English Language","Biology","Lunch","Civic Education","Agricultural Science"],
};

const Timetable = () => {
  const [periods, setPeriods] = useState(DEFAULT_PERIODS.map((p,i) => ({ id:i, label:p })));
  const [editPeriodModal, setEditPeriodModal] = useState(false);
  const [grid, setGrid] = useState(() => {
    const g = {};
    DAYS.forEach((d,di) => DEFAULT_PERIODS.forEach((_,pi) => { g[`${di}-${pi}`] = FILL[di]?.[pi] || "Mathematics"; }));
    return g;
  });

  const isBreak = label => /break|lunch|assembly/i.test(label);

  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, gap:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:9, alignItems:"center" }}>
          <Sel label="" value="JSS 3A"    onChange={() => {}} options={CLASSES.map(c=>({value:c,label:c}))} style={{ width:150 }}/>
          <Sel label="" value="2nd Term"  onChange={() => {}} options={["1st Term","2nd Term","3rd Term"].map(t=>({value:t,label:t}))} style={{ width:140 }}/>
        </div>
        <div style={{ display:"flex", gap:9 }}>
          <Btn variant="secondary" size="sm" onClick={() => setEditPeriodModal(true)}>⏱ Edit Periods</Btn>
          <Btn variant="secondary" size="sm">📥 Export PDF</Btn>
          <Btn variant="primary"   size="sm">💾 Save Timetable</Btn>
        </div>
      </div>

      <Card style={{ padding:0, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
          <thead>
            <tr style={{ background:C.navy }}>
              <th style={{ padding:"10px 12px", color:"#8DA4C0", fontSize:10, fontWeight:700, textTransform:"uppercase", width:140 }}>Period / Time</th>
              {DAYS.map(d => <th key={d} style={{ padding:"10px 12px", color:"#C8D8E8", fontSize:12, fontWeight:600 }}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, pi) => {
              const brk = isBreak(p.label);
              return (
                <tr key={p.id} style={{ borderBottom:`1px solid ${C.border}`, background:brk?"#F8FAFC":"transparent" }}>
                  <td style={{ padding:"7px 11px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, lineHeight:1.4 }}>{p.label}</div>
                  </td>
                  {DAYS.map((d, di) => {
                    const key  = `${di}-${pi}`;
                    const subj = grid[key] || "";
                    const isBreakCell = /break|lunch|assembly|free/i.test(subj);
                    return (
                      <td key={d} style={{ padding:"4px 5px" }}>
                        {isBreakCell ? (
                          <div style={{ padding:"7px 8px", borderRadius:7, background:"#F3F4F6", textAlign:"center", fontSize:11, color:C.textMuted, fontStyle:"italic" }}>{subj}</div>
                        ) : (
                          <select value={subj} onChange={e => setGrid(g => ({ ...g, [key]:e.target.value }))}
                            style={{ width:"100%", padding:"6px 5px", borderRadius:7, border:"1.5px solid transparent", fontSize:11, fontWeight:600,
                              outline:"none", cursor:"pointer", background:SUBJ_COLORS[subj]||"#F8FAFC", transition:"border .15s" }}
                            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor="transparent"}>
                            {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Period editor modal */}
      {editPeriodModal && (
        <Modal title="⏱ Edit Time Periods" onClose={() => setEditPeriodModal(false)} width={480}>
          <p style={{ fontSize:12, color:C.textMid, marginBottom:14 }}>Edit, add or remove periods. Mark break/lunch periods by including those words in the label.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
            {periods.map((p, i) => (
              <div key={p.id} style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:12, color:C.textMuted, minWidth:20, textAlign:"right" }}>{i+1}.</span>
                <input value={p.label} onChange={e => setPeriods(ps => ps.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                  style={{ flex:1, padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, fontSize:12, outline:"none" }}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
                <Btn size="sm" variant="ghost" onClick={() => setPeriods(ps => ps.filter((_,j) => j!==i))}>🗑</Btn>
              </div>
            ))}
          </div>
          <Btn size="sm" variant="secondary" onClick={() => setPeriods(p => [...p, { id:Date.now(), label:"New Period" }])}>+ Add Period</Btn>
          <div style={{ display:"flex", gap:9, justifyContent:"flex-end", marginTop:16 }}>
            <Btn variant="secondary" onClick={() => setEditPeriodModal(false)}>Cancel</Btn>
            <Btn variant="primary"   onClick={() => setEditPeriodModal(false)}>💾 Save Periods</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════════
// CBT EXAMS LIST
// ═══════════════════════════════════════════════════════════════════════════════
const CBTExams = ({ onNav }) => (
  <div className="fi">
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <div style={{ display:"flex", gap:7 }}>
        {["All","Active","Draft","Completed"].map(f => (
          <button key={f} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:f==="All"?C.navy:C.surface, color:f==="All"?"#fff":C.textMid, fontSize:12, fontWeight:500, cursor:"pointer" }}>{f}</button>
        ))}
      </div>
      <Btn onClick={() => onNav("cbt-create")} variant="primary">+ Create Exam</Btn>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
      {EXAMS.map(exam => (
        <Card key={exam.id} onClick={() => onNav("cbt-create")}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div style={{ width:42, height:42, borderRadius:10, background:C.navy, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>💻</div>
            <Badge color={exam.status==="Active"?"green":exam.status==="Draft"?"amber":"gray"}>{exam.status}</Badge>
          </div>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:3 }}>{exam.title}</div>
          <div style={{ fontSize:11, color:C.textMuted, marginBottom:12 }}>{exam.class} · {exam.type}</div>
          <div style={{ display:"flex", gap:14, borderTop:`1px solid ${C.border}`, paddingTop:11 }}>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:15, fontWeight:700 }}>{exam.questions}</div><div style={{ fontSize:9, color:C.textMuted }}>Questions</div></div>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:15, fontWeight:700 }}>{exam.duration}</div><div style={{ fontSize:9, color:C.textMuted }}>Minutes</div></div>
            <div style={{ flex:1 }}/>
            <Btn size="sm" variant="secondary" onClick={e => { e.stopPropagation(); onNav("cbt-take"); }}>Preview</Btn>
          </div>
        </Card>
      ))}
      <button onClick={() => onNav("cbt-create")}
        style={{ border:`2px dashed ${C.border}`, borderRadius:14, padding:"26px 16px", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:9, transition:"all .15s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.background=C.accentLight; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.background="transparent"; }}>
        <span style={{ fontSize:28 }}>+</span><span style={{ fontSize:13, fontWeight:600, color:C.textMid }}>Create New Exam</span>
      </button>
    </div>
  </div>
);

// ── CBT CREATE ────────────────────────────────────────────────────────────────
const CBTCreate = ({ onNav }) => {
  const [tab,      setTab]      = useState("details");
  const [questions,setQuestions]= useState(CBT_QS);
  const [editingQ, setEditingQ] = useState(null);
  const [duration, setDuration] = useState("60");
  const totalMarks = questions.reduce((a,q) => a+q.marks, 0);
  const addQ = type => {
    const nq = { id:Date.now(), type, marks:type==="mcq"?2:type==="short"?5:10, text:"", options:type==="mcq"?["","","",""]:[], answer:0 };
    setQuestions(p => [...p, nq]);
    setEditingQ(nq.id);
  };
  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <Btn onClick={() => onNav("cbt")} variant="secondary" size="sm">← Back</Btn>
        <div style={{ display:"flex", gap:9 }}>
          <Btn variant="secondary">💾 Draft</Btn>
          <Btn variant="primary" onClick={() => onNav("cbt-take")}>👁 Preview</Btn>
          <Btn variant="navy">🚀 Publish</Btn>
        </div>
      </div>
      <Tabs tabs={[{id:"details",label:"Exam Details"},{id:"questions",label:`Questions (${questions.length})`},{id:"settings",label:"Settings"}]} active={tab} onChange={setTab}/>
      <div style={{ marginTop:16 }}>
        {tab==="details" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 310px", gap:16 }}>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Exam Information</div>
              <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                <Input label="Exam Title" value="Mathematics Mid-Term Exam" onChange={() => {}}/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                  <Sel label="Class" value="SSS 2" onChange={() => {}} options={CLASSES.map(c=>({value:c,label:c}))}/>
                  <Sel label="Subject" value="Mathematics" onChange={() => {}} options={SUBJECTS.map(s=>({value:s,label:s}))}/>
                  <Sel label="Term" value="2nd Term" onChange={() => {}} options={["1st Term","2nd Term","3rd Term"].map(t=>({value:t,label:t}))}/>
                  <Sel label="Type" value="mid-term" onChange={() => {}} options={[{value:"mid-term",label:"Mid-Term"},{value:"final",label:"Final Exam"},{value:"quiz",label:"Class Quiz"},{value:"ca",label:"C.A. Test"}]}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".4px", display:"block", marginBottom:4 }}>Instructions</label>
                  <RichArea value="Answer all questions carefully." onChange={() => {}}/>
                </div>
              </div>
            </Card>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <Card>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:13 }}>Time & Scoring</div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <input type="range" min={5} max={180} value={duration} onChange={e=>setDuration(e.target.value)} style={{ flex:1 }}/>
                  <div style={{ padding:"5px 11px", borderRadius:8, background:C.navy, color:"#fff", fontSize:13, fontWeight:700, minWidth:46, textAlign:"center" }}>{duration}m</div>
                </div>
                {[["Questions",questions.length],["Total Marks",totalMarks],["Pass Mark",Math.round(totalMarks*.5)]].map(([l,v]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderTop:`1px solid ${C.border}`, fontSize:12 }}><span style={{ color:C.textMuted }}>{l}</span><span style={{ fontWeight:700 }}>{v}</span></div>
                ))}
              </Card>
            </div>
          </div>
        )}
        {tab==="questions" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 240px", gap:16 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
              {questions.map((q,i) => (
                <Card key={q.id} style={{ borderLeft:`4px solid ${q.type==="mcq"?C.sky:q.type==="short"?C.accent:C.purple}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                    <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:C.textMuted }}>Q{i+1}</span>
                      <Badge color={q.type==="mcq"?"blue":q.type==="short"?"green":"purple"} size="sm">{q.type.toUpperCase()}</Badge>
                      <span style={{ fontSize:11, color:C.textMuted }}>{q.marks}mk</span>
                    </div>
                    <div style={{ display:"flex", gap:5 }}>
                      <Btn size="sm" variant="ghost" onClick={() => setEditingQ(editingQ===q.id?null:q.id)}>{editingQ===q.id?"▲ Collapse":"✏️ Edit"}</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setQuestions(p => p.filter(x=>x.id!==q.id))}>🗑</Btn>
                    </div>
                  </div>
                  {editingQ===q.id ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      <div>
                        <label style={{ fontSize:10, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".4px", display:"block", marginBottom:4 }}>Question Text</label>
                        <RichArea value={q.text} onChange={v => setQuestions(p => p.map(x => x.id===q.id?{...x,text:v}:x))} placeholder="Type your question here…" minHeight={70}/>
                      </div>
                      {q.type==="mcq" && q.options.map((opt,oi) => (
                        <div key={oi} style={{ display:"flex", alignItems:"center", gap:9 }}>
                          <button onClick={() => setQuestions(p => p.map(x => x.id===q.id?{...x,answer:oi}:x))}
                            style={{ width:24, height:24, borderRadius:"50%", border:`2px solid ${q.answer===oi?C.accent:C.border}`, background:q.answer===oi?C.accent:"transparent", cursor:"pointer", fontSize:10, fontWeight:700, color:q.answer===oi?"#fff":C.textMuted }}>
                            {["A","B","C","D"][oi]}
                          </button>
                          <input defaultValue={opt} placeholder={`Option ${["A","B","C","D"][oi]}`}
                            style={{ flex:1, padding:"6px 10px", borderRadius:7, border:`1px solid ${q.answer===oi?C.accent:C.border}`, fontSize:12, outline:"none" }}
                            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>{if(q.answer!==oi)e.target.style.borderColor=C.border;}}/>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize:13, color:q.text?C.text:C.textMuted, fontStyle:q.text?"normal":"italic" }}>{q.text||"Click Edit to add question text…"}</div>
                  )}
                </Card>
              ))}
              <Card style={{ background:"#F8FAFC", border:`2px dashed ${C.border}` }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.textMid, marginBottom:10 }}>Add Question</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {[["🔘 MCQ","mcq",C.sky],["✏️ Short","short",C.accent],["📄 Essay","essay",C.purple],["✅ True/False","tf",C.amber],["___ Fill Blank","fill",C.coral]].map(([l,v,col]) => (
                    <button key={v} onClick={() => addQ(v)}
                      style={{ padding:"7px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.surface, fontSize:12, fontWeight:600, cursor:"pointer", color:C.textMid, transition:"all .15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=col;e.currentTarget.style.background=col+"14";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surface;}}>{l}</button>
                  ))}
                </div>
              </Card>
            </div>
            <Card>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>Navigator</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {questions.map((q,i) => (
                  <button key={q.id} onClick={() => setEditingQ(q.id===editingQ?null:q.id)}
                    style={{ width:30, height:30, borderRadius:7, border:`1.5px solid ${editingQ===q.id?C.accent:C.border}`, background:editingQ===q.id?C.accentLight:C.surface, fontSize:11, fontWeight:700, cursor:"pointer" }}>{i+1}</button>
                ))}
              </div>
            </Card>
          </div>
        )}
        {tab==="settings" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:13 }}>Security & Display</div>
              {[["Shuffle question order",true],["Shuffle answer options",true],["Show score after submission",false],["Prevent copy/paste",true],["One question at a time",false]].map(([label,def]) => {
                const [on, setOn] = useState(def);
                return (<div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.border}` }}><span style={{ fontSize:12 }}>{label}</span><Toggle value={on} onChange={setOn}/></div>);
              })}
            </Card>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:13 }}>Access Control</div>
              <Sel label="Assigned Class" value="SSS 2A" onChange={() => {}} options={CLASSES.map(c=>({value:c,label:c}))} style={{ marginBottom:12 }}/>
              <Input label="Start Date & Time" value="" onChange={() => {}} type="datetime-local" style={{ marginBottom:12 }}/>
              <Input label="End Date & Time"   value="" onChange={() => {}} type="datetime-local"/>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

// ── CBT TAKE ──────────────────────────────────────────────────────────────────
const CBTTake = ({ onNav }) => {
  const [current,   setCurrent]   = useState(0);
  const [answers,   setAnswers]   = useState({});
  const [timeLeft,  setTimeLeft]  = useState(3600);
  const [submitted, setSubmitted] = useState(false);
  const [shortText, setShortText] = useState({});
  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setTimeLeft(p => p > 0 ? p-1 : 0), 1000);
    return () => clearInterval(t);
  }, [submitted]);
  const fmt  = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const q    = CBT_QS[current];
  const answered = Object.keys(answers).length;
  if (submitted) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"60px 20px" }}>
      <div style={{ fontSize:54 }}>🎉</div>
      <h2 style={{ fontSize:21, fontWeight:700, marginTop:12 }}>Exam Submitted!</h2>
      <p style={{ color:C.textMid, marginTop:6, fontSize:13 }}>Results will be released by your teacher.</p>
      <div style={{ display:"flex", gap:16, marginTop:26 }}>
        <div style={{ padding:"17px 26px", borderRadius:12, background:C.accentLight, textAlign:"center" }}><div style={{ fontSize:24, fontWeight:700, color:C.accentDark }}>{answered}/{CBT_QS.length}</div><div style={{ fontSize:11, color:C.textMid, marginTop:2 }}>Answered</div></div>
        <div style={{ padding:"17px 26px", borderRadius:12, background:C.skyLight, textAlign:"center" }}><div style={{ fontSize:24, fontWeight:700, color:C.sky }}>{fmt(3600-timeLeft)}</div><div style={{ fontSize:11, color:C.textMid, marginTop:2 }}>Time Used</div></div>
      </div>
      <Btn onClick={() => onNav("cbt")} variant="primary" style={{ marginTop:26 }}>Back to Exams</Btn>
    </div>
  );
  return (
    <div className="fi">
      <div style={{ background:C.navy, borderRadius:12, padding:"13px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div><div style={{ color:"#fff", fontSize:14, fontWeight:700 }}>Mathematics Mid-Term Exam</div><div style={{ color:"#8DA4C0", fontSize:11, marginTop:2 }}>SSS 2 · {CBT_QS.length} Questions · 60 Minutes</div></div>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          <div style={{ textAlign:"center" }}><div style={{ color:"#8DA4C0", fontSize:9, textTransform:"uppercase" }}>Answered</div><div style={{ color:"#fff", fontSize:17, fontWeight:700 }}>{answered}/{CBT_QS.length}</div></div>
          <div style={{ padding:"8px 16px", borderRadius:9, background:timeLeft<300?C.coral+"22":C.accent+"22", border:`2px solid ${timeLeft<300?C.coral:C.accent}` }}>
            <div style={{ color:timeLeft<300?C.coral:C.accent, fontSize:22, fontWeight:700, fontFamily:"JetBrains Mono,monospace" }}>{fmt(timeLeft)}</div>
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 190px", gap:16 }}>
        <Card>
          <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:16 }}>
            <span style={{ fontSize:12, fontWeight:700, color:C.textMuted }}>Q{current+1} of {CBT_QS.length}</span>
            <Badge color={q.type==="mcq"?"blue":q.type==="short"?"green":"purple"} size="sm">{q.type.toUpperCase()}</Badge>
            <span style={{ fontSize:11, color:C.textMuted }}>{q.marks} mark{q.marks>1?"s":""}</span>
          </div>
          <div style={{ fontSize:15, lineHeight:1.7, marginBottom:20, padding:"13px 16px", background:"#F8FAFC", borderRadius:10, borderLeft:`3px solid ${C.accent}` }}>{q.text}</div>
          {q.type==="mcq" && (
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {q.options.map((opt,oi) => (
                <button key={oi} onClick={() => setAnswers(p => ({...p,[q.id]:oi}))}
                  style={{ padding:"11px 15px", borderRadius:9, border:`2px solid ${answers[q.id]===oi?C.accent:C.border}`, background:answers[q.id]===oi?C.accentLight:C.surface, cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"all .15s" }}
                  onMouseEnter={e=>{if(answers[q.id]!==oi)e.currentTarget.style.borderColor=C.borderDark;}}
                  onMouseLeave={e=>{if(answers[q.id]!==oi)e.currentTarget.style.borderColor=C.border;}}>
                  <div style={{ width:26, height:26, borderRadius:"50%", border:`2px solid ${answers[q.id]===oi?C.accent:C.borderDark}`, background:answers[q.id]===oi?C.accent:"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:answers[q.id]===oi?"#fff":C.textMid, flexShrink:0 }}>{["A","B","C","D"][oi]}</div>
                  <span style={{ fontSize:13, color:answers[q.id]===oi?C.accentDark:C.text, fontWeight:answers[q.id]===oi?600:400 }}>{opt}</span>
                </button>
              ))}
            </div>
          )}
          {(q.type==="short"||q.type==="essay") && (
            <div>
              <RichBar/>
              <textarea value={shortText[q.id]||""} onChange={e => { setShortText(p=>({...p,[q.id]:e.target.value})); setAnswers(p=>({...p,[q.id]:e.target.value})); }}
                placeholder="Type your answer here…"
                style={{ width:"100%", padding:"10px 13px", borderRadius:"0 0 9px 9px", border:`1px solid ${C.border}`, borderTop:"none", fontSize:13, minHeight:q.type==="essay"?180:90, resize:"vertical", outline:"none", fontFamily:"Sora,sans-serif", lineHeight:1.7 }}/>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:20 }}>
            <Btn onClick={() => setCurrent(p => Math.max(0,p-1))} variant="secondary" disabled={current===0}>← Previous</Btn>
            {current < CBT_QS.length-1
              ? <Btn onClick={() => setCurrent(p => p+1)} variant="primary">Next →</Btn>
              : <Btn onClick={() => setSubmitted(true)} variant="navy">Submit Exam 🚀</Btn>}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>Question Navigator</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {CBT_QS.map((q2,i) => (
              <button key={i} onClick={() => setCurrent(i)}
                style={{ width:32, height:32, borderRadius:7, border:`2px solid ${current===i?C.accent:answers[q2.id]!==undefined?C.accentDark:C.border}`, background:current===i||answers[q2.id]!==undefined?C.accentLight:C.surface, fontSize:11, fontWeight:700, cursor:"pointer", color:answers[q2.id]!==undefined?C.accentDark:C.textMid }}>{i+1}</button>
            ))}
          </div>
          <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:5 }}>
            {[["Answered",C.accent],["Current",C.sky],["Not yet",C.border]].map(([l,c]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:7, fontSize:11, color:C.textMid }}>
                <div style={{ width:11, height:11, borderRadius:3, background:c }}/>{l}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI TEACHING TOOLS  — subject+topic, custom prompts, map to exam, PDF/Word export
// ═══════════════════════════════════════════════════════════════════════════════
const AITools = () => {
  const [tab,            setTab]           = useState("qgen");
  const [notes,          setNotes]         = useState("The Pythagorean theorem states that in a right-angled triangle, the square of the hypotenuse equals the sum of the squares of the other two sides: a² + b² = c².\n\nExample: If a=3 and b=4, then c=√(9+16)=√25=5.");
  const [loading,        setLoading]       = useState(false);
  const [aiQuestions,    setAiQuestions]   = useState([]);
  const [subject,        setSubject]       = useState("Mathematics");
  const [topic,          setTopic]         = useState("Pythagorean Theorem");
  const [lessonClass,    setLessonClass]   = useState("JSS 3");
  const [lessonContent,  setLessonContent] = useState("");
  const [loadingLesson,  setLoadingLesson] = useState(false);
  const [qCount,         setQCount]        = useState("5");
  const [qType,          setQType]         = useState("mcq");
  const [difficulty,     setDifficulty]    = useState("medium");
  const [customQ,        setCustomQ]       = useState("");
  const [customL,        setCustomL]       = useState("");
  const [mapExam,        setMapExam]       = useState("");
  const [mapModal,       setMapModal]      = useState(false);
  const [toast,          setToast]         = useState(null);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const generateQuestions = useCallback(async () => {
    setLoading(true); setAiQuestions([]);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          messages:[{ role:"user", content:
            `You are an expert teacher. Generate ${qCount} ${qType==="mcq"?"multiple choice":qType==="short"?"short answer":"essay"} questions.\nSubject: ${subject}. Topic: ${topic}. Difficulty: ${difficulty}.${customQ?"\n\nAdditional instruction: "+customQ:""}\n\nLesson Notes:\n${notes}\n\nRespond ONLY with a JSON array, no markdown, no preamble.\n${qType==="mcq"?'[{"type":"mcq","text":"?","options":["A","B","C","D"],"answer":0,"marks":2}]':'[{"type":"'+qType+'","text":"?","model_answer":"expected","marks":5}]'}`
          }]
        })
      });
      const data = await resp.json();
      const raw  = data.content?.find(c=>c.type==="text")?.text || "[]";
      setAiQuestions(JSON.parse(raw.replace(/```json|```/g,"").trim()));
    } catch {
      setAiQuestions([{ type:"mcq", text:"What is the square of the hypotenuse in a 3-4-5 right triangle?", options:["5","7","25","12"], answer:0, marks:2 }]);
    }
    setLoading(false);
  }, [notes,qCount,qType,difficulty,subject,topic,customQ]);

  const generateLesson = useCallback(async () => {
    setLoadingLesson(true); setLessonContent("");
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          messages:[{ role:"user", content:
            `Write a detailed lesson note for Nigerian secondary school students.\nSubject: ${subject}. Topic: ${topic}. Class: ${lessonClass}.${customL?"\n\nAdditional instruction: "+customL:""}\n\nInclude: Learning Objectives, Introduction, Main Content with examples, Class Activities, Summary, Assignment. Use clear headings.`
          }]
        })
      });
      const data = await resp.json();
      setLessonContent(data.content?.find(c=>c.type==="text")?.text || "");
    } catch {
      setLessonContent(`# ${topic}\n**Subject:** ${subject} | **Class:** ${lessonClass}\n\n**Learning Objectives:**\nBy the end of this lesson, students should be able to...\n\n**Introduction:**\nIn this lesson, we will explore ${topic}...`);
    }
    setLoadingLesson(false);
  }, [subject,topic,lessonClass,customL]);

  const handleMapToExam = () => {
    if (!mapExam) return;
    showToast(`✅ ${aiQuestions.length} questions added to "${EXAMS.find(e=>e.id===mapExam)?.title}"`);
    setMapModal(false);
  };

  return (
    <div className="fi">
      {toast && (
        <div style={{ position:"fixed", bottom:26, right:26, zIndex:2000, background:C.navy, color:"#fff", padding:"11px 18px", borderRadius:11, fontSize:12, fontWeight:600, boxShadow:"0 8px 28px rgba(0,0,0,.2)", borderLeft:`4px solid ${C.accent}` }}>{toast}</div>
      )}
      <div style={{ display:"flex", gap:12, alignItems:"center", padding:"13px 18px", background:"linear-gradient(135deg,#0D1B2A 0%,#1A2E45 100%)", borderRadius:12, marginBottom:18, border:`1px solid ${C.accent}30` }}>
        <div style={{ width:42, height:42, borderRadius:11, background:C.accent+"22", border:`2px solid ${C.accent}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🤖</div>
        <div><div style={{ color:"#fff", fontSize:15, fontWeight:700 }}>AI Teaching Assistant</div><div style={{ color:"#8DA4C0", fontSize:11, marginTop:2 }}>Generate questions from notes, create lesson plans — powered by Claude AI</div></div>
        <div style={{ marginLeft:"auto" }}><Badge color="green">AI Powered</Badge></div>
      </div>
      <Tabs tabs={[{id:"qgen",label:"📝 Question Generator"},{id:"lesson",label:"📖 Lesson Note Creator"},{id:"rubric",label:"📋 Rubric Builder"}]} active={tab} onChange={setTab}/>

      <div style={{ marginTop:16 }}>
        {/* ── QUESTION GENERATOR ── */}
        {tab==="qgen" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:13 }}>⚙️ Configure Generation</div>
              {/* Subject + Topic */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                <Sel label="Subject" value={subject} onChange={setSubject} options={SUBJECTS.map(s=>({value:s,label:s}))}/>
                <Input label="Topic" value={topic} onChange={setTopic} placeholder="e.g. Pythagoras Theorem"/>
              </div>
              {/* Lesson Notes */}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".4px", display:"block", marginBottom:4 }}>Lesson Notes</label>
                <RichArea value={notes} onChange={setNotes} placeholder="Paste lesson notes, textbook excerpt or topic summary…" minHeight={130}/>
              </div>
              {/* Config row */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginBottom:11 }}>
                <Sel label="Type"       value={qType}      onChange={setQType}      options={[{value:"mcq",label:"MCQ"},{value:"short",label:"Short Answer"},{value:"essay",label:"Essay"},{value:"mixed",label:"Mixed"}]}/>
                <Sel label="Count"      value={qCount}     onChange={setQCount}     options={["3","5","10","15","20"].map(n=>({value:n,label:n+" questions"}))}/>
                <Sel label="Difficulty" value={difficulty} onChange={setDifficulty} options={[{value:"easy",label:"Easy"},{value:"medium",label:"Medium"},{value:"hard",label:"Hard"}]}/>
              </div>
              {/* Custom prompt */}
              <Input label="Custom Prompt (optional)" value={customQ} onChange={setCustomQ} placeholder="e.g. Focus on real-life applications, avoid calculus…" style={{ marginBottom:12 }}/>
              <Btn onClick={generateQuestions} disabled={loading||!notes.trim()} variant="primary" style={{ width:"100%", justifyContent:"center" }}>
                {loading ? <><span style={{ display:"inline-block", animation:"spin .8s linear infinite", marginRight:6 }}>⟳</span>Generating…</> : "🤖 Generate Questions with AI"}
              </Btn>
            </Card>

            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:13 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>Generated Questions</div>
                {aiQuestions.length > 0 && (
                  <div style={{ display:"flex", gap:7 }}>
                    <Btn size="sm" variant="secondary">📥 PDF</Btn>
                    <Btn size="sm" variant="secondary">📄 Word</Btn>
                    <Btn size="sm" variant="primary" onClick={() => setMapModal(true)}>📌 Map to Exam</Btn>
                  </div>
                )}
              </div>
              {loading && (
                <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"10px 0" }}>
                  {[80,60,90,70].map((w,i) => <div key={i} style={{ height:11, borderRadius:5, background:C.border, width:w+"%", animation:"pulse 1.5s infinite", animationDelay:i*.15+"s" }}/>)}
                  <div style={{ textAlign:"center", padding:"16px 0", color:C.textMid, fontSize:12 }}><div style={{ fontSize:22, marginBottom:6 }}>🤖</div>Analysing lesson notes…</div>
                </div>
              )}
              {!loading && aiQuestions.length===0 && (
                <div style={{ textAlign:"center", padding:"38px 16px", color:C.textMuted }}><div style={{ fontSize:34, marginBottom:10 }}>💡</div><div style={{ fontSize:13 }}>Paste lesson notes and click Generate</div></div>
              )}
              {!loading && aiQuestions.map((q,i) => (
                <div key={i} style={{ padding:"11px 13px", borderRadius:9, border:`1px solid ${C.border}`, marginBottom:9, animation:"fadeIn .3s ease", animationDelay:i*.07+"s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7 }}>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ fontSize:10, fontWeight:700, color:C.textMuted }}>Q{i+1}</span>
                      <Badge color={q.type==="mcq"?"blue":"green"} size="sm">{q.type==="mcq"?"MCQ":"Short"}</Badge>
                      <span style={{ fontSize:10, color:C.textMuted }}>{q.marks}mk</span>
                    </div>
                    <Btn size="sm" variant="ghost">✏️</Btn>
                  </div>
                  <div style={{ fontSize:12, lineHeight:1.6, marginBottom:7 }}>{q.text}</div>
                  {q.type==="mcq" && q.options && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {q.options.map((o,oi) => (
                        <span key={oi} style={{ padding:"2px 9px", borderRadius:5, fontSize:11, background:q.answer===oi?C.accentLight:"#F3F4F6", color:q.answer===oi?C.accentDark:C.textMid, fontWeight:q.answer===oi?700:400 }}>
                          {["A","B","C","D"][oi]}. {o}
                        </span>
                      ))}
                    </div>
                  )}
                  {q.model_answer && <div style={{ fontSize:11, color:C.textMid, marginTop:6, fontStyle:"italic" }}>💡 {q.model_answer}</div>}
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── LESSON NOTE CREATOR ── */}
        {tab==="lesson" && (
          <div style={{ display:"grid", gridTemplateColumns:"310px 1fr", gap:16 }}>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Lesson Plan Details</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {/* Subject BEFORE topic */}
                <Sel label="Subject" value={subject} onChange={setSubject} options={SUBJECTS.map(s=>({value:s,label:s}))}/>
                <Input label="Topic / Title" value={topic} onChange={setTopic} placeholder="e.g. Pythagorean Theorem"/>
                <Sel label="Class / Form" value={lessonClass} onChange={setLessonClass} options={CLASSES.map(c=>({value:c,label:c}))}/>
                <Sel label="Duration" value="40 minutes" onChange={() => {}} options={["40 minutes","60 minutes","80 minutes"].map(d=>({value:d,label:d}))}/>
                <Sel label="Curriculum" value="nigerian" onChange={() => {}} options={[{value:"nigerian",label:"Nigerian (NERDC)"},{value:"cambridge",label:"Cambridge IGCSE"}]}/>
                {/* Custom prompt */}
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".4px", display:"block", marginBottom:4 }}>Custom Prompt (optional)</label>
                  <textarea value={customL} onChange={e => setCustomL(e.target.value)}
                    placeholder="e.g. Include group activity, use Socratic questioning, add a real-world engineering example…"
                    style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, fontSize:12, resize:"vertical", outline:"none", minHeight:58, fontFamily:"Sora,sans-serif", lineHeight:1.6 }}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
                </div>
                <Btn onClick={generateLesson} disabled={loadingLesson||!topic.trim()} variant="primary" style={{ justifyContent:"center" }}>
                  {loadingLesson ? "⟳ Creating…" : "🤖 Generate Lesson Note"}
                </Btn>
                {lessonContent && (
                  <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                    <Btn variant="secondary" style={{ justifyContent:"center" }}>📥 Download as PDF</Btn>
                    <Btn variant="secondary" style={{ justifyContent:"center" }}>📄 Export to Word</Btn>
                    <Btn variant="secondary" style={{ justifyContent:"center" }} onClick={() => { setTab("qgen"); setNotes(lessonContent.slice(0,500)); }}>📝 Generate Questions from This Note</Btn>
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:13 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>Generated Lesson Note</div>
                {lessonContent && <Badge color="green">AI Generated</Badge>}
              </div>
              {loadingLesson && (
                <div style={{ display:"flex", flexDirection:"column", gap:7, padding:"16px 0" }}>
                  {[100,80,60,90,70,80,50].map((w,i) => <div key={i} style={{ height:10, borderRadius:5, background:C.border, width:w+"%", animation:"pulse 1.5s infinite", animationDelay:i*.1+"s" }}/>)}
                  <div style={{ textAlign:"center", padding:"16px 0", color:C.textMid, fontSize:12 }}>Creating your lesson note…</div>
                </div>
              )}
              {!loadingLesson && !lessonContent && (
                <div style={{ textAlign:"center", padding:"60px 16px", color:C.textMuted }}><div style={{ fontSize:34, marginBottom:10 }}>📖</div><div style={{ fontSize:13 }}>Fill in the details and click Generate</div></div>
              )}
              {!loadingLesson && lessonContent && (
                <div style={{ padding:"13px 16px", background:"#F8FAFC", borderRadius:9, minHeight:400, fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap", overflow:"auto", maxHeight:540 }}>{lessonContent}</div>
              )}
            </Card>
          </div>
        )}

        {tab==="rubric" && (
          <Card><div style={{ textAlign:"center", padding:"60px 16px" }}><div style={{ fontSize:34, marginBottom:12 }}>📋</div><div style={{ fontSize:16, fontWeight:700, marginBottom:7 }}>AI Rubric Builder</div><div style={{ fontSize:13, color:C.textMid, marginBottom:20 }}>Generate marking schemes for essay and practical assessments</div><Btn variant="primary">Coming in next sprint</Btn></div></Card>
        )}
      </div>

      {/* Map to Exam Modal */}
      {mapModal && (
        <Modal title="📌 Map Questions to Exam" onClose={() => setMapModal(false)} width={430}>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <div style={{ padding:"10px 13px", borderRadius:9, background:C.accentLight, fontSize:12, color:C.accentDark, fontWeight:600 }}>{aiQuestions.length} generated questions will be added to the selected exam.</div>
            <Sel label="Select Exam" value={mapExam} onChange={setMapExam}
              options={[{value:"",label:"— Choose exam —"}, ...EXAMS.map(e=>({value:e.id,label:`${e.title} (${e.class})`}))]}/>
            {mapExam && (
              <div style={{ padding:"9px 13px", borderRadius:9, background:"#F8FAFC", fontSize:12, color:C.textMid }}>
                Selected: <strong>{EXAMS.find(e=>e.id===mapExam)?.title}</strong> · {EXAMS.find(e=>e.id===mapExam)?.questions} existing questions
              </div>
            )}
            <div style={{ display:"flex", gap:9, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={() => setMapModal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleMapToExam} disabled={!mapExam}>✅ Add to Exam</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FEES & FINANCE  — Overview, Fee Collection, Expenses, Payroll, P&L
// ═══════════════════════════════════════════════════════════════════════════════
const EXPENSES = [
  {id:"E001",desc:"May Staff Salaries",        cat:"Salaries & Payroll",amount:3200000,date:"2026-05-25",by:"Accountant",status:"Paid"},
  {id:"E002",desc:"NEPA / Generator Fuel",     cat:"Utilities",         amount:185000, date:"2026-05-22",by:"Admin",    status:"Paid"},
  {id:"E003",desc:"Classroom Chairs (20 units)",cat:"Maintenance",      amount:360000, date:"2026-05-20",by:"Bursar",   status:"Pending"},
  {id:"E004",desc:"Inter-House Sports Event",  cat:"Events",            amount:220000, date:"2026-05-18",by:"Admin",    status:"Paid"},
  {id:"E005",desc:"Stationery Restock",        cat:"Supplies",          amount:95000,  date:"2026-05-15",by:"Store",    status:"Paid"},
];
const PAYROLL = [
  {id:"TC001",name:"Mrs. Blessing Adeyemi",role:"Teacher",    basic:180000,housing:40000,transport:20000,ded:18000},
  {id:"TC002",name:"Mr. Charles Osei",     role:"Teacher",    basic:175000,housing:40000,transport:20000,ded:17500},
  {id:"TC003",name:"Ms. Ngozi Ike",        role:"Teacher",    basic:175000,housing:40000,transport:20000,ded:17500},
  {id:"ADM1", name:"Mrs. Kemi Fashola",    role:"Admin Staff",basic:120000,housing:30000,transport:15000,ded:12000},
  {id:"BUR1", name:"Mr. Tunde Okafor",     role:"Bursar",     basic:150000,housing:35000,transport:18000,ded:15000},
];

const Fees = () => {
  const [tab, setTab] = useState("overview");
  const totalExp = EXPENSES.reduce((a,e) => a+e.amount, 0);
  return (
    <div className="fi">
      <Tabs tabs={[{id:"overview",label:"📊 Overview"},{id:"fees",label:"💳 Fee Collection"},{id:"expenses",label:"💸 Expenses"},{id:"payroll",label:"👥 Payroll"},{id:"pl",label:"📈 P&L Report"}]} active={tab} onChange={setTab}/>
      <div style={{ marginTop:16 }}>

        {tab==="overview" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:13, marginBottom:16 }}>
              <StatCard label="Total Invoiced"  value="₦24.2M"                              color={C.sky}    icon="📄"/>
              <StatCard label="Fees Collected"  value="₦18.4M" sub="76% collected"          color={C.accent} icon="✅"/>
              <StatCard label="Total Expenses"  value={`₦${(totalExp/1e6).toFixed(2)}M`}    color={C.coral}  icon="💸"/>
              <StatCard label="Net Cash"        value={`₦${((18400000-totalExp)/1e6).toFixed(1)}M`} color={C.accentDark} icon="💰"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:13 }}>
              <Card>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:13 }}>Income vs Expenses</div>
                {[["Fee Income","₦18.4M",C.accent,76],["Payroll","₦3.2M",C.coral,13],["Operations","₦0.9M",C.amber,4],["Events & Others","₦0.3M",C.sky,1]].map(([l,v,c,p]) => (
                  <div key={l} style={{ marginBottom:11 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}><span style={{ fontWeight:600 }}>{l}</span><span style={{ color:C.textMid }}>{v}</span></div>
                    <div style={{ height:6, borderRadius:99, background:C.border }}><div style={{ height:6, borderRadius:99, background:c, width:p+"%" }}/></div>
                  </div>
                ))}
              </Card>
              <Card>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:13 }}>Recent Transactions</div>
                {EXPENSES.slice(0,4).map(e => (
                  <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                    <div><div style={{ fontSize:12, fontWeight:600 }}>{e.desc}</div><div style={{ fontSize:10, color:C.textMuted }}>{e.date} · {e.cat}</div></div>
                    <div style={{ textAlign:"right" }}><div style={{ fontSize:13, fontWeight:700, color:C.coral }}>-₦{e.amount.toLocaleString()}</div><Badge color={e.status==="Paid"?"green":"amber"} size="sm">{e.status}</Badge></div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {tab==="fees" && (
          <div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:9, marginBottom:13 }}>
              <Btn variant="secondary" size="sm">+ Record Payment</Btn>
              <Btn variant="primary"   size="sm">Generate Invoices</Btn>
            </div>
            <Card style={{ padding:0 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#F8FAFC" }}>{["Student","Class","Term Fee","Paid","Balance","Status"].map(h=><th key={h} style={{ padding:"10px 15px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {STUDENTS.map(s => { const fee=85000, paid=s.fees==="Paid"?fee:Math.round(fee*.4); return (
                    <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"10px 15px" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><Avatar initials={s.avatar} size={26} color={C.accent}/><span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span></div></td>
                      <td style={{ padding:"10px 15px", fontSize:12 }}>{s.class}</td>
                      <td style={{ padding:"10px 15px", fontSize:12, fontFamily:"monospace" }}>₦{fee.toLocaleString()}</td>
                      <td style={{ padding:"10px 15px", fontSize:12, fontFamily:"monospace", color:C.accentDark }}>₦{paid.toLocaleString()}</td>
                      <td style={{ padding:"10px 15px", fontSize:12, fontFamily:"monospace", color:s.fees==="Paid"?C.textMuted:C.coral }}>₦{(fee-paid).toLocaleString()}</td>
                      <td style={{ padding:"10px 15px" }}><Badge color={s.fees==="Paid"?"green":"red"} size="sm">{s.fees}</Badge></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="expenses" && (
          <div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:9, marginBottom:13 }}>
              <Btn variant="secondary" size="sm">📥 Export</Btn>
              <Btn variant="primary"   size="sm">+ Add Expense</Btn>
            </div>
            <Card style={{ padding:0 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#F8FAFC" }}>{["Description","Category","Amount","Date","Recorded By","Status"].map(h=><th key={h} style={{ padding:"10px 15px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {EXPENSES.map(e => (
                    <tr key={e.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={ev=>ev.currentTarget.style.background="#F8FAFC"} onMouseLeave={ev=>ev.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"10px 15px", fontSize:13, fontWeight:600 }}>{e.desc}</td>
                      <td style={{ padding:"10px 15px" }}><Badge color="gray" size="sm">{e.cat}</Badge></td>
                      <td style={{ padding:"10px 15px", fontSize:13, fontWeight:700, color:C.coral }}>₦{e.amount.toLocaleString()}</td>
                      <td style={{ padding:"10px 15px", fontSize:12, color:C.textMuted }}>{e.date}</td>
                      <td style={{ padding:"10px 15px", fontSize:12, color:C.textMid }}>{e.by}</td>
                      <td style={{ padding:"10px 15px" }}><Badge color={e.status==="Paid"?"green":"amber"} size="sm">{e.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="payroll" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:13, flexWrap:"wrap", gap:10 }}>
              <Sel label="" value="May 2026" onChange={() => {}} options={["May 2026","April 2026","March 2026"].map(m=>({value:m,label:m}))} style={{ width:140 }}/>
              <div style={{ display:"flex", gap:9 }}>
                <Btn variant="secondary" size="sm">📥 Export Payslips</Btn>
                <Btn variant="primary"   size="sm">💳 Process Payroll</Btn>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14 }}>
              <StatCard label="Total Gross"      value="₦3.45M" color={C.sky}    icon="👥"/>
              <StatCard label="Total Deductions" value="₦345K"  color={C.amber}  icon="🔻"/>
              <StatCard label="Net Payable"       value="₦3.11M" color={C.accent} icon="💳"/>
            </div>
            <Card style={{ padding:0 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#F8FAFC" }}>{["Staff","Role","Basic","Housing","Transport","Deductions","Net Pay","Status"].map(h=><th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {PAYROLL.map(p => { const net=p.basic+p.housing+p.transport-p.ded; return (
                    <tr key={p.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"9px 12px", fontSize:12, fontWeight:600 }}>{p.name}</td>
                      <td style={{ padding:"9px 12px" }}><Badge color="blue" size="sm">{p.role}</Badge></td>
                      {[p.basic,p.housing,p.transport].map((v,i) => <td key={i} style={{ padding:"9px 12px", fontSize:12, fontFamily:"monospace" }}>₦{v.toLocaleString()}</td>)}
                      <td style={{ padding:"9px 12px", fontSize:12, fontFamily:"monospace", color:C.coral }}>-₦{p.ded.toLocaleString()}</td>
                      <td style={{ padding:"9px 12px", fontSize:13, fontWeight:700, color:C.accentDark }}>₦{net.toLocaleString()}</td>
                      <td style={{ padding:"9px 12px" }}><Badge color="green" size="sm">Paid</Badge></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="pl" && (
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700 }}>📊 Profit & Loss — 2nd Term 2025/2026</div>
              <div style={{ display:"flex", gap:9 }}><Btn variant="secondary" size="sm">📥 PDF</Btn><Btn variant="secondary" size="sm">📊 Excel</Btn></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.accentDark, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>INCOME</div>
                {[["Tuition Fees","₦18,400,000"],["Hostel Fees","₦2,400,000"],["Exam Fees","₦384,000"],["Misc Income","₦120,000"]].map(([l,v]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}><span>{l}</span><span style={{ fontWeight:600, color:C.accentDark }}>{v}</span></div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", fontSize:13, fontWeight:700 }}><span>Total Income</span><span style={{ color:C.accentDark }}>₦21,304,000</span></div>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.coral, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>EXPENSES</div>
                {[["Salaries & Payroll","₦3,200,000"],["Utilities","₦185,000"],["Maintenance","₦360,000"],["Food & Hostel","₦890,000"],["Events","₦220,000"],["Supplies","₦95,000"]].map(([l,v]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}><span>{l}</span><span style={{ fontWeight:600, color:C.coral }}>{v}</span></div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", fontSize:13, fontWeight:700 }}><span>Total Expenses</span><span style={{ color:C.coral }}>₦4,950,000</span></div>
              </div>
            </div>
            <div style={{ marginTop:14, padding:"13px 16px", borderRadius:10, background:`linear-gradient(90deg,${C.accentLight} 0%,#fff 100%)`, border:`1px solid ${C.accent}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, fontWeight:700 }}>NET SURPLUS (TERM)</span>
              <span style={{ fontSize:22, fontWeight:700, color:C.accentDark }}>₦16,354,000</span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOSTEL MODULE
// ═══════════════════════════════════════════════════════════════════════════════
const DORMS = [
  {id:"DA",name:"Block A (Boys)",  capacity:80,occupied:74,matron:"Mr. Abdullahi",rooms:20},
  {id:"DB",name:"Block B (Girls)", capacity:80,occupied:68,matron:"Mrs. Eze",     rooms:20},
  {id:"DC",name:"Block C (Boys)",  capacity:60,occupied:55,matron:"Mr. Ibrahim",  rooms:15},
  {id:"DD",name:"Block D (Girls)", capacity:60,occupied:52,matron:"Mrs. Okafor",  rooms:15},
];
const VISITORS = [
  {id:"V001",student:"Amara Okonkwo",visitor:"Mrs. Grace Okonkwo",relation:"Mother",  purpose:"Welfare visit", date:"2026-05-20",tin:"10:00",tout:"12:30"},
  {id:"V002",student:"Kofi Mensah",  visitor:"Mr. Kwame Mensah",  relation:"Father",  purpose:"Fees payment",  date:"2026-05-18",tin:"14:00",tout:"15:00"},
  {id:"V003",student:"Ibrahim Musa", visitor:"Dr. Musa Ibrahim",  relation:"Guardian",purpose:"Medical",       date:"2026-05-17",tin:"09:30",tout:"10:15"},
];
const HOSTEL_FEES = [
  {student:"Amara Okonkwo",block:"Block A",room:"A-12",termFee:120000,paid:120000,balance:0,  status:"Paid"},
  {student:"Kofi Mensah",  block:"Block B",room:"B-07",termFee:120000,paid:60000, balance:60000,status:"Part"},
  {student:"Chidinma Eze", block:"Block A",room:"A-03",termFee:120000,paid:120000,balance:0,  status:"Paid"},
];

const Hostel = () => {
  const [tab, setTab] = useState("overview");
  const totalOcc = DORMS.reduce((a,d)=>a+d.occupied,0);
  const totalCap = DORMS.reduce((a,d)=>a+d.capacity,0);
  return (
    <div className="fi">
      <Tabs tabs={[{id:"overview",label:"🏠 Overview"},{id:"rooms",label:"🛏 Rooms"},{id:"visitors",label:"👥 Visitors"},{id:"hfees",label:"💳 Hostel Fees"}]} active={tab} onChange={setTab}/>
      <div style={{ marginTop:16 }}>
        {tab==="overview" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:13, marginBottom:16 }}>
              <StatCard label="Total Capacity" value={totalCap}                              color={C.sky}    icon="🏠"/>
              <StatCard label="Occupied"       value={totalOcc}                              color={C.accent} icon="🛏"/>
              <StatCard label="Vacant Beds"    value={totalCap-totalOcc}                    color={C.amber}  icon="🔓"/>
              <StatCard label="Occupancy"      value={Math.round(totalOcc/totalCap*100)+"%"} color={C.purple} icon="📊"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:13 }}>
              {DORMS.map(d => {
                const pct = Math.round(d.occupied/d.capacity*100);
                return (
                  <Card key={d.id}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:11 }}>
                      <div><div style={{ fontSize:14, fontWeight:700 }}>{d.name}</div><div style={{ fontSize:11, color:C.textMuted }}>Managed by {d.matron}</div></div>
                      <Badge color={pct>90?"amber":"green"}>{pct}% Full</Badge>
                    </div>
                    <div style={{ display:"flex", gap:14, marginBottom:11 }}>
                      {[["Capacity",d.capacity],["Occupied",d.occupied],["Vacant",d.capacity-d.occupied],["Rooms",d.rooms]].map(([l,v]) => (
                        <div key={l} style={{ textAlign:"center" }}><div style={{ fontSize:17, fontWeight:700 }}>{v}</div><div style={{ fontSize:9, color:C.textMuted }}>{l}</div></div>
                      ))}
                    </div>
                    <div style={{ height:5, borderRadius:99, background:C.border }}><div style={{ height:5, borderRadius:99, background:pct>90?C.amber:C.accent, width:pct+"%" }}/></div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        {tab==="rooms" && (
          <div>
            <div style={{ display:"flex", gap:9, marginBottom:13 }}>
              <Sel label="" value="DA" onChange={()=>{}} options={DORMS.map(d=>({value:d.id,label:d.name}))} style={{ width:180 }}/>
              <Btn variant="secondary" size="sm">+ Assign Student</Btn>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
              {Array.from({length:8},(_,i) => {
                const roomStudents = STUDENTS.filter((_2,si) => si%8===i);
                return (
                  <Card key={i} style={{ padding:"13px 14px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                      <span style={{ fontSize:12, fontWeight:700 }}>Room A-{String(i+1).padStart(2,"0")}</span>
                      <Badge color={roomStudents.length>=4?"amber":roomStudents.length>0?"green":"gray"} size="sm">{roomStudents.length}/4</Badge>
                    </div>
                    {roomStudents.map(s => (
                      <div key={s.id} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                        <Avatar initials={s.avatar} size={20} color={C.accent}/>
                        <span style={{ fontSize:11, fontWeight:500 }}>{s.name.split(" ")[0]}</span>
                      </div>
                    ))}
                    {roomStudents.length<4 && <div style={{ fontSize:10, color:C.textMuted, fontStyle:"italic" }}>{4-roomStudents.length} bed(s) vacant</div>}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        {tab==="visitors" && (
          <div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:13 }}>
              <Btn variant="primary" size="sm">+ Log Visitor</Btn>
            </div>
            <Card style={{ padding:0 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#F8FAFC" }}>{["Student","Visitor","Relation","Purpose","Date","Time In","Time Out"].map(h=><th key={h} style={{ padding:"10px 13px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {VISITORS.map(v => (
                    <tr key={v.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"10px 13px", fontSize:12, fontWeight:600 }}>{v.student}</td>
                      <td style={{ padding:"10px 13px", fontSize:12 }}>{v.visitor}</td>
                      <td style={{ padding:"10px 13px" }}><Badge color="blue" size="sm">{v.relation}</Badge></td>
                      <td style={{ padding:"10px 13px", fontSize:12, color:C.textMid }}>{v.purpose}</td>
                      <td style={{ padding:"10px 13px", fontSize:11, color:C.textMuted }}>{v.date}</td>
                      <td style={{ padding:"10px 13px", fontSize:12 }}>{v.tin}</td>
                      <td style={{ padding:"10px 13px", fontSize:12, color:C.textMuted }}>{v.tout}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
        {tab==="hfees" && (
          <div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:9, marginBottom:13 }}>
              <Btn variant="secondary" size="sm">+ Record Payment</Btn>
              <Btn variant="primary"   size="sm">Generate Invoices</Btn>
            </div>
            <Card style={{ padding:0 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#F8FAFC" }}>{["Student","Block","Room","Term Fee","Paid","Balance","Status"].map(h=><th key={h} style={{ padding:"10px 13px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {HOSTEL_FEES.map((f,i) => (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"10px 13px", fontSize:12, fontWeight:600 }}>{f.student}</td>
                      <td style={{ padding:"10px 13px", fontSize:12 }}>{f.block}</td>
                      <td style={{ padding:"10px 13px", fontSize:12 }}>{f.room}</td>
                      <td style={{ padding:"10px 13px", fontSize:12, fontFamily:"monospace" }}>₦{f.termFee.toLocaleString()}</td>
                      <td style={{ padding:"10px 13px", fontSize:12, fontFamily:"monospace", color:C.accentDark }}>₦{f.paid.toLocaleString()}</td>
                      <td style={{ padding:"10px 13px", fontSize:12, fontFamily:"monospace", color:f.balance>0?C.coral:C.textMuted }}>₦{f.balance.toLocaleString()}</td>
                      <td style={{ padding:"10px 13px" }}><Badge color={f.status==="Paid"?"green":f.status==="Part"?"amber":"red"} size="sm">{f.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════
const INV_ITEMS = [
  {id:"I001",name:"Exercise Books (A4)", cat:"stationery",unit:"Ream",qty:340,min:100,cost:1200, loc:"Store Room A",  status:"ok"},
  {id:"I002",name:"Biro Pens (Blue)",    cat:"stationery",unit:"Box", qty:28, min:30, cost:800,  loc:"Store Room A",  status:"low"},
  {id:"I003",name:"Manila Cardboard",    cat:"stationery",unit:"Pack",qty:6,  min:15, cost:2500, loc:"Store Room A",  status:"critical"},
  {id:"I015",name:"Mattress (Single)",   cat:"hostel",    unit:"Pcs", qty:180,min:20, cost:22000,loc:"Hostel Store",  status:"ok"},
  {id:"I016",name:"Bedsheet (White)",    cat:"hostel",    unit:"Pcs", qty:95, min:50, cost:3800, loc:"Hostel Store",  status:"ok"},
  {id:"I017",name:"Pillow",              cat:"hostel",    unit:"Pcs", qty:42, min:40, cost:2800, loc:"Hostel Store",  status:"low"},
  {id:"I018",name:"Mosquito Net",        cat:"hostel",    unit:"Pcs", qty:8,  min:30, cost:1500, loc:"Hostel Store",  status:"critical"},
  {id:"I023",name:"Rice (50kg bag)",     cat:"kitchen",   unit:"Bag", qty:38, min:20, cost:75000,loc:"Kitchen Store", status:"ok"},
  {id:"I024",name:"Cooking Gas (12kg)",  cat:"kitchen",   unit:"Cyl",qty:5,   min:6,  cost:18000,loc:"Kitchen",       status:"low"},
  {id:"I027",name:"Paracetamol (500mg)", cat:"medical",   unit:"Pack",qty:45, min:20, cost:850,  loc:"Sick Bay",      status:"ok"},
  {id:"I029",name:"Disposable Gloves",   cat:"medical",   unit:"Box", qty:3,  min:10, cost:3500, loc:"Sick Bay",      status:"critical"},
  {id:"I031",name:"Electrical Bulb 20W", cat:"maintenance",unit:"Box",qty:6,  min:10, cost:8500, loc:"Maintenance",   status:"low"},
];
const INV_CATS = [{id:"all",label:"All",icon:"📦"},{id:"stationery",label:"Stationery",icon:"✏️"},{id:"hostel",label:"Hostel",icon:"🏠"},{id:"kitchen",label:"Kitchen",icon:"🍳"},{id:"medical",label:"Medical",icon:"💊"},{id:"maintenance",label:"Maintenance",icon:"🔧"}];

const Inventory = () => {
  const [items,     setItems]     = useState(INV_ITEMS);
  const [cat,       setCat]       = useState("all");
  const [search,    setSearch]    = useState("");
  const [modal,     setModal]     = useState(null);
  const [toast,     setToast]     = useState(null);

  const showToast = m => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const filtered  = items.filter(i => (cat==="all"||i.cat===cat) && i.name.toLowerCase().includes(search.toLowerCase()));
  const statColor = s => s==="ok"?"green":s==="low"?"amber":"red";
  const statLabel = s => s==="ok"?"In Stock":s==="low"?"Low Stock":"Critical";

  const SBar = ({ qty, min }) => {
    const pct = Math.min(100, Math.round(qty/Math.max(qty,min*2)*100));
    const col  = qty<=min*.5?C.coral:qty<=min?C.amber:C.accent;
    return <div style={{ height:4, borderRadius:99, background:C.border, overflow:"hidden" }}><div style={{ height:4, borderRadius:99, background:col, width:pct+"%" }}/></div>;
  };

  const issueItem = (item,qty,to) => { setItems(p=>p.map(i=>i.id===item.id?{...i,qty:Math.max(0,i.qty-qty),status:(i.qty-qty)<=i.min*.5?"critical":(i.qty-qty)<=i.min?"low":"ok"}:i)); showToast(`✅ Issued ${qty} ${item.unit} of "${item.name}" to ${to}`); setModal(null); };
  const restock   = (item,qty)   => { setItems(p=>p.map(i=>i.id===item.id?{...i,qty:i.qty+qty,status:(i.qty+qty)<=i.min*.5?"critical":(i.qty+qty)<=i.min?"low":"ok"}:i)); showToast(`📦 Restocked ${qty} ${item.unit} of "${item.name}"`); setModal(null); };

  const IssueForm = ({ item }) => {
    const [qty,setQty]=useState("1"); const [to,setTo]=useState("");
    return (<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Card style={{background:"#F8FAFC",padding:"11px 13px"}}><div style={{fontSize:11,color:C.textMuted}}>Issuing</div><div style={{fontSize:14,fontWeight:700}}>{item.name}</div><div style={{fontSize:11,color:C.textMid,marginTop:3}}>Available: <strong style={{color:item.qty<=item.min?C.coral:C.accentDark}}>{item.qty} {item.unit}</strong></div></Card>
      <Input label="Quantity" value={qty} onChange={setQty} type="number"/>
      <Input label="Issued To" value={to} onChange={setTo} placeholder="Class, dept, student name…"/>
      <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn variant="primary" onClick={()=>issueItem(item,parseInt(qty)||1,to)} disabled={!to||!qty}>✅ Confirm</Btn></div>
    </div>);
  };
  const RestockForm = ({ item }) => {
    const [qty,setQty]=useState("0");
    return (<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Card style={{background:"#F8FAFC",padding:"11px 13px"}}><div style={{fontSize:11,color:C.textMuted}}>Restocking</div><div style={{fontSize:14,fontWeight:700}}>{item.name}</div><div style={{fontSize:11,color:C.textMid,marginTop:3}}>Current: <strong>{item.qty}</strong> · Min: <strong>{item.min}</strong></div></Card>
      <Input label="Quantity Received" value={qty} onChange={setQty} type="number"/>
      <div style={{padding:"9px 12px",borderRadius:9,background:C.accentLight,fontSize:12,color:C.accentDark}}>New total: <strong>{item.qty+(parseInt(qty)||0)} {item.unit}</strong></div>
      <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn variant="primary" onClick={()=>restock(item,parseInt(qty)||0)} disabled={!qty||parseInt(qty)<=0}>📦 Confirm</Btn></div>
    </div>);
  };

  return (
    <div className="fi">
      {toast && <div style={{ position:"fixed", bottom:26, right:26, zIndex:2000, background:C.navy, color:"#fff", padding:"11px 18px", borderRadius:11, fontSize:12, fontWeight:600, boxShadow:"0 8px 28px rgba(0,0,0,.2)", borderLeft:`4px solid ${C.accent}` }}>{toast}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
        <StatCard label="Total Items"    value={items.length}                                                           color={C.sky}   icon="📦"/>
        <StatCard label="Stock Value"    value={"₦"+(items.reduce((a,i)=>a+(i.qty*i.cost),0)/1000).toFixed(0)+"K"}    color={C.accent} icon="💰"/>
        <StatCard label="Critical Items" value={items.filter(i=>i.status==="critical").length}                          color={C.coral} icon="🚨"/>
        <StatCard label="Low Stock"      value={items.filter(i=>i.status==="low").length}                               color={C.amber} icon="⚠️"/>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:13, flexWrap:"wrap", alignItems:"center" }}>
        <Input value={search} onChange={setSearch} placeholder="🔍 Search inventory…" style={{ width:210 }}/>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {INV_CATS.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)}
              style={{ padding:"4px 11px", borderRadius:99, border:`1.5px solid ${cat===c.id?C.accent:C.border}`, background:cat===c.id?C.accentLight:"transparent", fontSize:11, fontWeight:cat===c.id?700:500, cursor:"pointer", color:cat===c.id?C.accentDark:C.textMid, transition:"all .15s" }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <Btn variant="secondary" size="sm">📥 Import</Btn>
          <Btn variant="primary"   size="sm">+ Add Item</Btn>
        </div>
      </div>
      <Card style={{ padding:0, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:680 }}>
          <thead><tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>{["Item","Category","Location","Stock Level","Min Qty","Unit Cost","Status","Actions"].map(h=><th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".4px", whiteSpace:"nowrap" }}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0 && <tr><td colSpan={8} style={{ padding:"36px", textAlign:"center", color:C.textMuted, fontSize:13 }}>No items match your filter.</td></tr>}
            {filtered.map(item => {
              const catObj = INV_CATS.find(c => c.id===item.cat);
              return (
                <tr key={item.id} style={{ borderBottom:`1px solid ${C.border}`, transition:"background .1s" }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"9px 12px" }}><div style={{ fontSize:12, fontWeight:700 }}>{item.name}</div><div style={{ fontSize:9, color:C.textMuted, fontFamily:"monospace" }}>{item.id}</div></td>
                  <td style={{ padding:"9px 12px", fontSize:12 }}>{catObj?.icon} {catObj?.label}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.textMid }}>{item.loc}</td>
                  <td style={{ padding:"9px 12px", minWidth:100 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:item.status==="critical"?C.coral:item.status==="low"?C.amber:C.accentDark }}>{item.qty} <span style={{ fontSize:10, color:C.textMuted, fontWeight:400 }}>{item.unit}</span></div>
                    <div style={{ marginTop:3, width:76 }}><SBar qty={item.qty} min={item.min}/></div>
                  </td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.textMid }}>{item.min}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, fontFamily:"monospace", whiteSpace:"nowrap" }}>₦{item.cost.toLocaleString()}</td>
                  <td style={{ padding:"9px 12px" }}><Badge color={statColor(item.status)} size="sm">{statLabel(item.status)}</Badge></td>
                  <td style={{ padding:"9px 12px" }}>
                    <div style={{ display:"flex", gap:5 }}>
                      <Btn size="sm" variant="secondary" onClick={() => setModal({type:"issue",  item})}>Issue</Btn>
                      <Btn size="sm" variant="primary"   onClick={() => setModal({type:"restock",item})}>+Stock</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding:"8px 13px", borderTop:`1px solid ${C.border}`, fontSize:11, color:C.textMuted }}>Showing {filtered.length} of {items.length} items · Value: ₦{filtered.reduce((a,i)=>a+(i.qty*i.cost),0).toLocaleString()}</div>
      </Card>
      {modal?.type==="issue"   && <Modal title="Issue Item"   onClose={() => setModal(null)}><IssueForm   item={modal.item}/></Modal>}
      {modal?.type==="restock" && <Modal title="Restock Item" onClose={() => setModal(null)}><RestockForm item={modal.item}/></Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// REMAINING MODULES  — Messaging, Library, Staff, Settings
// ═══════════════════════════════════════════════════════════════════════════════
const Messaging = () => {
  const [msg, setMsg] = useState("");
  const msgs = [
    {from:"Mrs. Adeyemi",text:"Remind students about the Math test tomorrow.",   time:"10:32 AM",me:false},
    {from:"You",         text:"Will do. Already posted on the notice board.",     time:"10:35 AM",me:true},
    {from:"Mr. Osei",    text:"Can someone share the JSS 3 timetable changes?",  time:"11:02 AM",me:false},
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", height:"calc(100vh - 140px)", border:`1px solid ${C.border}`, borderRadius:13, overflow:"hidden" }}>
      <div style={{ background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}`, fontWeight:700, fontSize:12 }}>Conversations</div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {["Staff Chat","JSS 3 Parents","Announcements",...STAFF.map(s=>s.name)].map((c,i) => (
            <div key={c} style={{ padding:"10px 13px", cursor:"pointer", borderBottom:`1px solid ${C.border}`, background:i===0?C.accentLight:"transparent" }}
              onMouseEnter={e=>{if(i!==0)e.currentTarget.style.background="#F8FAFC";}} onMouseLeave={e=>{if(i!==0)e.currentTarget.style.background="transparent";}}>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:12, fontWeight:i<3?700:500 }}>{c}</span><span style={{ fontSize:9, color:C.textMuted }}>11:02</span></div>
              <div style={{ fontSize:10, color:C.textMuted, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Last message preview…</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", background:"#F8FAFC" }}>
        <div style={{ padding:"12px 18px", background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:700, fontSize:13 }}>Staff Chat</div>
          <Btn size="sm" variant="secondary">📢 Announce</Btn>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"13px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {msgs.map((m,i) => (
            <div key={i} style={{ display:"flex", justifyContent:m.me?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"66%" }}>
                {!m.me && <div style={{ fontSize:10, fontWeight:600, color:C.accent, marginBottom:2 }}>{m.from}</div>}
                <div style={{ padding:"9px 13px", borderRadius:m.me?"13px 13px 4px 13px":"13px 13px 13px 4px", background:m.me?C.navy:C.surface, color:m.me?"#fff":C.text, fontSize:12, border:m.me?"none":`1px solid ${C.border}` }}>{m.text}</div>
                <div style={{ fontSize:9, color:C.textMuted, marginTop:2, textAlign:m.me?"right":"left" }}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"11px 16px", background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", gap:9 }}>
          <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Type a message…"
            style={{ flex:1, padding:"8px 12px", borderRadius:9, border:`1px solid ${C.border}`, fontSize:13, outline:"none", fontFamily:"Sora,sans-serif" }}
            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
          <Btn variant="primary" onClick={() => setMsg("")}>Send →</Btn>
        </div>
      </div>
    </div>
  );
};

const Library = () => (
  <div className="fi">
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <Input value="" onChange={() => {}} placeholder="🔍 Search by title, author, ISBN…" style={{ width:270 }}/>
      <div style={{ display:"flex", gap:9 }}><Btn variant="secondary">+ Add Book</Btn><Btn variant="primary">📋 Issue Book</Btn></div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
      {[["New Gen Mathematics","Macrae","Mathematics",12,3],["Comprehensive English","Bankole","Languages",8,0],["Biology for Schools","Mackean","Sciences",15,5],["Further Mathematics","Ilori","Mathematics",6,6],["Chemistry in Use","Austin","Sciences",10,2],["History of W. Africa","Ajayi","Humanities",7,1],["Physics Essentials","Nelkon","Sciences",9,4],["Computer Studies","Obasi","ICT",5,0]].map(([title,author,cat,total,out]) => (
        <Card key={title} style={{ padding:"14px 15px" }}>
          <div style={{ width:"100%", height:56, borderRadius:8, background:C.sky+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, marginBottom:10 }}>📗</div>
          <div style={{ fontSize:12, fontWeight:700, lineHeight:1.3 }}>{title}</div>
          <div style={{ fontSize:10, color:C.textMuted, marginTop:3 }}>{author}</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
            <Badge color="gray" size="sm">{cat}</Badge>
            <span style={{ fontSize:10, color:C.textMuted }}>{total-out}/{total}</span>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

const Staff = () => (
  <div className="fi">
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <Input value="" onChange={() => {}} placeholder="🔍 Search staff…" style={{ width:240 }}/>
      <Btn variant="primary">+ Add Staff</Btn>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
      {STAFF.map((s,i) => (
        <Card key={s.id} style={{ display:"flex", gap:12, alignItems:"center" }}>
          <Avatar initials={s.name.split(" ").map(w=>w[0]).slice(0,2).join("")} size={44} color={[C.sky,C.purple,C.accent,C.amber][i%4]}/>
          <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:700 }}>{s.name}</div><div style={{ fontSize:11, color:C.textMuted }}>{s.subject} · {s.dept}</div></div>
          <Badge color={s.status==="Active"?"green":"amber"}>{s.status}</Badge>
        </Card>
      ))}
    </div>
  </div>
);

const Settings = () => {
  const [school, setSchool] = useState("Greenfield Academy");
  const [saved,  setSaved]  = useState(false);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:16 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
        {[["🏫","School"],["👤","Profile"],["🔔","Notifications"],["🔒","Security"],["💳","Billing"]].map(([ic,l],i) => (
          <button key={l} style={{ padding:"9px 12px", borderRadius:8, border:"none", background:i===0?C.accentLight:"transparent", color:i===0?C.accentDark:C.textMid, textAlign:"left", fontSize:12, fontWeight:i===0?600:400, cursor:"pointer", display:"flex", alignItems:"center", gap:7 }}><span>{ic}</span>{l}</button>
        ))}
      </div>
      <Card>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:16 }}>School Information</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:13 }}>
          <Input label="School Name"    value={school}                      onChange={setSchool}/>
          <Input label="School Code"    value="GFA-001"                     onChange={() => {}}/>
          <Input label="Address"        value="12 Education Lane, Lagos"    onChange={() => {}}/>
          <Input label="Phone"          value="+234 800 123 4567"           onChange={() => {}}/>
          <Input label="Email"          value="admin@greenfield.edu.ng"     onChange={() => {}}/>
          <Sel   label="Academic System" value="term"                       onChange={() => {}} options={[{value:"term",label:"3-Term System"},{value:"semester",label:"2-Semester System"}]}/>
        </div>
        <div style={{ marginTop:16, display:"flex", gap:10, alignItems:"center" }}>
          <Btn onClick={() => { setSaved(true); setTimeout(()=>setSaved(false),2500); }} variant="primary">💾 Save Changes</Btn>
          {saved && <span style={{ fontSize:12, color:C.accentDark, fontWeight:600 }}>✅ Saved!</span>}
        </div>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [page,      setPage]      = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const PAGES = {
    dashboard:   <Dashboard  onNav={setPage}/>,
    students:    <Students/>,
    staff:       <Staff/>,
    attendance:  <Attendance/>,
    grades:      <Grades/>,
    timetable:   <Timetable/>,
    cbt:         <CBTExams   onNav={setPage}/>,
    "cbt-create":<CBTCreate  onNav={setPage}/>,
    "cbt-take":  <CBTTake    onNav={setPage}/>,
    "ai-tools":  <AITools/>,
    fees:        <Fees/>,
    messaging:   <Messaging/>,
    hostel:      <Hostel/>,
    inventory:   <Inventory/>,
    library:     <Library/>,
    settings:    <Settings/>,
  };

  return (
    <>
      <style>{G}</style>
      <div style={{ display:"flex", minHeight:"100vh" }}>
        <Sidebar active={page} onNav={setPage} collapsed={collapsed} setCollapsed={setCollapsed}/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
          <Topbar page={page} onNav={setPage}/>
          <main style={{ flex:1, padding:22, overflowY:"auto" }}>
            {PAGES[page] || <Dashboard onNav={setPage}/>}
          </main>
        </div>
      </div>
    </>
  );
}
