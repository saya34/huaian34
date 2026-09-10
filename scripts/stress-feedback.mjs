import assert from "node:assert/strict";

function simulate(inputs) {
  const dedupe=new Map(),toasts=[],floats=[],center=[];
  for(const item of inputs){const last=dedupe.get(item.key)??-Infinity;if(item.at-last<500){const target=toasts.find(entry=>entry.key===item.key);if(target)target.count+=1;continue;}dedupe.set(item.key,item.at);if(item.kind==="toast"){toasts.push({...item,count:1});if(toasts.length>4)toasts.shift();}else if(item.kind==="float"){floats.push({...item,count:1});if(floats.length>6)floats.shift();}else center.push(item);}
  center.sort((a,b)=>a.priority-b.priority||a.at-b.at);
  return{toasts,floats,center};
}

const drops=Array.from({length:80},(_,index)=>({kind:index%2?"float":"toast",key:`drop-${index%5}`,at:index*70,priority:3}));
const crossDay=[{kind:"center",key:"day",at:0,priority:1},{kind:"center",key:"festival",at:1,priority:0},{kind:"center",key:"project",at:2,priority:1},{kind:"center",key:"level",at:3,priority:1}];
const result=simulate([...drops,...crossDay]);
assert.ok(result.toasts.length<=4,"toast stack exceeded visual bound");
assert.ok(result.floats.length<=6,"float stack exceeded visual bound");
assert.equal(result.center[0].key,"festival","P0 must lead central queue");
assert.ok(result.toasts.some(item=>item.count>1),"repeated loot must merge within 500ms");
console.log("feedback stress check passed: loot burst, batch floats, cross-day priority, central queue ordering");
