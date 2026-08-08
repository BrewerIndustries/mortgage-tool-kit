import { test } from 'node:test';
import assert from 'node:assert/strict';
// calc.js is a CommonJS module (it doubles as the browser global window.MTK), so default-
// import the exports object and destructure. This is the SAME module index.html ships.
import MTK from '../calc.js';
const { monthlyPI, amortize, payoffPayment, affordability, refinance, federalHolidays, previousBusinessDay } = MTK;
const { futureValue, presentValueAnnuity, payoffMonths, grow, federalTax, marginalRate, debtPayoff, TAX_2024, RMD_TABLE } = MTK;

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test('monthlyPI: 360k @ 6.5% / 30yr ~= 2275', () => {
  near(monthlyPI(360000, 6.5, 360), 2275, 1);
});
test('monthlyPI: 0% loan is straight-line', () => {
  assert.equal(monthlyPI(120000, 0, 240), 500);
});
test('monthlyPI: zero principal is zero', () => {
  assert.equal(monthlyPI(0, 6, 360), 0);
});

test('amortize: no extra pays off in exactly the term', () => {
  const a = amortize(360000, 6.5, 30);
  assert.equal(a.months, 360);
  near(a.basePmt, 2275, 1);
});
test('amortize: extra + lump + biweekly shortens the term and cuts interest', () => {
  const base = amortize(360000, 6.5, 30);
  const acc = amortize(360000, 6.5, 30, { lumpAmount: 20000, biweekly: true });
  assert.ok(acc.months < base.months, 'should pay off sooner');
  assert.ok(acc.totalInterest < base.totalInterest, 'should pay less interest');
});
test('amortize: recurring extra reduces months', () => {
  assert.ok(amortize(300000, 6, 30, { extra: 300 }).months < 360);
});
test('amortize: schedule rows foot exactly and clear the balance', () => {
  const a = amortize(360000, 6.5, 30, { schedule: true });
  assert.equal(a.schedule.length, a.months);
  assert.equal(a.schedule[a.schedule.length - 1].bal, 0);          // loan is fully retired
  const sumPrin = a.schedule.reduce((s, r) => s + r.principal, 0);
  near(sumPrin, a.totalPrincipal, 0.01);                            // rows foot to the total
  near(sumPrin, 360000, 0.5);                                       // principal repaid == borrowed
});

test('payoffPayment: paying the N-month level payment retires the loan in ~N months', () => {
  const target = 180;                                              // pay a 30yr loan off in 15
  const pmt = payoffPayment(360000, 6.5, target);
  assert.ok(pmt > monthlyPI(360000, 6.5, 360), 'requires a higher payment than the 30yr schedule');
  const extra = pmt - monthlyPI(360000, 6.5, 360);
  near(amortize(360000, 6.5, 30, { extra }).months, target, 1);
});

test('affordability: front-end DTI binds for a high-debt-free earner', () => {
  const r = affordability({ annualIncome: 120000, monthlyDebts: 600, frontDTI: 28, backDTI: 36, down: 60000, ratePct: 6.5, termYears: 30, taxRatePct: 1.1, insAnnual: 1800, hoaMonthly: 0 });
  near(r.maxHousing, 2800, 1);               // 28% of 10000
  assert.equal(r.backBinds, false);
  assert.ok(r.price > 380000 && r.price < 410000, `price ${r.price}`);
});
test('affordability: heavy debts make the back-end ratio bind', () => {
  const r = affordability({ annualIncome: 90000, monthlyDebts: 2200, frontDTI: 28, backDTI: 36, down: 20000, ratePct: 6.5, termYears: 30, taxRatePct: 1.1, insAnnual: 1500, hoaMonthly: 0 });
  assert.equal(r.backBinds, true);
});

test('refinance: lower rate saves monthly and has a finite break-even when not rolled', () => {
  const r = refinance({ balance: 320000, curRatePct: 7.25, curYearsLeft: 27, newRatePct: 6.0, newYears: 30, closingCosts: 6000, rollIntoLoan: false });
  assert.ok(r.monthlySavings > 0);
  assert.ok(isFinite(r.breakevenMonths) && r.breakevenMonths > 0);
});
test('refinance: rolling costs in gives an immediate (zero-upfront) break-even', () => {
  const r = refinance({ balance: 320000, curRatePct: 7.25, curYearsLeft: 27, newRatePct: 6.0, newYears: 30, closingCosts: 6000, rollIntoLoan: true });
  assert.equal(r.breakevenMonths, 0);
});

