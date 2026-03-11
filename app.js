/* ══ FIREBASE HELPERS ══ */
const R = p => window._DB.ref(p);
const fbGet    = r => r.once('value').then(s => s.val());
const fbSet    = (r,d) => r.set(d);
const fbUpdate = (r,d) => r.update(d);
const fbPush   = (r,d) => r.push(d);
const fbOn     = (r,cb) => r.on('value', s => cb(s.val()));

/* ══ TOAST ══ */
function toast(msg, type='ok', ms=3000){
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = type; t.style.display='block';
  clearTimeout(t._t); t._t = setTimeout(()=>t.style.display='none', ms);
}

/* ══ NAV ══ */
let _curSection = 'inicio';
function showSection(id, btn){
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  _curSection = id;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  let target = btn;
  if(!target){
    document.querySelectorAll('.nav-btn').forEach(b=>{
      if(b.getAttribute('onclick') && b.getAttribute('onclick').includes("'"+id+"'")){target=b;}
    });
  }
  if(target){ target.classList.add('active'); moveSlider(target); }
  const loaders = {
    tablas: loadTablas, jornadas: loadJornadas, stats: loadStats,
    tarjetas: loadTarjetas, noticias: loadNoticias,
    equipos: loadEquipos, fichajes: loadFichajes, foro: loadForo,
    cuenta: loadCuenta
  };
  if(loaders[id]) loaders[id]();
  revealAll();
}
function moveSlider(btn){
  const slider = document.getElementById('navSlider');
  if(!btn||!slider) return;
  slider.style.left  = btn.offsetLeft + 'px';
  slider.style.width = btn.offsetWidth + 'px';
}
window.addEventListener('resize', ()=>{
  const active = document.querySelector('.nav-btn.active');
  if(active) moveSlider(active);
});
function revealAll(){
  setTimeout(()=>{
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }, 80);
}

