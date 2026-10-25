## v0.4.6：尊重已确认的 HTTP 429 限流

默认单页，所有读取标签页共用至少 8 秒的主页导航间隔；每 40 次导航主动休息 60 秒，不再自动刷新报错或启动卡住的页面。初始临时标签页使用 about:blank，减少一次无用的 X 首页加载。这些都是插件的保守退避设置，不是 X 官方配额，也不保证不会再次被限流。

被动检查页面已有的 Resource Timing 信息；浏览器明确暴露 X 资源的 HTTP 429 或页面显示限流提示时，立即停止整批任务，保存进度和 15 分钟本地冷却状态。冷却期间重复点继续或刷新面板不会请求 X，冷却结束仍需手动继续，不能据此断言 X 已解除限制。未读到 HTTP 状态不代表没有限流（状态字段可能不受支持或因跨域限制为 0）。不新增权限，不直接调用日志中出现的 X 私有接口，不读取响应正文、Cookie 或请求参数。

冷却状态独立于资料备份和清空操作保留，避免清空名单后立即重新触发请求。遇到只有启动 Logo 的情况则短暂停止至少 1 分钟，不把目标账号当成失败；恢复站点后再继续。

## v0.4.5：X 启动 Logo 卡住时暂停整批读取

如果文档已加载完成，但 X 应用只有空白或启动 Logo，没有账号内容，记为应用启动异常；在时间预算内只重载一次，仍无法恢复则暂停整批读取并保留标签页。此时不将目标账号记为读取失败，恢复 X 后可直接继续。日志阶段为 `app-startup-stalled`。仅凭启动 Logo 无法判断网络、脚本、缓存或其他原因，需要结合 Chrome Console 的错误信息定位。

## v0.4.4：按真实诊断修复超时及空页面恢复

用实际经过时间检查 12 秒读取预算，日志同时显示实际耗时；不再把 48 次定时轮询当成 12 秒。浏览器冻结或调度延迟仍可能导致唤醒晚于预算，恢复执行后会停止继续等待。

页面没有主内容区时，也检查应用错误、验证及限流提示；遇到明确限制立即暂停，普通报错或加载完成后主区域持续缺失可在同一时间预算内重载一次。多个页面连续读取失败时自动降为单页，日志记录降并行及重载恢复事件。

对 K/M/万/亿等缩写使用保守范围：只有数量下界已经超过筛选上限时才直接排除，绝不把近似值当精确粉丝数。已保存的缩写记录会自动重新分类，无需访问主页；如 32.2K、1.2万 在上限 800 时不再列为待核实。范围跨越上限时仍保留待核实。精确中文数量支持“关注者/關注者”。

## v0.4.3：持久诊断日志和进一步提效

失败时自动展开“诊断日志”，可导出 JSON。日志保留最近 300 条，界面显示最近 80 条，记录账号、标签页、耗时、轮询次数、最后阶段、阶段变化和页面加载/可见状态；不会记录 Cookie、页面 HTML、请求令牌或 URL 查询参数。旧失败记录没有历史诊断细节，需勾选“重试待核实/失败”重新读取后生成日志。

后台默认 3 页并行，可选 2–4 页；前台模式仍为单页。轮询改为 0.25 秒，每页成功时最快约 2 秒启动下一次导航（含加载时间），失败时自动放慢，登录/访问受限仍暂停。单条资料独立保存，不再每次写入整个资料库；资料未变化时不重建结果表。保留旧版本资料、导入、JSON 备份和恢复兼容性，重新加载扩展并刷新管理面板即可继续，无需重新采集。实际速度仍取决于 X 页面和网络。

## v0.4.2：缩短等待并显示真实失败阶段

默认最多两个标签页并行，可取消“快速读取”使用单页模式。每 0.5 秒检查一次，资料稳定后即保存；蓝 V 等可见认证连续两次相同即可读取，未见认证需多等几次以避免漏掉延迟渲染的徽章。去掉每个账号读取完成后固定额外等待 5 秒，每个标签页的导航间隔至少 3 秒（包含页面加载时间）；每页轮询上限从约 30 秒改为约 12 秒，实际耗时仍取决于网络和浏览器调度，不承诺固定倍数提速。

