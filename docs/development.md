# 验证、构建与发布

## 当前版本与验收

`3.0.0-alpha.4` 开发结束，用户已确认本轮问题修复，包括开机模式保持及通知中心点击唤起。代码只推送 `dev`，由维护者手动 PR 到 `main`；发布由现有 CI 完成，不把本地测试包视为已发布资产。

本版采用当前用户 NSIS 可见自动安装、普通权限启动、TUN/mixed 按需提权、HKCU 自启和启动代理恢复。全局错误使用英文 Fluent Toast。具体行为见 architecture.md、frontend.md、backend.md；安装/卸载定制见 src-tauri/nsis/README.md。不实现 alpha.3 跨安装范围迁移，测试者按 README 全新安装。

已执行：生产构建、前端逻辑检查、256 项生产 bundle 浏览器检查、Rust 47 项通过（2 项实机专项 ignored）、all-targets Clippy、rustfmt、diff 检查及未签名 Windows x64 NSIS 构建。浏览器检查覆盖权限等待、模式/快照竞态、设置枚举、UWP 草稿、顶部 Toast 长文本/键盘及更新失败重试；Rust 覆盖交接 OS 10035、代理恢复失败保留记录、通知 XML/协议契约。截图与构建产物不入库。

用户确认不等于所有发布故障矩阵均已逐项执行：跨账户拒绝、真实签名升级、WebView2 缺失及异常断电等按下述发布范围复测。通知实测必须安装新包并点击新生成的通知；旧通知不自动更新激活方式。

已知边界：交接验证进程身份、令牌和通信，WebView 在旧实例退出后初始化；此后若初始化失败需手动重开。恢复系统代理只处理仍匹配本应用记录的配置，不覆盖其他软件的新设置。权限优化不承诺消除 Defender 误报。

## 本地验证

Windows x64，Rust 1.97+ MSVC、VS C++ Build Tools、WebView2、Node 20.19+（或22.12+）、Tauri CLI 2.11.4。在仓库根：

```powershell
npm ci --prefix frontend
npm run build --prefix frontend
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --offline -- -D warnings
node --test frontend/tests/logic.test.mjs
git diff --check
```

logic.test.mjs 直接加载 TypeScript，需支持类型擦除的 Node 22.18+ / 24+；生产构建与 CI 可继续 Node20。Rust 两个实机专项默认 ignored：

```powershell
$env:WINBOX_TEST_CORE='C:/path/to/sing-box.exe'
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline real_core_start_stop_restart_without_system_proxy -- --ignored --nocapture
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline installed_uwp_apps_are_detected -- --ignored --nocapture
```

前者在临时目录运行真实内核，仅控制API，不配置系统代理/TUN；UWP测试只读当前用户注册表，需要已安装UWP应用，受限沙箱可能无读取权限。alpha.4 自启改为当前用户注册表项，实际登录启动仍需人工验收。进程超时/退出/端口归属故障注入在常规测试中。

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

`.github/workflows/build-and-release.yml` 为准：PR到main构建未签名x64 NSIS；合并main后使用Actions secrets签名并发布 `*-setup.exe`、同名 `.sig`、`latest.json`（windows-x86_64-nsis），不生成 updater ZIP。密钥不入库，版本含连字符发布为prerelease。检查 Rust/tauri/frontend版本一致，锁文件齐全；不得跳过签名或从本地包代替CI资产。

每次发布按改动范围验证：安装/升级/卸载和数据保留、真实三模式/启停/代理恢复、UWP保存、托盘/自启、WebView2缺失、错误签名/断网/回滚、浅深/缩放/键盘。迁移阶段关闭不等于未来版本可跳过这些常规发布检查。

## 自更新测试

UI 回归包含缺失内核直接下载、网络/元数据错误、失败重试、进度归属、通道互斥、应用/内核共用更新弹窗版本/日志、Later/Escape/焦点恢复、长日志滚动与外部链接、确认版本与元数据不一致时拒绝安装。签名错误与重启状态使用 MockIPC 验证反馈，不代表真实签名安装已验证。

可在临时 JSON 写入 `{"version":"3.0.0-alpha.1"}`，以 `cargo tauri build --no-bundle --config <JSON绝对路径> --target x86_64-pc-windows-msvc -- --locked` 构建低版本测试 EXE，不修改源码版本。先另存正常版本产物，因为二者共用 target 输出。打开低版本 EXE，启用 Pre-release updates，检查更新并核对弹窗，然后确认安装、重启后版本及用户数据。它会安装当前线上版本，并沿用用户数据目录；不是隔离的数据沙箱。低版本测试程序仅通过构建配置覆盖版本，仅用于当前用户安装版本之间的更新测试，不得用 alpha.3 全局安装包验证 alpha.4 原地升级。