/* ══ HELPERS UI ══ */
function logoHtml(url, size=22){
  if(url) return '<img src="'+url+'" style="width:'+size+'px;height:'+size+'px;object-fit:contain" onerror="this.style.display=\'none\'">';
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(240,180,41,.3)" stroke-width="1.5" fill="none"/><text x="12" y="16" text-anchor="middle" font-size="7" fill="rgba(240,180,41,.7)">F</text></svg>';
}
function avatarDefault(name){
  name = name || '?';
  const c = ['#F0B429','#5865F2','#4ADE80','#F87171','#A78BFA'];
  const ci = (name.charCodeAt(0)||0) % c.length;
  const letter = encodeURIComponent((name[0]||'?').toUpperCase());
  const color = encodeURIComponent(c[ci]);
  return "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' rx='40' fill='"+color+"'/><text x='40' y='52' text-anchor='middle' font-size='32' font-family='Arial' fill='%230A1020'>"+letter+"</text></svg>";
}
function tsAgo(ts){
  if(!ts) return '';
  const s = Math.floor((Date.now()-ts)/1000);
  if(s<60) return 'hace un momento';
  if(s<3600) return 'hace '+Math.floor(s/60)+'m';
  if(s<86400) return 'hace '+Math.floor(s/3600)+'h';
  return 'hace '+Math.floor(s/86400)+'d';
}
function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
}
function escHtml(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ══ GLOBAL CACHE ══ */
let _equiposCache = {};
async function getEquipos(force){
  if(!force && Object.keys(_equiposCache).length>0) return _equiposCache;
  const data = await fbGet(R('bot/equipos'));
  _equiposCache = data || {};
  return _equiposCache;
}
function invalidateEquiposCache(){ _equiposCache = {}; }

window._globalFichajes  = {};
window._globalUsuarios  = {};
window._globalCuentas   = {};
window._globalDiscToUid = {};
window._globalTagToId   = {};
window._globalUidToId   = {};
window._globalIdentityLoaded = false;

async function ensureIdentity(){
  if(window._globalIdentityLoaded) return;
  const [fichajes, usuarios, cuentas] = await Promise.all([
    fbGet(R('bot/fichajes')),
    fbGet(R('usuarios')),
    fbGet(R('bot/cuentas'))
  ]);
  window._globalFichajes = fichajes || {};
  window._globalUsuarios = usuarios || {};
  window._globalCuentas  = cuentas  || {};
  const discToUid = {};
  if(cuentas) Object.entries(cuentas).forEach(([did,c])=>{ discToUid[did]=c.webUid; });
  window._globalDiscToUid = discToUid;
  const tagToId = {};
  const uidToId = {};
  if(fichajes) Object.entries(fichajes).forEach(([did,f])=>{
    const uid = discToUid[did];
    const u = uid && usuarios && usuarios[uid] ? usuarios[uid] : null;
    const entry = { discordId:did, webUid:uid||'', avatar:u ? u.avatar||null : null,
                    nombre:u ? u.nombre||f.discordTag||did : f.discordTag||did,
                    discordTag:f.discordTag||did };
    const tag = (f.discordTag||did).toLowerCase();
    tagToId[tag] = entry;
    if(u && u.nombre) tagToId[u.nombre.toLowerCase()] = entry;
    if(uid) uidToId[uid] = entry;
  });
  if(usuarios) Object.entries(usuarios).forEach(([uid,u])=>{
    if(!uidToId[uid] && u.discordId){
      uidToId[uid] = { discordId:u.discordId, webUid:uid, avatar:u.avatar||null,
                       nombre:u.nombre||u.email.split('@')[0]||'?', discordTag:u.discordTag||'' };
    }
  });
  window._globalTagToId = tagToId;
  window._globalUidToId = uidToId;
  window._globalIdentityLoaded = true;
}

function resolveIdentity(discordTag, discordId, webUid){
  const t = (discordTag||'').toLowerCase();
  if(webUid && window._globalUidToId[webUid]) return window._globalUidToId[webUid];
  if(discordId && window._globalUidToId[discordId]) return window._globalUidToId[discordId];
  return window._globalTagToId[t] || {};
}

/* ══ HERO STATS ══ */
async function loadHeroStats(){
  const [eqs, ps1, gs, fich] = await Promise.all([
    fbGet(R('bot/equipos')),
    fbGet(R('liga/partidos_primera')),
    fbGet(R('liga/goleadores')),
    fbGet(R('bot/fichajes'))
  ]);
  document.getElementById('hs-equipos').textContent  = eqs  ? Object.keys(eqs).length  : 0;
  document.getElementById('hs-partidos').textContent = ps1  ? Object.keys(ps1).length  : 0;
  document.getElementById('hs-goles').textContent    = gs   ? Object.values(gs).reduce((a,x)=>a+(x.goles||0),0) : 0;
  document.getElementById('hs-jugadores').textContent = fich ? Object.keys(fich).length : 0;
}

/* ══ TABLAS ══ */
async function loadTablas(){
  const wrap = document.getElementById('tabla1Wrap');
  if(!wrap || wrap.dataset.loaded) return;
  wrap.dataset.loaded = '1';
  const [equipos, tabla] = await Promise.all([getEquipos(), fbGet(R('liga/primera'))]);
  const eqList = Object.values(equipos);
  if(!eqList.length){ wrap.innerHTML='<div class="empty"><p>SIN EQUIPOS REGISTRADOS</p></div>'; return; }
  let rows = eqList.map(eq => {
    const t = (tabla && tabla[eq.roleId]) ? tabla[eq.roleId] : {};
    return { nombre:eq.nombre||eq.abrev||'Equipo', abrev:eq.abrev||'', logo:eq.logo||'',
             pj:t.pj||0, pg:t.pg||0, pe:t.pe||0, pp:t.pp||0,
             gf:t.gf||0, gc:t.gc||0,
             pts: t.pts!=null ? t.pts : ((t.pg||0)*3+(t.pe||0)), roleId:eq.roleId };
  });
  rows.sort((a,b)=>b.pts-a.pts||(b.gf-b.gc)-(a.gf-a.gc)||b.gf-a.gf);
  wrap.innerHTML = '<table><thead><tr><th>#</th><th style="text-align:left">EQUIPO</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead><tbody>'+
    rows.map((r,i)=>{
      const dg = r.gf-r.gc;
      return '<tr onclick="openTeamModal(\''+r.roleId+'\')" style="cursor:pointer">'+
        '<td><span class="pos '+(i===0?'gold':'')+'">'+( i+1)+'</span></td>'+
        '<td><div class="team-cell"><div class="team-logo-sm">'+logoHtml(r.logo,22)+'</div><span class="team-name player-clickable">'+r.nombre+'</span></div></td>'+
        '<td>'+r.pj+'</td><td>'+r.pg+'</td><td>'+r.pe+'</td><td>'+r.pp+'</td>'+
        '<td>'+r.gf+'</td><td>'+r.gc+'</td>'+
        '<td class="'+(dg>0?'dg-pos':dg<0?'dg-neg':'')+'">'+(dg>0?'+':'')+dg+'</td>'+
        '<td><span class="pts-pill">'+r.pts+'</span></td></tr>';
    }).join('')+'</tbody></table>';
}

/* ══ JORNADAS ══ */
let _jornadasData = [];
let _jornadasFilter = 'all';
let _jornadasEqMap = {};

async function loadJornadas(){
  const grid = document.getElementById('matchesGrid');
  if(!grid) return;
  grid.innerHTML='<div class="loading"><div class="spinner"></div><p>CARGANDO</p></div>';
  const [equipos, ps] = await Promise.all([getEquipos(), fbGet(R('liga/partidos_primera'))]);
  _jornadasEqMap = {};
  Object.values(equipos).forEach(e => _jornadasEqMap[e.roleId] = e);
  if(!ps){ _jornadasData = []; renderMatchCards([]); return; }
  _jornadasData = Object.entries(ps)
    .map(([id,p])=>({id,...p}))
    .sort((a,b)=>{
      const hasA = a.golLocal != null;
      const hasB = b.golLocal != null;
      if(!hasA && !hasB) return new Date(a.fecha||0) - new Date(b.fecha||0);
      if(!hasA) return -1;
      if(!hasB) return 1;
      return new Date(b.fecha||0) - new Date(a.fecha||0);
    });
  applyJornadaFilter();
}

function filterJornadas(filter, btn){
  _jornadasFilter = filter;
  document.querySelectorAll('.jornada-filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  applyJornadaFilter();
}

function applyJornadaFilter(){
  let filtered = _jornadasData;
  if(_jornadasFilter === 'played')  filtered = _jornadasData.filter(p => p.golLocal != null);
  if(_jornadasFilter === 'pending') filtered = _jornadasData.filter(p => p.golLocal == null);
  const lbl = document.getElementById('jornadaCountLabel');
  if(lbl) lbl.textContent = filtered.length+' partido'+(filtered.length!==1?'s':'');
  renderMatchCards(filtered);
}

function renderMatchCards(arr){
  const grid = document.getElementById('matchesGrid');
  if(!grid) return;
  if(!arr.length){
    const msgs = {all:'SIN PARTIDOS REGISTRADOS', played:'SIN PARTIDOS JUGADOS', pending:'SIN PARTIDOS PENDIENTES'};
    grid.innerHTML='<div class="matches-empty"><span class="ei">&#9917;</span><p>'+(msgs[_jornadasFilter]||'SIN PARTIDOS')+'</p></div>';
    return;
  }
  grid.innerHTML = arr.map(p=>{
    const l = _jornadasEqMap[p.localId]||{};
    const v = _jornadasEqMap[p.visitanteId]||{};
    const isPlayed = p.golLocal != null;

    // tarjeta con borde amarillo=pendiente, verde=jugado
    const cardBorder = isPlayed ? 'rgba(74,222,128,0.35)' : 'rgba(240,180,41,0.35)';
    const cardBg     = isPlayed ? 'linear-gradient(135deg,var(--bg-3),rgba(15,40,25,0.5))' : 'linear-gradient(135deg,var(--bg-3),rgba(40,30,5,0.4))';

    const statusBadge = isPlayed
      ? '<span class="match-status played"><span class="match-status-dot"></span>JUGADO</span>'
      : '<span class="match-status pending" style="background:rgba(240,180,41,.1);color:var(--gold);border-color:rgba(240,180,41,.35)"><span class="match-status-dot" style="background:var(--gold)"></span>PENDIENTE</span>';

    let centerHtml = '';
    if(isPlayed){
      centerHtml = '<span class="match-score">'+p.golLocal+' - '+p.golVisitante+'</span>';
    } else {
      centerHtml = '<span class="match-vs">VS</span>';
      if(p.hora) centerHtml += '<span class="match-hora">'+p.hora+'</span>';
    }

    return '<div class="match-card" style="border-color:'+cardBorder+';background:'+cardBg+'">'+
      '<div class="match-team home" onclick="openTeamModal(\''+p.localId+'\')" style="cursor:pointer">'+
        '<div class="match-logo">'+logoHtml(l.logo||'',22)+'</div>'+
        '<span class="match-team-name player-clickable">'+(l.abrev||l.nombre||p.local||'LOCAL')+'</span>'+
      '</div>'+
      '<div class="match-center">'+
        centerHtml+
        '<span class="match-date">'+fmtDate(p.fecha)+'</span>'+
        (p.jornada?'<span class="match-jornada-tag">'+p.jornada+'</span>':'')+
        statusBadge+
        (p.nota?'<span style="font-family:var(--fc);font-size:.6rem;color:var(--g3);display:block;margin-top:2px">'+p.nota+'</span>':'')+
      '</div>'+
      '<div class="match-team away" onclick="openTeamModal(\''+p.visitanteId+'\')" style="cursor:pointer">'+
        '<div class="match-logo">'+logoHtml(v.logo||'',22)+'</div>'+
        '<span class="match-team-name player-clickable">'+(v.abrev||v.nombre||p.visitante||'VISIT')+'</span>'+
      '</div>'+
      '<div class="match-bottom-line" style="background:linear-gradient(90deg,transparent,'+(isPlayed?'rgba(74,222,128,0.5)':'rgba(240,180,41,0.5)')+',transparent)"></div>'+
    '</div>';
  }).join('');
}

/* ══ STATS ══ */
function statsTable(data, key, icon){
  if(!data) return '<div class="empty"><p>SIN DATOS</p></div>';
  const arr = Object.values(data).filter(x=>(x[key]||0)>0).sort((a,b)=>(b[key]||0)-(a[key]||0)).slice(0,10);
  if(!arr.length) return '<div class="empty"><p>SIN DATOS</p></div>';
  const medals=['1','2','3'];
  return '<table><thead><tr><th>#</th><th style="text-align:left">JUGADOR</th><th>EQUIPO</th><th>'+icon+'</th></tr></thead><tbody>'+
    arr.map((x,i)=>{
      const av = x._avatar || avatarDefault(x.nombre||'?');
      const did = x._discordId||x.discordId||'';
      const uid = x._webUid||'';
      const click = (did||uid) ? 'onclick="openPlayerModal(\''+did+'\',\''+uid+'\')" style="cursor:pointer"' : '';
      return '<tr '+click+'>'+
        '<td><span class="pos '+(i===0?'gold':'')+'">'+( medals[i]||i+1)+'</span></td>'+
        '<td style="text-align:left"><div style="display:flex;align-items:center;gap:8px">'+
          '<img src="'+av+'" style="width:26px;height:26px;border-radius:50%;object-fit:cover;border:1px solid var(--border-g)" onerror="this.src=\''+avatarDefault(x.nombre||'?')+'\'">'+
          '<div><div class="'+(did||uid?'player-clickable':'')+'" style="font-size:.82rem;font-weight:700;color:'+(i===0?'var(--gold)':'#fff')+'">'+( x.nombre||x.discordTag||'Jugador')+'</div>'+
          (x._discordTag?'<div style="font-size:.64rem;color:var(--g3)">'+x._discordTag+'</div>':'')+
        '</div></div></td>'+
        '<td><div style="display:flex;align-items:center;gap:4px">'+
          (x.teamLogo?'<div style="width:18px;height:18px;background:#fff;border-radius:3px;padding:1px;display:flex;align-items:center;justify-content:center">'+logoHtml(x.teamLogo,14)+'</div>':'')+
          '<span style="font-size:.7rem;color:var(--g3)">'+(x.teamAbrev||x.teamNombre||'')+'</span>'+
        '</div></td>'+
        '<td><span class="pts-pill">'+x[key]+'</span></td>'+
      '</tr>';
    }).join('')+
  '</tbody></table>';
}

async function loadStats(){
  const gs=document.getElementById('statsGoles');
  const as=document.getElementById('statsAsist');
  const cs=document.getElementById('statsCS');
  if(!gs||gs.dataset.loaded) return;
  gs.dataset.loaded='1';
  await ensureIdentity();
  const [g,a,c,eqs] = await Promise.all([
    fbGet(R('liga/goleadores')), fbGet(R('liga/asistencias')),
    fbGet(R('liga/cleansheets')), getEquipos()
  ]);
  function enrich(data){
    if(!data) return null;
    const out={};
    Object.entries(data).forEach(([k,x])=>{
      const eq=eqs[x.equipoId]||{};
      const id=resolveIdentity(x.discordTag||x.nombre, x.discordId, x._webUid);
      out[k]={...x,
        teamAbrev:eq.abrev||eq.nombre||'',teamNombre:eq.nombre||eq.abrev||'',
        teamLogo:x.teamLogo||eq.logo||'',
        _discordId:id.discordId||x.discordId||'',
        _webUid:id.webUid||'',
        _avatar:id.avatar||null,
        _discordTag:id.discordTag||x.discordTag||''
      };
    });
    return out;
  }
  gs.innerHTML = statsTable(enrich(g),'goles','G');
  as.innerHTML = statsTable(enrich(a),'asistencias','A');
  cs.innerHTML = statsTable(enrich(c),'cleansheets','CS');
}

/* ══ TARJETAS ══ */
async function loadTarjetas(){
  const ta=document.getElementById('tarjetasAmaril');
  const tr=document.getElementById('tarjetasRojas');
  const sw=document.getElementById('sancionesWrap');
  if(!ta||ta.dataset.loaded) return;
  ta.dataset.loaded='1';
  await ensureIdentity();
  const [tarjetas, sanciones, eqs] = await Promise.all([
    fbGet(R('liga/tarjetas')), fbGet(R('liga/sanciones')), getEquipos()
  ]);
  const eqMap={}; Object.values(eqs).forEach(e=>eqMap[e.roleId]=e);
  function tarjetaCard(t, tipo){
    const eq=eqMap[t.equipoId]||{};
    const id=resolveIdentity(t.discordTag||t.jugador, t.discordId, '');
    const av=id.avatar||avatarDefault(t.jugador||'?');
    const nombre=id.nombre||t.jugador||t.discordTag||'Jugador';
    const hasP=id.discordId||id.webUid;
    const click=hasP ? 'onclick="openPlayerModal(\''+( id.discordId||'')+'\',\''+( id.webUid||'\'')+'" style="cursor:pointer"' : '';
    return '<div class="tarjeta-item '+tipo+'" '+click+'>'+
      '<img src="'+av+'" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid var(--border-g);flex-shrink:0" onerror="this.src=\''+avatarDefault(nombre)+'\'">'+
      '<div style="flex:1">'+
        '<div class="tarjeta-player '+(hasP?'player-clickable':'')+'">'+nombre+'</div>'+
        '<div class="tarjeta-club">'+
          (eq.logo?'<img src="'+eq.logo+'" style="width:13px;height:13px;object-fit:contain;background:#fff;border-radius:2px;padding:1px">':'')+
          '<span>'+(eq.nombre||eq.abrev||'')+'</span>'+
          (t.motivo?'<span style="color:var(--g3);margin-left:4px">- '+t.motivo+'</span>':'')+
        '</div>'+
        '<div class="tarjeta-date">'+fmtDate(t.fecha)+'</div>'+
      '</div>'+
      (t.discordTag?'<span style="font-size:.62rem;color:#7289da;background:rgba(88,101,242,.12);border:1px solid rgba(88,101,242,.2);border-radius:4px;padding:1px 6px;flex-shrink:0">'+t.discordTag+'</span>':'')+
    '</div>';
  }
  function renderTarjetas(wrap, tipo){
    if(!tarjetas){ wrap.innerHTML='<div class="empty"><p>SIN TARJETAS</p></div>'; return; }
    const arr=Object.values(tarjetas).filter(t=>t.tipo===tipo);
    if(!arr.length){ wrap.innerHTML='<div class="empty"><p>SIN TARJETAS</p></div>'; return; }
    wrap.innerHTML = arr.map(t=>tarjetaCard(t,tipo)).join('');
  }
  renderTarjetas(ta,'yellow');
  renderTarjetas(tr,'red');
  if(!sanciones){ sw.innerHTML='<div class="empty"><p>SIN SANCIONES ACTIVAS</p></div>'; }
  else {
    const arr=Object.entries(sanciones).map(([id,s])=>({id,...s}));
    sw.innerHTML='<div style="padding:.9rem;display:flex;flex-direction:column;gap:.5rem">'+arr.map(s=>{
      const id=resolveIdentity(s.discordTag||s.jugador, s.discordId, '');
      const av=id.avatar||avatarDefault(s.jugador||'?');
      const nombre=id.nombre||s.jugador||s.discordTag||'Jugador';
      const hasP=id.discordId||id.webUid;
      const click=hasP ? 'onclick="openPlayerModal(\''+( id.discordId||'')+'\',\''+( id.webUid||'\'')+'" style="cursor:pointer"' : '';
      return '<div class="sancion-item '+(s.tipo||'warning')+'" '+click+'>'+
        '<img src="'+av+'" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid var(--border-g);flex-shrink:0" onerror="this.src=\''+avatarDefault(nombre)+'\'">'+
        '<div class="sancion-info">'+
          '<div class="sancion-name '+(hasP?'player-clickable':'')+'">'+nombre+
            (s.discordTag?'<span style="font-size:.62rem;color:#7289da;background:rgba(88,101,242,.12);border:1px solid rgba(88,101,242,.2);border-radius:3px;padding:1px 5px;margin-left:5px">'+s.discordTag+'</span>':'')+
          '</div>'+
          '<div class="sancion-detail">'+(s.motivo||'')+' '+(s.partidos?'- '+s.partidos+' partido(s)':'')+'</div>'+
        '</div>'+
        '<span class="sancion-type '+(s.tipo||'warning')+'">'+(s.tipo||'ADVERTENCIA').toUpperCase()+'</span>'+
      '</div>';
    }).join('')+'</div>';
  }
}

/* ══ EQUIPOS ══ */
async function loadEquipos(){
  const grid = document.getElementById('equiposGrid');
  if(!grid||grid.dataset.loaded) return;
  grid.dataset.loaded='1';
  await ensureIdentity();
  const equipos = await getEquipos();
  const eqList  = Object.values(equipos);
  if(!eqList.length){ grid.innerHTML='<div class="empty"><p>SIN EQUIPOS REGISTRADOS</p></div>'; return; }
  const fichajes  = window._globalFichajes;
  const usuarios  = window._globalUsuarios;
  const discToUid = window._globalDiscToUid;
  const eqPlayers = {};
  eqList.forEach(eq=>{ eqPlayers[eq.roleId]=new Map(); });
  Object.entries(fichajes).forEach(([did,f])=>{
    if(!eqPlayers[f.equipoRoleId]) return;
    const uid = discToUid[did];
    const u   = uid && usuarios[uid] ? usuarios[uid] : null;
    eqPlayers[f.equipoRoleId].set(did, {
      discordId:did, uid:uid||'',
      nombre:u ? u.nombre||f.discordTag||did : f.discordTag||did,
      avatar:u ? u.avatar||null : null,
      discordTag:f.discordTag||did, esDT:f.esDT||false
    });
  });
  Object.entries(usuarios).forEach(([uid,u])=>{
    if(!u.equipoRoleId||!eqPlayers[u.equipoRoleId]) return;
    const did=u.discordId||'';
    if(did && eqPlayers[u.equipoRoleId].has(did)) return;
    eqPlayers[u.equipoRoleId].set(uid, {
      discordId:did, uid, nombre:u.nombre||u.email.split('@')[0]||'Jugador',
      avatar:u.avatar||null, discordTag:u.discordTag||'', esDT:false
    });
  });
  grid.innerHTML = eqList.map(eq=>{
    const todos   = Array.from(eqPlayers[eq.roleId].values());
    const dtJug   = todos.find(j=>j.esDT);
    const jugList = todos.filter(j=>!j.esDT);
    const dtHtml = dtJug ?
      '<div class="equipo-dt-row" onclick="event.stopPropagation();openPlayerModal(\''+dtJug.discordId+'\',\''+dtJug.uid+'\')" style="cursor:pointer">'+
        '<img src="'+(dtJug.avatar||avatarDefault(dtJug.nombre))+'" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid rgba(240,180,41,.4);flex-shrink:0" onerror="this.src=\''+avatarDefault(dtJug.nombre)+'\'">'+
        '<span style="font-family:var(--fc);font-size:.7rem;color:var(--gold);font-weight:800;letter-spacing:1px">DT</span>'+
        '<span class="player-clickable" style="font-family:var(--fc);font-size:.78rem;color:#fff;font-weight:600">'+dtJug.nombre+'</span>'+
      '</div>' : '';
    return '<div class="equipo-card" onclick="openTeamModal(\''+eq.roleId+'\')">'+
      '<div class="equipo-card-head">'+
        '<div class="equipo-logo">'+logoHtml(eq.logo||'',40)+'</div>'+
        '<div class="equipo-info">'+
          '<div class="equipo-name">'+(eq.nombre||eq.abrev||'Equipo')+'</div>'+
          '<div class="equipo-abrev">'+(eq.abrev||'')+'</div>'+
          '<div class="equipo-meta">'+
            '<span class="equipo-badge">'+todos.length+' jugadores</span>'+
            (dtJug?'<span class="equipo-badge" style="border-color:rgba(240,180,41,.3);color:var(--gold)">DT: '+dtJug.nombre.split(' ')[0]+'</span>':'')+
          '</div>'+
        '</div>'+
        '<div style="font-family:var(--fc);font-size:.62rem;color:var(--g3);letter-spacing:1px;align-self:flex-start;padding-top:2px;flex-shrink:0">VER</div>'+
      '</div>'+
      dtHtml+
      '<div class="equipo-players">'+
        jugList.slice(0,10).map(j=>
          '<div class="equipo-player" onclick="event.stopPropagation();openPlayerModal(\''+j.discordId+'\',\''+j.uid+'\')" title="'+j.discordTag+'">'+
            '<img src="'+(j.avatar||avatarDefault(j.nombre))+'" onerror="this.src=\''+avatarDefault(j.nombre)+'\'">'+
            '<span class="player-clickable">'+j.nombre+'</span>'+
          '</div>'
        ).join('')+
        (jugList.length>10?'<div class="equipo-player"><span style="color:var(--g3);font-size:.7rem">+'+(jugList.length-10)+' mas</span></div>':'')+
        (!todos.length?'<div style="font-family:var(--fc);font-size:.72rem;color:var(--g3);width:100%">Sin jugadores registrados</div>':'')+
      '</div>'+
    '</div>';
  }).join('');
}

/* ══ FICHAJES ══ */
async function loadFichajes(){
  const list=document.getElementById('fichajesList');
  if(!list||list.dataset.loaded) return;
  list.dataset.loaded='1';
  await ensureIdentity();
  const [historial, equipos] = await Promise.all([fbGet(R('bot/historial')), getEquipos()]);
  if(!historial){ list.innerHTML='<div class="empty"><p>SIN MOVIMIENTOS</p></div>'; return; }
  const eqMap={}; Object.values(equipos).forEach(e=>eqMap[e.roleId]=e);
  const arr=Object.entries(historial).map(([id,h])=>({id,...h}))
    .filter(h=>['FICHAJE','BAJA','TRASPASO','RENUNCIA'].includes(h.tipo))
    .sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0)).slice(0,50);
  if(!arr.length){ list.innerHTML='<div class="empty"><p>SIN MOVIMIENTOS</p></div>'; return; }
  const seen=new Set();
  const deduped=arr.filter(h=>{
    const key=( h.jugadorId||'')+'|'+h.tipo+'|'+h.fecha;
    if(seen.has(key)) return false; seen.add(key); return true;
  });
  list.innerHTML=deduped.map(h=>{
    const eq=eqMap[h.equipoId]||{};
    const uid=window._globalDiscToUid[h.jugadorId];
    const u=uid && window._globalUsuarios[uid] ? window._globalUsuarios[uid] : null;
    const displayName=u ? u.nombre||h.discordTag||h.jugadorId||'Jugador' : h.discordTag||h.jugadorId||'Jugador';
    const av=u ? u.avatar||avatarDefault(displayName) : avatarDefault(displayName);
    const hasP=h.jugadorId||uid;
    const clickStr=hasP ? 'onclick="openPlayerModal(\''+( h.jugadorId||'')+'\',\''+( uid||'\'')+'" style="cursor:pointer"' : '';
    return '<div class="fichaje-item">'+
      '<img class="fichaje-avatar '+(hasP?'player-clickable':'')+'" src="'+av+'" onerror="this.src=\''+avatarDefault(displayName)+'\'" '+clickStr+'>'+
      '<div class="fichaje-info">'+
        '<div class="fichaje-name">'+
          '<span class="'+(hasP?'player-clickable':'')+'" '+clickStr+'>'+displayName+'</span>'+
          (uid?'<span style="font-size:.58rem;background:rgba(88,101,242,.15);border:1px solid rgba(88,101,242,.25);border-radius:3px;padding:1px 5px;color:#7289da;margin-left:4px">WEB</span>':'')+
        '</div>'+
        '<div class="fichaje-detail">'+(h.desc||'')+' - '+fmtDate(h.fecha)+'</div>'+
      '</div>'+
      '<div class="fichaje-team" '+(eq.roleId?'onclick="openTeamModal(\''+eq.roleId+'\')" style="cursor:pointer"':'')+'>'+
        (eq.logo?'<div class="fichaje-team-logo">'+logoHtml(eq.logo,20)+'</div>':'')+
        '<span class="'+(eq.roleId?'player-clickable':'')+'" style="font-family:var(--fc);font-size:.72rem;color:var(--g2)">'+(eq.nombre||eq.abrev||'')+'</span>'+
      '</div>'+
      '<span class="fichaje-type '+h.tipo+'">'+h.tipo+'</span>'+
    '</div>';
  }).join('');
}

/* ══ NOTICIAS ══ */
async function loadNoticias(){
  const wrap=document.getElementById('noticiasList');
  if(!wrap||wrap.dataset.loaded) return;
  wrap.dataset.loaded='1';
  const data=await fbGet(R('liga/noticias'));
  renderNoticias(wrap, data);
}
function renderNoticias(wrap, data){
  if(!data){ wrap.innerHTML='<div class="empty"><p>SIN NOTICIAS</p></div>'; return; }
  const arr=Object.entries(data).map(([id,n])=>({id,...n})).sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0));
  wrap.innerHTML=arr.map(n=>
    '<div class="news-card" onclick="'+(n.link?'window.open(\''+n.link+'\',\'_blank\')':'')+'">' +
      '<div class="news-thumb">'+(n.imagen?'<img src="'+n.imagen+'" alt="" loading="lazy">':'')+'<div class="news-thumb-text">RB</div><div class="news-thumb-line"></div></div>'+
      '<div class="news-body">'+
        '<div class="news-tag">'+(n.tag||'NOTICIAS')+'</div>'+
        '<div class="news-title">'+(n.titulo||'Sin titulo')+'</div>'+
        '<div class="news-excerpt">'+(n.extracto||n.texto||'')+'</div>'+
        '<div class="news-footer">'+
          '<span class="news-date">'+fmtDate(n.fecha)+'</span>'+
          (n.link?'<a class="news-link" href="'+n.link+'" target="_blank">LEER</a>':'')+
        '</div>'+
      '</div>'+
    '</div>'
  ).join('');
}
async function loadHomeNoticias(){
  const wrap=document.getElementById('homeNews');
  const data=await fbGet(R('liga/noticias'));
  if(!data){ wrap.innerHTML='<div class="empty"><p>SIN NOTICIAS AUN</p></div>'; return; }
  const arr=Object.entries(data).map(([id,n])=>({id,...n})).sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0)).slice(0,3);
  renderNoticias(wrap, Object.fromEntries(arr.map(n=>[n.id,n])));
}

