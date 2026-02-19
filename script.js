// State Management
const STORAGE_KEY = 'money_manager_data';
let data = {
    transactions: [],
    accounts: [
        { id: 1, name: '財布', balance: 0 },
        { id: 2, name: '銀行', balance: 0 }
    ],
    categories: {
        expense: ['食費', '交通費', '日用品', 'エンタメ', 'その他'],
        income: ['給与', '賞与', 'その他']
    }
};

let expenseChartInstance = null;
let incomeChartInstance = null;
let analyticsExpenseChartInstance = null;
let analyticsIncomeChartInstance = null;
let assetTrendChartInstance = null;
let currentAnalyticsDate = new Date();

// DOM Elements
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const totalBalanceEl = document.getElementById('total-balance');
const transactionListEl = document.getElementById('transaction-list');
const categorySelect = document.getElementById('category');
const accountSelect = document.getElementById('account');
const accountsListEl = document.getElementById('accounts-list');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadTheme();
    setupNavigation();
    setupForms();
    setupAnalyticsListeners();
    renderAll();

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered', reg))
            .catch(err => console.error('SW failed', err));
    }
});

// Data persistence
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Migration: Convert array categories to object if needed
            if (Array.isArray(parsed.categories)) {
                parsed.categories = {
                    expense: parsed.categories, // Keep existing as expense for safety
                    income: ['給与', '賞与', 'その他']
                };
            }
            // Ensure both keys exist
            if (!parsed.categories.expense) parsed.categories.expense = ['その他'];
            if (!parsed.categories.income) parsed.categories.income = ['その他'];

            data = parsed;
        } catch (e) {
            console.error('Data corrupted, resetting', e);
        }
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    renderAll();
}

// Navigation
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Remove active class from all
            navItems.forEach(n => n.classList.remove('active'));
            views.forEach(v => {
                v.classList.remove('active');
                v.classList.add('hidden');
            });

            // Add active to clicked
            const targetId = item.dataset.target; // Using currentTarget if needed, but item is fine
            // item.dataset.target might be on the button itself

            // Handle the button click properly (could be icon or span clicked)
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');

            const targetView = document.getElementById(targetBtn.dataset.target);
            targetView.classList.remove('hidden');
            targetView.classList.add('active');

            if (targetBtn.dataset.target === 'view-dashboard') {
                updateCharts();
            } else if (targetBtn.dataset.target === 'view-analytics') {
                renderAnalytics();
            }

            // Mode switching for Add View
            if (targetBtn.dataset.mode) {
                const mode = targetBtn.dataset.mode;
                const radio = document.getElementById(`type-${mode}`);
                if (radio) {
                    radio.checked = true;
                    // Trigger change event to update UI (e.g. save button color)
                    radio.dispatchEvent(new Event('change'));
                }
            }
        });
    });
}

// Rendering
function renderAll() {
    renderDashboard();
    renderAccounts();
    populateSelects();
    renderCategorySettings();
}

function renderDashboard() {
    // Calculate total balance
    const total = data.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    totalBalanceEl.textContent = `¥${total.toLocaleString()}`;

    // Recent Transactions
    transactionListEl.innerHTML = '';
    const recent = [...data.transactions].sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        return dateDiff !== 0 ? dateDiff : b.id - a.id;
    }).slice(0, 10);

    recent.forEach(tx => {
        const li = document.createElement('li');
        const isExpense = tx.type === 'expense';
        li.innerHTML = `
            <div class="transaction-info">
                <span class="transaction-cat">${tx.category}</span>
                <span class="transaction-date">${tx.date} • ${getAccountName(tx.accountId)}</span>
            </div>
            <span class="transaction-amount ${isExpense ? 'amount-expense' : 'amount-income'}">
                ${isExpense ? '-' : '+'}¥${Number(tx.amount).toLocaleString()}
            </span>
        `;
        transactionListEl.appendChild(li);
    });

    updateCharts();
}

function getAccountName(id) {
    const acc = data.accounts.find(a => a.id == id);
    return acc ? acc.name : '不明';
}

