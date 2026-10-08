package vn.vtc.any.playback

import android.content.ComponentName
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import vn.vtc.any.ui.components.ChannelLogo

/** Kết nối tới VtcRadioService qua MediaController. */
@Composable
fun rememberRadioController(): MediaController? {
    val context = LocalContext.current
    var controller by remember { mutableStateOf<MediaController?>(null) }

    DisposableEffect(Unit) {
        val token = SessionToken(context, ComponentName(context, VtcRadioService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener(
            { runCatching { controller = future.get() } },
            ContextCompat.getMainExecutor(context),
        )
        onDispose {
            runCatching { controller?.release() }
            MediaController.releaseFuture(future)
            controller = null
        }
    }
    return controller
}

/**
 * Khung phát radio gọn: logo kênh + tên + nút play/pause.
 * Phát qua VtcRadioService nên thoát app vẫn nghe được.
 */
@Composable
fun RadioPlayer(
    url: String,
    channelName: String,
    channelLogo: String?,
    modifier: Modifier = Modifier,
) {
    val controller = rememberRadioController()
    var isPlaying by remember { mutableStateOf(false) }

    // Đổi kênh/URL -> set media mới cho service.
    androidx.compose.runtime.LaunchedEffect(controller, url) {
        val c = controller ?: return@LaunchedEffect
        if (url.isNotBlank() && c.currentMediaItem?.localConfiguration?.uri.toString() != url) {
            val item = MediaItem.Builder()
                .setUri(url)
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(channelName)
                        .setArtist("VTC ANY Radio")
                        .build(),
                )
                .build()
            c.setMediaItem(item)
            c.prepare()
            c.play()
        }
    }

    // Theo dõi trạng thái play/pause.
    DisposableEffect(controller) {
        val c = controller ?: return@DisposableEffect onDispose {}
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }
        }
        c.addListener(listener)
        isPlaying = c.isPlaying
        onDispose { c.removeListener(listener) }
    }

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ChannelLogo(
            logoUrl = channelLogo,
            name = channelName,
            modifier = Modifier.size(56.dp),
        )
        Text(
            text = channelName,
            style = MaterialTheme.typography.titleMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        IconButton(
            onClick = {
                val c = controller ?: return@IconButton
                if (c.isPlaying) c.pause() else c.play()
            },
            modifier = Modifier.size(56.dp),
        ) {
            Icon(
                imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                contentDescription = if (isPlaying) "Tạm dừng" else "Phát",
                modifier = Modifier.size(36.dp),
            )
        }
    }
}
