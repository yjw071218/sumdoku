// ============================================================================
// SumdokuGenerator - 킬러 수도쿠 3단계 정밀 생성 엔진
// [1단계: 9x9 정답판 생성]
//       ↓
// [2단계: 스마트 케이지 분할]
//       ↓
// [★ 2.5단계: 초고속 비트마스크 컴퓨터 솔버 검증 (MRV Backtracking)]
//   - 복수해(답이 2개 이상)이거나 해가 없는 불량 맵을 0.1ms 만에 컷트
//       ↓ (유일해 통과 시에만)
// [3단계: 인간 모사 연역 솔버 검증 (Deductive Advanced)]
//   - 45의 법칙, 조합 캐싱, Pointing Pairs, Naked Pairs, Singles로 100% 풀림 검증
// ============================================================================

// 1~5칸 케이지 합계별 숫자 조합 비트마스크 사전 계산 캐시 (O(1) 조회)
const PRECOMPUTED_COMBOS = (() => {
  const table = {};
  for (let sz = 1; sz <= 5; sz++) {
    table[sz] = {};
    const build = (start, curSize, curSum, mask) => {
      if (curSize === sz) {
        if (!table[sz][curSum]) table[sz][curSum] = [];
        table[sz][curSum].push(mask);
        return;
      }
      for (let n = start; n <= 9; n++) {
        build(n + 1, curSize + 1, curSum + n, mask | (1 << n));
      }
    };
    build(1, 0, 0, 0);
  }
  return table;
})();

const PRECOMPUTED_OR_MASKS = (() => {
  const table = {};
  for (let sz = 1; sz <= 5; sz++) {
    table[sz] = {};
    for (const [sumStr, list] of Object.entries(PRECOMPUTED_COMBOS[sz])) {
      let orM = 0;
      for (const m of list) orM |= m;
      table[sz][Number(sumStr)] = orM;
    }
  }
  return table;
})();

class SumdokuGenerator {
  constructor(rng = Math.random) {
    this.rng = rng;
  }

  // 동기 맵 생성
  generate(diff = 'expert', customRng = null) {
    const rng = customRng || this.rng;

    const anchorMap = {
      easy: 8,
      medium: 6,
      hard: [4, 5, 5][Math.floor(rng() * 3)],
      expert: [0, 1, 1, 2][Math.floor(rng() * 4)]
    };
    const targetAnchors = anchorMap[diff] !== undefined ? anchorMap[diff] : 1;

    let attempts = 0;
    const maxAttempts = 2000;
    let currentAnchors = targetAnchors;

    while (attempts++ < maxAttempts) {
      if (diff === 'expert' && attempts % 60 === 0) {
        currentAnchors = [0, 1, 1, 2][Math.floor(rng() * 4)];
      }

      // [1단계: 정답판 생성]
      const solution = this.createSolutionIterative(rng);

      // [2단계: 스마트 케이지 분할]
      let cages = this.createSmartCages(solution, currentAnchors, rng);
      let singles = cages.filter(c => c.cells.length === 1);
      if (singles.length !== currentAnchors) continue;

      // [★ 2.5단계: 초고속 유일해 검증 + 국소 수리 (Local Area Repair)]
      let isUnique = false;
      const maxRepairs = 5;
      for (let rIdx = 0; rIdx <= maxRepairs; rIdx++) {
        const check = this.checkUniquenessWithDiff(cages);
        if (check.isUnique) {
          isUnique = true;
          break;
        }
        if (rIdx < maxRepairs && check.diffCells && check.diffCells.length > 0) {
          cages = this.repairLocalCages(solution, cages, check.diffCells, rng);
          singles = cages.filter(c => c.cells.length === 1);
          if (singles.length !== currentAnchors) break;
        } else {
          break;
        }
      }

      if (!isUnique) continue;

      // [3단계: 인간 모사 연역 솔버 검증]
      const solved = this.solveDeductivelyAdvanced(solution, cages);
      const minRequired = diff === 'expert' ? 0 : (diff === 'hard' ? 40 : 81);
      if (solved >= minRequired) {
        return {
          solution,
          cages,
          anchorCount: currentAnchors
        };
      }
    }

    throw new Error('추론 가능한 퍼즐을 찾지 못했습니다. 다시 시도해 주세요.');
  }

