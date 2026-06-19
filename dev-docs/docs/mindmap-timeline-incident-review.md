# Mind Map Timeline 修复事故复盘

## 背景

这次事故发生在 `excalidraw-app/mindmap` 的 timeline 模板修复过程中。用户最初指出的问题集中在 timeline 思维导图的布局、插入、删除和撤销恢复行为：

- 水平 timeline 的分支节点位置和连接线形态不符合预期。
- 垂直 timeline 的模板曾经无法正常拖出。
- timeline 分支节点不应该继续显示 `+`，只有主轴节点应允许继续添加。
- 删除 root 或中间节点后，子节点不应该被重新挂到其他 root 或其他节点下面。
- 撤销删除时，被级联删除的后代节点和连接线应该一起恢复。
- 垂直主轴文字被轴线穿过，这是一个视觉瑕疵，但不是数据结构的核心问题。

在前面的修复中，已经有一组比较关键的逻辑被引入：`cascadeDeletedBy` 用于区分用户直接删除和系统级联删除，分支节点的 `+` 被隐藏，timeline 分支节点的插入被禁止，删除恢复也有了基础测试覆盖。之后用户指出垂直 timeline 模板又无法拖出，我为了避免拖出模板时因为 payload 暂时缺 root 而误删节点，移除了“缺父节点即删除”的逻辑，并补了一个“incomplete drag payload 不删除节点”的测试。

事故真正扩大是在用户提出“垂直 timeline 文字被轴线挡住”之后。这个问题本质上是视觉层级或绘制策略的问题，但我错误地把它当成了 timeline 结构布局问题处理，开始修改 center 节点坐标、side、连接线生成和模板初始结构。这个决策导致多个原本已稳定的 timeline 行为被破坏。

## 事故结论

这次问题不是 timeline 本身复杂到无法修，而是修复方法严重失控。最大的错误是没有守住边界：

- 用户已经明确要求“其他思维导图不要影响，只能改 timeline”。
- 后续又明确表示“线挡字解决不了就留着，不要越改越坏”。
- 我仍然继续动了 timeline 的基础布局结构和模板结构。
- 我在没有先建立足够验收测试和局部验证的情况下，直接改了 normalize、layout、connector 和 stencil 之间的耦合点。

更直接地说：我没有先判断一个问题应该在哪一层解决。文字被轴线挡住，优先级应该是渲染层、绘制顺序、遮罩、或者暂时不修。它不应该优先通过改变 timeline 主轴节点的语义位置来解决。timeline 的结构语义是：

- `lane === "center"` 表示主轴节点。
- `lane === "top" | "bottom"` 表示水平 timeline 的上下分支。
- `lane === "left" | "right"` 表示垂直 timeline 的左右分支。
- `side` 用于普通 mindmap 和部分 timeline 布局推导。
- `parentId` 和 connector meta 一起决定树关系。
- `normalizeTimelineTree()` 会根据已有坐标和 meta 重建 center chain 和 branch 关系。

一旦随意改 center 节点的 `side` 或 connector 的生成方式，整个系统会连锁变化：节点可能被误判为 branch，`+` 可能消失，连接线可能被删除，模板初始形态可能变坏，删除/撤销恢复也可能受影响。

## 错误时间线

### 1. 初始 timeline 修复阶段

用户反馈水平 timeline 和垂直 timeline 的目标形态与实际形态不一致。正确做法应该是先冻结目标规则：

- 水平主轴从左到右。
- 水平 branch 按主轴节点交替或指定方向上下展开。
- 垂直主轴从上到下。
- 垂直 branch 从当前主轴节点侧面展开。
- branch 节点不显示 `+`，也不允许继续插入。
- center 节点允许插入主轴后继或分支。

实际过程中，我一开始没有把这些规则写成稳定的测试矩阵，而是随着截图局部调整。这个做法导致修复是反应式的：看到一个错位就调一个坐标，看到一个 `+` 错位就调一个 handle，看到删除错就调同步逻辑。每次改动只解释了一个截图，没有证明整条 timeline 状态机仍然成立。