/* ══ FORO ══ */
async function loadForo(){
  if(document.getElementById('foroPosts').dataset.loaded) return;
  document.getElementById('foroPosts').dataset.loaded='1';
  await ensureIdentity();
  const user  = await getAuthUser();
  const compWrap = document.getElementById('foroComposeWrap');
  if(!user){
    compWrap.innerHTML='<div class="foro-compose" style="text-align:center;padding:1.5rem"><p style="font-family:var(--fc);color:var(--g3);letter-spacing:1px;font-size:.8rem;margin-bottom:.8rem">INICIA SESION PARA PARTICIPAR EN EL FORO</p><button class="btn btn-gold" onclick="showSection(\'cuenta\')">MI CUENTA</button></div>';
  } else {
    const userData=await fbGet(R('usuarios/'+user.uid));
    if(!userData || !userData.discordId){
      compWrap.innerHTML='<div class="foro-compose" style="text-align:center;padding:1.5rem"><p style="font-family:var(--fc);color:var(--g3);letter-spacing:1px;font-size:.8rem;margin-bottom:.5rem">VINCULA TU DISCORD PARA POSTEAR</p><p style="font-size:.74rem;color:var(--g3);margin-bottom:.8rem">Usa el comando <b style="color:var(--gold)">/vincular [codigo]</b> en Discord.</p><button class="btn btn-ghost btn-sm" onclick="showSection(\'cuenta\')">VER MI CODIGO</button></div>';
    } else {
      const av=userData.avatar||avatarDefault(userData.nombre||user.email||'?');
      compWrap.innerHTML='<div class="foro-compose reveal visible"><div class="foro-compose-inner"><img class="foro-compose-av" src="'+av+'" onerror="this.src=\''+avatarDefault(userData.nombre||'?')+'\'" alt=""><div class="foro-compose-body"><textarea class="foro-input" id="foroText" placeholder="Escribe algo en el foro..."></textarea><div class="foro-img-preview" id="foroImgPreview"></div><div class="foro-compose-actions"><label class="btn btn-ghost btn-sm" style="cursor:pointer">Imagen<input type="file" accept="image/*" multiple style="display:none" id="foroImgInput" onchange="handleForoImages(this)"></label><button class="btn btn-gold btn-sm" onclick="submitForo()">PUBLICAR</button></div></div></div></div>';
    }
  }
  fbOn(R('liga/foro'), renderForoPosts);
}

let _foroImgs=[];
function handleForoImages(input){
  const files=Array.from(input.files).slice(0,4);
  _foroImgs=[];
  const preview=document.getElementById('foroImgPreview');
  preview.innerHTML='';
  files.forEach((f,i)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      _foroImgs[i]=e.target.result;
      const div=document.createElement('div');
      div.className='foro-img-preview-item';
      div.innerHTML='<img src="'+e.target.result+'"><button class="foro-img-remove" onclick="removeForoImg('+i+')">X</button>';
      preview.appendChild(div);
    };
    reader.readAsDataURL(f);
  });
}
function removeForoImg(i){ _foroImgs.splice(i,1); var c=document.getElementById('foroImgPreview').children[i]; if(c) c.remove(); }

async function submitForo(){
  const user=window._AUTH.currentUser;
  if(!user) return toast('Inicia sesion primero','err');
  const txt=(document.getElementById('foroText') ? document.getElementById('foroText').value : '').trim();
  if(!txt&&!_foroImgs.length) return toast('Escribe algo antes de publicar','err');
  const userData=await fbGet(R('usuarios/'+user.uid));
  if(!userData || !userData.discordId) return toast('Vincula tu Discord primero','err');
  const imgs=[];
  for(const img of _foroImgs){ if(img) imgs.push(img.length>400000?await compressImg(img,.6):img); }
  await fbPush(R('liga/foro'),{
    uid:user.uid, nombre:userData.nombre||user.email,
    avatar:userData.avatar||null, discordTag:userData.discordTag||null,
    texto:txt, imgs:imgs.length?imgs:null, ts:Date.now(), likes:0
  });
  document.getElementById('foroText').value='';
  _foroImgs=[];
  document.getElementById('foroImgPreview').innerHTML='';
  toast('Publicado en el foro');
}

