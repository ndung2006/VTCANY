<template>
  <div class="flex flex-col gap-4">
    <div class="flex gap-2">
      <Button v-for="t in tabs" :key="t.key" :label="t.label" :icon="t.icon"
        :severity="tab === t.key ? undefined : 'secondary'" :outlined="tab !== t.key"
        @click="tab = t.key" size="small" />
    </div>

    <!-- TAB 1: Layout blocks cũ (giữ nguyên) -->
    <template v-if="tab === 'blocks'">
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
    </template>

    <!-- TAB 2: Banner theo mục (catalog) -->
    <template v-if="tab === 'banners'">
      <div class="flex items-center justify-between">
        <p class="text-sm text-neutral-400">Tổng: {{ bannerMeta.total }} banner</p>
        <Button v-if="can('catalog:write')" label="Thêm banner" icon="pi pi-plus" @click="openBannerAdd" />
      </div>
      <div class="surface-card p-4">
        <DataTable :value="banners" :loading="bannerLoading" paginator :rows="20" :total-records="bannerMeta.total"
          lazy :first="(bannerMeta.page - 1) * bannerMeta.limit" @page="(e: any) => { bannerMeta.page = e.page + 1; loadBanners(); }" size="small">
          <Column field="title" header="Tiêu đề" />
          <Column header="Mục">
            <template #body="{ data }">{{ sectionLabel(data.section) }}</template>
          </Column>
          <Column field="platform" header="Nền tảng" />
          <Column field="sortOrder" header="Thứ tự" style="width:6rem" />
          <Column header="Hiển thị" style="width:8rem">
            <template #body="{ data }"><Tag :value="data.isVisible ? 'Bật' : 'Tắt'" :severity="sevVisible(data.isVisible)" /></template>
          </Column>
          <Column header="Thao tác" style="min-width:10rem">
            <template #body="{ data }">
              <Button v-if="can('catalog:write')" label="Sửa" size="small" text @click="openBannerEdit(data)" />
              <Button v-if="can('catalog:write')" label="Xóa" size="small" text severity="danger" @click="bannerCtl.confirmDelete(confirm, data.id, data.title)" />
            </template>
          </Column>
        </DataTable>
      </div>

      <Dialog v-model:visible="bannerDlg" modal :header="editingBanner ? 'Sửa banner' : 'Thêm banner'" class="w-full max-w-xl">
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2"><label class="field-label">Tiêu đề *</label><InputText v-model="bannerForm.title" class="w-full" /></div>
          <div><label class="field-label">Mục</label>
            <Dropdown v-model="bannerForm.section" :options="sections" option-label="label" option-value="value" class="w-full" />
          </div>
          <div><label class="field-label">Nền tảng</label>
            <Dropdown v-model="bannerForm.platform" :options="['web', 'mobile']" class="w-full" />
          </div>
          <div><label class="field-label">Thứ tự</label><InputNumber v-model="bannerForm.sortOrder" class="w-full" :use-grouping="false" /></div>
          <div class="flex items-end pb-2"><div class="flex items-center gap-2"><Checkbox v-model="bannerForm.isVisible" binary input-id="bvis" /><label for="bvis">Hiển thị</label></div></div>
          <div><label class="field-label">Hiển thị từ</label><Calendar v-model="bannerForm.visibleFrom" date-format="yy-mm-dd" show-icon class="w-full" /></div>
          <div><label class="field-label">Hiển thị đến</label><Calendar v-model="bannerForm.visibleTo" date-format="yy-mm-dd" show-icon class="w-full" /></div>
          <div class="col-span-2"><label class="field-label">Ảnh web (URL)</label><InputText v-model="bannerForm.imageWeb" class="w-full" /></div>
          <div class="col-span-2"><label class="field-label">Ảnh mobile (URL)</label><InputText v-model="bannerForm.imageMobile" class="w-full" /></div>
        </div>
        <template #footer>
          <Button label="Hủy" text @click="bannerDlg = false" />
          <Button :label="editingBanner ? 'Lưu' : 'Tạo'" :loading="bannerSaving" @click="saveBanner" :disabled="!bannerForm.title.trim()" />
        </template>
      </Dialog>
    </template>

    <!-- TAB 3: Khối giao diện theo mục (catalog) -->
    <template v-if="tab === 'rails'">
      <div class="flex items-center justify-between">
        <p class="text-sm text-neutral-400">Tổng: {{ railMeta.total }} khối</p>
        <Button v-if="can('catalog:write')" label="Thêm khối" icon="pi pi-plus" @click="openRailAdd" />
      </div>
      <div class="surface-card p-4">
        <DataTable :value="rails" :loading="railLoading" paginator :rows="20" :total-records="railMeta.total"
          lazy :first="(railMeta.page - 1) * railMeta.limit" @page="(e: any) => { railMeta.page = e.page + 1; loadRails(); }" size="small">
          <Column field="title" header="Tiêu đề" />
          <Column header="Mục">
            <template #body="{ data }">{{ sectionLabel(data.section) }}</template>
          </Column>
          <Column field="platform" header="Nền tảng" />
          <Column field="sortOrder" header="Thứ tự" style="width:6rem" />
          <Column header="Hiển thị" style="width:8rem">
            <template #body="{ data }"><Tag :value="data.isVisible ? 'Bật' : 'Tắt'" :severity="sevVisible(data.isVisible)" /></template>
          </Column>
          <Column header="Thao tác" style="min-width:10rem">
            <template #body="{ data }">
              <Button v-if="can('catalog:write')" label="Sửa" size="small" text @click="openRailEdit(data)" />
              <Button v-if="can('catalog:write')" label="Xóa" size="small" text severity="danger" @click="railCtl.confirmDelete(confirm, data.id, data.title)" />
            </template>
          </Column>
        </DataTable>
      </div>

      <Dialog v-model:visible="railDlg" modal :header="editingRail ? 'Sửa khối' : 'Thêm khối'" class="w-full max-w-xl">
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2"><label class="field-label">Tiêu đề *</label><InputText v-model="railForm.title" class="w-full" /></div>
          <div><label class="field-label">Mục</label>
            <Dropdown v-model="railForm.section" :options="sections" option-label="label" option-value="value" class="w-full" />
          </div>
          <div><label class="field-label">Nền tảng</label>
            <Dropdown v-model="railForm.platform" :options="['web', 'mobile']" class="w-full" />
          </div>
          <div><label class="field-label">Loại nội dung</label><InputText v-model="railForm.contentType" class="w-full" placeholder="vd: movies" /></div>
          <div><label class="field-label">ID danh mục</label><InputText v-model="railForm.categoryId" class="w-full" /></div>
          <div><label class="field-label">Kiểu hiển thị</label><InputText v-model="railForm.style" class="w-full" placeholder="vd: horizontal" /></div>
          <div><label class="field-label">Thứ tự</label><InputNumber v-model="railForm.sortOrder" class="w-full" :use-grouping="false" /></div>
          <div><label class="field-label">Hiển thị từ</label><Calendar v-model="railForm.visibleFrom" date-format="yy-mm-dd" show-icon class="w-full" /></div>
          <div><label class="field-label">Hiển thị đến</label><Calendar v-model="railForm.visibleTo" date-format="yy-mm-dd" show-icon class="w-full" /></div>
          <div class="col-span-2 flex items-center gap-2"><Checkbox v-model="railForm.isVisible" binary input-id="rvis" /><label for="rvis">Hiển thị</label></div>
        </div>
        <template #footer>
          <Button label="Hủy" text @click="railDlg = false" />
          <Button :label="editingRail ? 'Lưu' : 'Tạo'" :loading="railSaving" @click="saveRail" :disabled="!railForm.title.trim()" />
        </template>
      </Dialog>
    </template>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useHead({ title: 'Giao diện - VTC ANY CMS' });

