package com.spiracompanion.thor;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

final class TargetSlotsTest {
    public static void main(String[] args) throws Exception {
        ByteBuffer menu = ByteBuffer.allocate(0x68).order(ByteOrder.LITTLE_ENDIAN);
        menu.putInt(0x64, 1).putShort(0x2c, (short) 3);
        // Preserve the in-game list order when translating cursor bits to actor slots.
        menu.put(0x1a, (byte) 16).put(0x1b, (byte) 17).put(0x1c, (byte) 18);
        menu.putShort(0x30, (short) 1).putShort(2, (short) 2);
        expect(menu, 1 << 17, "single enemy");
        menu.putShort(2, (short) 7);
        expect(menu, (1 << 16) | (1 << 17) | (1 << 18), "all enemies");
        menu.putShort(2, (short) 8);
        expect(menu, 0, "bit outside target list");
        menu.putShort(2, (short) 2).put(0x1b, (byte) 0xff);
        expect(menu, 0, "invalid actor slot");
        menu.put(0x1b, (byte) 17).putInt(0x64, 0);
        expect(menu, 0, "cancelled targeting");

        menu.putInt(0x64, 2).put(0x0a, (byte) 1).put(0x0b, (byte) 2).putShort(0x2a, (short) 2);
        menu.putShort(0x2e, (short) 1).putShort(0, (short) 4);
        expect(menu, 1 << 2, "party member chosen through Potion");
        menu.putShort(0, (short) 6);
        expect(menu, (1 << 1) | (1 << 2), "party group");

        if (args.length == 8) {
            int[] captured = {1 << 16, 1 << 17, 1 << 18, 1 << 17, 0, 1 << 1, 1 << 2, 0};
            for (int i = 0; i < captured.length; i++) {
                byte[] ram = Files.readAllBytes(Path.of(args[i]));
                int offset = 0x53d140 - (i < 5 ? 0x350000 : 0x53d100);
                ByteBuffer snapshot = ByteBuffer.wrap(Arrays.copyOfRange(ram, offset, offset + 0x68))
                    .order(ByteOrder.LITTLE_ENDIAN);
                expect(snapshot, captured[i], "captured Luca target " + i);
            }
        }
    }

    private static void expect(ByteBuffer menu, int expected, String description) {
        int actual = Ps2Feed.decodeX2TargetSlots(menu);
        if (actual != expected) {
            throw new AssertionError(description + ": expected " + expected + ", got " + actual);
        }
    }
}