test('federal holidays: Independence Day 2025 observed on Fri Jul 4', () => {
  assert.ok(federalHolidays(2025).has('2025-07-04'));
});
test('federal holidays: July 4 2026 (Saturday) observed Friday Jul 3', () => {
  const h = federalHolidays(2026);
  assert.ok(h.has('2026-07-03'));
  assert.ok(!h.has('2026-07-04'));
});

test('previousBusinessDay: Fri Jul 4 2025 (holiday) rolls to Thu Jul 3', () => {
  assert.equal(previousBusinessDay('2025-07-04'), '2025-07-03');
});
test('previousBusinessDay: Sunday rolls back to Friday', () => {
  assert.equal(previousBusinessDay('2025-06-15'), '2025-06-13');
});
test('previousBusinessDay: a normal weekday stays put', () => {
  assert.equal(previousBusinessDay('2026-06-08'), '2026-06-08');
});

// ===== Non-mortgage area primitives (Auto, Investing, Budget, Debt, Retirement & Taxes) =====

test('futureValue: 10k + 500/mo @ 7% for 30yr ~= 691k', () => {
  near(futureValue(10000, 500, 7, 30), 691140, 400);
});
test('futureValue: 0% is straight-line contributions', () => {
  assert.equal(futureValue(0, 100, 0, 10), 12000);
});
test('futureValue: lump sum only compounds monthly', () => {
  near(futureValue(1000, 0, 10, 1), 1104.71, 0.5);
});

test('presentValueAnnuity: inverse of monthlyPI', () => {
  const pv = presentValueAnnuity(1000, 6, 60);
  near(pv, 51725.6, 1);
  near(monthlyPI(pv, 6, 60), 1000, 0.01);   // round-trips
});

test('payoffMonths: 0% is balance / payment', () => {
  assert.equal(payoffMonths(5000, 0, 250), 20);
});
test('payoffMonths: payment below interest never pays off', () => {
  assert.equal(payoffMonths(5000, 22, 90), Infinity);   // interest ~= 91.67/mo
});
test('payoffMonths: round-trips with monthlyPI', () => {
  const pay = monthlyPI(20000, 7, 120);
  near(payoffMonths(20000, 7, pay), 120, 0.1);
});

test('grow: positive and negative compounding', () => {
  near(grow(1000, 10, 2), 1210, 0.01);
  near(grow(30000, -15, 5), 13311.16, 1);
});

test('federalTax: $70,400 taxable (2024 single) ~= $10,541', () => {
  near(federalTax(70400, TAX_2024.single.b), 10541, 1);
  assert.equal(federalTax(0, TAX_2024.single.b), 0);
});
test('marginalRate: $70,400 single is the 22% bracket', () => {
  assert.equal(marginalRate(70400, TAX_2024.single.b), 0.22);
});
test('federalTax: married brackets are wider than single', () => {
  assert.ok(federalTax(100000, TAX_2024.married.b) < federalTax(100000, TAX_2024.single.b));
});

test('debtPayoff: 3 debts + $200 extra (avalanche) clears in ~44 mo, ~$3,888 interest', () => {
  const debts = [{ bal: 6000, apr: 22, min: 150 }, { bal: 12000, apr: 7, min: 250 }, { bal: 3000, apr: 15, min: 80 }];
  const plan = debtPayoff(debts, 200, 'avalanche');
  near(plan.months, 44, 1);
  near(plan.interest, 3888, 60);
  assert.equal(plan.series[0], 21000);                       // starts at total balance
  assert.ok(plan.series[plan.series.length - 1] < 1);        // ends cleared
  assert.equal(debts[0].bal, 6000);                          // does not mutate the input
});
test('debtPayoff: extra payment beats minimums-only on interest and time', () => {
  const debts = [{ bal: 6000, apr: 22, min: 150 }, { bal: 12000, apr: 7, min: 250 }, { bal: 3000, apr: 15, min: 80 }];
  const plan = debtPayoff(debts, 200, 'avalanche');
  const minOnly = debtPayoff(debts, 0, 'avalanche');
  assert.ok(minOnly.interest > plan.interest);
  assert.ok(minOnly.months > plan.months);
});
test('debtPayoff: avalanche costs no more interest than snowball', () => {
  const debts = [{ bal: 6000, apr: 22, min: 150 }, { bal: 12000, apr: 7, min: 250 }, { bal: 3000, apr: 15, min: 80 }];
  const av = debtPayoff(debts, 200, 'avalanche');
  const sn = debtPayoff(debts, 200, 'snowball');
  assert.ok(av.interest <= sn.interest + 1);
});

test('RMD table: age 73 distribution period is 26.5', () => {
  assert.equal(RMD_TABLE[73], 26.5);
  near(500000 / RMD_TABLE[73], 18867.9, 1);
});
