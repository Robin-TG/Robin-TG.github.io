export interface Message {
  sender: 'user' | 'ai';
  text: string;
}

export interface Conversation {
  id: number;
  messages: Message[];
}

export interface InitialConversations {
  conversations: Conversation[];
  currentConvIdx: number;
}

export type ProgressCallback = (p: unknown) => void;
