import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";

// ─── Constants ────────────────────────────────────────────────────
const RARITY = {
  "Common":         { label:"Común",       color:"#94a3b8", min:100,   max:300   },
  "Uncommon":       { label:"Infrecuente", color:"#4ade80", min:300,   max:800   },
  "Rare":           { label:"Rara",        color:"#facc15", min:800,   max:2500  },
  "Rare Holo":      { label:"Holo",        color:"#f59e0b", min:1500,  max:5000  },
  "Rare Holo EX":   { label:"EX",          color:"#fb923c", min:3000,  max:12000 },
  "Rare Holo V":    { label:"V",           color:"#c084fc", min:2500,  max:8000  },
  "Rare Holo VMAX": { label:"VMAX",        color:"#e879f9", min:4000,  max:15000 },
  "Rare Ultra":     { label:"Ultra Rare",  color:"#60a5fa", min:5000,  max:20000 },
  "Rare Secret":    { label:"Secret Rare", color:"#f43f5e", min:10000, max:50000 },
  "Unknown":        { label:"?",           color:"#475569", min:100,   max:300   },
};

function rd(r) {
  if (!r) return RARITY.Unknown;
  if (RARITY[r]) return RARITY[r];
  const l = r.toLowerCase();
  if (l.includes("secret")) return RARITY["Rare Secret"];
  if (l.includes("ultra"))  return RARITY["Rare Ultra"];
  if (l.includes("vmax")||l.includes("vstar")) return RARITY["Rare Holo VMAX"];
  if (l.includes(" v"))     return RARITY["Rare Holo V"];
  if (l.includes("ex"))     return RARITY["Rare Holo EX"];
  if (l.includes("holo"))   return RARITY["Rare Holo"];
  if (l.includes("rare"))   return RARITY["Rare"];
  if (l.includes("uncommon")) return RARITY["Uncommon"];
  if (l.includes("common")) return RARITY["Common"];
  return RARITY.Unknown;
}

const fclp  = n => `$${Number(n||0).toLocaleString("es-CL")}`;
const today = () => new Date().toISOString().split("T")[0];
const uid   = () => `c${Date.now()}${Math.random().toString(36).slice(2,5)}`;
const estCLP = r => { const d = rd(r); return Math.round((d.min + d.max) / 2); };

function getBestPrice(card, prices) {
  const p = prices?.[card.id];
  if (!p) return { value: estCLP(card.rarity), source: "est" };
  if (p.tcgmatch_clp) return { value: p.tcgmatch_clp, source: "tcgmatch" };
  if (p.tcg_clp_market) return { value: p.tcg_clp_market, source: "tcg" };
  return { value: estCLP(card.rarity), source: "est" };
}

const SRC        = { tcgmatch:{label:"tcgmatch",color:"#facc15"}, tcg:{label:"TCGPlayer",color:"#60a5fa"}, est:{label:"estimado",color:"#475569"} };
const INV_STATUS = { disponible:{label:"Disponible",color:"#4ade80"}, en_lote:{label:"En lote",color:"#facc15"}, vendida:{label:"Vendida",color:"#64748b"} };
const LOT_STATUS = { borrador:{label:"Borrador",color:"#64748b"}, publicado:{label:"Publicado",color:"#4ade80"}, vendido:{label:"Vendido",color:"#facc15"} };
const PLATFORMS  = ["Mercado Libre","eBay","Instagram","WhatsApp","Otro"];
const PLAT_CLR   = {"Mercado Libre":"#facc15","eBay":"#60a5fa","Instagram":"#e879f9","WhatsApp":"#4ade80","Otro":"#94a3b8"};

const SEED_INV = [
  {id:"s1",name:"Pikachu",   set:"Base Set",number:"58",rarity:"Common",   language:"Spanish",condition:"Near Mint",image:"",addedAt:"2026-04-20",status:"disponible",lotId:null},
  {id:"s2",name:"Charizard", set:"Base Set",number:"4", rarity:"Rare Holo",language:"English",condition:"Good",     image:"",addedAt:"2026-04-20",status:"disponible",lotId:null},
  {id:"s3",name:"Mewtwo",    set:"Base Set",number:"10",rarity:"Rare Holo",language:"English",condition:"Near Mint",image:"",addedAt:"2026-04-21",status:"disponible",lotId:null},
];

// ─── API (calls our /api/claude proxy) ───────────────────────────
async function callClaude(body) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, ...body }),
  });
  const d = await res.json();
  if (d.error) throw new Error(typeof d.error === "string" ? d.error : d.error.message || "Error API");
  return d;
}

async function identifyCards(base64, mimeType) {
  const d = await callClaude({
    system: "You are a Pokémon TCG card scanner. READ the EXACT text printed on each card.\n\nRULES:\n- Read the card NAME exactly as printed (top of card)\n- Read SET name from bottom of card\n- Read card NUMBER (e.g. 163/217) from bottom\n- Do NOT guess or invent names\n- Each card is a separate object\n\nReturn ONLY valid JSON:\n{\"cards\":[{\"name\":\"exact name\",\"set\":\"set name or ?\",\"number\":\"number or ?\",\"rarity\":\"Common|Uncommon|Rare|Rare Holo|Rare Holo EX|Rare Holo V|Rare Holo VMAX|Rare Ultra|Rare Secret\",\"language\":\"English|Spanish|Japanese|Other\",\"condition\":\"Mint|Near Mint|Good|Played|Poor\"}]}\n\nIf no cards visible return {\"cards\":[]}.",
Return ONLY valid JSON: {"cards":[{"name":"...","set":"...","number":"...","rarity":"Common|Uncommon|Rare|Rare Holo|Rare Holo EX|Rare Holo V|Rare Holo VMAX|Rare Ultra|Rare Secret","language":"English|Spanish|Japanese|Other","condition":"Mint|Near Mint|Good|Played|Poor"}]}
If no cards, return {"cards":[]}.`,
    messages: [{role:"user",content:[
      {type:"image",source:{type:"base64",media_type:mimeType,data:base64}},
      {type:"text",text:"Identify ALL Pokémon cards visible in this image. There may be multiple cards. List each one separately."}
    ]}]
  });
  const t = d.content?.find(b=>b.type==="text")?.text || "{}";
  return JSON.parse(t.replace(/```json|```/g,"").trim());
}

async function enrichCard(name) {
  try {
    const q = encodeURIComponent(name.split(" ")[0]);
    const r = await fetch(`https://apitcg.com/api/pokemon/cards?name=${q}`);
    if (!r.ok) return null;
    const data = await r.json();
    const cards = data.data || [];
    if (!cards.length) return null;
    const nl = name.toLowerCase();
    const m = cards.find(c=>c.name?.toLowerCase()===nl) || cards.find(c=>c.name?.toLowerCase().includes(nl.split(" ")[0])) || cards[0];
    return { officialName:m.name, rarity:m.rarity, set:m.set?.name||"?", number:m.number, image:m.images?.small||null, types:m.types||[] };
  } catch { return null; }
}

async function fetchPricesWithClaude(cards) {
  const list = cards.map((c,i)=>`${i+1}. ${c.name}|${c.set||"?"}|${c.rarity||"?"}|${c.language||"Spanish"}`).join("\n");
  const d = await callClaude({
    max_tokens: 800,
    system: `Pokémon TCG pricing expert. Return ONLY JSON array, no markdown.
Format: [{"i":1,"usd":X.XX,"clp":XXXXX,"src":"tcgplayer|estimate","conf":"h|m|l"}]
TCGPlayer market prices, 950 CLP per USD. Rarity: Common $0.10, Uncommon $0.25, Rare $1, Holo $4, EX/V $8, VMAX $12, Ultra $20, Secret $40.`,
    messages: [{role:"user",content:`Price these cards:\n${list}`}]
  });
  const t = d.content?.find(b=>b.type==="text")?.text || "[]";
  try { return JSON.parse(t.replace(/```(?:json)?|```/g,"").trim()); } catch { return []; }
}

// ─── Local storage helpers ────────────────────────────────────────
const KEYS = { inv:"bulk-inv", lots:"bulk-lots", sales:"bulk-sales", prices:"bulk-prices" };
const ls = {
  get: k => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):null; } catch { return null; } },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },
};

