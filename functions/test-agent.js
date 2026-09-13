const assert=require('node:assert/strict');
const {analyzeTasks,runPolicy,scheduleSlot,isSlotBoundary}=require('./agent-policy');

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

const atRiyadhHour=(day,hour)=>new Date(`${day}T${String(hour-3).padStart(2,'0')}:00:00.000Z`);
assert.equal(scheduleSlot(atRiyadhHour('2026-09-13',8)),'2026-09-13:work:08');
assert.equal(scheduleSlot(atRiyadhHour('2026-09-13',16)),'2026-09-13:work:16');
assert.equal(scheduleSlot(atRiyadhHour('2026-09-13',17)),'2026-09-13:off:17');
assert.equal(scheduleSlot(atRiyadhHour('2026-09-13',19)),'2026-09-13:off:17');
assert.equal(scheduleSlot(atRiyadhHour('2026-09-13',20)),'2026-09-13:off:20');
assert.equal(scheduleSlot(atRiyadhHour('2026-09-18',9)),'2026-09-18:weekend:09');
assert.equal(scheduleSlot(atRiyadhHour('2026-09-18',10)),'2026-09-18:weekend:09');
assert.equal(scheduleSlot(atRiyadhHour('2026-09-13',22)),'');
assert.equal(scheduleSlot(atRiyadhHour('2026-09-14',5)),'');
assert.equal(isSlotBoundary(atRiyadhHour('2026-09-18',9),scheduleSlot(atRiyadhHour('2026-09-18',9))),true);
assert.equal(isSlotBoundary(atRiyadhHour('2026-09-18',10),scheduleSlot(atRiyadhHour('2026-09-18',10))),false);
console.log('Mesraah agent policy tests passed');
