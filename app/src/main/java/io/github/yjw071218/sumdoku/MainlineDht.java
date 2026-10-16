package io.github.yjw071218.sumdoku;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * v2.0.1 · 서버 없는 전 세계 랜덤 매칭용 Mainline DHT(BitTorrent BEP 5) 경량 노드.
 *
 * 동작 순서
 *  1. 공개 부트스트랩 노드(router.bittorrent.com 등)에서 출발해 매칭 구역의 info_hash 쪽으로
 *     get_peers 반복 탐색을 합니다. (info_hash = SHA-1("sumdoku-match|프로토콜|구역|모드|난이도"))
 *  2. 가장 가까운 노드들에게 announce_peer(implied_port=1)를 보내 "이 구역에서 상대를 찾는 중"이라고 등록합니다.
 *     implied_port=1 이므로 DHT 노드는 NAT 바깥에서 보이는 우리 포트를 기록하고, 같은 소켓으로 홀펀칭할 수 있습니다.
 *  3. get_peers 응답의 values(같은 구역에 등록된 기기)에게 같은 UDP 소켓으로 "SDK2|H" 인사 패킷을 반복 전송해
 *     NAT 구멍을 뚫습니다(UDP hole punching). 양쪽이 서로에게 보내면 대부분의 콘(cone) NAT를 통과합니다.
 *  4. 인사가 오가면 JS에 상대를 알리고, 이후 이 UDP 경로로 WebRTC offer/answer(SDP)를 조각내 재전송·확인응답 방식으로 전달합니다.
 *     실제 게임 데이터는 WebRTC DataChannel로 오갑니다.
 *
 * 외부 라이브러리 없이 순수 Java 소켓만 사용합니다(IPv4).
 */
public class MainlineDht {
    public interface Listener {
        void onPeer(String addr, String peerId);
        void onMessage(String addr, String text);
        void onStatus(String json);
    }

    private static final String[][] BOOTSTRAP = {
        {"router.bittorrent.com", "6881"},
        {"router.utorrent.com", "6881"},
        {"dht.transmissionbt.com", "6881"},
        {"dht.libtorrent.org", "25401"},
        {"dht.aelitis.com", "6881"},
    };
    private static final String MAGIC = "SDK2|";
    private static final int K = 8;
    private static final int ALPHA = 6;
    private static final int CHUNK = 700;

    private final Listener listener;
    private final SecureRandom rnd = new SecureRandom();
    private final byte[] nodeId = new byte[20];

    private volatile boolean running = false;
    private volatile DatagramSocket socket;
    private volatile byte[] infoHash;
    private volatile String selfId = "";
    private Thread recvThread, loopThread;
    private ScheduledExecutorService sched;

    // ---------------- 탐색 상태 ----------------
    private static final class Node {
        final InetSocketAddress addr; byte[] id; byte[] token;
        boolean queried, responded; long sentAt;
        Node(InetSocketAddress a, byte[] id) { this.addr = a; this.id = id; }
    }
    private final Object lookupLock = new Object();
    private final Map<String, Node> nodes = new LinkedHashMap<>();
    /** 진행 중인 KRPC 질의: 트랜잭션 ID → 대상 주소 */
    private final ConcurrentHashMap<String, String> pending = new ConcurrentHashMap<>();
    private int tidSeq = 0;

    // ---------------- 상대(같은 구역 기기) 상태 ----------------
    private final ConcurrentHashMap<String, Long> punchUntil = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> peerNotified = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Boolean> knownPeers = new ConcurrentHashMap<>();

    // ---------------- 신뢰 전송(SDP 시그널링) 상태 ----------------
    private static final class OutMsg {
        final InetSocketAddress to; final String id; final String[] parts; final boolean[] acked; int tries;
        OutMsg(InetSocketAddress to, String id, String[] parts) { this.to = to; this.id = id; this.parts = parts; this.acked = new boolean[parts.length]; }
    }
    private static final class InMsg { String[] parts; int got; long at = System.currentTimeMillis(); }
    private final ConcurrentHashMap<String, OutMsg> outbox = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, InMsg> inbox = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> delivered = new ConcurrentHashMap<>();