// ─── CardArt SVG ──────────────────────────────────────────────────
function CardArt({ card, size=48 }) {
  const [err, setErr] = useState(false);
  const rdata = rd(card?.rarity);
  const TYPE_CLR = {"Fire":"#fb923c","Water":"#60a5fa","Grass":"#4ade80","Electric":"#facc15","Psychic":"#e879f9","Fighting":"#f87171","Darkness":"#94a3b8","Metal":"#cbd5e1","Dragon":"#818cf8"};
  const tc = (card?.types?.[0] && TYPE_CLR[card.types[0]]) || rdata.color;
  const h  = Math.round(size * 1.4);
  const nm = (card?.officialName || card?.name || "?").slice(0, 12);
  if (card?.image && !err) return (
    <img src={card.image} alt={nm} width={size} height={h}
      style={{objectFit:"cover",borderRadius:6,flexShrink:0}}
      onError={()=>setErr(true)}/>
  );
  return (
    <svg viewBox="0 0 100 140" width={size} height={h} style={{flexShrink:0}}>
      <defs><linearGradient id={`g${card?.id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={tc} stopOpacity=".25"/>
        <stop offset="100%" stopColor={tc} stopOpacity=".05"/>
      </linearGradient></defs>
      <rect width="100" height="140" rx="8" fill={`url(#g${card?.id})`} stroke={`${tc}55`} strokeWidth="2"/>
      <circle cx="50" cy="55" r="25" fill={`${tc}15`} stroke={`${tc}40`} strokeWidth="1.5"/>
      <circle cx="50" cy="55" r="8" fill={`${tc}50`} stroke={`${tc}70`} strokeWidth="1.5"/>
      <line x1="25" y1="55" x2="75" y2="55" stroke={`${tc}35`} strokeWidth="1.5"/>
      <text x="50" y="100" textAnchor="middle" fontSize="9" fontFamily="system-ui" fill={tc} fontWeight="700">{nm}</text>
      <text x="50" y="113" textAnchor="middle" fontSize="6" fontFamily="system-ui" fill={`${tc}90`}>{rdata.label}</text>
    </svg>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────
function Sheet({ open, onClose, title, children, height="85vh" }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200}}/>
      <div style={{position:"fixed",bottom:0,left:0,right:0,height,background:"#0f1520",borderRadius:"20px 20px 0 0",border:"1px solid rgba(250,204,21,.15)",zIndex:201,display:"flex",flexDirection:"column",animation:"slideUp .28s cubic-bezier(.16,1,.3,1)"}}>
        <div style={{padding:"12px 20px 0"}}>
          <div style={{width:40,height:4,borderRadius:2,background:"rgba(255,255,255,.2)",margin:"0 auto 12px"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,.07)"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:1,color:"#facc15"}}>{title}</div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.07)",border:"none",color:"#94a3b8",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:14}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px 40px"}}>{children}</div>
      </div>
    </>
  );
}

// ─── Toast ────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{position:"fixed",bottom:84,left:16,right:16,background:type==="warn"?"rgba(239,68,68,.95)":"rgba(15,21,32,.97)",border:`1px solid ${type==="warn"?"rgba(239,68,68,.5)":"rgba(250,204,21,.3)"}`,color:type==="warn"?"#fca5a5":"#facc15",borderRadius:14,padding:"13px 18px",fontSize:13,zIndex:300,animation:"slideUp .25s ease",textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,.7)"}}>
      {msg}
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────
const iStyle = {width:"100%",background:"rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.12)",color:"#e2e8f0",borderRadius:10,padding:"13px 14px",fontSize:15,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
function Inp({label,...p}) { return <div style={{marginBottom:14}}>{label&&<div style={{fontSize:11,color:"#64748b",marginBottom:5}}>{label}</div>}<input style={iStyle} {...p}/></div>; }
function Sel({label,children,...p}) { return <div style={{marginBottom:14}}>{label&&<div style={{fontSize:11,color:"#64748b",marginBottom:5}}>{label}</div>}<select style={iStyle} {...p}>{children}</select></div>; }
function Btn({children,variant="primary",...p}) {
  return <button style={{width:"100%",border:"none",borderRadius:14,padding:"15px",fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:10,background:variant==="primary"?"linear-gradient(135deg,#facc15,#f59e0b)":variant==="danger"?"rgba(239,68,68,.12)":"rgba(255,255,255,.06)",color:variant==="primary"?"#090d12":variant==="danger"?"#f87171":"#e2e8f0",border:variant==="danger"?"1px solid rgba(239,68,68,.25)":variant==="ghost"?"1px solid rgba(255,255,255,.1)":"none",opacity:p.disabled?.5:1}} {...p}>{children}</button>;
}

// ═══════════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════════
export default function Home() {
  const [tab, setTab]       = useState("home");
  const [inv, setInv]       = useState([]);
  const [lots, setLots]     = useState([]);
  const [sales, setSales]   = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast]   = useState(null);

  const showToast = useCallback((msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),2500); }, []);
  const saveInv    = v => { setInv(v);    ls.set(KEYS.inv,v); };
  const saveLots   = v => { setLots(v);   ls.set(KEYS.lots,v); };
  const saveSales  = v => { setSales(v);  ls.set(KEYS.sales,v); };
  const savePrices = v => { setPrices(v); ls.set(KEYS.prices,v); };

  useEffect(() => {
    setInv(ls.get(KEYS.inv) || SEED_INV);
    setLots(ls.get(KEYS.lots) || []);
    setSales(ls.get(KEYS.sales) || []);
    setPrices(ls.get(KEYS.prices) || {});
    setLoading(false);
  }, []);

  const sh = {inv,lots,sales,prices,saveInv,saveLots,saveSales,savePrices,showToast};
  const NAV = [{id:"home",icon:"⚡",label:"Inicio"},{id:"scan",icon:"📷",label:"Scan"},{id:"stock",icon:"📦",label:"Stock"},{id:"lots",icon:"🧩",label:"Lotes"},{id:"sales",icon:"💰",label:"Ventas"}];

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#090d12",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#facc15,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>⚡</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,color:"#facc15"}}>BULK MANAGER</div>
      <div style={{width:20,height:20,border:"2px solid #1e293b",borderTopColor:"#facc15",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    </div>
  );

  return (
    <>
      <Head>
        <title>Bulk Manager — Pokémon TCG</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <meta name="theme-color" content="#090d12"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <link rel="icon" href="/favicon.ico"/>
      </Head>

      <div style={{minHeight:"100vh",background:"#090d12",paddingBottom:72}}>
        {tab==="home"  && <HomeTab  {...sh} setTab={setTab}/>}
        {tab==="scan"  && <ScanTab  {...sh}/>}
        {tab==="stock" && <StockTab {...sh}/>}
        {tab==="lots"  && <LotsTab  {...sh}/>}
        {tab==="sales" && <SalesTab {...sh}/>}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,height:68,background:"rgba(9,13,18,.98)",borderTop:"1px solid rgba(250,204,21,.12)",display:"flex",zIndex:100,backdropFilter:"blur(20px)"}}>
        {NAV.map(n => {
          const a = tab===n.id;
          return (
            <button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"none",border:"none",cursor:"pointer",color:a?"#facc15":"#475569",padding:"8px 0"}}>
              <span style={{fontSize:a?24:20}}>{n.icon}</span>
              <span style={{fontSize:10,fontWeight:a?700:400}}>{n.label}</span>
              {a && <div style={{width:4,height:4,borderRadius:"50%",background:"#facc15"}}/>}
            </button>
          );
        })}
      </nav>
      <Toast {...(toast||{msg:null})}/>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  HOME TAB
