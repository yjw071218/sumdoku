package io.github.yjw071218.sumdoku;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * v1.0.40 · 같은 Wi-Fi에서 4자리 코드로 방 찾기.
 *
 * 학교·회사 Wi-Fi는 큰 내부망(/16, /20 등)을 쓰기 때문에 같은 Wi-Fi라도 IP 앞 세 자리가 다를 수 있습니다.
 * v1.0.35는 참가자 IP의 /24(254개)만 훑어서 이런 망에서는 방을 찾지 못했습니다.
 *   1단계: UDP 브로드캐스트로 "이 코드 방 있나요?"를 묻고 방장 기기가 답합니다(망 크기와 무관).
 *   2단계: 답이 없으면 실제 서브넷(최대 4096개 주소)을 앱 안에서 병렬로 확인합니다.
 * 공유기가 기기 간 통신 자체를 막는 망(클라이언트 격리)에서는 어떤 방법으로도 연결되지 않습니다.
 */
public final class RoomDiscovery {
    public static final int UDP_PORT = 8889;
    static final String ASK = "SUMDOKU_FIND:";
    static final String ANSWER = "SUMDOKU_HERE:";
    private static final int MAX_SCAN = 4096;

    private RoomDiscovery() {}

    /** Wi-Fi(또는 핫스팟) 인터페이스의 사설 IPv4를 우선 선택합니다. 모바일 데이터 주소를 피합니다. */
    public static InterfaceAddress wifiAddress() {
        InterfaceAddress best = null;
        int bestScore = -1;
        try {
            for (NetworkInterface nif : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!nif.isUp() || nif.isLoopback()) continue;
                String name = nif.getName() == null ? "" : nif.getName().toLowerCase(java.util.Locale.ROOT);
                for (InterfaceAddress ia : nif.getInterfaceAddresses()) {
                    InetAddress a = ia.getAddress();
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    int score = 0;
                    if (name.startsWith("wlan") || name.startsWith("swlan") || name.startsWith("ap") || name.startsWith("eth")) score += 4;
                    if (name.startsWith("rmnet") || name.startsWith("ccmni") || name.startsWith("pdp") || name.startsWith("tun") || name.startsWith("v4-")) score -= 4;
                    if (a.isSiteLocalAddress()) score += 2;
                    if (ia.getBroadcast() != null) score += 1;
                    if (score > bestScore) { bestScore = score; best = ia; }
                }
            }
        } catch (Exception ignored) {}
        return best;
    }

    public static String localIp() {
        InterfaceAddress ia = wifiAddress();
        return ia == null ? "127.0.0.1" : ia.getAddress().getHostAddress();
    }

    /** 방장 쪽: 브로드캐스트 질문에 응답하는 스레드. */
    public static Thread startResponder(final DatagramSocket socket, final BattleServer server) {
        Thread t = new Thread(() -> {
            byte[] buf = new byte[256];
            while (!socket.isClosed()) {
                try {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    socket.receive(p);
                    String msg = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8).trim();
                    if (!msg.startsWith(ASK)) continue;
                    String code = msg.substring(ASK.length()).trim();
                    if (!server.answersTo(code)) continue;
                    byte[] reply = (ANSWER + code + ":" + server.getPort()).getBytes(StandardCharsets.UTF_8);
                    socket.send(new DatagramPacket(reply, reply.length, p.getAddress(), p.getPort()));
                } catch (Exception e) {
                    if (socket.isClosed()) break;
                }
            }
        }, "sumdoku-discovery");
        t.setDaemon(true);
        t.start();
        return t;
    }

    public interface Callback { void done(String json); }

    /** 참가자 쪽: 코드가 맞는 방의 IP를 찾아 JSON으로 돌려줍니다. */
    public static void find(final String code, final Callback cb) {
        new Thread(() -> {
            String json;
            try { json = findBlocking(code); }
            catch (Exception e) { json = "{\"ok\":false,\"error\":\"internal\"}"; }
            cb.done(json);
        }, "sumdoku-find").start();
    }

    static String findBlocking(String code) throws Exception {
        if (code == null || !code.matches("[0-9]{4}")) return "{\"ok\":false,\"error\":\"bad_code\"}";
        InterfaceAddress ia = wifiAddress();
        String viaUdp = findByBroadcast(code, ia);
        if (viaUdp != null) return "{\"ok\":true,\"ip\":\"" + viaUdp + "\",\"via\":\"broadcast\"}";
        if (ia == null) return "{\"ok\":false,\"error\":\"no_wifi\"}";
        int[] range = scanRange(ia);
        String viaScan = findByScan(code, range[0], range[1], ia.getAddress());
        if (viaScan != null) return "{\"ok\":true,\"ip\":\"" + viaScan + "\",\"via\":\"scan\",\"scanned\":" + range[1] + "}";
        return String.format(java.util.Locale.ROOT, "{\"ok\":false,\"error\":\"not_found\",\"ip\":\"%s\",\"prefix\":%d,\"scanned\":%d}",
            ia.getAddress().getHostAddress(), ia.getNetworkPrefixLength(), range[1]);
    }

    private static String findByBroadcast(String code, InterfaceAddress ia) {
        try (DatagramSocket s = new DatagramSocket()) {
            s.setBroadcast(true);
            s.setSoTimeout(300);
            List<InetAddress> targets = new ArrayList<>();
            targets.add(InetAddress.getByName("255.255.255.255"));
            if (ia != null && ia.getBroadcast() != null) targets.add(ia.getBroadcast());
            byte[] ask = (ASK + code).getBytes(StandardCharsets.UTF_8);
            byte[] buf = new byte[256];
            long end = System.currentTimeMillis() + 2400;
            int round = 0;
            while (System.currentTimeMillis() < end) {
                if (round < 4) {
                    for (InetAddress t : targets) {
                        try { s.send(new DatagramPacket(ask, ask.length, t, UDP_PORT)); } catch (Exception ignored) {}
                    }
                    round++;
                }
                try {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    s.receive(p);
                    String msg = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8).trim();
                    if (msg.startsWith(ANSWER + code + ":") && p.getAddress() instanceof Inet4Address) return p.getAddress().getHostAddress();
                } catch (java.net.SocketTimeoutException ignored) {}
            }
        } catch (Exception ignored) {}
        return null;
    }

    /** {시작 주소(int), 개수}. 서브넷이 4096개보다 크면 내 주소를 중심으로 4096개만. */
    static int[] scanRange(InterfaceAddress ia) { return scanRange(toInt(ia.getAddress()), ia.getNetworkPrefixLength()); }

    /**
     * v1.0.41: 학교망은 172.16.18.x 와 172.16.20.x 처럼 서로 다른 구역(서브넷)으로 나뉘어 있어도
     * 라우팅으로 서로 닿는 경우가 많습니다. 그래서 휴대폰이 알려 준 구역 크기와 상관없이
     * 사설망 블록(10/8, 172.16/12, 192.168/16) 안에서 내 주소를 중심으로 4096개를 확인합니다.
     * (예: 172.16.20.107 → 172.16.12.107 ~ 172.16.28.106)
     */
    static int[] scanRange(int ip, int prefixLength) {
        long u = ip & 0xFFFFFFFFL;
        int first = (int) (u >>> 24), second = (int) ((u >>> 16) & 0xFF);
        int prefix;
        if (first == 10) prefix = 8;
        else if (first == 172 && second >= 16 && second <= 31) prefix = 12;
        else if (first == 192 && second == 168) prefix = 16;
        else prefix = Math.max(16, Math.min(30, prefixLength <= 0 ? 24 : prefixLength));
        long size = 1L << (32 - prefix);
        int mask = (int) (0xFFFFFFFFL << (32 - prefix));
        long net = (ip & mask) & 0xFFFFFFFFL;
        if (size <= MAX_SCAN) return new int[]{(int) (net + 1), (int) size - 2};
        long start = Math.max(net + 1, (ip & 0xFFFFFFFFL) - MAX_SCAN / 2);
        long last = net + size - 2;
        if (start + MAX_SCAN - 1 > last) start = last - MAX_SCAN + 1;
        return new int[]{(int) start, MAX_SCAN};
    }

    private static String findByScan(final String code, final int start, final int count, final InetAddress myIp) throws Exception {
        final AtomicReference<String> found = new AtomicReference<>();
        ExecutorService pool = Executors.newFixedThreadPool(192);
        try {
            // 가까운 주소부터(같은 구역 → 이웃 구역) 확인해 빨리 찾습니다.
            final long self = myIp == null ? (start & 0xFFFFFFFFL) + count / 2 : (toInt(myIp) & 0xFFFFFFFFL);
            Long[] order = new Long[count];
            for (int k = 0; k < count; k++) order[k] = (start & 0xFFFFFFFFL) + k;
            java.util.Arrays.sort(order, (x, y) -> Long.compare(Math.abs(x - self), Math.abs(y - self)));
            for (int k = 0; k < count; k++) {
                if (order[k] == self) continue;
                final String host = toIp((int) (long) order[k]);
                pool.submit(() -> {
                    if (found.get() != null) return;
                    if (probe(host, code)) found.compareAndSet(null, host);
                });
            }
            pool.shutdown();
            long deadline = System.currentTimeMillis() + 25000;
            while (!pool.isTerminated() && found.get() == null && System.currentTimeMillis() < deadline) pool.awaitTermination(100, TimeUnit.MILLISECONDS);
        } finally { pool.shutdownNow(); }
        return found.get();
    }

    static boolean probe(String host, String code) {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, 8888), 350);
            s.setSoTimeout(800);
            OutputStream out = s.getOutputStream();
            out.write(("GET /api/hello HTTP/1.0\r\nHost: " + host + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            out.flush();
            InputStream in = s.getInputStream();
            byte[] buf = new byte[2048];
            int n, total = 0;
            StringBuilder sb = new StringBuilder();
            while (total < 4096 && (n = in.read(buf)) > 0) { sb.append(new String(buf, 0, n, StandardCharsets.UTF_8)); total += n; }
            String body = sb.toString();
            return body.contains("\"app\":\"sumdoku\"") && body.contains("\"code\":\"" + code + "\"") && !body.contains("\"status\":\"closed\"") && !body.contains("\"full\":true");
        } catch (Exception e) {
            return false;
        }
    }

    static int toInt(InetAddress a) {
        byte[] b = a.getAddress();
        return ((b[0] & 0xFF) << 24) | ((b[1] & 0xFF) << 16) | ((b[2] & 0xFF) << 8) | (b[3] & 0xFF);
    }

    static String toIp(int v) {
        return ((v >>> 24) & 0xFF) + "." + ((v >>> 16) & 0xFF) + "." + ((v >>> 8) & 0xFF) + "." + (v & 0xFF);
    }
}