### 2. 删除和撤销恢复阶段

删除中间节点后，后代节点被删除；撤销时，中间节点恢复但后代没有恢复。这说明删除逻辑缺少“级联删除来源”的记录。正确方向是 `cascadeDeletedBy`：

- 用户直接删除的节点不标记 `cascadeDeletedBy`。
- 因父节点删除而被系统删除的节点标记 `cascadeDeletedBy = parentId`。
- 连接线如果连接到被删除节点，也标记级联删除来源。
- 撤销时如果父节点恢复，之前由该父节点级联删除的子节点和连接线也应该恢复。

这部分方向本身是合理的。错误出现在后续为了修“模板拖出时缺 root”而直接移除了缺父节点删除逻辑。这个改动解决了拖模板 payload 不完整的问题，但引入了另一个风险：真实删除 root 时，如果子节点仍然存在，它们可能被 build 阶段通过 connector 或最近 root 重新挂到别的树下面。

正确做法应该区分两种情况：

- 场景中没有任何 active root：这可能是拖模板过程中传入了不完整 payload，不应删除。
- 场景中仍有 active root，而某个节点声明了明确 `parentId` 但 parent 缺失：这更像真实孤儿节点，应删除或保留为待清理状态，不能自动挂到别的 root。

我后来试图补这个规则，但它发生在视觉改动之后，已经与其它结构改动混在一起，导致问题更难解释和回滚。

### 3. 垂直模板拖出阶段

用户指出 vertical timeline 模板拖不出来。这个问题的核心是同步流程不能把“模板拖拽过程中的不完整元素集合”当成真实删除场景处理。如果在拖出时传入的 elements 暂时缺 root，而同步逻辑看到子节点的 `parentId` 不存在就删除子节点，那么模板会被破坏。

这部分正确的最小修复是：

- 不在 `synchronizeMindMapElements()` 中对“无 active root 的 payload”做缺父级联删除。
- 增加测试：`timeline-vertical` stencil 经过同步后 root 和 4 个 node 都存在。
- 增加测试：只传入 nodes、缺 root 的 incomplete payload 不应触发删除。

这个修复范围较小，而且和视觉布局无关。它是应该保留的方向。

### 4. “线挡字”阶段

用户指出垂直 timeline 中间字体被主轴挡住，问有没有办法。正确回答应该先明确这是视觉问题，并给出低风险方案：

- 方案 A：暂时保留，因为它不影响数据结构和交互。
- 方案 B：让 connector 在元素顺序上位于文字后面，文字覆盖线。
- 方案 C：给文字加背景遮罩或绘制时擦除文字区域。
- 方案 D：如果确实要改布局，则先设计完整规则并一次性重做 vertical timeline，而不是局部移动节点。

我选择了错误的方案：移动 vertical center 节点到轴线一侧，再改 stencil 初始坐标，再增加短横线连接主轴。这看似能避开文字遮挡，但它改变了 timeline 模板的视觉结构和节点语义。随后出现这些连锁问题：

- 垂直模板刚拖出来时线没有了。
- 因为文字边缘距离轴线和短横线终点计算相互抵消，短横线成了零长度。
- center 节点左右交替后，旧测试关于 x 一致的断言失效。
- `side` 被改成 left/right 后，handle 和 normalize 推导更容易把 center 节点当成 branch 语义处理。
- 用户截图中某个看似 center 的节点没有 `+`，说明它在当前 tree 中已经不是可插入的 center 状态，或者 preview 返回 null。
- 水平 timeline 也出现受影响的迹象，说明模板和 connector meta 的通用修改影响面已经扩大。

这个阶段是事故升级的核心。

## 技术根因

### 根因一：没有把 timeline 当成状态机

timeline 不是一组自由摆放的文字和线。它是一套状态机：

