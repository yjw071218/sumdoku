package io.github.yjw071218.sumdoku;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 동일 Wi-Fi 환경 기기 간 실시간 배틀을 위한 초경량 내장 HTTP REST 서버
 * - 외부 라이브러리 없이 순수 Java 소켓으로 동작
 * - 동일한 맵, 게임 모드, 진행 상황(칸 수, 점수, 실수) 실시간 동기화
 */
public class BattleServer {
    private ServerSocket serverSocket;
    private Thread serverThread;
    private ExecutorService clientPool;
    private volatile boolean running = false;
    private int port = 8888;

    // 대전 방 상태
    private volatile String roomStatus = "waiting"; // waiting, playing, ended
    private volatile String battleMode = "race";     // race, score, survival
    private volatile String difficulty = "medium";
    private volatile int timeLimit = 300;            // 타임어택 제한 시간(초)
    private volatile String puzzleJson = "{}";

    // 양 플레이어 실시간 진행 상태
    private final ConcurrentHashMap<String, String> p1State = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> p2State = new ConcurrentHashMap<>();
    private volatile boolean guestJoined = false;

    public BattleServer() {
        resetRoom();
    }

    public synchronized boolean start(int port) {
        if (running) return true;
        this.port = port;
        try {
            serverSocket = new ServerSocket(port);
            running = true;
            clientPool = Executors.newFixedThreadPool(4);
            final ServerSocket listeningSocket = serverSocket;
            final ExecutorService pool = clientPool;
            serverThread = new Thread(() -> {
                while (!listeningSocket.isClosed()) {
                    try {
                        Socket socket = listeningSocket.accept();
                        pool.submit(() -> handleClient(socket));
                    } catch (Exception e) {
                        if (listeningSocket.isClosed()) break;
                    }
                }
            });
            serverThread.start();
            return true;
        } catch (Exception e) {
            running = false;
            return false;
        }
    }

    public synchronized void stop() {
        running = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (Exception ignored) {}
        try {
            if (clientPool != null) clientPool.shutdownNow();
        } catch (Exception ignored) {}
        serverSocket = null;
        resetRoom();
    }

    public boolean isRunning() {
        return running;
    }

    public int getPort() {
        return port;
    }

    public void configureRoom(String mode, String diff, int timeLimitSec, String puzzleData) {
        this.battleMode = mode;
        this.difficulty = diff;
        this.timeLimit = timeLimitSec;
        this.puzzleJson = puzzleData;
        this.roomStatus = "waiting";
        this.guestJoined = false;
        this.p1State.clear();
        this.p2State.clear();
    }

    public void startMatch() {
        this.roomStatus = "playing";
    }

    private void resetRoom() {
        this.roomStatus = "waiting";
        this.guestJoined = false;
        this.p1State.clear();
        this.p2State.clear();
        this.puzzleJson = "{}";
    }