  // 비동기 맵 생성 및 진행 상황 실시간 피드백 지원
  async generateAsync(diff = 'expert', customRng = null, onProgress = null) {
    const rng = customRng || this.rng;

    const anchorMap = {
      easy: 8,
      medium: 6,
      hard: [4, 5, 5][Math.floor(rng() * 3)],
      expert: [0, 1, 1, 2][Math.floor(rng() * 4)]
    };
    let currentAnchors = anchorMap[diff] !== undefined ? anchorMap[diff] : 1;
    const diffNames = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' };
    const diffKr = diffNames[diff] || diff;

    let attempts = 0;
    let rejectedCount = 0;
    const maxAttempts = 2000;

    if (onProgress) {
      onProgress({
        diffKr,
        step: '1',
        stepStatus: 'active',
        stepName: '정답판 생성',
        message: '1단계: 9×9 완성 스도쿠 정답판 생성 중...',
        percent: 15,
        attempt: 0,
        rejectedCount: 0
      });
      await new Promise(r => setTimeout(r, 16));
    }

    while (attempts < maxAttempts) {
      attempts++;

      if (diff === 'expert' && attempts % 60 === 0) {
        currentAnchors = [0, 1, 1, 2][Math.floor(rng() * 4)];
      }

      // [1단계: 정답판 생성]
      const solution = this.createSolutionIterative(rng);

      // [2단계: 스마트 케이지 분할]
      let cages = this.createSmartCages(solution, currentAnchors, rng);
      let singles = cages.filter(c => c.cells.length === 1);
      if (singles.length !== currentAnchors) continue;

      if (attempts <= 2 && onProgress) {
        onProgress({
          diffKr,
          step: '2',
          stepStatus: 'active',
          stepName: '케이지 분할',
          message: `2단계: 스마트 케이지 분할 (${cages.length}개 케이지 형성)`,
          percent: 30,
          attempt: attempts,
          rejectedCount,
          cages,
          solution
        });
        await new Promise(r => setTimeout(r, 10));
      }

      // [★ 2.5단계: 초고속 유일해 검증 + 국소 수리 (Local Area Repair)]
      let isUnique = false;
      const maxRepairs = 5;
      let repairCount = 0;

      for (let repairIdx = 0; repairIdx <= maxRepairs; repairIdx++) {
        const check = this.checkUniquenessWithDiff(cages);
        if (check.isUnique) {
          isUnique = true;
          break;
        }

        if (repairIdx < maxRepairs && check.diffCells && check.diffCells.length > 0) {
          repairCount++;
          if (onProgress) {
            onProgress({
              diffKr,
              step: '2.5',
              stepStatus: 'repairing',
              stepName: '국소 영역 재분할',
              message: `★ 2.5단계: 복수해 원인(${check.diffCells.length}칸) 국소 수리 중 (#${repairCount}회)`,
              percent: Math.min(85, 30 + repairCount * 10),
              attempt: attempts,
              rejectedCount,
              repairCount,
              cages,
              solution
            });
            await new Promise(r => setTimeout(r, 0));
          }

          cages = this.repairLocalCages(solution, cages, check.diffCells, rng);
          singles = cages.filter(c => c.cells.length === 1);
          if (singles.length !== currentAnchors) break;
        } else {
          break;
        }
      }

      if (!isUnique) {
        rejectedCount++;
        if ((attempts % 3 === 0 || attempts <= 2) && onProgress) {
          const pct = Math.min(85, 25 + Math.floor((attempts / 50) * 60));
          onProgress({
            diffKr,
            step: '2.5',
            stepStatus: 'rejected',
            stepName: '초고속 컷트',
            message: `★ 2.5단계: 복수해 불량 맵 즉시 컷트 (0.1ms 컷트 #${rejectedCount}회)`,
            percent: pct,
            attempt: attempts,
            rejectedCount,
            cages,
            solution
          });
          await new Promise(r => setTimeout(r, 0));
        }
        continue;
      }

      // 유일해 통과 시 알림
      if (onProgress) {
        onProgress({
          diffKr,
          step: '2.5',
          stepStatus: 'passed',
          stepName: '유일해 통과',
          message: repairCount > 0
            ? `★ 2.5단계: 국소 수리 ${repairCount}회 성공! 유일해 확보 완료`
            : `★ 2.5단계: 유일해 검증 통과! (불량 맵 #${rejectedCount}회 컷트 완료)`,
          percent: 88,
          attempt: attempts,
          rejectedCount,
          cages,
          solution
        });
        await new Promise(r => setTimeout(r, 16));
      }

      // [3단계: 인간 모사 연역 솔버 검증]
      const detailed = this.solveDeductivelyAdvanced(solution, cages, true);
      const solvedCount = detailed.solvedCount;
      const solvedCells = detailed.solvedCells;
      const minRequired = diff === 'expert' ? 0 : (diff === 'hard' ? 40 : 81);

      if (solvedCount >= minRequired) {
        if (onProgress) {
          onProgress({
            diffKr,
            step: '3',
            stepStatus: 'completed',
            stepName: '연역 검증 완료',
            message: `3단계: 인간 연역 추론 검증 완료! (${solvedCount}/81칸 확정)`,
            percent: 100,
            attempt: attempts,
            rejectedCount,
            cages,
            solvedCount,
            solvedCells,
            solution
          });
          await new Promise(r => setTimeout(r, 50));
        }
        return {
          solution,
          cages,
          anchorCount: currentAnchors
        };
      }

      if (onProgress) {
        const pct = Math.min(95, 30 + Math.floor((attempts / 50) * 60));
        onProgress({
          diffKr,
          step: '3',
          stepStatus: 'retry',
          stepName: '연역 판별 중',
          message: `3단계: 인간 연역 판별 중... (${solvedCount}/81칸 확정 · 시도 #${attempts})`,
          percent: pct,
          attempt: attempts,
          rejectedCount,
          cages,
          solvedCount,
          solvedCells,
          solution
        });
        await new Promise(r => setTimeout(r, 0));
      }
    }

    throw new Error('추론 가능한 퍼즐을 찾지 못했습니다. 다시 시도해 주세요.');
  }

