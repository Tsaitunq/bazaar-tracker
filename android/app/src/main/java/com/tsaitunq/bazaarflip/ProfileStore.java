package com.tsaitunq.bazaarflip;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.AEADBadTagException;
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

    private ProfileStore() {}

    private static File file(Context context, String name) {
        return new File(context.getNoBackupFilesDir(), name);
    }

    // A crash while writing must not leave half a file: the old one stays until the new one is complete.
    private static void write(File target, byte[] data) throws IOException {
        File tmp = temp(target);
        try {
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(data);
            }
            if (!tmp.renameTo(target)) throw new IOException("could not store the file");
        } finally {
            tmp.delete();
        }
    }

    private static File temp(File target) {
        return new File(target.getPath() + ".tmp");
    }

    /** What a process killed while writing left behind; profile.json.tmp is plain text. */
    static void removeTemp(Context context) {
        temp(file(context, KEY_FILE)).delete();
        temp(file(context, PROFILE_FILE)).delete();
    }

    private static void remove(File target) throws IOException {
        for (File f : new File[] { target, temp(target) }) {
            if (f.exists() && !f.delete()) throw new IOException("could not remove the file");
        }
    }

    // java.nio.file only exists from API 26; minSdk is 24.
    private static byte[] read(File file) throws IOException {
        try (FileInputStream in = new FileInputStream(file)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            for (int n = in.read(chunk); n != -1; n = in.read(chunk)) out.write(chunk, 0, n);
            return out.toByteArray();
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

    /**
     * Null without a key. A key that can never be read again (Keystore key gone or invalidated, bad tag, broken file)
     * counts as none and is removed. Any other error may pass, so it is thrown and the file stays.
     */
    static String getKey(Context context) throws GeneralSecurityException, IOException {
        File file = file(context, KEY_FILE);
        if (!file.exists()) return null;
        byte[] all = read(file);
        SecretKey secret = secret(false);
        if (secret == null || all.length <= IV_BYTES) {
            file.delete();
            return null;
        }
        try {
            Cipher cipher = Cipher.getInstance(CIPHER);
            cipher.init(Cipher.DECRYPT_MODE, secret, new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            return new String(cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (AEADBadTagException | KeyPermanentlyInvalidatedException e) {
            file.delete();
            return null;
        }
    }

    static void clearKey(Context context) throws IOException {
        remove(file(context, KEY_FILE));
    }

    static void saveProfile(Context context, String json) throws IOException {
        write(file(context, PROFILE_FILE), json.getBytes(StandardCharsets.UTF_8));
    }

    /** Null without a stored profile. */
    static String loadProfile(Context context) {
        try {
            File file = file(context, PROFILE_FILE);
            return file.exists() ? new String(read(file), StandardCharsets.UTF_8) : null;
        } catch (IOException e) {
            return null;
        }
    }

    static void clearProfile(Context context) throws IOException {
        remove(file(context, PROFILE_FILE));
    }
}