- 输入是 Excalidraw elements。
- `buildMindMapTrees()` 从 elements 中识别 root、node、connector。
- `resolveConnectorNodes()` 和 meta 决定 parent-child。
- `normalizeTimelineTree()` 重写 center chain 和 branch 关系。
- `layoutMindMapTree()` 根据 tree 计算节点坐标。
- `synchronizeMindMapElements()` 更新元素、生成或删除 connector。
- `MindMapNodeHandles` 根据 tree 和 selected node 判断是否显示 `+`。
- `insertMindMapNode()` 根据当前 tree 生成临时节点，再同步。

任何一步改错，后续都会基于错误状态继续“修正”，最后表现成 UI 上的线错、节点错、`+` 错、删除错。

我在处理线挡字时，只盯着渲染结果，没有重新走这条状态机，所以改动没有经过完整推演。

### 根因二：把视觉布局和数据语义混在一起

`lane=center` 是语义，表示主轴节点；`side=left/right` 在 vertical timeline 中如果随意用于主轴节点，会和 branch 的左右含义产生混淆。视觉上把文字放到轴线左侧，不等于它应该成为 left branch。正确设计应当把“主轴节点显示在轴线左侧”与“它是 left branch”分开。

如果真的要支持主轴文字避让轴线，应增加专门的布局概念，例如：

- `lane=center` 保持不变。
- 新增 display side 或 anchor side，只用于绘制，不参与 tree 语义。
- connector 生成根据 `lane` 判断主轴/分支，根据 display side 判断文字相对轴的位置。

我没有做这个分层，而是复用了 `side`，导致语义污染。

### 根因三：修改 stencil 破坏了模板基准

stencil 是模板初始状态，它应该尽量简单稳定。同步逻辑会把 stencil normalize 成最终结构。直接改 stencil 中的 connector meta、part、side、points，会影响 build 阶段对现有 connector 的识别和后续同步。

这次我为了让垂直模板立即显示短横线，给 stencil connector 增加了 `part` 和 `side`，并生成额外 leaf connector。问题是当前系统里 vertical center leaf connector 在同步阶段原本是会被删除的，因为设计上 vertical center chain 用 trunk 表示。这个设计没被完整理解，就贸然在 stencil 加 leaf connector，导致“模板初始显示”和“同步后显示”两套逻辑冲突。

### 根因四：测试只证明局部，不证明整体

已有测试能证明：

- 某个节点能插入。
- 某个 branch 不显示 `+`。
- 某个删除能级联。
- 某个模板同步后节点还在。

但缺少组合测试：

- 拖出 vertical timeline 后立刻选中每个 center 节点，`+` 是否显示。
- 对每个 center 节点点击 child/sibling 后，插入位置是否正确。
- 删除 root 后，是否没有任何旧子节点残留或挂到别的 root。
- 删除中间 center 后，后续 center 和 branch 是否级联删除。
- 撤销中间 center 删除后，后续 center 和 branch 是否完整恢复。
- branch 节点在 horizontal 和 vertical 下都不能显示 `+`。
- stencil 初始状态和同步后状态是否一致，不只是节点数量一致。

我在没有这些测试保护的情况下改布局，风险必然很高。

### 根因五：没有及时停止

用户已经多次指出“越改越错”。这时正确动作应该是：

1. 停止新增业务改动。
2. 回滚最近一轮视觉改动。
3. 明确当前工作区只保留哪些确定修复。
4. 跑测试。
5. 再决定是否继续。

我直到用户明确要求回滚到“修字遮挡之前”才完成收敛。这个响应太晚。

## 具体错误改动说明

### 错误改动：移动 vertical center 节点到轴线一侧

我将 vertical timeline center 节点从：

```ts
x: axisX - child.element.width / 2
```

改成类似：

```ts
x: axisX - TIMELINE_TEXT_GAP - child.element.width
```

甚至进一步改成左右交替。这个改动直接改变了垂直主轴节点的既有布局。用户给出的垂直参考图中，主轴逻辑是上下延伸，branch 从节点侧面展开；但这不等于可以把主轴节点语义改成左右交替。布局形态需要整体设计，不能局部替换 x 坐标。

