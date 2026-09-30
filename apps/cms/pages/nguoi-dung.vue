<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm text-neutral-400">Tổng: {{ users.length }} người dùng (chỉ xem)</p>
    <div class="surface-card p-4">
      <DataTable :value="users" :loading="loading" paginator :rows="20" size="small">
        <Column field="id" header="ID" class="text-xs" />
        <Column field="email" header="Email" />
        <Column field="phone" header="SĐT" />
        <Column field="provider" header="Provider" />
        <Column header="Trạng thái">
          <template #body="{ data }"><Tag :value="data.status" :severity="data.status === 'active' ? 'success' : 'secondary'" /></template>
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
useHead({ title: 'Người dùng - VTC ANY CMS' });

const api = useApi();
const toast = useToast();
const users = ref<any[]>([]);
const loading = ref(true);

function fmtDate(v: any) {
  if (!v) return '';
  return new Date(typeof v === 'number' ? v : String(v)).toLocaleString('vi-VN');
}
onMounted(async () => {
  try {
    const r = await api.get<any>('/admin/users');
    users.value = r.data || [];
  } catch { toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được người dùng', life: 3000 }); }
  finally { loading.value = false; }
});
</script>
