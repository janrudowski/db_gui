<script setup lang="ts">
  import { ref, computed, watch } from "vue"
  import Sidebar from "primevue/sidebar"
  import TabView from "primevue/tabview"
  import TabPanel from "primevue/tabpanel"
  import Textarea from "primevue/textarea"
  import Button from "primevue/button"

  const props = defineProps<{
    visible: boolean
    value: unknown
    columnName: string
    columnType?: string
    editable?: boolean
  }>()

  const emit = defineEmits<{
    (e: "update:visible", value: boolean): void
    (e: "save", value: unknown): void
  }>()

  const editedValue = ref<string>("")
  const activeTab = ref(0)

  const isJson = computed(() => {
    if (typeof props.value === "object" && props.value !== null) return true
    if (typeof props.value !== "string") return false
    try {
      JSON.parse(props.value as string)
      return true
    } catch {
      return false
    }
  })

  const isBinary = computed(() => {
    const type = props.columnType?.toLowerCase() || ""
    return (
      type.includes("blob") || type.includes("bytea") || type.includes("binary")
    )
  })

  const isImage = computed(() => {
    if (typeof props.value !== "string") return false
    const val = props.value as string

    if (val.startsWith("data:image/")) return true

    if (val.startsWith("\\x") || val.startsWith("0x")) {
      const hex = val.replace(/^(\\x|0x)/, "").toLowerCase()
      if (hex.startsWith("89504e47")) return true
      if (hex.startsWith("ffd8ff")) return true
      if (hex.startsWith("47494638")) return true
      if (hex.startsWith("424d")) return true
    }

    return false
  })

  const imageDataUrl = computed(() => {
    if (!isImage.value || typeof props.value !== "string") return ""
    const val = props.value as string

    if (val.startsWith("data:image/")) return val

    if (val.startsWith("\\x") || val.startsWith("0x")) {
      const hex = val.replace(/^(\\x|0x)/, "")
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
      }
      const blob = new Blob([bytes])
      return URL.createObjectURL(blob)
    }

    return ""
  })

  const displayValue = computed(() => {
    if (props.value === null) return "NULL"
    if (props.value === undefined) return ""
    if (typeof props.value === "object") {
      return JSON.stringify(props.value, null, 2)
    }
    return String(props.value)
  })

  const formattedJson = computed(() => {
    if (!isJson.value) return ""
    try {
      const parsed =
        typeof props.value === "object"
          ? props.value
          : JSON.parse(props.value as string)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return String(props.value)
    }
  })

  watch(
    () => props.value,
    () => {
      editedValue.value = displayValue.value
    },
    { immediate: true }
  )

  function handleSave() {
    let valueToSave: unknown = editedValue.value

    if (editedValue.value === "NULL" || editedValue.value === "") {
      valueToSave = null
    } else if (isJson.value) {
      try {
        valueToSave = JSON.parse(editedValue.value)
      } catch {
        valueToSave = editedValue.value
      }
    }

    emit("save", valueToSave)
    emit("update:visible", false)
  }

  function handleClose() {
    emit("update:visible", false)
  }

  function setNull() {
    editedValue.value = "NULL"
  }

  function copyValue() {
    navigator.clipboard.writeText(displayValue.value)
  }
</script>

<template>
  <Sidebar
    :visible="visible"
    @update:visible="handleClose"
    position="right"
    :header="`${columnName}${columnType ? ` (${columnType})` : ''}`"
    class="value-inspector"
  >
    <div class="inspector-content">
      <TabView v-model:activeIndex="activeTab">
        <TabPanel value="text" header="Text">
          <div class="text-view">
            <Textarea
              v-if="editable"
              v-model="editedValue"
              :rows="15"
              class="value-textarea"
              :placeholder="
                isBinary ? 'Binary data cannot be edited' : 'Enter value...'
              "
              :disabled="isBinary"
            />
            <pre v-else class="value-display">{{ displayValue }}</pre>
          </div>
        </TabPanel>
        <TabPanel v-if="isJson" value="json" header="JSON">
          <pre class="json-view">{{ formattedJson }}</pre>
        </TabPanel>
        <TabPanel v-if="isBinary" value="hex" header="Hex">
          <div class="hex-view">
            <p class="binary-notice">
              <i class="pi pi-info-circle" />
              Binary data preview not available
            </p>
          </div>
        </TabPanel>
        <TabPanel v-if="isImage" value="image" header="Image">
          <div class="image-view">
            <img
              :src="imageDataUrl"
              alt="Binary image data"
              class="preview-image"
            />
          </div>
        </TabPanel>
      </TabView>

      <div class="inspector-actions">
        <Button
          icon="pi pi-copy"
          label="Copy"
          size="small"
          outlined
          @click="copyValue"
        />
        <Button
          v-if="editable"
          icon="pi pi-ban"
          label="Set NULL"
          size="small"
          outlined
          severity="secondary"
          @click="setNull"
        />
        <div class="spacer" />
        <Button
          v-if="editable"
          icon="pi pi-check"
          label="Save"
          size="small"
          @click="handleSave"
        />
      </div>
    </div>
  </Sidebar>
</template>

<style scoped>
  .value-inspector {
    width: 450px !important;
  }

  .inspector-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .text-view,
  .json-view,
  .hex-view {
    flex: 1;
    overflow: auto;
  }

  .value-textarea {
    width: 100%;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.85rem;
  }

  .value-display {
    margin: 0;
    padding: 0.75rem;
    background: var(--p-surface-100);
    border-radius: 6px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.85rem;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .json-view {
    margin: 0;
    padding: 0.75rem;
    background: var(--p-surface-900);
    color: var(--p-green-400);
    border-radius: 6px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.85rem;
    white-space: pre-wrap;
  }

  .binary-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--p-surface-100);
    border-radius: 6px;
    color: var(--p-text-muted-color);
  }

  .inspector-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--p-surface-200);
    margin-top: 1rem;
  }

  .spacer {
    flex: 1;
  }

  .image-view {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: var(--p-surface-100);
    border-radius: 6px;
    min-height: 200px;
  }

  .preview-image {
    max-width: 100%;
    max-height: 400px;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
</style>
