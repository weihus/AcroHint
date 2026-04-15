# AcroHint: Acronym Highlighter for Academic Papers

[English](#english-version) | [中文版](#chinese-version)

---

<a id="english-version"></a>
## 🇬🇧 English Version

**AcroHint** is a powerful Chrome extension designed for academic researchers. It automatically extracts, highlights, and tracks acronyms in academic papers (e.g., on arXiv). 

No more scrolling back and forth to find what an acronym stands for. Just hover over it to see the definition, or use the global sidebar to navigate through all acronyms in the paper.

### ✨ Features
* **Smart Highlighting**: Adds subtle blue dashed underlines to acronyms in the text.
* **Dark-Mode Tooltip**: Hover over any highlighted acronym to instantly view its full definition.
* **Global Sidebar**: Click the floating "A" button to view an alphabetical list of all acronyms. Click any item to smoothly scroll to its first definition in the text.
* **Advanced NLP Extraction**: Uses a custom Schwartz-Hearst style algorithm to precisely match full names and acronyms, avoiding noise words.

### ✅ Supported Scenarios
The extraction engine supports multiple academic writing conventions:
1.  **Standard Parentheses**: `Federated Learning (FL)`
2.  **Header Definitions**: `FedDCL: Federated Diffusion-enhanced Contrastive Learning`
3.  **Mixed/Structured**: `Challenge 1 (C1): Pseudo-Label Noise and Bias`
4.  **Smart Plurals**: Automatically infers `MLLMs` from `MLLM` and vice versa.

### 📄 Supported Formats & Sites
* **HTML Papers**: Native support for `arxiv.org/html/*`, `ar5iv.org`, and other HTML-based academic platforms.
* **PDF Papers (Local & Online)**: Built-in custom PDF viewer using Mozilla's `PDF.js` to support interactive text layers.

### ❓ FAQ: Why doesn't it work directly on Chrome's native PDF viewer?
You might notice that AcroHint redirects PDF links to its own custom viewer (`viewer.html`). This is a technical necessity. 
Chrome's native PDF viewer is a closed, sandboxed WebAssembly/C++ plugin (PDFium). It does not expose a standard HTML DOM. Therefore, Chrome extensions cannot inject `<span>` tags, manipulate CSS, or attach hover events to the text inside the native viewer. To provide interactive highlights, AcroHint intercepts `.pdf` requests and renders them using `PDF.js`, giving us full control over the transparent Text Layer.

### 🚀 Installation (Developer Mode)
1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the folder containing this extension.
5. **CRITICAL FOR LOCAL PDFs**: Find AcroHint in the extension list, click **Details**, and toggle on **Allow access to file URLs**. Without this, the extension cannot render PDFs stored on your hard drive.

---

<a id="chinese-version"></a>
## 🇨🇳 中文版

**AcroHint** 是一款专为学术研究人员设计的 Chrome 浏览器插件。它能够自动提取、高亮并追踪学术论文（如 arXiv）中的所有缩写词。

彻底告别在论文前后翻找缩写定义的痛苦。只需将鼠标悬停在缩写上即可查看全称，或使用全局侧边栏快速浏览并跳转到对应的定义位置。

### ✨ 核心功能
* **无感高亮**：在正文缩写下方添加柔和的蓝色虚线下划线。
* **暗色悬浮窗 (Tooltip)**：鼠标悬停即可瞬间查看完整定义，不打断阅读流。
* **全局侧边栏 (Sidebar)**：点击右下角悬浮按钮，按字母顺序查看文中所有缩写。点击列表项可平滑滚动至该缩写在文中的首次定义位置。
* **高精度 NLP 提取**：采用定制的首字母对齐算法，精准剔除定义前的“噪音”词汇。

### ✅ 支持的提取场景
算法完美适配多种学术写作习惯：
1.  **标准括号型**：`Federated Learning (FL)`
2.  **标题定义型**：`FedDCL: Federated Diffusion-enhanced Contrastive Learning`
3.  **混合结构型**：`Challenge 1 (C1): Pseudo-Label Noise and Bias`
4.  **智能复数推断**：自动识别并关联 `MLLM` 与 `MLLMs`。

### 📄 支持的格式与网站
* **HTML 格式论文**：原生支持 `arxiv.org/html/*`、`ar5iv.org` 等学术站点。
* **PDF 格式论文（本地与在线）**：内置基于 `PDF.js` 的独立阅读器，完美支持透明文字层的交互与高亮。

### ❓ 常见问题：为什么不支持 Chrome 原生 PDF 阅读器？
当你打开 PDF 时，AcroHint 会将页面重定向到插件自带的阅读器（`viewer.html`）。这是一个技术上的必然选择。
Chrome 原生的 PDF 阅读器是一个封闭的沙盒环境（基于 WebAssembly/C++ 的 PDFium），它没有暴露出标准的 HTML DOM 树。因此，普通的 Chrome 插件无法在原生阅读器中插入 `<span>` 标签或绑定鼠标悬停事件。为了实现交互式的高亮功能，AcroHint 必须拦截 `.pdf` 请求，并使用 Mozilla 的 `PDF.js` 重新渲染，从而让我们完全掌控用于文字选中的透明交互层 (Text Layer)。

### 🚀 安装指南（开发者模式）
1. 下载或 Clone 本仓库代码。
2. 打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/`。
3. 打开右上角的 **开发者模式** 开关。
4. 点击左上角的 **加载已解压的扩展程序**，选择本插件所在的文件夹。
5. **【本地 PDF 必看】**：在扩展列表中找到 AcroHint，点击 **详细信息**，向下滚动并打开 **允许访问文件网址** 开关。如果不开启此项，插件将由于 Chrome 的安全限制而无法加载你本地硬盘上的 PDF 文件。