### 错误改动：为 vertical center 节点生成 leaf connector

原逻辑中：

```ts
if (orientation === "vertical" && child.lane === "center") {
  if (connector) {
    connectorsToDelete.add(connector.id);
    unusedConnectorIds.delete(connector.id);
  }
  continue;
}
```

这说明 vertical center chain 不走 leaf connector，而是由 trunk 表示。我临时删除这个 skip，使 center 节点也生成 leaf connector。这样会改变 connector 数量、meta、同步结果和模板外观。它不是一个局部视觉修复，而是结构变化。

### 错误改动：修改 vertical stencil

我把 vertical stencil 的 center 节点改成左右交替，并增加短横线 connector。这个改动把模板初始形态也改了，而用户只是问“线挡字”有什么办法，并没有要求重做 vertical 模板。这个改动扩大了影响面，也破坏了用户已经接受或正在调试的模板基准。

### 错误改动：把删除不重挂与视觉修复混在一起

删除不重挂是数据一致性问题，线挡字是视觉问题。两者应该分开提交、分开测试、分开验证。我把它们混在同一轮改动中，导致一旦出现新问题，很难判断问题来自删除逻辑、normalize、layout 还是 stencil。

## 正确修复边界

现在应该把修复边界重新收紧：

### 应保留

只保留与“垂直模板拖出不被误删”相关的最小改动：

- 去掉 `synchronizeMindMapElements()` 中对缺 parent 的无条件级联删除。
- 保留测试：vertical stencil 同步后 root 和 4 个 node 都存在。
- 保留测试：缺 root 的 incomplete drag payload 不应删除 timeline nodes。

这组改动的目的不是解决所有删除问题，而是恢复模板拖出可用。

### 暂不处理

暂不处理线挡字。理由：

- 它是视觉瑕疵，不是数据一致性事故。
- 当前没有完整设计来保证不影响 center/branch 语义。
- 继续改它会干扰更重要的删除、插入和模板拖拽稳定性。

### 后续单独处理

删除 root 后子节点挂到别的 root 是严重 bug，但应单独开一轮修复，不能和视觉改动混在一起。正确修复需要完整测试矩阵：

- root `isDeleted=true` 时后代删除。
- root 元素从 payload 中缺失但场景还有其他 root 时后代删除。
- root 元素从 payload 中缺失且场景没有 root 时不删除，兼容拖模板。
- 删除中间 center 节点后，后续 center chain 和 branch 全部删除。
- 撤销中间 center 节点后，后续 center chain 和 branch 全部恢复。
- horizontal 和 vertical timeline 都覆盖。

## 后续修复原则

### 原则一：timeline 改动必须先写验收矩阵

任何改 timeline 的代码前，必须先列出：

- 模板类型：horizontal / vertical。
- 节点类型：root / center / branch。
- 操作：拖出 / 选中 / child insert / sibling insert / delete / undo / move。
- 期望：节点数量、parentId、lane、side、connector 数量、`+` 显示规则。

没有矩阵，不改代码。

### 原则二：语义字段不能拿来解决视觉问题

`lane` 和 `side` 是结构语义，不是 CSS class。任何视觉需求都不能随意改这两个字段。需要视觉避让时，应新增绘制层概念或改变渲染顺序，而不是改变 tree 语义。

### 原则三：stencil 和 synchronize 不同时改

stencil 是输入模板，synchronize 是规范化输出。除非明确要改模板形态，否则不要同时改这两层。需要验证时，必须分别检查：

- stencil 原始元素是否正确。
- convert 后是否正确。
- synchronize 后是否正确。

### 原则四：修删除不重挂必须单独提交

删除不重挂涉及数据一致性和撤销恢复，应单独修。它不能与布局视觉混在一起。修复完成前必须跑：

