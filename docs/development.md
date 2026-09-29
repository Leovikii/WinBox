# 验证、构建与发布

## 当前版本与验收

`3.0.0-beta.1` 修正 bata 拼写，保留管理员代理直到更新下载及验签完成，修复退出在 UI 线程等待下载操作锁的问题。当前自动检查与尚待实机验收范围见 [审查与验证报告](review.md)。错误预发布和 tag 已按用户要求删除；只交付 dev，由维护者 PR 到 main 后通过原工作流发布。

本版仍使用当前用户 NSIS、普通权限安装、按需提权和官方 updater。新增使用既有 Tauri 的 test feature（仅 dev-dependency，无新生产依赖）验证官方 updater 的本地包读取与错误签名拒绝。

更新专项实机验收：管理员运行 TUN/mixed 并依赖代理联网，确认外网下载/验签完成前不降权或停内核，交接后断开外网仍可安装；慢下载期间分别使用右上角 Quit/确认退出和托盘 Quit，确认窗口不冻结、下载取消、代理恢复；另测最小化到托盘继续下载、错误签名、交接失败保留原实例、正常安装后启动时无 --handoff 重放。不得以 MockIPC/单元测试代替这些实机结论。

## 本地验证

Windows x64，Rust 1.97+ MSVC、VS C++ Build Tools、WebView2、Node 24.14.0（完整验证基线）、Tauri CLI 2.11.4。在仓库根：

```powershell
npm ci --prefix frontend
npm run build --prefix frontend
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --offline --all-targets -- -D warnings
node --test frontend/tests/logic.test.mjs
git diff --check
```

logic.test.mjs 直接加载 TypeScript，需支持类型擦除的 Node 22.18+ / 24+；CI 固定 Node 24.14.0。Rust 两个实机专项默认 ignored：

```powershell
$env:WINBOX_TEST_CORE='C:/path/to/sing-box.exe'
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline real_core_start_stop_restart_without_system_proxy -- --ignored --nocapture
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline installed_uwp_apps_are_detected -- --ignored --nocapture
```

前者在临时目录运行真实内核，仅控制API，不配置系统代理/TUN；UWP测试只读当前用户注册表，需要已安装UWP应用，受限沙箱可能无读取权限。alpha.4 自启改为当前用户注册表项，实际登录启动仍需人工验收。进程超时/退出/端口归属故障注入在常规测试中。

UI 回归使用工具目录安装的 Playwright 1.58.2（微软官方，Apache-2.0，持续维护；仅测试，不进入产品依赖），通过其 CLI 安装 ffmpeg 录屏组件，浏览器复用已安装 Edge。首次缺少 Cargo 缓存时先 `cargo fetch --manifest-path src-tauri/Cargo.toml --locked`，之后再用 offline 验证。

UI 回归：构建后另开终端 `npm --prefix frontend run preview -- --host 127.0.0.1 --port 4173`；使用已有 playwright-core 和已安装 Edge，在根目录运行：

```powershell
node frontend/tests/visual-checks.mjs C:/path/to/playwright-core
```

可设 WINBOX_TEST_URL、WINBOX_BROWSER_CHANNEL、WINBOX_EVIDENCE_DIR。脚本对生产bundle注入官方 MockIPC；涵盖离线模式保存逐帧稳定性、流量/日志局部渲染与日志合批、自启查询/操作失败及重新进入设置校准、生命周期延迟/失败/竞态、四卡逐帧不变量、菜单锚点/宽度、主题/焦点/弹窗/缩放。输出默认 frontend/test-results（忽略）；fixture不进入生产。MockIPC不能替代原生Mica、UAC、系统代理/TUN、托盘/自启、UWP保存和真实更新。

## 本机单 EXE 测试

```powershell
cargo tauri build --no-bundle --target x86_64-pc-windows-msvc -- --locked
```

产物为 `src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，前端资源内嵌，不生成安装包；仍需系统 WebView2，默认普通权限，沿用用户数据目录。自启开启时记录这份 EXE 的实际路径，移动文件后应重新设置自启。这只是本机测试入口，不新增 portable 发行通道；正式发行继续使用 NSIS/updater。

## 构建与发布

```powershell
cargo install tauri-cli --version 2.11.4 --locked
cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis --no-sign -- --locked
```

产物：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe`。主程序 PE Machine 应为0x8664；NSIS引导器的x86 stub不是应用架构。禁止ARM64/MSI/portable；本地未签名包只供测试，不入库、不作为Release输入。

