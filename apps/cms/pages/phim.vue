<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-neutral-400">Tổng: {{ meta.total }} phim</p>
      <Button v-if="can('catalog:write')" label="Thêm phim" icon="pi pi-plus" @click="openAdd" />
    </div>

    <div class="surface-card p-4">
      <DataTable :value="items" :loading="loading" paginator :rows="20" :total-records="meta.total"
        lazy :first="(meta.page - 1) * meta.limit" @page="onPage" size="small">
        <Column field="title" header="Tên phim">
          <template #body="{ data }">
            <div class="font-medium">{{ data.title }}</div>
            <Tag :value="typeLabel(data.type)" severity="info" class="mt-1" />
          </template>
        </Column>
        <Column field="planId" header="Gói cước" />
        <Column field="distribution" header="Phân phối">
          <template #body="{ data }">{{ data.distribution === 'paid' ? 'Trả phí' : 'Miễn phí' }}</template>
        </Column>
        <Column header="Hiển thị" style="width:7rem">
          <template #body="{ data }">
            <InputSwitch :model-value="data.isVisible !== false"
              @update:model-value="(v: boolean) => toggleVisible(data, v)" :disabled="!can('catalog:write')" />
          </template>
        </Column>
        <Column field="createdAt" header="Ngày tạo">
          <template #body="{ data }">{{ fmtDate(data.createdAt) }}</template>
        </Column>
        <Column header="Thao tác" style="min-width:16rem">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-1">
              <Button label="Tập phim" size="small" text @click="openEpisodes(data)" />
              <Button v-if="can('catalog:write')" label="Sửa" size="small" text @click="openEdit(data)" />
              <Button v-if="can('catalog:write')" label="Xóa" size="small" text severity="danger" @click="confirmDelete(confirm, data.id, data.title)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Dialog phim -->
    <Dialog v-model:visible="dlg" modal :header="editing ? 'Sửa phim' : 'Thêm phim'" class="w-full max-w-3xl">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="field-label">Tên phim *</label><InputText v-model="form.title" class="w-full" /></div>
        <div class="col-span-2"><label class="field-label">Tên gốc</label><InputText v-model="form.originalTitle" class="w-full" /></div>
        <div class="col-span-2"><label class="field-label">Mô tả</label><Textarea v-model="form.description" rows="3" class="w-full" /></div>
        <div><label class="field-label">Loại phim</label>
          <Dropdown v-model="form.type" :options="movieTypes" option-label="label" option-value="value" class="w-full" />
        </div>
        <div><label class="field-label">Gói cước</label>
          <Dropdown v-model="form.planId" :options="plans" option-label="name" option-value="id" placeholder="—" show-clear class="w-full" />
        </div>
        <div><label class="field-label">Danh mục</label>
          <MultiSelect v-model="form.categoryIds" :options="typeCategories('phim')" option-label="name" option-value="id" filter display="chip"
            :loading="loadingCats" placeholder="Chọn danh mục" class="w-full" />
        </div>
        <div><label class="field-label">Thể loại (IDs, cách nhau dấu phẩy)</label><InputText v-model="form.genreIdsText" class="w-full" /></div>
        <div><label class="field-label">Giới hạn độ tuổi</label><InputText v-model="form.ageLimit" class="w-full" placeholder="vd: 13+" /></div>
        <div><label class="field-label">Ngày xuất bản</label><Calendar v-model="form.publishedAt" date-format="yy-mm-dd" show-icon class="w-full" /></div>
        <div><label class="field-label">Thời lượng (h:mm:ss)</label><InputText v-model="form.duration" class="w-full" placeholder="1:30:00" /></div>
        <div><label class="field-label">Năm sản xuất</label><InputNumber v-model="form.releaseYear" class="w-full" :use-grouping="false" /></div>
        <div><label class="field-label">Phân phối</label>
          <Dropdown v-model="form.distribution" :options="distOptions" option-label="label" option-value="value" class="w-full" />
        </div>
        <div><label class="field-label">Giá mua lẻ (VNĐ)</label><InputNumber v-model="form.price" class="w-full" :disabled="form.distribution === 'free'" /></div>
        <div class="col-span-2"><label class="field-label">Poster (2:3)</label><ImagePicker v-model="form.posterUrl" compact /></div>
        <div class="col-span-2"><label class="field-label">Thumbnail (16:9)</label><ImagePicker v-model="form.thumbnailUrl" compact /></div>
        <div class="col-span-2 flex flex-wrap gap-4">
          <div class="flex items-center gap-2"><Checkbox v-model="form.hasSubtitle" binary input-id="msub" /><label for="msub">Phụ đề</label></div>
          <div class="flex items-center gap-2"><Checkbox v-model="form.hasDubbing" binary input-id="mdub" /><label for="mdub">Thuyết minh</label></div>
          <div class="flex items-center gap-2"><Checkbox v-model="form.isVisible" binary input-id="mvis" /><label for="mvis">Hiển thị</label></div>
        </div>
      </div>
      <template #footer>
        <Button label="Hủy" text @click="dlg = false" />
        <Button :label="editing ? 'Lưu' : 'Tạo'" :loading="saving" @click="save" :disabled="!form.title.trim()" />
      </template>
    </Dialog>

    <!-- Dialog tập phim -->
    <Dialog v-model:visible="epDlg" modal :header="`Tập phim — ${epMovie?.title || ''}`" class="w-full max-w-4xl">
      <div class="mb-3 flex justify-end">
        <Button v-if="can('catalog:write')" label="Thêm tập" icon="pi pi-plus" size="small" @click="openEpAdd" />
      </div>
      <DataTable :value="episodes" :loading="epLoading" size="small">
        <Column field="order" header="Thứ tự" style="width:6rem" />
        <Column field="name" header="Tên tập" />
        <Column header="Hiển thị" style="width:7rem">
          <template #body="{ data }"><Tag :value="data.isVisible ? 'Bật' : 'Tắt'" :severity="sevVisible(data.isVisible)" /></template>
        </Column>
        <Column field="createdAt" header="Ngày tạo">
          <template #body="{ data }">{{ fmtDate(data.createdAt) }}</template>
        </Column>
        <Column header="Thao tác" style="min-width:11rem">
          <template #body="{ data }">
            <Button v-if="can('catalog:write')" :label="data.isVisible ? 'Ẩn' : 'Xuất bản'" size="small" text :severity="data.isVisible ? 'warn' : 'success'" @click="toggleEpPublish(data)" />
            <Button v-if="can('catalog:write')" label="Sửa" size="small" text @click="openEpEdit(data)" />
            <Button v-if="can('catalog:write')" label="Xóa" size="small" text severity="danger" @click="removeEpisode(data)" />
          </template>
        </Column>
      </DataTable>

      <Dialog v-model:visible="epFormDlg" modal :header="editingEp ? 'Sửa tập phim' : 'Thêm tập phim'" class="w-full max-w-2xl" append-to="self">
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2"><label class="field-label">Tên tập *</label><InputText v-model="epForm.name" class="w-full" /></div>
          <div class="col-span-2"><label class="field-label">Mô tả</label><Textarea v-model="epForm.description" rows="2" class="w-full" /></div>
          <div><label class="field-label">Thứ tự *</label><InputNumber v-model="epForm.order" class="w-full" :use-grouping="false" /></div>
          <div><label class="field-label">Ngày xuất bản</label><Calendar v-model="epForm.publishedAt" date-format="yy-mm-dd" show-icon class="w-full" /></div>
          <div><label class="field-label">Thời lượng video (h:mm:ss)</label><InputText v-model="epForm.duration" class="w-full" /></div>
          <div><label class="field-label">Video (chọn từ thư viện Tập tin)</label>
            <Dropdown v-model="epForm.videoFileId" :options="vodFileOptions" option-label="label" option-value="id" editable filter
              :loading="loadingFiles" placeholder="Chọn file đã transcode xong" class="w-full" />
            <InputText v-model="epForm.videoFileId" class="w-full mt-1" placeholder="...hoặc nhập ID file thủ công" />
          </div>
          <div v-if="editingEp?.id" class="col-span-2">
            <label class="field-label">Xem trước video</label>
            <div v-if="epPreviewUrl" class="relative aspect-video overflow-hidden rounded-lg bg-black">
              <HlsPreview ref="epPreviewRef" :src="epPreviewUrl" class="absolute inset-0" />
              <span class="absolute right-2 top-2 z-10 flex gap-1.5">
                <button type="button" title="Chụp thumbnail từ khung hình hiện tại"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-black/30 text-white backdrop-blur transition hover:bg-black/50 disabled:opacity-50"
                  :disabled="epCapturing" @click="captureEpThumb">
                  <i :class="epCapturing ? 'pi pi-spin pi-spinner text-sm' : 'pi pi-camera text-sm'"></i>
                </button>
                <button type="button" title="Bỏ video"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-black/30 text-red-400 backdrop-blur transition hover:bg-black/50"
                  @click="epForm.videoFileId = ''; epPreviewUrl = ''">
                  <i class="pi pi-trash text-sm"></i>
                </button>
              </span>
            </div>
            <Button v-else label="Xem trước video" icon="pi pi-play" outlined size="small"
              :loading="epPreviewBusy" :disabled="!epForm.videoFileId" @click="loadEpPreview" />
            <p v-if="epPreviewErr" class="mt-1 text-xs text-red-500">{{ epPreviewErr }}</p>
          </div>
          <div><label class="field-label">Phụ đề EN (URL file)</label><InputText v-model="epForm.subtitleEn" class="w-full" /></div>
          <div><label class="field-label">Phụ đề VI (URL file)</label><InputText v-model="epForm.subtitleVi" class="w-full" /></div>
          <div class="col-span-2"><label class="field-label">Thumbnail</label><ImagePicker v-model="epForm.thumbnail" compact /></div>
          <div><label class="field-label">Phân phối</label>
            <Dropdown v-model="epForm.distribution" :options="epDistOptions" option-label="label" option-value="value" class="w-full" />
          </div>
          <div><label class="field-label">Giá mua lẻ (VNĐ)</label><InputNumber v-model="epForm.price" class="w-full" :disabled="epForm.distribution === 'free'" /></div>
          <div class="col-span-2 flex flex-wrap gap-4">
            <div class="flex items-center gap-2"><Checkbox v-model="epForm.isVisible" binary input-id="evis" /><label for="evis">Hiển thị</label></div>
            <div class="flex items-center gap-2"><Checkbox v-model="epForm.showAds" binary input-id="eads" /><label for="eads">Hiển thị quảng cáo</label></div>
          </div>
        </div>
        <template #footer>
          <Button label="Hủy" text @click="epFormDlg = false" />
          <Button :label="editingEp ? 'Lưu' : 'Tạo'" :loading="epSaving" @click="saveEpisode" :disabled="!epForm.name.trim() || epForm.order == null" />
        </template>
      </Dialog>
    </Dialog>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useHead({ title: 'Phim - VTC ANY CMS' });

