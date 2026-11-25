'use strict';
const $=id=>document.getElementById(id);
const COLORS={early:'#527b56',late:'#246a58',stable:'#789579',gain:'#18a880',loss:'#d17a50'};
const NAMES={early:'Prima rilevazione',late:'Seconda rilevazione',stable:'Bosco persistente',gain:'Guadagno',loss:'Perdita'};
const fmt=(n,d=1)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:d,minimumFractionDigits:d}).format(n);
let catalog,current,mode='changes',unit='ha',opacity=.8,timer=null,request=0,baseRequest=0,baseLayer;
const dataCache=new Map(),layerCache=new Map();
const map=L.map('map',{zoomControl:false,preferCanvas:true,minZoom:3,maxZoom:18}).setView([47.2,19],5);
L.control.zoom({position:'topright'}).addTo(map);L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
map.createPane('natural');map.getPane('natural').style.zIndex=210;
for(const [name,z] of [['early',410],['late',420],['changes',430],['borders',440]]){map.createPane(name);map.getPane(name).style.zIndex=z;}
const renderers=Object.fromEntries(['early','late','changes','borders','natural'].map(k=>[k,L.canvas({pane:k,padding:.3})]));
let empireLayer,boundaryLayer,municipalityLayer,visibleLayers=[];
function error(message){$('map-error').textContent=message;$('map-error').hidden=!message;}
async function getJSON(path){if(!dataCache.has(path)){dataCache.set(path,fetch(path).then(r=>{if(!r.ok)throw new Error(`File non disponibile: ${path}`);return r.json();}).catch(e=>{dataCache.delete(path);throw e;}));}return dataCache.get(path);}
function area(n){return fmt(n*(unit==='ha'?100:1));}
function unitLabel(){return unit==='ha'?'ha':'km²';}
function fit(){if(!current)return;const [w,s,e,n]=current.bounds;map.fitBounds([[s,w],[n,e]],{paddingTopLeft:[35,85],paddingBottomRight:[35,90],maxZoom:10});}
function stopAnimation(){clearInterval(timer);timer=null;$('animate').textContent='▶ Alterna le due rilevazioni';$('animation-note').hidden=true;}
function swatch(k){return `<i class="swatch" style="background:${COLORS[k]}"></i>`;}
function updateStats(){
 $('map-title').textContent=`${current.name} · ${current.region}`;
 $('period').textContent=current.available?`${current.labels[0]} → ${current.labels[1]}${current.id==='belluno'?' · date da precisare':''}`:'Coperture in preparazione';
 $('caption').textContent=current.available?'Coperture integrali · confine imperiale di contesto · clicca un poligono per la superficie':'Háromszék · confine disponibile, rilevamenti forestali da aggiungere';
 document.querySelectorAll('.case').forEach(b=>{b.classList.toggle('active',b.dataset.case===current.id);b.setAttribute('aria-pressed',String(b.dataset.case===current.id));});
 document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=!current.available);$('animate').disabled=!current.available;
 $('downloads').innerHTML='';
 if(!current.available){$('stats').innerHTML='<p class="empty">Il quarto caso studio è pronto ad accogliere le coperture.<br><b>Nessun dato forestale disponibile.</b></p>';$('quality').textContent='Solo confine amministrativo disponibile. Nessuna superficie forestale calcolata.';return;}
 const s=current.stats;
 $('stats').innerHTML=`<div class="stat-periods"><div><label>${current.labels[0]}</label><strong>${area(s.early)}</strong><small>${unitLabel()}</small></div><div><label>${current.labels[1]}</label><strong>${area(s.late)}</strong><small>${unitLabel()}</small></div></div>`+['stable','gain','loss'].map(k=>`<div class="stat-row">${swatch(k)}<span>${NAMES[k]}</span><strong>${area(s[k])} ${unitLabel()}</strong></div>`).join('')+`<div class="stat-row net"><span>Saldo netto<br><small>${s.net_pct>=0?'+':''}${fmt(s.net_pct)}% sulla prima rilevazione</small></span><strong>${s.net>=0?'+':''}${area(s.net)} <small>${unitLabel()}</small></strong></div>`;
 for(const k of ['early','late','stable','gain','loss']){const a=document.createElement('a');a.href=`data/${current.id}-${k}.full.geojson.gz`;a.download='';a.textContent=`↓ ${NAMES[k]} · GeoJSON completo (.gz)`;$('downloads').append(a);}
 $('quality').innerHTML=`Area del confine di studio: ${fmt(current.boundary_km2,3)} km².<br>Copertura fuori dal confine di studio, conservata: ${fmt(current.outside_boundary_km2.early,4)} / ${fmt(current.outside_boundary_km2.late,4)} km².<br>Copertura entro il confine imperiale 1910: ${fmt(current.inside_empire_km2.early,3)} / ${fmt(current.inside_empire_km2.late,3)} km².<br>Ordine dei valori: prima / seconda rilevazione.<br>Fonti: ${current.sources.join('; ')}.`;
}
function updateLegend(){const ks=!current?.available?[]:mode==='changes'?['stable','gain','loss']:mode==='swipe'?['early','late']:[mode];$('legend-title').textContent=mode==='changes'?'Variazione della copertura':mode==='swipe'?'Prima ← confronto → Dopo':'Copertura forestale';$('legend-items').innerHTML=ks.map(k=>`<div class="item">${swatch(k)} ${k==='early'?current.labels[0]:k==='late'?current.labels[1]:NAMES[k]}</div>`).join('')||'<p>Rilevamenti non disponibili</p>';}
async function forestLayer(key){
 const id=`${current.id}-${key}`;
 if(!layerCache.has(id)){
  const d=await getJSON(`data/${id}.geojson`);
  const pane=['early','late'].includes(key)?key:'changes';
  const layer=L.geoJSON(d,{pane,renderer:renderers[pane],style:{color:COLORS[key],weight:.35,opacity:.65,fillColor:COLORS[key],fillOpacity:opacity},onEachFeature:(f,l)=>l.bindPopup(()=>`<b>${f.properties.case} · ${NAMES[key]}</b><br>Componente ${f.properties.component}<br><b>${fmt(f.properties.area_ha,2)} ha</b> · ${fmt(f.properties.area_km2,4)} km²<br><small>Superficie analitica non semplificata</small>`)});
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
 }catch(e){if(ticket===request)error('Impossibile caricare la copertura. '+e.message);}
 finally{if(ticket===request)$('loading').hidden=true;}
}
async function chooseCase(id){stopAnimation();current=catalog.cases.find(c=>c.id===id)||catalog.cases[0];history.replaceState(null,'',`#${current.id}`);updateStats();fit();await render();}
async function chooseBase(){
 const ticket=++baseRequest;const kind=$('basemap').value;error('');$('carto-config').hidden=kind!=='carto';
 if(kind==='carto'&&!$('carto-key').value.trim()){error('Inserisci una chiave CARTO per attivare Positron. La base precedente resta visibile.');return;}
 let next;
 if(kind==='natural'){
  $('base-note').textContent='Elementi naturali Natural Earth, scala 1:50 milioni. Dettaglio limitato agli zoom locali.';
  try{next=L.geoJSON(await getJSON('data/natural.geojson'),{pane:'natural',renderer:renderers.natural,interactive:false,style:f=>f.properties.kind==='land'?{fillColor:'#f1f2ed',fillOpacity:1,color:'#d2dcd5',weight:.7}:f.properties.kind==='lakes'?{fillColor:'#dce7e5',fillOpacity:1,color:'#c6d7d6',weight:.5}:{color:'#c5d8d7',weight:1,opacity:.85},attribution:'<a href="https://www.naturalearthdata.com/">Natural Earth</a>'});}catch(e){error('Base naturale non disponibile. Seleziona OpenStreetMap.');return;}
 }else{
  const carto=kind==='carto';$('base-note').textContent=carto?'Senza etichette; contiene anche strade ed elementi antropici.':'Cartografia attuale: non rappresenta il paesaggio storico.';
  next=L.tileLayer(carto?`https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png?key=${encodeURIComponent($('carto-key').value.trim())}`:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'+(carto?' © <a href="https://carto.com/attributions">CARTO</a>':''),crossOrigin:true});
  let failures=0;next.on('tileerror',()=>{if(ticket===baseRequest&&++failures===3)error('Alcune tessere della base non sono disponibili. Puoi usare la base Naturale locale.');});
 }
 if(ticket!==baseRequest)return;if(baseLayer)map.removeLayer(baseLayer);baseLayer=next.addTo(map);
}
async function init(){
 try{
  const [cat,emp,borders,munis]=await Promise.all(['catalog.json','empire.geojson','boundaries.geojson','municipalities.geojson'].map(n=>getJSON('data/'+n)));catalog=cat;
  empireLayer=L.geoJSON(emp,{pane:'borders',renderer:renderers.borders,interactive:false,style:{color:'#b18a4a',weight:2,dashArray:'7 6',fill:false}}).addTo(map);
  boundaryLayer=L.geoJSON(borders,{pane:'borders',renderer:renderers.borders,style:{color:'#40584c',weight:1.6,fill:false},onEachFeature:(f,l)=>l.bindTooltip(f.properties.name)}).addTo(map);
  municipalityLayer=L.geoJSON(munis,{pane:'borders',renderer:renderers.borders,style:{color:'#71629b',weight:1.8,dashArray:'3 3',fill:false},onEachFeature:(f,l)=>l.bindTooltip(f.properties.name+' · confine comunale 1991')}).addTo(map);
  for(const c of cat.cases){const b=document.createElement('button');b.className='case';b.dataset.case=c.id;b.innerHTML=`<b>${c.name}</b><small class="${c.available?'':'pending'}">${c.available?c.region:'In preparazione'}</small>`;b.onclick=()=>chooseCase(c.id);$('cases').append(b);}
  await Promise.all([chooseBase(),chooseCase(location.hash.slice(1)||'belluno')]);
 }catch(e){$('loading').hidden=true;error('Avvio non riuscito. '+e.message);}
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{stopAnimation();mode=b.dataset.mode;render();});
$('unit').onchange=()=>{unit=$('unit').value;updateStats();};$('fit').onclick=fit;$('empire-fit').onclick=()=>map.fitBounds(empireLayer.getBounds(),{padding:[45,60]});
$('opacity').oninput=()=>{opacity=Number($('opacity').value)/100;$('opacity-value').textContent=$('opacity').value+'%';visibleLayers.forEach(l=>l.setStyle({fillOpacity:opacity}));};
$('swipe').oninput=clipSwipe;map.on('move zoom zoomend moveend resize',()=>requestAnimationFrame(clipSwipe));
$('animate').onclick=async()=>{if(timer){stopAnimation();return;}mode='early';await render();if(!current.available)return;$('animation-note').hidden=false;$('animate').textContent='Ⅱ Ferma alternanza';timer=setInterval(()=>{mode=mode==='early'?'late':'early';render();},1800);};
$('basemap').onchange=chooseBase;$('carto-apply').onclick=chooseBase;
for(const [id,layer] of [['empire',()=>empireLayer],['boundaries',()=>boundaryLayer],['municipalities',()=>municipalityLayer]])$(id).onchange=()=>{const l=layer();if(l)$(id).checked?l.addTo(map):map.removeLayer(l);};
$('method-open').onclick=()=>$('method').showModal();$('method-close').onclick=()=>$('method').close();
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAnimation();});
init();
