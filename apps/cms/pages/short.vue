<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-neutral-400">Tổng: {{ meta.total }} short</p>
      <Button v-if="can('catalog:write')" label="Thêm short" icon="pi pi-plus" @click="openAdd" />
    </div>

    <div class="surface-card p-4">
      <DataTable :value="items" :loading="loading" paginator :rows="20" :total-records="meta.total"
        lazy :first="(meta.page - 1) * meta.limit" @page="onPage" size="small">
        <Column header="Ảnh" style="width:4.5rem">
          <template #body="{ data }">
            <img v-if="data.thumbnail" :src="data.thumbnail" class="w-10 aspect-[9/16] object-cover rounded" alt="" />
            <span v-else class="text-neutral-500 text-xs">—</span>
          </template>
        </Column>
        <Column field="title" header="Tên" />
        <Column header="Danh mục" style="width:10rem">
          <template #body="{ data }">{{ categoryName(data.categoryId) }}</template>
        </Column>
        <Column header="Gói cước" style="width:9rem">
          <template #body="{ data }"><Tag :value="data.planId ? planName(data.planId) : 'Miễn phí'" :severity="data.planId ? 'warn' : 'success'" /></template>
        </Column>
        <Column header="Hiển thị" style="width:7rem">
          <template #body="{ data }"><Tag :value="data.isVisible ? 'Bật' : 'Tắt'" :severity="sevVisible(data.isVisible)" /></template>
        </Column>
        <Column field="createdAt" header="Ngày tạo">
          <template #body="{ data }">{{ fmtDate(data.createdAt) }}</template>
        </Column>
        <Column header="Thao tác" style="min-width:12rem">
          <template #body="{ data }">
            <Button v-if="can('catalog:write')" :label="data.isVisible ? 'Ẩn' : 'Xuất bản'" size="small" text :severity="data.isVisible ? 'warn' : 'success'" @click="togglePublish(data)" />
            <Button v-if="can('catalog:write')" label="Sửa" size="small" text @click="openEdit(data)" />
            <Button v-if="can('catalog:write')" label="Xóa" size="small" text severity="danger" @click="confirmDelete(confirm, data.id, data.title)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dlg" modal :header="editing ? 'Sửa short' : 'Thêm short'" class="w-full max-w-6xl">
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_210px_250px] gap-5">
        <!-- Cot trai: thong tin -->
        <div class="flex flex-col gap-3">
          <div><label class="field-label">Tên (bắt buộc)</label><InputText v-model="form.title" class="w-full" /></div>
          <div><label class="field-label">Mô tả</label><Textarea v-model="form.description" rows="4" class="w-full" /></div>
          <div><label class="field-label">Danh mục</label>
            <Dropdown v-model="form.categoryId" :options="categories" option-label="name" option-value="id" show-clear filter
              :loading="loadingCats" placeholder="Chọn danh mục" class="w-full" />
          </div>
          <div><label class="field-label">Gói cước</label>
            <Dropdown v-model="form.planId" :options="plans" option-label="name" option-value="id" show-clear
              :loading="loadingPlans" placeholder="Miễn phí" class="w-full" />
          </div>
          <div><label class="field-label">Giới hạn độ tuổi</label>
            <Dropdown v-model="form.ageLimit" :options="ageOptions" show-clear placeholder="Mọi độ tuổi" class="w-full" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="field-label">Ngày xuất bản</label>
              <Calendar v-model="publishedDate" date-format="dd/mm/yy" show-icon placeholder="dd/mm/yyyy" class="w-full" />
            </div>
            <div><label class="field-label">Thời lượng video</label>
              <InputText v-model="form.duration" placeholder="giờ:phút:giây" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="field-label">Phân phối <i class="pi pi-info-circle text-xs text-neutral-400" v-tooltip.top="'Nền tảng hiển thị short này'"></i></label>
              <MultiSelect v-model="form.distribution" :options="platformOptions" placeholder="Chọn nền tảng" class="w-full" />
            </div>
            <div><label class="field-label">Giá mua lẻ nội dung (VNĐ)</label>
              <InputNumber v-model="form.price" class="w-full" :use-grouping="true" placeholder="0" />
            </div>
          </div>
          <div class="flex items-center gap-2"><Checkbox v-model="form.isVisible" binary input-id="sv" /><label for="sv">Hiển thị (xuất bản)</label></div>
        </div>

        <!-- Cot giua: thumbnail 9:16 -->
        <div>
          <label class="field-label">Ảnh thumbnail (Tỉ lệ 9:16)</label>
          <div class="aspect-[9/16] bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center relative">
            <img v-if="form.thumbnail" :src="form.thumbnail" class="absolute inset-0 w-full h-full object-cover" alt="thumbnail" />
            <span v-else class="text-xs text-neutral-400 px-2 text-center">Chưa có ảnh<br />(tỉ lệ 9:16)</span>
            <Button v-if="form.thumbnail" icon="pi pi-trash" size="small" severity="danger" text class="absolute top-1 right-1" @click="form.thumbnail = ''" />
          </div>
          <InputText v-model="form.thumbnail" class="w-full mt-2" placeholder="URL ảnh thumbnail" />
        </div>

        <!-- Cot phai: video -->
        <div>
          <label class="field-label">Video</label>
          <div class="aspect-[9/16] bg-neutral-100 dark:bg-neutral-800 rounded-lg flex flex-col items-center justify-center gap-2 p-3 text-center">
            <i class="pi pi-video text-3xl text-neutral-400"></i>
            <span class="text-xs text-neutral-500 break-all">{{ selectedFileLabel || 'Chưa chọn video' }}</span>
            <span v-if="form.videoFileId" class="text-[11px] text-neutral-400 break-all">{{ form.videoFileId }}</span>
          </div>
          <Dropdown v-model="form.videoFileId" :options="files" option-label="label" option-value="id" editable filter
            :loading="loadingFiles" placeholder="Chọn từ thư viện Tập tin" class="w-full mt-2" />
          <InputText v-model="form.videoFileId" class="w-full mt-1" placeholder="...hoặc nhập ID file thủ công" />
          <div class="mt-3">
            <MediaUploader @done="onUploadDone" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Đóng" text @click="dlg = false" />
        <Button label="Lưu" icon="pi pi-check" :loading="saving" @click="save" :disabled="!form.title.trim()" />
      </template>
    </Dialog>
    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useHead({ title: 'Short - VTC ANY CMS' });

