package app.bdstarter

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.content.edit
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The signed-in customer's session token, encrypted with a key that never
 * leaves the Android Keystore. Unlike the cart's visitor id, the token IS a
 * secret: it reads the customer's portal.
 *
 * The display name sits beside it in the clear, to show while offline.
 */
class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("bd-session", Context.MODE_PRIVATE)

    val token: String? get() = prefs.getString(TOKEN, null)?.let { runCatching { decrypt(it) }.getOrNull() }
    val name: String get() = prefs.getString(NAME, null).orEmpty()

    fun save(token: String, name: String) = prefs.edit { putString(TOKEN, encrypt(token)).putString(NAME, name) }

    fun saveName(name: String) = prefs.edit { putString(NAME, name) }

    fun clear() = prefs.edit { remove(TOKEN).remove(NAME) }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).apply {
            init(
                KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build(),
            )
        }.generateKey()
    }

    private fun encrypt(text: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key()) }
        return Base64.encodeToString(cipher.iv + cipher.doFinal(text.toByteArray()), Base64.NO_WRAP)
    }

    private fun decrypt(stored: String): String {
        val bytes = Base64.decode(stored, Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, IV_BYTES))
        }
        return String(cipher.doFinal(bytes, IV_BYTES, bytes.size - IV_BYTES))
    }

    private companion object {
        const val KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "bd-session"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
        const val TOKEN = "token"
        const val NAME = "name"
    }
}