    private volatile int foundPeers = 0;
    private volatile int respondedNodes = 0;
    private volatile int announced = 0;

    public MainlineDht(Listener listener) {
        this.listener = listener;
        rnd.nextBytes(nodeId);
    }

    // =====================================================================
    // 공개 API
    // =====================================================================
    public synchronized boolean start(String infoHashHex, String selfId) {
        byte[] ih = hexToBytes(infoHashHex);
        if (ih == null || ih.length != 20 || selfId == null || !selfId.matches("[A-Za-z0-9]{6,40}")) return false;
        stop();
        this.infoHash = ih;
        this.selfId = selfId;
        try {
            DatagramSocket s = new DatagramSocket(null);
            s.setReuseAddress(true);
            s.bind(new InetSocketAddress(0));
            s.setSoTimeout(0);
            socket = s;
        } catch (Exception e) {
            return false;
        }
        running = true;
        foundPeers = 0; respondedNodes = 0; announced = 0;
        // 이전 세션에서 응답한 노드는 남겨 두어 다음 매칭 때 부트스트랩 없이 바로 탐색합니다.
        synchronized (lookupLock) { for (Iterator<Node> it = nodes.values().iterator(); it.hasNext(); ) if (!it.next().responded) it.remove(); respondedNodes = nodes.size(); }
        pending.clear(); punchUntil.clear(); peerNotified.clear(); knownPeers.clear();
        outbox.clear(); inbox.clear(); delivered.clear();

        final DatagramSocket s = socket;
        recvThread = new Thread(() -> receiveLoop(s), "sumdoku-dht-recv");
        recvThread.setDaemon(true);
        recvThread.start();
        loopThread = new Thread(this::mainLoop, "sumdoku-dht-loop");
        loopThread.setDaemon(true);
        loopThread.start();
        sched = Executors.newSingleThreadScheduledExecutor();
        sched.scheduleWithFixedDelay(this::tick, 400, 400, TimeUnit.MILLISECONDS);
        return true;
    }

    public synchronized void stop() {
        running = false;
        try { if (socket != null) socket.close(); } catch (Exception ignored) {}
        socket = null;
        try { if (loopThread != null) loopThread.interrupt(); } catch (Exception ignored) {}
        try { if (sched != null) sched.shutdownNow(); } catch (Exception ignored) {}
        sched = null;
    }

    /** 홀펀칭으로 연결된 상대에게 텍스트(JSON)를 조각내어 확인응답 기반으로 보냅니다. */
    public void send(String addr, String text) {
        InetSocketAddress to = parseAddr(addr);
        if (to == null || text == null || !running) return;
        List<String> parts = new ArrayList<>();
        int i = 0;
        while (i < text.length()) {
            int end = Math.min(text.length(), i + CHUNK);
            if (end < text.length() && Character.isHighSurrogate(text.charAt(end - 1))) end--;
            parts.add(text.substring(i, end));
            i = end;
        }
        if (parts.isEmpty()) parts.add("");
        if (parts.size() > 64) return; // SDP는 수 KB 이내입니다. 비정상적으로 큰 메시지는 보내지 않습니다.
        String id = Long.toString(rnd.nextLong() & 0x7fffffffffffL, 36);
        OutMsg m = new OutMsg(to, id, parts.toArray(new String[0]));
        outbox.put(id, m);
        flush(m);
    }

