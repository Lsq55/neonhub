const SUPABASE_URL='https://iffxyfyfilbkqufyemoe.supabase.co',SUPABASE_KEY='sb_publishable_W8FyZODc9qO-k7YoMVrZ0g_8poq4Uae';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);let data=[],editing=null,cat=0,currentUser=null;const $=s=>document.querySelector(s),storeKey='neonhub-data';
const saveLocal=(snapshot=data)=>{if(currentUser)localStorage.setItem(storeKey+':'+currentUser.id,JSON.stringify(snapshot))};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
async function load(){let local=null;try{local=JSON.parse(localStorage.getItem(storeKey+':'+currentUser.id)||'null')}catch{}try{const [cr,lr]=await Promise.all([db.from('categories').select('id,name,sort_order').eq('user_id',currentUser.id).order('sort_order').order('created_at'),db.from('links').select('id,category,title,url,sort_order').eq('user_id',currentUser.id).order('sort_order').order('created_at')]);if(cr.error||lr.error)throw Error();const lm={};lr.data.forEach(r=>(lm[r.category]??=[]).push(r));const names=[...cr.data.map(c=>c.name),...Object.keys(lm)];data=[...new Set(names)].map(name=>{const c=cr.data.find(x=>x.name===name);return {id:c?.id,name,sort_order:c?.sort_order,links:lm[name]||[]}});{for(const m of data)if(!m.id){const {data:r}=await db.from('categories').insert({name:m.name,user_id:currentUser.id}).select().single();if(r)m.id=r.id}}saveLocal()}catch{data=Array.isArray(local)?local:[];toast('已进入本地模式，数据会保存在此浏览器')}render()}
function render(){const count=data.reduce((n,m)=>n+m.links.length,0);$('#layout').innerHTML=data.map((m,mi)=>`<section class="module" data-module="${mi}" ondragover="dragOver(event)" ondrop="dropModule(event,${mi})"><div class="module-head" draggable="true" ondragstart="dragModule(event,${mi})" ondragend="endDrag()" title="拖动标题栏调整模块顺序"><div><h2>${esc(m.name)}</h2><span class="count">${m.links.length} 个链接</span></div><div class="module-actions"><button title="重命名" onclick="renameCat(${mi})">✎</button><button title="删除模块" onclick="removeCat(${mi})">×</button><button class="add-link" onclick="openModal(${mi})">＋ 添加</button></div></div><div class="links">${m.links.map((l,li)=>`<a class="link" draggable="true" data-link="${mi}-${li}" ondragstart="dragLink(event,${mi},${li})" ondragend="endDrag()" ondragover="dragOver(event)" ondrop="dropLink(event,${mi},${li})" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="link-title"><span class="favicon">${esc(l.title).slice(0,1).toUpperCase()}</span>${esc(l.title)}</span><span class="link-actions"><button onclick="event.preventDefault();editLink(${mi},${li})">编辑</button><button onclick="event.preventDefault();removeLink(${mi},${li})">删除</button></span></a>`).join('')||'<div class="empty">还没有链接，添加一个常用网站吧</div>'}</div></section>`).join('');$('#summary').textContent=`${data.length} 个模块 · ${count} 个链接`}
function openModal(mi,li=null){cat=mi;editing=li;$('#modalTitle').textContent=li===null?'添加网页':'编辑网页';const l=li===null?{title:'',url:''}:data[mi].links[li];$('#title').value=l.title;$('#url').value=l.url;$('#modal').showModal();$('#title').focus()}
$('#cancelBtn').onclick=()=>$('#modal').close();$('#form').onsubmit=async e=>{e.preventDefault();let title=$('#title').value.trim(),u=$('#url').value.trim();if(!u.toLowerCase().startsWith('http://')&&!u.toLowerCase().startsWith('https://'))u='https://'+u;let m=data[cat];if(editing===null){try{const {data:r,error}=await db.from('links').insert({category:m.name,title,url:u,user_id:currentUser.id}).select().single();if(!error)m.links.push(r);else throw Error()}catch{m.links.push({id:crypto.randomUUID(),title,url:u});saveLocal()};toast('链接已添加')}else{const r=m.links[editing];try{await db.from('links').update({title,url:u}).eq('id',r.id)}catch{}Object.assign(r,{title,url:u});saveLocal();toast('链接已更新')}$('#modal').close();render()};
window.editLink=(m,l)=>openModal(m,l);window.removeLink=async(m,l)=>{if(!confirm('删除此网页？'))return;try{await db.from('links').delete().eq('id',data[m].links[l].id)}catch{}data[m].links.splice(l,1);saveLocal();render();toast('链接已删除')};window.renameCat=async i=>{const n=prompt('模块名称',data[i].name)?.trim();if(!n||n===data[i].name)return;try{for(const l of data[i].links)await db.from('links').update({category:n}).eq('id',l.id);await db.from('categories').update({name:n}).eq('id',data[i].id)}catch{}data[i].name=n;saveLocal();render()};window.removeCat=async i=>{
  const module=data[i];
  if(!module||!currentUser)return;
  if(!confirm('删除此模块及其中的全部网页？'))return;
  try{
    for(const link of module.links){
      const result=await db.from('links').delete().eq('id',link.id).eq('user_id',currentUser.id).select('id').single();
      if(result.error)throw result.error;
    }
    if(module.id){
      const result=await db.from('categories').delete().eq('id',module.id).eq('user_id',currentUser.id).select('id').single();
      if(result.error)throw result.error;
    }
    data.splice(data.indexOf(module),1);
    saveLocal();render();toast('模块已删除');
  }catch(error){
    await load();
    toast('删除未完成：'+(error.message||'请检查网络或数据库权限'));
  }
};$('#addCategory').onclick=async()=>{const n=prompt('新模块名称')?.trim();if(!n)return;if(data.some(m=>m.name===n))return toast('模块名称已存在');let item={name:n,links:[]};try{const {data:r,error}=await db.from('categories').insert({name:n,user_id:currentUser.id}).select().single();if(!error)item.id=r.id}catch{}data.push(item);saveLocal();render();toast('模块已创建')};
// Authentication and password recovery are initialized in auth.js.

