'use client';

import { motion } from 'framer-motion';
import {
  Settings,
  Moon,
  Sun,
  Cpu,
  Thermometer,
  Maximize2,
  Zap,
  Database,
  Wrench,
  Clock,
  Globe,
  Calculator,
  Cloud,
  ChevronDown,
  ChevronUp,
  Brain,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const containerVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 10 },
  visible: { opacity: 1, x: 0 },
};

const toolIcons: Record<string, React.ReactNode> = {
  Clock: <Clock className="h-4 w-4" />,
  Globe: <Globe className="h-4 w-4" />,
  Calculator: <Calculator className="h-4 w-4" />,
  Cloud: <Cloud className="h-4 w-4" />,
};

export function ConfigPanel() {
  const {
    theme,
    toggleTheme,
    config,
    updateConfig,
    tools,
    toggleTool,
    configPanelOpen,
  } = useAppStore();

  const [expandedSections, setExpandedSections] = useState({
    model: true,
    parameters: true,
    tools: true,
    features: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <motion.div
      initial={{ width: 300, opacity: 0 }}
      animate={{
        width: configPanelOpen ? 300 : 0,
        opacity: configPanelOpen ? 1 : 0,
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex flex-col border-l border-border bg-sidebar overflow-hidden"
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col h-full"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">配置面板</h2>
              <p className="text-xs text-muted-foreground">自定义AI行为</p>
            </div>
          </div>
        </motion.div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Theme Toggle */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {theme === 'light' ? (
                      <Sun className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Moon className="h-4 w-4 text-indigo-400" />
                    )}
                    <span className="text-sm font-medium">主题模式</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={toggleTheme}
                  >
                    {theme === 'light' ? '亮色' : '暗色'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Model Selection */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardHeader className="p-3 pb-2">
                <button
                  onClick={() => toggleSection('model')}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-medium">模型选择</CardTitle>
                  </div>
                  {expandedSections.model ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CardHeader>
              {expandedSections.model && (
                <CardContent className="p-3 pt-0 space-y-3">
                  <Select
                    value={config.model}
                    onValueChange={(value) => updateConfig({ model: value || 'glm-Z1-flash' })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glm-Z1-flash">GLM-Z1-Flash</SelectItem>
                      <SelectItem value="glm-4-flash">GLM-4-Flash</SelectItem>
                      <SelectItem value="glm-4">GLM-4</SelectItem>
                      <SelectItem value="glm-4-plus">GLM-4-Plus</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">流式输出</span>
                    <Switch
                      checked={config.enableStreaming}
                      onCheckedChange={(checked) =>
                        updateConfig({ enableStreaming: checked })
                      }
                    />
                  </div> */}
                </CardContent>
              )}
            </Card>
          </motion.div>

          {/* Parameters */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardHeader className="p-3 pb-2">
                <button
                  onClick={() => toggleSection('parameters')}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-orange-500" />
                    <CardTitle className="text-sm font-medium">参数设置</CardTitle>
                  </div>
                  {expandedSections.parameters ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CardHeader>
              {expandedSections.parameters && (
                <CardContent className="p-3 pt-0 space-y-4">
                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium">Temperature</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="secondary" className="text-[10px] h-4 cursor-help">
                              ?
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="max-w-xs text-xs">
                              控制输出的随机性。值越高，回答越创造性；值越低，回答越确定性。
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {config.temperature}
                      </span>
                    </div>
                    <Slider
                      value={[config.temperature]}
                      onValueChange={(value) => updateConfig({ temperature: Array.isArray(value) ? value[0] : value })}
                      min={0}
                      max={2}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>精确</span>
                      <span>平衡</span>
                      <span>创意</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Max Tokens */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Max Tokens</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {config.maxTokens}
                      </span>
                    </div>
                    <Slider
                      value={[config.maxTokens]}
                      onValueChange={(value) => updateConfig({ maxTokens: Array.isArray(value) ? value[0] : value })}
                      min={256}
                      max={4096}
                      step={256}
                      className="w-full"
                    />
                  </div>

                  <Separator />

                  {/* Top P */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Top P</span>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {config.topP}
                      </span>
                    </div>
                    <Slider
                      value={[config.topP]}
                      onValueChange={(value) => updateConfig({ topP: Array.isArray(value) ? value[0] : value })}
                      min={0}
                      max={1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>

          {/* Features */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardHeader className="p-3 pb-2">
                <button
                  onClick={() => toggleSection('features')}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <CardTitle className="text-sm font-medium">功能开关</CardTitle>
                  </div>
                  {expandedSections.features ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CardHeader>
              {expandedSections.features && (
                <CardContent className="p-3 pt-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-blue-500" />
                      <div>
                        <span className="text-sm">RAG 检索</span>
                        <p className="text-[10px] text-muted-foreground">基于文档的问答</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.enableRAG}
                      onCheckedChange={(checked) => updateConfig({ enableRAG: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-green-500" />
                      <div>
                        <span className="text-sm">工具调用</span>
                        <p className="text-[10px] text-muted-foreground">启用AI工具</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.enableTools}
                      onCheckedChange={(checked) => updateConfig({ enableTools: checked })}
                    />
                  </div>

                  {/* 深度思考开关 - 只在glm-Z1-flash模型时显示 */}
                  {config.model === 'glm-Z1-flash' && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-500" />
                        <div>
                          <span className="text-sm">深度思考</span>
                          <p className="text-[10px] text-muted-foreground">显示AI思考过程</p>
                        </div>
                      </div>
                      <Switch
                        checked={config.enableThinking}
                        onCheckedChange={(checked) => updateConfig({ enableThinking: checked })}
                      />
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </motion.div>

          {/* Tools */}
          {config.enableTools && (
            <motion.div variants={itemVariants}>
              <Card className="border-border/50">
                <CardHeader className="p-3 pb-2">
                  <button
                    onClick={() => toggleSection('tools')}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-green-500" />
                      <CardTitle className="text-sm font-medium">工具列表</CardTitle>
                    </div>
                    {expandedSections.tools ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CardHeader>
                {expandedSections.tools && (
                  <CardContent className="p-3 pt-0 space-y-2">
                    {tools.map((tool) => (
                      <div
                        key={tool.id}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-lg border transition-all',
                          tool.enabled
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-border bg-transparent'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'p-1.5 rounded-md',
                              tool.enabled ? 'bg-primary/20' : 'bg-muted'
                            )}
                          >
                            {toolIcons[tool.icon]}
                          </div>
                          <div>
                            <span className="text-xs font-medium">{tool.name}</span>
                            <p className="text-[10px] text-muted-foreground">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={tool.enabled}
                          onCheckedChange={() => toggleTool(tool.id)}
                          className="scale-75"
                        />
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <motion.div
          variants={itemVariants}
          className="p-4 border-t border-border text-center"
        >
          <p className="text-[10px] text-muted-foreground">
            企业级RAG知识库与AI Agent协作平台 v1.0
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
