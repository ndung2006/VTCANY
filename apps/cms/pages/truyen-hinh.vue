<template>
  <div class="flex flex-col gap-6">
    <!-- Quan ly hien thi kenh: nguon tu VTC AIO, BE quyet dinh kenh nao duoc hien thi -->
    <div class="surface-card p-4">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <h2 class="font-semibold">Quản lý kênh truyền hình</h2>
        <Tag v-if="aioError" severity="warn" value="AIO đang lỗi — danh sách có thể thiếu kênh" />
        <span class="text-xs text-neutral-500">Nguồn kênh: VTC AIO · hiển thị do BE quản lý (ẩn/hiện, nhóm, thứ tự)</span>
        <div class="flex-1" />
        <span class="p-input-icon-left">
          <i class="pi pi-search" />
          <InputText v-model="search" placeholder="Tìm kênh..." class="w-56" />
        </span>
        <Button v-if="can('catalog:write')" label="Thêm kênh / sự kiện" icon="pi pi-plus" size="small" @click="openAddCustom" />
        <Button label="Tải lại" icon="pi pi-refresh" size="small" outlined @click="loadChannels" />
      </div>

      <DataTable :value="filteredChannels" :loading="loadingChannels" size="small" paginator :rows="15">
        <Column header="Logo" style="width:5rem">
          <template #body="{ data }">
            <img v-if="data.logoUrl" :src="data.logoUrl" class="h-9 w-14 rounded bg-white object-contain" alt="" />
            <span v-else class="text-neutral-500 text-xs">—</span>
          </template>
        </Column>
        <Column header="Tên kênh">
          <template #body="{ data }">
            <div class="font-medium">{{ data.displayName || data.name }}</div>
            <div class="text-xs text-neutral-500">{{ data.key }}<span v-if="data.displayName && data.source === 'aio'"> · gốc: {{ data.name }}</span></div>
          </template>
        </Column>
        <Column header="Nguồn" style="width:7rem">
          <template #body="{ data }"><Tag :value="data.source === 'custom' ? 'Tự thêm' : 'VTC AIO'" :severity="data.source === 'custom' ? 'info' : 'secondary'" /></template>
        </Column>
        <Column header="Danh mục (nhóm)" style="width:13rem">
          <template #body="{ data }">{{ data.groupName || 'Mặc định theo tên kênh' }}</template>
        </Column>
        <Column header="Gói cước" style="width:9rem">
          <template #body="{ data }"><Tag :value="data.planId ? planName(data.planId) : 'Miễn phí'" :severity="data.planId ? 'warn' : 'success'" /></template>
        </Column>
        <Column header="Thứ tự" style="width:6rem">
          <template #body="{ data }">{{ data.sortOrder ?? '—' }}</template>
        </Column>
        <Column header="EPG AIO" style="width:7rem">
          <template #body="{ data }"><Tag :value="data.useAioEpg !== false ? 'Lấy' : 'Không lấy'" :severity="data.useAioEpg !== false ? 'info' : 'secondary'" /></template>
        </Column>
        <Column header="Hiển thị" style="width:7rem">
          <template #body="{ data }"><Tag :value="data.isVisible ? 'Bật' : 'Ẩn'" :severity="data.isVisible ? 'success' : 'danger'" /></template>
        </Column>
        <Column header="Thao tác" style="min-width:13rem">
          <template #body="{ data }">
            <Button icon="pi pi-pencil" size="small" text v-tooltip.top="'Cập nhật kênh'" :disabled="!can('catalog:write')" @click="openEditChannel(data)" />
            <Button :icon="data.isVisible ? 'pi pi-eye-slash' : 'pi pi-eye'" size="small" text :severity="data.isVisible ? 'warn' : 'success'"
              v-tooltip.top="data.isVisible ? 'Ẩn kênh' : 'Hiện kênh'" :disabled="!can('catalog:write')" @click="toggleVisible(data)" />
            <Button icon="pi pi-calendar" size="small" text v-tooltip.top="'Lịch phát sóng (EPG)'" @click="selectForEpg(data)" />
            <Button v-if="data.hasOverride" icon="pi pi-trash" size="small" text severity="danger"
              v-tooltip.top="data.source === 'custom' ? 'Xóa kênh tự thêm' : 'Xóa cài đặt (về mặc định AIO)'"
              :disabled="!can('catalog:write')" @click="confirmReset(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- EPG editor (giu nguyen luong cu) -->
    <div class="grid gap-6 xl:grid-cols-[20rem_1fr]">
      <div class="surface-card p-4">
        <h2 class="mb-3 font-semibold">Lịch phát sóng (EPG)</h2>
        <button v-for="ch in channels" :key="ch.key" @click="selectForEpg(ch)"
          class="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
          :class="selected?.key === ch.key ? 'bg-white/15 font-semibold' : ''">
          <img v-if="ch.logoUrl" :src="ch.logoUrl" class="h-6 w-6 rounded bg-white object-contain" alt="" />
          <span class="truncate">{{ ch.displayName || ch.name }}</span>
          <Tag v-if="!ch.isVisible" value="Ẩn" severity="danger" class="ml-auto" />
        </button>
        <p v-if="!channels.length" class="text-sm text-neutral-500">Chưa có kênh nào.</p>
      </div>

      <div class="surface-card p-5">
        <div v-if="!selected" class="py-16 text-center text-neutral-500">Chọn một kênh để sửa lịch phát sóng.</div>
        <div v-else class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-semibold">{{ selected.displayName || selected.name }}</h2>
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
    </div>

    <!-- Dialog cap nhat truyen hinh / su kien (mau VTCPlay) -->
    <Dialog v-model:visible="chDlg" modal :header="chEditing?.source === 'custom' && !chEditing?.key ? 'Thêm truyền hình / sự kiện' : 'Cập nhật truyền hình / sự kiện'" class="w-full max-w-6xl">
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        <div class="flex flex-col gap-3">
          <div><label class="field-label">Tên (bắt buộc)</label>
            <InputText v-model="chForm.displayName" class="w-full" :placeholder="chEditing?.source === 'aio' ? chEditing.name : 'Kênh truyền hình LTV2'" />
            <p v-if="chEditing?.source === 'aio'" class="text-xs text-neutral-500 mt-1">Tên gốc từ AIO: {{ chEditing.name }} (key: {{ chEditing.key }}) — để trống ô này nếu giữ tên gốc.</p>
          </div>
          <div><label class="field-label">Mô tả</label><Textarea v-model="chForm.description" rows="4" class="w-full" /></div>
          <div><label class="field-label">Danh mục</label>
            <Dropdown v-model="chForm.groupName" :options="groupOptions" editable show-clear placeholder="Mặc định theo tên kênh" class="w-full" />
          </div>
          <div><label class="field-label">Gói cước</label>
            <Dropdown v-model="chForm.planId" :options="plans" option-label="name" option-value="id" show-clear :loading="loadingPlans" placeholder="Miễn phí" class="w-full" />
          </div>
          <div><label class="field-label">HLS</label>
            <InputText v-model="chForm.hlsUrl" class="w-full" placeholder="https://.../index.m3u8" />
            <p class="text-xs text-neutral-500 mt-1">Kênh AIO: để trống để dùng luồng trực tiếp từ VTC AIO; điền vào để ghi đè nguồn phát.</p>
          </div>
          <div><label class="field-label">DASH</label><InputText v-model="chForm.dashUrl" class="w-full" placeholder="https://.../manifest.mpd" /></div>
          <div><label class="field-label">Catchup HLS</label><InputText v-model="chForm.catchupHlsUrl" class="w-full" placeholder="https://.../catchup.m3u8" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="field-label">Thứ tự hiển thị</label><InputNumber v-model="chForm.sortOrder" class="w-full" placeholder="Tự động" /></div>
            <div class="flex items-end gap-2 pb-2"><Checkbox v-model="chForm.isVisible" binary input-id="chvis" /><label for="chvis">Hiển thị kênh</label></div>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox v-model="chForm.useAioEpg" binary input-id="chepg" /><label for="chepg">Lấy EPG từ VTC AIO</label>
            <span class="text-xs text-neutral-500">(tắt = chỉ dùng lịch phát sóng nhập tay trong CMS)</span>
          </div>
        </div>
        <div class="flex flex-col gap-4">
          <div>
            <label class="field-label">Ảnh thumbnail (Tỉ lệ 16:9)</label>
            <div class="aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center relative">
              <img v-if="chForm.logoUrl" :src="chForm.logoUrl" class="absolute inset-0 w-full h-full object-contain bg-white" alt="thumbnail" />
              <span v-else class="text-xs text-neutral-400 px-2 text-center">Chưa có ảnh</span>
              <Button v-if="chForm.logoUrl" icon="pi pi-trash" size="small" severity="danger" text class="absolute top-1 right-1" @click="chForm.logoUrl = ''" />
            </div>
            <InputText v-model="chForm.logoUrl" class="w-full mt-2" placeholder="URL ảnh thumbnail / logo kênh" />
          </div>
          <div>
            <label class="field-label">Ảnh banner player (Tỉ lệ 16:9)</label>
            <div class="aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center relative">
              <img v-if="chForm.bannerUrl" :src="chForm.bannerUrl" class="absolute inset-0 w-full h-full object-cover" alt="banner" />
              <span v-else class="text-xs text-neutral-400 px-2 text-center">Chưa có ảnh</span>
              <Button v-if="chForm.bannerUrl" icon="pi pi-trash" size="small" severity="danger" text class="absolute top-1 right-1" @click="chForm.bannerUrl = ''" />
            </div>
            <InputText v-model="chForm.bannerUrl" class="w-full mt-2" placeholder="URL ảnh banner player" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Đóng" text @click="chDlg = false" />
        <Button label="Lưu" icon="pi pi-check" :loading="chSaving" @click="saveChannel" :disabled="!chEditing?.key && !chForm.displayName.trim()" />
      </template>
    </Dialog>

    <!-- Dialog nhập Excel EPG -->
    <Dialog v-model:visible="impDlg" modal header="Nhập lịch từ file Excel (CSV)" class="w-full max-w-md">
      <div class="flex flex-col gap-3">
        <p class="text-sm text-neutral-400">Kênh: <b class="text-neutral-200">{{ selected?.displayName || selected?.name }}</b> — Ngày: <b class="text-neutral-200">{{ dateStr() }}</b></p>
        <div><label class="field-label">File CSV (theo mẫu)</label>
          <input type="file" accept=".csv" class="w-full text-sm" @change="(e: any) => impFile = e.target.files?.[0] || null" />
        </div>
      </div>
      <template #footer>
        <Button label="Hủy" text @click="impDlg = false" />
        <Button label="Nhập" icon="pi pi-upload" :loading="importing" @click="doImport" :disabled="!impFile" />
      </template>
    </Dialog>
    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useHead({ title: 'Truyền hình & EPG - VTC ANY CMS' });

