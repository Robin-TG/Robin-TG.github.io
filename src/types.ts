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

export interface SpeechSettings {
  enabled: boolean;
  voiceUri: string;
}

export interface VoiceInfo {
  name: string;
  lang: string;
  uri: string;
  default?: boolean;
}
