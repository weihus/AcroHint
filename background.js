// background.js

chrome.runtime.onInstalled.addListener(() => {
  const extensionId = chrome.runtime.id;
  
  // 注册动态规则
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1], // 移除旧规则
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            // 使用当前扩展的真实 ID 构建目标 URL
            // \\0 代表匹配到的原始 URL
            regexSubstitution: `chrome-extension://${extensionId}/viewer.html?file=\\0`
          }
        },
        condition: {
          // 匹配本地 file 协议和在线 https 协议的 pdf
          regexFilter: "^(file|https?)://.*\\.pdf$",
          resourceTypes: ["main_frame"]
        }
      }
    ]
  });
  
  console.log("PDF 重定向规则已动态注册。");
});