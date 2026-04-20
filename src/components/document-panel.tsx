/**
 * 文档面板组件 - DocumentPanel
 * 
 * 这个组件是左侧的文档管理面板，负责：
 * 1. 显示知识库中的文档列表（从向量数据库加载）
 * 2. 提供文件上传功能（拖拽和点击）
 * 3. 文档搜索过滤
 * 4. 文档删除操作
 * 5. 存储空间统计
 * 
 * 布局结构：
 * - 顶部：标题和关闭按钮
 * - 中部：搜索框 + 文档列表
 * - 底部：存储统计 + 上传按钮
 */

'use client'; // 标记为客户端组件

// 导入 React 核心 hooks
// useState: 管理组件内部状态
// useRef: 获取DOM引用
// useCallback: 缓存回调函数，避免重复创建
// useEffect: 副作用处理
import { useState, useRef, useCallback, useEffect } from 'react';

// 导入 Framer Motion 动画库
import { motion, AnimatePresence } from 'framer-motion';

// 从 lucide-react 导入图标组件
import {
  FileText,
  Upload,
  X,
  MoreVertical,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  File,
  BookOpen,
  Database,
  Search,
} from 'lucide-react';

// 导入 UI 组件
import { Button } from '@/components/ui/button';           // 按钮组件
import { Input } from '@/components/ui/input';             // 输入框组件
import { ScrollArea } from '@/components/ui/scroll-area';  // 滚动区域
import { Badge } from '@/components/ui/badge';             // 徽章组件
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';                     // 下拉菜单

// 导入自定义对话框组件（用于显示错误信息）
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// 导入工具函数
import { cn } from '@/lib/utils';

// 导入全局状态管理
import { useAppStore } from '@/store/app-store';

/**
 * 格式化文件大小
 * 将字节数转换为人类可读的格式（B、KB、MB、GB）
 * 
 * @param bytes - 文件大小（字节）
 * @returns 格式化后的字符串，如 "1.5 MB"
 */
