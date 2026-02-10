# 12 - Agent Widget (Genesys Integration)

**Priority:** LOW (Optional - Advanced Feature)  
**Estimated Time:** 8-10 hours  
**Dependencies:** 02 (Tenant Service), Full message flow operational  
**Can Run in Parallel:** Yes (doesn't block core MVP)

---

## 🎯 Objective
Create a Genesys Agent Widget that displays WhatsApp conversation history and customer context within the Genesys Agent Desktop.

---

## 🛡️ Guard Rails (Check Before Starting)

- [x] Core MVP message flows working (Tasks 00-10)
- [x] State Manager tracking conversations and messages
- [x] Understanding of Genesys Widgets SDK
- [x] Agent Portal Service backend exists

---

## 📍 Anchors (Where to Make Changes)

**New Directory to Create:**
- `/services/agent-widget/` - New React widget application

**Files to Create:**
- `/services/agent-widget/public/index.html`
- `/services/agent-widget/src/App.tsx`
- `/services/agent-widget/src/components/ConversationView.tsx`
- `/services/agent-widget/src/components/MessageList.tsx`
- `/services/agent-widget/src/services/genesys-client.service.ts`
- `/services/agent-widget/src/services/api-client.service.ts`

---

## 📝 Step-by-Step Implementation

### Step 1: Initialize Widget Project

```bash
cd services
npm create vite@latest agent-widget -- --template react-ts
cd agent-widget
npm install @genesys/widgets-sdk axios @tanstack/react-query
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 2: Configure Genesys Widget Dependencies

**File:** `public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WhatsApp Agent Widget</title>
    
    <!-- Genesys Cloud Client SDK -->
    <script src="https://sdk-cdn.mypurecloud.com/client-apps/2.6.3/purecloud-client-app-sdk-de77761d.min.js"></script>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### Step 3: Create Genesys Client Service

**File:** `src/services/genesys-client.service.ts`

```typescript
declare const window: any;

class GenesysClientService {
    private clientApp: any;
    private currentConversation: any = null;

    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                const myClientApp = window.purecloud.apps.ClientApp;
                
                myClientApp.create({
                    appName: 'WhatsApp Agent Widget',
                    enableLog: true
                }).then((app: any) => {
                    this.clientApp = app;
                    console.log('Genesys Widget initialized');
                    
                    // Subscribe to conversation events
                    this.subscribeToConversations();
                    
                    resolve(app);
                }).catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    private subscribeToConversations() {
        // Listen for conversation focus changes
        this.clientApp.myConversations.subscribe((data: any) => {
            console.log('Conversation data:', data);
            
            if (data.activeConversationId) {
                this.onConversationChanged(data.activeConversationId);
            }
        });
    }

    private onConversationChanged(conversationId: string) {
        this.currentConversation = conversationId;
        
        // Trigger custom event for React components to listen
        window.dispatchEvent(new CustomEvent('genesys-conversation-changed', {
            detail: { conversationId }
        }));
    }

    getCurrentConversation() {
        return this.currentConversation;
    }

    async getUserDetails() {
        const user = await this.clientApp.users.getMe();
        return user;
    }
}

export default new GenesysClientService();
```

### Step 4: Create API Client Service

**File:** `src/services/api-client.service.ts`

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Message {
    id: string;
    direction: 'inbound' | 'outbound';
    messageType: 'text' | 'image' | 'document' | 'video';
    text?: string;
    mediaUrl?: string;
    timestamp: string;
    status: string;
}

export interface Conversation {
    conversationId: string;
    waId: string;
    contactName?: string;
    lastActivity: string;
    messageCount: number;
}

class ApiClientService {
    // Get conversation mapping for Genesys conversation
    async getConversationMapping(conversationId: string, tenantId: string): Promise<Conversation | null> {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/state/conversation/${conversationId}`,
                { headers: { 'X-Tenant-ID': tenantId } }
            );
            return response.data;
        } catch (error) {
            console.error('Failed to get conversation mapping:', error);
            return null;
        }
    }

    // Get message history for conversation
    async getMessageHistory(conversationId: string): Promise<Message[]> {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/state/messages/${conversationId}`
            );
            return response.data;
        } catch (error) {
            console.error('Failed to get message history:', error);
            return [];
        }
    }
}

export default new ApiClientService();
```

### Step 5: Create Message List Component

**File:** `src/components/MessageList.tsx`

```tsx
import React from 'react';
import { Message } from '../services/api-client.service';

interface Props {
    messages: Message[];
}

export default function MessageList({ messages }: Props) {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
                <div
                    key={message.id}
                    className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                            message.direction === 'outbound'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-900'
                        }`}
                    >
                        {message.messageType === 'text' && (
                            <p className="text-sm">{message.text}</p>
                        )}
                        
                        {message.messageType !== 'text' && (
                            <div>
                                <p className="text-xs opacity-75 mb-1">
                                    {message.messageType.toUpperCase()}
                                </p>
                                {message.mediaUrl && (
                                    <a
                                        href={message.mediaUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs underline"
                                    >
                                        View Media
                                    </a>
                                )}
                            </div>
                        )}
                        
                        <p className="text-xs opacity-75 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
```

