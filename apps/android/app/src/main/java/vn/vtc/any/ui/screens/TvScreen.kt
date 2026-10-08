package vn.vtc.any.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import vn.vtc.any.VtcAnyApp
import vn.vtc.any.data.api.ApiClient
import vn.vtc.any.data.api.Channel
import vn.vtc.any.data.api.ChannelGroup
import vn.vtc.any.data.api.EpgResponse
import vn.vtc.any.data.api.TimelineItem
import vn.vtc.any.ui.components.ChannelLogo
import vn.vtc.any.ui.components.ErrorBox
import vn.vtc.any.ui.components.LoadingBox
import vn.vtc.any.playback.RadioPlayer
import vn.vtc.any.ui.player.VideoPlayer

/** Trước khi link hết hạn 30 phút thì xin link mới (giống web: 210/240 phút). */
private const val REFRESH_BEFORE_MS = 30 * 60 * 1000L

@Composable
fun TvScreen(initialChannelId: String? = null) {
    val context = LocalContext.current
    val app = context.applicationContext as VtcAnyApp

    var groups by remember { mutableStateOf<List<ChannelGroup>>(emptyList()) }
    var groupsError by remember { mutableStateOf<String?>(null) }
    var selected by remember { mutableStateOf<Channel?>(null) }
    var epg by remember { mutableStateOf<EpgResponse?>(null) }
    var epgLoading by remember { mutableStateOf(false) }
    var epgError by remember { mutableStateOf<String?>(null) }
    var date by remember { mutableStateOf<String?>(null) }
    var retryKey by remember { mutableStateOf(0) }

    // Tải danh sách kênh 1 lần.
    LaunchedEffect(Unit) {
        runCatching { app.api.channels().groups.filter { it.channels.isNotEmpty() } }
            .onSuccess { groups = it }
            .onFailure { groupsError = ApiClient.errorMessage(it) }
    }

    // Chọn kênh mặc định: kênh được chỉ định, hoặc kênh đầu tiên.
    LaunchedEffect(groups, initialChannelId) {
        if (selected != null || groups.isEmpty()) return@LaunchedEffect
        selected = initialChannelId
            ?.let { id -> groups.flatMap { it.channels }.find { it.publicId == id } }
            ?: groups.first().channels.first()
    }

    // Tải EPG + link phát mỗi khi đổi kênh / ngày / retry.
    LaunchedEffect(selected?.publicId, date, retryKey) {
        val ch = selected ?: return@LaunchedEffect
        epgLoading = true
        epgError = null
        runCatching { app.api.epg(ch.publicId, date) }
            .onSuccess { epg = it; epgLoading = false }
            .onFailure { epgError = ApiClient.errorMessage(it); epgLoading = false }
    }

    // Tự xin lại link trước khi hết hạn (chỉ khi vẫn đang xem đúng kênh).
    val hlsUrl = epg?.channel?.hlsUrl
    val hlsExp = epg?.channel?.hlsExp
    val channelId = selected?.publicId
    LaunchedEffect(channelId, hlsExp) {
        val exp = hlsExp ?: return@LaunchedEffect
        val waitMs = exp - System.currentTimeMillis() - REFRESH_BEFORE_MS
        if (waitMs > 0) delay(waitMs)
        // Hết hạn (hoặc sắp hết): xin lại EPG, chỉ remount khi có link mới.
        val currentId = channelId ?: return@LaunchedEffect
        runCatching { app.api.epg(currentId, date) }
            .onSuccess { fresh ->
                if (selected?.publicId == currentId &&
                    !fresh.channel.hlsUrl.isNullOrBlank() &&
                    fresh.channel.hlsUrl != epg?.channel?.hlsUrl
                ) {
                    epg = fresh
                }
            }
    }

    Column(Modifier.fillMaxSize()) {
        // ---- Player ----
        Box(
            Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black),
            contentAlignment = Alignment.Center,
        ) {
            when {
                epgLoading && hlsUrl == null -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Color.White)
                        Spacer(Modifier.height(8.dp))
                        Text("Đang tải luồng phát...", color = Color.White.copy(alpha = 0.8f))
                    }
                }
                !hlsUrl.isNullOrBlank() -> {
                    val ch = selected
                    if (ch != null && ch.audioOnly) {
                        // Kênh phát thanh: phát nền qua service, hiện khung điều khiển gọn.
                        RadioPlayer(
                            url = hlsUrl!!,
                            channelName = ch.name,
                            channelLogo = ch.logo,
                            modifier = Modifier.fillMaxSize().padding(16.dp),
                        )
                    } else {
                        VideoPlayer(url = hlsUrl!!, modifier = Modifier.fillMaxSize())
                    }
                }
                !epgLoading -> {
                    Text(
                        "Kênh chưa có luồng phát.",
                        color = Color.White.copy(alpha = 0.7f),
                    )
                }
            }
            if (epgError != null && hlsUrl == null && !epgLoading) {
                ErrorBox(epgError!!, onRetry = { retryKey++ })
            }
        }

        // ---- Tên kênh đang xem ----
        selected?.let { ch ->
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ChannelLogo(
                    logoUrl = ch.logo,
                    name = ch.name,
                    modifier = Modifier.size(40.dp),
                )
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(ch.name, style = MaterialTheme.typography.titleMedium)
                    val liveTitle = epg?.timeline?.find { it.status == "LIVE" }?.title
                    if (liveTitle != null) {
                        Text(
                            "Đang phát: $liveTitle",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                if (ch.audioOnly) {
                    Text(
                        "Phát thanh",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.secondary,
                    )
                }
            }
        }

        // ---- Danh sách kênh ----
        val allChannels = remember(groups) { groups.flatMap { it.channels } }
        if (groupsError != null && allChannels.isEmpty()) {
            Text(
                groupsError!!,
                modifier = Modifier.padding(16.dp),
                color = MaterialTheme.colorScheme.error,
            )
        } else {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(allChannels, key = { it.publicId }) { ch ->
                    val isSel = ch.publicId == selected?.publicId
                    FilterChip(
                        selected = isSel,
                        onClick = {
                            if (!isSel) {
                                selected = ch
                                date = null
                            }
                        },
                        label = { Text(ch.name, maxLines = 1) },
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // ---- Lịch phát sóng ----
        EpgTimeline(
            epg = epg,
            loading = epgLoading,
            selectedDate = date,
            onDateSelect = { date = it },
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun EpgTimeline(
    epg: EpgResponse?,
    loading: Boolean,
    selectedDate: String?,
    onDateSelect: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth()) {
        // Tab ngày
        val dates = epg?.epgDates.orEmpty()
        if (dates.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(dates) { d ->
                    FilterChip(
                        selected = selectedDate == d,
                        onClick = { onDateSelect(if (selectedDate == d) null else d) },
                        label = { Text(formatEpgDate(d)) },
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
        }

        val timeline = epg?.timeline.orEmpty()
        when {
            loading && timeline.isEmpty() -> LoadingBox(Modifier.weight(1f))
            timeline.isEmpty() -> {
                Text(
                    "Chưa có lịch phát sóng.",
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            else -> {
                val listState = rememberLazyListState()
                // Tự cuộn để mục LIVE nằm sau ~3 mục đã phát (giống web).
                LaunchedEffect(timeline) {
                    val liveIdx = timeline.indexOfFirst { it.status == "LIVE" }
                    if (liveIdx > 3) listState.scrollToItem(liveIdx - 3)
                }
                LazyColumn(
                    state = listState,
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    items(timeline) { item ->
                        EpgRow(item)
                    }
                }
            }
        }
    }
}

@Composable
private fun EpgRow(item: TimelineItem) {
    val isLive = item.status == "LIVE"
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(
                if (isLive) MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)
                else Color.Transparent,
            )
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            item.time,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isLive) FontWeight.Bold else FontWeight.Normal,
            color = if (isLive) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(56.dp),
        )
        Text(
            item.title,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isLive) FontWeight.Bold else FontWeight.Normal,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (isLive) {
            Text(
                "LIVE",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(MaterialTheme.colorScheme.error)
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
    }
}

private fun formatEpgDate(iso: String): String {
    // "2026-10-08" -> "08/10"
    val p = iso.split("-")
    return if (p.size == 3) "${p[2]}/${p[1]}" else iso
}
