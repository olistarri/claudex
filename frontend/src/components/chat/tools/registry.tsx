import type { ToolComponent } from '@/types';
import { Task } from './Task';
import { WebSearch } from './WebSearch';
import { TodoWrite } from './TodoWrite';
import { MCPTool } from './MCPTool';
import { WriteTool, ReadTool, EditTool } from './FileOperationTool';
import { AskUserQuestion } from './AskUserQuestion';

export const TOOL_COMPONENTS: Record<string, ToolComponent> = {
  Task: Task,
  WebSearch: WebSearch,
  TodoWrite: TodoWrite,
  Write: WriteTool,
  Read: ReadTool,
  Edit: EditTool,
  AskUserQuestion: AskUserQuestion,
};

export const getToolComponent = (toolName: string): ToolComponent => {
  if (TOOL_COMPONENTS[toolName]) {
    return TOOL_COMPONENTS[toolName];
  }

  if (
    toolName.startsWith('mcp__web-search-prime__') ||
    toolName.startsWith('mcp__web_search_prime__')
  ) {
    return WebSearch;
  }

  return MCPTool;
};
