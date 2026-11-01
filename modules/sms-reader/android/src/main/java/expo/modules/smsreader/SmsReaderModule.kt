package expo.modules.smsreader

import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    // Returns inbox messages received after `sinceMs`, newest first, capped at `limit`.
    AsyncFunction("readInbox") { sinceMs: Double, limit: Int ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_NO_CONTEXT", "React context is not available", null)

      val messages = mutableListOf<Map<String, Any?>>()
      val cursor = context.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf("_id", "address", "body", "date"),
        "date > ?",
        arrayOf(sinceMs.toLong().toString()),
        "date DESC"
      ) ?: return@AsyncFunction messages

      cursor.use {
        val idIdx = it.getColumnIndexOrThrow("_id")
        val addressIdx = it.getColumnIndexOrThrow("address")
        val bodyIdx = it.getColumnIndexOrThrow("body")
        val dateIdx = it.getColumnIndexOrThrow("date")
        while (it.moveToNext() && messages.size < limit) {
          messages.add(
            mapOf(
              "id" to it.getString(idIdx),
              "address" to it.getString(addressIdx),
              "body" to it.getString(bodyIdx),
              "date" to it.getLong(dateIdx).toDouble()
            )
          )
        }
      }
      messages
    }
  }
}
