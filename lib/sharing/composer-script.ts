/** Runs in the export document on web and in the native WebView. */
export const composerScript = String.raw`
const SHOWS = PAYLOAD.shows;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = {selected:new Set(SHOWS.map(s=>s.id)),pins:new Set(),picks:new Set(),page:0,years:true,genres:false,missing:false,title:PAYLOAD.title,note:PAYLOAD.backlog?'I haven’t started these. Want to pick one together?':'Want to pick something to watch together?',name:'',sort:'original',context:PAYLOAD.backlog?'Not started':'Shared collection',collectionLabel:PAYLOAD.backlog?'PLANNED':'SHARED',drafts:new Map()};
let current=CONCEPTS[0], category='Text', revision=0, canvas=null, recipientHtml='', busy=false;
const imageCache=new Map();
function toast(message){$('#notice').textContent=message;}
function selectedShows(){const list=SHOWS.filter(s=>state.selected.has(s.id));if(state.sort==='title')list.sort((a,b)=>a.title.localeCompare(b.title));if(state.sort==='genre')list.sort((a,b)=>(a.genres[0]||'').localeCompare(b.genres[0]||''));return list;}
function outputShows(){const list=selectedShows();return current.layout==='trio'?list.filter(s=>state.pins.has(s.id)):list;}
function chunks(list,size){return Array.from({length:Math.ceil(list.length/size)},(_,i)=>list.slice(i*size,(i+1)*size));}
function loadImage(url){
  if(!url)return Promise.resolve(null);
  if(!imageCache.has(url)){
    const promise=new Promise(resolve=>{const img=new Image();let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};const timer=setTimeout(()=>{img.src='';finish(null);},8000);img.crossOrigin='anonymous';img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=url;});
    imageCache.set(url,promise);promise.then(img=>promise._loaded=img);
  }
  return imageCache.get(url);
}
async function prepare(list){let cursor=0;await Promise.all(Array.from({length:Math.min(4,list.length)},async()=>{while(cursor<list.length){const show=list[cursor++];await loadImage(show.poster);}}));await loadImage(BRAND);}
function imageData(url){const img=imageCache.get(url)?._loaded;if(!img)return '';try{const c=document.createElement('canvas');c.width=Math.min(342,img.width);c.height=Math.round(img.height*c.width/img.width);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8);}catch{return '';}}
function reset(){state.page=0;state.drafts.clear();state.picks.clear();refreshSelection();render();}
function refreshSelection(){
  const q=$('#selection-search').value.toLowerCase();$('#selected-count').textContent=selectedShows().length+' of '+SHOWS.length+' included';
  $('#selection').innerHTML=SHOWS.filter(s=>s.title.toLowerCase().includes(q)).map(s=>'<label class="selection-row"><input type="checkbox" data-select="'+esc(s.id)+'" '+(state.selected.has(s.id)?'checked':'')+'><span>'+esc(s.title)+'<small>'+esc([s.year,s.kind].filter(Boolean).join(' · '))+'</small></span>'+(current.layout==='trio'?'<button type="button" data-pin="'+esc(s.id)+'" aria-label="Shortlist '+esc(s.title)+'" aria-pressed="'+state.pins.has(s.id)+'">'+(state.pins.has(s.id)?'★':'☆')+'</button>':'')+'</label>').join('');
  $$('[data-select]').forEach(b=>b.onchange=()=>{if(b.checked)state.selected.add(b.dataset.select);else{state.selected.delete(b.dataset.select);state.pins.delete(b.dataset.select);}reset();});
  $$('[data-pin]').forEach(b=>b.onclick=e=>{e.preventDefault();const id=b.dataset.pin;if(state.pins.has(id))state.pins.delete(id);else{if(state.pins.size>=3){toast('Choose up to three. Unstar one to swap it.');return;}state.pins.add(id);state.selected.add(id);}reset();});
}
function formats(){
  $$('[data-category]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.category===category));
  $('#format').innerHTML=CONCEPTS.filter(c=>c.tag===category).map(c=>'<option value="'+c.slug+'">'+esc(c.name)+'</option>').join('');$('#format').value=current.slug;
}
function pagesFor(list){return current.format==='text'?textPages(current,list,state):current.format==='recipient'?[list]:chunks(list,current.cap);}
function editedMessages(list){return textPages(current,list,state).map((text,i)=>state.drafts.get(i)??text);}
async function render(){
  const token=++revision,list=outputShows(),pages=pagesFor(list);state.page=Math.max(0,Math.min(state.page,pages.length-1));canvas=null;recipientHtml='';
  $('#description').textContent=current.layout==='grid'&&list.length===1?'One large poster with the title, year, and your message.':current.desc;
  $('#scope').textContent=list.length+' '+(list.length===1?'show':'shows')+' · '+(current.layout==='trio'?selectedShows().length+' included · shortlist':'all included titles');
  $('#prev').disabled=!state.page;$('#next').disabled=state.page>=pages.length-1;$('#page').textContent=pages.length?'Page '+(state.page+1)+' of '+pages.length:'';
  $('#shortlist-help').hidden=current.layout!=='trio';$('#duel').hidden=current.layout!=='duel';
  $('#preview').innerHTML='';$('#actions').innerHTML='';
  if(!list.length){$('#preview').innerHTML='<div class="empty"><h3>'+ (current.layout==='trio'?'Choose your three picks':'No shows included')+'</h3><p>'+(current.layout==='trio'?'Open Edit selection & message and star up to three titles.':'Open Edit selection & message to include titles.')+'</p></div>';return;}
  if(current.format==='text'){
    const area=document.createElement('textarea');area.id='text-output';area.setAttribute('aria-label','Editable export text');area.value=state.drafts.get(state.page)??pages[state.page];area.oninput=()=>state.drafts.set(state.page,area.value);$('#preview').append(area);
    action('Copy text',()=>copyText(area.value),true);action('Share text',()=>shareText(area.value));action('Save .txt',()=>saveBlob(new Blob([editedMessages(list).join('\n\n———\n\n')],{type:'text/plain;charset=utf-8'}),'showtracker-shows.txt'));
    if(pages.length>1)action('Copy all messages',()=>copyText(editedMessages(list).join('\n\n———\n\n')));
    if(list.length===1&&list[0].appUrl)action('Copy show link',()=>copyText(list[0].appUrl));return;
  }
  $('#preview').innerHTML='<p class="loading" role="status">Preparing preview…</p>';
  if(current.format==='recipient'){
    const html=await recipientDocument(list,current.layout==='ballot');if(token!==revision)return;recipientHtml=html;
    const frame=document.createElement('iframe');frame.title='Try the recipient’s view';frame.srcdoc=html;frame.className='recipient-preview';frame.allow='clipboard-write';$('#preview').replaceChildren(frame);
    action('Save recipient page (.html)',()=>saveBlob(new Blob([recipientHtml],{type:'text/html;charset=utf-8'}),'showtracker-shared-shows.html'),true);action('Copy text list',()=>copyText(fullText(CONCEPTS[0],list,state)));
    $('#description').textContent='Your friend opens the downloaded file, picks shows, and copies a reply. Picks stay in that page. No login or synced votes.';return;
  }
  await prepare(pages[state.page]);if(token!==revision)return;
  const visualFormat=list.length===1&&current.layout==='grid'?{...current,layout:'single'}:current;
  canvas=renderCanvas(visualFormat,pages[state.page],state.page,pages.length,{...state,totalCount:list.length});$('#preview').replaceChildren(canvas);
  const missing=pages[state.page].filter(s=>s.poster&&!imageCache.get(s.poster)?._loaded).length;if(missing)toast(missing+' covers unavailable on this page. Their titles are still included.');
  action(NATIVE?'Save or share image':'Save this PNG',async()=>saveBlob(await canvasBlob(canvas),filename(state.page)),true);
  if(!NATIVE)action('Share image',shareImage);
  if(pages.length>1)action(NATIVE?'Share all images (.zip)':'Save all images (.zip)',downloadAll);
  if(current.layout==='duel'){
    ['a','b'].forEach((key,i)=>{$('#pick-'+key).disabled=!pages[state.page][i];$('#pick-'+key).onclick=()=>{state.picks.add(pages[state.page][i].id);state.page=Math.min(state.page+1,pages.length-1);render();};});
    $('#copy-picks').disabled=!state.picks.size;$('#copy-picks').textContent='Copy my '+state.picks.size+' picks';
  }
}
function action(label,callback,primary=false){const button=document.createElement('button');button.textContent=label;button.className=primary?'primary':'';button.disabled=busy;button.onclick=async()=>{if(busy)return;busy=true;$$('#actions button').forEach(b=>b.disabled=true);try{await callback();}catch(error){toast(error.message||'Could not export. Try again.');}finally{busy=false;$$('#actions button').forEach(b=>b.disabled=false);}};$('#actions').append(button);}
function bridge(data){window.ReactNativeWebView.postMessage(JSON.stringify(data));}
async function copyText(text){if(NATIVE){bridge({type:'copy',text});return;}try{await navigator.clipboard.writeText(text);toast('Copied. Paste it into your chat.');}catch{const area=document.createElement('textarea');area.value=text;$('#notice').after(area);area.select();let copied=false;try{copied=document.execCommand('copy');}catch{}if(copied){area.remove();toast('Copied.');}else toast('Copy is blocked. Select the text below or save the file.');}}
async function shareText(text){if(NATIVE){bridge({type:'share-text',text});return;}if(!navigator.share){toast('This browser has no share menu. Use Copy text or Save .txt.');return;}try{await navigator.share({text});}catch(e){if(e.name!=='AbortError')throw e;}}
async function saveBlob(blob,name){if(NATIVE){const reader=new FileReader();reader.onload=()=>bridge({type:'file',name,mime:blob.type,base64:String(reader.result).split(',')[1]});reader.readAsDataURL(blob);return;}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Downloaded '+name);}
function filename(page){return 'showtracker-'+current.slug+'-'+String(page+1).padStart(2,'0')+'.png';}
function canvasBlob(c){return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed.')),'image/png'));}
async function shareImage(){const file=new File([await canvasBlob(canvas)],filename(state.page),{type:'image/png'});if(!navigator.canShare?.({files:[file]})){toast('This browser cannot share image files. Save the PNG and attach it in your chat.');return;}try{await navigator.share({files:[file],title:state.title});}catch(e){if(e.name!=='AbortError')throw e;}}
async function downloadAll(){const list=outputShows(),pages=chunks(list,current.cap),files=[],format=current,options={...state,totalCount:list.length};for(let i=0;i<pages.length;i++){toast('Preparing image '+(i+1)+' of '+pages.length+'…');await prepare(pages[i]);const c=renderCanvas(format,pages[i],i,pages.length,options);files.push({name:'showtracker-'+format.slug+'-'+String(i+1).padStart(2,'0')+'.png',data:new Uint8Array(await (await canvasBlob(c)).arrayBuffer())});c.width=1;c.height=1;}files.push({name:'shows.txt',data:new TextEncoder().encode(fullText(CONCEPTS[0],list,options))});await saveBlob(zipFiles(files),'showtracker-'+format.slug+'.zip');}
async function recipientDocument(list,ballot){
  await prepare(list);const shows=list.map(s=>({...s,year:state.years?s.year:'',poster:imageData(s.poster)}));
  const genreList=[...new Set(shows.flatMap(s=>s.genres))].sort();
  const markup='<header class="recipient-head"><small>SHOWTRACKER · SHARED SHOWS</small><h1>'+esc(state.title||'Shared shows')+'</h1><p>'+esc(state.note)+(state.name?'<br>From '+esc(state.name):'')+'</p><p>'+shows.length+' shows</p><div class="recipient-tools"><input id="recipient-search" type="search" placeholder="Search shows" aria-label="Search shared shows"><select id="recipient-genre" aria-label="Filter by genre"><option value="all">All genres</option>'+genreList.map(g=>'<option>'+esc(g)+'</option>').join('')+'</select></div></header><div id="recipient-items" class="'+(ballot?'ballot-list':'recipient-grid')+'"></div><div class="recipient-bottom"><span id="picks-count"></span><div><button id="clear-picks">Clear picks</button><button id="reply-picks" class="primary">Copy my reply</button></div></div><p class="sources">Picks stay in this opened page. Copy your reply and send it back in your chat.</p>';
  const script='const shows='+JSON.stringify(shows).replace(/</g,'\\u003c')+';const ballot='+ballot+';const picks=new Set();const esc='+esc.toString()+';('+recipientOffline.toString()+')();';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(state.title||'Shared shows')+'</title><style>'+RECIPIENT_CSS+'</style></head><body><main class="recipient">'+markup+'</main><script>'+script+'</scr'+'ipt></body></html>';
}
$$('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;current=CONCEPTS.find(c=>c.tag===category);formats();reset();});
$('#format').onchange=e=>{current=CONCEPTS.find(c=>c.slug===e.target.value);reset();};
[['heading','title'],['note','note'],['sender','name']].forEach(([id,key])=>{$('#'+id).value=state[key];$('#'+id).oninput=e=>{state[key]=e.target.value;state.drafts.clear();render();};});
['years','genres'].forEach(key=>$('#'+key).onchange=e=>{state[key]=e.target.checked;state.drafts.clear();render();});
$('#sort').onchange=e=>{state.sort=e.target.value;reset();};$('#selection-search').oninput=refreshSelection;
$('#select-all').onclick=()=>{state.selected=new Set(SHOWS.map(s=>s.id));reset();};$('#select-none').onclick=()=>{state.selected.clear();state.pins.clear();reset();};
$('#prev').onclick=()=>{state.page--;render();};$('#next').onclick=()=>{state.page++;render();};
$('#shuffle').onclick=()=>{state.page=Math.floor(Math.random()*Math.ceil(outputShows().length/2));render();};
$('#copy-picks').onclick=()=>copyText('I’d watch these together:\n'+outputShows().filter(s=>state.picks.has(s.id)).map(s=>'• '+s.title).join('\n'));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!NATIVE)parent.postMessage({type:'showtracker-close-share'},location.origin);});
formats();refreshSelection();render();
`;
