import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyPI, amortize, affordability, refinance, federalHolidays, previousBusinessDay } from '../calc.mjs';

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
