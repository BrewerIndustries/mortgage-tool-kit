// Pure mortgage math — the single source of truth, unit-tested in test/calc.test.mjs
// AND loaded directly by the app (index.html via <script src="calc.js">, which exposes
// window.MTK). This dual CJS/browser shape means the code the tests validate is the exact
// code that ships — no more inline copies to drift out of sync.

'use strict';

// Monthly principal & interest for a fully-amortizing loan.
function monthlyPI(principal, annualRatePct, months) {
  const r = annualRatePct / 1200, n = Math.max(1, Math.round(months));
  if (principal <= 0) return 0;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

// Amortize a loan with optional recurring extra, a one-time lump sum, and bi-weekly
// (modeled as one extra payment/yr). Returns { basePmt, months, totalInterest,
// totalPrincipal } and, when opts.schedule is true, a per-payment `schedule` array of
// { i, pay, principal, interest, bal } rows (rounded to cents so a displayed table foots).
function amortize(principal, annualRatePct, years, opts = {}) {
  const { extra = 0, lumpAmount = 0, lumpAtPayment = 1, biweekly = false, schedule = false } = opts;
  const r = annualRatePct / 1200, n = Math.max(1, Math.round(years * 12));
  const basePmt = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  const biweeklyExtra = biweekly ? basePmt / 12 : 0;
  const lumpIdx = Math.max(1, Math.round(lumpAtPayment)) - 1;
  const round2 = (x) => Math.round(x * 100) / 100;
  const rows = schedule ? [] : null;
  let bal = principal, totalInterest = 0, totalPrincipal = 0, months = 0;
  for (let i = 0; i < n * 2 && bal > 0.005; i++) {
    const interest = round2(bal * r);
    let prin = basePmt - interest + extra + biweeklyExtra;
    if (i === lumpIdx && lumpAmount > 0) prin += lumpAmount;
    if (prin > bal) prin = bal;
    prin = round2(prin);
    // The final scheduled payment (or an early payoff) clears the balance, so the loan
    // retires in exactly the term - real lenders adjust the last payment for rounding.
    if (prin > bal || bal - prin < 0.01 || i === n - 1) prin = round2(bal);
    const pay = round2(prin + interest);
    bal = round2(bal - prin);
    totalInterest += interest; totalPrincipal += prin; months++;
    if (rows) rows.push({ i: i + 1, pay, principal: prin, interest, bal: Math.max(0, bal) });
    if (months > 1200) break;
  }
  const out = { basePmt, months, totalInterest: round2(totalInterest), totalPrincipal: round2(totalPrincipal) };
  if (rows) out.schedule = rows;
  return out;
}

// Level monthly payment that retires `principal` in exactly `targetMonths` (the reverse of
// monthlyPI). Used by the "pay off by date X -> required payment" solver.
function payoffPayment(principal, annualRatePct, targetMonths) {
  return monthlyPI(principal, annualRatePct, targetMonths);
}

// Max affordable home price given DTI limits. Returns { maxHousing, price, loan, backBinds }.
function affordability({ annualIncome, monthlyDebts, frontDTI, backDTI, down, ratePct, termYears, taxRatePct, insAnnual, hoaMonthly, pmiRatePct = 0.6 }) {
  const grossMo = annualIncome / 12;
  const maxHousing = Math.max(0, Math.min((frontDTI / 100) * grossMo, (backDTI / 100) * grossMo - monthlyDebts));
  const backBinds = ((backDTI / 100) * grossMo - monthlyDebts) < ((frontDTI / 100) * grossMo);
  const n = Math.max(1, Math.round(termYears * 12));
  let lo = down, hi = down + 5_000_000;
  for (let i = 0; i < 50; i++) {
    const P = (lo + hi) / 2, loan = Math.max(0, P - down);
    const piti = monthlyPI(loan, ratePct, n) + (P * taxRatePct / 100) / 12 + insAnnual / 12 + hoaMonthly +
      ((P > 0 && loan / P > 0.8) ? (loan * pmiRatePct / 100) / 12 : 0);
    if (piti > maxHousing) hi = P; else lo = P;
  }
  return { maxHousing, price: Math.max(down, lo), loan: Math.max(0, Math.max(down, lo) - down), backBinds };
}

// Refinance comparison. Returns { curPI, newPI, monthlySavings, breakevenMonths, lifetimeChange }.
function refinance({ balance, curRatePct, curYearsLeft, newRatePct, newYears, closingCosts, rollIntoLoan = true }) {
  const curMonths = Math.max(1, Math.round(curYearsLeft * 12)), newMonths = Math.max(1, Math.round(newYears * 12));
  const curPI = monthlyPI(balance, curRatePct, curMonths);
  const newLoan = balance + (rollIntoLoan ? closingCosts : 0);
  const newPI = monthlyPI(newLoan, newRatePct, newMonths);
  const monthlySavings = curPI - newPI;
  const upfront = rollIntoLoan ? 0 : closingCosts;
  return {
    curPI, newPI, monthlySavings,
    breakevenMonths: monthlySavings > 0 ? upfront / monthlySavings : Infinity,
    lifetimeChange: (newPI * newMonths + upfront) - (curPI * curMonths),
  };
}

// US federal holidays (observed) for a year, as a Set of ISO yyyy-mm-dd strings.
function federalHolidays(year) {
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const nth = (m, wd, n) => { let c = 0; for (let d = 1; d <= 31; d++) { const dt = new Date(year, m - 1, d); if (dt.getMonth() !== m - 1) break; if (dt.getDay() === wd && ++c === n) return dt; } return null; };
  const last = (m, wd) => { let res = null; for (let d = 1; d <= 31; d++) { const dt = new Date(year, m - 1, d); if (dt.getMonth() !== m - 1) break; if (dt.getDay() === wd) res = dt; } return res; };
  const obs = (m, d) => { let dt = new Date(year, m - 1, d); const w = dt.getDay(); if (w === 6) dt = new Date(year, m - 1, d - 1); else if (w === 0) dt = new Date(year, m - 1, d + 1); return dt; };
  const set = new Set();
  const add = (dt) => dt && set.add(iso(dt));
  add(obs(1, 1)); add(nth(1, 1, 3)); add(nth(2, 1, 3)); add(last(5, 1));
  if (year >= 2021) add(obs(6, 19));
  add(obs(7, 4)); add(nth(9, 1, 1)); add(nth(10, 1, 2)); add(obs(11, 11)); add(nth(11, 4, 4)); add(obs(12, 25));
  return set;
}

// Roll an ISO date back to the previous business day (skip weekends + federal holidays).
function previousBusinessDay(isoDate) {
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  let [y, m, d] = isoDate.split('-').map(Number);
  let dt = new Date(y, m - 1, d);
  for (let i = 0; i < 30; i++) {
    const w = dt.getDay();
    const holiday = federalHolidays(dt.getFullYear()).has(iso(dt));
    if (w !== 0 && w !== 6 && !holiday) return iso(dt);
    dt.setDate(dt.getDate() - 1);
  }
  return iso(dt);
}

// ===== Shared primitives for the non-mortgage areas (Auto, Investing, Budget, Debt,
// Retirement & Taxes). Kept here so the app and the unit tests run the exact same math. =====

// Future value of a starting balance plus a fixed monthly contribution, compounded monthly.
function futureValue(initial, monthly, annualPct, years) {
  const i = annualPct / 1200, n = Math.max(0, Math.round(years * 12));
  return !i ? initial + monthly * n : initial * Math.pow(1 + i, n) + monthly * ((Math.pow(1 + i, n) - 1) / i);
}

// Present value of a monthly annuity (max loan a given payment supports). Inverse of monthlyPI.
function presentValueAnnuity(payment, annualPct, months) {
  const i = annualPct / 1200, n = Math.max(0, months);
  return i ? payment * (1 - Math.pow(1 + i, -n)) / i : payment * n;
}

// Months to pay off a balance at a fixed payment. Infinity if the payment can't cover interest.
function payoffMonths(balance, annualPct, payment) {
  const i = annualPct / 1200;
  if (balance <= 0) return 0;
  if (!i) return payment > 0 ? balance / payment : Infinity;
  if (payment <= balance * i) return Infinity;
  return Math.log(payment / (payment - balance * i)) / Math.log(1 + i);
}

// Compound a single value at an annual rate for a number of years (rate may be negative).
function grow(value, annualPct, years) { return value * Math.pow(1 + annualPct / 100, years); }

// 2024 federal income-tax brackets + standard deductions, by filing status.
const TAX_2024 = {
  single:  { std: 14600, b: [[0, .10], [11600, .12], [47150, .22], [100525, .24], [191950, .32], [243725, .35], [609350, .37]] },
  married: { std: 29200, b: [[0, .10], [23200, .12], [94300, .22], [201050, .24], [383900, .32], [487450, .35], [731200, .37]] },
  hoh:     { std: 21900, b: [[0, .10], [16550, .12], [63100, .22], [100500, .24], [191950, .32], [243700, .35], [609350, .37]] },
};
// Tax on a taxable income given a marginal bracket table [[lowerBound, rate], ...].
function federalTax(taxable, brackets) {
  let t = 0;
  for (let i = 0; i < brackets.length; i++) {
    const lo = brackets[i][0], rate = brackets[i][1], hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (taxable > lo) t += (Math.min(taxable, hi) - lo) * rate; else break;
  }
  return t;
}
// Marginal rate (the bracket the top dollar falls in).
function marginalRate(taxable, brackets) { let r = brackets[0][1]; for (const [lo, rate] of brackets) if (taxable > lo) r = rate; return r; }

// IRS Uniform Lifetime Table (2022+): age -> distribution period (years).
const RMD_TABLE = { 72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4 };

// Multi-debt payoff simulation (snowball = smallest balance first, avalanche = highest APR
// first). Minimums are paid on every debt; `extra` plus any freed-up minimums roll onto the
// current target. Returns { months, interest, firstCleared, series } (series = total balance
// at each month, starting with the initial total). Does not mutate the input array.
function debtPayoff(debtsIn, extra, strategy) {
  const debts = (debtsIn || []).filter(d => d.bal > 0).map(d => ({ bal: d.bal, apr: d.apr, min: d.min }));
  let months = 0, interest = 0, firstCleared = 0;
  const series = [debts.reduce((s, d) => s + d.bal, 0)];
  const order = () => debts.map((d, i) => i).filter(i => debts[i].bal > 0.005)
    .sort((a, b) => strategy === 'avalanche' ? debts[b].apr - debts[a].apr : debts[a].bal - debts[b].bal);
  while (debts.some(d => d.bal > 0.005) && months < 1200) {
    months++;
    let pool = extra;
    debts.forEach(d => { if (d.bal > 0.005) { const int = d.bal * d.apr / 1200; interest += int; d.bal += int; } });
    debts.forEach(d => { if (d.bal > 0.005) { const p = Math.min(d.min, d.bal); d.bal -= p; pool += d.min - p; } });
    for (const idx of order()) { if (pool <= 0) break; const p = Math.min(pool, debts[idx].bal); debts[idx].bal -= p; pool -= p; }
    if (!firstCleared && debts.some(d => d.bal <= 0.005)) firstCleared = months;
    series.push(debts.reduce((s, d) => s + Math.max(0, d.bal), 0));
  }
  return { months, interest, firstCleared, series };
}

const MTK = {
  monthlyPI, amortize, payoffPayment, affordability, refinance, federalHolidays, previousBusinessDay,
  futureValue, presentValueAnnuity, payoffMonths, grow, federalTax, marginalRate, debtPayoff, TAX_2024, RMD_TABLE,
};

// Browser: expose as window.MTK (loaded via <script src="calc.js">).
if (typeof window !== 'undefined') window.MTK = MTK;
// Node (tests): CommonJS export. test/calc.test.mjs default-imports this object.
if (typeof module !== 'undefined' && module.exports) module.exports = MTK;
