const assert=require('node:assert/strict');
const {analyzeTasks,runPolicy}=require('./agent-policy');

const now=new Date('2026-09-13T08:00:00.000Z');
const state={
  agent:{enabled:true,settings:{}},
  tasks:[
    {id:'late',title:'مهمة متأخرة',status:'active',due:'2026-09-12'},
    {id:'today',title:'مهمة اليوم',status:'active',due:'2026-09-13'},
    {id:'waiting',title:'بانتظار رد',status:'waiting'},
    {id:'important',title:'مهمة مهمة',status:'active',priority:'important'}
  ]
};

const findings=analyzeTasks(state,'2026-09-13');
assert.deepEqual(findings.map(item=>item.rule),['overdue','due_today','waiting_without_follow','important_without_due']);
const first=runPolicy(state,'test',now);
assert.equal(first.result.added,4);
const second=runPolicy({...state,agent:first.agent},'test',now);
assert.equal(second.result.added,0);
assert.equal(second.agent.inbox.length,4);
assert.equal(runPolicy({...state,agent:{enabled:false}},'test',now).skipped,true);
console.log('Mesraah agent policy tests passed');