function renderAccounts() {
    accountsListEl.innerHTML = '';
    data.accounts.forEach(acc => {
        const div = document.createElement('div');
        div.className = 'card account-card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>${acc.name}</h3>
                <span style="font-weight:bold; font-size:1.2rem;">¥${acc.balance.toLocaleString()}</span>
            </div>
        `;
        accountsListEl.appendChild(div);
    });
}

function populateSelects() {
    // Determine current mode based on active radio in Add Form
    const mode = document.querySelector('input[name="type"]:checked')?.value || 'expense';
    const categories = data.categories[mode] || [];

    categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    accountSelect.innerHTML = data.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    // Dashboard Filter
    const dashboardFilter = document.getElementById('dashboard-account-filter');
    if (dashboardFilter) {
        const currentVal = dashboardFilter.value;
        const accountOptions = data.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        dashboardFilter.innerHTML = `<option value="all">全ての口座</option>` + accountOptions;
        dashboardFilter.value = currentVal || 'all'; // Restore selection if possible
    }
}

function renderCategorySettings() {
    const listEl = document.getElementById('settings-category-list');
    if (!listEl) return;

    // Determine mode for settings
    const mode = document.querySelector('input[name="cat-settings-type"]:checked')?.value || 'expense';
    const categories = data.categories[mode] || [];

    listEl.innerHTML = '';
    categories.forEach(cat => {
        const li = document.createElement('li');
        li.style.padding = '0.75rem';
        li.innerHTML = `
            <span>${cat}</span>
            <button class="icon-btn delete-cat-btn" data-cat="${cat}" style="width: 30px; height: 30px; font-size: 0.9rem; background: rgba(239, 68, 68, 0.2); color: var(--danger-color);">✕</button>
        `;
        listEl.appendChild(li);
    });

    // Add delete listeners
    document.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = e.currentTarget.dataset.cat;
            deleteCategory(mode, cat);
        });
    });
}

function addCategory(mode, name) {
    if (!data.categories[mode].includes(name)) {
        data.categories[mode].push(name);
        saveData();
        renderCategorySettings();
        populateSelects(); // Update select if in add view
    } else {
        alert('そのカテゴリは既に存在します');
    }
}

function deleteCategory(mode, name) {
    if (confirm(`「${name}」カテゴリを削除しますか？`)) {
        data.categories[mode] = data.categories[mode].filter(c => c !== name);
        saveData();
        renderCategorySettings();
        populateSelects();
    }
}

// Forms & logic
function setupForms() {
    // Sync Bottom Nav with Radio Buttons & Update Save Button Color
    const typeRadios = document.querySelectorAll('input[name="type"]');
    const saveBtn = document.querySelector('#transaction-form button[type="submit"]');

    const updateSaveButtonColor = (mode) => {
        if (mode === 'expense') {
            saveBtn.classList.remove('btn-primary');
            saveBtn.classList.add('btn-danger-fill');
        } else {
            saveBtn.classList.remove('btn-danger-fill');
            saveBtn.classList.add('btn-primary');
        }
    };

    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            // Update bottom nav
            navItems.forEach(n => n.classList.remove('active'));
            const targetNav = document.querySelector(`.nav-item[data-mode="${mode}"]`);
            if (targetNav) {
                targetNav.classList.add('active');
            }
            populateSelects();
            updateSaveButtonColor(mode);
        });
    });

    // Initial color set based on default checked
    const initialMode = document.querySelector('input[name="type"]:checked').value;
    updateSaveButtonColor(initialMode);

    // Category Settings
    const catSettingsRadios = document.querySelectorAll('input[name="cat-settings-type"]');
    catSettingsRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            renderCategorySettings();
        });
    });

    // Dashboard Filter
    const dashboardFilter = document.getElementById('dashboard-account-filter');
    if (dashboardFilter) {
        dashboardFilter.addEventListener('change', () => {
            updateCharts();
        });
    }

    document.getElementById('add-category-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const mode = document.querySelector('input[name="cat-settings-type"]:checked').value;
        const nameInput = document.getElementById('new-category-name');
        const name = nameInput.value.trim();
        if (name) {
            addCategory(mode, name);
            nameInput.value = '';
        }
    });

    // Add Transaction
    document.getElementById('transaction-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.querySelector('input[name="type"]:checked').value;
        const amount = parseInt(document.getElementById('amount').value);
        const accountId = parseInt(document.getElementById('account').value);

        const tx = {
            id: Date.now(),
            date: document.getElementById('date').value,
            amount: amount,
            type: type,
            category: document.getElementById('category').value,
            accountId: accountId,
            description: document.getElementById('description').value
        };

        // Update Account Balance
        const accIndex = data.accounts.findIndex(a => a.id === accountId);
        if (accIndex > -1) {
            if (type === 'expense') {
                data.accounts[accIndex].balance -= amount;
            } else {
                data.accounts[accIndex].balance += amount;
            }
        }

        data.transactions.push(tx);
        saveData();
        e.target.reset();
        // Set default date to today
        document.getElementById('date').valueAsDate = new Date();
        alert('保存しました');
    });

    // Add Account
    document.getElementById('account-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('new-account-name').value;
        const balance = parseInt(document.getElementById('new-account-balance').value);

        data.accounts.push({
            id: Date.now(),
            name: name,
            balance: balance
        });
        saveData();
        e.target.reset();
        alert('口座を追加しました');
    });

    // Settings
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
    document.getElementById('import-btn-trigger').addEventListener('click', () => document.getElementById('import-input').click());
    document.getElementById('import-input').addEventListener('change', importData);
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (confirm('本当に全てのデータを削除しますか？この操作は取り消せません。')) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        }
    });

    // Initial Date value
    document.getElementById('date').valueAsDate = new Date();

    // Theme Switcher
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const theme = e.target.value;
            applyTheme(theme);
            localStorage.setItem('money_manager_theme', theme);
            // Re-render everything to update charts colors
            renderAll();
            renderAnalytics(); // Also update analytics if open
        });
    });
}

// Theme
function loadTheme() {
    const savedTheme = localStorage.getItem('money_manager_theme') || 'dark';
    applyTheme(savedTheme);
    const radio = document.getElementById(`theme-${savedTheme}`);
    if (radio) radio.checked = true;
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

// Chart
function updateCharts() {
    const expenseCtx = document.getElementById('expenseChart').getContext('2d');
    const incomeCtx = document.getElementById('incomeChart').getContext('2d');

    const now = new Date();
    const filterAccountId = document.getElementById('dashboard-account-filter')?.value || 'all';

    // Helper to get aggregated data
    const getChartData = (type) => {
        const filteredTx = data.transactions.filter(tx => {
            const d = new Date(tx.date);
            const isType = tx.type === type;
            const isCurrentMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            const matchesAccount = filterAccountId === 'all' || tx.accountId == filterAccountId;
            return isCurrentMonth && isType && matchesAccount;
        });

        const totals = {};
        filteredTx.forEach(tx => {
            totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
        });

        return {
            labels: Object.keys(totals),
            data: Object.values(totals)
        };
    };

    const expenseData = getChartData('expense');
    const incomeData = getChartData('income');

    // Colors
    const colors = [
        '#00e676', '#2979ff', '#ff1744', '#ffea00', '#ff9100', '#d500f9', '#00b0ff'
    ];

    const getThemeColors = () => {
        const isLight = document.body.classList.contains('light-theme');
        return {
            text: isLight ? '#1e293b' : '#f1f5f9',
            grid: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
            tooltip: isLight ? '#fff' : '#000',
            tooltipText: isLight ? '#000' : '#fff'
        };
    };

    const renderChart = (ctx, instance, label, chartData) => {
        const colors = getThemeColors();

        if (instance) {
            instance.destroy();
        }

        if (chartData.labels.length === 0) {
            // Empty state
            return new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['データなし'],
                    datasets: [{ data: [1], backgroundColor: ['#333'], borderWidth: 0 }]
                },
                options: {
                    cutout: '70%',
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: label, color: colors.text }
                    }
                }
            });
        }

        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    backgroundColor: [
                        '#00e676', '#2979ff', '#ff1744', '#ffea00', '#ff9100', '#d500f9', '#00b0ff'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: colors.text, boxWidth: 12, font: { size: 10 }, padding: 10 }
                    },
                    title: {
                        display: true,
                        text: label,
                        color: colors.text
                    }
                }
            }
        });
    };

    expenseChartInstance = renderChart(expenseCtx, expenseChartInstance, '今月の支出', expenseData);
    incomeChartInstance = renderChart(incomeCtx, incomeChartInstance, '今月の収入', incomeData);
}

// Analytics Logic
function renderAnalytics() {
    // Check if elements exist (first load)
    const yearMonthEl = document.getElementById('analytics-current-month');
    if (!yearMonthEl) return; // Guard

    // Update Header
    const year = currentAnalyticsDate.getFullYear();
    const month = currentAnalyticsDate.getMonth() + 1;
    yearMonthEl.textContent = `${year}年${month}月`;

    // Filter Data
    const filteredTx = data.transactions.filter(tx => {
        const d = new Date(tx.date);
        return d.getFullYear() === year && d.getMonth() === (month - 1);
    });

    // Calc Totals
    let totalIncome = 0;
    let totalExpense = 0;
    const expenseTotals = {};
    const incomeTotals = {};

    filteredTx.forEach(tx => {
        if (tx.type === 'expense') {
            totalExpense += tx.amount;
            expenseTotals[tx.category] = (expenseTotals[tx.category] || 0) + tx.amount;
        } else {
            totalIncome += tx.amount;
            incomeTotals[tx.category] = (incomeTotals[tx.category] || 0) + tx.amount;
        }
    });

    // Update DOM
    document.getElementById('analytics-income').textContent = `¥${totalIncome.toLocaleString()}`;
    document.getElementById('analytics-expense').textContent = `¥${totalExpense.toLocaleString()}`;
    const balance = totalIncome - totalExpense;
    const balanceEl = document.getElementById('analytics-balance');
    balanceEl.textContent = `¥${balance.toLocaleString()}`;
    balanceEl.style.color = balance >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

    // Render Charts
    const expenseCtx = document.getElementById('analyticsExpenseChart').getContext('2d');
    const incomeCtx = document.getElementById('analyticsIncomeChart').getContext('2d');

    // Reuse or duplicate chart logic? Duplicating for safety and specific options
    analyticsExpenseChartInstance = renderAnalyticsChart(expenseCtx, analyticsExpenseChartInstance, '支出内訳', expenseTotals);
    analyticsIncomeChartInstance = renderAnalyticsChart(incomeCtx, analyticsIncomeChartInstance, '収入内訳', incomeTotals);

    // Asset Trend Chart
    const assetTrendCtx = document.getElementById('assetTrendChart').getContext('2d');
    const assetHistory = calculateAssetHistory();
    assetTrendChartInstance = renderAssetTrendChart(assetTrendCtx, assetTrendChartInstance, assetHistory);

    // Render Calendar
    renderCalendar();
}

function renderCalendar() {
    const calendarEl = document.getElementById('analytics-calendar');
    if (!calendarEl) return;

    calendarEl.innerHTML = '';

    const year = currentAnalyticsDate.getFullYear();
    const month = currentAnalyticsDate.getMonth(); // 0-indexed

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0); // Day 0 of next month is last day of current

    // Days in month
    const daysInMonth = lastDay.getDate();

    // Day of week for 1st (0 = Sunday)
    const startDayOfWeek = firstDay.getDay();

    // Empty cells for days before 1st
    for (let i = 0; i < startDayOfWeek; i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day empty';
        calendarEl.appendChild(div);
    }

    // Days 1 to daysInMonth
    const today = new Date();

    for (let d = 1; d <= daysInMonth; d++) {
        const div = document.createElement('div');
        div.className = 'calendar-day';

        // Check if today
        if (year === today.getFullYear() && month === today.getMonth() && d === today.getDate()) {
            div.classList.add('today');
        }

        // Calculate Income and Expense for this day
        const dailyIncome = data.transactions
            .filter(tx => {
                const tDate = new Date(tx.date);
                return tDate.getFullYear() === year &&
                    tDate.getMonth() === month &&
                    tDate.getDate() === d &&
                    tx.type === 'income';
            })
            .reduce((sum, tx) => sum + tx.amount, 0);

        const dailyExpense = data.transactions
            .filter(tx => {
                const tDate = new Date(tx.date);
                return tDate.getFullYear() === year &&
                    tDate.getMonth() === month &&
                    tDate.getDate() === d &&
                    tx.type === 'expense';
            })
            .reduce((sum, tx) => sum + tx.amount, 0);

        let content = `<span class="day-num">${d}</span>`;

        if (dailyIncome > 0) {
            content += `<span class="day-amount income">+¥${dailyIncome.toLocaleString()}</span>`;
        }
        if (dailyExpense > 0) {
            content += `<span class="day-amount expense">-¥${dailyExpense.toLocaleString()}</span>`;
        }

        div.innerHTML = content;

        // Add click event
        div.addEventListener('click', () => {
            // Remove selected class from all
            document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
            // Add to current
            div.classList.add('selected');
            // Show details
            showDailyTransactions(year, month, d);
        });

        calendarEl.appendChild(div);
    }
}

function showDailyTransactions(year, month, day) {
    const container = document.getElementById('selected-date-container');
    const title = document.getElementById('selected-date-title');
    const list = document.getElementById('selected-date-transactions');

    if (!container || !title || !list) return;

    // Filter transactions for this day
    const dailyTx = data.transactions.filter(tx => {
        const tDate = new Date(tx.date);
        return tDate.getFullYear() === year &&
            tDate.getMonth() === month &&
            tDate.getDate() === day;
    });

    if (dailyTx.length === 0) {
        container.classList.add('hidden');
        return;
    }

    // Show container
    container.classList.remove('hidden');
    title.textContent = `${month + 1}月${day}日の取引`;
    list.innerHTML = '';

    // Sort by type (income first) then amount desc? Or just order of entry?
    // Let's keep order of entry (reverse filter usually implies newest first if original is chronological)
    // Assuming data.transactions is not strictly ordered, let's sort by ID or keep as is.

    dailyTx.forEach(tx => {
        const li = document.createElement('li');
        const isExpense = tx.type === 'expense';
        const sign = isExpense ? '-' : '+';
        const amountClass = isExpense ? 'amount-expense' : 'amount-income';
        const accountName = getAccountName(tx.accountId);

        li.innerHTML = `
            <div class="transaction-info">
                <span class="transaction-cat">${tx.category} <span style="font-size: 0.8rem; color: var(--secondary-text); font-weight: normal;">(${accountName})</span></span>
                <span class="transaction-date">${tx.description || ''}</span>
            </div>
            <span class="transaction-amount ${amountClass}">${sign}¥${tx.amount.toLocaleString()}</span>
        `;
        list.appendChild(li);
    });

    // Scroll to container
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function calculateAssetHistory() {
    // Current Total Balance
    let currentBalance = data.accounts.reduce((sum, acc) => sum + acc.balance, 0);

    const history = [];
    const now = new Date(); // Today

    // Loop back 6 months (including current month)
    for (let i = 0; i < 6; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;
        const label = `${month}月`;

        // Calculate balance at end of this target month
        // logic: Start from currentBalance, and reverse transactions that happened AFTER the end of target month

        // Actually, simpler logic:
        // 1. Calculate balance at the END of month [i]
        // Balance(End of Month X) = CurrentBalance - (Transactions after End of Month X)

        // Define "End of Month X"
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999); // last day of month

        // Actually, easier to iterate from now backwards.
        // Balance at "Now" is Known.
        // To get Balance at End of Last Month:
        //   CurrentBalance - (Income this month) + (Expense this month)
        // Wait, "this month" means transactions > End of Last Month

        // Let's create a list of month-end balances
        // 0: Current Month (Now) -> Current Balance
        // 1: Last Month End -> Current Balance - Tx(Current Month)
        // 2: 2 Months Ago End -> Balance(1) - Tx(Last Month)

        // We want to show 6 points.
        // Point 0 (Rightmost): Current Status (Now)
        // Point 1: End of Last Month
        // ...
        // Point 5: End of 5 months ago
    }

    // Re-implementing logic correctly
    const points = [];
    let runningBalance = currentBalance;

    // Point 0: Now
    points.push({ label: '現在', value: runningBalance });

    // Iterate back 5 times to get previous 5 month-ends
    for (let i = 0; i < 5; i++) {
        // We need to reverse transactions that happened in "Month - i"
        // i=0: Current Month. We need to reverse transactions from "Start of Current Month" to "Now".
        // i=1: Last Month. Reverse transactions from "Start of Last Month" to "End of Last Month".

        const d = new Date();
        d.setMonth(d.getMonth() - i);

        const year = d.getFullYear();
        const month = d.getMonth(); // 0-indexed

        // Filter transactions in this month
        const monthlyTx = data.transactions.filter(tx => {
            const tDate = new Date(tx.date);
            return tDate.getFullYear() === year && tDate.getMonth() === month;
        });

        // Reverse efffect
        monthlyTx.forEach(tx => {
            if (tx.type === 'expense') {
                runningBalance += tx.amount; // Add back expense
            } else {
                runningBalance -= tx.amount; // Subtract income
            }
        });

        // Push the balance at the START of this month (which is effectively END of previous month)
        // Label should be previous month
        const prevMonthDate = new Date(year, month - 1, 1);
        points.push({
            label: `${prevMonthDate.getMonth() + 1}月末`,
            value: runningBalance
        });
    }

    return points.reverse();
}

function renderAssetTrendChart(ctx, instance, history) {
    if (instance) instance.destroy();

    const labels = history.map(h => h.label);
    const dataPoints = history.map(h => h.value);

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(0, 230, 118, 0.5)'); // Greenish
    gradient.addColorStop(1, 'rgba(0, 230, 118, 0.0)');

    const colors = (() => {
        const isLight = document.body.classList.contains('light-theme');
        return {
            text: isLight ? '#1e293b' : '#aaa',
            grid: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'
        };
    })();

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '総資産推移',
                data: dataPoints,
                borderColor: '#00e676',
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#00e676',
                pointRadius: 4,
                fill: true,
                tension: 0.4 // Smooth curve
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `¥${context.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false, // Don't start at 0 to show trend better
                    grid: { color: colors.grid },
                    ticks: { color: colors.text, callback: (val) => '¥' + val.toLocaleString() }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: colors.text }
                }
            }
        }
    });
}

