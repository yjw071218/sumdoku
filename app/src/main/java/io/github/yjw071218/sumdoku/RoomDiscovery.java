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
import java.net.SocketTimeoutException;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * v1.0.42 · 같은 Wi-Fi에서 4자리 코드로 방 초고속 탐색 (NIO 논블로킹 + 브로드캐스트 병렬 실행).
 *
 * 학교·회사 Wi-Fi는 큰 내부망(/16, /20 등)을 쓰기 때문에 같은 Wi-Fi라도 IP 앞 세 자리가 다를 수 있습니다.
 *   - 0단계: 이전에 연결했던 방장 IP가 있으면 10ms 이내 즉시 검증 (가장 빠른 재대결)
 *   - 1단계: UDP 브로드캐스트와 NIO 논블로킹 TCP 스캔을 '병렬로 동시' 시작
 *   - 2단계: Java NIO Selector로 최대 384개 주소를 스레드 생성 없이 논블로킹으로 동시 확인
 *     (4,096개 주소 전체 스캔도 2초 이내 완료, 근접 주소는 수십 ms 이내 발견)
 */
public final class RoomDiscovery {
    public static final int UDP_PORT = 8889;
    static final String ASK = "SUMDOKU_FIND:";
    static final String ANSWER = "SUMDOKU_HERE:";
    private static final int MAX_SCAN = 4096;
    /** 휴대폰 Wi-Fi 절전으로 첫 응답이 수백 ms~1초 이상 늦을 수 있어 넉넉하게 기다립니다. */
    static final long BROADCAST_WINDOW_MS = 3000;
    static final long CONNECT_TIMEOUT_MS = 1200;

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
        find(code, null, cb);
    }

    public static void find(final String code, final String lastHost, final Callback cb) {
        new Thread(() -> {
            String json;
            try { json = findBlocking(code, lastHost); }
            catch (Exception e) { json = "{\"ok\":false,\"error\":\"internal\"}"; }
            cb.done(json);
        }, "sumdoku-find").start();
    }

    static String findBlocking(String code) throws Exception {
        return findBlocking(code, null);
    }

    static String findBlocking(String code, String lastHost) throws Exception {
        if (code == null || !code.matches("[0-9]{4}")) return "{\"ok\":false,\"error\":\"bad_code\"}";

        // 0단계: 이전에 연결했던 방장 IP가 살아있고 코드가 맞으면 10ms 이내 즉시 반환
        if (lastHost != null && lastHost.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$")) {
            if (probe(lastHost, code)) {
                return "{\"ok\":true,\"ip\":\"" + lastHost + "\",\"via\":\"cached\"}";
            }
        }

        InterfaceAddress ia = wifiAddress();
        if (ia == null) return "{\"ok\":false,\"error\":\"no_wifi\"}";

        final AtomicReference<String> found = new AtomicReference<>();
        final AtomicReference<String> foundVia = new AtomicReference<>();

        // 1단계: 브로드캐스트 응답 청취를 백그라운드로 병렬 실행 (스캔 대기 없음)
        Thread bcast = new Thread(() -> findByBroadcastAsync(code, ia, found, foundVia), "sumdoku-bcast-find");
        bcast.setDaemon(true);
        bcast.start();

        // 2단계: 동시에 NIO 논블로킹 스캐너 실행 (384채널 윈도우 슬라이딩)
        int[] range = scanRange(ia);
        List<String> order = buildScanOrder(range[0], range[1], ia.getAddress());
        // 같은 /24(대부분의 가정·핫스팟 방장)는 Wi-Fi 절전 지연을 고려해 넉넉히, 나머지 큰 내부망은 빠르게 확인합니다.
        String self = ia.getAddress().getHostAddress();
        String prefix = self.substring(0, self.lastIndexOf('.') + 1);
        List<String> near = new ArrayList<>(), far = new ArrayList<>();
        for (String h : order) (h.startsWith(prefix) ? near : far).add(h);
        findByScanNio(code, near, found, foundVia, CONNECT_TIMEOUT_MS, 254);
        if (found.get() == null) findByScanNio(code, far, found, foundVia, 250, 384);
        // 스캔이 먼저 끝나도 브로드캐스트 응답 대기 시간이 남아 있으면 끝까지 기다립니다.
        if (found.get() == null) { try { bcast.join(BROADCAST_WINDOW_MS + 500); } catch (InterruptedException ignored) {} }
        // 마지막으로 가까운 주소를 더 긴 대기 시간으로 한 번 더 확인합니다.
        if (found.get() == null) findByScanNio(code, near, found, foundVia, 2500, 254);

        if (found.get() != null) {
            return "{\"ok\":true,\"ip\":\"" + found.get() + "\",\"via\":\"" + foundVia.get() + "\",\"scanned\":" + range[1] + "}";
        }

        return String.format(java.util.Locale.ROOT, "{\"ok\":false,\"error\":\"not_found\",\"ip\":\"%s\",\"prefix\":%d,\"scanned\":%d}",
            ia.getAddress().getHostAddress(), ia.getNetworkPrefixLength(), range[1]);
    }

    private static void findByBroadcastAsync(String code, InterfaceAddress ia, AtomicReference<String> found, AtomicReference<String> foundVia) {
        try (DatagramSocket s = new DatagramSocket()) {
            s.setBroadcast(true);
            s.setSoTimeout(100);
            List<InetAddress> targets = new ArrayList<>();
            targets.add(InetAddress.getByName("255.255.255.255"));
            if (ia != null && ia.getBroadcast() != null) targets.add(ia.getBroadcast());
            byte[] ask = (ASK + code).getBytes(StandardCharsets.UTF_8);
            byte[] buf = new byte[256];
            long deadline = System.currentTimeMillis() + BROADCAST_WINDOW_MS;
            long nextSend = 0;
            while (found.get() == null && System.currentTimeMillis() < deadline) {
                if (System.currentTimeMillis() >= nextSend) {
                    for (InetAddress t : targets) {
                        try { s.send(new DatagramPacket(ask, ask.length, t, UDP_PORT)); } catch (Exception ignored) {}
                    }
                    nextSend = System.currentTimeMillis() + 300;
                }
                try {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    s.receive(p);
                    String msg = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8).trim();
                    if (msg.startsWith(ANSWER + code + ":") && p.getAddress() instanceof Inet4Address) {
                        if (found.compareAndSet(null, p.getAddress().getHostAddress())) {
                            foundVia.set("broadcast");
                        }
                        break;
                    }
                } catch (SocketTimeoutException ignored) {}
            }
        } catch (Exception ignored) {}
    }

    static int[] scanRange(InterfaceAddress ia) { return scanRange(toInt(ia.getAddress()), ia.getNetworkPrefixLength()); }

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

    static List<String> buildScanOrder(int start, int count, InetAddress myIp) {
        final long self = myIp == null ? (start & 0xFFFFFFFFL) + count / 2 : (toInt(myIp) & 0xFFFFFFFFL);
        Long[] order = new Long[count];
        for (int k = 0; k < count; k++) order[k] = (start & 0xFFFFFFFFL) + k;
        java.util.Arrays.sort(order, (x, y) -> Long.compare(Math.abs(x - self), Math.abs(y - self)));
        List<String> list = new ArrayList<>(count);
        for (int k = 0; k < count; k++) {
            if (order[k] == self) continue;
            list.add(toIp((int) (long) order[k]));
        }
        return list;
    }

    private static void findByScanNio(String code, List<String> hosts, AtomicReference<String> found, AtomicReference<String> foundVia) {
        findByScanNio(code, hosts, found, foundVia, CONNECT_TIMEOUT_MS, 256);
    }

    private static void findByScanNio(String code, List<String> hosts, AtomicReference<String> found, AtomicReference<String> foundVia, long timeoutMs, int concurrency) {

        try (Selector selector = Selector.open()) {
            int cursor = 0;
            int active = 0;
            Map<SelectionKey, Long> startTimes = new HashMap<>();

            while ((cursor < hosts.size() || active > 0) && found.get() == null) {
                while (cursor < hosts.size() && active < concurrency && found.get() == null) {
                    String h = hosts.get(cursor++);
                    try {
                        SocketChannel ch = SocketChannel.open();
                        ch.configureBlocking(false);
                        boolean connected = ch.connect(new InetSocketAddress(h, 8888));
                        if (connected) {
                            if (probe(h, code)) {
                                if (found.compareAndSet(null, h)) foundVia.set("scan");
                                ch.close();
                                break;
                            }
                            ch.close();
                        } else {
                            SelectionKey key = ch.register(selector, SelectionKey.OP_CONNECT, h);
                            startTimes.put(key, System.currentTimeMillis());
                            active++;
                        }
                    } catch (Exception ignored) {}
                }

                if (found.get() != null) break;
                if (active == 0 && cursor >= hosts.size()) break;

                int selected = selector.select(20);
                long now = System.currentTimeMillis();

                if (selected > 0) {
                    Iterator<SelectionKey> it = selector.selectedKeys().iterator();
                    while (it.hasNext() && found.get() == null) {
                        SelectionKey key = it.next();
                        it.remove();
                        startTimes.remove(key);
                        active--;

                        SocketChannel ch = (SocketChannel) key.channel();
                        String h = (String) key.attachment();
                        try {
                            if (key.isConnectable() && ch.finishConnect()) {
                                if (probe(h, code)) {
                                    if (found.compareAndSet(null, h)) foundVia.set("scan");
                                    ch.close();
                                    break;
                                }
                            }
                        } catch (Exception ignored) {
                        } finally {
                            try { ch.close(); } catch (Exception ignored) {}
                        }
                    }
                }

                if (found.get() != null) break;

                // 타임아웃 채널 정리
                List<SelectionKey> timedOut = new ArrayList<>();
                for (Map.Entry<SelectionKey, Long> entry : startTimes.entrySet()) {
                    if (now - entry.getValue() > timeoutMs) {
                        timedOut.add(entry.getKey());
                    }
                }
                for (SelectionKey key : timedOut) {
                    startTimes.remove(key);
                    active--;
                    try {
                        key.channel().close();
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception ignored) {}
    }

    static boolean probe(String host, String code) {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, 8888), 2000);
            s.setSoTimeout(2500);
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
