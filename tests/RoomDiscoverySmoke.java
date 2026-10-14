package io.github.yjw071218.sumdoku;

import java.net.InetAddress;

// v1.0.40: 4자리 코드 방 찾기 (브로드캐스트 응답 · /api/hello 확인 · 서브넷 범위 계산)
public class RoomDiscoverySmoke {
    static void require(boolean ok, String m) { if (!ok) throw new AssertionError(m); }
    public static void main(String[] a) throws Exception {
        // 서브넷 범위: /24 → 254개, /20 → 4094개, /16 → 내 주소 중심 4096개
        int ip = RoomDiscovery.toInt(InetAddress.getByName("10.20.37.200"));
        require(RoomDiscovery.toIp(ip).equals("10.20.37.200"), "ip round trip");
        int[] r24 = RoomDiscovery.scanRange(ip, 24), r20 = RoomDiscovery.scanRange(ip, 20), r16 = RoomDiscovery.scanRange(ip, 16);
        require(RoomDiscovery.toIp(r24[0]).equals("10.20.37.1") && r24[1] == 254, "/24 range");
        require(RoomDiscovery.toIp(r20[0]).equals("10.20.32.1") && r20[1] == 4094, "/20 range " + RoomDiscovery.toIp(r20[0]));
        long first = r16[0] & 0xFFFFFFFFL, last = first + r16[1] - 1, me = ip & 0xFFFFFFFFL;
        require(r16[1] == 4096 && first <= me && me <= last, "/16 range is centred on own address");
        BattleServer server = new BattleServer();
        try {
            server.configureRoom("race", "easy", 0, "{\"roomCode\":\"4321\",\"rules\":{}}");
            require(server.start(8888), "bind 8888");
            require(RoomDiscovery.probe("127.0.0.1", "4321"), "hello probe matches code");
            require(!RoomDiscovery.probe("127.0.0.1", "1111"), "hello probe rejects other code");
            require(server.answersTo("4321") && !server.answersTo("1111"), "answersTo");
            String found = RoomDiscovery.findBlocking("4321");
            System.out.println("find 4321 -> " + found);
            require(found.contains("\"ok\":true"), "broadcast or scan finds the room: " + found);
            String missing = RoomDiscovery.findBlocking("9999");
            System.out.println("find 9999 -> " + missing);
            require(missing.contains("not_found"), "unknown code not found");
            System.out.println("local wifi ip: " + RoomDiscovery.localIp());
            System.out.println("PASS: room discovery");
        } finally { server.stop(); }
    }
}
