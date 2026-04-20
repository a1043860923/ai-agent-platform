/**
 * 顶部导航栏组件 - Header
 * 
 * 这个组件负责渲染整个应用的顶部导航栏，包含以下功能：
 * 1. 左侧：控制左侧文档面板的展开/收起按钮
 * 2. 中间：应用Logo和标题展示
 * 3. 右侧：控制右侧配置面板的展开/收起按钮
 * 
 * 使用了 Framer Motion 实现入场动画效果
 * 使用了 Zustand 状态管理来控制面板的显示状态
 */

'use client'; // 标记为客户端组件，因为使用了浏览器API和React Hooks

// 导入动画库 Framer Motion，用于实现平滑的动画效果
import { motion } from 'framer-motion';

// 从 lucide-react 导入图标组件
// PanelLeftClose/PanelLeftOpen: 左侧边栏关闭/打开图标
// PanelRightClose/PanelRightOpen: 右侧边栏关闭/打开图标
// Sparkles: 闪光/星星图标，用于Logo
// BookOpen: 书本图标，用于文档按钮
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  BookOpen,
} from 'lucide-react';

// 导入全局状态管理 store，用于获取和修改应用状态
import { useAppStore } from '@/store/app-store';

// 导入 UI 按钮组件
import { Button } from '@/components/ui/button';

// 导入工具函数，用于合并 CSS 类名
import { cn } from '@/lib/utils';

/**
 * Header 组件 - 顶部导航栏
 * 
 * @returns JSX.Element 返回顶部导航栏的 JSX 元素
 */
export function Header() {
  /**
   * 从全局状态 store 中解构获取以下状态和操作方法：
   * - sidebarOpen: 左侧文档面板是否打开（布尔值）
   * - toggleSidebar: 切换左侧文档面板显示状态的方法
   * - configPanelOpen: 右侧配置面板是否打开（布尔值）
   * - toggleConfigPanel: 切换右侧配置面板显示状态的方法
   * - theme: 当前主题（'light' 或 'dark'）
   */
  const {
    sidebarOpen,        // 左侧边栏的展开状态
    toggleSidebar,      // 切换左侧边栏的方法
    configPanelOpen,    // 右侧配置面板的展开状态
    toggleConfigPanel,  // 切换右侧配置面板的方法
    theme,              // 当前主题（虽然这里没用到，但保留了扩展性）
  } = useAppStore();

  return (
    /**
     * motion.header - 使用 Framer Motion 的动画 header 元素
     * 
     * initial={{ y: -20, opacity: 0 }} - 初始状态：从上方20像素处、透明度为0开始
     * animate={{ y: 0, opacity: 1 }} - 动画结束状态：移动到正常位置、透明度为1
     * transition={{ duration: 0.3 }} - 动画持续时间为0.3秒
     * 
     * 样式说明：
     * - h-14: 高度为3.5rem (56像素)
     * - border-b: 底部边框
     * - flex items-center justify-between: 弹性布局，垂直居中，两端对齐
     * - px-4: 水平方向内边距1rem
     * - shrink-0: 不允许被压缩
     * - glass: 自定义类，实现毛玻璃效果
     * - z-50: 层级为50，确保在最上层
     */
    <motion.header
      initial={{ y: -20, opacity: 0 }}  // 初始动画状态：从上方滑入
      animate={{ y: 0, opacity: 1 }}     // 最终动画状态：完全显示
      transition={{ duration: 0.3 }}     // 动画过渡时间0.3秒
      className={cn(
        'h-14 border-b flex items-center justify-between px-4 shrink-0',
        'glass z-50'  // glass是自定义CSS类，实现毛玻璃背景效果
      )}
    >
      {/* 
        ==================== 左侧区域 ====================
        包含：侧边栏切换按钮 + 应用Logo和标题
        w-[200px]: 固定宽度，与右侧对称，使中间区域居中
      */}
      <div className="flex items-center gap-3 w-[200px]">
        
        {/* 
          左侧边栏切换按钮
          点击时会调用 toggleSidebar 方法来切换左侧文档面板的显示/隐藏
          title属性提供鼠标悬停时的提示文本
        */}
        <Button
          variant="ghost"      // 幽灵按钮样式，背景透明
          size="icon"          // 图标按钮尺寸
          className="h-8 w-8"  // 固定宽高为32像素
          onClick={toggleSidebar}  // 点击事件：切换侧边栏
          title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}  // 悬停提示
        >
          {/* 根据 sidebarOpen 状态条件渲染不同图标 */}
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />   // 侧边栏打开时显示关闭图标
          ) : (
            <PanelLeftOpen className="h-4 w-4" />    // 侧边栏关闭时显示打开图标
          )}
        </Button>

        {/* 
          应用Logo和品牌区域
          包含：渐变背景的Logo图标 + 应用名称和副标题
        */}
        <div className="flex items-center gap-2">
          {/* 
            Logo图标容器
            使用渐变背景色（从紫罗兰色到粉色）
            w-7 h-7: 28x28像素
            rounded-lg: 圆角
          */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />  {/* 白色闪光图标 */}
          </div>
          
          {/* 
            应用标题和副标题
            hidden sm:block: 在小屏幕隐藏，中等屏幕以上显示
          */}
          <div className="hidden sm:block">
            {/* 主标题：使用渐变文字效果 */}
            <h1 className="font-bold text-sm gradient-text">RAG AI Platform</h1>
            {/* 副标题：小字、灰色、向上偏移 */}
            <p className="text-[10px] text-muted-foreground -mt-0.5">企业级知识库</p>
          </div>
        </div>
      </div>

      {/* 
        ==================== 中间区域 ====================
        包含：导航链接（文档按钮等）
        hidden md:flex: 在中等屏幕以下隐藏，以上显示
        flex-1: 占据剩余空间
        justify-center: 居中对齐，与下方欢迎界面对齐
      */}
      <div className="hidden md:flex flex-1 items-center justify-center gap-6">
        <nav className="flex items-center gap-1">
          {/* 文档按钮 */}
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />  {/* 书本图标 */}
            文档
          </Button>
        </nav>
      </div>

      {/* 
        ==================== 右侧区域 ====================
        包含：右侧配置面板切换按钮
        w-[200px]: 固定宽度，与左侧对称，使中间区域居中
        justify-end: 内容右对齐
      */}
      <div className="flex items-center justify-end gap-2 w-[200px]">
        {/* 
          右侧配置面板切换按钮
          点击时会调用 toggleConfigPanel 方法来切换右侧配置面板的显示/隐藏
        */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleConfigPanel}  // 点击事件：切换配置面板
          title={configPanelOpen ? '收起配置' : '展开配置'}  // 悬停提示
        >
          {/* 根据 configPanelOpen 状态条件渲染不同图标 */}
          {configPanelOpen ? (
            <PanelRightClose className="h-4 w-4" />   // 配置面板打开时显示关闭图标
          ) : (
            <PanelRightOpen className="h-4 w-4" />    // 配置面板关闭时显示打开图标
          )}
        </Button>
      </div>
    </motion.header>
  );
}
