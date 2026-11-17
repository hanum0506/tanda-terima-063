(function(){
const HARI=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const BLN=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DEF={kode:"KPP.041201",prefix:"TTR",start:0,kondisi:"Diterima Baik",defPenerima:"",penerima:[],keperluan:[],satuan:["Pcs","Pack","Box","Set","Unit"],via:["Cash","CC"]};
const $=id=>document.getElementById(id);
const rp=n=>"Rp "+new Intl.NumberFormat("id-ID").format(Number(n)||0);
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const pd=s=>{const [y,m,d]=String(s).split("-").map(Number);return new Date(y,m-1,d)};
const fmtLong=s=>{const d=pd(s);return d.getDate()+" "+BLN[d.getMonth()]+" "+d.getFullYear()};
const fmtShort=s=>{const d=pd(s);return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear()};
function h(tag,attrs,...kids){const e=document.createElement(tag);for(const k in(attrs||{})){const v=attrs[k];if(k==="class")e.className=v;else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else if(v===true)e.setAttribute(k,"");else if(v!==false&&v!=null)e.setAttribute(k,v)}for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)))}return e}
let toastT;function toast(msg,err){const t=$("toast");t.textContent=msg;t.className="toast"+(err?" err":"");t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3800)}
function notice(msg){const n=$("notice");n.textContent=msg||"";n.hidden=!msg}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}

let uid="anon";
let cfg=Object.assign({},DEF),rows=[],counterLast=null,editingId=null,selected=new Set(),loaded={cfg:false,rows:false};
let logoBytes=null;
fetch("logo.png").then(r=>r.arrayBuffer()).then(b=>{logoBytes=new Uint8Array(b)}).catch(()=>{});
const canWrite=()=>true;
const isAdmin=()=>true;

// ---------- tabs
function showTab(n){["input","daftar","set"].forEach(t=>{$("p-"+t).hidden=t!==n;$("tab-"+t).setAttribute("aria-selected",String(t===n))});ls("tt-tab",n);if(n==="set")fillSettings()}
document.querySelectorAll("nav.tabs button").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));

// ---------- helpers
const nomorStr=(n,tgl)=>cfg.prefix+"-"+String(n).padStart(3,"0")+"/"+cfg.kode+"/"+pd(tgl).getFullYear();
const maxNomor=()=>rows.reduce((m,r)=>Math.max(m,Number(r.nomor)||0),0);
function toTT(r){
  const tgl=r.tglTerima||r.tanggal;
  const p=(cfg.penerima||[]).find(x=>x.nama===r.penerima)||{nama:r.penerima||cfg.defPenerima||"",nip:""};
  return{nomor:nomorStr(r.nomor,tgl),hari:HARI[pd(tgl).getDay()],tanggal:fmtLong(tgl),vendor:r.vendor||"",keperluan:r.keperluan||"",
    items:(r.items||[]).filter(i=>i.nama),kondisi:cfg.kondisi,pengirim:r.pengirim||"",penerima:p};
}
const itemText=i=>[i.nama,i.vol,(i.sat||"").toLowerCase()].filter(x=>x!==""&&x!=null).join(" ");
function belanjaText(r){const t=(r.items||[]).filter(i=>i.nama).map(itemText);if(!t.length)return"";return"Belanja "+(t.length===1?t[0]:t.slice(0,-1).join(", ")+" dan "+t[t.length-1])}

// ---------- form
function itemRow(v){v=v||{};
  const n=h("input",{placeholder:"Nama barang","aria-label":"Nama barang",value:v.nama||""});
  const q=h("input",{placeholder:"Jml",inputmode:"decimal","aria-label":"Jumlah",value:v.vol==null?"":v.vol});
  const s=h("input",{placeholder:"Satuan",list:"dl-sat","aria-label":"Satuan",value:v.sat||""});
  const x=h("button",{type:"button",class:"btn x","aria-label":"Hapus baris",onclick:()=>{if($("items").children.length>1)r.remove()}},"×");
  const r=h("div",{class:"item"},n,q,s,x);return r}