// ═══════════════════════════════════════════════════════════════════
function HomeTab({inv,lots,sales,prices,setTab}) {
  const rev   = sales.reduce((s,x)=>s+(+x.salePrice||0),0);
  const avail = inv.filter(c=>c.status==="disponible").length;
  const pub   = lots.filter(l=>l.status==="publicado").length;
  const val   = inv.reduce((s,c)=>s+getBestPrice(c,prices).value,0);
  return (
    <div style={{padding:"52px 16px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#facc15,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 0 24px rgba(250,204,21,.35)"}}>⚡</div>
        <div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:3,color:"#facc15",lineHeight:1}}>BULK MANAGER</div>
          <div style={{fontSize:11,color:"#475569"}}>Pokémon TCG · Chile</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[{icon:"💵",label:"Ingresos",value:fclp(rev),color:"#4ade80"},{icon:"📦",label:"Disponibles",value:avail,color:"#facc15"},{icon:"📢",label:"En venta",value:pub,color:"#60a5fa"},{icon:"🗃️",label:"Valor stock",value:fclp(val),color:"#e879f9"}].map((k,i)=>(
          <div key={i} style={{background:"rgba(13,17,23,.95)",border:`1px solid ${k.color}22`,borderRadius:16,padding:"16px 14px"}}>
            <div style={{fontSize:22,marginBottom:8}}>{k.icon}</div>
            <div style={{fontFamily:"monospace",fontSize:20,color:k.color,fontWeight:700,marginBottom:2}}>{k.value}</div>
            <div style={{fontSize:11,color:"#475569"}}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:12,color:"#475569",marginBottom:10,fontWeight:600,letterSpacing:1}}>ACCIONES RÁPIDAS</div>
      {[{icon:"📷",label:"Escanear cartas",sub:"Cámara o galería directa",tab:"scan",color:"#facc15"},{icon:"📦",label:"Ver inventario",sub:`${inv.length} cartas`,tab:"stock",color:"#4ade80"},{icon:"🧩",label:"Armar lotes",sub:`${avail} disponibles`,tab:"lots",color:"#60a5fa"},{icon:"💰",label:"Registrar venta",sub:`${pub} publicados`,tab:"sales",color:"#e879f9"}].map(a=>(
        <button key={a.tab} onClick={()=>setTab(a.tab)} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"16px",background:"rgba(13,17,23,.95)",border:`1px solid ${a.color}18`,borderRadius:16,marginBottom:10,cursor:"pointer",textAlign:"left"}}>
          <div style={{width:48,height:48,borderRadius:12,background:`${a.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{a.icon}</div>
          <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"#e2e8f0"}}>{a.label}</div><div style={{fontSize:12,color:"#475569",marginTop:2}}>{a.sub}</div></div>
          <span style={{color:"#475569",fontSize:20}}>›</span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SCAN TAB — REAL FILE INPUT (works outside iframe!)
// ═══════════════════════════════════════════════════════════════════
function ScanTab({inv, saveInv, showToast}) {
  const [imgData, setImgData]   = useState(null);
  const [phase, setPhase]       = useState("idle");
  const [progress, setProgress] = useState({current:0,total:0});
  const [scanned, setScanned]   = useState(null);
  const [error, setError]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [showListing, setShowListing] = useState(false);
  const cameraRef  = useRef();
  const galleryRef = useRef();

  const loadFile = useCallback(file => {
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const MAX = 1200;
    let w = img.width, h = img.height;
    if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
    if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    const compressed = canvas.toDataURL("image/jpeg", 0.85);
    setImgData({ base64: compressed.split(",")[1], type: "image/jpeg", preview: compressed });
    setScanned(null); setError(null); setPhase("idle"); setSaved(false);
  };
  img.src = e.target.result;
};

  const reset = () => { setImgData(null); setPhase("idle"); setScanned(null); setError(null); setSaved(false); };

  const scan = async () => {
    if (!imgData) return;
    setError(null); setScanned(null); setPhase("vision");
    let vr;
    try { vr = await identifyCards(imgData.base64, imgData.type); }
    catch(e) { setError(e.message); setPhase("idle"); return; }
    const identified = vr.cards || [];
    if (!identified.length) { setScanned([]); setPhase("done"); return; }
    setPhase("enriching"); setProgress({current:0, total:identified.length});
    const enriched = [];
    for (let i=0; i<identified.length; i++) {
      setProgress({current:i+1, total:identified.length});
      const base = identified[i];
      const api  = await enrichCard(base.name);
      enriched.push({...base, id:uid(), rarity:api?.rarity||base.rarity||"Unknown", officialName:api?.officialName||base.name, officialSet:api?.set||base.set||"?", number:api?.number||base.number||"?", image:api?.image||null, types:api?.types||[], addedAt:today(), status:"disponible", lotId:null, enriched:!!api});
    }
    setScanned(enriched); setPhase("done");
  };

  const save = async () => {
    if (!scanned?.length) return;
    setSaving(true);
    saveInv([...scanned, ...inv]);
    setSaving(false); setSaved(true);
    showToast(`${scanned.length} cartas guardadas ✓`);
  };

  const isScanning = phase==="vision" || phase==="enriching";
  const totalMin   = scanned?.reduce((s,c)=>s+rd(c.rarity).min,0) || 0;
  const totalMax   = scanned?.reduce((s,c)=>s+rd(c.rarity).max,0) || 0;

  return (
    <div style={{padding:"52px 16px 16px"}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#facc15",marginBottom:2}}>📷 SCANNER IA</div>
      <div style={{fontSize:12,color:"#475569",marginBottom:20}}>Claude Vision + apitcg.com</div>

      {/* ── Upload zone ── */}
      {!imgData && (
        <div style={{background:"rgba(13,17,23,.95)",border:"2px dashed rgba(250,204,21,.3)",borderRadius:18,padding:24,marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:12,opacity:.5}}>📷</div>
          <div style={{fontSize:14,color:"#94a3b8",marginBottom:20}}>Selecciona una foto de tus cartas</div>
          <div style={{display:"flex",gap:12,justifyContent:"center"}}>
            {/* REAL file inputs — work in real browser */}
            <button onClick={()=>cameraRef.current.click()} style={{background:"linear-gradient(135deg,#facc15,#f59e0b)",color:"#090d12",border:"none",borderRadius:14,padding:"14px 24px",fontSize:15,fontWeight:700,cursor:"pointer"}}>📷 Cámara</button>
            <button onClick={()=>galleryRef.current.click()} style={{background:"rgba(255,255,255,.08)",color:"#e2e8f0",border:"1px solid rgba(255,255,255,.15)",borderRadius:14,padding:"14px 24px",fontSize:15,cursor:"pointer"}}>🖼️ Galería</button>
          </div>
          <input ref={cameraRef}  type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>loadFile(e.target.files?.[0])}/>
          <input ref={galleryRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>loadFile(e.target.files?.[0])}/>
          {error && <div style={{marginTop:14,fontSize:12,color:"#fca5a5"}}>{error}</div>}
        </div>
      )}

      {/* ── Preview ── */}
      {imgData && !isScanning && phase!=="done" && (
        <>
          <div style={{borderRadius:16,overflow:"hidden",marginBottom:12,background:"#000",maxHeight:280,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <img src={imgData.preview} alt="preview" style={{width:"100%",maxHeight:280,objectFit:"contain"}}/>
          </div>
          {error && <div style={{background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",borderRadius:12,padding:"12px 16px",fontSize:13,color:"#fca5a5",marginBottom:10}}>{error}</div>}
          <button onClick={scan} style={{width:"100%",background:"linear-gradient(135deg,#facc15,#f59e0b)",color:"#090d12",border:"none",borderRadius:16,padding:"16px",fontSize:18,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:2,cursor:"pointer",marginBottom:10}}>⚡ ESCANEAR CARTAS</button>
          <button onClick={reset} style={{width:"100%",background:"transparent",border:"1px solid rgba(255,255,255,.1)",color:"#94a3b8",borderRadius:12,padding:"11px",fontSize:14,cursor:"pointer"}}>↩ Cambiar imagen</button>
        </>
      )}

      {/* ── Scanning ── */}
      {isScanning && (
        <div style={{background:"rgba(13,17,23,.95)",border:"1px solid rgba(250,204,21,.2)",borderRadius:16,padding:18,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#64748b",marginBottom:10}}>
            <span>{phase==="vision"?"🔍 Analizando imagen...":"⚡ Consultando apitcg.com..."}</span>
            {phase==="enriching" && <span>{progress.current}/{progress.total}</span>}
          </div>
          <div style={{height:6,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#facc15,#f59e0b)",borderRadius:3,transition:"width .3s",width:phase==="vision"?"35%":`${progress.total?Math.round((progress.current/progress.total)*100):0}%`}}/>
          </div>
          {imgData?.preview && <img src={imgData.preview} alt="" style={{width:"100%",maxHeight:140,objectFit:"contain",borderRadius:10,marginTop:14,opacity:.5}}/>}
        </div>
      )}

      {/* ── Results ── */}
      {phase==="done" && scanned && (
        <>
          {scanned.length===0 ? (
            <div style={{textAlign:"center",padding:24,color:"#64748b"}}>
              <div style={{fontSize:32,marginBottom:8}}>🤔</div>
              No se detectaron cartas Pokémon
              <br/><button onClick={reset} style={{marginTop:12,background:"rgba(250,204,21,.1)",border:"1px solid rgba(250,204,21,.2)",color:"#facc15",borderRadius:10,padding:"10px 20px",fontSize:13,cursor:"pointer"}}>↩ Intentar de nuevo</button>
            </div>
          ) : (
            <>
              <div style={{background:"rgba(74,222,128,.06)",border:"1px solid rgba(74,222,128,.2)",borderRadius:14,padding:14,marginBottom:12,display:"flex",gap:12}}>
                {[{l:"Cartas",v:scanned.length,c:"#facc15"},{l:"Mín CLP",v:fclp(totalMin),c:"#4ade80"},{l:"Máx CLP",v:fclp(totalMax),c:"#60a5fa"}].map(s=>(
                  <div key={s.l} style={{flex:1,textAlign:"center"}}>
                    <div style={{fontFamily:"monospace",fontSize:18,color:s.c,fontWeight:700}}>{s.v}</div>
                    <div style={{fontSize:10,color:"#475569"}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                {scanned.map((card,i)=>{
                  const r=rd(card.rarity);
                  return (
                    <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",background:"rgba(13,17,23,.95)",border:`1px solid ${r.color}22`,borderRadius:14,alignItems:"center"}}>
                      <CardArt card={card} size={44}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{card.officialName||card.name}</div>
                        <div style={{fontSize:11,color:"#475569",marginTop:1}}>{card.officialSet}{card.number&&card.number!=="?"?` #${card.number}`:""}</div>
                        <div style={{display:"flex",gap:5,marginTop:5}}>
                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:`${r.color}22`,color:r.color}}>{r.label}</span>
                          {card.enriched&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:"rgba(74,222,128,.12)",color:"#4ade80"}}>✓ apitcg</span>}
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontFamily:"monospace",fontSize:13,color:"#facc15",fontWeight:700}}>{fclp(r.min)}</div>
                        <div style={{fontSize:9,color:"#475569"}}>est</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!saved ? (
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>setShowListing(true)} style={{flex:1,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"#e2e8f0",borderRadius:14,padding:"14px",fontSize:14,cursor:"pointer"}}>📋 Listing</button>
                  <button onClick={save} disabled={saving} style={{flex:2,background:"linear-gradient(135deg,#facc15,#f59e0b)",color:"#090d12",border:"none",borderRadius:14,padding:"14px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                    {saving?"Guardando...":"📦 Guardar"}
                  </button>
                </div>
              ) : (
                <div style={{background:"rgba(74,222,128,.08)",border:"1px solid rgba(74,222,128,.3)",borderRadius:14,padding:20,textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:6}}>✅</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#4ade80",letterSpacing:1,marginBottom:14}}>{scanned.length} CARTAS GUARDADAS</div>
                  <button onClick={reset} style={{background:"rgba(250,204,21,.1)",border:"1px solid rgba(250,204,21,.3)",color:"#facc15",borderRadius:12,padding:"12px 24px",fontSize:14,cursor:"pointer",fontWeight:600}}>📷 Escanear más</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <Sheet open={showListing} onClose={()=>setShowListing(false)} title="LISTING" height="65vh">
        {scanned?.length>0&&(()=>{const byR={};scanned.forEach(c=>{const l=rd(c.rarity).label;byR[l]=(byR[l]||0)+1;});const text=`Lote ${scanned.length} cartas Pokémon bulk\n\nComposición:\n${Object.entries(byR).map(([r,n])=>`• ${n}x ${r}`).join("\n")}\n\nCartas revisadas. Envío a todo Chile.\n💰 ${fclp(totalMin)}–${fclp(totalMax)} CLP\n📍 Ref: tcgmatch.cl`;return(<><div style={{background:"rgba(0,0,0,.4)",border:"1px solid rgba(250,204,21,.15)",borderRadius:12,padding:14,marginBottom:14}}><pre style={{fontSize:13,color:"#94a3b8",whiteSpace:"pre-wrap",lineHeight:1.7}}>{text}</pre></div><Btn onClick={()=>{navigator.clipboard.writeText(text);showToast("Copiado ✓");setShowListing(false);}}>📋 Copiar</Btn></>);})()} 
      </Sheet>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  STOCK TAB
// ═══════════════════════════════════════════════════════════════════
function StockTab({inv,prices,saveInv,savePrices,showToast}) {
  const [search,setSearch]   = useState("");
  const [detail,setDetail]   = useState(null);
  const [showAdd,setShowAdd] = useState(false);
  const [showPrice,setShowPrice] = useState(false);
  const [newCard,setNewCard] = useState({name:"",set:"",number:"",rarity:"Common",language:"Spanish",condition:"Near Mint"});
  const [saving,setSaving]   = useState(false);
  const [manualPrice,setManualPrice] = useState("");
  const [fetchingP,setFetchingP] = useState(false);

  const filtered = inv.filter(c=>{const q=search.toLowerCase();return !q||c.name?.toLowerCase().includes(q)||c.set?.toLowerCase().includes(q);});
  const avail = inv.filter(c=>c.status==="disponible").length;
  const val   = inv.reduce((s,c)=>s+getBestPrice(c,prices).value,0);

  const addCard=()=>{if(!newCard.name.trim())return;setSaving(true);saveInv([{...newCard,id:uid(),addedAt:today(),status:"disponible",lotId:null,image:""},...inv]);setNewCard({name:"",set:"",number:"",rarity:"Common",language:"Spanish",condition:"Near Mint"});setShowAdd(false);setSaving(false);showToast("Carta agregada ✓");};
  const chgSt=async(id,s)=>{saveInv(inv.map(c=>c.id===id?{...c,status:s}:c));setDetail(p=>p?.id===id?{...p,status:s}:p);showToast("Estado actualizado");};
  const delC=(id)=>{saveInv(inv.filter(c=>c.id!==id));setDetail(null);showToast("Eliminada","warn");};
  const fetchP=async(card)=>{setFetchingP(true);try{const r=await fetchPricesWithClaude([card]);const p=r[0];if(p?.clp){savePrices({...prices,[card.id]:{source:"tcg",tcg_clp_market:p.clp,tcg_market:p.usd,confidence:p.conf,fetchedAt:today()}});showToast(`${fclp(p.clp)} ✓`);}else showToast("Sin precio","warn");}catch{showToast("Error","warn");}setFetchingP(false);};
  const saveM=(id)=>{const v=parseFloat(String(manualPrice).replace(/\D/g,""));if(!v)return;savePrices({...prices,[id]:{...prices[id]||{},tcgmatch_clp:v,source:"tcgmatch",fetchedAt:today()}});setManualPrice("");setShowPrice(false);showToast("Precio guardado ✓");};

  return (
    <div style={{padding:"52px 16px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#facc15"}}>📦 INVENTARIO</div><div style={{fontSize:12,color:"#475569"}}>{avail} disponibles · {fclp(val)}</div></div>
        <button onClick={()=>setShowAdd(true)} style={{background:"linear-gradient(135deg,#facc15,#f59e0b)",color:"#090d12",border:"none",borderRadius:12,padding:"10px 16px",fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:1,cursor:"pointer"}}>+ CARTA</button>
      </div>
      <input placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{...iStyle,marginBottom:14}}/>
      {filtered.length===0
        ?<div style={{textAlign:"center",padding:48,color:"#475569",opacity:.5}}><div style={{fontSize:36,marginBottom:8}}>📭</div>Sin cartas</div>
        :filtered.map(card=>{const r=rd(card.rarity);const best=getBestPrice(card,prices);const src=SRC[best.source];return(
          <button key={card.id} onClick={()=>setDetail(card)} style={{width:"100%",display:"flex",gap:12,padding:"12px",background:"rgba(13,17,23,.95)",border:`1px solid ${r.color}18`,borderRadius:14,marginBottom:8,cursor:"pointer",textAlign:"left",alignItems:"center"}}>
            <CardArt card={card} size={44}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{card.officialName||card.name}</div>
              <div style={{fontSize:11,color:"#475569",marginTop:1}}>{card.set}</div>
              <div style={{display:"flex",gap:5,marginTop:4}}>
                <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:`${r.color}20`,color:r.color}}>{r.label}</span>
                <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:`${INV_STATUS[card.status]?.color}18`,color:INV_STATUS[card.status]?.color}}>{INV_STATUS[card.status]?.label}</span>
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontFamily:"monospace",fontSize:14,color:src.color,fontWeight:700}}>{fclp(best.value)}</div>
              <div style={{fontSize:9,color:"#475569"}}>{src.label}</div>
            </div>
          </button>
        );}
      )}

      <Sheet open={!!detail} onClose={()=>setDetail(null)} title={detail?.officialName||detail?.name||""} height="90vh">
        {detail&&(()=>{const r=rd(detail.rarity);const best=getBestPrice(detail,prices);const src=SRC[best.source];return(<>
          <div style={{display:"flex",justifyContent:"center",marginBottom:18}}><CardArt card={detail} size={90}/></div>
          {[["Set",detail.set+(detail.number&&detail.number!=="?"?` #${detail.number}`:"")],["Rareza",<span style={{color:r.color}}>{r.label}</span>],["Idioma",detail.language],["Condición",detail.condition],["Estado",<span style={{color:INV_STATUS[detail.status]?.color}}>{INV_STATUS[detail.status]?.label}</span>]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:"1px solid rgba(255,255,255,.06)"}}><span style={{fontSize:13,color:"#475569"}}>{k}</span><span style={{fontSize:13,color:"#e2e8f0",fontWeight:600}}>{v}</span></div>
          ))}
          <div style={{marginTop:14,background:`${src.color}10`,border:`1px solid ${src.color}30`,borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:"#475569"}}>Mejor precio</span><span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:`${src.color}22`,color:src.color}}>{src.label}</span></div>
            <div style={{fontFamily:"monospace",fontSize:24,color:src.color,fontWeight:700}}>{fclp(best.value)}</div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button onClick={()=>{setShowPrice(true);setManualPrice(prices[detail.id]?.tcgmatch_clp||"");}} style={{flex:1,background:"rgba(250,204,21,.08)",border:"1px solid rgba(250,204,21,.2)",color:"#facc15",borderRadius:12,padding:"11px",fontSize:13,cursor:"pointer"}}>✏️ tcgmatch</button>
            <button onClick={()=>fetchP(detail)} disabled={fetchingP} style={{flex:1,background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.2)",color:"#60a5fa",borderRadius:12,padding:"11px",fontSize:13,cursor:"pointer"}}>{fetchingP?"...":"⚡ TCGPlayer"}</button>
          </div>
          <div style={{fontSize:12,color:"#475569",marginBottom:8}}>Estado</div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>{Object.entries(INV_STATUS).map(([k,v])=><button key={k} onClick={()=>chgSt(detail.id,k)} style={{flex:1,padding:"10px 4px",borderRadius:10,cursor:"pointer",border:"none",fontSize:11,fontWeight:600,background:detail.status===k?`${v.color}25`:"rgba(255,255,255,.05)",color:detail.status===k?v.color:"#64748b",outline:detail.status===k?`1.5px solid ${v.color}50`:"none"}}>{v.label}</button>)}</div>
          <Btn variant="danger" onClick={()=>delC(detail.id)}>🗑 Eliminar</Btn>
        </>);})()} 
      </Sheet>

      <Sheet open={showPrice} onClose={()=>setShowPrice(false)} title="PRECIO TCGMATCH" height="50vh">
        {detail&&(<>
          <Inp label="Precio en CLP" type="number" placeholder="Ej: 3500" value={manualPrice} onChange={e=>setManualPrice(e.target.value)}/>
          <a href={`https://tcgmatch.cl/cartas/pokemon?q=${encodeURIComponent(detail?.name||"")}`} target="_blank" rel="noreferrer" style={{display:"block",textAlign:"center",color:"#facc15",fontSize:13,marginBottom:14,textDecoration:"none"}}>🔗 Ver en tcgmatch.cl →</a>
          <Btn onClick={()=>saveM(detail.id)}>GUARDAR</Btn>
        </>)}
      </Sheet>

      <Sheet open={showAdd} onClose={()=>setShowAdd(false)} title="AGREGAR CARTA" height="90vh">
        <Inp label="Nombre *" placeholder="Ej: Pikachu" value={newCard.name} onChange={e=>setNewCard(p=>({...p,name:e.target.value}))}/>
        <Inp label="Set" placeholder="Ej: Base Set" value={newCard.set} onChange={e=>setNewCard(p=>({...p,set:e.target.value}))}/>
        <Inp label="Número" placeholder="58" value={newCard.number} onChange={e=>setNewCard(p=>({...p,number:e.target.value}))}/>
        <Sel label="Rareza" value={newCard.rarity} onChange={e=>setNewCard(p=>({...p,rarity:e.target.value}))}>{Object.keys(RARITY).filter(r=>r!=="Unknown").map(r=><option key={r} value={r}>{RARITY[r].label}</option>)}</Sel>
        <Sel label="Idioma" value={newCard.language} onChange={e=>setNewCard(p=>({...p,language:e.target.value}))}>{["Spanish","English","Japanese","Other"].map(l=><option key={l}>{l}</option>)}</Sel>
        <Sel label="Condición" value={newCard.condition} onChange={e=>setNewCard(p=>({...p,condition:e.target.value}))}>{["Mint","Near Mint","Good","Played","Poor"].map(c=><option key={c}>{c}</option>)}</Sel>
        <Btn onClick={addCard} disabled={saving||!newCard.name.trim()}>{saving?"GUARDANDO...":"GUARDAR CARTA"}</Btn>
      </Sheet>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  LOTS TAB