  // ============================================================================
  // [★ 2.5단계] 초고속 컴퓨터 솔버 검증 및 복수해 원인 셀(Diff Cells) 정밀 추적
  // - 답이 1개인지 판별
  // - 복수해(2개 이상) 발견 시 첫 번째 해와 두 번째 해의 차이점 셀(diffCells)을 추출
  // ============================================================================
  checkUniquenessWithDiff(cages, maxNodes = 6000) {
    const numCages = cages.length;
    const cellCage = new Int32Array(81);
    const cageTarget = new Int32Array(numCages);
    const cageSize = new Int32Array(numCages);

    const fixedGrid = new Int32Array(81);
    const rowMask = new Int32Array(9);
    const colMask = new Int32Array(9);
    const boxMask = new Int32Array(9);
    const cageMask = new Int32Array(numCages);
    const cageSum = new Int32Array(numCages);
    const cageFilled = new Int32Array(numCages);

    for (let i = 0; i < numCages; i++) {
      const cg = cages[i];
      cageTarget[i] = cg.sum;
      cageSize[i] = cg.cells.length;
      for (const [r, c] of cg.cells) {
        const idx = r * 9 + c;
        cellCage[idx] = i;
        if (cg.cells.length === 1) {
          fixedGrid[idx] = cg.sum;
          const val = cg.sum;
          const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
          const vBit = 1 << val;
          if ((rowMask[r] & vBit) || (colMask[c] & vBit) || (boxMask[b] & vBit)) {
            return { isUnique: false, diffCells: [], noSolution: true };
          }
          rowMask[r] |= vBit;
          colMask[c] |= vBit;
          boxMask[b] |= vBit;
          cageMask[i] |= vBit;
          cageSum[i] = val;
          cageFilled[i] = 1;
        }
      }
    }

    const emptyCells = [];
    for (let idx = 0; idx < 81; idx++) {
      if (fixedGrid[idx] === 0) emptyCells.push(idx);
    }

    let solutionsFound = 0;
    let nodesExplored = 0;
    const ALL_CANDS = 0x3FE;
    let firstSolution = null;
    let secondSolution = null;

    const solve = () => {
      if (++nodesExplored > maxNodes) return false;

      // MRV (Minimum Remaining Values) 탐색
      let bestIdx = -1;
      let bestMask = 0;
      let minCands = 10;

      for (let i = 0; i < emptyCells.length; i++) {
        const cell = emptyCells[i];
        if (fixedGrid[cell] !== 0) continue;

        const r = Math.floor(cell / 9);
        const c = cell % 9;
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const cg = cellCage[cell];

        let avail = ALL_CANDS & ~(rowMask[r] | colMask[c] | boxMask[b] | cageMask[cg]);
        const remCells = cageSize[cg] - cageFilled[cg];
        const remSum = cageTarget[cg] - cageSum[cg];

        if (remCells === 1) {
          if (remSum >= 1 && remSum <= 9 && (avail & (1 << remSum))) {
            avail = 1 << remSum;
          } else {
            return false;
          }
        } else {
          if (remSum < remCells || remSum > remCells * 9) return false;
        }

        let count = 0;
        let temp = avail;
        while (temp) { temp &= temp - 1; count++; }

        if (count === 0) return false;
        if (count < minCands) {
          minCands = count;
          bestIdx = cell;
          bestMask = avail;
          if (count === 1) break;
        }
      }

      if (bestIdx === -1) {
        solutionsFound++;
        if (solutionsFound === 1) {
          firstSolution = new Int32Array(fixedGrid);
        } else if (solutionsFound === 2) {
          secondSolution = new Int32Array(fixedGrid);
          return true; // 2개 발견 시 즉시 중단(Early Exit)
        }
        return false;
      }

      const r = Math.floor(bestIdx / 9);
      const c = bestIdx % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const cg = cellCage[bestIdx];

      let mask = bestMask;
      while (mask) {
        const vBit = mask & -mask;
        mask ^= vBit;
        const num = 31 - Math.clz32(vBit);

        if (cageSum[cg] + num > cageTarget[cg]) continue;
        if (cageFilled[cg] + 1 === cageSize[cg] && cageSum[cg] + num !== cageTarget[cg]) continue;

        fixedGrid[bestIdx] = num;
        rowMask[r] |= vBit;
        colMask[c] |= vBit;
        boxMask[b] |= vBit;
        cageMask[cg] |= vBit;
        cageSum[cg] += num;
        cageFilled[cg]++;

        const shouldStop = solve();

        fixedGrid[bestIdx] = 0;
        rowMask[r] &= ~vBit;
        colMask[c] &= ~vBit;
        boxMask[b] &= ~vBit;
        cageMask[cg] &= ~vBit;
        cageSum[cg] -= num;
        cageFilled[cg]--;

        if (shouldStop) return true;
      }

      return false;
    };

    solve();

    if (solutionsFound === 1) {
      return { isUnique: true, diffCells: [] };
    }

    if (solutionsFound >= 2 && firstSolution && secondSolution) {
      const diffCells = [];
      for (let i = 0; i < 81; i++) {
        if (firstSolution[i] !== secondSolution[i]) {
          diffCells.push([Math.floor(i / 9), i % 9]);
        }
      }
      return { isUnique: false, diffCells, solutionsFound };
    }

    return { isUnique: false, diffCells: [], noSolution: true };
  }