function getItems(){return[...$("items").children].map(r=>{const i=r.querySelectorAll("input");const vs=i[1].value.replace(",",".").trim();return{nama:i[0].value.trim(),vol:vs===""?"":(isNaN(Number(vs))?vs:Number(vs)),sat:i[2].value.trim()}}).filter(i=>i.nama)}
function setItems(list){const box=$("items");box.replaceChildren();(list&&list.length?list:[{},{}]).forEach(i=>box.append(itemRow(i)))}
$("add-item").addEventListener("click",()=>{if($("items").children.length<5)$("items").append(itemRow());else toast("Satu tanda terima maksimal 5 barang.",true)});
$("f-harga").addEventListener("input",e=>{const d=e.target.value.replace(/\D/g,"");e.target.value=d?new Intl.NumberFormat("id-ID").format(Number(d)):""});
function opts(sel,list,keep){const cur=keep??sel.value;sel.replaceChildren(...list.map(x=>h("option",{value:x},x)));if(list.includes(cur))sel.value=cur}
function refreshLists(){
  opts($("f-via"),cfg.via.length?cfg.via:["Cash"]);
  const names=(cfg.penerima||[]).map(p=>p.nama);
  const def=cfg.defPenerima&&names.includes(cfg.defPenerima)?cfg.defPenerima:names[0];
  const cur=$("f-terima").value;opts($("f-terima"),names.length?names:[""],cur);if(!cur&&def)$("f-terima").value=def;
  $("dl-kep").replaceChildren(...cfg.keperluan.map(x=>h("option",{value:x})));
  $("dl-sat").replaceChildren(...cfg.satuan.map(x=>h("option",{value:x})));
  const vs=[...new Set(rows.map(r=>r.vendor).filter(Boolean))].sort();
  $("dl-vendor").replaceChildren(...vs.map(x=>h("option",{value:x})));
}
function resetForm(){editingId=null;$("f").reset();$("f-tgl").value=today();setItems();$("f-title").textContent="Belanja baru";$("f-del").hidden=true;$("f-del").textContent="Hapus belanja ini";
  const last=ls("tt-kirim");if(last)$("f-kirim").value=last;refreshLists();
  const names=(cfg.penerima||[]).map(p=>p.nama);const d=cfg.defPenerima&&names.includes(cfg.defPenerima)?cfg.defPenerima:names[0];if(d)$("f-terima").value=d;updateSide()}
$("f-reset").addEventListener("click",resetForm);
function loadForm(r){editingId=r.id;$("f-tgl").value=r.tanggal||"";$("f-tglt").value=r.tglTerima||"";$("f-vendor").value=r.vendor||"";$("f-inv").value=r.invoice||"";$("f-kep").value=r.keperluan||"";
  setItems(r.items);$("f-harga").value=r.harga?new Intl.NumberFormat("id-ID").format(r.harga):"";$("f-kirim").value=r.pengirim||"";$("f-cat").value=r.catatan||"";
  refreshLists();if(r.via)$("f-via").value=r.via;if(r.penerima)$("f-terima").value=r.penerima;
  $("f-title").textContent="Ubah belanja "+nomorStr(r.nomor,r.tglTerima||r.tanggal);$("f-del").hidden=false;showTab("input");window.scrollTo({top:0,behavior:"smooth"})}


// ---------- API (Google Apps Script)
const API_URL=(window.APP_CONFIG&&window.APP_CONFIG.apiUrl)||"";
let adminCode="";
async function api(action,payload){
  if(!API_URL||API_URL.startsWith("TEMPEL"))throw Object.assign(new Error("Alamat backend belum diisi di config.js"),{code:"config"});
  const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(Object.assign({action,key:ls("tt-key")||"",admin:adminCode},payload||{}))});
  const j=await r.json();
  if(!j.ok){throw Object.assign(new Error(j.message||"Gagal"),{code:j.error})}
  return j}
