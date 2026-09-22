# 验证、构建与发布

## 阶段结论

2026-09-22 用户在本轮测试包完成一系列前后端人工测试，确认问题解决、迁移基本完成，授权关闭重构阶段。所有迁移/样式计划与重复台账合并为当前指南，不再作为待办。此前自动证据：117项生产 UI 检查、37项 Rust 常规测试；真实 sing-box 三次启停（不同日志模式/IPv4及IPv6监听）、当前桌面 UWP 枚举109项通过。人工确认按用户整体反馈记录，不虚构其未逐项提供的截图、签名更新或全系统测试结果。

当前开发版本 `3.0.0-alpha.3`。提交/推送依用户授权，仅 dev；维护者手动 PR 到 main，合并/CI完成前不能宣称已发布。

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

logic.test.mjs 直接加载 TypeScript，需支持类型擦除的 Node 22.18+ / 24+；生产构建与 CI 可继续 Node20。Rust 三个实机专项默认 ignored：

```powershell
$env:WINBOX_TEST_CORE='C:/path/to/sing-box.exe'
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline real_core_start_stop_restart_without_system_proxy -- --ignored --nocapture
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline installed_uwp_apps_are_detected -- --ignored --nocapture
# 管理员终端：随机诊断任务，不运行任务，不修改 WinBoxAutostart
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline autostart_task_roundtrip -- --ignored --nocapture
```

前者在临时目录运行真实内核，仅控制API，不配置系统代理/TUN；UWP测试只读当前用户注册表，需要已安装UWP应用，受限沙箱可能无读取权限。自启测试验证中文/特殊字符路径、重复创建、禁用、目标不匹配、删除及不存在状态，最后清理诊断任务；实际登录启动仍需人工验收。进程超时/退出/端口归属故障注入在常规测试中。

UI 回归：构建后另开终端 `npm --prefix frontend run preview -- --host 127.0.0.1 --port 4173`；使用已有 playwright-core 和已安装 Edge，在根目录运行：

```powershell
node frontend/tests/visual-checks.mjs C:/path/to/playwright-core
```

可设 WINBOX_TEST_URL、WINBOX_BROWSER_CHANNEL、WINBOX_EVIDENCE_DIR。脚本对生产bundle注入官方 MockIPC；涵盖离线模式保存逐帧稳定性、流量/日志局部渲染与日志合批、自启查询/操作失败及重新进入设置校准、生命周期延迟/失败/竞态、四卡逐帧不变量、菜单锚点/宽度、主题/焦点/弹窗/缩放。输出默认 frontend/test-results（忽略）；fixture不进入生产。MockIPC不能替代原生Mica、UAC、系统代理/TUN、托盘/自启、UWP保存和真实更新。

## 本机单 EXE 测试

```powershell
cargo tauri build --no-bundle --target x86_64-pc-windows-msvc -- --locked
```

产物为 `src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，前端资源内嵌，不生成安装包；仍需系统 WebView2，沿用管理员权限和用户数据目录。自启开启时记录这份 EXE 的实际路径，移动文件后应重新设置自启。这只是本机测试入口，不新增 portable 发行通道；正式发行继续使用 NSIS/updater。

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

可在临时 JSON 写入 `{"version":"3.0.0-alpha.1"}`，以 `cargo tauri build --no-bundle --config <JSON绝对路径> --target x86_64-pc-windows-msvc -- --locked` 构建低版本测试 EXE，不修改源码版本。先另存正常版本产物，因为二者共用 target 输出。打开低版本 EXE，启用 Pre-release updates，检查更新并核对弹窗，然后确认安装、重启后版本及用户数据。它会安装当前线上版本，并沿用用户数据目录；不是隔离的数据沙箱。低版本测试程序仅通过构建配置覆盖版本，发布源码保持 alpha.3。

alpha.3 验证状态：用户于 2026-09-23 确认更新相关功能实测正常，并验证了新内核配置不兼容时中止替换、保留旧版本的保护行为。错误提示排版优化留待后续版本；本次不改变。该确认不代表完整发布矩阵全部执行。
