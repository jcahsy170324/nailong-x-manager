## v0.3.0 更新：双视图人工核实

Dashboard 的「账号名单与人工核实」支持「列表模式 / 逐个核实」切换。逐个模式支持上一个、下一个、打开 X 主页、已手动取关、保留、跳过、重置，以及处理进度和自动下一位。两种模式共用 `storage.local` 中的 `reviews`，无需重新采集。先筛选「疑似未回关（无标识）」再进入逐个模式更方便。操作只标记本地处理记录，**不会在 X 自动取关**。建议升级前备份 JSON。

# NaiLong X Manager v0.2.0 — 快速互关分析

**本版默认只需要采集 Following**：页面显示 `Follows you` 的账号标记为「页面标记互关」，没有该标识的标记为「疑似未回关（需核实）」。采集 Followers 是可选的双向名单比对，不是快速模式的前置条件。

## 从 v0.1.0 升级

在 `chrome://extensions` 找到 NaiLong X Manager，点击「重新加载」，然后刷新 X 页面。保持扩展 ID 不变（通常在原目录覆盖文件），原 `chrome.storage.local` 数据会继续保留。**升级前务必在旧版面板点击「备份 JSON」**。不要删除旧扩展后重新安装，否则可能丢失数据。

## 使用

1. 打开 `https://x.com/你的用户名/following`。
2. 点击扩展图标 →「开始采集」，手动缓慢滚动。无需 F12。
3. 点击「暂停」，打开管理面板，选择「疑似未回关（无标识）」筛选。
4. 点击账号主页人工核实，手动取关后标记处理结果。
5. 导出 CSV 或备份 JSON。

## 准确性与安全

- 没有 `Follows you` 不代表确定未回关：可能是标签延迟、语言或页面结构变化。
- 页面动态加载可能漏掉账号；数据不是完整性保证。
- 不自动点击关注/取关，不访问私有接口，不上传用户数据。
- 不会在 Console 中持续输出表格；每 2.5 秒低频采集已加载账号。

---

# NaiLong X Manager (MVP)

Chrome Manifest V3 extension. Local-first X account-list collection and manual review.

## Install (Windows / Chrome)

1. Unzip the package.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**, select the extracted `nailong-x-manager` folder containing `manifest.json`.
5. Open your X profile's `/following` page, click the extension icon, then **Start**.
6. Slowly scroll the list; the extension samples visible cards every 2.5 seconds and saves them locally.
7. Click **Pause** when finished. Repeat on `/followers` if you want to compare both lists.
8. Open the dashboard to inspect, manually review, and export CSV.

## Important limitations

- Only visible/loaded DOM user cards are collected. There is **no automatic scrolling** and no X API access. The list is not guaranteed complete.
- A user not present in the collected followers list is **unmatched**, not necessarily an unfollower. Only trust the set difference when both lists are demonstrably complete.
- Usernames are used as keys. A username change may cause mismatches; a future version should use stable IDs where legitimately available.
- UI text such as "Follows you" may change with localization and is not authoritative.
- No automatic unfollowing. Each action is manually performed on X. Dashboard buttons merely record your review status.
- Data remains in `chrome.storage.local`; export JSON backups regularly. Do not share backups publicly.
- Only use on accounts you own or are authorized to manage; respect X terms and rate limits.

## Architecture

- `content.js`: low-frequency DOM collection on X follower/following pages.
- `background.js`: validates and persists batches to `chrome.storage.local`.
- `popup.html/js`: start/stop collection for the current X tab.
- `dashboard.html/js`: list comparisons, manual review states, CSV import/export, JSON backup, snapshots.

No build step, external dependencies, credentials, or server needed.

## GitHub / open-source information

**License:** MIT (see `LICENSE`). **Status:** experimental MVP, not independently tested on all X layouts/locales.

### Features

- Collect loaded `/following` and `/followers` cards while you manually scroll.
- Store records in Chrome local extension storage.
- Compare captured lists; distinguish unmatched records from confirmed non-followers.
- Import CSV, export CSV, backup/restore JSON, and save snapshots.
- Open profiles and track *manual* review/unfollow decisions.

### Privacy

No backend, analytics service, account credentials, or paid X API is used. Data stays in local Chrome extension storage unless you explicitly export it. **Do not commit exported account data to GitHub.**

### Known issues / roadmap

- DOM selectors and localized labels can break after X UI updates.
- Captured lists can be incomplete; no completeness guarantee or automatic pagination.
- Usernames are not stable IDs; handle account renames cautiously.
- Future work: capture completeness checks, better progress UI, automated tests, accessibility, localization, and more robust backup validation.

### Development

No build tools are required. Edit the HTML/JS/CSS files, then use **Reload** on `chrome://extensions` to test. Contributions are welcome; see `CONTRIBUTING.md`.
