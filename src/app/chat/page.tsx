'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Send, 
  Terminal, 
  User as UserIcon, 
  Sparkles, 
  ShieldAlert, 
  Check, 
  X, 
  Loader2,
  Clock,
  Trash2
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { aiEngine, AIResponse } from '@/services/ai';
import { walletService } from '@/services/wallet';
import { dbService } from '@/services/db';
import { safetyService } from '@/services/safety';

const LETTER_GRIDS: Record<string, number[][]> = {
  A: [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1]
  ],
  R: [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 1, 0],
    [1, 0, 0, 1]
  ],
  C: [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 1, 1, 1]
  ],
  P: [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 0, 0, 0]
  ],
  I: [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [1, 1, 1, 1, 1]
  ],
  L: [
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 1, 1, 1]
  ],
  O: [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1]
  ],
  T: [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0]
  ],
  ' ': [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0]
  ]
};

function BlockLetter({ letter }: { letter: string }) {
  const grid = LETTER_GRIDS[letter] || LETTER_GRIDS[' '];
  const numRows = grid.length;
  const numCols = grid[0].length;
  
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateRows: `repeat(${numRows}, 8px)`,
      gridTemplateColumns: `repeat(${numCols}, 8px)`,
      gap: '0px',
      marginRight: '6px'
    }}>
      {grid.map((row, rIdx) => 
        row.map((cell, cIdx) => (
          <div 
            key={`${rIdx}-${cIdx}`} 
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: cell === 1 ? 'var(--accent)' : 'transparent',
              border: cell === 1 ? '1px solid var(--background)' : 'none',
              boxShadow: cell === 1 ? '0 0 0 1px var(--accent)' : 'none',
            }}
          />
        ))
      )}
    </div>
  );
}

function BlockText({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      {text.split('').map((char, idx) => (
        <BlockLetter key={idx} letter={char.toUpperCase()} />
      ))}
    </div>
  );
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  animate?: boolean;
  previewTx?: {
    amount: number;
    recipient: string;
    recipientAddress: string;
    fee: number;
    requiresManualApproval: boolean;
  };
  txSuccess?: {
    hash: string;
    amount: number;
    recipient: string;
  };
}

function TypedText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let currentText = '';
    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        currentText += text.charAt(index);
        setDisplayedText(currentText);
        index++;
      } else {
        clearInterval(timer);
        if (onComplete) onComplete();
      }
    }, 8); // 8ms gives a very smooth, fast terminal typing effect
    
    return () => clearInterval(timer);
  }, [text, onComplete]);

  return <span>{displayedText}</span>;
}