const { can } = useCmsAuth();
const confirm = useConfirm();
const { api, toast, items, meta, loading, load, onPage, saveItem, confirmDelete } = useCatalog('movies');

const movieTypes = [
  { label: 'Phim lẻ', value: 'single' },
  { label: 'Phim bộ', value: 'series' },
  { label: 'Short', value: 'short' },
];
const distOptions = [
  { label: 'Miễn phí', value: 'free' },
  { label: 'Trả phí', value: 'paid' },
];
const epDistOptions = [
  { label: 'Theo phim', value: 'inherit' },
  { label: 'Miễn phí', value: 'free' },
  { label: 'Trả phí', value: 'paid' },
];

const plans = ref<any[]>([]);
const categories = ref<any[]>([]);
const loadingCats = ref(false);
// Chi hien danh muc ap dung cho Phim (appliesTo rong = hien het, tuong thich du lieu cu).
function typeCategories(kind: string) {
  return categories.value.filter((c) => {
    const a = c.appliesTo || [];
    return !a.length || a.includes(kind);
  });
}
const { files: vodFiles, loadingFiles, loadDoneFiles, fileLabel } = useVodFiles();
const vodFileOptions = computed(() => vodFiles.value.map((f) => ({ id: f.id, label: fileLabel(f), posterUrl: f.posterUrl || '' })));
const dlg = ref(false);
const editing = ref<any>(null);
const saving = ref(false);
const form = ref({
  title: '', originalTitle: '', description: '', type: 'single', planId: '',
  categoryIds: [] as string[], genreIdsText: '', ageLimit: '', publishedAt: null as any,
  duration: '', releaseYear: null as any, distribution: 'free', price: null as any,
  posterUrl: '', thumbnailUrl: '', hasSubtitle: false, hasDubbing: false, isVisible: true,
});

