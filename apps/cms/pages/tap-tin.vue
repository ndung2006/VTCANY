<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm text-neutral-400">Tổng: {{ meta.total }} tập tin (thư viện upload, chỉ đọc)</p>

    <div class="surface-card p-4">
      <DataTable :value="items" :loading="loading" paginator :rows="20" :total-records="meta.total"
        lazy :first="(meta.page - 1) * meta.limit" @page="onPage" size="small">
        <Column field="filename" header="Tên file" />
        <Column field="id" header="ID" class="text-xs" style="width:14rem" />
        <Column header="Dung lượng" style="width:9rem">
          <template #body="{ data }">{{ fmtSize(data.size) }}</template>
        </Column>
        <Column field="status" header="Trạng thái upload" style="width:10rem">
          <template #body="{ data }"><Tag :value="data.status || '—'" :severity="data.status === 'complete' ? 'success' : 'warn'" /></template>
        </Column>
        <Column header="Transcode" style="width:10rem">
          <template #body="{ data }"><Tag :value="data.transcode || '—'" :severity="transcodeSev(data.transcode)" /></template>
        </Column>
        <Column field="createdAt" header="Ngày tạo">
          <template #body="{ data }">{{ fmtDate(data.createdAt) }}</template>
        </Column>
      </DataTable>
    </div>
    <Toast />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useHead({ title: 'Tập tin - VTC ANY CMS' });

const api = useApi();
const items = ref<any[]>([]);
const meta = ref({ page: 1, limit: 20, total: 0 });
const loading = ref(true);

function transcodeSev(t: string) {
  return { pending: 'warn', processing: 'info', done: 'success', error: 'danger' }[t] || 'secondary';
}
async function load() {
  loading.value = true;
  try {
    const r = await api.get<any>('/admin/catalog/files/all', { page: meta.value.page, limit: meta.value.limit });
    items.value = r.data || [];
    meta.value = { ...meta.value, ...r.meta };
  } finally { loading.value = false; }
}
function onPage(e: any) { meta.value.page = e.page + 1; load(); }
onMounted(load);
</script>
