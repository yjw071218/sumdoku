package io.github.yjw071218.sumdoku;

import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/** Wi-Fi 절전으로 0.9초 늦게 응답하는 방장 기기를 흉내 내 코드 확인(probe)이 실패하지 않는지 검사합니다. */
public class SlowHostProbeSmoke {
    public static void main(String[] args) throws Exception {
        try (ServerSocket server = new ServerSocket(8888)) {
            Thread t = new Thread(() -> {
                try (Socket s = server.accept()) {
                    s.getInputStream().read(new byte[512]);
                    Thread.sleep(900);
                    OutputStream out = s.getOutputStream();
                    out.write("HTTP/1.0 200 OK\r\n\r\n{\"ok\":true,\"app\":\"sumdoku\",\"code\":\"4321\",\"status\":\"waiting\",\"full\":false}".getBytes(StandardCharsets.UTF_8));
                    out.flush();
                } catch (Exception ignored) {}
            });
            t.start();
            boolean ok = RoomDiscovery.probe("127.0.0.1", "4321");
            t.join();
            if (!ok) throw new AssertionError("slow host (900ms) must still be recognized");
        }
        System.out.println("PASS: slow host probe (900ms response) recognized");
    }
}