function showGate(msg){
  const g=$("gate");
  const inp=h("input",{id:"gate-key",type:"password",placeholder:"Kode akses","aria-label":"Kode akses",autocomplete:"off"});
  g.replaceChildren(h("form",{class:"mbox",style:"max-width:380px;margin-top:12vh",onsubmit:e=>{e.preventDefault();ls("tt-key",inp.value.trim());g.hidden=true;load()}},
    h("h2",{style:"margin:0 0 6px;font:600 16px var(--f-head)"},"Masukkan kode akses"),
    h("p",{class:"hint",style:"margin:0 0 12px"},msg||"Kode diberikan oleh pengelola halaman ini."),
    inp,h("div",{class:"actions"},h("button",{class:"btn primary",type:"submit"},"Masuk"))));
  g.hidden=false;setTimeout(()=>inp.focus(),50)}
function handleErr(err){
  if(err&&err.code==="kode"){showGate("Kode akses salah. Coba lagi.");return}
  toast((err&&err.message)||"Terjadi kesalahan.",true)}
function saveBlob(name,blob){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
async function load(){
  try{const j=await api("list");mergeCfg(j.config);rows=j.rows||[];counterLast=j.counter==null?null:Number(j.counter);loaded.cfg=loaded.rows=true;notice("");
    for(const id of [...selected])if(!rows.some(r=>r.id===id))selected.delete(id);
    refreshLists();updateSide();renderList();fillSettings()}
  catch(e){if(e&&e.code==="kode"||!ls("tt-key"))showGate(ls("tt-key")?"Kode akses salah. Coba lagi.":"");else notice("Data belum bisa dimuat: "+(e.message||"cek koneksi")+".")}}

$("f").addEventListener("submit",async e=>{e.preventDefault();
  const items=getItems();if(!items.length)return toast("Isi minimal satu barang.",true);
  const harga=Number($("f-harga").value.replace(/\D/g,""))||0;
  const data={tanggal:$("f-tgl").value,tglTerima:$("f-tglt").value,vendor:$("f-vendor").value.trim(),invoice:$("f-inv").value.trim(),keperluan:$("f-kep").value.trim(),
    items,harga,via:$("f-via").value,pengirim:$("f-kirim").value.trim(),penerima:$("f-terima").value,catatan:$("f-cat").value.trim()};
  const btn=$("f-save");btn.disabled=true;
  try{ls("tt-kirim",data.pengirim);let row;
    if(editingId){await api("update",{id:editingId,data});const old=rows.find(r=>r.id===editingId)||{};row=Object.assign({},old,data,{id:editingId});toast("Perubahan tersimpan.")}
    else{const j=await api("add",{data});row=j.row;toast("Tersimpan sebagai "+nomorStr(row.nomor,row.tglTerima||row.tanggal))}
    resetForm();load();openPreview([row])
  }catch(err){handleErr(err)}finally{btn.disabled=false}});
$("f-del").addEventListener("click",async()=>{const b=$("f-del");
  if(b.dataset.arm!=="1"){b.dataset.arm="1";b.textContent="Klik lagi untuk menghapus";setTimeout(()=>{b.dataset.arm="";if(editingId)b.textContent="Hapus belanja ini"},3500);return}
  if(!adminCode)adminCode=($("s-admin").value||"").trim();
  if(!adminCode){toast("Menghapus perlu kode admin. Isi dulu di tab Pengaturan.",true);return}
  try{await api("delete",{id:editingId});toast("Belanja dihapus.");resetForm();load()}catch(e){handleErr(e)}});
// ---------- preview + download
function sheet(t){
  const n=Math.max(4,t.items.length);const trs=[];
  for(let i=0;i<n;i++){const it=t.items[i];trs.push(h("tr",null,h("td",null,(i+1)+"."),h("td",{class:"l"},it?it.nama:""),h("td",null,it?String(it.vol):""),h("td",null,it?it.sat:""),h("td",null,it?t.kondisi:""),h("td")))}
  return h("div",{class:"sheet"},
    h("div",{class:"kop"},h("img",{alt:"",src:"logo.png"}),h("div",null,h("div",{class:"k1"},"KEMENTERIAN KEUANGAN REPUBLIK INDONESIA"),h("div",{class:"k2"},"DIREKTORAT JENDERAL PAJAK"),h("div",{class:"k2"},"KANTOR WILAYAH DIREKTORAT JENDERAL PAJAK JAKARTA SELATAN I"),h("div",{class:"k2"},"KANTOR PELAYANAN PAJAK PRATAMA JAKARTA SETIABUDI TIGA"),h("div",{class:"k3"},"JL. RAYA PASAR MINGGU NO.11 PANCORAN, JAKARTA SELATAN 12780"))),
    h("h3",null,"TANDA TERIMA BARANG"),h("div",{class:"no"},"Nomor : "+t.nomor),
    h("p",{class:"in"},`Pada hari ini ${t.hari}, ${t.tanggal}, telah diterima barang dari ${t.vendor} untuk keperluan pelaksanaan kegiatan ${t.keperluan} pada KPP Pratama Jakarta Setiabudi Tiga dengan rincian sebagaimana berikut:`),
    h("table",null,h("thead",null,h("tr",null,...["No","Deskripsi Barang","Volume","Satuan","Catatan (kondisi)","Keterangan"].map(x=>h("th",null,x)))),h("tbody",null,trs)),
    h("p",{class:"in"},"Seluruh item tersebut di atas telah diperiksa dan diterima dalam jumlah yang sesuai serta dalam keadaan baik dan layak."),
    h("p",{class:"in"},"Demikian Tanda Terima ini dibuat sebagai bukti serah terima yang sah untuk dipergunakan sebagaimana mestinya."),
    h("div",{class:"sig"},h("div",null,"Pengirim,",h("br"),h("br"),h("br"),h("br"),t.pengirim),h("div",null,"Penerima,",h("br"),h("br"),h("br"),h("br"),t.penerima.nama,t.penerima.nip?h("br"):null,t.penerima.nip?"NIP "+t.penerima.nip:null)));
}
async function saveDocx(list){
  if(!logoBytes)return toast("Logo belum termuat, coba lagi sebentar.",true);
  const ts=list.map(toTT);
  const name=ts.length===1?"Tanda_Terima_"+ts[0].nomor.split("/")[0]+".docx":"Tanda_Terima_"+ts.length+"_surat.docx";
  try{saveBlob(name,TTD.build(ts,logoBytes));toast("File siap. Buka dengan Word lalu cetak (Ctrl+P).")}catch(e){toast("Gagal menyiapkan file.",true)}}
function openPreview(list){
  const m=$("modal");const r=list[0];
  m.replaceChildren(h("div",{class:"mbox",role:"dialog","aria-label":"Pratinjau Tanda Terima"},
    h("div",{class:"mbar"},h("span",{class:"hint"},"Pratinjau. Klik Cetak, atau unduh file Word-nya."),
      h("div",{class:"rowact"},h("button",{class:"btn primary",onclick:()=>window.print()},"Cetak"),h("button",{class:"btn",onclick:()=>saveDocx(list)},"Unduh .docx"),h("button",{class:"btn",onclick:()=>m.hidden=true},"Tutup"))),
    h("div",{class:"sheetwrap"},sheet(toTT(r)))));
  m.hidden=false;m.scrollTop=0}
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))$("modal").hidden=true});
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("modal").hidden=true});