export default function ChatPage() {
  const router = useRouter();
  const { user, wallet, refreshBalance, setWalletBalance } = useApp();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [pendingTx, setPendingTx] = useState<any>(null);
  const [executingTx, setExecutingTx] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Redirect to login if user session does not exist, and load chat history from DB
  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      const welcomeMsg: ChatMessage = {
        id: 'welcome',
        sender: 'assistant',
        text: `Welcome back, @${user.username}. AI wallet agent active.\nConnected recovery address: \`${user.recovery_wallet.slice(0, 6)}...${user.recovery_wallet.slice(-4)}\`.\n\nType \`help\` to view a list of natural language operations you can perform.`,
        timestamp: new Date()
      };

      dbService.getAIConversationsByUserId(user.id, 50)
        .then((history) => {
          if (history && history.length > 0) {
            const formattedHistory: ChatMessage[] = [];
            // Since rows are ordered created_at DESC, reverse them to display chronologically (oldest first)
            [...history].reverse().forEach((c) => {
              formattedHistory.push({
                id: 'msg_h_u_' + c.id,
                sender: 'user',
                text: c.message,
                timestamp: new Date(c.created_at || Date.now())
              });
              formattedHistory.push({
                id: 'msg_h_a_' + c.id,
                sender: 'assistant',
                text: c.response,
                timestamp: new Date(c.created_at || Date.now())
              });
            });
            setMessages([welcomeMsg, ...formattedHistory]);
          } else {
            setMessages([welcomeMsg]);
          }
        })
        .catch((err) => {
          console.error('Failed to load chat history:', err);
          setMessages([welcomeMsg]);
        });
    }
  }, [user, router]);

  const handleClearChat = async () => {
    if (!user) return;
    if (confirm('Are you sure you want to clear your chat history? This will delete the logs permanently.')) {
      try {
        await dbService.clearAIConversations(user.id);
        setMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: `Welcome back, @${user.username}. AI wallet agent active.\nConnected recovery address: \`${user.recovery_wallet.slice(0, 6)}...${user.recovery_wallet.slice(-4)}\`.\n\nType \`help\` to view a list of natural language operations you can perform.`,
            timestamp: new Date()
          }
        ]);
      } catch (e: any) {
        console.error('Failed to clear chat:', e);
        alert('Failed to clear chat: ' + e.message);
      }
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // Focus input on page load or shortcut
  useEffect(() => {
    inputRef.current?.focus();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL + K to focus input console
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !user || !wallet) return;

    const userText = input.trim();
    setInput('');

    // Add user message to log
    const userMsgId = 'msg_' + Date.now();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: userText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMsg]);

    setTyping(true);

    try {
      // 1. Compile chat history to send to LLM
      const chatHistory = messages.map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text
      }));

      // 2. Call backend chat API routing to MiMo
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          userId: user.id,
          username: user.username,
          history: chatHistory
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const apiResult = await apiResponse.json();
      const response = apiResult.response;

      // Save conversation in DB
      dbService.createAIConversation({
        user_id: user.id,
        message: userText,
        response: response.message
      });

      const botMsgId = 'msg_' + (Date.now() + 1);

      if (response.status === 'preview' || response.status === 'requires_confirmation') {
        // Safety Layer: Double-check safety limits before presenting preview
        const safetyResult = await safetyService.evaluateTransaction(
          user.username,
          response.data.recipient,
          response.data.amount
        );

        if (!safetyResult.allowed) {
          // Blocked by daily limit or blacklist
          setMessages(prev => [...prev, {
            id: botMsgId,
            sender: 'assistant',
            text: `❌ **Transaction Blocked:** ${safetyResult.reason}\n\n${safetyResult.details}`,
            timestamp: new Date(),
            animate: true
          }]);
          setTyping(false);
          return;
        }

        // Show transaction preview card
        setMessages(prev => [...prev, {
          id: botMsgId,
          sender: 'assistant',
          text: response.message,
          timestamp: new Date(),
          animate: true,
          previewTx: {
            amount: response.data.amount,
            recipient: response.data.recipient,
            recipientAddress: response.data.recipientAddress,
            fee: response.data.fee,
            requiresManualApproval: response.status === 'requires_confirmation' || safetyResult.requiresConfirmation
          }
        }]);
      } else {
        // General text output (e.g. balance checks, history log lists)
        setMessages(prev => [...prev, {
          id: botMsgId,
          sender: 'assistant',
          text: response.message,
          timestamp: new Date(),
          animate: true
        }]);
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: 'msg_error_' + Date.now(),
        sender: 'assistant',
        text: `Error processing query: ${err.message || 'Unknown network error.'}`,
        timestamp: new Date(),
        animate: true
      }]);
    } finally {
      setTyping(false);
    }
  };

  // Triggers when user clicks 'Approve' on preview tx card
  const approveTransaction = async (txData: any, msgId: string) => {
    if (!user || !wallet || executingTx) return;

    setExecutingTx(true);
    
    try {
      // Decrypt private key or simulate decrypting
      const userObj = await dbService.getUserByUsername(user.username);
      const embeddedWalletInfo = await walletService.createEmbeddedWallet(user.recovery_wallet);

      // Execute on chain / simulate
      const result = await walletService.executeTransfer(
        embeddedWalletInfo.encryptedPrivateKey,
        txData.recipientAddress,
        txData.amount
      );

      if (result.success) {
        // Update local wallet balance in state and DB
        const newBalance = wallet.balance - txData.amount - txData.fee;
        setWalletBalance(newBalance);

        // Record transaction in database
        await dbService.createTransaction({
          sender: '@' + user.username,
          receiver: txData.recipient,
          amount: txData.amount,
          status: 'success',
          hash: result.txHash
        });

        // Update the message bubble to reflect success
        setMessages(prev => prev.map(msg => {
          if (msg.id === msgId) {
            return {
              ...msg,
              previewTx: undefined, // remove preview card
              txSuccess: {
                hash: result.txHash,
                amount: txData.amount,
                recipient: txData.recipient
              }
            };
          }
          return msg;
        }));
      } else {
        alert('Transaction failed: ' + result.error);
      }
    } catch (e: any) {
      console.error(e);
      alert('Execution failed: ' + e.message);
    } finally {
      setExecutingTx(false);
    }
  };

  const cancelTransaction = (msgId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === msgId) {
        return {
          ...msg,
          previewTx: undefined,
          text: '❌ Transaction cancelled by user.'
        };
      }
      return msg;
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Console Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 'bold' }}>ArcPilot Terminal Console</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <div>Daily Limit: <span style={{ color: 'var(--foreground)' }}>100 ARC</span></div>
          <div>•</div>
          <div>Focus Console: <span className="kbd">Ctrl + K</span></div>
          <div>•</div>
          <button 
            onClick={handleClearChat}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--error)', 
              cursor: 'pointer', 
              padding: 0,
              fontSize: '12px',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Trash2 size={12} />
            <span>Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Messages viewport container */}
      <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Background Watermark logo */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          backgroundImage: 'url(/logo.png)',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
          opacity: 0.12,
          pointerEvents: 'none',
          mixBlendMode: 'color-dodge',
          zIndex: 0
        }} />

        {/* Scrollable messages viewport */}
        <div style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: '24px', 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '24px',
          zIndex: 1
        }}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '8px', 
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '15px'
            }}
          >
            {msg.sender === 'user' ? (
              /* CLI Command prompt style */
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--foreground)' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 'bold', userSelect: 'none' }}>arcpilot ~ %</span>
                <span style={{ fontWeight: 'bold', whiteSpace: 'pre-line' }}>{msg.text}</span>
              </div>
            ) : (
              /* CLI Command output style */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div 
                  style={{ 
                    paddingLeft: '24px',
                    color: 'var(--foreground)',
                    whiteSpace: 'pre-line',
                    lineHeight: '1.6'
                  }}
                >
                  {msg.id === 'welcome' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      <BlockText text="ARC" />
                      <BlockText text="PILOT" />
                    </div>
                  )}
                  {msg.animate ? (
                    <TypedText 
                      text={msg.text} 
                      onComplete={() => {
                        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, animate: false } : m));
                      }} 
                    />
                  ) : (
                    msg.text
                  )}
                </div>

                {/* Action Preview Card styled as terminal ASCII box */}
                {msg.previewTx && (
                  <div style={{ 
                    border: '1px solid var(--border)', 
                    borderRadius: '4px', 
                    backgroundColor: 'var(--surface-muted)', 
                    padding: '16px', 
                    maxWidth: '480px',
                    marginTop: '4px',
                    marginLeft: '24px',
                    fontFamily: 'monospace'
                  }}>
                    {msg.previewTx.requiresManualApproval && (
                      <div style={{ display: 'flex', gap: '8px', color: 'var(--error)', fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>
                        <ShieldAlert size={14} />
                        <span>[WARNING] EXCEEDS SAFETY LIMITS</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px', marginBottom: '16px' }}>
                      <div style={{ color: 'var(--text-muted)', userSelect: 'none' }}>+---------------------------------------------+</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Transaction Amount:</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{msg.previewTx.amount.toFixed(2)} ARC</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Recipient User:</span>
                        <span style={{ fontWeight: 'bold' }}>{msg.previewTx.recipient}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Estimated Gas Fee:</span>
                        <span>{msg.previewTx.fee.toFixed(4)} ARC</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', userSelect: 'none' }}>+---------------------------------------------+</div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button 
                        onClick={() => approveTransaction(msg.previewTx, msg.id)}
                        disabled={executingTx}
                        className="btn btn-primary"
                        style={{ flex: 1, height: '32px', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace' }}
                      >
                        {executingTx ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Broadcasting Tx...</span>
                          </>
                        ) : (
                          <span>[Confirm & Sign]</span>
                        )}
                      </button>
                      <button 
                        onClick={() => cancelTransaction(msg.id)}
                        disabled={executingTx}
                        className="btn"
                        style={{ height: '32px', fontSize: '12px', padding: '0 16px', fontFamily: 'monospace' }}
                      >
                        <span>[Cancel]</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Transaction success indicator */}
                {msg.txSuccess && (
                  <div style={{ 
                    border: '1px solid var(--success)', 
                    borderRadius: '4px', 
                    backgroundColor: '#15251e', 
                    padding: '12px 16px', 
                    maxWidth: '480px',
                    marginTop: '4px',
                    marginLeft: '24px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    fontFamily: 'monospace'
                  }}>
                    <Check size={14} style={{ color: 'var(--success)' }} />
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>Transaction Dispatched Successfully</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px', wordBreak: 'break-all' }}>
                        Tx Hash: {msg.txSuccess.hash}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div style={{ paddingLeft: '24px', color: 'var(--text-muted)', fontSize: '15px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={14} className="animate-spin-custom" style={{ color: 'var(--accent)' }} />
            <span className="thinking-loader">arcpilot is thinking</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>

      {/* Suggestion tags */}
      <div style={{ padding: '0 24px', display: 'flex', gap: '8px', overflowX: 'auto', flexShrink: 0, paddingBottom: '8px' }}>
        <button onClick={() => setInput('Show my balance')} className="btn" style={{ fontSize: '11px', padding: '4px 10px' }}>
          <span>Show Balance</span>
        </button>
        <button onClick={() => setInput('Send 5 ARC to @alice')} className="btn" style={{ fontSize: '11px', padding: '4px 10px' }}>
          <span>Send to @alice</span>
        </button>
        <button onClick={() => setInput('Summarize my activity')} className="btn" style={{ fontSize: '11px', padding: '4px 10px' }}>
          <span>Get Summary</span>
        </button>
        <button onClick={() => setInput('Show my last 5 transactions')} className="btn" style={{ fontSize: '11px', padding: '4px 10px' }}>
          <span>History</span>
        </button>
      </div>

      {/* Input console form */}
      <form onSubmit={handleSendMessage} style={{ padding: '16px 24px 24px 24px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface-muted)', display: 'flex', gap: '12px' }}>
        <div style={{ position: 'relative', flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: '14px', color: 'var(--accent)', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '15px', userSelect: 'none' }}>arcpilot ~ %</span>
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Send 10 ARC to @alice... (Ctrl+K to focus)" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="text-input" 
            style={{ paddingLeft: '125px', height: '42px', fontSize: '15px', fontFamily: 'monospace' }}
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ padding: '0 20px', height: '42px', fontFamily: 'monospace', fontWeight: 'bold' }}>
          <span>Execute</span>
        </button>
      </form>
    </div>
  );
}
