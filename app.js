(function () {
  // Robust starten: erst nach DOM-Ready loslegen
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    const v = document.getElementById('view');
    const byId = id => document.getElementById(id);
    if (!v) {
      console.error('TimeMate JW: #view nicht gefunden. Stelle sicher, dass das HTML geladen ist und ein <div id="view"></div> vorhanden ist.');
      return;
    }

    // ====== Konstanten / Kategorien ======
    const CAT_GMA = 'Genossenschaft Migros Aare';
    const CAT_UNCAT = 'Unkategorisiert';

    // Gemeinsame Kategorienliste (Termine & Aufgaben)
    const DEFAULT_CATS = [
      { key: 'Spitex Heitersberg', css: 'Spitex' },
      { key: 'Psychologin / Therapie', css: 'Psych' },
      { key: 'Töpferhaus', css: 'Töpferhaus' },
      { key: CAT_GMA, css: 'Geschäftlich' }, // ehemals "Geschäftlich"
      { key: 'Administrativ', css: 'Administrativ' },
      { key: 'Privat', css: 'Privat' },
      { key: 'HKV Aarau', css: 'HKV' },
      { key: 'Persönlich', css: 'HKV' }
    ];

    let CATS_ALL = JSON.parse(localStorage.getItem('tmjw_cats_all') || 'null') || DEFAULT_CATS;
    const saveCats = () => localStorage.setItem('tmjw_cats_all', JSON.stringify(CATS_ALL));

    // ====== Migration (zusammenführen & "Geschäftlich" → GMA) ======
    (function migrateOnce(){
      const term = JSON.parse(localStorage.getItem('tmjw_cats_term') || 'null');
      const task = JSON.parse(localStorage.getItem('tmjw_cats_task') || 'null');
      if(term || task){
        const map = new Map(DEFAULT_CATS.map(c=>[c.key,c]));
        (term||[]).forEach(c=>map.set(c.key, c));
        (task||[]).forEach(c=>map.set(c.key, c));
        CATS_ALL = Array.from(map.values());
        saveCats();
        localStorage.removeItem('tmjw_cats_term');
        localStorage.removeItem('tmjw_cats_task');
      }
      const key='tmjw_mig_gma_v2';
      if(localStorage.getItem(key)) return;
      let cc = JSON.parse(localStorage.getItem('tmjw_contacts')||'[]');
      cc = cc.map(c => c.kategorie==='Geschäftlich' ? {...c, kategorie: CAT_GMA} : c);
      localStorage.setItem('tmjw_contacts', JSON.stringify(cc));
      let items = JSON.parse(localStorage.getItem('tmjw_state')||'[]');
      items = items.map(i => i.category==='Geschäftlich' ? {...i, category: CAT_GMA} : i);
      localStorage.setItem('tmjw_state', JSON.stringify(items));
      if (!CATS_ALL.find(c=>c.key===CAT_GMA)) CATS_ALL.push({key:CAT_GMA, css:'Geschäftlich'});
      CATS_ALL = CATS_ALL.filter(c=>c.key!=='Geschäftlich');
      saveCats();
      localStorage.setItem(key,'1');
    })();

    // ====== Kontakte / Logs / Bilder ======
    let contacts = JSON.parse(localStorage.getItem('tmjw_contacts') || '[]');
    function saveContacts(){ localStorage.setItem('tmjw_contacts', JSON.stringify(contacts)); }
    let contactLogs = JSON.parse(localStorage.getItem('tmjw_contact_logs') || '{}'); // {contactId:[{id,ts,text}]}
    function saveContactLogs(){ localStorage.setItem('tmjw_contact_logs', JSON.stringify(contactLogs)); }
    const fullName = c => `${c.vorname||''} ${c.name||''}`.trim();
    const findContactByName = n => {
      if(!n) return null; const s=String(n).trim();
      return contacts.find(c => fullName(c)===s || c.name===s || (`${c.vorname||''} ${c.name||''}`).trim().includes(s));
    };
    const getContactImageByName = n => {
      const c=findContactByName(n); return c&&c.img?c.img:null;
    };
    let catImages = JSON.parse(localStorage.getItem('tmjw_cat_images') || '{}'); // {catName:dataURL}
    const saveCatImages = () => localStorage.setItem('tmjw_cat_images', JSON.stringify(catImages));

    // ====== Theme ======
    if ((localStorage.getItem('tmjw_theme')||'light') === 'dark') document.documentElement.classList.add('dark');

    // ====== Termine Storage ======
    const state = { items: JSON.parse(localStorage.getItem('tmjw_state') || '[]') };
    const save  = () => localStorage.setItem('tmjw_state', JSON.stringify(state.items));
    const fmt = iso => new Date(iso).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
    const esc = s => String(s).replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    function autoUpdate(){
      const now=Date.now(); let ch=false;
      state.items.forEach(a=>{
        const due=new Date(a.datetime).getTime();
        if(a.status!=='archived' && now>=due && a.status!=='done'){ a.status='done'; ch=true; }
        if(a.status!=='archived' && now-due>3*24*60*60*1000){ a.status='archived'; ch=true; }
      });
      if(ch) save();
    }

    // ====== Helpers ======
    function el(tag, attrs={}, text){ const n=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v)); if(text!==undefined) n.textContent=text; return n; }
    function dataURL(file){ return new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); }); }
    function avatarStack(names){
      const wrap = el('div',{style:'display:flex;gap:4px;align-items:center;flex-wrap:wrap'});
      (Array.isArray(names)?names:[names]).forEach(n=>{
        const src=getContactImageByName(n);
        if(src){ wrap.append(el('img',{src,style:'width:22px;height:22px;border-radius:50%;object-fit:cover'})); }
      });
      return wrap;
    }
    
    // ====== Terminbestätigung (Dokument) ======
    function openConfirmDoc(item){
      try{
        const perDisp = Array.isArray(item.person) ? item.person.join(', ') : (item.person || '—');
        const dt = new Date(item.datetime || Date.now());
        const dateStr = isNaN(dt) ? (item.datetime || '—') : dt.toLocaleDateString('de-CH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
        const timeStr = isNaN(dt) ? '' : dt.toLocaleTimeString('de-CH', { hour:'2-digit', minute:'2-digit' });
        const nowStr  = new Date().toLocaleString('de-CH', { dateStyle:'medium', timeStyle:'short' });
        const attach  = (item.attachments && item.attachments.length) ? item.attachments.map(a=>a.name||'Anhang').join(', ') : '—';
        const title   = (item.title || '(ohne Titel)');
        const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Terminbestätigung – ${esc(title)}</title>
<style>
  @page { margin: 18mm; @top-center { content: none !important; } @bottom-center { content: none !important; } }
  body { font-family: -apple-system, BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#0f172a; line-height:1.45; }
  h1 { margin:0 0 6px 0; font-size:22px; }
  .meta { color:#475569; margin-bottom:10px; }
  .box { border:1px solid #e5e7eb; border-radius:12px; padding:14px; }
  .row { display:grid; grid-template-columns:160px 1fr; gap:8px; margin:6px 0; }
  .label { color:#64748b; }
  footer { margin-top:24px; font-size:12px; color:#64748b; }
  .badge { display:inline-block; border:1px solid #e5e7eb; border-radius:999px; padding:2px 8px; font-size:12px; }
  .small { font-size:12px; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { header, footer { display:none !important; } }
</style>
</head>
<body>
  <h1>Terminbestätigung</h1>
  <div class="meta">Bestätigung des folgenden Termins</div>
  <div class="box">
    <div class="row"><div class="label">Titel</div><div><strong>${esc(title)}</strong></div></div>
    <div class="row"><div class="label">Typ</div><div>${esc(item.type || 'Termin')}</div></div>
    <div class="row"><div class="label">Kategorie</div><div><span class="badge">${esc(item.category || '')}</span></div></div>
    <div class="row"><div class="label">Datum</div><div>${esc(dateStr)}${timeStr ? ' – ' + esc(timeStr) + ' Uhr' : ''}</div></div>
    <div class="row"><div class="label">Person(en)</div><div>${esc(perDisp)}</div></div>
    <div class="row"><div class="label">Standort</div><div>${esc(item.location || '—')}</div></div>
    <div class="row"><div class="label">Status</div><div>${esc(item.status || 'upcoming')}</div></div>
    <div class="row"><div class="label">Notizen</div><div>${esc(item.notes || '—')}</div></div>
    <div class="row"><div class="label">Anhänge</div><div>${esc(attach)}</div></div>
    <div class="row small"><div class="label">ID</div><div>${esc(item.id || '')}</div></div>
  </div>
  <footer>
    <div>Erstellt am ${esc(nowStr)}</div>
    <div>automatisch generiert durch TimeMate by J.w.</div>
  </footer>
  <script>setTimeout(function(){ window.print(); }, 250);</script>
</body>
</html>`;
        const ww = window.open('', '_blank');
        if(!ww){ alert('Popup blockiert – bitte Popups erlauben.'); return; }
        ww.document.open('text/html');
        ww.document.write(html);
        ww.document.close();
      }catch(e){
        console.error('Bestätigung fehlgeschlagen', e);
        alert('Konnte die Terminbestätigung nicht erzeugen.');
      }
    }

    function route(name,arg){
      document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.toggle('active', b.dataset.route===name));
      if(name==='overview') return ov();
      if(name==='new')      return form(arg);
      if(name==='list')     return listView();   // Tab-Text wird zu "Termine"
      if(name==='tasks')    return tasksView();
      if(name==='archive')  return arch();
      if(name==='settings') return settings();
      if(name==='contacts') return contactsView();
    }

    // Tabs anpassen
    (function adjustTabs(){
      const nav=document.querySelector('.tabs');
      if(!nav) return;
      if(!nav.querySelector('[data-route="contacts"]')){
        const btn=el('button',{class:'tab','data-route':'contacts',type:'button'},'Kontakte');
        btn.addEventListener('click',()=>route('contacts'));
        nav.appendChild(btn);
      }
      const archBtn=[...nav.querySelectorAll('.tab')].find(b=>b.dataset.route==='archive');
      if(archBtn) archBtn.remove();
      const listBtn=[...nav.querySelectorAll('.tab')].find(b=>b.dataset.route==='list');
      if(listBtn) listBtn.textContent='Termine';
    })();

    // ====== Seed-Kontakte (nur falls fehlen) ======
    (function seedContactsOnce(){
      const key='tmjw_seed_contacts_v3';
      if(localStorage.getItem(key)) return;
      const addIfMissing=(vorname,name,kategorie)=>{
        if(!contacts.some(c=>c.vorname===vorname && c.name===name && c.kategorie===kategorie)){
          contacts.push({ id:String(Date.now()+Math.random()), vorname, name, kategorie, funktion:'', notizen:'', telefon:'', email:'', img:''});
        }
      };
      ['Aleks','Alina','Mama','Papa','Luana','Yulio'].forEach(n=>addIfMissing('',n,'Privat'));
      addIfMissing('F.','Völki','Spitex Heitersberg'); addIfMissing('A.','Rudgers','Spitex Heitersberg');
      addIfMissing('Domenique','Hürzeler','Töpferhaus'); addIfMissing('Jeanine','Haygis','Töpferhaus'); addIfMissing('Sandra','Schriber','Töpferhaus');
      ['Beatriz Häsler','Helena Huser','Jasmin Widmer','Linda Flückiger','Mathias Tomaske','Svenja Studer'].forEach(n=>{ const [v,...r]=n.split(' '); addIfMissing(v,r.join(' '),CAT_GMA); });
      ['Berat Aliu','Ellen Ricciardella','Gabriela Hirt','Kristina Brütsch','Rinor Aslani'].forEach(n=>{ const [v,...r]=n.split(' '); addIfMissing(v,r.join(' '),'HKV Aarau'); });
      saveContacts(); localStorage.setItem(key,'1');
    })();

    // ====== IndexedDB (Anhänge) ======
    const DB='tmjw_files', STORE='files'; let dbp;
    function db(){ if(dbp) return dbp; dbp=new Promise((res,rej)=>{const r=indexedDB.open(DB,1); r.onupgradeneeded=e=>e.target.result.createObjectStore(STORE); r.onsuccess=e=>res(e.target.result); r.onerror=e=>rej(e);}); return dbp; }

    // ====== Übersicht ======
    function ov(){
      autoUpdate(); v.innerHTML='';
      const wrap=el('section');
      wrap.append(el('h2',{},'Termine'));
      const grid=el('div',{class:'grid'});
      const upcoming=state.items.filter(x=>x.type!=='Aufgabe' && x.status!=='archived' && new Date(x.datetime)>new Date())
                               .sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
      CATS_ALL.forEach(c=>{
        const card=el('div',{class:'card cat-'+(c.css||'cat')});
        const head=el('div',{style:'display:flex;align-items:center;gap:10px;justify-content:space-between'});
        const left=el('div',{style:'display:flex;align-items:center;gap:10px'});
        if(catImages[c.key]) left.append(el('img',{src:catImages[c.key],style:'width:28px;height:28px;border-radius:6px;object-fit:cover'}));
        left.append(el('div',{class:'title'},c.key));
        head.append(left);
        const next=upcoming.find(x=>x.category===c.key);
        const right=el('div',{style:'display:flex;gap:6px;align-items:center'});
        if(next){ const persons=Array.isArray(next.person)?next.person:(next.person?[next.person]:[]); right.append(avatarStack(persons)); }
        head.append(right); card.append(head);

        if(next){
          const p=Array.isArray(next.person)?next.person.join(', '):(next.person||'—');
          card.append(el('div',{},next.title||'(ohne Titel)'));
          card.append(el('div',{},`${fmt(next.datetime)} · ${p} · ${next.location||''}`));
          const row=el('div',{class:'btnrow'});
          const b1=el('button',{type:'button'}, next.status==='done'?'✓ Erledigt':'☑️ Abhaken'); b1.onclick=()=>{ next.status=next.status==='done'?'upcoming':'done'; save(); ov(); };
          const b2=el('button',{type:'button'},'↪ Archivieren'); b2.onclick=()=>{ next.status='archived'; save(); ov(); };
          const b3=el('button',{type:'button'},'✏️ Bearbeiten'); b3.onclick=()=>route('new', next.id);
          row.append(b1,b2,b3);
          const b4=el('button',{type:'button'},'🧾 Bestätigen'); b4.onclick=()=>openConfirmDoc(next); row.append(b4);
          card.append(row);
        } else { card.append(el('div',{},'❗️ Kein Termin eingetragen')); }
        grid.append(card);
      });
      wrap.append(grid);

      wrap.append(el('div',{class:'sep'}));
      wrap.append(el('h2',{},'Aufgaben'));
      const tasks=state.items.filter(x=>x.type==='Aufgabe' && x.status!=='archived')
                             .sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
      const list=el('div',{class:'list'});
      if(!tasks.length) list.innerHTML='<p class="meta">Keine Aufgaben.</p>';
      tasks.forEach(a=>{
        const it=el('div',{class:'item'});
        const titleRow=el('div',{style:'display:flex;align-items:center;gap:8px;justify-content:space-between'});
        titleRow.append(el('div',{class:'title'},a.title||'(ohne Titel)'));
        const persons=Array.isArray(a.person)?a.person:(a.person?[a.person]:[]);
        titleRow.append(avatarStack(persons));
        it.append(titleRow);
        it.append(el('div',{},`${a.category} • ${fmt(a.datetime)} ${a.status==='done'?'✓':''}`));
        const row=el('div',{class:'btnrow'});
        const b1=el('button',{type:'button'}, a.status==='done'?'Als offen markieren':'☑️ Abhaken'); b1.onclick=()=>{ a.status=a.status==='done'?'upcoming':'done'; save(); ov(); };
        const b2=el('button',{type:'button'},'↪ Archivieren'); b2.onclick=()=>{ a.status='archived'; save(); ov(); };
        const b3=el('button',{type:'button'},'✏️ Bearbeiten'); b3.onclick=()=>route('new', a.id);
        row.append(b1,b2,b3);
      if(a.type!=='Aufgabe'){ const b4=el('button',{type:'button'},'🧾 Bestätigen'); b4.onclick=()=>openConfirmDoc(a); row.append(b4); }
      it.append(row); list.append(it);
      });
      wrap.append(list);
      v.append(wrap);
    }

    // ====== Termine- & Aufgaben-Listen ======
    function listView(){
      autoUpdate();
      v.innerHTML='<section><h2>Termine</h2><div id="list" class="list"></div></section>';
      const list=byId('list');
      const all=state.items.filter(a=>a.type!=='Aufgabe' && a.status!=='archived').sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
      if(!all.length){ list.innerHTML='<p class="meta">Keine Termine.</p>'; return; }
      all.forEach(a=>list.append(renderItem(a, ()=>listView())));
    }
    function tasksView(){
      autoUpdate();
      v.innerHTML='<section><h2>Aufgaben</h2><div id="tasks" class="list"></div></section>';
      const list=byId('tasks');
      const all=state.items.filter(a=>a.type==='Aufgabe' && a.status!=='archived').sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
      if(!all.length){ list.innerHTML='<p class="meta">Keine Aufgaben.</p>'; return; }
      all.forEach(a=>list.append(renderItem(a, ()=>tasksView())));
    }

    // ====== Archiv (über Einstellungen) ======
    function arch(){
      autoUpdate();
      v.innerHTML='<section><h2>Archiv</h2><div id="arch" class="list"></div></section>';
      const cont=byId('arch');
      const arr=state.items.filter(a=>a.status==='archived').sort((a,b)=>new Date(b.datetime)-new Date(a.datetime));
      if(!arr.length){ cont.innerHTML='<p class="meta">Archiv ist leer.</p>'; return; }
      arr.forEach(a=>{
        const it=renderItem(a, ()=>arch());
        const row=it.querySelector('.btnrow');
        const back=el('button',{type:'button'},'↩︎ Zurückholen'); back.onclick=()=>{ a.status='upcoming'; save(); arch(); };
        row.append(back); cont.append(it);
      });
    }

    // ====== Formular Neuer Eintrag / Bearbeiten ======
    function form(editId){
      const editing = editId ? state.items.find(x=>x.id===editId) : null;
      v.innerHTML=''; const s=el('section'); s.append(el('h2',{}, editing?'Eintrag bearbeiten':'Neuer Eintrag'));

      // Art
      const lType=el('label'); lType.append('Art');
      const selType=el('select',{id:'type'}); ['Termin','Aufgabe'].forEach(t=>selType.append(el('option',{},t)));
      lType.append(selType); s.append(lType);

      // Titel
      const lTitle=el('label'); lTitle.append('Titel'); lTitle.append(el('input',{id:'title',type:'text',required:'true',placeholder:'z.B. Kontrolle / Hausaufgabe'})); s.append(lTitle);

      // Kategorie
      const lCat=el('label'); lCat.append('Kategorie');
      const selCat=el('select',{id:'category',required:'true'}); lCat.append(selCat); s.append(lCat);

      // Dynamik
      const dyn=el('div',{id:'dyn'}); s.append(dyn);

      // Datum/Uhrzeit
      const row=el('div',{class:'row'});
      const lD=el('label',{class:'half'}); lD.append('Datum'); lD.append(el('input',{id:'date',type:'date',required:'true'})); row.append(lD);
      const lT=el('label',{class:'half'}); lT.append('Uhrzeit');
      const ti=el('input',{id:'time',type:'time',step:'300',required:'true'});
      ti.addEventListener('change',()=>{const [h,m]=ti.value.split(':').map(x=>parseInt(x||'0',10)); const mm=Math.round((m||0)/5)*5; ti.value=String(h).padStart(2,'0')+':'+String(mm%60).padStart(2,'0');});
      lT.append(ti); row.append(lT); s.append(row);

      // Notizen + Anhänge
      const lN=el('label'); lN.append('Notizen'); lN.append(el('textarea',{id:'notes',rows:'4',placeholder:'Kurznotiz…'})); s.append(lN);
      const lF=el('label'); lF.append('Anhänge (Bild/PDF)');
      const inp=el('input',{id:'files',type:'file',accept:'image/*,application/pdf',multiple:'true'}); lF.append(inp); s.append(lF);
      const at=el('div',{class:'attach',id:'attachList'}); s.append(at);

      // Buttons
      const saveBtn=el('button',{class:'primary',type:'button'}, editing?'Änderungen speichern':'Speichern'); s.append(saveBtn);
      const cancelBtn=el('button',{type:'button'},'Abbrechen'); cancelBtn.onclick=()=>route('overview'); s.append(cancelBtn);
      v.append(s);

      // Datalist (für Freitext/„Andere“)
      buildContactsDatalist();

      let tmp=[];
      inp.addEventListener('change',async()=>{
        at.innerHTML=''; tmp=[];
        for(const f of inp.files){
          const id='f_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
          const d=await db(); await new Promise((res,rej)=>{const tx=d.transaction('files','readwrite'); tx.objectStore('files').put(f,id); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e);});
          tmp.push({id,name:f.name,type:f.type,size:f.size});
          at.append(el('span',{class:'chip'},f.name));
        }
      });

      function populateCats(){
        selCat.innerHTML='';
        CATS_ALL.forEach(c=>selCat.append(el('option',{},c.key)));
        if (editing && editing.category && !CATS_ALL.some(c=>c.key===editing.category)) selCat.append(el('option',{},editing.category));
        fillDyn(selType.value, selCat.value, dyn);
      }
      selType.addEventListener('change',populateCats);
      selCat.addEventListener('change',()=>fillDyn(selType.value, selCat.value, dyn));
      populateCats();

      // Prefill
      if(editing){
        selType.value = editing.type || 'Termin';
        populateCats();
        byId('title').value = editing.title || '';
        selCat.value = editing.category || (CATS_ALL[0]?.key || CAT_UNCAT);
        fillDyn(selType.value, selCat.value, dyn);
        const d=new Date(editing.datetime);
        byId('date').value = d.toISOString().slice(0,10);
        byId('time').value = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        byId('notes').value= editing.notes || '';
        if(byId('personMulti') && Array.isArray(editing.person)){
          Array.from(byId('personMulti').options).forEach(o=>o.selected = editing.person.includes(o.value));
        }else if(byId('person')){
          byId('person').value = Array.isArray(editing.person)?(editing.person.join(', ')):(editing.person||'');
        }
        if(byId('location')) byId('location').value = editing.location || '';
      }

      saveBtn.onclick=()=>{
        const title=byId('title').value.trim();
        const type =selType.value;
        const cat  =selCat.value || CAT_UNCAT;
        const date =byId('date').value;
        const time =byId('time').value;
        if(!title||!cat||!date||!time){ alert('Bitte Titel, Kategorie, Datum und Uhrzeit angeben.'); return; }

        let person = byId('personMulti')
          ? Array.from(byId('personMulti').selectedOptions).map(o=>o.value)
          : (byId('personOther') && byId('personOther').style.display==='block') ? byId('personOther').value
          : (byId('person') ? byId('person').value : '');
        if(type==='Aufgabe' && cat==='Persönlich') person='Ich';

        const loc = byId('location') ? byId('location').value : '';
        const dt  = new Date(`${date}T${time}:00`).toISOString();
        const base = { id: editing?editing.id:String(Date.now()), type, title, category:cat, person, location:loc, datetime:dt, notes: byId('notes').value, attachments: tmp, status: editing?editing.status:'upcoming' };

        if(editing){ Object.assign(editing, base); }
        else { state.items.push(base); }
        save(); alert('Gespeichert.'); route('overview');
      };
    }

    // ====== Dynamische Felder ======
    function personsForCategory(cat){
      return contacts.filter(c=>c.kategorie===cat).map(fullName);
    }
    function fillDyn(type, cat, d){
      d.innerHTML='';
      const mk=h=>{const x=document.createElement('div'); x.innerHTML=h; return x.firstElementChild;};

      // Aufgaben
      if(type==='Aufgabe'){
        const names = personsForCategory(cat);
        if(cat==='HKV Aarau'){
          const opts = names.concat(['Persönlich','Andere']);
          d.append(mk('<label>Person<select id="person">'+opts.map(p=>`<option>${p}</option>`).join('')+'</select></label>'));
          d.append(mk('<input id="personOther" placeholder="Andere (Name)" style="display:none;">'));
          const sel=d.querySelector('#person'); const other=d.querySelector('#personOther');
          sel.addEventListener('change',()=>{ other.style.display=(sel.value==='Andere')?'block':'none'; });
        } else if(cat==='Persönlich'){
          if(names.length){
            d.append(mk('<label>Person<select id="person">'+names.concat(['Andere']).map(p=>`<option>${p}</option>`).join('')+'</select></label>'));
            d.append(mk('<input id="personOther" placeholder="Andere (Name)" style="display:none;">'));
            const sel=d.querySelector('#person'); const other=d.querySelector('#personOther');
            sel.addEventListener('change',()=>{ other.style.display=(sel.value==='Andere')?'block':'none'; });
          }
        } else {
          const opts = names.concat(['Andere']);
          d.append(mk('<label>Person<select id="person">'+opts.map(p=>`<option>${p}</option>`).join('')+'</select></label>'));
          d.append(mk('<input id="personOther" placeholder="Andere (Name)" style="display:none;">'));
          const sel=d.querySelector('#person'); const other=d.querySelector('#personOther');
          sel.addEventListener('change',()=>{ other.style.display=(sel.value==='Andere')?'block':'none'; });
        }
        d.append(mk('<label>Standort<input id="location" placeholder="Ort / Kontext"></label>'));
        return;
      }

      // Termine
      if(cat===CAT_GMA){
        const names = personsForCategory(cat);
        d.append(mk('<label>Termin mit (Mehrfachauswahl)<select id="personMulti" multiple size="6">'+names.map(n=>`<option>${n}</option>`).join('')+'</select></label>'));
        d.append(mk('<label>Standort<select id="location"><option>5000 Aarau</option><option>3322 Schönbühl</option></select></label>'));
        return;
      }
      const names = personsForCategory(cat);
      d.append(mk('<label>Termin mit<select id="person">'+names.concat(['Andere']).map(n=>`<option>${n}</option>`).join('')+'</select></label>'));
      d.append(mk('<input id="personOther" placeholder="Andere (Name)" style="display:none;">'));
      const sel=d.querySelector('#person'); const other=d.querySelector('#personOther');
      sel.addEventListener('change',()=>{ other.style.display = sel.value==='Andere' ? 'block' : 'none'; });

      if(cat==='Spitex Heitersberg'){
        d.append(mk('<label>Standort<select id="location"><option>5000 Aarau</option><option>5200 Brugg</option><option>5442 Fislisbach</option><option>5507 Mellingen</option></select></label>'));
      } else if(cat==='Töpferhaus'){
        d.append(mk('<label>Standort<select id="location"><option>5000 Aarau - Bleichmattstr.</option><option>5000 Aarau - Bachstr. 95</option></select></label>'));
      } else {
        d.append(mk('<label>Standort<input id="location" placeholder="Ort / Adresse"></label>'));
      }
    }

    // ====== Datalist (nur für Freitextfälle) ======
    function buildContactsDatalist(){
      let dl=document.getElementById('contactsAll'); if(!dl){ dl=el('datalist',{id:'contactsAll'}); document.body.appendChild(dl); }
      dl.innerHTML=''; contacts.forEach(c=> dl.append(el('option',{}, fullName(c))));
    }

    // ====== Kontakte: Hauptansicht (nur Hinzufügen) + Kategorien-Grid (nur Öffnen) ======
    function contactsView(){
      v.innerHTML = `<section>
        <h2>Kontakte</h2>

        <div style="margin:4px 0 12px">
          <input id="contactSearch" placeholder="Suchen (Name, Kategorie, Funktion, Telefon, E-Mail, Notiz)" style="width:100%">
        </div>

        <h3>Kategorien</h3>
        <div id="catListAll"></div>

        <div class="btnrow" style="margin:8px 0 16px">
          <button id="addCatAll" type="button" class="primary">+ Kategorie hinzufügen</button>
        </div>

        <h3>Suchergebnisse</h3>
        <div id="searchGrid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;"></div>

        <div class="btnrow" style="margin-top:16px">
          <button id="cNew" class="primary" type="button">+ Neuer Kontakt</button>
        </div>
      </section>`;

      renderCatList(); // Kategorien als Grid (nur Öffnen)
      byId('cNew').onclick=()=>editContact(null);
      byId('addCatAll').onclick=()=>addCategory();

      const searchInput = byId('contactSearch');
      const searchGrid  = byId('searchGrid');
      const renderSearch = ()=>{
        const q = searchInput.value.trim().toLowerCase();
        searchGrid.innerHTML='';
        if(!q) { searchGrid.innerHTML='<p class="meta" style="grid-column:1/-1;opacity:.8">Gib etwas ein, um zu suchen…</p>'; return; }
        const hits = contacts.filter(c=>{
          const hay = [
            fullName(c), c.kategorie||'', c.funktion||'',
            c.telefon||'', c.email||'', c.notizen||''
          ].join(' ').toLowerCase();
          return hay.includes(q);
        });
        if(!hits.length){ searchGrid.innerHTML='<p class="meta" style="grid-column:1/-1">Keine Treffer.</p>'; return; }
        hits.forEach(c=>searchGrid.append(contactCard(c)));
      };
      searchInput.addEventListener('input', renderSearch);
      renderSearch();
    }

    // Kategorien-Grid — pro Karte nur „Öffnen“
    function renderCatList(){
      const listEl = byId('catListAll');
      listEl.innerHTML = '';

      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
      grid.style.gap = '12px';

      const cats = CATS_ALL.map(c=>c.key);
      cats.forEach(k=>{
        const n = contacts.filter(c => c.kategorie === k).length;

        const card = el('div', { class: 'item', style: 'height:100%' });
        const head = el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:4px' });
        if (catImages[k]) {
          head.append(el('img', { src: catImages[k], style: 'width:28px;height:28px;border-radius:6px;object-fit:cover' }));
        }
        head.append(el('div', { class: 'title' }, k));
        card.append(head);

        card.append(el('div', {}, `${n} Kontakte`));

        const row = el('div', { class: 'btnrow', style: 'margin-top:8px' });
        const open  = el('button', {type:'button'}, 'Öffnen');
        open.onclick  = () => contactsByCategory(k);
        row.append(open);
        card.append(row);

        grid.append(card);
      });

      listEl.append(grid);
    }

    // Karte (Kontakt) – für Suchergebnisse (Grid)
    function contactCard(c){
      const it=el('div',{class:'item', style:'height:100%'});
      const head=el('div',{style:'display:flex;align-items:center;gap:10px;margin-bottom:4px'});
      if(c.img) head.append(el('img',{src:c.img,style:'width:36px;height:36px;border-radius:50%;object-fit:cover'}));
      head.append(el('div',{class:'title'}, `${fullName(c) || '(ohne Namen)'}`));
      it.append(head);
      if(c.kategorie) it.append(el('div',{}, c.kategorie));
      if(c.funktion)  it.append(el('div',{}, `Funktion: ${c.funktion}`));
      if(c.telefon)   it.append(el('div',{}, `Tel: ${c.telefon}`));
      if(c.email)     it.append(el('div',{}, `E-Mail: ${c.email}`));
      const row=el('div',{class:'btnrow', style:'margin-top:8px'});
      const b1=el('button',{type:'button'},'✏️ Bearbeiten'); b1.onclick=()=>editContact(c.id);
      const b2=el('button',{type:'button'},'🗑️ Löschen'); b2.onclick=()=>{ if(confirm('Kontakt löschen?')){ contacts=contacts.filter(x=>x.id!==c.id); saveContacts(); contactsView(); } };
      const b3=el('button',{type:'button'},'🕘 Verlauf'); b3.onclick=()=>showContactHistory(c.id, c.kategorie);
      row.append(b1,b2,b3); it.append(row);
      return it;
    }

    // Listen-Zeile (Kontakt) – für Kategorie-Ansicht (Liste)
    function contactListRow(c, parentCategory){
      const it = el('div', { class: 'item' });
      const head = el('div', { style: 'display:flex;align-items:center;gap:10px' });
      if (c.img) head.append(el('img', { src: c.img, style: 'width:32px;height:32px;border-radius:50%;object-fit:cover' }));
      head.append(el('div', { class: 'title' }, `${fullName(c) || '(ohne Namen)'}${c.kategorie ? ` (${c.kategorie})` : ''}`));
      it.append(head);
      if (c.funktion) it.append(el('div', {}, `Funktion: ${c.funktion}`));
      if (c.telefon)  it.append(el('div', {}, `Telefon: ${c.telefon}`));
      if (c.email)    it.append(el('div', {}, `E-Mail: ${c.email}`));
      if (c.notizen)  it.append(el('div', {}, `Notizen: ${c.notizen}`));
      const row = el('div', { class: 'btnrow' });
      const b1  = el('button', {type:'button'}, '✏️ Bearbeiten');  b1.onclick = () => editContact(c.id);
      const b2  = el('button', {type:'button'}, '🗑️ Löschen');    b2.onclick = () => {
        if (confirm('Kontakt löschen?')) {
          contacts = contacts.filter(x => x.id !== c.id);
          saveContacts();
          contactsByCategory(parentCategory || c.kategorie);
        }
      };
      const b3  = el('button', {type:'button'}, '🕘 Verlauf');    b3.onclick = () => showContactHistory(c.id, parentCategory || c.kategorie);
      row.append(b1, b2, b3);
      it.append(row);
      return it;
    }

    // Kontakte innerhalb einer Kategorie – Liste + Kategorie-Aktionen (Umbenennen/Bild/Löschen)
    function contactsByCategory(cat){
      v.innerHTML = `<section>
        <h2>${cat}</h2>

        <div class="btnrow" style="margin:6px 0 12px">
          <button id="cat-rename" type="button">Kategorie umbenennen</button>
          <button id="cat-image"  type="button">Kategorie-Bild setzen</button>
          <button id="cat-delete" type="button">Kategorie löschen</button>
        </div>

        <div style="margin:4px 0 12px">
          <input id="catSearch" placeholder="Innerhalb ${cat} suchen…" style="width:100%">
        </div>

        <div id="cList" class="list"></div>
        <div class="btnrow" style="margin-top:12px">
          <button id="cNew" class="primary" type="button">+ Neuer Kontakt</button>
          <button id="back" type="button">← Kategorien</button>
        </div>
      </section>`;

      // Kategorie-spezifische Aktionen
      byId('cat-rename').onclick = ()=> renameCategory(cat);
      byId('cat-image').onclick  = ()=> setCategoryImage(cat);
      byId('cat-delete').onclick = ()=> deleteCategory(cat);

      const cList=byId('cList');
      const base=contacts.filter(c=>c.kategorie===cat);

      const render=(arr)=>{
        cList.innerHTML = '';
        if(!arr.length){ cList.innerHTML='<p class="meta">Keine Kontakte.</p>'; return; }
        arr.forEach(c=>cList.append(contactListRow(c, cat)));
      };
      render(base);

      byId('cNew').onclick=()=>editContact(null, cat);
      byId('back').onclick=()=>contactsView();

      const catSearch=byId('catSearch');
      catSearch.addEventListener('input', ()=>{
        const q=catSearch.value.trim().toLowerCase();
        if(!q) return render(base);
        const filtered = base.filter(c=>{
          const hay=[fullName(c), c.funktion||'', c.telefon||'', c.email||'', c.notizen||''].join(' ').toLowerCase();
          return hay.includes(q);
        });
        render(filtered);
      });
    }

    // Kategorie-Operationen (werden von oben aufgerufen)
    function addCategory(){
      const name = prompt('Name der neuen Kategorie:'); if(!name) return;
      if(CATS_ALL.some(c=>c.key===name)){ alert('Kategorie existiert bereits.'); return; }
      CATS_ALL.push({key:name, css:'cat'}); saveCats(); contactsView();
    }
    function renameCategory(from){
      if(!from || !CATS_ALL.some(c=>c.key===from)) return alert('Kategorie nicht gefunden.');
      const to = prompt(`Neuer Name für "${from}":`, from); if(!to||to===from) return;
      if(CATS_ALL.some(c=>c.key===to)) return alert('Zielname existiert bereits.');
      CATS_ALL.forEach(c=>{ if(c.key===from) c.key=to; });
      contacts = contacts.map(c => c.kategorie===from ? {...c, kategorie:to} : c);
      if(catImages[from]){ catImages[to]=catImages[from]; delete catImages[from]; saveCatImages(); }
      saveContacts(); saveCats(); contactsView();
    }
    function deleteCategory(name){
      if(!name || !CATS_ALL.some(c=>c.key===name)) return alert('Kategorie nicht gefunden.');
      if(!confirm(`Kategorie "${name}" löschen?`)) return;
      const others = CATS_ALL.map(c=>c.key).filter(k=>k!==name);
      let target = others[0] || CAT_UNCAT;
      const ask = prompt(`Kontakte in welche Kategorie verschieben? (Enter für "${target}")\n` + (others.length?others.join('\n'):'(keine – es wird "Unkategorisiert" verwendet)'));
      if(ask && ask.trim()) target = ask.trim();
      CATS_ALL = CATS_ALL.filter(c=>c.key!==name);
      contacts = contacts.map(c => c.kategorie===name ? {...c, kategorie:target} : c);
      if(catImages[name]){ delete catImages[name]; saveCatImages(); }
      saveContacts(); saveCats(); contactsView();
    }
    function setCategoryImage(name){
      if(!name || !CATS_ALL.some(c=>c.key===name)) return alert('Kategorie nicht gefunden.');
      const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
      inp.onchange=async()=>{ if(inp.files&&inp.files[0]){ catImages[name]=await dataURL(inp.files[0]); saveCatImages(); contactsView(); } };
      inp.click();
    }

    function editContact(id, presetCat){
      const c = id ? contacts.find(x=>x.id===id) : {vorname:'',name:'',kategorie:presetCat||'',funktion:'',notizen:'',telefon:'',email:'',img:''};
      v.innerHTML='<section><h2>Kontakt</h2></section>';
      const s=v.querySelector('section');

      // Kategorie
      const wrapK=el('label'); wrapK.append('Kategorie');
      const selKat=el('select',{id:'kategorie'});
      [...CATS_ALL.map(c=>c.key), CAT_UNCAT].forEach(cat=> selKat.append(el('option',{},cat)));
      selKat.value = c.kategorie || CAT_UNCAT;
      wrapK.append(selKat); s.append(wrapK);

      const mkField=(k, lbl, type='text')=>{
        const wrap=el('label'); wrap.append(lbl);
        if(k==='notizen'){ const ta=el('textarea',{id:k}); ta.rows=3; ta.value=c[k]||''; wrap.append(ta); }
        else{ const inp=el('input',{id:k,type}); inp.value=c[k]||''; wrap.append(inp); }
        s.append(wrap);
      };
      mkField('vorname','Vorname'); mkField('name','Name');
      mkField('funktion','Funktion'); mkField('telefon','Telefonnummer');
      mkField('email','E-Mail','email'); mkField('notizen','Notizen');

      // Bild nur hier
      const imgRow=el('div',{class:'btnrow'});
      const imgSet=el('button',{type:'button'}, c.img ? 'Kontaktbild ersetzen' : 'Kontaktbild hinzufügen');
      const imgDel=el('button',{type:'button'}, 'Bild entfernen');
      imgRow.append(imgSet,imgDel); s.append(imgRow);
      imgSet.onclick=()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=async()=>{ if(inp.files&&inp.files[0]){ c.img=await dataURL(inp.files[0]); showPreview(); } }; inp.click(); };
      imgDel.onclick=()=>{ c.img=''; showPreview(); };
      let pre=null; function showPreview(){ if(pre) pre.remove(); if(c.img){ pre=el('img',{src:c.img,style:'width:80px;height:80px;border-radius:50%;object-fit:cover;margin:8px 0'}); s.insertBefore(pre, imgRow); } } showPreview();

      const row=el('div',{class:'btnrow'});
      const saveBtn=el('button',{class:'primary',type:'button'},'Speichern');
      const cancel=el('button',{type:'button'},'Abbrechen');
      row.append(saveBtn,cancel); s.append(row);

      saveBtn.onclick=()=>{
        const obj={ id: id || String(Date.now()),
          vorname:(byId('vorname')?.value||'').trim(),
          name:(byId('name')?.value||'').trim(),
          kategorie:(byId('kategorie')?.value||CAT_UNCAT).trim(),
          funktion:(byId('funktion')?.value||'').trim(),
          telefon:(byId('telefon')?.value||'').trim(),
          email:(byId('email')?.value||'').trim(),
          notizen:(byId('notizen')?.value||'').trim(),
          img:c.img||''
        };
        if(!obj.name && !obj.vorname){ alert('Bitte mindestens Vorname oder Name angeben.'); return; }
        if(id){ contacts=contacts.map(x=>x.id===id?obj:x); } else { contacts.push(obj); }
        saveContacts(); contactsByCategory(obj.kategorie);
      };
      cancel.onclick=()=>contactsView();
    }

    function showContactHistory(id, backCat){
      const c=contacts.find(x=>x.id===id); v.innerHTML=`<section><h2>Verlauf: ${fullName(c)}</h2></section>`;
      const s=v.querySelector('section');
      const isMatch = (item)=>{
        const fullname=fullName(c); const target=item.person;
        if(Array.isArray(target)) return target.some(p=>String(p).includes(c.name)||String(p).includes(fullname));
        return String(target||'').includes(c.name)||String(target||'').includes(fullname);
      };
      const past=state.items.filter(x=> new Date(x.datetime) < new Date()).filter(isMatch).sort((a,b)=> new Date(b.datetime)-new Date(a.datetime));
      if(!past.length){ s.append(el('p',{},'Keine vergangenen Termine gefunden.')); }
      else{
        const list=el('div',{class:'list'});
        past.forEach(p=>{
          const it=el('div',{class:'item'});
          it.append(el('div',{class:'title'}, `${fmt(p.datetime)} – ${p.title||'(ohne Titel)'}`));
          it.append(el('div',{}, `${p.type||'Termin'} • ${p.category}`));
          if(p.notes) it.append(el('div',{}, `Notiz: ${p.notes}`));
          list.append(it);
        }); s.append(list);
      }
      // Kurzberichte
      const key = id, logs = contactLogs[key] || [];
      s.append(el('h3',{},'Kurzberichte'));
      const logList=el('div',{class:'list'});
      if(!logs.length) logList.innerHTML='<p class="meta">Keine Kurzberichte.</p>';
      logs.forEach(entry=>{
        const it=el('div',{class:'item'});
        it.append(el('div',{class:'title'}, `${fmt(entry.ts)} – Notiz`));
        it.append(el('div',{}, entry.text));
        const row=el('div',{class:'btnrow'});
        const del=el('button',{type:'button'},'🗑️ Löschen'); del.onclick=()=>{ contactLogs[key]= (contactLogs[key]||[]).filter(x=>x.id!==entry.id); saveContactLogs(); showContactHistory(id, backCat); };
        row.append(del); it.append(row); logList.append(it);
      });
      s.append(logList);
      const ta=el('textarea',{rows:3,placeholder:'Kurzbericht…'});
      const addBtn=el('button',{class:'primary',type:'button'},'Kurzbericht speichern');
      addBtn.onclick=()=>{ const text=ta.value.trim(); if(!text) return; const entry={id:String(Date.now()), ts:new Date().toISOString(), text}; contactLogs[key]=[...(contactLogs[key]||[]), entry]; saveContactLogs(); showContactHistory(id, backCat); };
      s.append(ta); s.append(addBtn);
      const back=el('button',{type:'button'},'← Zurück'); back.onclick=()=> backCat ? contactsByCategory(backCat) : contactsView(); s.append(back);
    }

    // ====== Render Item (inkl. Avatare) ======
    function renderItem(a, refresh){
      const it=el('div',{class:'item'});
      const pDisp=Array.isArray(a.person)?a.person.join(', '):(a.person||'—');
      const head=el('div',{style:'display:flex;align-items:center;gap:8px;justify-content:space-between'});
      head.append(el('div',{class:'title'}, a.title||'(ohne Titel)'));
      const persons=Array.isArray(a.person)?a.person:(a.person?[a.person]:[]);
      head.append(avatarStack(persons));
      it.append(head);
      it.append(el('div',{}, `${a.type||'Termin'} • ${a.category} • ${fmt(a.datetime)} ${a.status==='done'?'✓':''} ${a.status==='archived'?'(Archiv)':''}`));
      if(a.type!=='Aufgabe'){
        it.append(el('div',{}, `Person(en): ${pDisp}`));
        it.append(el('div',{}, `Standort: ${a.location||'—'}`));
      }
      it.append(el('div',{}, `Notizen: ${esc(a.notes||'—')}`));
      const row=el('div',{class:'btnrow'});
      const b1=el('button',{type:'button'}, a.status==='done'?'Als offen markieren':'☑️ Abhaken'); b1.onclick=()=>{ a.status=a.status==='done'?'upcoming':'done'; save(); refresh(); };
      const b2=el('button',{type:'button'},'↪ Archivieren'); b2.onclick=()=>{ a.status='archived'; save(); refresh(); };
      const b3=el('button',{type:'button'},'✏️ Bearbeiten'); b3.onclick=()=>route('new', a.id);
      row.append(b1,b2,b3); it.append(row);
      return it;
    }

    // ====== Export/Import: Termine ======
    function exportCSV(items){
      const rows=[['Typ','Titel','Kategorie','Datum','Uhrzeit','Person(en)','Standort','Notizen','Status','Anhänge','ID']];
      items.slice().sort((a,b)=>new Date(a.datetime)-new Date(b.datetime)).forEach(a=>{
        const d=new Date(a.datetime), date=d.toLocaleDateString('de-CH'), time=d.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'});
        const per=Array.isArray(a.person)?a.person.join('; '):(a.person||''); const files=(a.attachments||[]).map(x=>x.name).join('; ');
        rows.push([a.type||'Termin',a.title||'',a.category,date,time,per,a.location||'',String(a.notes||'').replace(/\n/g,' '),a.status,files,a.id||'']);
      });
      return rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    }
    function downloadBlob(name, mime, data){
      const blob=new Blob([data],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
    }

    // ====== Kontakte: CSV/JSON inkl. E-Mail ======
    function contactsToCSV(arr){
      const head=['ID','Vorname','Name','Kategorie','Funktion','Telefon','E-Mail','Notizen','Bild(Base64?)'];
      const rows = arr.map(c=>[c.id, c.vorname||'', c.name||'', c.kategorie||'', c.funktion||'', c.telefon||'', c.email||'', (c.notizen||'').replace(/\n/g,' '), c.img? 'ja' : 'nein' ]);
      return [head,...rows].map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    }
    function mergeContacts(imported){
      const map=new Map(contacts.map(c=>[c.id,c]));
      imported.forEach(c=>{
        if(c.id && map.has(c.id)) map.set(c.id,{...map.get(c.id),...c});
        else { c.id = c.id || String(Date.now()+Math.random()); map.set(c.id,c); }
      });
      contacts=Array.from(map.values()); saveContacts();
    }

    // ====== Kurzberichte (Logs) Export/Import ======
    function logsToJSON(){ return JSON.stringify(contactLogs, null, 2); }
    function logsToCSV(){
      const head = ['KontaktID','Kontaktname','LogID','ZeitpunktISO','Text'];
      const rows = [head];
      Object.keys(contactLogs||{}).forEach(cid=>{
        const c = contacts.find(x=>x.id===cid);
        const name = c ? fullName(c) : '';
        (contactLogs[cid]||[]).forEach(L=>{ rows.push([cid, name, L.id||'', L.ts||'', (L.text||'').replace(/\n/g,' ')]); });
      });
      return rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    }
    function mergeLogs(imported){
      const store = {...contactLogs};
      const ensureArr = (x)=>Array.isArray(x)?x:[];
      if(Array.isArray(imported)){
        imported.forEach(e=>{
          const cid=e.contactId; if(!cid) return;
          const arr = ensureArr(store[cid]);
          const idx = arr.findIndex(z=>z.id===e.id);
          if(idx>=0) arr[idx]={...arr[idx], ...e};
          else arr.push({id:e.id||String(Date.now()+Math.random()), ts:e.ts||new Date().toISOString(), text:e.text||''});
          store[cid]=arr;
        });
      } else if (imported && typeof imported==='object'){
        Object.keys(imported).forEach(cid=>{
          const arr = ensureArr(store[cid]);
          ensureArr(imported[cid]).forEach(e=>{
            const idx = arr.findIndex(z=>z.id===e.id);
            if(idx>=0) arr[idx]={...arr[idx], ...e};
            else arr.push({id:e.id||String(Date.now()+Math.random()), ts:e.ts||new Date().toISOString(), text:e.text||''});
          });
          store[cid]=arr;
        });
      }
      contactLogs = store; saveContactLogs();
    }

    // ====== CSV Helpers & Merge Items ======
    function splitCSV(line){
      const res=[]; let cur=''; let inq=false;
      for(let i=0;i<line.length;i++){
        const ch=line[i];
        if(ch==='"'){ if(inq && line[i+1]==='"'){ cur+='"'; i++; } else inq=!inq; }
        else if(ch===';' && !inq){ res.push(cur); cur=''; }
        else cur+=ch;
      }
      res.push(cur); return res;
    }
    function mergeItems(arr){
      const map=new Map(state.items.map(x=>[x.id,x]));
      arr.forEach(n=>{ if(n.id && map.has(n.id)){ map.set(n.id,{...map.get(n.id),...n}); } else { if(!n.id) n.id=String(Date.now()+Math.random()); map.set(n.id,n); } });
      state.items=Array.from(map.values()); save();
    }

    // ====== Einstellungen (gegliedert) ======
    function settings(){
      v.innerHTML=`<section><h2>Einstellungen</h2>
        <h3>Darstellung</h3>
        <div class="btnrow">
          <button id="theme-toggle" type="button"></button>
        </div>

        <h3>Termine</h3>
        <div class="btnrow">
          <button id="exp-csv"  type="button">Termine → Excel/CSV exportieren</button>
          <button id="exp-json" type="button">Termine → JSON exportieren</button>
          <input type="file" id="imp-file" accept=".csv,.json" style="display:none">
          <button id="imp-btn"  type="button">Termine importieren (CSV/JSON)</button>
        </div>

        <h3>Kontakte</h3>
        <div class="btnrow">
          <button id="c-exp-csv"  type="button">Kontakte → CSV exportieren</button>
          <button id="c-exp-json" type="button">Kontakte → JSON exportieren</button>
          <input type="file" id="c-imp-file" accept=".csv,.json" style="display:none">
          <button id="c-imp-btn"  type="button">Kontakte importieren (CSV/JSON)</button>
        </div>

        <h3>Kurzberichte</h3>
        <div class="btnrow">
          <button id="l-exp-csv"  type="button">Kurzberichte → CSV exportieren</button>
          <button id="l-exp-json" type="button">Kurzberichte → JSON exportieren</button>
          <input type="file" id="l-imp-file" accept=".csv,.json" style="display:none">
          <button id="l-imp-btn"  type="button">Kurzberichte importieren (CSV/JSON)</button>
        </div>

        <h3>Wartung</h3>
        <div class="btnrow">
          <button id="open-arch" type="button">Archiv öffnen</button>
          <button id="wipe" class="danger" type="button">Alle Termine löschen</button>
        </div>
      </section>`;

      // Theme
      const isDark=document.documentElement.classList.contains('dark');
      const tt=byId('theme-toggle'); tt.textContent=isDark?'🌙 Dark-Mode ist an — ausschalten':'🌞 Dark-Mode ist aus — einschalten';
      tt.onclick=()=>{ const dark=document.documentElement.classList.toggle('dark'); localStorage.setItem('tmjw_theme',dark?'dark':'light'); settings(); };

      // Termine export/import
      byId('exp-csv').onclick=()=>downloadBlob('TimeMateJW_Termine.csv','text/csv;charset=utf-8', exportCSV(state.items));
      byId('exp-json').onclick=()=>downloadBlob('TimeMateJW_Termine.json','application/json', JSON.stringify(state.items,null,2));
      const file=byId('imp-file'); byId('imp-btn').onclick=()=>file.click();
      file.onchange=async()=>{
        if(!file.files||!file.files[0]) return; const f=file.files[0]; const txt=await f.text();
        try{ const data=JSON.parse(txt); if(Array.isArray(data)){ mergeItems(data); alert('Termine (JSON) importiert.'); route('overview'); return; } }catch(_){}
        const lines=txt.split(/\r?\n/).filter(x=>x.trim().length); const header=lines.shift(); const cols=header.split(';').map(x=>x.replace(/^"|"$/g,''));
        const idx=n=>cols.indexOf(n); const out=[];
        for(const line of lines){
          const cells=splitCSV(line);
          const obj={
            type:cells[idx('Typ')]?.replace(/^"|"$/g,'')||'Termin',
            title:cells[idx('Titel')]?.replace(/^"|"$/g,'')||'',
            category:cells[idx('Kategorie')]?.replace(/^"|"$/g,'')||'',
            date:cells[idx('Datum')]?.replace(/^"|"$/g,'')||'',
            time:cells[idx('Uhrzeit')]?.replace(/^"|"$/g,'')||'',
            person:cells[idx('Person(en)')]?.replace(/^"|"$/g,'')||'',
            location:cells[idx('Standort')]?.replace(/^"|"$/g,'')||'',
            notes:cells[idx('Notizen')]?.replace(/^"|"$/g,'')||'',
            status:cells[idx('Status')]?.replace(/^"|"$/g,'')||'upcoming',
            id:cells[idx('ID')]?.replace(/^"|"$/g,'')||String(Date.now()+Math.random())
          };
          let dt; try{ const [d,m,y]=obj.date.split('.'); dt = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${(obj.time||'00:00')}:00`);}catch(_){ dt=new Date(); }
          out.push({ id:obj.id, type:obj.type, title:obj.title, category:obj.category,
            person: obj.person.includes(';') ? obj.person.split(';').map(s=>s.trim()) : obj.person,
            location:obj.location, datetime: dt.toISOString(), notes:obj.notes, status:obj.status, attachments:[] });
        }
        mergeItems(out); alert('Termine (CSV) importiert.'); route('overview');
      };

      // Kontakte export/import
      byId('c-exp-csv').onclick=()=>downloadBlob('TimeMateJW_Kontakte.csv','text/csv;charset=utf-8', contactsToCSV(contacts));
      byId('c-exp-json').onclick=()=>downloadBlob('TimeMateJW_Kontakte.json','application/json', JSON.stringify(contacts,null,2));
      const cf=byId('c-imp-file'); byId('c-imp-btn').onclick=()=>cf.click();
      cf.onchange=async()=>{
        if(!cf.files||!cf.files[0]) return; const f=cf.files[0]; const txt=await f.text();
        try{ const data=JSON.parse(txt); if(Array.isArray(data)){ mergeContacts(data); alert('Kontakte (JSON) importiert.'); contactsView(); return; } }catch(_){}
        const lines=txt.split(/\r?\n/).filter(x=>x.trim().length); const header=lines.shift(); const cols=header.split(';').map(x=>x.replace(/^"|"$/g,''));
        const idx=n=>cols.indexOf(n); const arr=[];
        for(const line of lines){
          const cells=splitCSV(line);
          const obj={
            id:cells[idx('ID')]?.replace(/^"|"$/g,'')||String(Date.now()+Math.random()),
            vorname:cells[idx('Vorname')]?.replace(/^"|"$/g,'')||'',
            name:cells[idx('Name')]?.replace(/^"|"$/g,'')||'',
            kategorie:cells[idx('Kategorie')]?.replace(/^"|"$/g,'')||CAT_UNCAT,
            funktion:cells[idx('Funktion')]?.replace(/^"|"$/g,'')||'',
            telefon:cells[idx('Telefon')]?.replace(/^"|"$/g,'')||'',
            email:cells[idx('E-Mail')]?.replace(/^"|"$/g,'')||'',
            notizen:cells[idx('Notizen')]?.replace(/^"|"$/g,'')||'',
          };
          arr.push(obj);
        }
        mergeContacts(arr); alert('Kontakte (CSV) importiert.'); contactsView();
      };

      // Kurzberichte export/import
      byId('l-exp-json').onclick=()=>downloadBlob('TimeMateJW_Kurzberichte.json','application/json', logsToJSON());
      byId('l-exp-csv').onclick=()=>downloadBlob('TimeMateJW_Kurzberichte.csv','text/csv;charset=utf-8', logsToCSV());
      const lf=byId('l-imp-file'); byId('l-imp-btn').onclick=()=>lf.click();
      lf.onchange=async()=>{
        if(!lf.files||!lf.files[0]) return; const f=lf.files[0]; const txt=await f.text();
        try{
          const data=JSON.parse(txt);
          if(data && typeof data==='object'){ mergeLogs(data); alert('Kurzberichte (JSON) importiert.'); return; }
        }catch(_){}
        const lines=txt.split(/\r?\n/).filter(x=>x.trim().length); if(!lines.length){ alert('Datei leer.'); return; }
        const header=lines.shift(); const cols=header.split(';').map(x=>x.replace(/^"|"$/g,''));
        const idx=n=>cols.indexOf(n);
        const rows=[];
        for(const line of lines){
          const cells=splitCSV(line);
          const rec={
            contactId: cells[idx('KontaktID')]?.replace(/^"|"$/g,'')||'',
            id:        cells[idx('LogID')]?.replace(/^"|"$/g,'')||'',
            ts:        cells[idx('ZeitpunktISO')]?.replace(/^"|"$/g,'')||new Date().toISOString(),
            text:      cells[idx('Text')]?.replace(/^"|"$/g,'')||''
          };
          rows.push(rec);
        }
        mergeLogs(rows);
        alert('Kurzberichte (CSV) importiert.');
      };

      // Wartung
      byId('open-arch').onclick=()=>route('archive');
      byId('wipe').onclick=async()=>{ if(confirm('Wirklich alle Termine löschen?')){ const d=await db(); await new Promise((res,rej)=>{const tx=d.transaction('files','readwrite'); tx.objectStore('files').clear(); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e);}); state.items=[]; save(); alert('Gelöscht.'); route('overview'); } };
    }

    // ====== Start ======
    // Nur binden, wenn Tabs existieren – verhindert Fehler auf leeren Seiten
    const tabs = document.querySelectorAll('.tabs .tab');
    if (tabs && tabs.length) {
      tabs.forEach(b=>b.addEventListener('click',()=>route(b.dataset.route)));
    }
    // Erste Ansicht
    route('overview');
  }
})();