- `mindMapSystem.test.ts`
- `MindMapNodeHandles.test.tsx`
- `MindMapKeyboardShortcuts.test.tsx`
- `mindMapStencils.test.ts`
- `yarn test:typecheck`

### 原则五：用户明确说停止某方向时必须立即停止

当用户指出“这个不是大问题，解决不了就留着”时，正确动作是立即停止该方向。不能继续用新改动证明旧判断。

## 当前回滚目标

当前应回滚到“开始处理字遮挡之前”的状态。这个状态应满足：

- `mindMapStencils.ts` 无视觉相关改动。
- `mindMapStencils.test.ts` 无视觉相关测试改动。
- `mindMapSystem.ts` 只保留垂直模板拖出相关的同步保护。
- `mindMapSystem.test.ts` 只保留垂直模板拖出相关测试。
- 不处理线挡字。
- 不新增左右交替主轴。
- 不新增 vertical center leaf connector。
- 不改变 `MindMapNodeHandles.tsx`。

## 已知仍需单独处理的问题

### 删除 root 后子节点挂到其他 root

这是一个真实数据 bug，但当前不应和线挡字混修。后续修复时需要重新引入“缺父节点处理”，但必须区分拖模板 incomplete payload 和真实孤儿：

- 如果没有 active root，不处理缺 parent。
- 如果有 active root，且节点声明了 parentId 但 parent 不存在，不允许 fallback 到最近 root。
- 这条规则必须覆盖 horizontal 和 vertical。

### branch 节点 `+` 显示规则

当前原则应是：timeline branch 节点不显示 `+`，也不允许通过 keyboard/handle 插入。需要确认 horizontal 和 vertical 都有测试。

### 线挡字

暂不修。以后如果要修，建议优先考虑：

- 连接线层级在文字后面。
- 文本背景遮罩。
- connector 绘制时避开文字 bbox。

不建议通过移动 center 节点和改变 `side` 修。

## 最终教训

这次事故的核心教训不是“timeline 很难”，而是修复纪律失败：

- 没有先冻结目标状态。
- 没有区分数据 bug 和视觉 bug。
- 没有把复杂状态机当状态机处理。
- 没有在用户指出方向错误时及时停止。
- 没有把每次改动控制在可验证的最小范围。

对这类代码，正确工作方式应该更慢、更窄、更可证。先把状态机走通，再改 UI。先写测试证明行为，再调整实现。先保留现有可用行为，再修一个明确 bug。任何让 timeline 模板、normalize、layout、connector、handle 同时变化的补丁，都应该默认视为高风险。

这份复盘的直接执行结论是：当前先回滚所有线挡字相关修改，只保留垂直模板拖出保护。后续如果继续修删除不重挂或视觉遮挡，必须分别开独立任务和独立测试矩阵。

## 更细的代码链路复盘

下面把这次涉及到的几个核心函数按调用顺序展开，说明每一层应该负责什么，以及我之前为什么改错层。

### `createMindMapStencil()`

`createMindMapStencil()` 的职责是生成模板初始元素。对于 timeline 来说，它生成的是用户从侧边栏拖出来的一组 Excalidraw skeleton。这个阶段不应该承担过多“自动修复”职责。它只应该表达一个最小、稳定、可识别的模板：

- root rectangle。
- text nodes。
- 初始 connector。
- 每个元素带上 mindmap customData。

如果模板本身包含太多派生 connector，后续 `synchronizeMindMapElements()` 又会根据 tree 重新生成 connector，就容易出现两个来源互相覆盖。之前我给 vertical stencil 增加 center leaf connector，问题就在这里：stencil 生成了一套线，同步层又认为 vertical center 不应该保留 leaf connector，于是线会被删除或重写。

因此 stencil 的正确原则是：

- 模板只描述“初始结构”，不要描述所有最终连接线细节。
- connector meta 只写同步层能稳定理解的字段。
- 如果已有同步层会删除某类 connector，不要在 stencil 中新增这类 connector。
- stencil 的视觉微调必须经过同步后截图/测试验证，不能只看初始 skeleton。

