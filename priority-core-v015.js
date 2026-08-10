const DATA_KEY='mesraah_v030';
const VERSION='0.15.0';
const GROUPS={start:{label:'ابدأ بها'},plan:{label:'خطط لها'},opportunity:{label:'أنجزها عند الفرصة'},review:{label:'راجع أهميتها'}};
function clamp(v){const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=5?n:null}
function category(task){const impact=clamp(task?.impact),ease=clamp(task?.ease);if(!impact||!ease)return'';if(impact>=4&&ease>=4)return'start';if(impact>=4)return'plan';if(ease>=4)return'opportunity';return'review'}
function score(task){const impact=clamp(task?.impact),ease=clamp(task?.ease);if(!impact||!ease)return null;return Math.round(((impact*.65)+(ease*.35))/5*100)}
function assessed(task){return Boolean(clamp(task?.impact)&&clamp(task?.ease))}
function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return{}}}
function setAssessment(taskId,values={}){const state=readState(),task=(state.tasks||[]).find(t=>String(t.id)===String(taskId));if(!task)return false;task.impact=clamp(values.impact);task.ease=clamp(values.ease);localStorage.setItem(DATA_KEY,JSON.stringify(state));return true}
window.MesraahPriority=Object.freeze({version:VERSION,score,category,assessed,setAssessment,groups:GROUPS});
document.documentElement.dataset.mesraahPriorityVersion=VERSION;
