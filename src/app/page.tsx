'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/header';
import DocumentPanel from '@/components/document-panel';
import ChatWindow from '@/components/chat-window';
import { ConfigPanel } from '@/components/config-panel';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';

export default function Home() {
  const { theme, sidebarOpen } = useAppStore();

  // Apply theme to html element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col h-screen overflow-hidden',
        'bg-background text-foreground',
        'transition-colors duration-300'
      )}
    >
      <Header />
      
      <main className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Sidebar - Document Panel */}
        <motion.div
          initial={{ width: 320, opacity: 1 }}
          animate={{ 
            width: sidebarOpen ? 320 : 0,
            opacity: sidebarOpen ? 1 : 0
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="overflow-hidden"
        >
          <DocumentPanel />
        </motion.div>
        
        {/* Center - Chat Window */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <ChatWindow />
        </div>
        
        {/* Right Sidebar - Config Panel */}
        <ConfigPanel />
      </main>
    </motion.div>
  );
}