// ---- Episodes ----
const epDlg = ref(false);
const epMovie = ref<any>(null);
const episodes = ref<any[]>([]);
const epLoading = ref(false);
const epFormDlg = ref(false);
const editingEp = ref<any>(null);
const epSaving = ref(false);
const epForm = ref({
  name: '', description: '', order: null as any, publishedAt: null as any, duration: '',
  subtitleEn: '', subtitleVi: '', thumbnail: '', videoFileId: '',
  isVisible: true, showAds: false, distribution: 'inherit', price: null as any,
});

function typeLabel(t: string) { return movieTypes.find((x) => x.value === t)?.label || t || '—'; }
function toIso(d: any) { return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : (d || ''); }
function toDate(v: any) { return v ? new Date(v) : null; }

function openAdd() {
  editing.value = null;
  form.value = { title: '', originalTitle: '', description: '', type: 'single', planId: '', categoryIds: [], genreIdsText: '', ageLimit: '', publishedAt: null, duration: '', releaseYear: null, distribution: 'free', price: null, posterUrl: '', thumbnailUrl: '', hasSubtitle: false, hasDubbing: false, isVisible: true };
  dlg.value = true;
}
function openEdit(m: any) {
  editing.value = m;
  form.value = {
    title: m.title || '', originalTitle: m.originalTitle || '', description: m.description || '',
    type: m.type || 'single', planId: m.planId || '', categoryIds: m.categoryIds || [],
    genreIdsText: idsToText(m.genreIds), ageLimit: m.ageLimit || '', publishedAt: toDate(m.publishedAt),
    duration: m.duration || '', releaseYear: m.releaseYear ?? null, distribution: m.distribution || 'free',
    price: m.price ?? null, posterUrl: m.posterUrl || '', thumbnailUrl: m.thumbnailUrl || '',
    hasSubtitle: !!m.hasSubtitle, hasDubbing: !!m.hasDubbing, isVisible: m.isVisible !== false,
  };
  dlg.value = true;
}
async function save() {
  saving.value = true;
  const body = {
    title: form.value.title, originalTitle: form.value.originalTitle || undefined,
    description: form.value.description || undefined, type: form.value.type,
    planId: form.value.planId || undefined,
    categoryIds: form.value.categoryIds, genreIds: textToIds(form.value.genreIdsText),
    ageLimit: form.value.ageLimit || undefined, publishedAt: toIso(form.value.publishedAt) || undefined,
    duration: form.value.duration || undefined, releaseYear: form.value.releaseYear ?? undefined,
    distribution: form.value.distribution, price: form.value.price ?? undefined,
    posterUrl: form.value.posterUrl || undefined, thumbnailUrl: form.value.thumbnailUrl || undefined,
    hasSubtitle: form.value.hasSubtitle, hasDubbing: form.value.hasDubbing, isVisible: form.value.isVisible,
  };
  const ok = await saveItem(editing.value?.id || null, body, 'Đã lưu phim');
  saving.value = false;
  if (ok) { dlg.value = false; load(); }
}
async function toggleVisible(m: any, v: boolean) {
  try {
    await api.patch(`/admin/catalog/movies/${m.id}`, { isVisible: v });
    m.isVisible = v;
    toast.add({ severity: 'success', summary: 'Xong', detail: v ? 'Đã bật hiển thị' : 'Đã tắt hiển thị', life: 2000 });
  } catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không đổi được trạng thái', life: 3000 }); }
}