// Drag identity is held in this page, never inferred from an empty DataTransfer value.
let activeDrag = null;
let savingDrag = false;
let sortQueue = Promise.resolve();
let sortGeneration = 0;
let pendingSortSaves = 0;
let recoveringSort = false;

async function withSortTimeout(operation) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('排序请求超时，请检查网络后重试'));
    }, 10000);
  });
  try { return await Promise.race([operation(controller.signal), timeout]); }
  finally { clearTimeout(timer); }
}
window.endDrag = () => {
  activeDrag = null;
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
};
function startDrag(e, payload) {
  e.stopPropagation();
  if (recoveringSort || e.target.closest('button,input')) {
    e.preventDefault();
    return;
  }
  activeDrag = payload;
  e.dataTransfer.clearData();
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('application/x-neonhub', payload.kind);
}
window.dragModule = (e, i) => startDrag(e, {kind: 'module', module: data[i]});
window.dragLink = (e, m, l) => startDrag(e, {kind: 'link', module: data[m], link: data[m].links[l]});
window.dragOver = e => {
  if (!activeDrag || recoveringSort) return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  e.currentTarget.classList.add('drop-target');
};
window.dropModule = (e, i) => finishDrop(e, i, null);
window.dropLink = (e, m, l) => finishDrop(e, m, l);

