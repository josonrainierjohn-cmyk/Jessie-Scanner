const $=id=>document.getElementById(id);
const DBKEY="dampol_students_v1", ATTKEY="dampol_attendance_v1", PINKEY="dampol_admin_pin_v1";
let students=JSON.parse(localStorage.getItem(DBKEY)||"[]");
let attendance=JSON.parse(localStorage.getItem(ATTKEY)||"[]");
let adminPin=localStorage.getItem(PINKEY)||"1234";
let currentStudent=null, stream=null, scanning=false, lastCode="", lastScanAt=0;

function save(){localStorage.setItem(DBKEY,JSON.stringify(students));localStorage.setItem(ATTKEY,JSON.stringify(attendance))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function today(){return new Date().toISOString().slice(0,10)}
function nowTime(){return new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}
function renderLog(){
  const filter=$("gradeFilter").value, body=$("attendanceBody");
  const rows=attendance.filter(a=>a.date===today()&&(filter==="All"||a.grade===filter));
  body.innerHTML=rows.length?rows.map(a=>`<tr><td>${esc(a.date)}</td><td>${esc(a.time)}</td><td>${esc(a.name)}</td><td>${esc(a.lrn)}</td><td>${esc(a.section)}</td><td><b>${esc(a.status)}</b></td></tr>`).join(""):`<tr><td colspan="6" class="empty">No attendance records yet.</td></tr>`;
  $("totalStudents").textContent=students.length;
  $("presentCount").textContent=attendance.filter(a=>a.date===today()&&a.status==="PRESENT").length;
  $("timeoutCount").textContent=attendance.filter(a=>a.date===today()&&a.status==="TIME OUT").length;
}
function showStudent(s){
  currentStudent=s;$("notRegistered").classList.add("hidden");$("studentCard").classList.remove("hidden");
  $("studentName").textContent=s.name;$("studentLRN").textContent=s.lrn;$("studentSection").textContent=s.section;
  $("studentPhoto").src=s.photo||placeholder();
  const last=attendance.filter(a=>a.date===today()&&a.lrn===s.lrn).slice(-1)[0];
  $("attendanceState").textContent=last?`Today's latest status: ${last.status} at ${last.time}`:"No attendance marked today.";
  $("statusBox").textContent="Student verified. Guard must confirm the face matches the official photo.";
}
function placeholder(){return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360"><rect width="100%" height="100%" fill="#e7ebf3"/><text x="50%" y="50%" text-anchor="middle" fill="#667085" font-size="24">No Photo</text></svg>`)}
function scanCode(code){
  code=String(code).trim(); if(!code)return;
  const now=Date.now(); if(code===lastCode&&now-lastScanAt<2500)return; lastCode=code;lastScanAt=now;
  const s=students.find(x=>x.lrn===code||x.barcode===code);
  if(s)showStudent(s); else {$("studentCard").classList.add("hidden");$("notRegistered").classList.remove("hidden");$("statusBox").textContent=`Barcode ${code} is not registered.`}
}
async function startScanner(){
  $("scannerPanel").classList.remove("hidden");$("scannerMessage").textContent="Requesting camera permission…";
  if(!("BarcodeDetector" in window)){ $("scannerMessage").textContent="This browser does not support native barcode scanning. Try Chrome on Android/desktop, or use a device/browser with BarcodeDetector support."; return}
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
    $("camera").srcObject=stream; scanning=true; $("scannerMessage").textContent="Scanning… hold the barcode inside the frame.";
    const detector=new BarcodeDetector({formats:["code_128","ean_13","ean_8","upc_a","upc_e","code_39","codabar","itf"]});
    const loop=async()=>{if(!scanning)return;try{const codes=await detector.detect($("camera"));if(codes.length)scanCode(codes[0].rawValue)}catch(e){} requestAnimationFrame(loop)}; loop();
  }catch(e){$("scannerMessage").textContent="Camera access failed. Check browser permission and make sure the page is opened from a secure context (HTTPS/localhost)."}
}
function stopScanner(){scanning=false;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$("camera").srcObject=null;$("scannerPanel").classList.add("hidden")}
function mark(status){
  if(!currentStudent)return;
  const rec={date:today(),time:nowTime(),name:currentStudent.name,lrn:currentStudent.lrn,grade:(currentStudent.section.match(/^(\d{2})/)||[])[1]||"",section:currentStudent.section,status};
  attendance.push(rec);save();renderLog();showStudent(currentStudent);$("statusBox").textContent=`${status==="PRESENT"?"Marked Present":"Time Out"} — ${currentStudent.name}`;
}
function code128Pattern(text){
  const map=["11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000","11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100","11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010","11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000","11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110","11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010","11101111010","11001000010","11110001010","11110000110","11111011010","11111000110","11110100010","11110101110","11111010110","11001101110","11000010110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110","10111001110","11101011110","11101001110","11111011110","11010100010","11010100110","11010111000","11010111100","11011010000","11011011100","11011110000","11011110100","11110110000","11110111100","11111010000","11111011100","11111101010"];
  const start=104, stop="1100011101011"; let vals=[start],sum=start;
  for(let i=0;i<text.length;i++){let v=text.charCodeAt(i)-32;if(v<0||v>95)v=0;vals.push(v);sum+=v*(i+1)}
  vals.push(sum%103);
  return vals.map(v=>map[v]).join("")+stop;
}
function barcodeSvg(text){
  const bits=code128Pattern(text), w=bits.length, h=70, quiet=10, scale=2;
  let bars="",x=quiet;
  for(const b of bits){if(b==="1")bars+=`<rect x="${x}" y="5" width="${scale}" height="50"/>`;x+=scale}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x+quiet} ${h}" role="img" aria-label="Barcode ${esc(text)}"><rect width="100%" height="100%" fill="white"/>${bars}<text x="${(x+quiet)/2}" y="66" text-anchor="middle" font-family="Arial" font-size="9">${esc(text)}</text></svg>`;
}
function renderStudents(){
 $("studentBody").innerHTML=students.length?students.map((s,i)=>`<tr><td>${esc(s.lrn)}</td><td>${esc(s.name)}</td><td>${esc(s.section)}</td><td class="mini-barcode">${esc(s.barcode)}</td><td><button class="delete-btn" onclick="deleteStudent(${i})">Delete</button></td></tr>`).join(""):`<tr><td colspan="5" class="empty">No students registered.</td></tr>`;
}
window.deleteStudent=i=>{if(confirm("Delete this student?")){students.splice(i,1);save();renderStudents();renderLog()}};
$("scanBtn").onclick=startScanner;$("stopScanBtn").onclick=stopScanner;$("presentBtn").onclick=()=>mark("PRESENT");$("timeoutBtn").onclick=()=>mark("TIME OUT");$("gradeFilter").onchange=renderLog;
$("adminBtn").onclick=()=>{$("adminModal").classList.remove("hidden");$("pinView").classList.remove("hidden");$("adminView").classList.add("hidden");$("pinInput").value=""};
$("closeAdmin").onclick=()=>{$("adminModal").classList.add("hidden")};
$("pinSubmit").onclick=()=>{if($("pinInput").value===adminPin){$("pinView").classList.add("hidden");$("adminView").classList.remove("hidden");renderStudents()}else $("pinError").textContent="Incorrect PIN."};
$("studentForm").onsubmit=async e=>{e.preventDefault();const lrn=$("lrnInput").value.trim();if(students.some(s=>s.lrn===lrn)){alert("That LRN is already registered.");return}let photo="";const f=$("photoInput").files[0];if(f)photo=await new Promise(r=>{const rd=new FileReader();rd.onload=()=>r(rd.result);rd.readAsDataURL(f)});const s={lrn,name:$("nameInput").value.trim(),section:$("sectionInput").value.trim(),photo,barcode:lrn};students.push(s);save();renderStudents();$("barcodeSvg").innerHTML=barcodeSvg(lrn);$("barcodeCaption").textContent=`LRN: ${lrn} — compact Code 128 barcode`;$("barcodeOutput").classList.remove("hidden");e.target.reset();alert("Student saved. Print this compact barcode and place it on the ID.")};
$("printBarcodeBtn").onclick=()=>{const svg=$("barcodeSvg").innerHTML;const cap=$("barcodeCaption").textContent;const w=window.open("","_blank");w.document.write(`<html><head><title>Barcode</title><style>body{text-align:center;font-family:Arial;padding:30px}svg{width:280px;height:70px}</style></head><body>${svg}<p>${esc(cap)}</p><script>window.print()<\/script></body></html>`);w.document.close()};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".admin-tab").forEach(x=>x.classList.add("hidden"));b.classList.add("active");$(b.dataset.tab).classList.remove("hidden")});
$("exportBtn").onclick=()=>{if(!$("pinInput") && false)return;const rows=[["Date","Time","Name","LRN","Grade-Section","Status"],...attendance.map(a=>[a.date,a.time,a.name,a.lrn,a.section,a.status])];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\r\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Dampol_Attendance_${today()}.csv`;a.click();URL.revokeObjectURL(a.href)};
$("clearAttendanceBtn").onclick=()=>{if(confirm("Clear ALL attendance records? This cannot be undone.")){attendance=[];save();renderLog()}};
$("changePinBtn").onclick=()=>{const p=$("newPin").value.trim();if(p.length<4){alert("PIN must be at least 4 characters.");return}adminPin=p;localStorage.setItem(PINKEY,p);$("newPin").value="";alert("Admin PIN changed.")};
renderLog();
