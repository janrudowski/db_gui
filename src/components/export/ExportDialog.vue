<script setup lang="ts">
  import { ref, computed } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import { save } from "@tauri-apps/plugin-dialog"
  import { useToast } from "primevue/usetoast"
  import Dialog from "primevue/dialog"
  import Select from "primevue/select"
  import RadioButton from "primevue/radiobutton"
  import Button from "primevue/button"
  import ProgressBar from "primevue/progressbar"

  const props = defineProps<{
    visible: boolean
    connectionId: string
    query: string
    totalRecords: number
  }>()

  const emit = defineEmits<{
    (e: "update:visible", value: boolean): void
  }>()

  const toast = useToast()

  const format = ref<"csv" | "json">("csv")
  const scope = ref<"all" | "limit">("all")
  const limitRows = ref(1000)
  const exporting = ref(false)
  const progress = ref(0)

  const formatOptions = [
    { label: "CSV", value: "csv" },
    { label: "JSON", value: "json" },
  ]

  const limitOptions = [100, 500, 1000, 5000, 10000]

  const estimatedRows = computed(() => {
    return scope.value === "all"
      ? props.totalRecords
      : Math.min(limitRows.value, props.totalRecords)
  })

  async function handleExport() {
    const extension = format.value === "csv" ? "csv" : "json"
    const filePath = await save({
      filters: [
        {
          name: format.value.toUpperCase(),
          extensions: [extension],
        },
      ],
      defaultPath: `export.${extension}`,
    })

    if (!filePath) return

    exporting.value = true
    progress.value = 0

    try {
      const exportQuery =
        scope.value === "limit"
          ? `${props.query} LIMIT ${limitRows.value}`
          : props.query

      await invoke("export_data", {
        connectionId: props.connectionId,
        query: exportQuery,
        format: format.value,
        filePath,
      })

      progress.value = 100
      toast.add({
        severity: "success",
        summary: "Export Complete",
        detail: `Data exported to ${filePath}`,
        life: 3000,
      })

      emit("update:visible", false)
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Export Failed",
        detail: String(e),
        life: 5000,
      })
    } finally {
      exporting.value = false
    }
  }

  function closeDialog() {
    if (!exporting.value) {
      emit("update:visible", false)
    }
  }
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="closeDialog"
    header="Export Data"
    :modal="true"
    :style="{ width: '450px' }"
    :closable="!exporting"
  >
    <div class="export-form">
      <div class="form-group">
        <label>Format</label>
        <Select
          v-model="format"
          :options="formatOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          :disabled="exporting"
        />
      </div>

      <div class="form-group">
        <label>Scope</label>
        <div class="scope-options">
          <div class="scope-option">
            <RadioButton
              v-model="scope"
              input-id="scope-all"
              value="all"
              :disabled="exporting"
            />
            <label for="scope-all"
              >All rows ({{ totalRecords.toLocaleString() }})</label
            >
          </div>
          <div class="scope-option">
            <RadioButton
              v-model="scope"
              input-id="scope-limit"
              value="limit"
              :disabled="exporting"
            />
            <label for="scope-limit">Limit to</label>
            <Select
              v-model="limitRows"
              :options="limitOptions"
              class="limit-select"
              :disabled="exporting || scope !== 'limit'"
            />
            <span>rows</span>
          </div>
        </div>
      </div>

      <div class="export-summary">
        <i class="pi pi-info-circle" />
        <span
          >Will export approximately
          {{ estimatedRows.toLocaleString() }} rows</span
        >
      </div>

      <ProgressBar
        v-if="exporting"
        :value="progress"
        :show-value="false"
        class="export-progress"
      />
    </div>

    <template #footer>
      <Button
        label="Cancel"
        severity="secondary"
        @click="closeDialog"
        :disabled="exporting"
      />
      <Button
        label="Export"
        icon="pi pi-download"
        @click="handleExport"
        :loading="exporting"
      />
    </template>
  </Dialog>
</template>

<style scoped>
  .export-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .scope-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .scope-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .limit-select {
    width: 100px;
  }

  .export-summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--p-surface-100);
    border-radius: 6px;
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
  }

  .export-progress {
    height: 6px;
  }

  .w-full {
    width: 100%;
  }
</style>
