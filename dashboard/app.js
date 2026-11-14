// Token Radar dashboard logic.
// SPDX-License-Identifier: MIT
// Renders window.TOKEN_RADAR (written by main.ts) as a sortable, filterable
// board with a detail view per protocol. The farm-plan generator below is the
// same logic main.ts uses for board.json, so the page and the board agree.

const D = window.TOKEN_RADAR;
const $ = (id) => document.getElementById(id);

function fmtUsd(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n);
}
function fmtPct(x) {
  if (x === null || x === undefined) return 'n/a';
  return (x > 0 ? '+' : '') + x.toFixed(1) + '%';
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Rows arrive as compact arrays:
// [slug, name, category, chains, tvl, change_7d, age_days, implied, multiple, growthF, ageF, chainF, watchlist]
function toRow(a) {
  return {
    slug: a[0], name: a[1], category: a[2], chains: a[3], tvl: a[4], chg: a[5],
    age: a[6], val: a[7], mult: a[8], gF: a[9], aF: a[10], cF: a[11], watch: a[12] === 1,
  };
}
const ROWS = D.rows.map(toRow);

// ---- farm plans (identical to main.ts: same templates, same inputs) ----
function positionSize(tvl) {
  if (tvl >= 1e9) return '$1,000–$5,000';
  if (tvl >= 2e8) return '$500–$2,000';
  if (tvl >= 5e7) return '$200–$1,000';
  return '$50–$300';
}
function coreAction(category, name, chain, size) {
  switch (category) {
    case 'Dexs':
      return `Swap ${size} through ${name} on ${chain} and add the rest as liquidity in its deepest pool; hold the LP position rather than trading in and out, and keep any trading-fee share it pays.`;
    case 'Lending':
      return `Supply ${size} of stablecoins to ${name}'s lending market on ${chain}, then borrow a small amount against it and repay within a week, so the wallet shows both supply and borrow activity.`;
    case 'Yield':
      return `Deposit ${size} into ${name}'s highest-TVL vault on ${chain} and leave it earning for at least 30 days; harvest or compound the yield once a month rather than every day.`;
    case 'Risk Curators':
      return `Deposit ${size} into a ${name} curated vault on ${chain} and keep the position for at least 30 days; curated vaults reward steady depositors, so avoid withdrawing and re-depositing.`;
    case 'Onchain Capital Allocator':
      return `Allocate ${size} to a ${name} strategy vault on ${chain} and hold it for at least 30 days; check the strategy's reported yield weekly and move only if it underperforms for a full month.`;
    case 'Derivatives':
      return `Open a small ${size} hedged position on ${name} on ${chain} — for example a long with a matching short elsewhere — and close it within two weeks, keeping total exposure below half your deposit.`;
    case 'RWA':
      return `Buy ${size} of ${name}'s tokenised asset on ${chain} and hold it for at least 30 days; real-world-asset positions reward holders, so avoid flipping the position for a quick gain.`;
    case 'CDP':
    case 'CDP Manager':
      return `Lock ${size} of collateral in ${name} on ${chain}, mint its stablecoin against it at a conservative ratio, and repay the mint within 30 days while keeping the collateral ratio above 200%.`;
    case 'Yield Aggregator':
      return `Deposit ${size} into ${name}'s auto-compounding vault on ${chain} and leave it for at least 30 days; the aggregator compounds yield for you, so one deposit and monthly checks are enough.`;
    case 'Liquidity Manager':
      return `Deposit ${size} into a ${name} managed liquidity position on ${chain} and leave the manager to rebalance it for at least 30 days; check the range weekly but do not micromanage it.`;
    case 'Restaking':
      return `Restake ${size} through ${name} on ${chain} and keep the restaked position for at least 30 days; restaking rewards accrue to addresses that stay staked, not to ones that rotate.`;
    case 'Basis Trading':
      return `Deposit ${size} into ${name}'s basis strategy on ${chain} and hold it for at least 30 days; the strategy earns from funding-rate spreads, so judge it over a month, not a day.`;
    case 'Prediction Market':
      return `Place a spread of small ${size} positions across several ${name} markets on ${chain} over two weeks, rather than one large bet; breadth of participation is what a distribution would measure.`;
    case 'Insurance':
      return `Buy ${size} of cover from ${name} on ${chain} for a position you already hold, and keep the cover active for at least 30 days; renewing cover shows repeated, genuine use.`;
    case 'Payments':
      return `Route ${size} of real payments through ${name} on ${chain} across at least four separate weeks, keeping receipts; regular payment volume is the activity a future distribution would count.`;
    default:
      return `Use ${name}'s main product on ${chain} with ${size} and keep the position open for at least 30 days; steady, visible use of the live product is what a future distribution would measure.`;
  }
}
function farmSteps(r) {
  const chain = r.chains[0] || 'Ethereum';
  const size = positionSize(r.tvl);
  return [
    `Create a fresh wallet for ${r.name} farming on ${chain} and fund it with $5–$20 of the chain's native gas token plus ${size} in stablecoins for the position; keep this wallet separate from your main funds and store its recovery phrase offline.`,
    `Bridge ${size} of stablecoins to ${chain} if your funds sit elsewhere; allow 10–30 minutes and roughly $1–$5 in bridge fees, and confirm the funds arrive before moving to the next step.`,
    coreAction(r.category, r.name, chain, size),
    `Repeat the core position weekly for at least 4–8 weeks, using the same wallet and address so activity accrues to one identity; each repeat costs about $1–$3 in gas and takes 10–20 minutes.`,
    `Use ${r.name}'s other live features on ${chain} at least twice a month — a second pool, a vote or a supported integration — because distributions usually reward breadth of use, not a single deposit.`,
    `Record every deposit, date and transaction hash in a sheet, check the position weekly, and exit if TVL falls 30% in a week or the team goes silent for a month; never share your seed phrase and verify every link from the protocol's own channels.`,
  ];
}

// ---- board rendering ----
const maxVal = Math.max(...ROWS.map((r) => r.val));
const maxTvl = Math.max(...ROWS.map((r) => r.tvl));
let selected = null;

function fillSelect(id, values) {
  const el = $(id);
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    el.appendChild(o);
  }
}
fillSelect('cat', [...new Set(ROWS.map((r) => r.category || 'Uncategorised'))].sort());
fillSelect('chain', [...new Set(ROWS.flatMap((r) => r.chains))].sort());

