// Opens the recorder page, or focuses it if it is already open. No permissions needed.
const PAGE = chrome.runtime.getURL('app/index.html');

async function openRecorder() {
  try {
    const [ctx] = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [PAGE] });
    if (ctx && ctx.tabId >= 0) {
      await chrome.tabs.update(ctx.tabId, { active: true });
      if (ctx.windowId >= 0) await chrome.windows.update(ctx.windowId, { focused: true });
      return;
    }
  } catch { /* getContexts needs Chrome 116; fall through */ }
  await chrome.tabs.create({ url: PAGE });
}

chrome.action.onClicked.addListener(openRecorder);
chrome.runtime.onInstalled.addListener((d) => { if (d.reason === 'install') openRecorder(); });
