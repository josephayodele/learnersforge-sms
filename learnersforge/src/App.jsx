import { useState, useEffect, useCallback, useMemo } from "react";
import CCTVModule from "./CCTVModule";
import { getStudents, getDashboard, getReportCard, getCumulative, getTerms, getClasses, createClass, getSubjects,
         getCaTypes, getGrades, submitGrades, getBehaviour, saveBehaviour, getComments, saveComments,
         createExam, createStudent, importStudents, deleteStudent, bulkDeleteStudents, getSchoolSettings, updateSchoolSettings,
         getRemarkRanges, createRemarkRange, updateRemarkRange, deleteRemarkRange, getMe,
         getStaff, createStaff, getStaffAssignments, saveStaffAssignments, deleteStaff,
         getAttendance, submitAttendance, getTermAttendance, saveTermAttendance, aiChat,
         getExams, addExamQuestions, login as apiLogin } from "./api/client";

// Map a backend student row (first_name/last_name/class_name/student_id …)
// onto the field names the UI components render (name/avatar/class/fees/gpa).
const normStudent = (s = {}) => {
  const name = s.name || [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
  const initials = ((s.first_name?.[0] || name?.[0] || "") + (s.last_name?.[0] || "")).toUpperCase();
  return {
    ...s,
    name,
    avatar: s.avatar || initials,
    class: s.class || s.class_name || "—",
    fees: s.fees || s.fee_status || "—",
    gpa: s.gpa ?? s.cgpa ?? "—",
  };
};

// Currency / number formatters for dashboard stats.
const fmtNaira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });
const fmtNum   = (n) => Number(n || 0).toLocaleString("en-NG");

// Print the current sheet with a blank document title, so the browser's
// header/footer doesn't stamp the app name across the top of the PDF.
const printSheet = () => {
  const prev = document.title;
  document.title = " "; // non-breaking space → blank centre header
  const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
};

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
const Card = ({children,style={},onClick,className,id}) => (
  <div onClick={onClick} className={className} id={id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px",cursor:onClick?"pointer":"default",transition:"box-shadow .15s,transform .15s",...style}}
    onMouseEnter={e=>{if(onClick){e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.08)";e.currentTarget.style.transform="translateY(-1px)";}}}
    onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateY(0)"}}
  >{children}</div>
);
const Btn = ({children,onClick,variant="primary",size="md",style={},disabled,type="button"}) => {
  const base={display:"inline-flex",alignItems:"center",gap:6,border:"none",borderRadius:8,fontWeight:600,cursor:disabled?"not-allowed":"pointer",transition:"all .15s",opacity:disabled?.5:1,fontSize:size==="sm"?12:size==="lg"?15:13,padding:size==="sm"?"5px 12px":size==="lg"?"11px 22px":"8px 16px"};
  const vs={primary:{background:C.accent,color:"#fff"},secondary:{background:C.surface,color:C.text,border:`1px solid ${C.border}`},danger:{background:C.coral,color:"#fff"},ghost:{background:"transparent",color:C.textMid},navy:{background:C.navy,color:"#fff"},amber:{background:C.amber,color:"#fff"},teal:{background:C.teal,color:"#fff"}};
  return <button type={type} disabled={disabled} onClick={onClick} style={{...base,...(vs[variant]||vs.primary),...style}} onMouseEnter={e=>{if(!disabled)e.currentTarget.style.filter="brightness(1.08)"}} onMouseLeave={e=>{e.currentTarget.style.filter="none"}}>{children}</button>;
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


const BRANCHES=[{id:"B001",name:"Greenfield Academy – Lekki",students:1284,staff:68,active:true},{id:"B002",name:"Greenfield Academy – Surulere",students:890,staff:52,active:true},{id:"B003",name:"Greenfield Academy – Abuja",students:640,staff:41,active:false}];

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
  {id:"admissions",   label:"Admissions",        icon:"📋",group:"enroll"},
  {id:"academic-mgmt",label:"Academic Mgmt",     icon:"📚",group:"enroll"},
  {id:"student-extras",label:"Student Records",  icon:"📂",group:"enroll"},
  {id:"transport",    label:"Transport",          icon:"🚌",group:"ops"},
  {id:"certificates", label:"Certificates & IDs", icon:"🪪",group:"ops"},
  {id:"multi-branch", label:"Multi-Branch",       icon:"🏫",group:"ops"},
  {id:"cms",          label:"Website & CMS",      icon:"🌐",group:"ops"},
  {id:"hr",           label:"HR Module",          icon:"👥",group:"ops"},
  {id:"cctv",         label:"CCTV Security",      icon:"📹",group:"ops"},
  {id:"online-learning",label:"Online Learning",  icon:"🎓",group:"learning"},
  {id:"communications",label:"Communications",    icon:"📱",group:"learning"},
  {id:"analytics",    label:"Analytics",          icon:"📈",group:"learning"},
];
const GROUPS={main:"Main",academic:"Academics",exams:"Examinations",ai:"AI Tools",admin:"Administration",enroll:"Enrollment",ops:"Operations",learning:"Learning"};

const Sidebar = ({active,onNav,collapsed,setCollapsed,school}) => {
  const groups=[...new Set(NAV.map(n=>n.group))];
  return (
    <aside className="no-print" style={{width:collapsed?64:C.sidebarW,minHeight:"100vh",background:C.navy,display:"flex",flexDirection:"column",transition:"width .25s",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto",overflowX:"hidden"}}>
      <div style={{padding:"18px 14px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${C.navyLight}`}}>
        <div style={{width:32,height:32,borderRadius:9,background:school?.logo_url?"#fff":C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,overflow:"hidden"}}>
          {school?.logo_url ? <img src={school.logo_url} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/> : "⚡"}
        </div>
        {!collapsed&&<span style={{color:"#fff",fontWeight:700,fontSize:15,letterSpacing:"-.3px"}}>{school?.name || "LearnersForge"}</span>}
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
const TITLES={dashboard:"Dashboard",students:"Student Management",staff:"Staff Management",attendance:"Attendance",grades:"Grades & Report Cards",timetable:"Timetable",cbt:"CBT Exams","cbt-create":"Create Exam","cbt-take":"Take Exam","ai-tools":"AI Teaching Tools",fees:"Fees & Finance",messaging:"Messaging",hostel:"Hostel Management",inventory:"Inventory",library:"Library Management",settings:"Settings","admissions":"Admissions & Enrollment","academic-mgmt":"Academic Management","student-extras":"Student Records","transport":"Transport Management","certificates":"Certificates & ID Cards","multi-branch":"Multi-Branch Management","cms":"Website & CMS","hr":"HR Module","online-learning":"Online Learning","communications":"Communications","analytics":"Reports & Analytics"};
const Topbar = ({page,onNav,onLogout,school}) => (
  <header className="no-print" style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
    <div>
      <h1 style={{fontSize:16,fontWeight:700,color:C.text,margin:0}}>{TITLES[page]||page}</h1>
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
          <div style={{fontSize:10,color:C.textMuted}}>{school?.name || "—"}</div>
        </div>
      </div>
      <button onClick={onLogout} title="Log out" style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 11px",fontSize:12,color:C.textMid,cursor:"pointer",fontFamily:"Sora,sans-serif"}} onMouseEnter={e=>{e.currentTarget.style.background=C.coralLight;e.currentTarget.style.color=C.coral;e.currentTarget.style.borderColor=C.coral+"55";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.textMid;e.currentTarget.style.borderColor=C.border;}}>↪ Logout</button>
    </div>
  </header>
);

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = ({onNav}) => {
  const [students,setStudents]=useState([]);
  const [studentsLoading,setStudentsLoading]=useState(true);
  const [stats,setStats]=useState(null);

  useEffect(()=>{
    let cancelled=false;
    getDashboard()
      .then(res=>{ if(!cancelled) setStats(res?.data ?? res ?? null); })
      .catch(()=>{ if(!cancelled) setStats(null); });
    return ()=>{ cancelled=true; };
  },[]);

  useEffect(()=>{
    let cancelled=false;
    setStudentsLoading(true);
    getStudents()
      .then(res=>{
        if(cancelled) return;
        const list = Array.isArray(res) ? res
                   : Array.isArray(res?.data?.students) ? res.data.students
                   : Array.isArray(res?.data) ? res.data
                   : Array.isArray(res?.students) ? res.students
                   : [];
        setStudents(list.map(normStudent));
      })
      .catch(()=>{ if(!cancelled) setStudents([]); })
      .finally(()=>{ if(!cancelled) setStudentsLoading(false); });
    return ()=>{ cancelled=true; };
  },[]);

  return (
  <div className="fi">
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:18}}>
      <StatCard label="Total Students" value={stats ? fmtNum(stats.total_students) : "—"} sub="Enrolled"          color={C.accent} icon="👨‍🎓"/>
      <StatCard label="Teaching Staff" value={stats ? fmtNum(stats.total_staff) : "—"}    sub="Active"            color={C.sky}    icon="👩‍🏫"/>
      <StatCard label="Present Today"  value={stats ? fmtNum(stats.today_present) : "—"}   sub="Marked present"    color={C.amber}  icon="✅"/>
      <StatCard label="Fees Collected" value={stats ? fmtNaira(stats.fees_collected) : "—"} sub={stats ? `${fmtNaira(stats.fees_outstanding)} outstanding` : ""} color={C.purple} icon="💳"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:14}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700}}>Weekly Attendance</div><Badge color="green">This Week</Badge>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:88}}>
          {(stats?.attendance_week?.length ? stats.attendance_week : [{day:"M",rate:0},{day:"T",rate:0},{day:"W",rate:0},{day:"T",rate:0},{day:"F",rate:0}]).map((d,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:10,fontWeight:600,color:C.textMid}}>{d.rate}%</div>
              <div style={{width:"100%",background:C.accent,borderRadius:"4px 4px 0 0",height:Math.max(2,d.rate*.72)}}/>
              <div style={{fontSize:9,color:C.textMuted}}>{d.day}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Active Exams</div>
        {!stats?.active_exams?.length ? (
          <div style={{padding:"18px 0",textAlign:"center",fontSize:11,color:C.textMuted}}>No active exams.</div>
        ) : stats.active_exams.map(e=>{
          const label=(e.status||"").charAt(0).toUpperCase()+(e.status||"").slice(1);
          return (
          <div key={e.id} onClick={()=>onNav("cbt")} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
            <div style={{fontSize:12,fontWeight:600}}>{e.title}</div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
              <span style={{fontSize:10,color:C.textMuted}}>{e.exam_type||"Exam"}</span>
              <Badge color={e.status==="active"?"green":e.status==="draft"?"amber":"gray"} size="sm">{label}</Badge>
            </div>
          </div>
          );
        })}
        <Btn onClick={()=>onNav("cbt")} variant="ghost" size="sm" style={{marginTop:8,color:C.accent}}>View all →</Btn>
      </Card>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Recent Students</div>
        {studentsLoading ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 0",gap:10}}>
            <div style={{width:20,height:20,borderRadius:"50%",border:`2.5px solid ${C.border}`,borderTopColor:C.accent,animation:"spin .8s linear infinite"}}/>
            <span style={{fontSize:11,color:C.textMuted}}>Loading students…</span>
          </div>
        ) : students.length === 0 ? (
          <div style={{padding:"18px 0",textAlign:"center",fontSize:11,color:C.textMuted}}>No students yet.</div>
        ) : students.slice(0,4).map(s=>(
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
            <button key={lb} onClick={()=>onNav(pg)} style={{padding:"10px",borderRadius:9,border:`1px solid ${C.border}`,background:C.surface,color:C.text,cursor:"pointer",display:"flex",alignItems:"center",gap:7,fontSize:12,fontWeight:500,transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.background=C.accentLight;e.currentTarget.style.borderColor=C.accent;}} onMouseLeave={e=>{e.currentTarget.style.background=C.surface;e.currentTarget.style.borderColor=C.border;}}>
              <span style={{fontSize:16}}>{ic}</span>{lb}
            </button>
          ))}
        </div>
      </Card>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
      <Card>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Recent Alerts</div>
        {!stats?.recent_alerts?.length ? (
          <div style={{padding:"18px 0",textAlign:"center",fontSize:11,color:C.textMuted}}>No alerts.</div>
        ) : stats.recent_alerts.map(a=>(
          <div key={a.id} style={{display:"flex",alignItems:"flex-start",gap:9,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:15}}>🔔</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600}}>{a.title||a.type||"Notification"}</div>
              {a.message && <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{a.message}</div>}
            </div>
          </div>
        ))}
      </Card>
      <Card>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Low Inventory</div>
        {!stats?.low_inventory?.length ? (
          <div style={{padding:"18px 0",textAlign:"center",fontSize:11,color:C.textMuted}}>All items in stock.</div>
        ) : stats.low_inventory.map(it=>(
          <div key={it.id} onClick={()=>onNav("inventory")} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
            <span style={{fontSize:15}}>📦</span>
            <div style={{flex:1,fontSize:12,fontWeight:600}}>{it.name}</div>
            <Badge color={it.qty<=0?"red":"amber"} size="sm">{fmtNum(it.qty)}{it.unit?` ${it.unit}`:""} left</Badge>
          </div>
        ))}
      </Card>
    </div>
  </div>
  );
};

// ── Add Student modal ───────────────────────────────────────────────────────
const AddStudentModal = ({ onClose, onCreated }) => {
  const empty = { first_name:"", last_name:"", email:"", phone:"", gender:"",
                  date_of_birth:"", class_id:"", guardian_name:"", guardian_phone:"",
                  guardian_email:"", guardian_address:"", admission_number:"",
                  student_id:"", medical_notes:"", previous_school:"" };
  const [form,setForm]=useState(empty);
  const [classes,setClasses]=useState([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);
  const set=(k)=>(v)=>setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    let cancelled=false;
    getClasses()
      .then(res=>{
        if(cancelled) return;
        const list = Array.isArray(res) ? res
                   : Array.isArray(res?.data) ? res.data
                   : Array.isArray(res?.classes) ? res.classes
                   : [];
        setClasses(list);
        // default to first class so class_id is never empty on submit
        if(list.length && !form.class_id) setForm(p=>({...p,class_id:String(list[0].id)}));
      })
      .catch(()=>{ if(!cancelled) setClasses([]); });
    return ()=>{ cancelled=true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const submit=async()=>{
    if(!form.first_name.trim()||!form.last_name.trim()){ setError("First and last name are required."); return; }
    if(!form.email.trim()){ setError("Email is required."); return; }
    if(!form.class_id){ setError("Please select a class."); return; }
    setSaving(true); setError(null);
    try{
      await createStudent({ ...form, class_id:Number(form.class_id) });
      onCreated();
    }catch(err){
      setError(err?.message || err?.data?.error || "Failed to create student.");
      setSaving(false);
    }
  };

  const classOpts = [
    { value:"", label:"Select class…" },
    ...classes.map(c=>({ value:String(c.id), label:c.name })),
  ];

  return (
    <Modal title="Add Student" onClose={saving?()=>{}:onClose} width={620}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Input label="First Name"  value={form.first_name}    onChange={set("first_name")}    placeholder="e.g. Chidi"/>
        <Input label="Last Name"   value={form.last_name}     onChange={set("last_name")}     placeholder="e.g. Okonkwo"/>
        <Input label="Email"       value={form.email}         onChange={set("email")}         placeholder="student@example.com" type="email"/>
        <Input label="Phone"       value={form.phone}         onChange={set("phone")}         placeholder="+234 …"/>
        <Sel   label="Gender"      value={form.gender}        onChange={set("gender")}        options={[{value:"",label:"Select…"},{value:"male",label:"Male"},{value:"female",label:"Female"}]}/>
        <Input label="Date of Birth" value={form.date_of_birth} onChange={set("date_of_birth")} type="date"/>
        <Sel   label="Class"       value={form.class_id}      onChange={set("class_id")}      options={classOpts}/>
        <Input label="Guardian Name"  value={form.guardian_name}  onChange={set("guardian_name")}  placeholder="Parent / guardian"/>
        <Input label="Guardian Phone" value={form.guardian_phone} onChange={set("guardian_phone")} placeholder="+234 …"/>
        <Input label="Guardian Email" value={form.guardian_email} onChange={set("guardian_email")} placeholder="guardian@example.com" type="email"/>
        <Input label="Guardian Address" value={form.guardian_address} onChange={set("guardian_address")} placeholder="Home address" style={{gridColumn:"1 / -1"}}/>
        <Input label="Admission Number" value={form.admission_number} onChange={set("admission_number")} placeholder="Auto-generated if blank"/>
        <Input label="Student ID"     value={form.student_id}      onChange={set("student_id")}      placeholder="Auto-generated if blank"/>
        <Input label="Previous School" value={form.previous_school} onChange={set("previous_school")} placeholder="Former school (optional)" style={{gridColumn:"1 / -1"}}/>
        <Input label="Medical Notes"  value={form.medical_notes}   onChange={set("medical_notes")}   placeholder="Allergies, conditions… (optional)" style={{gridColumn:"1 / -1"}}/>
      </div>
      {error && <div style={{marginTop:14,padding:"9px 12px",borderRadius:8,background:C.coralLight||"#FEE2E2",color:C.coral,fontSize:12,fontWeight:600}}>{error}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
        <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving?"Saving…":"Create Student"}</Btn>
      </div>
    </Modal>
  );
};

// ── Import students ─────────────────────────────────────────────────────────
// Split a combined class name ("JSS 3A") into form ("JSS 3") + arm ("A").
const splitClassName = (name = "") => {
  const m = name.trim().match(/^(.*?)[\s-]*([A-Za-z])$/);
  if (m && /\d/.test(m[1])) return { form: m[1].trim(), arm: m[2].toUpperCase() };
  return { form: name.trim(), arm: "" };
};

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, escaped quotes).
const parseCSV = (text) => {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ""; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => (cell || "").trim() !== ""));
};

// Read a CSV or Excel file into an array-of-arrays (first row = headers).
const readSheet = async (file) => {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "csv" || ext === "txt") return parseCSV(await file.text());
  const XLSX = await import("xlsx");                        // lazy — only loaded for real spreadsheets
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" })
    .filter(r => r.some(cell => String(cell ?? "").trim() !== ""));
};

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const FIELD_ALIASES = {
  name:             ["student name", "name", "full name", "fullname", "students name"],
  first_name:       ["first name", "firstname", "given name"],
  last_name:        ["last name", "lastname", "surname", "family name"],
  admission_number: ["admission no", "admission number", "adm no", "admno"],
  guardian_name:    ["father name", "guardian name", "parent name", "fathers name", "mother name", "guardian", "parent"],
  date_of_birth:    ["date of birth", "dob", "birth date", "birthdate"],
  gender:           ["gender", "sex"],
  phone:            ["mobile number", "phone", "mobile", "phone number", "contact", "mobile no"],
};
const headerToField = (h) => {
  const n = norm(h);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) if (aliases.includes(n)) return field;
  return null;
};

// Turn a sheet (array-of-arrays) into normalised student rows.
const mapSheetRows = (aoa) => {
  if (!aoa.length) return [];
  const cols = aoa[0].map(headerToField);
  return aoa.slice(1).map(cells => {
    const o = {};
    cols.forEach((f, i) => { if (f) o[f] = String(cells[i] ?? "").trim(); });
    if (!o.first_name && o.name) {
      const parts = o.name.split(/\s+/).filter(Boolean);
      o.first_name = parts.shift() || "";
      o.last_name = parts.join(" ");
    }
    o.name = o.name || [o.first_name, o.last_name].filter(Boolean).join(" ");
    return o;
  }).filter(o => o.name || o.first_name);
};

