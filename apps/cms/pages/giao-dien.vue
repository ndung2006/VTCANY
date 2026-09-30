<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-neutral-400">Tổng: {{ blocks.length }} blocks</p>
      <Button label="Thêm block" icon="pi pi-plus" @click="openAdd" />
    </div>
    <div class="surface-card p-4">
      <DataTable :value="blocks" :loading="loading" size="small">
        <Column field="order" header="Thứ tự" style="width:6rem" />
        <Column header="Loại">
          <template #body="{ data }"><Tag :value="data.type" :severity="data.type === 'HERO_CAROUSEL' ? 'info' : 'secondary'" /></template>
        </Column>
        <Column field="title" header="Tiêu đề" />
        <Column field="card_aspect" header="Tỉ lệ card" />
        <Column header="Trạng thái">
          <template #body="{ data }"><Tag :value="data.is_active ? 'Bật' : 'Tắt'" :severity="data.is_active ? 'success' : 'secondary'" /></template>
        </Column>
        <Column header="Thao tác">
          <template #body="{ data }">
            <Button label="Sửa" size="small" text @click="openEdit(data)" />
            <Button label="Xóa" size="small" text severity="danger" @click="remove(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dlg" modal :header="editing ? 'Sửa block' : 'Thêm block'" class="w-full max-w-xl">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="field-label">Thứ tự</label><InputNumber v-model="form.order" class="w-full" /></div>
          <div><label class="field-label">Loại *</label>
            <Dropdown v-model="form.type" :options="['HERO_CAROUSEL', 'HORIZONTAL_LIST']" class="w-full" />
          </div>
        </div>
        <div><label class="field-label">Tiêu đề</label><InputText v-model="form.title" class="w-full" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="field-label">Target URL</label><InputText v-model="form.target_url" class="w-full" /></div>
          <div><label class="field-label">Tỉ lệ card</label>
            <Dropdown v-model="form.card_aspect" :options="['16/9', '2/3', '1/1']" class="w-full" editable />
          </div>
        </div>
        <div class="flex items-center gap-2"><InputSwitch v-model="form.is_active" input-id="ba" /><label for="ba">Kích hoạt</label></div>
        <div>
          <label class="field-label">Items (JSON)</label>
          <Textarea v-model="itemsText" rows="5" class="w-full font-mono text-xs" placeholder='[{"title":"...","image":"...","url":"..."}]' />
          <small v-if="itemsError" class="text-red-400">{{ itemsError }}</small>
        </div>
      </div>
      <template #footer>
        <Button label="Hủy" text @click="dlg = false" />
        <Button label="Lưu" :loading="saving" :disabled="!!itemsError" @click="save" />
      </template>
    </Dialog>
    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useHead({ title: 'Giao diện - VTC ANY CMS' });

const api = useApi();
const toast = useToast();
const confirm = useConfirm();
const blocks = ref<any[]>([]);
const loading = ref(true);
const dlg = ref(false);
const editing = ref<any>(null);
const saving = ref(false);
const form = ref({ order: 0, type: 'HORIZONTAL_LIST', title: '', target_url: '', card_aspect: '16/9', is_active: true });
const itemsText = ref('[]');
const itemsError = ref('');

watch(itemsText, (v) => {
  try { const p = JSON.parse(v || '[]'); itemsError.value = Array.isArray(p) ? '' : 'Items phải là mảng JSON.'; }
  catch { itemsError.value = 'JSON không hợp lệ.'; }
});

async function load() {
  loading.value = true;
  try { const r = await api.get<any>('/admin/layout-blocks'); blocks.value = r.data || []; }
  catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được layout blocks', life: 3000 }); }
  finally { loading.value = false; }
}
function openAdd() {
  editing.value = null;
  form.value = { order: blocks.value.length, type: 'HORIZONTAL_LIST', title: '', target_url: '', card_aspect: '16/9', is_active: true };
  itemsText.value = '[]'; dlg.value = true;
}
function openEdit(b: any) {
  editing.value = b;
  form.value = { order: b.order ?? 0, type: b.type, title: b.title || '', target_url: b.target_url || '', card_aspect: b.card_aspect || '16/9', is_active: b.is_active !== false };
  itemsText.value = JSON.stringify(b.items || [], null, 2);
  dlg.value = true;
}
async function save() {
  if (itemsError.value) return;
  saving.value = true;
  const body = { ...form.value, items: JSON.parse(itemsText.value || '[]') };
  try {
    if (editing.value) await api.patch(`/admin/layout-blocks/${editing.value.id}`, body);
    else await api.post('/admin/layout-blocks', body);
    toast.add({ severity: 'success', summary: 'Xong', detail: 'Đã lưu block', life: 3000 });
    dlg.value = false; load();
  } catch (e: any) { toast.add({ severity: 'error', summary: 'Lỗi', detail: e?.response?.data?.message || 'Lưu thất bại', life: 3000 }); }
  finally { saving.value = false; }
}
function remove(b: any) {
  confirm.require({
    message: `Xóa block "${b.title || b.type}"?`, header: 'Xác nhận', icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Xóa', rejectLabel: 'Hủy', acceptClass: 'p-button-danger',
    accept: async () => {
      try { await api.del(`/admin/layout-blocks/${b.id}`); toast.add({ severity: 'success', summary: 'Xong', detail: 'Đã xóa', life: 3000 }); load(); }
      catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Xóa thất bại', life: 3000 }); }
    },
  });
}
onMounted(load);
</script>