// ---------- list
function visible(){const q=$("q").value.trim().toLowerCase(),fs=$("fs").value;
  return rows.filter(r=>{const st=r.diajukan?"sudah":"belum";if(fs==="belum"&&r.diajukan)return false;if(fs==="sudah"&&!r.diajukan)return false;if(fs==="tunggu"&&!(r.diajukan&&!r.dibayar))return false;if(fs==="cair"&&!r.dibayar)return false;
    if(q){const hay=(r.vendor+" "+(r.items||[]).map(i=>i.nama).join(" ")+" "+r.keperluan+" "+r.invoice+" "+nomorStr(r.nomor,r.tglTerima||r.tanggal)).toLowerCase();if(!hay.includes(q))return false}return true})
   .sort((a,b)=>(b.nomor||0)-(a.nomor||0))}
function renderList(){
  const tb=$("tb");const vis=visible();tb.replaceChildren();
  if(!vis.length){tb.append(h("tr",null,h("td",{colspan:9},h("div",{class:"empty"},h("b",null,rows.length?"Tidak ada yang cocok":"Belum ada belanja"),rows.length?"Ubah kata kunci atau filter status.":"Isi form di tab Input belanja, nanti muncul di sini."))))}
  for(const r of vis){const st=r.diajukan?"sudah":"belum";
    const ck=h("input",{type:"checkbox",class:"ck","aria-label":"Pilih",checked:selected.has(r.id),onchange:e=>{e.target.checked?selected.add(r.id):selected.delete(r.id);selInfo()}});
    tb.append(h("tr",null,h("td",null,ck),h("td",null,h("span",{class:"ttl"},cfg.prefix+"-"+String(r.nomor).padStart(3,"0"))),h("td",null,fmtShort(r.tanggal)),
      h("td",null,h("div",{class:"ttl"},r.vendor),h("div",{class:"mut"},belanjaText(r))),h("td",{class:"num"},rp(r.harga)),h("td",null,r.via||""),
      h("td",null,h("span",{class:"pill "+st},st==="sudah"?"Diajukan "+fmtShort(r.diajukan):"Belum diajukan")),
      h("td",null,h("label",{class:"cair"},h("input",{type:"checkbox",class:"ck","aria-label":"Sudah direimburse",checked:!!r.dibayar,onchange:e=>setDibayar(r,e.target.checked)}),r.dibayar?h("span",{class:"pill sudah"},"Cair "+fmtShort(r.dibayar)):h("span",{class:"mut"},r.diajukan?"Menunggu":"Belum diajukan"))),
      h("td",null,h("div",{class:"rowact"},h("button",{class:"btn sm",onclick:()=>openPreview([r])},"Lihat"),h("button",{class:"btn sm",onclick:()=>loadForm(r)},"Ubah"))))) }
  selInfo();updateSide()}
