use crate::db::{ConnectionFactory, DatabaseType};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection {
    pub id: String,
    pub name: String,
    pub db_type: DatabaseType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
}

impl SavedConnection {
    pub fn new(
        name: String,
        db_type: DatabaseType,
        host: String,
        port: u16,
        database: String,
        username: String,
        password: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            db_type,
            host,
            port,
            database,
            username,
            password,
        }
    }

    pub fn connection_string(&self) -> String {
        ConnectionFactory::build_connection_string(
            self.db_type,
            &self.host,
            self.port,
            &self.database,
            &self.username,
            &self.password,
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConnectionStore {
    pub connections: Vec<SavedConnection>,
}

impl ConnectionStore {
    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Self::default()
        }
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)
    }

    pub fn add(&mut self, conn: SavedConnection) {
        self.connections.push(conn);
    }

    pub fn remove(&mut self, id: &str) {
        self.connections.retain(|c| c.id != id);
    }

    pub fn get(&self, id: &str) -> Option<&SavedConnection> {
        self.connections.iter().find(|c| c.id == id)
    }

    fn config_path() -> std::path::PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("db_gui")
            .join("connections.json")
    }
}
