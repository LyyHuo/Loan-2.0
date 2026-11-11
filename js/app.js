  const $ = id => document.getElementById(id);

  const money = value =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);

  const moneyNoDecimal = value =>
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(value);

  function clearInput(id) {
    $(id).value = "";
    calculate();
  }

  function getMonthlyRate() {
    let rate = parseFloat($("interestRate").value) || 0;

    // If Annual is selected, convert annual rate to monthly rate.
    if ($("annualRate").checked) {
      rate = rate / 12;
    }

    return rate / 100;
  }

  function calculateFlat(loan, months, monthlyRate) {
    const totalInterest = loan * monthlyRate * months;
    const totalPayment = loan + totalInterest;
    const payment = totalPayment / months;

    return {
      payment,
      totalInterest,
      totalPayment
    };
  }

  function calculateFixed(loan, months, monthlyRate) {
    let payment;

    if (monthlyRate === 0) {
      payment = loan / months;
    } else {
      payment =
        loan *
        monthlyRate *
        Math.pow(1 + monthlyRate, months) /
        (Math.pow(1 + monthlyRate, months) - 1);
    }

    const totalPayment = payment * months;
    const totalInterest = totalPayment - loan;

    return {
      payment,
      totalInterest,
      totalPayment
    };
  }

  function getCalculation(loan, months) {
    const rate = getMonthlyRate();

    if ($("fixedLoan").checked) {
      return calculateFixed(loan, months, rate);
    }

    return calculateFlat(loan, months, rate);
  }

  function calculate() {
    const price = Math.max(0, parseFloat($("price").value) || 0);

    let downPayment = Math.max(
      0,
      parseFloat($("downPayment").value) || 0
    );

    // Keep down payment inside the price, and reflect the clamp back
    // into the field so the UI never shows a down payment larger than price.
    if (downPayment > price) {
      downPayment = price;
      if (document.activeElement !== $("downPayment")) {
        $("downPayment").value = downPayment;
      }
    }

    const percent = price > 0 ? (downPayment / price) * 100 : 0;

    // Don't overwrite the percent field while the user is actively typing
    // into it -- otherwise the cursor jumps and digits get clobbered.
    if (document.activeElement !== $("downPercent")) {
      $("downPercent").value = Number(percent.toFixed(2));
    }

    const loan = Math.max(0, price - downPayment);

    let term = Math.max(0, parseInt($("term").value) || 0);
    const months = Math.max(1, $("termYear").checked ? term * 12 : term);

    const result = getCalculation(loan, months);

    $("monthlyPayment").textContent = "$" + money(result.payment);
    $("donutTerm").textContent =
      $("termYear").checked ? (currentLanguage === "km" ? `រយៈពេល ${term} ឆ្នាំ` : `Over ${term} Years`) : (currentLanguage === "km" ? `រយៈពេល ${term} ខែ` : `Over ${term} Months`);

    $("summaryDown").textContent = "$" + money(downPayment);
    $("summaryLoan").textContent = "$" + money(loan);
    $("summaryInterest").textContent = "$" + money(result.totalInterest);
    $("summaryTotal").textContent = "$" + money(downPayment + result.totalPayment);

    // Amortization schedule
    renderSchedule(loan, months, result.payment);

    // Report
    renderReport(price, downPayment, loan);
  }

  function renderSchedule(loan, months, payment) {
    const tbody = $("scheduleBody");
    tbody.innerHTML = "";

    if (loan <= 0 || months <= 0) return;

    const monthlyRate = getMonthlyRate();
    const isFixed = $("fixedLoan").checked;

    let balance = loan;
    const rowsToShow = Math.min(months, 12);

    for (let i = 1; i <= rowsToShow; i++) {
      let interest;
      let principal;
      let actualPayment = payment;

      if (isFixed) {
        interest = balance * monthlyRate;
        principal = actualPayment - interest;

        if (principal > balance) {
          principal = balance;
          actualPayment = principal + interest;
        }
      } else {
        // Flat loan: interest is based on original loan amount.
        interest = loan * monthlyRate;
        principal = actualPayment - interest;

        if (principal > balance) {
          principal = balance;
          actualPayment = principal + interest;
        }
      }

      balance = Math.max(0, balance - principal);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i}</td>
        <td>${money(actualPayment)}</td>
        <td>${money(interest)}</td>
        <td>${money(principal)}</td>
        <td>${money(balance)}</td>
      `;
      tbody.appendChild(tr);
    }

    if (months > 12) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="5" class="text-center text-muted">
          ${currentLanguage === "km" ? `បង្ហាញ 12 ការបង់ដំបូង ក្នុងចំណោម ${months} ការបង់សរុប` : `Showing first 12 payments of ${months} total payments`}
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderReport(price, downPayment, loan) {
    renderAllReport(price, downPayment, loan);
    const payment5 = Math.floor(getCalculation(loan, 60).payment);
    const payment6 = Math.floor(getCalculation(loan, 72).payment);
    const payment7 = Math.floor(getCalculation(loan, 84).payment);

    if (currentLanguage === "km") {
      $("reportText").innerHTML =
`ករណីឡានតម្លៃ <strong>${moneyNoDecimal(price)}$</strong><br>
-បង់មុន <strong>${moneyNoDecimal(downPayment)}$</strong><br>
-កម្ចី <strong>${moneyNoDecimal(loan)}$</strong><br><br>
***បង់ប្រចាំខែ <strong>${payment5}$</strong> រយៈពេល 5ឆ្នាំ<br>
***បង់ប្រចាំខែ <strong>${payment6}$</strong> រយៈពេល 6ឆ្នាំ<br>
***បង់ប្រចាំខែ <strong>${payment7}$</strong> រយៈពេល 7ឆ្នាំ`;
    } else {
      $("reportText").innerHTML =
`Car price <strong>${moneyNoDecimal(price)}$</strong><br>
-Down payment <strong>${moneyNoDecimal(downPayment)}$</strong><br>
-Loan <strong>${moneyNoDecimal(loan)}$</strong><br><br>
***Monthly payment <strong>${payment5}$</strong> for 5 years<br>
***Monthly payment <strong>${payment6}$</strong> for 6 years<br>
***Monthly payment <strong>${payment7}$</strong> for 7 years`;
    }
  }

  function getReportPlainText() {
    const price = Math.max(0, parseFloat($("price").value) || 0);
    const downPayment = Math.max(0, parseFloat($("downPayment").value) || 0);
    const loan = Math.max(0, price - downPayment);
    const payment5 = Math.floor(getCalculation(loan, 60).payment);
    const payment6 = Math.floor(getCalculation(loan, 72).payment);
    const payment7 = Math.floor(getCalculation(loan, 84).payment);
    if (currentLanguage === "km") {
      return `ករណីឡានតម្លៃ ${moneyNoDecimal(price)}$
-បង់មុន ${moneyNoDecimal(downPayment)}$
-កម្ចី ${moneyNoDecimal(loan)}$

***បង់ប្រចាំខែ ${payment5}$ រយៈពេល 5ឆ្នាំ
***បង់ប្រចាំខែ ${payment6}$ រយៈពេល 6ឆ្នាំ
***បង់ប្រចាំខែ ${payment7}$ រយៈពេល 7ឆ្នាំ`;
    }
    return `Car price ${moneyNoDecimal(price)}$
-Down payment ${moneyNoDecimal(downPayment)}$
-Loan ${moneyNoDecimal(loan)}$

***Monthly payment ${payment5}$ for 5 years
***Monthly payment ${payment6}$ for 6 years
***Monthly payment ${payment7}$ for 7 years`;
  }

  // Report with monthly payments for 1 to 7 years
  function buildAllReport(price, downPayment, loan, html) {
    const km = currentLanguage === "km";
    const b = v => html ? `<strong>${v}</strong>` : v;
    const nl = html ? "<br>" : "\n";
    const head = km
      ? `ករណីឡានតម្លៃ ${b(moneyNoDecimal(price) + "$")}${nl}-បង់មុន ${b(moneyNoDecimal(downPayment) + "$")}${nl}-កម្ចី ${b(moneyNoDecimal(loan) + "$")}${nl}${nl}`
      : `Car price ${b(moneyNoDecimal(price) + "$")}${nl}-Down payment ${b(moneyNoDecimal(downPayment) + "$")}${nl}-Loan ${b(moneyNoDecimal(loan) + "$")}${nl}${nl}`;
    const lines = [];
    for (let n = 1; n <= 7; n++) {
      const p = Math.floor(getCalculation(loan, n * 12).payment);
      lines.push(km
        ? `***បង់ប្រចាំខែ ${b(p + "$")} រយៈពេល ${n}ឆ្នាំ`
        : `***Monthly payment ${b(p + "$")} for ${n} year${n > 1 ? "s" : ""}`);
    }
    return head + lines.join(nl);
  }

  function renderAllReport(price, downPayment, loan) {
    $("reportAllText").innerHTML = buildAllReport(price, downPayment, loan, true);
  }

  function getAllPlainText() {
    const price = Math.max(0, parseFloat($("price").value) || 0);
    const downPayment = Math.max(0, parseFloat($("downPayment").value) || 0);
    return buildAllReport(price, downPayment, Math.max(0, price - downPayment), false);
  }

  // Down payment amount -> percentage
  $("downPayment").addEventListener("input", () => {
    const price = parseFloat($("price").value) || 0;
    const down = parseFloat($("downPayment").value) || 0;

    if (document.activeElement !== $("downPercent")) {
      $("downPercent").value =
        price > 0 ? Number(((down / price) * 100).toFixed(2)) : 0;
    }

    calculate();
  });

  // Down payment percentage -> amount
  $("downPercent").addEventListener("input", () => {
    const price = parseFloat($("price").value) || 0;
    const percent = Math.min(
      100,
      Math.max(0, parseFloat($("downPercent").value) || 0)
    );

    $("downPayment").value = (price * percent / 100).toFixed(2);
    calculate();
  });

  // All other inputs
  [
    "price",
    "term",
    "interestRate",
    "termYear",
    "termMonth",
    "annualRate",
    "monthlyRate",
    "fixedLoan",
    "flatLoan"
  ].forEach(id => {
    $(id).addEventListener("input", calculate);
    $(id).addEventListener("change", calculate);
  });

  // Remove the leading 0: clear a "0" field on focus, and strip zeros typed in front (05 -> 5)
  ["price", "downPayment", "downPercent", "term", "interestRate"].forEach(id => {
    const el = $(id);
    el.addEventListener("focus", () => {
      if (el.value !== "" && parseFloat(el.value) === 0) el.value = "";
    });
    el.addEventListener("input", () => {
      if (/^0+\d/.test(el.value)) el.value = el.value.replace(/^0+(?=\d)/, "");
    });
  });

  $("clearBtn").addEventListener("click", () => {
    $("price").value = "";
    $("downPayment").value = "";
    $("downPercent").value = "";
    $("term").value = "0";
    $("interestRate").value = "0.77";
    $("termYear").checked = true;
    $("monthlyRate").checked = true;
    $("flatLoan").checked = true;
    calculate();
  });

  async function copyWith(getText, buttons, report, messageEl) {
    const text = getText();

    // Play a quick click animation on both Copy buttons.
    buttons.forEach(button => {
      button.classList.remove("copy-report-animate");
      void button.offsetWidth;
      button.classList.add("copy-report-animate");
    });

    const showCopiedState = () => {
      buttons.forEach(button => {
        button.classList.add("copied");
        const originalText = button.dataset.originalText || button.textContent;
        button.dataset.originalText = originalText;
        button.textContent = currentLanguage === "km" ? "✓ បានចម្លង" : "✓ Copied";

        setTimeout(() => {
          button.textContent = translations[currentLanguage][button.dataset.i18n] || button.dataset.originalText;
          button.classList.remove("copied");
        }, 1400);
      });

      // Highlight the report so the user can see where it was copied from.
      report.classList.remove("copy-success");
      void report.offsetWidth;
      report.classList.add("copy-success");

      messageEl.textContent = translations[currentLanguage].copied;
      setTimeout(() => messageEl.textContent = "", 2000);
    };

    try {
      await navigator.clipboard.writeText(text);
      showCopiedState();
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      showCopiedState();
    }
  }

  const copyReport = () =>
    copyWith(getReportPlainText, [$("copyBtn")], $("reportText"), $("copyMessage"));
  const copyAllReport = () =>
    copyWith(getAllPlainText, [$("copyAllBtn")], $("reportAllText"), $("copyMessageAll"));

  $("copyBtn").addEventListener("click", copyReport);
  $("copyAllBtn").addEventListener("click", copyAllReport);

  // Language switcher
  const translations = {
    en: {
      loanCalculator: "Loan Calculator", clear: "Clear", price: "Price",
      downPayment: "Down Payment", term: "Term", year: "Year", month: "Month",
      interestRate: "Interest Rate", annual: "Annual", monthly: "Monthly",
      loanType: "Loan Type", fixed: "Fixed", flat: "Flat", perMonth: "Per month",
      loanAmount: "Loan Amount", totalInterest: "Total Interest", totalPayment: "Total Payment",
      fiveYears: "5 Years", sixYears: "6 Years",
      sevenYears: "7 Years", copyToReport: "Copy to Report", copyReport: "Copy Report",
      loanPaymentSchedule: "Loan Payment Schedule", copied: "Report copied successfully!",
      developedBy: "Developed by",
      reportAll: "Report: 1 to 7 years", thNo: "No.", thPayment: "Payment",
      thInterest: "Interest", thPrincipal: "Principal", thBalance: "Balance",
      history: "History", saveHistory: "Save", clearHistory: "Clear all",
      emptyHistory: "No saved calculations yet. Press Save to keep one.", saved: "Saved to history!"
    },
    km: {
      loanCalculator: "គណនាកម្ចី", clear: "សម្អាត", price: "តម្លៃ",
      downPayment: "បង់មុន", term: "រយៈពេល", year: "ឆ្នាំ", month: "ខែ",
      interestRate: "អត្រាការប្រាក់", annual: "ប្រចាំឆ្នាំ", monthly: "ប្រចាំខែ",
      loanType: "ប្រភេទកម្ចី", fixed: "ថេរ", flat: "Flat", perMonth: "ក្នុងមួយខែ",
      loanAmount: "ចំនួនកម្ចី", totalInterest: "ការប្រាក់សរុប", totalPayment: "ការបង់សរុប",
      fiveYears: "5 ឆ្នាំ", sixYears: "6 ឆ្នាំ",
      sevenYears: "7 ឆ្នាំ", copyToReport: "ចម្លងទៅរបាយការណ៍", copyReport: "ចម្លងរបាយការណ៍",
      loanPaymentSchedule: "តារាងការបង់កម្ចី", copied: "បានចម្លងរបាយការណ៍ដោយជោគជ័យ!",
      developedBy: "អភិវឌ្ឍន៍ដោយ",
      reportAll: "របាយការណ៍ 1 ដល់ 7 ឆ្នាំ", thNo: "ល.រ", thPayment: "ការបង់",
      thInterest: "ការប្រាក់", thPrincipal: "ប្រាក់ដើម", thBalance: "សមតុល្យ",
      history: "ប្រវត្តិ", saveHistory: "រក្សាទុក", clearHistory: "លុបទាំងអស់",
      emptyHistory: "មិនទាន់មានការគណនាដែលបានរក្សាទុក។ ចុច “រក្សាទុក” ដើម្បីបញ្ចូល។", saved: "បានរក្សាទុកក្នុងប្រវត្តិ!"
    }
  };

  // Flag emoji don't render on some systems (e.g. Windows): detect that and fall back to text
  const FLAG_OK = (() => {
    try {
      const c = document.createElement('canvas'); c.width = 40; c.height = 40;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.textBaseline = 'top'; x.font = '28px sans-serif';
      x.fillText('\u{1F1F0}\u{1F1ED}', 0, 0);
      const d = x.getImageData(0, 0, 40, 40).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0 && (Math.abs(d[i] - d[i + 1]) > 40 || Math.abs(d[i + 1] - d[i + 2]) > 40)) return true;
      }
      return false;
    } catch (e) { return true; }
  })();
  const flagText = code => FLAG_OK ? (code === 'KH' ? '\u{1F1F0}\u{1F1ED}' : '\u{1F1EC}\u{1F1E7}') : (code === 'KH' ? 'KH' : 'EN');

  let currentLanguage = "km"; // Khmer is always the default

  function applyLanguage() {
    const t = translations[currentLanguage];
    document.documentElement.lang = currentLanguage === "km" ? "km" : "en";
    document.title = t.loanCalculator;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      if (t[key]) el.textContent = t[key];
    });
    $("languageFlag").textContent = flagText(currentLanguage === "en" ? "KH" : "GB");
    $("languageFlag").classList.toggle("flag-text", !FLAG_OK);
    $("languageFlag").setAttribute("aria-label", currentLanguage === "en" ? "Switch to Khmer" : "Switch to English");
    calculate();
    renderReport(
      Math.max(0, parseFloat($("price").value) || 0),
      Math.max(0, parseFloat($("downPayment").value) || 0),
      Math.max(0, (parseFloat($("price").value) || 0) - (parseFloat($("downPayment").value) || 0))
    );
  }

  $("languageBtn").addEventListener("click", () => {
    currentLanguage = currentLanguage === "en" ? "km" : "en";
    [[$("languageFlag"), "flip"], [document.querySelector(".content-area"), "lang-swap"]].forEach(([node, cls]) => {
      node.classList.remove(cls);
      void node.offsetWidth;
      node.classList.add(cls);
    });
    applyLanguage();
  });

  // Initial setup: Khmer first (applyLanguage also runs the calculation)
  applyLanguage();

  // ===== History (saved in this browser) =====
  const HKEY = 'loanHistory';
  let history = [];
  try { history = JSON.parse(localStorage.getItem(HKEY) || '[]') || []; } catch (e) { history = []; }
  const persistHistory = () => { try { localStorage.setItem(HKEY, JSON.stringify(history)); } catch (e) {} };

  function restoreEntry(h) {
    $('price').value = h.price;
    $('downPayment').value = h.down;
    $('term').value = h.term;
    $('interestRate').value = h.rate;
    $(h.year ? 'termYear' : 'termMonth').checked = true;
    $(h.annual ? 'annualRate' : 'monthlyRate').checked = true;
    $(h.fixed ? 'fixedLoan' : 'flatLoan').checked = true;
    calculate();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderHistory() {
    const t = translations[currentLanguage];
    const km = currentLanguage === 'km';
    const box = $('historyList');
    box.innerHTML = '';
    if (!history.length) {
      box.innerHTML = `<div class='history-empty'>${t.emptyHistory}</div>`;
      return;
    }
    history.forEach((h, i) => {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.tabIndex = 0;
      row.style.animationDelay = Math.min(i, 8) * 40 + 'ms';
      const unit = h.year ? (km ? 'ឆ្នាំ' : 'yr') : (km ? 'ខែ' : 'mo');
      const rateUnit = h.annual ? (km ? '/ឆ្នាំ' : '/yr') : (km ? '/ខែ' : '/mo');
      const d = new Date(h.id);
      const when = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      row.innerHTML = `<div class='history-main'><div class='history-price'>$${moneyNoDecimal(h.price)} <span>• ${t.downPayment} $${moneyNoDecimal(h.down)}</span></div><div class='history-meta'>${h.term} ${unit} • ${h.rate}%${rateUnit} • ${h.fixed ? t.fixed : t.flat} • ${when}</div></div><div class='history-pay'>$${money(h.payment)}<small>${t.perMonth}</small></div><button type='button' class='history-del' aria-label='Delete'>×</button>`;
      row.addEventListener('click', () => restoreEntry(h));
      row.addEventListener('keydown', e => { if (e.key === 'Enter') restoreEntry(h); });
      row.querySelector('.history-del').addEventListener('click', e => {
        e.stopPropagation();
        history = history.filter(x => x.id !== h.id);
        persistHistory();
        renderHistory();
      });
      box.appendChild(row);
    });
  }

  $('saveHistoryBtn').addEventListener('click', () => {
    const price = Math.max(0, parseFloat($('price').value) || 0);
    if (!price) return;
    const down = Math.min(price, Math.max(0, parseFloat($('downPayment').value) || 0));
    const loan = price - down;
    const term = Math.max(0, parseInt($('term').value) || 0);
    const year = $('termYear').checked;
    const r = getCalculation(loan, Math.max(1, year ? term * 12 : term));
    history.unshift({
      id: Date.now(), price, down, term, year,
      rate: parseFloat($('interestRate').value) || 0,
      annual: $('annualRate').checked,
      fixed: $('fixedLoan').checked,
      payment: r.payment,
      total: down + r.totalPayment
    });
    history = history.slice(0, 30);
    persistHistory();
    renderHistory();
    $('historyMsg').textContent = translations[currentLanguage].saved;
    setTimeout(() => $('historyMsg').textContent = '', 1800);
  });

  $('clearHistoryBtn').addEventListener('click', () => {
    history = [];
    persistHistory();
    renderHistory();
  });

  // Re-render labels whenever the language changes
  new MutationObserver(renderHistory).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  renderHistory();

  // Motion that answers the user's input
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Money figures in the result panel count up or down to their new value
  ["monthlyPayment", "summaryDown", "summaryLoan", "summaryInterest", "summaryTotal"].forEach(id => {
    const el = $(id);
    let shown = parseFloat(el.textContent.replace(/[^0-9.]/g, "")) || 0;
    let raf = 0;
    const watch = () => observer.observe(el, { childList: true, characterData: true, subtree: true });
    const observer = new MutationObserver(() => {
      const finalText = el.textContent;
      const target = parseFloat(finalText.replace(/[^0-9.]/g, "")) || 0;
      cancelAnimationFrame(raf);
      if (reduceMotion || target === shown) { shown = target; return; }
      if (id === "monthlyPayment") {
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
      }
      const from = shown, start = performance.now(), duration = 450;
      const step = now => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        observer.disconnect();
        shown = from + (target - from) * eased;
        el.textContent = t < 1 ? "$" + money(shown) : finalText;
        watch();
        if (t < 1) raf = requestAnimationFrame(step); else shown = target;
      };
      raf = requestAnimationFrame(step);
    });
    watch();
  });

  // ===== Light / dark theme =====
  (function () {
    const KEY = 'loanTheme';
    const btn = $('themeBtn');
    let theme = null;
    try { theme = localStorage.getItem(KEY); } catch (e) {}
    if (theme !== 'dark' && theme !== 'light') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const apply = () => {
      document.documentElement.setAttribute('data-theme', theme);
      btn.innerHTML = theme === 'dark' ? "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='4'/><path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/></svg>" : "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'/></svg>";
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    };
    apply();
    btn.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, theme); } catch (e) {}
      if (!reduce) {
        document.documentElement.classList.add('theme-anim');
        setTimeout(() => document.documentElement.classList.remove('theme-anim'), 450);
        btn.classList.remove('spin'); void btn.offsetWidth; btn.classList.add('spin');
      }
      apply();
    });
  })();

  // ===== Scroll animation =====
  (function () {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.result-card, .history-card, .report-card, .app-footer').forEach((el, i) => {
      el.classList.add('reveal');
      io.observe(el);
    });
  })();

  // ===== Floating buttons =====
  (function () {
    const wrap = document.createElement('div');
    wrap.className = 'fab-wrap';
    wrap.innerHTML = "<button type='button' class='fab fab-top' id='fabTop' aria-label='Back to top'>↑</button>";
    document.body.appendChild(wrap);
    const top = $('fabTop');
    const sync = () => top.classList.toggle('show', window.scrollY > 400);
    window.addEventListener('scroll', sync, { passive: true });
    top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    sync();
  })();

  // Reports flash briefly when their text changes
  ["reportText", "reportAllText"].forEach(id => {
    const el = $(id);
    let last = el.innerHTML;
    new MutationObserver(() => {
      if (el.innerHTML === last) return;
      last = el.innerHTML;
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  const schedule = document.getElementById("loanSchedule");
  const arrow = document.getElementById("scheduleArrow");
  schedule.addEventListener("show.bs.collapse", () => {
    arrow.classList.add("open");
    schedule.classList.add("rows-in");
    setTimeout(() => schedule.classList.remove("rows-in"), 900);
  });
  schedule.addEventListener("hide.bs.collapse", () => arrow.classList.remove("open"));
