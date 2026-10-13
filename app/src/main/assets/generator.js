class SumdokuGenerator {
  constructor(rng = Math.random) {
    this.rng = rng;
  }

  generate(diff = 'expert', customRng = null) {
    const rng = customRng || this.rng;

    // ★ 전문가 난이도: 0개(순수 케이지 합계만으로 풀림)부터 1, 2, 3개 앵커까지 지원
    const anchorMap = {
      easy: 7,
      medium: 5,
      hard: 4,
      expert: [0, 1, 1, 2, 3][Math.floor(rng() * 5)]
    };
    const targetAnchors = anchorMap[diff] !== undefined ? anchorMap[diff] : [0, 1, 1, 2, 3][Math.floor(rng() * 5)];

    let attempts = 0;
    const maxAttempts = 5000;
    let currentAnchors = targetAnchors;

    while (attempts++ < maxAttempts) {
      if (diff === 'expert' && attempts % 120 === 0) {
        currentAnchors = [0, 1, 1, 2, 3][Math.floor(rng() * 5)];
      }

      const solution = this.createSolutionIterative(rng);
      const cages = this.createSmartCages(solution, currentAnchors, rng);
      const singles = cages.filter(c => c.cells.length === 1);

      // 확정 단서 수 일치 및 순수 연역 논리 100% 풀림(81칸 완료) 검증
      if (singles.length === currentAnchors && this.solveDeductivelyAdvanced(solution, cages) === 81) {
        return {
          solution,
          cages,
          anchorCount: currentAnchors
        };
      }
    }

    throw new Error('추론 가능한 퍼즐을 찾지 못했습니다. 다시 시도해 주세요.');
  }

  // 비동기 맵 생성 및 진행 상황 피드백 콜백 지원
  async generateAsync(diff = 'expert', customRng = null, onProgress = null) {
    const rng = customRng || this.rng;

    const anchorMap = {
      easy: 7,
      medium: 5,
      hard: 4,
      expert: [0, 1, 1, 2, 3][Math.floor(rng() * 5)]
    };
    let currentAnchors = anchorMap[diff] !== undefined ? anchorMap[diff] : [0, 1, 1, 2, 3][Math.floor(rng() * 5)];
    const diffNames = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' };
    const diffKr = diffNames[diff] || diff;

    let attempts = 0;
    const maxAttempts = 5000;

    if (onProgress) {
      onProgress({
        diffKr,
        step: 1,
        message: '9x9 기본 완성 스도쿠 판 생성 중...',
        percent: 15,
        attempt: 0
      });
      await new Promise(r => setTimeout(r, 16));
    }

    while (attempts < maxAttempts) {
      attempts++;

      if (diff === 'expert' && attempts % 120 === 0) {
        currentAnchors = [0, 1, 1, 2, 3][Math.floor(rng() * 5)];
      }

      const solution = this.createSolutionIterative(rng);
      const cages = this.createSmartCages(solution, currentAnchors, rng);
      const singles = cages.filter(c => c.cells.length === 1);
      const solvedCount = this.solveDeductivelyAdvanced(solution, cages);

      // 확정 단서 수 일치 및 순수 연역 논리 100% 풀림(81칸 완료) 검증
      if (singles.length === currentAnchors && solvedCount === 81) {
        if (onProgress) {
          onProgress({
            diffKr,
            step: 3,
            message: `100% 순수 연역 논리 검증 완료! (81/81칸 확정 · ${attempts}회 시도)`,
            percent: 100,
            attempt: attempts,
            cages,
            solvedCount: 81,
            solution
          });
          await new Promise(r => setTimeout(r, 60));
        }
        return {
          solution,
          cages,
          anchorCount: currentAnchors
        };
      }

      // 4회 시도마다 비동기 틱 양보 및 프로그레스 갱신 (실시간 케이지 프리뷰 데이터 전달)
      if (attempts % 4 === 0) {
        if (onProgress) {
          const pct = Math.min(95, 20 + Math.floor((attempts / 80) * 75));
          onProgress({
            diffKr,
            step: 2,
            message: `스마트 케이지 연역 추론 중... (${attempts}회 시도 · ${solvedCount}/81칸 해결)`,
            percent: pct,
            attempt: attempts,
            cages,
            solvedCount
          });
        }
        await new Promise(r => setTimeout(r, 0));
      }
    }

    throw new Error('추론 가능한 퍼즐을 찾지 못했습니다. 다시 시도해 주세요.');
  }

  // 100% 비재귀 반복문 백트래킹
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

  solveDeductivelyAdvanced(solution, cages) {
    const candidates = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    );

    let changed = true;
    let loop = 0;
    while (changed && loop++ < 80) {
      changed = false;

      // 1. Naked Singles & 피어 소거법
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (candidates[r][c].size === 1) {
            const val = [...candidates[r][c]][0];
            for (let i = 0; i < 9; i++) {
              if (i !== c && candidates[r][i].has(val)) {
                candidates[r][i].delete(val);
                changed = true;
              }
              if (i !== r && candidates[i][c].has(val)) {
                candidates[i][c].delete(val);
                changed = true;
              }
            }
            const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                if ((br + i !== r || bc + j !== c) && candidates[br + i][bc + j].has(val)) {
                  candidates[br + i][bc + j].delete(val);
                  changed = true;
                }
              }
            }
          }
        }
      }

      // 2. 케이지 합계 조합 필터링
      for (const cage of cages) {
        const solvedVals = [];
        const unsolved = [];
        for (const [r, c] of cage.cells) {
          if (candidates[r][c].size === 1) solvedVals.push([...candidates[r][c]][0]);
          else unsolved.push([r, c]);
        }
        if (unsolved.length === 0) continue;

        const currentSolvedSum = solvedVals.reduce((a, b) => a + b, 0);
        const remTargetSum = cage.sum - currentSolvedSum;
        const usedSet = new Set(solvedVals);

        const validSets = [];
        const findCombos = (idx, currentSum, chosen) => {
          if (idx === unsolved.length) {
            if (currentSum === remTargetSum) validSets.push([...chosen]);
            return;
          }
          const [ur, uc] = unsolved[idx];
          for (const cand of candidates[ur][uc]) {
            if (!chosen.includes(cand) && !usedSet.has(cand)) {
              if (currentSum + cand <= remTargetSum) {
                chosen.push(cand);
                findCombos(idx + 1, currentSum + cand, chosen);
                chosen.pop();
              }
            }
          }
        };
        findCombos(0, 0, []);

        if (validSets.length > 0) {
          for (let i = 0; i < unsolved.length; i++) {
            const [ur, uc] = unsolved[i];
            const allowedForCell = new Set(validSets.map(arr => arr[i]));
            for (const cand of candidates[ur][uc]) {
              if (!allowedForCell.has(cand)) {
                candidates[ur][uc].delete(cand);
                changed = true;
              }
            }
          }
        }
      }

      // 3. Hidden Singles 검증
      for (let r = 0; r < 9; r++) {
        for (let num = 1; num <= 9; num++) {
          const cols = [];
          for (let c = 0; c < 9; c++) {
            if (candidates[r][c].has(num)) cols.push(c);
          }
          if (cols.length === 1 && candidates[r][cols[0]].size > 1) {
            candidates[r][cols[0]] = new Set([num]);
            changed = true;
          }
        }
      }

      for (let c = 0; c < 9; c++) {
        for (let num = 1; num <= 9; num++) {
          const rows = [];
          for (let r = 0; r < 9; r++) {
            if (candidates[r][c].has(num)) rows.push(r);
          }
          if (rows.length === 1 && candidates[rows[0]][c].size > 1) {
            candidates[rows[0]][c] = new Set([num]);
            changed = true;
          }
        }
      }

      for (let br = 0; br < 9; br += 3) {
        for (let bc = 0; bc < 9; bc += 3) {
          for (let num = 1; num <= 9; num++) {
            const cells = [];
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                if (candidates[br + i][bc + j].has(num)) cells.push([br + i, bc + j]);
              }
            }
            if (cells.length === 1 && candidates[cells[0][0]][cells[0][1]].size > 1) {
              candidates[cells[0][0]][cells[0][1]] = new Set([num]);
              changed = true;
            }
          }
        }
      }
    }

    let solvedCount = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (candidates[r][c].size === 1) solvedCount++;
      }
    }
    return solvedCount;
  }
}

// ============================================================================
// 3. 앱 주 컨트롤러 (SumdokuApp)
// ============================================================================
