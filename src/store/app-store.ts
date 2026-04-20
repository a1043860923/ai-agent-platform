import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Document {
  id: string;
  title: string;
  type: 'pdf' | 'markdown';
  size: number;
  uploadTime: Date;
  status: 'processing' | 'completed' | 'failed';
  vectorId?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  thinking?: string;
  sources?: Source[];
  isStatus?: boolean;  // 是否为状态消息（如"正在调用工具..."）
  toolsUsed?: string[];  // 使用的工具列表
}

export interface Source {
  documentId: string;
  documentTitle: string;
  content: string;
  similarity: number;
}

export interface ChatConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  enableStreaming: boolean;
  enableRAG: boolean;
  enableTools: boolean;
  enableThinking: boolean;  // 是否启用深度思考（显示思考过程）
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
}

interface AppState {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Documents
  documents: Document[];
  addDocument: (doc: Document) => void;
  removeDocument: (id: string) => void;
  updateDocumentStatus: (id: string, status: Document['status']) => void;

  // Chat
  messages: Message[];
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  isStreaming: boolean;
  setIsStreaming: (value: boolean) => void;

  // Config
  config: ChatConfig;
  updateConfig: (config: Partial<ChatConfig>) => void;

  // Tools
  tools: Tool[];
  toggleTool: (id: string) => void;

  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  configPanelOpen: boolean;
  toggleConfigPanel: () => void;
}

const defaultTools: Tool[] = [
  { id: 'time', name: '获取时间', description: '获取当前日期和时间', icon: 'Clock', enabled: true },
  { id: 'search', name: '网络搜索', description: '搜索互联网获取最新信息', icon: 'Globe', enabled: true },
  { id: 'calculator', name: '计算器', description: '执行数学计算', icon: 'Calculator', enabled: true },
  { id: 'weather', name: '天气查询', description: '查询指定地区天气', icon: 'Cloud', enabled: true },
];

const defaultConfig: ChatConfig = {
  model: 'glm-Z1-flash',
  temperature: 0.2,    // 低随机性，确保基于文档内容准确回答
  maxTokens: 2048,     // 足够回答复杂问题
  topP: 0.3,           // 低多样性，优先选择最相关词汇
  enableStreaming: true,
  enableRAG: true,     // 默认启用RAG，基于文档问答
  enableTools: false,  // 文档问答场景默认关闭工具，专注检索
  enableThinking: true, // 默认启用深度思考，显示AI的思考过程
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'light',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      // Documents
      documents: [],
      addDocument: (doc) => set((state) => ({ documents: [...state.documents, doc] })),
      removeDocument: (id) => set((state) => ({ documents: state.documents.filter((d) => d.id !== id) })),
      updateDocumentStatus: (id, status) =>
        set((state) => ({
          documents: state.documents.map((d) => (d.id === id ? { ...d, status } : d)),
        })),

      // Chat
      messages: [],
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),
      clearMessages: () => set({ messages: [] }),
      isStreaming: false,
      setIsStreaming: (value) => set({ isStreaming: value }),

      // Config
      config: defaultConfig,
      updateConfig: (newConfig) => set((state) => ({ config: { ...state.config, ...newConfig } })),

      // Tools
      tools: defaultTools,
      toggleTool: (id) =>
        set((state) => ({
          tools: state.tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
        })),

      // UI State
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      configPanelOpen: true,
      toggleConfigPanel: () => set((state) => ({ configPanelOpen: !state.configPanelOpen })),
    }),
    {
      name: 'rag-app-storage',
      partialize: (state) => ({
        theme: state.theme,
        config: state.config,
        tools: state.tools,
        sidebarOpen: state.sidebarOpen,
        configPanelOpen: state.configPanelOpen,
      }),
    }
  )
);