    private void handleClient(Socket socket) {
        try (socket) {
            socket.setSoTimeout(5000);
            InputStream in = new BufferedInputStream(socket.getInputStream());
            OutputStream out = socket.getOutputStream();

            String requestLine = readHeaderLine(in);
            if (requestLine == null) return;

            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;
            String method = parts[0].toUpperCase();
            String path = parts[1];

            // 헤더 파싱
            int contentLength = 0;
            String line;
            while ((line = readHeaderLine(in)) != null && !line.isEmpty()) {
                if (line.toLowerCase().startsWith("content-length:")) {
                    try {
                        contentLength = Integer.parseInt(line.substring(15).trim());
                    } catch (Exception ignored) {}
                }
            }

            if (contentLength < 0 || contentLength > 262144) { sendResponse(out, 413, "{}"); return; }
            byte[] payload = new byte[contentLength];
            int received = 0;
            while (received < contentLength) {
                int count = in.read(payload, received, contentLength - received);
                if (count < 0) return;
                received += count;
            }
            String body = new String(payload, StandardCharsets.UTF_8);

            // CORS 프리플라이트 처리
            if ("OPTIONS".equals(method)) {
                sendResponse(out, 200, "{\"ok\":true}");
                return;
            }

            // REST API 라우팅
            String responseJson = "{\"error\":\"not_found\"}";
            int statusCode = 200;

            if (path.startsWith("/api/status")) {
                responseJson = String.format(
                    "{\"ok\":true,\"status\":\"%s\",\"guestJoined\":%b,\"mode\":\"%s\",\"diff\":\"%s\",\"timeLimit\":%d}",
                    roomStatus, guestJoined, battleMode, difficulty, timeLimit
                );
            } else if (path.startsWith("/api/join")) {
                guestJoined = true;
                responseJson = "{\"ok\":true,\"message\":\"Joined room successfully\",\"player\":2}";
            } else if (path.startsWith("/api/start")) {
                roomStatus = "playing";
                responseJson = "{\"ok\":true,\"status\":\"playing\"}";
            } else if (path.startsWith("/api/room")) {
                responseJson = String.format(
                    "{\"ok\":true,\"status\":\"%s\",\"mode\":\"%s\",\"diff\":\"%s\",\"timeLimit\":%d,\"puzzle\":%s}",
                    roomStatus, battleMode, difficulty, timeLimit, puzzleJson
                );
            } else if (path.startsWith("/api/progress")) {
                if ("POST".equals(method)) {
                    // Update progress
                    String bodyStr = body.toString();
                    if (bodyStr.contains("\"player\":1") || bodyStr.contains("\"player\":\"1\"")) {
                        p1State.put("data", bodyStr);
                    } else {
                        p2State.put("data", bodyStr);
                    }
                    responseJson = "{\"ok\":true}";
                } else {
                    // GET progress
                    String p1 = p1State.getOrDefault("data", "{}");
                    String p2 = p2State.getOrDefault("data", "{}");
                    responseJson = String.format("{\"ok\":true,\"p1\":%s,\"p2\":%s,\"status\":\"%s\"}", p1, p2, roomStatus);
                }
            } else if (path.startsWith("/api/end")) {
                roomStatus = "ended";
                responseJson = "{\"ok\":true,\"status\":\"ended\"}";
            }

            sendResponse(out, statusCode, responseJson);
        } catch (Exception ignored) {}
    }

    private String readHeaderLine(InputStream in) throws Exception {
        ByteArrayOutputStream line = new ByteArrayOutputStream();
        int value;
        while ((value = in.read()) != -1) {
            if (value == 10) break;
            if (value != 13) line.write(value);
            if (line.size() > 8192) throw new java.io.IOException("Header too long");
        }
        return value == -1 && line.size() == 0 ? null : new String(line.toByteArray(), StandardCharsets.UTF_8);
    }

    private void sendResponse(OutputStream out, int code, String json) throws Exception {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        String header = "HTTP/1.1 " + code + " OK\r\n" +
            "Content-Type: application/json; charset=utf-8\r\n" +
            "Access-Control-Allow-Origin: *\r\n" +
            "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
            "Access-Control-Allow-Headers: *\r\n" +
            "Content-Length: " + bytes.length + "\r\n" +
            "Connection: close\r\n\r\n";
        out.write(header.getBytes(StandardCharsets.UTF_8));
        out.write(bytes);
        out.flush();
    }

    public static String getLocalIpAddress() {
        try {
            for (Enumeration<NetworkInterface> en = NetworkInterface.getNetworkInterfaces(); en.hasMoreElements();) {
                NetworkInterface intf = en.nextElement();
                for (Enumeration<InetAddress> enumIpAddr = intf.getInetAddresses(); enumIpAddr.hasMoreElements();) {
                    InetAddress inetAddress = enumIpAddr.nextElement();
                    if (!inetAddress.isLoopbackAddress() && inetAddress instanceof Inet4Address) {
                        return inetAddress.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {}
        return "127.0.0.1";
    }
}
