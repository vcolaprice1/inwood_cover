'use strict';
const $=id=>document.getElementById(id);
const COLORS={early:'#526573',late:'#6535a5',stable:'#657276',gain:'#7635c5',loss:'#e65316'};
const NAMES={early:'Earlier reconstruction',late:'Later reconstruction',stable:'Persistent forest',gain:'Forest gain',loss:'Forest loss'};
const fmt=(n,d=1)=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:d,minimumFractionDigits:d}).format(n);
let catalog,current,mode='changes',unit='ha',opacity=.8,timer=null,request=0,baseRequest=0,baseLayer;
const dataCache=new Map(),layerCache=new Map();
const map=L.map('map',{zoomControl:false,preferCanvas:true,minZoom:3,maxZoom:18}).setView([47.2,19],5);
L.control.zoom({position:'topright'}).addTo(map);L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
map.createPane('natural');map.getPane('natural').style.zIndex=210;
for(const [name,z] of [['early',410],['late',420],['changes',430],['borders',440]]){map.createPane(name);map.getPane(name).style.zIndex=z;}
const renderers=Object.fromEntries(['early','late','changes','borders','natural'].map(k=>[k,L.canvas({pane:k,padding:.3})]));
let empireLayer,landsLayer,boundaryLayer,municipalityLayer,visibleLayers=[];
function error(message){$('map-error').textContent=message;$('map-error').hidden=!message;}
async function getJSON(path){if(!dataCache.has(path)){dataCache.set(path,fetch(path).then(r=>{if(!r.ok)throw new Error(`File unavailable: ${path}`);return r.json();}).catch(e=>{dataCache.delete(path);throw e;}));}return dataCache.get(path);}
function area(n){return fmt(n*(unit==='ha'?100:1));}
function unitLabel(){return unit==='ha'?'ha':'km²';}
function fit(){if(!current)return;const [w,s,e,n]=current.bounds;map.fitBounds([[s,w],[n,e]],{paddingTopLeft:[35,85],paddingBottomRight:[35,90],maxZoom:10});}
function stopAnimation(){clearInterval(timer);timer=null;$('animate').textContent='▶ Alternate the two reconstructions';$('animation-note').hidden=true;}
function swatch(k){return `<i class="swatch" style="background:${COLORS[k]}"></i>`;}
function updateStats(){
 $('date-note').textContent=current.date_note;
 $('map-title').textContent=`${current.name} · ${current.region}`;
 $('period').textContent=current.available?`${current.labels[0]} → ${current.labels[1]}`:'Forest reconstructions forthcoming';
 $('caption').textContent=current.available?'Full forest coverage · historical boundaries for context · click a polygon for its area':'Háromszék · boundary available; forest reconstructions forthcoming';
 document.querySelectorAll('.case').forEach(b=>{b.classList.toggle('active',b.dataset.case===current.id);b.setAttribute('aria-pressed',String(b.dataset.case===current.id));});
 document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=!current.available);$('animate').disabled=!current.available;
 $('downloads').innerHTML='';
 $('study-area-total').textContent=`Total study area: ${area(current.boundary_km2)} ${unitLabel()}`;
 $('forest-share').innerHTML=current.available?`<div class="share-title">Forest share of study area</div><div class="share-periods">${['early','late'].map((k,i)=>`<div><label>${current.labels[i]}</label><strong>${fmt(current.coverage.percent[k],2)}%</strong><span>${area(current.coverage.forest_inside_km2[k])} ${unitLabel()} of forest within the boundary</span></div>`).join('')}</div><p class="small">${current.coverage.change_percentage_points>=0?'+':''}${fmt(current.coverage.change_percentage_points,2)} percentage points between reconstructions.</p><a href="data/forest-share.csv" download>↓ Export forest shares · CSV</a>`:'<p class="small">Forest share unavailable until the reconstructions are added.</p>';
 if(!current.available){$('stats').innerHTML='<p class="empty">The fourth study area is ready for future reconstructions.<br><b>No forest cover data available yet.</b></p>';$('quality').textContent='Only the administrative boundary is available. No forest area has been calculated.';return;}
 const s=current.stats;
 $('stats').innerHTML=`<div class="stat-periods"><div><label>${current.labels[0]}</label><strong>${area(s.early)}</strong><small>${unitLabel()}</small></div><div><label>${current.labels[1]}</label><strong>${area(s.late)}</strong><small>${unitLabel()}</small></div></div>`+['stable','gain','loss'].map(k=>`<div class="stat-row">${swatch(k)}<span>${NAMES[k]}</span><strong>${area(s[k])} ${unitLabel()}</strong></div>`).join('')+`<div class="stat-row net"><span>Net change<br><small>${s.net_pct>=0?'+':''}${fmt(s.net_pct)}% relative to earlier forest area</small></span><strong>${s.net>=0?'+':''}${area(s.net)} <small>${unitLabel()}</small></strong></div>`;
 for(const k of ['early','late','stable','gain','loss']){const a=document.createElement('a');a.href=`data/${current.id}-${k}.full.geojson.gz`;a.download='';a.textContent=`↓ ${NAMES[k]} · Full GeoJSON (.gz)`;$('downloads').append(a);}
 $('quality').innerHTML=`Study area boundary: ${fmt(current.boundary_km2,3)} km².<br>Retained forest outside the study boundary: ${fmt(current.outside_boundary_km2.early,4)} / ${fmt(current.outside_boundary_km2.late,4)} km².<br>Forest inside the 1910 imperial boundary: ${fmt(current.inside_empire_km2.early,3)} / ${fmt(current.inside_empire_km2.late,3)} km².<br>Values are shown in earlier / later order.`;
}
function updateLegend(){const ks=!current?.available?[]:mode==='changes'?['stable','gain','loss']:mode==='swipe'?['early','late']:[mode];$('legend-title').textContent=mode==='changes'?'Forest cover change':mode==='swipe'?'Earlier ← comparison → Later':'Forest cover';$('legend-items').innerHTML=ks.map(k=>`<div class="item">${swatch(k)} ${k==='early'?current.labels[0]:k==='late'?current.labels[1]:NAMES[k]}</div>`).join('')||'<p>Reconstructions not available</p>';}
async function forestLayer(key){
 const id=`${current.id}-${key}`;
 if(!layerCache.has(id)){
  const d=await getJSON(`data/${id}.geojson`);
  const pane=['early','late'].includes(key)?key:'changes';
  const layer=L.geoJSON(d,{pane,renderer:renderers[pane],style:{color:COLORS[key],weight:.35,opacity:.65,fillColor:COLORS[key],fillOpacity:opacity},onEachFeature:(f,l)=>l.bindPopup(()=>`<b>${f.properties.case} · ${NAMES[key]}</b><br>Component ${f.properties.component}<br><b>${fmt(f.properties.area_ha,2)} ha</b> · ${fmt(f.properties.area_km2,4)} km²<br><small>Unsimplified analytical area</small>`)});
  layerCache.set(id,layer);
 }
 return layerCache.get(id);
}
function clipSwipe(){
 const active=mode==='swipe'&&current?.available;
 $('swipe-line').hidden=!active;$('swipe-control').hidden=!active;
 const percent=Number($('swipe').value);$('swipe-line').style.left=percent+'%';
 const bounds=$('map').getBoundingClientRect();const cut=bounds.left+bounds.width*percent/100;
 for(const k of ['early','late']){const canvas=map.getPane(k).querySelector('canvas');if(!canvas)continue;const rect=canvas.getBoundingClientRect();canvas.style.clipPath=active?(k==='early'?`inset(0 ${Math.max(0,rect.right-cut)}px 0 0)`:`inset(0 0 0 ${Math.max(0,cut-rect.left)}px)`):'';}
}
async function render(){
 const ticket=++request;error('');$('loading').hidden=false;
 visibleLayers.forEach(l=>map.removeLayer(l));visibleLayers=[];
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});updateLegend();
 try{
  if(current.available){const keys=mode==='changes'?['stable','loss','gain']:mode==='swipe'?['early','late']:[mode];const layers=await Promise.all(keys.map(forestLayer));if(ticket!==request)return;visibleLayers=layers;layers.forEach(l=>{l.setStyle({fillOpacity:opacity});l.addTo(map);});}
  clipSwipe();
 }catch(e){if(ticket===request)error('Unable to load forest coverage. '+e.message);}
 finally{if(ticket===request)$('loading').hidden=true;}
}
async function chooseCase(id){stopAnimation();current=catalog.cases.find(c=>c.id===id)||catalog.cases[0];history.replaceState(null,'',`#${current.id}`);updateStats();fit();await render();}
async function naturalFallback(ticket){
 if(ticket!==baseRequest)return;
 if(baseLayer){map.removeLayer(baseLayer);baseLayer=null;}
 try{
  const data=await getJSON('data/natural.geojson');if(ticket!==baseRequest)return;
  baseLayer=L.geoJSON(data,{pane:'natural',renderer:renderers.natural,interactive:false,style:f=>f.properties.kind==='land'?{fillColor:'#f1f2ed',fillOpacity:1,color:'#d2dcd5',weight:.7}:f.properties.kind==='lakes'?{fillColor:'#dce7e5',fillOpacity:1,color:'#c6d7d6',weight:.5}:{color:'#c5d8d7',weight:1,opacity:.85},attribution:'<a href="https://www.naturalearthdata.com/">Natural Earth</a>'}).addTo(map);
  $('base-note').textContent='Fallback active: Natural Earth (1:50 million), not OSM. Vector tiles or WebGL are unavailable. Select standard OSM for more detail.';
 }catch(e){error('Basemap unavailable. Please select standard OpenStreetMap.');}
}
async function chooseBase(){
 const ticket=++baseRequest;const kind=$('basemap').value;error('');
 if(baseLayer){map.removeLayer(baseLayer);baseLayer=null;}
 if(kind==='natural'){
  $('base-note').textContent='Present-day water and natural land cover. No labels, roads, buildings or settlements.';
  try{
   const style=await getJSON('data/osm-natural-style.json');if(ticket!==baseRequest)return;
   baseLayer=L.maplibreGL({style,pane:'natural',interactive:false,attributionControl:{customAttribution:'<a href="https://openfreemap.org/">OpenFreeMap</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}}).addTo(map);
   const gl=baseLayer.getMaplibreMap();let failed=false;
   gl.on('error',()=>{if(!failed&&ticket===baseRequest){failed=true;naturalFallback(ticket);}});
  }catch(e){await naturalFallback(ticket);}
 }else{
  $('base-note').textContent='Present-day cartography; does not represent the historical landscape.';
  baseLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',crossOrigin:true}).addTo(map);
  let failures=0;baseLayer.on('tileerror',()=>{if(ticket===baseRequest&&++failures===3)error('Some basemap tiles are unavailable. Try the natural-features basemap.');});
 }
}
async function init(){
 try{
  const [cat,emp,borders,munis,lands]=await Promise.all(['catalog.json','empire.geojson','boundaries.geojson','municipalities.geojson','lands.geojson'].map(n=>getJSON('data/'+n)));catalog=cat;
  const outline=(data,style,tooltip=false)=>L.geoJSON(data,{pane:'borders',renderer:renderers.borders,interactive:tooltip,style:{fill:false,...style},onEachFeature:tooltip?(f,l)=>l.bindTooltip(f.properties.name):undefined});
  landsLayer=L.featureGroup([outline(lands,{color:'#fff',weight:4,opacity:.8}),outline(lands,{color:'#655367',weight:1.7,opacity:.85,dashArray:'6 3'},true)]).addTo(map);
  empireLayer=L.featureGroup([outline(emp,{color:'#fff',weight:6.5,opacity:.9}),outline(emp,{color:'#172a40',weight:3.5,opacity:.9})]).addTo(map);
  $('chronology').innerHTML=cat.cases.map(c=>`<div class="chronology-case"><h4>${c.name} · ${c.region}</h4>${c.available?`<p><b>Earlier · ${c.periods[0]}</b><br>${c.early_note}</p><p><b>Later · ${c.periods[1]}</b><br>${c.late_note}</p>`:'<p>Forest reconstructions forthcoming.</p>'}</div>`).join('');
  boundaryLayer=L.geoJSON(borders,{pane:'borders',renderer:renderers.borders,style:{color:'#4a4336',weight:1.8,opacity:.9,fill:false},onEachFeature:(f,l)=>l.bindTooltip(f.properties.name)}).addTo(map);
  municipalityLayer=L.geoJSON(munis,{pane:'borders',renderer:renderers.borders,style:{color:'#997324',weight:2,dashArray:'3 3',opacity:.9,fill:false},onEachFeature:(f,l)=>l.bindTooltip(f.properties.name+' · municipal boundary, 1991')}).addTo(map);
  for(const c of cat.cases){const b=document.createElement('button');b.className='case';b.dataset.case=c.id;b.innerHTML=`<b>${c.name}</b><small class="${c.available?'':'pending'}">${c.available?c.region:'Forthcoming'}</small>`;b.onclick=()=>chooseCase(c.id);$('cases').append(b);}
  await Promise.all([chooseBase(),chooseCase(location.hash.slice(1)||'belluno')]);
 }catch(e){$('loading').hidden=true;error('Unable to start the atlas. '+e.message);}
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{stopAnimation();mode=b.dataset.mode;render();});
$('unit').onchange=()=>{unit=$('unit').value;updateStats();};$('fit').onclick=fit;$('empire-fit').onclick=()=>map.fitBounds(empireLayer.getBounds(),{padding:[45,60]});
$('opacity').oninput=()=>{opacity=Number($('opacity').value)/100;$('opacity-value').textContent=$('opacity').value+'%';visibleLayers.forEach(l=>l.setStyle({fillOpacity:opacity}));};
$('swipe').oninput=clipSwipe;map.on('move zoom zoomend moveend resize',()=>requestAnimationFrame(clipSwipe));
$('animate').onclick=async()=>{if(timer){stopAnimation();return;}mode='early';await render();if(!current.available)return;$('animation-note').hidden=false;$('animate').textContent='Ⅱ Stop alternating';timer=setInterval(()=>{mode=mode==='early'?'late':'early';render();},1800);};
$('basemap').onchange=chooseBase;
for(const [id,layer] of [['empire',()=>empireLayer],['lands',()=>landsLayer],['boundaries',()=>boundaryLayer],['municipalities',()=>municipalityLayer]])$(id).onchange=()=>{const l=layer();if(l)$(id).checked?l.addTo(map):map.removeLayer(l);};
$('method-open').onclick=()=>$('method').showModal();$('method-close').onclick=()=>$('method').close();
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAnimation();});
init();
