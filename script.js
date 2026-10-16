
const imageSet=[
 {name:'Recámara',url:'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80'},
 {name:'Sala',url:'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80'},
 {name:'Cocina',url:'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'},
 {name:'Baño',url:'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=800&q=80'},
 {name:'Estudio',url:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80'},
 {name:'Comedor',url:'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80'}
];
let rooms=[
 {id:1,name:'Recámara',devices:2,on:true,brightness:80,image:0},
 {id:2,name:'Sala',devices:3,on:true,brightness:60,image:1},
 {id:3,name:'Cocina',devices:2,on:false,brightness:0,image:2},
 {id:4,name:'Baño',devices:1,on:true,brightness:70,image:3},
 {id:5,name:'Estudio',devices:2,on:false,brightness:0,image:4}
];
let selectedImage=0,editingId=null,notificationsEnabled=true,autoMode=false,deviceOn=false;
const $=s=>document.querySelector(s);
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2600)}
function renderRooms(filter=''){
 const root=$('#rooms');root.innerHTML='';
 const filtered=rooms.filter(r=>r.name.toLowerCase().includes(filter.toLowerCase()));
 filtered.forEach(r=>{
  const el=document.createElement('article');el.className='room';
  el.innerHTML=`<img src="${imageSet[r.image].url}" alt="Fotografía ilustrativa de ${r.name}" loading="lazy"><div class="room-info"><div class="room-title"><strong>${escapeHtml(r.name)}</strong><button class="switch ${r.on?'on':''}" data-toggle="${r.id}" aria-label="Encender ${escapeHtml(r.name)}"></button></div><small>${r.devices} ${r.devices===1?'dispositivo':'dispositivos'}</small><div class="brightness"><span>☼</span><input type="range" min="0" max="100" value="${r.brightness}" data-bright="${r.id}" aria-label="Brillo de ${escapeHtml(r.name)}"><span>${r.brightness}%</span></div><div style="display:flex;gap:6px;margin-top:10px"><button class="secondary" data-edit="${r.id}" style="font-size:11px;padding:5px 8px">Editar</button><button class="secondary" data-delete="${r.id}" style="font-size:11px;padding:5px 8px">Eliminar</button></div></div>`;
  root.appendChild(el);
 });
 const create=document.createElement('button');create.className='create-room';create.innerHTML='<span class="plus">＋</span><b>Crear habitación</b><small>Personaliza un nuevo espacio en tu hogar.</small>';create.onclick=()=>openModal();root.appendChild(create);
 $('#roomCount').textContent=rooms.length;$('#lightsOn').textContent=rooms.filter(r=>r.on).length+' encendidas';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function openModal(id=null){editingId=id;const r=rooms.find(x=>x.id===id);$('#modalTitle').textContent=r?'Editar habitación':'Crear habitación';$('#roomName').value=r?r.name:'';$('#roomDevices').value=(r?r.devices:1)+' dispositivo'+((r?r.devices:1)===1?'':'s');selectedImage=r?r.image:0;renderImageChoices();$('#roomModal').classList.add('show');$('#roomName').focus()}
function renderImageChoices(){const root=$('#imageChoices');root.innerHTML='';imageSet.forEach((im,i)=>{const b=document.createElement('button');b.className='image-choice '+(i===selectedImage?'active':'');b.innerHTML=`<img src="${im.url}" alt="${im.name}">`;b.title=im.name;b.onclick=()=>{selectedImage=i;renderImageChoices()};root.appendChild(b)})}
function closeModal(){$('#roomModal').classList.remove('show')}
function saveRoom(){const name=$('#roomName').value.trim();if(!name){toast('Escribe un nombre para la habitación.');$('#roomName').focus();return}const devices=parseInt($('#roomDevices').value,10)||1;if(editingId){const r=rooms.find(x=>x.id===editingId);Object.assign(r,{name,devices,image:selectedImage});toast('Habitación actualizada.')}else{rooms.push({id:Date.now(),name,devices,on:false,brightness:0,image:selectedImage});toast('Habitación creada correctamente.')}closeModal();renderRooms($('#search').value);refreshScheduleRooms()}
function setRoomPower(id,on){const r=rooms.find(x=>x.id===id);if(!r)return;r.on=on;if(!on)r.brightness=0;else if(r.brightness===0)r.brightness=70;renderRooms($('#search').value);toast(`${r.name}: luz ${on?'encendida':'apagada'} (modo demo)`);updateAllSwitch()}
function updateAllSwitch(){$('#allLights').classList.toggle('on',rooms.some(r=>r.on));$('#mainPower').textContent=deviceOn?'Apagar':'Encender';}
$('#rooms').addEventListener('click',e=>{const t=e.target.closest('[data-toggle]');if(t){const r=rooms.find(x=>x.id===+t.dataset.toggle);setRoomPower(r.id,!r.on);return}const edit=e.target.closest('[data-edit]');if(edit){openModal(+edit.dataset.edit);return}const del=e.target.closest('[data-delete]');if(del){const r=rooms.find(x=>x.id===+del.dataset.delete);if(confirm(`¿Eliminar la habitación "${r.name}"?`)){rooms=rooms.filter(x=>x.id!==r.id);renderRooms($('#search').value);refreshScheduleRooms();toast('Habitación eliminada.')}return}});
$('#rooms').addEventListener('input',e=>{if(e.target.matches('[data-bright]')){const r=rooms.find(x=>x.id===+e.target.dataset.bright);r.brightness=+e.target.value;r.on=r.brightness>0;const val=e.target.parentElement.querySelector('span:last-child');val.textContent=r.brightness+'%';const card=e.target.closest('.room');card.querySelector('.switch').classList.toggle('on',r.on);$('#lightsOn').textContent=rooms.filter(x=>x.on).length+' encendidas';updateAllSwitch()}});
$('#newRoom').onclick=()=>openModal();$('#saveRoom').onclick=saveRoom;$('#cancelRoom').onclick=closeModal;$('#roomModal').addEventListener('click',e=>{if(e.target.id==='roomModal')closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Enter'&&$('#roomModal').classList.contains('show'))saveRoom()});
$('#allLights').onclick=()=>{const turnOn=!rooms.every(r=>r.on);rooms.forEach(r=>{r.on=turnOn;r.brightness=turnOn?Math.max(r.brightness,70):0});renderRooms($('#search').value);toast(`Todas las luces ${turnOn?'encendidas':'apagadas'} (modo demo)`);updateAllSwitch()};
$('#notificationToggle').onclick=()=>{notificationsEnabled=!notificationsEnabled;$('#notificationToggle').classList.toggle('on',notificationsEnabled);toast('Notificaciones '+(notificationsEnabled?'activadas':'desactivadas'))};
$('#autoMode').onclick=()=>{autoMode=!autoMode;$('#autoMode').classList.toggle('on',autoMode);toast('Modo automático '+(autoMode?'activado':'desactivado')+' (modo demo)')};
$('#mainPower').onclick=()=>{deviceOn=!deviceOn;$('#mainPower').textContent=deviceOn?'Apagar':'Encender';toast('Foco principal '+(deviceOn?'encendido':'apagado')+' (modo demo)')};
$('#deviceSettings').onclick=()=>navigateTo('Ajustes');
$('#scenes').addEventListener('click',e=>{const b=e.target.closest('[data-scene]');if(!b)return;document.querySelectorAll('.scene').forEach(x=>x.classList.toggle('selected',x===b));const scene=b.dataset.scene;$('#sceneCount').textContent='1';if(scene==='Noche')rooms.forEach(r=>{r.on=true;r.brightness=Math.min(r.brightness||25,35)});if(scene==='Estudio'){rooms.forEach(r=>{if(r.name.toLowerCase().includes('estudio')){r.on=true;r.brightness=100}})}if(scene==='Relajación')rooms.forEach(r=>{r.on=true;r.brightness=40});if(scene==='Película')rooms.forEach(r=>{r.on=true;r.brightness=20});renderRooms($('#search').value);toast('Escena '+scene+' activada (modo demo)')});
$('#search').addEventListener('input',e=>renderRooms(e.target.value));
$('#notifications').onclick=()=>navigateTo('Notificaciones');
$('#viewAll').onclick=()=>navigateTo('Notificaciones');$('#viewActivity').onclick=()=>navigateTo('Notificaciones');
$('#theme').onclick=()=>{document.body.classList.toggle('warm');if(document.body.classList.contains('warm')){document.body.style.filter='hue-rotate(20deg)';toast('Ambiente visual cálido')}else{document.body.style.filter='';toast('Ambiente azul restaurado')}};

/* Cada área principal tiene su propio apartado. Habitaciones sigue integrado en Inicio. */
const mainPane = $('.main');
mainPane.classList.add('single-page');
const pageIntro = document.createElement('section');
pageIntro.className = 'page-intro'; pageIntro.hidden = true;
$('.topbar').insertAdjacentElement('afterend',pageIntro);
const uiSections = {
 hero:$('.hero'), stats:$('.stats'), rooms:$('#roomsSection'),
 energy:$('.bottom-grid > .section:first-child'), quick:$('.bottom-grid > .section:nth-child(2)'),
 device:$('.right > .section:nth-child(1)'), scenes:$('.right > .section:nth-child(2)'),
 notifications:$('.right > .section:nth-child(3)'), activity:$('.right > .section:nth-child(4)'),
 schedule:$('#schedulePanel'), settings:$('#settingsPanel')
};
const pages = {
 'Inicio':{title:'Inicio',subtitle:'Resumen de tu hogar inteligente.',sections:['hero','stats','rooms','quick']},
 'Dispositivos':{title:'Dispositivos',subtitle:'Consulta y controla los equipos de iluminación.',sections:['device']},
 'Escenas':{title:'Escenas',subtitle:'Elige un ambiente para cada momento.',sections:['scenes']},
 'Horarios':{title:'Horarios',subtitle:'Programa acciones de iluminación por hora y frecuencia.',sections:['schedule']},
 'Estadísticas':{title:'Estadísticas',subtitle:'Consulta el resumen visual del consumo de energía.',sections:['energy']},
 'Notificaciones':{title:'Notificaciones',subtitle:'Revisa los avisos y la actividad reciente.',sections:['notifications','activity']},
 'Ajustes':{title:'Ajustes',subtitle:'Personaliza preferencias de visualización y automatización.',sections:['settings']}
};
function navigateTo(page,options={}){
 const config=pages[page]||pages.Inicio, visible=new Set(config.sections);
 Object.entries(uiSections).forEach(([key,element])=>{if(element)element.hidden=!visible.has(key)});
 pageIntro.hidden=page==='Inicio';
 pageIntro.innerHTML=pageIntro.hidden?'':`<h2>${config.title}</h2><p>${config.subtitle}</p>`;
 mainPane.scrollTo({top:0,behavior:options.instant?'auto':'smooth'});
 document.querySelectorAll('#nav [data-page]').forEach(btn=>{
  const active=btn.dataset.page===(options.activeItem||page);btn.classList.toggle('active',active);
  if(active){btn.classList.remove('icon-tap');void btn.offsetWidth;btn.classList.add('icon-tap');setTimeout(()=>btn.classList.remove('icon-tap'),520)}
 });
 $('.search').placeholder=page==='Inicio'?'⌕  Buscar habitaciones, dispositivos, escenas...':`⌕  Buscar en ${page.toLowerCase()}...`;
 if(options.scrollRooms)setTimeout(()=>{const target=uiSections.rooms;const top=target.getBoundingClientRect().top-mainPane.getBoundingClientRect().top+mainPane.scrollTop-16;mainPane.scrollTo({top:Math.max(0,top),behavior:'smooth'});target.classList.remove('nav-focus');void target.offsetWidth;target.classList.add('nav-focus');setTimeout(()=>target.classList.remove('nav-focus'),1200)},80);
}
$('#nav').addEventListener('click',event=>{
 const button=event.target.closest('[data-page]');if(!button)return;
 if(button.dataset.page==='Habitaciones')navigateTo('Inicio',{activeItem:'Habitaciones',scrollRooms:true});
 else navigateTo(button.dataset.page);
});
$('#period').onchange=()=>{const bars=[38,20,35,55,24,47,30,70,43,64,52,81,45,68,51,88,36,57,41,27];document.querySelectorAll('.bar').forEach((b,i)=>b.style.height=Math.max(10,bars[i]*(($('#period').value==='Mes')?.75:($('#period').value==='Semana')?.9:1))+'%');toast('Periodo: '+$('#period').value)};
function renderChart(){const vals=[12,20,30,18,25,45,30,55,38,70,48,60,42,85,55,62,38,52,35,22];$('#chart').innerHTML=vals.map(v=>`<div class="bar" style="height:${v}%"></div>`).join('')}

/* Gestión de horarios y preferencias locales de demostración */
let schedules=[];
function refreshScheduleRooms(){const select=$('#scheduleRoom');if(!select)return;const previous=select.value;select.innerHTML=rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');if(rooms.some(r=>String(r.id)===previous))select.value=previous;}
function renderSchedules(){const root=$('#scheduleList');if(!root)return;if(!schedules.length){root.innerHTML='<div class="schedule-empty">◷<br><strong>No hay horarios creados todavía</strong><br><small>Configura una hora y pulsa “Crear horario”.</small></div>';return;}root.innerHTML=schedules.map(s=>{const room=rooms.find(r=>String(r.id)===String(s.roomId));return `<div class="schedule-item"><div class="schedule-time">${escapeHtml(s.time)}</div><div class="schedule-detail"><strong>${s.action==='on'?'Encender':'Apagar'} · ${escapeHtml(room?room.name:'Habitación eliminada')}</strong><small>${escapeHtml(s.days)} · Horario de demostración</small></div><button class="schedule-delete" data-delete-schedule="${s.id}">Eliminar</button></div>`}).join('');}
$('#addSchedule').addEventListener('click',()=>{const time=$('#scheduleTime').value;if(!time){toast('Selecciona una hora para el horario.');$('#scheduleTime').focus();return;}schedules.push({id:Date.now(),roomId:$('#scheduleRoom').value,time,action:$('#scheduleAction').value,days:$('#scheduleDays').value});renderSchedules();toast('Horario agregado a la demostración.');});
$('#scheduleList').addEventListener('click',event=>{const button=event.target.closest('[data-delete-schedule]');if(!button)return;schedules=schedules.filter(s=>s.id!==Number(button.dataset.deleteSchedule));renderSchedules();toast('Horario eliminado.');});
$('#settingNotifications').addEventListener('click',()=>{notificationsEnabled=!notificationsEnabled;$('#settingNotifications').classList.toggle('on',notificationsEnabled);$('#notificationToggle').classList.toggle('on',notificationsEnabled);toast('Notificaciones '+(notificationsEnabled?'activadas':'desactivadas'));});
$('#settingAutoMode').addEventListener('click',()=>{autoMode=!autoMode;$('#settingAutoMode').classList.toggle('on',autoMode);$('#autoMode').classList.toggle('on',autoMode);toast('Modo automático '+(autoMode?'activado':'desactivado')+' (modo demo)');});
$('#settingWarmTheme').addEventListener('click',()=>{const warm=!document.body.classList.contains('warm');document.body.classList.toggle('warm',warm);document.body.style.filter=warm?'hue-rotate(20deg)':'';$('#settingWarmTheme').classList.toggle('on',warm);toast(warm?'Ambiente visual cálido activado':'Ambiente azul restaurado');});

refreshScheduleRooms();renderSchedules();
renderRooms();renderChart();
navigateTo('Inicio',{instant:true});


/* Motion helpers: animate cards created dynamically without changing their behavior. */
(function addDynamicMotion() {
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !('IntersectionObserver' in window)) return;
  const observeCards = () => {
    document.querySelectorAll('.room:not([data-motion-ready]), .stat:not([data-motion-ready]), .section:not([data-motion-ready])').forEach((el, index) => {
      el.dataset.motionReady = '1';
      el.style.animationDelay = Math.min(index * 55, 330) + 'ms';
    });
  };
  observeCards();
  const root = document.querySelector('#rooms');
  if (root) new MutationObserver(observeCards).observe(root, { childList: true });
})();


/* Efectos dinámicos para iconos pulsados en la barra y elementos recién creados. */
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.closest('#nav')) return;
  button.classList.remove('button-tap');
  void button.offsetWidth;
  button.classList.add('button-tap');
  window.setTimeout(() => button.classList.remove('button-tap'), 420);
});
