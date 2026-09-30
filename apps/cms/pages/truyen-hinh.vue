<template>
  <div class="grid gap-6 xl:grid-cols-[20rem_1fr]">
    <div class="surface-card p-4">
      <h2 class="mb-3 font-semibold">Kênh</h2>
      <div v-for="g in groups" :key="g.name" class="mb-3">
        <p class="mb-1 text-xs font-semibold uppercase text-neutral-500">{{ g.name }}</p>
        <button v-for="ch in g.channels" :key="ch.id || ch.slug" @click="select(ch)"
          class="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
          :class="selected?.id === ch.id || selected?.slug === ch.slug ? 'bg-white/15 font-semibold' : ''">
          <img v-if="ch.logo" :src="ch.logo" class="h-6 w-6 rounded bg-white object-contain" alt="" />
          <span class="truncate">{{ ch.name }}</span>
        </button>
      </div>
    </div>

    <div class="surface-card p-5">
      <div v-if="!selected" class="py-16 text-center text-neutral-500">Chọn một kênh để sửa lịch phát sóng.</div>
      <div v-else class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="font-semibold">{{ selected.name }}</h2>
          <Calendar v-model="date" date-format="yy-mm-dd" show-icon @date-select="loadEpg" class="w-40" />
          <span class="text-xs text-neutral-500">Nguồn: {{ source }}</span>
          <div class="flex-1" />
          <Button label="Tải file mẫu" icon="pi pi-download" size="small" outlined @click="downloadTemplate" />
          <Button v-if="can('catalog:write')" label="Nhập Excel" icon="pi pi-upload" size="small" severity="info" @click="impDlg = true" />
          <Button label="Lưu lịch" icon="pi pi-save" :loading="saving" @click="save" />
        </div>

        <DataTable :value="timeline" size="small" :loading="loading">
          <Column field="time" header="Giờ" style="width:7rem" />
          <Column field="title" header="Chương trình" />
          <Column header="Trạng thái" style="width:9rem">
            <template #body="{ data }"><Tag :value="data.status" :severity="epgSev(data.status)" /></template>
          </Column>
          <Column header="" style="width:7rem">
            <template #body="{ index }">
              <Button icon="pi pi-pencil" size="small" text @click="editRow(index)" />
              <Button icon="pi pi-trash" size="small" text severity="danger" @click="timeline.splice(index, 1)" />
            </template>
          </Column>
        </DataTable>

        <div class="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-800 p-3">
          <div><label class="field-label">Giờ</label><InputText v-model="row.time" placeholder="20:00" class="w-24" /></div>
          <div class="min-w-52 flex-1"><label class="field-label">Chương trình</label><InputText v-model="row.title" class="w-full" /></div>
          <div><label class="field-label">Trạng thái</label>
            <Dropdown v-model="row.status" :options="['LIVE', 'UPCOMING', 'REPLAY']" class="w-36" />
          </div>
          <Button :label="rowIdx === -1 ? 'Thêm' : 'Cập nhật'" icon="pi pi-plus" size="small" @click="applyRow" :disabled="!row.time || !row.title.trim()" />
          <Button v-if="rowIdx !== -1" label="Hủy" size="small" text @click="resetRow" />
        </div>
      </div>
    </div>
    <Toast />

    <!-- Dialog nhập Excel EPG -->
    <Dialog v-model:visible="impDlg" modal header="Nhập lịch từ file Excel (CSV)" class="w-full max-w-md">
      <div class="flex flex-col gap-3">
        <p class="text-sm text-neutral-400">Kênh: <b class="text-neutral-200">{{ selected?.name }}</b> — Ngày: <b class="text-neutral-200">{{ dateStr() }}</b></p>
        <div><label class="field-label">File CSV (theo mẫu)</label>
          <input type="file" accept=".csv" class="w-full text-sm" @change="(e: any) => impFile = e.target.files?.[0] || null" />
        </div>
      </div>
      <template #footer>
        <Button label="Hủy" text @click="impDlg = false" />
        <Button label="Nhập" icon="pi pi-upload" :loading="importing" @click="doImport" :disabled="!impFile" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useHead({ title: 'Truyền hình & EPG - VTC ANY CMS' });

