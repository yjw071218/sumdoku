package io.github.yjw071218.sumdoku;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class TurnModeSmoke {
    static String http(String method, String path, String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL("http://127.0.0.1:8888" + path).openConnection();
        c.setRequestMethod(method);
        if (body != null) { c.setDoOutput(true); c.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8)); }
        InputStream in = c.getResponseCode() >= 400 ? c.getErrorStream() : c.getInputStream();
        return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
    static void require(boolean ok, String m) { if (!ok) throw new AssertionError(m); }
    public static void main(String[] a) throws Exception {
        BattleServer s = new BattleServer();
        s.configureRoom("turn", "easy", 0, "{\"roomCode\":\"1234\",\"rules\":{\"turnSeconds\":\"15\"}}");
        s.start(8888);
        try {
            http("POST", "/api/join", "{\"code\":\"1234\"}");
            http("POST", "/api/ready", "{\"player\":2,\"ready\":true}");
            String puzzle = "{\"solution\":[[1]],\"cages\":[],\"rules\":{\"turnSeconds\":\"15\"}}";
            String st = http("POST", "/api/start", puzzle);
            require(st.contains("\"ok\":true"), "start " + st);
            String t0 = http("GET", "/api/turn", null);
            require(t0.contains("\"turn\":1") && t0.contains("\"seq\":0"), "initial " + t0);
            String wrong = http("POST", "/api/turn", "{\"player\":2,\"seq\":0,\"r\":0,\"c\":0,\"v\":5,\"ok\":true,\"score\":100}");
            require(wrong.contains("\"ok\":false"), "out of turn rejected " + wrong);
            String m1 = http("POST", "/api/turn", "{\"player\":1,\"seq\":0,\"r\":2,\"c\":3,\"v\":7,\"ok\":true,\"score\":100}");
            require(m1.contains("\"turn\":2") && m1.contains("\"seq\":1") && m1.contains("\"r\":2") && m1.contains("\"v\":7"), "move " + m1);
            String stale = http("POST", "/api/turn", "{\"player\":2,\"seq\":0,\"pass\":true}");
            require(stale.contains("\"ok\":false"), "stale seq rejected");
            String early = http("POST", "/api/turn", "{\"player\":1,\"seq\":1,\"pass\":true}");
            require(early.contains("\"ok\":false"), "opponent cannot pass before limit");
            String p2 = http("POST", "/api/turn", "{\"player\":2,\"seq\":1,\"pass\":true,\"score\":-30}");
            require(p2.contains("\"turn\":1") && p2.contains("\"pass\":true"), "pass " + p2);
            String log = http("GET", "/api/turn?after=0", null);
            require(log.split("\"seq\":").length - 1 == 3, "log has 2 moves + header " + log);
            http("POST", "/api/rematch", "{}");
            String reset = http("GET", "/api/turn", null);
            require(reset.contains("\"seq\":0") && reset.contains("\"moves\":[]"), "rematch reset " + reset);
            System.out.println("PASS: turn order, stale/out-of-turn rejection, timeout pass guard, log replay, rematch reset");
        } finally { s.stop(); }
    }
}
