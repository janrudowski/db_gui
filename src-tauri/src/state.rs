use crate::connection::{ConnectionStore, SavedConnection};
use crate::db::{DatabaseType, DbConnection};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub connection_store: RwLock<ConnectionStore>,
    pub active_connections: RwLock<HashMap<String, Arc<dyn DbConnection>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            connection_store: RwLock::new(ConnectionStore::load()),
            active_connections: RwLock::new(HashMap::new()),
        }
    }
}

impl AppState {
    pub async fn get_connection(&self, id: &str) -> Option<Arc<dyn DbConnection>> {
        let connections = self.active_connections.read().await;
        connections.get(id).cloned()
    }

    pub async fn add_connection(&self, id: String, conn: Arc<dyn DbConnection>) {
        let mut connections = self.active_connections.write().await;
        connections.insert(id, conn);
    }

    pub async fn remove_connection(&self, id: &str) -> Option<Arc<dyn DbConnection>> {
        let mut connections = self.active_connections.write().await;
        connections.remove(id)
    }
}
