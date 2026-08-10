const DATA_KEY='mesraah_v030';
const PRESERVE=['recurrence','recurrenceSeriesId','recurrenceOccurrence','impact','ease'];

function install(){
  if(window.__MESRAAH_V12_TASK_STATE_BRIDGE__)return;
  window.__MESRAAH_V12_TASK_STATE_BRIDGE__=true;
  const previousSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    if(this===localStorage&&key===DATA_KEY){
      try{
        const previous=JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{};
        const next=JSON.parse(String(value||'{}'))||{};
        const oldTasks=new Map((previous.tasks||[]).map(task=>[String(task.id),task]));
        next.tasks=(next.tasks||[]).map(task=>{
          const old=oldTasks.get(String(task.id));
          if(!old)return task;
          const merged={...task};
          for(const field of PRESERVE){
            if(!(field in merged)&&field in old)merged[field]=old[field];
          }
          return merged;
        });
        value=JSON.stringify(next);
      }catch{}
    }
    return previousSetItem.call(this,key,value);
  };
}

install();