const api = useApi();
const toast = useToast();
const { can } = useCmsAuth();
const groups = ref<any[]>([]);
const selected = ref<any>(null);
const date = ref(new Date());
const timeline = ref<any[]>([]);
const source = ref('');
const loading = ref(false);
const saving = ref(false);
const row = ref({ time: '', title: '', status: 'UPCOMING' });
const rowIdx = ref(-1);
const impDlg = ref(false);
const impFile = ref<File | null>(null);
const importing = ref(false);

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('cms_token') || sessionStorage.getItem('cms_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function slugOf(ch: any) {
  return ch.slug || String(ch.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
function dateStr() {
  const d = date.value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function epgSev(s: string) {
  return { LIVE: 'danger', UPCOMING: 'info', REPLAY: 'secondary' }[s] || 'info';
}
function select(ch: any) { selected.value = ch; loadEpg(); }
function resetRow() { row.value = { time: '', title: '', status: 'UPCOMING' }; rowIdx.value = -1; }
function editRow(i: number) { row.value = { ...timeline.value[i] }; rowIdx.value = i; }
function applyRow() {
  if (rowIdx.value === -1) timeline.value.push({ ...row.value });
  else timeline.value[rowIdx.value] = { ...row.value };
  timeline.value.sort((a, b) => a.time.localeCompare(b.time));
  resetRow();
}
async function loadEpg() {
  if (!selected.value) return;
  loading.value = true;
  try {
    const r = await api.get<any>(`/channels/${slugOf(selected.value)}/schedule`, { date: dateStr() });
    timeline.value = (r.timeline || []).map((t: any) => ({ time: t.time, title: t.title, status: t.status }));
    source.value = r.source || '';
  } catch {
    timeline.value = [];
    toast.add({ severity: 'warn', summary: 'Chú ý', detail: 'Chưa có lịch, tạo mới bên dưới', life: 3000 });
  } finally { loading.value = false; }
}
async function save() {
  saving.value = true;
  try {
    await api.post(`/channels/${slugOf(selected.value)}/epg`, { timeline: timeline.value }, { date: dateStr() });
    toast.add({ severity: 'success', summary: 'Xong', detail: `Đã lưu lịch ngày ${dateStr()}`, life: 3000 });
  } catch (e: any) { toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.message || 'Lưu thất bại', life: 3000 }); }
  finally { saving.value = false; }
}
onMounted(async () => {
  try {
    const r = await api.get<any>('/channels');
    groups.value = (r.groups || []).filter((g: any) => (g.channels || []).length);
  } catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được danh sách kênh', life: 3000 }); }
});

// ---- Nhập Excel EPG: tải file mẫu CSV + import multipart ----
async function downloadTemplate() {
  try {
    const base = (useRuntimeConfig().public.apiBase as string).replace(/\/$/, '');
    const blob = await $fetch<Blob>(`${base}/admin/catalog/epg/template`, {
      headers: authHeaders(),
      responseType: 'blob',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'epg-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được file mẫu', life: 3000 });
  }
}
async function doImport() {
  if (!selected.value || !impFile.value) return;
  importing.value = true;
  try {
    const base = (useRuntimeConfig().public.apiBase as string).replace(/\/$/, '');
    const fd = new FormData();
    fd.append('file', impFile.value);
    const r = await $fetch<any>(`${base}/admin/catalog/channels/${slugOf(selected.value)}/epg/import`, {
      method: 'POST',
      query: { date: dateStr() },
      body: fd,
      headers: authHeaders(),
    });
    toast.add({ severity: 'success', summary: 'Xong', detail: `Đã nhập ${r.imported ?? 0} dòng lịch ngày ${dateStr()}`, life: 4000 });
    impDlg.value = false;
    impFile.value = null;
    loadEpg();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.error?.message || 'Nhập thất bại', life: 3000 });
  } finally { importing.value = false; }
}
</script>
