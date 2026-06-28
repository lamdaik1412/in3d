import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const STORAGE_KEY = "xuong-nho-cost-studio-v1";
const firebaseConfig = {
  apiKey: "AIzaSyDv7pMrC1LV_4E3gpbqler0XXUinD7r-b8",
  authDomain: "in3d-project.firebaseapp.com",
  projectId: "in3d-project",
  storageBucket: "in3d-project.firebasestorage.app",
  messagingSenderId: "582581287530",
  appId: "1:582581287530:web:b919cd163a9becd774e813",
  measurementId: "G-YBLN964KVM"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();
let currentUser = null;
let cloudReady = false;
let syncTimer = null;

const seed = {
  materials: [
    ["m1","MÁY",19865000,1,"MÁY",""],["m2","PLA CAM",213600,1000,"GRAM",""],["m3","PLA VÀNG",236300,1000,"GRAM",""],
    ["m4","PETG ĐỎ",161300,1000,"GRAM",""],["m5","PLA CYAN",114500,1000,"GRAM","Sử dụng 200K xu"],["m6","PLA XANH LÁ",114500,1000,"GRAM",""],
    ["m7","PETG SIL",116000,1000,"GRAM",""],["m8","PETG WOOD",116000,1000,"GRAM",""],["m9","PETG TRANS",244400,1000,"GRAM","Không lõi"],
    ["m10","PLA TRẮNG",211400,1000,"GRAM",""],["m11","PLA ĐEN",211400,1000,"GRAM",""],["m12","BÚT MÀU",48400,1,"BỘ",""],
    ["m13","100 MÓC KHOÁ",45865,100,"CÁI",""],["m14","2 KÝ GIẤY RƠM GÓI HÀNG",120000,2,"KÝ",""],["m15","KỀM",110000,1,"CÂY",""],
    ["m16","COMBO ĐÈN + DÂY E27 CÔNG TẮC TEST",61000,1,"BỘ",""],["m17","2 ĐÈN LED R=6CM",95940,2,"CÁI",""],
    ["m18","COMBO 10 ĐÈN LED E27",54287,10,"CÁI",""],["m19","GIẤY RƠM GÓI HÀNG NỮA KÝ",44000,.5,"KÝ",""],
    ["m20","10 DÂY CÓ CÔNG TẮC",272000,10,"CÁI",""],["m21","9 CHUÔI ĐÈN E27",93600,9,"CÁI",""]
  ].map(([id,name,cost,quantity,unit,note])=>({id,name,cost,quantity,unit,note})),
  products: [
    {id:"p1",name:"Mẫu đèn 01",multiplier:2.57,rounding:1000,targetPrice:239000,components:[
      ["Đế","m8",161],["4 nút nâng đế","m8",6],["Adapter nếu có","m8",12],["Thân đèn","m9",120],
      ["Bộ đèn","m16",0],["Dây có công tắc","m20",1],["Bóng đèn","m18",1],["Chuôi E27","m21",1]
    ].map(([name,materialId,quantity])=>({id:uid(),name,materialId,quantity,printHours:0}))},
    {id:"p2",name:"Mẫu đèn 02 — Bộ 1",multiplier:2.57,rounding:1000,targetPrice:139000,components:[
      ["Thân đèn","m9",73],["Dây có công tắc","m20",1],["Bóng đèn","m18",1],["Chuôi E27","m21",1],["Đế E27","m8",93]
    ].map(([name,materialId,quantity])=>({id:uid(),name,materialId,quantity,printHours:0}))},
    {id:"p3",name:"Mẫu đèn 02 — Bộ 2",multiplier:2.57,rounding:1000,targetPrice:139000,components:[
      ["Thân đèn","m9",73],["Đế","m8",33],["Bộ đèn","m17",1]
    ].map(([name,materialId,quantity])=>({id:uid(),name,materialId,quantity,printHours:0}))},
    {id:"p4",name:"Mẫu đèn 03",multiplier:2.57,rounding:1000,targetPrice:199000,components:[
      ["Đế","m8",38],["Thân đèn","m9",101],["Bộ đèn","m17",1]
    ].map(([name,materialId,quantity])=>({id:uid(),name,materialId,quantity,printHours:0}))}
  ]
};

let state = loadState();
let currentView = "dashboard";
let currentProductId = null;
let confirmCallback = null;

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => new Intl.NumberFormat("vi-VN", {style:"currency",currency:"VND",maximumFractionDigits:0}).format(Number(n)||0);
const number = n => new Intl.NumberFormat("vi-VN", {maximumFractionDigits:1}).format(Number(n)||0);
function uid(){ return Math.random().toString(36).slice(2,9); }
function unitPrice(m){ return m && m.quantity ? m.cost / m.quantity : 0; }
function componentCost(c){ return unitPrice(state.materials.find(m=>m.id===c.materialId)) * (Number(c.quantity)||0); }
function defaults(){ return {machineValue:19865000,machineLifetimeHours:6000,powerKw:.12,electricityRate:3500,laborHours:0,laborRate:25000,wasteRate:8,packagingCost:10000,shippingCost:0,otherCost:0,platformFeeRate:15,targetMarginRate:25}; }
function normalizeProduct(p){p.image=/^data:image\/(jpeg|png|webp|gif);base64,/i.test(p.image||"")?p.image:"";p.rounding=Number(p.rounding)||1000;p.targetPrice=Number(p.targetPrice)||0;p.costing={...defaults(),...(p.costing||{})};p.components=(p.components||[]).map(c=>({...c,printHours:Number(c.printHours)||0}));return p;}
function materialSubtotal(p){ return p.components.reduce((sum,c)=>sum+componentCost(c),0); }
function totalPrintHours(p){ return p.components.reduce((sum,c)=>sum+(Number(c.printHours)||0),0); }
function machineHourlyRate(p){const c=p.costing;return Number(c.machineLifetimeHours)>0?(Number(c.machineValue)||0)/Number(c.machineLifetimeHours):(Number(c.machineRate)||0);}
function costBreakdown(p){
  const c=p.costing, materials=materialSubtotal(p), printHours=totalPrintHours(p);
  const waste=materials*(Number(c.wasteRate)||0)/100;
  const machine=printHours*machineHourlyRate(p);
  const electricity=printHours*(Number(c.powerKw)||0)*(Number(c.electricityRate)||0);
  const labor=(Number(c.laborHours)||0)*(Number(c.laborRate)||0);
  const packaging=Number(c.packagingCost)||0, shipping=Number(c.shippingCost)||0, other=Number(c.otherCost)||0;
  return {materials,waste,machine,electricity,labor,packaging,shipping,other,printHours,total:materials+waste+machine+electricity+labor+packaging+shipping+other};
}
function productCost(p){ return costBreakdown(p).total; }
function suggestedPrice(p){ const c=p.costing, denominator=1-(Number(c.platformFeeRate)||0)/100-(Number(c.targetMarginRate)||0)/100; const raw=denominator>0?productCost(p)/denominator:productCost(p); const step=Number(p.rounding)||1; return Math.ceil(raw/step)*step; }
function totalInvestment(){ return state.materials.reduce((sum,m)=>sum+(Number(m.cost)||0),0); }
function clone(data){ return JSON.parse(JSON.stringify(data)); }
function loadState(){ try { const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)); if(saved?.materials?.length && saved?.products){saved.products.forEach(normalizeProduct);return saved;} } catch(e){} const fresh=clone(seed);fresh.products.forEach(normalizeProduct);return fresh; }
function persistLocal(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){toast("Bộ nhớ ảnh đã đầy — hãy dùng ảnh nhẹ hơn");}}
function saveState(){persistLocal();updatePills();if(currentUser&&cloudReady)scheduleCloudSync();}
function updatePills(){ $("#productCountPill").textContent=state.products.length; $("#materialCountPill").textContent=state.materials.length; }
function toast(message){ const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),1900); }
function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const max=720,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.7));};img.src=reader.result;};reader.readAsDataURL(file);});}

