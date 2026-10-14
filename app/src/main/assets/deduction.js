/* Shared by the UI and puzzle worker. Every reduction follows visible constraints;
 * no solution board or speculative assignment is accepted by this engine. */
const KillerDeduction = (() => {
  const ALL = 0x3fe;
  const count = new Uint8Array(1024), sum = new Uint8Array(1024);
  const combos = Array.from({length:10}, () => Array.from({length:46}, () => []));
  for (let m = 2; m <= ALL; m += 2) {
    const bit = m & -m;
    count[m] = count[m ^ bit] + 1;
    sum[m] = sum[m ^ bit] + (31 - Math.clz32(bit));
    combos[count[m]][sum[m]].push(m);
  }
  const digits = m => Array.from({length:9}, (_,i) => i+1).filter(n => m & (1<<n));
  const pos = i => `${Math.floor(i/9)+1}행 ${i%9+1}열`;
  const choose = (items, n, visit, start=0, selected=[]) => {
    if (!n) { visit(selected); return; }
    for (let i=start; i<=items.length-n; i++) choose(items,n-1,visit,i+1,[...selected,items[i]]);
  };
  const houses = [
    ...Array.from({length:9},(_,r)=>({cells:Array.from({length:9},(_,c)=>r*9+c),name:`${r+1}행`})),
    ...Array.from({length:9},(_,c)=>({cells:Array.from({length:9},(_,r)=>r*9+c),name:`${c+1}열`})),
    ...Array.from({length:9},(_,b)=>({cells:Array.from({length:9},(_,i)=>(Math.floor(b/3)*3+Math.floor(i/3))*9+(b%3)*3+i%3),name:`${b+1}번 박스`}))
  ];
  const topologyCache = new WeakMap();
  function topology(cages) {
    if (topologyCache.has(cages)) return topologyCache.get(cages);
    const cageUnits = cages.map(c=>({cells:c.cells.map(([r,c])=>r*9+c),sum:c.sum,name:`합 ${c.sum} 케이지`}));
    const units = houses.map(h=>({...h,full:true})).concat(cageUnits);
    const peers = Array.from({length:81},()=>new Set());
    for (const u of units) for (const i of u.cells) for (const j of u.cells) if(i!==j) peers[i].add(j);
    const boundaries=[], seen=new Set();
    const add = (cells,target,name) => {
      // Large boundaries are usually weaker than their constituent constraints.
      if (!cells.length || cells.length>12) return;
      cells.sort((a,b)=>a-b);
      const key=cells.join(',')+':'+target;
      if(seen.has(key)) return;
      seen.add(key); boundaries.push({cells,sum:target,name});
    };
    for(let family=0;family<3;family++) for(let size=1;size<=3;size++) {
      choose(houses.slice(family*9,family*9+9),size,group=>{
        const inside=new Set(group.flatMap(h=>h.cells));
        const contained=cageUnits.filter(c=>c.cells.every(i=>inside.has(i)));
        const touching=cageUnits.filter(c=>c.cells.some(i=>inside.has(i)));
        const covered=new Set(contained.flatMap(c=>c.cells));
        const label=`${group.map(h=>h.name).join(' + ')} (합 ${45*size})`;
        add([...inside].filter(i=>!covered.has(i)),45*size-contained.reduce((s,c)=>s+c.sum,0),`45의 법칙(${group.map(h=>h.name).join('+')})`);
        add(touching.flatMap(c=>c.cells.filter(i=>!inside.has(i))),touching.reduce((s,c)=>s+c.sum,0)-45*size,`45의 법칙(${group.map(h=>h.name).join('+')} 바깥)`);
      });
    }
    const constraints=units.map(u=>({...u,type:'unit'})).concat(boundaries.map(u=>({...u,type:'boundary'})));
    const watching=Array.from({length:81},()=>[]);
    constraints.forEach((u,k)=>u.cells.forEach(i=>watching[i].push(k)));
    const value={units,cageUnits,peers,constraints,watching};
    topologyCache.set(cages,value);return value;
  }
  function solve(cages,board=null,traced=false,level=4) {
    // level 1: 확정/유일 위치/케이지 조합, 2: +쌍·세쌍·교차 제거, 3: +45 합 범위, 4: 전체
    const t=topology(cages), masks=new Uint16Array(81).fill(ALL);
    const proof=Array.from({length:81},()=>new Set()), events=[], trace=[];
    const pending=new Set(t.constraints.map((_,i)=>i).filter(i=>level>=3||t.constraints[i].type==='unit'));
    const enqueue=k=>{if(level>=3||t.constraints[k].type==='unit')pending.add(k);};
    let contradiction=false, visits=0;
    const givens=new Uint8Array(81);
    for(let i=0;i<81;i++) {
      const v=board?.[Math.floor(i/9)]?.[i%9]?.val || 0;
      if(v) { if(!Number.isInteger(v)||v<1||v>9) contradiction=true; else {masks[i]=1<<v;givens[i]=v;} }
    }
    function reduce(updates,reason,sources,technique) {
      const actual=updates.map(([i,m])=>[i,masks[i]&m]).filter(([i,m])=>m!==masks[i]);
      if(!actual.length)return;
      const dependencies=new Set();
      if(traced) for(const i of sources) for(const p of proof[i]) dependencies.add(p);
      const id=events.length;
      if(traced) events.push({id,reason,technique,dependencies:[...dependencies],updates:actual.map(([i,m])=>({i,before:masks[i],after:m}))});
      for(const [i,m] of actual) {
        if(!m) contradiction=true;
        if(traced) {
          for(const p of dependencies)proof[i].add(p);
          proof[i].add(id);
          trace.push({r:Math.floor(i/9),c:i%9,before:digits(masks[i]),after:digits(m),reason,eventId:id});
        }
        masks[i]=m;
        for(const k of t.watching[i])enqueue(k);
      }
    }
    // Matching-based cage filtering: a combination must admit a distinct digit
    // assignment to every cell. DP states are (cell index, used digit mask).
    function cageFilter(u) {
      const ordered=[...u.cells].sort((a,b)=>count[masks[a]]-count[masks[b]]);
      const allowed=new Uint16Array(ordered.length);
      let mandatory=ALL,valid=0;
      for(const combo of combos[ordered.length]?.[u.sum] || []) {
        if(ordered.some(i=>!(masks[i]&combo)))continue;
        const memo=new Map();
        const feasible=(k,used)=>{
          if(k===ordered.length)return true;
          const key=k*1024+used;
          if(memo.has(key))return memo.get(key);
          let opts=masks[ordered[k]]&combo&~used,ok=false;
          while(opts) {const b=opts&-opts;opts^=b;if(feasible(k+1,used|b)){ok=true;break;}}
          memo.set(key,ok);return ok;
        };
        if(!feasible(0,0))continue;
        valid++; mandatory&=combo;
        let frontier=new Set([0]);
        for(let k=0;k<ordered.length;k++) {
          const next=new Set();
          for(const used of frontier) {
            let opts=masks[ordered[k]]&combo&~used;
            while(opts) {const b=opts&-opts;opts^=b;if(feasible(k+1,used|b)){allowed[k]|=b;next.add(used|b);}}
          }
          frontier=next;
        }
      }
      if(!valid){contradiction=true;return 0;}
      reduce(ordered.map((i,k)=>[i,allowed[k]]),`${u.name}(${ordered.length}칸): 들어갈 수 있는 숫자는 ${digits(allowed.reduce((m,a)=>m|a,0)).join('·')}뿐`,u.cells,'cage-combination');
      return mandatory;
    }
    function unit(u) {
      // MRV: propagate confirmed cells before larger subsets.
      for(const i of u.cells) if(count[masks[i]]===1) {
        const bit=masks[i];
        reduce(u.cells.filter(j=>j!==i).map(j=>[j,ALL^bit]),`${pos(i)} = ${digits(bit)[0]} → ${u.name}의 다른 칸에서 ${digits(bit)[0]} 제외`,[i],'single');
      }
      if(contradiction)return;
      const mandatory=u.full?ALL:cageFilter(u);
      if(contradiction)return;
      for(const n of digits(mandatory)) {
        const cells=u.cells.filter(i=>masks[i]&(1<<n));
        if(!cells.length){contradiction=true;return;}
        if(cells.length===1)reduce([[cells[0],1<<n]],`${u.name}에서 ${n}이 갈 수 있는 곳은 ${pos(cells[0])}뿐`,u.cells,'hidden-single');
      }
      if(level<2)return;
      for(const n of [2,3]) {
        const small=u.cells.filter(i=>count[masks[i]]>=2&&count[masks[i]]<=n);
        choose(small,n,selected=>{
          const union=selected.reduce((m,i)=>m|masks[i],0);
          if(count[union]!==n)return;
          reduce(u.cells.filter(i=>!selected.includes(i)).map(i=>[i,ALL^union]),`${selected.map(pos).join(', ')}이 ${digits(union).join('·')}를 나눠 가짐 → ${u.name}의 다른 칸에서 제외`,selected,'naked-'+n);
        });
        const possible=digits(mandatory).filter(d=>{const len=u.cells.filter(i=>masks[i]&(1<<d)).length;return len>=2&&len<=n;});
        choose(possible,n,selected=>{
          const bits=selected.reduce((m,d)=>m|(1<<d),0), cells=u.cells.filter(i=>masks[i]&bits);
          if(cells.length!==n)return;
          reduce(cells.map(i=>[i,bits]),`${u.name}의 ${selected.join('·')}는 ${cells.map(pos).join(', ')}에만 들어감 → 이 칸들의 다른 후보 제외`,u.cells,'hidden-'+n);
        });
      }
      if(!u.full)return;
      for(const d of digits(ALL)) {
        const cells=u.cells.filter(i=>masks[i]&(1<<d));
        if(cells.length<2||cells.length>3)continue;
        for(const other of houses) {
          if(other.cells===u.cells||!cells.every(i=>other.cells.includes(i)))continue;
          reduce(other.cells.filter(i=>!u.cells.includes(i)).map(i=>[i,ALL^(1<<d)]),`${u.name}의 ${d}는 ${other.name}과 겹치는 칸에만 있음 → ${other.name} 나머지에서 ${d} 제외`,u.cells,'locked-candidate');
        }
      }
    }
    function boundary(u) {
      const fixed=u.cells.filter(i=>count[masks[i]]===1);
      const empty=u.cells.filter(i=>count[masks[i]]>1).sort((a,b)=>count[masks[a]]-count[masks[b]]);
      const target=u.sum-fixed.reduce((s,i)=>s+sum[masks[i]],0);
      if(!empty.length){if(target!==0)contradiction=true;return;}
      const min=empty.map(i=>31-Math.clz32(masks[i]&-masks[i]));
      const max=empty.map(i=>31-Math.clz32(masks[i]));
      const lo=min.reduce((a,b)=>a+b,0),hi=max.reduce((a,b)=>a+b,0);
      if(target<lo||target>hi){contradiction=true;return;}
      reduce(empty.map((i,k)=>[i,digits(masks[i]).filter(d=>d+lo-min[k]<=target&&d+hi-max[k]>=target).reduce((m,d)=>m|(1<<d),0)]),`${u.name}: ${empty.map(pos).join(', ')}의 합은 ${target} → 범위를 벗어나는 후보 제외`,u.cells,'45-bound');
      if(contradiction||empty.length>4||level<4)return;
      const supports=new Uint16Array(empty.length),values=[],limit=20000;
      let nodes=0,aborted=false;
      const visit=(k,left)=>{
        if(++nodes>limit){aborted=true;return;}
        if(k===empty.length){if(left===0)values.forEach((d,j)=>supports[j]|=1<<d);return;}
        let low=0,high=0;
        for(let j=k;j<empty.length;j++){low+=31-Math.clz32(masks[empty[j]]&-masks[empty[j]]);high+=31-Math.clz32(masks[empty[j]]);}
        if(left<low||left>high)return;
        for(const d of digits(masks[empty[k]])) {
          if(values.some((v,j)=>j<k&&v===d&&t.peers[empty[k]].has(empty[j])))continue;
          values[k]=d;visit(k+1,left-d);values.length=k;
          if(aborted)return;
        }
      };
      visit(0,target);
      // An incomplete enumeration must never remove a candidate.
      if(!aborted)reduce(empty.map((i,k)=>[i,supports[k]]),`${u.name}: ${empty.map(pos).join(', ')}의 합이 ${target}이 되는 배치만 남김`,u.cells,'45-combination');
    }
    while(pending.size&&!contradiction) {
      // Dirty units only. Prefer the most constrained small unit, then 45 sums.
      let best=-1,rank=Infinity;
      for(const k of pending) {
        const u=t.constraints[k];
        const score=(u.type==='boundary'?100:0)+u.cells.reduce((s,i)=>s+count[masks[i]],0)/u.cells.length;
        if(score<rank){rank=score;best=k;}
      }
      pending.delete(best);visits++;
      const u=t.constraints[best];
      if(u.type==='unit')unit(u);else boundary(u);
    }
    const solvedCells=[];
    if(!contradiction)for(let i=0;i<81;i++)if(count[masks[i]]===1)solvedCells.push([Math.floor(i/9),i%9]);
    return {solvedCount:solvedCells.length,solvedCells,trace,events,proof:proof.map(p=>[...p].sort((a,b)=>a-b)),contradiction,visits,candidates:Array.from({length:9},(_,r)=>Array.from(masks.slice(r*9,r*9+9))),givens};
  }
  const LEVEL_NAME=['','기본 추론','쌍·교차 후보','45의 법칙','45의 법칙 조합'];
  const STEP_WEIGHT={'single':0.2,'hidden-single':1,'cage-combination':1,'naked-2':2,'hidden-2':2,'locked-candidate':2,'naked-3':3,'hidden-3':3,'45-bound':3,'45-combination':4};
  // Easiest first: try the weakest technique set that confirms any cell, then
  // choose the cell whose proof is lightest (singles are cheap, triples expensive).
  function hint(cages,board) {
    for(let level=1;level<=4;level++) {
      const result=solve(cages,board,true,level);
      if(result.contradiction)return null;
      const targets=result.solvedCells.map(([r,c])=>r*9+c).filter(i=>!result.givens[i]);
      if(!targets.length)continue;
      const cost=i=>result.proof[i].reduce((s,id)=>s+(STEP_WEIGHT[result.events[id].technique]||2),0);
      targets.sort((a,b)=>cost(a)-cost(b)||result.proof[a].length-result.proof[b].length||a-b);
      const i=targets[0],r=Math.floor(i/9),c=i%9,answer=digits(result.candidates[r][c])[0];
      const steps=result.proof[i].map(id=>result.events[id]);
      const cage=cages.find(cg=>cg.cells.some(([rr,cc])=>rr===r&&cc===c));
      const singles=steps.filter(s=>s.technique==='single');
      const key=steps.filter(s=>s.technique!=='single');
      const shown=key.length<=5?key:key.slice(-4);
      const lines=[];
      if(singles.length){
        const placed=[...new Set(singles.map(s=>s.reason.split(' → ')[0]))];
        lines.push(`이미 놓인 숫자(${placed.slice(0,4).join(', ')}${placed.length>4?' 등':''})를 같은 행·열·박스·케이지에서 지웁니다.`);
      }
      if(key.length>shown.length)lines.push(`(앞선 ${key.length-shown.length}단계 생략)`);
      shown.forEach(s=>lines.push(s.reason));
      return {r,c,answer,level,stepsCount:steps.length,proof:steps,badgeText:`${LEVEL_NAME[level]} · ${key.length||1}단계`,posName:pos(i),cageInfo:`케이지 합 ${cage.sum}`,
        explanation:`${lines.map((l,k)=>`${k+1}. ${l}`).join('\n')}\n→ ${pos(i)}은 ${answer}입니다.`};
    }
    return null;
  }
  return {solve,hint,count,combos,topology};
})();
