/* Local-only translation of static and dynamically rendered UI text.
 * Original text is retained per node so switching languages is reversible.
 */
(() => {
 const normalize=s=>String(s).replace(/\s+/g,' ').trim();
 const dictionaries=window.UI_TRANSLATIONS||{};
 const weekdayLabels = {en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],ja:['日','月','火','水','木','金','土'],zh:['日','一','二','三','四','五','六'],'zh-TW':['日','一','二','三','四','五','六'],es:['dom','lun','mar','mié','jue','vie','sáb'],fr:['dim','lun','mar','mer','jeu','ven','sam'],de:['So','Mo','Di','Mi','Do','Fr','Sa'],ko:['일','월','화','수','목','금','토']};
 const sources=Object.keys(dictionaries.en||{});
 const exact=new Map(),patterns=[];
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const s of sources){
  if(/\{\d+\}/.test(s)){
   const ids=[];let last=0,rx='^';
   for(const match of s.matchAll(/\{(\d+)\}/g)){rx+=escape(s.slice(last,match.index))+'([\\s\\S]*?)';ids.push(match[1]);last=match.index+match[0].length;}
   rx+=escape(s.slice(last))+'$';
   patterns.push({source:s,rx:new RegExp(rx),ids,weight:s.replace(/\{\d+\}/g,'').length});
  }else exact.set(s,s);
 }
 patterns.sort((a,b)=>b.weight-a.weight);
 const known=new Map();
 for(const [key,ko] of Object.entries(I18N.dictionaries.ko)) known.set(normalize(ko),key);
 const cache=new Map();
 function translate(raw,lang=I18N.currentLang,depth=0){
  if(lang==='ko')return raw;
  const s=normalize(raw),cacheKey=lang+'\0'+s;
  if(cache.has(cacheKey))return cache.get(cacheKey);
  const dynamic=window.SumdokuDynI18n?.(s,lang);
  if(dynamic!=null){cache.set(cacheKey,dynamic);return dynamic;}
  const key=known.get(s);
  let out=key?I18N.dictionaries[lang]?.[key]:null;
  out=out||dictionaries[lang]?.[s];
  if(!out && depth<2)for(const p of patterns){
   const m=p.rx.exec(s);if(!m)continue;
   const template=dictionaries[lang]?.[p.source];if(!template)continue;
   const values={};p.ids.forEach((id,i)=>values[id]=translate(m[i+1],lang,depth+1));
   out=template.replace(/\{(\d+)\}/g,(token,id)=>values[id]??token);break;
  }
  out=out||raw;cache.set(cacheKey,out);return out;
 }
 I18N.text=translate;
 const records=new WeakMap(),attributes=new WeakMap();
 const skip='script,style,textarea,[contenteditable],.cell-custom-memo,.chat-msg,#chat-pop,.chat-message-text,[data-user-content]';
 function textNode(node){
  const parent=node.parentElement;if(!parent||parent.closest(skip)||parent.closest('select[id$="language"]'))return;
  if(parent.parentElement?.classList.contains('calendar-weekdays')) {
    const index=[...parent.parentElement.children].indexOf(parent);
    const output=weekdayLabels[I18N.currentLang]?.[index];
    if(output && node.nodeValue!==output)node.nodeValue=output;
    return;
  }
  const current=node.nodeValue;if(!current?.trim())return;
  let record=records.get(node);
  if(!record||current!==record.output)record={source:current,output:current};
  const output=translate(record.source);
  record.output=output;records.set(node,record);
  if(current!==output)node.nodeValue=output;
 }
 function element(el){
  if(!el?.getAttribute||(el.closest(skip)&&!el.matches('textarea,input')))return;

  let map=attributes.get(el);if(!map){map={};attributes.set(el,map);}
  for(const name of ['title','placeholder','aria-label','alt']){
   const value=el.getAttribute(name);if(!value)continue;
   let record=map[name];if(!record||record.output!==value)record={source:value};
   record.output=translate(record.source);map[name]=record;
   if(value!==record.output)el.setAttribute(name,record.output);
  }
 }
 function scan(root){
  if(root.nodeType===3){textNode(root);return;}
  if(root.nodeType!==1)return;
  element(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  let node;while(node=walker.nextNode()){if(node.nodeType===3)textNode(node);else element(node);}
 }
 window.addEventListener('DOMContentLoaded',()=>{
  const base=I18N.setLanguage.bind(I18N);
  I18N.setLanguage=lang=>{base(lang);scan(document.body);};
  scan(document.body);
  const queue=new Set();let scheduled=false;
  const observer=new MutationObserver(changes=>{
   for(const m of changes){if(m.type==='characterData'||m.type==='attributes')queue.add(m.target);else for(const n of m.addedNodes)queue.add(n);}
   if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;for(const n of queue)if(n.isConnected)scan(n);queue.clear();});}
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','alt']});
 });
})();