    // =====================================================================
    // 메인 루프: 탐색 → 등록 → 잠시 대기 → 반복
    // =====================================================================
    private void mainLoop() {
        int round = 0;
        while (running) {
            try {
                round++;
                status("lookup", round);
                lookup();
                if (!running) break;
                announce();
                status("announced", round);
                // 새로 등록한 다른 기기를 찾기 위해 짧은 주기로 다시 탐색합니다(처음엔 빠르게, 이후 완만하게).
                long wait = round < 3 ? 6000 : 15000;
                long until = System.currentTimeMillis() + wait;
                while (running && System.currentTimeMillis() < until) Thread.sleep(250);
            } catch (InterruptedException e) {
                break;
            } catch (Exception ignored) {
                try { Thread.sleep(2000); } catch (InterruptedException e) { break; }
            }
        }
    }

    private void lookup() throws InterruptedException {
        // 이전 라운드에서 응답한 노드는 유지하고 질의 상태만 초기화합니다.
        synchronized (lookupLock) {
            for (Iterator<Node> it = nodes.values().iterator(); it.hasNext(); ) {
                Node n = it.next();
                if (!n.responded) it.remove(); else { n.queried = false; n.token = null; }
            }
        }
        boolean hasKnown;
        synchronized (lookupLock) { hasKnown = nodes.size() >= K; }
        if (!hasKnown) bootstrap();
        long deadline = System.currentTimeMillis() + 9000;
        int idle = 0;
        while (running && System.currentTimeMillis() < deadline) {
            Thread.sleep(250);
            List<Node> toQuery = new ArrayList<>();
            int inflight = 0;
            synchronized (lookupLock) {
                long now = System.currentTimeMillis();
                List<Node> sorted = sortedByDistance();
                int considered = 0;
                for (Node n : sorted) {
                    if (n.queried && !n.responded && now - n.sentAt < 2000) inflight++;
                }
                // 탐색 창: 목표에 가장 가까운 '살아 있을 수 있는' 노드 K*2개.
                // 질의 후 2초 넘게 응답이 없는 노드는 죽은 것으로 보고 건너뜁니다(NAT 뒤 노드가 많아 흔함).
                for (Node n : sorted) {
                    boolean dead = n.queried && !n.responded && now - n.sentAt >= 2000;
                    if (dead) continue;
                    if (considered++ >= K * 2) break;
                    if (!n.queried && toQuery.size() + inflight < ALPHA) { n.queried = true; n.sentAt = now; toQuery.add(n); }
                }
            }
            for (Node n : toQuery) sendGetPeers(n.addr);
            boolean empty;
            synchronized (lookupLock) { empty = nodes.isEmpty(); }
            // 부트스트랩 응답이 아직 없으면(패킷 유실·DNS 지연) 2초마다 다시 보냅니다.
            if (empty && idle > 0 && idle % 8 == 0) bootstrap();
            if (toQuery.isEmpty() && inflight == 0) { if (++idle > (empty ? 28 : 8)) break; } else idle = 0;
        }
    }

    private final List<InetSocketAddress> bootAddrs = new ArrayList<>();
    private void bootstrap() {
        if (bootAddrs.isEmpty()) {
            for (String[] b : BOOTSTRAP) {
                try {
                    for (InetAddress a : InetAddress.getAllByName(b[0])) {
                        if (a.getAddress().length == 4) bootAddrs.add(new InetSocketAddress(a, Integer.parseInt(b[1])));
                    }
                } catch (Exception ignored) {}
            }
        }
        for (InetSocketAddress sa : bootAddrs) sendGetPeers(sa);
    }

    private void announce() {
        List<Node> targets = new ArrayList<>();
        synchronized (lookupLock) {
            for (Node n : sortedByDistance()) {
                if (n.responded && n.token != null) targets.add(n);
                if (targets.size() >= K) break;
            }
        }
        DatagramSocket s = socket;
        if (s == null) return;
        int port = s.getLocalPort();
        for (Node n : targets) {
            Map<String, Object> a = new TreeMap<>();
            a.put("id", nodeId);
            a.put("implied_port", 1L);
            a.put("info_hash", infoHash);
            a.put("port", (long) port);
            a.put("token", n.token);
            query(n.addr, "announce_peer", a);
        }
        announced = targets.size();
    }

