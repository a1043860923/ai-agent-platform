/**
 * 聊天窗口组件 - ChatWindow
 * 
 * 这个组件是中间的聊天窗口，负责：
 * 1. 显示用户和AI的消息对话
 * 2. 提供消息输入框和发送功能
 * 3. 实现流式响应（打字机效果）
 * 4. 显示AI的思考过程和参考来源
 * 5. 欢迎界面和快捷问题建议
 * 
 * 包含两个子组件：
 * - MessageBubble: 单个消息气泡
 * - WelcomeScreen: 欢迎界面
 */

'use client'; // 标记为客户端组件

// 导入 React 核心 hooks
// useState: 管理组件状态
// useRef: 获取DOM引用
// useEffect: 副作用处理
// useCallback: 缓存回调函数
// memo: 组件记忆化，避免不必要的重渲染
import { useState, useRef, useEffect, useCallback, memo } from 'react';

// 导入 Framer Motion 动画库
import { motion, AnimatePresence } from 'framer-motion';

// 从 lucide-react 导入图标组件
// Send: 发送图标
// Bot: 机器人图标
// User: 用户图标
// Sparkles: 闪光图标
// RefreshCw: 刷新图标
// Copy: 复制图标
// Check: 勾选图标
// ChevronDown/ChevronUp: 下/上箭头（展开/收起）
// FileText: 文件文本图标
// Zap: 闪电图标（思考过程）
// Brain: 大脑图标（深度思考）
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  Loader2,
  Globe,
  Brain,
} from 'lucide-react';

// 导入全局状态管理和类型定义
import { useAppStore, Message } from '@/store/app-store';

// 导入 UI 组件
import { Button } from '@/components/ui/button';           // 按钮组件
import { Textarea } from '@/components/ui/textarea';       // 多行文本输入框
import { Avatar, AvatarFallback } from '@/components/ui/avatar';  // 头像组件
import { Badge } from '@/components/ui/badge';             // 徽章组件

// 导入工具函数
import { cn } from '@/lib/utils';

/**
 * 消息气泡组件 - MessageBubble
 * 
 * 渲染单条消息，包括：
 * - 用户/AI头像
 * - 发送者名称和时间
 * - 思考过程（千问风格：在时间下方，回答上方）
 * - 消息内容（支持打字机效果）
 * - 复制按钮
 * - 参考来源（可展开）
 * 
 * 使用 memo 包装，只有当 message 或 isStreaming 变化时才重新渲染
 * 避免父组件状态变化导致所有消息气泡重新渲染
 * 
 * @param message - 消息对象
 * @param isStreaming - 是否正在流式输出
 * @param isThinking - 是否正在思考中（思考过程中隐藏回答）
 * @param enableThinking - 是否启用思考过程显示
 * @param onThinkingFolded - 思考过程折叠完成后的回调
 * @param onThinkingContentChange - 思考过程内容变化时的回调（用于触发页面滚动）
 */
