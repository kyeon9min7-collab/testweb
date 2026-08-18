// Pokemon GO IV calculator logic.
// POKEMON_DATA / CPM_WHOLE_LEVELS come from data.js.

const MAX_LEVEL = 40; // covers virtually all wild/raid/egg catches without needing XL-candy-only levels

function cpmAtLevel(level) {
  if (Number.isInteger(level)) return CPM_WHOLE_LEVELS[level - 1];
  const lower = Math.floor(level);
  const a = CPM_WHOLE_LEVELS[lower - 1];
  const b = CPM_WHOLE_LEVELS[lower];
  return Math.sqrt((a * a + b * b) / 2);
}

function computeCP(atkTotal, defTotal, staTotal, cpm) {
  return Math.max(10, Math.floor(atkTotal * Math.sqrt(defTotal) * Math.sqrt(staTotal) * cpm * cpm / 10));
}

function computeHP(staTotal, cpm) {
  return Math.max(10, Math.floor(staTotal * cpm));
}

function findMatchingCombos(baseAtk, baseDef, baseSta, targetCP, targetHP, maxLevel) {
  const results = [];
  for (let li = 2; li <= maxLevel * 2; li++) {
    const level = li / 2;
    const cpm = cpmAtLevel(level);
    for (let staIV = 0; staIV <= 15; staIV++) {
      const hp = computeHP(baseSta + staIV, cpm);
      if (hp !== targetHP) continue;
      for (let atkIV = 0; atkIV <= 15; atkIV++) {
        for (let defIV = 0; defIV <= 15; defIV++) {
          const cp = computeCP(baseAtk + atkIV, baseDef + defIV, baseSta + staIV, cpm);
          if (cp === targetCP) {
            results.push({ level, atkIV, defIV, staIV });
          }
        }
      }
    }
  }
  return results;
}

function tierMatches(tierStr, value) {
  if (!tierStr) return true;
  const [lo, hi] = tierStr.split('-').map(Number);
  return value >= lo && value <= hi;
}

// ---- UI wiring ----

let selectedMon = null; // {dex, id, nameKo, form, atk, def, hp}
let lastResults = [];
const appraisalTiers = { atk: '', def: '', sta: '' };

const searchInput = document.getElementById('species-search');
const resultsBox = document.getElementById('species-results');
const selectedBox = document.getElementById('species-selected');
const selectedName = document.getElementById('selected-name');
const selectedStats = document.getElementById('selected-stats');
const clearBtn = document.getElementById('species-clear');
const calcBtn = document.getElementById('calc-btn');
const appraisalCard = document.getElementById('appraisal-card');
const resultCard = document.getElementById('result-card');
const verdictEl = document.getElementById('verdict');
const summaryEl = document.getElementById('result-summary');
const listEl = document.getElementById('result-list');

function displayName(mon) {
  return mon.form ? `${mon.nameKo} (${mon.form})` : mon.nameKo;
}

function searchSpecies(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const isNumber = /^\d+$/.test(q);
  const out = [];
  for (const row of POKEMON_DATA) {
    const [dex, id, nameKo, form, atk, def, hp] = row;
    let hit = false;
    if (isNumber) {
      hit = String(dex) === q;
    } else {
      hit = nameKo.includes(query.trim()) || id.includes(q);
    }
    if (hit) {
      out.push({ dex, id, nameKo, form, atk, def, hp });
      if (out.length >= 30) break;
    }
  }
  return out;
}

function renderSearchResults(list) {
  resultsBox.innerHTML = '';
  if (!list.length) {
    resultsBox.hidden = true;
    return;
  }
  for (const mon of list) {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.innerHTML = `<span>${displayName(mon)}</span><span class="dex-no">#${String(mon.dex).padStart(4, '0')}</span>`;
    item.addEventListener('click', () => selectSpecies(mon));
    resultsBox.appendChild(item);
  }
  resultsBox.hidden = false;
}

function selectSpecies(mon) {
  selectedMon = mon;
  searchInput.value = '';
  resultsBox.hidden = true;
  selectedName.textContent = displayName(mon);
  selectedStats.textContent = `공격 ${mon.atk} · 방어 ${mon.def} · 체력 ${mon.hp}`;
  selectedBox.hidden = false;
  searchInput.hidden = true;
  searchInput.parentElement.querySelector('label').hidden = true;
}

clearBtn.addEventListener('click', () => {
  selectedMon = null;
  selectedBox.hidden = true;
  searchInput.hidden = false;
  searchInput.parentElement.querySelector('label').hidden = false;
  searchInput.focus();
});

searchInput.addEventListener('input', () => {
  renderSearchResults(searchSpecies(searchInput.value));
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.field')) resultsBox.hidden = true;
});