function renderForoPosts(data){
  const wrap=document.getElementById('foroPosts');
  if(!data){ wrap.innerHTML='<div class="empty"><p>SIN POSTS AUN</p></div>'; return; }
  const arr=Object.entries(data).map(([id,p])=>({id,...p})).sort((a,b)=>b.ts-a.ts);
  const user=window._AUTH.currentUser;
  wrap.innerHTML=arr.map(p=>{
    let identity={};
    if(p.uid && window._globalUidToId[p.uid]) identity=window._globalUidToId[p.uid];
    else if(p.discordTag) identity=window._globalTagToId[(p.discordTag||'').toLowerCase()]||{};
    const av=p.avatar||identity.avatar||avatarDefault(p.nombre||'?');
    const imgs=p.imgs?Object.values(p.imgs):[];
    const liked=user&&p.likedBy&&p.likedBy[user.uid.replace(/[.#$\[\]]/g,'_')];
    const hasP=identity.discordId||identity.webUid;
    const clickAv=hasP ? 'onclick="openPlayerModal(\''+( identity.discordId||'')+'\',\''+( identity.webUid||'\'')+'" style="cursor:pointer"' : '';
    const displayName=identity.nombre||p.nombre||'Anonimo';
    const discTag=p.discordTag||identity.discordTag||'';
    return '<div class="foro-post">'+
      '<div class="foro-post-head">'+
        '<img class="foro-post-av" src="'+av+'" onerror="this.src=\''+avatarDefault(displayName)+'\'" alt="" '+clickAv+'>'+
        '<div class="foro-post-meta">'+
          '<div class="foro-post-user">'+
            '<span class="'+(hasP?'player-clickable':'')+'" '+(hasP?'onclick="openPlayerModal(\''+( identity.discordId||'')+'\',\''+( identity.webUid||'\'')+'" style="cursor:pointer"':'')+'>'+displayName+'</span>'+
            (discTag?'<span class="foro-post-disc">'+discTag+'</span>':'')+
          '</div>'+
          '<div class="foro-post-time">'+tsAgo(p.ts)+'</div>'+
        '</div>'+
      '</div>'+
      (p.texto?'<div class="foro-post-text">'+escHtml(p.texto)+'</div>':'')+
      (imgs.length?'<div class="foro-post-imgs">'+imgs.map(img=>'<img src="'+img+'" alt="" onclick="openLightbox(\''+img+'\')">').join('')+'</div>':'')+
      '<div class="foro-post-actions">'+
        '<button class="foro-like '+(liked?'liked':'')+'" onclick="toggleLike(\''+p.id+'\',\''+(user?user.uid:'')+'\','+(p.likes||0)+')">&#9829; '+(p.likes||0)+'</button>'+
        ((window._adminLogged||(user&&user.uid===p.uid))?'<button class="foro-del" onclick="deletePost(\''+p.id+'\')">eliminar</button>':'')+
      '</div>'+
    '</div>';
  }).join('');
}

async function toggleLike(postId, uid, cur){
  if(!uid) return toast('Inicia sesion para dar like','err');
  const safeUid=uid.replace(/[.#$\[\]]/g,'_');
  const ref=R('liga/foro/'+postId);
  const post=await fbGet(ref);
  if(!post) return;
  const liked=post.likedBy&&post.likedBy[safeUid];
  const upd={likes:Math.max(0,(post.likes||0)+(liked?-1:1))};
  upd['likedBy/'+safeUid]=liked?null:true;
  await fbUpdate(ref, upd);
}
async function deletePost(id){
  if(!confirm('Eliminar este post?')) return;
  await R('liga/foro/'+id).remove();
  toast('Post eliminado');
}
function compressImg(dataUrl,q){
  q=q||.7;
  return new Promise(function(res){
    var img=new Image(); img.src=dataUrl;
    img.onload=function(){
      var max=800,w=img.width,h=img.height;
      if(w>max){h=Math.round(h*max/w);w=max;}
      var c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      res(c.toDataURL('image/jpeg',q));
    };
    img.onerror=function(){res(dataUrl);};
  });
}
function openLightbox(src){ document.getElementById('lb-img').src=src; document.getElementById('lightbox').classList.add('open'); }

/* ══ AUTH ══ */
let _authResolved=false, _authUser=null, _authInitialFired=false;
let _authReadyResolve;
const _authReady=new Promise(function(res){_authReadyResolve=res;});
async function getAuthUser(){ await _authReady; return _authUser; }

window._AUTH.onAuthStateChanged(function(user){
  _authUser=user;
  if(!_authResolved){ _authResolved=true; _authReadyResolve(); }
  var btn=document.getElementById('cuentaNavBtn');
  if(btn) btn.textContent=user ? 'Mi: '+(user.email||'').split('@')[0].slice(0,12) : 'Cuenta';
  if(!_authInitialFired){ _authInitialFired=true; return; }
  if(_curSection==='cuenta') loadCuenta();
  if(_curSection==='foro'){ var fp=document.getElementById('foroPosts'); if(fp) delete fp.dataset.loaded; loadForo(); }
  if(_curSection==='jornadas'){ var ab=document.getElementById('jornadasAdminBtns'); if(ab) ab.style.display=window._adminLogged?'block':'none'; }
});

function renderAuthForm(tab){
  tab=tab||'login';
  return '<div class="perfil-wrap"><div class="auth-wrap perfil-card">'+
    '<h3>MI CUENTA</h3><p class="auth-sub">ACCEDE O REGISTRATE PARA CONTINUAR</p>'+
    '<div class="auth-toggle">'+
      '<button class="auth-tab '+(tab==='login'?'active':'')+'" id="authTabLogin" onclick="switchAuthTab(\'login\')">INICIAR SESION</button>'+
      '<button class="auth-tab '+(tab==='register'?'active':'')+'" id="authTabReg" onclick="switchAuthTab(\'register\')">REGISTRARSE</button>'+
    '</div>'+
    '<div id="authFormLogin" style="display:'+(tab==='login'?'block':'none')+'">'+
      '<div class="form-group"><label>Email</label><input type="email" id="loginEmail" placeholder="tu@email.com" onkeydown="if(event.key===\'Enter\')doLogin()"></div>'+
      '<div class="form-group"><label>Contrasena</label><input type="password" id="loginPwd" placeholder="..." onkeydown="if(event.key===\'Enter\')doLogin()"></div>'+
      '<button class="btn btn-gold btn-full" onclick="doLogin()">ENTRAR</button>'+
      '<div style="margin-top:.75rem;text-align:center"><button class="btn btn-ghost btn-sm" onclick="doForgot()">Olvidaste tu contrasena?</button></div>'+
    '</div>'+
    '<div id="authFormReg" style="display:'+(tab==='register'?'block':'none')+'">'+
      '<div class="form-group"><label>Email</label><input type="email" id="regEmail" placeholder="tu@email.com"></div>'+
      '<div class="form-group"><label>Contrasena</label><input type="password" id="regPwd" placeholder="Minimo 6 caracteres"></div>'+
      '<div class="form-group"><label>Nombre de usuario</label><input type="text" id="regNombre" placeholder="Tu nombre en la liga"></div>'+
      '<button class="btn btn-gold btn-full" onclick="doRegister()">CREAR CUENTA</button>'+
    '</div>'+
  '</div></div>';
}
function switchAuthTab(tab){
  var tl=document.getElementById('authTabLogin'); if(tl) tl.classList.toggle('active',tab==='login');
  var tr=document.getElementById('authTabReg'); if(tr) tr.classList.toggle('active',tab==='register');
  var fl=document.getElementById('authFormLogin'); if(fl) fl.style.display=tab==='login'?'block':'none';
  var fr=document.getElementById('authFormReg'); if(fr) fr.style.display=tab==='register'?'block':'none';
}
async function doLogin(){
  var email=document.getElementById('loginEmail') ? document.getElementById('loginEmail').value.trim() : '';
  var pwd=document.getElementById('loginPwd') ? document.getElementById('loginPwd').value : '';
  if(!email||!pwd) return toast('Completa email y contrasena','err');
  try{ await window._AUTH.signInWithEmailAndPassword(email,pwd); }
  catch(e){
    var msgs={'auth/user-not-found':'Usuario no encontrado.','auth/wrong-password':'Contrasena incorrecta.','auth/invalid-email':'Email invalido.','auth/too-many-requests':'Demasiados intentos.'};
    toast(msgs[e.code]||'Error: '+e.message,'err',4000);
  }
}
async function doRegister(){
  var email=document.getElementById('regEmail') ? document.getElementById('regEmail').value.trim() : '';
  var pwd=document.getElementById('regPwd') ? document.getElementById('regPwd').value : '';
  var nombre=document.getElementById('regNombre') ? document.getElementById('regNombre').value.trim() : '';
  if(!email||!pwd||!nombre) return toast('Completa todos los campos','err');
  if(pwd.length<6) return toast('La contrasena debe tener al menos 6 caracteres','err');
  try{
    var cred=await window._AUTH.createUserWithEmailAndPassword(email,pwd);
    var code=Math.random().toString(36).toUpperCase().slice(2,10);
    await fbSet(R('usuarios/'+cred.user.uid),{nombre,email,createdAt:new Date().toISOString(),codigo:code});
    await fbSet(R('bot/vinculacion_pendiente/'+code),{uid:cred.user.uid,email,ts:Date.now()});
    toast('Cuenta creada. Bienvenido, '+nombre+'!');
  } catch(e){
    var msgs={'auth/email-already-in-use':'Este email ya esta registrado.','auth/invalid-email':'Email invalido.','auth/weak-password':'Contrasena muy debil.'};
    toast(msgs[e.code]||'Error: '+e.message,'err',4000);
  }
}
async function doForgot(){
  var email=document.getElementById('loginEmail') ? document.getElementById('loginEmail').value.trim() : '';
  if(!email) return toast('Escribe tu email primero','err');
  try{ await window._AUTH.sendPasswordResetEmail(email); toast('Email de recuperacion enviado','info',5000); }
  catch(e){ toast('No se pudo enviar el email','err'); }
}
async function doLogout(){ await window._AUTH.signOut(); toast('Sesion cerrada'); loadCuenta(); }

/* ══ CUENTA ══ */
async function loadCuenta(){
  var wrap=document.getElementById('cuentaContent');
  if(!wrap) return;
  wrap.innerHTML='<div class="loading"><div class="spinner"></div><p>CARGANDO</p></div>';
  var user=await getAuthUser();
  if(!user){ wrap.innerHTML=renderAuthForm(); return; }
  var userData=null;
  try{ userData=await fbGet(R('usuarios/'+user.uid)); } catch(e){}
  if(!userData){
    try{
      var code=Math.random().toString(36).toUpperCase().slice(2,10);
      userData={nombre:user.displayName||user.email.split('@')[0],email:user.email,createdAt:new Date().toISOString(),codigo:code};
      await fbSet(R('usuarios/'+user.uid),userData);
      await fbSet(R('bot/vinculacion_pendiente/'+code),{uid:user.uid,email:user.email,ts:Date.now()});
    } catch(e){ wrap.innerHTML='<div class="empty"><p>ERROR AL CARGAR PERFIL.</p></div>'; return; }
  }
  if(userData.blocked){
    wrap.innerHTML='<div class="perfil-wrap" style="text-align:center;padding:3rem 1rem"><div style="font-size:3rem;margin-bottom:1rem">X</div><div style="font-family:var(--fd);font-size:1.5rem;letter-spacing:2px;color:#F87171;margin-bottom:.5rem">CUENTA BLOQUEADA</div><p style="font-family:var(--fc);color:var(--g3);font-size:.8rem;margin-bottom:1.5rem">Tu cuenta ha sido suspendida. Contacta al administrador.</p><button class="btn btn-ghost" onclick="doLogout()">CERRAR SESION</button></div>';
    return;
  }
  try{ await renderPerfil(wrap,user,userData); }
  catch(e){ wrap.innerHTML='<div class="empty"><p>ERROR AL RENDERIZAR PERFIL.</p></div>'; }
}

async function renderPerfil(wrap,user,userData){
  var av=userData.avatar||avatarDefault(userData.nombre||user.email||'?');
  var botStats=null, equipoActual=null, amarillas=0;
  if(userData.discordId){
    var results=await Promise.all([
      fbGet(R('bot/stats/'+userData.discordId)),
      fbGet(R('bot/fichajes/'+userData.discordId)),
      fbGet(R('liga/tarjetas'))
    ]);
    botStats=results[0];
    var fich=results[1];
    var tarj=results[2];
    if(fich){ var eqs=await getEquipos(); equipoActual=eqs[fich.equipoRoleId]||null; }
    if(tarj) Object.values(tarj).forEach(function(t){
      var match=t.discordTag===userData.discordTag||t.jugador===userData.discordTag||t.jugador===userData.nombre;
      if(match && t.tipo==='yellow') amarillas++;
    });
  }
  wrap.innerHTML='<div class="perfil-wrap">'+
    '<div class="perfil-card reveal visible">'+
      '<div class="perfil-head">'+
        '<div class="perfil-av-wrap" onclick="document.getElementById(\'avInput\').click()">'+
          '<img class="perfil-av" src="'+av+'" id="perfilAv" onerror="this.src=\''+avatarDefault(userData.nombre||'?')+'\'" alt="">'+
          '<div class="perfil-av-edit">E</div>'+
        '</div>'+
        '<input type="file" id="avInput" accept="image/*" style="display:none" onchange="changeAvatar(this)">'+
        '<div class="perfil-info">'+
          '<h3>'+(userData.nombre||'Jugador')+'</h3>'+
          '<p>'+user.email+'</p>'+
          (userData.discordTag?'<div class="dbadge">'+userData.discordTag+'</div>':'<div style="font-family:var(--fc);font-size:.72rem;color:var(--g3);margin-top:5px">Discord no vinculado</div>')+
          (equipoActual?'<div style="display:flex;align-items:center;gap:5px;margin-top:6px"><div style="width:18px;height:18px;background:#fff;border-radius:3px;padding:1px;display:flex;align-items:center;justify-content:center">'+logoHtml(equipoActual.logo||'',14)+'</div><span style="font-family:var(--fc);font-size:.72rem;color:var(--g2)">'+(equipoActual.nombre||equipoActual.abrev)+'</span></div>':'')+
        '</div>'+
      '</div>'+
      '<div class="code-box" style="margin-top:.9rem">'+
        '<div>'+
          '<div style="font-family:var(--fc);font-size:.62rem;letter-spacing:2px;text-transform:uppercase;color:var(--g3);margin-bottom:3px">CODIGO DE VINCULACION</div>'+
          '<div class="code-val">'+(userData.codigo||'--')+'</div>'+
          '<div style="font-family:var(--fc);font-size:.66rem;color:var(--g3);margin-top:3px">Usa /vincular '+(userData.codigo||'[codigo]')+' en Discord</div>'+
        '</div>'+
        '<button class="btn btn-ghost btn-xs" onclick="copyCodigo(\''+(userData.codigo||'')+'\')">COPIAR</button>'+
      '</div>'+
    '</div>'+
    '<div class="perfil-card reveal visible">'+
      '<div style="font-family:var(--fd);font-size:1.1rem;letter-spacing:2px;color:var(--gold);margin-bottom:.9rem">STATS EN LA LIGA</div>'+
      '<div class="stats-mini">'+
        '<div class="stat-mini"><span class="stat-mini-num">'+(botStats ? botStats.goles||0 : 0)+'</span><span class="stat-mini-label">Goles</span></div>'+
        '<div class="stat-mini"><span class="stat-mini-num">'+(botStats ? botStats.asistencias||0 : 0)+'</span><span class="stat-mini-label">Asist.</span></div>'+
        '<div class="stat-mini"><span class="stat-mini-num">'+(botStats ? botStats.cs||0 : 0)+'</span><span class="stat-mini-label">Vallas</span></div>'+
        '<div class="stat-mini"><span class="stat-mini-num">'+(botStats ? botStats.partidos||0 : 0)+'</span><span class="stat-mini-label">Partidos</span></div>'+
        '<div class="stat-mini"><span class="stat-mini-num">'+(botStats ? botStats.mvps||0 : 0)+'</span><span class="stat-mini-label">MVPs</span></div>'+
        '<div class="stat-mini"><span class="stat-mini-num">'+amarillas+'</span><span class="stat-mini-label">Amarillas</span></div>'+
      '</div>'+
    '</div>'+
    '<div style="display:flex;gap:.65rem;flex-wrap:wrap">'+
      (userData.discordId?'<button class="btn btn-ghost btn-sm" onclick="openPlayerModal(\''+userData.discordId+'\',\''+user.uid+'\')">VER PERFIL PUBLICO</button>':'')+
      '<button class="btn btn-danger" onclick="doLogout()">CERRAR SESION</button>'+
    '</div>'+
  '</div>';
}
function copyCodigo(c){ if(!c) return; navigator.clipboard.writeText(c).then(function(){toast('Codigo copiado');}).catch(function(){toast('No se pudo copiar','err');}); }
async function changeAvatar(input){
  var user=window._AUTH.currentUser; if(!user||!input.files[0]) return;
  var reader=new FileReader();
  reader.onload=async function(e){
    var data=e.target.result;
    if(data.length>700000) data=await compressImg(data,.65);
    if(data.length>700000) return toast('Imagen demasiado grande','err');
    await fbUpdate(R('usuarios/'+user.uid),{avatar:data});
    document.getElementById('perfilAv').src=data; toast('Avatar actualizado');
  };
  reader.readAsDataURL(input.files[0]);
}

/* ══ PLAYER MODAL ══ */
async function openPlayerModal(discordId, webUid){
  if(!discordId&&!webUid) return;
  var overlay=document.getElementById('pmodal');
  var body=document.getElementById('pmodalBody');
  overlay.classList.add('open');
  body.innerHTML='<div class="loading"><div class="spinner"></div><p>CARGANDO PERFIL</p></div>';
  if(!webUid&&discordId){
    var c=await fbGet(R('bot/cuentas/'+discordId));
    if(c) webUid=c.webUid||'';
  }
  var results=await Promise.all([
    discordId?fbGet(R('bot/fichajes/'+discordId)):Promise.resolve(null),
    getEquipos(), fbGet(R('liga/tarjetas')), fbGet(R('bot/historial')), fbGet(R('liga/sanciones'))
  ]);
  var fichaje=results[0], eqs=results[1], tarjetas=results[2], historial=results[3], sanciones=results[4];
  var userData=null;
  if(webUid) userData=await fbGet(R('usuarios/'+webUid));
  var discordTag=userData ? userData.discordTag||( fichaje ? fichaje.discordTag||discordId : discordId) : (fichaje ? fichaje.discordTag||discordId : discordId);
  var nombre=userData ? userData.nombre||discordTag : discordTag||'Jugador';
  var av=userData ? userData.avatar||avatarDefault(nombre) : avatarDefault(nombre);
  var bio=userData ? userData.bio||'' : '';
  var equipoActual=fichaje?(eqs[fichaje.equipoRoleId]||null):null;
  var statResults=await Promise.all([
    fbGet(R('liga/goleadores')),fbGet(R('liga/asistencias')),fbGet(R('liga/cleansheets')),
    discordId?fbGet(R('bot/stats/'+discordId)):Promise.resolve(null)
  ]);
  var goleadores=statResults[0],asistencias=statResults[1],cleansheets=statResults[2],botStats=statResults[3];
  function findStat(data,key){
    if(!data) return 0;
    var e=Object.values(data).find(function(x){return x.discordTag===discordTag||x.nombre===nombre||x.discordId===discordId;});
    return e ? e[key]||0 : 0;
  }
  var goles=botStats ? botStats.goles||findStat(goleadores,'goles') : findStat(goleadores,'goles');
  var asist=botStats ? botStats.asistencias||findStat(asistencias,'asistencias') : findStat(asistencias,'asistencias');
  var cs=botStats ? botStats.cs||findStat(cleansheets,'cleansheets') : findStat(cleansheets,'cleansheets');
  var partidos=botStats ? botStats.partidos||0 : 0;
  var mvps=botStats ? botStats.mvps||0 : 0;
  var amarillas=[],rojas=[];
  if(tarjetas) Object.values(tarjetas).forEach(function(t){
    var match=t.discordTag===discordTag||t.jugador===discordTag||t.jugador===nombre;
    if(match){ if(t.tipo==='yellow') amarillas.push(t); else if(t.tipo==='red') rojas.push(t); }
  });
  var sancionesActivas=[];
  if(sanciones) sancionesActivas=Object.values(sanciones).filter(function(s){return s.discordTag===discordTag||s.jugador===discordTag||s.jugador===nombre;});
  var histJugador=[];
  if(historial&&discordId){
    histJugador=Object.values(historial).filter(function(h){return h.jugadorId===discordId&&['FICHAJE','BAJA','TRASPASO','RENUNCIA'].includes(h.tipo);}).sort(function(a,b){return new Date(b.fecha||0)-new Date(a.fecha||0);}).slice(0,5);
  }
  body.innerHTML=
    '<div class="pmodal-head">'+
      '<img class="pmodal-av" src="'+av+'" onerror="this.src=\''+avatarDefault(nombre)+'\'" alt="">'+
      '<div class="pmodal-info">'+
        '<div class="pmodal-name">'+nombre+'</div>'+
        (discordTag?'<div class="pmodal-tag">'+discordTag+'</div>':'')+
        (equipoActual?'<div class="pmodal-team">'+
          '<div class="pmodal-team-logo">'+logoHtml(equipoActual.logo||'',12)+'</div>'+
          '<span style="font-family:var(--fc);font-size:.72rem;color:var(--g2);cursor:pointer" onclick="closePModal();openTeamModal(\''+equipoActual.roleId+'\')">'+( equipoActual.nombre||equipoActual.abrev)+'</span>'+
          (fichaje&&fichaje.esDT?'<span style="font-size:.6rem;background:rgba(240,180,41,.15);border:1px solid rgba(240,180,41,.3);color:var(--gold);border-radius:3px;padding:1px 5px;margin-left:3px">DT</span>':'')+
        '</div>':'<span style="font-size:.7rem;color:var(--g3);margin-top:2px">Sin equipo</span>')+
      '</div>'+
    '</div>'+
    (bio?'<div class="pmodal-bio">"'+escHtml(bio)+'"</div>':'')+
    '<div class="pmodal-section">ESTADISTICAS</div>'+
    '<div class="pmodal-stats">'+
      '<div class="pmodal-stat"><span class="pmodal-stat-num">'+goles+'</span><span class="pmodal-stat-label">Goles</span></div>'+
      '<div class="pmodal-stat"><span class="pmodal-stat-num">'+asist+'</span><span class="pmodal-stat-label">Asist.</span></div>'+
      '<div class="pmodal-stat"><span class="pmodal-stat-num">'+cs+'</span><span class="pmodal-stat-label">Vallas</span></div>'+
      '<div class="pmodal-stat"><span class="pmodal-stat-num">'+partidos+'</span><span class="pmodal-stat-label">Partidos</span></div>'+
      '<div class="pmodal-stat"><span class="pmodal-stat-num">'+mvps+'</span><span class="pmodal-stat-label">MVPs</span></div>'+
      '<div class="pmodal-stat"><span class="pmodal-stat-num" style="'+(amarillas.length>=3?'color:#F87171':'')+'">'+amarillas.length+'</span><span class="pmodal-stat-label">Amarillas</span></div>'+
    '</div>'+
    ((amarillas.length||rojas.length||sancionesActivas.length)?
      '<div class="pmodal-section">DISCIPLINA</div>'+
      '<div class="pmodal-tarjetas">'+
        amarillas.map(function(t){return '<span class="pmodal-tarjeta yellow">A '+fmtDate(t.fecha)+(t.motivo?' - '+t.motivo:'')+'</span>';}).join('')+
        rojas.map(function(t){return '<span class="pmodal-tarjeta red">R '+fmtDate(t.fecha)+(t.motivo?' - '+t.motivo:'')+'</span>';}).join('')+
        sancionesActivas.map(function(s){return '<span class="pmodal-tarjeta red">'+(s.tipo||'SANCION').toUpperCase()+(s.partidos?' ('+s.partidos+' PJ)':'')+' - '+(s.motivo||'')+'</span>';}).join('')+
      '</div>'
    :'')+
    (histJugador.length?
      '<div class="pmodal-section">HISTORIAL</div>'+
      '<div class="pmodal-historial">'+histJugador.map(function(h){
        var eq=eqs[h.equipoId]||{};
        return '<div class="pmodal-hist-item">'+
          (eq.logo?'<div style="width:22px;height:22px;background:#fff;border-radius:3px;padding:1px;display:flex;align-items:center;justify-content:center">'+logoHtml(eq.logo,16)+'</div>':'')+
          '<div style="flex:1"><span style="font-family:var(--fc);font-size:.76rem;color:var(--g1)">'+(eq.nombre||eq.abrev||h.equipoId||'-')+'</span><span style="font-family:var(--fc);font-size:.65rem;color:var(--g3);margin-left:6px">'+fmtDate(h.fecha)+'</span></div>'+
          '<span class="fichaje-type '+h.tipo+'">'+h.tipo+'</span>'+
        '</div>';
      }).join('')+'</div>'
    :'')+
    (!webUid?'<div style="margin-top:1rem;padding:.65rem;background:rgba(255,255,255,.03);border-radius:var(--r-sm);font-family:var(--fc);font-size:.7rem;color:var(--g3);text-align:center">Este jugador aun no ha vinculado su cuenta web</div>':'');
}
function closePModal(){ document.getElementById('pmodal').classList.remove('open'); }

/* ══ TEAM MODAL ══ */
async function openTeamModal(roleId){
  if(!roleId) return;
  var overlay=document.getElementById('tmodal');
  var body=document.getElementById('tmodalBody');
  overlay.classList.add('open');
  body.innerHTML='<div class="loading"><div class="spinner"></div><p>CARGANDO EQUIPO</p></div>';
  await ensureIdentity();
  var results=await Promise.all([getEquipos(), fbGet(R('liga/primera')), fbGet(R('liga/partidos_primera')), fbGet(R('liga/goleadores'))]);
  var eqs=results[0], tabla=results[1], partidos=results[2], goleadores=results[3];
  var eq=eqs[roleId];
  if(!eq){ body.innerHTML='<div class="empty"><p>Equipo no encontrado</p></div>'; return; }
  var stats=(tabla&&tabla[roleId])||{};
  var fichajes=window._globalFichajes;
  var usuarios=window._globalUsuarios;
  var discToUid=window._globalDiscToUid;
  var players=Object.entries(fichajes)
    .filter(function(e){return e[1].equipoRoleId===roleId;})
    .map(function(e){
      var did=e[0], f=e[1];
      var uid=discToUid[did]; var u=uid&&usuarios[uid]?usuarios[uid]:null;
      return {discordId:did, uid:uid||'', nombre:u?u.nombre||f.discordTag||did:f.discordTag||did, avatar:u?u.avatar||null:null, discordTag:f.discordTag||did, esDT:f.esDT};
    });
  var matches=partidos?Object.values(partidos).filter(function(p){return p.localId===roleId||p.visitanteId===roleId;}).sort(function(a,b){return new Date(b.fecha||0)-new Date(a.fecha||0);}).slice(0,5):[];
  var topScorers=goleadores?Object.values(goleadores).filter(function(g){return g.equipoId===roleId&&(g.goles||0)>0;}).sort(function(a,b){return (b.goles||0)-(a.goles||0);}).slice(0,3):[];
  var dg=(stats.gf||0)-(stats.gc||0);
  body.innerHTML=
    '<div style="display:flex;align-items:flex-end;gap:1.1rem;margin-top:-38px;margin-bottom:1rem;position:relative;z-index:1">'+
      '<div style="width:76px;height:76px;background:#fff;border-radius:12px;border:3px solid var(--bg-2);box-shadow:0 4px 20px rgba(0,0,0,.5);flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:6px">'+logoHtml(eq.logo||'',56)+'</div>'+
      '<div style="padding-bottom:4px;flex:1"><div style="font-family:var(--fd);font-size:1.5rem;letter-spacing:2px;color:#fff;line-height:1">'+(eq.nombre||eq.abrev)+'</div><div style="font-family:var(--fc);font-size:.78rem;letter-spacing:2px;color:var(--gold);margin-top:2px">'+(eq.abrev||'')+'</div></div>'+
    '</div>'+
    '<div style="font-family:var(--fd);font-size:.95rem;letter-spacing:2px;color:var(--gold);margin:1rem 0 .6rem">ESTADISTICAS</div>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:.5rem">'+
      [['PJ',stats.pj||0],['PG',stats.pg||0],['PTS',stats.pts||0],['DG',(dg>0?'+':'')+dg]].map(function(item){
        var l=item[0],v=item[1];
        return '<div style="background:var(--bg-3);border:1px solid var(--border);border-radius:var(--r-sm);padding:.65rem;text-align:center"><span style="font-family:var(--fd);font-size:1.5rem;color:'+(l==='DG'&&dg>0?'var(--green)':l==='DG'&&dg<0?'var(--red)':'var(--gold)')+';display:block;line-height:1">'+v+'</span><span style="font-family:var(--fc);font-size:.58rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--g3);margin-top:2px">'+l+'</span></div>';
      }).join('')+
    '</div>'+
    (topScorers.length?
      '<div style="font-family:var(--fd);font-size:.95rem;letter-spacing:2px;color:var(--gold);margin:1rem 0 .6rem">GOLEADORES</div>'+
      '<div style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:.5rem">'+
        topScorers.map(function(g,i){return '<div style="display:flex;align-items:center;gap:.6rem;padding:.4rem .6rem;background:var(--bg-3);border-radius:var(--r-sm);border:1px solid var(--border)"><span style="font-family:var(--fd);font-size:1rem;color:var(--gold);width:20px">'+(i+1)+'</span><span style="font-family:var(--fc);font-size:.82rem;color:#fff;flex:1">'+(g.nombre||g.discordTag)+'</span><span class="pts-pill">'+g.goles+' G</span></div>';}).join('')+
      '</div>'
    :'')+
    '<div style="font-family:var(--fd);font-size:.95rem;letter-spacing:2px;color:var(--gold);margin:1rem 0 .6rem">PLANTILLA ('+players.length+')</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.8rem">'+
      players.map(function(p){
        var av=p.avatar||avatarDefault(p.nombre);
        var hasP=p.discordId||p.uid;
        return '<div class="equipo-player '+(p.esDT?'dt':'')+'" '+(hasP?'onclick="openPlayerModal(\''+p.discordId+'\',\''+p.uid+'\')" style="cursor:pointer"':'')+' title="'+p.discordTag+'"><img src="'+av+'" style="width:22px;height:22px;border-radius:50%;object-fit:cover" onerror="this.src=\''+avatarDefault(p.nombre)+'\'"><span class="'+(hasP?'player-clickable':'')+'">'+p.nombre+'</span>'+(p.esDT?'<span style="font-size:.55rem;color:var(--gold);font-weight:800">DT</span>':'')+'</div>';
      }).join('')+
      (!players.length?'<span style="font-family:var(--fc);font-size:.76rem;color:var(--g3)">Sin jugadores fichados</span>':'')+
    '</div>'+
    (matches.length?
      '<div style="font-family:var(--fd);font-size:.95rem;letter-spacing:2px;color:var(--gold);margin:1rem 0 .6rem">ULTIMOS PARTIDOS</div>'+
      '<div style="display:flex;flex-direction:column;gap:.4rem">'+
        matches.map(function(p){
          var isLocal=p.localId===roleId;
          var rival=eqs[isLocal?p.visitanteId:p.localId]||{};
          var myG=isLocal?p.golLocal:p.golVisitante;
          var thG=isLocal?p.golVisitante:p.golLocal;
          var hs=myG!=null;
          var res=hs?(myG>thG?'W':myG<thG?'L':'D'):null;
          var col={W:'rgba(74,222,128,.15)',L:'rgba(248,113,113,.15)',D:'rgba(255,255,255,.06)'};
          return '<div style="display:flex;align-items:center;gap:.7rem;padding:.5rem .7rem;background:'+(res?col[res]:'var(--bg-3)')+';border:1px solid var(--border);border-radius:var(--r-sm)">'+
            (res?'<span style="font-family:var(--fd);font-size:.9rem;color:'+(res==='W'?'var(--green)':res==='L'?'var(--red)':'var(--g2)')+';width:16px">'+res+'</span>':'')+
            '<div style="width:22px;height:22px;background:#fff;border-radius:3px;padding:1px;display:flex;align-items:center;justify-content:center">'+logoHtml(rival.logo||'',16)+'</div>'+
            '<span style="font-family:var(--fc);font-size:.78rem;color:#fff;flex:1">'+(isLocal?'vs':'@')+' '+(rival.nombre||rival.abrev||'Rival')+'</span>'+
            (hs?'<span style="font-family:var(--fd);font-size:1rem;color:var(--gold)">'+myG+' - '+thG+'</span>':'<span style="font-size:.7rem;color:var(--g3)">Prog.'+(p.hora?' - '+p.hora:'')+'</span>')+
            '<span style="font-size:.63rem;color:var(--g3)">'+fmtDate(p.fecha)+'</span>'+
          '</div>';
        }).join('')+
      '</div>'
    :'');
}
function closeTModal(){ document.getElementById('tmodal').classList.remove('open'); }

/* ══ ADMIN ══ */
window._adminLogged=false;
window._adminRole=null;

async function openAdmin(){
  var user=await getAuthUser();
  if(!user){ toast('Inicia sesion en tu cuenta web primero','err',4000); showSection('cuenta'); return; }
  var adminEntry=await fbGet(R('admins/'+user.uid));
  if(!adminEntry){ toast('No tienes permisos de administrador','err',4000); return; }
  window._adminLogged=true;
  window._adminRole=adminEntry.role||'admin';
  document.getElementById('adminModal').classList.add('open');
  var saTab=document.getElementById('adminTabSuperadmin');
  if(saTab) saTab.style.display=(window._adminRole==='superadmin')?'':'none';
  var ab=document.getElementById('jornadasAdminBtns');
  if(ab) ab.style.display='block';
  if(!document.getElementById('apanel-primera')){ buildAdminPanels(); switchAdminTab('primera'); }
}
function closeAdmin(){ document.getElementById('adminModal').classList.remove('open'); }

function switchAdminTab(id,btn){
  document.querySelectorAll('.admin-tab').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  else document.querySelectorAll('.admin-tab').forEach(function(b){ if(b.getAttribute('onclick') && b.getAttribute('onclick').includes("'"+id+"'")) b.classList.add('active'); });
  document.querySelectorAll('.admin-panel').forEach(function(p){p.classList.remove('active');});
  var panel=document.getElementById('apanel-'+id);
  if(panel) panel.classList.add('active');
}

async function buildAdminPanels(){
  var container=document.getElementById('adminPanels');
  var results=await Promise.all([getEquipos(), fbGet(R('bot/fichajes'))]);
  var equipos=results[0];
  var eqList=Object.values(equipos);
  var eqOpts=eqList.map(function(e){return '<option value="'+e.roleId+'">'+(e.nombre||e.abrev)+'</option>';}).join('');

  container.innerHTML=
  '<div class="admin-panel active" id="apanel-primera">'+
    '<div class="setup-notice"><h4>TABLA - PRIMERA DIVISION</h4><p>Edita las estadisticas de cada equipo.</p></div>'+
    '<div class="edit-table-wrap"><table class="edit-table" id="editTablaPrimera">'+
      '<thead><tr><th style="text-align:left;min-width:140px">EQUIPO</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>PTS</th></tr></thead>'+
      '<tbody id="editTbody1"></tbody>'+
    '</table></div>'+
    '<div class="save-bar"><button class="btn btn-ghost btn-sm" onclick="loadAdminTabla()">RECARGAR</button><button class="btn btn-gold" onclick="savePrimera()">GUARDAR TABLA</button></div>'+
  '</div>'+

  '<div class="admin-panel" id="apanel-partidos">'+
    '<div class="setup-notice"><h4>AGREGAR PARTIDO</h4><p>El partido se crea como <b>Programado</b>. Luego puedes marcar el resultado directamente aqui.</p></div>'+
    '<div class="form-row" style="margin-bottom:.6rem">'+
      '<div class="form-group"><label>Local</label><select id="pLocal"><option value="">- Equipo -</option>'+eqOpts+'</select></div>'+
      '<div class="form-group"><label>Visitante</label><select id="pVisitante"><option value="">- Equipo -</option>'+eqOpts+'</select></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.7rem;margin-bottom:.7rem">'+
      '<div class="form-group"><label>Fecha</label><input type="date" id="pFecha"></div>'+
      '<div class="form-group"><label>Hora</label><input type="time" id="pHora"></div>'+
      '<div class="form-group"><label>Jornada</label><input type="text" id="pJornada" placeholder="J1, J2..."></div>'+
      '<div class="form-group"><label>Nota (opc.)</label><input type="text" id="pNota" placeholder="Sala, plataforma..."></div>'+
    '</div>'+
    '<button class="btn btn-gold" style="margin-bottom:1.1rem" onclick="addPartido()">+ AGREGAR PROGRAMADO</button>'+
    '<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.6rem;flex-wrap:wrap">'+
      '<span style="font-family:var(--fc);font-size:.65rem;letter-spacing:1px;color:var(--g3);text-transform:uppercase">Filtrar:</span>'+
      '<button class="jornada-filter-btn active" id="apmf-all"    onclick="filterAdminMatches(\'all\',this)"       style="padding:4px 10px;font-size:.62rem">TODOS</button>'+
      '<button class="jornada-filter-btn"         id="apmf-sched" onclick="filterAdminMatches(\'scheduled\',this)" style="padding:4px 10px;font-size:.62rem">PROGRAMADOS</button>'+
      '<button class="jornada-filter-btn"         id="apmf-played" onclick="filterAdminMatches(\'played\',this)"  style="padding:4px 10px;font-size:.62rem">JUGADOS</button>'+
      '<button class="jornada-filter-btn"         id="apmf-pend"  onclick="filterAdminMatches(\'pending\',this)"  style="padding:4px 10px;font-size:.62rem">PENDIENTES</button>'+
      '<span id="apmCountLabel" style="font-family:var(--fc);font-size:.62rem;color:var(--g3);margin-left:.5rem"></span>'+
    '</div>'+
    '<div id="adminMatchList"><div class="loading"><div class="spinner"></div><p>CARGANDO</p></div></div>'+
  '</div>'+

  '<div class="admin-panel" id="apanel-stats">'+
    '<div class="setup-notice"><h4>TOP STATS</h4><p>Selecciona equipo, luego jugador y valor.</p></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">'+
      '<div><div style="font-family:var(--fd);font-size:1rem;color:var(--gold);margin-bottom:.6rem;letter-spacing:2px">GOLEADORES</div><div id="aStatsGoles"></div><button class="btn btn-ghost btn-xs" style="margin-top:.5rem" onclick="addStatsRow(\'goleadores\')">+ FILA</button></div>'+
      '<div><div style="font-family:var(--fd);font-size:1rem;color:var(--gold);margin-bottom:.6rem;letter-spacing:2px">ASISTENCIAS</div><div id="aStatsAsist"></div><button class="btn btn-ghost btn-xs" style="margin-top:.5rem" onclick="addStatsRow(\'asistencias\')">+ FILA</button></div>'+
      '<div><div style="font-family:var(--fd);font-size:1rem;color:var(--gold);margin-bottom:.6rem;letter-spacing:2px">CLEANSHEETS</div><div id="aStatsCS"></div><button class="btn btn-ghost btn-xs" style="margin-top:.5rem" onclick="addStatsRow(\'cleansheets\')">+ FILA</button></div>'+
    '</div>'+
    '<div class="save-bar"><button class="btn btn-gold" onclick="saveAllStats()">GUARDAR STATS</button></div>'+
  '</div>'+

  '<div class="admin-panel" id="apanel-tarjetas">'+
    '<div class="setup-notice"><h4>TARJETAS</h4></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:.9rem">'+
      '<div class="form-group"><label>1 - Equipo</label><select id="tEquipo" onchange="onTarjetaEqChange(this)"><option value="">- Equipo -</option>'+eqOpts+'</select></div>'+
      '<div class="form-group"><label>2 - Jugador</label><select id="tJugadorSelect" onchange="onTarjetaPlayerChange(this)"><option value="">- Equipo primero -</option></select></div>'+
    '</div>'+
    '<div id="tJugadorPreview" style="display:none;background:var(--bg-3);border:1px solid rgba(240,180,41,.2);border-radius:var(--r-sm);padding:.5rem .9rem;margin-bottom:.7rem;flex-direction:row;align-items:center;gap:.7rem">'+
      '<img id="tJugadorAv" src="" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid var(--border-g)">'+
      '<div><div id="tJugadorNombre" style="font-family:var(--fc);font-size:.82rem;font-weight:700;color:#fff"></div><div id="tJugadorTag" style="font-family:var(--fc);font-size:.66rem;color:#7289da"></div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.7rem;margin-bottom:.9rem">'+
      '<div class="form-group"><label>Tipo</label><select id="tTipo"><option value="yellow">Amarilla</option><option value="red">Roja</option></select></div>'+
      '<div class="form-group"><label>Fecha</label><input type="date" id="tFecha"></div>'+
      '<div class="form-group"><label>Motivo (opc.)</label><input type="text" id="tMotivo" placeholder="Falta violenta..."></div>'+
    '</div>'+
    '<button class="btn btn-gold" style="margin-bottom:1rem" onclick="addTarjeta()">+ AGREGAR TARJETA</button>'+
    '<div id="adminTarjList"><div class="loading"><div class="spinner"></div><p>CARGANDO</p></div></div>'+
  '</div>'+

  '<div class="admin-panel" id="apanel-sanciones">'+
    '<div class="setup-notice"><h4>SANCIONES</h4></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:.9rem">'+
      '<div class="form-group"><label>1 - Equipo</label><select id="sEquipo" onchange="onSancionEqChange(this)"><option value="">- Equipo -</option>'+eqOpts+'</select></div>'+
      '<div class="form-group"><label>2 - Jugador</label><select id="sJugadorSelect" onchange="onSancionPlayerChange(this)"><option value="">- Equipo primero -</option></select></div>'+
    '</div>'+
    '<div id="sJugadorPreview" style="display:none;background:var(--bg-3);border:1px solid rgba(240,180,41,.2);border-radius:var(--r-sm);padding:.5rem .9rem;margin-bottom:.7rem;flex-direction:row;align-items:center;gap:.7rem">'+
      '<img id="sJugadorAv" src="" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid var(--border-g)">'+
      '<div><div id="sJugadorNombre" style="font-family:var(--fc);font-size:.82rem;font-weight:700;color:#fff"></div><div id="sJugadorTag" style="font-family:var(--fc);font-size:.66rem;color:#7289da"></div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.7rem;margin-bottom:.9rem">'+
      '<div class="form-group"><label>Tipo</label><select id="sTipo"><option value="warning">Advertencia</option><option value="suspension">Suspension</option><option value="ban">Ban</option></select></div>'+
      '<div class="form-group"><label>Partidos (opc.)</label><input type="number" id="sPartidos" min="0" value="1"></div>'+
      '<div class="form-group"><label>Fecha</label><input type="date" id="sFecha"></div>'+
    '</div>'+
    '<div class="form-group"><label>Motivo</label><textarea id="sMotivo" placeholder="Describe la sancion..."></textarea></div>'+
    '<button class="btn btn-gold" style="margin-bottom:1rem" onclick="addSancion()">+ APLICAR SANCION</button>'+
    '<div id="adminSancionesList"><div class="loading"><div class="spinner"></div><p>CARGANDO</p></div></div>'+
  '</div>'+

  '<div class="admin-panel" id="apanel-noticias">'+
    '<button class="btn btn-gold" style="margin-bottom:.9rem" onclick="addNoticiaForm()">+ NUEVA NOTICIA</button>'+
    '<div id="newNoticiaForm"></div>'+
    '<div id="adminNoticiasList"></div>'+
  '</div>'+

  '<div class="admin-panel" id="apanel-cuentas">'+
    '<div class="setup-notice"><h4>GESTION DE CUENTAS</h4></div>'+
    '<div id="adminCuentasList"><div class="loading"><div class="spinner"></div><p>CARGANDO</p></div></div>'+
  '</div>'+

  '<div class="admin-panel" id="apanel-anuncios">'+
    '<div class="setup-notice"><h4>ANUNCIOS AL BOT</h4></div>'+
    '<div class="form-group"><label>Titulo</label><input type="text" id="aTitulo" placeholder="Titulo del anuncio"></div>'+
    '<div class="form-group"><label>Mensaje</label><textarea id="aTexto" placeholder="Cuerpo del anuncio..." style="min-height:120px"></textarea></div>'+
    '<button class="btn btn-gold" onclick="sendAnuncio()">ENVIAR ANUNCIO</button>'+
  '</div>'+

  '<div class="admin-panel" id="apanel-superadmin">'+
    '<div class="setup-notice" style="border-color:rgba(240,180,41,.4);background:rgba(240,180,41,.06)"><h4>GESTION DE ADMINISTRADORES</h4></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:.9rem">'+
      '<div class="form-group"><label>Email de la cuenta web</label><input type="email" id="saEmail" placeholder="usuario@email.com"></div>'+
      '<div class="form-group"><label>Rol</label><select id="saRol"><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select></div>'+
    '</div>'+
    '<button class="btn btn-gold" style="margin-bottom:1.1rem" onclick="addAdminByEmail()">+ AGREGAR ADMIN</button>'+
    '<div id="adminsList"><div class="loading"><div class="spinner"></div><p>CARGANDO</p></div></div>'+
  '</div>';

  loadAdminTabla(); loadAdminMatches(); loadAdminStats();
  loadAdminTarjetas(); loadAdminSanciones();
  loadAdminNoticias(); loadAdminCuentas();
  if(window._adminRole==='superadmin') loadAdminsList();
  ['pFecha','tFecha','sFecha'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=new Date().toISOString().slice(0,10); });
  var pHoraEl=document.getElementById('pHora'); if(pHoraEl) pHoraEl.value='';
  _adminMatchesFilter='all';
}

/* ADMIN TABLA */
async function loadAdminTabla(){
  var tbody=document.getElementById('editTbody1'); if(!tbody) return;
  var results=await Promise.all([getEquipos(),fbGet(R('liga/primera'))]);
  var equipos=results[0], tabla=results[1];
  var eqList=Object.values(equipos);
  tbody.innerHTML=eqList.map(function(eq){
    var t=(tabla&&tabla[eq.roleId])||{};
    return '<tr data-id="'+eq.roleId+'">'+
      '<td><div class="team-label-admin"><div class="tl-logo">'+logoHtml(eq.logo||'',16)+'</div>'+(eq.nombre||eq.abrev)+'</div></td>'+
      ['pj','pg','pe','pp','gf','gc','pts'].map(function(f){return '<td><input type="number" min="0" value="'+(t[f]||0)+'" data-field="'+f+'" style="width:54px"></td>';}).join('')+
    '</tr>';
  }).join('');
}
async function savePrimera(){
  var rows=document.querySelectorAll('#editTbody1 tr');
  var update={};
  rows.forEach(function(row){
    var id=row.dataset.id; var obj={};
    row.querySelectorAll('input[data-field]').forEach(function(inp){ obj[inp.dataset.field]=parseInt(inp.value)||0; });
    update[id]=obj;
  });
  await fbSet(R('liga/primera'),update);
  var tw=document.getElementById('tabla1Wrap'); if(tw) delete tw.dataset.loaded;
  toast('Tabla guardada');
}

/* ADMIN PARTIDOS */
var _adminMatchesData=[];
var _adminMatchesFilter='all';

async function loadAdminMatches(){
  var wrap=document.getElementById('adminMatchList'); if(!wrap) return;
  wrap.innerHTML='<div class="loading"><div class="spinner"></div><p>CARGANDO</p></div>';
  var results=await Promise.all([fbGet(R('liga/partidos_primera')),getEquipos()]);
  var ps=results[0], eqs=results[1];
  var eqMap={}; Object.values(eqs).forEach(function(e){eqMap[e.roleId]=e;});
  window._adminMatchEqMap=eqMap;
  if(!ps){ _adminMatchesData=[]; renderAdminMatches(); return; }
  _adminMatchesData=Object.entries(ps).map(function(e){return Object.assign({id:e[0]},e[1]);})
    .sort(function(a,b){
      var pa=a.golLocal!=null?2:a.hora?1:0;
      var pb=b.golLocal!=null?2:b.hora?1:0;
      if(pa!==pb) return pa-pb;
      return new Date(a.fecha||0)-new Date(b.fecha||0);
    });
  renderAdminMatches();
}

function filterAdminMatches(filter,btn){
  _adminMatchesFilter=filter;
  document.querySelectorAll('#apmf-all,#apmf-sched,#apmf-played,#apmf-pend').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  renderAdminMatches();
}

function renderAdminMatches(){
  var wrap=document.getElementById('adminMatchList'); if(!wrap) return;
  var eqMap=window._adminMatchEqMap||{};
  var arr=_adminMatchesData;
  if(_adminMatchesFilter==='scheduled') arr=arr.filter(function(p){return p.golLocal==null&&p.hora;});
  else if(_adminMatchesFilter==='played') arr=arr.filter(function(p){return p.golLocal!=null;});
  else if(_adminMatchesFilter==='pending') arr=arr.filter(function(p){return p.golLocal==null&&!p.hora;});
  var lbl=document.getElementById('apmCountLabel');
  if(lbl) lbl.textContent=arr.length+' partido'+(arr.length!==1?'s':'');
  if(!arr.length){ wrap.innerHTML='<div style="text-align:center;padding:1.5rem"><p style="font-family:var(--fc);color:var(--g3);letter-spacing:1px;font-size:.72rem">SIN PARTIDOS EN ESTA CATEGORIA</p></div>'; return; }
  wrap.innerHTML=arr.map(function(p){
    var l=eqMap[p.localId]||{}; var v=eqMap[p.visitanteId]||{};
    var isPlayed=p.golLocal!=null;
    var isScheduled=!isPlayed&&p.hora;
    var statusColor=isPlayed?'rgba(74,222,128,.15)':isScheduled?'rgba(88,101,242,.12)':'rgba(255,255,255,.04)';
    var statusLabel=isPlayed
      ? '<span style="font-size:.6rem;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.25);color:#4ADE80;border-radius:3px;padding:1px 6px;font-family:var(--fc)">JUGADO</span>'
      : isScheduled
        ? '<span style="font-size:.6rem;background:rgba(88,101,242,.12);border:1px solid rgba(88,101,242,.25);color:#818cf8;border-radius:3px;padding:1px 6px;font-family:var(--fc)">PROGRAMADO</span>'
        : '<span style="font-size:.6rem;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--g3);border-radius:3px;padding:1px 6px;font-family:var(--fc)">PENDIENTE</span>';
    var resultText=isPlayed
      ? '<span style="font-family:var(--fd);font-size:1.05rem;color:var(--gold);letter-spacing:2px">'+p.golLocal+' - '+p.golVisitante+'</span>'
      : isScheduled
        ? '<span style="font-family:var(--fd);font-size:.85rem;color:#818cf8">'+p.hora+'</span>'
        : '<span style="font-family:var(--fc);font-size:.72rem;color:var(--g3)">vs</span>';

    // inline result editor row (hidden by default)
    var editRow='<div id="editrow-'+p.id+'" style="display:none;grid-column:1/-1;background:var(--bg-4);border-top:1px solid var(--border);padding:.6rem .8rem;border-radius:0 0 8px 8px">'+
      '<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">'+
        '<span style="font-family:var(--fc);font-size:.65rem;color:var(--g3);text-transform:uppercase;letter-spacing:1px">'+( l.abrev||'L')+'</span>'+
        '<input type="number" id="er-gl-'+p.id+'" value="'+(isPlayed?p.golLocal:0)+'" min="0" style="width:50px;height:36px;background:var(--bg-3);border:2px solid rgba(240,180,41,.3);border-radius:6px;color:var(--gold);font-family:var(--fd);font-size:1.3rem;text-align:center;outline:none">'+
        '<span style="font-family:var(--fd);font-size:1rem;color:var(--g3)">-</span>'+
        '<input type="number" id="er-gv-'+p.id+'" value="'+(isPlayed?p.golVisitante:0)+'" min="0" style="width:50px;height:36px;background:var(--bg-3);border:2px solid rgba(240,180,41,.3);border-radius:6px;color:var(--gold);font-family:var(--fd);font-size:1.3rem;text-align:center;outline:none">'+
        '<span style="font-family:var(--fc);font-size:.65rem;color:var(--g3);text-transform:uppercase;letter-spacing:1px">'+( v.abrev||'V')+'</span>'+
        '<input type="date" id="er-fecha-'+p.id+'" value="'+(p.fecha||'')+'" style="background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:#fff;font-size:.76rem;padding:5px 8px;outline:none">'+
        '<input type="text" id="er-jornada-'+p.id+'" value="'+(p.jornada||'')+'" placeholder="Jornada" style="width:80px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:#fff;font-size:.76rem;padding:5px 8px;outline:none">'+
        '<button class="btn btn-gold btn-xs" onclick="saveAdminResult(\''+p.id+'\')">GUARDAR</button>'+
        '<button class="btn btn-ghost btn-xs" onclick="toggleEditRow(\''+p.id+'\')">CANCELAR</button>'+
        (isPlayed?'<button class="del-btn" onclick="clearAdminResult(\''+p.id+'\')" style="margin-left:auto">LIMPIAR RESULTADO</button>':'')+
      '</div>'+
      '<div style="margin-top:.5rem;display:flex;align-items:center;gap:.5rem">'+
        '<span style="font-family:var(--fc);font-size:.65rem;color:var(--g3)">HORA:</span>'+
        '<input type="time" id="er-hora-'+p.id+'" value="'+(p.hora||'')+'" style="background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:#fff;font-size:.76rem;padding:5px 8px;outline:none">'+
        '<span style="font-family:var(--fc);font-size:.65rem;color:var(--g3)">NOTA:</span>'+
        '<input type="text" id="er-nota-'+p.id+'" value="'+(p.nota||'')+'" placeholder="Sala, plataforma..." style="flex:1;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:#fff;font-size:.76rem;padding:5px 8px;outline:none">'+
      '</div>'+
    '</div>';

    return '<div style="background:'+statusColor+';border:1px solid var(--border);border-radius:8px;margin-bottom:.5rem;display:grid;grid-template-columns:auto 1fr auto 1fr auto;align-items:center;gap:.5rem;padding:.55rem .8rem;position:relative">'+
      statusLabel+
      '<div style="display:flex;align-items:center;gap:5px">'+
        '<div style="width:20px;height:20px;background:#fff;border-radius:3px;padding:1px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+logoHtml(l.logo,14)+'</div>'+
        '<span style="font-family:var(--fc);font-size:.78rem;color:#fff;font-weight:700">'+(l.abrev||l.nombre||'?')+'</span>'+
      '</div>'+
      '<div style="text-align:center">'+resultText+(p.jornada?'<div style="font-size:.6rem;color:var(--g3);margin-top:2px">'+p.jornada+'</div>':'')+'</div>'+
      '<div style="display:flex;align-items:center;gap:5px">'+
        '<span style="font-family:var(--fc);font-size:.78rem;color:#fff;font-weight:700">'+(v.abrev||v.nombre||'?')+'</span>'+
        '<div style="width:20px;height:20px;background:#fff;border-radius:3px;padding:1px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+logoHtml(v.logo,14)+'</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:.3rem;flex-shrink:0">'+
        '<span style="font-size:.6rem;color:var(--g3)">'+fmtDate(p.fecha)+'</span>'+
        '<button class="mact-btn '+(isPlayed?'result':'sched')+'" onclick="toggleEditRow(\''+p.id+'\')" style="padding:3px 8px;font-size:.6rem">'+(isPlayed?'EDITAR':'RESULTADO')+'</button>'+
        '<button class="del-btn" onclick="delPartido(\''+p.id+'\')">X</button>'+
      '</div>'+
      editRow+
    '</div>';
  }).join('');
}

function toggleEditRow(id){
  var row=document.getElementById('editrow-'+id); if(!row) return;
  row.style.display=row.style.display==='none'?'block':'none';
}

async function saveAdminResult(id){
  var glEl=document.getElementById('er-gl-'+id);
  var gvEl=document.getElementById('er-gv-'+id);
  var fechaEl=document.getElementById('er-fecha-'+id);
  var jorEl=document.getElementById('er-jornada-'+id);
  var horaEl=document.getElementById('er-hora-'+id);
  var notaEl=document.getElementById('er-nota-'+id);
  var upd={};
  if(glEl&&gvEl){
    upd.golLocal=parseInt(glEl.value)||0;
    upd.golVisitante=parseInt(gvEl.value)||0;
  }
  if(fechaEl) upd.fecha=fechaEl.value||null;
  if(jorEl) upd.jornada=jorEl.value||null;
  if(horaEl) upd.hora=horaEl.value||null;
  if(notaEl) upd.nota=notaEl.value||null;
  await fbUpdate(R('liga/partidos_primera/'+id),upd);
  // update local cache
  var idx=_adminMatchesData.findIndex(function(x){return x.id===id;});
  if(idx>=0) Object.assign(_adminMatchesData[idx],upd);
  _jornadasData=_jornadasData.map(function(p){return p.id===id?Object.assign({},p,upd):p;});
  var tw=document.getElementById('tabla1Wrap'); if(tw) delete tw.dataset.loaded;
  renderAdminMatches();
  if(_curSection==='jornadas') applyJornadaFilter();
  toast('Partido actualizado');
}

async function clearAdminResult(id){
  if(!confirm('Quitar el resultado de este partido? Quedara como Programado.')) return;
  var upd={golLocal:null,golVisitante:null};
  await fbUpdate(R('liga/partidos_primera/'+id),upd);
  var idx=_adminMatchesData.findIndex(function(x){return x.id===id;});
  if(idx>=0){ delete _adminMatchesData[idx].golLocal; delete _adminMatchesData[idx].golVisitante; }
  _jornadasData=_jornadasData.map(function(p){ if(p.id===id){ var np=Object.assign({},p); delete np.golLocal; delete np.golVisitante; return np; } return p; });
  var tw=document.getElementById('tabla1Wrap'); if(tw) delete tw.dataset.loaded;
  renderAdminMatches();
  if(_curSection==='jornadas') applyJornadaFilter();
  toast('Resultado limpiado');
}

async function addPartido(){
  var lId=document.getElementById('pLocal') ? document.getElementById('pLocal').value : '';
  var vId=document.getElementById('pVisitante') ? document.getElementById('pVisitante').value : '';
  if(!lId||!vId) return toast('Selecciona ambos equipos','err');
  if(lId===vId) return toast('Local y visitante no pueden ser iguales','err');
  var eqs=await getEquipos(); var l=eqs[lId]||{}; var v=eqs[vId]||{};
  var hora=document.getElementById('pHora') ? document.getElementById('pHora').value : '';
  var nota=document.getElementById('pNota') ? document.getElementById('pNota').value.trim() : '';
  await fbPush(R('liga/partidos_primera'),{
    localId:lId, visitanteId:vId, local:l.nombre||l.abrev||'', visitante:v.nombre||v.abrev||'',
    fecha:document.getElementById('pFecha') ? document.getElementById('pFecha').value : new Date().toISOString().slice(0,10),
    hora:hora||null,
    jornada:document.getElementById('pJornada') ? document.getElementById('pJornada').value : '',
    nota:nota||null
  });
  _jornadasData=[];
  if(_curSection==='jornadas') loadJornadas();
  loadAdminMatches(); toast('Partido programado correctamente');
}

async function delPartido(id){
  if(!confirm('Eliminar este partido?')) return;
  await R('liga/partidos_primera/'+id).remove();
  _adminMatchesData=_adminMatchesData.filter(function(x){return x.id!==id;});
  _jornadasData=_jornadasData.filter(function(x){return x.id!==id;});
  renderAdminMatches();
  if(_curSection==='jornadas') applyJornadaFilter();
  toast('Partido eliminado');
}

/* ADMIN STATS */
async function loadAdminStats(){
  var results=await Promise.all([
    fbGet(R('liga/goleadores')),fbGet(R('liga/asistencias')),fbGet(R('liga/cleansheets')),
    getEquipos(),fbGet(R('bot/fichajes')),fbGet(R('usuarios')),fbGet(R('bot/cuentas'))
  ]);
  var g=results[0],a=results[1],c=results[2],eqs=results[3],fichajes=results[4],usuarios=results[5],cuentas=results[6];
  window._adminFichajes=fichajes||{}; window._adminUsuarios=usuarios||{}; window._adminCuentas=cuentas||{};
  window._adminEqs=eqs;
  var discToUid={};
  if(cuentas) Object.entries(cuentas).forEach(function(e){discToUid[e[0]]=e[1].webUid;});
  var eqList=Object.values(eqs);
  window._adminEqPlayers={};
  if(fichajes) Object.entries(fichajes).forEach(function(e){
    var did=e[0], f=e[1];
    var uid=discToUid[did]; var u=uid&&usuarios&&usuarios[uid]?usuarios[uid]:null;
    var entry={discordId:did,discordTag:f.discordTag||did,nombre:u?u.nombre||f.discordTag||did:f.discordTag||did,webUid:uid||'',esDT:f.esDT||false,equipoRoleId:f.equipoRoleId};
    if(!window._adminEqPlayers[f.equipoRoleId]) window._adminEqPlayers[f.equipoRoleId]=[];
    window._adminEqPlayers[f.equipoRoleId].push(entry);
  });
  var eqOptsBase='<option value="">-- Equipo --</option>'+eqList.map(function(e){return '<option value="'+e.roleId+'">'+(e.abrev||e.nombre)+'</option>';}).join('');
  window._adminEqOpts=eqOptsBase;

  function rowHtml(id,nombre,discordTag,discordId,webUid,val,equipoId){
    var players=(window._adminEqPlayers[equipoId]||[]);
    var playerOpts='<option value="">-- Jugador --</option>'+players.map(function(p){
      var sel=(p.discordId===discordId||p.discordTag===discordTag||p.nombre===nombre)?' selected':'';
      return '<option value="'+p.discordId+'" data-tag="'+p.discordTag+'" data-nombre="'+p.nombre+'" data-uid="'+p.webUid+'"'+sel+'>'+p.nombre+(p.esDT?' (DT)':'')+'</option>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:auto 1fr auto auto;gap:.3rem;align-items:center;margin-bottom:.35rem;background:var(--bg-4);border:1px solid var(--border);border-radius:6px;padding:.35rem .4rem" data-id="'+id+'" data-discordid="'+(discordId||'')+'" data-tag="'+(discordTag||'')+'" data-uid="'+(webUid||'')+'">'+
      '<select class="stat-eq-sel" onchange="onStatEqChange(this)" style="background:var(--bg-3);border:1px solid var(--border);border-radius:4px;padding:3px 5px;color:#fff;font-size:.7rem;outline:none;max-width:90px">'+eqOptsBase.replace('value="'+equipoId+'"','value="'+equipoId+'" selected')+'</select>'+
      '<select class="stat-pl-sel" onchange="onStatPlayerChange(this)" style="background:var(--bg-3);border:1px solid var(--border);border-radius:4px;padding:3px 5px;color:#fff;font-size:.72rem;outline:none;min-width:0">'+playerOpts+'</select>'+
      '<input type="number" value="'+(val||0)+'" min="0" class="stat-val" style="width:46px;background:var(--bg-3);border:1px solid var(--border);border-radius:4px;padding:3px 5px;color:#fff;font-size:.78rem;text-align:center;outline:none">'+
      '<button class="del-btn" onclick="this.closest(\'[data-id]\').remove()">X</button>'+
    '</div>';
  }
  function renderSt(wrapId,data,key){
    var wrap=document.getElementById(wrapId); if(!wrap) return;
    var rows=data?Object.entries(data):[];
    wrap.innerHTML='<div id="'+wrapId+'_rows">'+rows.map(function(e){var id=e[0],x=e[1];return rowHtml(id,x.nombre||x.discordTag||'',x.discordTag||'',x.discordId||'',x._webUid||'',x[key]||0,x.equipoId||'');}).join('')+'</div>';
  }
  renderSt('aStatsGoles',g,'goles');
  renderSt('aStatsAsist',a,'asistencias');
  renderSt('aStatsCS',c,'cleansheets');
}

function onStatEqChange(sel){
  var row=sel.closest('[data-id]'); if(!row) return;
  var plSel=row.querySelector('.stat-pl-sel'); if(!plSel) return;
  var players=(window._adminEqPlayers[sel.value]||[]);
  plSel.innerHTML='<option value="">-- Jugador --</option>'+players.map(function(p){return '<option value="'+p.discordId+'" data-tag="'+p.discordTag+'" data-nombre="'+p.nombre+'" data-uid="'+p.webUid+'">'+p.nombre+(p.esDT?' (DT)':'')+'</option>';}).join('');
  row.dataset.discordid=''; row.dataset.tag=''; row.dataset.uid='';
}
function onStatPlayerChange(sel){
  var row=sel.closest('[data-id]'); if(!row) return;
  var opt=sel.options[sel.selectedIndex];
  row.dataset.discordid=sel.value||''; row.dataset.tag=opt.dataset.tag||''; row.dataset.uid=opt.dataset.uid||'';
}
function addStatsRow(section){
  var idMap={goleadores:'aStatsGoles',asistencias:'aStatsAsist',cleansheets:'aStatsCS'};
  var wrapId=idMap[section];
  var wrap=document.getElementById(wrapId+'_rows')||document.getElementById(wrapId); if(!wrap) return;
  var eqList=Object.values(window._adminEqs||{});
  var eqOpts='<option value="">-- Equipo --</option>'+eqList.map(function(e){return '<option value="'+e.roleId+'">'+(e.abrev||e.nombre)+'</option>';}).join('');
  var div=document.createElement('div');
  div.style.cssText='display:grid;grid-template-columns:auto 1fr auto auto;gap:.3rem;align-items:center;margin-bottom:.35rem;background:var(--bg-4);border:1px solid var(--border);border-radius:6px;padding:.35rem .4rem';
  div.dataset.id='new_'+Date.now(); div.dataset.discordid=''; div.dataset.tag=''; div.dataset.uid='';
  div.innerHTML=
    '<select class="stat-eq-sel" onchange="onStatEqChange(this)" style="background:var(--bg-3);border:1px solid var(--border);border-radius:4px;padding:3px 5px;color:#fff;font-size:.7rem;outline:none;max-width:90px">'+eqOpts+'</select>'+
    '<select class="stat-pl-sel" onchange="onStatPlayerChange(this)" style="background:var(--bg-3);border:1px solid var(--border);border-radius:4px;padding:3px 5px;color:#fff;font-size:.72rem;outline:none;min-width:0"><option value="">- Equipo primero -</option></select>'+
    '<input type="number" value="0" min="0" class="stat-val" style="width:46px;background:var(--bg-3);border:1px solid var(--border);border-radius:4px;padding:3px 5px;color:#fff;font-size:.78rem;text-align:center;outline:none">'+
    '<button class="del-btn" onclick="this.closest(\'[data-id]\').remove()">X</button>';
  wrap.appendChild(div);
}
async function saveAllStats(){
  var eqs=window._adminEqs||await getEquipos();
  function collectRows(wrapId,key){
    var wrap=document.getElementById(wrapId); if(!wrap) return {};
    var obj={};
    wrap.querySelectorAll('[data-id]').forEach(function(row){
      var eqSel=row.querySelector('.stat-eq-sel'); var plSel=row.querySelector('.stat-pl-sel'); var valInp=row.querySelector('.stat-val');
      var equipoId=eqSel?eqSel.value:''; var discordId=row.dataset.discordid||( plSel?plSel.value:''); var val=parseInt(valInp?valInp.value:0)||0;
      if(!equipoId||!discordId||val<=0) return;
      var plOpt=plSel?plSel.options[plSel.selectedIndex]:null;
      var nombre=plOpt?plOpt.dataset.nombre||plOpt.text||discordId:discordId;
      var discordTag=row.dataset.tag||(plOpt?plOpt.dataset.tag||nombre:nombre);
      var webUid=row.dataset.uid||(plOpt?plOpt.dataset.uid||'':'');
      var rawId=row.dataset.id;
      var id=rawId.startsWith('new_')?'p_'+Date.now()+'_'+Math.random().toString(36).slice(2,7):rawId;
      var eq=eqs[equipoId]||{};
      obj[id]={nombre:nombre,discordTag:discordTag,discordId:discordId,[key]:val,equipoId:equipoId,teamLogo:eq.logo||'',teamAbrev:eq.abrev||eq.nombre||''};
    });
    return obj;
  }
  await Promise.all([
    fbSet(R('liga/goleadores'),collectRows('aStatsGoles','goles')),
    fbSet(R('liga/asistencias'),collectRows('aStatsAsist','asistencias')),
    fbSet(R('liga/cleansheets'),collectRows('aStatsCS','cleansheets'))
  ]);
  ['statsGoles','statsAsist','statsCS'].forEach(function(id){ var el=document.getElementById(id); if(el) delete el.dataset.loaded; });
  window._globalIdentityLoaded=false;
  await loadAdminStats(); toast('Stats guardadas');
}

/* helpers equipo->jugador */
function _buildPlayerOpts(equipoId, selectId){
  var players=(window._adminEqPlayers||{})[equipoId]||[];
  var sel=document.getElementById(selectId); if(!sel) return;
  if(!players.length){ sel.innerHTML='<option value="">- Sin jugadores -</option>'; return; }
  sel.innerHTML='<option value="">- Elige jugador -</option>'+players.map(function(p){
    var av=(window._adminUsuarios||{})[p.webUid] ? (window._adminUsuarios[p.webUid].avatar||'') : '';
    return '<option value="'+p.discordId+'" data-tag="'+p.discordTag+'" data-nombre="'+p.nombre+'" data-uid="'+p.webUid+'" data-av="'+av+'">'+p.nombre+(p.esDT?' (DT)':'')+'</option>';
  }).join('');
}
function _showPlayerPreview(selId,previewId,nombreId,tagId,avId){
  var sel=document.getElementById(selId); var preview=document.getElementById(previewId);
  if(!sel||!preview) return;
  if(!sel.value){ preview.style.display='none'; return; }
  var opt=sel.options[sel.selectedIndex];
  var nombre=opt.dataset.nombre||opt.text||sel.value;
  var tag=opt.dataset.tag||''; var av=opt.dataset.av||'';
  var defaultAv=avatarDefault(nombre);
  preview.style.display='flex';
  var avEl=document.getElementById(avId); if(avEl){ avEl.src=av||defaultAv; avEl.onerror=function(){avEl.src=defaultAv;}; }
  var nEl=document.getElementById(nombreId); if(nEl) nEl.textContent=nombre;
  var tEl=document.getElementById(tagId); if(tEl) tEl.textContent=tag?tag:'';
}
function onTarjetaEqChange(sel){ _buildPlayerOpts(sel.value,'tJugadorSelect'); document.getElementById('tJugadorPreview').style.display='none'; }
function onTarjetaPlayerChange(sel){ _showPlayerPreview('tJugadorSelect','tJugadorPreview','tJugadorNombre','tJugadorTag','tJugadorAv'); }
function onSancionEqChange(sel){ _buildPlayerOpts(sel.value,'sJugadorSelect'); document.getElementById('sJugadorPreview').style.display='none'; }
function onSancionPlayerChange(sel){ _showPlayerPreview('sJugadorSelect','sJugadorPreview','sJugadorNombre','sJugadorTag','sJugadorAv'); }

/* ADMIN TARJETAS */
async function addTarjeta(){
  var eqSel=document.getElementById('tEquipo'); var plSel=document.getElementById('tJugadorSelect');
  var equipoId=eqSel?eqSel.value:''; var discordId=plSel?plSel.value:'';
  if(!equipoId) return toast('Selecciona el equipo','err');
  if(!discordId) return toast('Selecciona el jugador','err');
  var plOpt=plSel.options[plSel.selectedIndex];
  var discordTag=plOpt.dataset.tag||plOpt.text||discordId;
  var jugador=plOpt.dataset.nombre||discordTag;
  await fbPush(R('liga/tarjetas'),{jugador:jugador,discordTag:discordTag,discordId:discordId,equipoId:equipoId,
    tipo:document.getElementById('tTipo')?document.getElementById('tTipo').value:'yellow',
    fecha:document.getElementById('tFecha')?document.getElementById('tFecha').value:'',
    motivo:document.getElementById('tMotivo')?document.getElementById('tMotivo').value:''});
  eqSel.value=''; plSel.innerHTML='<option value="">- Equipo primero -</option>';
  document.getElementById('tJugadorPreview').style.display='none';
  var tm=document.getElementById('tMotivo'); if(tm) tm.value='';
  loadAdminTarjetas();
  var ta=document.getElementById('tarjetasAmaril'); if(ta) delete ta.dataset.loaded;
  toast('Tarjeta agregada');
}
async function loadAdminTarjetas(){
  var wrap=document.getElementById('adminTarjList'); if(!wrap) return;
  var results=await Promise.all([fbGet(R('liga/tarjetas')),getEquipos()]);
  var tarjetas=results[0], eqs=results[1];
  if(!tarjetas){ wrap.innerHTML='<div class="empty"><p>SIN TARJETAS</p></div>'; return; }
  var eqMap={}; Object.values(eqs).forEach(function(e){eqMap[e.roleId]=e;});
  var arr=Object.entries(tarjetas).map(function(e){return Object.assign({id:e[0]},e[1]);});
  wrap.innerHTML='<div style="display:flex;flex-direction:column;gap:.4rem">'+arr.map(function(t){
    var eq=eqMap[t.equipoId]||{};
    return '<div class="match-list-item">'+
      '<span style="font-size:.7rem">'+(t.tipo==='yellow'?'A':'R')+' <b>'+(t.jugador||t.discordTag)+'</b></span>'+
      (t.discordTag&&t.discordTag!==t.jugador?'<span style="font-size:.63rem;color:#7289da">'+t.discordTag+'</span>':'')+
      '<span style="font-size:.66rem;color:var(--g3)">'+(eq.abrev||'')+'</span>'+
      '<span style="font-size:.66rem;color:var(--g3)">'+fmtDate(t.fecha)+'</span>'+
      '<button class="del-btn" onclick="delTarjeta(\''+t.id+'\')">X</button>'+
    '</div>';
  }).join('')+'</div>';
}
async function delTarjeta(id){ await R('liga/tarjetas/'+id).remove(); loadAdminTarjetas(); toast('Tarjeta eliminada'); }

/* ADMIN SANCIONES */
async function addSancion(){
  var eqSel=document.getElementById('sEquipo'); var plSel=document.getElementById('sJugadorSelect');
  var equipoId=eqSel?eqSel.value:''; var discordId=plSel?plSel.value:'';
  if(!equipoId) return toast('Selecciona el equipo','err');
  if(!discordId) return toast('Selecciona el jugador','err');
  var plOpt=plSel.options[plSel.selectedIndex];
  var discordTag=plOpt.dataset.tag||plOpt.text||discordId;
  var jugador=plOpt.dataset.nombre||discordTag;
  await fbPush(R('liga/sanciones'),{jugador:jugador,discordTag:discordTag,discordId:discordId,equipoId:equipoId,
    tipo:document.getElementById('sTipo')?document.getElementById('sTipo').value:'warning',
    partidos:parseInt(document.getElementById('sPartidos')?document.getElementById('sPartidos').value:0)||0,
    motivo:document.getElementById('sMotivo')?document.getElementById('sMotivo').value:'',
    fecha:document.getElementById('sFecha')?document.getElementById('sFecha').value:new Date().toISOString().slice(0,10)});
  eqSel.value=''; plSel.innerHTML='<option value="">- Equipo primero -</option>';
  document.getElementById('sJugadorPreview').style.display='none';
  var sm=document.getElementById('sMotivo'); if(sm) sm.value='';
  loadAdminSanciones();
  var sw=document.getElementById('sancionesWrap'); if(sw) delete sw.dataset.loaded;
  toast('Sancion aplicada');
}
async function loadAdminSanciones(){
  var wrap=document.getElementById('adminSancionesList'); if(!wrap) return;
  var data=await fbGet(R('liga/sanciones'));
  if(!data){ wrap.innerHTML='<div class="empty"><p>SIN SANCIONES</p></div>'; return; }
  var arr=Object.entries(data).map(function(e){return Object.assign({id:e[0]},e[1]);});
  wrap.innerHTML=arr.map(function(s){
    return '<div class="match-list-item">'+
      '<span style="font-size:.7rem"><b>'+(s.jugador||s.discordTag)+'</b></span>'+
      (s.discordTag&&s.discordTag!==s.jugador?'<span style="font-size:.63rem;color:#7289da">'+s.discordTag+'</span>':'')+
      '<span class="sancion-type '+(s.tipo||'warning')+'" style="font-size:.6rem">'+(s.tipo||'').toUpperCase()+'</span>'+
      '<span style="font-size:.66rem;color:var(--g3)">'+(s.motivo||'')+'</span>'+
      '<button class="del-btn" onclick="delSancion(\''+s.id+'\')">X</button>'+
    '</div>';
  }).join('');
}
async function delSancion(id){ await R('liga/sanciones/'+id).remove(); loadAdminSanciones(); toast('Sancion eliminada'); }

/* ADMIN NOTICIAS */
async function loadAdminNoticias(){
  var wrap=document.getElementById('adminNoticiasList'); if(!wrap) return;
  var data=await fbGet(R('liga/noticias'));
  if(!data){ wrap.innerHTML='<div class="empty"><p>SIN NOTICIAS</p></div>'; return; }
  var arr=Object.entries(data).map(function(e){return Object.assign({id:e[0]},e[1]);}).sort(function(a,b){return new Date(b.fecha||0)-new Date(a.fecha||0);});
  wrap.innerHTML=arr.map(function(n){
    return '<div class="noticia-row">'+
      '<div class="noticia-row-head"><span>'+(n.titulo||'Sin titulo')+'</span>'+
      '<div style="display:flex;gap:.4rem">'+
        '<button class="btn btn-ghost btn-xs" onclick="editNoticia(\''+n.id+'\')">EDITAR</button>'+
        '<button class="btn btn-danger btn-xs" onclick="delNoticia(\''+n.id+'\')">X</button>'+
      '</div></div>'+
      '<div style="font-size:.72rem;color:var(--g3)">'+(n.tag||'')+' - '+fmtDate(n.fecha)+'</div>'+
    '</div>';
  }).join('');
}
function addNoticiaForm(data){
  data=data||{};
  var wrap=document.getElementById('newNoticiaForm'); if(!wrap) return;
  var id=data.id||null;
  wrap.innerHTML='<div class="noticia-row">'+
    '<div class="form-group"><label>Titulo</label><input type="text" id="nTitulo" value="'+(data.titulo||'')+'"></div>'+
    '<div class="form-group"><label>Extracto</label><textarea id="nExtracto">'+(data.extracto||'')+'</textarea></div>'+
    '<div class="form-row">'+
      '<div class="form-group"><label>Tag</label><input type="text" id="nTag" value="'+(data.tag||'NOTICIAS')+'"></div>'+
      '<div class="form-group"><label>Fecha</label><input type="date" id="nFecha" value="'+(data.fecha||new Date().toISOString().slice(0,10))+'"></div>'+
    '</div>'+
    '<div class="form-group"><label>Imagen URL</label><input type="text" id="nImagen" placeholder="https://..." value="'+(data.imagen||'')+'"></div>'+
    '<div class="form-group"><label>Link externo</label><input type="text" id="nLink" placeholder="https://..." value="'+(data.link||'')+'"></div>'+
    '<div style="display:flex;gap:.5rem">'+
      '<button class="btn btn-gold" onclick="saveNoticia('+(id?'\''+id+'\'':'null')+')">'+( id?'ACTUALIZAR':'PUBLICAR')+' NOTICIA</button>'+
      '<button class="btn btn-ghost" onclick="document.getElementById(\'newNoticiaForm\').innerHTML=\'\'">CANCELAR</button>'+
    '</div>'+
  '</div>';
}
async function editNoticia(id){ var d=await fbGet(R('liga/noticias/'+id)); if(d) addNoticiaForm(Object.assign({id:id},d)); }
async function saveNoticia(id){
  var obj={
    titulo:document.getElementById('nTitulo')?document.getElementById('nTitulo').value:'',
    extracto:document.getElementById('nExtracto')?document.getElementById('nExtracto').value:'',
    tag:document.getElementById('nTag')?document.getElementById('nTag').value:'NOTICIAS',
    fecha:document.getElementById('nFecha')?document.getElementById('nFecha').value:'',
    imagen:document.getElementById('nImagen')?document.getElementById('nImagen').value:'',
    link:document.getElementById('nLink')?document.getElementById('nLink').value:''
  };
  if(id) await fbUpdate(R('liga/noticias/'+id),obj); else await fbPush(R('liga/noticias'),obj);
  document.getElementById('newNoticiaForm').innerHTML='';
  loadAdminNoticias();
  var nw=document.getElementById('noticiasList'); if(nw) delete nw.dataset.loaded;
  toast(id?'Noticia actualizada':'Noticia publicada');
}
async function delNoticia(id){ if(!confirm('Eliminar noticia?')) return; await R('liga/noticias/'+id).remove(); loadAdminNoticias(); toast('Eliminada'); }

/* ADMIN CUENTAS */
async function loadAdminCuentas(){
  var wrap=document.getElementById('adminCuentasList'); if(!wrap) return;
  var results=await Promise.all([fbGet(R('usuarios')),fbGet(R('bot/cuentas'))]);
  var usuarios=results[0], cuentas=results[1];
  if(!usuarios){ wrap.innerHTML='<div class="empty"><p>SIN CUENTAS REGISTRADAS</p></div>'; return; }
  var discMap={};
  if(cuentas) Object.entries(cuentas).forEach(function(e){ discMap[e[1].webUid]={discordId:e[0],discordTag:e[1].discordTag||''}; });
  var arr=Object.entries(usuarios).map(function(e){return Object.assign({uid:e[0]},e[1],{discordLink:discMap[e[0]]});});
  wrap.innerHTML=arr.map(function(u){
    var av=u.avatar||avatarDefault(u.nombre||'?');
    var disc=u.discordLink; var blocked=u.blocked;
    return '<div class="cuenta-admin-item '+(blocked?'cuenta-blocked':'')+'">'+
      '<img class="cuenta-admin-av" src="'+av+'" onerror="this.src=\''+avatarDefault(u.nombre||'?')+'\'" alt="">'+
      '<div class="cuenta-admin-info">'+
        '<div class="cuenta-admin-name">'+(u.nombre||'Sin nombre')+
          (disc?'<span class="cuenta-admin-badge">'+( disc.discordTag||disc.discordId)+'</span>':'<span style="font-size:.6rem;color:var(--g3);margin-left:5px">Sin vincular</span>')+
          (blocked?'<span style="font-size:.6rem;color:#F87171;margin-left:5px">BLOQUEADA</span>':'')+
        '</div>'+
        '<div class="cuenta-admin-meta">'+(u.email||'')+' - Creada '+fmtDate(u.createdAt)+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:.4rem;flex-shrink:0;flex-wrap:wrap">'+
        '<button class="btn btn-ghost btn-xs" onclick="toggleBlockCuenta(\''+u.uid+'\','+(!!blocked)+')">'+(blocked?'DESBLOQUEAR':'BLOQUEAR')+'</button>'+
        '<button class="btn btn-danger btn-xs" onclick="deleteCuenta(\''+u.uid+'\')">ELIMINAR</button>'+
      '</div>'+
    '</div>';
  }).join('');
}
async function toggleBlockCuenta(uid,blocked){
  await fbUpdate(R('usuarios/'+uid),{blocked:!blocked});
  toast(blocked?'Cuenta desbloqueada':'Cuenta bloqueada'); loadAdminCuentas();
}
async function deleteCuenta(uid){
  if(!confirm('Eliminar esta cuenta permanentemente?')) return;
  await R('usuarios/'+uid).remove();
  var cuentas=await fbGet(R('bot/cuentas'));
  if(cuentas){
    for(var did in cuentas){ if(cuentas[did].webUid===uid) await R('bot/cuentas/'+did).remove(); }
  }
  invalidateEquiposCache(); window._globalIdentityLoaded=false;
  loadAdminCuentas(); toast('Cuenta eliminada');
}

/* ADMIN ANUNCIOS */
async function sendAnuncio(){
  var titulo=document.getElementById('aTitulo')?document.getElementById('aTitulo').value.trim():'';
  var texto=document.getElementById('aTexto')?document.getElementById('aTexto').value.trim():'';
  if(!titulo||!texto) return toast('Completa titulo y mensaje','err');
  await fbPush(R('bot/anuncios'),{titulo:titulo,texto:texto,fecha:new Date().toISOString(),enviado:false});
  document.getElementById('aTitulo').value=''; document.getElementById('aTexto').value='';
  toast('Anuncio enviado al bot');
}

/* SUPERADMIN */
async function loadAdminsList(){
  var wrap=document.getElementById('adminsList'); if(!wrap) return;
  var admins=await fbGet(R('admins'));
  if(!admins){ wrap.innerHTML='<div class="empty"><p>SIN ADMINS CONFIGURADOS</p></div>'; return; }
  var usuarios=await fbGet(R('usuarios'));
  wrap.innerHTML=Object.entries(admins).map(function(e){
    var uid=e[0], a=e[1];
    var u=usuarios && usuarios[uid] ? usuarios[uid] : {};
    var roleLabels={superadmin:'Superadmin',admin:'Admin',dt:'DT'};
    return '<div class="cuenta-admin-item">'+
      '<img class="cuenta-admin-av" src="'+(u.avatar||avatarDefault(u.nombre||uid))+'" onerror="this.src=\''+avatarDefault(uid)+'\'" alt="">'+
      '<div class="cuenta-admin-info">'+
        '<div class="cuenta-admin-name">'+(u.nombre||'Sin nombre')+
          '<span class="cuenta-admin-badge">'+(roleLabels[a.role]||a.role)+'</span>'+
        '</div>'+
        '<div class="cuenta-admin-meta">'+(u.email||uid)+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:.4rem;flex-shrink:0">'+
        '<select onchange="changeAdminRole(\''+uid+'\',this.value)" style="background:var(--bg-3);border:1px solid var(--border);border-radius:4px;padding:3px 8px;color:#fff;font-size:.7rem;outline:none">'+
          '<option value="admin" '+(a.role==='admin'?'selected':'')+'>Admin</option>'+
          '<option value="superadmin" '+(a.role==='superadmin'?'selected':'')+'>Superadmin</option>'+
          '<option value="dt" '+(a.role==='dt'?'selected':'')+'>DT</option>'+
        '</select>'+
        '<button class="btn btn-danger btn-xs" onclick="removeAdmin(\''+uid+'\')">X</button>'+
      '</div>'+
    '</div>';
  }).join('');
}
async function addAdminByEmail(){
  if(window._adminRole!=='superadmin') return toast('Solo el superadmin puede hacer esto','err');
  var email=document.getElementById('saEmail')?document.getElementById('saEmail').value.trim().toLowerCase():'';
  var rol=document.getElementById('saRol')?document.getElementById('saRol').value:'admin';
  if(!email) return toast('Escribe el email','err');
  var usuarios=await fbGet(R('usuarios'));
  if(!usuarios) return toast('No hay usuarios registrados','err');
  var found=null;
  Object.entries(usuarios).forEach(function(e){ if((e[1].email||'').toLowerCase()===email) found=e; });
  if(!found) return toast('No se encontro ninguna cuenta con ese email','err',4000);
  var uid=found[0];
  await fbSet(R('admins/'+uid),{role:rol,email:email,nombre:found[1].nombre||email,fecha:new Date().toISOString()});
  if(document.getElementById('saEmail')) document.getElementById('saEmail').value='';
  loadAdminsList(); toast('Admin ('+rol+') agregado');
}
async function changeAdminRole(uid,newRole){
  if(window._adminRole!=='superadmin') return;
  await fbUpdate(R('admins/'+uid),{role:newRole}); toast('Rol actualizado');
}
async function removeAdmin(uid){
  if(window._adminRole!=='superadmin') return toast('Solo el superadmin puede hacer esto','err');
  if(!confirm('Quitar permisos de admin?')) return;
  await R('admins/'+uid).remove();
  loadAdminsList();
  toast('Admin eliminado');
}

/* ══ INIT ══ */
(async function(){
  revealAll();
  loadHeroStats();
  loadHomeNoticias();
  setTimeout(function(){
    var active = document.querySelector('.nav-btn.active');
    if(active) moveSlider(active);
  }, 100);
})();
