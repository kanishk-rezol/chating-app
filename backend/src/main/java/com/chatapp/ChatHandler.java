package com.chatapp;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ChatHandler extends TextWebSocketHandler {
    private static Map<String, CopyOnWriteArrayList<WebSocketSession>> chatRooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String chatId = getChatIdFromSession(session);
        chatRooms.computeIfAbsent(chatId, k -> new CopyOnWriteArrayList<>()).add(session); 
        System.out.println("New connection to chat " + chatId + ": " + session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String chatId = getChatIdFromSession(session);
        String payload = message.getPayload();
        System.out.println("Message in chat " + chatId + ": " + payload);
        CopyOnWriteArrayList<WebSocketSession> sessions = chatRooms.get(chatId);
        if (sessions != null) {
            for (WebSocketSession webSocketSession : sessions) {
                if (webSocketSession.isOpen() && !webSocketSession.equals(session)) {
                    try {
                        webSocketSession.sendMessage(message);
                    } catch (IOException e) {
                        System.err.println("Error sending message to session " + webSocketSession.getId());
                    }
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        chatRooms.forEach((chatId, sessions) -> sessions.remove(session));
        System.out.println("Connection closed: " + session.getId() + " (" + status + ")");
    }

    private String getChatIdFromSession(WebSocketSession session) {
        return "default";
    }
}