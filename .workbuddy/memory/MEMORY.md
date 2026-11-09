# 项目长期记忆

## 安心养老 · 银发经济微信小程序

原生微信小程序工程，路径即工作区根目录。适老化家居安装 + 居家养老服务预约，双模式（老人自用 / 子女代下单）。

### 关键约定

- **纯 `.js` + `.wxss`，无 npm 依赖**（云函数侧有 wx-server-sdk，由云端安装）。
- **数据层三后端可切换**：`utils/store.js` 是工厂，`config.js` 的 `backend` 决定走 `cloud-api.js`（云开发）/ `http-store.js`（自建后端）/ `local-store.js`（wx storage）。三者方法名与 Promise 契约完全一致（cloud/http 各 32 个，local 少 `login`，store 有兜底），`check-refs.js` 会校验一致性。页面只 require store.js。
- **AppID 为 `wx9ef94ff784a8f0b4`**（2026-10-26 更换；旧号 `wx4bfdeaa9cbd67a9b` 已弃用，其云开发从未开通、无数据需迁移）。
- **云开发环境 ID 已填**：`cloud1-d5gl1cb3tac0ac224`，`useCloud` 自动为 true。当前已切云端，但 5 个集合与 3 个云函数**尚未在云端创建**，需按 `docs/一期实施清单.md` 第 3–5 步补齐后才能正常运行。清空 `CLOUD_ENV` 即退回本地模式。
- **两个演示开关**：`utils/config.js` 的 `demoMode`、`cloudfunctions/order/index.js` 的 `DEMO_MODE`，上线前必须改 false。
- **云函数 6 个**：login / home / elder / order / room / staff。
  - `home`：多房管理，最多 5 套，首次自动建「我的家」，权限表 `home_access`
  - `room`：房间资产（照片 + 隐患勾选），挂 `homeId + roomType`
  - `elder`：家人档案，含绑定权限校验
  - `order`：状态机 8 态 12 转换，每次转换写 `order_logs`；可见性按 userId / elderId / homeId 三重判定；服务人员端 5 个 action（pool/mine/accept/arrive/finish）
  - `staff`：师傅身份，激活码 `AXIN2026`（硬编码，上线前必须换）
- **集合 9 个**：users / homes / home_access / elders / elder_bindings / orders / order_logs / room_assets / staff。旧的 `room_photos` 已废弃。
- **服务人员端**：`pages/staff/home`（工单池/我的工单）、`pages/staff/detail`（接单/打卡/完成+传图）、`pages/staff/activate`（激活码）。入口在「我的」页。接单用乐观锁，接单前手机号打码。
- **配色规范在 `docs/color-palette.md`**：纯白 + 绿，禁止引入橙/红/蓝/黄。主绿 `#15803D`，页面底纯白 `#FFFFFF`，卡片白底 + 2rpx 描边 `#E6EFE9`。
- **超大字体方案**：每个页面 wxss 末尾有 `.bigfont` 前缀覆盖块（字号 ×1.24、盒模型 ×1.14），页面根节点绑 `{{bigFont}}`，状态存在 `app.globalData.bigFont`。改样式后如需同步覆盖块，要一并检查。
- **适老化基线**：正文 ≥30rpx，主按钮 96rpx 起，文字色统一加深避免浅底看不清。

### 改样式后的必查项

1. WXSS 花括号平衡
2. 同行重复声明（脚本批量插入易产生）
3. 孤立 `}` 行
4. `.bigfont` 覆盖块是否仍生效
5. 新建深层目录页面后，跑 `node scripts/check-refs.js` —— require 层级写错编译器不报错，进页面直接白屏（师傅认证页踩过：`pages/staff/activate/` 需 `../../../utils/`，不是 `../../`）

### 页面结构（2026-10-26 按设计稿重构）

5 个 tab：`pages/home` 首页 / `pages/myhome` 我的家 / `pages/help` 帮我一下 / `pages/heart` 心语 / `pages/profile` 我的。
子页：`pages/booking`（三步预约）、`pages/orders`、`pages/order-detail`、`pages/family`。
`custom-tab-bar/` 为自定义 tabBar（emoji 图标），**每个 tab 页 onShow 必须调 `getTabBar().setData({selected:n})`**。
旧的 `pages/index`、`pages/services`、`utils/data.js` 已删除，业务配置改在 `utils/design.js`。

