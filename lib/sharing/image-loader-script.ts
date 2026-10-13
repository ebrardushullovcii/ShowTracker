/** Export covers must be readable by canvas, even after an ordinary app image warmed the HTTP cache. */
export const imageLoaderScript = String.raw`
function loadImage(url){
  if(!url)return Promise.resolve(null);
  if(!imageCache.has(url)){
    const promise=new Promise(resolve=>{
      const controller=new AbortController();let img=null,objectUrl='',done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);if(objectUrl)URL.revokeObjectURL(objectUrl);resolve(value);};
      const timer=setTimeout(()=>{controller.abort();if(img){img.onload=img.onerror=null;img.src='';}finish(null);},15000);
      (async()=>{
        try{
          let source=url;
          if(!url.startsWith('data:image/')){
            // Image CDNs can omit CORS headers on normal image requests without Vary: Origin.
            // Reusing that response blocks canvas exports. Fetch a fresh readable response instead.
            const response=await fetch(url,{mode:'cors',cache:'reload',credentials:'omit',signal:controller.signal});
            if(!response.ok)throw new Error('Cover request failed.');
            const blob=await response.blob();if(done)return;
            objectUrl=URL.createObjectURL(blob);source=objectUrl;
          }
          if(done)return;
          img=new Image();img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=source;
        }catch{finish(null);}
      })();
    });
    imageCache.set(url,promise);
    promise.then(img=>{promise._loaded=img;if(!img&&imageCache.get(url)===promise)imageCache.delete(url);});
  }
  return imageCache.get(url);
}
`;
