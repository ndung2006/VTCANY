<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-neutral-400">Tổng: {{ meta.total }} videos</p>
      <Button v-if="can('video:create')" label="Thêm video" icon="pi pi-plus" @click="openAdd" />
    </div>

    <div class="surface-card p-4">
      <DataTable :value="videos" :loading="loading" paginator :rows="20" :total-records="meta.total"
        lazy :first="(meta.page - 1) * meta.limit" @page="onPage" size="small">
        <Column field="id" header="ID" class="text-xs" />
        <Column field="title" header="Tiêu đề" />
        <Column field="channel" header="Kênh" />
        <Column header="Trạng thái">
          <template #body="{ data }"><Tag :value="data.status" :severity="sev(data.status)" /></template>
        </Column>
        <Column field="createdAt" header="Ngày tạo">
          <template #body="{ data }">{{ fmtDate(data.createdAt) }}</template>
        </Column>
        <Column header="Thao tác" style="min-width: 16rem">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-1">
              <Button label="Play URL" size="small" text @click="showPlay(data)" />
              <Button v-if="can('video:update')" label="Sửa" size="small" text @click="openEdit(data)" />
              <Button v-if="data.status === 'draft' && can('video:submit')" label="Gửi duyệt" size="small" severity="warn" text @click="act(data, 'submit')" />
              <template v-if="data.status === 'pending' && can('video:publish')">
                <Button label="Xuất bản" size="small" severity="success" text @click="act(data, 'publish')" />
                <Button label="Từ chối" size="small" severity="danger" text @click="act(data, 'reject')" />
              </template>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dlg" modal :header="editing ? 'Sửa video' : 'Thêm video'" class="w-full max-w-lg">
      <div class="flex flex-col gap-3">
        <div><label class="field-label">Tiêu đề</label><InputText v-model="form.title" class="w-full" /></div>
        <div><label class="field-label">Kênh</label><InputText v-model="form.channel" class="w-full" placeholder="vd: VTC1" /></div>
        <div v-if="!editing">
          <label class="field-label">Upload file nguồn</label>
          <MediaUploader @uploaded="(vid) => { createdVideoId = vid; }" />
        </div>
      </div>
      <template #footer>
        <Button label="Hủy" text @click="dlg = false" />
        <Button :label="editing ? 'Lưu' : 'Tạo'" :loading="saving" @click="save" :disabled="!form.title.trim()" />
      </template>
    </Dialog>

    <Dialog v-model:visible="playDlg" modal header="Play URL" class="w-full max-w-lg">
      <pre v-if="playInfo" class="overflow-auto rounded bg-black/40 p-3 text-xs">{{ JSON.stringify(playInfo, null, 2) }}</pre>
      <Message v-else-if="playError" severity="warn">{{ playError }}</Message>
    </Dialog>
    <Toast />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useHead({ title: 'Videos - VTC ANY CMS' });

const api = useApi();
const toast = useToast();
const { can } = useCmsAuth();
const videos = ref<any[]>([]);
const meta = ref({ page: 1, limit: 20, total: 0 });
const loading = ref(true);
const dlg = ref(false);
const editing = ref<any>(null);
const saving = ref(false);
const form = ref({ title: '', channel: '' });
const createdVideoId = ref('');
const playDlg = ref(false);
const playInfo = ref<any>(null);
const playError = ref('');

function sev(s: string) {
  return { draft: 'secondary', pending: 'warn', published: 'success', rejected: 'danger' }[s] || 'info';
}
function fmtDate(v: any) {
  if (!v) return '';
  return new Date(typeof v === 'number' ? v : String(v)).toLocaleString('vi-VN');
}
async function load() {
  loading.value = true;
  try {
    const r = await api.get<any>('/videos', { page: meta.value.page, limit: meta.value.limit });
    videos.value = r.data || [];
    meta.value = { ...meta.value, ...r.meta };
  } catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được danh sách videos', life: 3000 }); }
  finally { loading.value = false; }
}
function onPage(e: any) { meta.value.page = e.page + 1; load(); }
function openAdd() { editing.value = null; form.value = { title: '', channel: '' }; createdVideoId.value = ''; dlg.value = true; }
function openEdit(v: any) { editing.value = v; form.value = { title: v.title || '', channel: v.channel || '' }; dlg.value = true; }
async function save() {
  saving.value = true;
  try {
    if (editing.value) await api.patch(`/videos/${editing.value.id}`, { title: form.value.title, channel: form.value.channel || undefined });
    else await api.post('/videos', { title: form.value.title, channel: form.value.channel || undefined });
    toast.add({ severity: 'success', summary: 'Xong', detail: 'Đã lưu video', life: 3000 });
    dlg.value = false;
    load();
  } catch (e: any) { toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.error?.message || 'Lưu thất bại', life: 3000 }); }
  finally { saving.value = false; }
}
async function act(v: any, action: string) {
  try {
    const r = await api.post(`/videos/${v.id}/${action}`);
    Object.assign(v, r);
    toast.add({ severity: 'success', summary: 'Xong', detail: `Đã ${action} video`, life: 3000 });
  } catch (e: any) { toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.error?.message || 'Thao tác thất bại', life: 3000 }); }
}
async function showPlay(v: any) {
  playDlg.value = true; playInfo.value = null; playError.value = '';
  try { playInfo.value = await api.get(`/videos/${v.id}/play`); }
  catch { playError.value = 'Video chưa có bản HLS (upload/transcode chưa xong).'; }
}
onMounted(load);
</script>