### Step 6: Create Conversation View Component

**File:** `src/components/ConversationView.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api-client.service';
import MessageList from './MessageList';

interface Props {
    conversationId: string;
    tenantId: string;
}

export default function ConversationView({ conversationId, tenantId }: Props) {
    const [mapping, setMapping] = useState<any>(null);

    // Get conversation mapping
    useEffect(() => {
        apiClient.getConversationMapping(conversationId, tenantId)
            .then(setMapping);
    }, [conversationId, tenantId]);

    // Get message history
    const { data: messages = [], isLoading } = useQuery({
        queryKey: ['messages', conversationId],
        queryFn: () => apiClient.getMessageHistory(conversationId),
        refetchInterval: 5000 // Refresh every 5 seconds
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading conversation...</p>
            </div>
        );
    }

    if (!mapping) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No WhatsApp conversation linked</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-green-600 text-white p-4">
                <h2 className="font-semibold">WhatsApp Conversation</h2>
                <p className="text-sm opacity-90">
                    {mapping.contactName || mapping.waId}
                </p>
            </div>

            {/* Messages */}
            <MessageList messages={messages} />

            {/* Footer */}
            <div className="bg-gray-100 p-3 text-center text-xs text-gray-500">
                Messages are managed through Genesys
            </div>
        </div>
    );
}
```

### Step 7: Create Main App Component

**File:** `src/App.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import genesysClient from './services/genesys-client.service';
import ConversationView from './components/ConversationView';

const queryClient = new QueryClient();

function App() {
    const [initialized, setInitialized] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [tenantId] = useState('demo-tenant-001'); // Get from config or user

    useEffect(() => {
        // Initialize Genesys Widget
        genesysClient.initialize()
            .then(() => {
                setInitialized(true);
                console.log('Widget ready');
            })
            .catch(console.error);

        // Listen for conversation changes
        const handleConversationChange = (event: any) => {
            setConversationId(event.detail.conversationId);
        };

        window.addEventListener('genesys-conversation-changed', handleConversationChange);

        return () => {
            window.removeEventListener('genesys-conversation-changed', handleConversationChange);
        };
    }, []);

    if (!initialized) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing widget...</p>
                </div>
            </div>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <div className="h-screen bg-white">
                {conversationId ? (
                    <ConversationView
                        conversationId={conversationId}
                        tenantId={tenantId}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">Select a conversation to view details</p>
                    </div>
                )}
            </div>
        </QueryClientProvider>
    );
}

export default App;
```

### Step 8: Update Environment Variables

**File:** `.env`

```env
VITE_API_URL=http://localhost:3000
```

### Step 9: Build and Deploy

**File:** `package.json` (add scripts)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "deploy": "npm run build && ./deploy-to-genesys.sh"
  }
}
```

---

## ✅ Verification Steps

### 1. Build Widget

```bash
cd services/agent-widget
npm install
npm run build
```

### 2. Test Locally

```bash
npm run dev
```

Open: `http://localhost:5173`

### 3. Deploy to Genesys

Upload `dist/` folder to Genesys Cloud:
1. Go to Admin → Integrations → Client Applications
2. Create new integration
3. Upload widget files
4. Configure as "Widget" type
5. Assign to queues/agents

### 4. Test in Genesys Agent Desktop

1. Login to Genesys as agent
2. Accept WhatsApp conversation
3. Widget should appear in sidebar
4. Shows conversation history

---

## 🚨 Common Issues

### Issue 1: Widget Not Loading in Genesys
**Solution:**
- Check CSP headers allow your API domain
- Verify widget is assigned to agent's queue
- Check browser console for errors

### Issue 2: No Conversation Data
**Solution:**
- Verify State Manager has conversation mapping
- Check API Gateway routes are accessible
- Ensure tenantId is correct

### Issue 3: CORS Errors
**Solution:**
Add to API Gateway CORS config:
```javascript
origin: ['https://apps.mypurecloud.com', 'http://localhost:5173']
```

---

## 📤 Deliverables

- [x] Genesys Widget integrated
- [x] Shows WhatsApp conversation history
- [x] Real-time message updates (polling)
- [x] Customer info display
- [x] Media message links
- [x] Build and deploy scripts

---

## 🎯 Note

This is an **advanced optional feature**. For MVP:
- Skip if time-constrained
- Agents can use Genesys native interface
- Widget adds convenience but not required for core functionality

**Priority:** Focus on Tasks 00-10 first! The widget enhances UX but message flow works without it.

---

## 🚀 Future Enhancements

- WebSocket for real-time updates (instead of polling)
- Send quick replies from widget
- Show customer profile data
- Inline media preview
- Conversation notes/tags
