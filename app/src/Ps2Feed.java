package com.spiracompanion.thor;

import java.io.DataInputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class Ps2Feed {
    private static final int PORT = 28011;
    private static final byte WRITE_8 = 4;
    private static final byte WRITE_32 = 6;
    private static final int GIL_LIMIT = 99_999_999;
    private static final byte ID = 0x0c;
    private static final byte CRC = 0x0d;
    private static final byte STATUS = 0x0f;
    private static final int X_ALLY_SIZE = 56;
    private static final int X_ENEMY_SIZE = 64;
    private static final int X_BLITZ_PRIZES = 0x1984 + 60 * 2;
    // The roster tables precede the saved salary and prize tables.
    private static final int X_BLITZ_LEVELS = 0x1984 - 0x3ca;
    private static final int X_BLITZ_ROSTERS = X_BLITZ_LEVELS + 0x4c;
    private static final int X_BLITZ_CONTRACTS = X_BLITZ_LEVELS + 0x15c;
    private static final int X_BLITZ_EQUIPPED = X_BLITZ_LEVELS - 360;
    private static final int X_BLITZ_KNOWN = X_BLITZ_EQUIPPED - 614;
    private static final int X_BLITZ_TECH_BYTES = 60 * (8 + 5);
    private static final int X2_AP_STRIDE = 0x6a0;
    private static final int X_BLITZ_PLAYER_COUNT = 60;
    private static final int X_BLITZ_ROSTER_BYTES = 6 * 8;
    private static final int X_CHALLENGE_BYTES = 13;

    private static final class Profile {
        final String game, edition;
        final int save, stats, stride, count, itemsOffset, mapPointer, fieldPointer;
        final boolean sequel;

        Profile(String game, String edition, int save, int stats, int stride, int count, int itemsOffset,
                int mapPointer, int fieldPointer) {
            this.game = game;
            this.edition = edition;
            this.save = save;
            this.stats = stats;
            this.stride = stride;
            this.count = count;
            this.itemsOffset = itemsOffset;
            this.mapPointer = mapPointer;
            this.fieldPointer = fieldPointer;
            sequel = game.equals("x2");
        }

        int gilAddress() {
            return save + (sequel ? 0x77d8 : 0x3d48);
        }
    }

    private static Profile profile(String serial, String crc) {
        switch (serial + "/" + crc.toUpperCase(Locale.ROOT)) {
            case "SLPS-25088/658597E2":
                return new Profile("x", "International", 0x319150, 0x31e71c, 0x94, 8, 0x3ecc, 0x636bec, 0x58df58);
            case "SLUS-20672/48FE0C71":
                return new Profile("x2", "USA", 0x36c710, 0x3748b0, 0x70, 3, 0x7930, 0x4e5174, 0x4b0d18);
            case "SLPM-65478/E1FD9A2D":
                return new Profile("x2", "International", 0x36c790, 0x374940, 0x80, 11, 0x7940, 0x4eb474, 0x4b7098);
            default:
                return null;
        }
    }

    private static Socket connect() throws IOException {
        Socket socket = new Socket();
        try {
            socket.connect(new InetSocketAddress(InetAddress.getByAddress(new byte[] {127, 0, 0, 1}), PORT), 350);
            socket.setSoTimeout(550);
            return socket;
        } catch (IOException e) {
            socket.close();
            throw e;
        }
    }

    static void sharePartyAp(JSONObject expected, java.util.function.BooleanSupplier enabled) throws IOException, JSONException {
        if (!enabled.getAsBoolean() || !expected.optBoolean("battle") || expected.optBoolean("paused") ||
                !"SLPS-25088".equals(expected.optString("disc")) || !"658597E2".equals(expected.optString("crc"))) return;
        try (Socket socket = connect()) {
            ByteBuffer identity = request(socket, new byte[] {ID, CRC, STATUS});
            if (!"SLPS-25088".equals(string(identity)) || !"658597E2".equalsIgnoreCase(string(identity)) || identity.getInt() != 0) return;
            ByteBuffer battle = readXBattle(socket);
            if (battle == null) return;
            ByteBuffer location = readBytes(socket, 0x319150, 8);
            if (Short.toUnsignedInt(location.getShort(0)) != expected.optInt("room")) return;
            ByteBuffer roster = readBytes(socket, 0x319150 + 0x3d48 + 16, 20);
            ByteBuffer flags = readBytes(socket, 0x31f894, 8);
            ByteBuffer commands = little(7 * 6);
            boolean[] seen = new boolean[7];
            for (int i = 0; i < 20; i++) {
                int id = Byte.toUnsignedInt(roster.get(i));
                if (id >= 7 || seen[id]) continue;
                seen[id] = true;
                int flag = Byte.toUnsignedInt(flags.get(id));
                if (flag > 1) return;
                if (flag == 0) commands.put(WRITE_8).putInt(0x31f894 + id).put((byte) 1);
            }
            if (commands.position() == 0 || !enabled.getAsBoolean()) return;
            ByteBuffer confirm = request(socket, new byte[] {ID, CRC});
            if (!"SLPS-25088".equals(string(confirm)) || !"658597E2".equalsIgnoreCase(string(confirm))) return;
            ByteBuffer guard = little(30);
            readRange(guard, 0x316f80, 1);
            readRange(guard, 0x662070, 4);
            readRange(guard, 0x319150, 2);
            readRange(guard, 0x319150 + 0x3d14, 4);
            guard.put(STATUS);
            ByteBuffer last = request(socket, java.util.Arrays.copyOf(guard.array(), guard.position()));
            if (last.get() != 1 || last.getInt() != battle.getInt(8 * X_ALLY_SIZE) ||
                    Short.toUnsignedInt(last.getShort()) != expected.optInt("room") ||
                    Integer.toUnsignedLong(last.getInt()) != expected.optLong("battles") || last.getInt() != 0 || !enabled.getAsBoolean()) return;
            request(socket, java.util.Arrays.copyOf(commands.array(), commands.position()));
        }
    }

    static JSONObject snapshot() throws IOException, JSONException {
        try (Socket socket = connect()) {
            ByteBuffer status = request(socket, new byte[] {STATUS});
            if (status.remaining() != 4) throw new IOException("Invalid PINE status");
            int vm = status.getInt();
            if (vm != 0 && vm != 1) return frame("waiting");

            ByteBuffer identity = request(socket, new byte[] {ID, CRC});
            String serial = string(identity);
            String crc = string(identity);
            Profile p = profile(serial, crc);
            if (p == null) {
                if (serial.isEmpty()) return frame("waiting");
                return frame("unsupported").put("disc", serial).put("crc", crc);
            }

            ByteBuffer request = little(8192);
            readRange(request, p.save, 8);
            readRange(request, p.save + 0xbec, 2);
            readRange(request, p.save + 0x114c, 1);
            readRange(request, p.gilAddress(), 40);
            readRange(request, p.save + (p.sequel ? 0x77e4 : 0x3d14), 4);
            readRange(request, p.stats, p.count * p.stride);
            readRange(request, p.save + p.itemsOffset, 768);
            boolean x2Loadout = p.sequel && p.stride == 0x70;
            if (x2Loadout) {
                readRange(request, p.save + 0x7804, X2_UNLOCK_BYTES);
                readRange(request, p.save + 0x7c70, X2_ACCESSORY_SLOTS * 3);
                readRange(request, p.save + 0x80a0, 64); // Shinra's Oversoul flags.
                readRange(request, p.save + 0x61f0, X2_GRID_SAVE_BYTES);
                readRange(request, p.save + 0x8110, 8); // Crimson Spheres and Experiment repair manuals.
                for (int member = 0; member < 3; member++) {
                    readRange(request, p.save + 0x8bb0 + member * X2_AP_STRIDE + 0x48 * 2, 16 * 2);
                }
                readRange(request, p.save + 0x2ac, 8); // Open Air and Argent credits.
                readRange(request, p.save + 0xda4, 12); // Publicity and matrimony totals.
                readRange(request, p.save + 0x487, 5); // Successful ranch dispatches by level.
                readRange(request, p.save + 0xd84, 18); // Experiment assembly counts, by stat and grade.
                readRange(request, p.save + 0x300, 8); // Successful and failed Bikanel digs.
                readRange(request, p.save + 0x2c1, 20); // Ten tower records and ten attempted flags.
            }
            if (!p.sequel) {
                readRange(request, p.save + 0x449c, 200 * 22);
                readRange(request, p.save + 0x21ec, 2048);
                readRange(request, p.save + 0x420c, 640);
                readRange(request, p.save + 0x30ec, 14);
                readRange(request, p.save + 0x2bec, 881);
                readRange(request, 0x324f38, 4);
                readRange(request, p.save + 0x3d10, 4); // Al Bhed language bits, including compilation.
                readRange(request, p.save + 0x448c, 16);
                readRange(request, p.save + 0xc51, 1); // Wantz.
                readRange(request, p.save + 0xc5c, 1); // Destruction Sphere treasures.
                readRange(request, p.save + 0xc89, 8); // Dark Aeon flags.
                readRange(request, p.save + 0xc7b, 3); // Optional Aeons and Jecht Sphere flags.
                readRange(request, p.save + 0x3d6c, 4); // Bushido and Ronso Rage unlocks.
                readRange(request, p.save + X_BLITZ_PRIZES, 12); // Three league and tournament prizes each.
                readRange(request, p.save + X_BLITZ_LEVELS, X_BLITZ_PLAYER_COUNT);
                readRange(request, p.save + X_BLITZ_ROSTERS, X_BLITZ_ROSTER_BYTES);
                readRange(request, p.save + X_BLITZ_CONTRACTS, X_BLITZ_PLAYER_COUNT);
                readRange(request, p.save + X_BLITZ_KNOWN, 60 * 8);
                readRange(request, p.save + X_BLITZ_EQUIPPED, 60 * 5);
                readRange(request, p.save + 0xc81, 2); // Airship destinations.
                readRange(request, p.save + 0x3fc, 6); // Thunder Plains records.
                readRange(request, p.save + 0x2ba, 2); // Chocobo training flags.
                readRange(request, p.save + 0x2dd, 3); // Catcher Chocobo best time.
                readRange(request, p.save + 0xcc3, 1); // Cactuar Village stage.
                readRange(request, p.save + 0xcc5, 1); // Successful Cactuar rounds.
                readRange(request, p.save + 0x3da4, 4); // Yojimbo compatibility.
            }
            readRange(request, p.mapPointer, 4);
            byte[] commands = new byte[request.position()];
            request.flip();
            request.get(commands);
            ByteBuffer memory = request(socket, commands);
            int expected = 8 + 2 + 1 + 40 + 4 + p.count * p.stride + 768 + 4 +
                (p.sequel ? 0 : 200 * 22 + 2048 + 640 + 14 + 881 + 4 + 49 +
                    X_BLITZ_PLAYER_COUNT * 2 + X_BLITZ_ROSTER_BYTES + X_BLITZ_TECH_BYTES + 2 + X_CHALLENGE_BYTES + 4) +
                (x2Loadout ? X2_UNLOCK_BYTES + X2_ACCESSORY_SLOTS * 3 + 64 + X2_GRID_SAVE_BYTES +
                    8 + 3 * 32 + 8 + 12 + 5 + 18 + 8 + 20 : 0);
            if (memory.remaining() != expected) throw new IOException("Incomplete PINE snapshot");

            int room = Short.toUnsignedInt(memory.getShort());
            int previousRoom = Short.toUnsignedInt(memory.getShort());
            memory.position(8);
            int story = Short.toUnsignedInt(memory.getShort());
            int chapter = Byte.toUnsignedInt(memory.get());
            ByteBuffer party = little(40);
            for (int i = 0; i < 40; i++) party.put(memory.get());
            long battles = Integer.toUnsignedLong(memory.getInt());
            ByteBuffer stats = little(p.count * p.stride);
            while (stats.hasRemaining()) stats.put(memory.get());
            ByteBuffer inventory = little(768);
            while (inventory.hasRemaining()) inventory.put(memory.get());
            ByteBuffer x2Unlocks = x2Loadout ? take(memory, X2_UNLOCK_BYTES) : null;
            ByteBuffer x2Accessories = x2Loadout ? take(memory, X2_ACCESSORY_SLOTS * 3) : null;
            ByteBuffer x2Oversoul = x2Loadout ? take(memory, 64) : null;
            ByteBuffer x2GridSlots = x2Loadout ? take(memory, X2_GRID_SAVE_BYTES) : null;
            long x2KeyItems = x2Loadout ? memory.getLong() : 0;
            JSONArray blueBullets = x2Loadout ? readX2BlueBullets(memory) : null;
            JSONObject calmLands = x2Loadout ? readX2CalmLands(memory) : null;
            JSONObject experiment = x2Loadout ? readX2Experiment(memory, (int) ((x2KeyItems >>> 55) & 31)) : null;
            JSONObject towers = x2Loadout ? readX2Towers(take(memory, 20)) : null;

            ByteBuffer gear = p.sequel ? null : take(memory, 200 * 22);
            ByteBuffer grid = p.sequel ? null : take(memory, 2048);
            ByteBuffer arena = p.sequel ? null : take(memory, 640);
            ByteBuffer gridPositions = p.sequel ? null : take(memory, 14);
            ByteBuffer gridLinks = p.sequel ? null : take(memory, 881);
            int targetMask = p.sequel ? 0 : memory.getInt();
            JSONObject progress = null;
            if (!p.sequel) {
                progress = new JSONObject().put("primers", memory.getInt() & 0x3ffffff)
                    .put("keyItems", hex(take(memory, 16).array()))
                    .put("wantz", (memory.get() & 1) != 0)
                    .put("trials", memory.get() & 0x3f);
                int darkAeons = 0;
                for (int i = 0; i < 8; i++) darkAeons |= ((memory.get() & 0x80) >>> 7) << i;
                progress.put("darkValefor", (darkAeons & 1) != 0)
                    .put("darkShiva", (darkAeons & 8) != 0)
                    .put("darkBahamut", (darkAeons & 16) != 0)
                    .put("darkAeons", darkAeons)
                    .put("optionalAeons", memory.get() & 7)
                    .put("jechtSpheres", Short.toUnsignedInt(memory.getShort()) & 0x1ff);
                int limits = memory.getInt();
                progress.put("ronsoRages", (limits >>> 8) & 0xfff)
                    .put("bushido", (limits >>> 4) & 0xf);
                progress.put("blitzball", readBlitzball(memory, limits));
                progress.put("destinations", Short.toUnsignedInt(memory.getShort()) & 0xfff);
                progress.put("challenges", readChallenges(memory));
                long compatibility = Integer.toUnsignedLong(memory.getInt());
                if (compatibility <= 255) progress.put("yojimboCompatibility", compatibility);
            }
            int mapAddress = memory.getInt();
            ByteBuffer battle = p.sequel ? null : readXBattle(socket);
            X2Battle sequelBattle = p.sequel ? readX2Battle(socket, p.stride == 0x80) : null;
            JSONArray enemies = sequelBattle != null ? sequelBattle.enemies :
                battle == null ? null : readXEnemies(socket, targetMask);
            JSONArray turns = battle == null ? null : readXTurnOrder(socket, battle.getInt(8 * X_ALLY_SIZE));
            boolean playing = isPlaying(p, room, story);
            byte[] voiceFlags = playing && x2Loadout && chapter >= 1 && chapter <= 5 ?
                readX2StoryFlags(socket, p.save) : null;
            JSONArray dressphereAp = playing && x2Loadout ? readX2DressphereAp(socket, p.save) : null;
            JSONObject loadout = playing && x2Loadout ?
                readX2Loadout(socket, stats, x2Unlocks, x2Accessories, x2GridSlots, sequelBattle != null) : null;

            // A reset or disc switch during a read can otherwise pair data with the previous game's profile.
            ByteBuffer confirmed = request(socket, new byte[] {STATUS, ID, CRC});
            if (confirmed.getInt() != vm || !serial.equals(string(confirmed)) || !crc.equals(string(confirmed))) return frame("waiting");

            JSONObject out = frame(playing ? "live" : "title").put("game", p.game)
                .put("edition", p.edition).put("disc", serial).put("crc", crc).put("paused", vm == 1);
            if (!playing) return out;

            out.put("room", room).put("gil", Integer.toUnsignedLong(party.getInt(0)))
                .put("story", story).put("previousRoom", previousRoom)
                .put("battles", battles).put("battle", battle != null || sequelBattle != null)
                .put("party", sequelBattle != null ? sequelBattle.party : members(p, party, stats, battle, gear));
            if (battle != null) {
                JSONArray fighters = out.getJSONArray("party");
                ByteBuffer participation = readBytes(socket, 0x31f894, 8);
                boolean activeBattle = readBytes(socket, 0x316f80, 1).get() == 1;
                for (int i = 0; i < fighters.length(); i++) {
                    JSONObject member = fighters.getJSONObject(i);
                    member.put("targeted", (targetMask & (1 << member.getInt("id"))) != 0);
                    int id = member.getInt("id");
                    if (id < 7 && activeBattle) {
                        int acted = Byte.toUnsignedInt(participation.get(id));
                        if (acted <= 1) member.put("apParticipated", acted == 1);
                    }
                }
            }
            if (loadout != null) out.put("loadout", loadout);
            if (x2Oversoul != null) out.put("oversoul", hex(x2Oversoul.array()));
            if (x2Loadout) {
                experiment.put("primers", Long.bitCount((x2KeyItems >>> 10) & 0x3ffffffL));
                if (voiceFlags != null) {
                    experiment.put("earlyScene", (voiceFlags[0x19fb] & 8) != 0)
                        .put("maxScene", (voiceFlags[0x1a08] & 4) != 0 && (voiceFlags[0x1a0a] & 1) != 0);
                }
                out.put("crimsonSpheres", (int) x2KeyItems & 0x3ff).put("blueBullets", blueBullets)
                    .put("calmLands", calmLands).put("experiment", experiment).put("towers", towers);
            }
            if (dressphereAp != null) out.put("dressphereAp", dressphereAp);
            if (enemies != null) out.put("enemies", enemies);
            if (turns != null) out.put("turnOrder", turns);
            if (grid != null) {
                out.put("progress", progress);
                out.put("grid", hex(grid.array())).put("arena", hex(arena.array()));
                JSONArray positions = new JSONArray();
                for (int i = 0; i < 7; i++) positions.put(Short.toUnsignedInt(gridPositions.getShort(i * 2)));
                out.put("gridPositions", positions).put("gridLinks", hex(gridLinks.array()));
            }
            JSONObject fieldMap = readFieldMap(socket, p, room, mapAddress);
            if (fieldMap != null) {
                out.put("fieldMap", fieldMap);
                if (battle == null && sequelBattle == null) {
                    JSONObject marker = readFieldPlayer(socket, p, fieldMap.optDouble("unit", 0));
                    if (marker != null) out.put("fieldPlayer", marker);
                    JSONArray exits = readFieldExits(socket, p, room, fieldMap.optDouble("unit", 0));
                    if (exits != null && exits.length() > 0) out.put("fieldExits", exits);
                }
            }
            if (p.sequel && chapter >= 1 && chapter <= 5) {
                out.put("chapter", chapter);
                if (voiceFlags != null) out.put("storyFlags", java.util.Base64.getEncoder().encodeToString(voiceFlags));
            }
            if (!p.sequel && battle == null) {
                JSONObject match = readBlitzMatch(socket, p, room);
                if (match != null) out.put("blitzMatch", match);
                JSONObject butterfly = readButterfly(socket, p, room);
                if (butterfly != null) out.put("butterfly", butterfly);
                JSONObject cloister = readCloister(socket, p, room);
                if (cloister != null) {
                    out.put("cloister", cloister);
                    // The tile diagram uses world coordinates, including where no regular field map exists.
                    if (room == 320) {
                        JSONObject position = readFieldPlayer(socket, p, 1);
                        if (position != null) out.put("cloisterPlayer", position);
                    }
                }
                JSONObject catcher = readCatcher(socket, p, room);
                if (catcher != null) out.put("catcher", catcher);
            }
            JSONArray items = new JSONArray();
            for (int i = 0; i < 256; i++) {
                int id = Short.toUnsignedInt(inventory.getShort(i * 2));
                int quantity = Byte.toUnsignedInt(inventory.get(512 + i));
                if ((id & 0xf000) == 0x2000 && quantity >= 1 && quantity <= 99) {
                    items.put(new JSONArray().put(id).put(quantity));
                }
            }
            ByteBuffer context = little(18);
            context.put(STATUS).put(ID).put(CRC);
            readLocation(context, p);
            ByteBuffer finalState = request(socket, context.array());
            if (finalState.getInt() != vm || !serial.equals(string(finalState)) || !crc.equals(string(finalState)) ||
                    !sameLocation(finalState, room, story, p.sequel ? chapter : -1)) return frame("waiting");
            return out.put("items", items);
        }
    }

    private static boolean isPlaying(Profile p, int room, int story) {
        return room > 0 && (p.sequel || room != 23 || story != 0);
    }

    private static void readLocation(ByteBuffer commands, Profile p) {
        readRange(commands, p.save, 2);
        readRange(commands, p.save + 0xbec, 2);
        readRange(commands, p.save + 0x114c, 1);
    }

    private static boolean sameLocation(ByteBuffer state, int room, int story, int chapter) {
        if (state.remaining() < 5 || Short.toUnsignedInt(state.getShort()) != room ||
                Short.toUnsignedInt(state.getShort()) != story) return false;
        int liveChapter = Byte.toUnsignedInt(state.get());
        return chapter < 0 || liveChapter == chapter;
    }

    static boolean supportsCheats(String serial) {
        return "SLPS-25088".equals(serial) || "SLUS-20672".equals(serial);
    }

    private static boolean cheatItem(int item) {
        return item >= 0x2000 && item <= 0x200f;
    }

    // One field per request. Preflight and readback use the same PINE connection.
    static String applyCheat(String disc, int room, int story, int item, int expected, int target,
            java.util.function.BooleanSupplier enabled) throws IOException, JSONException {
        if (!enabled.getAsBoolean()) return "The cheat is no longer active in this session.";
        boolean gil = item == 0;
        if (!supportsCheats(disc) || (!gil && !cheatItem(item)) ||
                expected < (gil ? 0 : 1) || target < (gil ? 0 : 1) || target > (gil ? GIL_LIMIT : 99)) {
            return "Choose a valid amount for this game.";
        }
        try (Socket socket = connect()) {
            ByteBuffer identity = request(socket, new byte[] {ID, CRC});
            String serial = string(identity);
            String crc = string(identity);
            Profile p = profile(serial, crc);
            if (p == null || !disc.equals(serial)) return "The running game changed. Review the cheat again.";

            ByteBuffer position = little(15);
            readLocation(position, p);
            ByteBuffer where = request(socket, position.array());
            if (where.remaining() != 5 || !isPlaying(p, room, story) ||
                    Short.toUnsignedInt(where.getShort()) != room || Short.toUnsignedInt(where.getShort()) != story) {
                return "The game moved or reloaded. Review the cheat again.";
            }
            int chapter = Byte.toUnsignedInt(where.get());
            if (p.sequel && (chapter < 1 || chapter > 5)) return "Load a game before applying a cheat.";
            int writeAddress = p.gilAddress();
            int slot = -1;
            if (!gil) {
                ByteBuffer inventoryRead = little(512);
                readRange(inventoryRead, p.save + p.itemsOffset, 768);
                ByteBuffer inventory = request(socket, java.util.Arrays.copyOf(inventoryRead.array(), inventoryRead.position()));
                if (inventory.remaining() != 768) throw new IOException("Incomplete inventory");
                for (int i = 0; i < 256; i++) {
                    if (Short.toUnsignedInt(inventory.getShort(i * 2)) != item) continue;
                    int count = Byte.toUnsignedInt(inventory.get(512 + i));
                    if (count == 0) continue;
                    if (slot != -1 || count != expected) return "Item stock changed. Review the cheat again.";
                    slot = i;
                }
                if (slot == -1) return "This item is no longer in your inventory.";
                writeAddress = p.save + p.itemsOffset + 512 + slot;
            }
            int battleRoot = p.sequel ? readBytes(socket, 0x51b860, 4).getInt() : 0;
            boolean battle = p.sequel ? readX2Battle(socket, false) != null : readXBattle(socket) != null;
            if (battle) return "Finish the battle before applying a cheat.";

            ByteBuffer guard = little(gil ? 28 : 33);
            guard.put(STATUS).put(ID).put(CRC);
            readLocation(guard, p);
            readRange(guard, p.sequel ? 0x51b860 : 0x316f80, p.sequel ? 4 : 1);
            if (!gil) readRange(guard, p.save + p.itemsOffset + 2 * slot, 2);
            readRange(guard, writeAddress, gil ? 4 : 1);
            ByteBuffer confirmed = request(socket, guard.array());
            if (confirmed.remaining() < 4 || confirmed.getInt() != 0 ||
                    !serial.equals(string(confirmed)) || !crc.equals(string(confirmed))) {
                return "Resume the same game before applying a cheat.";
            }
            if (!sameLocation(confirmed, room, story, p.sequel ? chapter : -1)) {
                return "The game moved or reloaded. Review the cheat again.";
            }
            if (p.sequel ? confirmed.getInt() != battleRoot : confirmed.get() != 0) {
                return "Finish the battle before applying a cheat.";
            }
            if (!gil && Short.toUnsignedInt(confirmed.getShort()) != item) return "Item stock changed. Review the cheat again.";
            if ((gil ? Integer.toUnsignedLong(confirmed.getInt()) : Byte.toUnsignedInt(confirmed.get())) != expected) {
                return "The amount changed. Review the cheat again.";
            }
            if (!enabled.getAsBoolean()) return "The cheat is no longer active in this session.";

            ByteBuffer valueRead = little(5);
            readRange(valueRead, writeAddress, gil ? 4 : 1);
            ByteBuffer commands = little(gil ? 14 : 11);
            commands.put(gil ? WRITE_32 : WRITE_8).putInt(writeAddress);
            if (gil) commands.putInt(target);
            else commands.put((byte) target);
            commands.put(valueRead.array());
            ByteBuffer result = request(socket, commands.array());
            if (result.remaining() != (gil ? 4 : 1) ||
                    (gil ? Integer.toUnsignedLong(result.getInt()) : Byte.toUnsignedInt(result.get())) != target) {
                throw new IOException("The emulator did not confirm the new amount");
            }
            return "";
        }
    }

    // English reference tables in the SLUS-20672 executable's loaded game data.
    private static final int X2_ACCESSORY = 0x927e40;
    private static final int X2_GARMENT_GRID = 0x93df40;
    private static final int X2_JOB = 0x93c600;
    private static final int X2_UNLOCK_BYTES = 8 + 30;
    private static final int X2_ACCESSORY_SLOTS = 128;
    private static final int X2_GRID_ARCHIVES = 0x46b40c;
    private static final int X2_CROSSED_NODES = 0x5ad148;
    private static final int X2_GRID_COUNT = 64;
    private static final int X2_GRID_SLOT_BYTES = 16;
    // Each grid has 32 job nibbles. Three character cursor tables follow at +0x800.
    private static final int X2_GRID_CURSORS = 0x800;
    private static final int X2_GRID_SAVE_BYTES = X2_GRID_CURSORS + 3 * X2_GRID_COUNT;
    private static JSONArray x2AccessoryInfo;
    private static JSONArray x2GridInfo;
    private static JSONArray x2JobInfo;
    private static final GridVertex[][] x2GridVertices = new GridVertex[X2_GRID_COUNT][];

    private static JSONArray readX2BlueBullets(ByteBuffer memory) {
        JSONArray learned = new JSONArray();
        for (int member = 0; member < 3; member++) {
            int mask = 0;
            // Player commands 0x3048–0x3057 require one AP each, awarded on learning the move.
            for (int ability = 0; ability < 16; ability++) {
                if (Short.toUnsignedInt(memory.getShort()) >= 1) mask |= 1 << ability;
            }
            learned.put(mask);
        }
        return learned;
    }

    private static JSONObject readX2CalmLands(ByteBuffer memory) throws JSONException {
        JSONObject result = new JSONObject()
            .put("openAirCredits", Integer.toUnsignedLong(memory.getInt()))
            .put("argentCredits", Integer.toUnsignedLong(memory.getInt()))
            .put("openAir", Integer.toUnsignedLong(memory.getInt()))
            .put("argent", Integer.toUnsignedLong(memory.getInt()))
            .put("matrimony", Integer.toUnsignedLong(memory.getInt()));
        JSONArray dispatches = new JSONArray();
        for (int level = 1; level <= 5; level++) dispatches.put(Byte.toUnsignedInt(memory.get()));
        return result.put("dispatches", dispatches);
    }

    private static JSONObject readX2Experiment(ByteBuffer memory, int manuals) throws JSONException {
        JSONArray parts = new JSONArray();
        for (int stat = 0; stat < 3; stat++) {
            JSONArray grades = new JSONArray();
            for (int grade = 0; grade < 3; grade++) grades.put(Short.toUnsignedInt(memory.getShort()));
            parts.put(grades);
        }
        return new JSONObject().put("parts", parts).put("manuals", manuals)
            .put("digs", Integer.toUnsignedLong(memory.getInt()))
            .put("failedDigs", Integer.toUnsignedLong(memory.getInt()));
    }

    private static JSONObject readX2Towers(ByteBuffer memory) throws JSONException {
        JSONArray scores = new JSONArray(), attempted = new JSONArray();
        for (int i = 0; i < 10; i++) {
            int score = Byte.toUnsignedInt(memory.get(i));
            if (score > 30) return null;
            scores.put(score);
            attempted.put(score > 0 || memory.get(10 + i) != 0);
        }
        return new JSONObject().put("scores", scores).put("attempted", attempted);
    }

    private static final class GridVertex {
        final int x, y, type;
        final int[] links;

        GridVertex(int x, int y, int type, int[] links) {
            this.x = x;
            this.y = y;
            this.type = type;
            this.links = links;
        }
    }

    private static JSONObject readX2Loadout(Socket socket, ByteBuffer stats, ByteBuffer unlocks,
                                            ByteBuffer accessories, ByteBuffer gridSlots, boolean battle) throws JSONException {
        if (x2AccessoryInfo == null) x2AccessoryInfo = tryX2Table(socket, X2_ACCESSORY, 128, 36, "Iron Bangle");
        if (x2GridInfo == null) x2GridInfo = tryX2Table(socket, X2_GARMENT_GRID, 64, 72, "First Steps");
        if (x2JobInfo == null) x2JobInfo = tryX2Table(socket, X2_JOB, 28, 172, "None");
        int[] equippedGrids = new int[3];
        for (int id = 0; id < equippedGrids.length; id++) {
            equippedGrids[id] = Short.toUnsignedInt(stats.getShort(id * 0x70 + 0x38));
        }
        ByteBuffer crossed = battle ? tryX2Read(socket, X2_CROSSED_NODES, 3 * X2_GRID_COUNT * 4) : null;

        JSONArray party = new JSONArray();
        for (int id = 0; id < 3; id++) {
            int base = id * 0x70;
            JSONArray worn = new JSONArray();
            for (int slot = 0; slot < 2; slot++) {
                int code = Short.toUnsignedInt(stats.getShort(base + 0x3a + slot * 2));
                worn.put((code & 0xff80) == 0x9000 ? code & 0x7f : JSONObject.NULL);
            }
            JSONArray attributes = new JSONArray();
            for (int i = 0; i < 8; i++) attributes.put(Byte.toUnsignedInt(stats.get(base + 0x2d + i)));
            long experience = Integer.toUnsignedLong(stats.getInt(base + 0x14));
            long nextLevel = Integer.toUnsignedLong(stats.getInt(base + 0x18));
            int grid = equippedGrids[id];
            JSONObject member = new JSONObject().put("id", id)
                .put("dressphere", Short.toUnsignedInt(stats.getShort(base + 0x36)))
                .put("grid", grid)
                .put("accessories", worn).put("stats", attributes)
                .put("xp", experience).put("xpToNext", nextLevel >= 0xffffffffL ? 0 : Math.max(0, nextLevel - experience));
            if (grid < X2_GRID_COUNT) {
                int cursor = Byte.toUnsignedInt(gridSlots.get(X2_GRID_CURSORS + id * X2_GRID_COUNT + grid));
                if (cursor < 32) member.put("gridSlot", cursor);
                if (crossed != null) {
                    // The game's battle table marks both visited dresspheres and crossed gate vertices.
                    member.put("gridVisitedNodes", Integer.toUnsignedLong(crossed.getInt((id * X2_GRID_COUNT + grid) * 4)));
                }
            }
            party.put(member);
        }
        JSONArray ownedGrids = new JSONArray(), ownedJobs = new JSONArray(), bag = new JSONArray();
        long bits = unlocks.getLong(0);
        for (int i = 0; i < Long.SIZE; i++) {
            if ((bits & (1L << i)) != 0) ownedGrids.put(i);
        }
        for (int i = 1; i < 30; i++) {
            int quantity = Byte.toUnsignedInt(unlocks.get(8 + i));
            if (quantity > 0 && quantity <= 99) ownedJobs.put(new JSONArray().put(0x5000 + i).put(quantity));
        }
        for (int i = 0; i < X2_ACCESSORY_SLOTS; i++) {
            int code = Short.toUnsignedInt(accessories.getShort(i * 2));
            int quantity = Byte.toUnsignedInt(accessories.get(X2_ACCESSORY_SLOTS * 2 + i));
            if ((code & 0xff80) == 0x9000 && quantity > 0 && quantity <= 99) {
                bag.put(new JSONArray().put(code & 0x7f).put(quantity));
            }
        }
        return new JSONObject().put("party", party).put("grids", ownedGrids).put("dresspheres", ownedJobs)
            .put("accessories", bag).put("gridInfo", x2GridInfo).put("dressphereInfo", x2JobInfo)
            .put("accessoryInfo", x2AccessoryInfo)
            .put("gridLayouts", readX2GridLayouts(socket, gridSlots, bits, equippedGrids));
    }

    private static JSONObject readX2GridLayouts(Socket socket, ByteBuffer slots, long grids, int[] equippedGrids)
            throws JSONException {
        for (int grid : equippedGrids) if (grid < X2_GRID_COUNT) grids |= 1L << grid;
        ByteBuffer archives = tryX2Read(socket, X2_GRID_ARCHIVES, X2_GRID_COUNT * 4);
        JSONObject layouts = new JSONObject();
        for (int grid = 0; grid < X2_GRID_COUNT; grid++) {
            if ((grids & (1L << grid)) == 0) continue;
            GridVertex[] vertices = x2GridVertices[grid];
            if (vertices == null && archives != null) {
                vertices = readX2GridVertices(socket, archives.getInt(grid * 4));
                if (vertices != null) x2GridVertices[grid] = vertices;
            }
            if (vertices == null) continue;
            JSONArray rows = new JSONArray();
            for (int node = 0; node < vertices.length; node++) {
                GridVertex vertex = vertices[node];
                int packed = Byte.toUnsignedInt(slots.get(grid * X2_GRID_SLOT_BYTES + node / 2));
                int job = vertex.type == 0 ? (packed >>> ((node & 1) * 4)) & 15 : 0;
                JSONArray links = new JSONArray();
                for (int link : vertex.links) links.put(link);
                rows.put(new JSONArray().put(vertex.x).put(vertex.y).put(vertex.type).put(links).put(job));
            }
            layouts.put(Integer.toString(grid), rows);
        }
        return layouts;
    }

    private static GridVertex[] readX2GridVertices(Socket socket, int archive) {
        if (!validRam(archive, 40) || (archive & 3) != 0) return null;
        ByteBuffer section = tryX2Read(socket, archive + 36, 4);
        if (section == null) return null;
        int offset = section.getInt(0);
        if (offset < 40 || offset > 0xffff || !validRam(archive, offset + 4)) return null;
        ByteBuffer descriptor = tryX2Read(socket, archive + offset, 4);
        if (descriptor == null) return null;
        int address = descriptor.getInt(0);
        if (!validRam(address, 4) || (address & 3) != 0) return null;
        ByteBuffer header = tryX2Read(socket, address, 4);
        if (header == null) return null;
        int count = header.getInt(0);
        if (count < 2 || count > 32 || !validRam(address, 4 + count * 32)) return null;
        ByteBuffer rows = tryX2Read(socket, address + 4, count * 32);
        if (rows == null) return null;
        GridVertex[] vertices = new GridVertex[count];
        int slots = 0;
        for (int node = 0; node < count; node++) {
            int row = node * 32;
            int type = Short.toUnsignedInt(rows.getShort(row));
            if (type > 4) return null;
            if (type == 0) slots++;
            int[] links = new int[8];
            int length = 0;
            while (length < links.length) {
                int link = Byte.toUnsignedInt(rows.get(row + 8 + length));
                if (link == 255) break;
                if (link >= count || link == node) return null;
                links[length++] = link;
            }
            if (length == 0) return null;
            vertices[node] = new GridVertex(rows.getShort(row + 4), rows.getShort(row + 6), type,
                java.util.Arrays.copyOf(links, length));
        }
        for (int node = 0; node < count; node++) {
            for (int link : vertices[node].links) {
                boolean reciprocal = false;
                for (int reverse : vertices[link].links) reciprocal |= reverse == node;
                if (!reciprocal) return null;
            }
        }
        return slots >= 2 && slots <= 6 ? vertices : null;
    }

    private static ByteBuffer tryX2Read(Socket socket, int address, int count) {
        try {
            return readBytes(socket, address, count);
        } catch (IOException ignored) {
            return null;
        }
    }

    private static JSONArray tryX2Table(Socket socket, int address, int count, int stride, String firstName) {
        try {
            ByteBuffer header = readBytes(socket, address, 32);
            if (header.getInt(0) != 1 || header.getInt(16) != count - 1 ||
                header.getInt(20) != stride || header.getInt(24) != count * stride ||
                header.getInt(28) != 32) return null;
            ByteBuffer rows = readBytes(socket, address + 32, count * stride);
            int textStart = address + 32 + count * stride;
            int last = 0;
            for (int i = 0; i < count; i++) {
                last = Math.max(last, Short.toUnsignedInt(rows.getShort(i * stride)));
                last = Math.max(last, Short.toUnsignedInt(rows.getShort(i * stride + 4)));
                if (address == X2_GARMENT_GRID) {
                    for (int message = 8; message <= 20; message += 4) {
                        last = Math.max(last, Short.toUnsignedInt(rows.getShort(i * stride + message)));
                    }
                }
            }
            if (last > 0x5000) return null;
            ByteBuffer strings = little(last + 256);
            for (int offset = 0; offset < strings.capacity();) {
                int length = Math.min(4096, strings.capacity() - offset);
                strings.put(readBytes(socket, textStart + offset, length));
                offset += length;
            }
            JSONArray info = new JSONArray();
            for (int i = 0; i < count; i++) {
                String name = decodeX2Text(strings, Short.toUnsignedInt(rows.getShort(i * stride)));
                if (i == 0 && !firstName.equals(name)) return null;
                String effect = decodeX2Text(strings, Short.toUnsignedInt(rows.getShort(i * stride + 4)));
                // Some job IDs are shared by character-specific rows, and others skip a row.
                // This byte is the ID used by the save and battle actor, not the row index.
                int id = address == X2_JOB ? Byte.toUnsignedInt(rows.get(i * stride + 10)) : i;
                if (id >= 32 && address == X2_JOB) continue;
                JSONArray row = new JSONArray().put(name).put(effect);
                if (address == X2_ACCESSORY) {
                    JSONArray stats = new JSONArray();
                    for (int stat = 0; stat < 10; stat++) stats.put(rows.get(i * stride + 14 + stat));
                    row.put(stats);
                }
                if (address == X2_GARMENT_GRID) {
                    JSONArray gates = new JSONArray();
                    for (int message = 8; message <= 20; message += 4) {
                        int start = Short.toUnsignedInt(rows.getShort(i * stride + message));
                        readX2GridMessage(strings, start, gates);
                    }
                    row.put(gates);
                }
                info.put(id, row);
            }
            return info;
        } catch (IOException | JSONException | RuntimeException e) {
            // Reference tables can be temporarily unavailable while a state is loading.
            return null;
        }
    }

    private static void readX2GridMessage(ByteBuffer text, int start, JSONArray out) throws JSONException {
        int gates = 0;
        StringBuilder value = new StringBuilder();
        for (int i = start; i < Math.min(start + 224, text.capacity()); i++) {
            int code = Byte.toUnsignedInt(text.get(i));
            if (code == 0) break;
            if (code == 0x0a) i++;
            else if (code == 0x0b && i + 1 < text.capacity()) {
                int icon = Byte.toUnsignedInt(text.get(++i));
                if (icon >= 0x80 && icon <= 0x83) {
                    if (!value.toString().isBlank()) {
                        out.put(new JSONArray().put(gates).put(value.toString().trim()));
                        value.setLength(0);
                        gates = 0;
                    }
                    gates |= 1 << (icon - 0x80);
                }
            } else {
                appendX2Character(value, code);
            }
        }
        if (!value.toString().isBlank()) out.put(new JSONArray().put(gates).put(value.toString().trim()));
    }

    private static String decodeX2Text(ByteBuffer text, int offset) {
        StringBuilder value = new StringBuilder();
        for (int i = offset; i < Math.min(offset + 224, text.capacity()); i++) {
            int code = Byte.toUnsignedInt(text.get(i));
            if (code == 0) break;
            if (code == 0x0a || code == 0x0b) i++; // Inline color or icon.
            else appendX2Character(value, code);
        }
        return value.toString().trim();
    }

    private static void appendX2Character(StringBuilder value, int code) {
        String punctuation = " !?\"#%&'()*+,-./:";
        if ((code >= 0x50 && code <= 0x89) || (code >= 0x30 && code <= 0x39)) {
            value.append((char) (code >= 0x50 ? code - 0x0f : code));
        } else if (code >= 0x3a && code <= 0x4a) {
            value.append(punctuation.charAt(code - 0x3a));
        } else if (code == 0x01) value.append(' ');
    }

    private static ByteBuffer readXBattle(Socket socket) throws IOException {
        final int pointer = 0x662070;
        final int stride = 0xc50;
        ByteBuffer query = little(5);
        readRange(query, pointer, 4);
        int address = request(socket, query.array()).getInt();
        if (address < 0x00800000 || address > 0x02000000 - 8 * stride || address % 16 != 0) return null;
        query = little(1024);
        for (int i = 0; i < 8; i++) {
            int actor = address + i * stride;
            readRange(query, actor + 0x0c, 2);
            readRange(query, actor + 0x14, 4);
            readRange(query, actor + 0x254, 8);
            readRange(query, actor + 0x290, 8);
            readRange(query, actor + 0x2c6, 16);
            readRange(query, actor + 0x27c, 2);
            readRange(query, actor + 0x268, 8); // STR, DEF, MAG, MDEF, AGI, LUCK, EVA, ACC.
            readRange(query, actor + 0x31c, 8); // CTB, default delay, Cheer/Aim/Focus/Reflex/Luck/Jinx.
        }
        readRange(query, pointer, 4);
        byte[] commands = new byte[query.position()];
        query.flip();
        query.get(commands);
        ByteBuffer actors = request(socket, commands);
        if (actors.remaining() != 8 * X_ALLY_SIZE + 4 || actors.getInt(8 * X_ALLY_SIZE) != address) return null;
        int active = 0;
        for (int i = 0; i < 8; i++) {
            int offset = i * X_ALLY_SIZE;
            if (actors.getShort(offset) != i) return null;
            if (actors.get(offset + 3) == 1) active++;
        }
        return active > 0 && active <= 3 ? actors : null;
    }

    private static JSONArray readXEnemies(Socket socket, int targetMask) throws IOException, JSONException {
        final int pointer = 0x662074;
        final int stride = 0xc50;
        ByteBuffer query = little(5);
        readRange(query, pointer, 4);
        int address = request(socket, query.array()).getInt();
        JSONArray enemies = new JSONArray();
        if (address < 0x00800000 || address > 0x02000000 - 8 * stride || address % 16 != 0) return enemies;
        query = little(1024);
        for (int i = 0; i < 8; i++) {
            int actor = address + i * stride;
            readRange(query, actor, 16);
            readRange(query, actor + 0x254, 8);
            readRange(query, actor + 0x290, 8);
            readRange(query, actor + 0x2c6, 16);
            readRange(query, actor + 0x268, 8);
            readRange(query, actor + 0x31c, 8);
        }
        readRange(query, pointer, 4);
        ByteBuffer actors = request(socket, java.util.Arrays.copyOf(query.array(), query.position()));
        if (actors.remaining() != 8 * X_ENEMY_SIZE + 4 || actors.getInt(8 * X_ENEMY_SIZE) != address) return enemies;
        for (int i = 0; i < 8; i++) {
            int row = i * X_ENEMY_SIZE;
            int id = Short.toUnsignedInt(actors.getShort(row + 14));
            int battleId = Short.toUnsignedInt(actors.getShort(row + 12));
            int maxHp = actors.getInt(row + 16);
            int hp = actors.getInt(row + 24);
            if (actors.getInt(row) == 0 || (id & 0xf000) != 0x1000 ||
                    hp < 0 || hp > maxHp || maxHp <= 0 || maxHp > 9999999) continue;
            JSONObject enemy = new JSONObject().put("id", id & 0xfff).put("slot", i).put("battleId", battleId)
                .put("hp", hp).put("maxHp", maxHp)
                .put("mp", actors.getInt(row + 28)).put("maxMp", actors.getInt(row + 20))
                .put("statusBits", Short.toUnsignedInt(actors.getShort(row + 32)))
                .put("statusTimed", xTimedEffects(actors, row + 34))
                .put("targeted", battleId < 32 && (targetMask & (1 << battleId)) != 0);
            appendXBattleStats(enemy, actors, row + 48);
            enemies.put(enemy);
        }
        return enemies;
    }

    private static int xTimedEffects(ByteBuffer actors, int offset) {
        int mask = 0;
        for (int flag = 0; flag < 13; flag++) {
            if (actors.get(offset + flag) != 0) mask |= 1 << flag;
        }
        return mask;
    }

    private static void appendXBattleStats(JSONObject actor, ByteBuffer data, int offset) throws JSONException {
        JSONArray stats = new JSONArray(), boosts = new JSONArray();
        for (int i = 0; i < 8; i++) stats.put(Byte.toUnsignedInt(data.get(offset + i)));
        for (int i = 0; i < 6; i++) {
            int value = Byte.toUnsignedInt(data.get(offset + 10 + i));
            if (value > 5) return; // Reject an inconsistent actor read.
            boosts.put(value);
        }
        actor.put("battleAttributes", stats).put("boosts", boosts)
            .put("ctb", Byte.toUnsignedInt(data.get(offset + 8)))
            .put("baseCtb", Byte.toUnsignedInt(data.get(offset + 9)));
    }

    private static final int X_CTB_ORDER = 0x68fdb0;
    private static final int X_CTB_ENTRIES = 0x68fe30;
    private static final int X_CTB_ENTRY_SIZE = 24;
    private static final int X_CTB_COUNT = 16;
    private static final int X_CTB_BYTES = X_CTB_ENTRIES - X_CTB_ORDER + 32 * X_CTB_ENTRY_SIZE;

    private static JSONArray readXTurnOrder(Socket socket, int partyAddress) throws IOException {
        // The game sorts pointers to its CTB display entries when a command is aimed.
        // Read the pointers and backing entries in the same PINE batch.
        ByteBuffer commands = little(600);
        readRange(commands, X_CTB_ORDER, X_CTB_BYTES);
        readRange(commands, 0x662070, 4);
        ByteBuffer data = request(socket, java.util.Arrays.copyOf(commands.array(), commands.position()));
        if (data.remaining() != X_CTB_BYTES + 4 || data.getInt(X_CTB_BYTES) != partyAddress) return null;
        int[] order = decodeXTurnOrder(data);
        if (order == null) return null;
        JSONArray turns = new JSONArray();
        for (int id : order) turns.put(id);
        return turns;
    }

    static int[] decodeXTurnOrder(ByteBuffer data) {
        final int tableOffset = X_CTB_ENTRIES - X_CTB_ORDER;
        if (data.limit() < X_CTB_BYTES) return null;
        int[] order = new int[X_CTB_COUNT];
        int seen = 0;
        for (int i = 0; i < order.length; i++) {
            int offset = data.getInt(i * 4) - X_CTB_ENTRIES;
            if (offset < 0 || offset >= 32 * X_CTB_ENTRY_SIZE || offset % X_CTB_ENTRY_SIZE != 0) return null;
            int bit = 1 << (offset / X_CTB_ENTRY_SIZE);
            if ((seen & bit) != 0) return null;
            seen |= bit;
            int entry = tableOffset + offset;
            int id = Byte.toUnsignedInt(data.get(entry + 1));
            if (data.get(entry) != 1 || id >= 31) return null;
            order[i] = id;
        }
        return order;
    }

    private static final class X2Battle {
        final JSONArray party = new JSONArray();
        final JSONArray enemies = new JSONArray();
    }

    private static X2Battle readX2Battle(Socket socket, boolean international) throws IOException, JSONException {
        int pointer = international ? 0x521b80 : 0x51b860;
        int stride = international ? 0x15a0 : 0x1580;
        int shift = international ? 0x10 : 0;
        int root = readBytes(socket, pointer, 4).getInt();
        if (!validRam(root, 31 * stride) || (root & 15) != 0) return null;
        ByteBuffer commands = little(31 * 20 * 5 + 5);
        for (int slot = 0; slot < 31; slot++) {
            int actor = root + slot * stride;
            readRange(commands, actor, 20);
            readRange(commands, actor + 0x10f + shift, 41);
            readRange(commands, actor + 0x138 + shift, 12);
            readRange(commands, actor + 0x16c + shift, 8);
            readRange(commands, actor + 0x1ec + shift, 12);
            readRange(commands, actor + 0x622 + shift, 2);
        }
        readRange(commands, pointer, 4);
        ByteBuffer data = request(socket, java.util.Arrays.copyOf(commands.array(), commands.position()));
        final int record = 95;
        if (data.remaining() != 31 * record + 4 || data.getInt(31 * record) != root) return null;
        X2Battle result = new X2Battle();
        int targets = international ? 0 : decodeX2TargetSlots(readBytes(socket, 0x53d140, 0x68));
        for (int slot = 0; slot < 31; slot++) {
            int row = slot * record;
            int gameSlot = Short.toUnsignedInt(data.getShort(row + 12));
            int model = Short.toUnsignedInt(data.getShort(row + 4));
            if (gameSlot != slot || data.getInt(row) == 0 || data.get(row + 19) != 1) continue;
            int maxHp = data.getInt(row + 65);
            int maxMp = data.getInt(row + 69);
            int hp = data.getInt(row + 73);
            int mp = data.getInt(row + 77);
            if (maxHp < 1 || maxHp > 9999999 || hp < 0 || hp > maxHp ||
                mp < 0 || maxMp < mp || maxMp > 9999999) continue;
            JSONObject actor = new JSONObject().put("slot", slot).put("hp", hp).put("maxHp", maxHp)
                .put("mp", mp).put("maxMp", maxMp).put("level", Byte.toUnsignedInt(data.get(row + 61)))
                .put("targeted", (targets & (1 << slot)) != 0);
            if (!international) {
                int effects = data.getInt(row + 81);
                int timed = 0;
                for (int i = 0; i < 7; i++) if (data.get(row + 85 + i) != 0) timed |= 1 << i;
                if (effects != 0) actor.put("statusBits", effects & 0x7ffff);
                if (timed != 0) actor.put("statusTimed", timed);
            }
            if (slot < 15) {
                actor.put("id", slot).put("active", true);
                int job = Short.toUnsignedInt(data.getShort(row + 93));
                if (!international && job > 0x5000 && job <= 0x501f) actor.put("job", job);
                result.party.put(actor);
            } else if ((model & 0xf000) == 0x1000 && model != 0x112d && model != 0x1119) {
                String name = decodeBattleName(data, row + 20);
                if (name.equalsIgnoreCase("Dummy") || name.equalsIgnoreCase("None")) continue;
                actor.put("id", model & 0xfff).put("name", name);
                result.enemies.put(actor);
            }
        }
        return result.party.length() > 0 && result.enemies.length() > 0 ? result : null;
    }

    static int decodeX2TargetSlots(ByteBuffer menu) {
        int mode = menu.getInt(0x64);
        if (mode != 1 && mode != 2) return 0;
        boolean party = mode == 2;
        int cursor = Short.toUnsignedInt(menu.getShort(0x2e + (party ? 0 : 2)));
        int count = Short.toUnsignedInt(menu.getShort(party ? 0x2a : 0x2c));
        int list = party ? 0x0a : 0x1a;
        int mask = Short.toUnsignedInt(menu.getShort(party ? 0 : 2));
        if (count < 1 || count > 16 || cursor >= count || mask == 0) return 0;
        if (!party && (mask >>> count) != 0) return 0;
        int cursorSlot = Byte.toUnsignedInt(menu.get(list + cursor));
        int cursorBit = party ? cursorSlot : cursor;
        if (cursorBit >= 16 || (Integer.bitCount(mask) == 1 && (mask & (1 << cursorBit)) == 0)) return 0;
        // Enemy bits index the menu list. Party bits index actual actor slots.
        int matched = 0;
        int targets = 0;
        for (int i = 0; i < count; i++) {
            int slot = Byte.toUnsignedInt(menu.get(list + i));
            if (slot >= 31 || (party && slot >= 15)) return 0;
            int bit = 1 << (party ? slot : i);
            if ((mask & bit) == 0) continue;
            matched |= bit;
            targets |= 1 << slot;
        }
        return matched == mask ? targets : 0;
    }

    private static String decodeBattleName(ByteBuffer data, int start) {
        StringBuilder name = new StringBuilder();
        for (int i = 0; i < 40; i++) {
            int code = Byte.toUnsignedInt(data.get(start + i));
            if (code == 0 && name.length() > 0) break;
            if (code == 0x3a) name.append(' ');
            else if (code >= 0x30 && code <= 0x39) name.append((char) code);
            else if (code >= 0x50 && code <= 0x89) name.append((char) (code - 0x0f));
            else if (code == 0x4f) name.append('?');
            else if (code == 0x47) name.append('-');
        }
        return name.toString().trim();
    }

    private static int cachedRoom = -1;
    private static int cachedMapAddress;
    private static int cachedGuideSignature;
    private static int cachedMapPointer;
    private static JSONObject cachedMap;

    private static JSONObject readFieldMap(Socket socket, Profile profile, int room, int address) throws IOException, JSONException {
        if (!validRam(address, 0x40)) return null;
        ByteBuffer header = readBytes(socket, address, 0x40);
        if (header.getInt(0) != 0x3150414d) return null; // MAP1
        int offset = header.getInt(0x3c);
        if (offset < 0x80 || offset >= 0x01800000 - address) return readWalkableMap(socket, profile, room, address, header);
        int guide = address + offset;
        ByteBuffer guideHeader = readBytes(socket, guide, 0x58);
        if (guideHeader.getInt(0) != 0x54444e59 || guideHeader.getInt(0x10) != 0x4d474e59) {
            return readWalkableMap(socket, profile, room, address, header);
        }
        // Separate guide packets can draw different floors. Use the common coordinate space
        // of the walkable terrain instead of drawing the first floor regardless of position.
        long guidePacketEnd = 0x20L + 16L * guideHeader.getInt(0x14);
        if (profile.sequel && guidePacketEnd >= 0x58 && guidePacketEnd < 0x40000 &&
            validRam(guide, (int) guidePacketEnd + 4) &&
            readBytes(socket, guide + (int) guidePacketEnd, 4).getInt() == 0x4d474e59) {
            JSONObject terrain = readWalkableMap(socket, profile, room, address, header);
            if (terrain != null) return terrain;
        }
        int triangleCount = Short.toUnsignedInt(guideHeader.getShort(0x38));
        int vertexCount = Short.toUnsignedInt(guideHeader.getShort(0x3a));
        // The vertex pool follows the padded polygon packet and its control words.
        int vertexOffset = guideHeader.getInt(0x30) + 0x28;
        int size = vertexOffset + vertexCount * 6;
        if (triangleCount == 0 || triangleCount > 4000 || vertexCount < 3 || vertexCount > 8000 ||
            vertexOffset < 0x58 + triangleCount * 20 || vertexOffset > 0x80 + triangleCount * 20 ||
            !validRam(guide, size)) return null;
        int signature = java.util.Arrays.hashCode(guideHeader.array()) ^ offset;
        if (cachedMapPointer == profile.mapPointer && cachedRoom == room && cachedMapAddress == address &&
            cachedGuideSignature == signature) return cachedMap;

        int bodySize = size - 0x58;
        ByteBuffer data = little(bodySize);
        for (int read = 0; read < bodySize;) {
            int amount = Math.min(8192, bodySize - read);
            data.put(readBytes(socket, guide + 0x58 + read, amount));
            read += amount;
        }
        ByteBuffer verify = little(10);
        readRange(verify, profile.mapPointer, 4);
        readRange(verify, profile.save, 2);
        ByteBuffer current = request(socket, verify.array());
        if (current.getInt() != address || Short.toUnsignedInt(current.getShort()) != room) return null;

        ByteBuffer triangles = little(triangleCount * 6);
        for (int i = 0; i < triangleCount; i++) {
            for (int j = 0; j < 3; j++) {
                short vertex = data.getShort(i * 20 + 12 + j * 2);
                if (Short.toUnsignedInt(vertex) >= vertexCount) return null;
                triangles.putShort(vertex);
            }
        }
        ByteBuffer vertices = little(vertexCount * 4);
        for (int i = 0; i < vertexCount; i++) {
            int vertex = vertexOffset - 0x58 + i * 6;
            vertices.putShort(data.getShort(vertex)).putShort(data.getShort(vertex + 4));
        }
        cachedRoom = room;
        cachedMapPointer = profile.mapPointer;
        cachedMapAddress = address;
        cachedGuideSignature = signature;
        cachedMap = new JSONObject()
            .put("vertices", android.util.Base64.encodeToString(vertices.array(), android.util.Base64.NO_WRAP))
            .put("triangles", android.util.Base64.encodeToString(triangles.array(), android.util.Base64.NO_WRAP));
        // The first YNGM packet ends at its qword length plus the YNDT wrapper.
        // Its transform scales packed coordinates into the same units as the field actors.
        long packetEnd = 0x20L + 16L * guideHeader.getInt(0x14);
        if (packetEnd >= size + 0xc0 && packetEnd < 0x40000 && validRam(guide, (int) packetEnd)) {
            float unit = readBytes(socket, guide + (int) packetEnd - 0x88, 4).getFloat();
            if (Float.isFinite(unit) && unit > 0.00001f && unit < 10f) cachedMap.put("unit", unit);
        }
        return cachedMap;
    }

    private static JSONObject readWalkableMap(Socket socket, Profile profile, int room, int address, ByteBuffer map)
            throws IOException, JSONException {
        // FFX-2 can omit guide art entirely. Draw the playable surfaces from MAP1's height mesh instead.
        // See the MIT-licensed noclip.website FFX MAP1 reader for the common record layout.
        if (!profile.sequel) return null;
        int offset = map.getInt(0x18);
        if (offset < 0x80 || !validRam(address + offset, 0x20)) return null;
        ByteBuffer header = readBytes(socket, address + offset, 0x20);
        int vertexCount = Short.toUnsignedInt(header.getShort(0x0a));
        float inverseScale = header.getFloat(0x0c);
        int vertexAddress = header.getInt(0x18);
        int triangleHeader = header.getInt(0x1c);
        if (vertexCount < 3 || vertexCount > 20000 || !Float.isFinite(inverseScale) || inverseScale < 1 || inverseScale > 100000 ||
            !validRam(vertexAddress, vertexCount * 8) || !validRam(triangleHeader, 16)) return null;
        ByteBuffer table = readBytes(socket, triangleHeader, 16);
        int triangleCount = Short.toUnsignedInt(table.getShort(8));
        int triangleAddress = table.getInt(0x0c);
        if (triangleCount < 1 || triangleCount > 30000 || !validRam(triangleAddress, triangleCount * 16)) return null;
        int signature = java.util.Arrays.hashCode(header.array()) ^ triangleAddress ^ triangleCount;
        if (cachedMapPointer == profile.mapPointer && cachedRoom == room && cachedMapAddress == address &&
            cachedGuideSignature == signature) return cachedMap;

        ByteBuffer rawVertices = readChunks(socket, vertexAddress, vertexCount * 8);
        ByteBuffer rawTriangles = readChunks(socket, triangleAddress, triangleCount * 16);
        ByteBuffer verify = little(10);
        readRange(verify, profile.mapPointer, 4);
        readRange(verify, profile.save, 2);
        ByteBuffer current = request(socket, verify.array());
        if (current.getInt() != address || Short.toUnsignedInt(current.getShort()) != room) return null;
        ByteBuffer vertices = little(vertexCount * 4);
        ByteBuffer triangles = little(triangleCount * 6);
        int[] packed = new int[vertexCount];
        java.util.Arrays.fill(packed, -1);
        for (int t = 0; t < triangleCount * 16; t += 16) {
            if ((rawTriangles.getInt(t + 12) & 0x7f) != 0) continue;
            int a = Short.toUnsignedInt(rawTriangles.getShort(t));
            int b = Short.toUnsignedInt(rawTriangles.getShort(t + 2));
            int c = Short.toUnsignedInt(rawTriangles.getShort(t + 4));
            if (a >= vertexCount || b >= vertexCount || c >= vertexCount) return null;
            if (a == b || b == c || a == c) continue;
            for (int id : new int[]{a, b, c}) {
                if (packed[id] < 0) {
                    packed[id] = vertices.position() / 4;
                    vertices.putShort(rawVertices.getShort(id * 8)).putShort(rawVertices.getShort(id * 8 + 4));
                }
                triangles.putShort((short) packed[id]);
            }
        }
        if (triangles.position() == 0) return null;
        cachedMapPointer = profile.mapPointer;
        cachedRoom = room;
        cachedMapAddress = address;
        cachedGuideSignature = signature;
        cachedMap = new JSONObject().put("unit", 10f / inverseScale).put("mesh", true)
            .put("vertices", android.util.Base64.encodeToString(vertices.array(), 0, vertices.position(), android.util.Base64.NO_WRAP))
            .put("triangles", android.util.Base64.encodeToString(triangles.array(), 0, triangles.position(), android.util.Base64.NO_WRAP));
        return cachedMap;
    }

    private static ByteBuffer readChunks(Socket socket, int address, int size) throws IOException {
        ByteBuffer data = little(size);
        for (int offset = 0; offset < size;) {
            int amount = Math.min(8192, size - offset);
            data.put(readBytes(socket, address + offset, amount));
            offset += amount;
        }
        return data;
    }

    private static int exitEvent, exitRoom, exitProfile, exitCode;
    private static double exitUnit;
    private static JSONArray cachedExits;

    private static JSONArray readFieldExits(Socket socket, Profile profile, int room, double unit)
            throws IOException, JSONException {
        if (unit <= 0) return null;
        int field = readBytes(socket, profile.fieldPointer, 4).getInt();
        if (field < 0x00400000 || field > 0x00800000 - 0x50) return null;
        ByteBuffer fieldState = readBytes(socket, field, 0x4c);
        if ((fieldState.getInt(0) & 1) == 0 || Short.toUnsignedInt(fieldState.getShort(0x0a)) == 0xffff) return null;
        int event = fieldState.getInt(0x48);
        if (!validRam(event, 0x38)) return null;
        ByteBuffer header = readBytes(socket, event, 0x38);
        int codeStart = header.getInt(0x30), codeLength = header.getInt(0), jumpsEnd = header.getInt(0x10);
        int count = Short.toUnsignedInt(header.getShort(0x34));
        if (count < 1 || count > 256 || codeStart < 0x38 + 4 * count || codeStart > 0x20000 ||
            codeLength < 1 || codeLength > 0x60000 || jumpsEnd < codeStart + codeLength || jumpsEnd > 0x80000 ||
            !validRam(event, jumpsEnd)) return null;
        if (cachedExits != null && exitEvent == event && exitRoom == room && exitProfile == profile.fieldPointer &&
            exitCode == codeLength && exitUnit == unit) return cachedExits;

        // ATEL assigns an initialization function and a crossing handler to each line trigger.
        ByteBuffer workerIndex = readBytes(socket, event + 0x38, count * 4);
        int first = codeStart, last = 0;
        for (int i = 0; i < count; i++) {
            int at = workerIndex.getInt(i * 4);
            if (at < 0x38 + 4 * count || at > codeStart - 0x34) return null;
            first = Math.min(first, at);
            last = Math.max(last, at + 0x34);
        }
        if (last - first > 0x3000) return null;
        ByteBuffer workers = readChunks(socket, event + first, last - first);
        ByteBuffer indexes = little(count * 2 * 5);
        int[][] triggers = new int[count][3];
        int triggerCount = 0;
        for (int i = 0; i < count; i++) {
            int worker = workerIndex.getInt(i * 4) - first;
            int type = Short.toUnsignedInt(workers.getShort(worker));
            int handler = type == 2 ? 4 : profile.sequel && type == 5 ? 2 : -1;
            if (handler < 0 || Short.toUnsignedInt(workers.getShort(worker + 8)) <= handler) continue;
            int funcs = workers.getInt(worker + 0x20);
            int floats = workers.getInt(worker + 0x1c);
            int floatCount = Short.toUnsignedInt(workers.getShort(worker + 6));
            if (funcs < 0x38 || funcs > jumpsEnd - 4 * (handler + 1) || floats < 0x38 ||
                floatCount < 1 || floats > codeStart - 4 * floatCount) continue;
            readRange(indexes, event + funcs, 4);
            readRange(indexes, event + funcs + handler * 4, 4);
            triggers[triggerCount++] = new int[]{floats, floatCount, i};
        }
        JSONArray result = new JSONArray();
        if (triggerCount > 0) {
            ByteBuffer functions = request(socket, java.util.Arrays.copyOf(indexes.array(), indexes.position()));
            for (int i = 0; i < triggerCount; i++) {
                int init = functions.getInt(), handler = functions.getInt();
                if (init < 0 || init >= codeLength || handler < 0 || handler >= codeLength) continue;
                int destination = exitDestination(readBytes(socket, event + codeStart + handler,
                    Math.min(240, codeLength - handler)));
                if (destination <= 0 || destination == room || destination > 999) continue;
                int[] refs = exitCoordinates(readBytes(socket, event + codeStart + init,
                    Math.min(160, codeLength - init)));
                if (refs == null) continue;
                ByteBuffer values = little(20);
                boolean valid = true;
                for (int j : new int[]{0, 2, 3, 5}) {
                    if (refs[j] >= triggers[i][1]) { valid = false; break; }
                    readRange(values, event + triggers[i][0] + 4 * refs[j], 4);
                }
                if (!valid) continue;
                ByteBuffer points = request(socket, values.array());
                double x = points.getFloat() / unit, y = points.getFloat() / unit;
                double endX = points.getFloat() / unit, endY = points.getFloat() / unit;
                if (!validMapPoint(x, y) || !validMapPoint(endX, endY)) continue;
                result.put(new JSONObject().put("room", destination).put("trigger", triggers[i][2])
                    .put("x", Math.round((x + endX) / 2)).put("y", Math.round((y + endY) / 2)));
            }
        }
        if (Short.toUnsignedInt(readBytes(socket, profile.save, 2).getShort()) != room ||
            readBytes(socket, field + 0x48, 4).getInt() != event) return null;
        exitEvent = event;
        exitRoom = room;
        exitProfile = profile.fieldPointer;
        exitCode = codeLength;
        exitUnit = unit;
        cachedExits = result;
        return result;
    }

    private static int exitDestination(ByteBuffer script) {
        int target = -1, last = -1, previous = -1;
        while (script.hasRemaining()) {
            int op = Byte.toUnsignedInt(script.get());
            if (op == 0x3c || op == 0x40) break;
            if (op >= 0x80 && op != 0xff && script.remaining() < 2) break;
            int operand = op >= 0x80 && op != 0xff ? Short.toUnsignedInt(script.getShort()) : 0;
            if (op == 0xd8 && (operand == 0x11 || operand == 0x10b)) {
                if (previous < 1 || last < 0 || (target != -1 && target != previous)) return -1;
                target = previous;
            }
            previous = last;
            last = op == 0xae ? operand : -1;
        }
        return target;
    }

    private static int[] exitCoordinates(ByteBuffer script) {
        int[] refs = new int[6];
        int count = 0;
        while (script.hasRemaining()) {
            int op = Byte.toUnsignedInt(script.get());
            if (op == 0x3c || op == 0x40) break;
            if (op >= 0x80 && op != 0xff && script.remaining() < 2) break;
            int operand = op >= 0x80 && op != 0xff ? Short.toUnsignedInt(script.getShort()) : 0;
            if (op == 0xd8 && operand == 0x54) return count == 6 ? refs : null;
            if (op == 0xaf && count < 6) refs[count++] = operand;
            else count = 0;
        }
        return null;
    }

    private static boolean validMapPoint(double x, double y) {
        return Double.isFinite(x) && Double.isFinite(y) && Math.abs(x) <= 32768 && Math.abs(y) <= 32768;
    }

    private static JSONObject readFieldPlayer(Socket socket, Profile profile, double unit) throws IOException, JSONException {
        if (unit <= 0) return null;
        int fieldAddress = readBytes(socket, profile.fieldPointer, 4).getInt();
        if (fieldAddress < 0x00400000 || fieldAddress > 0x00800000 - 0x20) return null;
        ByteBuffer field = readBytes(socket, fieldAddress, 0x20);
        int actor = Short.toUnsignedInt(field.getShort(0x0a));
        int count = Short.toUnsignedInt(field.getShort(0x0c)) - Short.toUnsignedInt(field.getShort(0x14))
            - Short.toUnsignedInt(field.getShort(0x16)) - Short.toUnsignedInt(field.getShort(0x18));
        int stride = profile.sequel ? 0xb98 : 0xb58;
        int root = field.getInt(0x1c);
        if ((field.getInt(0) & 1) == 0 || actor >= count || count > 256 || !validRam(root, count * stride)) return null;
        ByteBuffer position = readBytes(socket, root + actor * stride + 0x558, 0x38);
        double x = position.getFloat(0) / unit;
        double y = position.getFloat(8) / unit;
        float facing = position.getFloat(0x34);
        if (!validMapPoint(x, y) ||
            !Float.isFinite(facing) || Math.abs(facing) > 20) return null;
        return new JSONObject().put("x", Math.round(x)).put("y", Math.round(y));
    }

    private static boolean validRam(int address, int length) {
        return address >= 0x00800000 && address <= 0x02000000 - length;
    }

    // SLPS-25088 ATEL scope-6 variables live in the current event's data section.
    // Every requested variable is checked against its declaration before reading.
    private static final class FieldScript {
        int field, event, data, variables, variableCount, workers, workerCount, controlled;
    }

    private static FieldScript fieldScript(Socket socket, Profile profile, String expectedName) throws IOException {
        int field = readBytes(socket, profile.fieldPointer, 4).getInt();
        if (field < 0x00400000 || field > 0x00800000 - 0x50) return null;
        ByteBuffer state = readBytes(socket, field, 0x4c);
        if ((state.getInt(0) & 1) == 0) return null;
        int event = state.getInt(0x48);
        if (!validRam(event, 0x3c)) return null;
        ByteBuffer header = readBytes(socket, event, 0x3c);
        int idOffset = header.getInt(0x0c);
        if (idOffset < 0x38 || idOffset > 0x600000 || !validRam(event + idOffset, 8) ||
            !expectedName.equals(new String(readBytes(socket, event + idOffset, 8).array(), StandardCharsets.US_ASCII))) return null;
        int dataOffset = header.getInt(0x20), workerOffset = header.getInt(0x38);
        if (dataOffset < 0x38 || dataOffset > 0x600000 || workerOffset < 0x38 || workerOffset > 0x600000 ||
                !validRam(event + dataOffset, 4) || !validRam(event + workerOffset, 0x34)) return null;
        ByteBuffer worker = readBytes(socket, event + workerOffset, 0x34);
        int count = Short.toUnsignedInt(worker.getShort(2)), variables = worker.getInt(0x14);
        if (count < 1 || count > 4096 || variables < 0x38 || variables > 0x600000 ||
                !validRam(event + variables, count * 8)) return null;
        FieldScript script = new FieldScript();
        script.field = field; script.event = event; script.data = event + dataOffset;
        script.variables = event + variables; script.variableCount = count;
        script.workers = state.getInt(0x1c);
        script.workerCount = Short.toUnsignedInt(state.getShort(0x0c)) - Short.toUnsignedInt(state.getShort(0x14)) -
            Short.toUnsignedInt(state.getShort(0x16)) - Short.toUnsignedInt(state.getShort(0x18));
        script.controlled = Short.toUnsignedInt(state.getShort(0x0a));
        return script;
    }

    private static boolean scriptVariable(Socket socket, FieldScript script, int id, int descriptor, int count) throws IOException {
        if (id < 0 || id >= script.variableCount) return false;
        ByteBuffer declaration = readBytes(socket, script.variables + id * 8, 8);
        return declaration.getInt() == descriptor && declaration.getInt() == count;
    }

    private static boolean scriptVariables(Socket socket, FieldScript script, int[][] wanted) throws IOException {
        ByteBuffer commands = little(wanted.length * 10);
        for (int[] variable : wanted) {
            if (variable[0] < 0 || variable[0] >= script.variableCount) return false;
            readRange(commands, script.variables + variable[0] * 8, 8);
        }
        ByteBuffer data = request(socket, java.util.Arrays.copyOf(commands.array(), commands.position()));
        for (int[] variable : wanted) if (data.getInt() != variable[1] || data.getInt() != variable[2]) return false;
        return true;
    }

    private static boolean sameFieldScript(Socket socket, Profile p, FieldScript script, int room) throws IOException {
        ByteBuffer commands = little(40);
        readRange(commands, p.fieldPointer, 4); readRange(commands, script.field + 0x48, 4);
        readRange(commands, script.field + 0x1c, 4); readRange(commands, script.field + 0x0a, 2);
        readRange(commands, p.save, 2);
        ByteBuffer data = request(socket, java.util.Arrays.copyOf(commands.array(), commands.position()));
        boolean same = data.getInt() == script.field && data.getInt() == script.event && data.getInt() == script.workers;
        if (!same) return false;
        script.controlled = Short.toUnsignedInt(data.getShort());
        return Short.toUnsignedInt(data.getShort()) == room;
    }

    private static JSONObject readBlitzMatch(Socket socket, Profile p, int room) throws IOException, JSONException {
        if (room != 62) return null;
        FieldScript script = fieldScript(socket, p, "bltz0000");
        if (script == null || script.workerCount < 19 || script.workerCount > 256 ||
                !validRam(script.workers, script.workerCount * 0xb58) || !validRam(script.data, 0xfb1)) return null;
        if (!scriptVariables(socket, script, new int[][] {{42,0x5d0000c0,16},{52,0x5c000144,1},{53,0x5c000148,1},
            {166,0x0c000f76,1},{173,0x0d000f90,16},{175,0x0c000fb0,1},{57,0x5d00020c,16},{59,0x5d00028c,16},
            {61,0x5d00030c,16},{63,0x5d00038c,16},{65,0x5d00040c,16},{67,0x5d00048c,16},{69,0x5d00050c,16}})) return null;
        int[] statOffsets = {0x20c,0x28c,0x30c,0x38c,0x40c,0x48c,0x50c};
        String[] statNames = {"AT","EN","PA","SH","BL","CA","SP"};
        int[] slots = {0,1,2,3,4,5,8,9,10,11,12,13};
        ByteBuffer batch = little(2048);
        readRange(batch, script.data + 0xc0, 0x54c - 0xc0);
        readRange(batch, script.data + 0xf76, 0x3b); readRange(batch, p.save + 0x163e, 4);
        for (int slot : slots) readRange(batch, script.workers + (2 + slot) * 0xb58 + 0x558, 12);
        for (int slot : slots) readRange(batch, script.workers + (2 + slot) * 0xb58 + 0x9c, 4);
        readRange(batch, script.workers + 18 * 0xb58 + 0x9c, 4);
        ByteBuffer all = request(socket, java.util.Arrays.copyOf(batch.array(), batch.position()));
        ByteBuffer statsBlock = take(all, 0x54c - 0xc0);
        int elapsed = statsBlock.getInt(0x144 - 0xc0), period = statsBlock.getInt(0x148 - 0xc0);
        ByteBuffer lineup = take(all, 0x3b);
        int carrier = Byte.toUnsignedInt(lineup.get(0)), base = Byte.toUnsignedInt(lineup.get(0x3a));
        if (elapsed < 0 || elapsed > 300 || period != 300 || base != 2) return null;
        ByteBuffer score = take(all, 4);
        int us = Byte.toUnsignedInt(score.get()), them = Byte.toUnsignedInt(score.get()), half = Byte.toUnsignedInt(score.get());
        if (us > 99 || them > 99 || half > 2) return null;
        JSONArray players = new JSONArray();
        boolean[] ids = new boolean[60];
        boolean carrierFound = false;
        for (int slot : slots) {
            int id = Byte.toUnsignedInt(lineup.get(0x1a + slot)), health = statsBlock.getInt(slot * 4);
            if (id >= 60 || ids[id] || health < 0 || health > 9999) return null;
            ids[id] = true;
            ByteBuffer coords = take(all, 12);
            float x = coords.getFloat(0), y = coords.getFloat(8);
            if (!Float.isFinite(x) || !Float.isFinite(y) || Math.abs(x) > 20000 || Math.abs(y) > 20000) return null;
            JSONObject stats = new JSONObject();
            for (int i = 0; i < statOffsets.length; i++) {
                int stat = statsBlock.getInt(statOffsets[i] - 0xc0 + slot * 4);
                if (stat < 0 || stat > 99) return null;
                stats.put(statNames[i], stat);
            }
            players.put(new JSONObject().put("slot", slot).put("id", id).put("hp", health).put("x", x).put("y", y).put("stats", stats));
            if (slot == carrier) carrierFound = true;
        }
        int[] handles = new int[slots.length];
        for(int i=0;i<handles.length;i++){handles[i]=all.getInt();if(!validRam(handles[i],0x1b0))return null;}
        int ballHandle=all.getInt();if(!validRam(ballHandle,0x1b0))return null;
        ByteBuffer binding=readBytes(socket,ballHandle+0x1a8,8);
        int parent=binding.getInt(),joint=binding.getInt(),attached=-1;
        if(joint==14||joint==15)for(int i=0;i<handles.length;i++)if(handles[i]==parent)attached=slots[i];
        carrierFound=carrierFound&&attached==carrier;
        if (!sameFieldScript(socket, p, script, room)) return null;
        return new JSONObject().put("elapsed", elapsed).put("period", period).put("score", new JSONArray().put(us).put(them))
            .put("half", half).put("carrier", carrierFound ? carrier : -1)
            .put("ballInFlight",parent==0)
            .put("controlled", script.controlled == 0xffff ? -1 : script.controlled - base).put("players", players);
    }

    private static JSONObject readButterfly(Socket socket, Profile p, int room) throws IOException, JSONException {
        if (room != 241 && room != 242) return null;
        FieldScript script = fieldScript(socket, p, room == 241 ? "mcfr0100" : "mcfr0200");
        int variable = room == 241 ? 26 : 20;
        if (script == null || !validRam(script.data, 0x43) ||
            !scriptVariable(socket, script, variable, 0x0c000041, 1) ||
            !scriptVariable(socket, script, variable + 1, 0x0c000042, 1)) return null;
        ByteBuffer state = readBytes(socket, script.data + 0x41, 2);
        int active = Byte.toUnsignedInt(state.get()), caught = Byte.toUnsignedInt(state.get());
        if (active > 1 || caught > 7 || !sameFieldScript(socket, p, script, room)) return null;
        JSONObject out = new JSONObject().put("active", active == 1);
        if (active == 1) {
            out.put("caught", caught);
            JSONArray markers=butterflyActors(socket,script,room);
            if(markers!=null)out.put("actors",markers);
        }
        if(!sameFieldScript(socket,p,script,room))return null;
        return out;
    }

    private static JSONArray butterflyActors(Socket socket,FieldScript script,int room) throws IOException,JSONException {
        int first=room==241?18:8;
        int[] workers={first,first+2,first+3,first+4,first+5,first+6,first+7,first+8};
        if(script.workerCount<=first+8||script.workerCount>256||!validRam(script.workers,script.workerCount*0xb58))return null;
        ByteBuffer commands=little(160);
        for(int worker:workers){readRange(commands,script.workers+worker*0xb58+0x9c,4);readRange(commands,script.workers+worker*0xb58+0x558,12);}
        ByteBuffer actorData=request(socket,java.util.Arrays.copyOf(commands.array(),commands.position()));
        float[][] positions=new float[8][2];commands=little(240);
        for(int i=0;i<8;i++){
            int handle=actorData.getInt();positions[i][0]=actorData.getFloat();actorData.getFloat();positions[i][1]=actorData.getFloat();
            if(!validRam(handle,0x354)||!Float.isFinite(positions[i][0])||!Float.isFinite(positions[i][1])||
                Math.abs(positions[i][0])>20000||Math.abs(positions[i][1])>20000)return null;
            readRange(commands,handle+0x32c,40);
        }
        ByteBuffer colors=request(socket,java.util.Arrays.copyOf(commands.array(),commands.position()));
        JSONArray markers=new JSONArray();
        for(int i=0;i<8;i++){
            ByteBuffer color=take(colors,40);float r=color.getFloat(0),g=color.getFloat(12),b=color.getFloat(24),alpha=color.getFloat(36);
            String kind=Math.abs(r-.1f)<.02f&&Math.abs(g-.3f)<.02f&&Math.abs(b-1)<.02f?"blue":
                Math.abs(r-.9f)<.02f&&Math.abs(g-.1f)<.02f&&Math.abs(b-.1f)<.02f?"red":null;
            if(kind!=null&&Float.isFinite(alpha)&&alpha>0)markers.put(new JSONObject().put("kind",kind).put("x",positions[i][0]).put("y",positions[i][1]));
        }
        return markers;
    }

    private static JSONObject readCatcher(Socket socket, Profile p, int room) throws IOException, JSONException {
        if (room != 223) return null;
        FieldScript script=fieldScript(socket,p,"nagi0000");
        if(script==null||!validRam(script.data,0xe2)||!scriptVariables(socket,script,new int[][]{
            {104,0x0c0000b0,1},{105,0x0c0000b1,1},{106,0x0c0000b2,1},{113,0x0c0000b9,1},{114,0x0c0000ba,1},{115,0x0c0000bb,1},
            {116,0x0c0000bc,1},{117,0x0c0000bd,1},{135,0x0c0000d3,1},{137,0x0c0000d5,1},{140,0x0c0000d8,1},{149,0x0c0000e1,1}}))return null;
        ByteBuffer bytes=readBytes(socket,script.data+0xb0,0x32);
        if(Byte.toUnsignedInt(bytes.get(0xc))!=4||bytes.get(0x31)!=1)return null;
        int phase=Byte.toUnsignedInt(bytes.get(0xd)),finish=Byte.toUnsignedInt(bytes.get(0x28));
        if(phase<1||phase>4||finish>4)return null;
        boolean finished=finish==4;
        int minutes=Byte.toUnsignedInt(bytes.get(finished?9:2)),seconds=Byte.toUnsignedInt(bytes.get(finished?10:1)),tenths=Byte.toUnsignedInt(bytes.get(finished?11:0));
        int balloons=Byte.toUnsignedInt(bytes.get(0x23)),birds=Byte.toUnsignedInt(bytes.get(0x25));
        if(minutes>2||seconds>59||tenths>9||balloons>99||birds>99||!sameFieldScript(socket,p,script,room))return null;
        return new JSONObject().put("finished",finished).put("tenths",minutes*600+seconds*10+tenths).put("balloons",balloons).put("birds",birds);
    }

    private static JSONArray attachedSpheres(Socket socket, FieldScript script, int[] workers, String[] names, int pedestal)
            throws IOException, JSONException {
        int largest = pedestal;
        for (int id : workers) largest = Math.max(largest, id);
        if (script.workerCount <= largest || script.workerCount > 256 || !validRam(script.workers, script.workerCount * 0xb58)) return null;
        ByteBuffer commands = little((workers.length + 2) * 5);
        readRange(commands, script.workers + 0x9c, 4);
        if (pedestal >= 0) readRange(commands, script.workers + pedestal * 0xb58 + 0x9c, 4);
        for (int id : workers) readRange(commands, script.workers + id * 0xb58 + 0x9c, 4);
        ByteBuffer handles = request(socket, java.util.Arrays.copyOf(commands.array(), commands.position()));
        int playerHandle = handles.getInt(), pedestalHandle = pedestal >= 0 ? handles.getInt() : 0;
        if (!validRam(playerHandle, 0x1b0) || pedestal >= 0 && !validRam(pedestalHandle, 0x1b0)) return null;
        commands = little(workers.length * 10);
        for (int i = 0; i < workers.length; i++) {
            int handle = handles.getInt();
            if (!validRam(handle, 0x1b0)) return null;
            readRange(commands, handle + 0x1a8, 8);
        }
        ByteBuffer parents = request(socket, java.util.Arrays.copyOf(commands.array(), commands.position()));
        JSONArray spheres = new JSONArray();
        for (int i = 0; i < workers.length; i++) {
            int parent = parents.getInt(), joint = parents.getInt();
            String owner = parent == playerHandle && joint == 5 ? "held" :
                pedestal >= 0 && parent == pedestalHandle && (joint == 4 || joint == 5) ? "pedestal" : "recess";
            spheres.put(new JSONObject().put("name", names[i]).put("owner", owner).put("joint", joint));
        }
        return spheres;
    }

    private static JSONObject readCloister(Socket socket, Profile p, int room) throws IOException, JSONException {
        String name, temple; int variable, offset, maximum; boolean wide;
        switch (room) {
            case 122: name="bsyt0100"; temple="Besaid"; variable=37; offset=0xac; maximum=3; wide=true; break;
            case 108: name="klyt1000"; temple="Kilika"; variable=27; offset=0x5b; maximum=6; wide=false; break;
            case 214: name="djyt0600"; temple="Djose"; variable=40; offset=0x94; maximum=10; wide=false; break;
            case 239: name="mcyt0500"; temple="Macalania"; variable=31; offset=0x94; maximum=11; wide=false; break;
            case 306: name="bvyt1100"; temple="Bevelle"; variable=-1; offset=0; maximum=0; wide=false; break;
            case 320: name="dome0700"; temple="Zanarkand"; variable=-1; offset=0; maximum=0; wide=false; break;
            default: return null;
        }
        FieldScript script = fieldScript(socket, p, name);
        if (script == null || !validRam(script.data, 0xec)) return null;
        JSONObject out = new JSONObject().put("temple", temple);
        int held = 0;
        if (variable >= 0) {
            if (!scriptVariable(socket, script, variable, (wide ? 0x5c000000 : 0x0c000000) | offset, 1)) return null;
            ByteBuffer value = readBytes(socket, script.data + offset, wide ? 4 : 1);
            held = wide ? value.getInt() : Byte.toUnsignedInt(value.get());
            if (held < 0 || held > maximum) return null;
            out.put("held", held);
        }
        if (room == 320 && scriptVariables(socket, script, new int[][]{
                {8,0x5c000004,1},{9,0x5c000008,1},{10,0x5c00000c,1},{11,0x5c000010,1},
                {12,0x5c000014,1},{13,0x5c000018,1},{14,0x5c00001c,1},{15,0x0c000020,1},
                {17,0x0c000022,1},{18,0x0c000023,1},{19,0x0c000024,1},{24,0x0c000029,1}})) {
            ByteBuffer puzzle=readBytes(socket,script.data+4,0x26);
            int phase=puzzle.getInt(0),hand=puzzle.getInt(4),solved=Byte.toUnsignedInt(puzzle.get(0x1c));
            int small=Byte.toUnsignedInt(puzzle.get(0x1e)),large=Byte.toUnsignedInt(puzzle.get(0x20)),white=Byte.toUnsignedInt(puzzle.get(0x25));
            if(phase<0||phase>6||hand<0||hand>3||solved<0||solved>7||small>5||large>9||white>8)return null;
            JSONArray sockets=new JSONArray();
            for(int id=10;id<=14;id++) {
                int sphere=puzzle.getInt((id-8)*4);
                if(sphere<0||sphere>3)return null;
                if(id!=12||phase==5&&white>=7)sockets.put(new JSONObject().put("id",id).put("value",sphere));
            }
            out.put("held",hand).put("sockets",sockets).put("puzzle",new JSONObject().put("phase",phase)
                .put("solved",solved).put("small",small).put("large",large).put("white",white));
        } else if (room == 306 && scriptVariables(socket,script,new int[][]{
                {32,0x0c000025,1},{33,0x0c000026,1},{36,0x0c00002a,1},{43,0x0d000032,0x000c0048}})) {
            // The sphere table tracks Tidus in slot 1, including when he carries the starting-branch sphere.
            ByteBuffer data=readBytes(socket,script.data+0x25,0x55);
            int[] slots=new int[12];
            for(int group=1;group<=5;group++) {
                int found=0;
                for(int slot=1;slot<=11;slot++) {
                    int flag=Byte.toUnsignedInt(data.get(0x0d+group*12+slot));
                    if(flag>1||flag==1&&(found!=0||slots[slot]!=0))return null;
                    if(flag==1){found=slot;slots[slot]=group<=3?1:group-2;}
                }
                if(found==0)return null;
            }
            JSONArray sockets=new JSONArray();
            for(int id=2;id<=11;id++)sockets.put(new JSONObject().put("id",id).put("value",slots[id]));
            out.put("held",slots[1]).put("sockets",sockets).put("puzzle",new JSONObject()
                .put("firstBridge",data.get(0)==1).put("exitBridge",data.get(1)==1).put("knightLance",data.get(5)==1));
        } else if (room == 306 || room == 320) {
            JSONArray spheres = room == 306 ? attachedSpheres(socket, script, new int[]{8,9,10,11,12},
                new String[]{"Bevelle","Bevelle","Bevelle","Glyph","Destruction"},13) :
                attachedSpheres(socket, script, new int[]{29,30,31},new String[]{"Besaid","Kilika","Destruction"},-1);
            if (spheres == null) return null;
            String carrying = "Empty"; int carried = 0;
            for (int i = 0; i < spheres.length(); i++) if ("held".equals(spheres.getJSONObject(i).getString("owner"))) {
                carried++; carrying = spheres.getJSONObject(i).getString("name");
            }
            if (carried > 1) return null;
            out.put("heldType", carrying).put("attachments", spheres);
        } else if (room == 108) {
            int[][] declarations = new int[12][3];
            for (int i=0;i<12;i++) declarations[i]=new int[]{24+i,0x0c000058+i,1};
            if (!scriptVariables(socket,script,declarations)) return null;
            ByteBuffer values=readBytes(socket,script.data+0x58,12);
            JSONArray sockets=new JSONArray();
            for(int i=0;i<11;i++) { int value=Byte.toUnsignedInt(values.get()); if(value>6||value==5)return null;
                if(i!=3)sockets.put(new JSONObject().put("id",24+i).put("value",value)); }
            int doors=Byte.toUnsignedInt(values.get());
            if(doors!=0&&doors!=1&&doors!=3)return null;
            JSONObject puzzle=new JSONObject().put("doors",doors);
            int pedestal=script.workers+6*0xb58+0x558;
            if(script.workerCount>6&&validRam(pedestal,12)){
                ByteBuffer xyz=readBytes(socket,pedestal,12);
                float x=xyz.getFloat(),y=xyz.getFloat(),z=xyz.getFloat();
                if(Float.isFinite(x)&&Float.isFinite(y)&&Float.isFinite(z))
                    puzzle.put("dropped",Math.abs(x-50.01)<1&&Math.abs(z-205.15)<1&&Math.abs(y-20.01)<2);
            }
            out.put("puzzle",puzzle);
            out.put("sockets",sockets);
        } else {
            int count = room == 122 ? 9 : room == 239 ? 8 : 12;
            int[][] declarations = new int[count][3];
            for (int i = 0; i < count; i++) declarations[i] = new int[]{variable + i + 1,
                (wide ? 0x5c000000 : 0x0c000000) | (offset + (i + 1) * (wide ? 4 : 1)), 1};
            if (scriptVariables(socket, script, declarations)) {
                ByteBuffer values = readBytes(socket, script.data + offset + (wide ? 4 : 1), count * (wide ? 4 : 1));
                JSONArray sockets = new JSONArray();
                for (int i = 0; i < count; i++) {
                    int value = wide ? values.getInt() : Byte.toUnsignedInt(values.get());
                    if (value < 0 || value > maximum) return null;
                    sockets.put(new JSONObject().put("id", variable + i + 1).put("value", value));
                }
                out.put("sockets", sockets);
            }
        }
        if(room==214 && scriptVariables(socket,script,new int[][]{
            {75,0x0c0000d9,1},{76,0x0c0000da,1},{77,0x0c0000db,1},
            {80,0x0c0000de,1},{81,0x0c0000df,1},{82,0x0c0000e0,1},{83,0x0c0000e1,1},{84,0x0c0000e2,1},
            {85,0x0c0000e3,1},{86,0x0c0000e4,1},{87,0x0c0000e5,1}})) {
            ByteBuffer flags=readBytes(socket,script.data+0xd9,13);
            int upper=0;
            for(int i=5;i<=9;i++)if(flags.get(i)==1)upper|=1<<(i-5);
            int stage=Byte.toUnsignedInt(flags.get(10)),glyph=Byte.toUnsignedInt(flags.get(12));
            if(stage<=2&&glyph<=2)out.put("puzzle",new JSONObject().put("pit",flags.get(0)!=0)
                .put("farPedestal",flags.get(1)!=0).put("elevator",flags.get(2)!=0).put("upper",upper)
                .put("stage",stage).put("door",flags.get(11)!=0).put("glyph",glyph));
        }
        if(room==239 && scriptVariables(socket,script,new int[][]{{46,0x0c0000a3,1},{54,0x0c0000c6,1},{56,0x0c0000c8,1},{58,0x0c0000ca,1}})) {
            ByteBuffer flags=readBytes(socket,script.data+0xc6,5);
            int mode=Byte.toUnsignedInt(readBytes(socket,script.data+0xa3,1).get());
            if((mode>=0&&mode<=6)||mode==99)out.put("puzzle",new JSONObject().put("pedestal",mode)
                .put("iceStop",flags.get(0)==1).put("lifted",flags.get(2)==1).put("bridgeSeen",flags.get(4)==1));
        }
        if(room==122 && scriptVariables(socket,script,new int[][]{{48,0x5c0000d8,1},{49,0x5c0000dc,1},{50,0x5c0000e0,1},{51,0x5c0000e4,1},{52,0x5c0000e8,1}})) {
            ByteBuffer flags=readBytes(socket,script.data+0xd8,20); JSONArray phases=new JSONArray();
            for(int i=0;i<5;i++){int flag=flags.getInt();if(flag<0||flag>1)return null;phases.put(flag);}
            out.put("phases",phases);
        }
        return sameFieldScript(socket, p, script, room) ? out : null;
    }

    private static ByteBuffer readBytes(Socket socket, int address, int length) throws IOException {
        ByteBuffer commands = little((length / 8 + 6) * 5);
        readRange(commands, address, length);
        ByteBuffer result = request(socket, java.util.Arrays.copyOf(commands.array(), commands.position()));
        if (result.remaining() != length) throw new IOException("Incomplete PINE read");
        return result;
    }

    // Story voice flags for SLUS-20672. The 525-entry table is loaded once the story system is initialized.
    private static byte[] readX2StoryFlags(Socket socket, int save) throws IOException {
        if (readBytes(socket, save + 0x138, 4).getInt() != 525) return null;
        byte[] flags = new byte[0x2868];
        for (int offset = 0; offset < flags.length; offset += 0x1000) {
            int length = Math.min(0x1000, flags.length - offset);
            readBytes(socket, save + 0x21ec + offset, length).get(flags, offset, length);
        }
        return flags;
    }

    private static JSONArray readX2DressphereAp(Socket socket, int save) throws IOException {
        JSONArray ap = new JSONArray();
        for (int member = 0; member < 3; member++) {
            byte[] data = readBytes(socket, save + 0x8d30 + member * X2_AP_STRIDE, X2_AP_STRIDE).array();
            ap.put(java.util.Base64.getEncoder().encodeToString(data));
        }
        return ap;
    }

    private static JSONArray members(Profile p, ByteBuffer party, ByteBuffer stats, ByteBuffer battle, ByteBuffer gear) throws JSONException {
        JSONArray members = new JSONArray();
        boolean[] seen = new boolean[p.count];
        for (int slot = 0; slot < (battle == null ? 1 : 2) * (p.sequel ? 3 : 20); slot++) {
            int id = Byte.toUnsignedInt(party.get(16 + slot % 20));
            if (id >= seen.length || seen[id]) continue;
            int actor = id * X_ALLY_SIZE;
            boolean active = battle == null ? slot < 3 : battle.get(actor + 3) == 1;
            if (battle != null && active != (slot < 20)) continue;
            int base = id * p.stride;
            int offset = base + 0x1c;
            int hp = stats.getInt(offset), mp = stats.getInt(offset + 4);
            int maxHp = stats.getInt(offset + 8), maxMp = stats.getInt(offset + 12);
            if (battle != null) {
                maxHp = battle.getInt(actor + 6);
                maxMp = battle.getInt(actor + 10);
                hp = battle.getInt(actor + 14);
                mp = battle.getInt(actor + 18);
            }
            if (hp < 0 || mp < 0 || maxHp <= 0 || maxMp < 0 || hp > maxHp || mp > maxMp ||
                    maxHp > 999999 || maxMp > 99999) continue;
            seen[id] = true;
            JSONObject member = new JSONObject().put("id", id).put("active", active)
                .put("hp", hp).put("mp", mp).put("maxHp", maxHp).put("maxMp", maxMp);
            if (p.sequel) {
                member.put("job", Short.toUnsignedInt(stats.getShort(base + 0x36)));
                if (p.stride == 0x80) member.put("level", Byte.toUnsignedInt(stats.get(base + 0x35)));
            } else {
                int overdrive = Byte.toUnsignedInt(stats.get(base + 0x39));
                int overdriveMax = Byte.toUnsignedInt(stats.get(base + 0x3a));
                if (battle != null && active) {
                    overdrive = Byte.toUnsignedInt(battle.get(actor + 38));
                    overdriveMax = Byte.toUnsignedInt(battle.get(actor + 39));
                }
                member.put("sphereLevel", Byte.toUnsignedInt(stats.get(base + 0x3b)))
                    .put("overdrive", overdrive).put("overdriveMax", overdriveMax);
                member.put("fiendsDefeated", Integer.toUnsignedLong(stats.getInt(base + 0x54)))
                    .put("overdriveMode", Byte.toUnsignedInt(stats.get(base + 0x38)))
                    .put("overdriveModes", Integer.toUnsignedLong(stats.getInt(base + 0x88)));
                if (id < 7) {
                    JSONArray remaining = new JSONArray();
                    for (int mode = 0; mode < 17; mode++) {
                        remaining.put(Short.toUnsignedInt(stats.getShort(base + 0x60 + mode * 2)));
                    }
                    member.put("overdriveRemaining", remaining);
                }
                JSONArray attributes = new JSONArray();
                for (int i = 0; i < 8; i++) attributes.put(Byte.toUnsignedInt(stats.get(base + 0x2f + i)));
                member.put("attributes", attributes);
                JSONArray learned = new JSONArray();
                for (int bit = 6; bit < 96; bit++) {
                    if ((stats.get(base + 0x3e + bit / 8) & (1 << (bit % 8))) != 0) learned.put(0x3000 + bit);
                }
                member.put("commands", learned);
                member.put("gear", gearFor(gear, id, stats.get(base + 0x2d), stats.get(base + 0x2e)));
                if (battle != null) {
                    member.put("statusBits", Short.toUnsignedInt(battle.getShort(actor + 22)))
                        .put("statusTimed", xTimedEffects(battle, actor + 24));
                    appendXBattleStats(member, battle, actor + 40);
                }
            }
            members.put(member);
        }
        return members;
    }

    private static JSONArray gearFor(ByteBuffer gear, int id, byte weapon, byte armor) throws JSONException {
        JSONArray result = new JSONArray();
        for (int i = 0; i < 200; i++) {
            int record = i * 22;
            if (gear.get(record + 2) != 1 || (gear.get(record + 3) & 2) != 0 || gear.get(record + 4) != id) continue;
            int type = gear.get(record + 5) & 1;
            JSONArray abilities = new JSONArray();
            int slots = Math.min(4, Byte.toUnsignedInt(gear.get(record + 11)));
            for (int j = 0; j < slots; j++) {
                int ability = Short.toUnsignedInt(gear.getShort(record + 14 + j * 2));
                abilities.put(ability == 255 || ability == 65535 ? JSONObject.NULL : ability);
            }
            result.put(new JSONObject().put("name", Short.toUnsignedInt(gear.getShort(record))).put("type", type)
                .put("damageFormula", Byte.toUnsignedInt(gear.get(record + 8)))
                .put("power", Byte.toUnsignedInt(gear.get(record + 9)))
                .put("criticalBonus", Byte.toUnsignedInt(gear.get(record + 10)))
                .put("equipped", i == Byte.toUnsignedInt(type == 0 ? weapon : armor))
                .put("celestial", (gear.get(record + 3) & 4) != 0).put("abilities", abilities));
        }
        return result;
    }

    private static ByteBuffer take(ByteBuffer source, int length) {
        byte[] bytes = new byte[length];
        source.get(bytes);
        return ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
    }

    private static JSONObject readChallenges(ByteBuffer memory) throws JSONException {
        JSONObject lightning = new JSONObject().put("bolts", Short.toUnsignedInt(memory.getShort()))
            .put("dodges", Short.toUnsignedInt(memory.getShort()))
            .put("best", Short.toUnsignedInt(memory.getShort()));
        boolean trainerRecord = (memory.get() & 0x10) != 0;
        int training = Byte.toUnsignedInt(memory.get()) & 0x3a;
        int minutes = Byte.toUnsignedInt(memory.get());
        int seconds = Byte.toUnsignedInt(memory.get());
        int tenths = Byte.toUnsignedInt(memory.get());
        JSONObject result = new JSONObject().put("lightning", lightning).put("training", training)
            .put("cactuarStage", Byte.toUnsignedInt(memory.get()))
            .put("cactuarWins", Byte.toUnsignedInt(memory.get()));
        if ((trainerRecord || (training & 0x20) != 0) && minutes < 60 && seconds < 60 && tenths < 10) {
            result.put("catcherBest", 600 * minutes + 10 * seconds + tenths);
        }
        return result;
    }

    private static JSONObject readBlitzball(ByteBuffer memory, int limits) throws JSONException {
        JSONArray league = new JSONArray();
        JSONArray tournament = new JSONArray();
        for (int i = 0; i < 3; i++) league.put(Short.toUnsignedInt(memory.getShort()));
        for (int i = 0; i < 3; i++) tournament.put(Short.toUnsignedInt(memory.getShort()));
        ByteBuffer levels = take(memory, X_BLITZ_PLAYER_COUNT);
        ByteBuffer rosters = take(memory, X_BLITZ_ROSTER_BYTES);
        ByteBuffer contracts = take(memory, X_BLITZ_PLAYER_COUNT);
        ByteBuffer known = take(memory, 60 * 8);
        ByteBuffer equipped = take(memory, 60 * 5);
        JSONObject result = new JSONObject().put("reels", (limits >>> 21) & 7)
            .put("league", league).put("tournament", tournament);
        int[] teams = new int[X_BLITZ_PLAYER_COUNT];
        java.util.Arrays.fill(teams, -1);
        for (int slot = 0; slot < X_BLITZ_ROSTER_BYTES; slot++) {
            int id = Byte.toUnsignedInt(rosters.get(slot));
            if (id == X_BLITZ_PLAYER_COUNT || id == 255) continue; // Empty position.
            if (id > X_BLITZ_PLAYER_COUNT || teams[id] != -1) return result;
            teams[id] = slot / 8;
        }
        if (teams[0] != 5) return result; // The Aurochs always include Tidus after initialization.
        JSONArray players = new JSONArray();
        JSONArray techniques = new JSONArray();
        for (int id = 0; id < X_BLITZ_PLAYER_COUNT; id++) {
            int level = Byte.toUnsignedInt(levels.get(id));
            if (level < 1 || level > 99) return result;
            players.put(new JSONArray().put(teams[id]).put(level).put(Byte.toUnsignedInt(contracts.get(id))));
            JSONArray slots = new JSONArray();
            for (int slot = 0; slot < 5; slot++) {
                int technique = Byte.toUnsignedInt(equipped.get(id * 5 + slot));
                if (technique >= 1 && technique <= 60) slots.put(technique);
            }
            techniques.put(new JSONArray().put(known.getInt(id * 4)).put(known.getInt(240 + id * 4)).put(slots));
        }
        return result.put("players", players).put("techniques", techniques);
    }

    private static String hex(byte[] bytes) {
        char[] result = new char[bytes.length * 2];
        String digits = "0123456789abcdef";
        for (int i = 0; i < bytes.length; i++) {
            int value = Byte.toUnsignedInt(bytes[i]);
            result[i * 2] = digits.charAt(value >>> 4);
            result[i * 2 + 1] = digits.charAt(value & 15);
        }
        return new String(result);
    }

    private static JSONObject frame(String status) throws JSONException {
        return new JSONObject().put("schema", 1).put("timestamp", System.currentTimeMillis()).put("status", status);
    }

    private static ByteBuffer little(int size) {
        return ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN);
    }

    private static void readRange(ByteBuffer commands, int address, int size) {
        while (size > 0) {
            int width = Math.min(Integer.highestOneBit(size), 8);
            width = Math.min(width, Integer.lowestOneBit(address));
            commands.put((byte) Integer.numberOfTrailingZeros(width)).putInt(address);
            address += width;
            size -= width;
        }
    }

    private static String string(ByteBuffer reply) throws IOException {
        if (reply.remaining() < 4) throw new IOException("Missing PINE identity");
        int length = reply.getInt();
        if (length < 1 || length > 128 || length > reply.remaining()) throw new IOException("Invalid PINE identity");
        byte[] data = new byte[length];
        reply.get(data);
        if (data[length - 1] != 0) throw new IOException("Unterminated PINE identity");
        return new String(data, 0, length - 1, StandardCharsets.US_ASCII);
    }

    private static ByteBuffer request(Socket socket, byte[] commands) throws IOException {
        ByteBuffer packet = little(commands.length + 4);
        packet.putInt(packet.capacity()).put(commands);
        socket.getOutputStream().write(packet.array());
        DataInputStream input = new DataInputStream(socket.getInputStream());
        int length = Integer.reverseBytes(input.readInt());
        if (length < 5 || length > 16384 || input.readUnsignedByte() != 0) {
            throw new IOException("ARMSX2 did not accept the PINE request");
        }
        byte[] payload = new byte[length - 5];
        input.readFully(payload);
        return ByteBuffer.wrap(payload).order(ByteOrder.LITTLE_ENDIAN);
    }
}