`.github/workflows/build-and-release.yml` 将 Rust 测试/Clippy/NSIS 打包与 Edge 全量生产 UI 回归放在两个 Windows job 并行执行。保留前端构建与逻辑检查、Rust 常规/集成测试、rustfmt、all-targets Clippy、UI 失败证据、NSIS 产物及签名检查。原必需检查名称 Build Windows x64 NSIS 作为汇总门禁，仅两个 job 全部成功才通过；发布依赖此门禁，失败/取消/跳过均不能发布。UI失败仍上传 winbox-ui-failure（7天）。

Rust 使用 [Swatinem/rust-cache v2.9.2](https://github.com/Swatinem/rust-cache/tree/v2.9.2)，固定提交6323deb102c322ba6fcbdcafc7e3dddab59af2b6；LGPL-3.0，维护活跃（2026-08-06发布），仅CI工具。缓存Cargo下载与debug/release依赖编译产物，按工具链、Cargo清单/锁文件及编译环境自动隔离，清理工作区应用产物和增量缓存；额外缓存Tauri下载的NSIS工具。失败也保存可复用依赖，缓存不是发布资产。GitHub分支作用域隔离PR缓存，main不从PR取缓存；工具链变化、首次运行和缓存淘汰仍会冷编译。

[官方 @tauri-apps/cli 2.11.4](https://github.com/tauri-apps/tauri/tree/tauri-cli-v2.11.4) 作为锁定devDependency，MIT/Apache-2.0，Tauri官方持续维护；通过npm获取平台预编译CLI，替代cargo install。锁文件含上游多平台可选包，不改变产品只构建Windows x64的范围。CI使用 npm exec --prefix frontend -- tauri；同runner先构建前端，再通过临时配置清空beforeBuildCommand，避免打包重复构建，正常本地构建hook不变。UI runner独立构建同一提交，无跨job dist传递。

基线运行36527913764的构建任务约19分24秒（回归6分53秒、UI2分31秒、打包7分49秒）。缓存及并行收益待首轮冷缓存和后续命中运行比较，不将估算当作实测；并行会增加少量runner安装开销，目标是缩短等待时间。

本轮已通过 actionlint 1.7.12 工作流静态检查、npm ci 锁文件安装、前端构建/逻辑测试，以及新 npm CLI + 临时配置的未签名 x64 NSIS 实际构建。未为此修改产品代码或测试脚本；未执行远端签名发布，未宣称已测得缓存收益。

发行以该 workflow 为准：PR到main构建未签名x64 NSIS；合并main后使用Actions secrets签名并发布 `*-setup.exe`、同名 `.sig`、`latest.json`（windows-x86_64-nsis），不生成 updater ZIP。密钥不入库，版本含连字符发布为prerelease。检查 Rust/tauri/frontend版本一致，锁文件齐全；不得跳过签名或从本地包代替CI资产。

每次发布按改动范围验证：安装/升级/卸载和数据保留、真实三模式/启停/代理恢复、UWP保存、托盘/自启、WebView2缺失、错误签名/断网/回滚、浅深/缩放/键盘。迁移阶段关闭不等于未来版本可跳过这些常规发布检查。

## 自更新测试

UI 回归包含缺失内核直接下载、网络/元数据错误、失败重试、进度归属、通道互斥、应用/内核共用更新弹窗版本/日志、Later/Escape/焦点恢复、长日志滚动与外部链接、确认版本与元数据不一致时拒绝安装。签名错误与重启状态使用 MockIPC 验证反馈，不代表真实签名安装已验证。

可在临时 JSON 写入 `{"version":"3.0.0-alpha.1"}`，以 `cargo tauri build --no-bundle --config <JSON绝对路径> --target x86_64-pc-windows-msvc -- --locked` 构建低版本测试 EXE，不修改源码版本。先另存正常版本产物，因为二者共用 target 输出。打开低版本 EXE，启用 Pre-release updates，检查更新并核对弹窗，然后确认安装、重启后版本及用户数据。它会安装当前线上版本，并沿用用户数据目录；不是隔离的数据沙箱。低版本测试程序仅通过构建配置覆盖版本，仅用于当前用户安装版本之间的更新测试，不得用 alpha.3 全局安装包验证 alpha.4 原地升级。