const ImportStudentsModal = ({ onClose, onImported }) => {
  const [classes, setClasses]   = useState([]);
  const [form, setForm]         = useState("");
  const [arm, setArm]           = useState("");
  const [rows, setRows]         = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);
  const [result, setResult]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    getClasses().then(res => {
      if (cancelled) return;
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setClasses(list);
    }).catch(() => { if (!cancelled) setClasses([]); });
    return () => { cancelled = true; };
  }, []);

  const parsed  = classes.map(c => ({ ...c, ...splitClassName(c.name) }));
  const forms   = [...new Set(parsed.map(c => c.form))];
  const arms    = parsed.filter(c => c.form === form).map(c => c.arm);
  const classId = parsed.find(c => c.form === form && c.arm === arm)?.id ?? null;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null); setResult(null); setFileName(file.name);
    try {
      const mapped = mapSheetRows(await readSheet(file));
      if (!mapped.length) { setError("No student rows found. Make sure the first row has column headers (e.g. Student Name, Admission No)."); setRows([]); return; }
      setRows(mapped);
    } catch (err) {
      setRows([]);
      setError(err?.message || "Could not read that file. Please upload a .csv or .xlsx file.");
    }
  };

  const doImport = async () => {
    if (!classId) { setError("Please select a class and arm."); return; }
    if (!rows.length) { setError("Please choose a file with at least one student."); return; }
    setBusy(true); setError(null);
    try {
      const res = await importStudents(classId, rows);
      setResult(res?.data ?? { created: 0, failed: 0, errors: [] });
    } catch (err) {
      setError(err?.message || err?.data?.error || "Import failed.");
    } finally { setBusy(false); }
  };

  return (
    <Modal title="📥 Import Students" onClose={busy ? () => {} : onClose} width={720}>
      {result ? (
        <div>
          <div style={{ padding:"16px", borderRadius:10, background:C.accentLight, border:`1px solid ${C.accent}33`, marginBottom:14 }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.accentDark }}>✅ {result.created} student{result.created === 1 ? "" : "s"} imported</div>
            {result.failed > 0 && <div style={{ fontSize:12, color:C.coral, fontWeight:600, marginTop:4 }}>{result.failed} row{result.failed === 1 ? "" : "s"} skipped</div>}
          </div>
          {result.errors?.length > 0 && (
            <div style={{ maxHeight:200, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:8, marginBottom:14 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr style={{ background:"#F8FAFC" }}>{["Row","Name","Reason"].map(h => <th key={h} style={{ padding:"7px 10px", textAlign:"left", fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {result.errors.map((er, i) => (
                    <tr key={i} style={{ borderTop:`1px solid ${C.border}` }}>
                      <td style={{ padding:"6px 10px", color:C.textMuted }}>{er.row}</td>
                      <td style={{ padding:"6px 10px" }}>{er.name || "—"}</td>
                      <td style={{ padding:"6px 10px", color:C.coral }}>{er.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <Btn variant="primary" onClick={onImported}>Done</Btn>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            <Sel label="Class" value={form} onChange={v => { setForm(v); setArm(""); }}
                 options={[{ value:"", label:"Select class…" }, ...forms.map(f => ({ value:f, label:f }))]}/>
            <Sel label="Arm" value={arm} onChange={setArm}
                 options={[{ value:"", label:"Select arm…" }, ...arms.map(a => ({ value:a, label:a || "—" }))]}/>
          </div>

          <label style={{ display:"block", border:`2px dashed ${C.border}`, borderRadius:12, padding:"22px", textAlign:"center", background:"#F8FAFC", cursor:"pointer" }}>
            <div style={{ fontSize:26, marginBottom:6 }}>📄</div>
            <div style={{ fontSize:13, fontWeight:600, color:C.textMid }}>{fileName || "Click to choose a CSV or Excel file"}</div>
            <div style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>Expected columns: Student Name, Admission No, Date of Birth, Gender, Father Name, Mobile Number</div>
            <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={onFile} style={{ display:"none" }}/>
          </label>

          {rows.length > 0 && (
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.textMid, marginBottom:6 }}>{rows.length} student{rows.length === 1 ? "" : "s"} ready to import {rows.length > 50 ? "(showing first 50)" : ""}</div>
              <div style={{ maxHeight:230, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:8 }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead><tr style={{ background:"#F8FAFC", position:"sticky", top:0 }}>{["#","Name","Admission No","Gender","D.O.B","Guardian"].map(h => <th key={h} style={{ padding:"7px 10px", textAlign:"left", fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} style={{ borderTop:`1px solid ${C.border}` }}>
                        <td style={{ padding:"6px 10px", color:C.textMuted }}>{i + 1}</td>
                        <td style={{ padding:"6px 10px", fontWeight:600 }}>{r.name || <span style={{ color:C.coral }}>Missing name</span>}</td>
                        <td style={{ padding:"6px 10px", color:C.textMid }}>{r.admission_number || "—"}</td>
                        <td style={{ padding:"6px 10px", color:C.textMid }}>{r.gender || "—"}</td>
                        <td style={{ padding:"6px 10px", color:C.textMid }}>{r.date_of_birth || "—"}</td>
                        <td style={{ padding:"6px 10px", color:C.textMid }}>{r.guardian_name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && <div style={{ marginTop:14, padding:"9px 12px", borderRadius:8, background:C.coralLight, color:C.coral, fontSize:12, fontWeight:600 }}>{error}</div>}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:18 }}>
            <Btn variant="secondary" onClick={onClose} disabled={busy}>Cancel</Btn>
            <Btn variant="primary" onClick={doImport} disabled={busy || !classId || !rows.length}>
              {busy ? "Importing…" : `Import ${rows.length || ""} Student${rows.length === 1 ? "" : "s"}`}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ── Students ──────────────────────────────────────────────────────────────────
const Students = () => {
  const [searchInput,setSearchInput]=useState("");
  const [search,setSearch]=useState("");
  const [classForm,setClassForm]=useState("");
  const [arm,setArm]=useState("");
  const [page,setPage]=useState(1);
  const [perPage,setPerPage]=useState(25);
  const [selected,setSelected]=useState(null);
  const [students,setStudents]=useState([]);
  const [meta,setMeta]=useState({total:0,page:1,per_page:25,pages:1});
  const [classes,setClasses]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [reloadKey,setReloadKey]=useState(0);
  const [showAdd,setShowAdd]=useState(false);
  const [showImport,setShowImport]=useState(false);
  const [sel,setSel]=useState(()=>new Set());   // selected student ids (for bulk delete)
  const [del,setDel]=useState(null);            // pending delete confirmation { ids:[], label }
  const [deleting,setDeleting]=useState(false);
  const [toast,setToast]=useState("");
  const flash=msg=>{ setToast(msg); setTimeout(()=>setToast(""),2600); };

  // Class / arm options for the filter dropdowns.
  useEffect(()=>{
    let cancelled=false;
    getClasses().then(res=>{
      if(cancelled) return;
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setClasses(list);
    }).catch(()=>{ if(!cancelled) setClasses([]); });
    return ()=>{ cancelled=true; };
  },[]);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(()=>{
    const t=setTimeout(()=>{ setSearch(searchInput); setPage(1); },350);
    return ()=>clearTimeout(t);
  },[searchInput]);

  const parsedClasses = classes.map(c=>({ ...c, ...splitClassName(c.name) }));
  const forms   = [...new Set(parsedClasses.map(c=>c.form))];
  const armOpts = parsedClasses.filter(c=>c.form===classForm).map(c=>c.arm);
  const classId = parsedClasses.find(c=>c.form===classForm && c.arm===arm)?.id ?? null;
  const hasFilters = !!(searchInput || classForm || arm);

  // Server-side fetch: search + class/arm filter + pagination.
  useEffect(()=>{
    let cancelled=false;
    setLoading(true); setError(null);
    const params={ page, per_page:perPage };
    if(search) params.search=search;
    if(classId) params.class_id=classId;
    else if(classForm) params.form=classForm;
    getStudents(params)
      .then(res=>{
        if(cancelled) return;
        const data = res?.data ?? res ?? {};
        const list = Array.isArray(data?.students) ? data.students
                   : Array.isArray(data) ? data
                   : Array.isArray(data?.data) ? data.data
                   : [];
        setStudents(list.map(normStudent));
        setMeta(data?.meta ?? { total:list.length, page, per_page:perPage, pages:1 });
        setSel(new Set());   // reset selection whenever the page/filter/data changes
      })
      .catch(err=>{ if(!cancelled) setError(err?.message || "Failed to load students."); })
      .finally(()=>{ if(!cancelled) setLoading(false); });
    return ()=>{ cancelled=true; };
  },[search,classId,classForm,page,perPage,reloadKey]);

  const clearFilters=()=>{ setSearchInput(""); setSearch(""); setClassForm(""); setArm(""); setPage(1); };
  const total = meta?.total ?? 0;
  const pages = Math.max(1, meta?.pages ?? 1);
  const start = total===0 ? 0 : (page-1)*perPage+1;
  const end   = Math.min(page*perPage, total);

  // Selection + delete
  const toggle    = id => setSel(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const allOnPage = students.length>0 && students.every(s=>sel.has(s.id));
  const toggleAll = () => setSel(p => { const n=new Set(p); const on=students.every(s=>p.has(s.id)); students.forEach(s=>on?n.delete(s.id):n.add(s.id)); return n; });
  const askDeleteOne      = s => setDel({ ids:[s.id], label:s.name });
  const askDeleteSelected = () => { if(sel.size) setDel({ ids:[...sel], label:`${sel.size} selected student${sel.size===1?"":"s"}` }); };
  const confirmDelete = async () => {
    if(!del) return;
    setDeleting(true);
    try {
      if(del.ids.length===1) await deleteStudent(del.ids[0]);
      else                   await bulkDeleteStudents(del.ids);
      flash(`Deleted ${del.ids.length} student${del.ids.length===1?"":"s"}.`);
      setDel(null); setSel(new Set()); setReloadKey(k=>k+1);
    } catch(err){ flash(err?.message || "Delete failed."); }
    finally { setDeleting(false); }
  };

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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <Input value={searchInput} onChange={setSearchInput} placeholder="🔍 Search name or ID…" style={{width:250}}/>
        <div style={{display:"flex",gap:8}}><Btn variant="secondary" onClick={()=>setShowImport(true)}>📥 Import Students</Btn><Btn variant="primary" onClick={()=>setShowAdd(true)}>+ Add Student</Btn></div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap",marginBottom:16}}>
        <Sel label="Class" value={classForm} onChange={v=>{ setClassForm(v); setArm(""); setPage(1); }}
             options={[{value:"",label:"All classes"},...forms.map(f=>({value:f,label:f}))]} style={{width:160}}/>
        <Sel label="Arm" value={arm} onChange={v=>{ setArm(v); setPage(1); }}
             options={[{value:"",label:classForm?"All arms":"—"},...armOpts.map(a=>({value:a,label:a||"—"}))]} style={{width:130}}/>
        <Sel label="Per page" value={String(perPage)} onChange={v=>{ setPerPage(Number(v)); setPage(1); }}
             options={[10,25,50,100].map(n=>({value:String(n),label:String(n)}))} style={{width:110}}/>
        {hasFilters && <Btn variant="ghost" size="sm" onClick={clearFilters}>✕ Clear</Btn>}
        <div style={{marginLeft:"auto",fontSize:12,color:C.textMuted,fontWeight:600}}>{total} student{total===1?"":"s"}</div>
      </div>
      {showAdd && (
        <AddStudentModal
          onClose={()=>setShowAdd(false)}
          onCreated={()=>{ setShowAdd(false); setReloadKey(k=>k+1); }}
        />
      )}
      {showImport && (
        <ImportStudentsModal
          onClose={()=>setShowImport(false)}
          onImported={()=>{ setShowImport(false); setReloadKey(k=>k+1); }}
        />
      )}
      {sel.size>0 && (
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",marginBottom:12,borderRadius:10,background:C.coralLight||"#FEE2E2",border:`1px solid ${C.coral}`}}>
          <span style={{fontSize:12,fontWeight:700,color:C.coral}}>{sel.size} selected</span>
          <Btn size="sm" variant="danger" onClick={askDeleteSelected}>🗑 Delete selected</Btn>
          <Btn size="sm" variant="ghost" onClick={()=>setSel(new Set())}>Clear selection</Btn>
        </div>
      )}
      {del && (
        <Modal title={del.ids.length===1?"Delete student?":"Delete students?"} onClose={deleting?()=>{}:()=>setDel(null)} width={440}>
          <div style={{fontSize:13,color:C.textMid,lineHeight:1.6}}>
            You're about to delete <strong>{del.label}</strong>. They will be removed from active student lists, classes and rosters. This cannot be undone from here.
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <Btn variant="secondary" onClick={()=>setDel(null)} disabled={deleting}>Cancel</Btn>
            <Btn variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting?"Deleting…":`Delete ${del.ids.length} student${del.ids.length===1?"":"s"}`}</Btn>
          </div>
        </Modal>
      )}
      {toast && <div style={{position:"fixed",bottom:26,right:26,zIndex:2000,background:C.navy,color:"#fff",padding:"11px 18px",borderRadius:11,fontSize:12,fontWeight:600,boxShadow:"0 8px 28px rgba(0,0,0,.2)",borderLeft:`4px solid ${C.accent}`}}>{toast}</div>}
      {loading ? (
        <Card>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px",gap:14}}>
            <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${C.border}`,borderTopColor:C.accent,animation:"spin .8s linear infinite"}}/>
            <span style={{fontSize:12,color:C.textMuted,fontWeight:500}}>Loading students…</span>
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",gap:10}}>
            <div style={{fontSize:13,fontWeight:600,color:C.coral}}>Couldn't load students</div>
            <div style={{fontSize:11,color:C.textMuted}}>{error}</div>
            <Btn variant="secondary" size="sm" onClick={()=>setReloadKey(k=>k+1)} style={{marginTop:6}}>Retry</Btn>
          </div>
        </Card>
      ) : (
      <Card style={{padding:0}}>
        <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
          <thead><tr style={{borderBottom:`1px solid ${C.border}`,background:"#F8FAFC"}}>
            <th style={{padding:"10px 15px",width:34}}><input type="checkbox" checked={allOnPage} onChange={toggleAll} title="Select all on this page" style={{width:15,height:15,cursor:"pointer"}}/></th>
            {["Student","ID","Class","GPA","Fees","Action"].map(h=><th key={h} style={{padding:"10px 15px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:".5px"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {students.length===0 ? (
              <tr><td colSpan={7} style={{padding:"36px 15px",textAlign:"center",fontSize:12,color:C.textMuted}}>{hasFilters?"No students match these filters.":"No students yet."}</td></tr>
            ) : students.map((s,i)=>(
              <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`,transition:"background .1s",background:sel.has(s.id)?C.accentLight:"transparent"}} onMouseEnter={e=>{if(!sel.has(s.id))e.currentTarget.style.background="#F8FAFC"}} onMouseLeave={e=>{e.currentTarget.style.background=sel.has(s.id)?C.accentLight:"transparent"}}>
                <td style={{padding:"10px 15px"}}><input type="checkbox" checked={sel.has(s.id)} onChange={()=>toggle(s.id)} style={{width:15,height:15,cursor:"pointer"}}/></td>
                <td style={{padding:"10px 15px"}}><div style={{display:"flex",alignItems:"center",gap:9}}><Avatar initials={s.avatar} size={28} color={[C.accent,C.sky,C.purple,C.amber,C.coral][i%5]}/><span style={{fontSize:12,fontWeight:600}}>{s.name}</span></div></td>
                <td style={{padding:"10px 15px",fontSize:11,color:C.textMuted,fontFamily:"monospace"}}>{s.student_id||s.id}</td>
                <td style={{padding:"10px 15px",fontSize:12}}>{s.class}</td>
                <td style={{padding:"10px 15px",fontSize:13,fontWeight:700,color:s.gpa>=3.5?C.accentDark:s.gpa>=2.5?C.amber:C.coral}}>{s.gpa}</td>
                <td style={{padding:"10px 15px"}}><Badge color={s.fees==="Paid"?"green":"red"} size="sm">{s.fees}</Badge></td>
                <td style={{padding:"10px 15px"}}><div style={{display:"flex",gap:6}}><Btn onClick={()=>setSelected(s)} size="sm" variant="secondary">View</Btn><Btn onClick={()=>askDeleteOne(s)} size="sm" variant="danger">Delete</Btn></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {/* Pagination */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 15px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap",gap:10}}>
          <span style={{fontSize:12,color:C.textMuted}}>Showing {start}–{end} of {total}</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Btn size="sm" variant="secondary" onClick={()=>setPage(1)} disabled={page<=1}>« First</Btn>
            <Btn size="sm" variant="secondary" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>‹ Prev</Btn>
            <span style={{fontSize:12,fontWeight:600,padding:"0 8px"}}>Page {page} of {pages}</span>
            <Btn size="sm" variant="secondary" onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page>=pages}>Next ›</Btn>
            <Btn size="sm" variant="secondary" onClick={()=>setPage(pages)} disabled={page>=pages}>Last »</Btn>
          </div>
        </div>
      </Card>
      )}
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
  const [classes, setClasses] = useState([]);
  const [terms,   setTerms]   = useState([]);
  const [classId, setClassId] = useState("");
  const [termId,  setTermId]  = useState("");
  const [date,    setDate]    = useState(() => new Date().toISOString().slice(0,10));
  const [students,setStudents]= useState([]);
  const [records, setRecords] = useState({});   // studentId -> { status, comment, dismissTime }
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState("");
  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2600); };

  useEffect(() => {
    getClasses().then(r => { const l = arrOf(r); setClasses(l); if (l[0]) setClassId(String(l[0].id)); }).catch(() => {});
    getTerms().then(r => { const l = arrOf(r); setTerms(l); if (l.length) setTermId(String(l[l.length-1].id)); }).catch(() => {});
  }, []);

  // Load roster + any attendance already saved for this class/date/term.
  useEffect(() => {
    if (!classId || !termId || !date) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getStudents({ class_id: classId, per_page: 100 }).then(r => arrOf(r, "students").map(normStudent)).catch(() => []),
      getAttendance(classId, date, termId).then(r => arrOf(r)).catch(() => []),
    ]).then(([roster, existing]) => {
      if (cancelled) return;
      setStudents(roster);
      const byId = {};
      existing.forEach(a => { byId[a.student_id] = { status:a.status||"", comment:a.comment||"", dismissTime:a.dismiss_time||"" }; });
      const recs = {};
      roster.forEach(s => { recs[s.id] = byId[s.id] || { status:"", comment:"", dismissTime:"" }; });
      setRecords(recs);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [classId, termId, date]);

  const setField = (id, key, val) => setRecords(p => ({ ...p, [id]: { ...p[id], [key]: val } }));
  const countBy  = prefix => Object.values(records).filter(r => r.status?.startsWith(prefix)).length;
  const totalMarked = Object.values(records).filter(r => r.status).length;

  const save = async () => {
    const recs = students.filter(s => records[s.id]?.status).map(s => ({
      student_id: s.id, status: records[s.id].status,
      dismiss_time: records[s.id].dismissTime || null, comment: records[s.id].comment || null, method:"manual",
    }));
    if (!recs.length) { flash("Mark at least one student first."); return; }
    setSaving(true);
    try {
      const res = await submitAttendance(recs, Number(classId), Number(termId), date);
      flash(`Attendance saved for ${res?.data?.saved ?? recs.length} student(s).`);
    } catch (err) { flash(err?.message || err?.data?.error || "Save failed."); }
    finally { setSaving(false); }
  };

  const applyQR = scanned => {
    setRecords(p => { const n = { ...p }; scanned.forEach(sc => { if (n[sc.id]) n[sc.id] = { ...n[sc.id], status:"present" }; }); return n; });
    setModal(null);
  };

  const statusBorderColor = s => ({
    present:"#2ECC9A", "absent-excused":"#3B82F6", "absent-unexcused":"#EF4444",
    late:"#F59E0B", "late-excused":"#3B82F6", "early-dismissal":"#F97316",
  })[s] || C.border;

  return (
    <div className="fi">
      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div style={{ display:"flex", gap:2, background:"#F1F5F9", borderRadius:10, padding:4, alignSelf:"center" }}>
          {[["manual","✏️ Manual"],["qr","📷 QR Code"],["biometric","👆 Biometric"]].map(([v,l]) => (
            <button key={v} onClick={() => { setMethod(v); if (v !== "manual") setModal(v); }}
              style={{ padding:"6px 14px", borderRadius:8, border:"none", fontSize:12, fontWeight:600, cursor:"pointer",
                background:method===v?C.surface:"transparent", color:method===v?C.text:C.textMid,
                boxShadow:method===v?"0 1px 4px rgba(0,0,0,.08)":"none", transition:"all .15s" }}>{l}</button>
          ))}
        </div>
        <Sel label="Class" value={classId} onChange={setClassId} options={classes.map(c => ({ value:String(c.id), label:c.name }))} style={{ width:150 }}/>
        <Sel label="Term"  value={termId}  onChange={setTermId}  options={terms.map(t => ({ value:String(t.id), label:t.year_name?`${t.name} · ${t.year_name}`:t.name }))} style={{ width:170 }}/>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontSize:11, fontWeight:700, color:C.textMid, letterSpacing:".4px", textTransform:"uppercase" }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            onClick={e => e.target.showPicker?.()} onFocus={e => e.target.showPicker?.()}
            style={{ padding:"8px 12px", borderRadius:8, border:`1px solid ${C.border}`, fontSize:13, outline:"none", background:C.surface, color:C.text, cursor:"pointer", colorScheme:"light" }}/>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:9, alignSelf:"center" }}>
          <Btn variant="primary" disabled={saving || totalMarked===0} onClick={save}>{saving?"Saving…":`✅ Submit (${totalMarked}/${students.length})`}</Btn>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {[["Present",countBy("present"),C.accent],["Absent",countBy("absent"),C.coral],["Late",countBy("late"),C.amber],["Early Dismiss",countBy("early-dismissal"),C.orange],["Unmarked",Math.max(0,students.length-totalMarked),C.textMuted]].map(([l,v,col]) => (
          <div key={l} style={{ flex:1, minWidth:90, padding:"11px 13px", background:col+"14", borderRadius:10, border:`1px solid ${col}28` }}>
            <div style={{ fontSize:20, fontWeight:700, color:col }}>{v}</div>
            <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Register */}
      <Card style={{ padding:0 }}>
        {loading ? (
          <div style={{ padding:"50px", textAlign:"center", fontSize:12, color:C.textMuted }}>Loading register…</div>
        ) : students.length === 0 ? (
          <div style={{ padding:"40px", textAlign:"center", fontSize:12, color:C.textMuted }}>{classId ? "No students in this class." : "Select a class to take attendance."}</div>
        ) : students.map((s, i) => {
          const rec = records[s.id] || { status:"", comment:"", dismissTime:"" };
          const isED = rec.status === "early-dismissal";
          return (
            <div key={s.id} style={{ borderBottom: i < students.length-1 ? `1px solid ${C.border}` : "none", padding:"12px 18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <Avatar initials={s.avatar} size={32} color={C.accent}/>
                <div style={{ minWidth:150 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{s.name}</div>
                  <div style={{ fontSize:10, color:C.textMuted }}>{s.student_id || s.id}</div>
                </div>

                {/* Status dropdown (explicit dark text so options stay legible) */}
                <select value={rec.status} onChange={e => setField(s.id, "status", e.target.value)}
                  style={{ padding:"6px 10px", borderRadius:8, border:`1.5px solid ${rec.status ? statusBorderColor(rec.status) : C.border}`,
                    fontSize:12, outline:"none", background:rec.status?C.accentLight:C.surface, color:C.text,
                    fontFamily:"Sora,sans-serif", cursor:"pointer", flex:1, minWidth:200 }}>
                  <option value="" style={{ color:C.text, background:"#fff" }}>— Mark attendance —</option>
                  {STATUS_OPTS.map(o => <option key={o.value} value={o.value} style={{ color:C.text, background:"#fff" }}>{o.label}</option>)}
                </select>

                {isED && (
                  <input type="time" value={rec.dismissTime} onChange={e => setField(s.id, "dismissTime", e.target.value)}
                    style={{ padding:"6px 10px", borderRadius:8, border:`1px solid ${C.orange}`, fontSize:12, outline:"none", background:C.orangeLight, color:C.text, width:110 }}/>
                )}

                {rec.status && (
                  <Badge color={{ present:"green","absent-excused":"blue","absent-unexcused":"red",late:"amber","late-excused":"blue","early-dismissal":"orange" }[rec.status]||"gray"} size="sm">
                    {STATUS_OPTS.find(o => o.value === rec.status)?.label.replace(/^[^\s]+\s/, "")}
                  </Badge>
                )}
              </div>

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

      {/* Bottom submit — mirrors the toolbar button so long registers don't require scrolling back up. */}
      {students.length > 0 && (
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
          <Btn variant="primary" disabled={saving || totalMarked===0} onClick={save}>{saving?"Saving…":`✅ Submit (${totalMarked}/${students.length})`}</Btn>
        </div>
      )}

      {toast && <div style={{position:"fixed",bottom:26,right:26,zIndex:2000,background:C.navy,color:"#fff",padding:"11px 18px",borderRadius:11,fontSize:12,fontWeight:600,boxShadow:"0 8px 28px rgba(0,0,0,.2)",borderLeft:`4px solid ${C.accent}`}}>{toast}</div>}
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
// Single-letter grade colour (report-card scale A–F).
const letterColor = g => ({A:"green",B:"blue",C:"amber",D:"amber",E:"red",F:"red"}[g]||"gray");
const ordinal     = n => { if(n==null) return "—"; const s=["th","st","nd","rd"],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };
// Report-card table cell styles.
const rcThL = { padding:"8px 10px", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", textAlign:"left",   border:`1px solid ${C.border}` };
const rcThC = { ...rcThL, textAlign:"center" };
const rcTd  = { padding:"7px 9px", fontSize:12, border:`1px solid ${C.border}` };
const rcTdC = { ...rcTd, textAlign:"center" };

// A single printable report sheet. Rendered one-per-student inside a print-only
// container so single and bulk printing share exactly the same layout.
const ReportSheet = ({ rc }) => {
  if (!rc) return null;
  const hasAttendance = (rc.attendance?.total_days > 0) || (rc.attendance?.present > 0) || (rc.attendance?.absent > 0);
  return (
    <Card className="print-area report-sheet" style={{ maxWidth:820, margin:"0 auto 18px", border:"2px solid "+C.border }}>
      {/* Header — school logo + name, then report-card band */}
      <div style={{ borderBottom:`2px solid ${C.navy}`, paddingBottom:12, marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14 }}>
          {rc.school?.logo_url && <img src={rc.school.logo_url} alt="" style={{ height:60, width:60, objectFit:"contain", flexShrink:0 }}/>}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:800, color:C.navy, lineHeight:1.15 }}>{rc.school?.name || "—"}</div>
            {rc.school?.motto && <div style={{ fontSize:10, fontStyle:"italic", color:C.textMid }}>{rc.school.motto}</div>}
            {rc.school?.address && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>{rc.school.address}{rc.school.phone?` · ${rc.school.phone}`:""}</div>}
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:10 }}>
          <span style={{ display:"inline-block", background:C.navy, color:"#fff", fontSize:11, fontWeight:700, letterSpacing:".8px", padding:"4px 16px", borderRadius:20 }}>TERMLY REPORT SHEET</span>
          <div style={{ fontSize:11, color:C.textMid, marginTop:5 }}>Academic Session: {rc.term?.year || "—"}</div>
        </div>
      </div>
      {/* Student row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 24px", fontSize:12, marginBottom:12 }}>
        {[
          ["Student's Name", rc.student?.name],
          ["Student ID", rc.student?.sid],
          ["Class", rc.student?.class_name],
          ["Term", rc.term?.name],
        ].map(([k,v]) => (
          <div key={k} style={{ display:"flex", justifyContent:"space-between", gap:8, borderBottom:`1px dotted ${C.border}`, paddingBottom:3 }}>
            <span style={{ color:C.textMuted }}>{k}:</span><strong style={{ textAlign:"right" }}>{v || "—"}</strong>
          </div>
        ))}
      </div>
      {/* Scholastic table */}
      <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:12 }}>
        <thead>
          <tr style={{ background:"#F8FAFC" }}>
            <th style={rcThL}>Subject</th>
            <th style={rcThC}>C.A.<br/><span style={{ fontWeight:400 }}>(40)</span></th>
            <th style={rcThC}>Exam<br/><span style={{ fontWeight:400 }}>(60)</span></th>
            <th style={rcThC}>Total<br/><span style={{ fontWeight:400 }}>(100)</span></th>
            <th style={rcThC}>Grade</th>
            <th style={rcThC}>Position</th>
            <th style={rcThC}>Highest</th>
            <th style={rcThC}>Lowest</th>
          </tr>
        </thead>
        <tbody>
          {rc.subjects?.length ? rc.subjects.map(s => (
            <tr key={s.subject}>
              <td style={{ ...rcTd, fontWeight:600 }}>{s.subject}</td>
              <td style={rcTdC}>{s.ca}</td>
              <td style={rcTdC}>{s.exam}</td>
              <td style={{ ...rcTdC, fontWeight:700 }}>{s.total}</td>
              <td style={rcTdC}><Badge color={letterColor(s.grade)} size="sm">{s.grade}</Badge></td>
              <td style={rcTdC}>{ordinal(s.position)}</td>
              <td style={{ ...rcTdC, background:C.accentLight }}>{s.highest}</td>
              <td style={{ ...rcTdC, background:C.coralLight }}>{s.lowest}</td>
            </tr>
          )) : <tr><td colSpan={8} style={{ ...rcTdC, color:C.textMuted, padding:"16px" }}>No grades recorded for this term.</td></tr>}
        </tbody>
      </table>
      {/* Overall summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, fontSize:12, marginBottom:14 }}>
        {[
          ["Overall Marks", `${rc.overall?.total} / ${rc.overall?.max}`],
          ["Percentage", `${rc.overall?.percentage}%`],
          ["Grade", rc.overall?.grade],
          ["Position in Class", `${ordinal(rc.overall?.position)} of ${rc.class_size}`],
          ["Class Highest", `${rc.overall?.class_highest}%`],
          ["Class Lowest", `${rc.overall?.class_lowest}%`],
        ].map(([k,v]) => (
          <div key={k} style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 10px" }}>
            <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>{k}</div>
            <div style={{ fontSize:14, fontWeight:700 }}>{v}</div>
          </div>
        ))}
      </div>
      {/* Behaviour */}
      <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom: hasAttendance ? 10 : 14 }}>
        <div style={{ background:"#F8FAFC", padding:"7px 10px", fontSize:10, fontWeight:700, textTransform:"uppercase" }}>Affective Traits / Behavioural Assessment</div>
        {rc.behaviour?.length ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
            {rc.behaviour.map((b,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                <span>{b.trait}</span><strong>{b.score != null ? `${b.score}/5` : (b.rating || "—")}</strong>
              </div>
            ))}
          </div>
        ) : <div style={{ padding:"14px 10px", fontSize:11, color:C.textMuted, textAlign:"center" }}>No behavioural records.</div>}
      </div>
      {/* Attendance — single horizontal row of columns to save vertical space */}
      {hasAttendance && (
        <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom:14 }}>
          <div style={{ background:"#F8FAFC", padding:"7px 10px", fontSize:10, fontWeight:700, textTransform:"uppercase" }}>Attendance</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
            {[
              ["Times School Opened", rc.attendance?.total_days],
              ["Times Present", rc.attendance?.present],
              ["Times Absent", rc.attendance?.absent ?? "—"],
              ["Attendance %", `${rc.attendance?.percentage}%`],
            ].map(([k,v],i) => (
              <div key={k} style={{ padding:"8px 10px", textAlign:"center", borderLeft: i ? `1px solid ${C.border}` : "none" }}>
                <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase" }}>{k}</div>
                <div style={{ fontSize:14, fontWeight:700, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Comments */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:8 }}>
        {[["Class Teacher's Remark", rc.comments?.teacher_comment],["Head Teacher's Remark", rc.comments?.principal_comment]].map(([title,text]) => (
          <div key={title} style={{ padding:"10px 12px", borderRadius:9, background:"#F8FAFC", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", marginBottom:5 }}>{title}</div>
            <div style={{ fontSize:12, lineHeight:1.6, color:C.textMid, minHeight:34 }}>{text || <span style={{ color:C.textMuted }}>—</span>}</div>
          </div>
        ))}
      </div>
      {/* Grading scale */}
      <div style={{ fontSize:10, color:C.textMuted, borderTop:`1px solid ${C.border}`, paddingTop:8, marginTop:6 }}>
        Grading Scale: A (70–100%) · B (60–69%) · C (50–59%) · D (45–49%) · E (40–44%) · F (0–39%)
      </div>
    </Card>
  );
};

const TraitSel = ({ value, onChange }) => (
  <select value={value||""} onChange={e => onChange(e.target.value)}
    style={{ padding:"3px 6px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:11, outline:"none", background:C.surface }}>
    <option value="">—</option>
    {["Excellent","Very Good","Good","Fair","Poor"].map(r => <option key={r} value={r}>{r}</option>)}
  </select>
);

// Best-effort JSON parse for AI output: strips ``` fences and slices to the
// outermost array/object so a stray sentence before/after JSON doesn't break it.
const parseJsonLoose = raw => {
  if (!raw) return null;
  let s = String(raw).replace(/```json|```/gi, "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  const o = s.indexOf("{"), p = s.lastIndexOf("}");
  const start = a >= 0 ? a : o, end = a >= 0 ? b : p;
  if (start >= 0 && end > start) { try { return JSON.parse(s.slice(start, end + 1)); } catch { /* noop */ } }
  return null;
};

// ── Document export (no external deps) ──────────────────────────────────────────
const escHtml = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
// Minimal Markdown → HTML for AI output (headings, bold, bullet lists, paragraphs).
const mdToHtml = md => {
  const lines = String(md ?? "").split("\n");
  let html = "", inList = false;
  const inline = t => escHtml(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  for (const raw of lines) {
    const l = raw.trim();
    if (/^[-*]\s+/.test(l)) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    if (/^###\s+/.test(l))      html += `<h3>${inline(l.replace(/^###\s+/, ""))}</h3>`;
    else if (/^##\s+/.test(l))  html += `<h2>${inline(l.replace(/^##\s+/, ""))}</h2>`;
    else if (/^#\s+/.test(l))   html += `<h1>${inline(l.replace(/^#\s+/, ""))}</h1>`;
    else if (l === "")          html += "";
    else                        html += `<p>${inline(l)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
};
const exportDocHtml = (title, bodyHtml) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title>
<style>body{font-family:Georgia,'Times New Roman',serif;line-height:1.6;color:#111;max-width:820px;margin:28px auto;padding:0 22px}
h1{font-size:22px}h2{font-size:17px;margin:20px 0 6px}h3{font-size:15px;margin:16px 0 4px}
.q{margin:0 0 12px}.opt{margin:2px 0 2px 20px}.mk{color:#666;font-size:12px}hr{border:none;border-top:1px solid #ccc;margin:16px 0}
ul{margin:6px 0 6px 22px}</style></head><body>${bodyHtml}</body></html>`;
// Word: an HTML-based .doc blob (Word opens it natively) — no library needed.
const downloadDoc = (filename, title, bodyHtml) => {
  const blob = new Blob(["﻿", exportDocHtml(title, bodyHtml)], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".doc") ? filename : filename + ".doc";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
// PDF: open a print window; the user picks "Save as PDF" in the print dialog.
const printDocPdf = (title, bodyHtml) => {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(exportDocHtml(title, bodyHtml));
  w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch { /* noop */ } }, 350);
  return true;
};

// Pull an array out of the {status,data,message} envelope, by key or directly.
const arrOf = (res, key) => Array.isArray(res?.data?.[key]) ? res.data[key]
                         : Array.isArray(res?.data) ? res.data
                         : Array.isArray(res) ? res : [];

// ── Report-card attendance totals ───────────────────────────────────────────────
// Teachers enter, per student per term: times present, times absent, and the number
// of times the school opened. These feed the report card's Attendance box.
const AttendanceSummaryTab = ({ flash }) => {
  const [classes,setClasses]=useState([]);
  const [terms,setTerms]=useState([]);
  const [classId,setClassId]=useState("");
  const [termId,setTermId]=useState("");
  const [students,setStudents]=useState([]);
  const [vals,setVals]=useState({});   // studentId -> { present, absent, days_opened }
  const [openedAll,setOpenedAll]=useState("");
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    getClasses().then(r=>{ const l=arrOf(r); setClasses(l); if(l[0]) setClassId(String(l[0].id)); }).catch(()=>{});
    getTerms().then(r=>{ const l=arrOf(r); setTerms(l); if(l.length) setTermId(String(l[l.length-1].id)); }).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(!classId||!termId) return;
    let cancelled=false; setLoading(true);
    Promise.all([
      getStudents({class_id:classId,per_page:100}).then(r=>arrOf(r,"students").map(normStudent)).catch(()=>[]),
      getTermAttendance(classId,termId).then(r=>arrOf(r)).catch(()=>[]),
    ]).then(([roster,summary])=>{
      if(cancelled) return;
      setStudents(roster);
      const byId={}; summary.forEach(a=>{ byId[a.student_id]={ present:a.present??"", absent:a.absent??"", days_opened:a.days_opened??"" }; });
      const v={}; roster.forEach(s=>{ v[s.id]=byId[s.id]||{ present:"", absent:"", days_opened:"" }; });
      setVals(v);
    }).finally(()=>{ if(!cancelled) setLoading(false); });
    return ()=>{ cancelled=true; };
  },[classId,termId]);

  const set=(id,k,val)=>setVals(p=>({...p,[id]:{...(p[id]||{}),[k]:val}}));
  const applyOpenedToAll=()=>{ if(openedAll==="") return; setVals(p=>{ const n={...p}; students.forEach(s=>{ n[s.id]={...(n[s.id]||{}),days_opened:openedAll}; }); return n; }); };

  const save=async()=>{
    const records=students.map(s=>({ student_id:s.id, ...(vals[s.id]||{}) }));
    setSaving(true);
    try{ await saveTermAttendance(Number(classId),Number(termId),records); flash("Attendance totals saved."); }
    catch(err){ flash(err?.message || err?.data?.error || "Save failed."); }
    finally{ setSaving(false); }
  };

  const numInput=(id,k,ph)=>(
    <input type="number" min="0" value={vals[id]?.[k] ?? ""} onChange={e=>set(id,k,e.target.value)} placeholder={ph}
      style={{ width:"100%", padding:"6px 8px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:13, outline:"none", textAlign:"center", color:C.text, background:C.surface }}/>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
        <Sel label="Class" value={classId} onChange={setClassId} options={classes.map(c=>({value:String(c.id),label:c.name}))} style={{ width:160 }}/>
        <Sel label="Term"  value={termId}  onChange={setTermId}  options={terms.map(t=>({value:String(t.id),label:t.year_name?`${t.name} · ${t.year_name}`:t.name}))} style={{ width:180 }}/>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontSize:11, fontWeight:700, color:C.textMid, letterSpacing:".4px", textTransform:"uppercase" }}>School opened (all)</label>
          <div style={{ display:"flex", gap:6 }}>
            <input type="number" min="0" value={openedAll} onChange={e=>setOpenedAll(e.target.value)} placeholder="e.g. 120"
              style={{ width:100, padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, fontSize:13, outline:"none", color:C.text, background:C.surface }}/>
            <Btn variant="secondary" size="sm" onClick={applyOpenedToAll}>Apply to all</Btn>
          </div>
        </div>
        <div style={{ marginLeft:"auto" }}>
          <Btn variant="primary" onClick={save} disabled={saving || students.length===0}>{saving?"Saving…":"💾 Save Totals"}</Btn>
        </div>
      </div>
      <div style={{ padding:"10px 14px", borderRadius:9, background:C.accentLight, fontSize:12, color:C.accentDark }}>
        ℹ️ Enter each student's total <strong>present</strong> and <strong>absent</strong> counts and the number of times the <strong>school opened</strong> for the term. These appear in the report card's Attendance box (Attendance % = present ÷ school opened).
      </div>
      <Card style={{ padding:0, overflowX:"auto" }}>
        {loading ? (
          <div style={{ padding:"40px", textAlign:"center", fontSize:12, color:C.textMuted }}>Loading…</div>
        ) : students.length===0 ? (
          <div style={{ padding:"40px", textAlign:"center", fontSize:12, color:C.textMuted }}>{classId?"No students in this class.":"Select a class."}</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:560 }}>
            <thead><tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
              {["Student","Present","Absent","Times School Opened"].map(h=><th key={h} style={{ padding:"10px 14px", textAlign:h==="Student"?"left":"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {students.map(s=>(
                <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"8px 14px", fontSize:12, fontWeight:600 }}>{s.name}</td>
                  <td style={{ padding:"8px 10px", width:120 }}>{numInput(s.id,"present","0")}</td>
                  <td style={{ padding:"8px 10px", width:120 }}>{numInput(s.id,"absent","0")}</td>
                  <td style={{ padding:"8px 10px", width:150 }}>{numInput(s.id,"days_opened","0")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

// ── Report-card remark settings ─────────────────────────────────────────────────
// Two features, both editable only by an admin or the class's mapped class teacher:
//   1. Score bands per remark type — school-wide OR class-specific (class overrides).
//   2. A custom remark targeting one specific student (overrides everything).
const REMARK_TYPES = [
  { key:"class_teacher", label:"👩‍🏫 Class Teacher's Remark" },
  { key:"head_teacher",  label:"🎓 Head Teacher's Remark" },
];
const ADMIN_ROLES = ["super_admin", "school_admin"];
// Recommended school-wide bands (high→low). Shown as placeholder guidance in the
// school-wide remark inputs and offered via "Load recommended defaults".
const RECOMMENDED_BANDS = {
  class_teacher: [
    { min:"70", max:"100",   remark:"An excellent result. A hardworking and focused student - keep it up!" },
    { min:"60", max:"69.99", remark:"A very good performance. With more effort you will reach the top." },
    { min:"50", max:"59.99", remark:"A good result, but there is room for improvement. Work harder." },
    { min:"40", max:"49.99", remark:"A fair result. You need to be more serious with your studies." },
    { min:"0",  max:"39.99", remark:"A weak result. Please put in much more effort next term." },
  ],
  head_teacher: [
    { min:"70", max:"100",   remark:"Outstanding! A commendable performance. We are proud of you." },
    { min:"60", max:"69.99", remark:"A very good result. Keep up the good work." },
    { min:"50", max:"59.99", remark:"A satisfactory result. Aim higher next term." },
    { min:"40", max:"49.99", remark:"You can do better. More commitment is required." },
    { min:"0",  max:"39.99", remark:"This result is below expectation. Extra support is advised." },
  ],
};

// Wrapper: loads the signed-in user + classes once, derives the permission check,
// then renders the custom-student-remark and score-band sections.
const RemarkSettings = ({ flash }) => {
  const [me,      setMe]      = useState(null);
  const [classes, setClasses] = useState([]);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMe().then(r => r?.data ?? r).catch(() => null),
      getClasses().then(r => arrOf(r)).catch(() => []),
    ]).then(([user, cls]) => {
      if (cancelled) return;
      setMe(user); setClasses(cls); setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const isAdmin = !!me && ADMIN_ROLES.includes(me.role);
  // classId falsy → school-wide scope (admins only). Otherwise admin or that class's teacher.
  const canManage = (classId) => {
    if (isAdmin) return true;
    if (!classId) return false;
    const c = classes.find(x => String(x.id) === String(classId));
    return !!(c && me && Number(c.form_teacher_id) === Number(me.id));
  };

  if (!loaded) return <Card><div style={{ padding:"40px", textAlign:"center", fontSize:12, color:C.textMuted }}>Loading remark settings…</div></Card>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {!isAdmin && (
        <div style={{ padding:"10px 14px", borderRadius:9, background:C.amberLight, fontSize:12, color:"#92400E" }}>
          🔒 You can edit remarks only for the class you are assigned to as class teacher. Other scopes are read-only.
        </div>
      )}
      <CustomStudentRemark classes={classes} canManage={canManage} flash={flash}/>
      <RemarkRangesManager  classes={classes} canManage={canManage} flash={flash}/>
    </div>
  );
};

// Feature 1 — custom remark for a specific student (stored as teacher_comments;
// overrides the range-based auto remark on that student's report card).
const CustomStudentRemark = ({ classes, canManage, flash }) => {
  const [classId,  setClassId]  = useState("");
  const [students, setStudents] = useState([]);
  const [studentId,setStudentId]= useState("");
  const [terms,    setTerms]    = useState([]);
  const [termId,   setTermId]   = useState("");
  const [cmap,     setCmap]     = useState({});   // student_id -> {teacher_comment, principal_comment}
  const [teacher,  setTeacher]  = useState("");
  const [head,     setHead]     = useState("");
  const [saving,   setSaving]   = useState(false);

  const allowed = canManage(classId);

  useEffect(() => {
    getTerms().then(r => { const l = arrOf(r); setTerms(l); if (l.length) setTermId(String(l[l.length-1].id)); }).catch(() => {});
  }, []);

  // Roster when class changes.
  useEffect(() => {
    if (!classId) { setStudents([]); setStudentId(""); return; }
    let cancelled = false;
    getStudents({ class_id: classId, per_page: 100 })
      .then(r => { if (!cancelled) { const l = arrOf(r, "students").map(normStudent); setStudents(l); setStudentId(l[0] ? String(l[0].id) : ""); } })
      .catch(() => { if (!cancelled) setStudents([]); });
    return () => { cancelled = true; };
  }, [classId]);

  // Existing comments for the class+term (to pre-fill).
  useEffect(() => {
    if (!classId || !termId) { setCmap({}); return; }
    let cancelled = false;
    getComments({ class_id: classId, term_id: termId })
      .then(r => { if (!cancelled) { const m = {}; arrOf(r).forEach(c => { m[c.student_id] = c; }); setCmap(m); } })
      .catch(() => { if (!cancelled) setCmap({}); });
    return () => { cancelled = true; };
  }, [classId, termId]);

  // Pre-fill the editors when the selected student (or loaded comments) change.
  useEffect(() => {
    const c = cmap[studentId] || {};
    setTeacher(c.teacher_comment || "");
    setHead(c.principal_comment || "");
  }, [studentId, cmap]);

  const save = async () => {
    if (!studentId || !termId) { flash("Select a class, student and term."); return; }
    setSaving(true);
    try {
      await saveComments([{ student_id: Number(studentId), term_id: Number(termId),
                            teacher_comment: teacher.trim() || null, principal_comment: head.trim() || null }]);
      setCmap(m => ({ ...m, [studentId]: { student_id: Number(studentId), teacher_comment: teacher, principal_comment: head } }));
      flash("Custom remark saved for this student.");
    } catch (err) { flash(err?.message || "Save failed."); }
    finally { setSaving(false); }
  };

  const classOpts = [{ value:"", label:"Select class…" }, ...classes.map(c => ({ value:String(c.id), label:c.name }))];
  const studentOpts = [{ value:"", label: students.length ? "Select student…" : "— no students —" },
                       ...students.map(s => ({ value:String(s.id), label:s.name }))];
  const termOpts = terms.map(t => ({ value:String(t.id), label: t.year_name ? `${t.name} · ${t.year_name}` : t.name }));

  return (
    <Card>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>✍️ Custom Remark for a Specific Student</div>
      <div style={{ fontSize:11, color:C.textMuted, marginBottom:14 }}>
        A remark set here overrides the range-based auto remark on that student's report card for the selected term.
      </div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
        <Sel label="Class"   value={classId}   onChange={setClassId}   options={classOpts}   style={{ width:180 }}/>
        <Sel label="Student" value={studentId} onChange={setStudentId} options={studentOpts} style={{ width:220 }}/>
        <Sel label="Term"    value={termId}    onChange={setTermId}    options={termOpts}    style={{ width:190 }}/>
      </div>
      {classId && !allowed && (
        <div style={{ padding:"9px 12px", borderRadius:8, background:C.amberLight, color:"#92400E", fontSize:12, marginBottom:12 }}>
          🔒 Only an administrator or this class's class teacher can edit remarks for this class.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[["Class Teacher's Remark", teacher, setTeacher],["Head Teacher's Remark", head, setHead]].map(([lbl, val, setter]) => (
          <div key={lbl} style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.textMid, letterSpacing:".4px", textTransform:"uppercase" }}>{lbl}</label>
            <textarea value={val} onChange={e => setter(e.target.value)} disabled={!allowed || !studentId}
              placeholder={studentId ? "Type a custom remark…" : "Select a student first"}
              style={{ padding:"9px 12px", borderRadius:8, border:`1px solid ${C.border}`, fontSize:13, minHeight:80, resize:"vertical", outline:"none", fontFamily:"Sora,sans-serif", lineHeight:1.6, color:C.text, background: (!allowed || !studentId) ? "#F8FAFC" : C.surface }}/>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:14 }}>
        <Btn variant="primary" onClick={save} disabled={!allowed || !studentId || saving}>{saving ? "Saving…" : "💾 Save Custom Remark"}</Btn>
      </div>
    </Card>
  );
};

// Feature 2 — score bands, either school-wide or scoped to a specific class.
const RemarkRangesManager = ({ classes, canManage, flash }) => {
  const [scope,   setScope]   = useState("");    // "" = school-wide default; else class id
  const [ranges,  setRanges]  = useState([]);    // [{id?, remark_type, min_score, max_score, remark}]
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [busy,    setBusy]    = useState(false);

  const allowed = canManage(scope);

  const load = () => {
    setLoading(true); setError(null);
    getRemarkRanges(scope ? { class_id: scope } : {})
      .then(res => setRanges(arrOf(res).map(r => ({
        id:r.id, remark_type:r.remark_type,
        min_score:String(r.min_score), max_score:String(r.max_score), remark:r.remark || "",
      }))))
      .catch(err => setError(err?.message || "Failed to load remark ranges."))
      .finally(() => setLoading(false));
  };
  useEffect(load, [scope]);   // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (idx, k, v) => setRanges(p => p.map((r,i) => i===idx ? { ...r, [k]:v } : r));
  const addRow = type => setRanges(p => [...p, { remark_type:type, min_score:"", max_score:"", remark:"" }]);
  // Append the recommended bands for a type as editable (unsaved) rows.
  const addRecommended = type => setRanges(p => [
    ...p,
    ...(RECOMMENDED_BANDS[type] || []).map(b => ({ remark_type:type, min_score:b.min, max_score:b.max, remark:b.remark })),
  ]);

  const save = async (idx) => {
    const r = ranges[idx];
    const min = parseFloat(r.min_score), max = parseFloat(r.max_score);
    if (Number.isNaN(min) || Number.isNaN(max)) { flash("Enter numeric min and max scores."); return; }
    if (max < min) { flash("Max score must be ≥ min score."); return; }
    if (!r.remark.trim()) { flash("Enter the remark text."); return; }
    setBusy(true);
    try {
      const payload = { remark_type:r.remark_type, min_score:min, max_score:max, remark:r.remark.trim() };
      if (r.id) await updateRemarkRange(r.id, payload);
      else      await createRemarkRange({ ...payload, class_id: scope || null });
      flash("Remark range saved.");
      load();
    } catch (err) { flash(err?.message || "Save failed."); }
    finally { setBusy(false); }
  };

  const remove = async (idx) => {
    const r = ranges[idx];
    if (!r.id) { setRanges(p => p.filter((_,i) => i!==idx)); return; }
    setBusy(true);
    try { await deleteRemarkRange(r.id); flash("Remark range deleted."); load(); }
    catch (err) { flash(err?.message || "Delete failed."); }
    finally { setBusy(false); }
  };

  const scopeOpts = [{ value:"", label:"🏫 School-wide default" }, ...classes.map(c => ({ value:String(c.id), label:`📕 ${c.name}` }))];
  const scopeName = scope ? (classes.find(c => String(c.id) === String(scope))?.name || "class") : "school-wide default";

  return (
    <Card>
      <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap", marginBottom:12 }}>
        <Sel label="Score-band scope" value={scope} onChange={setScope} options={scopeOpts} style={{ width:240 }}/>
        <div style={{ fontSize:11, color:C.textMuted, paddingBottom:8 }}>
          {scope ? "Class bands override the school-wide default on report cards." : "Applies to every class unless a class has its own bands."}
        </div>
      </div>
      <div style={{ padding:"10px 14px", borderRadius:9, background:C.accentLight, fontSize:12, color:C.accentDark, marginBottom:14 }}>
        ℹ️ Define score bands (by overall %) for the <strong>{scopeName}</strong>. On a report card the matching band is filled automatically; a custom student remark or a teacher's typed comment overrides it.
      </div>
      {!allowed && (
        <div style={{ padding:"9px 12px", borderRadius:8, background:C.amberLight, color:"#92400E", fontSize:12, marginBottom:12 }}>
          🔒 Read-only — only an administrator{scope ? " or this class's class teacher" : ""} can modify these bands.
        </div>
      )}
      {loading ? (
        <div style={{ padding:"30px", textAlign:"center", fontSize:12, color:C.textMuted }}>Loading remark ranges…</div>
      ) : error ? (
        <div style={{ padding:"20px", textAlign:"center" }}><div style={{ fontSize:13, fontWeight:600, color:C.coral, marginBottom:8 }}>{error}</div><Btn size="sm" variant="secondary" onClick={load}>Retry</Btn></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {REMARK_TYPES.map(({ key, label }) => {
            const rows = ranges.map((r,i) => ({ r, i })).filter(x => x.r.remark_type === key);
            return (
              <div key={key}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:8, flexWrap:"wrap" }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>{label}</div>
                  {allowed && (
                    <div style={{ display:"flex", gap:6 }}>
                      {!scope && rows.length === 0 && <Btn size="sm" variant="secondary" onClick={() => addRecommended(key)} disabled={busy}>✨ Load recommended</Btn>}
                      <Btn size="sm" variant="secondary" onClick={() => addRow(key)} disabled={busy}>+ Add Range</Btn>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                  <div style={{ display:"grid", gridTemplateColumns:`90px 90px 1fr${allowed ? " auto auto" : ""}`, gap:9, fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".4px", padding:"0 2px" }}>
                    <span>Min %</span><span>Max %</span><span>Remark</span>{allowed && <><span/><span/></>}
                  </div>
                  {rows.length === 0 && <div style={{ fontSize:12, color:C.textMuted, padding:"6px 2px" }}>No ranges for this scope yet.{allowed ? (scope ? " Add one to auto-fill this remark." : " Add one, or load the recommended set above.") : ""}</div>}
                  {rows.map(({ r, i }, ri) => {
                    const rec = scope ? null : (RECOMMENDED_BANDS[key] || [])[ri];   // recommended placeholder (school-wide only)
                    return (
                    <div key={r.id ?? `local-${i}`} style={{ display:"grid", gridTemplateColumns:`90px 90px 1fr${allowed ? " auto auto" : ""}`, gap:9, alignItems:"center" }}>
                      <input type="number" value={r.min_score} disabled={!allowed} onChange={e => upd(i,"min_score",e.target.value)} placeholder={rec ? rec.min : "0"}
                        style={{ padding:"7px 9px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:13, outline:"none", textAlign:"center", background: allowed ? C.surface : "#F8FAFC", color:C.text }}/>
                      <input type="number" value={r.max_score} disabled={!allowed} onChange={e => upd(i,"max_score",e.target.value)} placeholder={rec ? rec.max : "100"}
                        style={{ padding:"7px 9px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:13, outline:"none", textAlign:"center", background: allowed ? C.surface : "#F8FAFC", color:C.text }}/>
                      <input value={r.remark} disabled={!allowed} onChange={e => upd(i,"remark",e.target.value)} placeholder={rec ? rec.remark : "Remark shown on the report card…"}
                        style={{ padding:"7px 10px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:13, outline:"none", background: allowed ? C.surface : "#F8FAFC", color:C.text }}/>
                      {allowed && <Btn size="sm" variant="primary" onClick={() => save(i)} disabled={busy}>Save</Btn>}
                      {allowed && <Btn size="sm" variant="ghost" onClick={() => remove(i)} disabled={busy}>🗑</Btn>}
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

const Grades = () => {
  const [tab,           setTab]           = useState("scores");
  const [caTypes,       setCaTypes]       = useState(DEFAULT_CA);   // CA Settings modal (local config)
  const [showCAConfig,  setShowCAConfig]  = useState(false);
  const [toast,         setToast]         = useState("");
  const [saving,        setSaving]        = useState(false);

  // ── Reference data ──
  const [studentList,   setStudentList]   = useState([]);   // all students (report-card / cumulative pickers)
  const [termList,      setTermList]      = useState([]);
  const [classList,     setClassList]     = useState([]);
  const [subjectList,   setSubjectList]   = useState([]);

  // ── Data-entry selectors (scores / behaviour / comments) ──
  const [entClass,      setEntClass]      = useState("");
  const [entSubject,    setEntSubject]    = useState("");
  const [entTerm,       setEntTerm]       = useState("");
  const [classStudents, setClassStudents] = useState([]);
  const [caRows,        setCaRows]        = useState([]);    // CA components from backend
  const [scores,        setScores]        = useState({});    // `${studentId}:${caTypeId}` -> score
  const [psycho,        setPsycho]        = useState({});    // `${studentId}:${trait}` -> rating
  const [affective,     setAffective]     = useState({});    // `${studentId}:${trait}` -> rating
  const [comments,      setComments]      = useState({});    // studentId -> { teacher, principal }
  const [entLoading,    setEntLoading]    = useState(false);

  // ── Report-card / cumulative ──
  const [rcStudent,     setRcStudent]     = useState("");   // cumulative tab still picks a student
  const [rcTerm,        setRcTerm]        = useState("");
  const [rcError,       setRcError]       = useState(null);
  // Report-card tab: pick a class → roster table → print single / bulk.
  const [rcClassId,     setRcClassId]     = useState("");
  const [rcRoster,      setRcRoster]      = useState([]);
  const [rcRosterLoading,setRcRosterLoading] = useState(false);
  const [rcSelected,    setRcSelected]    = useState(() => new Set());
  const [sheets,        setSheets]        = useState([]);   // report data queued for printing
  const [rcBusy,        setRcBusy]        = useState(false);
  const [pendingPrint,  setPendingPrint]  = useState(false);
  const [cumTermIds,    setCumTermIds]    = useState([]);
  const [cum,           setCum]           = useState(null);
  const [cumLoading,    setCumLoading]    = useState(false);

  const flash = msg => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  // Load reference data once.
  useEffect(() => {
    let cancelled = false;
    getStudents({ per_page: 100 }).then(res => {
      if (cancelled) return;
      const norm = arrOf(res, "students").map(normStudent);
      setStudentList(norm);
      if (norm[0]) setRcStudent(String(norm[0].id));
    }).catch(() => {});
    getTerms().then(res => {
      if (cancelled) return;
      const list = arrOf(res);
      setTermList(list);
      if (list.length) { const last = String(list[list.length - 1].id); setRcTerm(last); setEntTerm(last); }
      setCumTermIds(list.map(t => t.id));
    }).catch(() => {});
    getClasses().then(res => { if (!cancelled) { const l = arrOf(res); setClassList(l); if (l[0]) setEntClass(String(l[0].id)); } }).catch(() => {});
    getSubjects().then(res => { if (!cancelled) { const l = arrOf(res); setSubjectList(l); if (l[0]) setEntSubject(String(l[0].id)); } }).catch(() => {});
    getCaTypes().then(res => { if (!cancelled) setCaRows(arrOf(res)); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Class roster when the class changes.
  useEffect(() => {
    if (!entClass) return;
    let cancelled = false;
    setEntLoading(true);
    getStudents({ class_id: entClass, per_page: 100 })
      .then(res => { if (!cancelled) setClassStudents(arrOf(res, "students").map(normStudent)); })
      .catch(() => { if (!cancelled) setClassStudents([]); })
      .finally(() => { if (!cancelled) setEntLoading(false); });
    return () => { cancelled = true; };
  }, [entClass]);

  // Behaviour + comments depend on class + term.
  useEffect(() => {
    if (!entClass || !entTerm) return;
    let cancelled = false;
    getBehaviour({ class_id: entClass, term_id: entTerm }).then(res => {
      if (cancelled) return;
      const ps = {}, af = {};
      arrOf(res).forEach(r => { (r.domain === "affective" ? af : ps)[`${r.student_id}:${r.trait}`] = r.rating || ""; });
      setPsycho(ps); setAffective(af);
    }).catch(() => {});
    getComments({ class_id: entClass, term_id: entTerm }).then(res => {
      if (cancelled) return;
      const cm = {};
      arrOf(res).forEach(r => { cm[r.student_id] = { teacher: r.teacher_comment || "", principal: r.principal_comment || "" }; });
      setComments(cm);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [entClass, entTerm]);

  // Scores depend on class + subject + term.
  useEffect(() => {
    if (!entClass || !entSubject || !entTerm) return;
    let cancelled = false;
    getGrades({ class_id: entClass, subject_id: entSubject, term_id: entTerm }).then(res => {
      if (cancelled) return;
      const sc = {};
      arrOf(res).forEach(r => { sc[`${r.student_id}:${r.ca_type_id}`] = r.score; });
      setScores(sc);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [entClass, entSubject, entTerm]);

  // Report-card tab: load the roster of the selected class.
  useEffect(() => {
    if (tab !== "reportcard" || !rcClassId) return;
    let cancelled = false;
    setRcRosterLoading(true); setRcError(null); setRcSelected(new Set());
    getStudents({ class_id: rcClassId, per_page: 200 })
      .then(res => { if (!cancelled) setRcRoster(arrOf(res, "students").map(normStudent)); })
      .catch(() => { if (!cancelled) setRcRoster([]); })
      .finally(() => { if (!cancelled) setRcRosterLoading(false); });
    return () => { cancelled = true; };
  }, [tab, rcClassId]);

  // Print once the queued sheets have rendered into the DOM.
  useEffect(() => {
    if (pendingPrint && sheets.length) { printSheet(); setPendingPrint(false); }
  }, [pendingPrint, sheets]);

  // Fetch the cumulative report when student/terms change.
  useEffect(() => {
    if (tab !== "cumulative" || !rcStudent || cumTermIds.length === 0) return;
    let cancelled = false;
    setCumLoading(true);
    getCumulative(rcStudent, cumTermIds.join(","))
      .then(res => { if (!cancelled) setCum(res?.data ?? null); })
      .catch(() => { if (!cancelled) setCum(null); })
      .finally(() => { if (!cancelled) setCumLoading(false); });
    return () => { cancelled = true; };
  }, [tab, rcStudent, cumTermIds]);

  const enabledCA  = caTypes.filter(c => c.enabled);   // for CA Settings modal only
  const caTotal    = enabledCA.reduce((a, c) => a + c.max, 0);
  const caTotalMax = caRows.reduce((a, c) => a + Number(c.max_score || 0), 0) || 100;
  const rowTotal   = sid => caRows.reduce((a, c) => a + (Number(scores[`${sid}:${c.id}`]) || 0), 0);

  // ── Report-card roster selection + printing ──
  const rcAllSelected = rcRoster.length > 0 && rcRoster.every(s => rcSelected.has(s.id));
  const toggleAllRc = () => setRcSelected(rcAllSelected ? new Set() : new Set(rcRoster.map(s => s.id)));
  const toggleOneRc = id => setRcSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Fetch report data for the given student ids, then trigger printing.
  const gatherAndPrint = async (ids) => {
    if (!rcTerm)  { setRcError("Please select a term first."); return; }
    if (!ids.length) return;
    setRcBusy(true); setRcError(null);
    try {
      const out = [];
      for (const id of ids) {
        const res = await getReportCard(id, rcTerm);
        if (res?.data) out.push(res.data);
      }
      if (!out.length) { setRcError("No report data found for the selected student(s)."); return; }
      setSheets(out);
      setPendingPrint(true);
    } catch (e) {
      setRcError(e?.message || "Failed to load report card(s).");
    } finally { setRcBusy(false); }
  };
  const printOneSheet = id => gatherAndPrint([id]);
  const printSelectedSheets = () => gatherAndPrint(rcRoster.filter(s => rcSelected.has(s.id)).map(s => s.id));

  // ── Save handlers ──
  const saveScores = async () => {
    const grades = [];
    classStudents.forEach(s => caRows.forEach(c => {
      const v = scores[`${s.id}:${c.id}`];
      if (v !== "" && v != null) grades.push({ student_id: s.id, subject_id: Number(entSubject), term_id: Number(entTerm), ca_type_id: c.id, score: Number(v) });
    }));
    await submitGrades(grades);
    const cm = classStudents
      .filter(s => comments[s.id] && (comments[s.id].teacher || comments[s.id].principal))
      .map(s => ({ student_id: s.id, term_id: Number(entTerm), teacher_comment: comments[s.id].teacher, principal_comment: comments[s.id].principal }));
    if (cm.length) await saveComments(cm);
    flash(`Saved ${grades.length} score(s)${cm.length ? ` & ${cm.length} comment(s)` : ""}.`);
  };
  const saveTraits = async domain => {
    const map = domain === "affective" ? affective : psycho;
    const traits = domain === "affective" ? AFFECTIVE : PSYCHOMOTOR;
    const records = [];
    classStudents.forEach(s => traits.forEach(t => {
      const key = `${s.id}:${t}`;
      if (map[key] !== undefined) records.push({ student_id: s.id, term_id: Number(entTerm), trait: t, rating: map[key], domain });
    }));
    await saveBehaviour(records);
    flash(`Saved ${records.length} ${domain} record(s).`);
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === "scores")            await saveScores();
      else if (tab === "psychomotor")  await saveTraits("psychomotor");
      else if (tab === "affective")    await saveTraits("affective");
    } catch (e) { flash("Save failed: " + (e?.message || "error")); }
    finally { setSaving(false); }
  };
  const isEntryTab = tab === "scores" || tab === "psychomotor" || tab === "affective";

  return (
    <div className="fi">
      <div className="no-print" style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <Tabs tabs={[{id:"scores",label:"📊 Scores"},{id:"psychomotor",label:"🏃 Psychomotor"},{id:"affective",label:"💙 Affective"},{id:"attendance",label:"🗓 Attendance"},{id:"cumulative",label:"📈 Cumulative"},{id:"reportcard",label:"🖨 Report Card"},{id:"remarks",label:"⚙️ Remark Settings"}]} active={tab} onChange={setTab}/>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          {tab==="scores" && <Btn variant="secondary" size="sm" onClick={() => setShowCAConfig(true)}>⚙️ CA Settings</Btn>}
          {isEntryTab && <Btn variant="primary" size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "💾 Save"}</Btn>}
        </div>
      </div>

      {/* ── SCORES ── */}
      {tab==="scores" && (
        <div>
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            <Sel label="Class"   value={entClass}   onChange={setEntClass}   options={classList.map(c=>({value:String(c.id),label:c.name}))}   style={{ width:160 }}/>
            <Sel label="Subject" value={entSubject} onChange={setEntSubject} options={subjectList.map(s=>({value:String(s.id),label:s.name}))} style={{ width:200 }}/>
            <Sel label="Term"    value={entTerm}    onChange={setEntTerm}    options={termList.map(t=>({value:String(t.id),label:t.year_name?`${t.name} · ${t.year_name}`:t.name}))} style={{ width:170 }}/>
          </div>
          <Card style={{ padding:0, overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:680 }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                  <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Student</th>
                  {caRows.map(c => (
                    <th key={c.id} style={{ padding:"10px 9px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>
                      {c.label}<br/><span style={{ fontWeight:400, fontSize:9 }}>/{c.max_score}</span>
                    </th>
                  ))}
                  <th style={{ padding:"10px 9px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Total<br/><span style={{ fontWeight:400, fontSize:9 }}>/{caTotalMax}</span></th>
                  <th style={{ padding:"10px 9px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {entLoading ? (
                  <tr><td colSpan={caRows.length+3} style={{ padding:"22px", textAlign:"center", fontSize:12, color:C.textMuted }}>Loading…</td></tr>
                ) : classStudents.length === 0 ? (
                  <tr><td colSpan={caRows.length+3} style={{ padding:"22px", textAlign:"center", fontSize:12, color:C.textMuted }}>No students in this class.</td></tr>
                ) : classStudents.map(s => {
                  const total = rowTotal(s.id);
                  const g = gradeLabel(total);
                  return (
                    <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"9px 14px" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><Avatar initials={s.avatar} size={24} color={C.accent}/><span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span></div></td>
                      {caRows.map(c => (
                        <td key={c.id} style={{ padding:"7px 7px", textAlign:"center" }}>
                          <input type="number" min={0} max={c.max_score} value={scores[`${s.id}:${c.id}`] ?? ""}
                            onChange={e => setScores(p => ({ ...p, [`${s.id}:${c.id}`]: e.target.value }))}
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
          {classStudents.length > 0 && (
          <Card style={{ marginTop:14 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>💬 Class Teacher & Principal Comments</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {classStudents.map(s => (
                <div key={s.id} style={{ padding:"12px 14px", borderRadius:10, border:`1px solid ${C.border}`, background:"#F8FAFC" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <Avatar initials={s.avatar} size={22} color={C.accent}/>
                    <span style={{ fontSize:12, fontWeight:700 }}>{s.name}</span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {[["Class Teacher's Comment","teacher","e.g. A brilliant student who needs to improve time management…"],["Principal / Head Teacher's Comment","principal","e.g. Keep up the excellent work. We expect great results next term…"]].map(([lbl,key,ph]) => (
                      <div key={key}>
                        <label style={{ fontSize:10, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".4px", display:"block", marginBottom:4 }}>{lbl}</label>
                        <textarea value={comments[s.id]?.[key] || ""} onChange={e => setComments(p => ({ ...p, [s.id]: { ...(p[s.id]||{}), [key]: e.target.value } }))}
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
          )}
        </div>
      )}

      {/* ── PSYCHOMOTOR ── */}
      {tab==="psychomotor" && (
        <div>
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            <Sel label="Class" value={entClass} onChange={setEntClass} options={classList.map(c=>({value:String(c.id),label:c.name}))} style={{ width:160 }}/>
            <Sel label="Term"  value={entTerm}  onChange={setEntTerm}  options={termList.map(t=>({value:String(t.id),label:t.year_name?`${t.name} · ${t.year_name}`:t.name}))} style={{ width:170 }}/>
          </div>
          <Card style={{ padding:0, overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:820 }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                  <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", minWidth:160 }}>Student</th>
                  {PSYCHOMOTOR.map(t => <th key={t} style={{ padding:"10px 8px", textAlign:"center", fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", maxWidth:88 }}>{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {classStudents.length === 0 ? (
                  <tr><td colSpan={PSYCHOMOTOR.length+1} style={{ padding:"22px", textAlign:"center", fontSize:12, color:C.textMuted }}>{entLoading ? "Loading…" : "No students in this class."}</td></tr>
                ) : classStudents.map(s => (
                  <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"8px 14px" }}><div style={{ display:"flex", alignItems:"center", gap:7 }}><Avatar initials={s.avatar} size={22} color={C.accent}/><span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span></div></td>
                    {PSYCHOMOTOR.map(t => (
                      <td key={t} style={{ padding:"6px 6px", textAlign:"center" }}>
                        <TraitSel value={psycho[`${s.id}:${t}`]} onChange={v => setPsycho(p => ({ ...p, [`${s.id}:${t}`]: v }))}/>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── AFFECTIVE ── */}
      {tab==="affective" && (
        <div>
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            <Sel label="Class" value={entClass} onChange={setEntClass} options={classList.map(c=>({value:String(c.id),label:c.name}))} style={{ width:160 }}/>
            <Sel label="Term"  value={entTerm}  onChange={setEntTerm}  options={termList.map(t=>({value:String(t.id),label:t.year_name?`${t.name} · ${t.year_name}`:t.name}))} style={{ width:170 }}/>
          </div>
          <Card style={{ padding:0, overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                  <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", minWidth:160 }}>Student</th>
                  {AFFECTIVE.map(t => <th key={t} style={{ padding:"10px 8px", textAlign:"center", fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", maxWidth:90 }}>{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {classStudents.length === 0 ? (
                  <tr><td colSpan={AFFECTIVE.length+1} style={{ padding:"22px", textAlign:"center", fontSize:12, color:C.textMuted }}>{entLoading ? "Loading…" : "No students in this class."}</td></tr>
                ) : classStudents.map(s => (
                  <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"8px 14px" }}><div style={{ display:"flex", alignItems:"center", gap:7 }}><Avatar initials={s.avatar} size={22} color={C.accent}/><span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span></div></td>
                    {AFFECTIVE.map(t => (
                      <td key={t} style={{ padding:"6px 6px", textAlign:"center" }}>
                        <TraitSel value={affective[`${s.id}:${t}`]} onChange={v => setAffective(p => ({ ...p, [`${s.id}:${t}`]: v }))}/>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── CUMULATIVE ── */}
      {tab==="cumulative" && (
        <div>
          <div className="no-print" style={{ display:"flex", gap:10, marginBottom:14, alignItems:"flex-end", flexWrap:"wrap" }}>
            <Sel label="Student" value={rcStudent} onChange={setRcStudent} options={studentList.map(s=>({value:String(s.id),label:s.name}))} style={{ width:220 }}/>
            <Btn variant="secondary" size="sm" onClick={printSheet}>🖨 Print / Save PDF</Btn>
          </div>
          <Card className="no-print" style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>📈 Select Terms to Combine</div>
            <div style={{ display:"flex", gap:18, alignItems:"center", flexWrap:"wrap" }}>
              {termList.length===0 ? <span style={{fontSize:12,color:C.textMuted}}>No terms available.</span> : termList.map(t => (
                <Toggle key={t.id} value={cumTermIds.includes(t.id)}
                  onChange={v => setCumTermIds(p => v ? [...p, t.id] : p.filter(x=>x!==t.id))}
                  label={t.year_name ? `${t.name} · ${t.year_name}` : t.name}/>
              ))}
              <span style={{ marginLeft:"auto", fontSize:12, color:C.textMid }}>
                Combining <strong>{cumTermIds.length}</strong> term(s)
              </span>
            </div>
          </Card>
          {cumLoading ? (
            <Card><div style={{padding:"24px 0",textAlign:"center",fontSize:12,color:C.textMuted}}>Loading cumulative…</div></Card>
          ) : !cum || !cum.subjects?.length ? (
            <Card><div style={{padding:"24px 0",textAlign:"center",fontSize:12,color:C.textMuted}}>No cumulative data for the selected terms.</div></Card>
          ) : (
          <Card className="print-area" style={{ padding:0 }}>
            <div style={{ padding:"14px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>{cum.student?.name}</div>
                <div style={{ fontSize:11, color:C.textMuted }}>{cum.student?.sid} · {cum.student?.class_name}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:11, color:C.textMuted }}>Cumulative Average</div>
                <div style={{ fontSize:18, fontWeight:800, color:C.accentDark }}>{cum.overall?.average}% <Badge color={letterColor(cum.overall?.grade)} size="sm">{cum.overall?.grade}</Badge></div>
                <div style={{ fontSize:11, color:C.textMid }}>Position {ordinal(cum.overall?.position)} of {cum.overall?.class_size}</div>
              </div>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                  <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Subject</th>
                  {cum.terms?.map(t => <th key={t.id} style={{ padding:"10px 10px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>{t.name}</th>)}
                  <th style={{ padding:"10px 10px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Average</th>
                  <th style={{ padding:"10px 10px", textAlign:"center", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {cum.subjects.map(s => (
                  <tr key={s.subject} style={{ borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600 }}>{s.subject}</td>
                    {cum.terms?.map(t => <td key={t.id} style={{ padding:"9px 10px", textAlign:"center", fontSize:12 }}>{s.per_term?.[t.id] ?? "—"}</td>)}
                    <td style={{ padding:"9px 10px", textAlign:"center", fontSize:13, fontWeight:700, color:s.average>=60?C.accentDark:s.average>=40?C.amber:C.coral }}>{s.average}</td>
                    <td style={{ padding:"9px 10px", textAlign:"center" }}><Badge color={letterColor(s.grade)} size="sm">{s.grade}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          )}
        </div>
      )}

      {/* ── REPORT CARD ── pick a class, then print single/bulk from the roster */}
      {tab==="reportcard" && (
        <div>
          <div className="no-print" style={{ display:"flex", gap:10, marginBottom:14, alignItems:"flex-end", flexWrap:"wrap" }}>
            <Sel label="Class" value={rcClassId} onChange={setRcClassId} options={[{value:"",label:"Select class…"}, ...classList.map(c=>({value:String(c.id),label:c.name}))]} style={{ width:200 }}/>
            <Sel label="Term"  value={rcTerm}    onChange={setRcTerm}    options={termList.map(t=>({value:String(t.id),label:t.year_name?`${t.name} · ${t.year_name}`:t.name}))} style={{ width:200 }}/>
            <Btn variant="primary" size="sm" onClick={printSelectedSheets} disabled={rcBusy || rcSelected.size===0}>
              {rcBusy ? "Preparing…" : `🖨 Download Selected (${rcSelected.size})`}
            </Btn>
          </div>

          <Card className="no-print" style={{ padding:0 }}>
            {!rcClassId ? (
              <div style={{ padding:"32px 0", textAlign:"center", fontSize:12, color:C.textMuted }}>Select a class to list its students.</div>
            ) : rcRosterLoading ? (
              <div style={{ padding:"32px 0", textAlign:"center", fontSize:12, color:C.textMuted }}>Loading students…</div>
            ) : rcRoster.length===0 ? (
              <div style={{ padding:"32px 0", textAlign:"center", fontSize:12, color:C.textMuted }}>No students in this class.</div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:520 }}>
                  <thead>
                    <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                      <th style={{ padding:"10px 14px", width:44, textAlign:"center" }}>
                        <input type="checkbox" checked={rcAllSelected} onChange={toggleAllRc} style={{ width:15, height:15, cursor:"pointer" }} title="Select all"/>
                      </th>
                      {["Student","Student ID","Report Sheet"].map(h=><th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".5px" }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rcRoster.map((s,i)=>(
                      <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}`, background: rcSelected.has(s.id) ? C.accentLight : "transparent" }}>
                        <td style={{ padding:"9px 14px", textAlign:"center" }}>
                          <input type="checkbox" checked={rcSelected.has(s.id)} onChange={()=>toggleOneRc(s.id)} style={{ width:15, height:15, cursor:"pointer" }}/>
                        </td>
                        <td style={{ padding:"9px 14px" }}><div style={{ display:"flex", alignItems:"center", gap:9 }}><Avatar initials={s.avatar} size={26} color={[C.accent,C.sky,C.purple,C.amber,C.coral][i%5]}/><span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span></div></td>
                        <td style={{ padding:"9px 14px", fontSize:11, color:C.textMuted, fontFamily:"monospace" }}>{s.student_id||s.id}</td>
                        <td style={{ padding:"9px 14px" }}><Btn size="sm" variant="secondary" onClick={()=>printOneSheet(s.id)} disabled={rcBusy}>🖨 Print</Btn></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {rcError && <div className="no-print" style={{ marginTop:12, padding:"9px 12px", borderRadius:8, background:C.coralLight, color:C.coral, fontSize:12, fontWeight:600 }}>{rcError}</div>}

          {/* Printable sheets — hidden on screen, one per (selected) student when printing */}
          <div className="print-only">
            {sheets.map((data,i)=><ReportSheet key={i} rc={data}/>)}
          </div>
        </div>
      )}

      {tab==="attendance" && <AttendanceSummaryTab flash={flash}/>}

      {tab==="remarks" && <RemarkSettings flash={flash}/>}

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

      {toast && <div className="no-print" style={{ position:"fixed", bottom:26, right:26, zIndex:2000, background:C.navy, color:"#fff", padding:"11px 18px", borderRadius:11, fontSize:12, fontWeight:600, boxShadow:"0 8px 28px rgba(0,0,0,.2)", borderLeft:`4px solid ${C.accent}` }}>{toast}</div>}
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
              <th style={{ padding:"10px 12px", color:"#C8D8E8", fontSize:10, fontWeight:700, textTransform:"uppercase", width:140 }}>Period / Time</th>
              {DAYS.map(d => <th key={d} style={{ padding:"10px 12px", color:"#C8D8E8", fontSize:12, fontWeight:600 }}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, pi) => {
              const brk = isBreak(p.label);
              return (
                <tr key={p.id} style={{ borderBottom:`1px solid ${C.border}`, background:brk?"#F8FAFC":"transparent" }}>
                  <td style={{ padding:"7px 11px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.textMid, lineHeight:1.4 }}>{p.label}</div>
                  </td>
                  {DAYS.map((d, di) => {
                    const key  = `${di}-${pi}`;
                    const subj = grid[key] || "";
                    const isBreakCell = /break|lunch|assembly|free/i.test(subj);
                    return (
                      <td key={d} style={{ padding:"4px 5px" }}>
                        {isBreakCell ? (
                          <div style={{ padding:"7px 8px", borderRadius:7, background:"#F3F4F6", textAlign:"center", fontSize:11, color:C.textMid, fontStyle:"italic" }}>{subj}</div>
                        ) : (
                          <select value={subj} onChange={e => setGrid(g => ({ ...g, [key]:e.target.value }))}
                            style={{ width:"100%", padding:"6px 5px", borderRadius:7, border:"1.5px solid transparent", fontSize:11, fontWeight:600,
                              outline:"none", cursor:"pointer", color:C.text, background:SUBJ_COLORS[subj]||"#F8FAFC", transition:"border .15s" }}
                            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor="transparent"}>
                            {ALL_SUBJECTS.map(s => <option key={s} value={s} style={{ color:C.text, background:C.surface }}>{s}</option>)}
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
const EXAM_TYPES = [{value:"mid-term",label:"Mid-Term"},{value:"final",label:"Final Exam"},{value:"quiz",label:"Class Quiz"},{value:"ca",label:"C.A. Test"}];

const CBTCreate = ({ onNav }) => {
  const [tab,          setTab]          = useState("details");
  const [title,        setTitle]        = useState("");
  const [classId,      setClassId]      = useState("");
  const [subjectId,    setSubjectId]    = useState("");
  const [termId,       setTermId]       = useState("");
  const [examType,     setExamType]     = useState("mid-term");
  const [instructions, setInstructions] = useState("");
  const [duration,     setDuration]     = useState("60");
  const [questions,    setQuestions]    = useState([]);   // fresh, empty
  const [editingQ,     setEditingQ]     = useState(null);
  const [settings,     setSettings]     = useState({ shuffle_q:true, shuffle_opts:true, show_score:false, prevent_copy:true, one_at_a_time:false });
  const [startAt,      setStartAt]      = useState("");
  const [endAt,        setEndAt]        = useState("");

  const [classList,    setClassList]    = useState([]);
  const [subjectList,  setSubjectList]  = useState([]);
  const [termList,     setTermList]     = useState([]);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState("");

  const flash = msg => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  useEffect(() => {
    let cancelled = false;
    getClasses().then(res => { if (!cancelled) setClassList(arrOf(res)); }).catch(() => {});
    getSubjects().then(res => { if (!cancelled) setSubjectList(arrOf(res)); }).catch(() => {});
    getTerms().then(res => { if (!cancelled) { const l = arrOf(res); setTermList(l); if (l.length) setTermId(String(l[l.length-1].id)); } }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const totalMarks = questions.reduce((a,q) => a + (Number(q.marks)||0), 0);

  const addQ = type => {
    const nq = { id:Date.now(), type, marks:type==="mcq"?2:type==="short"?5:10, text:"", options:type==="mcq"?["","","",""]:[], answer:0 };
    setQuestions(p => [...p, nq]);
    setEditingQ(nq.id);
    setTab("questions");
  };

  const save = async status => {
    if (!title.trim())                     { flash("Enter an exam title."); setTab("details"); return; }
    if (!classId || !subjectId || !termId) { flash("Select class, subject and term."); setTab("details"); return; }
    setSaving(true);
    try {
      await createExam({
        class_id: Number(classId), subject_id: Number(subjectId), term_id: Number(termId),
        title: title.trim(), exam_type: examType, duration: Number(duration),
        total_marks: totalMarks, pass_mark: Math.round(totalMarks*0.5), status,
        shuffle_q: settings.shuffle_q?1:0, shuffle_opts: settings.shuffle_opts?1:0,
        questions: questions.map(q => ({
          type: q.type, question: q.text, options: q.options, marks: Number(q.marks)||0,
          answer: q.type==="mcq" ? String(q.answer) : "",
        })),
      });
      flash(status==="active" ? "Exam published!" : "Draft saved.");
      setTimeout(() => onNav("cbt"), 800);
    } catch (e) { flash("Save failed: " + (e?.message || "error")); }
    finally { setSaving(false); }
  };

  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <Btn onClick={() => onNav("cbt")} variant="secondary" size="sm">← Back</Btn>
        <div style={{ display:"flex", gap:9 }}>
          <Btn variant="secondary" onClick={() => save("draft")} disabled={saving}>💾 Draft</Btn>
          <Btn variant="navy" onClick={() => save("active")} disabled={saving}>{saving ? "Saving…" : "🚀 Publish"}</Btn>
        </div>
      </div>
      <Tabs tabs={[{id:"details",label:"Exam Details"},{id:"questions",label:`Questions (${questions.length})`},{id:"settings",label:"Settings"}]} active={tab} onChange={setTab}/>
      <div style={{ marginTop:16 }}>
        {tab==="details" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 310px", gap:16 }}>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Exam Information</div>
              <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                <Input label="Exam Title" value={title} onChange={setTitle} placeholder="e.g. Mathematics Mid-Term Exam"/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                  <Sel label="Class" value={classId} onChange={setClassId} options={[{value:"",label:"Select class…"},...classList.map(c=>({value:String(c.id),label:c.name}))]}/>
                  <Sel label="Subject" value={subjectId} onChange={setSubjectId} options={[{value:"",label:"Select subject…"},...subjectList.map(s=>({value:String(s.id),label:s.name}))]}/>
                  <Sel label="Term" value={termId} onChange={setTermId} options={[{value:"",label:"Select term…"},...termList.map(t=>({value:String(t.id),label:t.year_name?`${t.name} · ${t.year_name}`:t.name}))]}/>
                  <Sel label="Type" value={examType} onChange={setExamType} options={EXAM_TYPES}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".4px", display:"block", marginBottom:4 }}>Instructions</label>
                  <RichArea value={instructions} onChange={setInstructions} placeholder="e.g. Answer all questions carefully."/>
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
              {questions.length===0 && (
                <Card style={{ textAlign:"center", color:C.textMuted, fontSize:12 }}>No questions yet — add one below to get started.</Card>
              )}
              {questions.map((q,i) => (
                <Card key={q.id} style={{ borderLeft:`4px solid ${q.type==="mcq"?C.sky:q.type==="short"?C.accent:C.purple}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                    <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:C.textMuted }}>Q{i+1}</span>
                      <Badge color={q.type==="mcq"?"blue":q.type==="short"?"green":"purple"} size="sm">{q.type.toUpperCase()}</Badge>
                      <input type="number" min={1} value={q.marks} onChange={e=>setQuestions(p=>p.map(x=>x.id===q.id?{...x,marks:e.target.value}:x))}
                        style={{ width:46, padding:"3px 6px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:11, textAlign:"center", outline:"none" }}/>
                      <span style={{ fontSize:11, color:C.textMuted }}>marks</span>
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
                          <button onClick={() => setQuestions(p => p.map(x => x.id===q.id?{...x,answer:oi}:x))} title="Mark as correct answer"
                            style={{ width:24, height:24, borderRadius:"50%", border:`2px solid ${q.answer===oi?C.accent:C.border}`, background:q.answer===oi?C.accent:"transparent", cursor:"pointer", fontSize:10, fontWeight:700, color:q.answer===oi?"#fff":C.textMuted }}>
                            {["A","B","C","D"][oi]}
                          </button>
                          <input value={opt} placeholder={`Option ${["A","B","C","D"][oi]}`}
                            onChange={e => setQuestions(p => p.map(x => x.id===q.id?{...x,options:x.options.map((o,k)=>k===oi?e.target.value:o)}:x))}
                            style={{ flex:1, padding:"6px 10px", borderRadius:7, border:`1px solid ${q.answer===oi?C.accent:C.border}`, fontSize:12, outline:"none", color:C.text, background:C.surface }}
                            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>{if(q.answer!==oi)e.target.style.borderColor=C.border;}}/>
                        </div>
                      ))}
                      {q.type==="mcq" && <div style={{ fontSize:10, color:C.textMuted }}>Tap a letter to mark the correct option.</div>}
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
                    style={{ width:30, height:30, borderRadius:7, border:`1.5px solid ${editingQ===q.id?C.accent:C.border}`, background:editingQ===q.id?C.accentLight:C.surface, color:C.text, fontSize:11, fontWeight:700, cursor:"pointer" }}>{i+1}</button>
                ))}
              </div>
            </Card>
          </div>
        )}
        {tab==="settings" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:13 }}>Security & Display</div>
              {[["Shuffle question order","shuffle_q"],["Shuffle answer options","shuffle_opts"],["Show score after submission","show_score"],["Prevent copy/paste","prevent_copy"],["One question at a time","one_at_a_time"]].map(([label,key]) => (
                <div key={key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:12 }}>{label}</span>
                  <Toggle value={settings[key]} onChange={v => setSettings(p => ({ ...p, [key]: v }))}/>
                </div>
              ))}
            </Card>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:13 }}>Access Control</div>
              <Sel label="Assigned Class" value={classId} onChange={setClassId} options={[{value:"",label:"Select class…"},...classList.map(c=>({value:String(c.id),label:c.name}))]} style={{ marginBottom:12 }}/>
              <Input label="Start Date & Time" value={startAt} onChange={setStartAt} type="datetime-local" style={{ marginBottom:12 }}/>
              <Input label="End Date & Time"   value={endAt}   onChange={setEndAt}   type="datetime-local"/>
            </Card>
          </div>
        )}
      </div>
      {toast && <div className="no-print" style={{ position:"fixed", bottom:26, right:26, zIndex:2000, background:C.navy, color:"#fff", padding:"11px 18px", borderRadius:11, fontSize:12, fontWeight:600, boxShadow:"0 8px 28px rgba(0,0,0,.2)", borderLeft:`4px solid ${C.accent}` }}>{toast}</div>}
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
  const [exams,          setExams]         = useState([]);
  const [mapping,        setMapping]       = useState(false);
  const [toast,          setToast]         = useState(null);
  // Rubric builder
  const [rubType,        setRubType]       = useState("essay");
  const [rubMarks,       setRubMarks]      = useState("20");
  const [rubContent,     setRubContent]    = useState("");
  const [loadingRub,     setLoadingRub]    = useState(false);
  // Chat assistant
  const [chatMsgs,       setChatMsgs]      = useState([]);   // { role, content }
  const [chatInput,      setChatInput]     = useState("");
  const [chatBusy,       setChatBusy]      = useState(false);
  // Performance insights
  const [insClasses,     setInsClasses]    = useState([]);
  const [insTerms,       setInsTerms]      = useState([]);
  const [insStudents,    setInsStudents]   = useState([]);
  const [insClass,       setInsClass]      = useState("");
  const [insStudent,     setInsStudent]    = useState("");
  const [insTerm,        setInsTerm]       = useState("");
  const [insContent,     setInsContent]    = useState("");
  const [loadingIns,     setLoadingIns]    = useState(false);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const generateQuestions = useCallback(async () => {
    setLoading(true); setAiQuestions([]);
    try {
      const shape = qType==="mcq"
        ? '[{"type":"mcq","text":"?","options":["A","B","C","D"],"answer":0,"marks":2}]'
        : '[{"type":"'+qType+'","text":"?","model_answer":"expected","marks":5}]';
      const { content } = await aiChat({
        system:"You are an expert Nigerian secondary-school teacher and exam setter. You reply ONLY with valid JSON — no markdown fences, no preamble, no commentary.",
        prompt:`Generate ${qCount} ${qType==="mcq"?"multiple choice":qType==="short"?"short answer":qType==="essay"?"essay":"mixed"} question(s).\nSubject: ${subject}. Topic: ${topic}. Difficulty: ${difficulty}.${customQ?"\n\nAdditional instruction: "+customQ:""}\n\nLesson Notes:\n${notes}\n\nRespond ONLY with a JSON array in exactly this shape:\n${shape}`,
        temperature:0.6, max_tokens:2000,
      });
      const parsed = parseJsonLoose(content);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("The AI returned an unexpected format. Try again.");
      setAiQuestions(parsed);
    } catch (e) {
      showToast(e?.message || e?.data?.message || "Question generation failed. Check the AI configuration and try again.");
    }
    setLoading(false);
  }, [notes,qCount,qType,difficulty,subject,topic,customQ]);

  const generateLesson = useCallback(async () => {
    setLoadingLesson(true); setLessonContent("");
    try {
      const { content } = await aiChat({
        system:"You are an experienced Nigerian secondary-school teacher who writes clear, well-structured lesson notes using Markdown headings.",
        prompt:`Write a detailed lesson note for Nigerian secondary school students.\nSubject: ${subject}. Topic: ${topic}. Class: ${lessonClass}.${customL?"\n\nAdditional instruction: "+customL:""}\n\nInclude these sections with clear headings: Learning Objectives, Introduction, Main Content (with worked examples), Class Activities, Summary, and Assignment.`,
        temperature:0.7, max_tokens:3000,
      });
      if (!content?.trim()) throw new Error("The AI returned an empty response. Try again.");
      setLessonContent(content);
    } catch (e) {
      showToast(e?.message || e?.data?.message || "Lesson note generation failed. Check the AI configuration and try again.");
    }
    setLoadingLesson(false);
  }, [subject,topic,lessonClass,customL]);

  const generateRubric = useCallback(async () => {
    setLoadingRub(true); setRubContent("");
    try {
      const { content } = await aiChat({
        system:"You are an expert assessment designer for Nigerian secondary schools. Produce clear marking rubrics in Markdown: a table of weighted criteria with short descriptors for each performance band (Excellent / Good / Fair / Poor) and the marks per band, ending with the total.",
        prompt:`Create a detailed marking rubric.\nAssessment: ${subject} — ${topic || "General"}. Type: ${rubType}. Total marks: ${rubMarks}.\n\nBreak the total marks into weighted criteria and show how marks are awarded across the performance bands. Make sure the criteria marks add up to ${rubMarks}.`,
        temperature:0.6, max_tokens:2000,
      });
      if (!content?.trim()) throw new Error("The AI returned an empty response. Try again.");
      setRubContent(content);
    } catch (e) { showToast(e?.message || e?.data?.message || "Rubric generation failed."); }
    setLoadingRub(false);
  }, [subject, topic, rubType, rubMarks]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const next = [...chatMsgs, { role:"user", content:text }];
    setChatMsgs(next); setChatInput(""); setChatBusy(true);
    try {
      const { content } = await aiChat({
        system:"You are LearnersForge Assistant, a helpful assistant for teachers and administrators of a Nigerian secondary school. Help with teaching, lesson ideas, explaining concepts, drafting messages to parents, and school administration. Be concise, warm and practical.",
        messages: next.map(m => ({ role:m.role, content:m.content })),
        temperature:0.7, max_tokens:1500,
      });
      setChatMsgs(m => [...m, { role:"assistant", content: content || "…" }]);
    } catch (e) {
      setChatMsgs(m => [...m, { role:"assistant", content:"⚠️ " + (e?.message || e?.data?.message || "Request failed.") }]);
    }
    setChatBusy(false);
  }, [chatInput, chatBusy, chatMsgs]);

  // Insights: load class + term lists once, and the roster when a class is picked.
  useEffect(() => {
    getClasses().then(r => setInsClasses(arrOf(r))).catch(() => {});
    getTerms().then(r => { const l = arrOf(r); setInsTerms(l); if (l.length) setInsTerm(String(l[l.length-1].id)); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!insClass) { setInsStudents([]); setInsStudent(""); return; }
    getStudents({ class_id:insClass, per_page:100 }).then(r => setInsStudents(arrOf(r, "students").map(normStudent))).catch(() => setInsStudents([]));
  }, [insClass]);

  const generateInsights = useCallback(async () => {
    if (!insStudent || !insTerm) { showToast("Pick a class, student and term first."); return; }
    setLoadingIns(true); setInsContent("");
    try {
      const rc = await getReportCard(insStudent, Number(insTerm)).then(r => r?.data ?? r);
      const rows = (rc?.subjects || []).map(s => `${s.subject}: total ${s.total}/100, grade ${s.grade}, position ${s.position} (class high ${s.highest}, low ${s.lowest})`).join("\n");
      const stu  = insStudents.find(s => String(s.id) === String(insStudent));
      const { content } = await aiChat({
        system:"You are an experienced Nigerian secondary-school academic advisor. Analyse a student's results and give a concise, encouraging, actionable report for the teacher, using short Markdown sections: Overview, Strengths, Areas to Improve, and Recommended Actions.",
        prompt:`Student: ${stu?.name || rc?.student?.name || "Student"} — Class ${rc?.student?.class_name || stu?.class || ""}, ${rc?.term?.name || "this term"}.\n\nSubject results:\n${rows || "No subject scores available."}\n\nOverall: ${rc?.overall?.percentage ?? "n/a"}% (grade ${rc?.overall?.grade ?? "n/a"}), position ${rc?.overall?.position ?? "n/a"} of ${rc?.class_size ?? "n/a"}. Class highest ${rc?.overall?.class_highest ?? "n/a"}%, class lowest ${rc?.overall?.class_lowest ?? "n/a"}%.\n\nWrite the analysis.`,
        temperature:0.6, max_tokens:1600,
      });
      if (!content?.trim()) throw new Error("The AI returned an empty response.");
      setInsContent(content);
    } catch (e) { showToast(e?.message || e?.data?.message || "Insights generation failed."); }
    setLoadingIns(false);
  }, [insStudent, insTerm, insStudents]);

  // Load the real exam list when the map modal opens.
  const openMapModal = () => {
    setMapModal(true);
    getExams().then(r => setExams(arrOf(r))).catch(() => setExams([]));
  };

  const handleMapToExam = async () => {
    if (!mapExam || mapping) return;
    // Map the AI question shape onto the exam_questions shape the backend expects.
    const payload = aiQuestions.map(q => {
      const isMcq = Array.isArray(q.options) && q.options.length > 0;
      return {
        type: isMcq ? "mcq" : (["short","essay","tf","fill"].includes(q.type) ? q.type : "short"),
        question: q.text || q.question || "",
        options: isMcq ? q.options : undefined,
        answer: isMcq ? (q.options[q.answer] ?? q.answer ?? "") : (q.model_answer ?? q.answer ?? ""),
        marks: Number(q.marks) || 2,
      };
    });
    setMapping(true);
    try {
      await addExamQuestions(mapExam, payload);
      const title = exams.find(e => String(e.id) === String(mapExam))?.title || "the exam";
      showToast(`✅ ${payload.length} question(s) added to "${title}".`);
      setMapModal(false);
    } catch (e) {
      showToast(e?.message || e?.data?.message || "Could not add questions to the exam.");
    }
    setMapping(false);
  };

  // ── Exports ──
  const exportQuestions = mode => {
    if (!aiQuestions.length) return;
    const body =
      `<h1>${escHtml(subject)} — ${escHtml(topic || "Questions")}</h1>` +
      aiQuestions.map((q,i) => {
        const opts = Array.isArray(q.options)
          ? q.options.map((o,oi) => `<div class="opt">${["A","B","C","D","E"][oi] || oi+1}. ${escHtml(o)}</div>`).join("")
          : "";
        return `<div class="q"><strong>Q${i+1}.</strong> ${escHtml(q.text || q.question || "")} <span class="mk">(${q.marks || 2} mk)</span>${opts}</div>`;
      }).join("") +
      `<hr/><h2>Answer Key</h2>` +
      aiQuestions.map((q,i) => {
        const ans = Array.isArray(q.options) ? (["A","B","C","D","E"][q.answer] ?? q.answer) : (q.model_answer ?? q.answer ?? "—");
        return `<div class="q"><strong>Q${i+1}.</strong> ${escHtml(ans)}</div>`;
      }).join("");
    const fname = `${subject}-${topic || "questions"}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    if (mode === "word") downloadDoc(fname, `${subject} — ${topic}`, body);
    else if (!printDocPdf(`${subject} — ${topic}`, body)) showToast("Allow pop-ups for this site to export as PDF.");
  };

  const exportLesson = mode => {
    if (!lessonContent) return;
    const body = mdToHtml(lessonContent);
    const fname = `lesson-${subject}-${topic || "note"}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    if (mode === "word") downloadDoc(fname, `${topic} — ${subject}`, body);
    else if (!printDocPdf(`${topic} — ${subject}`, body)) showToast("Allow pop-ups for this site to export as PDF.");
  };

  return (
    <div className="fi">
      {toast && (
        <div style={{ position:"fixed", bottom:26, right:26, zIndex:2000, background:C.navy, color:"#fff", padding:"11px 18px", borderRadius:11, fontSize:12, fontWeight:600, boxShadow:"0 8px 28px rgba(0,0,0,.2)", borderLeft:`4px solid ${C.accent}` }}>{toast}</div>
      )}
      <div style={{ display:"flex", gap:12, alignItems:"center", padding:"13px 18px", background:"linear-gradient(135deg,#0D1B2A 0%,#1A2E45 100%)", borderRadius:12, marginBottom:18, border:`1px solid ${C.accent}30` }}>
        <div style={{ width:42, height:42, borderRadius:11, background:C.accent+"22", border:`2px solid ${C.accent}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🤖</div>
        <div><div style={{ color:"#fff", fontSize:15, fontWeight:700 }}>AI Teaching Assistant</div><div style={{ color:"#8DA4C0", fontSize:11, marginTop:2 }}>Questions, lesson notes, rubrics, insights & chat — powered by z.ai (GLM)</div></div>
        <div style={{ marginLeft:"auto" }}><Badge color="green">AI Powered</Badge></div>
      </div>
      <Tabs tabs={[{id:"qgen",label:"📝 Question Generator"},{id:"lesson",label:"📖 Lesson Note Creator"},{id:"rubric",label:"📋 Rubric Builder"},{id:"insights",label:"📊 Performance Insights"},{id:"chat",label:"💬 Assistant"}]} active={tab} onChange={setTab}/>

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
                    <Btn size="sm" variant="secondary" onClick={() => exportQuestions("pdf")}>📥 PDF</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => exportQuestions("word")}>📄 Word</Btn>
                    <Btn size="sm" variant="primary" onClick={openMapModal}>📌 Map to Exam</Btn>
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
                    <Btn variant="secondary" style={{ justifyContent:"center" }} onClick={() => exportLesson("pdf")}>📥 Download as PDF</Btn>
                    <Btn variant="secondary" style={{ justifyContent:"center" }} onClick={() => exportLesson("word")}>📄 Export to Word</Btn>
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

        {/* ── RUBRIC BUILDER ── */}
        {tab==="rubric" && (
          <div style={{ display:"grid", gridTemplateColumns:"310px 1fr", gap:16 }}>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Rubric Details</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <Sel label="Subject" value={subject} onChange={setSubject} options={SUBJECTS.map(s=>({value:s,label:s}))}/>
                <Input label="Assessment / Topic" value={topic} onChange={setTopic} placeholder="e.g. Essay on Deforestation"/>
                <Sel label="Assessment Type" value={rubType} onChange={setRubType} options={[{value:"essay",label:"Essay"},{value:"practical",label:"Practical"},{value:"project",label:"Project"},{value:"oral",label:"Oral / Presentation"},{value:"lab-report",label:"Lab Report"}]}/>
                <Sel label="Total Marks" value={rubMarks} onChange={setRubMarks} options={["10","20","30","40","50","100"].map(n=>({value:n,label:n+" marks"}))}/>
                <Btn onClick={generateRubric} disabled={loadingRub||!topic.trim()} variant="primary" style={{ justifyContent:"center" }}>
                  {loadingRub ? "⟳ Building…" : "🤖 Generate Rubric"}
                </Btn>
              </div>
            </Card>
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:13 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>Generated Rubric</div>
                {rubContent && <Badge color="green">AI Generated</Badge>}
              </div>
              {loadingRub && <div style={{ textAlign:"center", padding:"40px 16px", color:C.textMid, fontSize:12 }}><div style={{ fontSize:22, marginBottom:6 }}>🤖</div>Building marking scheme…</div>}
              {!loadingRub && !rubContent && <div style={{ textAlign:"center", padding:"60px 16px", color:C.textMuted }}><div style={{ fontSize:34, marginBottom:10 }}>📋</div><div style={{ fontSize:13 }}>Fill in the details and click Generate</div></div>}
              {!loadingRub && rubContent && <div style={{ padding:"13px 16px", background:"#F8FAFC", borderRadius:9, minHeight:300, fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap", overflow:"auto", maxHeight:540 }}>{rubContent}</div>}
            </Card>
          </div>
        )}

        {/* ── PERFORMANCE INSIGHTS ── */}
        {tab==="insights" && (
          <div style={{ display:"grid", gridTemplateColumns:"310px 1fr", gap:16 }}>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Analyse a Student</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <Sel label="Class" value={insClass} onChange={setInsClass} options={[{value:"",label:"— Select class —"}, ...insClasses.map(c=>({value:String(c.id),label:c.name}))]}/>
                <Sel label="Student" value={insStudent} onChange={setInsStudent} options={[{value:"",label: insClass ? "— Select student —" : "Pick a class first"}, ...insStudents.map(s=>({value:String(s.id),label:s.name}))]}/>
                <Sel label="Term" value={insTerm} onChange={setInsTerm} options={insTerms.map(t=>({value:String(t.id),label:t.year_name?`${t.name} · ${t.year_name}`:t.name}))}/>
                <Btn onClick={generateInsights} disabled={loadingIns||!insStudent||!insTerm} variant="primary" style={{ justifyContent:"center" }}>
                  {loadingIns ? "⟳ Analysing…" : "🤖 Generate Insights"}
                </Btn>
                <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5 }}>Analyses the student's term results — strengths, weak subjects and suggested next steps for the teacher.</div>
              </div>
            </Card>
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:13 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>Performance Analysis</div>
                {insContent && <Badge color="green">AI Generated</Badge>}
              </div>
              {loadingIns && <div style={{ textAlign:"center", padding:"40px 16px", color:C.textMid, fontSize:12 }}><div style={{ fontSize:22, marginBottom:6 }}>📊</div>Reading the results…</div>}
              {!loadingIns && !insContent && <div style={{ textAlign:"center", padding:"60px 16px", color:C.textMuted }}><div style={{ fontSize:34, marginBottom:10 }}>📊</div><div style={{ fontSize:13 }}>Select a student and click Generate</div></div>}
              {!loadingIns && insContent && <div style={{ padding:"13px 16px", background:"#F8FAFC", borderRadius:9, minHeight:300, fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap", overflow:"auto", maxHeight:540 }}>{insContent}</div>}
            </Card>
          </div>
        )}

        {/* ── CHAT ASSISTANT ── */}
        {tab==="chat" && (
          <Card style={{ display:"flex", flexDirection:"column", height:"60vh", minHeight:420, padding:0 }}>
            <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:12 }}>
              {chatMsgs.length===0 && (
                <div style={{ textAlign:"center", margin:"auto", color:C.textMuted, maxWidth:380 }}>
                  <div style={{ fontSize:34, marginBottom:10 }}>💬</div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.textMid, marginBottom:6 }}>Ask the assistant anything</div>
                  <div style={{ fontSize:12, lineHeight:1.6 }}>Lesson ideas, explain a concept for a class, draft a message to parents, plan an activity…</div>
                </div>
              )}
              {chatMsgs.map((m,i) => (
                <div key={i} style={{ alignSelf: m.role==="user"?"flex-end":"flex-start", maxWidth:"78%",
                  background: m.role==="user"?C.accent:"#F1F5F9", color: m.role==="user"?"#fff":C.text,
                  padding:"9px 13px", borderRadius:12, fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{m.content}</div>
              ))}
              {chatBusy && <div style={{ alignSelf:"flex-start", background:"#F1F5F9", color:C.textMuted, padding:"9px 13px", borderRadius:12, fontSize:13 }}>⟳ Thinking…</div>}
            </div>
            <div style={{ borderTop:`1px solid ${C.border}`, padding:"12px 14px", display:"flex", gap:9, alignItems:"flex-end" }}>
              <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); } }}
                placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
                rows={1} style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1px solid ${C.border}`, fontSize:13, resize:"none", maxHeight:120, outline:"none", fontFamily:"Sora,sans-serif", lineHeight:1.5, color:C.text }}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
              <Btn variant="primary" onClick={sendChat} disabled={chatBusy||!chatInput.trim()}>Send</Btn>
              {chatMsgs.length>0 && <Btn variant="secondary" onClick={()=>setChatMsgs([])}>Clear</Btn>}
            </div>
          </Card>
        )}
      </div>

      {/* Map to Exam Modal */}
      {mapModal && (
        <Modal title="📌 Map Questions to Exam" onClose={() => setMapModal(false)} width={430}>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <div style={{ padding:"10px 13px", borderRadius:9, background:C.accentLight, fontSize:12, color:C.accentDark, fontWeight:600 }}>{aiQuestions.length} generated question(s) will be added to the selected exam.</div>
            {exams.length === 0 ? (
              <div style={{ padding:"9px 13px", borderRadius:9, background:"#F8FAFC", fontSize:12, color:C.textMid }}>
                No exams found. Create an exam first under <strong>Exams</strong>, then map questions to it.
              </div>
            ) : (
              <Sel label="Select Exam" value={mapExam} onChange={setMapExam}
                options={[{value:"",label:"— Choose exam —"}, ...exams.map(e=>({value:String(e.id),label:`${e.title}${e.class_name?` (${e.class_name})`:""}`}))]}/>
            )}
            <div style={{ display:"flex", gap:9, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={() => setMapModal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleMapToExam} disabled={!mapExam || mapping}>{mapping ? "Adding…" : "✅ Add to Exam"}</Btn>
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
      {toast && <div className="no-print" style={{ position:"fixed", bottom:26, right:26, zIndex:2000, background:C.navy, color:"#fff", padding:"11px 18px", borderRadius:11, fontSize:12, fontWeight:600, boxShadow:"0 8px 28px rgba(0,0,0,.2)", borderLeft:`4px solid ${C.accent}` }}>{toast}</div>}
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

// Controlled editor for a teacher's assignments — class-teacher-of (form teacher,
// grants remarks + psychomotor/affective) and teaching pairs (grants grade entry).
const AssignmentFields = ({ classes, subjects, classTeacherOf, setClassTeacherOf, teaching, setTeaching }) => {
  const [tClass, setTClass] = useState("");
  const [tSubs,  setTSubs]  = useState(() => new Set());
  const key = (c,s) => `${c}:${s}`;
  const className = id => classes.find(c => c.id === id)?.name || `#${id}`;
  const subjName  = id => subjects.find(s => s.id === id)?.name || `#${id}`;

  const toggleCT  = id => setClassTeacherOf(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleSub = id => setTSubs(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const addTeaching = () => {
    const cid = Number(tClass);
    if (!cid || tSubs.size === 0) return;
    setTeaching(p => {
      const have = new Set(p.map(t => key(t.class_id, t.subject_id)));
      const add = [...tSubs].filter(s => !have.has(key(cid, s))).map(s => ({ class_id:cid, subject_id:s }));
      return [...p, ...add];
    });
    setTSubs(new Set());
  };
  const removeTeaching = (c,s) => setTeaching(p => p.filter(t => !(t.class_id===c && t.subject_id===s)));

  // Group teaching pairs by class for display.
  const byClass = {};
  teaching.forEach(t => { (byClass[t.class_id] = byClass[t.class_id] || []).push(t.subject_id); });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Class teacher of */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:C.textMid, letterSpacing:".4px", textTransform:"uppercase", marginBottom:7 }}>Class teacher of</div>
        <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Grants report-card remarks and psychomotor/affective traits for these classes. A class has one class teacher.</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
          {classes.length===0 && <span style={{ fontSize:12, color:C.textMuted }}>No classes found.</span>}
          {classes.map(c => {
            const on = classTeacherOf.has(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggleCT(c.id)}
                style={{ padding:"5px 11px", borderRadius:99, fontSize:12, fontWeight:600, cursor:"pointer",
                  border:`1px solid ${on?C.accent:C.border}`, background:on?C.accent:C.surface, color:on?"#fff":C.textMid }}>
                {on ? "✓ " : ""}{c.name}
              </button>
            );
          })}
        </div>
      </div>
      {/* Teaching assignments */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:C.textMid, letterSpacing:".4px", textTransform:"uppercase", marginBottom:7 }}>Teaches (subjects in classes)</div>
        <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Grants score/result entry for students in these classes for the chosen subjects.</div>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:9, background:"#F8FAFC" }}>
          <Sel label="Class" value={tClass} onChange={setTClass}
               options={[{value:"",label:"Select class…"}, ...classes.map(c=>({value:String(c.id),label:c.name}))]} style={{ width:170 }}/>
          <div style={{ flex:1, minWidth:220 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.textMid, letterSpacing:".4px", textTransform:"uppercase", marginBottom:5 }}>Subjects</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {subjects.map(s => {
                const on = tSubs.has(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleSub(s.id)} disabled={!tClass}
                    style={{ padding:"4px 10px", borderRadius:99, fontSize:11, fontWeight:600, cursor:tClass?"pointer":"not-allowed", opacity:tClass?1:.5,
                      border:`1px solid ${on?C.sky:C.border}`, background:on?C.sky:C.surface, color:on?"#fff":C.textMid }}>
                    {on ? "✓ " : ""}{s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Btn size="sm" variant="secondary" onClick={addTeaching} disabled={!tClass || tSubs.size===0}>+ Add</Btn>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:10 }}>
          {Object.keys(byClass).length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No teaching assignments yet.</div>}
          {Object.entries(byClass).map(([cid, subs]) => (
            <div key={cid} style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:8 }}>
              <span style={{ fontSize:12, fontWeight:700, minWidth:90 }}>{className(Number(cid))}</span>
              {subs.map(sid => (
                <span key={sid} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:99, background:C.skyLight||"#E0F2FE", color:C.sky, fontSize:11, fontWeight:600 }}>
                  {subjName(sid)}
                  <button type="button" onClick={() => removeTeaching(Number(cid), sid)} style={{ border:"none", background:"none", cursor:"pointer", color:C.sky, fontSize:13, lineHeight:1 }}>×</button>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AddStaffModal = ({ classes, subjects, onClose, onSaved }) => {
  const empty = { first_name:"", last_name:"", email:"", phone:"", gender:"", department:"", designation:"" };
  const [form,setForm]=useState(empty);
  const [classTeacherOf,setClassTeacherOf]=useState(()=>new Set());
  const [teaching,setTeaching]=useState([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);
  const set=k=>v=>setForm(p=>({...p,[k]:v}));

  const submit=async()=>{
    if(!form.first_name.trim()||!form.last_name.trim()){ setError("First and last name are required."); return; }
    if(!form.email.trim()){ setError("Email is required."); return; }
    setSaving(true); setError(null);
    try{
      await createStaff({ ...form, class_teacher_of:[...classTeacherOf], teaching });
      onSaved();
    }catch(err){ setError(err?.message || err?.data?.error || "Failed to create staff."); setSaving(false); }
  };

  return (
    <Modal title="Add Staff" onClose={saving?()=>{}:onClose} width={680}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
        <Input label="First Name"  value={form.first_name}  onChange={set("first_name")}  placeholder="e.g. Grace"/>
        <Input label="Last Name"   value={form.last_name}   onChange={set("last_name")}   placeholder="e.g. Bello"/>
        <Input label="Email"       value={form.email}       onChange={set("email")}       placeholder="teacher@school.edu" type="email"/>
        <Input label="Phone"       value={form.phone}       onChange={set("phone")}       placeholder="+234 …"/>
        <Sel   label="Gender"      value={form.gender}      onChange={set("gender")}      options={[{value:"",label:"Select…"},{value:"male",label:"Male"},{value:"female",label:"Female"}]}/>
        <Input label="Department"  value={form.department}  onChange={set("department")}  placeholder="e.g. Sciences"/>
        <Input label="Designation" value={form.designation} onChange={set("designation")} placeholder="e.g. Senior Teacher" style={{gridColumn:"1 / -1"}}/>
      </div>
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14}}>
        <AssignmentFields classes={classes} subjects={subjects}
          classTeacherOf={classTeacherOf} setClassTeacherOf={setClassTeacherOf}
          teaching={teaching} setTeaching={setTeaching}/>
      </div>
      {error && <div style={{marginTop:14,padding:"9px 12px",borderRadius:8,background:C.coralLight||"#FEE2E2",color:C.coral,fontSize:12,fontWeight:600}}>{error}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
        <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving?"Saving…":"Create Staff"}</Btn>
      </div>
    </Modal>
  );
};

const AssignStaffModal = ({ staff, classes, subjects, onClose, onSaved }) => {
  const [classTeacherOf,setClassTeacherOf]=useState(()=>new Set());
  const [teaching,setTeaching]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);

  useEffect(()=>{
    let cancelled=false;
    getStaffAssignments(staff.id)
      .then(res=>{ if(cancelled) return; const d=res?.data ?? res ?? {};
        setClassTeacherOf(new Set((d.class_teacher_of||[]).map(Number)));
        setTeaching((d.teaching||[]).map(t=>({class_id:Number(t.class_id),subject_id:Number(t.subject_id)})));
      })
      .catch(err=>{ if(!cancelled) setError(err?.message || "Failed to load assignments."); })
      .finally(()=>{ if(!cancelled) setLoading(false); });
    return ()=>{ cancelled=true; };
  },[staff.id]);

  const submit=async()=>{
    setSaving(true); setError(null);
    try{ await saveStaffAssignments(staff.id, { class_teacher_of:[...classTeacherOf], teaching }); onSaved(); }
    catch(err){ setError(err?.message || err?.data?.error || "Failed to save assignments."); setSaving(false); }
  };

  return (
    <Modal title={`Assignments · ${staff.name}`} onClose={saving?()=>{}:onClose} width={680}>
      {loading ? (
        <div style={{padding:"30px",textAlign:"center",fontSize:12,color:C.textMuted}}>Loading assignments…</div>
      ) : (
        <>
          <AssignmentFields classes={classes} subjects={subjects}
            classTeacherOf={classTeacherOf} setClassTeacherOf={setClassTeacherOf}
            teaching={teaching} setTeaching={setTeaching}/>
          {error && <div style={{marginTop:14,padding:"9px 12px",borderRadius:8,background:C.coralLight||"#FEE2E2",color:C.coral,fontSize:12,fontWeight:600}}>{error}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
            <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
            <Btn variant="primary" onClick={submit} disabled={saving}>{saving?"Saving…":"💾 Save Assignments"}</Btn>
          </div>
        </>
      )}
    </Modal>
  );
};

const Staff = () => {
  const [staff,setStaff]=useState([]);
  const [classes,setClasses]=useState([]);
  const [subjects,setSubjects]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [search,setSearch]=useState("");
  const [reloadKey,setReloadKey]=useState(0);
  const [showAdd,setShowAdd]=useState(false);
  const [assignFor,setAssignFor]=useState(null);
  const [del,setDel]=useState(null);          // staff pending delete
  const [deleting,setDeleting]=useState(false);
  const [toast,setToast]=useState("");
  const flash=msg=>{ setToast(msg); setTimeout(()=>setToast(""),2600); };

  const confirmDelete=async()=>{
    if(!del) return;
    setDeleting(true);
    try{ await deleteStaff(del.id); flash("Staff deleted."); setDel(null); setReloadKey(k=>k+1); }
    catch(err){ flash(err?.message || "Delete failed."); }
    finally{ setDeleting(false); }
  };

  useEffect(()=>{
    getClasses().then(r=>setClasses(arrOf(r).map(c=>({...c,id:Number(c.id)})))).catch(()=>{});
    getSubjects().then(r=>setSubjects(arrOf(r).map(s=>({...s,id:Number(s.id)})))).catch(()=>{});
  },[]);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true); setError(null);
    getStaff()
      .then(res=>{ if(cancelled) return;
        const list=arrOf(res).map(s=>({ ...s, id:Number(s.id),
          name:[s.first_name,s.last_name].filter(Boolean).join(" ").trim() || s.email || "Staff" }));
        setStaff(list);
      })
      .catch(err=>{ if(!cancelled) setError(err?.message || "Failed to load staff."); })
      .finally(()=>{ if(!cancelled) setLoading(false); });
    return ()=>{ cancelled=true; };
  },[reloadKey]);

  const filtered=staff.filter(s=>s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, gap:10 }}>
        <Input value={search} onChange={setSearch} placeholder="🔍 Search staff…" style={{ width:240 }}/>
        <Btn variant="primary" onClick={()=>setShowAdd(true)}>+ Add Staff</Btn>
      </div>
      {showAdd && <AddStaffModal classes={classes} subjects={subjects}
        onClose={()=>setShowAdd(false)} onSaved={()=>{ setShowAdd(false); flash("Staff created."); setReloadKey(k=>k+1); }}/>}
      {assignFor && <AssignStaffModal staff={assignFor} classes={classes} subjects={subjects}
        onClose={()=>setAssignFor(null)} onSaved={()=>{ setAssignFor(null); flash("Assignments saved."); }}/>}
      {del && (
        <Modal title="Delete staff?" onClose={deleting?()=>{}:()=>setDel(null)} width={440}>
          <div style={{fontSize:13,color:C.textMid,lineHeight:1.6}}>
            You're about to delete <strong>{del.name}</strong>. They will be removed from active staff, and their class‑teacher and subject‑teaching assignments will be released. This cannot be undone from here.
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <Btn variant="secondary" onClick={()=>setDel(null)} disabled={deleting}>Cancel</Btn>
            <Btn variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting?"Deleting…":"Delete staff"}</Btn>
          </div>
        </Modal>
      )}
      {toast && <div style={{position:"fixed",bottom:26,right:26,zIndex:2000,background:C.navy,color:"#fff",padding:"11px 18px",borderRadius:11,fontSize:12,fontWeight:600,boxShadow:"0 8px 28px rgba(0,0,0,.2)",borderLeft:`4px solid ${C.accent}`}}>{toast}</div>}
      {loading ? (
        <Card><div style={{padding:"50px",textAlign:"center",fontSize:12,color:C.textMuted}}>Loading staff…</div></Card>
      ) : error ? (
        <Card><div style={{padding:"30px",textAlign:"center"}}><div style={{fontSize:13,fontWeight:600,color:C.coral,marginBottom:8}}>{error}</div><Btn size="sm" variant="secondary" onClick={()=>setReloadKey(k=>k+1)}>Retry</Btn></div></Card>
      ) : filtered.length===0 ? (
        <Card><div style={{padding:"40px",textAlign:"center",fontSize:12,color:C.textMuted}}>{search?"No staff match your search.":"No staff yet. Add one to get started."}</div></Card>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
          {filtered.map((s,i) => (
            <Card key={s.id} style={{ display:"flex", gap:12, alignItems:"center" }}>
              <Avatar initials={s.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()} size={44} color={[C.sky,C.purple,C.accent,C.amber][i%4]}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{s.name}</div>
                <div style={{ fontSize:11, color:C.textMuted }}>{[s.designation,s.department].filter(Boolean).join(" · ")||s.staff_id}</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <Btn size="sm" variant="secondary" onClick={()=>setAssignFor(s)}>Assign</Btn>
                <Btn size="sm" variant="danger" onClick={()=>setDel(s)}>Delete</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Downscale an uploaded image to a max dimension and return a compact data URL,
// so the school logo stays small enough to store and renders crisply on the PDF.
const fileToLogoDataUrl = (file, max = 260) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Could not read the image file."));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error("That file is not a valid image."));
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      // PNG preserves transparency for typical crest/logo art.
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const Settings = () => {
  const empty = { name:"", code:"", address:"", phone:"", email:"", motto:"", term_system:"term", logo_url:"" };
  const [form,    setForm]    = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);
  const set = k => v => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    getSchoolSettings()
      .then(res => { if (!cancelled) setForm({ ...empty, ...(res?.data ?? {}) }); })
      .catch(() => { if (!cancelled) setError("Could not load school settings."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickLogo = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";               // allow re-selecting the same file later
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Logo image must be under 5MB."); return; }
    try { const logo_url = await fileToLogoDataUrl(file); setForm(p => ({ ...p, logo_url })); setError(null); }
    catch (err) { setError(err.message || "Could not process the image."); }
  };

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await updateSchoolSettings(form);
      setForm({ ...empty, ...(res?.data ?? form) });
      window.dispatchEvent(new Event('lf-school-updated'));   // refresh sidebar/topbar name + logo
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.message || err?.data?.error || "Failed to save settings.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:16 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
        {[["🏫","School"],["👤","Profile"],["🔔","Notifications"],["🔒","Security"],["💳","Billing"]].map(([ic,l],i) => (
          <button key={l} style={{ padding:"9px 12px", borderRadius:8, border:"none", background:i===0?C.accentLight:"transparent", color:i===0?C.accentDark:C.textMid, textAlign:"left", fontSize:12, fontWeight:i===0?600:400, cursor:"pointer", display:"flex", alignItems:"center", gap:7 }}><span>{ic}</span>{l}</button>
        ))}
      </div>
      <Card>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:16 }}>School Information</div>

        {/* School logo — shown at the top of report-card / result PDFs */}
        <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:18, padding:"14px", border:`1px solid ${C.border}`, borderRadius:10, background:"#F8FAFC" }}>
          <div style={{ width:74, height:74, borderRadius:12, border:`1px dashed ${C.border}`, background:C.surface, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
            {form.logo_url ? <img src={form.logo_url} alt="School logo" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }}/> : <span style={{ fontSize:26 }}>🏫</span>}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textMid }}>School Logo</div>
            <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>PNG or JPG · appears at the top of every report card / result PDF.</div>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <label style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 13px", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, fontSize:12, fontWeight:600, cursor:"pointer", color:C.text }}>
                ⬆️ {form.logo_url ? "Replace" : "Upload"} Logo
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickLogo} style={{ display:"none" }}/>
              </label>
              {form.logo_url && <Btn size="sm" variant="ghost" onClick={() => set("logo_url")("")}>Remove</Btn>}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:13 }}>
          <Input label="School Name"    value={form.name}    onChange={set("name")}    placeholder="e.g. Greenfield Academy"/>
          <Input label="School Code"    value={form.code}    onChange={set("code")}    placeholder="e.g. GFA-001"/>
          <Input label="Address"        value={form.address} onChange={set("address")} placeholder="Street, city" style={{ gridColumn:"1 / -1" }}/>
          <Input label="Phone"          value={form.phone}   onChange={set("phone")}   placeholder="+234 …"/>
          <Input label="Email"          value={form.email}   onChange={set("email")}   placeholder="admin@school.edu.ng" type="email"/>
          <Input label="Motto"          value={form.motto}   onChange={set("motto")}   placeholder="School motto (shown on results)" style={{ gridColumn:"1 / -1" }}/>
          <Sel   label="Academic System" value={form.term_system} onChange={set("term_system")} options={[{value:"term",label:"3-Term System"},{value:"semester",label:"2-Semester System"}]}/>
        </div>

        {error && <div style={{ marginTop:14, padding:"9px 12px", borderRadius:8, background:C.coralLight, color:C.coral, fontSize:12, fontWeight:600 }}>{error}</div>}
        <div style={{ marginTop:16, display:"flex", gap:10, alignItems:"center" }}>
          <Btn onClick={save} variant="primary" disabled={loading || saving}>{saving ? "Saving…" : "💾 Save Changes"}</Btn>
          {loading && <span style={{ fontSize:12, color:C.textMuted }}>Loading…</span>}
          {saved && <span style={{ fontSize:12, color:C.accentDark, fontWeight:600 }}>✅ Saved!</span>}
        </div>
      </Card>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════════
// NEW MODULES FROM PROPOSAL GAP ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

const StudentExtras = () => {
  const [tab, setTab] = useState("docs");
  const [incidentModal, setIncidentModal] = useState(false);
  const [promoteModal, setPromoteModal] = useState(false);
  const [incident, setIncident] = useState({ student:"", type:"", description:"", action:"", date:"" });

  const docs = [
    { name:"Birth Certificate",    student:"Amara Okonkwo",  uploaded:"2026-01-10", size:"1.2MB", status:"Verified" },
    { name:"Passport Photograph",  student:"Amara Okonkwo",  uploaded:"2026-01-10", size:"340KB", status:"Verified" },
    { name:"Previous School Result",student:"Kofi Mensah",   uploaded:"2026-02-05", size:"2.1MB", status:"Pending"  },
    { name:"Medical Certificate",  student:"Fatima Al-Hassan",uploaded:"2026-01-20",size:"890KB", status:"Verified" },
  ];
  const incidents = [
    { id:"INC001", student:"David Nwachukwu", type:"Misconduct",    date:"2026-05-10", action:"Warning issued",    status:"Resolved" },
    { id:"INC002", student:"Kofi Mensah",     type:"Late Coming",   date:"2026-05-14", action:"Parent notified",   status:"Open"     },
    { id:"INC003", student:"Amara Okonkwo",   type:"Dress Code",    date:"2026-04-28", action:"Counselling",       status:"Resolved" },
  ];

  return (
    <div className="fi">
      <Tabs tabs={[{id:"docs",label:"📄 Documents"},{id:"discipline",label:"⚠️ Disciplinary Records"},{id:"promote",label:"🎓 Promotion & Transfer"}]} active={tab} onChange={setTab}/>
      <div style={{marginTop:16}}>

        {/* ── DOCUMENTS ── */}
        {tab==="docs" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginBottom:14}}>
              <Btn variant="primary" size="sm">📎 Upload Document</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
              {docs.map((d,i)=>(
                <Card key={i} style={{display:"flex",gap:13,alignItems:"center"}}>
                  <div style={{width:44,height:44,borderRadius:10,background:C.skyLight,border:`1px solid ${C.sky}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📄</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{d.name}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{d.student} · {d.size} · {d.uploaded}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                    <Badge color={d.status==="Verified"?"green":"amber"} size="sm">{d.status}</Badge>
                    <div style={{display:"flex",gap:5}}>
                      <Btn size="sm" variant="ghost">👁</Btn>
                      <Btn size="sm" variant="ghost">⬇️</Btn>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {/* Upload area */}
            <div style={{marginTop:14,border:`2px dashed ${C.border}`,borderRadius:12,padding:"28px",textAlign:"center",background:"#F8FAFC"}}>
              <div style={{fontSize:28,marginBottom:8}}>📁</div>
              <div style={{fontSize:13,fontWeight:600,color:C.textMid}}>Drag & drop files here or click to browse</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>Supports PDF, JPG, PNG, DOC — Max 10MB per file</div>
              <Btn variant="secondary" size="sm" style={{marginTop:12}}>Browse Files</Btn>
            </div>
          </div>
        )}

        {/* ── DISCIPLINARY ── */}
        {tab==="discipline" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{display:"flex",gap:12}}>
                <StatCard label="Total Incidents" value={incidents.length} color={C.amber} icon="⚠️"/>
                <StatCard label="Open Cases"      value={incidents.filter(i=>i.status==="Open").length} color={C.coral} icon="🔴"/>
                <StatCard label="Resolved"        value={incidents.filter(i=>i.status==="Resolved").length} color={C.accent} icon="✅"/>
              </div>
              <Btn variant="primary" onClick={()=>setIncidentModal(true)}>+ Log Incident</Btn>
            </div>
            <Card style={{padding:0}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["ID","Student","Incident Type","Date","Action Taken","Status"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {incidents.map(inc=>(
                    <tr key={inc.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"10px 14px",fontSize:11,color:C.textMuted,fontFamily:"monospace"}}>{inc.id}</td>
                      <td style={{padding:"10px 14px",fontSize:13,fontWeight:600}}>{inc.student}</td>
                      <td style={{padding:"10px 14px"}}><Badge color={inc.type==="Misconduct"?"red":inc.type==="Late Coming"?"amber":"orange"} size="sm">{inc.type}</Badge></td>
                      <td style={{padding:"10px 14px",fontSize:12,color:C.textMuted}}>{inc.date}</td>
                      <td style={{padding:"10px 14px",fontSize:12,color:C.textMid}}>{inc.action}</td>
                      <td style={{padding:"10px 14px"}}><Badge color={inc.status==="Resolved"?"green":"amber"} size="sm">{inc.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ── PROMOTION & TRANSFER ── */}
        {tab==="promote" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:13,color:C.textMid}}>Promote or transfer students at end of term/year</div>
              <div style={{display:"flex",gap:9}}>
                <Btn variant="secondary">↗ Transfer Student</Btn>
                <Btn variant="primary" onClick={()=>setPromoteModal(true)}>🎓 Bulk Promote</Btn>
              </div>
            </div>
            <Card style={{padding:0}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["Student","Current Class","Target Class","Average Score","Eligible","Action"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {STUDENTS.map((s,i)=>{
                    const avg=58+i*7; const eligible=avg>=50;
                    const currentIdx=CLASSES.indexOf(s.class);
                    const nextClass=currentIdx>=0&&currentIdx<CLASSES.length-1?CLASSES[currentIdx+1]:"Final Year";
                    return(
                      <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar initials={s.avatar} size={26} color={C.accent}/><span style={{fontSize:12,fontWeight:600}}>{s.name}</span></div></td>
                        <td style={{padding:"10px 14px",fontSize:12}}>{s.class}</td>
                        <td style={{padding:"10px 14px",fontSize:12,color:C.textMid}}>{nextClass}</td>
                        <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:eligible?C.accentDark:C.coral}}>{avg}%</td>
                        <td style={{padding:"10px 14px"}}><Badge color={eligible?"green":"red"} size="sm">{eligible?"Yes":"No"}</Badge></td>
                        <td style={{padding:"10px 14px"}}><div style={{display:"flex",gap:6}}><Btn size="sm" variant={eligible?"primary":"secondary"} disabled={!eligible}>Promote</Btn><Btn size="sm" variant="ghost">Transfer</Btn></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>

      {incidentModal&&<Modal title="Log Disciplinary Incident" onClose={()=>setIncidentModal(false)} width={500}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Sel label="Student" value={incident.student} onChange={v=>setIncident(p=>({...p,student:v}))} options={[{value:"",label:"Select student"},...STUDENTS.map(s=>({value:s.id,label:s.name}))]}/>
          <Sel label="Incident Type" value={incident.type} onChange={v=>setIncident(p=>({...p,type:v}))} options={["","Misconduct","Late Coming","Dress Code Violation","Fighting","Truancy","Exam Malpractice","Other"].map(t=>({value:t,label:t||"Select type"}))}/>
          <Input label="Date" value={incident.date} onChange={v=>setIncident(p=>({...p,date:v}))} type="date"/>
          <div><label style={{fontSize:11,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:4}}>Description</label><textarea value={incident.description} onChange={e=>setIncident(p=>({...p,description:e.target.value}))} placeholder="Describe the incident in detail…" style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,minHeight:80,resize:"none",outline:"none",fontFamily:"Sora,sans-serif"}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/></div>
          <Input label="Action Taken" value={incident.action} onChange={v=>setIncident(p=>({...p,action:v}))} placeholder="e.g. Warning issued, Parent notified, Suspension…"/>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setIncidentModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>setIncidentModal(false)}>💾 Save Incident</Btn></div>
        </div>
      </Modal>}

      {promoteModal&&<Modal title="🎓 Bulk Class Promotion" onClose={()=>setPromoteModal(false)} width={480}>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div style={{padding:"11px 14px",borderRadius:10,background:C.amberLight,fontSize:12,color:"#92400E",fontWeight:600}}>⚠️ This will promote ALL eligible students in the selected class to the next class.</div>
          <Sel label="From Class" value="JSS 2A" onChange={()=>{}} options={CLASSES.map(c=>({value:c,label:c}))}/>
          <Sel label="To Class"   value="JSS 3A" onChange={()=>{}} options={CLASSES.map(c=>({value:c,label:c}))}/>
          <Input label="Minimum Average Score for Promotion (%)" value="50" onChange={()=>{}} type="number"/>
          <div style={{padding:"11px 14px",borderRadius:10,background:C.accentLight,fontSize:12,color:C.accentDark}}>✅ <strong>3 students</strong> eligible for promotion · <strong>1 student</strong> will be held back</div>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setPromoteModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>setPromoteModal(false)}>🎓 Confirm Promotion</Btn></div>
        </div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ONLINE ADMISSION & ENROLLMENT
// ═══════════════════════════════════════════════════════════════════════════════
const Admissions = () => {
  const [tab, setTab] = useState("applications");
  const [viewApp, setViewApp] = useState(null);

  const applications = [
    {id:"ADM001",name:"Tunde Bakare",   dob:"2013-04-12",applyClass:"JSS 1A",guardian:"Mr. Bakare",    phone:"08011234567",date:"2026-05-10",status:"Pending",  docs:true},
    {id:"ADM002",name:"Ngozi Eze",      dob:"2012-09-03",applyClass:"JSS 2A",guardian:"Mrs. Eze",      phone:"08022345678",date:"2026-05-08",status:"Approved", docs:true},
    {id:"ADM003",name:"Emeka Okafor",   dob:"2011-01-22",applyClass:"JSS 3B",guardian:"Mr. Okafor",    phone:"08033456789",date:"2026-05-06",status:"Rejected", docs:false},
    {id:"ADM004",name:"Halima Usman",   dob:"2013-07-30",applyClass:"JSS 1B",guardian:"Dr. Usman",     phone:"08044567890",date:"2026-05-14",status:"Pending",  docs:true},
    {id:"ADM005",name:"Chukwuemeka Ibe",dob:"2012-11-15",applyClass:"SSS 1A",guardian:"Chief Ibe",     phone:"08055678901",date:"2026-05-12",status:"Interview", docs:true},
  ];

  const statusColor = s => ({Pending:"amber",Approved:"green",Rejected:"red",Interview:"blue"})[s]||"gray";

  return (
    <div className="fi">
      <Tabs tabs={[{id:"applications",label:"📋 Applications"},{id:"form",label:"📝 Admission Form"},{id:"settings",label:"⚙️ Settings"}]} active={tab} onChange={setTab}/>
      <div style={{marginTop:16}}>

        {tab==="applications" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
              {[["Total Applied",applications.length,C.sky,"📋"],["Approved",applications.filter(a=>a.status==="Approved").length,C.accent,"✅"],["Pending",applications.filter(a=>a.status==="Pending").length,C.amber,"⏳"],["Rejected",applications.filter(a=>a.status==="Rejected").length,C.coral,"❌"]].map(([l,v,c,ic])=>(
                <div key={l} style={{padding:"13px 16px",borderRadius:12,background:c+"14",border:`1px solid ${c}28`}}><div style={{fontSize:20,marginBottom:4}}>{ic}</div><div style={{fontSize:22,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:11,color:C.textMuted}}>{l}</div></div>
              ))}
            </div>
            <Card style={{padding:0}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["Applicant","Class Applied","Guardian","Phone","Date","Docs","Status","Action"].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {applications.map(a=>(
                    <tr key={a.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"10px 13px"}}><div style={{fontSize:13,fontWeight:700}}>{a.name}</div><div style={{fontSize:10,color:C.textMuted}}>DOB: {a.dob}</div></td>
                      <td style={{padding:"10px 13px",fontSize:12}}>{a.applyClass}</td>
                      <td style={{padding:"10px 13px",fontSize:12}}>{a.guardian}</td>
                      <td style={{padding:"10px 13px",fontSize:12,color:C.textMid}}>{a.phone}</td>
                      <td style={{padding:"10px 13px",fontSize:11,color:C.textMuted}}>{a.date}</td>
                      <td style={{padding:"10px 13px"}}><Badge color={a.docs?"green":"red"} size="sm">{a.docs?"Complete":"Missing"}</Badge></td>
                      <td style={{padding:"10px 13px"}}><Badge color={statusColor(a.status)} size="sm">{a.status}</Badge></td>
                      <td style={{padding:"10px 13px"}}>
                        <div style={{display:"flex",gap:5}}>
                          <Btn size="sm" variant="secondary" onClick={()=>setViewApp(a)}>View</Btn>
                          {a.status==="Pending"&&<><Btn size="sm" variant="primary">✅</Btn><Btn size="sm" variant="danger">✗</Btn></>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="form" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:16}}>
            <Card>
              <div style={{fontSize:13,fontWeight:700,marginBottom:16}}>📝 New Student Admission Form</div>
              <div style={{display:"flex",flexDirection:"column",gap:13}}>
                <div style={{fontSize:12,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:".5px",paddingBottom:6,borderBottom:`1px solid ${C.border}`}}>Student Information</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                  <Input label="First Name"   value="" onChange={()=>{}} placeholder="e.g. Amara"/>
                  <Input label="Last Name"    value="" onChange={()=>{}} placeholder="e.g. Okonkwo"/>
                  <Input label="Date of Birth" value="" onChange={()=>{}} type="date"/>
                  <Sel   label="Gender" value="female" onChange={()=>{}} options={[{value:"female",label:"Female"},{value:"male",label:"Male"}]}/>
                  <Sel   label="Class Applying For" value="JSS 1A" onChange={()=>{}} options={CLASSES.map(c=>({value:c,label:c}))}/>
                  <Input label="Previous School" value="" onChange={()=>{}} placeholder="Name of last school"/>
                </div>
                <div style={{fontSize:12,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:".5px",paddingBottom:6,borderBottom:`1px solid ${C.border}`,marginTop:6}}>Parent / Guardian Information</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                  <Input label="Guardian Full Name" value="" onChange={()=>{}} placeholder="Full name"/>
                  <Input label="Relationship"       value="" onChange={()=>{}} placeholder="e.g. Father, Mother"/>
                  <Input label="Phone Number"       value="" onChange={()=>{}} placeholder="+234 800 000 0000"/>
                  <Input label="Email Address"      value="" onChange={()=>{}} type="email" placeholder="email@example.com"/>
                  <Input label="Home Address" value="" onChange={()=>{}} placeholder="Full residential address" style={{gridColumn:"1/-1"}}/>
                </div>
                <div style={{fontSize:12,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:".5px",paddingBottom:6,borderBottom:`1px solid ${C.border}`,marginTop:6}}>Documents Upload</div>
                {["Birth Certificate","Passport Photograph","Last School Result","Medical Certificate"].map(doc=>(
                  <div key={doc} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:9,border:`1px solid ${C.border}`,background:"#F8FAFC"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>📄</span><span style={{fontSize:12,fontWeight:500}}>{doc}</span></div>
                    <Btn size="sm" variant="secondary">📎 Upload</Btn>
                  </div>
                ))}
                <div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:6}}>
                  <Btn variant="secondary">Save as Draft</Btn>
                  <Btn variant="primary">Submit Application 🚀</Btn>
                </div>
              </div>
            </Card>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <Card>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>📅 Admission Timeline</div>
                {[["Application Opens","Jan 15, 2026","done"],["Entrance Exam","Mar 5, 2026","done"],["Results Released","Mar 20, 2026","done"],["Acceptance Deadline","Apr 10, 2026","done"],["Resumption","Sep 8, 2026","upcoming"]].map(([l,d,s])=>(
                  <div key={l} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:s==="done"?C.accentLight:C.amberLight,border:`2px solid ${s==="done"?C.accent:C.amber}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0}}>{s==="done"?"✓":"○"}</div>
                    <div><div style={{fontSize:12,fontWeight:600}}>{l}</div><div style={{fontSize:10,color:C.textMuted}}>{d}</div></div>
                  </div>
                ))}
              </Card>
              <Card>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>💳 Admission Fee</div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span>Application Fee</span><span style={{fontWeight:700}}>₦5,000</span></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"8px 0"}}><span>Acceptance Fee</span><span style={{fontWeight:700}}>₦25,000</span></div>
                <Btn variant="primary" style={{width:"100%",justifyContent:"center",marginTop:12}}>💳 Pay Online</Btn>
              </Card>
            </div>
          </div>
        )}

        {tab==="settings" && (
          <Card>
            <div style={{fontSize:13,fontWeight:700,marginBottom:16}}>⚙️ Admission Configuration</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Input label="Admission Open Date"  value="2026-01-15" onChange={()=>{}} type="date"/>
              <Input label="Admission Close Date" value="2026-07-31" onChange={()=>{}} type="date"/>
              <Input label="Application Fee (₦)"  value="5000"       onChange={()=>{}} type="number"/>
              <Input label="Acceptance Fee (₦)"   value="25000"      onChange={()=>{}} type="number"/>
              <Sel label="Auto-Generate Student ID" value="yes" onChange={()=>{}} options={[{value:"yes",label:"Yes – Auto"},{value:"no",label:"No – Manual"}]}/>
              <Sel label="Require Entrance Exam" value="yes" onChange={()=>{}} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </div>
            <div style={{marginTop:16}}><Btn variant="primary">💾 Save Settings</Btn></div>
          </Card>
        )}
      </div>

      {viewApp&&<Modal title={`Application — ${viewApp.name}`} onClose={()=>setViewApp(null)} width={520}>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[["Full Name",viewApp.name],["Date of Birth",viewApp.dob],["Class Applied For",viewApp.applyClass],["Guardian",viewApp.guardian],["Phone",viewApp.phone],["Application Date",viewApp.date],["Documents",viewApp.docs?"Complete":"Incomplete"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}><span style={{color:C.textMuted}}>{k}</span><span style={{fontWeight:600}}>{v}</span></div>
          ))}
          <div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:8}}>
            <Btn variant="danger"   onClick={()=>setViewApp(null)}>✗ Reject</Btn>
            <Btn variant="amber"    onClick={()=>setViewApp(null)}>📅 Schedule Interview</Btn>
            <Btn variant="primary"  onClick={()=>setViewApp(null)}>✅ Approve & Enroll</Btn>
          </div>
        </div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ACADEMIC MANAGEMENT — Classes, Subjects, Study Materials, Assignments
// ═══════════════════════════════════════════════════════════════════════════════
const AddClassModal = ({ onClose, onCreated }) => {
  const [form, setForm]         = useState("");
  const [arm, setArm]           = useState("");
  const [capacity, setCapacity] = useState("40");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const fullName = `${form.trim()}${arm.trim().toUpperCase()}`.trim();

  const submit = async () => {
    if (!form.trim()) { setError("Enter a class/form name (e.g. JSS 3)."); return; }
    setSaving(true); setError(null);
    try {
      await createClass({ name: fullName, form: form.trim(), arm: arm.trim().toUpperCase(), level: form.trim(), capacity: Number(capacity) || 40 });
      onCreated();
    } catch (e) {
      setError(e?.message || e?.data?.error || "Failed to create class.");
      setSaving(false);
    }
  };

  return (
    <Modal title="🏫 Add Class" onClose={saving ? () => {} : onClose} width={460}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Input label="Class / Form" value={form} onChange={setForm} placeholder="e.g. JSS 3"/>
        <Input label="Arm (optional)" value={arm} onChange={setArm} placeholder="e.g. A"/>
        <Input label="Capacity" value={capacity} onChange={setCapacity} type="number" placeholder="40"/>
      </div>
      <div style={{ marginTop:12, fontSize:12, color:C.textMid }}>
        New class name: <strong style={{ color:C.text }}>{fullName || "—"}</strong>
      </div>
      {error && <div style={{ marginTop:14, padding:"9px 12px", borderRadius:8, background:C.coralLight, color:C.coral, fontSize:12, fontWeight:600 }}>{error}</div>}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:18 }}>
        <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create Class"}</Btn>
      </div>
    </Modal>
  );
};

const AcademicMgmt = () => {
  const [tab, setTab] = useState("classes");
  const [matModal, setMatModal] = useState(false);
  const [asnModal, setAsnModal] = useState(false);
  const [classList, setClassList] = useState([]);
  const [classReload, setClassReload] = useState(0);
  const [showAddClass, setShowAddClass] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getClasses().then(res => {
      if (cancelled) return;
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setClassList(list);
    }).catch(() => { if (!cancelled) setClassList([]); });
    return () => { cancelled = true; };
  }, [classReload]);

  const materials = [
    {id:"M001",title:"Introduction to Algebra",subject:"Mathematics",class:"JSS 3",type:"PDF",   size:"2.4MB",uploader:"Mrs. Adeyemi",date:"2026-05-15"},
    {id:"M002",title:"Photosynthesis Explained",subject:"Biology",   class:"SSS 1",type:"Video", size:"84MB", uploader:"Ms. Ngozi Ike", date:"2026-05-12"},
    {id:"M003",title:"Grammar & Composition",   subject:"English",   class:"JSS 2",type:"PDF",   size:"1.1MB",uploader:"Mr. Charles Osei",date:"2026-05-10"},
    {id:"M004",title:"Newton's Laws Podcast",   subject:"Physics",   class:"SSS 2",type:"Audio", size:"18MB", uploader:"Mrs. Adeyemi",date:"2026-05-08"},
  ];
  const assignments = [
    {id:"A001",title:"Solve Quadratic Equations",subject:"Mathematics",class:"SSS 2B",due:"2026-05-28",submitted:18,total:28,status:"Open"},
    {id:"A002",title:"Write a Descriptive Essay",subject:"English",   class:"JSS 3A",due:"2026-05-25",submitted:26,total:30,status:"Closed"},
    {id:"A003",title:"Dissection Lab Report",    subject:"Biology",   class:"SSS 1A",due:"2026-05-30",submitted:5, total:25,status:"Open"},
  ];
  const typeIcon = t => ({PDF:"📄",Video:"🎥",Audio:"🎧",DOC:"📝"})[t]||"📁";
  const typeColor = t => ({PDF:"blue",Video:"purple",Audio:"teal",DOC:"orange"})[t]||"gray";

  return (
    <div className="fi">
      <Tabs tabs={[{id:"classes",label:"🏫 Classes & Subjects"},{id:"materials",label:"📚 Study Materials"},{id:"assignments",label:"📝 Assignments"}]} active={tab} onChange={setTab}/>
      <div style={{marginTop:16}}>

        {tab==="classes" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
                <div style={{fontSize:13,fontWeight:700}}>🏫 Classes / Forms</div>
                <Btn size="sm" variant="primary" onClick={()=>setShowAddClass(true)}>+ Add Class</Btn>
              </div>
              {classList.length===0 ? (
                <div style={{padding:"22px 0",textAlign:"center",fontSize:12,color:C.textMuted}}>No classes yet. Click “+ Add Class” to create one.</div>
              ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {classList.map(cls=>(
                  <div key={cls.id} style={{padding:"10px 12px",borderRadius:9,border:`1px solid ${C.border}`,background:"#F8FAFC",textAlign:"center"}}>
                    <div style={{fontSize:12,fontWeight:700}}>{cls.name}</div>
                    <div style={{fontSize:10,color:C.textMuted,marginTop:3}}>Capacity {cls.capacity||40}</div>
                  </div>
                ))}
              </div>
              )}
            </Card>
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
                <div style={{fontSize:13,fontWeight:700}}>📖 Subjects & Curriculum</div>
                <Btn size="sm" variant="primary">+ Add Subject</Btn>
              </div>
              {SUBJECTS.map((s,i)=>(
                <div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <div style={{width:28,height:28,borderRadius:7,background:[C.sky,C.accent,C.amber,C.purple,C.coral,C.teal,C.orange,C.pink,C.sky][i%9]+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>{["📐","📖","🔬","⚡","🧪","📜","🗺️","🏛️","💻"][i%9]}</div>
                    <span style={{fontSize:13,fontWeight:600}}>{s}</span>
                  </div>
                  <div style={{display:"flex",gap:7,alignItems:"center"}}>
                    <Badge color="blue" size="sm">All Classes</Badge>
                    <Btn size="sm" variant="ghost">✏️</Btn>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab==="materials" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{display:"flex",gap:9}}>
                <Sel label="" value="all" onChange={()=>{}} options={[{value:"all",label:"All Subjects"},...SUBJECTS.map(s=>({value:s,label:s}))]} style={{width:190}}/>
                <Sel label="" value="all" onChange={()=>{}} options={[{value:"all",label:"All Types"},{value:"PDF",label:"PDF"},{value:"Video",label:"Video"},{value:"Audio",label:"Audio"}]} style={{width:130}}/>
              </div>
              <Btn variant="primary" onClick={()=>setMatModal(true)}>📎 Upload Material</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
              {materials.map(m=>(
                <Card key={m.id} style={{display:"flex",gap:13,alignItems:"center"}}>
                  <div style={{width:48,height:48,borderRadius:11,background:C[typeColor(m.type)+"Light"]||"#F3F4F6",border:`1px solid ${C[typeColor(m.type)]||C.border}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{typeIcon(m.type)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{m.title}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{m.subject} · {m.class} · {m.size}</div>
                    <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>Uploaded by {m.uploader} on {m.date}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                    <Badge color={typeColor(m.type)} size="sm">{m.type}</Badge>
                    <div style={{display:"flex",gap:5}}><Btn size="sm" variant="ghost">👁 View</Btn><Btn size="sm" variant="ghost">⬇️</Btn></div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab==="assignments" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginBottom:14}}>
              <Btn variant="primary" onClick={()=>setAsnModal(true)}>+ Create Assignment</Btn>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {assignments.map(a=>{
                const pct=Math.round(a.submitted/a.total*100);
                return(
                  <Card key={a.id}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:700}}>{a.title}</div>
                        <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{a.subject} · {a.class} · Due: <strong style={{color:a.status==="Open"?C.amber:C.textMuted}}>{a.due}</strong></div>
                      </div>
                      <Badge color={a.status==="Open"?"green":"gray"}>{a.status}</Badge>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,height:6,borderRadius:99,background:C.border}}><div style={{height:6,borderRadius:99,background:pct>=80?C.accent:pct>=50?C.amber:C.coral,width:pct+"%"}}/></div>
                      <span style={{fontSize:12,fontWeight:700,minWidth:60,textAlign:"right"}}>{a.submitted}/{a.total} submitted</span>
                      <Btn size="sm" variant="secondary">View Submissions</Btn>
                      {a.status==="Open"&&<Btn size="sm" variant="ghost">Close</Btn>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showAddClass && (
        <AddClassModal
          onClose={()=>setShowAddClass(false)}
          onCreated={()=>{ setShowAddClass(false); setClassReload(k=>k+1); }}
        />
      )}

      {matModal&&<Modal title="📎 Upload Study Material" onClose={()=>setMatModal(false)} width={500}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Input label="Title" value="" onChange={()=>{}} placeholder="e.g. Introduction to Algebra"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Sel label="Subject" value="Mathematics" onChange={()=>{}} options={SUBJECTS.map(s=>({value:s,label:s}))}/>
            <Sel label="Class"   value="JSS 3A"      onChange={()=>{}} options={CLASSES.map(c=>({value:c,label:c}))}/>
            <Sel label="Material Type" value="PDF"   onChange={()=>{}} options={["PDF","Video","Audio","DOC","Link"].map(t=>({value:t,label:t}))}/>
          </div>
          <div style={{border:`2px dashed ${C.border}`,borderRadius:10,padding:"20px",textAlign:"center",background:"#F8FAFC"}}>
            <div style={{fontSize:22,marginBottom:6}}>📁</div>
            <div style={{fontSize:12,color:C.textMid}}>Drag & drop file or click to browse</div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:3}}>PDF, MP4, MP3, DOC — Max 100MB</div>
            <Btn variant="secondary" size="sm" style={{marginTop:9}}>Browse</Btn>
          </div>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setMatModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>setMatModal(false)}>📎 Upload</Btn></div>
        </div>
      </Modal>}

      {asnModal&&<Modal title="+ Create Assignment" onClose={()=>setAsnModal(false)} width={500}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Input label="Assignment Title" value="" onChange={()=>{}} placeholder="e.g. Solve Quadratic Equations"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Sel label="Subject" value="Mathematics" onChange={()=>{}} options={SUBJECTS.map(s=>({value:s,label:s}))}/>
            <Sel label="Class"   value="SSS 2B"      onChange={()=>{}} options={CLASSES.map(c=>({value:c,label:c}))}/>
            <Input label="Due Date" value="" onChange={()=>{}} type="datetime-local"/>
            <Input label="Max Score" value="20" onChange={()=>{}} type="number"/>
          </div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:4}}>Instructions</label><textarea placeholder="Describe the assignment, resources, submission format…" style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,minHeight:80,resize:"none",outline:"none",fontFamily:"Sora,sans-serif"}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/></div>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setAsnModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>setAsnModal(false)}>📝 Create Assignment</Btn></div>
        </div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TRANSPORT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
const Transport = () => {
  const [tab, setTab] = useState("routes");
  const routes = [
    {id:"R001",name:"Lekki – VI Route",   driver:"Mr. Adamu Bello",  bus:"LND-342-AA",capacity:35,students:30,fee:25000,status:"Active"},
    {id:"R002",name:"Surulere – Yaba",    driver:"Mr. Emeka Nwosu",  bus:"LND-218-BB",capacity:30,students:28,fee:22000,status:"Active"},
    {id:"R003",name:"Ikeja – Ojodu",      driver:"Mr. Kunle Adesanya",bus:"LND-556-CC",capacity:40,students:15,fee:20000,status:"Active"},
    {id:"R004",name:"Ajah – Sangotedo",   driver:"Mrs. Taiwo Adeyemi",bus:"LND-112-DD",capacity:35,students:35,fee:28000,status:"Full"},
  ];
  const drivers = [
    {id:"D001",name:"Mr. Adamu Bello",   license:"Lagos-DL-2024-001",phone:"08011111111",route:"Lekki – VI",   status:"Active"},
    {id:"D002",name:"Mr. Emeka Nwosu",   license:"Lagos-DL-2024-002",phone:"08022222222",route:"Surulere – Yaba",status:"Active"},
    {id:"D003",name:"Mr. Kunle Adesanya",license:"Lagos-DL-2024-003",phone:"08033333333",route:"Ikeja – Ojodu", status:"Active"},
  ];

  return (
    <div className="fi">
      <Tabs tabs={[{id:"routes",label:"🚌 Routes"},{id:"drivers",label:"🧑‍✈️ Drivers"},{id:"tracking",label:"📍 Student Pickup"},{id:"fees",label:"💳 Transport Fees"}]} active={tab} onChange={setTab}/>
      <div style={{marginTop:16}}>

        {tab==="routes" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn variant="primary">+ Add Route</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:13}}>
              {routes.map(r=>(
                <Card key={r.id}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div style={{display:"flex",gap:11,alignItems:"center"}}>
                      <div style={{width:44,height:44,borderRadius:11,background:C.sky+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🚌</div>
                      <div><div style={{fontSize:14,fontWeight:700}}>{r.name}</div><div style={{fontSize:11,color:C.textMuted}}>Bus: {r.bus}</div></div>
                    </div>
                    <Badge color={r.status==="Full"?"red":"green"} size="sm">{r.status}</Badge>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
                    {[["Driver",r.driver.split(" ")[1]],["Capacity",r.capacity],["Enrolled",r.students]].map(([l,v])=>(
                      <div key={l} style={{textAlign:"center",padding:"8px",borderRadius:8,background:"#F8FAFC"}}>
                        <div style={{fontSize:14,fontWeight:700}}>{v}</div><div style={{fontSize:9,color:C.textMuted}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:700,color:C.accentDark}}>₦{r.fee.toLocaleString()}<span style={{fontSize:10,color:C.textMuted,fontWeight:400}}>/term</span></span>
                    <div style={{display:"flex",gap:7}}><Btn size="sm" variant="secondary">View Students</Btn><Btn size="sm" variant="ghost">✏️ Edit</Btn></div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab==="drivers" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn variant="primary">+ Add Driver</Btn></div>
            <Card style={{padding:0}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["Driver","License No.","Phone","Assigned Route","Status","Action"].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {drivers.map(d=>(
                    <tr key={d.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"10px 13px"}}><div style={{display:"flex",alignItems:"center",gap:9}}><Avatar initials={d.name.split(" ").map(w=>w[0]).slice(0,2).join("")} size={28} color={C.sky}/><span style={{fontSize:13,fontWeight:600}}>{d.name}</span></div></td>
                      <td style={{padding:"10px 13px",fontSize:12,fontFamily:"monospace"}}>{d.license}</td>
                      <td style={{padding:"10px 13px",fontSize:12}}>{d.phone}</td>
                      <td style={{padding:"10px 13px",fontSize:12}}>{d.route}</td>
                      <td style={{padding:"10px 13px"}}><Badge color="green" size="sm">{d.status}</Badge></td>
                      <td style={{padding:"10px 13px"}}><Btn size="sm" variant="secondary">View</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="tracking" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
              <StatCard label="Total Routes"   value={routes.length}                          color={C.sky}    icon="🗺️"/>
              <StatCard label="Students on Bus" value={routes.reduce((a,r)=>a+r.students,0)} color={C.accent} icon="👨‍🎓"/>
              <StatCard label="Active Drivers"  value={drivers.length}                         color={C.purple} icon="🧑‍✈️"/>
            </div>
            <Card>
              <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>📍 Today's Pickup Status</div>
              {STUDENTS.map((s,i)=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                  <Avatar initials={s.avatar} size={30} color={C.accent}/>
                  <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{s.name}</div><div style={{fontSize:10,color:C.textMuted}}>{routes[i%routes.length].name}</div></div>
                  <Badge color={i%3===0?"green":i%3===1?"amber":"gray"} size="sm">{i%3===0?"Picked Up":i%3===1?"En Route":"Not Registered"}</Badge>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab==="fees" && (
          <div>
            <Card style={{padding:0}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["Student","Route","Term Fee","Paid","Balance","Status"].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {STUDENTS.map((s,i)=>{const fee=routes[i%routes.length].fee;const paid=i%2===0?fee:Math.round(fee*.5);return(
                    <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"10px 13px",fontSize:12,fontWeight:600}}>{s.name}</td>
                      <td style={{padding:"10px 13px",fontSize:12}}>{routes[i%routes.length].name}</td>
                      <td style={{padding:"10px 13px",fontSize:12,fontFamily:"monospace"}}>₦{fee.toLocaleString()}</td>
                      <td style={{padding:"10px 13px",fontSize:12,fontFamily:"monospace",color:C.accentDark}}>₦{paid.toLocaleString()}</td>
                      <td style={{padding:"10px 13px",fontSize:12,fontFamily:"monospace",color:(fee-paid)>0?C.coral:C.textMuted}}>₦{(fee-paid).toLocaleString()}</td>
                      <td style={{padding:"10px 13px"}}><Badge color={paid===fee?"green":"amber"} size="sm">{paid===fee?"Paid":"Part"}</Badge></td>
                    </tr>
                  );})}
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
// 5. CERTIFICATES & ID CARDS
// ═══════════════════════════════════════════════════════════════════════════════
const Certificates = () => {
  const [tab, setTab] = useState("idcards");
  const [preview, setPreview] = useState(null);

  const IDCardPreview = ({ student, type }) => (
    <div style={{width:320,height:190,borderRadius:14,background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 100%)`,padding:"16px 18px",display:"flex",flexDirection:"column",justifyContent:"space-between",boxShadow:"0 8px 28px rgba(0,0,0,.25)",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:C.accent+"18"}}/>
      <div style={{position:"absolute",bottom:-30,left:-10,width:80,height:80,borderRadius:"50%",background:C.accent+"12"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><div style={{color:C.accent,fontSize:10,fontWeight:700,letterSpacing:"1px"}}>GREENFIELD ACADEMY</div><div style={{color:"#8DA4C0",fontSize:9,marginTop:1}}>LAGOS · NIGERIA</div></div>
        <div style={{background:C.accent,borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:C.navy}}>{type.toUpperCase()}</div>
      </div>
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <div style={{width:44,height:44,borderRadius:"50%",background:C.accent+"33",border:`2px solid ${C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:C.accent,flexShrink:0}}>{student?.avatar||"ST"}</div>
        <div>
          <div style={{color:"#fff",fontSize:13,fontWeight:700}}>{student?.name||"Student Name"}</div>
          <div style={{color:"#8DA4C0",fontSize:10,marginTop:2}}>{student?.class||"Class"}</div>
          <div style={{color:"#8DA4C0",fontSize:10,marginTop:1}}>ID: {student?.id||"ST001"}</div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{color:"#8DA4C0",fontSize:9}}>Valid: 2025/2026 Academic Session</div>
        <div style={{background:C.accent+"22",borderRadius:4,padding:"2px 7px",color:C.accent,fontSize:9,fontWeight:700}}>OFFICIAL</div>
      </div>
    </div>
  );

  const CertPreview = ({ name, type }) => (
    <div style={{width:"100%",maxWidth:500,background:"#fff",border:`3px solid ${C.navy}`,borderRadius:8,padding:"28px 32px",textAlign:"center",position:"relative"}}>
      <div style={{position:"absolute",inset:8,border:`1px solid ${C.accent}44`,borderRadius:4,pointerEvents:"none"}}/>
      <div style={{fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:"2px",marginBottom:8}}>GREENFIELD ACADEMY</div>
      <div style={{fontSize:10,color:C.textMuted,marginBottom:16}}>12 Education Lane, Lagos · Accredited by WAEC</div>
      <div style={{fontSize:15,fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"1px",marginBottom:20}}>Certificate of {type}</div>
      <div style={{fontSize:12,color:C.textMid,lineHeight:1.8}}>This is to certify that</div>
      <div style={{fontSize:20,fontWeight:700,color:C.navy,margin:"8px 0",fontStyle:"italic"}}>{name}</div>
      <div style={{fontSize:12,color:C.textMid,lineHeight:1.8}}>has successfully {type==="Graduation"?"completed the secondary school programme":"participated in this programme"} at Greenfield Academy for the academic year 2025/2026.</div>
      <div style={{display:"flex",justifyContent:"space-around",marginTop:24}}>
        <div style={{textAlign:"center"}}><div style={{borderTop:`1px solid ${C.navy}`,paddingTop:5,width:120,fontSize:11,color:C.textMid}}>Class Teacher</div></div>
        <div style={{textAlign:"center"}}><div style={{borderTop:`1px solid ${C.navy}`,paddingTop:5,width:120,fontSize:11,color:C.textMid}}>Principal</div></div>
      </div>
    </div>
  );

  return (
    <div className="fi">
      <Tabs tabs={[{id:"idcards",label:"🪪 ID Cards"},{id:"certs",label:"🏆 Certificates"},{id:"admitcards",label:"📋 Admit Cards"},{id:"templates",label:"🎨 Templates"}]} active={tab} onChange={setTab}/>
      <div style={{marginTop:16}}>

        {tab==="idcards" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{display:"flex",gap:9}}>
                <Sel label="" value="all" onChange={()=>{}} options={[{value:"all",label:"All Students"},{value:"jss",label:"JSS Only"},{value:"sss",label:"SSS Only"}]} style={{width:150}}/>
              </div>
              <div style={{display:"flex",gap:9}}><Btn variant="secondary">🖨 Print Selected</Btn><Btn variant="primary">🖨 Print All ID Cards</Btn></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
              {STUDENTS.map(s=>(
                <div key={s.id}>
                  <IDCardPreview student={s} type="Student"/>
                  <div style={{display:"flex",gap:7,marginTop:8,justifyContent:"flex-end"}}>
                    <Btn size="sm" variant="secondary">👁 Preview</Btn>
                    <Btn size="sm" variant="primary">🖨 Print</Btn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="certs" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <Sel label="" value="Graduation" onChange={()=>{}} options={["Graduation","Completion","Achievement","Participation","Merit"].map(t=>({value:t,label:t+" Certificate"}))} style={{width:220}}/>
              <Btn variant="primary">🖨 Generate Certificates</Btn>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {STUDENTS.slice(0,2).map(s=>(
                <div key={s.id} style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                  <CertPreview name={s.name} type="Graduation"/>
                  <div style={{display:"flex",flexDirection:"column",gap:8,paddingTop:8}}>
                    <Btn size="sm" variant="primary">🖨 Print</Btn>
                    <Btn size="sm" variant="secondary">📥 PDF</Btn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="admitcards" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <Sel label="" value="Mathematics Mid-Term" onChange={()=>{}} options={["Mathematics Mid-Term","English Exam","Biology Final"].map(e=>({value:e,label:e}))} style={{width:240}}/>
              <Btn variant="primary">🖨 Print All Admit Cards</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
              {STUDENTS.map(s=>(
                <Card key={s.id} style={{background:`linear-gradient(135deg,${C.navyMid} 0%,${C.navy} 100%)`,border:"none",padding:"16px 18px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{color:C.accent,fontSize:10,fontWeight:700,letterSpacing:"1px"}}>EXAM ADMIT CARD</div>
                    <div style={{color:"#8DA4C0",fontSize:9}}>2025/2026</div>
                  </div>
                  <div style={{display:"flex",gap:11,alignItems:"center",marginBottom:12}}>
                    <Avatar initials={s.avatar} size={36} color={C.accent}/>
                    <div><div style={{color:"#fff",fontSize:13,fontWeight:700}}>{s.name}</div><div style={{color:"#8DA4C0",fontSize:10}}>{s.id} · {s.class}</div></div>
                  </div>
                  <div style={{background:C.accent+"22",borderRadius:8,padding:"8px 11px"}}>
                    <div style={{color:C.accent,fontSize:11,fontWeight:700}}>Mathematics Mid-Term Examination</div>
                    <div style={{color:"#8DA4C0",fontSize:10,marginTop:3}}>Date: June 15, 2026 · Time: 9:00 AM · Hall: Block A</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab==="templates" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn variant="primary">+ Create Template</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[["Student ID Card","Default navy + teal",C.navy,"🪪"],["Staff ID Card","Dark professional",C.navyMid,"👤"],["Graduation Certificate","Gold & cream",C.amber,"🏆"],["Achievement Award","Blue & silver",C.sky,"⭐"],["Admit Card","Compact exam card",C.purple,"📋"],["Transfer Certificate","Clean document style",C.teal,"📄"]].map(([name,desc,col,ic])=>(
                <Card key={name} style={{textAlign:"center",cursor:"pointer"}} onClick={()=>{}}>
                  <div style={{width:"100%",height:80,borderRadius:9,background:`linear-gradient(135deg,${col} 0%,${col}88 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,marginBottom:11}}>{ic}</div>
                  <div style={{fontSize:13,fontWeight:700}}>{name}</div>
                  <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{desc}</div>
                  <div style={{display:"flex",gap:7,justifyContent:"center",marginTop:11}}>
                    <Btn size="sm" variant="secondary">Preview</Btn>
                    <Btn size="sm" variant="primary">Use</Btn>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. MULTI-BRANCH MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
const MultiBranch = () => {
  const [selected, setSelected] = useState(null);
  const metrics = { B001:{students:1284,staff:68,fees:"₦18.4M",attendance:"94%"}, B002:{students:890,staff:52,fees:"₦12.1M",attendance:"91%"}, B003:{students:640,staff:41,fees:"₦8.9M",attendance:"89%"} };

  return (
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:16,fontWeight:700}}>🏫 Multi-Branch Management</div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Centralized overview of all school branches</div>
        </div>
        <Btn variant="primary">+ Add Branch</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:13,marginBottom:20}}>
        <StatCard label="Total Branches" value={BRANCHES.length}                            color={C.sky}    icon="🏫"/>
        <StatCard label="Total Students" value={Object.values(metrics).reduce((a,m)=>a+m.students,0).toLocaleString()} color={C.accent} icon="👨‍🎓"/>
        <StatCard label="Total Staff"    value={Object.values(metrics).reduce((a,m)=>a+m.staff,0)}  color={C.purple} icon="👩‍🏫"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {BRANCHES.map(b=>{
          const m=metrics[b.id];
          return(
            <Card key={b.id} onClick={()=>setSelected(b)} style={{borderLeft:`4px solid ${b.active?C.accent:C.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:13}}>
                <div style={{width:42,height:42,borderRadius:11,background:b.active?C.accentLight:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🏫</div>
                <Badge color={b.active?"green":"gray"}>{b.active?"Active":"Inactive"}</Badge>
              </div>
              <div style={{fontSize:14,fontWeight:700,marginBottom:3}}>{b.name}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginTop:13}}>
                {[["Students",m.students],["Staff",m.staff],["Fees",m.fees],["Attendance",m.attendance]].map(([l,v])=>(
                  <div key={l} style={{padding:"9px 10px",borderRadius:8,background:"#F8FAFC"}}>
                    <div style={{fontSize:13,fontWeight:700}}>{v}</div><div style={{fontSize:9,color:C.textMuted}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:7,marginTop:13}}>
                <Btn size="sm" variant="secondary" style={{flex:1,justifyContent:"center"}}>Manage</Btn>
                <Btn size="sm" variant="ghost">⚙️</Btn>
              </div>
            </Card>
          );
        })}
      </div>

      {selected&&(
        <Modal title={selected.name} onClose={()=>setSelected(null)} width={500}>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            {[["Branch ID",selected.id],["Branch Name",selected.name],["Status",selected.active?"Active":"Inactive"],["Students",metrics[selected.id].students],["Staff",metrics[selected.id].staff],["Fees Collected",metrics[selected.id].fees],["Attendance Rate",metrics[selected.id].attendance]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}><span style={{color:C.textMuted}}>{k}</span><span style={{fontWeight:600}}>{v}</span></div>
            ))}
            <div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:8}}>
              <Btn variant="secondary" onClick={()=>setSelected(null)}>Close</Btn>
              <Btn variant="primary">Open Branch Dashboard</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SCHOOL WEBSITE & CMS
// ═══════════════════════════════════════════════════════════════════════════════
const SchoolCMS = () => {
  const [tab, setTab] = useState("overview");
  const [postModal, setPostModal] = useState(false);

  const posts = [
    {id:"P001",title:"End of Term Examination Schedule Released",type:"Announcement",date:"2026-05-18",status:"Published",views:284},
    {id:"P002",title:"Inter-House Sports Day — Results & Photos",type:"News",         date:"2026-05-15",status:"Published",views:512},
    {id:"P003",title:"2026/2027 Admission Now Open",            type:"Admission",     date:"2026-05-10",status:"Published",views:1240},
    {id:"P004",title:"Staff Professional Development Day",      type:"Event",         date:"2026-05-05",status:"Draft",    views:0},
  ];
  const events = [
    {id:"E001",title:"End of Term Exams",    date:"Jun 15-20, 2026",type:"Academic",category:"Exam"},
    {id:"E002",title:"Prize Giving Day",     date:"Jul 5, 2026",    type:"Social",   category:"Ceremony"},
    {id:"E003",title:"New Session Resumption",date:"Sep 8, 2026",   type:"Academic", category:"Resumption"},
    {id:"E004",title:"Parent-Teacher Meeting",date:"Oct 12, 2026",  type:"Meeting",  category:"Meeting"},
  ];

  return (
    <div className="fi">
      <div style={{display:"flex",gap:12,alignItems:"center",padding:"12px 18px",background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 100%)`,borderRadius:12,marginBottom:18,border:`1px solid ${C.accent}30`}}>
        <div style={{width:40,height:40,borderRadius:10,background:C.accent+"22",border:`2px solid ${C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🌐</div>
        <div><div style={{color:"#fff",fontSize:14,fontWeight:700}}>School Website & CMS</div><div style={{color:"#8DA4C0",fontSize:11,marginTop:2}}>Manage your school's public-facing content, news and events</div></div>
        <div style={{marginLeft:"auto",display:"flex",gap:9}}><Btn variant="secondary" size="sm">🌐 View Website</Btn><Btn variant="primary" size="sm">+ New Post</Btn></div>
      </div>

      <Tabs tabs={[{id:"overview",label:"📊 Overview"},{id:"posts",label:"📰 News & Announcements"},{id:"events",label:"📅 Events"},{id:"gallery",label:"📷 Gallery"},{id:"pages",label:"📄 Pages"}]} active={tab} onChange={setTab}/>
      <div style={{marginTop:16}}>

        {tab==="overview" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
              <StatCard label="Total Posts"   value={posts.length}                           color={C.sky}    icon="📝"/>
              <StatCard label="Published"     value={posts.filter(p=>p.status==="Published").length} color={C.accent} icon="✅"/>
              <StatCard label="Total Views"   value={posts.reduce((a,p)=>a+p.views,0).toLocaleString()} color={C.purple} icon="👁"/>
              <StatCard label="Upcoming Events" value={events.length}                        color={C.amber}  icon="📅"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Card>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>📰 Recent Posts</div>
                {posts.slice(0,3).map(p=>(
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div><div style={{fontSize:12,fontWeight:600}}>{p.title}</div><div style={{fontSize:10,color:C.textMuted}}>{p.date} · {p.views} views</div></div>
                    <Badge color={p.status==="Published"?"green":"amber"} size="sm">{p.status}</Badge>
                  </div>
                ))}
              </Card>
              <Card>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>📅 Upcoming Events</div>
                {events.map(e=>(
                  <div key={e.id} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{width:36,height:36,borderRadius:8,background:C.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>📅</div>
                    <div><div style={{fontSize:12,fontWeight:600}}>{e.title}</div><div style={{fontSize:10,color:C.textMuted}}>{e.date}</div></div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {tab==="posts" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginBottom:14}}>
              <Btn variant="primary" onClick={()=>setPostModal(true)}>+ New Post</Btn>
            </div>
            <Card style={{padding:0}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["Title","Type","Date","Views","Status","Actions"].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {posts.map(p=>(
                    <tr key={p.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"10px 13px",fontSize:13,fontWeight:600,maxWidth:280}}>{p.title}</td>
                      <td style={{padding:"10px 13px"}}><Badge color={p.type==="Announcement"?"blue":p.type==="News"?"teal":p.type==="Admission"?"purple":"orange"} size="sm">{p.type}</Badge></td>
                      <td style={{padding:"10px 13px",fontSize:11,color:C.textMuted}}>{p.date}</td>
                      <td style={{padding:"10px 13px",fontSize:12,fontWeight:600}}>{p.views.toLocaleString()}</td>
                      <td style={{padding:"10px 13px"}}><Badge color={p.status==="Published"?"green":"amber"} size="sm">{p.status}</Badge></td>
                      <td style={{padding:"10px 13px"}}><div style={{display:"flex",gap:6}}><Btn size="sm" variant="ghost">✏️</Btn><Btn size="sm" variant="ghost">🗑</Btn></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="events" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn variant="primary">+ Add Event</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
              {events.map(e=>(
                <Card key={e.id} style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{width:48,height:48,borderRadius:11,background:C.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📅</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{e.title}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{e.date}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                    <Badge color={e.type==="Academic"?"blue":"green"} size="sm">{e.category}</Badge>
                    <Btn size="sm" variant="ghost">✏️ Edit</Btn>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab==="gallery" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginBottom:14}}>
              <Btn variant="secondary">📁 New Album</Btn>
              <Btn variant="primary">📎 Upload Photos</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {["Inter-House Sports 2026","Prize Giving Day 2025","WAEC Valedictory","Cultural Day 2025","Science Fair","New Students Orientation"].map((album,i)=>(
                <Card key={album} style={{padding:"12px 14px",cursor:"pointer",textAlign:"center"}}>
                  <div style={{width:"100%",height:80,borderRadius:9,background:[C.sky,C.accent,C.amber,C.purple,C.coral,C.teal][i%6]+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,marginBottom:9}}>📷</div>
                  <div style={{fontSize:12,fontWeight:700,lineHeight:1.3}}>{album}</div>
                  <div style={{fontSize:10,color:C.textMuted,marginTop:3}}>{8+i*3} photos</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab==="pages" && (
          <div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[["🏠","Home","Published","Edit the school homepage, hero image and intro text"],["ℹ️","About Us","Published","School history, mission, vision and values"],["👨‍🏫","Staff Directory","Published","List of teachers and admin staff"],["📞","Contact","Published","Contact form, address, map embed"],["🎓","Admissions","Published","Admission requirements and online form link"],["📖","Academics","Draft","Curriculum, timetable and academic policy"]].map(([ic,page,status,desc])=>(
                <Card key={page} style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{width:38,height:38,borderRadius:9,background:C.navyMid,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{ic}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{page}</div><div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{desc}</div></div>
                  <Badge color={status==="Published"?"green":"amber"} size="sm">{status}</Badge>
                  <Btn size="sm" variant="secondary">✏️ Edit</Btn>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {postModal&&<Modal title="+ New Post" onClose={()=>setPostModal(false)} width={540}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Input label="Title" value="" onChange={()=>{}} placeholder="Post title…"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Sel label="Type" value="Announcement" onChange={()=>{}} options={["Announcement","News","Event","Admission","Alert"].map(t=>({value:t,label:t}))}/>
            <Sel label="Visibility" value="public" onChange={()=>{}} options={[{value:"public",label:"Public (Website)"},{value:"internal",label:"Internal Only"},{value:"parents",label:"Parents Only"}]}/>
          </div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:4}}>Content</label><textarea placeholder="Write your post content here…" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,minHeight:100,resize:"vertical",outline:"none",fontFamily:"Sora,sans-serif"}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/></div>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setPostModal(false)}>Save Draft</Btn><Btn variant="primary" onClick={()=>setPostModal(false)}>🚀 Publish</Btn></div>
        </div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. HR MODULE EXTRAS — Leave Management, Staff Attendance, Payslips
// ═══════════════════════════════════════════════════════════════════════════════
const HRModule = () => {
  const [tab, setTab] = useState("attendance");
  const [leaveModal, setLeaveModal] = useState(false);

  const leaveRequests = [
    {id:"L001",staff:"Mrs. Blessing Adeyemi",type:"Medical Leave",  from:"2026-05-20",to:"2026-05-24",days:5, status:"Approved"},
    {id:"L002",staff:"Mr. Yusuf Abdullahi",  type:"Annual Leave",   from:"2026-06-01",to:"2026-06-10",days:10,status:"Pending"},
    {id:"L003",staff:"Ms. Ngozi Ike",        type:"Maternity Leave",from:"2026-07-01",to:"2026-09-30",days:90,status:"Approved"},
    {id:"L004",staff:"Mr. Charles Osei",     type:"Casual Leave",   from:"2026-05-26",to:"2026-05-26",days:1, status:"Pending"},
  ];

  const PAYROLL_DATA = [
    {id:"TC001",name:"Mrs. Blessing Adeyemi",role:"Teacher",   basic:180000,housing:40000,transport:20000,ded:18000},
    {id:"TC002",name:"Mr. Charles Osei",     role:"Teacher",   basic:175000,housing:40000,transport:20000,ded:17500},
    {id:"TC003",name:"Ms. Ngozi Ike",        role:"Teacher",   basic:175000,housing:40000,transport:20000,ded:17500},
    {id:"ADM1", name:"Mrs. Kemi Fashola",    role:"Admin",     basic:120000,housing:30000,transport:15000,ded:12000},
  ];

  const PayslipCard = ({ p }) => {
    const net = p.basic + p.housing + p.transport - p.ded;
    return (
      <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{background:C.navy,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{color:"#fff",fontSize:13,fontWeight:700}}>{p.name}</div><div style={{color:"#8DA4C0",fontSize:11,marginTop:2}}>{p.role} · May 2026 Payslip</div></div>
          <div style={{color:C.accent,fontSize:18,fontWeight:700}}>₦{net.toLocaleString()}</div>
        </div>
        <div style={{padding:"12px 18px",background:"#F8FAFC"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.accentDark,marginBottom:6,textTransform:"uppercase"}}>Earnings</div>
              {[["Basic Salary",p.basic],["Housing Allowance",p.housing],["Transport Allowance",p.transport]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.textMid}}>{l}</span><span style={{fontWeight:600}}>₦{v.toLocaleString()}</span></div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,padding:"6px 0",color:C.accentDark}}><span>Gross</span><span>₦{(p.basic+p.housing+p.transport).toLocaleString()}</span></div>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.coral,marginBottom:6,textTransform:"uppercase"}}>Deductions</div>
              {[["PAYE Tax",Math.round(p.ded*.6)],["Pension (8%)",Math.round(p.ded*.3)],["Other",Math.round(p.ded*.1)]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.textMid}}>{l}</span><span style={{fontWeight:600,color:C.coral}}>₦{v.toLocaleString()}</span></div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,padding:"6px 0",color:C.coral}}><span>Total Deductions</span><span>₦{p.ded.toLocaleString()}</span></div>
            </div>
          </div>
          <div style={{marginTop:10,padding:"10px 12px",borderRadius:9,background:C.accentLight,display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:13,fontWeight:700}}>NET PAY</span>
            <span style={{fontSize:16,fontWeight:700,color:C.accentDark}}>₦{net.toLocaleString()}</span>
          </div>
          <div style={{display:"flex",gap:7,justifyContent:"flex-end",marginTop:9}}>
            <Btn size="sm" variant="secondary">📥 Download PDF</Btn>
            <Btn size="sm" variant="secondary">📧 Email Payslip</Btn>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fi">
      <Tabs tabs={[{id:"attendance",label:"⏱ Staff Attendance"},{id:"leave",label:"🏖 Leave Management"},{id:"payslips",label:"💰 Payslips"}]} active={tab} onChange={setTab}/>
      <div style={{marginTop:16}}>

        {tab==="attendance" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{display:"flex",gap:9}}>
                <Input label="" value="2026-05-27" onChange={()=>{}} type="date" style={{width:160}}/>
              </div>
              <Btn variant="primary" size="sm">💾 Save Attendance</Btn>
            </div>
            <Card style={{padding:0}}>
              {[...PAYROLL_DATA,...PAYROLL_DATA.slice(0,2)].map((p,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 18px",borderBottom:`1px solid ${C.border}`}}>
                  <Avatar initials={p.name.split(" ").map(w=>w[0]).slice(0,2).join("")} size={32} color={C.sky}/>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{p.name}</div><div style={{fontSize:11,color:C.textMuted}}>{p.role}</div></div>
                  <div style={{display:"flex",gap:7}}>
                    {[["Present","present",C.accent],["Absent","absent",C.coral],["Late","late",C.amber],["Leave","leave",C.sky]].map(([l,v,c])=>(
                      <button key={v} style={{padding:"5px 11px",borderRadius:7,border:`1.5px solid ${i%4===["present","absent","late","leave"].indexOf(v)?c:C.border}`,background:i%4===["present","absent","late","leave"].indexOf(v)?c+"18":"transparent",fontSize:11,fontWeight:600,cursor:"pointer",color:i%4===["present","absent","late","leave"].indexOf(v)?c:C.textMid}}>{l}</button>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab==="leave" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:11}}>
                <StatCard label="Pending"  value={leaveRequests.filter(l=>l.status==="Pending").length}  color={C.amber}  icon="⏳"/>
                <StatCard label="Approved" value={leaveRequests.filter(l=>l.status==="Approved").length} color={C.accent} icon="✅"/>
                <StatCard label="On Leave" value="3" color={C.sky} icon="🏖"/>
              </div>
              <Btn variant="primary" onClick={()=>setLeaveModal(true)}>+ Request Leave</Btn>
            </div>
            <Card style={{padding:0}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["Staff","Leave Type","From","To","Days","Status","Action"].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {leaveRequests.map(l=>(
                    <tr key={l.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"10px 13px",fontSize:13,fontWeight:600}}>{l.staff}</td>
                      <td style={{padding:"10px 13px"}}><Badge color={l.type.includes("Medical")?"red":l.type.includes("Annual")?"blue":l.type.includes("Maternity")?"pink":"amber"} size="sm">{l.type}</Badge></td>
                      <td style={{padding:"10px 13px",fontSize:12,color:C.textMuted}}>{l.from}</td>
                      <td style={{padding:"10px 13px",fontSize:12,color:C.textMuted}}>{l.to}</td>
                      <td style={{padding:"10px 13px",fontSize:13,fontWeight:700}}>{l.days}</td>
                      <td style={{padding:"10px 13px"}}><Badge color={l.status==="Approved"?"green":"amber"} size="sm">{l.status}</Badge></td>
                      <td style={{padding:"10px 13px"}}>
                        {l.status==="Pending"&&<div style={{display:"flex",gap:5}}><Btn size="sm" variant="primary">✅</Btn><Btn size="sm" variant="danger">✗</Btn></div>}
                        {l.status==="Approved"&&<Btn size="sm" variant="ghost">View</Btn>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="payslips" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <Sel label="" value="May 2026" onChange={()=>{}} options={["May 2026","April 2026","March 2026"].map(m=>({value:m,label:m}))} style={{width:150}}/>
              <div style={{display:"flex",gap:9}}><Btn variant="secondary">📧 Email All Payslips</Btn><Btn variant="primary">📥 Download All PDFs</Btn></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
              {PAYROLL_DATA.map(p=><PayslipCard key={p.id} p={p}/>)}
            </div>
          </div>
        )}
      </div>

      {leaveModal&&<Modal title="📝 Leave Request" onClose={()=>setLeaveModal(false)} width={460}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Sel label="Staff Member" value="" onChange={()=>{}} options={[{value:"",label:"Select staff"},...PAYROLL_DATA.map(p=>({value:p.id,label:p.name}))]}/>
          <Sel label="Leave Type" value="Annual Leave" onChange={()=>{}} options={["Annual Leave","Medical Leave","Maternity Leave","Paternity Leave","Casual Leave","Study Leave"].map(t=>({value:t,label:t}))}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="From Date" value="" onChange={()=>{}} type="date"/>
            <Input label="To Date"   value="" onChange={()=>{}} type="date"/>
          </div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:4}}>Reason</label><textarea placeholder="Brief reason for leave request…" style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,minHeight:70,resize:"none",outline:"none",fontFamily:"Sora,sans-serif"}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/></div>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setLeaveModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>setLeaveModal(false)}>Submit Request</Btn></div>
        </div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. ONLINE LEARNING — Virtual Classes, Recorded Lectures, Online Assignments
// ═══════════════════════════════════════════════════════════════════════════════
const OnlineLearning = () => {
  const [tab, setTab] = useState("live");
  const [schedModal, setSchedModal] = useState(false);

  const liveClasses = [
    {id:"LC001",title:"Quadratic Equations – Live Session", subject:"Mathematics",teacher:"Mrs. Adeyemi",class:"SSS 2",date:"2026-05-27",time:"10:00 AM",duration:"1 hour",status:"Scheduled",platform:"Google Meet"},
    {id:"LC002",title:"English Essay Writing Workshop",     subject:"English",    teacher:"Mr. Osei",   class:"JSS 3",date:"2026-05-27",time:"2:00 PM", duration:"45 min",status:"Live Now",  platform:"Zoom"},
    {id:"LC003",title:"Cell Division & Mitosis",           subject:"Biology",    teacher:"Ms. Ike",    class:"SSS 1",date:"2026-05-28",time:"9:00 AM", duration:"1 hour",status:"Scheduled",platform:"Google Meet"},
  ];
  const recordings = [
    {id:"R001",title:"Introduction to Trigonometry",     subject:"Mathematics",teacher:"Mrs. Adeyemi",class:"SSS 2",duration:"58 min",views:142,date:"2026-05-20"},
    {id:"R002",title:"Nigeria's Independence Movement",  subject:"History",    teacher:"Mr. Abdullahi",class:"SSS 3",duration:"45 min",views:98, date:"2026-05-18"},
    {id:"R003",title:"Newton's Laws of Motion",          subject:"Physics",    teacher:"Mrs. Adeyemi",class:"SSS 2",duration:"52 min",views:210,date:"2026-05-15"},
  ];

  return (
    <div className="fi">
      <div style={{display:"flex",gap:12,alignItems:"center",padding:"12px 18px",background:`linear-gradient(135deg,${C.purple} 0%,${C.sky} 100%)`,borderRadius:12,marginBottom:18}}>
        <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🎓</div>
        <div><div style={{color:"#fff",fontSize:14,fontWeight:700}}>Online Learning Centre</div><div style={{color:"rgba(255,255,255,.75)",fontSize:11,marginTop:2}}>Virtual classes, recorded lectures and online assignments</div></div>
        <div style={{marginLeft:"auto"}}><Btn variant="secondary" size="sm" onClick={()=>setSchedModal(true)}>+ Schedule Class</Btn></div>
      </div>

      <Tabs tabs={[{id:"live",label:"🔴 Live Classes"},{id:"recordings",label:"🎥 Recordings"},{id:"online-assignments",label:"📝 Online Assignments"}]} active={tab} onChange={setTab}/>
      <div style={{marginTop:16}}>

        {tab==="live" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {liveClasses.map(lc=>(
              <Card key={lc.id}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:54,height:54,borderRadius:12,background:lc.status==="Live Now"?C.coral+"22":C.accentLight,border:`2px solid ${lc.status==="Live Now"?C.coral:C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{lc.status==="Live Now"?"🔴":"📹"}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:14,fontWeight:700}}>{lc.title}</span>
                      {lc.status==="Live Now"&&<Badge color="red">🔴 LIVE</Badge>}
                      {lc.status==="Scheduled"&&<Badge color="blue" size="sm">Scheduled</Badge>}
                    </div>
                    <div style={{fontSize:12,color:C.textMuted}}>{lc.subject} · {lc.class} · {lc.teacher} · {lc.date} at {lc.time} · {lc.duration}</div>
                    <div style={{fontSize:11,color:C.textMid,marginTop:2}}>Platform: {lc.platform}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {lc.status==="Live Now"&&<Btn variant="danger">Join Now →</Btn>}
                    {lc.status==="Scheduled"&&<><Btn size="sm" variant="secondary">Edit</Btn><Btn size="sm" variant="primary">📧 Notify Students</Btn></>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="recordings" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn variant="primary">📎 Upload Recording</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {recordings.map(r=>(
                <Card key={r.id} style={{cursor:"pointer"}} onClick={()=>{}}>
                  <div style={{width:"100%",height:90,borderRadius:9,background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:11,position:"relative"}}>
                    ▶️
                    <div style={{position:"absolute",bottom:7,right:8,background:"rgba(0,0,0,.6)",color:"#fff",fontSize:10,borderRadius:4,padding:"2px 6px"}}>{r.duration}</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,lineHeight:1.3}}>{r.title}</div>
                  <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>{r.subject} · {r.class}</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:9,fontSize:11,color:C.textMid}}>
                    <span>👁 {r.views} views</span><span>{r.date}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab==="online-assignments" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn variant="primary">+ Create Online Assignment</Btn></div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              {[["Algebra Problem Set","Mathematics","SSS 2B","2026-05-30",22,28,"Open"],["Comprehension Exercise","English","JSS 3A","2026-05-28",28,30,"Open"],["Lab Report – Titration","Chemistry","SSS 1A","2026-05-26",15,24,"Closed"]].map(([title,subj,cls,due,sub,total,status])=>{
                const pct=Math.round(sub/total*100);
                return(
                  <Card key={title}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700}}>{title}</div>
                        <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{subj} · {cls} · Due: <strong style={{color:status==="Open"?C.amber:C.textMuted}}>{due}</strong></div>
                      </div>
                      <Badge color={status==="Open"?"green":"gray"}>{status}</Badge>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,height:5,borderRadius:99,background:C.border}}><div style={{height:5,borderRadius:99,background:pct>=80?C.accent:pct>=50?C.amber:C.coral,width:pct+"%"}}/></div>
                      <span style={{fontSize:12,fontWeight:700,minWidth:65,textAlign:"right"}}>{sub}/{total} submitted</span>
                      <Btn size="sm" variant="secondary">Review</Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {schedModal&&<Modal title="📅 Schedule Virtual Class" onClose={()=>setSchedModal(false)} width={500}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Input label="Session Title" value="" onChange={()=>{}} placeholder="e.g. Quadratic Equations – Live Session"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Sel label="Subject" value="Mathematics" onChange={()=>{}} options={SUBJECTS.map(s=>({value:s,label:s}))}/>
            <Sel label="Class"   value="SSS 2A"      onChange={()=>{}} options={CLASSES.map(c=>({value:c,label:c}))}/>
            <Input label="Date"  value=""             onChange={()=>{}} type="date"/>
            <Input label="Time"  value=""             onChange={()=>{}} type="time"/>
            <Sel label="Duration" value="60" onChange={()=>{}} options={["30","45","60","90","120"].map(d=>({value:d,label:d+" minutes"}))}/>
            <Sel label="Platform" value="google-meet" onChange={()=>{}} options={[{value:"google-meet",label:"Google Meet"},{value:"zoom",label:"Zoom"},{value:"teams",label:"Microsoft Teams"}]}/>
          </div>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setSchedModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>setSchedModal(false)}>📅 Schedule Class</Btn></div>
        </div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. COMMUNICATION EXTRAS — SMS Notifications, Event Reminders, Parent Portal Preview
// ═══════════════════════════════════════════════════════════════════════════════
const Communications = () => {
  const [tab, setTab] = useState("sms");
  const [smsModal, setSmsModal] = useState(false);

  const smsLogs = [
    {id:"S001",recipient:"All Parents",    message:"Reminder: School fees for 2nd term are due by May 31.",  sent:1284,delivered:1270,date:"2026-05-20 9:00 AM",status:"Delivered"},
    {id:"S002",recipient:"SSS 3 Parents", message:"Final exams commence June 15. Please ensure wards prepare.",sent:120, delivered:118, date:"2026-05-18 2:30 PM",status:"Delivered"},
    {id:"S003",recipient:"JSS 3A Parents",message:"Kofi Mensah was marked absent today without explanation.",    sent:1,   delivered:1,   date:"2026-05-17 8:45 AM",status:"Delivered"},
  ];
  const reminders = [
    {id:"R001",event:"End of Term Exams",    date:"Jun 15, 2026",  sendDate:"Jun 8, 2026",  audience:"All Parents & Students",  status:"Scheduled"},
    {id:"R002",event:"Prize Giving Day",     date:"Jul 5, 2026",   sendDate:"Jun 28, 2026", audience:"All Parents",             status:"Scheduled"},
    {id:"R003",event:"School Fees Deadline", date:"May 31, 2026",  sendDate:"May 25, 2026", audience:"Owing Parents",           status:"Sent"},
    {id:"R004",event:"New Session Resumption",date:"Sep 8, 2026",  sendDate:"Sep 1, 2026",  audience:"All Parents & Students",  status:"Pending"},
  ];

  return (
    <div className="fi">
      <Tabs tabs={[{id:"sms",label:"📱 SMS Notifications"},{id:"reminders",label:"⏰ Event Reminders"},{id:"parentportal",label:"👨‍👩‍👧 Parent Portal Preview"}]} active={tab} onChange={setTab}/>
      <div style={{marginTop:16}}>

        {tab==="sms" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:11}}>
                <StatCard label="SMS Sent This Month"   value="2,847" color={C.sky}    icon="📱"/>
                <StatCard label="Delivery Rate"         value="98.7%" color={C.accent} icon="✅"/>
                <StatCard label="SMS Balance (Units)"   value="4,200" color={C.amber}  icon="💳"/>
              </div>
              <Btn variant="primary" onClick={()=>setSmsModal(true)}>📱 Send SMS</Btn>
            </div>
            <Card style={{padding:0}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["Recipient","Message Preview","Sent","Delivered","Date","Status"].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {smsLogs.map(s=>(
                    <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"10px 13px",fontSize:12,fontWeight:600}}>{s.recipient}</td>
                      <td style={{padding:"10px 13px",fontSize:12,color:C.textMid,maxWidth:240}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.message}</div></td>
                      <td style={{padding:"10px 13px",fontSize:12,fontWeight:600}}>{s.sent}</td>
                      <td style={{padding:"10px 13px",fontSize:12,fontWeight:600,color:C.accentDark}}>{s.delivered}</td>
                      <td style={{padding:"10px 13px",fontSize:11,color:C.textMuted}}>{s.date}</td>
                      <td style={{padding:"10px 13px"}}><Badge color="green" size="sm">{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="reminders" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn variant="primary">+ Add Reminder</Btn></div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              {reminders.map(r=>(
                <Card key={r.id} style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:46,height:46,borderRadius:11,background:r.status==="Sent"?C.accentLight:r.status==="Scheduled"?C.skyLight:C.amberLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>⏰</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{r.event}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Event: {r.date} · Send reminder: {r.sendDate}</div>
                    <div style={{fontSize:11,color:C.textMid,marginTop:2}}>To: {r.audience}</div>
                  </div>
                  <Badge color={r.status==="Sent"?"green":r.status==="Scheduled"?"blue":"amber"} size="sm">{r.status}</Badge>
                  <div style={{display:"flex",gap:7}}><Btn size="sm" variant="ghost">✏️</Btn>{r.status!=="Sent"&&<Btn size="sm" variant="secondary">Send Now</Btn>}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab==="parentportal" && (
          <div>
            <div style={{padding:"11px 14px",borderRadius:10,background:C.amberLight,fontSize:12,color:"#92400E",fontWeight:600,marginBottom:16}}>👁 This is a preview of what parents see when they log into their portal.</div>
            {/* Simulated parent portal */}
            <div style={{border:`2px solid ${C.border}`,borderRadius:14,overflow:"hidden",maxWidth:680,margin:"0 auto"}}>
              <div style={{background:C.navy,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{color:"#fff",fontSize:14,fontWeight:700}}>Parent Portal — Mrs. Grace Okonkwo</div>
                <div style={{color:"#8DA4C0",fontSize:11}}>Viewing: Amara Okonkwo · JSS 3A</div>
              </div>
              <div style={{padding:"18px 20px",background:"#F8FAFC",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:11,marginBottom:2}}>
                {[["Avg Score","78%",C.accent,"📊"],["Attendance","94%",C.sky,"✅"],["Fee Balance","₦0",C.accentDark,"💳"],["Rank","3rd / 42",C.purple,"🏆"]].map(([l,v,c,ic])=>(
                  <div key={l} style={{padding:"11px 13px",background:"#fff",borderRadius:10,border:`1px solid ${C.border}`,textAlign:"center"}}>
                    <div style={{fontSize:16,marginBottom:4}}>{ic}</div>
                    <div style={{fontSize:17,fontWeight:700,color:c}}>{v}</div>
                    <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{padding:"14px 20px",background:"#fff"}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:11}}>Recent Results</div>
                {SUBJECTS.slice(0,4).map((s,i)=>(
                  <div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                    <span style={{fontWeight:500}}>{s}</span>
                    <div style={{display:"flex",gap:11,alignItems:"center"}}>
                      <span style={{fontWeight:700,color:65+i*5>=70?C.accentDark:C.amber}}>{65+i*5}%</span>
                      <Badge color={65+i*5>=70?"green":"amber"} size="sm">{"ABCDE"[Math.floor((100-(65+i*5))/10)]}{"123456789"[Math.floor((100-(65+i*5))/10)]}</Badge>
                    </div>
                  </div>
                ))}
                <div style={{display:"flex",gap:9,marginTop:14}}>
                  <Btn size="sm" variant="secondary" style={{flex:1,justifyContent:"center"}}>💳 Pay Fees</Btn>
                  <Btn size="sm" variant="primary"  style={{flex:1,justifyContent:"center"}}>💬 Message Teacher</Btn>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {smsModal&&<Modal title="📱 Send SMS Notification" onClose={()=>setSmsModal(false)} width={500}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Sel label="Send To" value="all-parents" onChange={()=>{}} options={[{value:"all-parents",label:"All Parents"},{value:"all-students",label:"All Students"},{value:"class-parents",label:"Specific Class Parents"},{value:"debtors",label:"Owing Parents Only"},{value:"individual",label:"Individual"}]}/>
          <Sel label="Class (if applicable)" value="all" onChange={()=>{}} options={[{value:"all",label:"All Classes"},...CLASSES.map(c=>({value:c,label:c}))]}/>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:4}}>Message</label>
            <textarea placeholder="Type your SMS message here… (max 160 characters)" maxLength={160} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,minHeight:80,resize:"none",outline:"none",fontFamily:"Sora,sans-serif"}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
            <div style={{fontSize:10,color:C.textMuted,textAlign:"right",marginTop:3}}>0/160 characters · Est. recipients: 1,284</div>
          </div>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setSmsModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>setSmsModal(false)}>📱 Send SMS</Btn></div>
        </div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 11. REPORTS & ANALYTICS (enhanced)
// ═══════════════════════════════════════════════════════════════════════════════
const Analytics = () => {
  const [tab, setTab] = useState("performance");

  const BarChart = ({ data, color = C.accent, height = 100 }) => {
    const max = Math.max(...data.map(d => d.value));
    return (
      <div style={{ display:"flex", alignItems:"flex-end", gap:8, height }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.textMid }}>{d.value}{d.unit||""}</div>
            <div style={{ width:"100%", background:color, borderRadius:"4px 4px 0 0", height:Math.round((d.value/max)*(height-24)) }}/>
            <div style={{ fontSize:9, color:C.textMuted, textAlign:"center", lineHeight:1.2 }}>{d.label}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fi">
      <Tabs tabs={[{id:"performance",label:"📊 Student Performance"},{id:"attendance",label:"✅ Attendance Analytics"},{id:"finance",label:"💰 Financial Reports"},{id:"admissions",label:"🎓 Admission Stats"}]} active={tab} onChange={setTab}/>
      <div style={{ marginTop:16 }}>

        {tab==="performance" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              <StatCard label="School Average"  value="68.4%" color={C.accent}  icon="📊"/>
              <StatCard label="Top Scorer"       value="96%"   color={C.sky}     icon="🏆"/>
              <StatCard label="Below 50% (At Risk)" value="47" color={C.coral}  icon="⚠️"/>
              <StatCard label="Above 80% (Distinction)" value="128" color={C.accent} icon="⭐"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Card>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Performance by Subject (School Average)</div>
                <BarChart data={[{label:"Maths",value:72},{label:"English",value:78},{label:"Biology",value:65},{label:"Physics",value:61},{label:"Chemistry",value:58},{label:"History",value:74}]} color={C.accent}/>
              </Card>
              <Card>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Performance by Class</div>
                <BarChart data={CLASSES.slice(0,6).map((c,i)=>({label:c,value:58+i*4}))} color={C.sky}/>
              </Card>
            </div>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>📋 Class Performance Rankings</div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#F8FAFC" }}>{["Rank","Class","Avg Score","Top Student","No. Passed","No. Failed"].map(h=><th key={h} style={{ padding:"10px 13px", textAlign:"left", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {CLASSES.slice(0,6).map((cls,i)=>(
                    <tr key={cls} style={{ borderBottom:`1px solid ${C.border}` }} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"10px 13px" }}><div style={{ width:26, height:26, borderRadius:"50%", background:i<3?[C.amber,C.borderDark,C.orange][i]+"22":"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>{i+1}</div></td>
                      <td style={{ padding:"10px 13px", fontSize:13, fontWeight:700 }}>{cls}</td>
                      <td style={{ padding:"10px 13px", fontSize:13, fontWeight:700, color:C.accentDark }}>{74-i*2}%</td>
                      <td style={{ padding:"10px 13px", fontSize:12 }}>{STUDENTS[i%STUDENTS.length].name}</td>
                      <td style={{ padding:"10px 13px", fontSize:12, color:C.accentDark, fontWeight:600 }}>{28-i}</td>
                      <td style={{ padding:"10px 13px", fontSize:12, color:C.coral, fontWeight:600 }}>{2+i}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="attendance" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              <StatCard label="Overall Rate"    value="94.2%" color={C.accent} icon="✅"/>
              <StatCard label="Perfect Attendance" value="342" sub="Students" color={C.sky} icon="⭐"/>
              <StatCard label="Chronic Absent"  value="28"    sub="> 5 absences" color={C.coral} icon="🔴"/>
              <StatCard label="Avg Daily Present" value="1,208" color={C.purple} icon="👥"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Card>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Daily Attendance — This Week</div>
                <BarChart data={[{label:"Mon",value:94,unit:"%"},{label:"Tue",value:96,unit:"%"},{label:"Wed",value:88,unit:"%"},{label:"Thu",value:95,unit:"%"},{label:"Fri",value:97,unit:"%"}]} color={C.accent}/>
              </Card>
              <Card>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Attendance by Class (This Month)</div>
                {CLASSES.slice(0,6).map((cls,i)=>{const pct=88+i;return(
                  <div key={cls} style={{ marginBottom:9 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}><span style={{ fontWeight:600 }}>{cls}</span><span style={{ color:pct>=95?"green":pct>=85?C.amber:C.coral }}>{pct}%</span></div>
                    <div style={{ height:5, borderRadius:99, background:C.border }}><div style={{ height:5, borderRadius:99, background:pct>=95?C.accent:pct>=85?C.amber:C.coral, width:pct+"%" }}/></div>
                  </div>
                );})}
              </Card>
            </div>
          </div>
        )}

        {tab==="finance" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              <StatCard label="Total Revenue"   value="₦21.3M" color={C.accent} icon="💰"/>
              <StatCard label="Total Expenses"  value="₦4.95M" color={C.coral}  icon="💸"/>
              <StatCard label="Net Surplus"      value="₦16.4M" color={C.accentDark} icon="📈"/>
              <StatCard label="Fee Collection Rate" value="76%" color={C.sky}   icon="✅"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Card>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Monthly Fee Collection</div>
                <BarChart data={[{label:"Jan",value:3.2},{label:"Feb",value:4.1},{label:"Mar",value:2.8},{label:"Apr",value:3.9},{label:"May",value:4.4}]} color={C.accent}/>
              </Card>
              <Card>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Expense Breakdown</div>
                {[["Salaries",65,C.coral],["Utilities",4,C.amber],["Maintenance",7,C.sky],["Events",5,C.purple],["Supplies",2,C.teal],["Other",17,C.textMid]].map(([l,p,c])=>(
                  <div key={l} style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}><span style={{ fontWeight:600 }}>{l}</span><span style={{ color:C.textMid }}>{p}%</span></div>
                    <div style={{ height:5, borderRadius:99, background:C.border }}><div style={{ height:5, borderRadius:99, background:c, width:p+"%" }}/></div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {tab==="admissions" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              <StatCard label="Applications (2026)" value="248"  color={C.sky}    icon="📋"/>
              <StatCard label="Approved"             value="186"  color={C.accent} icon="✅"/>
              <StatCard label="Rejection Rate"       value="12%"  color={C.amber}  icon="📊"/>
              <StatCard label="Enrolled"             value="174"  color={C.purple} icon="🎓"/>
            </div>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Applications per Class</div>
              <BarChart data={[{label:"JSS 1",value:98},{label:"JSS 2",value:42},{label:"JSS 3",value:28},{label:"SSS 1",value:56},{label:"SSS 2",value:14},{label:"SSS 3",value:10}]} color={C.purple}/>
            </Card>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Year-on-Year Enrollment Trend</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:14, height:110, paddingBottom:4 }}>
                {[{year:"2021/22",n:820},{year:"2022/23",n:940},{year:"2023/24",n:1060},{year:"2024/25",n:1180},{year:"2025/26",n:1284}].map((y,i)=>(
                  <div key={y.year} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.textMid }}>{y.n.toLocaleString()}</div>
                    <div style={{ width:"100%", background:i===4?C.accent:C.sky+"66", borderRadius:"5px 5px 0 0", height:Math.round(y.n/1284*86) }}/>
                    <div style={{ fontSize:9, color:C.textMuted }}>{y.year}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE NAVIGATOR — demo shell to preview all new modules
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
const Login = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) { setError("Email and password are required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await apiLogin(email, password);
      onSuccess();
    } catch (err) {
      setError(err?.message || "Login failed. Check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"Sora,sans-serif"}}>
      <style>{G}</style>
      <form onSubmit={submit} className="su" style={{background:C.surface,borderRadius:16,padding:"36px 32px",width:"100%",maxWidth:400,boxShadow:"0 24px 60px rgba(0,0,0,.25)"}}>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:6}}>
          <div style={{width:38,height:38,borderRadius:10,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>⚡</div>
          <span style={{fontSize:18,fontWeight:700,letterSpacing:"-.3px"}}>LearnersForge</span>
        </div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:24}}>Sign in to continue to your school dashboard.</div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Input label="Email" value={email} onChange={setEmail} placeholder="you@school.edu" type="email"/>
          <Input label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password"/>
        </div>

        {error && (
          <div style={{marginTop:14,padding:"9px 12px",borderRadius:8,background:C.coralLight,color:"#991B1B",fontSize:12,fontWeight:500}}>{error}</div>
        )}

        <Btn type="submit" variant="primary" size="lg" disabled={submitting} style={{width:"100%",marginTop:18,justifyContent:"center"}}>
          {submitting ? (
            <>
              <span style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",animation:"spin .8s linear infinite",display:"inline-block"}}/>
              Signing in…
            </>
          ) : "Sign In"}
        </Btn>

        <div style={{marginTop:16,textAlign:"center",fontSize:11,color:C.textMuted}}>
          Greenfield Academy · 2025/2026 Session
        </div>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('lf_token'));
  const [page,      setPage]      = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [school,    setSchool]    = useState(null);   // school name + logo for the app chrome

  useEffect(() => {
    const onUnauth = () => setAuthed(false);
    window.addEventListener('lf-unauthorized', onUnauth);
    return () => window.removeEventListener('lf-unauthorized', onUnauth);
  }, []);

  // Load the school's name/logo once signed in (refreshes when settings change via 'lf-school-updated').
  useEffect(() => {
    if (!authed) return;
    const load = () => getSchoolSettings().then(r => setSchool(r?.data ?? r)).catch(() => {});
    load();
    window.addEventListener('lf-school-updated', load);
    return () => window.removeEventListener('lf-school-updated', load);
  }, [authed]);

  const handleLogout = () => {
    localStorage.removeItem('lf_token');
    setAuthed(false);
    setPage("dashboard");
  };

  if (!authed) return <Login onSuccess={() => setAuthed(true)}/>;

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
    inventory:        <Inventory/>,
    library:          <Library/>,
    settings:         <Settings/>,
    admissions:       <Admissions/>,
    "academic-mgmt":  <AcademicMgmt/>,
    "student-extras": <StudentExtras/>,
    transport:        <Transport/>,
    certificates:     <Certificates/>,
    "multi-branch":   <MultiBranch/>,
    cms:              <SchoolCMS/>,
    hr:               <HRModule/>,
    cctv:             <CCTVModule/>,
    "online-learning":<OnlineLearning/>,
    communications:   <Communications/>,
    analytics:        <Analytics/>,
  };

  return (
    <>
      <style>{G}</style>
      <div style={{ display:"flex", minHeight:"100vh" }}>
        <Sidebar active={page} onNav={setPage} collapsed={collapsed} setCollapsed={setCollapsed} school={school}/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
          <Topbar page={page} onNav={setPage} onLogout={handleLogout} school={school}/>
          <main style={{ flex:1, padding:22, overflowY:"auto" }}>
            {PAGES[page] || <Dashboard onNav={setPage}/>}
          </main>
        </div>
      </div>
    </>
  );
}