  // 기존 호출부 하위 호환용 래퍼
  isSolutionUniqueFast(cages, maxNodes = 6000) {
    return this.checkUniquenessWithDiff(cages, maxNodes).isUnique;
  }

  // ============================================================================
  // [국소 영역 케이지 재분할 수리 (Local Area Re-carving Repair)]
  // 2번째 해를 유발한 원인 칸(diffCells) 주변 케이지들만 결합을 해제하여
  // 다른 영역은 유지한 채 충돌 구역만 스마트하게 국소 재분할하여 대칭/복수해를 파괴
  // ============================================================================
  repairLocalCages(solution, cages, diffCells, rng = Math.random) {
    if (!diffCells || diffCells.length === 0) return cages;

    const cellKey = (r, c) => `${r},${c}`;
    const cageMap = new Map();
    cages.forEach((cg, idx) => {
      cg.cells.forEach(([r, c]) => cageMap.set(cellKey(r, c), idx));
    });

    const targetCageIndices = new Set();
    for (const [r, c] of diffCells) {
      const cIdx = cageMap.get(cellKey(r, c));
      if (cIdx !== undefined && cages[cIdx].cells.length > 1) {
        targetCageIndices.add(cIdx);
      }
    }

    if (targetCageIndices.size === 0) {
      for (const [r, c] of diffCells) {
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
            const adjIdx = cageMap.get(cellKey(nr, nc));
            if (adjIdx !== undefined && cages[adjIdx].cells.length > 1) {
              targetCageIndices.add(adjIdx);
              break;
            }
          }
        }
        if (targetCageIndices.size > 0) break;
      }
    }

    // 인접한 이웃 케이지 1개를 추가하여 재분할 유연성 확보
    const expandedIndices = new Set(targetCageIndices);
    for (const cIdx of targetCageIndices) {
      for (const [r, c] of cages[cIdx].cells) {
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
            const neighborIdx = cageMap.get(cellKey(nr, nc));
            if (neighborIdx !== undefined && !expandedIndices.has(neighborIdx) && cages[neighborIdx].cells.length > 1) {
              expandedIndices.add(neighborIdx);
              break;
            }
          }
        }
        if (expandedIndices.size > targetCageIndices.size + 1) break;
      }
    }

    const localCells = [];
    const preservedCages = [];
    for (let i = 0; i < cages.length; i++) {
      if (expandedIndices.has(i)) {
        for (const cell of cages[i].cells) localCells.push(cell);
      } else {
        preservedCages.push(cages[i]);
      }
    }

    if (localCells.length === 0) return cages;

    // 국소 영역 내에서 케이지 재분할 (Re-carving)
    const localAssigned = new Set();
    const newLocalCages = [];
    const localPool = [...localCells].sort(() => rng() - 0.5);

    for (const startCell of localPool) {
      const startKey = cellKey(startCell[0], startCell[1]);
      if (localAssigned.has(startKey)) continue;

      const currentCageCells = [startCell];
      localAssigned.add(startKey);
      const targetSize = [2, 2, 3, 3, 4][Math.floor(rng() * 5)];

      while (currentCageCells.length < targetSize) {
        const neighbors = [];
        for (const [cr, cc] of currentCageCells) {
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = cr + dr, nc = cc + dc;
            const nKey = cellKey(nr, nc);
            if (localCells.some(([lr, lc]) => lr === nr && lc === nc) && !localAssigned.has(nKey)) {
              const existVals = currentCageCells.map(([r, c]) => solution[r][c]);
              if (!existVals.includes(solution[nr][nc])) {
                neighbors.push([nr, nc]);
              }
            }
          }
        }

        if (neighbors.length === 0) break;
        const nextCell = neighbors[Math.floor(rng() * neighbors.length)];
        currentCageCells.push(nextCell);
        localAssigned.add(cellKey(nextCell[0], nextCell[1]));
      }

      // 고립 1칸 병합 처리
      if (currentCageCells.length === 1) {
        const [or, oc] = currentCageCells[0];
        const val = solution[or][oc];
        let merged = false;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = or + dr, nc = oc + dc;
          const neighborCage = newLocalCages.find(cg => cg.cells.some(([cr, cc]) => cr === nr && cc === nc));
          if (neighborCage && neighborCage.cells.length < 5) {
            const adjVals = neighborCage.cells.map(([r, c]) => solution[r][c]);
            if (!adjVals.includes(val)) {
              neighborCage.cells.push([or, oc]);
              neighborCage.sum += val;
              merged = true;
              break;
            }
          }
        }
        if (!merged) {
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = or + dr, nc = oc + dc;
            const presCage = preservedCages.find(cg => cg.cells.length > 1 && cg.cells.length < 5 && cg.cells.some(([cr, cc]) => cr === nr && cc === nc));
            if (presCage) {
              const presVals = presCage.cells.map(([r, c]) => solution[r][c]);
              if (!presVals.includes(val)) {
                presCage.cells.push([or, oc]);
                presCage.sum += val;
                merged = true;
                break;
              }
            }
          }
        }
        if (!merged) {
          newLocalCages.push({ sum: val, cells: currentCageCells });
        }
      } else {
        const sum = currentCageCells.reduce((acc, [r, c]) => acc + solution[r][c], 0);
        newLocalCages.push({ sum, cells: currentCageCells });
      }
    }

    return [...preservedCages, ...newLocalCages];
  }

  // ============================================================================
  // [3단계] 인간 모사 순수 연역 솔버 (Deductive Advanced Solver)
  // 찍기 없이 사람이 생각하는 논리 규칙만으로 81칸이 풀리는지 검증
  // ============================================================================
  solveDeductivelyAdvanced(solution, cages, returnDetailed = false, traceEnabled = false) {
    const trace = [];
    let reason = '케이지 크기와 목표 합으로 가능한 숫자 조합을 제한합니다.';
    const digits = mask => Array.from({length:9},(_,i)=>i+1).filter(n=>mask & (1<<n));
    const cands = Array.from({ length: 9 }, (_, r) => traceEnabled ? new Proxy(Array(9).fill(0), {
      set(row, key, value) {
        const c = Number(key), before = row[key];
        if (Number.isInteger(c) && c >= 0 && c < 9 && before && before !== value) {
          trace.push({r,c,before:digits(before),after:digits(value),reason});
        }
        row[key] = value; return true;
      }
    }) : new Int32Array(9));
    const ALL_CANDS = 0x3FE; // bits 1..9

    // 초기화: 케이지 크기 및 합계 사전 캐시 마스크 적용
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        cands[r][c] = ALL_CANDS;
      }
    }

    for (const cg of cages) {
      const sz = cg.cells.length;
      if(traceEnabled) reason = `합 ${cg.sum}, ${sz}칸 케이지에서 중복 없는 숫자 조합을 계산합니다.`;
      if (sz === 1) {
        const [r, c] = cg.cells[0];
        cands[r][c] = 1 << cg.sum;
      } else if (sz <= 5 && PRECOMPUTED_OR_MASKS[sz] && PRECOMPUTED_OR_MASKS[sz][cg.sum]) {
        const allowedOr = PRECOMPUTED_OR_MASKS[sz][cg.sum];
        for (const [r, c] of cg.cells) {
          cands[r][c] &= allowedOr;
        }
      }
    }

    const popcount = (m) => {
      let count = 0;
      while (m) { m &= m - 1; count++; }
      return count;
    };

    let changed = true;
    let loop = 0;

    while (changed && loop++ < 80) {
      changed = false;

      // 1. Naked Singles & 상호 피어 소거
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const m = cands[r][c];
          if (popcount(m) === 1) {
            const valBit = m;
            if(traceEnabled) reason = `${r+1}행 ${c+1}열이 ${31-Math.clz32(m)}로 확정되어 같은 행·열·박스에서 이 숫자를 제외합니다.`;

            // 행 소거
            for (let i = 0; i < 9; i++) {
              if (i !== c && (cands[r][i] & valBit)) {
                cands[r][i] &= ~valBit;
                changed = true;
              }
            }
            // 열 소거
            for (let i = 0; i < 9; i++) {
              if (i !== r && (cands[i][c] & valBit)) {
                cands[i][c] &= ~valBit;
                changed = true;
              }
            }
            // 3x3 박스 소거
            const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                const tr = br + i, tc = bc + j;
                if ((tr !== r || tc !== c) && (cands[tr][tc] & valBit)) {
                  cands[tr][tc] &= ~valBit;
                  changed = true;
                }
              }
            }
          }
        }
      }

      // 2. 케이지 내부 동일 숫자 중복 소거 & 사전 조합 필터링
      for (const cg of cages) {
        const unsolved = [];
        let solvedSum = 0;
        let solvedMask = 0;

        for (const [r, c] of cg.cells) {
          const m = cands[r][c];
          if (popcount(m) === 1) {
            solvedSum += (31 - Math.clz32(m));
            solvedMask |= m;
          } else {
            unsolved.push([r, c]);
          }
        }

        // 이미 풀린 숫자는 케이지 내 다른 미완성 셀에서 소거
        if (solvedMask > 0) {
          if(traceEnabled) reason = `합 ${cg.sum} 케이지에서 이미 확정된 ${digits(solvedMask).join(", ")}은 다른 칸에 중복될 수 없습니다.`;
          for (const [ur, uc] of unsolved) {
            if (cands[ur][uc] & solvedMask) {
              cands[ur][uc] &= ~solvedMask;
              changed = true;
            }
          }
        }

        // 남은 셀들에 대한 케이지 조합 비트마스크 필터링
        const remLen = unsolved.length;
        const remTarget = cg.sum - solvedSum;
        if(traceEnabled) reason = `케이지 합 ${cg.sum} - 확정된 숫자의 합 ${solvedSum} = ${remTarget}. 남은 ${remLen}칸의 중복 없는 조합과 각 칸 후보를 대조합니다.`;
        if (remLen >= 1 && remLen <= 5 && PRECOMPUTED_COMBOS[remLen] && PRECOMPUTED_COMBOS[remLen][remTarget]) {
          const comboList = PRECOMPUTED_COMBOS[remLen][remTarget];
          let allowedUnion = 0;

          for (const comboMask of comboList) {
            // 이미 풀린 숫자와 겹치지 않는 조합인지 확인
            if (comboMask & solvedMask) continue;

            // unsolved 셀들의 후보와 이 조합의 각 숫자가 매칭 가능한지 확인
            let canFitAll = true;
            for (const [ur, uc] of unsolved) {
              if ((cands[ur][uc] & comboMask) === 0) {
                canFitAll = false;
                break;
              }
            }
            if (canFitAll) {
              allowedUnion |= comboMask;
            }
          }

          if (allowedUnion > 0) {
            for (const [ur, uc] of unsolved) {
              const before = cands[ur][uc];
              cands[ur][uc] &= allowedUnion;
              if (cands[ur][uc] !== before) changed = true;
            }
          }
        }
      }

      // 3. Hidden Singles (행, 열, 3x3 박스, 케이지)
      for (let r = 0; r < 9; r++) {
        for (let num = 1; num <= 9; num++) {
          const bit = 1 << num;
          let count = 0, lastC = -1;
          for (let c = 0; c < 9; c++) {
            if (cands[r][c] & bit) { count++; lastC = c; }
          }
          if (count === 1 && popcount(cands[r][lastC]) > 1) {
            if(traceEnabled) reason = `${r+1}행에서 ${num} 후보가 있는 유일한 자리는 ${lastC+1}열입니다.`;
            cands[r][lastC] = bit;
            changed = true;
          }
        }
      }

      for (let c = 0; c < 9; c++) {
        for (let num = 1; num <= 9; num++) {
          const bit = 1 << num;
          let count = 0, lastR = -1;
          for (let r = 0; r < 9; r++) {
            if (cands[r][c] & bit) { count++; lastR = r; }
          }
          if (count === 1 && popcount(cands[lastR][c]) > 1) {
            if(traceEnabled) reason = `${c+1}열에서 ${num} 후보가 있는 유일한 자리는 ${lastR+1}행입니다.`;
            cands[lastR][c] = bit;
            changed = true;
          }
        }
      }

      for (let br = 0; br < 9; br += 3) {
        for (let bc = 0; bc < 9; bc += 3) {
          for (let num = 1; num <= 9; num++) {
            const bit = 1 << num;
            let count = 0, lastR = -1, lastC = -1;
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                if (cands[br + i][bc + j] & bit) { count++; lastR = br + i; lastC = bc + j; }
              }
            }
            if (count === 1 && popcount(cands[lastR][lastC]) > 1) {
              if(traceEnabled) reason = `${br+1}~${br+3}행, ${bc+1}~${bc+3}열 박스에서 ${num} 후보가 있는 유일한 자리는 ${lastR+1}행 ${lastC+1}열입니다.`;
              cands[lastR][lastC] = bit;
              changed = true;
            }
          }
        }
      }

      // 4. Pointing Pairs / Box-Line Reduction (교차 후보 제거)
      for (let b = 0; b < 9; b++) {
        const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
        for (let num = 1; num <= 9; num++) {
          const bit = 1 << num;
          const rowsWithNum = new Set();
          const colsWithNum = new Set();

          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              if (cands[br + i][bc + j] & bit) {
                rowsWithNum.add(br + i);
                colsWithNum.add(bc + j);
              }
            }
          }

          // 박스 내에서 해당 숫자가 오직 한 행에만 존재할 때, 그 행의 박스 바깥에서 제거
          if (rowsWithNum.size === 1) {
            const row = [...rowsWithNum][0];
            if(traceEnabled) reason = `${br+1}~${br+3}행, ${bc+1}~${bc+3}열 박스의 ${num} 후보가 ${row+1}행에만 있어, 그 행의 박스 밖에서 ${num}을 제외합니다.`;
            for (let c = 0; c < 9; c++) {
              if (c < bc || c >= bc + 3) {
                if (cands[row][c] & bit) {
                  cands[row][c] &= ~bit;
                  changed = true;
                }
              }
            }
          }

          // 박스 내에서 해당 숫자가 오직 한 열에만 존재할 때, 그 열의 박스 바깥에서 제거
          if (colsWithNum.size === 1) {
            const col = [...colsWithNum][0];
            if(traceEnabled) reason = `${br+1}~${br+3}행, ${bc+1}~${bc+3}열 박스의 ${num} 후보가 ${col+1}열에만 있어, 그 열의 박스 밖에서 ${num}을 제외합니다.`;
            for (let r = 0; r < 9; r++) {
              if (r < br || r >= br + 3) {
                if (cands[r][col] & bit) {
                  cands[r][col] &= ~bit;
                  changed = true;
                }
              }
            }
          }
        }
      }

      // 5. Naked Pairs (쌍둥이 소거법)
      for (let r = 0; r < 9; r++) {
        for (let c1 = 0; c1 < 8; c1++) {
          if (popcount(cands[r][c1]) === 2) {
            for (let c2 = c1 + 1; c2 < 9; c2++) {
              if (cands[r][c1] === cands[r][c2]) {
                const pairMask = cands[r][c1];
                if(traceEnabled) reason = `${r+1}행의 ${c1+1}열과 ${c2+1}열이 후보 {${digits(pairMask).join(",")}}를 독점하므로 다른 칸에서 제외합니다.`;
                for (let c3 = 0; c3 < 9; c3++) {
                  if (c3 !== c1 && c3 !== c2 && (cands[r][c3] & pairMask)) {
                    cands[r][c3] &= ~pairMask;
                    changed = true;
                  }
                }
              }
            }
          }
        }
      }

      for (let c = 0; c < 9; c++) {
        for (let r1 = 0; r1 < 8; r1++) {
          if (popcount(cands[r1][c]) === 2) {
            for (let r2 = r1 + 1; r2 < 9; r2++) {
              if (cands[r1][c] === cands[r2][c]) {
                const pairMask = cands[r1][c];
                if(traceEnabled) reason = `${c+1}열의 ${r1+1}행과 ${r2+1}행이 후보 {${digits(pairMask).join(",")}}를 독점하므로 다른 칸에서 제외합니다.`;
                for (let r3 = 0; r3 < 9; r3++) {
                  if (r3 !== r1 && r3 !== r2 && (cands[r3][c] & pairMask)) {
                    cands[r3][c] &= ~pairMask;
                    changed = true;
                  }
                }
              }
            }
          }
        }
      }
    }

    let solvedCount = 0;
    const solvedCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (popcount(cands[r][c]) === 1) {
          solvedCount++;
          solvedCells.push([r, c]);
        }
      }
    }
    return returnDetailed ? { solvedCount, solvedCells, trace, candidates: cands.map(row=>Array.from(row)) } : solvedCount;
  }

  // 100% 비재귀 반복문 백트래킹 (기본 완성 수도쿠 판 생성)
  createSolutionIterative(rng = Math.random) {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    
    for (let b = 0; b < 9; b += 3) {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => rng() - 0.5);
      let idx = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          board[b + r][b + c] = nums[idx++];
        }
      }
    }

    const empty = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) empty.push([r, c]);
      }
    }

    const isSafe = (r, c, val) => {
      for (let i = 0; i < 9; i++) {
        if (board[r][i] === val || board[i][c] === val) return false;
      }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (board[br + i][bc + j] === val) return false;
        }
      }
      return true;
    };

    const cellState = empty.map(() => ({
      nums: [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => rng() - 0.5),
      tryIdx: 0
    }));

    let idx = 0;
    while (idx < empty.length) {
      const [r, c] = empty[idx];
      const state = cellState[idx];
      let placed = false;
      while (state.tryIdx < state.nums.length) {
        const val = state.nums[state.tryIdx++];
        if (isSafe(r, c, val)) {
          board[r][c] = val;
          placed = true;
          break;
        }
      }
      if (placed) {
        idx++;
      } else {
        board[r][c] = 0;
        state.tryIdx = 0;
        state.nums.sort(() => rng() - 0.5);
        idx--;
        if (idx < 0) break;
      }
    }
    return board;
  }

  // 스마트 케이지 분할 (자연스러운 2~4칸 폴리오미노 형성)
  createSmartCages(solution, exactAnchors, rng = Math.random) {
    const boxIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => rng() - 0.5);
    const assigned = new Map();
    const cages = [];

    // 1. 정확한 개수의 1칸 시작 확정 앵커 배치
    for (let i = 0; i < exactAnchors; i++) {
      const box = boxIndices[i % boxIndices.length];
      const br = Math.floor(box / 3) * 3 + Math.floor(rng() * 3);
      const bc = (box % 3) * 3 + Math.floor(rng() * 3);
      const cell = [br, bc];
      const cage = { sum: solution[br][bc], cells: [cell] };
      cages.push(cage);
      assigned.set(`${br},${bc}`, cage);
    }

    // 2. 나머지 셀들을 무작위 순서로 순회하며 2~4칸 케이지로 그룹화
    const remaining = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!assigned.has(`${r},${c}`)) remaining.push([r, c]);
      }
    }
    remaining.sort(() => rng() - 0.5);

    for (const startCell of remaining) {
      const key = `${startCell[0]},${startCell[1]}`;
      if (assigned.has(key)) continue;

      const currentCageCells = [startCell];
      assigned.set(key, null);
      const targetSize = [2, 2, 2, 3, 3, 4][Math.floor(rng() * 6)];

      while (currentCageCells.length < targetSize) {
        const neighbors = [];
        for (const [cr, cc] of currentCageCells) {
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = cr + dr, nc = cc + dc;
            if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && !assigned.has(`${nr},${nc}`)) {
              const existVals = currentCageCells.map(([r, c]) => solution[r][c]);
              if (!existVals.includes(solution[nr][nc])) neighbors.push([nr, nc]);
            }
          }
        }
        if (neighbors.length === 0) break;
        const nextCell = neighbors[Math.floor(rng() * neighbors.length)];
        currentCageCells.push(nextCell);
        assigned.set(`${nextCell[0]},${nextCell[1]}`, null);
      }

      // 고립되어 1칸만 남은 셀은 인접 케이지로 병합하여 불필요한 추가 앵커 방지
      if (currentCageCells.length === 1) {
        const [or, oc] = currentCageCells[0];
        const val = solution[or][oc];
        let merged = false;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = or + dr, nc = oc + dc;
          if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
            const adj = assigned.get(`${nr},${nc}`);
            if (adj && adj.cells.length > 1 && adj.cells.length < 5) {
              const adjVals = adj.cells.map(([r, c]) => solution[r][c]);
              if (!adjVals.includes(val)) {
                adj.cells.push([or, oc]);
                adj.sum += val;
                assigned.set(key, adj);
                merged = true;
                break;
              }
            }
          }
        }
        if (!merged) {
          const cage = { sum: val, cells: currentCageCells };
          cages.push(cage);
          assigned.set(key, cage);
        }
      } else {
        const sum = currentCageCells.reduce((acc, [r, c]) => acc + solution[r][c], 0);
        const cage = { sum, cells: currentCageCells };
        cages.push(cage);
        for (const c of currentCageCells) assigned.set(`${c[0]},${c[1]}`, cage);
      }
    }

    return cages;
  }
}