// ---- Episodes ----
function openEpisodes(m: any) { epMovie.value = m; epDlg.value = true; loadEpisodes(); }
async function loadEpisodes() {
  if (!epMovie.value) return;
  epLoading.value = true;
  try {
    const r = await api.get<any>(`/admin/catalog/movies/${epMovie.value.id}/episodes`, { page: 1, limit: 100 });
    episodes.value = (r.data || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  } catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được tập phim', life: 3000 }); }
  finally { epLoading.value = false; }
}
function openEpAdd() {
  editingEp.value = null;
  epForm.value = { name: '', description: '', order: (episodes.value.length || 0) + 1, publishedAt: null, duration: '', subtitleEn: '', subtitleVi: '', thumbnail: '', videoFileId: '', isVisible: true, showAds: false, distribution: 'inherit', price: null };
  epFormDlg.value = true;
  loadDoneFiles();
}
function openEpEdit(e: any) {
  editingEp.value = e;
  epPreviewUrl.value = ''; epPreviewErr.value = '';
  epForm.value = {
    name: e.name || '', description: e.description || '', order: e.order ?? null,
    publishedAt: toDate(e.publishedAt), duration: e.duration || '',
    subtitleEn: e.subtitleEn || '', subtitleVi: e.subtitleVi || '', thumbnail: e.thumbnail || '',
    videoFileId: e.videoFileId || '', isVisible: e.isVisible !== false, showAds: !!e.showAds,
    distribution: e.distribution || 'inherit', price: e.price ?? null,
  };
  epFormDlg.value = true;
  loadDoneFiles();
}

// Xem truoc video tap phim ngay trong form.
const epPreviewUrl = ref('');
const epPreviewBusy = ref(false);
const epPreviewErr = ref('');
async function loadEpPreview() {
  if (!editingEp.value?.id) return;
  epPreviewBusy.value = true; epPreviewErr.value = '';
  try {
    const r = await api.get<any>(`/admin/catalog/episodes/${editingEp.value.id}/play`);
    epPreviewUrl.value = r.hls_path || '';
    if (!epPreviewUrl.value) epPreviewErr.value = 'Chưa có URL phát cho tập này.';
  } catch (e: any) {
    epPreviewErr.value = e?.data?.error?.message || 'Video chưa sẵn sàng (chưa gắn file hoặc transcode chưa xong).';
  } finally { epPreviewBusy.value = false; }
}
watch(() => epForm.value.videoFileId, () => { epPreviewUrl.value = ''; epPreviewErr.value = ''; autoEpThumbFromFile(); });
watch(epFormDlg, (open) => { if (!open) { epPreviewUrl.value = ''; epPreviewErr.value = ''; } });

// Thumbnail tu dong cho tap: dung poster worker cat san neu chua co anh rieng.
function autoEpThumbFromFile() {
  if (epForm.value.thumbnail) return;
  const f = vodFileOptions.value.find((x) => x.id === epForm.value.videoFileId);
  if (f?.posterUrl) epForm.value.thumbnail = f.posterUrl;
}
watch(vodFileOptions, autoEpThumbFromFile);

// Chup khung hinh dang phat lam thumbnail cho tap phim.
const epPreviewRef = ref<any>(null);
const epCapturing = ref(false);
async function captureEpThumb() {
  if (!epPreviewRef.value?.captureFrame) return;
  epCapturing.value = true;
  try {
    const blob = await epPreviewRef.value.captureFrame();
    if (!blob) {
      toast.add({ severity: 'warn', summary: 'Chưa chụp được', detail: 'Hãy để video phát một lúc rồi thử lại.', life: 3000 });
      return;
    }
    const file = new File([blob], `thumb-ep-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const res = await api.put<any>('/uploads/image', file, { 'Content-Type': 'image/jpeg', 'x-file-name': encodeURIComponent(file.name) });
    if (res?.url) {
      epForm.value.thumbnail = res.url;
      toast.add({ severity: 'success', summary: 'Đã cắt thumbnail từ video', life: 2500 });
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chụp thumbnail lỗi', detail: e?.data?.error || e?.message || 'Thử lại sau.', life: 3000 });
  } finally { epCapturing.value = false; }
}

async function toggleEpPublish(ep: any) {
  const action = ep.isVisible ? 'unpublish' : 'publish';
  try {
    await api.post(`/admin/catalog/episodes/${ep.id}/${action}`);
    toast.add({ severity: 'success', summary: ep.isVisible ? 'Đã ẩn tập phim' : 'Đã xuất bản tập phim', life: 2500 });
    loadEpisodes();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.error?.message || e?.message, life: 3000 });
  }
}
async function saveEpisode() {
  epSaving.value = true;
  try {
    const body = { ...epForm.value, publishedAt: toIso(epForm.value.publishedAt) || undefined };
    if (editingEp.value) await api.patch(`/admin/catalog/episodes/${editingEp.value.id}`, body);
    else await api.post(`/admin/catalog/movies/${epMovie.value.id}/episodes`, body);
    toast.add({ severity: 'success', summary: 'Xong', detail: 'Đã lưu tập phim', life: 3000 });
    epFormDlg.value = false; loadEpisodes();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.error?.message || 'Lưu thất bại', life: 3000 });
  } finally { epSaving.value = false; }
}
function removeEpisode(e: any) {
  confirm.require({
    message: `Xóa tập "${e.name}"?`, header: 'Xác nhận', icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Xóa', rejectLabel: 'Hủy', acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.del(`/admin/catalog/episodes/${e.id}`);
        toast.add({ severity: 'success', summary: 'Xong', detail: 'Đã xóa tập phim', life: 3000 });
        loadEpisodes();
      } catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Xóa thất bại', life: 3000 }); }
    },
  });
}

onMounted(async () => {
  load();
  try {
    const r = await api.get<any>('/admin/catalog/plans', { page: 1, limit: 100 });
    plans.value = r.data || [];
  } catch { /* bỏ qua */ }
  loadingCats.value = true;
  try {
    const r = await api.get<any>('/admin/categories');
    categories.value = r.data || [];
  } catch { categories.value = []; }
  finally { loadingCats.value = false; }
});
</script>
