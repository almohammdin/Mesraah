import {TASK_TOOL_DECLARATIONS,executeTaskTool} from './mesraah-voice-tools.js?v=0.20.3';

const VIEW_IDS=['today','calendar','inbox','spaces','people','followups','achievements','rewards','manage'];
const TASK_FIELDS=['title','notes','date','time','location','space','person','status','priority','follow','points'];

export const MESRAAH_AGENT_TOOL_DECLARATIONS=[
  ...TASK_TOOL_DECLARATIONS,
  {name:'get_mesraah_context',description:'اقرأ حالة مسراح الحالية والواجهة المفتوحة ومسودة المهمة المفتوحة. استخدمها عندما تحتاج أحدث حالة قبل الشرح أو التنقل.',parametersJsonSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'navigate_to_view',description:'انتقل فعليا داخل مسراح إلى قسم أمام المستخدم. استخدمه بدلا من الاكتفاء بوصف مكان القسم.',parametersJsonSchema:{type:'object',properties:{view:{type:'string',enum:VIEW_IDS},reason:{type:'string'}},required:['view'],additionalProperties:false}},
  {name:'open_entity',description:'افتح فعليا صفحة مساحة أو شخص داخل مسراح بعد تحديده بالاسم أو المعرف.',parametersJsonSchema:{type:'object',properties:{kind:{type:'string',enum:['space','person']},id:{type:'string'},name:{type:'string'}},required:['kind'],additionalProperties:false}},
  {name:'open_new_task',description:'افتح نموذج مهمة جديدة أمام المستخدم فقط، بدون حفظ.',parametersJsonSchema:{type:'object',properties:{reason:{type:'string'}},additionalProperties:false}},
  {name:'open_task',description:'افتح مهمة موجودة أمام المستخدم للتفاصيل أو التعديل. استخدم taskId إذا كان معروفا وإلا query.',parametersJsonSchema:{type:'object',properties:{taskId:{type:'string'},query:{type:'string'}},additionalProperties:false}},
  {name:'focus_task_field',description:'حرك الواجهة إلى حقل داخل نموذج المهمة وميزه بصريا مع شرح قصير.',parametersJsonSchema:{type:'object',properties:{field:{type:'string',enum:TASK_FIELDS},message:{type:'string'}},required:['field'],additionalProperties:false}},
  {name:'set_task_field',description:'اكتب قيمة في حقل نموذج المهمة المفتوح أمام المستخدم بدون حفظ. التاريخ YYYY-MM-DD والوقت HH:MM. هذا تعديل لمسودة مرئية فقط.',parametersJsonSchema:{type:'object',properties:{field:{type:'string',enum:TASK_FIELDS},value:{type:'string'}},required:['field','value'],additionalProperties:false}},
  {name:'fill_task_draft',description:'املأ عدة حقول في نموذج المهمة المفتوح بالتتابع وبشكل مرئي أمام المستخدم، بدون حفظ. استخدمه عند إعطاء المستخدم تفاصيل مهمة كاملة.',parametersJsonSchema:{type:'object',properties:{title:{type:'string',description:'عنوان المهمة فقط'},notes:{type:'string',description:'ملاحظات إضافية'},date:{type:'string',description:'تاريخ الإنجاز بصيغة YYYY-MM-DD'},time:{type:'string',description:'الوقت بصيغة HH:MM بنظام 24 ساعة'},location:{type:'string',description:'اسم أو وصف المكان'},space:{type:'string',description:'اسم المساحة الموجودة في مسراح'},person:{type:'string',description:'اسم الشخص الموجود في مسراح'},status:{type:'string',enum:['inbox','active','waiting'],description:'حالة المهمة'},priority:{type:'string',enum:['normal','important','strategic'],description:'أهمية المهمة'},follow:{type:'string',description:'تاريخ المتابعة بصيغة YYYY-MM-DD'},points:{type:'string',enum:['5','10','20','30'],description:'نقاط الإنجاز'}},additionalProperties:false}},
  {name:'save_task',description:'احفظ نموذج المهمة المفتوح فعليا بعد أمر صريح بالحفظ أو الإضافة أو التسجيل. confirmed يجب أن تكون true فقط بعد أمر صريح من المستخدم.',parametersJsonSchema:{type:'object',properties:{confirmed:{type:'boolean'}},required:['confirmed'],additionalProperties:false}},
  {name:'close_task',description:'أغلق نموذج المهمة المفتوح بدون حفظ.',parametersJsonSchema:{type:'object',properties:{},additionalProperties:false}}
];

const TASK_TOOL_NAMES=new Set(TASK_TOOL_DECLARATIONS.map(tool=>tool.name));

export async function executeMesraahAgentTool(name,args={}){
  if(TASK_TOOL_NAMES.has(name))return executeTaskTool(name,args);
  const bridge=window.MesraahAgentBridge;
  if(!bridge)return {ok:false,error:'mesraah-agent-bridge-unavailable'};
  if(name==='get_mesraah_context')return {ok:true,context:bridge.getPlatformContext(),persisted:false};
  if(name==='navigate_to_view')return bridge.navigateToView(args.view,args.reason||'');
  if(name==='open_entity')return bridge.openEntity(args.kind,{id:args.id||'',name:args.name||''});
  if(name==='open_new_task')return bridge.openNewTask(args.reason||'');
  if(name==='open_task')return bridge.openTask({taskId:args.taskId||'',query:args.query||''});
  if(name==='focus_task_field')return bridge.focusTaskField(args.field,args.message||'');
  if(name==='set_task_field')return bridge.setTaskField(args.field,args.value);
  if(name==='fill_task_draft')return bridge.fillTaskDraft(args||{});
  if(name==='save_task')return bridge.saveTask(args.confirmed===true);
  if(name==='close_task')return bridge.closeTask();
  return {ok:false,error:'unknown-agent-tool'};
}