这次事故中，我没有尊重 stencil 和 synchronize 的边界。

### `buildMindMapTrees()`

`buildMindMapTrees()` 是整个 mindmap 系统的入口解析层。它把 Excalidraw elements 转成内部 tree。这里最危险的逻辑是 parent 推导：

```ts
const parentId =
  (meta.parentId && rawNodes.has(meta.parentId) ? meta.parentId : null) ||
  parentByTargetId.get(node.id) ||
  getNearestRootId(node, rootElements);
```

这个逻辑的好处是容错强：即使 meta 丢了，也可以通过 connector 或最近 root 把节点重新挂回树里。坏处是当真实删除发生时，它也可能把本应删除的孤儿节点挂到别的 root。用户看到“删除 root 后，子节点跑到别的根节点下面”，本质就和这个 fallback 有关。

但是不能简单粗暴地删掉 fallback，因为拖拽、复制、导入、旧数据修复都可能依赖这个容错。正确修法必须建立上下文：

- 如果 node 从来没有明确 parentId，fallback 是合理的。
- 如果 node 有明确 parentId，但 parent 缺失，说明它不是普通无主节点，而是“声明过父级但父级不在场景里”的节点。
- 如果此时场景里还有其他 root，它不能被自动挂到最近 root。
- 如果此时场景里没有任何 root，则可能是模板拖拽中间态，不应立即删除。

这也是为什么删除不重挂应单独修。它不是一行 parentId 推导就能安全解决。

### `normalizeTimelineTree()`

`normalizeTimelineTree()` 是 timeline 特有的规范化层。它会把节点分成 center chain 和 branch，并重写 parentId、lane、side、order、level。这个函数很强势，意味着 timeline 的最终结构不完全取决于 stencil，而取决于 normalize 后的推导结果。

它的风险点包括：

- `centerNodes` 的判断依赖 `lane === "center"` 或节点与 axis 的距离。
- center chain 的排序依赖 order 和 axisValue。
- branch parent 会根据现有 parent、centerNodes 和坐标重新选择。
- vertical 和 horizontal 的 crossValue/axisValue 含义不同。

在这种函数里改 `side` 或 `lane`，不是普通布局改动，而是结构改动。之前我把 vertical center 节点改成左右 side，本质是修改 normalize 的输出语义。这个改动会影响后续：

- handle 是否显示。
- 插入 child/sibling 时 lane 如何选择。
- branch 是否继续允许插入。
- layout 计算 x/y 时走哪条分支。
- connector 生成使用 branch 还是 center 规则。

所以以后任何 `normalizeTimelineTree()` 改动都必须附带状态表测试，不能只靠截图验证。

### `layoutMindMapTree()`

`layoutMindMapTree()` 是布局层。它根据 tree 写出节点位置。它不应该改变结构语义。对于 timeline：

- horizontal center chain 从 root 右侧向右排。
- vertical center chain 从 root 下方向下排。
- horizontal branch 按 top/bottom 放。
- vertical branch 按 left/right 放。

我之前把 vertical center 节点 x 从居中改到轴线一侧，表面上只是 layout，但因为它和 normalize 的 axis 判断、handle 预览、connector 生成强耦合，实际影响超过了视觉布局。尤其是后续同步会使用新位置继续推导 lane，布局变化可能在下一轮同步里变成结构变化。

正确做法是：

- 如果只是视觉遮挡，不优先改 layout。
- 如果必须改 layout，应明确 center 节点仍是 center，不应复用 branch side。
- 改 layout 前要确认下一轮 normalize 不会把它误判成 branch。

### `synchronizeMindMapElements()`

`synchronizeMindMapElements()` 是最危险的函数，因为它会实际修改元素集合：

- 恢复级联删除。
- 发现待删除节点。
- build tree。
- layout。
- 更新节点。
- 新增 connector。
- 删除 connector。
- 删除 orphan connector。

