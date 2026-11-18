package com.spiracompanion.thor;

import java.lang.reflect.Method;
import java.net.Socket;
import org.json.JSONObject;

/** Invokes the production readers against the synthetic local PINE test server. */
public final class LiveReadersHarness {
    public static void main(String[] args) throws Exception {
        if (args[0].equals("snapshot")) {
            System.out.println(Ps2Feed.snapshot());
            return;
        }
        if (args[0].equals("cheat")) {
            String scenario = args[1];
            int item = scenario.equals("item") ? 8192 : 0;
            int[] checks = {0};
            String result = Ps2Feed.applyCheat("SLPS-25088", 277, 1250, item, item == 0 ? 100 : 2,
                item == 0 ? 200 : 4, () -> !scenario.equals("disabled") &&
                    (!scenario.equals("cancel") || checks[0]++ == 0));
            System.out.println(new JSONObject().put("result", result));
            return;
        }
        if (args[0].equals("ap")) {
            JSONObject expected=new JSONObject().put("disc","SLPS-25088").put("crc","658597E2")
                .put("battle",true).put("paused",false).put("room",277).put("battles",100);
            Ps2Feed.sharePartyAp(expected,()->!args[1].equals("disabled"));
            System.out.println("{}");return;
        }
        Method profile=Ps2Feed.class.getDeclaredMethod("profile",String.class,String.class);
        profile.setAccessible(true);Object p=profile.invoke(null,"SLPS-25088","658597E2");
        Method method=Ps2Feed.class.getDeclaredMethod(args[0],Socket.class,p.getClass(),int.class);
        method.setAccessible(true);
        try(Socket socket=new Socket("127.0.0.1",28011)) {
            socket.setSoTimeout(2000);
            System.out.println(method.invoke(null,socket,p,Integer.parseInt(args[1])));
        }
    }
}