function selInfo(){const n=[...selected].filter(id=>rows.some(r=>r.id===id)).length;$("sel-info").textContent=n?n+" dipilih":"";$("b-dl").disabled=!n;$("b-aju").disabled=!n;
  const vis=visible();$("ck-all").checked=vis.length>0&&vis.every(r=>selected.has(r.id))}
$("ck-all").addEventListener("change",e=>{visible().forEach(r=>e.target.checked?selected.add(r.id):selected.delete(r.id));renderList()});
$("q").addEventListener("input",renderList);$("fs").addEventListener("change",renderList);
const picked=()=>rows.filter(r=>selected.has(r.id)).sort((a,b)=>a.nomor-b.nomor);
$("b-dl").addEventListener("click",()=>saveDocx(picked()));
$("b-aju").addEventListener("click",async()=>{
  const list=picked();try{await api("diajukan",{ids:list.map(r=>r.id),tanggal:today()});selected.clear();toast(list.length+" belanja ditandai sudah diajukan.");load()}catch(e){handleErr(e)}});
$("b-csv").addEventListener("click",()=>{
  const list=(selected.size?picked():[...rows].sort((a,b)=>a.nomor-b.nomor));
  const q=s=>'"'+String(s==null?"":s).replace(/"/g,'""')+'"';
  const lines=[["No","Tanggal","Belanja","Harga","Via","Diajukan","Direimburse"].join(",")].concat(list.map(r=>[r.nomor,fmtShort(r.tanggal),q(belanjaText(r)),r.harga||0,q(r.via),r.diajukan||"",r.dibayar||""].join(",")));
  saveBlob("log_reimburse.csv",new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv"}));toast("File log reimburse siap.")});
async function setDibayar(r,on){
  try{await api("dibayar",{id:r.id,tanggal:on?today():""});toast(on?"Ditandai sudah direimburse.":"Tanda reimburse dibatalkan.");load()}catch(e){handleErr(e);renderList()}}
function updateSide(){
  const last=Math.max(counterLast==null?0:counterLast,maxNomor(),Number(cfg.start)||0);const n=last+1;
  $("next-no").textContent=cfg.prefix+"-"+String(n).padStart(3,"0");$("next-full").textContent=nomorStr(n,$("f-tglt").value||$("f-tgl").value||today());
  const b=rows.filter(r=>!r.diajukan);$("s-belum").textContent=b.length;$("s-belum-rp").textContent=rp(b.reduce((a,r)=>a+(Number(r.harga)||0),0));$("s-sudah").textContent=rows.length-b.length;const w=rows.filter(r=>r.diajukan&&!r.dibayar);$("s-tunggu").textContent=w.length;$("s-tunggu-rp").textContent=rp(w.reduce((a,r)=>a+(Number(r.harga)||0),0))}
$("f-tgl").addEventListener("change",updateSide);$("f-tglt").addEventListener("change",updateSide);

// ---------- settings
const lines=t=>t.split("\n").map(s=>s.trim()).filter(Boolean);
function fillSettings(){
  if(document.activeElement&&$("p-set").contains(document.activeElement))return;
  const ro=!isAdmin();
  $("s-kode").value=cfg.kode;$("s-prefix").value=cfg.prefix;$("s-kond").value=cfg.kondisi;
  $("s-pen").value=cfg.penerima.map(p=>p.nama+" | "+(p.nip||"")).join("\n");$("s-kep").value=cfg.keperluan.join("\n");$("s-sat").value=cfg.satuan.join("\n");$("s-via").value=cfg.via.join("\n");
  opts($("s-def"),cfg.penerima.map(p=>p.nama),cfg.defPenerima);$("s-last").value=Math.max(counterLast==null?0:counterLast,maxNomor(),Number(cfg.start)||0);
  $("s-last-hint").textContent="Nomor berikutnya akan jadi nomor ini + 1.";
  $("set-note").textContent=ro?"Hanya Editor yang bisa mengubah pengaturan.":"Perubahan berlaku untuk semua orang yang memakai halaman ini.";
  $("p-set").querySelectorAll("input,select,textarea,button").forEach(e=>e.disabled=ro)}
$("s-admin").addEventListener("input",e=>{adminCode=e.target.value.trim()});
$("s-save").addEventListener("click",async()=>{
  const pen=lines($("s-pen").value).map(l=>{const [a,...b]=l.split("|");return{nama:a.trim(),nip:b.join("|").trim()}}).filter(p=>p.nama);
  const next={kode:$("s-kode").value.trim()||DEF.kode,prefix:$("s-prefix").value.trim()||DEF.prefix,kondisi:$("s-kond").value.trim()||DEF.kondisi,
    defPenerima:$("s-def").value||(pen[0]&&pen[0].nama)||"",penerima:pen,keperluan:lines($("s-kep").value),satuan:lines($("s-sat").value),via:lines($("s-via").value),start:cfg.start||0};
  try{await api("config",{config:next});toast("Pengaturan tersimpan.");load()}catch(e){handleErr(e)}});
$("s-last-save").addEventListener("click",async()=>{const n=Number($("s-last").value.replace(/\D/g,""));if(isNaN(n))return;
  try{await api("counter",{last:n});toast("Nomor terakhir diatur ke "+n+".");load()}catch(e){handleErr(e)}});
function mergeCfg(d){cfg=Object.assign({},DEF,d||{});cfg.penerima=cfg.penerima||[];cfg.keperluan=cfg.keperluan||[];cfg.satuan=cfg.satuan||DEF.satuan;cfg.via=cfg.via||DEF.via}
$("f-tgl").value=today();setItems();refreshLists();updateSide();renderList();
{const t=ls("tt-tab");if(t&&["input","daftar","set"].includes(t))showTab(t)}
if(!ls("tt-key"))showGate("");else load();
setInterval(()=>{if(!document.hidden&&ls("tt-key")&&$("gate").hidden)load()},30000);
})();
