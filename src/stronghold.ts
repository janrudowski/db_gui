import { Client, Stronghold } from "@tauri-apps/plugin-stronghold"
import { appDataDir } from "@tauri-apps/api/path"

const VAULT_PASSWORD = "db_gui_vault_2024"
const CLIENT_NAME = "db_gui_client"

let strongholdInstance: Stronghold | null = null
let clientInstance: Client | null = null
let initPromise: Promise<{ stronghold: Stronghold; client: Client }> | null =
  null

async function initStronghold(): Promise<{
  stronghold: Stronghold
  client: Client
}> {
  const vaultPath = `${await appDataDir()}vault.hold`
  console.log("Loading stronghold from:", vaultPath)

  const stronghold = await Stronghold.load(vaultPath, VAULT_PASSWORD)
  console.log("Stronghold loaded")

  let client: Client
  try {
    client = await stronghold.loadClient(CLIENT_NAME)
    console.log("Client loaded")
  } catch {
    client = await stronghold.createClient(CLIENT_NAME)
    console.log("Client created")
  }

  strongholdInstance = stronghold
  clientInstance = client

  return { stronghold, client }
}

async function getStronghold(): Promise<{
  stronghold: Stronghold
  client: Client
}> {
  if (strongholdInstance && clientInstance) {
    return { stronghold: strongholdInstance, client: clientInstance }
  }

  if (!initPromise) {
    initPromise = initStronghold()
  }

  return initPromise
}

export async function savePassword(
  connectionId: string,
  password: string
): Promise<void> {
  console.log("savePassword called for:", connectionId)
  const { stronghold, client } = await getStronghold()
  const store = client.getStore()
  const data = Array.from(new TextEncoder().encode(password))
  console.log("Inserting password...")
  await store.insert(`password_${connectionId}`, data)
  console.log("Saving stronghold...")
  await stronghold.save()
  console.log("Password saved")
}

export async function getPassword(
  connectionId: string
): Promise<string | null> {
  try {
    const { client } = await getStronghold()
    const store = client.getStore()
    const data = await store.get(`password_${connectionId}`)
    if (!data || data.length === 0) return null
    return new TextDecoder().decode(new Uint8Array(data))
  } catch {
    return null
  }
}

export async function deletePassword(connectionId: string): Promise<void> {
  try {
    const { stronghold, client } = await getStronghold()
    const store = client.getStore()
    await store.remove(`password_${connectionId}`)
    await stronghold.save()
  } catch {
    // Ignore if password doesn't exist
  }
}
