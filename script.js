/* EliteBudget Pro Ultimate - Offline-first financial management engine */
(() => {
  'use strict';

  const LEGACY_APP_KEY = 'elitebudget_pro_ultimate_v1';
  const USERS_KEY = 'elitebudget_users_v1';
  const CURRENT_USER_KEY = 'elitebudget_current_user_v1';
  const DATA_PREFIX = 'elitebudget_user_data_';
  let currentUserId = localStorage.getItem(CURRENT_USER_KEY) || '';
  const userDataKey = () => currentUserId ? `${DATA_PREFIX}${currentUserId}` : LEGACY_APP_KEY;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const localDate = value => { const [y,m,d] = String(value || today()).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const monthStart = (date = today()) => { const d = localDate(date); return new Date(d.getFullYear(), d.getMonth(), 1); };
  const monthEnd = (date = today()) => { const d = localDate(date); return new Date(d.getFullYear(), d.getMonth() + 1, 0); };
  const daysInMonth = (date = today()) => monthEnd(date).getDate();
  const sameMonth = (a, b) => { const x = localDate(a), y = localDate(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth(); };
  const daysBetween = (a, b) => Math.ceil((new Date(b) - new Date(a)) / 86400000);
  const num = value => Number.parseFloat(value || 0) || 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const categories = ['Housing','Food','Transportation','Fuel','Utilities','Internet','Phone','Insurance','Medical','Education','Business','Taxes','Entertainment','Shopping','Subscriptions','Travel','Children','Family','Emergency','Savings','Investments','Other'];

  const blankData = () => ({
    settings: {
      name: '', businessName: 'EliteBudget Pro', currency: 'J$', country: 'Jamaica',
      budgetMethod: '50/30/20', riskTolerance: 'Medium', emergencyTarget: 0, savingsPercent: 20,
      pin: '', theme: 'light', autoLock: false
    },
    accounts: [],
    transactions: [],
    incomes: [],
    expenses: [],
    bills: [],
    savings: [],
    debts: [],
    risks: [],
    journals: []
  });

  let state = currentUserId ? load() : blankData();

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
    catch { return []; }
  }
  function setUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
  function load() {
    try {
      const saved = localStorage.getItem(userDataKey());
      if (saved) return JSON.parse(saved);
    } catch (error) { console.warn('Local data could not be read.', error); }
    const fresh = blankData();
    localStorage.setItem(userDataKey(), JSON.stringify(fresh));
    return fresh;
  }
  function save() { if (currentUserId) localStorage.setItem(userDataKey(), JSON.stringify(state)); }
  function money(v) { return `${state.settings.currency || '$'}${num(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }

  function transactionAccountDelta(t) {
    const amount = num(t?.amount);
    if (['income', 'deposit', 'refund'].includes(String(t?.type).toLowerCase())) return amount;
    if (['expense', 'withdrawal', 'bill', 'savings', 'debt', 'investment'].includes(String(t?.type).toLowerCase())) return -amount;
    return 0;
  }

  function applyTransactionToAccount(t, direction = 1) {
    if (!t || !t.account) return;
    const account = state.accounts.find(a => a.name === t.account);
    if (!account) return;
    account.balance = num(account.balance) + transactionAccountDelta(t) * direction;
  }

  function normalizeTransactionRecord(data) {
    data.amount = num(data.amount);
    data.date = data.date || today();
    data.type = data.type || 'expense';
    data.category = data.category || 'Other';
    data.description = data.description || `${data.type} transaction`;
    return data;
  }



  function isMasterLinkedTransaction(t) {
    const source = t?.linkedSource;
    return !!(source && ['incomes','expenses','bills'].includes(source.collection));
  }

  function isDebtPaymentTransaction(t) {
    const source = t?.linkedSource;
    return !!(source && source.collection === 'debts' && String(t?.type || '').toLowerCase() === 'debt');
  }

  function removeLinkedTransactions(collection, sourceId) {
    state.transactions = state.transactions.filter(t => !(t.linkedSource && t.linkedSource.collection === collection && t.linkedSource.id === sourceId));
  }

  function debtPayments(debtId) {
    return state.transactions
      .filter(t => t.linkedSource && t.linkedSource.collection === 'debts' && t.linkedSource.id === debtId && String(t.type || '').toLowerCase() === 'debt')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function debtPaidTotal(debtId) {
    return debtPayments(debtId).reduce((sum, t) => sum + num(t.amount), 0);
  }

  function debtOriginalAmount(d) {
    // Preserve the true starting balance. For old records without originalAmount, reconstruct it once from current balance + payments made.
    return num(d.originalAmount || d.openingBalance || (num(d.balance) + debtPaidTotal(d.id)));
  }

  function incomePayDatesForMonth(i, targetDate = today()) {
    const amountDate = i.date || today();
    const frequency = normalizedFrequency(i);
    const start = monthStart(targetDate);
    const end = monthEnd(targetDate);
    const anchor = localDate(amountDate);

    if (i.recurring === false || String(i.recurring) === 'false' || frequency === 'one-time') {
      return sameMonth(amountDate, targetDate) ? [amountDate] : [];
    }
    if (frequency === 'daily') {
      const dates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dates.push(d.toISOString().slice(0, 10));
      return dates;
    }
    if (frequency === 'monthly') return [new Date(start.getFullYear(), start.getMonth(), Math.min(anchor.getDate(), end.getDate())).toISOString().slice(0, 10)];
    if (frequency === 'yearly') return anchor.getMonth() === start.getMonth() ? [new Date(start.getFullYear(), start.getMonth(), Math.min(anchor.getDate(), end.getDate())).toISOString().slice(0, 10)] : [];

    const interval = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 0;
    if (!interval) return [today()];

    const msDay = 86400000;
    const diff = Math.floor((start - anchor) / msDay);
    let k = Math.ceil(diff / interval);
    let payDate = new Date(anchor);
    payDate.setDate(anchor.getDate() + k * interval);
    const dates = [];
    while (payDate <= end) {
      if (payDate >= start) dates.push(payDate.toISOString().slice(0, 10));
      payDate.setDate(payDate.getDate() + interval);
    }
    return dates;
  }

  function syncLinkedLedger() {
    const manual = state.transactions.filter(t => !isMasterLinkedTransaction(t));
    const linked = [];

    state.incomes.forEach(i => {
      incomePayDatesForMonth(i, today()).forEach(date => {
        linked.push(normalizeTransactionRecord({
          id: uid(),
          date,
          type: 'income',
          description: `Auto income: ${i.source || i.type || 'Income'}`,
          category: 'Income',
          amount: netIncomeAmount(i),
          account: '',
          tags: 'auto, income-source',
          notes: 'Generated from the Income tab. Dashboard income is calculated from the income source to prevent double counting.',
          linkedSource: { collection: 'incomes', id: i.id }
        }));
      });
    });

    state.expenses.forEach(e => {
      const amount = monthlyEquivalentAmount(e);
      if (amount > 0) {
        linked.push(normalizeTransactionRecord({
          id: uid(),
          date: e.date || today(),
          type: 'expense',
          description: `Auto expense: ${e.name || 'Expense'}`,
          category: e.category || 'Other',
          amount,
          account: '',
          tags: 'auto, expense-record',
          notes: 'Generated from the Expenses tab. Dashboard expense is calculated from the expense record to prevent double counting.',
          linkedSource: { collection: 'expenses', id: e.id }
        }));
      }
    });

    state.bills.forEach(b => {
      if (String(b.status || '').toLowerCase() === 'paid') {
        linked.push(normalizeTransactionRecord({
          id: uid(),
          date: b.paidDate || today(),
          type: 'bill',
          description: `Bill paid: ${b.name || 'Bill'}`,
          category: 'Bills',
          amount: num(b.amount),
          account: '',
          tags: 'auto, bill-payment',
          notes: 'Generated when the bill is marked paid. Dashboard paid bills are calculated from the bill record to prevent double counting.',
          linkedSource: { collection: 'bills', id: b.id }
        }));
      }
    });

    state.transactions = [...manual, ...linked].sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  function toast(message) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; $('#toastStack').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  const Finance = {
    incomeMonthly(source = state.incomes) {
      const recurringIncome = plannedMonthlyIncome(source);
      if (source !== state.incomes) return recurringIncome;
      return recurringIncome + transactionTotalsForMonth().income;
    },
    transactionIncomeMonthly() { return transactionTotalsForMonth().income; },
    transactionOutflowMonthly() { return transactionTotalsForMonth().outflow; },
    transactionSpendingMonthly() { return transactionTotalsForMonth().spending; },
    paidBillsMonthly() {
      return state.bills.reduce((s, b) => {
        const paid = String(b.status || '').toLowerCase() === 'paid';
        const paidDate = b.paidDate || b.dueDate || today();
        return paid && sameMonth(paidDate, today()) ? s + num(b.amount) : s;
      }, 0);
    },
    unpaidBillsMonthly() {
      return state.bills.reduce((s, b) => {
        const unpaid = String(b.status || 'unpaid').toLowerCase() !== 'paid';
        const dueDate = b.dueDate || today();
        return unpaid && sameMonth(dueDate, today()) ? s + num(b.amount) : s;
      }, 0);
    },
    expenseMonthly() {
      return plannedMonthlyExpenses() + transactionTotalsForMonth().spending;
    },
    billsMonthly() { return this.unpaidBillsMonthly(); },
    totalMonthlyOutflow() { return this.expenseMonthly() + this.paidBillsMonthly() + transactionTotalsForMonth().savings + transactionTotalsForMonth().debtPayments + transactionTotalsForMonth().investments; },
    currentBalance() { return this.incomeMonthly() - this.totalMonthlyOutflow(); },
    debtTotal() { return state.debts.reduce((s, d) => s + num(d.balance), 0); },
    savingsTotal() { return state.savings.reduce((s, g) => s + num(g.current), 0); },
    accountBalance() { return state.accounts.reduce((s, a) => s + num(a.balance), 0); },
    emergencySaved() { return state.savings.filter(g => /emergency/i.test(g.name + g.type)).reduce((s, g) => s + num(g.current), 0); },
    netWorth() { return this.accountBalance() + this.savingsTotal() - this.debtTotal(); },
    budget() {
      const income = this.incomeMonthly();
      const method = state.settings.budgetMethod;
      let split = { Needs: .50, Wants: .30, Savings: .20, Debt: .00, Business: .00 };
      if (method === 'conservative') split = { Needs: .55, Wants: .15, Savings: .20, Debt: .10, Business: .00 };
      if (method === 'aggressive') split = { Needs: .45, Wants: .10, Savings: .35, Debt: .10, Business: .00 };
      if (method === 'debt') split = { Needs: .50, Wants: .10, Savings: .10, Debt: .30, Business: .00 };
      if (method === 'zero') split = { Needs: .48, Wants: .17, Savings: .15, Debt: .15, Business: .05 };
      return Object.entries(split).map(([name, pct]) => ({ name, pct, amount: income * pct }));
    },
    scores() {
      const income = this.incomeMonthly(); const expenses = this.expenseMonthly(); const bills = this.billsMonthly(); const paidBills = this.paidBillsMonthly(); const totalOutflow = this.totalMonthlyOutflow(); const debt = this.debtTotal(); const emergency = this.emergencySaved();
      const savingsTarget = num(state.settings.emergencyTarget) || 1;
      const cashFlowRatio = income ? (income - totalOutflow) / income : -1;
      const billRatio = income ? bills / income : 1;
      const debtRatio = income ? debt / (income * 12) : 1;
      const emergencyRatio = clamp(emergency / savingsTarget, 0, 1);
      const budgetScore = clamp(100 - (Math.max(0, totalOutflow - income) / Math.max(income,1)) * 100 - billRatio * 18, 0, 100);
      const savingsScore = clamp(emergencyRatio * 80 + (cashFlowRatio > .1 ? 20 : 0), 0, 100);
      const spendingScore = clamp(100 - (totalOutflow / Math.max(income, 1)) * 70, 0, 100);
      const riskScore = clamp(100 - debtRatio * 45 - billRatio * 25 + emergencyRatio * 25, 0, 100);
      const health = Math.round((budgetScore + savingsScore + spendingScore + riskScore) / 4);
      return { budgetScore: Math.round(budgetScore), savingsScore: Math.round(savingsScore), spendingScore: Math.round(spendingScore), riskScore: Math.round(riskScore), health };
    },
    recommendations() {
      const income = this.incomeMonthly(); const expenses = this.expenseMonthly(); const bills = this.billsMonthly(); const paidBills = this.paidBillsMonthly(); const totalOutflow = this.totalMonthlyOutflow(); const debt = this.debtTotal(); const emergency = this.emergencySaved();
      const recs = [];
      if (income <= 0) recs.push(['bad','Add income sources so the budget engine can calculate safe limits.']);
      if (totalOutflow > income) recs.push(['bad',`Your paid bills, expenses, and outflows exceed income by ${money(totalOutflow - income)}. Cut recurring costs first.`]);
      if (bills > income * .45) recs.push(['warn',`Bills are above 45% of income. Reduce fixed bills by about ${money(bills - income * .45)}.`]);
      if (emergency < num(state.settings.emergencyTarget) * .25) recs.push(['warn','Emergency fund is weak. Avoid high-risk decisions until at least 25% funded.']);
      if (debt > income * 6) recs.push(['warn','Debt balance is high compared to monthly income. Use avalanche payoff for high-interest debts.']);
      if (!state.bills.some(b => b.status === 'unpaid' && daysBetween(today(), b.dueDate) <= 7)) recs.push(['good','No major unpaid bill pressure detected for the next 7 days.']);
      if (income > totalOutflow) recs.push(['good',`Remaining monthly balance is ${money(income - totalOutflow)}. Safe savings capacity is approximately ${money((income - totalOutflow) * .55)}.`]);
      return recs;
    },
    risk(entry) {
      const risk = num(entry.risk), reward = num(entry.reward), balance = num(entry.balance), p = num(entry.probability) / 100;
      const expectedValue = reward * p - risk * (1 - p);
      const ratio = risk ? reward / risk : 0;
      const safePct = balance ? (risk / balance) * 100 : 100;
      const kelly = reward && risk ? clamp(((ratio * p) - (1 - p)) / ratio, 0, 1) * 100 : 0;
      let level = 'Low'; let klass = 'good';
      if (safePct > 10 || ratio < 2 || expectedValue < 0) { level = 'High'; klass = 'warn'; }
      if (safePct > 20 || (expectedValue < 0 && ratio < 1.5)) { level = 'Extreme'; klass = 'bad'; }
      if (safePct <= 5 && ratio >= 2 && expectedValue > 0) { level = 'Low'; klass = 'good'; }
      return { ratio, expectedValue, safePct, kelly, level, klass, maxLoss: risk, maxGain: reward, breakEven: ratio ? (1 / (1 + ratio)) * 100 : 0 };
    }
  };

  function isThisMonth(date) {
    return sameMonth(date, today());
  }
  function transactionTotalsForMonth() {
    return state.transactions.filter(t => isThisMonth(t.date)).reduce((totals, t) => {
      if (isMasterLinkedTransaction(t)) return totals;
      const type = String(t.type || '').toLowerCase();
      const amount = num(t.amount);
      if (['income', 'deposit', 'refund'].includes(type)) totals.income += amount;
      if (['expense', 'withdrawal', 'bill', 'savings', 'debt', 'investment'].includes(type)) totals.outflow += amount;
      if (['expense', 'withdrawal', 'bill'].includes(type)) totals.spending += amount;
      if (type === 'savings') totals.savings += amount;
      if (type === 'debt') totals.debtPayments += amount;
      if (type === 'investment') totals.investments += amount;
      return totals;
    }, { income: 0, outflow: 0, spending: 0, savings: 0, debtPayments: 0, investments: 0 });
  }

  function netIncomeAmount(i) {
    return Math.max(0, num(i.amount) - num(i.deductions));
  }

  function normalizedFrequency(i) {
    const f = String(i.frequency || i.type || '').toLowerCase().replaceAll('-', '').replaceAll(' ', '');
    if (f.includes('fortnight') || f.includes('biweekly') || f.includes('biweekly')) return 'biweekly';
    if (f.includes('weekly')) return 'weekly';
    if (f.includes('daily')) return 'daily';
    if (f.includes('monthly')) return 'monthly';
    if (f.includes('quarter')) return 'quarterly';
    if (f.includes('one-time') || f.includes('onetime') || f.includes('once')) return 'one-time';
    if (f.includes('yearly') || f.includes('annual')) return 'yearly';
    return f || 'monthly';
  }

  function countRecurringPaymentsInMonth(i, targetDate = today()) {
    const amountDate = i.date || today();
    const frequency = normalizedFrequency(i);
    const start = monthStart(targetDate);
    const end = monthEnd(targetDate);
    const anchor = localDate(amountDate);

    if (i.recurring === false || String(i.recurring) === 'false' || frequency === 'one-time') {
      return sameMonth(amountDate, targetDate) ? 1 : 0;
    }
    if (frequency === 'daily') return daysInMonth(targetDate);
    if (frequency === 'monthly') return 1;
    if (frequency === 'yearly') return anchor.getMonth() === start.getMonth() ? 1 : 0;

    const interval = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 0;
    if (!interval) return 1;

    const msDay = 86400000;
    const diff = Math.floor((start - anchor) / msDay);
    let k = Math.ceil(diff / interval);
    let payDate = new Date(anchor);
    payDate.setDate(anchor.getDate() + k * interval);
    let count = 0;
    while (payDate <= end) {
      if (payDate >= start) count += 1;
      payDate.setDate(payDate.getDate() + interval);
    }
    return count;
  }

  function incomeForMonth(source = state.incomes, targetDate = today()) {
    return source.reduce((sum, i) => sum + netIncomeAmount(i) * countRecurringPaymentsInMonth(i, targetDate), 0);
  }

  function projectedIncomeForMonths(source = state.incomes, months = 12, startDate = today()) {
    const base = monthStart(startDate);
    let total = 0;
    for (let m = 0; m < months; m++) {
      const d = new Date(base.getFullYear(), base.getMonth() + m, 1);
      total += incomeForMonth(source, d.toISOString().slice(0, 10));
    }
    return total;
  }

  function plannedMonthlyIncome(source = state.incomes) {
    return incomeForMonth(source, today());
  }

  function monthlyEquivalentAmount(record) {
    const amount = num(record.amount);
    const frequency = normalizedFrequency(record);
    if (record.recurring === false || String(record.recurring) === 'false') {
      return sameMonth(record.date || record.dueDate || today(), today()) ? amount : 0;
    }
    if (frequency === 'daily') return amount * daysInMonth(today());
    if (frequency === 'weekly') return amount * 52 / 12;
    if (frequency === 'biweekly') return amount * countRecurringPaymentsInMonth(record, today());
    if (frequency === 'yearly') return amount / 12;
    if (frequency === 'quarterly') return amount / 3;
    return amount;
  }

  function plannedMonthlyExpenses() {
    return state.expenses.reduce((s, e) => s + monthlyEquivalentAmount(e), 0);
  }


  function renderAll() {
    syncLinkedLedger();
    applyTheme(); renderProfile(); renderDashboard(); renderTables(); renderBudget(); renderSavings(); renderDebt(); renderRisk(); renderAccounting(); renderReports(); save();
  }
  function renderProfile() {
    const s = state.settings; $('#profileNameTop').textContent = s.name?.split(' ')[0] || 'User'; $('#businessNameTop').textContent = s.businessName || 'EliteBudget Pro';
    $('#profileInitials').textContent = (s.name || 'User').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const score = Finance.scores().health;

const sideHealth = $('#sideHealth');
const sideHealthBar = $('#sideHealthBar');

if (sideHealth) {
    sideHealth.textContent = `${score}%`;
}

if (sideHealthBar) {
    sideHealthBar.style.width = `${score}%`;
}
  }
  function kpi(title, value, note) { return `<article class="kpi-card glass-panel"><small>${title}</small><strong>${value}</strong><span>${note}</span></article>`; }
  function renderDashboard() {
    const txTotals = transactionTotalsForMonth();
    const income = Finance.incomeMonthly(), expenses = Finance.expenseMonthly(), unpaidBills = Finance.unpaidBillsMonthly(), paidBills = Finance.paidBillsMonthly(), totalOutflow = Finance.totalMonthlyOutflow(), currentBalance = Finance.currentBalance(), debt = Finance.debtTotal(), savings = Finance.savingsTotal(), net = Finance.netWorth(), scores = Finance.scores();
    $('#kpiGrid').innerHTML = [
      kpi('Current Balance', money(currentBalance), 'Monthly income minus expenses, paid bills, savings, debt, and investments'),
      kpi('Monthly Plan Income', money(income), 'Recurring income + income transactions'),
      kpi('Total Outflow', money(totalOutflow), 'Expenses + paid bills + savings/debt/investments'),
      kpi('Monthly Expenses', money(expenses), 'Expense tab deductions + expense transactions'),
      kpi('Paid Bills', money(paidBills), 'Bills marked paid this month'),
      kpi('Bills Due', money(unpaidBills), 'Unpaid bills due this month'),
      kpi('Net Worth', money(net), 'Accounts + savings - debt'),
      kpi('Health Score', `${scores.health}%`, 'Overall financial condition')
    ].join('');
    $('#recommendations').innerHTML = Finance.recommendations().map(([c, t]) => `<div class="alert ${c}">${t}</div>`).join('');
    const upcoming = state.bills.filter(b => b.status !== 'paid').sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).slice(0,5);
    $('#upcomingBills').innerHTML = upcoming.map(b => `<div class="mini-item"><div><strong>${b.name}</strong><small>${b.dueDate} • ${b.priority}</small></div><strong>${money(b.amount)}</strong></div>`).join('') || '<p class="muted">No unpaid bills.</p>';
    $('#recentTransactions').innerHTML = table(['Date','Type','Description','Category','Amount'], state.transactions.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,7).map(t=>[t.date, badge(t.type), t.description, t.category, money(t.amount)]));
    drawCashFlow(); drawCategoryChart(); drawBudgetChart();
  }
  function badge(text, klass='') { return `<span class="badge ${klass}">${text}</span>`; }
  function table(headers, rows, emptyMessage = 'No records yet. Add your first item to begin.') {
    const body = rows.length
      ? rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${headers.length}" class="empty-cell">${emptyMessage}</td></tr>`;
    return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  }
  function actionButtons(collection, id) {
    if (collection === 'transactions') {
      const record = state.transactions.find(t => t.id === id);
      if (isMasterLinkedTransaction(record)) {
        return `<div class="row-actions"><span class="badge good">Auto ledger</span></div>`;
      }
      if (isDebtPaymentTransaction(record)) {
        return `<div class="row-actions"><button class="small-btn" data-delete="${collection}" data-id="${id}">Delete Payment</button></div>`;
      }
    }
    return `<div class="row-actions"><button class="small-btn" data-edit="${collection}" data-id="${id}">Edit</button><button class="small-btn" data-delete="${collection}" data-id="${id}">Delete</button></div>`;
  }

  function renderTables() {
    const tQuery = ($('#transactionSearch')?.value || '').toLowerCase(); const tFilter = $('#transactionFilter')?.value || 'all';
    let tx = state.transactions.filter(t => [t.description,t.category,t.type,t.account,t.tags].join(' ').toLowerCase().includes(tQuery)); if (tFilter !== 'all') tx = tx.filter(t => t.type === tFilter);
    $('#transactionsTable').innerHTML = table(['Date','Type','Description','Category','Account','Amount','Actions'], tx.map(t => [t.date, badge(t.type), t.description, t.category, t.account, money(t.amount), actionButtons('transactions', t.id)]));
    $('#incomeTable').innerHTML = table(['Source','Type','Amount','Frequency','This Month','Next Pay Date','Actions'], state.incomes.map(i => [i.source, i.type, money(i.amount), normalizedFrequency(i), money(Finance.incomeMonthly([i])), i.date || 'Not set', actionButtons('incomes', i.id)]));
    const monthly = Finance.incomeMonthly();
    const yearly = projectedIncomeForMonths(state.incomes, 12);
    $('#incomeSummary').innerHTML = `<div class="section-title"><h2>Income Analysis</h2><span>Real payday calendar</span></div><div class="statement-grid"><div class="statement">Daily Avg.<strong>${money(yearly/365)}</strong></div><div class="statement">Weekly Avg.<strong>${money(yearly/52)}</strong></div><div class="statement">This Month<strong>${money(monthly)}</strong></div><div class="statement">Next 12 Months<strong>${money(yearly)}</strong></div></div><p class="muted">Bi-weekly / fortnightly income is counted by actual pay dates. Normal months show 2 paychecks; three-paycheck months show 3.</p>`;
    renderPayCalendar();
    const eQuery = ($('#expenseSearch')?.value || '').toLowerCase(); const eCat = $('#expenseCategoryFilter')?.value || 'all';
    let ex = state.expenses.filter(e => [e.name,e.category,e.notes].join(' ').toLowerCase().includes(eQuery)); if (eCat !== 'all') ex = ex.filter(e => e.category === eCat);
    $('#expensesTable').innerHTML = table(['Name','Category','Amount','Frequency','Monthly Deduction','Recurring','Priority','% Income','Actions'], ex.map(e => [e.name, e.category, money(e.amount), e.frequency || 'monthly', money(monthlyEquivalentAmount(e)), e.recurring ? 'Yes' : 'No', e.priority, `${((monthlyEquivalentAmount(e)/Math.max(monthly,1))*100).toFixed(1)}%`, actionButtons('expenses', e.id)]));
    $('#billsTable').innerHTML = table(['Bill','Amount','Due','Frequency','Status','Paid Date','Risk','Actions'], state.bills.map(b => [b.name, money(b.amount), b.dueDate, b.frequency, badge(b.status, b.status === 'paid' ? 'good' : daysBetween(today(), b.dueDate) < 0 ? 'bad' : 'warn'), b.paidDate || '—', billRisk(b), `${b.status !== 'paid' ? `<button class="small-btn" data-pay-bill="${b.id}">Mark Paid</button>` : ''}${actionButtons('bills', b.id)}`]));
    $('#billCalendar').innerHTML = `<div class="section-title"><h2>Bill Calendar</h2><span>Due timeline</span></div>${state.bills.slice().sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).map(b=>`<div class="mini-item"><div><strong>${b.dueDate}</strong><small>${b.name}</small></div><span>${money(b.amount)}</span></div>`).join('')}`;
    const catSelect = $('#expenseCategoryFilter'); if (catSelect && catSelect.children.length < 3) catSelect.innerHTML = '<option value="all">All Categories</option>' + categories.map(c=>`<option>${c}</option>`).join('');
  }

  function renderPayCalendar() {
    const panel = $('#payCalendar');
    if (!panel) return;
    if (!state.incomes.length) {
      panel.innerHTML = '<div class="section-title"><h2>Pay Calendar</h2><span>No income yet</span></div><p class="muted">Add recurring income with a next pay date to generate your paycheck calendar.</p>';
      return;
    }
    const base = monthStart(today());
    const rows = [];
    for (let m = 0; m < 12; m++) {
      const d = new Date(base.getFullYear(), base.getMonth() + m, 1);
      const key = d.toISOString().slice(0, 10);
      const monthName = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      const total = incomeForMonth(state.incomes, key);
      const details = state.incomes.map(i => `${countRecurringPaymentsInMonth(i, key)} × ${money(netIncomeAmount(i))}`).join(' + ');
      const count = state.incomes.reduce((sum, i) => sum + countRecurringPaymentsInMonth(i, key), 0);
      rows.push(`<div class="mini-item ${count >= 3 ? 'three-pay-month' : ''}"><div><strong>${monthName}</strong><small>${details}</small></div><strong>${money(total)}</strong></div>`);
    }
    panel.innerHTML = `<div class="section-title"><h2>Pay Calendar</h2><span>Next 12 months</span></div>${rows.join('')}`;
  }

  function billRisk(b) { const days = daysBetween(today(), b.dueDate); if (b.status === 'paid') return badge('Cleared','good'); if (days < 0) return badge('Overdue','bad'); if (days <= 7) return badge('Due Soon','warn'); return badge('Normal','good'); }

  function renderBudget() {
    const budget = Finance.budget(); const income = Finance.incomeMonthly(); const spent = Finance.totalMonthlyOutflow(); const score = Finance.scores().budgetScore;
    $('#budgetCards').innerHTML = `<div class="section-title"><h2>${state.settings.budgetMethod} Budget</h2><span>Score ${score}/100</span></div>${budget.map(b=>`<div class="mini-item"><div><strong>${b.name}</strong><small>${Math.round(b.pct*100)}% allocation</small></div><strong>${money(b.amount)}</strong></div>`).join('')}`;
    $('#budgetAdvice').innerHTML = `<div class="section-title"><h2>Budget Advice</h2><span>Generated from current data</span></div><p>Monthly income is <strong>${money(income)}</strong>. Current expenses plus bills are <strong>${money(spent)}</strong>. Remaining projected cash flow is <strong>${money(income - spent)}</strong>.</p>${Finance.recommendations().map(([c,t])=>`<div class="alert ${c}">${t}</div>`).join('')}`;
  }
  function renderSavings() {
    $('#savingsGrid').innerHTML = state.savings.length ? state.savings.map(g => {
      const pct = clamp(num(g.current) / Math.max(num(g.target), 1) * 100, 0, 100); const days = Math.max(daysBetween(today(), g.deadline), 1); const remaining = Math.max(num(g.target)-num(g.current),0);
      return `<article class="goal-card glass-panel"><div class="section-title"><h2>${g.name}</h2>${actionButtons('savings', g.id)}</div><div class="amount">${money(g.current)} / ${money(g.target)}</div><div class="progress"><span style="width:${pct}%"></span></div><p class="muted">${pct.toFixed(1)}% complete. Save ${money(remaining/days)} daily or ${money(remaining/Math.max(days/7,1))} weekly to hit ${g.deadline}.</p></article>`;
    }).join('') : '<div class="empty-card glass-panel"><strong>No savings goals yet.</strong><p class="muted">Create your first goal to track progress.</p></div>';
  }
  function renderDebt() {
    const debts = state.debts.slice().sort((a,b)=> num(b.interest)-num(a.interest));
    $('#debtTable').innerHTML = table(['Debt','Original','Remaining','Paid','Progress','Interest','Minimum','Due','Actions'], debts.map(d => {
      const paid = debtPaidTotal(d.id);
      const original = debtOriginalAmount(d);
      const progress = clamp((paid / Math.max(original, 1)) * 100, 0, 100);
      const payBtn = `<button class="small-btn" data-pay-debt="${d.id}">Make Payment</button>`;
      return [
        d.name,
        money(original),
        money(d.balance),
        money(paid),
        `<div class="progress mini-progress"><span style="width:${progress}%"></span></div><small>${progress.toFixed(1)}%</small>`,
        `${d.interest || 0}%`,
        money(d.minimum),
        d.dueDate || '—',
        `${payBtn}${actionButtons('debts', d.id)}`
      ];
    }));

    const total = Finance.debtTotal();
    const min = state.debts.reduce((s,d)=>s+num(d.minimum),0);
    const paidTotal = state.debts.reduce((s,d)=>s+debtPaidTotal(d.id),0);
    const priority = debts[0];
    const recentPayments = state.transactions
      .filter(t => t.linkedSource && t.linkedSource.collection === 'debts')
      .sort((a,b)=>new Date(b.date)-new Date(a.date))
      .slice(0,8);
    $('#debtPlan').innerHTML = `<div class="section-title"><h2>Debt Payment Center</h2><span>Pay down debt without editing balances directly</span></div>
      <div class="statement-grid">
        <div class="statement">Remaining Debt<strong>${money(total)}</strong></div>
        <div class="statement">Paid So Far<strong>${money(paidTotal)}</strong></div>
        <div class="statement">Monthly Minimums<strong>${money(min)}</strong></div>
      </div>
      <p>Priority debt: <strong>${priority ? priority.name : 'None'}</strong>. Click <strong>Make Payment</strong> beside a debt to reduce the remaining balance, deduct from current balance, and create a debt-payment transaction.</p>
      <div class="section-title"><h2>Recent Debt Payments</h2><span>Ledger history</span></div>
      ${recentPayments.length ? recentPayments.map(t=>`<div class="mini-item"><div><strong>${t.description}</strong><small>${t.date} • ${t.paymentMethod || 'Payment'}</small></div><strong>${money(t.amount)}</strong></div>`).join('') : '<p class="muted">No debt payments recorded yet.</p>'}`;
  }
  function renderRisk() {
    $('#riskTable').innerHTML = table(['Date','Category','Risk','Reward','Probability','Expected Value','Level','Actions'], state.risks.map(r => { const a = Finance.risk(r); return [r.date, r.category, money(r.risk), money(r.reward), `${r.probability}%`, money(a.expectedValue), badge(a.level, a.klass), actionButtons('risks', r.id)]; }));
    const latest = state.risks.at(-1); if (!latest) { $('#riskSummary').innerHTML = '<p class="muted">No risk entries yet.</p>'; return; }
    const a = Finance.risk(latest); $('#riskSummary').innerHTML = `<div class="section-title"><h2>Latest Risk Analysis</h2><span>${a.level}</span></div><div class="statement-grid"><div class="statement">Risk/Reward<strong>${a.ratio.toFixed(2)}x</strong></div><div class="statement">Safe Risk %<strong>${a.safePct.toFixed(1)}%</strong></div><div class="statement">Break Even<strong>${a.breakEven.toFixed(1)}%</strong></div><div class="statement">Kelly Guide<strong>${a.kelly.toFixed(1)}%</strong></div></div><p>${a.expectedValue >= 0 ? 'Positive expected value.' : 'Negative expected value. This strategy is dangerous unless risk is reduced.'}</p>`;
  }
  function renderAccounting() {
    const income = Finance.incomeMonthly(), expenses = Finance.expenseMonthly() + Finance.billsMonthly(), assets = Finance.accountBalance() + Finance.savingsTotal(), liabilities = Finance.debtTotal(), equity = assets - liabilities;
    $('#accountingStatements').innerHTML = `<div class="section-title"><h2>Financial Statements</h2><span>Auto-generated</span></div><div class="statement-grid"><div class="statement">Profit / Loss<strong>${money(income-expenses)}</strong></div><div class="statement">Assets<strong>${money(assets)}</strong></div><div class="statement">Liabilities<strong>${money(liabilities)}</strong></div><div class="statement">Equity<strong>${money(equity)}</strong></div></div>`;
    $('#ledgerTable').innerHTML = table(['Date','Account','Debit','Credit','Memo','Actions'], state.journals.map(j => [j.date, j.account, money(j.debit), money(j.credit), j.memo, actionButtons('journals', j.id)]));
  }
  function renderReports() {
    const s = Finance.scores(); const income = Finance.incomeMonthly(), expenses = Finance.expenseMonthly(), bills = Finance.unpaidBillsMonthly(), paidBills = Finance.paidBillsMonthly(), totalOutflow = Finance.totalMonthlyOutflow(), remaining = Finance.currentBalance();
    $('#reportPanel').innerHTML = `<div class="print-report"><h2>Monthly Financial Report</h2><p><strong>Income:</strong> ${money(income)}<br><strong>Expenses:</strong> ${money(expenses)}<br><strong>Unpaid Bills Due:</strong> ${money(bills)}<br><strong>Paid Bills:</strong> ${money(paidBills)}<br><strong>Total Outflow:</strong> ${money(totalOutflow)}<br><strong>Remaining Balance:</strong> ${money(remaining)}<br><strong>Financial Health:</strong> ${s.health}/100</p><h3>Recommendations</h3>${Finance.recommendations().map(([c,t])=>`<div class="alert ${c}">${t}</div>`).join('')}</div>`;
    $('#forecastPanel').innerHTML = `<div class="section-title"><h2>Forecast Engine</h2><span>Projected balances</span></div>${[30,90,180,365,1825].map(days=>`<div class="mini-item"><div><strong>${days===1825?'5 Years':days+' Days'}</strong><small>Based on current monthly cash flow</small></div><strong>${money(Finance.accountBalance() + remaining / 30.42 * days)}</strong></div>`).join('')}`;
  }

  function drawCanvas(canvas, draw) { const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h); ctx.lineWidth = 2; ctx.font = '13px Inter, Arial'; draw(ctx,w,h); }
  function drawCashFlow() { const c = $('#cashFlowChart'); if (!c) return; const income = Finance.incomeMonthly(), expense = Finance.totalMonthlyOutflow(), remaining = Finance.currentBalance(); drawCanvas(c, (ctx,w,h)=>{ const max=Math.max(income,expense,Math.abs(remaining),1); [['Income',income,60],['Total Outflow',expense,170],['Remaining',remaining,280]].forEach(([label,val,y])=>{ ctx.fillStyle='rgba(100,116,139,.16)'; ctx.fillRect(150,y,w-220,42); ctx.fillStyle= val<0?'#dc2626':'#1457ff'; ctx.fillRect(150,y,Math.max(0,(w-220)*(Math.abs(val)/max)),42); ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--text'); ctx.fillText(label,24,y+27); ctx.fillText(money(val),w-140,y+27); }); }); }
  function drawCategoryChart() { const c = $('#categoryChart'); if (!c) return; const totals = {}; state.expenses.forEach(e=>totals[e.category]=(totals[e.category]||0)+monthlyEquivalentAmount(e)); state.transactions.filter(t=>!isMasterLinkedTransaction(t) && ['expense','withdrawal','bill','savings','debt','investment'].includes(String(t.type).toLowerCase()) && isThisMonth(t.date)).forEach(t=>totals[t.category || t.type]=(totals[t.category || t.type]||0)+num(t.amount)); const entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,7); drawCanvas(c,(ctx,w,h)=>{ const max=Math.max(...entries.map(e=>e[1]),1); if(!entries.length){ ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted'); ctx.fillText('No spending data yet.',24,48); return; } entries.forEach(([label,val],i)=>{ const y=36+i*38; ctx.fillStyle='rgba(100,116,139,.16)'; ctx.fillRect(130,y,w-170,24); ctx.fillStyle=`hsl(${210+i*25} 80% 52%)`; ctx.fillRect(130,y,(w-170)*val/max,24); ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--text'); ctx.fillText(label,18,y+17); ctx.fillText(money(val),w-90,y+17); }); }); }
  function drawBudgetChart() { const c = $('#budgetChart'); if (!c) return; const b = Finance.budget(); drawCanvas(c,(ctx,w,h)=>{ const cx=w/2, cy=h/2, r=105; let start=-Math.PI/2; b.forEach((x,i)=>{ const end=start+Math.PI*2*x.pct; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,end); ctx.fillStyle=`hsl(${205+i*34} 78% 54%)`; ctx.fill(); start=end; }); ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--text'); ctx.fillText('Budget Allocation',cx-52,cy+5); }); }

  const schemas = {
    transactionModal: { title:'Add Manual Ledger Transaction', collection:'transactions', fields:[['date','Date','date'],['type','Type','select',['income','expense','transfer','bill','savings','debt','investment','refund']],['description','Description','text'],['category','Category','select',categories],['amount','Amount','number'],['account','Account','select',()=>state.accounts.map(a=>a.name)],['tags','Tags','text'],['notes','Notes','textarea']] },
    incomeModal: { title:'Add Income', collection:'incomes', fields:[['source','Source','text'],['type','Type','select',['Salary','Hourly','Daily','Weekly','Biweekly','Monthly','Yearly','Business Income','Freelance','Rental Income','Passive Income','Investment Income']],['amount','Amount','number'],['frequency','Frequency','select',['daily','weekly','biweekly','fortnightly','monthly','yearly','custom']],['date','Next Pay Date','date'],['deductions','Deductions','number'],['recurring','Recurring','select',['true','false']]] },
    expenseModal: { title:'Add Expense', collection:'expenses', fields:[['name','Expense Name','text'],['category','Category','select',categories],['amount','Amount','number'],['date','Expense Date','date'],['recurring','Recurring','select',['true','false']],['frequency','Frequency','select',['one-time','daily','weekly','biweekly','fortnightly','monthly','quarterly','yearly']],['payment','Payment Method','text'],['priority','Priority','select',['Low','Medium','High']],['notes','Notes','textarea']] },
    billModal: { title:'Add Bill', collection:'bills', fields:[['name','Bill Name','text'],['amount','Amount','number'],['dueDate','Due Date','date'],['frequency','Frequency','select',['one-time','weekly','biweekly','monthly','yearly']],['status','Status','select',['unpaid','paid']],['lateFee','Late Fee','number'],['priority','Priority','select',['Low','Medium','High']],['payment','Payment Method','text']] },
    savingsModal: { title:'Add Savings Goal', collection:'savings', fields:[['name','Goal Name','text'],['target','Target Amount','number'],['current','Current Saved','number'],['deadline','Deadline','date'],['contribution','Monthly Contribution','number'],['type','Type','select',['Vacation','House','Emergency','Vehicle','Education','Retirement','Wedding','Business','Custom']]] },
    debtModal: { title:'Add Debt', collection:'debts', fields:[['name','Debt Name','text'],['balance','Current / Opening Balance','number'],['interest','Interest Rate','number'],['minimum','Minimum Payment','number'],['dueDate','Due Date','date'],['type','Debt Type','select',['Credit Card','Loan','Personal','Business','Other']]] },
    riskModal: { title:'Analyze Risk', collection:'risks', fields:[['date','Date','date'],['balance','Available Balance','number'],['risk','Risk Amount','number'],['reward','Potential Reward','number'],['probability','Probability of Success','number'],['period','Time Period','text'],['category','Risk Category','text'],['notes','Notes','textarea']] },
    journalModal: { title:'Add Journal Entry', collection:'journals', fields:[['date','Date','date'],['account','Account','text'],['debit','Debit','number'],['credit','Credit','number'],['memo','Memo','textarea']] }
  };
  const editMap = { transactions:'transactionModal', incomes:'incomeModal', expenses:'expenseModal', bills:'billModal', savings:'savingsModal', debts:'debtModal', risks:'riskModal', journals:'journalModal' };

  function openModal(key, record = null) {
    const schema = schemas[key]; const layer = $('#modalLayer'); const frag = $('#modalTemplate').content.cloneNode(true); const modal = frag.querySelector('.modal'); const form = frag.querySelector('form'); frag.querySelector('h2').textContent = record ? `Edit ${schema.title.replace('Add ','')}` : schema.title;
    schema.fields.forEach(([name,label,type,opts]) => {
      const value = record?.[name] ?? (type === 'date' ? today() : ''); let field = '';
      if (type === 'select') { const values = typeof opts === 'function' ? opts() : opts; field = `<select name="${name}">${values.map(o=>`<option value="${o}" ${String(value)===String(o)?'selected':''}>${o}</option>`).join('')}</select>`; }
      else if (type === 'textarea') field = `<textarea name="${name}" rows="3">${value}</textarea>`;
      else field = `<input name="${name}" type="${type}" value="${value}" ${['amount','target','current','balance','risk','reward','probability'].includes(name)?'required':''}/>`;
      form.insertAdjacentHTML('beforeend', `<label>${label}${field}</label>`);
    });
    form.insertAdjacentHTML('beforeend', `<div class="form-actions full-span"><button class="btn primary" type="submit">Save</button><button class="btn secondary close-modal" type="button">Cancel</button></div>`);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      ['amount','deductions','lateFee','target','current','contribution','balance','interest','minimum','risk','reward','probability','debit','credit'].forEach(k=>{ if(k in data) data[k]=num(data[k]); });
      if('recurring' in data) data.recurring = data.recurring === 'true';
      if (schema.collection === 'expenses' && !data.frequency) data.frequency = data.recurring ? 'monthly' : 'one-time';
      if (schema.collection === 'transactions') normalizeTransactionRecord(data);
      if (schema.collection === 'bills' && String(data.status || '').toLowerCase() === 'paid' && !data.paidDate) data.paidDate = today();
      if (schema.collection === 'bills' && String(data.status || '').toLowerCase() !== 'paid') data.paidDate = '';
      if (schema.collection === 'debts' && !record) data.originalAmount = num(data.balance);

      if (record) {
        if (schema.collection === 'transactions') applyTransactionToAccount(record, -1);
        Object.assign(record, data);
        if (schema.collection === 'transactions') applyTransactionToAccount(record, 1);
      } else {
        const created = { id: uid(), ...data };
        state[schema.collection].push(created);
        if (schema.collection === 'transactions') applyTransactionToAccount(created, 1);
      }

      toast('Saved successfully. Dashboard updated.');
      closeModal();
      renderAll();
    });
    layer.innerHTML = ''; layer.appendChild(frag); layer.classList.remove('hidden'); layer.addEventListener('click', e => { if (e.target === layer || e.target.classList.contains('close-modal')) closeModal(); }, { once:false });
  }
  function openDebtPaymentModal(debt) {
    if (!debt) return;
    const layer = $('#modalLayer');
    const frag = $('#modalTemplate').content.cloneNode(true);
    const form = frag.querySelector('form');
    frag.querySelector('h2').textContent = `Make Payment: ${debt.name}`;
    form.insertAdjacentHTML('beforeend', `
      <div class="full-span"><p class="muted">Remaining balance: <strong>${money(debt.balance)}</strong>. This payment will reduce the debt and deduct from Current Balance.</p></div>
      <label>Payment Date<input name="date" type="date" value="${today()}" required></label>
      <label>Amount Paid<input name="amount" type="number" min="0.01" step="0.01" max="${num(debt.balance)}" required></label>
      <label>Payment Method<select name="paymentMethod"><option>Cash</option><option>Bank Transfer</option><option>Debit Card</option><option>Credit Card</option><option>Other</option></select></label>
      <label>Notes<textarea name="notes" rows="3" placeholder="Optional payment note"></textarea></label>
      <div class="form-actions full-span"><button class="btn primary" type="submit">Save Payment</button><button class="btn secondary close-modal" type="button">Cancel</button></div>
    `);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const amount = Math.min(num(data.amount), num(debt.balance));
      if (amount <= 0) { toast('Enter a valid payment amount.'); return; }
      debt.originalAmount = debt.originalAmount || num(debt.balance);
      debt.balance = Math.max(0, num(debt.balance) - amount);
      const payment = normalizeTransactionRecord({
        id: uid(),
        date: data.date || today(),
        type: 'debt',
        description: `Debt payment: ${debt.name}`,
        category: 'Debt Payment',
        amount,
        account: '',
        paymentMethod: data.paymentMethod || 'Payment',
        tags: 'debt-payment',
        notes: data.notes || '',
        linkedSource: { collection: 'debts', id: debt.id }
      });
      state.transactions.push(payment);
      toast('Debt payment saved. Debt balance and dashboard updated.');
      closeModal();
      renderAll();
    });
    layer.innerHTML = '';
    layer.appendChild(frag);
    layer.classList.remove('hidden');
    layer.addEventListener('click', e => { if (e.target === layer || e.target.classList.contains('close-modal')) closeModal(); }, { once:false });
  }

  function closeModal(){ $('#modalLayer').classList.add('hidden'); $('#modalLayer').innerHTML=''; }

  function showAccountScreen() {
    save();
    $('#accountScreen')?.classList.remove('hidden');
    $('.app-shell')?.classList.add('hidden');
    $('#lockScreen')?.classList.add('hidden');
    renderUserSelect();
  }

  function showAppScreen() {
    $('#accountScreen')?.classList.add('hidden');
    $('.app-shell')?.classList.remove('hidden');
  }

  function renderUserSelect() {
    const select = $('#userSelect');
    if (!select) return;
    const users = getUsers();
    select.innerHTML = users.length
      ? users.map(u => `<option value="${u.id}">${u.name || 'User'}${u.businessName ? ' — ' + u.businessName : ''}</option>`).join('')
      : '<option value="">No users yet — create account</option>';
  }

  function createOfflineUser(formData) {
    const users = getUsers();
    const id = uid();
    const user = {
      id,
      name: formData.name || 'User',
      businessName: formData.businessName || 'EliteBudget Pro',
      pin: formData.pin || '',
      createdAt: new Date().toISOString()
    };
    users.push(user);
    setUsers(users);
    currentUserId = id;
    localStorage.setItem(CURRENT_USER_KEY, id);
    state = blankData();
    state.settings.name = user.name;
    state.settings.businessName = user.businessName;
    state.settings.currency = formData.currency || 'J$';
    state.settings.pin = user.pin;
    save();
    hydrateSettingsForm();
    showAppScreen();
    renderAll();
    toast('Offline user account created.');
  }

  function loginOfflineUser() {
    const id = $('#userSelect')?.value;
    const pin = $('#loginPin')?.value || '';
    const user = getUsers().find(u => u.id === id);
    if (!user) { toast('Create a user first.'); return; }
    if (user.pin && user.pin !== pin) { toast('Incorrect PIN.'); return; }
    currentUserId = user.id;
    localStorage.setItem(CURRENT_USER_KEY, currentUserId);
    state = load();
    state.settings.name = state.settings.name || user.name;
    state.settings.businessName = state.settings.businessName || user.businessName;
    state.settings.pin = state.settings.pin || user.pin;
    hydrateSettingsForm();
    showAppScreen();
    renderAll();
    toast(`Logged in as ${state.settings.name || user.name}.`);
  }

  function logoutOfflineUser() {
    save();
    localStorage.removeItem(CURRENT_USER_KEY);
    currentUserId = '';
    state = blankData();
    $('#loginPin') && ($('#loginPin').value = '');
    showAccountScreen();
  }

  function bindAccountEvents() {
    $('#loginUserBtn')?.addEventListener('click', loginOfflineUser);
    $('#loginPin')?.addEventListener('keydown', e => { if (e.key === 'Enter') loginOfflineUser(); });
    $('#showCreateUserBtn')?.addEventListener('click', () => { $('#loginPanel').classList.add('hidden'); $('#createUserForm').classList.remove('hidden'); });
    $('#cancelCreateUserBtn')?.addEventListener('click', () => { $('#createUserForm').classList.add('hidden'); $('#loginPanel').classList.remove('hidden'); });
    $('#createUserForm')?.addEventListener('submit', e => { e.preventDefault(); createOfflineUser(Object.fromEntries(new FormData(e.target))); e.target.reset(); });
    $('#switchUserBtn')?.addEventListener('click', logoutOfflineUser);
  }

  function applyTheme() { document.documentElement.dataset.theme = state.settings.theme || 'light'; }
  function hydrateSettingsForm() { const form = $('#settingsForm'); Object.entries(state.settings).forEach(([k,v]) => { if (form.elements[k] && k !== 'pin') form.elements[k].value = v; }); }

  let deferredInstallPrompt = null;

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(() => {});
      });
    }
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      $('#installAppBtn')?.classList.remove('hidden');
    });
  }

  function bindEvents() {
    $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => { $$('.nav-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); $$('.page').forEach(p=>p.classList.remove('active')); $(`#${btn.dataset.page}`).classList.add('active'); $('#sidebar').classList.remove('open'); renderAll(); }));
    $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#themeToggle').addEventListener('click', () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; renderAll(); });
    $('#installAppBtn')?.addEventListener('click', async () => { if (!deferredInstallPrompt) { toast('Use your browser menu to install/add this app.'); return; } deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; $('#installAppBtn')?.classList.add('hidden'); });
    $('#lockBtn').addEventListener('click', lock);
    $('#unlockBtn').addEventListener('click', unlock);
    $('#pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
    $('#resetPinBtn').addEventListener('click', logoutOfflineUser);
    $$('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.open)));
    ['transactionSearch','transactionFilter','expenseSearch','expenseCategoryFilter'].forEach(id => $('#'+id)?.addEventListener('input', renderTables));
    document.addEventListener('click', e => {
      const del = e.target.closest('[data-delete]'); if (del) {
        if(confirm('Delete this record?')) {
          const collection = del.dataset.delete;
          const record = state[collection].find(x => x.id === del.dataset.id);
          if (collection === 'transactions' && isMasterLinkedTransaction(record)) {
            toast('Auto ledger rows cannot be deleted here. Edit or delete the linked income, expense, or bill instead.');
            return;
          }
          if (collection === 'transactions') {
            if (isDebtPaymentTransaction(record)) {
              const debt = state.debts.find(d => d.id === record.linkedSource.id);
              if (debt) debt.balance = num(debt.balance) + num(record.amount);
            }
            applyTransactionToAccount(record, -1);
          }
          if (collection !== 'transactions') removeLinkedTransactions(collection, del.dataset.id);
          state[collection] = state[collection].filter(x => x.id !== del.dataset.id);
          toast('Deleted. Dashboard updated.');
          renderAll();
        }
      }
      const edit = e.target.closest('[data-edit]'); if (edit) { const rec = state[edit.dataset.edit].find(x => x.id === edit.dataset.id); if (edit.dataset.edit === 'transactions' && (isMasterLinkedTransaction(rec) || isDebtPaymentTransaction(rec))) { toast('This ledger row is controlled by its source record. Edit the linked income, expense, bill, or debt instead.'); return; } openModal(editMap[edit.dataset.edit], rec); }
      const pay = e.target.closest('[data-pay-bill]'); if (pay) { const b = state.bills.find(x=>x.id===pay.dataset.payBill); if (b) { b.status = 'paid'; b.paidDate = today(); } toast('Bill marked paid and deducted from current balance.'); renderAll(); }
      const debtPay = e.target.closest('[data-pay-debt]'); if (debtPay) { const debt = state.debts.find(x=>x.id===debtPay.dataset.payDebt); openDebtPaymentModal(debt); }
    });
    $('#generateBudgetBtn').addEventListener('click', () => { renderBudget(); toast('Budget regenerated from current financial data.'); });
    $('#printReportBtn').addEventListener('click', () => window.print());
    $('#seedBtn')?.addEventListener('click', () => { if(confirm('Reset the app to blank data? This removes all local records.')) { localStorage.removeItem(userDataKey()); state = blankData(); renderAll(); toast('Blank app data loaded for this user.'); } });
    $('#settingsForm').addEventListener('submit', e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); Object.assign(state.settings, data); ['emergencyTarget','savingsPercent'].forEach(k=>state.settings[k]=num(state.settings[k])); if(!data.pin) state.settings.pin = state.settings.pin || ''; hydrateSettingsForm(); renderAll(); toast('Settings saved.'); });
    $('#clearDataBtn').addEventListener('click', () => { if(confirm('Permanently clear all local financial data and start blank?')) { localStorage.removeItem(userDataKey()); state = blankData(); renderAll(); toast('All data cleared for this user. The app is now blank.'); } });
    $('#exportJsonBtn').addEventListener('click', exportJson);
    $('#importJsonInput').addEventListener('change', importJson);
    $('#exportCsvBtn').addEventListener('click', exportCsv);
    $('#importCsvInput').addEventListener('change', importCsv);
    $('#globalSearch').addEventListener('input', globalSearch);
    document.addEventListener('keydown', e => { if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); $('#globalSearch').focus(); } if(e.key==='Escape'){ closeModal(); $('#searchResults').classList.add('hidden'); } });
  }

  function lock() { if (state.settings.pin) { $('#lockScreen').classList.remove('hidden'); $('#pinInput').value=''; $('#pinInput').focus(); } else toast('Set a PIN in Settings first.'); }
  function unlock() { if (!state.settings.pin || $('#pinInput').value === state.settings.pin) $('#lockScreen').classList.add('hidden'); else toast('Incorrect PIN.'); }
  function exportJson() { download('elitebudget-backup.json', JSON.stringify(state, null, 2), 'application/json'); }
  function importJson(e) { const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result); if(!data.settings || !data.transactions) throw new Error('Invalid backup'); state=data; renderAll(); toast('Backup imported.'); }catch{ toast('Invalid JSON backup.'); } }; reader.readAsText(file); }
  function exportCsv() { const headers=['date','type','description','category','amount','account','tags','notes']; const rows=state.transactions.map(t=>headers.map(h=>`"${String(t[h]??'').replaceAll('"','""')}"`).join(',')); download('transactions.csv', [headers.join(','),...rows].join('\n'), 'text/csv'); }
  function importCsv(e) { const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ const lines=reader.result.split(/\r?\n/).filter(Boolean); const headers=lines.shift().split(',').map(h=>h.replaceAll('"','').trim()); lines.forEach(line=>{ const vals=line.match(/("[^"]*(""[^"]*)*"|[^,]+)/g) || []; const obj={id:uid()}; headers.forEach((h,i)=>obj[h]=String(vals[i]||'').replace(/^"|"$/g,'').replaceAll('""','"')); normalizeTransactionRecord(obj); state.transactions.push(obj); applyTransactionToAccount(obj, 1); }); renderAll(); toast('CSV imported. Dashboard updated.'); }; reader.readAsText(file); }
  function download(name, content, type) { const blob = new Blob([content], {type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
  function globalSearch() { const q = $('#globalSearch').value.toLowerCase().trim(); const panel = $('#searchResults'); if(!q){ panel.classList.add('hidden'); return; } const pools = ['transactions','incomes','expenses','bills','savings','debts','risks','journals']; const results=[]; pools.forEach(p=>state[p].forEach(x=>{ const txt=JSON.stringify(x).toLowerCase(); if(txt.includes(q)) results.push({p,x}); })); panel.innerHTML = `<div class="glass-panel">${results.slice(0,10).map(r=>`<div class="search-result-item"><strong>${r.p}</strong><br><span class="muted">${Object.values(r.x).slice(1,5).join(' • ')}</span></div>`).join('') || '<div class="search-result-item">No matches found.</div>'}</div>`; panel.classList.remove('hidden'); }

  function init() { applyTheme(); registerServiceWorker(); bindAccountEvents(); bindEvents(); renderUserSelect(); if (!currentUserId || !getUsers().some(u => u.id === currentUserId)) { showAccountScreen(); return; } hydrateSettingsForm(); showAppScreen(); renderAll(); }
  init();
})();