    private List<Node> sortedByDistance() {
        List<Node> list = new ArrayList<>();
        for (Node n : nodes.values()) if (n.id != null) list.add(n);
        final byte[] target = infoHash;
        list.sort((x, y) -> distance(x.id, target).compareTo(distance(y.id, target)));
        return list;
    }

    private static BigInteger distance(byte[] a, byte[] b) {
        byte[] d = new byte[20];
        for (int i = 0; i < 20; i++) d[i] = (byte) (a[i] ^ b[i]);
        return new BigInteger(1, d);
    }

    // =====================================================================
    // KRPC
    // =====================================================================
    private void sendGetPeers(InetSocketAddress to) {
        Map<String, Object> a = new TreeMap<>();
        a.put("id", nodeId);
        a.put("info_hash", infoHash);
        query(to, "get_peers", a);
    }

    private void query(InetSocketAddress to, String q, Map<String, Object> args) {
        String tid;
        synchronized (this) { tid = String.valueOf((char) ('a' + (tidSeq / 26) % 26)) + (char) ('a' + tidSeq % 26); tidSeq = (tidSeq + 1) % 676; }
        Map<String, Object> m = new TreeMap<>();
        m.put("a", args);
        m.put("q", q);
        m.put("t", tid);
        m.put("v", "SD20");
        m.put("y", "q");
        pending.put(tid, to.getAddress().getHostAddress() + ":" + to.getPort());
        sendRaw(to, Bencode.encode(m));
    }

    @SuppressWarnings("unchecked")
    private void handleKrpc(InetSocketAddress from, byte[] data) {
        Object o;
        try { o = Bencode.decode(data); } catch (Exception e) { return; }
        if (!(o instanceof Map)) return;
        Map<String, Object> m = (Map<String, Object>) o;
        String y = str(m.get("y"));
        byte[] t = bytes(m.get("t"));
        if ("q".equals(y)) { answerQuery(from, m, t); return; }
        if (!"r".equals(y) || t == null) return;
        String tid = new String(t, StandardCharsets.ISO_8859_1);
        pending.remove(tid);
        Object rr = m.get("r");
        if (!(rr instanceof Map)) return;
        Map<String, Object> r = (Map<String, Object>) rr;
        byte[] id = bytes(r.get("id"));
        if (id == null || id.length != 20) return;
        String key = from.getAddress().getHostAddress() + ":" + from.getPort();
        synchronized (lookupLock) {
            Node n = nodes.get(key);
            if (n == null) { n = new Node(from, id); n.queried = true; nodes.put(key, n); }
            n.id = id;
            if (!n.responded) { n.responded = true; respondedNodes++; }
            byte[] tok = bytes(r.get("token"));
            if (tok != null) n.token = tok;
            byte[] compact = bytes(r.get("nodes"));
            if (compact != null) {
                for (int i = 0; i + 26 <= compact.length; i += 26) {
                    byte[] nid = Arrays.copyOfRange(compact, i, i + 20);
                    InetSocketAddress na = compactAddr(compact, i + 20);
                    if (na == null) continue;
                    String nk = na.getAddress().getHostAddress() + ":" + na.getPort();
                    if (!nodes.containsKey(nk) && nodes.size() < 600) nodes.put(nk, new Node(na, nid));
                }
            }
        }
        Object values = r.get("values");
        if (values instanceof List) {
            for (Object v : (List<Object>) values) {
                byte[] pv = bytes(v);
                if (pv == null || pv.length != 6) continue;
                InetSocketAddress pa = compactAddr(pv, 0);
                if (pa != null) onPeerCandidate(pa);
            }
        }
    }