检测到登录/验证跳转或页面明确显示请求频率限制时立即暂停。连续五次无法读取资料也会暂停；保留出错的读取标签页，可点击“查看读取页面”检查。失败名单会区分未加载主内容区、账号名称区缺失、账号不匹配、粉丝数链接缺失及脚本通信问题。解析兼容两种账号名称区标记，并补读粉丝数子元素的精确文字和标签。失败的重新检查会保留此前成功的结果。

已有粉丝名单及资料无需清空。重新加载扩展，刷新管理面板，确认筛选标题显示 v0.4.2，然后继续；具体 X 页面故障仍需结合新诊断和真实页面核实。

若账号手动能打开但后台读取失败，可勾选“前台读取”，使用一个可见的读取标签页（此模式会切换 Chrome 标签页，优先于双页设置）。这有助于检查可见页与后台页的差异，不能保证消除所有网络或页面结构问题。

## v0.4.1：避免资料补采反复暂停

缩写粉丝数和认证不明记为“待核实”，不再算作主页加载失败，不会触发连续失败暂停。继续时默认读取尚未检查的账号；需要补查旧失败记录时，勾选“重试待核实/失败”，未检查账号仍优先。面板可展开查看待核实或失败的原因及主页链接。连续 10 个主页无法读取时暂停，保留进度及已筛选结果。

## v0.4.0：筛选粉丝数 ≤800 的蓝 V 粉丝

重新加载扩展，刷新管理面板，在“低粉丝数蓝 V 筛选”中点击“补采粉丝资料 / 继续”。默认上限 800，可自行调整，支持暂停及导出全部符合条件的账号。已保存粉丝名单可直接使用，无需重新采集。

该功能依次打开已保存粉丝的公开主页，读取认证颜色和精确粉丝数；只筛选蓝 V，排除金 V、灰 V，不限定注册或认证日期。现有 CSV 不包含这些资料，因此必须先补采。每次只使用一个临时标签页，每个账号需数秒或更久；几千个账号可能需数小时。保持管理面板打开，关闭面板会停止，资料已保存后可继续；默认跳过已经尝试的账号，可勾选“重试待核实/失败”补查，勾选“重新检查全部”可更新旧资料。

结果以读取时间为准，不保证粉丝数实时不变。无法识别的认证、缩写粉丝数（如 1K）、加载失败不会计为符合条件；连续 10 个主页无法读取会暂停，请检查 X 页面是否需要登录、验证或稍后重试。仅解析页面 DOM，不调用私有接口，不自动关注、取关或发送消息。蓝 V 核实依赖页面结构和颜色，页面改版可能需要调整。JSON 备份包含新增资料；普通名单 CSV 保持原格式，筛选结果请用独立的“导出筛选结果 CSV”按钮。

完整回归测试：`node --test tests/collection.test.cjs tests/profiles.test.cjs`。

## v0.3.2 修复：管理面板显示粉丝

账号名单默认显示全部已保存账号，支持切换关注和粉丝名单，两种视图均可搜索及人工核实。仅有粉丝数据时会提示补采 Following 以分析未回关；粉丝独有记录不计入疑似未回关或页面标记互关。重新加载扩展并刷新管理面板即可使用，已保存数据无需重新采集。

## v0.3.1 修复：认证粉丝采集和 CSV 导出

- 支持 `/verified_followers`（认证粉丝）及 `/followers_you_follow`（你关注的粉丝），保存到粉丝名单；这些子列表只覆盖当前页面加载的账号。
- CSV 导出包含关注及粉丝，新增“名单类型”列，同一账号合并为一行；导入时保留名单类型。
- 暂停时补采当前页面并等待保存完成；不支持的页面会明确提示，弹窗定时更新已保存数量。
- 没有数据时提示先采集，不再下载只有表头的 CSV。

更新方式：在 `chrome://extensions` 找到本扩展并点击“重新加载”，再刷新 X 页面，重新开始采集。保留原扩展及目录可继续使用本地数据。旧版未保存的记录需要重新采集。

回归测试：`node --test tests/collection.test.cjs`。

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
