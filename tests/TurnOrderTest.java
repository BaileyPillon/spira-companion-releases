package com.spiracompanion.thor;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

final class TurnOrderTest {
    public static void main(String[] args) throws Exception {
        // Moving through a command menu reorders the pointers to the same entries.
        int[] expected = {6, 2, 20, 21, 6, 5, 20, 6, 2, 21, 5, 20, 6, 2, 20, 21};
        ByteBuffer ctb = ByteBuffer.allocate(896).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < expected.length; i++) {
            int index = (i + 12) % 32;
            ctb.putInt(i * 4, 0x68fe30 + 24 * index);
            int offset = 128 + 24 * index;
            ctb.put(offset, (byte) 1).put(offset + 1, (byte) expected[i]);
        }
        expect(ctb, expected);
        int first = ctb.getInt(0);
        ctb.putInt(0, ctb.getInt(4));
        expect(ctb, null);
        ctb.putInt(0, first + 1);
        expect(ctb, null);
        ctb.putInt(0, first).put(128 + 24 * 12 + 1, (byte) 255);
        expect(ctb, null);
        expect(ByteBuffer.allocate(128), null);

        if (args.length == 2) {
            expect(read(args[0]), expected);
            expect(read(args[1]), new int[] {2, 20, 21, 6, 5, 2, 20, 6, 21, 5, 20, 6, 2, 20, 21, 6});
        }
    }

    private static ByteBuffer read(String path) throws Exception {
        return ByteBuffer.wrap(Files.readAllBytes(Path.of(path))).order(ByteOrder.LITTLE_ENDIAN);
    }

    private static void expect(ByteBuffer ctb, int[] expected) {
        int[] actual = Ps2Feed.decodeXTurnOrder(ctb);
        if (!Arrays.equals(expected, actual)) {
            throw new AssertionError("Expected " + Arrays.toString(expected) + ", got " + Arrays.toString(actual));
        }
    }
}