    /** 다른 노드의 질의에 최소한으로 응답해 DHT 이웃으로서 예의를 지킵니다. */
    private void answerQuery(InetSocketAddress from, Map<String, Object> m, byte[] t) {
        if (t == null) return;
        String q = str(m.get("q"));
        Map<String, Object> r = new TreeMap<>();
        r.put("id", nodeId);
        if ("get_peers".equals(q) || "find_node".equals(q)) {
            r.put("nodes", new byte[0]);
            if ("get_peers".equals(q)) r.put("token", "sd".getBytes(StandardCharsets.ISO_8859_1));
        } else if (!"ping".equals(q) && !"announce_peer".equals(q)) {
            return;
        }
        Map<String, Object> resp = new TreeMap<>();
        resp.put("r", r);
        resp.put("t", t);
        resp.put("y", "r");
        sendRaw(from, Bencode.encode(resp));
    }

    // =====================================================================
    // 상대 기기: 홀펀칭과 인사
    // =====================================================================
    private void onPeerCandidate(InetSocketAddress pa) {
        String key = pa.getAddress().getHostAddress() + ":" + pa.getPort();
        if (knownPeers.size() > 200 && !knownPeers.containsKey(key)) return;
        if (knownPeers.putIfAbsent(key, Boolean.TRUE) == null) foundPeers++;
        Long until = punchUntil.get(key);
        long now = System.currentTimeMillis();
        if (until == null || until < now) punchUntil.put(key, now + 15000);
    }

    private void tick() {
        if (!running) return;
        long now = System.currentTimeMillis();
        // 1) 홀펀칭 인사 반복
        for (Map.Entry<String, Long> e : punchUntil.entrySet()) {
            if (e.getValue() < now) { punchUntil.remove(e.getKey()); continue; }
            InetSocketAddress a = parseAddr(e.getKey());
            if (a != null) sendText(a, MAGIC + "H|" + selfId);
        }
        // 2) 확인응답이 오지 않은 조각 재전송
        for (OutMsg m : outbox.values()) {
            if (++m.tries > 25) { outbox.remove(m.id); continue; }
            flush(m);
        }
        // 3) 오래된 조립 버퍼·중복 기록 정리
        for (Map.Entry<String, InMsg> e : inbox.entrySet()) if (now - e.getValue().at > 30000) inbox.remove(e.getKey());
        for (Map.Entry<String, Long> e : delivered.entrySet()) if (now - e.getValue() > 120000) delivered.remove(e.getKey());
    }

    private void flush(OutMsg m) {
        boolean all = true;
        for (int i = 0; i < m.parts.length; i++) {
            if (m.acked[i]) continue;
            all = false;
            sendText(m.to, MAGIC + "M|" + m.id + "|" + i + "|" + m.parts.length + "|" + m.parts[i]);
        }
        if (all) outbox.remove(m.id);
    }

    private void handleMagic(InetSocketAddress from, String text) {
        String key = from.getAddress().getHostAddress() + ":" + from.getPort();
        String body = text.substring(MAGIC.length());
        if (body.startsWith("H|") || body.startsWith("K|")) {
            String pid = body.substring(2);
            if (!pid.matches("[A-Za-z0-9]{6,40}") || pid.equals(selfId)) return;
            if (body.startsWith("H|")) sendText(from, MAGIC + "K|" + selfId);
            punchUntil.remove(key);
            long now = System.currentTimeMillis();
            Long last = peerNotified.get(key);
            if (last == null || now - last > 20000) {
                peerNotified.put(key, now);
                listener.onPeer(key, pid);
            }
        } else if (body.startsWith("M|")) {
            String[] f = body.split("\\|", 5);
            if (f.length < 5) return;
            int idx, total;
            try { idx = Integer.parseInt(f[2]); total = Integer.parseInt(f[3]); } catch (NumberFormatException e) { return; }
            if (total < 1 || total > 64 || idx < 0 || idx >= total) return;
            sendText(from, MAGIC + "A|" + f[1] + "|" + idx);
            String mk = key + "#" + f[1];
            if (delivered.containsKey(mk)) return;
            InMsg in = inbox.get(mk);
            if (in == null) { in = new InMsg(); in.parts = new String[total]; inbox.put(mk, in); }
            if (in.parts.length != total) return;
            if (in.parts[idx] == null) { in.parts[idx] = f[4]; in.got++; }
            if (in.got == total) {
                inbox.remove(mk);
                delivered.put(mk, System.currentTimeMillis());
                StringBuilder sb = new StringBuilder();
                for (String p : in.parts) sb.append(p);
                listener.onMessage(key, sb.toString());
            }
        } else if (body.startsWith("A|")) {
            String[] f = body.split("\\|", 3);
            if (f.length < 3) return;
            OutMsg m = outbox.get(f[1]);
            if (m == null) return;
            try { int idx = Integer.parseInt(f[2]); if (idx >= 0 && idx < m.acked.length) m.acked[idx] = true; } catch (NumberFormatException ignored) {}
            boolean all = true;
            for (boolean b : m.acked) all &= b;
            if (all) outbox.remove(m.id);
        }
    }

