  const $ = id => document.getElementById(id);

  // ===== Money inputs: thousands separators =====
  const readNum = el => parseFloat(String(el.value).replace(/,/g, ""));
  const fmtNum = n => (Number.isFinite(n) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) : "");

  function formatMoneyInput(el) {
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, caret).replace(/[^0-9.]/g, "").length;

    let clean = raw.replace(/[^0-9.]/g, "");
    const dot = clean.indexOf(".");
    if (dot !== -1) clean = clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\./g, "");
    let [intPart, decPart] = clean.split(".");
    intPart = (intPart || "").replace(/^0+(?=\d)/, "");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const out = decPart !== undefined ? grouped + "." + decPart : grouped;
    if (out === el.value) return;
    el.value = out;

    // Keep the cursor after the same number of digits
    let pos = 0, seen = 0;
    if (digitsBefore > 0) {
      for (let i = 0; i < out.length; i++) {
        if (/[0-9.]/.test(out[i])) seen++;
        if (seen === digitsBefore) { pos = i + 1; break; }
      }
    }
    el.setSelectionRange(pos, pos);
  }

  ["price", "downPayment"].forEach(id => {
    $(id).addEventListener("input", () => formatMoneyInput($(id)));
  });

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
    const price = Math.max(0, readNum($("price")) || 0);

    let downPayment = Math.max(
      0,
      readNum($("downPayment")) || 0
    );

    // Keep down payment inside the price, and reflect the clamp back
    // into the field so the UI never shows a down payment larger than price.
    if (downPayment > price) {
      downPayment = price;
      if (document.activeElement !== $("downPayment")) {
        $("downPayment").value = fmtNum(downPayment);
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
    $("perDay").textContent = (currentLanguage === "km" ? "ការបង់ប្រចាំថ្ងៃ " : "Daily payment ") + "$" + money(result.payment / 30);
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

  let scheduleShowAll = false;

  function renderSchedule(loan, months, payment) {
    const tbody = $("scheduleBody");
    tbody.innerHTML = "";

    if (loan <= 0 || months <= 0) return;

    const monthlyRate = getMonthlyRate();
    const isFixed = $("fixedLoan").checked;

    let balance = loan;
    const rowsToShow = scheduleShowAll ? months : Math.min(months, 12);

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
      const km = currentLanguage === "km";
      const label = scheduleShowAll
        ? (km ? "បង្ហាញតិច" : "Show less")
        : (km ? `បង្ហាញទាំងអស់ (${months} ការបង់)` : `Show more (${months} payments)`);
      tr.innerHTML = `
        <td colspan="5" class="text-center">
          <button type="button" class="btn btn-sm download-btn ghost" id="scheduleToggleBtn">${label}</button>
        </td>
      `;
      tbody.appendChild(tr);
      $("scheduleToggleBtn").onclick = () => {
        scheduleShowAll = !scheduleShowAll;
        renderSchedule(loan, months, payment);
      };
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
    const price = Math.max(0, readNum($("price")) || 0);
    const downPayment = Math.max(0, readNum($("downPayment")) || 0);
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
    const price = Math.max(0, readNum($("price")) || 0);
    const downPayment = Math.max(0, readNum($("downPayment")) || 0);
    return buildAllReport(price, downPayment, Math.max(0, price - downPayment), false);
  }

  // Down payment amount -> percentage
  $("downPayment").addEventListener("input", () => {
    const price = readNum($("price")) || 0;
    const down = readNum($("downPayment")) || 0;

    if (document.activeElement !== $("downPercent")) {
      $("downPercent").value =
        price > 0 ? Number(((down / price) * 100).toFixed(2)) : 0;
    }

    calculate();
  });

  // Down payment percentage -> amount
  $("downPercent").addEventListener("input", () => {
    const price = readNum($("price")) || 0;
    const percent = Math.min(
      100,
      Math.max(0, parseFloat($("downPercent").value) || 0)
    );

    $("downPayment").value = fmtNum(price * percent / 100);
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
    $("term").value = "7";
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

  // Keyboard: Enter calculates, Esc clears
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && (e.target.type === "number" || e.target.hasAttribute("data-money"))) {
      e.preventDefault();
      calculate();
      e.target.blur();
    }
    if (e.key === "Escape") {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      $("clearBtn").click();
    }
  });

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
      thInterest: "Interest", thPrincipal: "Principal", thBalance: "Balance", downloadTable: "Download table",
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
      thInterest: "ការប្រាក់", thPrincipal: "ប្រាក់ដើម", thBalance: "សមតុល្យ", downloadTable: "ទាញយកតារាង",
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
      Math.max(0, readNum($("price")) || 0),
      Math.max(0, readNum($("downPayment")) || 0),
      Math.max(0, (readNum($("price")) || 0) - (readNum($("downPayment")) || 0))
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
    $('price').value = fmtNum(h.price);
    $('downPayment').value = fmtNum(h.down);
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
    const price = Math.max(0, readNum($("price")) || 0);
    if (!price) return;
    const down = Math.min(price, Math.max(0, readNum($("downPayment")) || 0));
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

  // ===== Download schedule table: choose CSV or Excel (.xlsx, colored) =====
  (function () {
    const btn = document.getElementById("downloadTableBtn");
    const menu = document.getElementById("downloadMenu");
    const table = document.querySelector("#loanSchedule table");
    if (!btn || !menu || !table) return;

    const enc = new TextEncoder();
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const isNumText = v => /^-?[\d,]+(\.\d+)?$/.test(v);

    function tableData() {
      const header = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
      const rows = [...table.querySelectorAll("tbody tr")]
        .filter(tr => tr.children.length === 5)
        .map(tr => [...tr.children].map(td => td.textContent.trim()));
      return { header, rows };
    }

    // ----- CSV -----
    function buildCsv(header, rows) {
      const cell = v => '"' + String(v).replace(/"/g, '""') + '"';
      return "\uFEFF" + [header, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
    }

    // ----- XLSX (built by hand: zip + SpreadsheetML with fills and number format) -----
    const CRC_TABLE = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
      return t;
    })();
    const crc32 = bytes => {
      let c = 0xFFFFFFFF;
      for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
      return (c ^ 0xFFFFFFFF) >>> 0;
    };

    function zipStore(files) {
      const parts = [], central = [];
      let offset = 0;
      for (const f of files) {
        const name = enc.encode(f.name);
        const crc = crc32(f.data), size = f.data.length;
        const lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true);
        lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true);
        lh.setUint32(18, size, true); lh.setUint32(22, size, true);
        lh.setUint16(26, name.length, true);
        parts.push(new Uint8Array(lh.buffer), name, f.data);

        const cd = new DataView(new ArrayBuffer(46));
        cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
        cd.setUint16(14, 0x21 & 0xFFFF, true); cd.setUint16(16, 0, true);
        cd.setUint32(16, crc, true); cd.setUint32(20, size, true); cd.setUint32(24, size, true);
        cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
        central.push(new Uint8Array(cd.buffer), name);
        offset += 30 + name.length + size;
      }
      const cdSize = central.reduce((a, p) => a + p.length, 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true);
      end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true);
      end.setUint32(16, offset, true);
      const all = [...parts, ...central, new Uint8Array(end.buffer)];
      const total = all.reduce((a, p) => a + p.length, 0);
      const out = new Uint8Array(total);
      let pos = 0;
      for (const p of all) { out.set(p, pos); pos += p.length; }
      return out;
    }

    // Reads the same inputs the calculator uses, so the Excel formulas match the page.
    function currentParams() {
      const g = id => document.getElementById(id);
      const num = id => parseFloat(String(g(id).value).replace(/,/g, "")) || 0;
      const price = Math.max(0, num("price"));
      let down = Math.max(0, num("downPayment"));
      if (down > price) down = price;
      const loan = Math.max(0, price - down);
      const termV = Math.max(0, Math.floor(num("term")));
      const months = Math.max(1, g("termYear").checked ? termV * 12 : termV);
      const raw = num("interestRate");
      const r = g("annualRate").checked ? raw / 12 / 100 : raw / 100;
      return { price, down, loan, months, r, fixed: g("fixedLoan").checked };
    }

    function sheetXml(header, rows) {
      const p = currentParams();
      const n = rows.length;
      const col = i => String.fromCharCode(65 + i);
      const TITLE = "តារាងបង់រំលស់";
      const H = 11;            // table header row
      const first = H + 1;     // first data row
      const lastRow = H + n;   // last data row
      const totalRow = lastRow + 1;

      const payment = p.fixed
        ? (p.r === 0 ? p.loan / p.months : p.loan * p.r * Math.pow(1 + p.r, p.months) / (Math.pow(1 + p.r, p.months) - 1))
        : (p.loan + p.loan * p.r * p.months) / p.months;

      // Cached values so numbers show before Excel recalculates
      const cache = [];
      let bal = p.loan;
      for (let i = 0; i < n; i++) {
        const interest = p.fixed ? bal * p.r : p.loan * p.r;
        const principal = payment - interest;
        bal = bal - principal;
        cache.push({ interest, principal, bal });
      }

      const cells = {};
      const add = (r, xml) => { (cells[r] = cells[r] || []).push(xml); };
      const txt = (ref, s, t) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t>${esc(t)}</t></is></c>`;
      const val = (ref, s, v) => `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
      const fx = (ref, s, f, v) => `<c r="${ref}" s="${s}"><f>${f}</f><v>${v}</v></c>`;

      // Title (merged A1:E1)
      add(1, txt("A1", 6, TITLE));
      for (let i = 1; i < header.length; i++) add(1, `<c r="${col(i)}1" s="6"/>`);

      // Loan information block (labels in A, values in B)
      const info = [
        [3, "តម្លៃ / Price", val("B3", 4, p.price)],
        [4, "បង់មុន / Down payment", val("B4", 4, p.down)],
        [5, "ចំនួនកម្ចី / Loan amount", fx("B5", 4, "B3-B4", p.loan)],
        [6, "អត្រាការប្រាក់ក្នុងមួយខែ / Monthly rate", val("B6", 8, p.r)],
        [7, "រយៈពេល (ខែ) / Months", val("B7", 2, p.months)],
        [8, "ការបង់ក្នុងមួយខែ / Monthly payment", fx("B8", 4, p.fixed ? "PMT(B6,B7,-B5)" : "(B5+B5*B6*B7)/B7", payment)],
        [9, "ប្រភេទកម្ចី / Loan type", txt("B9", 2, p.fixed ? "Fixed" : "Flat")],
      ];
      info.forEach(([r, label, valueXml]) => { add(r, txt("A" + r, 7, label)); add(r, valueXml); });

      // Table header
      header.forEach((h, i) => add(H, txt(col(i) + H, 1, h)));

      // Schedule rows with formulas
      rows.forEach((r, ri) => {
        const rn = first + ri, band = ri % 2 === 1, c = cache[ri];
        const sPlain = band ? 3 : 2, sMoney = band ? 5 : 4;
        const no = r[0];
        add(rn, isNumText(no) ? val("A" + rn, sPlain, Number(no.replace(/,/g, ""))) : txt("A" + rn, sPlain, no));
        add(rn, fx("B" + rn, sMoney, "$B$8", payment));
        const interestF = (p.fixed && ri > 0) ? `E${rn - 1}*$B$6` : `$B$5*$B$6`;
        add(rn, fx("C" + rn, sMoney, interestF, c.interest));
        add(rn, fx("D" + rn, sMoney, `B${rn}-C${rn}`, c.principal));
        const balF = ri === 0 ? `$B$5-D${rn}` : `E${rn - 1}-D${rn}`;
        add(rn, fx("E" + rn, sMoney, balF, c.bal));
      });

      // Totals
      const sum = k => cache.reduce((a, c) => a + (k === "pay" ? payment : c[k]), 0);
      add(totalRow, txt("A" + totalRow, 1, "Total"));
      add(totalRow, fx("B" + totalRow, 4, `SUM(B${first}:B${lastRow})`, sum("pay")));
      add(totalRow, fx("C" + totalRow, 4, `SUM(C${first}:C${lastRow})`, sum("interest")));
      add(totalRow, fx("D" + totalRow, 4, `SUM(D${first}:D${lastRow})`, sum("principal")));

      const rowsXml = Object.keys(cells).map(Number).sort((a, b) => a - b)
        .map(r => `<row r="${r}">${cells[r].join("")}</row>`).join("");

      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' +
        `<cols><col min="1" max="1" width="40" customWidth="1"/><col min="2" max="${Math.max(header.length, 2)}" width="18" customWidth="1"/></cols>` +
        `<sheetData>${rowsXml}</sheetData>` +
        `<mergeCells count="1"><mergeCell ref="A1:${col(header.length - 1)}1"/></mergeCells>` +
        '</worksheet>';
    }

    const STYLES =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="4"><font><sz val="11"/><name val="Khmer OS"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Khmer OS"/></font>' +
      '<font><b/><sz val="16"/><color rgb="FF0B2A6F"/><name val="Khmer OS"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF0B2A6F"/><name val="Khmer OS"/></font></fonts>' +
      '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0B2A6F"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="9">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>' +
      '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="4" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';

    function buildXlsx(header, rows) {
      const files = [
        { name: "[Content_Types].xml", data: enc.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          '</Types>') },
        { name: "_rels/.rels", data: enc.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>') },
        { name: "xl/workbook.xml", data: enc.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets><sheet name="Schedule" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>') },
        { name: "xl/_rels/workbook.xml.rels", data: enc.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '</Relationships>') },
        { name: "xl/styles.xml", data: enc.encode(STYLES) },
        { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml(header, rows)) },
      ];
      return zipStore(files);
    }

    // ----- PDF: each page is drawn on a canvas (so Khmer shapes correctly), then embedded as a JPEG page -----
    const PAGE_W = 1654, PAGE_H = 2339; // A4 at about 200 dpi
    const KH_FONT = '"Kantumruy Pro", "Khmer OS", "Noto Sans Khmer", sans-serif';
    const money2 = n => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const numOf = v => Number(String(v).replace(/,/g, "")) || 0;
    const monthlyPayment = p => p.fixed
      ? (p.r === 0 ? p.loan / p.months : p.loan * p.r * Math.pow(1 + p.r, p.months) / (Math.pow(1 + p.r, p.months) - 1))
      : (p.loan + p.loan * p.r * p.months) / p.months;

    function infoLines(p) {
      return [
        ["តម្លៃ / Price", "$" + money2(p.price)],
        ["បង់មុន / Down payment", "$" + money2(p.down)],
        ["ចំនួនកម្ចី / Loan amount", "$" + money2(p.loan)],
        ["អត្រាការប្រាក់ក្នុងមួយខែ / Monthly rate", (p.r * 100).toFixed(2) + "%"],
        ["រយៈពេល (ខែ) / Months", String(p.months)],
        ["ការបង់ក្នុងមួយខែ / Monthly payment", "$" + money2(monthlyPayment(p))],
        ["ប្រភេទកម្ចី / Loan type", p.fixed ? "Fixed" : "Flat"],
      ];
    }

    function renderPdfPage(pg, pageIndex, pageCount, header, rows, p, sums) {
      const ROW_H = 64, HEAD_H = 72, M = 110, TW = PAGE_W - 2 * M;
      const TOP_FIRST = 740, TOP_NEXT = 200;
      const c = document.createElement("canvas");
      c.width = PAGE_W; c.height = PAGE_H;
      const x = c.getContext("2d");
      x.fillStyle = "#FFFFFF";
      x.fillRect(0, 0, PAGE_W, PAGE_H);

      if (pg.first) {
        x.fillStyle = "#0B2A6F";
        x.fillRect(0, 0, PAGE_W, 220);
        x.fillStyle = "#FFFFFF";
        x.font = `bold 84px ${KH_FONT}`;
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillText("តារាងបង់រំលស់", PAGE_W / 2, 120);

        let y = 280;
        infoLines(p).forEach(([k, v], i) => {
          x.fillStyle = i % 2 ? "#E8EEF8" : "#FFFFFF";
          x.fillRect(M, y, TW, 56);
          x.textBaseline = "middle";
          x.fillStyle = "#0B2A6F";
          x.font = `bold 30px ${KH_FONT}`;
          x.textAlign = "left";
          x.fillText(k, M + 20, y + 28);
          x.fillStyle = "#0D1B3A";
          x.font = `30px ${KH_FONT}`;
          x.textAlign = "right";
          x.fillText(v, PAGE_W - M - 20, y + 28);
          y += 56;
        });
      }

      const top = pg.first ? TOP_FIRST : TOP_NEXT;
      const colW = TW / header.length;
      x.fillStyle = "#0B2A6F";
      x.fillRect(M, top, TW, HEAD_H);
      x.fillStyle = "#FFFFFF";
      x.font = `bold 28px ${KH_FONT}`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      header.forEach((h, i) => x.fillText(h, M + colW * i + colW / 2, top + HEAD_H / 2));

      const pageRows = rows.slice(pg.start, pg.start + pg.count);
      pageRows.forEach((r, ri) => {
        const y = top + HEAD_H + ri * ROW_H;
        x.fillStyle = ri % 2 ? "#E8EEF8" : "#FFFFFF";
        x.fillRect(M, y, TW, ROW_H);
        x.fillStyle = "#0D1B3A";
        x.font = `28px ${KH_FONT}`;
        r.forEach((v, ci) => {
          x.textAlign = ci === 0 ? "center" : "right";
          const tx = ci === 0 ? M + colW / 2 : M + colW * (ci + 1) - 16;
          x.fillText(v, tx, y + ROW_H / 2);
        });
      });

      if (pg.isLast && sums) {
        const y = top + HEAD_H + pageRows.length * ROW_H;
        x.fillStyle = "#D3DCEF";
        x.fillRect(M, y, TW, ROW_H);
        x.fillStyle = "#0B2A6F";
        x.font = `bold 28px ${KH_FONT}`;
        x.textAlign = "center";
        x.fillText("Total", M + colW / 2, y + ROW_H / 2);
        x.textAlign = "right";
        [sums.payment, sums.interest, sums.principal].forEach((v, i) =>
          x.fillText(money2(v), M + colW * (i + 2) - 16, y + ROW_H / 2));
      }

      x.fillStyle = "#5B6B8C";
      x.font = `22px ${KH_FONT}`;
      x.textAlign = "center";
      x.fillText(`${pageIndex + 1} / ${pageCount}`, PAGE_W / 2, PAGE_H - 70);

      return new Promise(res => c.toBlob(b => b.arrayBuffer().then(buf => res(new Uint8Array(buf))), "image/jpeg", 0.92));
    }

    function assemblePdf(images) {
      const enc = new TextEncoder();
      const chunks = [], offsets = [];
      let len = 0;
      const put = part => { const b = typeof part === "string" ? enc.encode(part) : part; chunks.push(b); len += b.length; };
      const obj = (n, ...parts) => { offsets[n] = len; put(`${n} 0 obj\n`); parts.forEach(put); put("\nendobj\n"); };
      const N = images.length;
      const pageId = i => 3 + i * 3;

      put("%PDF-1.4\n");
      obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
      obj(2, `<< /Type /Pages /Kids [${images.map((_, i) => pageId(i) + " 0 R").join(" ")}] /Count ${N} >>`);
      images.forEach((im, i) => {
        const pid = pageId(i), cid = pid + 1, iid = pid + 2;
        obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
        const content = `q 595 0 0 842 0 0 cm /Im${i} Do Q`;
        obj(cid, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        obj(iid,
          `<< /Type /XObject /Subtype /Image /Width ${PAGE_W} /Height ${PAGE_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.length} >>\nstream\n`,
          im,
          "\nendstream");
      });

      const maxId = pageId(N - 1) + 2;
      const xrefPos = len;
      let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
      for (let i = 1; i <= maxId; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
      put(xref);
      put(`trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

      const out = new Uint8Array(len);
      let pos = 0;
      chunks.forEach(ch => { out.set(ch, pos); pos += ch.length; });
      return out;
    }

    async function buildPdf(header, rows) {
      const p = currentParams();
      try { await document.fonts.load(`32px ${KH_FONT}`); } catch (e) { /* use fallback font */ }

      // Pagination
      const ROW_H = 64, HEAD_H = 72, TOP_FIRST = 740, TOP_NEXT = 200, BOTTOM = PAGE_H - 160;
      const defs = [];
      let idx = 0, firstPg = true;
      do {
        const top = firstPg ? TOP_FIRST : TOP_NEXT;
        const cap = Math.floor((BOTTOM - top - HEAD_H) / ROW_H);
        const take = Math.max(1, Math.min(cap, rows.length - idx));
        defs.push({ first: firstPg, start: idx, count: Math.min(take, rows.length - idx) });
        idx += defs[defs.length - 1].count;
        firstPg = false;
      } while (idx < rows.length);
      const lastDef = defs[defs.length - 1];
      const lastTop = lastDef.first ? TOP_FIRST : TOP_NEXT;
      if (lastDef.count + 1 > Math.floor((BOTTOM - lastTop - HEAD_H) / ROW_H)) {
        defs.push({ first: false, start: rows.length, count: 0 });
      }
      defs.forEach((d, i) => { d.isLast = i === defs.length - 1; });

      const sums = {
        payment: rows.reduce((a, r) => a + numOf(r[1]), 0),
        interest: rows.reduce((a, r) => a + numOf(r[2]), 0),
        principal: rows.reduce((a, r) => a + numOf(r[3]), 0),
      };

      const images = [];
      for (let i = 0; i < defs.length; i++) {
        images.push(await renderPdfPage(defs[i], i, defs.length, header, rows, p, sums));
      }
      return assemblePdf(images);
    }

    // ----- Save flow -----
    // Saves a file through the artifact's download capability when available,
    // otherwise as a normal browser download (for the GitHub Pages / local version).
    const browserSave = async ({ filename, data }) => {
      const type = filename.endsWith(".pdf") ? "application/pdf"
        : filename.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv;charset=utf-8";
      const url = URL.createObjectURL(new Blob([data], { type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    let downloads = { save: browserSave };
    btn.hidden = false;
    Promise.resolve(window.claude && window.claude.use ? window.claude.use("downloads") : null)
      .then(ns => { if (ns) downloads = ns; })
      .catch(() => {});

    btn.addEventListener("click", () => { menu.hidden = !menu.hidden; });

    menu.addEventListener("click", async e => {
      const choice = e.target.closest("[data-fmt]");
      if (!choice || !downloads) return;
      const { header, rows } = tableData();
      try {
        if (choice.dataset.fmt === "csv") {
          await downloads.save({ filename: "loan-schedule.csv", data: buildCsv(header, rows) });
        } else if (choice.dataset.fmt === "xlsx") {
          await downloads.save({ filename: "loan-schedule.xlsx", data: buildXlsx(header, rows) });
        } else if (choice.dataset.fmt === "pdf") {
          const bytes = await buildPdf(header, rows);
          await downloads.save({ filename: "loan-schedule.pdf", data: bytes });
        }
        menu.hidden = true;
      } catch (err) {
        // Declined or unavailable: keep the menu open so the viewer can try again.
      }
    });
  })();

  // ===== Header: shrink a little after scrolling =====
  (function () {
    const bar = document.querySelector(".topbar");
    if (!bar) return;
    const update = () => bar.classList.toggle("scrolled", window.scrollY > 40);
    window.addEventListener("scroll", update, { passive: true });
    update();
  })();

  // ===== Compare page: two loan options side by side =====
  (function () {
    const area = document.querySelector(".content-area");
    const topbar = document.querySelector(".topbar");
    // The top-bar button was removed; the page is still reachable with #compare
    const navBtn = document.getElementById("compareNavBtn") || document.createElement("button");
    if (!area || !topbar) return;

    const CT = {
      en: { title: "Compare offers", colA: "Option A", colB: "Option B", price: "Price", down: "Down payment",
            term: "Term", rate: "Interest rate", years: "Years", months: "Months", monthly: "Monthly", annual: "Annual",
            flat: "Flat", fixed: "Fixed", useCalc: "Use calculator values", monthlyPay: "Monthly payment",
            loanAmt: "Loan amount", totalInt: "Total interest", totalCost: "Total cost", termMonths: "Months",
            lower: "Lower total cost", equal: "Same total cost", diff: "Difference", back: "Back to calculator" },
      km: { title: "ប្រៀបធៀបការផ្ដល់ជូន", colA: "ជម្រើស A", colB: "ជម្រើស B", price: "តម្លៃ", down: "បង់មុន",
            term: "រយៈពេល", rate: "អត្រាការប្រាក់", years: "ឆ្នាំ", months: "ខែ", monthly: "ប្រចាំខែ", annual: "ប្រចាំឆ្នាំ",
            flat: "Flat", fixed: "Fixed", useCalc: "យកពីម៉ាស៊ីនគណនា", monthlyPay: "ការបង់ក្នុងមួយខែ",
            loanAmt: "ចំនួនកម្ចី", totalInt: "ការប្រាក់សរុប", totalCost: "ការបង់សរុប", termMonths: "ចំនួនខែ",
            lower: "ថោកជាង", equal: "ស្មើគ្នា", diff: "ខុសគ្នា", back: "ត្រឡប់ទៅម៉ាស៊ីនគណនា" }
    };
    const t = k => (CT[currentLanguage] || CT.en)[k];
    const $c = id => document.getElementById(id);

    // Nav button in the top bar
    navBtn.textContent = "⇄";
    navBtn.setAttribute("aria-label", "Compare");
    navBtn.title = "Compare";

    // Compare section
    const page = document.createElement("section");
    page.id = "comparePage";
    page.className = "compare-page";
    page.style.display = "none";
    area.appendChild(page);

    const state = { A: { years: true, annual: false, fixed: false }, B: { years: true, annual: false, fixed: false } };

    function optionHTML(k) {
      return `
        <div class="cmp-col">
          <h3 class="cmp-head" data-ck="col${k}"></h3>
          <label data-ck="price"></label>
          <input class="cmp-in" data-money id="cmp${k}Price" inputmode="decimal" value="0">
          <label data-ck="down"></label>
          <input class="cmp-in" data-money id="cmp${k}Down" inputmode="decimal" value="0">
          <label data-ck="term"></label>
          <div class="cmp-row">
            <input class="cmp-in" id="cmp${k}Term" inputmode="numeric" value="0">
            <div class="cmp-seg" data-group="years" data-k="${k}">
              <button type="button" data-v="1" data-ck="years"></button>
              <button type="button" data-v="0" data-ck="months"></button>
            </div>
          </div>
          <label data-ck="rate"></label>
          <div class="cmp-row">
            <input class="cmp-in" id="cmp${k}Rate" inputmode="decimal" value="0.77">
            <div class="cmp-seg" data-group="annual" data-k="${k}">
              <button type="button" data-v="0" data-ck="monthly"></button>
              <button type="button" data-v="1" data-ck="annual"></button>
            </div>
          </div>
          <label data-ck="loanType"></label>
          <div class="cmp-seg" data-group="fixed" data-k="${k}">
            <button type="button" data-v="0" data-ck="flat">Flat</button>
            <button type="button" data-v="1" data-ck="fixed">Fixed</button>
          </div>
          <button type="button" class="cmp-use" data-k="${k}" data-ck="useCalc"></button>
        </div>`;
    }

    page.innerHTML = `
      <div class="cmp-top">
        <button type="button" class="cmp-back" id="cmpBack">←</button>
        <h2 class="cmp-title" data-ck="title"></h2>
      </div>
      <div class="cmp-grid">${optionHTML("A")}${optionHTML("B")}</div>
      <div class="cmp-results card-like" id="cmpResults"></div>`;

    function readOption(k) {
      const s = state[k];
      const price = Math.max(0, parseFloat(String($c(`cmp${k}Price`).value).replace(/,/g, "")) || 0);
      let down = Math.max(0, parseFloat(String($c(`cmp${k}Down`).value).replace(/,/g, "")) || 0);
      if (down > price) down = price;
      const loan = Math.max(0, price - down);
      const tv = Math.max(0, Math.floor(parseFloat($c(`cmp${k}Term`).value) || 0));
      const months = Math.max(1, s.years ? tv * 12 : tv);
      const raw = parseFloat($c(`cmp${k}Rate`).value) || 0;
      const r = s.annual ? raw / 12 / 100 : raw / 100;
      let payment, interest;
      if (s.fixed) {
        payment = r === 0 ? loan / months : loan * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
        interest = payment * months - loan;
      } else {
        interest = loan * r * months;
        payment = (loan + interest) / months;
      }
      return { price, down, loan, months, payment, interest, cost: down + loan + interest, tv };
    }

    function renderResults() {
      const a = readOption("A"), b = readOption("B");
      const lowerA = a.cost < b.cost, lowerB = b.cost < a.cost;
      const diff = Math.abs(a.cost - b.cost);
      let verdict;
      if (!lowerA && !lowerB) verdict = `<div class="cmp-verdict">${t("equal")}</div>`;
      else verdict = `<div class="cmp-verdict">${lowerA ? t("colA") : t("colB")}: ${t("lower")} · ${t("diff")} $${money2(diff)}</div>`;
      const row = (label, fa, fb, win) => `<tr><th>${label}</th><td class="${win === "A" ? "cmp-win" : ""}">${fa}</td><td class="${win === "B" ? "cmp-win" : ""}">${fb}</td></tr>`;
      const money = v => "$" + money2(v);
      $c("cmpResults").innerHTML = `
        ${verdict}
        <table class="cmp-table">
          <thead><tr><th></th><th>${t("colA")}</th><th>${t("colB")}</th></tr></thead>
          <tbody>
            ${row(t("monthlyPay"), money(a.payment), money(b.payment), a.payment < b.payment ? "A" : b.payment < a.payment ? "B" : null)}
            ${row(t("loanAmt"), money(a.loan), money(b.loan), null)}
            ${row(t("totalInt"), money(a.interest), money(b.interest), a.interest < b.interest ? "A" : b.interest < a.interest ? "B" : null)}
            ${row(t("totalCost"), money(a.cost), money(b.cost), lowerA ? "A" : lowerB ? "B" : null)}
            ${row(t("termMonths"), a.months, b.months, null)}
          </tbody>
        </table>`;
    }

    function money2(n) {
      return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function applyText() {
      page.querySelectorAll("[data-ck]").forEach(el => {
        const key = el.dataset.ck;
        if (key === "colA" || key === "colB") el.textContent = t(key);
        else if (key === "title") el.textContent = t("title");
        else if (key === "loanType") el.textContent = t("loanType") || "Loan type";
        else if (key === "flat") el.textContent = "Flat";
        else if (key === "fixed") el.textContent = "Fixed";
        else if (key && CT[currentLanguage] && CT[currentLanguage][key]) el.textContent = t(key);
      });
      page.querySelectorAll(".cmp-head").forEach(h => h.textContent = h.dataset.ck === "colA" ? t("colA") : t("colB"));
      page.querySelectorAll("label[data-ck]").forEach(l => { l.textContent = t(l.dataset.ck) || l.textContent; });
      // Loan type label is not in CT, so keep it short and bilingual
      page.querySelectorAll('label[data-ck="loanType"]').forEach(l => l.textContent = currentLanguage === "km" ? "ប្រភេទកម្ចី" : "Loan type");
      page.querySelectorAll(".cmp-seg button").forEach(b => {
        const g = b.parentElement.dataset.group;
        if (g === "years") b.textContent = t(b.dataset.v === "1" ? "years" : "months");
        if (g === "annual") b.textContent = t(b.dataset.v === "1" ? "annual" : "monthly");
        if (g === "fixed") b.textContent = b.dataset.v === "1" ? "Fixed" : "Flat";
      });
      page.querySelectorAll(".cmp-use").forEach(b => b.textContent = t("useCalc"));
      $c("cmpBack").title = t("back");
      renderResults();
    }

    function syncSeg() {
      page.querySelectorAll(".cmp-seg").forEach(seg => {
        const k = seg.dataset.k, s = state[k];
        const key = seg.dataset.group === "years" ? "years" : seg.dataset.group === "annual" ? "annual" : "fixed";
        seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", (b.dataset.v === "1") === !!s[key]));
      });
    }

    function copyFromCalc(k) {
      $c(`cmp${k}Price`).value = $c("price").value;
      $c(`cmp${k}Down`).value = $c("downPayment").value;
      $c(`cmp${k}Term`).value = $c("term").value;
      $c(`cmp${k}Rate`).value = $c("interestRate").value;
      state[k] = { years: $c("termYear").checked, annual: $c("annualRate").checked, fixed: $c("fixedLoan").checked };
      syncSeg();
      renderResults();
    }

    // Live updates
    page.addEventListener("input", e => {
      if (e.target.matches("[data-money]") && typeof formatMoneyInput === "function") formatMoneyInput(e.target);
      renderResults();
    });
    page.addEventListener("click", e => {
      const seg = e.target.closest(".cmp-seg button");
      if (seg) {
        const g = seg.parentElement.dataset.group, k = seg.parentElement.dataset.k, v = seg.dataset.v === "1";
        if (g === "years") state[k].years = v;
        if (g === "annual") state[k].annual = v;
        if (g === "fixed") state[k].fixed = v;
        syncSeg(); renderResults(); return;
      }
      const use = e.target.closest(".cmp-use");
      if (use) { copyFromCalc(use.dataset.k); return; }
      if (e.target.closest("#cmpBack")) setView(false);
    });

    // Show / hide the calculator vs. the compare page
    let comparing = false;
    function setView(on) {
      comparing = on;
      Array.from(area.children).forEach(el => {
        if (el === topbar || el === page) return;
        el.style.display = on ? "none" : "";
      });
      page.style.display = on ? "" : "none";
      navBtn.classList.toggle("on", on);
      window.scrollTo(0, 0);
      if (on) { applyText(); syncSeg(); }
      try { history.replaceState(null, "", on ? "#compare" : location.pathname + location.search); } catch (e) {}
    }

    navBtn.addEventListener("click", () => setView(!comparing));
    window.addEventListener("hashchange", () => setView(location.hash === "#compare"));

    // Initial state from the calculator, then keep the language text current
    copyFromCalc("A");
    state.B = { ...state.A };
    copyFromCalc("B");
    new MutationObserver(() => { if (comparing) applyText(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    if (location.hash === "#compare") setView(true);
  })();

  // ===== Term presets: 5, 6, 7 years =====
  (function () {
    const btns = document.querySelectorAll(".term-preset");
    const termInput = document.getElementById("term");
    const yearRadio = document.getElementById("termYear");
    const monthRadio = document.getElementById("termMonth");
    if (!btns.length || !termInput || !yearRadio || !monthRadio) return;

    const refresh = () => {
      const km = currentLanguage === "km";
      btns.forEach(b => {
        const y = Number(b.dataset.years);
        b.textContent = km ? `${y} ឆ្នាំ` : `${y} years`;
        b.classList.toggle("active", yearRadio.checked && Number(termInput.value) === y);
      });
    };

    btns.forEach(b => b.addEventListener("click", () => {
      yearRadio.checked = true;
      monthRadio.checked = false;
      termInput.value = b.dataset.years;
      termInput.dispatchEvent(new Event("input", { bubbles: true }));
      yearRadio.dispatchEvent(new Event("change", { bubbles: true }));
      refresh();
    }));
    termInput.addEventListener("input", refresh);
    yearRadio.addEventListener("change", refresh);
    monthRadio.addEventListener("change", refresh);
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    refresh();
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