const api = useApi();
const toast = useToast();
const confirm = useConfirm();
const { can } = useCmsAuth();

// ---------- Quan ly hien thi kenh ----------
const channels = ref<any[]>([]);
const loadingChannels = ref(false);
const aioError = ref(false);
const search = ref('');
const plans = ref<any[]>([]);
const loadingPlans = ref(false);
const groupOptions = ['Kênh VTV', 'KÊNH ĐỊA PHƯƠNG', 'RADIO', 'ANTV-Truyền hình CAND', 'QPVN'];

const filteredChannels = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return channels.value;
  return channels.value.filter((c) => `${c.displayName || ''} ${c.name} ${c.key}`.toLowerCase().includes(q));
});
function planName(id: any): string { return plans.value.find((p) => p.id === id)?.name || 'Có gói'; }

async function loadChannels() {
  loadingChannels.value = true;
  try {
    const r = await api.get<any>('/admin/channels');
    channels.value = r.data || [];
    aioError.value = !!r.meta?.aioError;
    for (const c of channels.value) if (c.groupName && !groupOptions.includes(c.groupName)) groupOptions.push(c.groupName);
  } catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được danh sách kênh', life: 3000 }); }
  finally { loadingChannels.value = false; }
}
async function loadPlans() {
  loadingPlans.value = true;
  try { const r = await api.get<any>('/admin/catalog/plans', { page: 1, limit: 100 }); plans.value = r.data || []; } catch { plans.value = []; }
  finally { loadingPlans.value = false; }
}