async function finishDrop(e, targetIndex, linkIndex) {
  e.preventDefault();
  e.stopPropagation();
  const drag = activeDrag;
  endDrag();
  if (!drag || recoveringSort || !data[targetIndex]) return;
  const sourceIndex = data.indexOf(drag.module);
  if (sourceIndex < 0) return;
  const next = data.map(m => ({...m, links: m.links.map(l => ({...l}))}));
  let writes;

  if (drag.kind === 'module') {
    if (sourceIndex === targetIndex) return;
    const [module] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, module);
    writes = next.map((m, i) => {
      m.sort_order = i;
      return {table: 'categories', id: m.id, values: {sort_order: i}};
    });
  } else if (drag.kind === 'link') {
    const from = data[sourceIndex].links.indexOf(drag.link);
    if (from < 0) return;
    const same = sourceIndex === targetIndex;
    if (same && from === linkIndex) return;
    const [link] = next[sourceIndex].links.splice(from, 1);
    // Dropping on a row inserts before it; dropping on the module appends.
    let at = linkIndex === null ? next[targetIndex].links.length : linkIndex;
    if (same && linkIndex !== null && from < linkIndex) at--;
    if (same && at === from) return;
    link.category = next[targetIndex].name;
    next[targetIndex].links.splice(at, 0, link);
    writes = [...new Set([sourceIndex, targetIndex])].flatMap(i => next[i].links.map((l, n) => {
      l.sort_order = n;
      return {table: 'links', id: l.id, values: {category: next[i].name, sort_order: n}};
    }));
  } else return;
  if (!currentUser || writes.some(w => !w?.id)) {
    toast('无法保存拖动：请先登录并确认模块和网页已保存到云端');
    return;
  }
  const previous = data;
  const ownerId = currentUser.id;
  const oldRows = new Map();
  for (const m of previous) {
    oldRows.set('categories:' + m.id, m);
    for (const l of m.links) oldRows.set('links:' + l.id, {...l, category: m.name});
  }
  writes = writes.filter(w => {
    const old = oldRows.get(w.table + ':' + w.id);
    return !old || Object.entries(w.values).some(([key, value]) => old[key] !== value);
  });
  savingDrag = true;
  pendingSortSaves++;
  const generation = sortGeneration;
  // Render immediately; ordinary links stay clickable during cloud persistence.
  data = next;
  render();
  setSortBusy(true);
  const task = sortQueue.then(async () => {
  try {
    if (generation !== sortGeneration || currentUser?.id !== ownerId) return;
    const results = await Promise.allSettled(writes.map(async w => {
      const result = await withSortTimeout(signal => db.from(w.table).update(w.values)
        .eq('id', w.id).eq('user_id', ownerId).select('id').abortSignal(signal).single());
      if (result.error) throw result.error;
      if (!result.data) throw new Error('未更新到云端记录');
    }));
    // Wait for every request before reading back a partially completed batch.
    const failure = results.find(r => r.status === 'rejected');
    if (failure) throw failure.reason;
    if (currentUser?.id === ownerId) saveLocal(next);
  } catch (error) {
    sortGeneration++;
    recoveringSort = true;
    endDrag();
    if (currentUser?.id !== ownerId) return;
    data = previous;
    render();
    setSortBusy(true);
    try {
      const [categories, links] = await withSortTimeout(signal => Promise.all([
        db.from('categories').select('id,name,sort_order').eq('user_id',ownerId).order('sort_order').order('created_at').order('id').abortSignal(signal),
        db.from('links').select('id,category,title,url,sort_order').eq('user_id',ownerId).order('sort_order').order('created_at').order('id').abortSignal(signal)
      ]));
      if (categories.error || links.error) throw categories.error || links.error;
      if (currentUser?.id !== ownerId) return;
      const names = [...new Set([...categories.data.map(c=>c.name), ...links.data.map(l=>l.category)])];
      data = names.map(name => ({...categories.data.find(c=>c.name===name), name, links:links.data.filter(l=>l.category===name)}));
      saveLocal();
      render();
      toast('排序未完整保存，已重新读取云端数据：' + (error.message || '网络错误'));
    } catch {
      toast('排序保存失败，已恢复拖动前的显示；云端状态暂无法确认，请联网后刷新：' + (error.message || '网络错误'));
    }
  } finally {
    recoveringSort = false;
    pendingSortSaves--;
    savingDrag = pendingSortSaves > 0;
    setSortBusy(savingDrag);
  }
  });
  sortQueue = task.catch(() => {});
  return task;
}

function setSortBusy(busy) {
  // Prevent conflicting writes, without blocking navigation or reading the page.
  document.querySelectorAll('.module button, #addCategory, #form button[type="submit"], #form .primary').forEach(button => {button.disabled = busy;});
  // Keep drag handles available while a previous save is pending.
}