const { can } = useCmsAuth();
const confirm = useConfirm();
const api = useApi();
const toast = useToast();
const { items, meta, loading, load, onPage, saveItem, confirmDelete } = useCatalog('shorts');
const { files: vodFiles, loadingFiles, loadDoneFiles, fileLabel } = useVodFiles();
const files = computed(() => vodFiles.value.map((f) => ({ id: f.id, label: fileLabel(f) })));
const selectedFileLabel = computed(() => files.value.find((f) => f.id === form.value.videoFileId)?.label || '');

const categories = ref<any[]>([]);
const loadingCats = ref(false);
const plans = ref<any[]>([]);
const loadingPlans = ref(false);
const ageOptions = ['Mọi độ tuổi', '13+', '16+', '18+'];
const platformOptions = ['Website', 'Mobile App', 'TV App'];

function categoryName(id: any): string { return categories.value.find((c) => c.id === id)?.name || '—'; }
function planName(id: any): string { return plans.value.find((p) => p.id === id)?.name || 'Có gói'; }

async function loadRefs() {
  loadingCats.value = true; loadingPlans.value = true;
  try { const r = await api.get<any>('/admin/categories'); categories.value = r.data || []; } catch { categories.value = []; }
  finally { loadingCats.value = false; }
  try { const r = await api.get<any>('/admin/catalog/plans', { page: 1, limit: 100 }); plans.value = r.data || []; } catch { plans.value = []; }
  finally { loadingPlans.value = false; }
}

const dlg = ref(false);
const editing = ref<any>(null);
const saving = ref(false);
const publishedDate = ref<Date | null>(null);
const emptyForm = () => ({ title: '', description: '', categoryId: null as any, planId: null as any, ageLimit: null as any, duration: '', distribution: [] as string[], price: null as number | null, videoFileId: '', thumbnail: '', isVisible: true });
const form = ref(emptyForm());

function openAdd() {
  editing.value = null;
  form.value = emptyForm();
  publishedDate.value = new Date();
  dlg.value = true; loadDoneFiles(); loadRefs();
}
function openEdit(s: any) {
  editing.value = s;
  form.value = {
    title: s.title || '', description: s.description || '',
    categoryId: s.categoryId ?? null, planId: s.planId ?? null, ageLimit: s.ageLimit ?? null,
    duration: s.duration || '', distribution: Array.isArray(s.distribution) ? s.distribution : [],
    price: s.price ?? null, videoFileId: s.videoFileId || '', thumbnail: s.thumbnail || '',
    isVisible: s.isVisible !== false,
  };
  publishedDate.value = s.publishedAt ? new Date(s.publishedAt) : null;
  dlg.value = true; loadDoneFiles(); loadRefs();
}
function onUploadDone(uploadId: string) {
  form.value.videoFileId = uploadId;
  loadDoneFiles();
  toast.add({ severity: 'success', summary: 'Upload xong', detail: 'Đã gắn file video vừa tải lên vào short.', life: 3000 });
}
async function togglePublish(row: any) {
  const action = row.isVisible ? 'unpublish' : 'publish';
  try {
    await api.post(`/admin/catalog/shorts/${row.id}/${action}`);
    toast.add({ severity: 'success', summary: row.isVisible ? 'Đã ẩn short' : 'Đã xuất bản short', life: 2500 });
    load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.error?.message || e?.message, life: 3000 });
  }
}
async function save() {
  saving.value = true;
  const body: any = { ...form.value };
  body.publishedAt = publishedDate.value ? publishedDate.value.toISOString() : null;
  const ok = await saveItem(editing.value?.id || null, body, 'Đã lưu short');
  saving.value = false;
  if (ok) { dlg.value = false; load(); }
}
onMounted(() => { load(); loadRefs(); });
</script>
