<script setup lang="ts">
  import { ref, computed, watch } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import Popover from "primevue/popover"
  import Button from "primevue/button"
  import InputText from "primevue/inputtext"
  import Checkbox from "primevue/checkbox"
  import Select from "primevue/select"
  import TabView from "primevue/tabview"
  import TabPanel from "primevue/tabpanel"
  import ProgressSpinner from "primevue/progressspinner"

  export interface ColumnFilterValue {
    column: string
    operator: string
    value: unknown
  }

  const props = defineProps<{
    column: string
    connectionId: string
    schema: string
    table: string
    currentFilter?: ColumnFilterValue
  }>()

  const emit = defineEmits<{
    (e: "apply", filter: ColumnFilterValue): void
    (e: "clear"): void
  }>()

  const popover = ref<InstanceType<typeof Popover> | null>(null)
  const loading = ref(false)
  const distinctValues = ref<string[]>([])
  const searchText = ref("")
  const selectedValues = ref<string[]>([])
  const customOperator = ref("contains")
  const customValue = ref("")
  const activeTab = ref(0)

  const operators = [
    { label: "Contains", value: "contains" },
    { label: "Equals", value: "equals" },
    { label: "Not Equals", value: "notEquals" },
    { label: "Starts With", value: "startsWith" },
    { label: "Ends With", value: "endsWith" },
    { label: "Greater Than", value: "gt" },
    { label: "Less Than", value: "lt" },
    { label: "Is NULL", value: "isNull" },
    { label: "Is Not NULL", value: "isNotNull" },
  ]

  const filteredDistinctValues = computed(() => {
    if (!searchText.value) return distinctValues.value
    const search = searchText.value.toLowerCase()
    return distinctValues.value.filter((v) =>
      String(v).toLowerCase().includes(search)
    )
  })

  const allSelected = computed(() => {
    return (
      filteredDistinctValues.value.length > 0 &&
      filteredDistinctValues.value.every((v) =>
        selectedValues.value.includes(v)
      )
    )
  })

  const hasActiveFilter = computed(() => !!props.currentFilter)

  watch(
    () => props.currentFilter,
    (filter) => {
      if (filter) {
        if (filter.operator === "in" && Array.isArray(filter.value)) {
          selectedValues.value = filter.value as string[]
          activeTab.value = 0
        } else {
          customOperator.value = filter.operator
          customValue.value = String(filter.value || "")
          activeTab.value = 1
        }
      } else {
        selectedValues.value = []
        customOperator.value = "contains"
        customValue.value = ""
      }
    },
    { immediate: true }
  )

  async function loadDistinctValues() {
    if (distinctValues.value.length > 0) return

    loading.value = true
    try {
      const values = await invoke<unknown[]>("get_distinct_values", {
        connectionId: props.connectionId,
        schema: props.schema,
        table: props.table,
        column: props.column,
        limit: 200,
      })
      distinctValues.value = values.map((v) => String(v))
    } catch (e) {
      console.error("Failed to load distinct values:", e)
    } finally {
      loading.value = false
    }
  }

  function toggle(event: Event) {
    popover.value?.toggle(event)
    loadDistinctValues()
  }

  function toggleSelectAll() {
    if (allSelected.value) {
      selectedValues.value = selectedValues.value.filter(
        (v) => !filteredDistinctValues.value.includes(v)
      )
    } else {
      const newValues = new Set(selectedValues.value)
      filteredDistinctValues.value.forEach((v) => newValues.add(v))
      selectedValues.value = Array.from(newValues)
    }
  }

  function applyFilter() {
    if (activeTab.value === 0) {
      if (selectedValues.value.length > 0) {
        emit("apply", {
          column: props.column,
          operator: "in",
          value: selectedValues.value,
        })
      } else {
        emit("clear")
      }
    } else {
      if (
        customOperator.value === "isNull" ||
        customOperator.value === "isNotNull"
      ) {
        emit("apply", {
          column: props.column,
          operator: customOperator.value,
          value: null,
        })
      } else if (customValue.value) {
        emit("apply", {
          column: props.column,
          operator: customOperator.value,
          value: customValue.value,
        })
      } else {
        emit("clear")
      }
    }
    popover.value?.hide()
  }

  function clearFilter() {
    selectedValues.value = []
    customOperator.value = "contains"
    customValue.value = ""
    emit("clear")
    popover.value?.hide()
  }

  defineExpose({ toggle })
</script>

<template>
  <Button
    type="button"
    :icon="hasActiveFilter ? 'pi pi-filter-fill' : 'pi pi-filter'"
    :class="{ 'filter-active': hasActiveFilter }"
    text
    rounded
    size="small"
    @click="toggle"
    v-tooltip="'Filter'"
  />
  <Popover ref="popover" class="column-filter-popover">
    <div class="filter-content">
      <TabView v-model:activeIndex="activeTab">
        <TabPanel value="0" header="Values">
          <div class="values-tab">
            <InputText
              v-model="searchText"
              placeholder="Search values..."
              class="search-input"
              size="small"
            />
            <div v-if="loading" class="loading-state">
              <ProgressSpinner style="width: 24px; height: 24px" />
            </div>
            <div v-else class="values-list">
              <div class="select-all">
                <Checkbox
                  :model-value="allSelected"
                  :indeterminate="selectedValues.length > 0 && !allSelected"
                  binary
                  @change="toggleSelectAll"
                />
                <span @click="toggleSelectAll">Select All</span>
              </div>
              <div
                v-for="val in filteredDistinctValues"
                :key="val"
                class="value-item"
              >
                <Checkbox v-model="selectedValues" :value="val" />
                <span class="value-text">{{ val }}</span>
              </div>
              <div v-if="filteredDistinctValues.length === 0" class="no-values">
                No values found
              </div>
            </div>
          </div>
        </TabPanel>
        <TabPanel value="1" header="Custom">
          <div class="custom-tab">
            <Select
              v-model="customOperator"
              :options="operators"
              option-label="label"
              option-value="value"
              placeholder="Select operator"
              class="operator-select"
            />
            <InputText
              v-if="
                customOperator !== 'isNull' && customOperator !== 'isNotNull'
              "
              v-model="customValue"
              placeholder="Enter value..."
              class="value-input"
            />
          </div>
        </TabPanel>
      </TabView>
      <div class="filter-actions">
        <Button
          label="Clear"
          icon="pi pi-times"
          text
          size="small"
          @click="clearFilter"
        />
        <Button
          label="Apply"
          icon="pi pi-check"
          size="small"
          @click="applyFilter"
        />
      </div>
    </div>
  </Popover>
</template>

<style scoped>
  .filter-active {
    color: var(--p-primary-color) !important;
  }

  .filter-content {
    width: 280px;
  }

  .values-tab {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-input {
    width: 100%;
  }

  .loading-state {
    display: flex;
    justify-content: center;
    padding: 1rem;
  }

  .values-list {
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .select-all {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--p-surface-200);
    margin-bottom: 0.25rem;
    cursor: pointer;
    font-weight: 600;
  }

  .value-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .value-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.85rem;
  }

  .no-values {
    text-align: center;
    color: var(--p-text-muted-color);
    padding: 1rem;
    font-size: 0.85rem;
  }

  .custom-tab {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .operator-select,
  .value-input {
    width: 100%;
  }

  .filter-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--p-surface-200);
    margin-top: 0.75rem;
  }
</style>
