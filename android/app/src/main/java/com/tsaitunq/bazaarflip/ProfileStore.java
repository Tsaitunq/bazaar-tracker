package com.tsaitunq.bazaarflip;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * The player's Hypixel API key and synced profile. Both live in the no-backup directory, which Android leaves out of
 * its backups although the app allows them; the key is also encrypted with a key that only the Keystore holds.
 * Nothing here logs, and no exception message leaves this class with data in it.
 */
final class ProfileStore {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String ALIAS = "hypixel_key";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final String KEY_FILE = "hypixel.key";
    private static final String PROFILE_FILE = "profile.json";
    private static final String FIXTURE_FILE = "profile-fixture.json";

    private ProfileStore() {}

    private static File file(Context context, String name) {
        return new File(context.getNoBackupFilesDir(), name);
    }

    // A crash while writing must not leave half a file: the old one stays until the new one is complete.
    private static void write(File target, byte[] data) throws IOException {
        File tmp = new File(target.getPath() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(data);
        }
        if (!tmp.renameTo(target)) {
            tmp.delete();
            throw new IOException("could not store the file");
        }
    }

    private static SecretKey secret(boolean create) throws GeneralSecurityException, IOException {
        KeyStore store = KeyStore.getInstance(KEYSTORE);
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        if (!create) return null;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return generator.generateKey();
    }

    static void setKey(Context context, String key) throws GeneralSecurityException, IOException {
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, secret(true));
        byte[] body = cipher.doFinal(key.getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        byte[] all = Arrays.copyOf(iv, iv.length + body.length);
        System.arraycopy(body, 0, all, iv.length, body.length);
        write(file(context, KEY_FILE), all);
    }

    /** Null without a key. A key that cannot be read any more, for example after a restore, counts as none and is removed. */
    static String getKey(Context context) {
        File file = file(context, KEY_FILE);
        if (!file.exists()) return null;
        try {
            byte[] all = Files.readAllBytes(file.toPath());
            SecretKey secret = secret(false);
            if (secret == null || all.length <= IV_BYTES) throw new GeneralSecurityException();
            Cipher cipher = Cipher.getInstance(CIPHER);
            cipher.init(Cipher.DECRYPT_MODE, secret, new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            return new String(cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IOException | RuntimeException e) {
            file.delete();
            return null;
        }
    }

    static void clearKey(Context context) {
        file(context, KEY_FILE).delete();
    }

    static void saveProfile(Context context, String json) throws IOException {
        write(file(context, PROFILE_FILE), json.getBytes(StandardCharsets.UTF_8));
    }

    /** Null without a stored profile. */
    static String loadProfile(Context context) {
        try {
            File file = file(context, PROFILE_FILE);
            return file.exists() ? new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8) : null;
        } catch (IOException e) {
            return null;
        }
    }

    static void clearProfile(Context context) {
        file(context, PROFILE_FILE).delete();
        new File(context.getCacheDir(), FIXTURE_FILE).delete();
    }

    // shortcut: temporary for field check, removed in Task 6. The cache directory is what the app's FileProvider can share.
    static File saveFixture(Context context, String json) throws IOException {
        File target = new File(context.getCacheDir(), FIXTURE_FILE);
        write(target, json.getBytes(StandardCharsets.UTF_8));
        return target;
    }
}
