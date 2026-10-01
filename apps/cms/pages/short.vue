<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-neutral-400">Tổng: {{ meta.total }} short</p>
      <Button v-if="can('catalog:write')" label="Thêm short" icon="pi pi-plus" @click="openAdd" />
    </div>

    <div class="surface-card p-4">
      <DataTable :value="items" :loading="loading" paginator :rows="20" :total-records="meta.total"
        lazy :first="(meta.page - 1) * meta.limit" @page="onPage" size="small">
        <Column field="title" header="Tiêu đề" />
        <Column field="videoFileId" header="File video" class="text-xs" />
        <Column header="Hiển thị" style="width:8rem">
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

    <Dialog v-model:visible="dlg" modal :header="editing ? 'Sửa short' : 'Thêm short'" class="w-full max-w-lg">
      <div class="flex flex-col gap-3">
        <div><label class="field-label">Tiêu đề *</label><InputText v-model="form.title" class="w-full" /></div>
        <div><label class="field-label">Mô tả</label><Textarea v-model="form.description" rows="3" class="w-full" /></div>
        <div><label class="field-label">File video (chọn từ thư viện Tập tin)</label>
          <Dropdown v-model="form.videoFileId" :options="files" option-label="label" option-value="id" editable filter
            :loading="loadingFiles" placeholder="Chọn file đã transcode xong" class="w-full" />
          <InputText v-model="form.videoFileId" class="w-full mt-1" placeholder="...hoặc nhập ID file thủ công" />
        </div>
        <div><label class="field-label">Thumbnail (URL)</label><InputText v-model="form.thumbnail" class="w-full" /></div>
        <div class="flex items-center gap-2"><Checkbox v-model="form.isVisible" binary input-id="sv" /><label for="sv">Hiển thị</label></div>
      </div>
      <template #footer>
        <Button label="Hủy" text @click="dlg = false" />
        <Button :label="editing ? 'Lưu' : 'Tạo'" :loading="saving" @click="save" :disabled="!form.title.trim()" />
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

const dlg = ref(false);
const editing = ref<any>(null);
const saving = ref(false);
const form = ref({ title: '', description: '', videoFileId: '', thumbnail: '', isVisible: true });

function openAdd() { editing.value = null; form.value = { title: '', description: '', videoFileId: '', thumbnail: '', isVisible: true }; dlg.value = true; loadDoneFiles(); }
function openEdit(s: any) {
  editing.value = s;
  form.value = { title: s.title || '', description: s.description || '', videoFileId: s.videoFileId || '', thumbnail: s.thumbnail || '', isVisible: s.isVisible !== false };
  dlg.value = true; loadDoneFiles();
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
  const ok = await saveItem(editing.value?.id || null, { ...form.value }, 'Đã lưu short');
  saving.value = false;
  if (ok) { dlg.value = false; load(); }
}
onMounted(load);
</script>