### 设计令牌（`app.wxss`）

页面底 `#F4F8F2`，卡片白 + 圆角 28rpx。**文字三档：`#1F2D22` / `#3D4A3F` / `#5F7165`，均已实测 ≥4.5:1；不得再引入更浅的灰**（`#8A9A8C`/`#9AAA9C` 已废弃）。主绿渐变 `#3D9142 → #2E7D32`（白字 3.94~5.13:1），占位符 `#74876F`。完整色板与实测值见 `docs/color-palette.md`。
每个页面 wxss 末尾保留 `.bigfont` 覆盖块（字号 ×1.24），页面根节点绑 `{{bigFont}}`。

### 弹层（sheet）布局要点

底部弹层结构必须是：`.sheet{max-height:88vh; overflow:hidden; display:flex; column}` + `.sheet-body{flex:1; min-height:0}` + `.sheet-foot{flex-shrink:0}`。**主操作按钮放 `.sheet-foot`，不能放在 scroll-view 内部**，否则长表单时按钮会被挤出屏幕（家人档案踩过这个坑）。

### 工具链

- **三个自检脚本**（改完必跑）：`node scripts/check-refs.js`（结构/require/事件绑定）、`node scripts/test-cloud.js`（云函数功能测试，39 项，用内存 DB 模拟 wx-server-sdk）、`node scripts/test-store.js`（本地数据层，19 项）

- 微信开发者工具装在 `D:\WeChat_devtool\微信web开发者工具\`（v2.02.2609231），`cli.bat` 可用。注意 `C:\Users\13432\AppData\Local\微信开发者工具` 只是配置目录，不是安装位置。
- CLI 调用需用户在「设置 → 安全设置 → 服务端口」开启；当前为关闭状态。
- 开启后可用 `cli cloud functions deploy --e <envId> --n <name> --r --project <path>` 直接部署云函数（`-r` = 云端安装依赖），可绕开 GUI 文件树。
- CLI 的 `y` 确认是工具内置的人工授权门，不可替用户自动应答。

### WXML 限制

- 不支持方法调用（如 `item.name.charAt(0)`），需在 JS 中预计算字段

### 目标框架（用户 2026-10-26 提供的模块表）

比现有工程大得多：登录绑定（亲情绑定、一人多老人）、首页（4 入口+消息红点）、诊断流程（动态问卷+断点续答+报告）、订单闭环（5 态机+双向确认+凭证+双向评价+订阅消息）、机构端 3 页、管理端 4 页。

**评审结论见 `docs/框架评审.md`**。四个待解决的前置问题：
1. 老人是否独立微信账号（决定表结构/权限/解绑规则/是否需要老人端）
2. 管理端应改 Web 后台，不适合放小程序
3. 订阅消息无法做到「每态触发」，只能关键节点 + 站内消息
4. 适老化「88px」应为 88rpx（44px），「18pt」应为 36rpx

**当前工程与框架差距**：7 页 vs 约 25-30 页；无后端。后端是硬门槛，未开通前多角色/多设备功能无法实现。

**新框架已交付：`docs/可行框架v1.md`**。核心决策：
- 老人档案 = 数据主体，微信账号 = 操作者（老人可不注册，也可扫码认领档案）
- 一条主线：评估 → 报告 → 推荐服务（带参直达下单）→ 履约 → 复评
- 订单 8 态 12 转换，含拒单/取消/售后；每次转换写 order_logs，权限服务端校验
- 管理端与服务端机构后台走 Web；C 端 8 页 P0 + 4 页 P1；服务人员 5 页同 AppID 角色路由
- 订阅消息只 3 节点（下单时一次请求多个 tmplId），其余站内消息
- 一期不做支付（商户号+执照+对公账户周期 2-4 周会卡上线）
- 后端推荐微信云开发（免备案、原生 SDK、免费额度够 MVP）