function filtered() {
  const q = $('q').value.trim().toLowerCase();
  const cat = $('cat').value;
  const chain = $('chain').value;
  const watch = $('watch').checked;
  let list = ROWS.filter((r) => {
    if (watch && !r.watch) return false;
    if (cat && (r.category || 'Uncategorised') !== cat) return false;
    if (chain && !r.chains.includes(chain)) return false;
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q))) return false;
    return true;
  });
  const sort = $('sort').value;
  if (sort === 'tvl') list = [...list].sort((a, b) => b.tvl - a.tvl);
  else if (sort === 'growth') list = [...list].sort((a, b) => (b.chg ?? -999) - (a.chg ?? -999));
  else if (sort === 'age') list = [...list].sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
  else list = [...list].sort((a, b) => b.val - a.val);
  return list;
}

function render() {
  const list = filtered();
  const tb = $('rows');
  tb.innerHTML = '';
  for (const r of list) {
    const tr = document.createElement('tr');
    if (selected && selected.slug === r.slug) tr.className = 'sel';
    const rank = ROWS.indexOf(r) + 1;
    tr.innerHTML =
      '<td>' + rank + '</td>' +
      '<td>' + esc(r.name) + (r.watch ? '<span class="badge">WATCHLIST</span>' : '') + '</td>' +
      '<td>' + esc(r.category || 'Uncategorised') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
      '<td class="tvl">' + fmtUsd(r.tvl) + '</td>' +
      '<td class="' + ((r.chg ?? 0) >= 0 ? 'up' : 'down') + '">' + fmtPct(r.chg) + '</td>' +
      '<td class="val">' + fmtUsd(r.val) + '</td>' +
      '<td><div class="bar"><span style="width:' + Math.max(4, Math.round((Math.log10(r.val) / Math.log10(maxVal)) * 100)) + '%"></span></div></td>';
    tr.addEventListener('click', () => { selected = r; render(); showDetail(r); });
    tb.appendChild(tr);
  }
  $('count').textContent = list.length + ' of ' + ROWS.length + ' pre-token protocols shown.';
}

function showDetail(r) {
  const rank = ROWS.indexOf(r) + 1;
  const steps = farmSteps(r);
  $('detail').innerHTML =
    '<div class="detail-card"><h2>#' + rank + ' ' + esc(r.name) +
    (r.watch ? '<span class="badge">WATCHLIST</span>' : '') +
    '<span class="badge">RECORDS NO TOKEN</span></h2>' +
    '<p class="note">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) + '</p>' +
    '<div class="tiles">' +
    '<div class="tile"><div class="lab">TVL</div><div class="num">' + fmtUsd(r.tvl) + '</div></div>' +
    '<div class="tile"><div class="lab">7-day change</div><div class="num">' + fmtPct(r.chg) + '</div></div>' +
    '<div class="tile"><div class="lab">Tracked for</div><div class="num">' + (r.age === null ? 'n/a' : Math.round(r.age / 30) + ' mo') + '</div></div>' +
    '<div class="tile"><div class="lab">Category multiple</div><div class="num">' + r.mult.toFixed(3) + 'x</div></div>' +
    '<div class="tile"><div class="lab">Implied value</div><div class="num gold">' + fmtUsd(r.val) + '</div></div>' +
    '</div>' +
    '<p class="formula">Value model: TVL ' + fmtUsd(r.tvl) + ' x multiple ' + r.mult.toFixed(3) +
    ' x growth ' + r.gF.toFixed(3) + ' x age ' + r.aF.toFixed(3) + ' x chains ' + r.cF.toFixed(3) +
    ' = ' + fmtUsd(r.val) + '. The multiple is the median mcap/TVL of token-bearing ' +
    esc(r.category || 'Uncategorised') + ' protocols in this snapshot.</p>' +
    '<h2>How to farm it</h2><ol class="steps">' +
    steps.map((s) => '<li>' + esc(s) + '</li>').join('') +
    '</ol></div>';
  $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

for (const id of ['q', 'cat', 'chain', 'sort', 'watch']) {
  $(id).addEventListener('input', render);
  $(id).addEventListener('change', render);
}

$('meta').textContent = 'Snapshot ' + D.meta.as_of + ' · ' + D.meta.rows + ' pre-token protocols · ' + D.meta.watchlist + ' on the watchlist · floor ' + fmtUsd(D.meta.floor_usd);
$('asof').textContent = D.meta.as_of;
$('model').textContent = D.meta.model + '. Global category multiple ' + D.meta.global_multiple.toFixed(3) + 'x.';
$('tradingRows').innerHTML = D.trading.map((t) =>
  '<tr><td>' + esc(t[0]) + '</td><td>' + fmtUsd(t[1]) + '</td><td>' + fmtUsd(t[2]) + '</td></tr>').join('');

render();
showDetail(ROWS[0]);