document.querySelectorAll('.tier-btns').forEach((group) => {
  const stat = group.dataset.stat;
  group.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
      if (btn.dataset.tier !== '') btn.classList.add('selected');
      appraisalTiers[stat] = btn.dataset.tier;
      renderResults();
    });
  });
});

calcBtn.addEventListener('click', () => {
  if (!selectedMon) {
    alert('먼저 포켓몬을 선택해주세요.');
    return;
  }
  const cp = parseInt(document.getElementById('input-cp').value, 10);
  const hp = parseInt(document.getElementById('input-hp').value, 10);
  if (!cp || !hp) {
    alert('CP와 HP를 입력해주세요.');
    return;
  }
  const trainerLevelRaw = parseInt(document.getElementById('trainer-level').value, 10);
  const buddyBonus = parseInt(document.getElementById('buddy-boost').value, 10);
  const weatherBonus = document.getElementById('weather-boost').checked ? 4 : 0;

  let maxLevel = MAX_LEVEL;
  if (trainerLevelRaw) {
    maxLevel = Math.min(MAX_LEVEL, trainerLevelRaw + buddyBonus + weatherBonus);
  }

  lastResults = findMatchingCombos(selectedMon.atk, selectedMon.def, selectedMon.hp, cp, hp, maxLevel);
  appraisalCard.hidden = false;
  renderResults();
});

function renderResults() {
  resultCard.hidden = false;
  const filtered = lastResults.filter(
    (r) => tierMatches(appraisalTiers.atk, r.atkIV) &&
           tierMatches(appraisalTiers.def, r.defIV) &&
           tierMatches(appraisalTiers.sta, r.staIV)
  );

  listEl.innerHTML = '';

  if (lastResults.length === 0) {
    verdictEl.className = 'verdict none';
    verdictEl.textContent = '조건에 맞는 조합을 찾지 못했어요';
    summaryEl.textContent = '입력한 종/CP/HP/트레이너 레벨을 다시 확인해주세요.';
    return;
  }

  if (filtered.length === 0) {
    verdictEl.className = 'verdict none';
    verdictEl.textContent = '감정 결과와 맞는 조합이 없어요';
    summaryEl.textContent = '감정 선택을 다시 확인해주세요.';
    return;
  }

  const totalPercents = filtered.map((r) => (r.atkIV + r.defIV + r.staIV) / 45 * 100);
  const minPct = Math.min(...totalPercents);
  const maxPct = Math.max(...totalPercents);
  const allPerfect = filtered.every((r) => r.atkIV === 15 && r.defIV === 15 && r.staIV === 15);
  const anyPerfect = filtered.some((r) => r.atkIV === 15 && r.defIV === 15 && r.staIV === 15);

  if (allPerfect) {
    verdictEl.className = 'verdict perfect';
    verdictEl.textContent = '100% 확정입니다! (헌드로)';
  } else if (anyPerfect) {
    verdictEl.className = 'verdict maybe';
    verdictEl.textContent = '100%일 가능성이 있어요 (다른 조합도 가능)';
  } else if (maxPct === minPct) {
    verdictEl.className = 'verdict no';
    verdictEl.textContent = `100%가 아닙니다 (IV ${Math.round(maxPct)}% 확정)`;
  } else {
    verdictEl.className = 'verdict no';
    verdictEl.textContent = `100%가 아닙니다 (최대 IV ${Math.round(maxPct)}%)`;
  }

  summaryEl.textContent = filtered.length === 1
    ? `가능한 조합 1가지로 확정됐어요.`
    : `가능한 조합 ${filtered.length}가지 · IV 범위 ${Math.round(minPct)}% ~ ${Math.round(maxPct)}%. 감정 결과를 입력하면 더 좁혀져요.`;

  const sorted = [...filtered].sort((a, b) => {
    const pctA = a.atkIV + a.defIV + a.staIV;
    const pctB = b.atkIV + b.defIV + b.staIV;
    return pctB - pctA || a.level - b.level;
  });

  for (const r of sorted) {
    const pct = Math.round((r.atkIV + r.defIV + r.staIV) / 45 * 100);
    const isPerfect = r.atkIV === 15 && r.defIV === 15 && r.staIV === 15;
    const row = document.createElement('div');
    row.className = 'result-row' + (isPerfect ? ' perfect' : '');
    row.innerHTML = `
      <span class="ivs">Lv.${r.level} · 공${r.atkIV}/방${r.defIV}/체${r.staIV}</span>
      <span class="pct">${pct}%${isPerfect ? '<span class="badge">100%</span>' : ''}</span>
    `;
    listEl.appendChild(row);
  }
}