const { can } = useCmsAuth();
const api = useApi();
const toast = useToast();
const confirm = useConfirm();

const tabs = [
  { key: 'blocks', label: 'Layout blocks', icon: 'pi pi-th-large' },
  { key: 'banners', label: 'Banner theo mục', icon: 'pi pi-image' },
  { key: 'rails', label: 'Khối giao diện theo mục', icon: 'pi pi-list' },
];
const tab = ref('blocks');
const sections = [
  { label: 'Trang chủ', value: 'home' },
  { label: 'Truyền hình', value: 'tv' },
  { label: 'Phim', value: 'movies' },
  { label: 'Video', value: 'video' },
  { label: 'Short', value: 'short' },
  { label: 'Giải trí', value: 'entertainment' },
];
function sectionLabel(s: string) { return sections.find((x) => x.value === s)?.label || s || '—'; }
function toDate(v: any) { return v ? new Date(v) : null; }
function toIso(d: any) { return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : (d || ''); }

// ---- TAB blocks (logic cũ giữ nguyên) ----
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

// ---- TAB banners (catalog) ----
const bannerCtl = useCatalog('banners');
const banners = bannerCtl.items;
const bannerMeta = bannerCtl.meta;
const bannerLoading = bannerCtl.loading;
const loadBanners = bannerCtl.load;
const bannerDlg = ref(false);
const editingBanner = ref<any>(null);
const bannerSaving = ref(false);
const bannerForm = ref({ title: '', section: 'home', platform: 'web', sortOrder: 0, visibleFrom: null as any, visibleTo: null as any, isVisible: true, imageWeb: '', imageMobile: '' });

