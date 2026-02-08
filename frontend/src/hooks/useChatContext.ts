import { useContext } from 'react';
import { ChatContext } from '@/contexts/ChatContextDefinition';

const EMPTY: never[] = [];

export function useChatContext() {
  const context = useContext(ChatContext);
  return (
    context ?? {
      chatId: undefined,
      sandboxId: undefined,
      fileStructure: EMPTY,
      customAgents: EMPTY,
      customSlashCommands: EMPTY,
      customPrompts: EMPTY,
    }
  );
}