const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
  isThinking,
  enableThinking,
  onThinkingFolded,
  onThinkingContentChange,
}: {
  message: Message;
  isStreaming: boolean;
  isThinking: boolean;
  enableThinking: boolean;
  onThinkingFolded?: () => void;
  onThinkingContentChange?: () => void;
}) {
  // copied: 是否已复制消息内容（用于显示复制成功状态）
  const [copied, setCopied] = useState(false);
  // showSources: 是否显示参考来源
  const [showSources, setShowSources] = useState(false);
  // showThinking: 是否展开思考过程
  const [showThinking, setShowThinking] = useState(true);
  // thinkingFolded: 思考过程是否已经折叠完成
  const [thinkingFolded, setThinkingFolded] = useState(false);

  // 判断消息是否来自用户
  const isUser = message.role === 'user';

  // thinkingRef: 思考过程内容区域的引用，用于自动滚动
  const thinkingRef = useRef<HTMLPreElement>(null);

  /**
   * 副作用：当正在流式输出且思考内容更新时，自动展开思考过程
   */
  useEffect(() => {
    if (isStreaming && message.thinking && !showThinking) {
      setShowThinking(true);
    }
  }, [isStreaming, message.thinking, showThinking]);

  // 使用 ref 存储上一帧的思考内容长度，用于检测变化
  const lastThinkingLengthRef = useRef(0);

  /**
   * 副作用：思考过程中使用 requestAnimationFrame 持续滚动到底部
   * 确保滚动紧跟内容更新，不延迟
   */
  useEffect(() => {
    if (!isThinking || !thinkingRef.current || !showThinking) return;

    let rafId: number;
    const container = thinkingRef.current.parentElement;
    if (!container) return;

    const scrollToBottom = () => {
      // 检测思考内容是否有变化
      const currentLength = message.thinking?.length || 0;
      if (currentLength !== lastThinkingLengthRef.current) {
        lastThinkingLengthRef.current = currentLength;
        // 立即滚动到底部
        container.scrollTop = container.scrollHeight;
        // 同时触发页面滚动
        onThinkingContentChange?.();
      }
      // 继续下一帧检测
      rafId = requestAnimationFrame(scrollToBottom);
    };

    // 启动滚动循环
    rafId = requestAnimationFrame(scrollToBottom);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isThinking, showThinking, message.thinking, onThinkingContentChange]);

  /**
   * 副作用：思考开始时立即滚动到底部
   * 当思考开始时，立即滚动到思考区域底部
   */
  useEffect(() => {
    if (isThinking && thinkingRef.current && showThinking) {
      const container = thinkingRef.current.parentElement;
      if (container) {
        // 重置长度记录
        lastThinkingLengthRef.current = message.thinking?.length || 0;
        // 立即滚动到底部
        container.scrollTop = container.scrollHeight;
        // 触发页面滚动
        onThinkingContentChange?.();
      }
    }
  }, [isThinking, showThinking, message.thinking, onThinkingContentChange]);

  /**
   * 副作用：思考完毕后自动折叠思考过程
   * 当思考结束（isThinking从true变为false）且有思考内容时，延迟后折叠
   */
  useEffect(() => {
    // 如果之前正在思考，现在不思考了（思考完成），且有思考内容，且还未折叠
    if (!isThinking && message.thinking && showThinking && !thinkingFolded) {
      // 延迟800毫秒后自动折叠
      const timer = setTimeout(() => {
        setShowThinking(false);
        setThinkingFolded(true);
        // 通知父组件思考过程已折叠
        onThinkingFolded?.();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isThinking, message.thinking, showThinking, thinkingFolded, onThinkingFolded]);

  /**
   * 副作用：当新的思考开始时，重置折叠状态
   */
  useEffect(() => {
    if (isThinking) {
      setThinkingFolded(false);
    }
  }, [isThinking]);

  /**
   * 处理复制消息内容
   * 使用 Clipboard API 复制文本到剪贴板
   */
  const handleCopy = async () => {
    // 写入剪贴板
    await navigator.clipboard.writeText(message.content);
    // 设置已复制状态
    setCopied(true);
    // 2秒后恢复未复制状态
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    // 消息容器，使用 Framer Motion 实现入场动画
    <motion.div
      initial={{ opacity: 0, y: 20 }}    // 初始状态：透明，向下偏移20px
      animate={{ opacity: 1, y: 0 }}     // 动画到：不透明，正常位置
      transition={{ duration: 0.3, ease: 'easeOut' }}  // 动画配置
      // 根据发送者调整布局方向：用户右对齐，AI左对齐
      className={cn('flex gap-4 p-4', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/*
        头像组件
        用户：使用蓝色渐变背景，代表用户身份
        AI：使用紫粉渐变背景，配合光晕效果，更有科技感
      */}
      <Avatar className={cn(
        'h-8 w-8 shrink-0 ring-2 ring-offset-2 ring-offset-background',
        isUser
          ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 ring-blue-500/30'
          : 'bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 ring-purple-500/30 shadow-lg shadow-purple-500/20'
      )}>
        <AvatarFallback className="text-xs text-white bg-transparent">
          {/* 根据发送者显示不同图标 */}
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* 消息内容区域 */}
      <div className={cn('flex flex-col gap-2 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        {/* 消息头部：发送者名称 + 时间 + 状态 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? '您' : 'AI 助手'}
          </span>
          <span className="text-xs text-muted-foreground">
            {/* 格式化时间，只显示时和分 */}
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {/* 如果消息正在发送中，显示提示 */}
          {message.status === 'sending' && (
            <span className="text-xs text-muted-foreground animate-pulse">发送中...</span>
          )}
        </div>

        {/*
          思考过程展开区域（千问风格：放在时间下方，回答上方）
          如果消息包含思考过程且启用了深度思考，显示展开按钮
        */}
        {!isUser && message.thinking && enableThinking && (
          <div className="w-full">
            {/* 展开/收起按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setShowThinking(!showThinking)}
            >
              <Zap className={cn("h-3 w-3", isThinking && "animate-pulse text-purple-500")} />
              <span className={cn(isThinking && "text-purple-600")}>
                {isThinking ? '深度思考中...' : '思考过程'}
              </span>
              {/* 根据展开状态显示不同箭头 */}
              {showThinking ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            {/* 使用 AnimatePresence 实现展开/收起动画 */}
            <AnimatePresence>
              {showThinking && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}    // 初始：高度0，透明
                  animate={{ height: 'auto', opacity: 1 }} // 动画：自适应高度，不透明
                  exit={{ height: 0, opacity: 0 }}        // 退出：高度0，透明
                  className="overflow-hidden"
                >
                  {/* 思考过程内容，使用等宽字体 */}
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs font-mono text-muted-foreground border border-border max-h-[200px] overflow-y-auto">
                    <pre ref={thinkingRef} className="whitespace-pre-wrap">{message.thinking?.replace(/^\n+/, '')}</pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/*
          消息气泡
          使用不同的样式类区分用户和AI
          用户：右上角小圆角（message-bubble-user）
          AI：左上角小圆角（message-bubble-assistant）
          状态消息：使用特殊的样式（带加载动画）
          思考中或思考未折叠完成时：完全隐藏回答框（仅当启用深度思考且消息有思考过程时）
        */}
        {(isUser || !enableThinking || !message.thinking || (!isThinking && thinkingFolded)) && (
          <div
            className={cn(
              'relative group rounded-2xl px-4 py-3 text-sm leading-relaxed',
              isUser
                ? 'message-bubble-user rounded-tr-sm'
                : message.isStatus
                  ? 'bg-muted/50 border border-dashed border-muted-foreground/30 text-muted-foreground italic'
                  : 'message-bubble-assistant rounded-tl-sm'
            )}
          >
            {/* 消息内容，保留换行符 */}
            <div className="whitespace-pre-wrap break-words">
              {/* 状态消息显示加载动画 */}
              {message.isStatus && (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {message.content}
                </span>
              )}
              {/* 显示消息内容（思考中或思考未折叠完成时不显示AI回答） */}
              {!message.isStatus && message.content}
              {/* 如果正在流式输出但没有内容，显示加载中提示 */}
              {isStreaming && !isUser && !message.isStatus && !message.content && (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  思考中...
                </span>
              )}
              {/* 如果正在流式输出且有内容，显示闪烁光标 */}
              {isStreaming && !isUser && !message.isStatus && message.content && (
                <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
              )}
            </div>

            {/* 
              复制按钮（仅AI消息显示）
              绝对定位在气泡下方
              默认透明，悬停时显示
            */}
            {!isUser && (
              <div className="absolute -bottom-8 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                  {/* 根据 copied 状态显示不同图标 */}
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
          </div>
        )}

        {/*
          参考来源展开区域
          如果消息包含参考来源，显示展开按钮（思考折叠完成后或没有思考过程时才显示）
        */}
        {message.sources && message.sources.length > 0 && (!isThinking && (thinkingFolded || !message.thinking)) && (
          <div className="w-full">
            {/* 展开/收起按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setShowSources(!showSources)}
            >
              <FileText className="h-3 w-3" />
              参考来源 ({message.sources.length})
              {/* 根据展开状态显示不同箭头 */}
              {showSources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            {/* 使用 AnimatePresence 实现展开/收起动画 */}
            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {/* 来源列表 */}
                  <div className="mt-2 space-y-2">
                    {message.sources.map((source, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-muted/50 text-xs border border-border"
                      >
                        {/* 来源标题和相似度 */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-foreground">{source.documentTitle}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            相似度: {(source.similarity * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        {/* 来源内容预览 */}
                        <p className="text-muted-foreground line-clamp-2">{source.content}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
});

/**
 * 欢迎界面组件 - WelcomeScreen
 * 
 * 当没有消息时显示的欢迎界面，包含：
 * - 应用Logo和标题
 * - 功能介绍
 * - 快捷问题建议（点击自动填入输入框）
 * 
 * @param onSuggestionClick - 点击建议时的回调函数
 */
function WelcomeScreen({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  // 预定义的快捷问题建议列表
  const suggestions = [
    '帮我总结一下这份文档的主要内容',
    '这份文档中有哪些关键数据？',
    '根据文档内容，给我一些建议',
    '解释一下文档中的专业术语',
  ];

  return (
    // 欢迎界面容器，使用 Framer Motion 实现入场动画
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}  // 初始：透明，轻微缩小
      animate={{ opacity: 1, scale: 1 }}     // 动画：不透明，正常大小
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center h-full px-8"
    >
      {/* Logo图标，使用渐变背景 */}
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/25">
        <Sparkles className="h-10 w-10 text-white" />
      </div>
      {/* 标题，使用渐变文字效果 */}
      <h1 className="text-2xl font-bold mb-2 gradient-text">AI 知识库助手</h1>
      {/* 功能介绍 */}
      <p className="text-muted-foreground text-center max-w-md mb-8">
        基于 RAG 技术，我可以帮您快速检索和理解文档内容。
        <br />
        上传文档，开始智能问答。
      </p>

      {/* 快捷问题建议网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {suggestions.map((suggestion, idx) => (
          <motion.button
            key={idx}
            initial={{ opacity: 0, y: 10 }}    // 依次从下方滑入
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}  // 每个延迟0.1秒
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(0,0,0,0.02)' }}  // 悬停效果
            whileTap={{ scale: 0.98 }}         // 点击时缩小
            onClick={() => onSuggestionClick(suggestion)}  // 点击时调用回调
            className="p-4 text-left text-sm rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 transition-all"
          >
            {suggestion}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * 主组件 - ChatWindow
 * 
 * 聊天窗口的主要逻辑，包括：
 * - 消息列表管理
 * - 用户输入处理
 * - API调用和流式响应
 * - 自动滚动和输入框高度调整
 * - 思考过程显示（千问风格：输入框上方，思考中隐藏回答）
 */
export default function ChatWindow() {
  // 从全局状态获取消息列表、添加消息函数、更新消息函数、清空消息函数
  const { messages, addMessage, updateMessage, clearMessages, config } = useAppStore();
  // input: 输入框的当前值
  const [input, setInput] = useState('');
  // isLoading: 是否正在加载AI响应
  const [isLoading, setIsLoading] = useState(false);
  // isThinking: 是否正在思考中（用于控制回答显示）
  const [isThinking, setIsThinking] = useState(false);
  // scrollRef: 滚动区域的引用，用于自动滚动
  const scrollRef = useRef<HTMLDivElement>(null);
  // textareaRef: 文本输入框的引用，用于自动调整高度
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // userScrolling: 用户是否正在主动滚动
  const userScrollingRef = useRef(false);
  // scrollTimeout: 滚动检测的定时器
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 处理用户滚动事件
   * 检测用户是否主动滚动，如果是则暂停自动滚动
   */
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // 判断是否滚动到底部（允许50px误差，给内容变化留出空间）
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    console.log('[Scroll Debug] handleScroll - scrollTop:', scrollTop, 'scrollHeight:', scrollHeight, 'clientHeight:', clientHeight, 'isAtBottom:', isAtBottom, 'userScrolling:', userScrollingRef.current);

    // 如果用户不在底部，标记为用户正在滚动
    if (!isAtBottom) {
      userScrollingRef.current = true;

      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 2秒后恢复自动滚动
      scrollTimeoutRef.current = setTimeout(() => {
        userScrollingRef.current = false;
        console.log('[Scroll Debug] userScrolling reset to false after 2s timeout');
      }, 2000);
    } else {
      // 用户滚动到底部，恢复自动滚动
      userScrollingRef.current = false;
    }
  }, []);

  /**
   * 副作用：自动滚动到底部
   * 当消息列表变化时，滚动到最新消息
   * 使用 setTimeout 确保 DOM 完全渲染后再滚动
   * 只在用户没有主动滚动时执行
   */
  useEffect(() => {
    console.log('[Scroll Debug] messages changed, userScrolling:', userScrollingRef.current, 'messages count:', messages.length);
    if (!scrollRef.current || userScrollingRef.current) {
      console.log('[Scroll Debug] skipped: no scrollRef or user is scrolling');
      return;
    }

    // 使用 setTimeout 确保 React 完成渲染，DOM 元素已完全布局
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const scrollTop = scrollRef.current.scrollTop;
        const scrollHeight = scrollRef.current.scrollHeight;
        const clientHeight = scrollRef.current.clientHeight;
        console.log('[Scroll Debug] before scroll - scrollTop:', scrollTop, 'scrollHeight:', scrollHeight, 'clientHeight:', clientHeight);
        // 强制滚动到底部，使用最新的 scrollHeight
        const targetScrollTop = scrollRef.current.scrollHeight;
        scrollRef.current.scrollTo({
          top: targetScrollTop,
          behavior: 'auto'
        });
        console.log('[Scroll Debug] after scroll - scrollTop:', scrollRef.current.scrollTop, 'target was:', targetScrollTop);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  /**
   * 副作用：流式输出期间持续滚动
   * 使用 requestAnimationFrame 确保平滑滚动
   * 在消息生成期间持续滚动到底部
   * 只在用户没有主动滚动时执行
   */
  useEffect(() => {
    let rafId: number | null = null;
    let lastContent = '';

    const scrollToBottom = () => {
      // 如果用户正在滚动，不执行自动滚动
      if (userScrollingRef.current) {
        rafId = requestAnimationFrame(scrollToBottom);
        return;
      }

      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'auto'
        });
      }

      // 检查是否还在生成中（内容在变化）
      const lastMessage = messages[messages.length - 1];
      const isGenerating = lastMessage?.role === 'assistant' &&
        !lastMessage?.isStatus &&
        (isLoading || lastMessage?.content !== lastContent);

      if (isGenerating) {
        lastContent = lastMessage?.content || '';
        rafId = requestAnimationFrame(scrollToBottom);
      }
    };

    // 当有消息且最后一条是AI消息时开始滚动
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && !lastMessage?.isStatus) {
      rafId = requestAnimationFrame(scrollToBottom);
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [messages, isLoading]);

  /**
   * 清理滚动检测定时器
   */
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  /**
   * 副作用：自动调整输入框高度
   * 当输入内容变化时，根据内容高度调整输入框
   */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  /**
   * 调用后端API获取AI响应
   * 支持流式输出（SSE）和非流式输出两种模式
   * 
   * @param userMessage - 用户发送的消息内容
   */
  const simulateResponse = useCallback(async (userMessage: string) => {
    // 设置加载状态
    setIsLoading(true);
    // 重置思考状态
    setIsThinking(config.enableThinking);

    // 生成唯一的消息ID
    const responseId = crypto.randomUUID();

    try {
      // 获取当前消息列表（用于发送给API）
      const currentMessages = useAppStore.getState().messages;

      // 调用API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...currentMessages, { role: 'user', content: userMessage }]
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content })),
          config: {
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            enableRAG: config.enableRAG,
            enableTools: config.enableTools,
            tools: config.enableTools ? useAppStore.getState().tools.filter(t => t.enabled).map(t => t.id) : [],
            enableStreaming: config.enableStreaming,
            enableThinking: config.enableThinking,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type') || '';
      const isStreamResponse = contentType.includes('text/event-stream');

      if (isStreamResponse && config.enableStreaming) {
        // 流式响应处理
        addMessage({
          id: responseId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        });
        setIsLoading(false);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let currentThinking = '';
        let sources: any[] = [];
        let thinkingEnded = false;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'content' && data.token) {
                    fullContent += data.token;
                    useAppStore.getState().updateMessage(responseId, {
                      content: fullContent,
                      isStatus: false  // 收到内容时，将状态消息标记为普通消息
                    });
                    // 收到正式内容，思考结束
                    if (!thinkingEnded && config.enableThinking) {
                      thinkingEnded = true;
                      setIsThinking(false);
                    }
                  } else if (data.type === 'thinking' && data.token) {
                    // 收集思考过程
                    currentThinking += data.token;
                    useAppStore.getState().updateMessage(responseId, {
                      thinking: currentThinking,
                      isStatus: false
                    });
                  } else if (data.type === 'thinking_complete' && data.thinking) {
                    // 思考过程完成，更新完整的思考内容
                    currentThinking = data.thinking;
                    useAppStore.getState().updateMessage(responseId, {
                      thinking: data.thinking,
                      isStatus: false
                    });
                    // 思考完成标记
                    thinkingEnded = true;
                    setIsThinking(false);
                  } else if (data.type === 'sources' && data.sources) {
                    sources = data.sources.map((s: any) => ({
                      documentId: s.documentId || '',
                      documentTitle: s.documentTitle || '未知文档',
                      content: s.content || '',
                      similarity: s.similarity || 0,
                    }));
                    useAppStore.getState().updateMessage(responseId, { sources });
                  } else if (data.type === 'status' && data.message) {
                    useAppStore.getState().updateMessage(responseId, {
                      content: data.message,
                      isStatus: true
                    });
                  } else if (data.type === 'tools' && data.toolsUsed) {
                    useAppStore.getState().updateMessage(responseId, {
                      toolsUsed: data.toolsUsed,
                      isStatus: false
                    });
                  } else if (data.type === 'done') {
                    // 完成
                    setIsThinking(false);
                  } else if (data.type === 'error') {
                    console.error('流式输出错误:', data.message);
                    setIsThinking(false);
                  }
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }
        }
      } else {
        // 非流式响应处理
        const data = await response.json();
        setIsLoading(false);
        setIsThinking(false);

        addMessage({
          id: responseId,
          role: 'assistant',
          content: data.answer || '抱歉，无法生成回答。',
          timestamp: new Date(),
          thinking: data.thinking,
          sources: data.sources?.map((s: any) => ({
            documentId: s.documentId || '',
            documentTitle: s.documentTitle || '未知文档',
            content: s.content || '',
            similarity: s.similarity || 0,
          })),
        });
      }
    } catch (error) {
      console.error('获取AI响应失败:', error);
      setIsLoading(false);
      setIsThinking(false);
      
      addMessage({
        id: responseId,
        role: 'assistant',
        content: '抱歉，获取回答时出现错误，请稍后重试。',
        timestamp: new Date(),
      });
    }
  }, [config, addMessage]);

  /**
   * 处理发送消息
   * 当用户点击发送按钮或按回车键时调用
   */
  const handleSend = useCallback(async () => {
    // 如果输入为空或正在加载，不执行任何操作
    if (!input.trim() || isLoading) return;

    // 获取输入内容并清空输入框
    const userMessage = input.trim();
    setInput('');

    // 添加用户消息到消息列表
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // 重置用户滚动状态，确保自动滚动生效
    userScrollingRef.current = false;
    console.log('[Scroll Debug] handleSend: reset userScrolling to false');

    // 使用 setTimeout 确保 React 完成渲染，DOM 元素已完全布局
    // 100ms 确保 React 完成渲染和布局计算
    setTimeout(() => {
      if (scrollRef.current) {
        const scrollTop = scrollRef.current.scrollTop;
        const scrollHeight = scrollRef.current.scrollHeight;
        const clientHeight = scrollRef.current.clientHeight;
        console.log('[Scroll Debug] handleSend scroll - scrollTop:', scrollTop, 'scrollHeight:', scrollHeight, 'clientHeight:', clientHeight);
        // 强制滚动到底部，使用最新的 scrollHeight
        const targetScrollTop = scrollRef.current.scrollHeight;
        scrollRef.current.scrollTo({
          top: targetScrollTop,
          behavior: 'auto'
        });
        console.log('[Scroll Debug] handleSend after scroll - scrollTop:', scrollRef.current.scrollTop, 'target was:', targetScrollTop);
      }
    }, 100);

    // 调用API获取AI响应
    await simulateResponse(userMessage);
  }, [input, isLoading, addMessage, simulateResponse]);

  /**
   * 处理键盘事件
   * 当用户在输入框中按键时调用
   * 支持回车键发送（Shift+回车换行）
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 如果按下回车键且没有按住Shift键，发送消息
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();  // 阻止默认的换行行为
      handleSend();        // 调用发送函数
    }
  }, [handleSend]);

  /**
   * 处理快捷建议点击
   * 当用户点击欢迎界面的快捷问题时调用
   */
  const handleSuggestionClick = useCallback((text: string) => {
    setInput(text);  // 将建议文本填入输入框
  }, []);

  // 判断是否正在流式输出（最后一条消息是AI消息且正在生成，且思考已折叠）
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const isLastAssistant = lastMessage?.role === 'assistant';
  const isStreaming = isLoading || (isLastAssistant && !lastMessage?.isStatus && lastMessage?.content === '');

  /**
   * 处理思考过程内容变化时的页面滚动
   * 当思考过程超出页面时触发页面自动往下滚动
   */
  const handleThinkingContentChange = useCallback(() => {
    // 如果用户正在主动滚动，不执行自动滚动
    if (userScrollingRef.current) return;
    
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'auto'
      });
    }
  }, []);

  return (
    // 聊天窗口容器，使用 flex 布局
    <div className="flex flex-col h-full">
      {/*
        消息列表区域
        使用原生 div 实现可滚动，更可靠的滚动控制
        添加 onScroll 事件监听用户滚动
      */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
      >
        <div className={cn(
          "flex flex-col",
          messages.length === 0 ? "h-full justify-center min-h-full" : "min-h-full"
        )}>
          {/* 如果没有消息，显示欢迎界面 */}
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
          ) : (
            // 否则显示消息列表
            <>
              {messages.map((message, idx) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  // 只有最后一条AI消息才显示流式状态
                  isStreaming={isStreaming && idx === messages.length - 1 && message.role === 'assistant'}
                  // 传递思考中状态
                  isThinking={isThinking && idx === messages.length - 1 && message.role === 'assistant'}
                  // 传递深度思考配置
                  enableThinking={config.enableThinking}
                  // 思考过程内容变化时触发页面滚动
                  onThinkingContentChange={idx === messages.length - 1 && message.role === 'assistant' ? handleThinkingContentChange : undefined}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* 
        输入区域
        固定在底部，参考 ChatGPT/Claude 等设计
      */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur-xl p-4">
        <div className="max-w-4xl mx-auto">
          {/* 输入框容器 - 带边框和阴影 */}
          <div className={cn(
            'relative flex flex-col gap-2 rounded-2xl border bg-card p-3',
            'shadow-lg shadow-black/5',
            'focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20',
            'transition-all'
          )}>
            {/* 多行文本输入框 */}
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的问题...（Shift+回车换行）"
              className="flex-1 min-h-[60px] max-h-[300px] resize-none border-0 bg-transparent px-2 py-1 text-base focus-visible:ring-0"
            />

            {/* 底部工具栏 */}
            <div className="flex items-center justify-between">
              {/* 左侧工具按钮 */}
              <div className="flex items-center gap-1">
                {/* 深度思考开关 - 只在glm-Z1-flash模型时显示 */}
                {config.model === 'glm-Z1-flash' && (
                  <Button
                    variant={config.enableThinking ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-8 gap-1.5 text-xs rounded-lg',
                      config.enableThinking && 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                    )}
                    onClick={() => useAppStore.getState().updateConfig({ enableThinking: !config.enableThinking })}
                    title="显示AI的思考过程"
                  >
                    <Brain className="h-3.5 w-3.5" />
                    深度思考
                    {config.enableThinking && <Check className="h-3 w-3" />}
                  </Button>
                )}

                {/* 联网搜索开关 */}
                <Button
                  variant={config.enableTools ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 text-xs rounded-lg',
                    config.enableTools && 'bg-primary/10 text-primary hover:bg-primary/20'
                  )}
                  onClick={() => useAppStore.getState().updateConfig({ enableTools: !config.enableTools })}
                >
                  <Globe className="h-3.5 w-3.5" />
                  联网搜索
                  {config.enableTools && <Check className="h-3 w-3" />}
                </Button>

                {/* 清空对话按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs rounded-lg"
                  onClick={clearMessages}
                  disabled={messages.length === 0 || isLoading}
                  title="清空对话"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  清空
                </Button>
              </div>

              {/* 右侧发送按钮 */}
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="h-8 px-4 rounded-lg"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1.5" />
                    发送
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 底部提示文字 */}
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            AI 生成内容仅供参考，请核实重要信息
          </p>
        </div>
      </div>
    </div>
  );
}
