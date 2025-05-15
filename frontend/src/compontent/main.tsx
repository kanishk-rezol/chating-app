import React, { useState, useEffect, useRef } from 'react';

interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  lastUpdated: number;
}

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  senderName: string;
  timestamp: number;
  chatId: string;
}

const ChatApp = () => {
  // Generate a unique user ID for this session
  const [userId] = useState(() => `user_${Math.random().toString(36).substr(2, 9)}`);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('userName') || 'Anonymous';
  });
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempUserName, setTempUserName] = useState('');

  // State initialization
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('chats');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'General', lastMessage: '', lastUpdated: Date.now() },
      { id: '2', name: 'Support', lastMessage: '', lastUpdated: Date.now() },
    ];
  });

  const [activeChat, setActiveChat] = useState<string>(() => {
    return localStorage.getItem('activeChat') || '1';
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('messages');
    return saved ? JSON.parse(saved).filter((msg: Message) => msg.chatId === activeChat) : [];
  });

  const [newMessage, setNewMessage] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('chats', JSON.stringify(chats));
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    localStorage.setItem('userName', userName);
  }, [chats, darkMode, userName]);

  useEffect(() => {
    localStorage.setItem('activeChat', activeChat);
  }, [activeChat]);

  useEffect(() => {
    const allMessages = JSON.parse(localStorage.getItem('messages') || '[]');
    const chatMessages = allMessages.filter((msg: Message) => msg.chatId === activeChat);
    setMessages(chatMessages);
  }, [activeChat]);

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket connection
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080/chat');
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const messageData = JSON.parse(event.data);
        
        // Check if this is our own message that we just sent
        if (messageData.senderId === userId) {
          return; // Skip processing our own messages that come back from the server
        }
        
        // Ensure message has chatId (default to activeChat if not provided)
        if (!messageData.chatId) {
          messageData.chatId = activeChat;
        }

        const receivedMessage: Message = {
          id: messageData.id,
          text: messageData.text,
          sender: 'other',
          senderName: messageData.senderName || 'Anonymous',
          timestamp: messageData.timestamp || Date.now(),
          chatId: messageData.chatId
        };

        // Update all messages in localStorage
        const allMessages = JSON.parse(localStorage.getItem('messages') || '[]');
        
        // Check if message already exists to prevent duplicates
        if (!allMessages.some((msg: Message) => msg.id === receivedMessage.id)) {
          const updatedMessages = [...allMessages, receivedMessage];
          localStorage.setItem('messages', JSON.stringify(updatedMessages));

          // Update chat list
          setChats(prevChats => 
            prevChats.map(chat => 
              chat.id === receivedMessage.chatId 
                ? { 
                    ...chat, 
                    lastMessage: receivedMessage.text,
                    lastUpdated: receivedMessage.timestamp
                  } 
                : chat
            )
          );

          // Only update messages state if it's for the current chat
          if (receivedMessage.chatId === activeChat) {
            setMessages(prev => [...prev, receivedMessage]);
          }
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [activeChat, userId]);

  const handleSendMessage = () => {
    if (newMessage.trim() && socketRef.current?.readyState === WebSocket.OPEN) {
      const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const messageData = {
        id: messageId,
        text: newMessage,
        senderId: userId,
        senderName: userName,
        timestamp: Date.now(),
        chatId: activeChat
      };

      // Send to server
      socketRef.current.send(JSON.stringify(messageData));
      
      // Create local message object
      const localMessage: Message = {
        ...messageData,
        sender: 'me'
      };
      
      // Update all messages in localStorage
      const allMessages = JSON.parse(localStorage.getItem('messages') || '[]');
      const updatedMessages = [...allMessages, localMessage];
      localStorage.setItem('messages', JSON.stringify(updatedMessages));
      
      // Update state with filtered messages
      setMessages(updatedMessages.filter(msg => msg.chatId === activeChat));
      
      // Update chat list
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === activeChat 
            ? { 
                ...chat, 
                lastMessage: newMessage,
                lastUpdated: Date.now()
              } 
            : chat
        )
      );
      
      setNewMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectChat = (chatId: string) => {
    setActiveChat(chatId);
    const allMessages = JSON.parse(localStorage.getItem('messages') || '[]');
    const chatMessages = allMessages.filter((msg: Message) => msg.chatId === chatId);
    setMessages(chatMessages);
  };

  const createNewChat = () => {
    if (newChatName.trim()) {
      const newChat: Chat = {
        id: Date.now().toString(),
        name: newChatName.trim(),
        lastMessage: '',
        lastUpdated: Date.now()
      };

      setChats(prev => [...prev, newChat]);
      setNewChatName('');
      setShowNewChatModal(false);
      selectChat(newChat.id);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleNameChange = () => {
    if (tempUserName.trim()) {
      setUserName(tempUserName.trim());
      setShowNameModal(false);
    }
  };

  return (
    <div className={`flex h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="dark:bg-gray-900 dark:text-gray-100 flex h-full w-full">
        {/* Left sidebar - Chat list and user info */}
        <div className="w-[30%] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* User info section */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium">{userName}</div>
                <button
                  onClick={() => {
                    setTempUserName(userName);
                    setShowNameModal(true);
                  }}
                  className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Edit profile
                </button>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-1 rounded-full focus:outline-none"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>

          {/* Chats header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Chats</h2>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="bg-blue-500 dark:bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 dark:hover:bg-blue-700"
            >
              New Chat
            </button>
          </div>

          {/* Chat list */}
          <div className="overflow-y-auto flex-1">
            {chats
              .sort((a, b) => b.lastUpdated - a.lastUpdated)
              .map(chat => (
                <div
                  key={chat.id}
                  onClick={() => selectChat(chat.id)}
                  className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    activeChat === chat.id ? 'bg-blue-50 dark:bg-gray-600' : ''
                  }`}
                >
                  <h3 className="font-medium">{chat.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                </div>
              ))}
          </div>
        </div>

        {/* Right side - Active chat */}
        <div className="flex flex-col w-[70%]">
          {/* Chat header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold">
              {chats.find(c => c.id === activeChat)?.name || 'New Chat'}
            </h2>
          </div>
          
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-700">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                Start a new conversation
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex mb-4 ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className='flex-col'>
                    <div className={`text-xs mb-1 ${message.sender === 'me' ? 'text-right' : 'text-left'} text-gray-500 dark:text-gray-400`}>
                      {message.sender === 'me' ? 'You' : (message.senderName === 'Anonymous' ? 'Anonymous' : message.senderName)}
                    </div>
                    <div
                      className={`max-w-xs p-3 rounded-3xl shadow ${
                        message.sender === 'me' 
                          ? 'bg-blue-500 text-white rounded-br-none' 
                          : 'bg-gray-200 dark:bg-gray-600 text-black dark:text-white rounded-bl-none'
                      }`}
                    >
                      {message.text}
                    </div>
                    <div className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'} text-xs mt-1 ${
                      message.sender === 'me' ? 'text-black dark:text-gray-300' : 'text-black dark:text-gray-300'
                    }`}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Message input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Type a message..."
              />
              <button
                onClick={handleSendMessage}
                className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!newMessage.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* New Chat Modal */}
        {showNewChatModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
              <h3 className="text-lg font-semibold mb-4">Create New Chat</h3>
              <input
                type="text"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                className="w-full px-4 py-2 border rounded-md mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter chat name"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 border rounded-md dark:border-gray-600 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewChat}
                  className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700"
                  disabled={!newChatName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Name Modal */}
        {showNameModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
              <h3 className="text-lg font-semibold mb-4">Change Your Name</h3>
              <input
                type="text"
                value={tempUserName}
                onChange={(e) => setTempUserName(e.target.value)}
                className="w-full px-4 py-2 border rounded-md mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter your name"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowNameModal(false)}
                  className="px-4 py-2 border rounded-md dark:border-gray-600 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNameChange}
                  className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700"
                  disabled={!tempUserName.trim()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;