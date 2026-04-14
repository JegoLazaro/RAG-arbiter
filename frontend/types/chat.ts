// types/chat.ts
export type Source = {
  name: string;
  text: string;
  score: string;
  citations?: Record<string, string>;
};

export type Message = {
  role: 'user' | 'arbiter';
  content: string;
  sources?: Source[];
};