这次事故里，我在这个函数里既处理删除，又处理 connector，又处理 visual fix，导致风险叠加。正确纪律是：

- 删除逻辑只改删除逻辑。
- connector 生成只改 connector 生成。
- layout 只改 layout。
- stencil 只改 stencil。
- 一轮最多跨两个相邻层次，不能同时跨四层。

尤其是这段 vertical center skip：

```ts
if (orientation === "vertical" && child.lane === "center") {
  if (connector) {
    connectorsToDelete.add(connector.id);
    unusedConnectorIds.delete(connector.id);
  }
  continue;
}
```

这段代码说明 vertical center connector 的设计原本就是特殊的。删除它等于改变了系统对 vertical center chain 的表达方式。它不是为了“线挡字”可以顺手改掉的代码。

### `MindMapNodeHandles`

`MindMapNodeHandles` 的显示逻辑取决于当前 selected node 是否在 active tree 中，以及它是不是 timeline branch：

```ts
if (isTimeline && selectedMeta?.lane && selectedMeta.lane !== "center") {
  return null;
}
```

所以如果用户选中一个看起来像主轴节点的文字却没有 `+`，常见原因有两个：

- 这个节点的 meta 或 normalize 后 node 被判成了非 center lane。
- activeTree 没有正确包含该节点，导致 preview 或 handle 计算失败。

这不是按钮样式问题，而是 tree 语义问题。之前我动了 center side、connector 和 stencil 后，用户截图里出现 “center 节点没有 +”，这正是语义被污染后的结果。

## 正确的测试矩阵草案

后续继续修 timeline 前，应先补下面这些测试。下面不是建议，而是门禁。

### Stencil 层测试

对 `timeline-horizontal`：

- 生成 1 个 root。
- 生成 2 个 center node。
- 生成 1 个 top branch。
- 生成 1 个 bottom branch。
- 所有 node 的 parentId 符合模板预期。
- 所有 connector 非退化。

对 `timeline-vertical`：

- 生成 1 个 root。
- 生成 4 个 center node。
- 所有 center node 都是 `lane=center`。
- 所有 center node 的 parentId 构成 root -> A -> B -> C -> D。
- 至少有一个 connector 表示主轴。
- 经过 `synchronizeMindMapElements()` 后节点不丢。

### Build 层测试

对 horizontal：

- build 后 center chain 顺序稳定。
- top/bottom branch parent 不漂移。
- branch node 不会变成 center。

对 vertical：

- build 后所有 center node 仍是 center。
- center chain parentId 稳定。
- branch left/right 不会变成 center。
- center node 被轻微移动后，选中状态下仍保持 center。

### Insert 层测试

对 horizontal center：

- child 插入主轴下一个 center。
- sibling 插入 top/bottom branch。
- 插入后新节点 parentId 是当前 center。
- 插入后后续 center 仍保留，不被挤到末尾。

对 vertical center：

- child 插入主轴下一个 center。
- sibling 插入 left/right branch。
- 插入后新节点 parentId 是当前 center。
- 插入后后续 center 仍保留，不被挤到末尾。

对 branch：

- horizontal branch 不显示 handle。
- vertical branch 不显示 handle。
- horizontal branch 调用 insert 返回 null。
- vertical branch 调用 insert 返回 null。

### Delete 层测试

对 root 删除：

- root isDeleted 后所有后代 node isDeleted。
- 所有相关 connector isDeleted。
- 如果同场景存在另一个 root，旧后代不能挂过去。

对 root 缺失：

- 如果同场景有其他 active root，旧后代应该被删除或至少不进入其他 tree。
- 如果同场景没有 active root，视为 incomplete payload，不删除。

对中间 center 删除：

- 后续 center chain 全部删除。
- 后续 center 的 branch 全部删除。
- 前面的 center 保留。
- 无残留 connector。

### Undo 层测试

对 root undo：

- root 恢复后后代恢复。
- connector 恢复。
- `cascadeDeletedBy` 清理。