function setSyncStatus(text,mode="local"){const el=$("#syncState");if(!el)return;el.lastChild.textContent=text;el.dataset.mode=mode;}
function cloudPayload(){return {materials:clone(state.materials),products:state.products.map(({image,...p})=>({...clone(p),image:""})),updatedAt:serverTimestamp(),version:2};}
function scheduleCloudSync(){clearTimeout(syncTimer);setSyncStatus("Đang chờ lưu…","saving");syncTimer=setTimeout(syncCloudState,650);}
async function syncCloudState(){if(!currentUser||!cloudReady)return;setSyncStatus("Đang đồng bộ…","saving");try{await setDoc(doc(db,"users",currentUser.uid,"app","data"),cloudPayload());setSyncStatus("Đã đồng bộ","synced");}catch(error){console.error(error);setSyncStatus("Lỗi đồng bộ","error");toast(firebaseErrorMessage(error));}}
async function syncImage(productId,dataUrl){if(!currentUser||!cloudReady)return;try{await setDoc(doc(db,"users",currentUser.uid,"images",productId),{dataUrl,updatedAt:serverTimestamp()});setSyncStatus("Đã đồng bộ","synced");}catch(error){console.error(error);toast(firebaseErrorMessage(error));}}
async function removeCloudImage(productId){if(!currentUser||!cloudReady)return;try{await deleteDoc(doc(db,"users",currentUser.uid,"images",productId));}catch(error){console.error(error);}}
async function loadCloudState(user){setSyncStatus("Đang tải cloud…","saving");cloudReady=false;try{const ref=doc(db,"users",user.uid,"app","data"),snap=await getDoc(ref);if(snap.exists()){const data=snap.data();state={materials:Array.isArray(data.materials)?data.materials:[],products:Array.isArray(data.products)?data.products:[]};state.products.forEach(normalizeProduct);await Promise.all(state.products.map(async p=>{const imageSnap=await getDoc(doc(db,"users",user.uid,"images",p.id));if(imageSnap.exists())p.image=normalizeProduct({...p,image:imageSnap.data().dataUrl}).image;}));persistLocal();updatePills();navigate(currentView,currentProductId);}else{cloudReady=true;await syncCloudState();for(const p of state.products)if(p.image)await syncImage(p.id,p.image);}cloudReady=true;setSyncStatus("Đã đồng bộ","synced");}catch(error){console.error(error);cloudReady=false;setSyncStatus("Cloud chưa kết nối","error");toast(firebaseErrorMessage(error));}}
function updateAuthUI(user){const btn=$("#authBtn");if(!btn)return;if(user){btn.innerHTML=`${user.photoURL?`<img src="${escapeAttr(user.photoURL)}" alt="">`:""}<span>${escapeHtml(user.displayName||user.email||"Tài khoản")}</span><b>Đăng xuất</b>`;btn.dataset.signedIn="true";btn.title=user.email||"";}else{btn.textContent="Đăng nhập Google";btn.dataset.signedIn="false";btn.title="Đăng nhập để đồng bộ cloud";setSyncStatus("Lưu trên máy","local");}}
function firebaseErrorMessage(error){const code=error?.code||"";if(code.includes("unauthorized-domain"))return "Hãy thêm domain GitHub Pages vào Authorized domains";if(code.includes("permission-denied"))return "Firestore đang chặn quyền — cần cập nhật Rules";if(code.includes("popup-blocked"))return "Trình duyệt đang chặn cửa sổ đăng nhập";if(code.includes("network"))return "Không có kết nối tới Firebase";return "Chưa đồng bộ được Firebase";}