function renderAnalyticsChart(ctx, instance, label, totals) {
    const labels = Object.keys(totals);
    const chartData = Object.values(totals);
    const colors = ['#00e676', '#2979ff', '#ff1744', '#ffea00', '#ff9100', '#d500f9', '#00b0ff'];

    if (instance) instance.destroy();

    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#1e293b' : '#fff';

    if (labels.length === 0) {
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['データなし'],
                datasets: [{ data: [1], backgroundColor: ['#333'], borderWidth: 0 }]
            },
            options: {
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: label, color: textColor }
                }
            }
        });
    }

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: chartData,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, boxWidth: 12, font: { size: 10 }, padding: 10 }
                },
                title: {
                    display: true,
                    text: label,
                    color: textColor
                }
            }
        }
    });
}

function changeAnalyticsMonth(delta) {
    currentAnalyticsDate.setMonth(currentAnalyticsDate.getMonth() + delta);
    renderAnalytics();
    // Hide details when changing month
    const container = document.getElementById('selected-date-container');
    if (container) container.classList.add('hidden');
}

// Add event listeners for analytics buttons
function setupAnalyticsListeners() {
    const prevBtn = document.getElementById('analytics-prev-month');
    const nextBtn = document.getElementById('analytics-next-month');

    if (prevBtn) prevBtn.addEventListener('click', () => changeAnalyticsMonth(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changeAnalyticsMonth(1));
}



// CSV Export
function exportCSV() {
    if (data.transactions.length === 0) {
        alert('データがありません');
        return;
    }

    // Header
    let csvContent = "日付,種別,カテゴリ,金額,口座,メモ\n";

    // Rows
    data.transactions.forEach(tx => {
        const typeStr = tx.type === 'expense' ? '支出' : '収入';
        const accountName = getAccountName(tx.accountId);
        // Escape quotes if necessary, though simpler app might not need complex escaping yet
        // A simple CSV escape: replace " with "" and wrap in "
        const escape = (str) => `"${String(str).replace(/"/g, '""')}"`;

        const row = [
            escape(tx.date),
            escape(typeStr),
            escape(tx.category),
            escape(tx.amount),
            escape(accountName),
            escape(tx.description || '')
        ].join(",");

        csvContent += row + "\n";
    });

    // BOM for Excel
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `money_manager_export_${dateStr}.csv`;

    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Backup/Restore
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "money_manager_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData.transactions && importedData.accounts) {
                data = importedData;
                saveData();
                alert('データを復元しました');
            } else {
                alert('無効なファイル形式です');
            }
        } catch (error) {
            alert('読み込みに失敗しました');
        }
    };
    reader.readAsText(file);
}

// ============================================================
// PWA インストールバナー制御
// ============================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    // セッション中に非表示にしていなければバナーを表示
    if (!sessionStorage.getItem('pwa-banner-dismissed')) {
        showInstallBanner();
    }
});

function showInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
        banner.classList.remove('hidden');
        banner.classList.add('visible');
    }
}

function hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
        banner.classList.remove('visible');
        // アニメーション後に hidden クラスを戻す
        setTimeout(() => banner.classList.add('hidden'), 300);
    }
}

// インストールボタン
document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('pwa-install-btn');
    const dismissBtn = document.getElementById('pwa-dismiss-btn');

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            hideInstallBanner();
        });
    }

    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            sessionStorage.setItem('pwa-banner-dismissed', '1');
            hideInstallBanner();
        });
    }
});

// インストール完了後はバナーを非表示
window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    deferredInstallPrompt = null;
});