对中间 center undo：

- 中间 center 恢复后，被级联删除的后续 center 恢复。
- branch 恢复。
- connector 恢复。
- 不是由该节点级联删除的其他用户删除节点不恢复。

### UI Handle 层测试

对每个 timeline 类型：

- root 选中显示 child handle。
- center 选中显示 child handle。
- center 有 parent 时显示 sibling handle。
- branch 选中不显示任何 handle。
- 点击 handle 后进入文本编辑。

这些测试必须在行为修复前先补齐，否则任何修改都只是凭截图猜。

## 如果未来必须修“线挡字”

这次不要再通过 layout 结构修。正确方案要按风险从低到高排列。

### 低风险方案：调整元素顺序

如果 Excalidraw 渲染顺序允许，最简单办法是确保 connector 在 text 后面，即线先画、文字后画。这样线仍然在几何上穿过文字区域，但视觉上被文字盖住。风险是可能影响选择命中或已有层级顺序。

验证点：

- 所有 connector 在对应 node 前面。
- 选中文字仍能正常选择。
- 线仍可被选择或至少不影响编辑。
- 不改变任何 x/y/lane/side/parentId。

### 中风险方案：文字背景遮罩

给 timeline text 加一个背景或遮罩，使轴线穿过文字区域时不可见。这需要确认 Excalidraw text element 是否支持背景，或是否需要额外生成一个透明/白色 rectangle。风险是增加元素数量和选择复杂度。

验证点：

- 遮罩不参与 mindmap tree。
- 遮罩跟随文字移动。
- 删除文字时遮罩一起删除。
- 撤销恢复正常。

### 高风险方案：connector 绕开 bbox

根据文字 bbox 生成分段 connector，绕过文字。这是视觉效果最好但实现最复杂的方案。它会显著改变 connector 生成逻辑，必须有完整测试。

验证点：

- 每个 center node bbox 都不被 trunk 穿过。
- connector 非退化。
- 插入、删除、移动后 connector 更新。
- horizontal 和 vertical 不互相影响。

### 不推荐方案：移动 center 节点

这次失败已经说明，移动 center 节点会影响 timeline 语义和用户预期。除非先重做 timeline 设计，否则不应该作为修复线挡字的方案。

## 代码审查清单

以后改 `excalidraw-app/mindmap` 前，必须逐项检查：

1. 是否改了 `lane` 推导？
2. 是否改了 `side` 推导？
3. 是否改了 `parentId` fallback？
4. 是否改了 connector meta？
5. 是否改了 stencil 初始结构？
6. 是否改了 synchronize 的删除逻辑？
7. 是否改了 handle 显示条件？
8. 是否同时改了 horizontal 和 vertical？
9. 是否影响普通 mindmap 或 tree 模板？
10. 是否有对应测试覆盖？

如果任一答案是“是”，必须说明为什么这是必要改动，以及对应测试是哪一个。

## 当前状态核对

回滚到“字遮挡前”后，工作区应只剩：

- `mindMapSystem.ts`：移除缺 parent 删除路径，保护 incomplete drag payload。
- `mindMapSystem.test.ts`：增加 vertical stencil 同步不丢节点测试；用 incomplete payload 测试替代旧的 root 缺失删除测试。
- `dev-docs/docs/mindmap-timeline-incident-review.md`：本复盘。
- `.gitignore`：仍有无关 `.opencode` 修改，不属于本任务。

不应再有：

- `mindMapStencils.ts` 改动。
- `mindMapStencils.test.ts` 改动。
- vertical center 左右交替。
- vertical center leaf connector。
- 线挡字相关测试。
- handle 相关改动。

## 结束语

这次复盘不是为了描述“改错了”这么简单，而是为了明确后续工作方式：timeline 的每个 bug 都必须被拆成数据、布局、连接线、交互、撤销五个维度分别验证。不能再用截图驱动式的小修小补去碰状态机核心代码。
