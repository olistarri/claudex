import { useEffect, useMemo, useCallback, ReactNode } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Sidebar, useLayoutSidebar } from '@/components/layout';
import { useUIStore, useChatStore } from '@/store';
import { ViewSwitcher } from '@/components/ui/ViewSwitcher';
import {
  BrowserView,
  IDEView,
  MobilePreviewView,
  SecretsView,
  TerminalView,
  WebPreviewView,
} from '@/components/views';
import { SplitViewContainer } from '@/components/ui/SplitViewContainer';
import type { ViewType } from '@/types/ui.types';
import { Chat as ChatComponent } from '@/components/chat/chat-window/Chat';
import { Editor } from '@/components/editor/editor-core/Editor';
import { useQueryClient } from '@tanstack/react-query';
import { useChatStreaming } from '@/hooks/useChatStreaming';
import { usePermissionRequest } from '@/hooks/usePermissionRequest';
import { ToolPermissionModal } from '@/components/chat/tools/ToolPermissionModal';
import { useInitialPrompt } from '@/hooks/useInitialPrompt';
import { useEditorState } from '@/hooks/useEditorState';
import { useMessageInitialization } from '@/hooks/useMessageInitialization';
import { useChatData } from '@/hooks/useChatData';
import { useSandboxFiles } from '@/hooks/useSandboxFiles';
import { useContextUsageState } from '@/hooks/useContextUsageState';
import { useSettingsQuery, useModelSelection } from '@/hooks/queries';
import { mergeAgents } from '@/utils/settings';