const chDlg = ref(false);
const chEditing = ref<any>(null);
const chSaving = ref(false);
const emptyChForm = () => ({ displayName: '', description: '', groupName: null as any, planId: null as any, hlsUrl: '', dashUrl: '', catchupHlsUrl: '', logoUrl: '', bannerUrl: '', sortOrder: null as number | null, isVisible: true, useAioEpg: true });
const chForm = ref(emptyChForm());

function fillChForm(c: any) {
  chForm.value = {
    displayName: c.displayName || '', description: c.description || '',
    groupName: c.groupName ?? null, planId: c.planId ?? null,
    hlsUrl: c.hlsUrl || '', dashUrl: c.dashUrl || '', catchupHlsUrl: c.catchupHlsUrl || '',
    logoUrl: c.logoUrl || '', bannerUrl: c.bannerUrl || '',
    sortOrder: c.sortOrder ?? null, isVisible: c.isVisible !== false, useAioEpg: c.useAioEpg !== false,
  };
}
function openEditChannel(c: any) { chEditing.value = c; fillChForm(c); chDlg.value = true; loadPlans(); }
function openAddCustom() {
  chEditing.value = { source: 'custom', hasOverride: false, key: '' };
  chForm.value = emptyChForm();
  chDlg.value = true; loadPlans();
}
async function saveChannel() {
  const f = chForm.value;
  const isNewCustom = chEditing.value?.source === 'custom' && !chEditing.value?.key;
  const key = isNewCustom ? f.displayName.trim() : chEditing.value.key;
  if (!key) { toast.add({ severity: 'warn', summary: 'Thiếu tên kênh', life: 2500 }); return; }
  chSaving.value = true;
  try {
    await api.put(`/admin/channels/${encodeURIComponent(key)}`, {
        displayName: f.displayName.trim() || null, description: f.description || null,
        groupName: f.groupName || null, planId: f.planId || null,
        hlsUrl: f.hlsUrl.trim() || null, dashUrl: f.dashUrl.trim() || null, catchupHlsUrl: f.catchupHlsUrl.trim() || null,
        logoUrl: f.logoUrl.trim() || null, bannerUrl: f.bannerUrl.trim() || null,
        sortOrder: f.sortOrder, isVisible: f.isVisible, useAioEpg: f.useAioEpg, isCustom: chEditing.value?.source === 'custom',
    });
    toast.add({ severity: 'success', summary: 'Đã lưu cài đặt kênh', life: 2500 });
    chDlg.value = false;
    loadChannels();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.error?.message || e?.message, life: 3000 });
  } finally { chSaving.value = false; }
}
async function toggleVisible(c: any) {
  try {
    await api.put(`/admin/channels/${encodeURIComponent(c.key)}`, { isVisible: !c.isVisible });
    toast.add({ severity: 'success', summary: c.isVisible ? `Đã ẩn kênh ${c.displayName || c.name}` : `Đã hiện kênh ${c.displayName || c.name}`, life: 2500 });
    loadChannels();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.error?.message || e?.message, life: 3000 });
  }
}
function confirmReset(c: any) {
  confirm.require({
    message: c.source === 'custom' ? `Xóa kênh tự thêm "${c.displayName || c.name}"?` : `Xóa mọi cài đặt riêng của kênh "${c.name}" và quay về mặc định AIO?`,
    header: 'Xác nhận', icon: 'pi pi-exclamation-triangle', acceptLabel: 'Xóa', rejectLabel: 'Hủy',
    accept: async () => {
      try {
        await api.del(`/admin/channels/${encodeURIComponent(c.key)}`);
        toast.add({ severity: 'success', summary: 'Đã xóa cài đặt kênh', life: 2500 });
        loadChannels();
      } catch (e: any) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.error?.message || e?.message, life: 3000 });
      }
    },
  });
}

// ---------- EPG ----------
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
function slugOf(ch: any) { return ch?.key || ''; }
function dateStr() {
  const d = date.value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function epgSev(s: string) {
  return { LIVE: 'danger', UPCOMING: 'info', REPLAY: 'secondary' }[s] || 'info';
}
function selectForEpg(ch: any) { selected.value = ch; loadEpg(); }
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
    const r = await api.get<any>(`/channels/${encodeURIComponent(slugOf(selected.value))}/schedule`, { date: dateStr() });
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
    await api.post(`/channels/${encodeURIComponent(slugOf(selected.value))}/epg`, { timeline: timeline.value }, { date: dateStr() });
    toast.add({ severity: 'success', summary: 'Xong', detail: `Đã lưu lịch ngày ${dateStr()}`, life: 3000 });
  } catch (e: any) { toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.message || 'Lưu thất bại', life: 3000 }); }
  finally { saving.value = false; }
}

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
    const r = await $fetch<any>(`${base}/admin/catalog/channels/${encodeURIComponent(slugOf(selected.value))}/epg/import`, {
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

onMounted(() => { loadChannels(); loadPlans(); });
</script>
