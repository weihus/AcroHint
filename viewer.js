/**
 * Acronym Highlighter for arXiv — viewer.js v1.0
 * 修复：
 * 1. 消除 "Models", "Steps" 等普通单词的误匹配 (严格大小写特征过滤)
 * 2. 修复 PDF 多页渲染重叠、错位与模糊问题 (强制容器定位与标准 HiDPI 缩放)
 */

(async () => {
  "use strict";

  const urlParams = new URLSearchParams(window.location.search);
  const fileUrl = urlParams.get('file');
  if (!fileUrl) return;

  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.js';
  const container = document.getElementById('viewer');

  const HIGHLIGHT_CLASS = "paper-acronym-highlight";
  const TOOLTIP_ID      = "paper-acronym-tooltip";
  const SIDEBAR_HOST_ID = "paper-acronym-sidebar-host";
  
  const acronymMap = new Map(); 

  // --- 正则引擎组 (放宽捕获，通过 JS 进行严格二次过滤) ---
  const PATTERNS = {
    PARENS: /((?:[A-Z][\w'-]*(?:\s+[a-z]{1,4})?(?:\s+[A-Za-z][\w'-]*){0,12}))\s+\(([A-Za-z0-9\-]{2,10})\)/g,
    COLON: /\b([A-Z][A-Za-z0-9\-]{1,10})\s*[:：]\s*((?:[A-Z][\w'-]*(?:\s+[\w'-]*){0,14}))/g,
    MIXED: /\b[\w\s]+\(([A-Z][A-Z0-9\-]{1,5})\)\s*[:：]\s*((?:[A-Z][\w'-]*(?:\s+[\w'-]*){0,14}))/g
  };

  // --- 样式注入 (修复排版的核心) ---
  const style = document.createElement('style');
  style.textContent = `
    /* 强制重置 viewer 内部排版，防止外部样式污染 */
    #viewer { display: flex; flex-direction: column; align-items: center; background: #525659; padding: 20px 0; }
    
    .page-container {
      position: relative !important; /* 极其重要：锁死内部元素的绝对定位基准 */
      margin-bottom: 20px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      background-color: white;
    }
    
    .textLayer {
      position: absolute !important;
      left: 0; top: 0; right: 0; bottom: 0;
      overflow: hidden;
      line-height: 1.0;
    }

    .textLayer > span { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; }
    .textLayer br { display: none; }

    .textLayer .${HIGHLIGHT_CLASS} {
      border-bottom: 2px dashed #4285F4;
      background-color: rgba(66, 133, 244, 0.1);
      color: transparent; cursor: help; pointer-events: auto;
    }
    
    #${TOOLTIP_ID} {
      position: absolute; z-index: 2147483647; display: none; pointer-events: none;
      padding: 8px 12px; border-radius: 8px; background: #1e2330; color: #e8eaf0;
      font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: sans-serif;
    }
    .tip-acronym { font-weight: bold; color: #81b4ff; }
  `;
  document.head.appendChild(style);

  // --- 【新增】严格的缩写验证器 ---
  function isValidAcronym(word) {
    if (!word || word.length < 2) return false;
    const upperCount = (word.match(/[A-Z]/g) || []).length;
    const digitCount = (word.match(/[0-9]/g) || []).length;
    
    // 必须满足：至少2个大写字母 (如 MLLMs) OR 1个大写字母+至少1个数字 (如 C1)
    // 直接秒杀 "Models", "Steps", "Node" 等普通单词
    return upperCount >= 2 || (upperCount === 1 && digitCount >= 1);
  }

  // --- NLP 清理算法 ---
  function cleanDefinition(rawText, acronym) {
    const words = rawText.trim().split(/\s+/);
    const acr = acronym.replace(/[^A-Za-z]/g, '').toLowerCase();
    if (!acr) return rawText;

    const firstAcrChar = acr[0];
    let bestStart = 0;
    for (let i = 0; i < words.length; i++) {
      const wordInitial = words[i].replace(/^[^A-Za-z]+/, '').charAt(0).toLowerCase();
      if (wordInitial === firstAcrChar && (words.length - i) <= acr.length + 3) {
        bestStart = i; break;
      }
    }
    return words.slice(bestStart).join(' ');
  }

  // --- PDF 加载与提取 ---
  try {
    const pdf = await pdfjsLib.getDocument(fileUrl).promise;
    
    // 全文预扫描
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(" ");
      extractFromText(text, i);
    }

    // 逐页渲染
    for (let i = 1; i <= pdf.numPages; i++) {
      await renderPage(pdf, i);
    }

    if (acronymMap.size > 0) {
      setupTooltip();
      initSidebar();
    }
  } catch (err) { console.error(err); }

  function extractFromText(text, pageNum) {
    let m;
    while ((m = PATTERNS.PARENS.exec(text)) !== null) {
      const acr = m[2];
      if (!isValidAcronym(acr)) continue; // 应用严格过滤
      const full = cleanDefinition(m[1], acr);
      if (!acronymMap.has(acr)) acronymMap.set(acr, { fullName: full, anchor: null, pageNum });
    }
    
    PATTERNS.COLON.lastIndex = 0;
    while ((m = PATTERNS.COLON.exec(text)) !== null) {
      const acr = m[1], full = m[2].trim();
      if (!isValidAcronym(acr)) continue; // 应用严格过滤
      if (!acronymMap.has(acr)) acronymMap.set(acr, { fullName: full, anchor: null, pageNum });
    }
    
    PATTERNS.MIXED.lastIndex = 0;
    while ((m = PATTERNS.MIXED.exec(text)) !== null) {
      const acr = m[1], full = m[2].trim();
      if (!isValidAcronym(acr)) continue; // 应用严格过滤
      if (!acronymMap.has(acr)) acronymMap.set(acr, { fullName: full, anchor: null, pageNum });
    }
  }

  // --- 【修复】稳健的 PDF 渲染逻辑 ---
  async function renderPage(pdf, pageNum) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const outputScale = window.devicePixelRatio || 1;

    // 1. 绝对稳定的容器
    const wrapper = document.createElement('div');
    wrapper.className = 'page-container';
    wrapper.id = `page-${pageNum}`;
    // 强制规定 CSS 宽高，配合 relative
    wrapper.style.width = `${viewport.width}px`;
    wrapper.style.height = `${viewport.height}px`;
    wrapper.style.setProperty('--scale-factor', viewport.scale);
    container.appendChild(wrapper);

    // 2. HiDPI Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    wrapper.appendChild(canvas);
    
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
    await page.render({ canvasContext: ctx, transform, viewport }).promise;

    // 3. 文本层对齐
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    wrapper.appendChild(textLayerDiv);
    
    const textContent = await page.getTextContent();
    await pdfjsLib.renderTextLayer({ textContentSource: textContent, container: textLayerDiv, viewport, textDivs: [] }).promise;

    highlightTextLayer(textLayerDiv, pageNum);
  }

  function highlightTextLayer(div, pageNum) {
    const keys = [...acronymMap.keys()].sort((a, b) => b.length - a.length);
    if (!keys.length) return;
    
    // 生成正则，避开普通字母包围
    const re = new RegExp(`(?<![A-Za-z])(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z])`, "g");

    div.querySelectorAll('span').forEach(span => {
      const txt = span.textContent;
      if (re.test(txt)) {
        re.lastIndex = 0;
        span.innerHTML = txt.replace(re, (m) => {
          const data = acronymMap.get(m);
          if (data && !data.anchor) data.anchor = span; 
          return `<span class="${HIGHLIGHT_CLASS}" data-full-name="${data?.fullName || ''}">${m}</span>`;
        });
      }
    });
  }

  // --- 侧边栏与悬浮窗 ---
  function initSidebar() {
    const host = document.createElement('div');
    host.id = SIDEBAR_HOST_ID;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const sidebarStyle = document.createElement('style');
    sidebarStyle.textContent = `
      #fab { position: fixed; right: 20px; bottom: 20px; width: 45px; height: 45px; background: #4285F4; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2); font-weight: bold; font-size: 16px; }
      #drawer { position: fixed; right: -320px; top: 0; width: 300px; height: 100vh; background: white; transition: 0.3s; z-index: 10001; display: flex; flex-direction: column; box-shadow: -2px 0 10px rgba(0,0,0,0.1); font-family: sans-serif; }
      #drawer.open { right: 0; }
      .header { padding: 15px; background: #f1f3f4; font-weight: bold; display: flex; justify-content: space-between;}
      .close-btn { cursor: pointer; color: #555; }
      .item { padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; }
      .item:hover { background: #f8f9fa; }
      .acr { font-weight: bold; color: #1a73e8; }
      .full { font-size: 12px; color: #666; margin-top: 4px; }
      #list { flex: 1; overflow-y: auto; }
    `;
    shadow.appendChild(sidebarStyle);

    const drawer = document.createElement('div');
    drawer.id = "drawer";
    drawer.innerHTML = `<div class="header"><span>Acronyms (${acronymMap.size})</span><span class="close-btn">&times;</span></div><div id="list"></div>`;
    
    const fab = document.createElement('div');
    fab.id = "fab"; fab.textContent = "A";
    
    const toggle = () => drawer.classList.toggle('open');
    fab.onclick = toggle;
    drawer.querySelector('.close-btn').onclick = toggle;

    const list = drawer.querySelector('#list');
    [...acronymMap.entries()].sort((a,b) => a[0].localeCompare(b[0])).forEach(([acr, data]) => {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `<div class="acr">${acr}</div><div class="full">${data.fullName}</div>`;
      el.onclick = () => {
        const target = document.getElementById(`page-${data.pageNum}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          toggle(); // 自动关闭侧边栏
        }
      };
      list.appendChild(el);
    });

    shadow.appendChild(fab);
    shadow.appendChild(drawer);
  }

  function setupTooltip() {
    let tip = document.createElement("div");
    tip.id = TOOLTIP_ID;
    document.body.appendChild(tip);

    document.addEventListener("mouseover", (e) => {
      if (e.target.classList.contains(HIGHLIGHT_CLASS)) {
        const acr = e.target.textContent;
        const full = e.target.dataset.fullName || "";
        tip.innerHTML = `<span class="tip-acronym">${acr}</span><span style="color:#555e7a;margin:0 5px;">→</span><span>${full}</span>`;
        tip.style.display = "block";
        const rect = e.target.getBoundingClientRect();
        tip.style.left = `${Math.max(10, rect.left)}px`;
        tip.style.top  = `${Math.max(10, rect.top - tip.offsetHeight - 5 + window.scrollY)}px`;
      }
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.classList.contains(HIGHLIGHT_CLASS)) tip.style.display = "none";
    });
  }
})();