package io.github.yjw071218.sumdoku;

import java.net.InetAddress;

// v1.0.40: 4자리 코드 방 찾기 (브로드캐스트 응답 · /api/hello 확인 · 서브넷 범위 계산)
public class RoomDiscoverySmoke {
    static void require(boolean ok, String m) { if (!ok) throw new AssertionError(m); }
    public static void main(String[] a) throws Exception {
        // 서브넷 범위: /24 → 254개, /20 → 4094개, /16 → 내 주소 중심 4096개
        int ip = RoomDiscovery.toInt(InetAddress.getByName("10.20.37.200"));
        // 학교망 실제 사례: 휴대폰 172.16.20.107(/24 또는 /22) → 탭 172.16.18.247 이 확인 범위 안
        for (int prefix : new int[]{24, 22, 20, 16}) {
            int me = RoomDiscovery.toInt(InetAddress.getByName("172.16.20.107"));
            int[] r = RoomDiscovery.scanRange(me, prefix);
            long tab = RoomDiscovery.toInt(InetAddress.getByName("172.16.18.247")) & 0xFFFFFFFFL, s0 = r[0] & 0xFFFFFFFFL;
            require(r[1] == 4096 && s0 <= tab && tab < s0 + r[1], "school case /" + prefix + " start " + RoomDiscovery.toIp(r[0]));
        }
        int[] home = RoomDiscovery.scanRange(RoomDiscovery.toInt(InetAddress.getByName("192.168.0.15")), 24);
        long h0 = home[0] & 0xFFFFFFFFL, homeIp = RoomDiscovery.toInt(InetAddress.getByName("192.168.0.15")) & 0xFFFFFFFFL;
        require(home[1] == 4096 && h0 <= homeIp && homeIp < h0 + 4096 && RoomDiscovery.toIp(home[0]).startsWith("192.168."), "home range stays in 192.168/16: " + RoomDiscovery.toIp(home[0]));
        require(RoomDiscovery.toIp(ip).equals("10.20.37.200"), "ip round trip");
        BattleServer server = new BattleServer();
        try {
            server.configureRoom("race", "easy", 0, "{\"roomCode\":\"4321\",\"rules\":{}}");
            require(server.start(8888), "bind 8888");
            require(RoomDiscovery.probe("127.0.0.1", "4321"), "hello probe matches code");
            require(!RoomDiscovery.probe("127.0.0.1", "1111"), "hello probe rejects other code");
            require(server.answersTo("4321") && !server.answersTo("1111"), "answersTo");
            long t0 = System.currentTimeMillis();
            String cached = RoomDiscovery.findBlocking("4321", "127.0.0.1");
            long cachedMs = System.currentTimeMillis() - t0;
            System.out.println("find 4321 (cached) -> " + cached + " in " + cachedMs + "ms");
            require(cached.contains("\"via\":\"cached\"") && cachedMs < 100, "cached host must be fast (<100ms): " + cachedMs + "ms");

            long t1 = System.currentTimeMillis();
            String found = RoomDiscovery.findBlocking("4321");
            long foundMs = System.currentTimeMillis() - t1;
            System.out.println("find 4321 -> " + found + " in " + foundMs + "ms");
            require(found.contains("\"ok\":true"), "broadcast or scan finds the room: " + found);

            long t2 = System.currentTimeMillis();
            String missing = RoomDiscovery.findBlocking("9999");
            long missingMs = System.currentTimeMillis() - t2;
            System.out.println("find 9999 -> " + missing + " in " + missingMs + "ms");
            require(missing.contains("not_found"), "unknown code not found");
            require(missingMs < 4500, "4096 address scan must complete within 4.5s: " + missingMs + "ms");
            System.out.println("local wifi ip: " + RoomDiscovery.localIp());
            System.out.println("PASS: room discovery");
        } finally { server.stop(); }
    }
}