function navigate(view, productId){
  currentView=view; currentProductId=productId || currentProductId;
  $$(".view").forEach(v=>v.classList.remove("active"));
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===view || (view==="editor"&&n.dataset.view==="products")));
  const map={dashboard:"dashboardView",products:"productsView",materials:"materialsView",editor:"editorView"};
  $("#"+map[view]).classList.add("active");
  const crumbs={dashboard:"Tổng quan",products:"Mẫu sản phẩm",materials:"Kho vật tư",editor:`Mẫu sản phẩm / <strong>${escapeHtml(state.products.find(p=>p.id===currentProductId)?.name||"Chỉnh sửa")}</strong>`};
  $("#breadcrumb").innerHTML=crumbs[view];
  if(view==="dashboard") renderDashboard(); if(view==="products") renderProducts(); if(view==="materials") renderMaterials(); if(view==="editor") renderEditor();
  $(".sidebar").classList.remove("open"); window.scrollTo({top:0,behavior:"smooth"});
}

function pageHeading(kicker,title,desc,action=""){
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${desc}</p></div>${action||`<span class="date-chip">${new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"long",year:"numeric"}).format(new Date())}</span>`}</div>`;
}

function renderDashboard(){
  const products=[...state.products].sort((a,b)=>productCost(b)-productCost(a));
  const avg=products.length?products.reduce((s,p)=>s+suggestedPrice(p),0)/products.length:0;
  const topMaterials=[...state.materials].sort((a,b)=>b.cost-a.cost).slice(0,4); const max=topMaterials[0]?.cost||1;
  $("#dashboardView").innerHTML=`
    ${pageHeading("BẢNG ĐIỀU KHIỂN","Chào xưởng, hôm nay tính gì?","Mọi con số được cập nhật trực tiếp từ kho vật tư và định mức sản phẩm.")}
    <div class="kpi-grid">
      <article class="kpi-card accent"><span class="kpi-label">Tổng vốn đã nhập</span><strong class="kpi-value">${compactMoney(totalInvestment())}</strong><span class="kpi-meta">${state.materials.length} hạng mục trong kho</span></article>
      <article class="kpi-card"><span class="kpi-label">Mẫu sản phẩm</span><strong class="kpi-value">${state.products.length}</strong><span class="kpi-meta">Nhấn vào mẫu để chỉnh BOM</span></article>
      <article class="kpi-card"><span class="kpi-label">Giá bán gợi ý TB</span><strong class="kpi-value">${compactMoney(avg)}</strong><span class="kpi-meta">Đã gồm chi phí và biên lợi nhuận</span></article>
      <article class="kpi-card"><span class="kpi-label">Đơn giá PETG Wood</span><strong class="kpi-value">${money(unitPrice(state.materials.find(m=>m.name==="PETG WOOD")))}</strong><span class="kpi-meta">Mỗi gram vật tư</span></article>
    </div>
    <div class="dashboard-grid">
      <article class="panel"><div class="panel-head"><h3>Mẫu sản phẩm gần đây</h3><button class="link-button" data-go="products">Xem tất cả</button></div>
        <div>${products.slice(0,5).map((p,i)=>productRow(p,i)).join("") || `<div class="empty-state">Chưa có mẫu nào.</div>`}</div>
      </article>
      <article class="panel"><div class="panel-head"><h3>Khoản đầu tư lớn</h3><button class="link-button" data-go="materials">Mở kho</button></div>
        <div class="material-bars">${topMaterials.map(m=>`<div class="bar-item"><div class="bar-item-head"><span>${escapeHtml(m.name)}</span><strong>${compactMoney(m.cost)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(5,m.cost/max*100)}%"></div></div></div>`).join("")}</div>
      </article>
    </div>`;
}

function productVisual(p,fallback){return p.image?`<img src="${p.image}" alt="" />`:escapeHtml(fallback);}
function productRow(p,i){return `<div class="product-row" data-product-id="${p.id}"><span class="product-avatar ${p.image?"has-image":""}">${productVisual(p,String(i+1).padStart(2,"0"))}</span><div class="product-name"><strong>${escapeHtml(p.name)}</strong><small>${p.components.length} cấu phần · ${number(totalPrintHours(p))} giờ máy</small></div><div class="cost-cell"><span class="cell-label">Giá thành đủ</span><span class="money">${money(productCost(p))}</span></div><div class="optional-cell"><span class="cell-label">Giá gợi ý</span><span class="money">${money(suggestedPrice(p))}</span></div><span class="price-tag">${p.targetPrice?compactMoney(p.targetPrice):"Chưa chốt"}</span></div>`}

function renderProducts(filter=""){
  const list=state.products.filter(p=>p.name.toLowerCase().includes(filter.toLowerCase()));
  $("#productsView").innerHTML=`${pageHeading("THƯ VIỆN MẪU","Mẫu sản phẩm","Quản lý định mức, giá vốn và giá bán của từng mẫu.",`<button class="primary-button" data-create-product>＋ Tạo mẫu mới</button>`)}
  <div class="section-toolbar"><div class="search-wrap"><input id="productSearch" value="${escapeAttr(filter)}" placeholder="Tìm theo tên mẫu..." /></div><span class="date-chip">${list.length} mẫu</span></div>
  <div class="product-grid">${list.map((p,i)=>`<article class="product-card" data-product-id="${p.id}"><div class="product-cover ${p.image?"has-image":""}">${productVisual(p,"Chưa có ảnh")}</div><div class="product-card-top"><span class="product-index">MẪU ${String(i+1).padStart(2,"0")}</span><button class="card-menu" data-duplicate="${p.id}" title="Nhân bản">⧉</button></div><h3>${escapeHtml(p.name)}</h3><p>${p.components.length} cấu phần · ${number(totalPrintHours(p))} giờ máy</p><div class="card-stats"><div><strong>${money(productCost(p))}</strong><span>Giá thành đủ</span></div><div><strong>${money(suggestedPrice(p))}</strong><span>Giá gợi ý</span></div></div></article>`).join("")}<article class="product-card new-card" data-create-product><div><b>＋</b><h3>Tạo mẫu mới</h3><p>Bắt đầu từ một BOM trống</p></div></article></div>`;
}

function createProduct(){ const p=normalizeProduct({id:uid(),name:"Mẫu mới",rounding:1000,targetPrice:0,components:[{id:uid(),name:"Cấu phần 1",materialId:state.materials[0]?.id||"",quantity:1,printHours:0}]});state.products.push(p);saveState();navigate("editor",p.id);toast("Đã tạo mẫu mới"); }
function duplicateProduct(id){const source=state.products.find(p=>p.id===id);if(!source)return;const p=clone(source);p.id=uid();p.name += " — Bản sao";p.components.forEach(c=>c.id=uid());state.products.push(p);saveState();if(p.image)syncImage(p.id,p.image);renderProducts();toast("Đã nhân bản mẫu");}

function renderEditor(){
  const p=state.products.find(x=>x.id===currentProductId);if(!p){navigate("products");return;}
  const b=costBreakdown(p),c=p.costing;
  $("#editorView").innerHTML=`${pageHeading("CHỈNH ĐỊNH MỨC","Cân đối giá thành đầy đủ","Gram nhựa chỉ là một phần — thời gian máy và phụ phí cũng phải được trả tiền.",`<button class="secondary-button" data-back-products>← Trở lại</button>`)}
    <div class="editor-layout"><div class="editor-main"><div class="editor-head"><div class="editor-title-wrap"><div class="editor-thumb ${p.image?"has-image":""}">${productVisual(p,"◇")}</div><div><input class="title-input" id="productName" value="${escapeAttr(p.name)}" /><p>${p.components.length} cấu phần · ${number(b.printHours)} giờ máy · tự lưu</p></div></div><div class="editor-head-actions"><label class="image-upload-button">▣ Ảnh sản phẩm<input id="productImageInput" type="file" accept="image/*" hidden /></label>${p.image?`<button class="icon-button" data-remove-image title="Xoá ảnh">×</button>`:""}<button class="icon-button" data-duplicate="${p.id}" title="Nhân bản">⧉</button><button class="icon-button" data-delete-product="${p.id}" title="Xoá mẫu">⌫</button></div></div>
    <div class="bom-head"><span>Tên cấu phần</span><span>Vật tư sử dụng</span><span>Lượng dùng</span><span>Giờ máy</span><span style="text-align:right">Chi phí trực tiếp</span><span></span></div><div id="bomRows">${p.components.map(x=>bomRow(p,x)).join("")}</div><button class="add-row" data-add-component>＋ Thêm cấu phần</button>
    <section class="cost-settings"><div class="cost-settings-head"><div><span class="eyebrow">THÔNG SỐ SẢN XUẤT</span><h3>Máy, nhân công và phụ phí</h3></div><p>Các giá trị này áp dụng riêng cho mẫu đang mở.</p></div>
      <div class="settings-group"><h4>Vận hành máy in</h4><div class="settings-grid four"><label>Giá trị máy<input data-cost-field="machineValue" type="number" min="0" step="100000" value="${c.machineValue}"><small>Giá mua máy và nâng cấp</small></label><label>Vòng đời dự kiến (giờ)<input data-cost-field="machineLifetimeHours" type="number" min="1" step="100" value="${c.machineLifetimeHours}"><small id="machineRateHint">Khấu hao hiện tại: ${money(machineHourlyRate(p))}/giờ</small></label><label>Công suất máy (kW)<input data-cost-field="powerKw" type="number" min="0" step=".01" value="${c.powerKw}"><small>120W = 0,12 kW</small></label><label>Giá điện / kWh<input data-cost-field="electricityRate" type="number" min="0" step="100" value="${c.electricityRate}"><small>Tra theo hoá đơn điện thực tế</small></label></div></div>
      <div class="settings-group"><h4>Hoàn thiện & rủi ro</h4><div class="settings-grid"><label>Giờ nhân công<input data-cost-field="laborHours" type="number" min="0" step=".1" value="${c.laborHours}"></label><label>Nhân công / giờ<input data-cost-field="laborRate" type="number" min="0" step="1000" value="${c.laborRate}"></label><label>Hao hụt vật tư (%)<input data-cost-field="wasteRate" type="number" min="0" step=".5" value="${c.wasteRate}"><small>Bù lỗi in, support, test mẫu</small></label></div></div>
      <div class="settings-group"><h4>Đóng gói & bán hàng</h4><div class="settings-grid four"><label>Đóng gói<input data-cost-field="packagingCost" type="number" min="0" step="1000" value="${c.packagingCost}"></label><label>Vận chuyển hỗ trợ<input data-cost-field="shippingCost" type="number" min="0" step="1000" value="${c.shippingCost}"></label><label>Phụ phí khác<input data-cost-field="otherCost" type="number" min="0" step="1000" value="${c.otherCost}"></label><label>Phí sàn (%)<input data-cost-field="platformFeeRate" type="number" min="0" max="90" step=".5" value="${c.platformFeeRate}"></label><label>Lợi nhuận mục tiêu (%)<input data-cost-field="targetMarginRate" type="number" min="0" max="90" step="1" value="${c.targetMarginRate}"></label><label>Làm tròn giá<input id="roundingInput" type="number" min="1" step="1000" value="${p.rounding}"></label></div></div>
    </section></div>
    <aside class="summary-card"><h3>Cấu thành giá</h3><div class="summary-line"><span>Vật tư</span><strong id="materialSummary">${money(b.materials)}</strong></div><div class="summary-line"><span>Hao hụt vật tư</span><strong id="wasteSummary">${money(b.waste)}</strong></div><div class="summary-line"><span>Máy & khấu hao · ${number(b.printHours)}h × ${money(machineHourlyRate(p))}</span><strong id="machineSummary">${money(b.machine)}</strong></div><div class="summary-line"><span>Điện năng</span><strong id="electricitySummary">${money(b.electricity)}</strong></div><div class="summary-line"><span>Nhân công</span><strong id="laborSummary">${money(b.labor)}</strong></div><div class="summary-line"><span>Đóng gói, ship & khác</span><strong id="extraSummary">${money(b.packaging+b.shipping+b.other)}</strong></div><div class="summary-line total-line"><span>Tổng giá thành</span><strong id="costSummary">${money(b.total)}</strong></div><div class="summary-total"><span>Giá bán gợi ý</span><strong id="suggestedSummary">${money(suggestedPrice(p))}</strong><small id="formulaHint">Đã dành ${number(c.platformFeeRate)}% phí sàn + ${number(c.targetMarginRate)}% lợi nhuận</small></div>
    <label class="target-price-label">Giá bán bạn chốt<input id="targetPriceInput" type="number" min="0" step="1000" value="${p.targetPrice||0}" /></label><p class="profit-note" id="targetProfitNote">${targetProfitText(p)}</p></aside></div>`;
}

function componentDirectCost(p,c){return componentCost(c)+(Number(c.printHours)||0)*(machineHourlyRate(p)+(Number(p.costing.powerKw)||0)*(Number(p.costing.electricityRate)||0));}
function bomRow(p,c){return `<div class="bom-row" data-component-id="${c.id}"><input class="component-input" data-field="name" value="${escapeAttr(c.name)}" placeholder="Tên cấu phần"/><select data-field="materialId">${state.materials.map(m=>`<option value="${m.id}" ${m.id===c.materialId?"selected":""}>${escapeHtml(m.name)} · ${money(unitPrice(m))}/${escapeHtml(m.unit.toLowerCase())}</option>`).join("")}</select><input data-field="quantity" type="number" min="0" step=".1" value="${c.quantity}" title="Lượng vật tư dùng"/><input data-field="printHours" type="number" min="0" step=".1" value="${c.printHours||0}" title="Số giờ máy"/><span class="bom-cost">${money(componentDirectCost(p,c))}</span><button class="delete-row" data-remove-component title="Xoá dòng">×</button></div>`}
function targetProfitText(p){const target=Number(p.targetPrice)||0,fee=target*(Number(p.costing.platformFeeRate)||0)/100,profit=target-fee-productCost(p),margin=target?profit/target*100:0;return target?`Sau <strong>${money(fee)}</strong> phí sàn, lợi nhuận còn <strong class="${profit<0?"negative":""}">${money(profit)}</strong> (${number(margin)}% giá bán).`:"Nhập giá bán bạn muốn chốt để xem lợi nhuận thật sau phí sàn.";}
function updateEditorTotals(p){const b=costBreakdown(p),rate=machineHourlyRate(p);$("#materialSummary").textContent=money(b.materials);$("#wasteSummary").textContent=money(b.waste);$("#machineSummary").textContent=money(b.machine);$("#machineSummary").previousElementSibling.textContent=`Máy & khấu hao · ${number(b.printHours)}h × ${money(rate)}`;$("#machineRateHint").textContent=`Khấu hao hiện tại: ${money(rate)}/giờ`;$("#electricitySummary").textContent=money(b.electricity);$("#laborSummary").textContent=money(b.labor);$("#extraSummary").textContent=money(b.packaging+b.shipping+b.other);$("#costSummary").textContent=money(b.total);$("#suggestedSummary").textContent=money(suggestedPrice(p));$("#formulaHint").textContent=`Đã dành ${number(p.costing.platformFeeRate)}% phí sàn + ${number(p.costing.targetMarginRate)}% lợi nhuận`;$("#targetProfitNote").innerHTML=targetProfitText(p);$$(".bom-row").forEach(row=>{const x=p.components.find(c=>c.id===row.dataset.componentId);if(x)$(".bom-cost",row).textContent=money(componentDirectCost(p,x));});}

function renderMaterials(filter=""){
  const list=state.materials.filter(m=>[m.name,m.unit,m.note].join(" ").toLowerCase().includes(filter.toLowerCase()));
  $("#materialsView").innerHTML=`${pageHeading("DANH MỤC GỐC","Kho vật tư","Cập nhật một lần, mọi mẫu dùng vật tư đó sẽ tự tính lại.",`<button class="primary-button" data-add-material>＋ Thêm vật tư</button>`)}<div class="section-toolbar"><div class="search-wrap"><input id="materialSearch" value="${escapeAttr(filter)}" placeholder="Tìm vật tư, đơn vị, ghi chú..." /></div><span class="date-chip">${list.length} vật tư</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Hạng mục</th><th class="number">Tổng chi phí</th><th class="number">Số lượng</th><th>Đơn vị</th><th class="number">Đơn giá / 1</th><th></th></tr></thead><tbody>${list.map(m=>`<tr><td class="material-name"><strong>${escapeHtml(m.name)}</strong>${m.note?`<small>${escapeHtml(m.note)}</small>`:""}</td><td class="number">${money(m.cost)}</td><td class="number">${number(m.quantity)}</td><td>${escapeHtml(m.unit)}</td><td class="number"><strong>${money(unitPrice(m))}</strong></td><td><div class="row-actions"><button class="mini-btn" data-edit-material="${m.id}">Sửa</button><button class="mini-btn" data-delete-material="${m.id}">Xoá</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function openMaterialDialog(id){const m=state.materials.find(x=>x.id===id);$("#materialDialogTitle").textContent=m?"Chỉnh vật tư":"Thêm vật tư";$("#materialId").value=m?.id||"";$("#materialName").value=m?.name||"";$("#materialCost").value=m?.cost||"";$("#materialQuantity").value=m?.quantity||"";$("#materialUnit").value=m?.unit||"";$("#materialNote").value=m?.note||"";updateUnitPreview();$("#materialDialog").showModal();}
function updateUnitPreview(){const c=Number($("#materialCost").value)||0,q=Number($("#materialQuantity").value)||0;$("#unitPricePreview").textContent=money(q?c/q:0);}
function deleteMaterial(id){const m=state.materials.find(x=>x.id===id);const usage=state.products.reduce((n,p)=>n+p.components.filter(c=>c.materialId===id).length,0);confirm(`Xoá “${m.name}”?`,usage?`Vật tư này đang được dùng ở ${usage} cấu phần. Các dòng đó sẽ được giữ lại nhưng không còn đơn giá.`:"Thao tác này không thể hoàn tác.",()=>{state.materials=state.materials.filter(x=>x.id!==id);saveState();renderMaterials();toast("Đã xoá vật tư");});}
function confirm(title,message,cb){$("#confirmTitle").textContent=title;$("#confirmMessage").textContent=message;confirmCallback=cb;$("#confirmDialog").showModal();}

document.addEventListener("click",e=>{
  if(e.target.closest("#authBtn")){handleAuthClick();return;}
  const nav=e.target.closest("[data-view]");if(nav){navigate(nav.dataset.view);return;}
  const go=e.target.closest("[data-go]");if(go){navigate(go.dataset.go);return;}
  const product=e.target.closest("[data-product-id]");if(product && !e.target.closest("[data-duplicate]")){navigate("editor",product.dataset.productId);return;}
  if(e.target.closest("[data-create-product]")||e.target.closest("#quickAddBtn")){createProduct();return;}
  const duplicate=e.target.closest("[data-duplicate]");if(duplicate){e.stopPropagation();duplicateProduct(duplicate.dataset.duplicate);return;}
  if(e.target.closest("[data-back-products]")){navigate("products");return;}
  const delProduct=e.target.closest("[data-delete-product]");if(delProduct){const p=state.products.find(x=>x.id===delProduct.dataset.deleteProduct);confirm(`Xoá “${p.name}”?`,`Toàn bộ định mức của mẫu này sẽ bị xoá.`,()=>{state.products=state.products.filter(x=>x.id!==p.id);removeCloudImage(p.id);saveState();navigate("products");toast("Đã xoá mẫu");});return;}
  if(e.target.closest("[data-add-component]")){const p=state.products.find(x=>x.id===currentProductId);p.components.push({id:uid(),name:"Cấu phần mới",materialId:state.materials[0]?.id||"",quantity:1,printHours:0});saveState();renderEditor();return;}
  const remove=e.target.closest("[data-remove-component]");if(remove){const p=state.products.find(x=>x.id===currentProductId),row=remove.closest(".bom-row");p.components=p.components.filter(c=>c.id!==row.dataset.componentId);saveState();row.remove();updateEditorTotals(p);return;}
  if(e.target.closest("[data-remove-image]")){const p=state.products.find(x=>x.id===currentProductId);p.image="";removeCloudImage(p.id);saveState();renderEditor();toast("Đã xoá ảnh sản phẩm");return;}
  if(e.target.closest("[data-add-material]")){openMaterialDialog();return;}
  const edit=e.target.closest("[data-edit-material]");if(edit){openMaterialDialog(edit.dataset.editMaterial);return;}
  const del=e.target.closest("[data-delete-material]");if(del){deleteMaterial(del.dataset.deleteMaterial);return;}
  if(e.target.closest("[data-close-dialog]")){e.target.closest("dialog").close();return;}
  if(e.target.closest("#menuBtn")){$(".sidebar").classList.toggle("open");return;}
});

document.addEventListener("input",e=>{
  if(e.target.id==="productSearch"){renderProducts(e.target.value);$("#productSearch").focus();return;}
  if(e.target.id==="materialSearch"){renderMaterials(e.target.value);$("#materialSearch").focus();return;}
  if(["materialCost","materialQuantity"].includes(e.target.id)){updateUnitPreview();return;}
  const p=state.products.find(x=>x.id===currentProductId);if(!p)return;
  if(e.target.id==="productName"){p.name=e.target.value;saveState();return;}
  if(e.target.id==="roundingInput"){p.rounding=Number(e.target.value)||1;saveState();updateEditorTotals(p);return;}
  if(e.target.id==="targetPriceInput"){p.targetPrice=Number(e.target.value)||0;saveState();updateEditorTotals(p);return;}
  if(e.target.dataset.costField){p.costing[e.target.dataset.costField]=Number(e.target.value)||0;saveState();updateEditorTotals(p);return;}
  const row=e.target.closest(".bom-row");if(row&&e.target.dataset.field){const c=p.components.find(x=>x.id===row.dataset.componentId),field=e.target.dataset.field;c[field]=["quantity","printHours"].includes(field)?(Number(e.target.value)||0):e.target.value;saveState();updateEditorTotals(p);}
});

document.addEventListener("change",async e=>{if(e.target.id!=="productImageInput"||!e.target.files?.[0])return;const file=e.target.files[0];if(!file.type.startsWith("image/")){toast("Vui lòng chọn file ảnh");return;}try{const p=state.products.find(x=>x.id===currentProductId);p.image=await compressImage(file);saveState();await syncImage(p.id,p.image);renderEditor();toast("Đã thêm ảnh sản phẩm");}catch(err){toast("Không thể đọc ảnh này");}});

$("#materialForm").addEventListener("submit",e=>{e.preventDefault();if(!e.submitter||e.submitter.value!=="save")return;const id=$("#materialId").value;const data={id:id||uid(),name:$("#materialName").value.trim().toUpperCase(),cost:Number($("#materialCost").value),quantity:Number($("#materialQuantity").value),unit:$("#materialUnit").value.trim().toUpperCase(),note:$("#materialNote").value.trim()};const i=state.materials.findIndex(m=>m.id===id);if(i>=0)state.materials[i]=data;else state.materials.push(data);saveState();$("#materialDialog").close();renderMaterials();toast(id?"Đã cập nhật vật tư":"Đã thêm vật tư");});
$("#confirmDialog").addEventListener("close",()=>{if($("#confirmDialog").returnValue==="confirm"&&confirmCallback)confirmCallback();confirmCallback=null;});
$("#exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`xuong-nho-du-lieu-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast("Đã xuất bản sao dữ liệu");});
$("#importInput").addEventListener("change",async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data.materials)||!Array.isArray(data.products))throw Error();data.products.forEach(normalizeProduct);state=data;saveState();if(currentUser&&cloudReady)for(const p of state.products)if(p.image)await syncImage(p.id,p.image);navigate("dashboard");toast("Đã nhập dữ liệu");}catch(err){toast("File dữ liệu không hợp lệ");}e.target.value="";});

async function handleAuthClick(){if(location.protocol==="file:"){toast("Đăng nhập cloud cần mở qua GitHub Pages hoặc localhost");return;}try{if(currentUser)await signOut(auth);else await signInWithPopup(auth,googleProvider);}catch(error){console.error(error);toast(firebaseErrorMessage(error));}}

function compactMoney(n){n=Number(n)||0;if(n>=1e9)return `${number(n/1e9)} tỷ`;if(n>=1e6)return `${number(n/1e6)} triệu`;if(n>=1000)return `${number(n/1000)}K`;return money(n);}
function escapeHtml(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function escapeAttr(v=""){return escapeHtml(v);}

updatePills();navigate("dashboard");updateAuthUI(null);
onAuthStateChanged(auth,async user=>{currentUser=user;updateAuthUI(user);if(user)await loadCloudState(user);else{cloudReady=false;clearTimeout(syncTimer);}});