function formatFileSize(bytes: number): string {
  // 如果小于1KB，直接显示字节数
  if (bytes < 1024) return bytes + ' B';
  // 如果小于1MB，显示KB（保留1位小数）
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  // 如果小于1GB，显示MB（保留1位小数）
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  // 否则显示GB（保留1位小数）
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * 主组件 - DocumentPanel
 */
export default function DocumentPanel() {
  /**
   * 从全局状态获取：
   * - sidebarOpen: 侧边栏是否打开
   * - toggleSidebar: 切换侧边栏的函数
   * - documents: 文档列表
   * - addDocument: 添加文档的函数
   * - removeDocument: 删除文档的函数
   */
  const { sidebarOpen, toggleSidebar } = useAppStore();

  /**
   * 本地状态定义
   */
  // searchQuery: 搜索关键词，用于过滤文档列表
  const [searchQuery, setSearchQuery] = useState('');

  // isDragging: 是否正在拖拽文件到上传区域
  const [isDragging, setIsDragging] = useState(false);

  // fileInputRef: 文件输入框的DOM引用，用于触发文件选择对话框
  const fileInputRef = useRef<HTMLInputElement>(null);

  // errorDialog: 错误对话框状态
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  });

  // selectedDoc: 当前选中的文档（用于查看文本块）
  const [selectedDoc, setSelectedDoc] = useState<{
    id: string;
    title: string;
    chunks: Array<{ content: string; metadata: any }>;
  } | null>(null);
  
  // isLoadingChunks: 是否正在加载文本块
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // documents: 从向量数据库加载的文档列表
  const [documents, setDocuments] = useState<Array<{
    id: string;
    title: string;
    chunkCount: number;
    uploadedAt: string;
    size?: number;
  }>>([]);
  
  // isLoading: 是否正在加载文档
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 加载文档列表的函数
   * 从向量数据库获取已上传的文档列表
   */
  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/documents/list');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('加载文档失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 副作用：组件挂载时加载文档
   */
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  /**
   * 过滤后的文档列表
   * 根据搜索关键词过滤文档，不区分大小写
   */
  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /**
   * 处理文件上传的核心函数
   * 
   * @param files - 用户选择的文件列表
   */
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    // 如果没有文件，直接返回
    if (!files || files.length === 0) return;

    // 遍历每个文件进行处理
    for (const file of Array.from(files)) {
      // 检查文件类型，只允许 .md 和 .pdf
      if (!file.name.endsWith('.md') && !file.name.endsWith('.pdf')) {
        // 显示错误对话框
        setErrorDialog({
          open: true,
          title: '不支持的文件格式',
          message: `文件 "${file.name}" 格式不支持。\n\n目前仅支持以下格式：\n• Markdown (.md)\n• PDF (.pdf)`,
        });
        continue;
      }

      // 检查文件大小，限制为 10MB
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        setErrorDialog({
          open: true,
          title: '文件过大',
          message: `文件 "${file.name}" 大小超过限制。\n\n最大允许大小：10MB\n当前文件大小：${formatFileSize(file.size)}`,
        });
        continue;
      }

      try {
        // 创建 FormData 对象用于文件上传
        const formData = new FormData();
        formData.append('file', file);

        // 调用后端 API 上传文件
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        // 解析响应数据
        const result = await response.json();

        if (result.success) {
          // 上传成功，重新加载文档列表以确保数据同步
          await loadDocuments();
        } else {
          // 上传失败，显示错误
          setErrorDialog({
            open: true,
            title: '文档处理失败',
            message: result.error || '未知错误',
          });
        }
      } catch (error) {
        console.error('上传文件失败:', error);
        setErrorDialog({
          open: true,
          title: '上传失败',
          message: `文件 "${file.name}" 上传失败，请检查网络连接后重试。`,
        });
      }
    }

    // 重置文件输入框，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * 处理拖拽进入上传区域
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * 处理拖拽离开上传区域
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * 处理拖拽悬停（必须阻止默认行为才能接收drop）
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * 处理文件拖放
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    // 调用文件上传处理函数
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  /**
   * 处理点击上传按钮
   */
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * 处理文件选择对话框的选择
   */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
  }, [handleFileUpload]);

  /**
   * 处理删除文档
   */
  const handleRemoveDocument = useCallback(async (docId: string) => {
    try {
      // 调用后端 API 删除文档
      // API 格式: DELETE /api/documents?documentId=xxx
      const response = await fetch(`/api/documents?documentId=${encodeURIComponent(docId)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 从列表中移除
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
      } else {
        console.error('删除文档失败');
      }
    } catch (error) {
      console.error('删除文档失败:', error);
    }
  }, []);

  /**
   * 处理点击文档查看文本块
   */
  const handleViewDocument = useCallback(async (doc: { id: string; title: string }) => {
    setIsLoadingChunks(true);
    try {
      // 调用后端 API 获取文档的文本块
      // 对 ID 进行编码，处理中文等特殊字符
      const encodedId = encodeURIComponent(doc.id);
      const response = await fetch(`/api/documents/${encodedId}/chunks`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDoc({
          id: doc.id,
          title: doc.title,
          chunks: data.chunks || [],
        });
      }
    } catch (error) {
      console.error('加载文本块失败:', error);
    } finally {
      setIsLoadingChunks(false);
    }
  }, []);

  /**
   * 动画变体定义
   * 用于 Framer Motion 的动画效果
   */
  // 容器动画变体：控制子元素的 stagger 效果
  const containerVariants = {
    hidden: { opacity: 0 },    // 初始状态：透明
    visible: {
      opacity: 1,              // 可见状态：不透明
      transition: {
        staggerChildren: 0.05, // 子元素间隔0.05秒依次动画
      },
    },
  };

  // 单项动画变体：每个文档项的动画效果
  const itemVariants = {
    hidden: { opacity: 0, x: -20 },  // 初始：透明，向左偏移20px
    visible: { opacity: 1, x: 0 },   // 可见：不透明，正常位置
  };

  // 计算总存储大小
  const totalSize = documents.reduce((acc, doc) => acc + (doc.size || 0), 0);

  return (
    <>
      {/* 
        ==================== 主面板容器 ====================
        使用 motion.div 实现侧边栏滑入动画
      */}
      <motion.div
        initial={{ x: -320, opacity: 0 }}    // 初始状态：向左偏移320px（隐藏），透明
        animate={{ 
          x: sidebarOpen ? 0 : -320,         // 动画：打开时偏移0，关闭时偏移-320
          opacity: sidebarOpen ? 1 : 0       // 透明度：打开时不透明，关闭时透明
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}  // 弹簧动画效果
        className={cn(
          'h-full w-80 bg-background/95 backdrop-blur-xl',
          'border-r border-border z-40 flex flex-col',
          'shadow-xl shadow-black/5'  // 添加轻微阴影增强层次感
        )}
      >
        {/* 
          ==================== 面板头部 ====================
          包含：标题、文档数量、关闭按钮
        */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {/* 文档图标 */}
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              {/* 面板标题 */}
              <h2 className="font-semibold">知识库文档</h2>
              {/* 文档数量 */}
              <p className="text-xs text-muted-foreground">
                {documents.length} 个文档
              </p>
            </div>
          </div>
          {/* 关闭按钮 */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidebar}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 
          ==================== 搜索框区域 ====================
          用于过滤文档列表
        */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索文档..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* 
          ==================== 上传区域 ====================
          支持拖拽上传和点击上传
        */}
        <div className="px-3 pb-3">
          <div
            // 动态类名：根据拖拽状态改变边框颜色
            className={cn(
              'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all',
              isDragging
                ? 'border-primary bg-primary/5'    // 拖拽中：主题色边框和背景
                : 'border-muted-foreground/20 hover:border-muted-foreground/40'  // 默认：灰色边框
            )}
            // 绑定拖拽事件处理器
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleUploadClick}
          >
            {/* 上传图标 */}
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            {/* 提示文字 */}
            <p className="text-xs text-muted-foreground">
              拖拽文件到此处，或点击上传
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              支持 Markdown (.md) 和 PDF (.pdf)
            </p>
            {/* 隐藏的文件输入框 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* 
          ==================== 文档列表区域 ====================
          使用 ScrollArea 实现可滚动列表
        */}
        <ScrollArea className="flex-1 px-3">
          <AnimatePresence mode="popLayout">
            <div className="space-y-2 pb-4">
              {/* 加载中状态 */}
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground ml-2">加载文档...</span>
                </div>
              )}

              {/* 文档列表 */}
              {filteredDocuments.length > 0 && (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {filteredDocuments.map((doc) => (
                    <motion.div
                      key={doc.id}
                      variants={itemVariants}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className={cn(
                        'group flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer',
                        'hover:border-primary/50 hover:shadow-sm hover:bg-accent/50',
                        'bg-card/50'
                      )}
                      onClick={() => handleViewDocument(doc)}
                    >
                      {/* 文件类型图标 */}
                      <div className="mt-0.5">
                        <Database className="h-5 w-5 text-green-500" />
                      </div>

                      {/* 文档信息区域 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={doc.title}>
                          {doc.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {doc.chunkCount} 个文本块
                          </span>
                          <Badge variant="secondary" className="text-[10px] h-4">
                            已存储
                          </Badge>
                        </div>
                      </div>

                      {/* 操作按钮区域 */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDocument(doc.id);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* 空状态 */}
              {!isLoading && filteredDocuments.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">暂无文档</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    上传文档开始构建知识库
                  </p>
                </motion.div>
              )}
            </div>
          </AnimatePresence>
        </ScrollArea>

        {/* 
          ==================== 存储统计区域 ====================
          显示已使用的存储空间和进度条
        */}
        <div className="p-3 border-t border-border">
          {/* 存储使用文字 */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>存储使用</span>
            <span>{formatFileSize(totalSize)}</span>
          </div>
          
          {/* 进度条容器 */}
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            {/* 进度条 */}
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((totalSize / (100 * 1024 * 1024)) * 100, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </motion.div>

      {/* 
        ==================== 错误对话框 ====================
        当上传出错时显示
      */}
      <Dialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {errorDialog.title}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {errorDialog.message}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/*
        ==================== 文本块查看对话框 ====================
        点击查看文档时显示
        宽度为屏幕80%，内容超出可滚动
      */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="!w-[80vw] !max-w-[80vw] !h-[80vh] !max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {selectedDoc?.title}
            </DialogTitle>
            <DialogDescription>
              共 {selectedDoc?.chunks.length || 0} 个文本块
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-6 pb-6">
            {isLoadingChunks ? (
              <div className="flex items-center justify-center py-8 h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground ml-2">加载文本块...</span>
              </div>
            ) : (
              <ScrollArea className="h-full mt-4">
                <div className="space-y-3 pr-4">
                  {selectedDoc?.chunks.map((chunk, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px]">
                          块 {idx + 1}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
