<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-neutral-400">Tổng: {{ cats.length }} danh mục</p>
      <Button label="Thêm danh mục" icon="pi pi-plus" @click="openAdd" />
    </div>
    <div class="surface-card p-4">
      <DataTable :value="cats" :loading="loading" size="small">
        <Column field="name" header="Tên" />
        <Column field="slug" header="Slug" class="text-xs" />
        <Column header="Danh mục cha"><template #body="{ data }">{{ parentName(data.parentId) }}</template></Column>
        <Column field="sortOrder" header="Thứ tự" />
        <Column header="Hiển thị"><template #body="{ data }"><Tag :value="data.isVisible ? 'Hiện' : 'Ẩn'" :severity="data.isVisible ? 'success' : 'secondary'" /></template></Column>
        <Column header="Thao tác">
          <template #body="{ data }">
            <Button label="Sửa" size="small" text @click="openEdit(data)" />
            <Button label="Xóa" size="small" text severity="danger" @click="remove(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dlg" modal :header="editing ? 'Sửa danh mục' : 'Thêm danh mục'" class="w-full max-w-xl">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="field-label">Tên *</label><InputText v-model="form.name" class="w-full" /></div>
        <div class="col-span-2">
          <label class="field-label">Slug</label>
          <InputText v-model="form.slug" class="w-full" placeholder="tự sinh từ tên" />
          <small class="text-neutral-500">Preview: {{ slugPreview }}</small>
        </div>
        <div><label class="field-label">Danh mục cha</label>
          <Dropdown v-model="form.parentId" :options="parentOpts" option-label="name" option-value="id"
            placeholder="— Không có —" class="w-full" show-clear />
        </div>
        <div><label class="field-label">Thứ tự</label><InputNumber v-model="form.sortOrder" class="w-full" /></div>
        <div><label class="field-label">Icon</label><InputText v-model="form.icon" class="w-full" placeholder="pi pi-..." /></div>
        <div><label class="field-label">Thumbnail URL</label><InputText v-model="form.thumbnail" class="w-full" /></div>
        <div class="col-span-2"><label class="field-label">Mô tả</label><Textarea v-model="form.description" rows="2" class="w-full" /></div>
        <div class="flex items-center gap-2"><InputSwitch v-model="form.isVisible" input-id="vis" /><label for="vis">Hiển thị</label></div>
        <div />
        <div><label class="field-label">Platforms</label><MultiSelect v-model="form.platforms" :options="platformOpts" class="w-full" /></div>
        <div><label class="field-label">Áp dụng cho</label><MultiSelect v-model="form.appliesTo" :options="appliesOpts" class="w-full" /></div>
      </div>
      <template #footer>
        <Button label="Hủy" text @click="dlg = false" />
        <Button label="Lưu" :loading="saving" :disabled="!form.name.trim()" @click="save" />
      </template>
    </Dialog>
    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useHead({ title: 'Danh mục - VTC ANY CMS' });

const api = useApi();
const toast = useToast();
const confirm = useConfirm();
const cats = ref<any[]>([]);
const loading = ref(true);
const dlg = ref(false);
const editing = ref<any>(null);
const saving = ref(false);
const platformOpts = ['WEB', 'MOBILE', 'TV'];
const appliesOpts = ['phim', 'video', 'short', 'giai-tri'];

const blank = () => ({ name: '', slug: '', parentId: null, icon: '', thumbnail: '', description: '', sortOrder: 0, isVisible: true, platforms: ['WEB'], appliesTo: ['phim'] });
const form = ref(blank());
const parentOpts = computed(() => cats.value.filter((c) => !editing.value || c.id !== editing.value.id));
const slugPreview = computed(() => form.value.slug || slugify(form.value.name));

function slugify(s: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function parentName(id: string | null) {
  return cats.value.find((c) => c.id === id)?.name || '—';
}
async function load() {
  loading.value = true;
  try { const r = await api.get<any>('/admin/categories'); cats.value = r.data || []; }
  catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được danh mục', life: 3000 }); }
  finally { loading.value = false; }
}
function openAdd() { editing.value = null; form.value = blank(); dlg.value = true; }
function openEdit(c: any) {
  editing.value = c;
  form.value = { name: c.name || '', slug: c.slug || '', parentId: c.parentId ?? null, icon: c.icon || '', thumbnail: c.thumbnail || '', description: c.description || '', sortOrder: c.sortOrder ?? 0, isVisible: c.isVisible !== false, platforms: c.platforms || ['WEB'], appliesTo: c.appliesTo || [] };
  dlg.value = true;
}
async function save() {
  saving.value = true;
  const body: any = { ...form.value, slug: form.value.slug || undefined };
  try {
    if (editing.value) await api.patch(`/admin/categories/${editing.value.id}`, body);
    else await api.post('/admin/categories', body);
    toast.add({ severity: 'success', summary: 'Xong', detail: 'Đã lưu danh mục', life: 3000 });
    dlg.value = false; load();
  } catch (e: any) { toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.message || 'Lưu thất bại', life: 3000 }); }
  finally { saving.value = false; }
}
function remove(c: any) {
  confirm.require({
    message: `Xóa danh mục "${c.name}"?`, header: 'Xác nhận', icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Xóa', rejectLabel: 'Hủy', acceptClass: 'p-button-danger',
    accept: async () => {
      try { await api.del(`/admin/categories/${c.id}`); toast.add({ severity: 'success', summary: 'Xong', detail: 'Đã xóa', life: 3000 }); load(); }
      catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Xóa thất bại', life: 3000 }); }
    },
  });
}
onMounted(load);
</script>
