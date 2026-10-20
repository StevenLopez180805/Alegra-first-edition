// Contrato de dominio que consume el worker de preparación (adaptador Inventory).
export { computeShortages, type StockSnapshot } from "./domain/shortages";
export {
  buildConsumptionTransactItems,
  buildRestockTransactItems,
  getStock,
  getStockSnapshot,
  isAlreadyConsumed,
  restock,
  type TransactItem,
} from "./repository";
