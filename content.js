/**
 * Acronym Highlighter for arXiv — content.js v1.0 (NLP Precision Update)
 * Features: 
 * 1. Smart acronym extraction (Plurals, mixed-case)
 * 2. Precise boundaries via Initial Matching Algorithm (Fixes "we design X" bug)
 * 3. Inline blue dashed highlights + Dark Tooltips (DOM)
 * 4. Global Sidebar + Smooth Anchor Scrolling (Shadow DOM)
 */

(() => {
  "use strict";

  /* ─── 配置与状态 ─────────────────────────────────────────────── */
  const HIGHLIGHT_CLASS = "paper-acronym-highlight";
  const TOOLTIP_ID      = "paper-acronym-tooltip";
  const SIDEBAR_HOST_ID = "paper-acronym-sidebar-host";

  const acronymMap = new Map(); 

  // 正则：放宽前置词的抓取范围，真正的精准裁切交给 cleanFullName 函数处理
  const DEFINITION_RE = /\b((?:[A-Za-z][\w'-]*(?:\s+[a-z]{1,4})?(?:\s+[A-Za-z][\w'-]*){0,14}))\s+\(([A-Za-z0-9\-]{2,10})\)/g;

  /* ─── 样式表常量 ─────────────────────────────────────────────── */
  const MAIN_PAGE_CSS = `
    .${HIGHLIGHT_CLASS} {
      border-bottom: 1.5px dashed #4285F4; cursor: help; color: inherit; text-decoration: none;
      position: relative; transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .${HIGHLIGHT_CLASS}:hover { border-bottom-color: #1a73e8; background-color: rgba(66, 133, 244, 0.08); border-radius: 2px; }
    #${TOOLTIP_ID} {
      position: absolute; z-index: 2147483647; display: none; pointer-events: none;
      max-width: 360px; padding: 7px 12px; border-radius: 8px; background: #1e2330; color: #e8eaf0;
      border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), 0 1px 4px rgba(0, 0, 0, 0.25);
      font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 13px;
      line-height: 1.5; letter-spacing: 0.01em; animation: acronym-tip-in 0.12s ease both;
    }
    @keyframes acronym-tip-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    #${TOOLTIP_ID}::after {
      content: ""; position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%);
      width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #1e2330; pointer-events: none;
    }
    #${TOOLTIP_ID} .tip-acronym { font-weight: 700; color: #81b4ff; margin-right: 2px; font-size: 13px; letter-spacing: 0.04em; }
    #${TOOLTIP_ID} .tip-sep { color: #555e7a; margin: 0 5px; font-size: 11px; vertical-align: middle; }
    #${TOOLTIP_ID} .tip-full { color: #c9d1e0; font-size: 13px; }
  `;

  const SIDEBAR_CSS = `
    #fab {
      position: fixed; right: 24px; bottom: 24px; width: 48px; height: 48px;
      background: #4285F4; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 18px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 999999;
      transition: transform 0.2s, background 0.2s;
    }
    #fab:hover { transform: scale(1.08); background: #3367d6; }
    #sidebar {
      position: fixed; right: -350px; top: 0; width: 320px; height: 100vh;
      background: #ffffff; box-shadow: -4px 0 12px rgba(0,0,0,0.1); z-index: 1000000;
      transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; font-family: system-ui, -apple-system, sans-serif;
    }
    #sidebar.open { right: 0; }
    .header { padding: 20px; border-bottom: 1px solid #eee; background: #f8f9fa; }
    h3 { margin: 0 0 12px 0; color: #202124; font-size: 16px; display: flex; justify-content: space-between; align-items: center; }
    .close-btn { cursor: pointer; color: #5f6368; font-size: 20px; line-height: 1; padding: 0 4px; }
    .close-btn:hover { color: #202124; }
    #search { width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 6px; box-sizing: border-box; font-size: 14px; outline: none; transition: border 0.2s; }
    #search:focus { border-color: #4285F4; }
    #list-container { flex: 1; overflow-y: auto; padding: 8px; }
    .acr-item { padding: 12px; border-radius: 8px; cursor: pointer; transition: background 0.2s; border-bottom: 1px solid transparent; margin-bottom: 4px; }
    .acr-item:hover { background: #e8f0fe; }
    .acr-name { font-weight: 600; color: #1a73e8; margin-bottom: 4px; font-size: 14px; }
    .acr-full { font-size: 13px; color: #5f6368; line-height: 1.4; }
    #overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.3); visibility: hidden; opacity: 0;
      transition: opacity 0.3s; z-index: 999998; backdrop-filter: blur(2px);
    }
    #overlay.visible { visibility: visible; opacity: 1; }
    .empty { padding: 30px 20px; text-align: center; color: #80868b; font-size: 14px; }
  `;

  /* ─── 核心逻辑：高精度首字母匹配算法 ───────────────────────────── */

  function cleanFullName(rawText, acronym) {
    const words = rawText.trim().split(/\s+/);
    const acrChars = acronym.replace(/[^A-Za-z]/g, '').toLowerCase();
    if (!acrChars) return rawText.trim();
    
    const firstChar = acrChars.charAt(0);
    let bestStart = 0;
    let maxScore = -1;

    for (let i = 0; i < words.length; i++) {
        let wordInitial = words[i].replace(/^[^A-Za-z]+/, '').charAt(0).toLowerCase();
        
        // 过滤掉距离过远的起点（排除掉 we design 这种不相干的词）
        if (wordInitial === firstChar && (words.length - i) <= acrChars.length * 2 + 3) {
            let candidateWords = words.slice(i);
            // 拆解可能带有连字符的单词 (e.g. Spatio-Temporal-Spectral)
            let subWords = candidateWords.join(' ').split(/[\s\-]+/);
            
            let score = 0;
            let acrIndex = 0;
            
            for (let j = 0; j < subWords.length; j++) {
                let initial = subWords[j].replace(/^[^A-Za-z]+/, '').charAt(0).toLowerCase();
                let foundIndex = acrChars.indexOf(initial, acrIndex);
                
                // 允许容错跳过缩写中的个别字母
                if (foundIndex !== -1 && foundIndex <= acrIndex + 2) {
                    score++;
                    acrIndex = foundIndex + 1;
                }
            }
            
            // 记录匹配度最高的词组边界
            if (score > maxScore) {
                maxScore = score;
                bestStart = i;
            }
        }
    }
    return words.slice(bestStart).join(' ');
  }

  /* ─── 核心逻辑：提取与高亮 ──────────────────────────────────── */

  function injectMainCSS() {
    if (document.getElementById('acronym-main-css')) return;
    const style = document.createElement('style');
    style.id = 'acronym-main-css';
    style.textContent = MAIN_PAGE_CSS;
    document.head.appendChild(style);
  }

  function extractAcronyms(root) {
    const BLOCK_SEL = "p, li, td, th, blockquote, .ltx_para, .abstract, abstract, h1, h2, h3, h4, h5, h6";
    const blocks = root.querySelectorAll(BLOCK_SEL);
    
    blocks.forEach(el => {
      const text = el.innerText || "";
      DEFINITION_RE.lastIndex = 0;
      let m;
      while ((m = DEFINITION_RE.exec(text)) !== null) {
        let rawFull = m[1];
        let acr  = m[2];
        if (!/[A-Z]/.test(acr)) continue;

        // 使用 NLP 算法清洗无关前缀
        let full = cleanFullName(rawFull, acr);

        if (!acronymMap.has(acr)) {
          acronymMap.set(acr, { fullName: full, anchor: null });
          if (acr.endsWith('s') && acr.length > 2) {
            const base = acr.slice(0, -1);
            if (!acronymMap.has(base)) acronymMap.set(base, { fullName: full, anchor: null });
          }
        }
      }
    });
  }

  function injectHighlights(root) {
    if (!acronymMap.size) return;
    const keys = [...acronymMap.keys()].sort((a, b) => b.length - a.length);
    const esc  = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re   = new RegExp(`(?<![A-Za-z])(${esc.join("|")})(?![A-Za-z])`, "g");
    
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let tn;
    while ((tn = walker.nextNode())) {
      if (tn.parentElement && (tn.parentElement.classList.contains(HIGHLIGHT_CLASS) || tn.parentElement.closest('script, style, math'))) continue;
      
      const text = tn.nodeValue;
      if (!re.test(text)) continue;
      re.lastIndex = 0;

      const frags = [];
      let last = 0, m;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) frags.push(document.createTextNode(text.slice(last, m.index)));
        
        const span = document.createElement("span");
        span.className = HIGHLIGHT_CLASS;
        span.textContent = m[1];
        span.dataset.fullName = acronymMap.get(m[1])?.fullName || "";
        
        if (!acronymMap.get(m[1]).anchor) {
          acronymMap.get(m[1]).anchor = span;
        }
        
        frags.push(span);
        last = m.index + m[0].length;
      }
      if (last < text.length) frags.push(document.createTextNode(text.slice(last)));

      const df = document.createDocumentFragment();
      frags.forEach(f => df.appendChild(f));
      tn.parentNode.replaceChild(df, tn);
    }
  }

  /* ─── 交互逻辑：文内悬浮窗 Tooltip ───────────────────────────── */

  let tooltipTimer = null;

  function ensureTooltip() {
    let tip = document.getElementById(TOOLTIP_ID);
    if (tip) return tip;
    tip = document.createElement("div");
    tip.id = TOOLTIP_ID;
    tip.setAttribute("role", "tooltip");
    tip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tip);
    return tip;
  }

  function setupTooltip() {
    const tip = ensureTooltip();

    function showTip(target) {
      const acronym  = target.textContent;
      const fullName = target.dataset.fullName || "";

      tip.innerHTML = `<span class="tip-acronym">${acronym}</span><span class="tip-sep">→</span><span class="tip-full">${fullName}</span>`;
      tip.style.visibility = "hidden"; tip.style.display = "block"; tip.removeAttribute("aria-hidden");

      const tw = tip.offsetWidth, th = tip.offsetHeight, vw = window.innerWidth, MARGIN = 10;
      const rect = target.getBoundingClientRect();

      let left = rect.left + rect.width / 2 - tw / 2;
      let top  = rect.top  - th - MARGIN + window.scrollY;

      if (left < MARGIN) left = MARGIN;
      if (left + tw > vw - MARGIN) left = vw - tw - MARGIN;
      if (rect.top - th - MARGIN < 0) top = rect.bottom + MARGIN + window.scrollY;

      tip.style.left = `${left}px`; tip.style.top = `${top}px`; tip.style.visibility = "visible";
    }

    function hideTip() {
      clearTimeout(tooltipTimer);
      tip.style.display = "none"; tip.setAttribute("aria-hidden", "true");
    }

    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest && e.target.closest(`.${HIGHLIGHT_CLASS}`);
      if (!el) return;
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(() => showTip(el), 200);
    });

    document.addEventListener("mouseout", (e) => {
      const el = e.target.closest && e.target.closest(`.${HIGHLIGHT_CLASS}`);
      if (!el) return;
      hideTip();
    });

    window.addEventListener("scroll", hideTip, { passive: true });
  }

  /* ─── 交互逻辑：全局侧边栏 Sidebar (Shadow DOM) ──────────────── */

  let shadowRoot;
  let isSidebarOpen = false;

  function initSidebar() {
    if (document.getElementById(SIDEBAR_HOST_ID) || !acronymMap.size) return;

    const host = document.createElement('div');
    host.id = SIDEBAR_HOST_ID;
    document.body.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = SIDEBAR_CSS;
    shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.innerHTML = `
      <div id="fab" title="View Acronyms (${acronymMap.size})">A</div>
      <div id="sidebar">
        <div class="header">
          <h3>Acronyms List <span class="close-btn" title="Close">&times;</span></h3>
          <input type="text" id="search" placeholder="Filter acronyms or names...">
        </div>
        <div id="list-container"></div>
      </div>
      <div id="overlay"></div>
    `;
    shadowRoot.appendChild(container);

    const fab = shadowRoot.getElementById('fab');
    const overlay = shadowRoot.getElementById('overlay');
    const closeBtn = shadowRoot.querySelector('.close-btn');
    const search = shadowRoot.getElementById('search');

    fab.onclick = toggleSidebar;
    overlay.onclick = toggleSidebar;
    closeBtn.onclick = toggleSidebar;
    search.oninput = (e) => renderList(e.target.value);
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    const sidebar = shadowRoot.getElementById('sidebar');
    const overlay = shadowRoot.getElementById('overlay');
    
    sidebar.classList.toggle('open', isSidebarOpen);
    overlay.classList.toggle('visible', isSidebarOpen);
    
    if (isSidebarOpen) {
      const searchInput = shadowRoot.getElementById('search');
      renderList(searchInput.value);
      setTimeout(() => searchInput.focus(), 300);
    }
  }

  function renderList(filter = "") {
    const listContainer = shadowRoot.getElementById('list-container');
    listContainer.innerHTML = "";

    const filtered = [...acronymMap.entries()]
      .filter(([acr, data]) => acr.toLowerCase().includes(filter.toLowerCase()) || data.fullName.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="empty">No matches found.</div>`;
      return;
    }

    filtered.forEach(([acr, data]) => {
      const item = document.createElement('div');
      item.className = 'acr-item';
      item.innerHTML = `<div class="acr-name">${acr}</div><div class="acr-full">${data.fullName}</div>`;
      item.onclick = () => {
        if (data.anchor) {
          data.anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
          data.anchor.style.transition = "background-color 0.3s";
          data.anchor.style.backgroundColor = "#fff59d";
          setTimeout(() => { data.anchor.style.backgroundColor = ""; }, 1500);
          toggleSidebar();
        }
      };
      listContainer.appendChild(item);
    });
  }

  /* ─── 启动与防抖监听 ──────────────────────────────────────────── */

  function run() {
    if (document.contentType === "application/pdf" || document.querySelector("embed[type='application/pdf']")) return;
    
    injectMainCSS();
    extractAcronyms(document.body);
    injectHighlights(document.body);
    
    if (acronymMap.size > 0) {
      setupTooltip();
      initSidebar();
    }
  }

  function init() {
    run();
    let timer;
    const observer = new MutationObserver((mutations) => {
      const added = mutations.some(m => m.addedNodes.length > 0);
      if (added) {
        clearTimeout(timer);
        timer = setTimeout(run, 1000);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();