export function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { attachedFiles, setAttachedFiles, setCurrentChat } = useChatStore(
    useShallow((state) => ({
      attachedFiles: state.attachedFiles,
      setAttachedFiles: state.setAttachedFiles,
      setCurrentChat: state.setCurrentChat,
    })),
  );

  const { selectedModelId, selectModel } = useModelSelection();

  const { permissionMode, thinkingMode, currentView, setCurrentView } = useUIStore(
    useShallow((state) => ({
      permissionMode: state.permissionMode,
      thinkingMode: state.thinkingMode,
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
    })),
  );

  const {
    initialPrompt,
    setInitialPrompt,
    initialPromptSent,
    setInitialPromptSent,
    initialPromptFromRoute,
  } = useInitialPrompt();

  const { chats, currentChat, fetchedMessages, hasFetchedMessages, chatsQueryMeta, messagesQuery } =
    useChatData(chatId);

  const { fileStructure, isFileMetadataLoading, refetchFilesMetadata } = useSandboxFiles(
    currentChat,
    chatId,
  );

  useEffect(() => {
    if (currentView === 'editor' && currentChat?.sandbox_id) {
      refetchFilesMetadata();
    }
  }, [currentView, currentChat?.sandbox_id, refetchFilesMetadata]);

  const { contextUsage, updateContextUsage } = useContextUsageState(chatId, currentChat);

  const { data: settings } = useSettingsQuery();

  const allAgents = useMemo(() => mergeAgents(settings?.custom_agents), [settings?.custom_agents]);

  const enabledSlashCommands = useMemo(() => {
    return settings?.custom_slash_commands?.filter((cmd) => cmd.enabled) || [];
  }, [settings?.custom_slash_commands]);

  const customPrompts = useMemo(() => {
    return settings?.custom_prompts || [];
  }, [settings?.custom_prompts]);

  const { selectedFile, setSelectedFile, isRefreshing, handleRefresh, handleFileSelect } =
    useEditorState(refetchFilesMetadata);

  const {
    pendingRequest,
    isLoading: isPermissionLoading,
    handlePermissionRequest,
    handleApprove,
    handleReject,
  } = usePermissionRequest(chatId);

  const streamingState = useChatStreaming({
    chatId,
    currentChat,
    fetchedMessages,
    hasFetchedMessages,
    isInitialLoading: messagesQuery.isLoading,
    queryClient,
    refetchFilesMetadata,
    onContextUsageUpdate: updateContextUsage,
    selectedModelId,
    permissionMode,
    thinkingMode,
    onPermissionRequest: handlePermissionRequest,
  });

  const {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    error,
    wasAborted,
    setWasAborted,
    setMessages,
  } = streamingState;

  useMessageInitialization({
    fetchedMessages,
    chatId,
    selectedModelId,
    hasMessages: messages.length > 0,
    initialPromptFromRoute,
    initialPromptSent,
    wasAborted,
    attachedFiles,
    isLoading,
    isStreaming,
    setMessages,
    setInitialPrompt,
  });

  useEffect(() => {
    if (
      initialPrompt &&
      messages.length === 1 &&
      !isLoading &&
      !isStreaming &&
      !initialPromptSent &&
      !error &&
      !messagesQuery.isLoading &&
      !hasFetchedMessages
    ) {
      const userMessage = messages[0];
      sendMessage(initialPrompt, chatId, userMessage, attachedFiles);
      setInitialPromptSent(true);
      setAttachedFiles([]);
    }
  }, [
    initialPrompt,
    messages,
    messages.length,
    isLoading,
    isStreaming,
    sendMessage,
    chatId,
    initialPromptSent,
    error,
    setAttachedFiles,
    messagesQuery.isLoading,
    hasFetchedMessages,
    attachedFiles,
    setInitialPromptSent,
  ]);

  useEffect(() => {
    setCurrentChat(currentChat || null);
  }, [currentChat, setCurrentChat]);

  useEffect(() => {
    setInitialPromptSent(false);
    setSelectedFile(null);
    setCurrentView('agent');
  }, [chatId, setInitialPromptSent, setSelectedFile, setCurrentView]);

  const handleChatSelect = useCallback(
    (selectedChatId: string) => {
      navigate(`/chat/${selectedChatId}`);
    },
    [navigate],
  );

  const handleRestoreSuccess = useCallback(() => {
    setWasAborted(false);
    messagesQuery.refetch();
    if (currentChat?.sandbox_id) {
      refetchFilesMetadata();
    }
  }, [setWasAborted, messagesQuery, currentChat?.sandbox_id, refetchFilesMetadata]);

  const sidebarContent = useMemo(() => {
    if (currentView !== 'agent') return null;
    return (
      <Sidebar
        chats={chats}
        selectedChatId={chatId || null}
        onChatSelect={handleChatSelect}
        hasNextPage={chatsQueryMeta.hasNextPage}
        fetchNextPage={chatsQueryMeta.fetchNextPage}
        isFetchingNextPage={chatsQueryMeta.isFetchingNextPage}
        hasActivityBar={true}
      />
    );
  }, [
    currentView,
    chats,
    chatId,
    chatsQueryMeta.fetchNextPage,
    handleChatSelect,
    chatsQueryMeta.hasNextPage,
    chatsQueryMeta.isFetchingNextPage,
  ]);

  useLayoutSidebar(sidebarContent);

  const renderView = useCallback(
    (view: ViewType): ReactNode => {
      switch (view) {
        case 'terminal':
          return <TerminalView currentChat={currentChat} isVisible={true} />;
        case 'agent':
          return (
            <ChatComponent
              messages={messages}
              copiedMessageId={streamingState.copiedMessageId}
              isLoading={isLoading}
              isStreaming={isStreaming}
              isInitialLoading={messagesQuery.isLoading}
              error={error}
              onCopy={streamingState.handleCopy}
              inputMessage={streamingState.inputMessage}
              setInputMessage={streamingState.setInputMessage}
              onMessageSend={streamingState.handleMessageSend}
              onStopStream={streamingState.handleStop}
              onAttach={streamingState.setInputFiles}
              selectedModelId={selectedModelId}
              onModelChange={selectModel}
              attachedFiles={streamingState.inputFiles}
              contextUsage={contextUsage}
              sandboxId={currentChat?.sandbox_id}
              chatId={chatId}
              onDismissError={streamingState.handleDismissError}
              fetchNextPage={messagesQuery.fetchNextPage}
              hasNextPage={messagesQuery.hasNextPage}
              isFetchingNextPage={messagesQuery.isFetchingNextPage}
              onRestoreSuccess={handleRestoreSuccess}
              fileStructure={fileStructure}
              customAgents={allAgents}
              customSlashCommands={enabledSlashCommands}
              customPrompts={customPrompts}
            />
          );
        case 'editor':
          return (
            <Editor
              files={fileStructure}
              isExpanded={true}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              chatId={chatId}
              currentChat={currentChat}
              isSandboxSyncing={isFileMetadataLoading}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
          );
        case 'ide':
          return <IDEView sandboxId={currentChat?.sandbox_id} isActive={true} />;
        case 'secrets':
          return <SecretsView chatId={chatId} sandboxId={currentChat?.sandbox_id} />;
        case 'webPreview':
          return <WebPreviewView sandboxId={currentChat?.sandbox_id} isActive={true} />;
        case 'mobilePreview':
          return <MobilePreviewView sandboxId={currentChat?.sandbox_id} />;
        case 'browser':
          return <BrowserView sandboxId={currentChat?.sandbox_id} isActive={true} />;
        default:
          return null;
      }
    },
    [
      currentChat,
      messages,
      streamingState,
      isLoading,
      isStreaming,
      messagesQuery,
      error,
      selectedModelId,
      selectModel,
      contextUsage,
      chatId,
      handleRestoreSuccess,
      fileStructure,
      allAgents,
      enabledSlashCommands,
      customPrompts,
      selectedFile,
      handleFileSelect,
      isFileMetadataLoading,
      handleRefresh,
      isRefreshing,
    ],
  );

  if (!chatId) return <Navigate to="/" />;

  return (
    <div className="relative flex h-full">
      <ViewSwitcher />
      <div className="flex h-full flex-1 overflow-hidden bg-surface-secondary pl-12 text-text-primary dark:bg-surface-dark-secondary dark:text-text-dark-primary">
        <SplitViewContainer renderView={renderView} />
      </div>

      <ToolPermissionModal
        request={pendingRequest}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isPermissionLoading}
      />
    </div>
  );
}