    // =====================================================================
    // 소켓
    // =====================================================================
    private void receiveLoop(DatagramSocket s) {
        byte[] buf = new byte[4096];
        while (running && !s.isClosed()) {
            try {
                DatagramPacket p = new DatagramPacket(buf, buf.length);
                s.receive(p);
                byte[] data = Arrays.copyOfRange(p.getData(), p.getOffset(), p.getOffset() + p.getLength());
                InetSocketAddress from = (InetSocketAddress) p.getSocketAddress();
                if (data.length > 5 && data[0] == 'S' && data[1] == 'D' && data[2] == 'K' && data[3] == '2' && data[4] == '|') {
                    handleMagic(from, new String(data, StandardCharsets.UTF_8));
                } else if (data.length > 0 && data[0] == 'd') {
                    handleKrpc(from, data);
                }
            } catch (Exception e) {
                if (!running || s.isClosed()) break;
            }
        }
    }

    private void sendText(InetSocketAddress to, String text) { sendRaw(to, text.getBytes(StandardCharsets.UTF_8)); }

    private void sendRaw(InetSocketAddress to, byte[] data) {
        DatagramSocket s = socket;
        if (s == null || to == null) return;
        try { s.send(new DatagramPacket(data, data.length, to)); } catch (Exception ignored) {}
    }

    private void status(String phase, int round) {
        try {
            listener.onStatus(String.format(java.util.Locale.ROOT,
                "{\"phase\":\"%s\",\"round\":%d,\"nodes\":%d,\"peers\":%d,\"announced\":%d,\"port\":%d}",
                phase, round, respondedNodes, foundPeers, announced, socket == null ? 0 : socket.getLocalPort()));
        } catch (Exception ignored) {}
    }

    // =====================================================================
    // 유틸
    // =====================================================================
    private static InetSocketAddress compactAddr(byte[] b, int off) {
        try {
            byte[] ip = Arrays.copyOfRange(b, off, off + 4);
            int port = ((b[off + 4] & 0xff) << 8) | (b[off + 5] & 0xff);
            if (port == 0 || (ip[0] == 0)) return null;
            return new InetSocketAddress(InetAddress.getByAddress(ip), port);
        } catch (Exception e) { return null; }
    }

    private static InetSocketAddress parseAddr(String addr) {
        if (addr == null) return null;
        int c = addr.lastIndexOf(':');
        if (c <= 0) return null;
        String host = addr.substring(0, c);
        if (!host.matches("\\d{1,3}(\\.\\d{1,3}){3}")) return null;
        try {
            int port = Integer.parseInt(addr.substring(c + 1));
            if (port < 1 || port > 65535) return null;
            return new InetSocketAddress(InetAddress.getByName(host), port);
        } catch (Exception e) { return null; }
    }

    private static byte[] hexToBytes(String hex) {
        if (hex == null || !hex.matches("[0-9a-fA-F]{40}")) return null;
        byte[] out = new byte[20];
        for (int i = 0; i < 20; i++) out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        return out;
    }