// ═══════════════════════════════════════════════════════════════════
function LotsTab({inv,lots,saveInv,saveLots,showToast}) {
  const [view,setView]      = useState("list");
  const [strat,setStrat]    = useState("balanced");
  const [minC,setMinC]      = useState(5);
  const [maxC,setMaxC]      = useState(20);
  const [preview,setPreview]= useState([]);
  const [building,setBuilding]=useState(false);
  const [detail,setDetail]  = useState(null);
  const [saving,setSaving]  = useState(false);

  const avail = inv.filter(c=>c.status==="disponible");
  const mkLot=(cards,n)=>{const min=cards.reduce((s,c)=>s+rd(c.rarity).min,0),max=cards.reduce((s,c)=>s+rd(c.rarity).max,0),rb={};cards.forEach(c=>{const l=rd(c.rarity).label;rb[l]=(rb[l]||0)+1;});return{id:`L${String(n).padStart(3,"0")}`,name:`Lote Bulk #${n}`,strategy:strat,cards:[...cards],cardIds:cards.map(c=>c.id),minVal:min,maxVal:max,suggestedPrice:Math.round((min+max)/2/100)*100,rarityBreak:rb,createdAt:today(),status:"borrador"};};
  const doBuild=()=>{setBuilding(true);setTimeout(()=>{let p=[...avail];const res=[];let n=lots.length+1;if(strat==="balanced"){while(p.length>=minC){const lot=[];p.sort((a,b)=>(rd(b.rarity).points||1)-(rd(a.rarity).points||1));const anc=p.find(c=>(rd(c.rarity).points||1)>=5)||p[0];if(anc){lot.push(anc);p=p.filter(c=>c.id!==anc.id);}for(const f of p.filter(c=>(rd(c.rarity).points||1)<=2)){if(lot.length>=maxC)break;lot.push(f);p=p.filter(c=>c.id!==f.id);}if(lot.length>=minC)res.push(mkLot(lot,n++));else break;}}else if(strat==="bulk"){let fp=p.filter(c=>(rd(c.rarity).points||1)<=2);while(fp.length>=minC){const ch=fp.splice(0,maxC);if(ch.length>=minC)res.push(mkLot(ch,n++));}}else if(strat==="rare_mix"){let rp=p.filter(c=>(rd(c.rarity).points||1)>=5),cp=p.filter(c=>(rd(c.rarity).points||1)<5);while(rp.length>0&&cp.length>=minC-1){const lot=[rp.shift(),...cp.splice(0,Math.min(maxC-1,cp.length))];if(lot.length>=minC)res.push(mkLot(lot,n++));}}else{const bl={};p.forEach(c=>{(bl[c.language]=bl[c.language]||[]).push(c);});Object.values(bl).forEach(lc=>{let lp=[...lc];while(lp.length>=minC){const ch=lp.splice(0,maxC);if(ch.length>=minC)res.push(mkLot(ch,n++));}});}setPreview(res);setBuilding(false);},600);};
  const doSave=()=>{setSaving(true);const ids=new Set(preview.flatMap(l=>l.cardIds));saveLots([...lots,...preview]);saveInv(inv.map(c=>ids.has(c.id)?{...c,status:"en_lote",lotId:preview.find(l=>l.cardIds.includes(c.id))?.id}:c));setPreview([]);setView("list");setSaving(false);showToast(`${preview.length} lotes guardados ✓`);};
  const delLot=id=>{const lot=lots.find(l=>l.id===id);saveLots(lots.filter(l=>l.id!==id));saveInv(inv.map(c=>lot?.cardIds.includes(c.id)?{...c,status:"disponible",lotId:null}:c));setDetail(null);showToast("Lote eliminado","warn");};
  const chgSt=(id,s)=>{saveLots(lots.map(l=>l.id===id?{...l,status:s}:l));setDetail(p=>p?.id===id?{...p,status:s}:p);showToast("Estado actualizado");};
  const STRATS=[{id:"balanced",icon:"⚖️",label:"Balanceado",desc:"Mezcla rarezas"},{id:"bulk",icon:"📦",label:"Bulk puro",desc:"Solo comunes"},{id:"rare_mix",icon:"✨",label:"Rares mix",desc:"1 rara por lote"},{id:"language",icon:"🌐",label:"Por idioma",desc:"Separa idiomas"}];
  const ICO={"balanced":"⚖️","bulk":"📦","common_bulk":"📦","rare_mix":"✨","language":"🌐"};
  const RC={"Común":"#94a3b8","Infrecuente":"#4ade80","Rara":"#facc15","Holo":"#f59e0b","EX":"#fb923c","V":"#c084fc","VMAX":"#e879f9","Ultra Rare":"#60a5fa","Secret Rare":"#f43f5e"};

  return (
    <div style={{padding:"52px 16px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#facc15"}}>🧩 LOTES</div><div style={{fontSize:12,color:"#475569"}}>{lots.length} lotes · {avail.length} disponibles</div></div>
        <button onClick={()=>setView(v=>v==="list"?"builder":"list")} style={{background:view==="builder"?"rgba(250,204,21,.15)":"rgba(255,255,255,.07)",border:`1px solid ${view==="builder"?"rgba(250,204,21,.3)":"rgba(255,255,255,.1)"}`,color:view==="builder"?"#facc15":"#e2e8f0",borderRadius:12,padding:"10px 16px",fontSize:13,cursor:"pointer"}}>{view==="builder"?"← Lista":"⚡ Armar"}</button>
      </div>
      {view==="builder"&&(<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>{STRATS.map(s=><button key={s.id} onClick={()=>setStrat(s.id)} style={{background:strat===s.id?"rgba(250,204,21,.1)":"rgba(13,17,23,.95)",border:`1px solid ${strat===s.id?"rgba(250,204,21,.4)":"rgba(255,255,255,.08)"}`,borderRadius:12,padding:"12px",cursor:"pointer",textAlign:"left"}}><div style={{fontSize:20,marginBottom:4}}>{s.icon}</div><div style={{fontSize:13,fontWeight:700,color:strat===s.id?"#facc15":"#e2e8f0"}}>{s.label}</div><div style={{fontSize:11,color:"#475569"}}>{s.desc}</div></button>)}</div>
        {[{l:`Mín: ${minC}`,v:minC,set:setMinC,min:3,max:30},{l:`Máx: ${maxC}`,v:maxC,set:setMaxC,min:5,max:100}].map(s=><div key={s.l} style={{marginBottom:14}}><div style={{fontSize:13,color:"#94a3b8",marginBottom:6}}>{s.l}</div><input type="range" min={s.min} max={s.max} value={s.v} onChange={e=>s.set(+e.target.value)} style={{width:"100%",accentColor:"#facc15"}}/></div>)}
        <Btn onClick={doBuild} disabled={avail.length<minC||building}>{building?"CALCULANDO...":avail.length<minC?`NECESITAS ${minC} CARTAS`:"ARMAR LOTES"}</Btn>
        {preview.length>0&&<><div style={{background:"rgba(250,204,21,.06)",border:"1px solid rgba(250,204,21,.2)",borderRadius:12,padding:14,marginBottom:12}}><div style={{display:"flex",gap:14,marginBottom:12}}>{[{l:"Lotes",v:preview.length},{l:"Cartas",v:preview.reduce((s,l)=>s+l.cards.length,0)},{l:"Valor",v:fclp(preview.reduce((s,l)=>s+l.suggestedPrice,0))}].map(s=><div key={s.l} style={{flex:1,textAlign:"center"}}><div style={{fontFamily:"monospace",fontSize:18,color:"#facc15",fontWeight:700}}>{s.v}</div><div style={{fontSize:10,color:"#475569"}}>{s.l}</div></div>)}</div><Btn onClick={doSave} disabled={saving}>{saving?"GUARDANDO...":"💾 GUARDAR LOTES"}</Btn></div>{preview.slice(0,4).map((lot,i)=><button key={lot.id} onClick={()=>setDetail(lot)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px",background:"rgba(13,17,23,.95)",border:`1px solid ${LOT_STATUS[lot.status]?.color}18`,borderRadius:14,marginBottom:8,cursor:"pointer",textAlign:"left"}}><div style={{width:44,height:44,borderRadius:12,background:"rgba(250,204,21,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{ICO[lot.strategy]||"📦"}</div><div style={{flex:1,minWidth:0}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1,color:"#e2e8f0"}}>{lot.id}</div><div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>{lot.rarityBreak&&Object.entries(lot.rarityBreak).slice(0,3).map(([r,n])=><span key={r} style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:`${RC[r]||"#64748b"}22`,color:RC[r]||"#64748b"}}>{n}× {r}</span>)}</div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"monospace",fontSize:14,color:"#facc15",fontWeight:700}}>{fclp(lot.suggestedPrice)}</div></div></button>)}</>}
      </>)}
      {view==="list"&&(lots.length===0?<div style={{textAlign:"center",padding:48,color:"#475569",opacity:.5}}><div style={{fontSize:36,marginBottom:8}}>📭</div>Sin lotes<br/><button onClick={()=>setView("builder")} style={{marginTop:14,background:"rgba(250,204,21,.1)",border:"1px solid rgba(250,204,21,.2)",color:"#facc15",borderRadius:10,padding:"10px 20px",fontSize:13,cursor:"pointer"}}>Armar primer lote →</button></div>:lots.map((lot,i)=><button key={lot.id} onClick={()=>setDetail(lot)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px",background:"rgba(13,17,23,.95)",border:`1px solid ${LOT_STATUS[lot.status]?.color}18`,borderRadius:14,marginBottom:8,cursor:"pointer",textAlign:"left",animation:"slideUp .3s ease",animationDelay:`${Math.min(i,10)*40}ms`}}><div style={{width:44,height:44,borderRadius:12,background:"rgba(250,204,21,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{ICO[lot.strategy]||"📦"}</div><div style={{flex:1,minWidth:0}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1,color:"#e2e8f0"}}>{lot.id}</div><div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>{lot.rarityBreak&&Object.entries(lot.rarityBreak).slice(0,3).map(([r,n])=><span key={r} style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:`${RC[r]||"#64748b"}22`,color:RC[r]||"#64748b"}}>{n}× {r}</span>)}</div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"monospace",fontSize:14,color:"#facc15",fontWeight:700}}>{fclp(lot.suggestedPrice)}</div><span style={{fontSize:10,padding:"2px 6px",borderRadius:5,background:`${LOT_STATUS[lot.status]?.color}22`,color:LOT_STATUS[lot.status]?.color}}>{LOT_STATUS[lot.status]?.label}</span></div></button>))}
      <Sheet open={!!detail} onClose={()=>setDetail(null)} title={detail?.id||""} height="85vh">
        {detail&&(<><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>{detail.rarityBreak&&Object.entries(detail.rarityBreak).map(([r,n])=><span key={r} style={{fontSize:11,padding:"3px 9px",borderRadius:6,background:`${RC[r]||"#64748b"}22`,color:RC[r]||"#64748b"}}>{n}× {r}</span>)}</div><div style={{background:"rgba(250,204,21,.07)",border:"1px solid rgba(250,204,21,.15)",borderRadius:12,padding:14,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:11,color:"#475569",marginBottom:2}}>{detail.cards?.length||0} cartas</div><div style={{fontFamily:"monospace",fontSize:22,color:"#facc15",fontWeight:700}}>{fclp(detail.suggestedPrice)}</div></div><span style={{fontSize:12,padding:"4px 10px",borderRadius:8,background:`${LOT_STATUS[detail.status]?.color}22`,color:LOT_STATUS[detail.status]?.color}}>{LOT_STATUS[detail.status]?.label}</span></div><div style={{maxHeight:200,overflowY:"auto",marginBottom:14}}>{detail.cards?.map((card,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}><CardArt card={card} size={28}/><span style={{fontSize:13,color:"#94a3b8",flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{card.officialName||card.name}</span><span style={{fontSize:10,padding:"1px 5px",borderRadius:4,background:`${rd(card.rarity).color}22`,color:rd(card.rarity).color}}>{rd(card.rarity).label}</span></div>)}</div><div style={{fontSize:12,color:"#475569",marginBottom:8}}>Estado</div><div style={{display:"flex",gap:8,marginBottom:14}}>{Object.entries(LOT_STATUS).map(([k,v])=><button key={k} onClick={()=>chgSt(detail.id,k)} style={{flex:1,padding:"11px 4px",borderRadius:10,cursor:"pointer",border:"none",fontSize:11,fontWeight:600,background:detail.status===k?`${v.color}25`:"rgba(255,255,255,.05)",color:detail.status===k?v.color:"#64748b",outline:detail.status===k?`1.5px solid ${v.color}50`:"none"}}>{v.label}</button>)}</div><Btn variant="danger" onClick={()=>delLot(detail.id)}>🗑 Eliminar lote</Btn></>)}
      </Sheet>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SALES TAB
// ═══════════════════════════════════════════════════════════════════
function SalesTab({lots,sales,saveLots,saveSales,showToast}) {
  const [view,setView]      = useState("pipeline");
  const [modal,setModal]    = useState(null);
  const [form,setForm]      = useState({platform:"Mercado Libre",salePrice:"",buyer:"",notes:"",date:today()});
  const [saving,setSaving]  = useState(false);

  const rev  = sales.reduce((s,x)=>s+(+x.salePrice||0),0);
  const pub  = lots.filter(l=>l.status==="publicado").length;
  const byPl = sales.reduce((acc,s)=>{acc[s.platform]=(acc[s.platform]||0)+(+s.salePrice||0);return acc;},{});

  const regSale=()=>{if(!form.salePrice||!modal)return;setSaving(true);const sale={id:`sale_${Date.now()}`,lotId:modal.id,lotName:modal.name||modal.id,platform:form.platform,salePrice:+form.salePrice,date:form.date,buyer:form.buyer,notes:form.notes};saveSales([sale,...sales]);saveLots(lots.map(l=>l.id===modal.id?{...l,status:"vendido"}:l));setSaving(false);setModal(null);setForm({platform:"Mercado Libre",salePrice:"",buyer:"",notes:"",date:today()});showToast(`${fclp(sale.salePrice)} registrado ✓`);};
  const mkPub=id=>{saveLots(lots.map(l=>l.id===id?{...l,status:"publicado"}:l));showToast("Lote publicado");};

  return (
    <div style={{padding:"52px 16px 16px"}}>
      <div style={{marginBottom:14}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#facc15"}}>💰 VENTAS</div><div style={{fontSize:12,color:"#475569"}}>{fclp(rev)} · {sales.length} ventas · {pub} publicados</div></div>
      <div style={{display:"flex",gap:0,marginBottom:16,background:"rgba(0,0,0,.3)",borderRadius:12,padding:3}}>{[["pipeline","🔄 Pipeline"],["historial","📋 Historial"]].map(([v,l])=><button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"10px",background:view===v?"rgba(250,204,21,.12)":"none",border:"none",borderRadius:10,cursor:"pointer",fontSize:13,color:view===v?"#facc15":"#64748b",fontWeight:view===v?700:400}}>{l}</button>)}</div>
      {view==="pipeline"&&(<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>{[{l:"Ingresos",v:fclp(rev),c:"#4ade80"},{l:"Vendidos",v:sales.length,c:"#facc15"},{l:"En venta",v:pub,c:"#60a5fa"}].map(s=><div key={s.l} style={{background:"rgba(13,17,23,.95)",border:`1px solid ${s.c}22`,borderRadius:12,padding:"12px 8px",textAlign:"center"}}><div style={{fontFamily:"monospace",fontSize:16,color:s.c,fontWeight:700}}>{s.v}</div><div style={{fontSize:10,color:"#475569",marginTop:2}}>{s.l}</div></div>)}</div>
        {Object.keys(byPl).length>0&&<div style={{background:"rgba(13,17,23,.95)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:14,marginBottom:14}}><div style={{fontSize:12,color:"#475569",marginBottom:10,fontWeight:600}}>POR PLATAFORMA</div>{Object.entries(byPl).sort((a,b)=>b[1]-a[1]).map(([pl,r])=>{const c=PLAT_CLR[pl]||"#94a3b8";const pct=rev>0?Math.round((r/rev)*100):0;return<div key={pl} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:"#e2e8f0"}}>{pl}</span><span style={{fontSize:12,color:c,fontFamily:"monospace"}}>{fclp(r)}</span></div><div style={{height:5,background:"rgba(255,255,255,.06)",borderRadius:3}}><div style={{width:`${pct}%`,height:"100%",background:c,borderRadius:3}}/></div></div>;})}</div>}
        {["borrador","publicado"].map(status=>{const cl=lots.filter(l=>l.status===status);if(!cl.length)return null;return<div key={status} style={{marginBottom:14}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:1,color:LOT_STATUS[status]?.color,marginBottom:8}}>{status==="borrador"?"📝 BORRADORES":"📢 EN VENTA"} ({cl.length})</div>{cl.map(lot=><div key={lot.id} style={{background:"rgba(13,17,23,.95)",border:`1px solid ${LOT_STATUS[status]?.color}22`,borderRadius:14,padding:"12px 14px",marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#e2e8f0"}}>{lot.id}</div><div style={{fontSize:11,color:"#475569"}}>{lot.cards?.length||0} cartas</div></div><div style={{fontFamily:"monospace",fontSize:15,color:"#facc15",fontWeight:700}}>{fclp(lot.suggestedPrice)}</div></div>{status==="publicado"?<button onClick={()=>{setModal(lot);setForm(f=>({...f,salePrice:lot.suggestedPrice,date:today()}));}} style={{width:"100%",background:"linear-gradient(135deg,#facc15,#f59e0b)",color:"#090d12",border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer"}}>💰 REGISTRAR VENTA</button>:<button onClick={()=>mkPub(lot.id)} style={{width:"100%",background:"rgba(74,222,128,.08)",border:"1px solid rgba(74,222,128,.2)",color:"#4ade80",borderRadius:10,padding:"11px",fontSize:13,cursor:"pointer"}}>📢 Marcar publicado</button>}</div>)}</div>;})}
      </>)}
      {view==="historial"&&(<>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:13,color:"#64748b",fontWeight:600}}>{sales.length} VENTAS</div><div style={{fontFamily:"monospace",fontSize:13,color:"#4ade80"}}>{fclp(rev)}</div></div>
        {sales.length===0?<div style={{textAlign:"center",padding:48,color:"#475569",opacity:.5}}><div style={{fontSize:36,marginBottom:8}}>📋</div>Sin ventas aún</div>:sales.map(s=><div key={s.id} style={{display:"flex",gap:12,alignItems:"center",padding:"12px",background:"rgba(13,17,23,.95)",borderRadius:14,marginBottom:8,border:"1px solid rgba(255,255,255,.06)"}}><div style={{width:40,height:40,borderRadius:10,background:`${PLAT_CLR[s.platform]||"#64748b"}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.platform==="Mercado Libre"?"🛒":s.platform==="eBay"?"🌐":s.platform==="Instagram"?"📸":"💬"}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.lotName}</div><div style={{fontSize:11,color:"#64748b"}}>{s.platform}{s.buyer?` · ${s.buyer}`:""}</div></div><div style={{fontFamily:"monospace",fontSize:15,color:"#4ade80",fontWeight:700,flexShrink:0}}>{fclp(s.salePrice)}</div></div>)}
      </>)}
      <Sheet open={!!modal} onClose={()=>setModal(null)} title="REGISTRAR VENTA" height="80vh">
        {modal&&(<>
          <div style={{background:"rgba(250,204,21,.07)",border:"1px solid rgba(250,204,21,.15)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#94a3b8"}}>{modal.name||modal.id} · precio sugerido <span style={{color:"#facc15"}}>{fclp(modal.suggestedPrice)}</span></div>
          <Sel label="Plataforma" value={form.platform} onChange={e=>setForm(f=>({...f,platform:e.target.value}))}>{PLATFORMS.map(p=><option key={p}>{p}</option>)}</Sel>
          <Inp label="Precio de venta (CLP) *" type="number" placeholder="Ej: 5000" value={form.salePrice} onChange={e=>setForm(f=>({...f,salePrice:e.target.value}))}/>
          {form.salePrice&&<div style={{fontSize:11,color:+form.salePrice<modal.suggestedPrice?"#fb923c":"#4ade80",marginTop:-10,marginBottom:14}}>{+form.salePrice<modal.suggestedPrice?"↓ Bajo precio sugerido":"✓ Sobre precio sugerido"}</div>}
          <Inp label="Fecha" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
          <Inp label="Comprador (opcional)" placeholder="@usuario" value={form.buyer} onChange={e=>setForm(f=>({...f,buyer:e.target.value}))}/>
          <Inp label="Notas (opcional)" placeholder="Ej: envío Santiago" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
          <Btn onClick={regSale} disabled={saving||!form.salePrice}>{saving?"GUARDANDO...":"💰 CONFIRMAR VENTA"}</Btn>
        </>)}
      </Sheet>
    </div>
  );
}
