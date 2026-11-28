import { isRental, type Condition } from "@/lib/domain";
import type { Money } from "@/lib/domain";
import { esNumeroUtil, formatearEntero } from "./numeros";

// Reglas de este archivo, que no son negociables:
//
// 1. La moneda NUNCA se muestra sin su símbolo o su código. "320.000" sin más
//    es una cifra que el visitante lee en la moneda que se le ocurra.
// 2. La moneda NUNCA se convierte. La API no convierte, y hacerlo en el front
//    implicaría una cotización que nadie mantiene. USD y ARS se muestran tal
//    como vienen.
// 3. Sin decimales: los precios inmobiliarios no los usan y "USD 320.000,00"
//    se lee peor.

const PREFIJO: Record<Money["currency"], string> = {
  USD: "USD",
  ARS: "$",
};

export function prefijoDeMoneda(currency: Money["currency"]): string {
  return PREFIJO[currency];
}

// Un precio en 0 no es un precio: en la práctica es una propiedad cargada sin
// valor, o "a convenir". Mostrar "$ 0" parece un error del sitio.
export const PRECIO_SIN_VALOR = "Consultar precio";

export function formatearPrecio(money: Money | null | undefined): string {
  if (money === null || money === undefined) return PRECIO_SIN_VALOR;
  if (!esNumeroUtil(money.amount) || money.amount <= 0) return PRECIO_SIN_VALOR;
  return `${prefijoDeMoneda(money.currency)} ${formatearEntero(money.amount)}`;
}

// Un alquiler mostrado como precio total es un error de lectura caro: el
// visitante cree que son 450.000 en total y no por mes.
export function formatearPrecioPorMes(
  money: Money | null | undefined,
  condition: Condition,
): string {
  const precio = formatearPrecio(money);
  if (precio === PRECIO_SIN_VALOR || !isRental(condition)) return precio;
  return `${precio} por mes`;
}

// Devuelve null cuando no hay expensas, para que el componente no dibuje la
// línea en vez de dibujarla vacía.
export function formatearExpensas(money: Money | null | undefined): string | null {
  if (money === null || money === undefined) return null;
  if (!esNumeroUtil(money.amount) || money.amount <= 0) return null;
  return `+ ${prefijoDeMoneda(money.currency)} ${formatearEntero(money.amount)} de expensas`;
}
