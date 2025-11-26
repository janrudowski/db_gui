import { createRouter, createWebHistory } from "vue-router"
import ConnectionsView from "./views/ConnectionsView.vue"
import DatabaseView from "./views/DatabaseView.vue"

const routes = [
  {
    path: "/",
    name: "connections",
    component: ConnectionsView,
  },
  {
    path: "/database/:id",
    name: "database",
    component: DatabaseView,
    props: true,
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
