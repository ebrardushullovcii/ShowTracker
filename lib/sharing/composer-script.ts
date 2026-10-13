/** Runs in the export document on web and in the native WebView. */
import { imageLoaderScript } from "./image-loader-script";

export const composerScript = String.raw`
const SHOWS = PAYLOAD.shows;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = {selected:new Set(SHOWS.map(s=>s.id)),page:0,years:true,genres:false,missing:false,title:PAYLOAD.title,note:PAYLOAD.backlog?'I haven’t started these. Want to pick one together?':'Want to pick something to watch together?',name:'',sort:'original',context:PAYLOAD.backlog?'Not started':'Shared collection',collectionLabel:PAYLOAD.backlog?'PLANNED':'SHARED',drafts:new Map()};
let current=CONCEPTS[0], category='Text', revision=0, canvas=null, busy=false;
const imageCache=new Map();
const gameLinks=new Map(),shareRequests=new Map(),HOST_ORIGIN=NATIVE?'':parent.location.origin;let shareRequestId=0;
function resolveShareReply(message){const pending=shareRequests.get(message.requestId);if(!pending)return;shareRequests.delete(message.requestId);clearTimeout(pending.timer);if(message.error)pending.reject(new Error(message.error));else pending.resolve(message.result);}
function requestShare(data){return new Promise((resolve,reject)=>{const requestId=++shareRequestId,timer=setTimeout(()=>{shareRequests.delete(requestId);reject(new Error('The link request timed out. Try again.'));},45000);shareRequests.set(requestId,{resolve,reject,timer});const message={...data,requestId};try{if(NATIVE)bridge(message);else parent.postMessage(message,HOST_ORIGIN);}catch(error){clearTimeout(timer);shareRequests.delete(requestId);reject(error);}});}
window.addEventListener('message',e=>{if(e.source===parent&&e.origin===HOST_ORIGIN&&e.data?.type==='game-link-reply')resolveShareReply(e.data);});
function gameSnapshot(list){return {mode:'duel',title:state.title,note:state.note,name:state.name,shows:list.map(s=>({...s}))};}
function gameCard(list){
  const link=gameLinks.get(JSON.stringify(gameSnapshot(list))),shown=list.slice(0,list.length>8?7:8);
  const posters=shown.map(s=>'<span class="game-cover" title="'+esc(s.title)+'"><span>'+esc(s.title.slice(0,1))+'</span>'+(s.poster?'<img src="'+esc(s.poster)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">':'')+'</span>').join('')+(list.length>8?'<span class="game-cover">+'+(list.length-7)+'</span>':'');
  return '<div class="game-creator"><div class="game-head"><small>THIS OR THAT</small>'+(link?'<span class="game-ready">Link ready</span>':'')+'</div><h2>'+esc(state.title||'What should we watch?')+'</h2><p class="game-count">'+list.length+' '+(list.length===1?'show':'shows')+' · '+Math.max(0,list.length-1)+' '+(list.length===2?'pick':'picks')+' to a winner</p><div class="game-posters" aria-hidden="true">'+posters+'</div>'+(state.note||state.name?'<p class="game-note">'+(state.note?'“'+esc(state.note)+'”':'')+(state.name?'<span>From '+esc(state.name)+'</span>':'')+'</p>':'')+'</div>';
}
function renderGameLink(list){
  const snapshot=gameSnapshot(list),key=JSON.stringify(snapshot),link=gameLinks.get(key),box=$('#game-link');box.hidden=false;
  if(!link){if(list.length<2){box.innerHTML='<p class="game-warning">Include at least two shows to play This or that.</p>';return;}box.innerHTML='<p class="privacy">Anyone with the link can play without signing in. Links expire after 30 days.</p>';action('Create share link',async()=>{const created=await requestShare({type:'create-game-link',snapshot});gameLinks.set(key,created);render();},true);return;}
  box.innerHTML='<label class="field">Share link<input id="share-url" aria-label="Share link" readonly value="'+esc(link.url)+'"></label><p class="privacy">Anyone with the link can play. It expires in 30 days, or remove it any time.</p>';
  action('Copy link',()=>copyText(link.url),true);action('Share link',()=>shareText(link.url));
  if(NATIVE)action('Open game',()=>bridge({type:'open-game',token:link.token}));
  else{const a=document.createElement('a');a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open game';a.className='game-open';$('#actions').append(a);}
  action('Remove link',async()=>{await requestShare({type:'revoke-game-link',token:link.token});gameLinks.delete(key);render();toast('Link removed. It can no longer be opened.');});$('#actions').lastElementChild.classList.add('quiet');
}
function toast(message){$('#notice').textContent=message;}
function selectedShows(){const list=SHOWS.filter(s=>state.selected.has(s.id));if(state.sort==='title')list.sort((a,b)=>a.title.localeCompare(b.title));if(state.sort==='genre')list.sort((a,b)=>(a.genres[0]||'').localeCompare(b.genres[0]||''));return list;}
function chunks(list,size){return Array.from({length:Math.ceil(list.length/size)},(_,i)=>list.slice(i*size,(i+1)*size));}
${imageLoaderScript}
async function prepare(list){let cursor=0;await Promise.all(Array.from({length:Math.min(4,list.length)},async()=>{while(cursor<list.length){const show=list[cursor++];await loadImage(show.poster);}}));await loadImage(BRAND);}
function reset(){state.page=0;state.drafts.clear();refreshSelection();render();}
function refreshSelection(){
  const q=$('#selection-search').value.toLowerCase();$('#selected-count').textContent=selectedShows().length+' of '+SHOWS.length+' included';
  $('#selection').innerHTML=SHOWS.filter(s=>s.title.toLowerCase().includes(q)).map(s=>'<label class="selection-row"><input type="checkbox" data-select="'+esc(s.id)+'" '+(state.selected.has(s.id)?'checked':'')+'><span>'+esc(s.title)+'<small>'+esc([s.year,s.kind].filter(Boolean).join(' · '))+'</small></span>'+'</label>').join('');
  $$('[data-select]').forEach(b=>b.onchange=()=>{if(b.checked)state.selected.add(b.dataset.select);else state.selected.delete(b.dataset.select);reset();});
}
function formats(){
  $$('[data-category]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.category===category));
  $('#format').innerHTML=CONCEPTS.filter(c=>c.tag===category).map(c=>'<option value="'+c.slug+'">'+esc(c.name)+'</option>').join('');$('#format').value=current.slug;
}
function pagesFor(list){return current.format==='text'?textPages(current,list,state):current.format==='game'?[list]:chunks(list,current.cap);}
function editedMessages(list){return textPages(current,list,state).map((text,i)=>state.drafts.get(i)??text);}
async function render(){
  const token=++revision,list=selectedShows(),pages=pagesFor(list);state.page=Math.max(0,Math.min(state.page,pages.length-1));canvas=null;
  toast('');
  $('#description').textContent=current.layout==='grid'&&list.length===1?'One large poster with the title, year, and your message.':current.desc;
  $('#scope').textContent=list.length+' '+(list.length===1?'show':'shows')+' · all included titles';
  $('#prev').disabled=!state.page;$('#next').disabled=state.page>=pages.length-1;$('#page').textContent=pages.length?'Page '+(state.page+1)+' of '+pages.length:'';
  const game=current.format==='game';$('#format-field').hidden=game;$('#export-details').hidden=game;$('#pagination').hidden=game;$('#stage-title').textContent=game?'Game creator':'Preview';$('#edit-summary').textContent=game?'Edit game & shows':'Edit selection & message';$('#scope').hidden=game;$('#game-link').hidden=true;$('#game-link').innerHTML='';
  $('#preview').innerHTML='';$('#actions').innerHTML='';
  if(!list.length){$('#preview').innerHTML='<div class="empty"><h3>No shows included</h3><p>Open '+(game?'Edit game & shows':'Edit selection & message')+' to include titles.</p></div>';return;}
  if(current.format==='text'){
    const area=document.createElement('textarea');area.id='text-output';area.setAttribute('aria-label','Editable export text');area.value=state.drafts.get(state.page)??pages[state.page];area.oninput=()=>state.drafts.set(state.page,area.value);$('#preview').append(area);
    action('Copy text',()=>copyText(area.value),true);action('Share text',()=>shareText(area.value));action('Save .txt',()=>saveBlob(new Blob([editedMessages(list).join('\n\n———\n\n')],{type:'text/plain;charset=utf-8'}),'showtracker-shows.txt'));
    if(pages.length>1)action('Copy all messages',()=>copyText(editedMessages(list).join('\n\n———\n\n')));
    if(list.length===1&&list[0].appUrl)action('Copy show link',()=>copyText(list[0].appUrl));return;
  }
  if(game){$('#preview').innerHTML=gameCard(list);renderGameLink(list);return;}
  $('#preview').innerHTML='<p class="loading" role="status">Preparing preview…</p>';
  await prepare(pages[state.page]);if(token!==revision)return;
  const visualFormat=list.length===1&&current.layout==='grid'?{...current,layout:'single'}:current;
  canvas=renderCanvas(visualFormat,pages[state.page],state.page,pages.length,{...state,totalCount:list.length});$('#preview').replaceChildren(canvas);
  const missing=pages[state.page].filter(s=>s.poster&&!imageCache.get(s.poster)?._loaded).length;if(missing)toast(missing+' covers unavailable on this page. Their titles are still included.');
  action(NATIVE?'Save or share image':'Save this PNG',async()=>saveBlob(await canvasBlob(canvas),filename(state.page)),true);
  if(!NATIVE)action('Share image',shareImage);
  if(pages.length>1)action(NATIVE?'Share all images (.zip)':'Save all images (.zip)',downloadAll);
}
function action(label,callback,primary=false){const button=document.createElement('button');button.textContent=label;button.className=primary?'primary':'';button.disabled=busy;button.onclick=async()=>{if(busy)return;busy=true;$$('#actions button').forEach(b=>b.disabled=true);try{await callback();}catch(error){toast(error.message||'Could not export. Try again.');}finally{busy=false;$$('#actions button').forEach(b=>b.disabled=false);}};$('#actions').append(button);}
function bridge(data){window.ReactNativeWebView.postMessage(JSON.stringify(data));}
async function copyText(text){if(NATIVE){bridge({type:'copy',text});return;}try{await navigator.clipboard.writeText(text);toast('Copied. Paste it into your chat.');}catch{const area=document.createElement('textarea');area.value=text;$('#notice').after(area);area.select();let copied=false;try{copied=document.execCommand('copy');}catch{}if(copied){area.remove();toast('Copied.');}else toast('Copy is blocked. Select the text below or save the file.');}}
async function shareText(text){if(NATIVE){bridge({type:'share-text',text});return;}if(!navigator.share){toast(current.format==='game'?'This browser has no share menu. Use Copy link.':'This browser has no share menu. Use Copy text or Save .txt.');return;}try{await navigator.share({text});}catch(e){if(e.name!=='AbortError')throw e;}}
async function saveBlob(blob,name){if(NATIVE){const reader=new FileReader();reader.onload=()=>bridge({type:'file',name,mime:blob.type,base64:String(reader.result).split(',')[1]});reader.readAsDataURL(blob);return;}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Downloaded '+name);}
function filename(page){return 'showtracker-'+current.slug+'-'+String(page+1).padStart(2,'0')+'.png';}
function canvasBlob(c){return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed.')),'image/png'));}
async function shareImage(){const file=new File([await canvasBlob(canvas)],filename(state.page),{type:'image/png'});if(!navigator.canShare?.({files:[file]})){toast('This browser cannot share image files. Save the PNG and attach it in your chat.');return;}try{await navigator.share({files:[file],title:state.title});}catch(e){if(e.name!=='AbortError')throw e;}}
async function downloadAll(){const list=selectedShows(),pages=chunks(list,current.cap),files=[],format=current,options={...state,totalCount:list.length};for(let i=0;i<pages.length;i++){toast('Preparing image '+(i+1)+' of '+pages.length+'…');await prepare(pages[i]);const c=renderCanvas(format,pages[i],i,pages.length,options);files.push({name:'showtracker-'+format.slug+'-'+String(i+1).padStart(2,'0')+'.png',data:new Uint8Array(await (await canvasBlob(c)).arrayBuffer())});c.width=1;c.height=1;}files.push({name:'shows.txt',data:new TextEncoder().encode(fullText(CONCEPTS[0],list,options))});await saveBlob(zipFiles(files),'showtracker-'+format.slug+'.zip');}
$$('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;current=CONCEPTS.find(c=>c.tag===category);formats();reset();});
$('#format').onchange=e=>{current=CONCEPTS.find(c=>c.slug===e.target.value);reset();};
[['heading','title'],['note','note'],['sender','name']].forEach(([id,key])=>{$('#'+id).value=state[key];$('#'+id).oninput=e=>{state[key]=e.target.value;state.drafts.clear();render();};});
['years','genres'].forEach(key=>$('#'+key).onchange=e=>{state[key]=e.target.checked;state.drafts.clear();render();});
$('#sort').onchange=e=>{state.sort=e.target.value;reset();};$('#selection-search').oninput=refreshSelection;
$('#select-all').onclick=()=>{state.selected=new Set(SHOWS.map(s=>s.id));reset();};$('#select-none').onclick=()=>{state.selected.clear();reset();};
$('#prev').onclick=()=>{state.page--;render();};$('#next').onclick=()=>{state.page++;render();};
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!NATIVE)parent.postMessage({type:'showtracker-close-share'},HOST_ORIGIN);});
formats();refreshSelection();render();
`;
