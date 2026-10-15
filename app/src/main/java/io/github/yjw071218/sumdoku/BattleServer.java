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
    // v1.0.40: 4자리 코드 브로드캐스트 탐색 응답용 (TCP 포트 + 1)
    private java.net.DatagramSocket discoverySocket;
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
    private volatile String generationProgress = null;

    // 양 플레이어 실시간 진행 상태
    private final ConcurrentHashMap<String, String> p1State = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> p2State = new ConcurrentHashMap<>();
    private volatile boolean guestJoined = false;
    private volatile boolean p1Ready = false;
    private volatile boolean p2Ready = false;
    private volatile long lastGuestActiveTime = 0;
    private volatile int endedBy = 0;
    private volatile String endReason = "";
    private volatile int endWinner = -1; // -1 미정, 0 무승부, 1/2 승자
    private String terminalProgress = null;
    // 배틀 채팅: 최근 60개만 보관
    private final java.util.ArrayList<String> chatLog = new java.util.ArrayList<>();
    private int chatSeq = 0;

    // v1.0.50 턴제 모드: 서버가 차례와 수순을 단일 기준으로 관리합니다.
    private int turnPlayer = 1;
    private int turnSeq = 0;
    private long turnStartedAt = 0;
    private final java.util.ArrayList<String> turnLog = new java.util.ArrayList<>();

    private synchronized void resetTurns() {
        turnPlayer = 1; turnSeq = 0; turnStartedAt = System.currentTimeMillis(); turnLog.clear();
    }

    private static int jsonInt(String body, String key, int def) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + key + "\"\\s*:\\s*\"?(-?\\d+)\"?").matcher(body == null ? "" : body);
        return m.find() ? Integer.parseInt(m.group(1)) : def;
    }

    private synchronized String turnSnapshot(int after) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("{\"ok\":true,\"turn\":%d,\"seq\":%d,\"elapsed\":%d,\"status\":\"%s\",\"moves\":[",
            turnPlayer, turnSeq, System.currentTimeMillis() - turnStartedAt, roomStatus));
        boolean first = true;
        for (int i = Math.max(0, after); i < turnLog.size(); i++) { if (!first) sb.append(','); sb.append(turnLog.get(i)); first = false; }
        return sb.append("]}").toString();
    }

    /** 턴 수: 착수(r,c,v,ok) 또는 시간 초과 패스(pass). 상대는 제한 시간 + 4초 뒤에만 대신 패스를 걸 수 있습니다. */
    synchronized String turnMove(String body, int limitSec) {
        int player = playerNumber(body);
        int seq = jsonInt(body, "seq", -1);
        boolean pass = flag(body, "pass");
        if (player == 0 || !"playing".equals(roomStatus)) return null;
        if (seq != turnSeq) return null;
        long elapsed = System.currentTimeMillis() - turnStartedAt;
        if (player != turnPlayer && !(pass && elapsed > (limitSec + 4) * 1000L)) return null;
        int mover = turnPlayer;
        int r = jsonInt(body, "r", -1), c = jsonInt(body, "c", -1), v = jsonInt(body, "v", 0), score = jsonInt(body, "score", 0);
        if (!pass && (r < 0 || r > 8 || c < 0 || c > 8 || v < 1 || v > 9)) return null;
        turnLog.add(String.format("{\"seq\":%d,\"player\":%d,\"pass\":%b,\"r\":%d,\"c\":%d,\"v\":%d,\"ok\":%b,\"score\":%d}",
            turnSeq, mover, pass, r, c, v, flag(body, "ok"), score));
        turnSeq++;
        turnPlayer = 3 - turnPlayer;
        turnStartedAt = System.currentTimeMillis();
        return turnSnapshot(turnLog.size() - 1);
    }
    // v1.0.35: 같은 네트워크에 방이 여러 개 있어도 구분하는 4자리 방 코드
    private volatile String roomCode = "";

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
            try {
                discoverySocket = new java.net.DatagramSocket(null);
                discoverySocket.setReuseAddress(true);
                discoverySocket.setBroadcast(true);
                discoverySocket.bind(new java.net.InetSocketAddress(port + 1));
                RoomDiscovery.startResponder(discoverySocket, this);
            } catch (Exception e) {
                // 브로드캐스트 응답을 못 열어도 서브넷 확인·IP 직접 접속은 동작합니다.
                if (discoverySocket != null) discoverySocket.close();
                discoverySocket = null;
            }
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
            if (discoverySocket != null) discoverySocket.close();
        } catch (Exception ignored) {}
        discoverySocket = null;
        try {
            if (clientPool != null) clientPool.shutdownNow();
        } catch (Exception ignored) {}
        serverSocket = null;
        resetRoom();
    }

    /** 브로드캐스트 질문에 답할 방인지: 코드 일치, 닫히지 않음, 빈자리 있음 */
    public boolean answersTo(String code) {
        boolean full = guestJoined && lastGuestActiveTime > 0 && System.currentTimeMillis() - lastGuestActiveTime <= 3500;
        return running && !roomCode.isEmpty() && roomCode.equals(code) && !"closed".equals(roomStatus) && !full;
    }

    public boolean isRunning() {
        return running;
    }

    public int getPort() {
        return port;
    }

    public synchronized void configureRoom(String mode, String diff, int timeLimitSec, String puzzleData) {
        terminalProgress = null;
        this.battleMode = mode;
        this.difficulty = diff;
        this.timeLimit = timeLimitSec;
        this.puzzleJson = (puzzleData != null && !puzzleData.isEmpty()) ? puzzleData : "{}";
        this.roomStatus = "waiting";
        this.guestJoined = false;
        this.p1Ready = false;
        this.p2Ready = false;
        this.p1State.clear();
        this.p2State.clear();
        this.lastGuestActiveTime = 0;
        this.endedBy = 0;
        this.endReason = ""; this.endWinner = -1;
        this.chatLog.clear();
        this.generationProgress = null; resetTurns();
        String code = jsonString(this.puzzleJson, "roomCode");
        this.roomCode = code != null && code.matches("[0-9]{4}") ? code : "";
    }

    public synchronized void startMatch() {
        terminalProgress = null;
        this.generationProgress = null; resetTurns();
        this.roomStatus = "playing";
        this.endedBy = 0;
        this.endReason = ""; this.endWinner = -1;
    }

    private void resetRoom() {
        terminalProgress = null;
        this.generationProgress = null; resetTurns();
        this.roomStatus = "waiting";
        this.guestJoined = false;
        this.p1Ready = false;
        this.p2Ready = false;
        this.p1State.clear();
        this.p2State.clear();
        this.puzzleJson = "{}";
        this.lastGuestActiveTime = 0;
        this.endedBy = 0;
        this.endReason = ""; this.endWinner = -1;
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

            if (contentLength < 0 || contentLength > 524288) { sendResponse(out, 413, "{}"); return; }
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

            // Serialize state transitions, but never hold this lock during socket I/O.
            synchronized (this) {
            if (path.startsWith("/api/status")) {
                if ("waiting".equals(roomStatus) && guestJoined) {
                    if (lastGuestActiveTime > 0 && (System.currentTimeMillis() - lastGuestActiveTime) > 3500) {
                        guestJoined = false;
                        p2Ready = false;
                        p2State.clear();
                    }
                }
                responseJson = String.format(
                    "{\"ok\":true,\"status\":\"%s\",\"guestJoined\":%b,\"p1Ready\":%b,\"p2Ready\":%b,\"mode\":\"%s\",\"diff\":\"%s\",\"timeLimit\":%d,\"endedBy\":%d,\"endReason\":\"%s\"}",
                    roomStatus, guestJoined, p1Ready, p2Ready, battleMode, difficulty, timeLimit, endedBy, endReason
                );
            } else if (path.startsWith("/api/hello")) {
                responseJson = String.format("{\"ok\":true,\"app\":\"sumdoku\",\"code\":\"%s\",\"status\":\"%s\",\"full\":%b}",
                    roomCode, roomStatus, guestJoined && lastGuestActiveTime > 0 && System.currentTimeMillis() - lastGuestActiveTime <= 3500);
            } else if (path.startsWith("/api/join") && !"closed".equals(roomStatus) && !roomCode.isEmpty() && jsonString(body, "code") != null && !roomCode.equals(jsonString(body, "code"))) {
                statusCode = 403;
                responseJson = "{\"ok\":false,\"error\":\"wrong_code\"}";
            } else if (path.startsWith("/api/join") && guestJoined && lastGuestActiveTime > 0 && System.currentTimeMillis() - lastGuestActiveTime <= 3500) {
                statusCode = 409;
                responseJson = "{\"ok\":false,\"error\":\"room_full\"}";
            } else if (path.startsWith("/api/join")) {
                guestJoined = true;
                p2Ready = false;
                lastGuestActiveTime = System.currentTimeMillis();
                responseJson = "{\"ok\":true,\"message\":\"Joined room successfully\",\"player\":2}";
            } else if (path.startsWith("/api/leave")) {
                if ("playing".equals(roomStatus)) {
                    finishMatch(2, "forfeit");
                }
                guestJoined = false;
                p2Ready = false;
                lastGuestActiveTime = 0;
                responseJson = "{\"ok\":true,\"message\":\"Left room successfully\"}";
            } else if (path.startsWith("/api/close")) {
                if ("playing".equals(roomStatus)) {
                    finishMatch(1, "forfeit");
                } else {
                    roomStatus = "closed";
                }
                guestJoined = false;
                p1Ready = false;
                p2Ready = false;
                p1State.clear();
                p2State.clear();
                puzzleJson = "{}";
                generationProgress = null; resetTurns();
                lastGuestActiveTime = 0;
                chatLog.clear();
                responseJson = "{\"ok\":true,\"status\":\"closed\"}";
            } else if (path.startsWith("/api/ready")) {
                if ("POST".equals(method)) {
                    if (body.contains("\"player\":1") || body.contains("\"player\":\"1\"")) {
                        p1Ready = body.contains("\"ready\":true");
                    } else if (body.contains("\"player\":2") || body.contains("\"player\":\"2\"")) {
                        p2Ready = body.contains("\"ready\":true");
                        lastGuestActiveTime = System.currentTimeMillis();
                    }
                }
                responseJson = String.format("{\"ok\":true,\"p1Ready\":%b,\"p2Ready\":%b}", p1Ready, p2Ready);
            } else if (path.startsWith("/api/rematch")) {
                roomStatus = "waiting";
                p1Ready = false;
                p2Ready = false;
                p1State.clear();
                p2State.clear();
                puzzleJson = "{}";
                generationProgress = null; resetTurns();
                endedBy = 0;
                endReason = ""; endWinner = -1;
                lastGuestActiveTime = System.currentTimeMillis();
                responseJson = "{\"ok\":true,\"status\":\"waiting\"}";
            } else if (path.startsWith("/api/generating")) {
                if ("POST".equals(method)) {
                    generationProgress = (body == null || body.trim().isEmpty() || "{}".equals(body.trim())) ? null : body;
                    responseJson = "{\"ok\":true}";
                } else {
                    responseJson = String.format("{\"ok\":true,\"generation\":%s}", generationProgress == null ? "null" : generationProgress);
                }
            } else if (path.startsWith("/api/start")) {
                if (!"POST".equals(method) || !"waiting".equals(roomStatus) || !guestJoined || !p2Ready || !body.contains("\"solution\"") || !body.contains("\"cages\"")) {
                    statusCode = 409;
                    responseJson = "{\"ok\":false,\"error\":\"not_ready\"}";
                } else {
                    puzzleJson = body;
                    generationProgress = null; resetTurns();
                    roomStatus = "playing";
                    terminalProgress = null;
                    endedBy = 0;
                    endReason = ""; endWinner = -1;
                    responseJson = "{\"ok\":true,\"status\":\"playing\"}";
                }
            } else if (path.startsWith("/api/room")) {
                lastGuestActiveTime = System.currentTimeMillis();
                responseJson = String.format(
                    "{\"ok\":true,\"status\":\"%s\",\"mode\":\"%s\",\"diff\":\"%s\",\"timeLimit\":%d,\"p1Ready\":%b,\"p2Ready\":%b,\"guestJoined\":%b,\"endedBy\":%d,\"endReason\":\"%s\",\"puzzle\":%s,\"generation\":%s}",
                    roomStatus, battleMode, difficulty, timeLimit, p1Ready, p2Ready, guestJoined, endedBy, endReason, puzzleJson,
                    generationProgress == null ? "null" : generationProgress
                );
            } else if (path.startsWith("/api/chat")) {
                if ("POST".equals(method)) {
                    int player = playerNumber(body);
                    String text = jsonString(body, "text");
                    if (player == 0 || text == null || text.trim().isEmpty()) {
                        statusCode = 400;
                        responseJson = "{\"ok\":false,\"error\":\"invalid_chat\"}";
                    } else {
                        text = text.trim();
                        if (text.codePointCount(0, text.length()) > 80) text = text.substring(0, text.offsetByCodePoints(0, 80));
                        chatSeq++;
                        chatLog.add(String.format("{\"id\":%d,\"player\":%d,\"text\":\"%s\",\"t\":%d}", chatSeq, player, escapeJson(text), System.currentTimeMillis()));
                        while (chatLog.size() > 60) chatLog.remove(0);
                        if (player == 2) lastGuestActiveTime = System.currentTimeMillis();
                        responseJson = String.format("{\"ok\":true,\"id\":%d}", chatSeq);
                    }
                } else {
                    int after = 0;
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("[?&]after=(\\d+)").matcher(path);
                    if (m.find()) { try { after = Integer.parseInt(m.group(1)); } catch (NumberFormatException ignored) {} }
                    StringBuilder sb = new StringBuilder("{\"ok\":true,\"last\":").append(chatSeq).append(",\"messages\":[");
                    boolean first = true;
                    for (String msg : chatLog) {
                        java.util.regex.Matcher im = java.util.regex.Pattern.compile("^\\{\"id\":(\\d+)").matcher(msg);
                        if (im.find() && Integer.parseInt(im.group(1)) > after) { if (!first) sb.append(','); sb.append(msg); first = false; }
                    }
                    responseJson = sb.append("]}").toString();
                }
            } else if (path.startsWith("/api/turn")) {
                if ("POST".equals(method)) {
                    String res = turnMove(body, Math.max(10, jsonInt(puzzleJson, "turnSeconds", 30)));
                    if (res == null) { statusCode = 409; responseJson = turnSnapshot(Integer.MAX_VALUE).replace("\"ok\":true", "\"ok\":false"); }
                    else responseJson = res;
                } else {
                    int after = 0;
                    java.util.regex.Matcher am = java.util.regex.Pattern.compile("after=(\\d+)").matcher(path);
                    if (am.find()) after = Integer.parseInt(am.group(1));
                    responseJson = turnSnapshot(after);
                }
            } else if (path.startsWith("/api/progress")) {
                if ("POST".equals(method)) {
                    int player = playerNumber(body);
                    if (player == 0) {
                        statusCode = 400;
                    } else {
                        responseJson = recordProgress(player, body);
                    }
                    if (player == 0) responseJson = "{\"ok\":false}";
                } else {
                    responseJson = progressSnapshot();
                }
            } else if (path.startsWith("/api/end")) {
                int player = playerNumber(body);
                if (!"POST".equals(method) || player == 0) {
                    statusCode = 400;
                    responseJson = "{\"ok\":false,\"error\":\"invalid_end\"}";
                } else {
                    responseJson = endMatch(player, body);
                }
            }
            }

            sendResponse(out, statusCode, responseJson);
        } catch (Exception ignored) {}
    }

    private static String jsonString(String body, String key) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + key + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(body);
        if (!m.find()) return null;
        String raw = m.group(1);
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < raw.length(); i++) {
            char ch = raw.charAt(i);
            if (ch != '\\' || i + 1 >= raw.length()) { out.append(ch); continue; }
            char n = raw.charAt(++i);
            switch (n) {
                case 'n': out.append(' '); break;
                case 't': out.append(' '); break;
                case 'r': break;
                case 'u':
                    if (i + 4 < raw.length()) { try { out.append((char) Integer.parseInt(raw.substring(i + 1, i + 5), 16)); i += 4; } catch (NumberFormatException e) { out.append('?'); } }
                    break;
                default: out.append(n);
            }
        }
        return out.toString();
    }

    private static String escapeJson(String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == '"' || ch == '\\') b.append('\\').append(ch);
            else if (ch < 0x20) b.append(' ');
            else if (ch == '<') b.append("\\u003c");
            else b.append(ch);
        }
        return b.toString();
    }

    private static int playerNumber(String body) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"player\"\\s*:\\s*\"?([12])\"?\\s*[,}]").matcher(body);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private static boolean flag(String body, String key) {
        return java.util.regex.Pattern.compile("\"" + key + "\"\\s*:\\s*true\\s*[,}]").matcher(body).find();
    }

    /** 경기 종료 요청을 한 번에 하나씩 처리합니다. 먼저 도착한 종료만 인정하고, 이후 요청은 확정된 결과를 돌려받습니다. */
    private synchronized String recordProgress(int player, String body) {
        if ("playing".equals(roomStatus)) {
            (player == 1 ? p1State : p2State).put("data", body);
            if (player == 2) lastGuestActiveTime = System.currentTimeMillis();
            if (flag(body, "resigned") || flag(body, "forfeit")) finishMatch(player, "forfeit");
        }
        return progressSnapshot();
    }

    private synchronized String endMatch(int player, String body) {
        if ("playing".equals(roomStatus)) {
            (player == 1 ? p1State : p2State).put("data", body);
            boolean forfeit = flag(body, "forfeit") || flag(body, "resigned");
            String kind = jsonString(body, "reason");
            if (forfeit || kind == null || !kind.matches("completed|race|turn|eliminated|timeup|negative")) kind = forfeit ? "forfeit" : "completed";
            int winner;
            if (forfeit) winner = 3 - player;
            else if ("race".equals(kind)) {
                // 스피드 레이스: 서버에 기록된 최신 점수로 승패를 정합니다(완주자는 보너스 포함 점수).
                int mine = jsonInt(body, "score", 0);
                int other = jsonInt((player == 1 ? p2State : p1State).getOrDefault("data", "{}"), "score", 0);
                winner = mine > other ? player : mine < other ? 3 - player : 0;
            } else winner = jsonInt(body, "winner", "completed".equals(kind) ? player : -1);
            finishMatch(player, kind, winner < 0 || winner > 2 ? -1 : winner);
        }
        return progressSnapshot();
    }

    private void finishMatch(int player, String reason) {
        finishMatch(player, reason, "forfeit".equals(reason) ? 3 - player : "completed".equals(reason) ? player : -1);
    }

    private void finishMatch(int player, String reason, int winner) {
        if (!"playing".equals(roomStatus)) return;
        endWinner = winner;
        endedBy = player;
        endReason = reason;
        roomStatus = "ended";
        terminalProgress = progressSnapshot();
    }

    private synchronized String progressSnapshot() {
        // Retain the previous result while a rematch is waiting, so a slow peer
        // can still observe the terminal event before joining the new lobby.
        if (terminalProgress != null) return terminalProgress;
        return String.format("{\"ok\":true,\"p1\":%s,\"p2\":%s,\"status\":\"%s\",\"endedBy\":%d,\"endReason\":\"%s\",\"winner\":%d}",
            p1State.getOrDefault("data", "{}"), p2State.getOrDefault("data", "{}"), roomStatus, endedBy, endReason, endWinner);
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
        String wifi = RoomDiscovery.localIp();
        if (!"127.0.0.1".equals(wifi)) return wifi;
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
