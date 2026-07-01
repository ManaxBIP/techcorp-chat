import { writable, get } from 'svelte/store';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatStoreState {
  messages: Message[];
  isLoading: boolean;
  apiUrl: string;
  model: string;
  streamMode: boolean;
  simulationMode: boolean;
}

const DEFAULT_STATE: ChatStoreState = {
  messages: [],
  isLoading: false,
  apiUrl: 'https://tasty-doodles-create.loca.lt/api/chat',
  model: 'llama3',
  streamMode: true,
  simulationMode: false
};

// Simple uuid generator for environments where crypto.randomUUID is not available
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function createChatStore() {
  const store = writable<ChatStoreState>({ ...DEFAULT_STATE });
  const { subscribe, set, update } = store;

  /**
   * Helper to simulate a streaming chatbot response.
   */
  async function handleSimulation(userContent: string, assistantMessageId: string) {
    const responseText = `[Mode Simulation] J'ai bien reçu votre message : "${userContent}".

Le mode simulation vous permet de tester le comportement du streaming de l'interface sans nécessiter une instance locale d'Ollama.

Détails de la configuration actuelle :
- URL de l'API : ${get(store).apiUrl}
- Modèle sélectionné : ${get(store).model}
- Mode Streaming : ${get(store).streamMode ? 'Activé' : 'Désactivé'}

Pour désactiver la simulation et se connecter à l'API, basculez la variable \`simulationMode\` à \`false\`.`;

    // Wait 1 second (as required by the prompt)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (get(store).streamMode) {
      // Split by words/whitespace to simulate streaming tokens
      const words = responseText.split(/(\s+)/);
      for (const word of words) {
        // If the user cleared messages or stopped loading during simulation
        if (!get(store).isLoading) break;

        update((state) => {
          const messages = state.messages.map((msg) => {
            if (msg.id === assistantMessageId) {
              return { ...msg, content: msg.content + word };
            }
            return msg;
          });
          return { ...state, messages };
        });

        // Small delay between tokens to feel natural (approx 30ms)
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    } else {
      // Non-streaming simulation
      update((state) => {
        const messages = state.messages.map((msg) => {
          if (msg.id === assistantMessageId) {
            return { ...msg, content: responseText };
          }
          return msg;
        });
        return { ...state, messages };
      });
    }
  }

  /**
   * Helper to fetch response from Ollama API
   */
  async function handleApiFetch(assistantMessageId: string) {
    const state = get(store);
    const { apiUrl, model, messages, streamMode } = state;

    // Filter out the very last assistant message placeholder for API context,
    // and map to the format expected by Ollama API (role and content only)
    const apiMessages = messages
      .filter((m) => m.id !== assistantMessageId)
      .map((m) => ({
        role: m.role,
        content: m.content
      }));

    console.log("Calling Ollama API:", { apiUrl, model, streamMode, messagesCount: apiMessages.length });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        stream: streamMode
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    if (streamMode && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Queued typing animation logic to guarantee smooth word-by-word display
      const tokenQueue: string[] = [];
      let isTyping = false;
      let streamFinished = false;

      let resolveTyping: () => void = () => { };
      const typingFinishedPromise = new Promise<void>((resolve) => {
        resolveTyping = resolve;
      });

      function processQueue() {
        if (tokenQueue.length === 0) {
          isTyping = false;
          if (streamFinished) {
            resolveTyping();
          }
          return;
        }

        const nextToken = tokenQueue.shift();
        if (nextToken) {
          update((currentState) => {
            const updatedMessages = currentState.messages.map((msg) => {
              if (msg.id === assistantMessageId) {
                return { ...msg, content: msg.content + nextToken };
              }
              return msg;
            });
            return { ...currentState, messages: updatedMessages };
          });
        }

        // 12ms delay per token guarantees smooth typing even if tokens arrive in bulk
        setTimeout(processQueue, 12);
      }

      function queueToken(token: string) {
        tokenQueue.push(token);
        if (!isTyping) {
          isTyping = true;
          processQueue();
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                queueToken(json.message.content);
              }
            } catch (err) {
              console.warn('Error parsing stream line:', err, line);
            }
          }
        }

        // Process final line in buffer if exists
        if (buffer.trim()) {
          try {
            const json = JSON.parse(buffer);
            if (json.message?.content) {
              queueToken(json.message.content);
            }
          } catch (err) {
            console.warn('Error parsing final stream buffer:', err, buffer);
          }
        }

        streamFinished = true;
        if (!isTyping) {
          resolveTyping();
        }

        // Keep isLoading: true until the typist has completed printing everything
        await typingFinishedPromise;

      } finally {
        reader.releaseLock();
      }
    } else {
      // Non-streaming API call
      const json = await response.json();
      if (json.message?.content) {
        update((currentState) => {
          const updatedMessages = currentState.messages.map((msg) => {
            if (msg.id === assistantMessageId) {
              return { ...msg, content: json.message.content };
            }
            return msg;
          });
          return { ...currentState, messages: updatedMessages };
        });
      } else {
        throw new Error('Invalid response structure from Ollama API');
      }
    }
  }

  return {
    subscribe,

    /**
     * Configure the API Endpoint URL
     */
    setApiUrl: (url: string) => update((s) => ({ ...s, apiUrl: url })),

    /**
     * Configure the Ollama Model Name (e.g. 'llama3', 'gemma')
     */
    setModel: (model: string) => update((s) => ({ ...s, model })),

    /**
     * Toggle Streaming Mode (true/false)
     */
    setStreamMode: (enabled: boolean) => update((s) => ({ ...s, streamMode: enabled })),

    /**
     * Toggle Simulation Mode (true/false)
     */
    setSimulationMode: (enabled: boolean) => update((s) => ({ ...s, simulationMode: enabled })),

    /**
     * Clear all chat history and reset loading state
     */
    clearMessages: () => update((s) => ({ ...s, messages: [], isLoading: false })),

    /**
     * Reset store to initial state
     */
    reset: () => set({ ...DEFAULT_STATE }),

    /**
     * Send a message to the chatbot
     */
    sendMessage: async (content: string) => {
      if (!content || !content.trim()) return;

      const state = get(store);
      if (state.isLoading) return;

      // 1. Add user message
      const userMessage: Message = {
        id: generateUUID(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date()
      };

      // 2. Add empty assistant message as a placeholder
      const assistantMessageId = generateUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      update((currentState) => ({
        ...currentState,
        isLoading: true,
        messages: [...currentState.messages, userMessage, assistantMessage]
      }));

      try {
        if (get(store).simulationMode) {
          await handleSimulation(userMessage.content, assistantMessageId);
        } else {
          await handleApiFetch(assistantMessageId);
        }
      } catch (error) {
        console.error('Error sending message:', error);

        // Append error description to the assistant message
        update((currentState) => {
          const updatedMessages = currentState.messages.map((msg) => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                content: `⚠️ Erreur : Impossible d'obtenir une réponse. (${error instanceof Error ? error.message : 'Erreur inconnue'})`
              };
            }
            return msg;
          });
          return { ...currentState, messages: updatedMessages };
        });
      } finally {
        update((currentState) => ({ ...currentState, isLoading: false }));
      }
    }
  };
}

export const chatStore = createChatStore();