    private static byte[] bytes(Object o) { return o instanceof byte[] ? (byte[]) o : null; }
    private static String str(Object o) { return o instanceof byte[] ? new String((byte[]) o, StandardCharsets.ISO_8859_1) : null; }

    /** 최소 bencode 구현(BEP 3): 정수, 바이트 문자열, 리스트, 사전. */
    static final class Bencode {
        static byte[] encode(Object o) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            write(out, o);
            return out.toByteArray();
        }

        @SuppressWarnings("unchecked")
        private static void write(ByteArrayOutputStream out, Object o) {
            if (o instanceof Long || o instanceof Integer) {
                byte[] b = ("i" + o + "e").getBytes(StandardCharsets.US_ASCII); out.write(b, 0, b.length);
            } else if (o instanceof String) {
                writeBytes(out, ((String) o).getBytes(StandardCharsets.ISO_8859_1));
            } else if (o instanceof byte[]) {
                writeBytes(out, (byte[]) o);
            } else if (o instanceof List) {
                out.write('l'); for (Object x : (List<Object>) o) write(out, x); out.write('e');
            } else if (o instanceof Map) {
                out.write('d');
                TreeMap<String, Object> sorted = new TreeMap<>((Map<String, Object>) o);
                for (Map.Entry<String, Object> e : sorted.entrySet()) { writeBytes(out, e.getKey().getBytes(StandardCharsets.ISO_8859_1)); write(out, e.getValue()); }
                out.write('e');
            } else throw new IllegalArgumentException("bencode type");
        }

        private static void writeBytes(ByteArrayOutputStream out, byte[] b) {
            byte[] len = (b.length + ":").getBytes(StandardCharsets.US_ASCII);
            out.write(len, 0, len.length); out.write(b, 0, b.length);
        }

        static Object decode(byte[] data) {
            int[] pos = {0};
            Object o = read(data, pos, 0);
            return o;
        }

        private static Object read(byte[] d, int[] p, int depth) {
            if (depth > 16 || p[0] >= d.length) throw new IllegalArgumentException("bencode");
            byte c = d[p[0]];
            if (c == 'i') {
                int end = indexOf(d, (byte) 'e', p[0]);
                long v = Long.parseLong(new String(d, p[0] + 1, end - p[0] - 1, StandardCharsets.US_ASCII));
                p[0] = end + 1; return v;
            } else if (c == 'l') {
                p[0]++; List<Object> list = new ArrayList<>();
                while (p[0] < d.length && d[p[0]] != 'e') { list.add(read(d, p, depth + 1)); if (list.size() > 512) throw new IllegalArgumentException("bencode"); }
                p[0]++; return list;
            } else if (c == 'd') {
                p[0]++; Map<String, Object> map = new LinkedHashMap<>();
                while (p[0] < d.length && d[p[0]] != 'e') {
                    Object k = read(d, p, depth + 1);
                    if (!(k instanceof byte[])) throw new IllegalArgumentException("bencode");
                    map.put(new String((byte[]) k, StandardCharsets.ISO_8859_1), read(d, p, depth + 1));
                }
                p[0]++; return map;
            } else if (c >= '0' && c <= '9') {
                int colon = indexOf(d, (byte) ':', p[0]);
                int len = Integer.parseInt(new String(d, p[0], colon - p[0], StandardCharsets.US_ASCII));
                if (len < 0 || colon + 1 + len > d.length) throw new IllegalArgumentException("bencode");
                byte[] b = Arrays.copyOfRange(d, colon + 1, colon + 1 + len);
                p[0] = colon + 1 + len; return b;
            }
            throw new IllegalArgumentException("bencode");
        }

        private static int indexOf(byte[] d, byte b, int from) {
            for (int i = from; i < d.length && i < from + 24; i++) if (d[i] == b) return i;
            throw new IllegalArgumentException("bencode");
        }
    }
}