function openBannerAdd() {
  editingBanner.value = null;
  bannerForm.value = { title: '', section: 'home', platform: 'web', sortOrder: 0, visibleFrom: null, visibleTo: null, isVisible: true, imageWeb: '', imageMobile: '' };
  bannerDlg.value = true;
}
function openBannerEdit(b: any) {
  editingBanner.value = b;
  bannerForm.value = { title: b.title || '', section: b.section || 'home', platform: b.platform || 'web', sortOrder: b.sortOrder ?? 0, visibleFrom: toDate(b.visibleFrom), visibleTo: toDate(b.visibleTo), isVisible: b.isVisible !== false, imageWeb: b.imageWeb || '', imageMobile: b.imageMobile || '' };
  bannerDlg.value = true;
}
async function saveBanner() {
  bannerSaving.value = true;
  const ok = await bannerCtl.saveItem(editingBanner.value?.id || null, {
    ...bannerForm.value, visibleFrom: toIso(bannerForm.value.visibleFrom) || undefined, visibleTo: toIso(bannerForm.value.visibleTo) || undefined,
  }, 'Đã lưu banner');
  bannerSaving.value = false;
  if (ok) { bannerDlg.value = false; loadBanners(); }
}

// ---- TAB rails (catalog) ----
const railCtl = useCatalog('rails');
const rails = railCtl.items;
const railMeta = railCtl.meta;
const railLoading = railCtl.loading;
const loadRails = railCtl.load;
const railDlg = ref(false);
const editingRail = ref<any>(null);
const railSaving = ref(false);
const railForm = ref({ title: '', section: 'home', platform: 'web', contentType: '', categoryId: '', style: '', sortOrder: 0, visibleFrom: null as any, visibleTo: null as any, isVisible: true });

function openRailAdd() {
  editingRail.value = null;
  railForm.value = { title: '', section: 'home', platform: 'web', contentType: '', categoryId: '', style: '', sortOrder: 0, visibleFrom: null, visibleTo: null, isVisible: true };
  railDlg.value = true;
}
function openRailEdit(r: any) {
  editingRail.value = r;
  railForm.value = { title: r.title || '', section: r.section || 'home', platform: r.platform || 'web', contentType: r.contentType || '', categoryId: r.categoryId || '', style: r.style || '', sortOrder: r.sortOrder ?? 0, visibleFrom: toDate(r.visibleFrom), visibleTo: toDate(r.visibleTo), isVisible: r.isVisible !== false };
  railDlg.value = true;
}
async function saveRail() {
  railSaving.value = true;
  const ok = await railCtl.saveItem(editingRail.value?.id || null, {
    ...railForm.value, visibleFrom: toIso(railForm.value.visibleFrom) || undefined, visibleTo: toIso(railForm.value.visibleTo) || undefined,
  }, 'Đã lưu khối giao diện');
  railSaving.value = false;
  if (ok) { railDlg.value = false; loadRails(); }
}

watch(tab, (t) => {
  if (t === 'banners') loadBanners();
  if (t === 'rails') loadRails();
});
onMounted(load);
</script>
